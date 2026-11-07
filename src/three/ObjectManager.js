// Incremental lifecycle management for factory object visuals.

import * as THREE from 'three';
import {
  createVisual,
  disposeVisual,
  setPortsForSelection,
  setVisualHighlight,
  updateAnalyticPanel,
  updateVisualLabel,
} from './ObjectFactory.js';

export class ObjectManager {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'FactoryObjects';
    scene.add(this.root);
    this.visuals = new Map();
    this.result = null;
    this.selection = new Set();
    this.connectionHighlights = new Set();
    this.hoverId = null;
  }

  sync(factory, selection, options = {}) {
    const wanted = new Set();
    this.selection = new Set(selection || []);
    if (options.connectionHighlights) {
      this.connectionHighlights = new Set(options.connectionHighlights);
    }
    this.hoverId = options.hoverId ?? this.hoverId;
    this.result = options.result || null;

    for (const component of factory.components) {
      wanted.add(component.id);
      let visual = this.visuals.get(component.id);
      if (visual && visual.type !== component.type) {
        disposeVisual(visual);
        this.visuals.delete(component.id);
        visual = null;
      }
      if (!visual) {
        visual = createVisual(component);
        this.visuals.set(component.id, visual);
        this.root.add(visual.group);
      }

      const { position, rotation, scale } = component;
      visual.group.position.set(position.x, position.y, position.z);
      visual.group.rotation.set(rotation.x, rotation.y, rotation.z);
      visual.group.scale.set(scale.x, scale.y, scale.z);

      updateVisualLabel(visual, component);
      setPortsForSelection(visual, this.selection.has(component.id));

      if (visual.panel) {
        updateAnalyticPanel(visual, component.props.metric || 'throughput', this.result);
      }

      let mode = 'none';
      if (this.selection.has(component.id)) mode = 'selected';
      else if (this.connectionHighlights.has(component.id)) mode = 'connected';
      else if (this.hoverId === component.id) mode = 'hover';
      setVisualHighlight(visual, mode);
    }

    for (const [id, visual] of this.visuals) {
      if (!wanted.has(id)) {
        disposeVisual(visual);
        this.visuals.delete(id);
      }
    }
  }

  getVisual(id) {
    return this.visuals.get(id);
  }

  getGroup(id) {
    return this.visuals.get(id)?.group;
  }

  getPorts() {
    const ports = [];
    for (const visual of this.visuals.values()) {
      for (const port of visual.ports) ports.push(port);
    }
    return ports;
  }

  getNodePorts(nodeId, kind) {
    const visual = this.visuals.get(nodeId);
    if (!visual) return [];
    return visual.ports.filter((port) => !kind || port.userData.port?.kind === kind);
  }

  portWorldPosition(nodeId, kind) {
    const port = this.getNodePorts(nodeId, kind)[0];
    if (!port) return null;
    port.updateWorldMatrix(true, false);
    return port.getWorldPosition(new THREE.Vector3());
  }

  setHover(id) {
    this.hoverId = id;
    for (const [visualId, visual] of this.visuals) {
      let mode = 'none';
      if (this.selection.has(visualId)) mode = 'selected';
      else if (this.connectionHighlights.has(visualId)) mode = 'connected';
      else if (id === visualId) mode = 'hover';
      setVisualHighlight(visual, mode);
    }
  }

  setConnectionHighlights(ids) {
    this.connectionHighlights = new Set(ids || []);
    for (const [visualId, visual] of this.visuals) {
      let mode = 'none';
      if (this.selection.has(visualId)) mode = 'selected';
      else if (this.connectionHighlights.has(visualId)) mode = 'connected';
      else if (this.hoverId === visualId) mode = 'hover';
      setVisualHighlight(visual, mode);
    }
  }

  raycastTargets() {
    return [...this.visuals.values()].map((visual) => visual.group);
  }

  /** Resolve the factory node for a hit object by walking up the scene graph. */
  static nodeIdFromObject(object) {
    let current = object;
    while (current) {
      if (current.userData?.nodeId) return current.userData.nodeId;
      if (current.userData?.port?.nodeId) return current.userData.port.nodeId;
      current = current.parent;
    }
    return null;
  }

  dispose() {
    for (const visual of this.visuals.values()) disposeVisual(visual);
    this.visuals.clear();
    this.scene.remove(this.root);
  }
}
