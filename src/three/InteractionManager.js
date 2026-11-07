// Pointer arbitration between OrbitControls, object selection, body dragging,
// TransformControls gizmos, connection ports and placement mode.

import * as THREE from 'three';

const MOVE_THRESHOLD = 5;

export class InteractionManager {
  constructor({
    dom,
    cameraController,
    objectManager,
    connectionManager,
    placement,
    transform,
    getState,
    callbacks,
  }) {
    this.dom = dom;
    this.cameraController = cameraController;
    this.objectManager = objectManager;
    this.connectionManager = connectionManager;
    this.placement = placement;
    this.transform = transform;
    this.getState = getState;
    this.callbacks = callbacks;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.drag = null;
    this.emptyPress = null;
    this.pendingPress = null;
    this.hoverPort = null;
    this.hoveredConnection = null;
    this.hoveredNode = null;
    this.mode = 'select';
    this.placementType = null;
    this.connectMode = false;
    this.enabled = true;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onContextMenu = (event) => event.preventDefault();

    dom.addEventListener('pointerdown', this.onPointerDown, true);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointerleave', this.onPointerLeave);
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  configure(state) {
    this.mode = state.mode || 'select';
    this.placementType = state.placementType || null;
    this.connectMode = Boolean(state.connectMode);
    if (this.mode !== 'place' || !this.placementType) this.placement.hide();
    this.updateCursor();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.cancelDrag();
  }

  screenPoint(event) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.cameraController.camera);
    return this.pointer.clone();
  }

  groundPoint(event, y = 0) {
    this.screenPoint(event);
    this.groundPlane.set(new THREE.Vector3(0, 1, 0), -y);
    const point = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, point) ? point : null;
  }

  pickObject() {
    const hits = this.raycaster.intersectObjects(this.objectManager.raycastTargets(), true);
    for (const hit of hits) {
      if (hit.object?.userData?.port) continue;
      const id = findNodeId(hit.object);
      if (id) return { id, object: hit.object };
    }
    return null;
  }

  onPointerDown(event) {
    if (!this.enabled) return;
    const state = this.getState();
    const button = event.button;

    if (button === 2) {
      if (this.mode === 'place' || this.mode === 'connect' || this.connectionManager.pending) {
        this.callbacks.onCancelTransient?.();
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (button !== 0) return;

    this.screenPoint(event);

    if (this.mode === 'place' && this.placementType) {
      const point = this.groundPoint(event, 0);
      if (point) {
        const snapped = this.placement.snap(point, state.factory.grid.snap, state.factory.grid.spacing);
        this.callbacks.onPlace?.(this.placementType, snapped.x, 0, snapped.z);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const portHit = this.connectionManager.pickPort(this.raycaster);
    if (portHit) {
      this.handlePortDown(portHit, event);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Ports take precedence: gizmo axes can overlap a selected object's ports.
    if (this.transform.controls.axis) return; // TransformControls owns this drag.

    const objectHit = this.pickObject();
    if (objectHit) {
      this.startObjectPress(objectHit, event, state);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this.connectMode && this.connectionManager.pending) {
      // Clicking empty space keeps the pending link alive; Escape cancels it.
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.emptyPress = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      moved: false,
    };
    this.hideHover();
  }

  handlePortDown(portHit, event) {
    const existing = this.connectionManager.pending;
    const port = portHit.port;
    if (existing) {
      if (port.kind === existing.targetKind) {
        this.finishPending(portHit.mesh);
        event.preventDefault();
        return;
      }
      if (port.kind === 'material-out' || port.kind === 'worker-out') {
        this.connectionManager.startPending(portHit);
        this.pendingPress = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false };
        this.dom.setPointerCapture?.(event.pointerId);
        return;
      }
      this.callbacks.onStatus?.('Choose a compatible input port to complete the connection.');
      return;
    }
    if (port.kind === 'material-out' || port.kind === 'worker-out') {
      this.connectionManager.startPending(portHit);
      this.pendingPress = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false };
      this.dom.setPointerCapture?.(event.pointerId);
      this.updateCursor();
    } else {
      this.callbacks.onStatus?.('Connections start at an output port (green or amber).');
    }
  }

  finishPending(targetMesh) {
    const result = this.connectionManager.finalizePending(targetMesh);
    this.pendingPress = null;
    if (!result) {
      this.callbacks.onStatus?.('Connection cancelled: ports are not compatible.');
      this.updateCursor();
      return;
    }
    this.callbacks.onConnect?.(result.from, result.to, result.kind);
    this.updateCursor();
  }

  startObjectPress(objectHit, event, state) {
    const id = objectHit.id;
    const shift = event.shiftKey;
    let dragIds;
    if (shift) {
      this.callbacks.onToggleSelect?.(id);
      if (state.selection.includes(id)) {
        dragIds = [];
      } else {
        dragIds = [...state.selection, id];
      }
    } else if (state.selection.includes(id)) {
      dragIds = state.selection.length ? state.selection : [id];
    } else {
      this.callbacks.onSelect?.([id]);
      dragIds = [id];
    }

    const groundPoint = this.groundPoint(event, objectHitPosition(this.objectManager, id)?.y ?? 0);
    if (!groundPoint) return;
    const origins = new Map();
    for (const dragId of dragIds) {
      const group = this.objectManager.getGroup(dragId);
      if (!group) continue;
      origins.set(dragId, { x: group.position.x, y: group.position.y, z: group.position.z });
    }
    this.drag = {
      kind: 'object',
      ids: dragIds,
      origins,
      startPoint: groundPoint,
      startClient: { x: event.clientX, y: event.clientY },
      started: false,
      pointerId: event.pointerId,
      tag: `drag:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    };
    this.dom.setPointerCapture?.(event.pointerId);
    this.updateCursor();
  }

  onPointerMove(event) {
    if (!this.enabled) return;
    this.screenPoint(event);
    const state = this.getState();

    if (this.mode === 'place' && this.placementType) {
      const point = this.groundPoint(event, 0);
      if (point) this.placement.show(this.placementType, point, state.factory);
      this.updateCursor();
      return;
    }

    if (this.connectionManager.pending) {
      const point = this.groundPoint(event, 0);
      if (this.pendingPress) {
        const moved =
          Math.abs(event.clientX - this.pendingPress.x) + Math.abs(event.clientY - this.pendingPress.y) >
          MOVE_THRESHOLD;
        if (moved) this.pendingPress.moved = true;
      }
      const portHit = this.connectionManager.pickPort(this.raycaster);
      if (point) this.connectionManager.updatePending(point, portHit?.mesh || null);
      this.updateCursor();
      return;
    }

    if (this.drag?.kind === 'object') {
      const moved =
        Math.abs(event.clientX - this.drag.startClient.x) +
          Math.abs(event.clientY - this.drag.startClient.y) >
        MOVE_THRESHOLD;
      if (!this.drag.started && moved) {
        this.drag.started = true;
        this.cameraController.setOrbitEnabled(false);
        this.dom.style.cursor = 'grabbing';
      }
      if (!this.drag.started) return;
      const point = this.groundPoint(event, this.drag.startPoint.y);
      if (!point) return;
      const dx = point.x - this.drag.startPoint.x;
      const dz = point.z - this.drag.startPoint.z;
      const updates = [];
      for (const [id, origin] of this.drag.origins) {
        let x = origin.x + dx;
        let z = origin.z + dz;
        if (state.factory.grid.snap) {
          const spacing = state.factory.grid.spacing;
          x = Math.round(x / spacing) * spacing;
          z = Math.round(z / spacing) * spacing;
        }
        x = Math.round(x * 1000) / 1000;
        z = Math.round(z * 1000) / 1000;
        const group = this.objectManager.getGroup(id);
        if (group) group.position.set(x, origin.y, z);
        updates.push({ id, position: { x, y: origin.y, z } });
      }
      this.queueTransform(updates);
      return;
    }

    // Hover feedback when idle.
    const portHit = this.connectionManager.pickPort(this.raycaster);
    if (this.hoverPort && this.hoverPort !== portHit?.mesh) {
      this.hoverPort.scale.setScalar(1);
      this.hoverPort = null;
    }
    if (portHit) {
      portHit.mesh.scale.setScalar(1.4);
      this.hoverPort = portHit.mesh;
      this.hoveredNode = portHit.port.nodeId;
      this.objectManager.setHover(portHit.port.nodeId);
      this.connectionManager.setHoveredConnection(null);
      this.hoveredConnection = null;
      this.dom.style.cursor = 'crosshair';
      return;
    }

    const connectionId = this.connectionManager.pickConnection(this.raycaster);
    if (connectionId) {
      if (this.hoveredConnection !== connectionId) {
        this.connectionManager.setHoveredConnection(connectionId);
        this.hoveredConnection = connectionId;
      }
      this.objectManager.setHover(null);
      this.hoveredNode = null;
      this.dom.style.cursor = 'pointer';
      return;
    }
    if (this.hoveredConnection) {
      this.connectionManager.setHoveredConnection(null);
      this.hoveredConnection = null;
    }

    const objectHit = this.pickObject();
    const nodeId = objectHit?.id || null;
    if (this.hoveredNode !== nodeId) {
      this.hoveredNode = nodeId;
      this.objectManager.setHover(nodeId);
    }
    this.dom.style.cursor = nodeId ? 'move' : this.connectMode ? 'crosshair' : 'default';
  }

  queueTransform(updates) {
    if (!this.transformBatch) this.transformBatch = [];
    this.transformBatch = updates;
    if (this.transformFrame) return;
    this.transformFrame = requestAnimationFrame(() => {
      this.transformFrame = null;
      const batch = this.transformBatch;
      this.transformBatch = null;
      if (batch?.length) {
        this.callbacks.onTransformLive?.(batch, { tag: this.drag?.tag });
      }
    });
  }

  onPointerUp(event) {
    if (!this.enabled) return;
    if (event.button !== 0) return;
    const state = this.getState();

    if (this.drag?.kind === 'object') {
      if (this.drag.started) {
        if (this.transformBatch?.length) {
          this.callbacks.onTransformLive?.(this.transformBatch, { tag: this.drag.tag });
          this.transformBatch = null;
        }
        if (this.transformFrame) {
          cancelAnimationFrame(this.transformFrame);
          this.transformFrame = null;
        }
        this.callbacks.onTransformEnd?.(this.drag.ids);
      }
      this.cameraController.setOrbitEnabled(true);
      this.releasePointer(this.drag.pointerId);
      this.drag = null;
      this.updateCursor();
      return;
    }

    if (this.pendingPress) {
      const moved = this.pendingPress.moved;
      const portHit = this.connectionManager.pickPort(this.raycaster);
      this.releasePointer(this.pendingPress.pointerId);
      this.pendingPress = null;
      if (this.connectionManager.pending) {
        if (portHit && portHit.port.kind === this.connectionManager.pending.targetKind) {
          this.finishPending(portHit.mesh);
        } else if (moved) {
          this.connectionManager.cancelPending();
          this.callbacks.onStatus?.('Connection cancelled.');
          this.updateCursor();
        }
      }
      return;
    }

    if (this.emptyPress) {
      const moved =
        Math.abs(event.clientX - this.emptyPress.x) +
          Math.abs(event.clientY - this.emptyPress.y) >
        MOVE_THRESHOLD;
      this.releasePointer(this.emptyPress.pointerId);
      this.emptyPress = null;
      if (!moved && state.mode === 'select' && !state.connectMode) {
        this.callbacks.onSelect?.([]);
      }
      return;
    }
  }

  onPointerLeave() {
    if (this.drag || this.connectionManager.pending) return;
    this.hideHover();
    this.placement.hide();
  }

  hideHover() {
    if (this.hoverPort) {
      this.hoverPort.scale.setScalar(1);
      this.hoverPort = null;
    }
    if (this.hoveredConnection) {
      this.connectionManager.setHoveredConnection(null);
      this.hoveredConnection = null;
    }
    if (this.hoveredNode) {
      this.objectManager.setHover(null);
      this.hoveredNode = null;
    }
  }

  releasePointer(pointerId) {
    try {
      if (this.dom.hasPointerCapture?.(pointerId)) this.dom.releasePointerCapture(pointerId);
    } catch {
      // ignore
    }
  }

  cancelDrag() {
    if (this.transformFrame) {
      cancelAnimationFrame(this.transformFrame);
      this.transformFrame = null;
    }
    this.transformBatch = null;
    this.drag = null;
    this.emptyPress = null;
    this.pendingPress = null;
    this.connectionManager.cancelPending();
    this.cameraController.setOrbitEnabled(true);
    this.placement.hide();
    this.updateCursor();
  }

  updateCursor() {
    if (this.drag?.started) {
      this.dom.style.cursor = 'grabbing';
      return;
    }
    if (this.mode === 'place' || this.connectMode || this.connectionManager.pending) {
      this.dom.style.cursor = 'crosshair';
      return;
    }
    this.dom.style.cursor = 'default';
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onPointerDown, true);
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    this.dom.removeEventListener('pointerup', this.onPointerUp);
    this.dom.removeEventListener('pointerleave', this.onPointerLeave);
    this.dom.removeEventListener('contextmenu', this.onContextMenu);
    if (this.transformFrame) cancelAnimationFrame(this.transformFrame);
  }
}

function findNodeId(object) {
  let current = object;
  while (current) {
    if (current.userData?.nodeId) return current.userData.nodeId;
    current = current.parent;
  }
  return null;
}

function objectHitPosition(objectManager, id) {
  const group = objectManager.getGroup(id);
  return group ? group.position : null;
}
