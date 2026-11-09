// Binds cached GLB models to factory visuals. Loading is asynchronous and the
// procedural ObjectFactory body stays visible until the model is ready, so a
// missing or broken asset degrades gracefully instead of hiding the object.

import * as THREE from 'three';
import { assetLibrary } from './AssetLibrary.js';
import { modelForComponent } from '../data/assetManifest.js';

function showProcedural(visual, visible) {
  for (const mesh of visual.proceduralMeshes || []) {
    if (visual.panel && mesh === visual.panel) continue;
    mesh.visible = visible;
  }
}

export function bindVisualModel(visual, component, library = assetLibrary) {
  if (!visual || visual.disposed) return;
  const spec = modelForComponent(component);
  if (!spec) return;
  if (visual.assetKey === spec.key && (visual.model || visual.assetError)) return;

  visual.assetKey = spec.key;
  visual.assetError = null;
  visual.modelRoot.clear();
  visual.model = null;
  showProcedural(visual, true);

  const currentKey = spec.key;
  library
    .get(currentKey, { animated: Boolean(spec.animated) })
    .then((asset) => {
      if (!visual || visual.disposed || visual.assetKey !== currentKey) return;
      if (!asset) {
        visual.assetError = library.failures.get(currentKey) || 'asset unavailable';
        showProcedural(visual, true);
        return;
      }

      visual.modelRoot.clear();
      visual.modelRoot.add(asset.object);
      visual.model = asset.object;
      showProcedural(visual, false);

      if (component.type === 'display' && visual.panel) {
        // Keep the live metric screen in front of the physical HMI model.
        visual.panel.visible = true;
        visual.panel.position.y = 1.55;
        visual.panel.scale.set(0.62, 0.62, 1);
      }

      if (spec.animated && asset.clips.length) {
        const mixer = new THREE.AnimationMixer(asset.object);
        const clip = asset.clipMap.idle || asset.clips[0];
        if (clip) mixer.clipAction(clip).play();
        visual.mixer = mixer;
      }
    })
    .catch((error) => {
      if (!visual || visual.disposed) return;
      visual.assetError = String(error?.message || error);
      showProcedural(visual, true);
    });
}

export function updateVisualMixers(visuals, deltaSeconds) {
  for (const visual of visuals) {
    visual.mixer?.update(deltaSeconds);
  }
}
