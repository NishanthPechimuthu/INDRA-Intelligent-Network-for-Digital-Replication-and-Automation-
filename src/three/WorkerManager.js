// Individual worker avatars placed around the workstation that owns them.
// The number comes from the editable "Assigned workers" property, and the
// animation/status colour follows the live station state instead of a random
// animation choice.

import * as THREE from 'three';
import { assetLibrary } from './AssetLibrary.js';
import { workerCount, workerLayout } from './workerLayout.js';

const STATUS_COLORS = {
  available: 0x42d6b2,
  working: 0xf0b45a,
  unavailable: 0xe25555,
};

export class WorkerManager {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'FactoryWorkers';
    scene.add(this.root);
    this.stations = new Map();
    this.factory = null;
    this.time = 0;

    this.bodyGeometry = new THREE.CylinderGeometry(0.17, 0.21, 0.72, 12);
    this.headGeometry = new THREE.SphereGeometry(0.15, 14, 10);
    this.ringGeometry = new THREE.RingGeometry(0.29, 0.38, 28);
    this.fallbackBody = new THREE.MeshStandardMaterial({
      color: 0x3f6f86,
      roughness: 0.65,
      metalness: 0.15,
    });
    this.fallbackHead = new THREE.MeshStandardMaterial({
      color: 0xe0a94f,
      roughness: 0.55,
      metalness: 0.05,
    });
  }

  _makeFallback() {
    const holder = new THREE.Group();
    const body = new THREE.Mesh(this.bodyGeometry, this.fallbackBody);
    body.position.y = 0.46;
    body.castShadow = true;
    const head = new THREE.Mesh(this.headGeometry, this.fallbackHead);
    head.position.y = 1.02;
    head.castShadow = true;
    holder.add(body, head);
    holder.userData.fallback = true;
    return holder;
  }

  _createAvatar(station, index) {
    const group = new THREE.Group();
    group.name = `worker-${station.id}-${index}`;
    const fallback = this._makeFallback();
    group.add(fallback);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: STATUS_COLORS.available,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(this.ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.raycast = () => {};
    group.add(ring);

    this.root.add(group);
    const avatar = {
      group,
      fallback,
      ring,
      ringMaterial,
      mixer: null,
      actions: null,
      currentAction: null,
      clipIdle: null,
      clipWorking: null,
      status: 'available',
      alive: true,
      timeOffset: (index % 5) * 0.37,
    };
    this._loadModel(avatar);
    return avatar;
  }

  _loadModel(avatar) {
    assetLibrary
      .get('worker', { animated: true })
      .then((asset) => {
        if (!avatar.alive || !asset) return;
        avatar.fallback.visible = false;
        avatar.group.add(asset.object);
        asset.object.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        if (asset.clips?.length) {
          const mixer = new THREE.AnimationMixer(asset.object);
          const idleClip = asset.clipMap.idle || asset.clips[0];
          const workingClip = asset.clipMap.working || idleClip;
          const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
          const workingAction = workingClip ? mixer.clipAction(workingClip) : null;
          if (idleAction) idleAction.play();
          avatar.mixer = mixer;
          avatar.actions = { idle: idleAction, working: workingAction };
          avatar.currentAction = idleAction;
          this._applyAnimation(avatar, avatar.status);
        }
      })
      .catch(() => {
        // The procedural fallback remains visible.
      });
  }

  _applyAnimation(avatar, status) {
    if (!avatar.actions) {
      avatar.status = status;
      return;
    }
    const target = status === 'working' ? avatar.actions.working : avatar.actions.idle;
    if (!target) return;
    if (avatar.currentAction !== target) {
      target.reset();
      target.enabled = true;
      target.setEffectiveTimeScale(status === 'unavailable' ? 0.35 : 1);
      target.setEffectiveWeight(1);
      target.play();
      if (avatar.currentAction) target.crossFadeFrom(avatar.currentAction, 0.25, false);
      avatar.currentAction = target;
    }
    target.setEffectiveTimeScale(status === 'unavailable' ? 0.35 : status === 'working' ? 1.15 : 1);
    avatar.status = status;
  }

  _setStatus(avatar, status) {
    if (avatar.status === status) return;
    avatar.status = status;
    avatar.ringMaterial.color.setHex(STATUS_COLORS[status]);
    this._applyAnimation(avatar, status);
  }

  _layout(station, avatars) {
    const positions = workerLayout(station, avatars.length);
    for (let index = 0; index < avatars.length; index += 1) {
      const avatar = avatars[index];
      const position = positions[index];
      if (!position) return;
      avatar.group.position.set(position.x, position.y, position.z);
      avatar.group.rotation.y = position.rotationY;
    }
  }

  sync(factory, simulation) {
    this.factory = factory;
    const live = new Map((simulation?.stations || []).map((station) => [station.id, station]));
    const wanted = new Set();

    for (const component of factory.components) {
      if (component.type !== 'workstation') continue;
      const count = workerCount(component);
      if (!count) continue;
      wanted.add(component.id);

      let entry = this.stations.get(component.id);
      if (!entry) {
        entry = { avatars: [] };
        this.stations.set(component.id, entry);
      }
      while (entry.avatars.length < count) {
        entry.avatars.push(this._createAvatar(component, entry.avatars.length));
      }
      while (entry.avatars.length > count) {
        const avatar = entry.avatars.pop();
        this._removeAvatar(avatar);
      }

      const liveStation = live.get(component.id);
      const unavailable =
        liveStation?.state === 'down' ||
        liveStation?.state === 'off-shift' ||
        liveStation?.workerState === 'unavailable';
      const active = Math.max(0, liveStation?.activeWorkers ?? 0);
      for (let index = 0; index < entry.avatars.length; index += 1) {
        const avatar = entry.avatars[index];
        let status = 'available';
        if (unavailable) status = 'unavailable';
        else if (liveStation && index < active) status = 'working';
        this._setStatus(avatar, status);
      }
      this._layout(component, entry.avatars);
    }

    for (const [id, entry] of this.stations) {
      if (wanted.has(id)) continue;
      for (const avatar of entry.avatars) this._removeAvatar(avatar);
      this.stations.delete(id);
    }
  }

  _removeAvatar(avatar) {
    avatar.alive = false;
    avatar.mixer?.stopAllAction();
    this.root.remove(avatar.group);
    avatar.ringMaterial.dispose();
    if (avatar.fallback) {
      for (const child of avatar.fallback.children) child.geometry = null;
    }
  }

  update(delta) {
    this.time += delta;
    for (const entry of this.stations.values()) {
      for (const avatar of entry.avatars) {
        avatar.mixer?.update(delta);
        if (!avatar.mixer) {
          const bob = avatar.status === 'working' ? Math.sin((this.time + avatar.timeOffset) * 5) * 0.035 : 0;
          avatar.fallback.position.y = bob;
          avatar.ringMaterial.opacity = 0.65 + Math.sin((this.time + avatar.timeOffset) * 2) * 0.15;
        }
      }
    }
  }

  /** Read-only summary used by diagnostics and browser tests. */
  debug() {
    return {
      stations: [...this.stations.entries()].map(([id, entry]) => ({
        id,
        count: entry.avatars.length,
        statuses: entry.avatars.map((avatar) => avatar.status),
        loaded: entry.avatars.filter((avatar) => avatar.mixer).length,
        positions: entry.avatars.map((avatar) => ({
          x: Number(avatar.group.position.x.toFixed(2)),
          z: Number(avatar.group.position.z.toFixed(2)),
        })),
      })),
    };
  }

  clear() {
    for (const entry of this.stations.values()) {
      for (const avatar of entry.avatars) this._removeAvatar(avatar);
    }
    this.stations.clear();
  }

  dispose() {
    this.clear();
    this.bodyGeometry.dispose();
    this.headGeometry.dispose();
    this.ringGeometry.dispose();
    this.fallbackBody.dispose();
    this.fallbackHead.dispose();
    this.scene.remove(this.root);
  }
}
