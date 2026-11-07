// TransformControls integration and gizmo state.

import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export class ObjectTransform {
  constructor(camera, domElement, scene, callbacks = {}) {
    this.callbacks = callbacks;
    this.controls = new TransformControls(camera, domElement);
    this.controls.setSize(0.85);
    this.controls.setSpace('world');
    this.helper = this.controls.getHelper();
    this.helper.raycast = () => {};
    scene.add(this.helper);
    this.mode = 'translate';
    this.attachedId = null;
    this.dragging = false;

    this.controls.addEventListener('dragging-changed', (event) => {
      this.dragging = Boolean(event.value);
      if (event.value) this.callbacks.onDragStart?.(this.attachedId);
      else this.callbacks.onDragEnd?.(this.attachedId);
      this.callbacks.onDraggingChanged?.(Boolean(event.value));
    });

    this.controls.addEventListener('objectChange', () => {
      const object = this.controls.object;
      const id = object?.userData?.nodeId;
      if (!id) return;
      this.callbacks.onChange?.(id, {
        position: {
          x: round(object.position.x),
          y: round(object.position.y),
          z: round(object.position.z),
        },
        rotation: {
          x: round(object.rotation.x),
          y: round(object.rotation.y),
          z: round(object.rotation.z),
        },
        scale: {
          x: round(Math.max(0.01, object.scale.x)),
          y: round(Math.max(0.01, object.scale.y)),
          z: round(Math.max(0.01, object.scale.z)),
        },
      });
    });

    this.setMode('translate');
  }

  setCamera(camera) {
    this.controls.camera = camera;
  }

  attach(id, group) {
    if (!group) {
      this.detach();
      return;
    }
    if (this.attachedId === id && this.controls.object === group) return;
    this.attachedId = id;
    this.controls.attach(group);
    this.helper.visible = true;
  }

  detach() {
    this.attachedId = null;
    this.controls.detach();
    this.helper.visible = false;
  }

  setMode(mode) {
    this.mode = mode;
    this.controls.setMode(mode);
    this.controls.showX = mode !== 'rotate';
    this.controls.showZ = mode !== 'rotate';
    this.controls.showY = true;
    if (mode === 'rotate') {
      this.controls.showX = false;
      this.controls.showY = true;
      this.controls.showZ = false;
      this.controls.rotationSnap = Math.PI / 12;
    } else {
      this.controls.rotationSnap = null;
    }
    if (mode === 'scale') {
      this.controls.scaleSnap = 0.1;
    } else {
      this.controls.scaleSnap = null;
    }
  }

  setSnap(enabled, spacing) {
    this.controls.translationSnap = enabled ? Math.max(0.05, spacing) : null;
    this.controls.rotationSnap = this.mode === 'rotate' ? Math.PI / 12 : null;
  }

  setEnabled(enabled) {
    this.controls.enabled = enabled;
    this.helper.visible = enabled && Boolean(this.controls.object);
  }

  dispose() {
    this.controls.detach();
    this.controls.dispose();
    this.helper.removeFromParent();
  }
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
