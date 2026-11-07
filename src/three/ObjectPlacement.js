// Placement ghost, grid-cell highlight and snapping helpers.

import * as THREE from 'three';
import { createGhost, disposeGhost, setGhostCell } from './ObjectFactory.js';

export class ObjectPlacement {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'PlacementPreview';
    scene.add(this.root);
    this.type = null;
    this.ghost = null;
  }

  show(type, point, factory) {
    if (!type) {
      this.hide();
      return;
    }
    if (this.type !== type) {
      this.disposeGhost();
      this.ghost = createGhost(type);
      this.root.add(this.ghost);
      this.type = type;
    }
    const { grid } = factory;
    const snapped = this.snap(point, grid.snap, grid.spacing);
    this.ghost.visible = true;
    this.ghost.position.set(snapped.x, 0, snapped.z);
    setGhostCell(this.ghost, grid.snap, grid.spacing);
    return snapped;
  }

  hide() {
    if (this.ghost) this.ghost.visible = false;
    this.type = null;
  }

  snap(point, snap, spacing) {
    if (!snap || !spacing) return { x: point.x, z: point.z };
    return {
      x: Math.round(point.x / spacing) * spacing,
      z: Math.round(point.z / spacing) * spacing,
    };
  }

  disposeGhost() {
    if (this.ghost) {
      disposeGhost(this.ghost);
      this.root.remove(this.ghost);
      this.ghost = null;
      this.type = null;
    }
  }

  dispose() {
    this.disposeGhost();
    this.scene.remove(this.root);
  }
}
