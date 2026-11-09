// Product tokens rendered from the live simulation snapshot. Every position is
// derived from the real material connection or the queue/process slot recorded
// by ProductionEngine, so products never teleport between stations.

import * as THREE from 'three';

const COLORS = {
  moving: 0x5ec8e8,
  queued: 0x9fb7c9,
  processing: 0xf0b45a,
  done: 0x4fda9e,
  rejected: 0xe25555,
  blocked: 0xe09a4f,
};

function stateColor(product) {
  if (product.rejected) return COLORS.rejected;
  if (product.state === 'done') return COLORS.done;
  if (product.state === 'processing') return COLORS.processing;
  if (product.state === 'moving') return COLORS.moving;
  if (product.state === 'blocked') return COLORS.blocked;
  return COLORS.queued;
}

function quadratic(start, end, t, lift = 0.65) {
  const distance = start.distanceTo(end);
  const mid = start.clone().lerp(end, 0.5);
  mid.y += Math.min(2.4, lift + distance * 0.09);
  const one = 1 - t;
  return new THREE.Vector3(
    one * one * start.x + 2 * one * t * mid.x + t * t * end.x,
    one * one * start.y + 2 * one * t * mid.y + t * t * end.y,
    one * one * start.z + 2 * one * t * mid.z + t * t * end.z,
  );
}

function stableOffset(id) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997;
  }
  return (hash / 997 - 0.5) * 0.55;
}

export class ProductManager {
  constructor(scene, objectManager) {
    this.scene = scene;
    this.objectManager = objectManager;
    this.root = new THREE.Group();
    this.root.name = 'SimulationProducts';
    scene.add(this.root);
    this.factory = null;
    this.products = new Map();
    this.geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    this.materials = new Map();
    for (const [name, color] of Object.entries(COLORS)) {
      this.materials.set(
        name,
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.28,
          roughness: 0.35,
          metalness: 0.25,
        }),
      );
    }
  }

  _material(product) {
    if (product.rejected) return this.materials.get('rejected');
    if (product.state === 'done') return this.materials.get('done');
    if (product.state === 'processing') return this.materials.get('processing');
    if (product.state === 'moving') return this.materials.get('moving');
    if (product.state === 'blocked') return this.materials.get('blocked');
    return this.materials.get('queued');
  }

  _component(id) {
    return this.factory?.components.find((component) => component.id === id) || null;
  }

  _center(id) {
    const component = this._component(id);
    if (!component) return new THREE.Vector3();
    return new THREE.Vector3(component.position.x, component.position.y + 0.7, component.position.z);
  }

  _port(id, kind) {
    const world = this.objectManager.portWorldPosition(id, kind);
    if (world) return world.clone();
    return this._center(id);
  }

  _positionFor(product) {
    const location = product.location;
    if (!location) return this._center(product.sourceId);
    if (location.kind === 'transfer') {
      const start = this._port(location.from, 'material-out');
      const end = this._port(location.to, 'material-in');
      return quadratic(start, end, Math.min(1, Math.max(0, location.t ?? 0)));
    }
    if (location.kind === 'conveyor') {
      const start = this._port(location.nodeId, 'material-in');
      const end = this._port(location.nodeId, 'material-out');
      return quadratic(start, end, Math.min(1, Math.max(0, location.t ?? 0)), 0.18);
    }
    if (location.kind === 'processing') {
      const center = this._center(location.nodeId);
      const slot = location.slotIndex || 0;
      center.y = 0.95;
      center.x += (slot - 0.35) * 0.4;
      center.z += 0.3;
      return center;
    }
    if (location.kind === 'queue') {
      const component = this._component(location.nodeId);
      if (!component) return this._center(location.nodeId);
      if (component.type === 'buffer') {
        const index = location.index || 0;
        const layer = Math.floor(index / 8);
        return new THREE.Vector3(
          component.position.x - 0.33 + (index % 4) * 0.22,
          0.5 + layer * 0.28,
          component.position.z - 0.26 + (Math.floor(index / 4) % 2) * 0.44,
        );
      }
      const incoming = this._port(location.nodeId, 'material-in');
      const direction = incoming.clone().sub(new THREE.Vector3(
        component.position.x,
        component.position.y + 0.7,
        component.position.z,
      ));
      direction.y = 0;
      if (direction.lengthSq() < 1e-4) direction.set(-1, 0, 0);
      direction.normalize();
      const index = location.index || 0;
      return new THREE.Vector3(
        component.position.x + direction.x * (0.95 + index * 0.22),
        0.62,
        component.position.z + direction.z * (0.95 + index * 0.22),
      );
    }
    if (location.kind === 'rejected') {
      const center = this._center(location.nodeId);
      center.x += stableOffset(product.id) - 0.7;
      center.y = 0.35;
      return center;
    }
    if (location.kind === 'output') {
      const center = this._center(location.nodeId);
      center.x += stableOffset(product.id);
      center.y = 0.85;
      center.z += stableOffset(`${product.id}z`);
      return center;
    }
    return this._center(product.sourceId);
  }

  sync(factory, simulation) {
    this.factory = factory;
    const wanted = new Set();
    const products = simulation?.products || [];
    for (const product of products) {
      wanted.add(product.id);
      let token = this.products.get(product.id);
      if (!token) {
        const mesh = new THREE.Mesh(this.geometry, this._material(product));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.productId = product.id;
        const target = this._positionFor(product);
        mesh.position.copy(target);
        this.root.add(mesh);
        token = { mesh, target, state: product.state, rejected: product.rejected };
        this.products.set(product.id, token);
      }
      token.mesh.material = this._material(product);
      token.target = this._positionFor(product);
      token.mesh.visible = true;
      if (product.rejected) {
        token.mesh.rotation.y = 0.7;
        token.mesh.scale.set(0.85, 0.85, 0.85);
      } else if (product.state === 'processing') {
        token.mesh.rotation.y += 0;
        token.mesh.scale.set(0.92, 0.92, 0.92);
      } else {
        token.mesh.rotation.y = 0;
        token.mesh.scale.set(1, 1, 1);
      }
    }
    for (const [id, token] of this.products) {
      if (!wanted.has(id)) {
        this.root.remove(token.mesh);
        this.products.delete(id);
      }
    }
  }

  update(delta) {
    const alpha = Math.min(1, Math.max(0.08, delta * 12));
    for (const token of this.products.values()) {
      token.mesh.position.lerp(token.target, alpha);
    }
  }

  clear() {
    for (const token of this.products.values()) this.root.remove(token.mesh);
    this.products.clear();
  }

  /** Read-only summary used by diagnostics and browser tests. */
  debug() {
    return {
      count: this.products.size,
      products: [...this.products.entries()].slice(0, 40).map(([id, token]) => ({
        id,
        x: Number(token.mesh.position.x.toFixed(2)),
        y: Number(token.mesh.position.y.toFixed(2)),
        z: Number(token.mesh.position.z.toFixed(2)),
        target: {
          x: Number(token.target.x.toFixed(2)),
          y: Number(token.target.y.toFixed(2)),
          z: Number(token.target.z.toFixed(2)),
        },
      })),
    };
  }

  dispose() {
    this.clear();
    this.geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.scene.remove(this.root);
  }
}
