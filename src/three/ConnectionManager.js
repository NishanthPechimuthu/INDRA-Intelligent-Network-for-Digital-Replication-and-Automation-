// Visual connection graph: ports, curved links, drag-to-connect preview and picking.

import * as THREE from 'three';

const MATERIAL_COLOR = 0x52c9ad;
const WORKER_COLOR = 0xe3a13d;
const INVALID_COLOR = 0xe25555;

function makeCurve(start, end) {
  const distance = start.distanceTo(end);
  const mid = start.clone().lerp(end, 0.5);
  mid.y += Math.min(2.4, 0.55 + distance * 0.09);
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

export class ConnectionManager {
  constructor(scene, objectManager, callbacks = {}) {
    this.scene = scene;
    this.objectManager = objectManager;
    this.callbacks = callbacks;
    this.root = new THREE.Group();
    this.root.name = 'FactoryConnections';
    scene.add(this.root);
    this.links = new Map();
    this.hoveredId = null;
    this.pending = null;
    this.portHitMaterial = new THREE.MeshBasicMaterial({
      color: MATERIAL_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.previewMaterial = new THREE.LineBasicMaterial({
      color: MATERIAL_COLOR,
      transparent: true,
      opacity: 0.9,
    });
    this.previewLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]), this.previewMaterial);
    this.previewLine.visible = false;
    this.previewLine.frustumCulled = false;
    this.scene.add(this.previewLine);
  }

  sync(factory, connectMode = false) {
    const present = new Set();
    for (const edge of factory.connections) {
      present.add(edge.id);
      const fromKind = edge.kind === 'worker' ? 'worker-out' : 'material-out';
      const toKind = edge.kind === 'worker' ? 'worker-in' : 'material-in';
      const from = this.objectManager.portWorldPosition(edge.from, fromKind);
      const to = this.objectManager.portWorldPosition(edge.to, toKind);
      if (!from || !to) continue;
      const key = `${from.x.toFixed(3)},${from.y.toFixed(3)},${from.z.toFixed(3)}|${to.x.toFixed(3)},${to.y.toFixed(3)},${to.z.toFixed(3)}`;
      let link = this.links.get(edge.id);
      if (!link) {
        link = this.createLink(edge, from, to, key);
        this.links.set(edge.id, link);
      } else if (link.key !== key || link.kind !== (edge.kind || 'material')) {
        this.rebuildLink(link, edge, from, to, key);
      }
    }
    for (const [id, link] of this.links) {
      if (!present.has(id)) {
        this.removeLink(link);
        this.links.delete(id);
      }
    }
    if (this.hoveredId && !present.has(this.hoveredId)) this.setHoveredConnection(null);
  }

  createLink(edge, from, to, key) {
    const kind = edge.kind || 'material';
    const color = kind === 'worker' ? WORKER_COLOR : MATERIAL_COLOR;
    const group = new THREE.Group();
    group.userData.connectionId = edge.id;

    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78 });
    const curve = makeCurve(from, to);
    const geometry = new THREE.TubeGeometry(curve, 20, 0.035, 6, false);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.connectionId = edge.id;
    group.add(mesh);

    const pickGeometry = new THREE.TubeGeometry(curve, 20, 0.16, 4, false);
    const pickMaterial = this.portHitMaterial.clone();
    const pick = new THREE.Mesh(pickGeometry, pickMaterial);
    pick.userData.connectionId = edge.id;
    group.add(pick);

    const coneMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 8), coneMaterial);
    orientCone(cone, curve);
    group.add(cone);

    this.root.add(group);
    const link = {
      id: edge.id,
      kind,
      key,
      group,
      mesh,
      material,
      geometry,
      pick,
      pickGeometry,
      pickMaterial,
      cone,
      coneMaterial,
      endpoints: [from, to],
    };
    this.applyLinkColor(link);
    return link;
  }

  rebuildLink(link, edge, from, to, key) {
    const kind = edge.kind || 'material';
    link.kind = kind;
    link.key = key;
    link.endpoints = [from, to];
    const curve = makeCurve(from, to);
    link.geometry.dispose();
    link.geometry = new THREE.TubeGeometry(curve, 20, 0.035, 6, false);
    link.mesh.geometry = link.geometry;
    link.pickGeometry.dispose();
    link.pickGeometry = new THREE.TubeGeometry(curve, 20, 0.16, 4, false);
    link.pick.geometry = link.pickGeometry;
    orientCone(link.cone, curve);
    this.applyLinkColor(link);
  }

  applyLinkColor(link) {
    const hovered = this.hoveredId === link.id;
    const base = link.kind === 'worker' ? WORKER_COLOR : MATERIAL_COLOR;
    const color = hovered ? 0xffffff : base;
    link.material.color.setHex(color);
    link.material.opacity = hovered ? 1 : 0.78;
    link.coneMaterial.color.setHex(color);
  }

  removeLink(link) {
    this.root.remove(link.group);
    link.geometry.dispose();
    link.material.dispose();
    link.pickGeometry.dispose();
    link.pickMaterial.dispose();
    link.cone.geometry.dispose();
    link.coneMaterial.dispose();
  }

  pickPort(raycaster) {
    const hits = raycaster.intersectObjects(this.objectManager.getPorts(), false);
    if (!hits.length) return null;
    const hit = hits[0].object;
    return { mesh: hit, port: hit.userData.port, point: hits[0].point };
  }

  pickConnection(raycaster) {
    const picks = [];
    for (const link of this.links.values()) picks.push(link.pick);
    const hits = raycaster.intersectObjects(picks, false);
    if (!hits.length) return null;
    return hits[0].object.userData.connectionId || null;
  }

  startPending(portHit) {
    const kind = portHit.port?.kind;
    if (kind !== 'material-out' && kind !== 'worker-out') return false;
    this.cancelPending();
    const start = this.objectManager.portWorldPosition(portHit.port.nodeId, kind);
    if (!start) return false;
    this.pending = {
      fromNodeId: portHit.port.nodeId,
      fromKind: kind,
      targetKind: kind === 'worker-out' ? 'worker-in' : 'material-in',
      kind: kind === 'worker-out' ? 'worker' : 'material',
      start,
    };
    this.previewLine.geometry.setFromPoints([start, start.clone().add(new THREE.Vector3(0, 1, 0))]);
    this.previewLine.visible = true;
    this.previewLine.frustumCulled = false;
    return true;
  }

  updatePending(worldPoint, targetPort) {
    if (!this.pending) return;
    let end = worldPoint.clone();
    let valid = true;
    if (targetPort) {
      const candidate = this.objectManager.portWorldPosition(
        targetPort.userData.port.nodeId,
        targetPort.userData.port.kind,
      );
      if (candidate) end = candidate;
      const kindMatches =
        targetPort.userData.port.kind === this.pending.targetKind &&
        targetPort.userData.port.nodeId !== this.pending.fromNodeId;
      const validation = kindMatches
        ? this.callbacks.validate?.(this.pending.fromNodeId, targetPort.userData.port.nodeId, this.pending.kind)
        : null;
      valid = Boolean(kindMatches && (validation ? validation.ok : true));
      this.pending.validation = validation;
      this.pending.targetNodeId = targetPort.userData.port.nodeId;
    } else {
      valid = true;
      this.pending.validation = null;
      this.pending.targetNodeId = null;
    }
    if (this.pending.targetPortMesh) {
      this.pending.targetPortMesh.scale.setScalar(1);
      this.pending.targetPortMesh = null;
    }
    if (targetPort && valid) {
      targetPort.scale.setScalar(1.55);
      this.pending.targetPortMesh = targetPort;
    }
    const points = [this.pending.start, end];
    this.previewLine.geometry.setFromPoints(points);
    this.previewLine.geometry.attributes.position.needsUpdate = true;
    this.previewMaterial.color.setHex(targetPort && !valid ? INVALID_COLOR : MATERIAL_COLOR);
    this.pending.hoverValid = valid;
    this.pending.end = end;
  }

  finalizePending(targetPort) {
    if (!this.pending) return null;
    const pending = this.pending;
    if (!targetPort || targetPort.userData.port.kind !== pending.targetKind) {
      this.cancelPending();
      return null;
    }
    const fromNode = pending.fromNodeId;
    const toNode = targetPort.userData.port.nodeId;
    const validation = this.callbacks.validate?.(fromNode, toNode, pending.kind);
    this.cancelPending();
    if (fromNode === toNode) return null;
    if (validation && !validation.ok) {
      this.callbacks.onInvalid?.(validation.error);
      return null;
    }
    return { from: fromNode, to: toNode, kind: pending.kind };
  }

  cancelPending() {
    if (this.pending?.targetPortMesh) {
      this.pending.targetPortMesh.scale.setScalar(1);
    }
    this.pending = null;
    this.previewLine.visible = false;
    this.previewMaterial.color.setHex(MATERIAL_COLOR);
  }

  setHoveredConnection(id) {
    if (this.hoveredId === id) return;
    this.hoveredId = id;
    for (const link of this.links.values()) this.applyLinkColor(link);
    const link = id ? this.links.get(id) : null;
    if (link) {
      // Find endpoints in factory connections via stored link id.
      const edge = this.callbacks.getConnection?.(id);
      if (edge) this.objectManager.setConnectionHighlights([edge.from, edge.to]);
    } else {
      this.objectManager.setConnectionHighlights([]);
    }
  }

  getHoveredEdgeObjects() {
    if (!this.hoveredId) return null;
    return this.callbacks.getConnection?.(this.hoveredId) || null;
  }

  dispose() {
    for (const link of this.links.values()) this.removeLink(link);
    this.links.clear();
    this.cancelPending();
    this.previewLine.geometry.dispose();
    this.previewMaterial.dispose();
    this.scene.remove(this.previewLine);
    this.portHitMaterial.dispose();
    this.scene.remove(this.root);
  }
}

function orientCone(cone, curve) {
  const end = curve.getPointAt(1);
  const tangent = curve.getTangentAt(1).normalize();
  cone.position.copy(end).sub(tangent.clone().multiplyScalar(0.06));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
}
