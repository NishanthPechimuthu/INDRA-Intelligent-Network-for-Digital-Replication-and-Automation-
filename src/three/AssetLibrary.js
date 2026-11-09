// Asynchronous, cached GLB loading and normalisation for the Three.js scene.
// The cache stores one GLTF template per asset key; scene objects are clones.
// A failed asset never prevents the factory from rendering: the procedural
// ObjectFactory visual remains visible as the fallback.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLB_MODELS, modelForComponent } from '../data/assetManifest.js';

const moduleUrls = import.meta.glob('../../assets/glb/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
});

const textureUrls = import.meta.glob('../../assets/glb/Textures/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

function baseName(path) {
  return String(path).split('/').pop();
}

const urlByFile = new Map();
for (const [path, url] of Object.entries(moduleUrls)) {
  urlByFile.set(baseName(path), url);
}

const colormapUrl =
  Object.entries(textureUrls).find(([path]) => baseName(path) === 'colormap.png')?.[1] || null;

function normaliseName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function pickClip(clips, candidates) {
  const byName = new Map(clips.map((clip) => [normaliseName(clip.name), clip]));
  for (const candidate of candidates) {
    const found = byName.get(normaliseName(candidate));
    if (found) return found;
  }
  return null;
}

function setShadows(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        material.envMapIntensity = 0.65;
        material.needsUpdate = true;
      }
    }
  });
}

function normaliseTemplate(scene, spec) {
  // Do not use scene.clone() here: it breaks skinned meshes because the clone
  // keeps skeleton bone references from the original hierarchy. The parsed
  // scene is normalised in place and becomes the single cached template; every
  // scene instance is cloned later with SkeletonUtils.clone().
  const source = scene;
  source.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(source);
  const size = new THREE.Vector3();
  box.getSize(size);
  const safe = (value) => (Number.isFinite(value) && value > 1e-5 ? value : 1);
  const [targetX, targetY, targetZ] = spec.target || [1, 1, 1];
  const scale = Math.min(
    targetX / safe(size.x),
    targetY / safe(size.y),
    targetZ / safe(size.z),
  );

  const holder = new THREE.Group();
  holder.name = `asset-${spec.key}`;
  source.scale.setScalar(scale);
  source.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(source);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  source.position.x -= center.x;
  source.position.z -= center.z;
  source.position.y -= scaledBox.min.y;
  holder.add(source);

  if (spec.rotationY) holder.rotation.y = spec.rotationY;
  holder.userData.normalised = true;
  holder.userData.assetKey = spec.key;
  setShadows(holder);
  return holder;
}

export class AssetLibrary {
  constructor() {
    this.cache = new Map();
    this.failures = new Map();
    this.loaded = new Set();
    this.loading = new Set();
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) listener(this.status());
  }

  status() {
    return {
      loaded: this.loaded.size,
      required: Object.keys(GLB_MODELS).length,
      failures: [...this.failures.keys()],
      loading: this.loading.size,
    };
  }

  urlFor(key) {
    const spec = GLB_MODELS[key];
    if (!spec) return null;
    return urlByFile.get(spec.file) || null;
  }

  modelSpecForComponent(component) {
    return modelForComponent(component);
  }

  /** Load (or return the cached template for) one asset key. */
  load(key) {
    const spec = GLB_MODELS[key];
    if (!spec) return Promise.resolve(null);
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.failures.has(key)) return Promise.resolve(null);

    const url = this.urlFor(key);
    if (!url) {
      const error = new Error(`Bundled GLB not found for ${key} (${spec.file})`);
      this.failures.set(key, error.message);
      this.emit();
      return Promise.resolve(null);
    }

    this.loading.add(key);
    this.emit();

    const promise = new Promise((resolve) => {
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((requested) => {
        if (colormapUrl && /(?:^|\/)colormap\.png(?:\?|$)/i.test(requested)) return colormapUrl;
        if (colormapUrl && /Textures\//i.test(requested)) {
          const fileName = baseName(requested.split('?')[0]);
          const match = Object.entries(textureUrls).find(([path]) => baseName(path) === fileName);
          if (match) return match[1];
        }
        return requested;
      });
      const loader = new GLTFLoader(manager);
      loader.load(
        url,
        (gltf) => {
          try {
            const template = normaliseTemplate(gltf.scene, spec);
            const clips = gltf.animations || [];
            const entry = {
              key,
              spec,
              template,
              clips,
              clipMap: {
                idle: pickClip(clips, ['Idle']),
                working: pickClip(clips, ['PickUp', 'Punch']),
                inspecting: pickClip(clips, ['PickUp']),
                material: pickClip(clips, ['Walk_Carry', 'Run_Carry', 'PickUp']),
              },
              url,
            };
            this.cache.set(key, Promise.resolve(entry));
            this.loaded.add(key);
            this.loading.delete(key);
            this.emit();
            resolve(entry);
          } catch (error) {
            this.failures.set(key, String(error?.message || error));
            this.loading.delete(key);
            this.emit();
            resolve(null);
          }
        },
        undefined,
        (error) => {
          this.failures.set(key, String(error?.message || error || 'GLB load failed'));
          this.loading.delete(key);
          this.emit();
          resolve(null);
        },
      );
    });

    this.cache.set(key, promise);
    return promise;
  }

  async get(key, { animated = false } = {}) {
    const entry = await this.load(key);
    if (!entry) return null;
    // SkeletonUtils.clone is required whenever the template contains a
    // SkinnedMesh; ordinary Object3D.clone cannot rebind skeleton bones.
    let skinned = animated;
    entry.template.traverse((child) => {
      if (child.isSkinnedMesh) skinned = true;
    });
    const object = skinned ? cloneSkeleton(entry.template) : entry.template.clone(true);
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return { object, clips: entry.clips, clipMap: entry.clipMap, spec: entry.spec };
  }

  async getForComponent(component) {
    const spec = modelForComponent(component);
    if (!spec) return null;
    return this.get(spec.key, { animated: Boolean(spec.animated) });
  }

  async preload() {
    await Promise.all(Object.keys(GLB_MODELS).map((key) => this.load(key)));
    return this.status();
  }

  dispose() {
    this.cache.clear();
    this.loaded.clear();
    this.failures.clear();
    this.loading.clear();
    this.listeners.clear();
  }
}

export const assetLibrary = new AssetLibrary();
