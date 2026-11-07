// Scene lifecycle: renderer, lights, grid, object manager, placement, transforms,
// camera controls and interaction arbitration.

import * as THREE from 'three';
import { CameraController } from './CameraController.js';
import { ObjectManager } from './ObjectManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { ObjectPlacement } from './ObjectPlacement.js';
import { ObjectTransform } from './ObjectTransform.js';
import { InteractionManager } from './InteractionManager.js';
import { disposeSharedResources, setPortsActive } from './ObjectFactory.js';
import { validateConnection } from '../engine/graph.js';

export class SceneManager {
  constructor(container, callbacks = {}, initialFactory) {
    this.container = container;
    this.callbacks = callbacks;
    this.factory = initialFactory;
    this.state = {
      factory: initialFactory,
      selection: [],
      mode: 'select',
      placementType: null,
      connectMode: false,
      transformMode: 'translate',
      result: null,
    };
    this.connectedPortsActive = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0f1924');

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'factory-canvas';

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.cameraController = new CameraController(this.renderer.domElement, width, height);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x33424e, 1.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(12, 22, 10);
    this.scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x7fb4d8, 0.5);
    fillLight.position.set(-14, 8, -12);
    this.scene.add(fillLight);

    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.MeshStandardMaterial({ color: 0x0c1620, roughness: 0.95, metalness: 0.05 }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.015;
    this.floor.raycast = () => {};
    this.scene.add(this.floor);

    this.grid = null;
    this.rebuildGrid(initialFactory.grid);

    this.objectManager = new ObjectManager(this.scene);
    this.connectionManager = new ConnectionManager(this.scene, this.objectManager, {
      getConnection: (id) => this.factory?.connections.find((c) => c.id === id) || null,
      validate: (from, to, kind) => validateConnection(this.factory, from, to, kind),
      onInvalid: (error) => this.callbacks.onStatus?.(error),
    });
    this.placement = new ObjectPlacement(this.scene);

    this.gizmoTag = null;
    this.transform = new ObjectTransform(
      this.cameraController.camera,
      this.renderer.domElement,
      this.scene,
      {
        onDragStart: () => {
          this.gizmoTag = `gizmo:${Date.now()}`;
        },
        onDragEnd: () => {
          this.cameraController.setOrbitEnabled(true);
          this.callbacks.onTransformEnd?.();
          this.gizmoTag = null;
        },
        onDraggingChanged: (dragging) => {
          if (dragging) this.cameraController.setOrbitEnabled(false);
          else this.cameraController.setOrbitEnabled(true);
        },
        onChange: (id, value) => {
          this.callbacks.onTransformLive?.(
            [{ id, ...value }],
            { tag: this.gizmoTag || `gizmo:${id}` },
          );
        },
      },
    );

    this.interaction = new InteractionManager({
      dom: this.renderer.domElement,
      cameraController: this.cameraController,
      objectManager: this.objectManager,
      connectionManager: this.connectionManager,
      placement: this.placement,
      transform: this.transform,
      getState: () => this.state,
      callbacks: {
        onSelect: (ids) => this.callbacks.onSelect?.(ids),
        onToggleSelect: (id) => this.callbacks.onToggleSelect?.(id),
        onPlace: (type, x, y, z) => this.callbacks.onPlace?.(type, x, y, z),
        onTransformLive: (updates, meta) => this.callbacks.onTransformLive?.(updates, meta),
        onTransformEnd: (ids) => this.callbacks.onTransformEnd?.(ids),
        onConnect: (from, to, kind) => {
          const validation = validateConnection(this.factory, from, to, kind);
          if (!validation.ok) {
            this.callbacks.onStatus?.(validation.error);
            return;
          }
          this.callbacks.onConnect?.(from, to, kind);
        },
        onSelectConnection: (id) => this.callbacks.onSelectConnection?.(id),
        onStatus: (message) => this.callbacks.onStatus?.(message),
        onCancelTransient: () => this.callbacks.onCancelTransient?.(),
      },
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.onWindowResize = () => this.resize();
    window.addEventListener('resize', this.onWindowResize);

    this.animate = this.animate.bind(this);
    this.renderer.setAnimationLoop(this.animate);
  }

  rebuildGrid(grid) {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry?.dispose();
      if (Array.isArray(this.grid.material)) this.grid.material.forEach((m) => m.dispose());
      else this.grid.material?.dispose();
    }
    const size = Math.max(10, grid?.size || 50);
    const spacing = Math.max(0.25, grid?.spacing || 1);
    const divisions = Math.max(1, Math.round(size / spacing));
    this.grid = new THREE.GridHelper(size, divisions, 0x527083, 0x263846);
    this.grid.position.y = 0.002;
    this.grid.raycast = () => {};
    this.scene.add(this.grid);
    this.gridConfig = { size, spacing };
  }

  update(state) {
    this.state = {
      ...this.state,
      ...state,
      factory: state.factory || this.state.factory,
    };
    const factory = this.state.factory;
    if (!factory) return;
    this.factory = factory;

    if (
      !this.gridConfig ||
      this.gridConfig.size !== factory.grid.size ||
      this.gridConfig.spacing !== factory.grid.spacing
    ) {
      this.rebuildGrid(factory.grid);
    }

    this.objectManager.sync(factory, this.state.selection, { result: this.state.result });
    this.connectionManager.sync(factory, this.state.connectMode);

    this.transform.setCamera(this.cameraController.camera);
    this.transform.setMode(this.state.transformMode || 'translate');
    this.transform.setSnap(factory.grid.snap, factory.grid.spacing);

    const canTransform = this.state.mode === 'select';
    this.transform.setEnabled(canTransform);
    if (canTransform && this.state.selection.length) {
      const primaryId = this.state.selection[this.state.selection.length - 1];
      const group = this.objectManager.getGroup(primaryId);
      if (group) this.transform.attach(primaryId, group);
      else this.transform.detach();
    } else {
      this.transform.detach();
    }

    const connectActive = Boolean(this.state.connectMode);
    if (connectActive !== this.connectedPortsActive) {
      this.connectedPortsActive = connectActive;
      for (const visual of this.objectManager.visuals.values()) {
        setPortsActive(visual, connectActive);
      }
    }

    this.interaction.configure(this.state);
    this.interaction.updateCursor();
  }

  setView(view) {
    this.cameraController.setView(view);
    this.transform.setCamera(this.cameraController.camera);
  }

  screenToGround(clientX, clientY, y = 0) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.cameraController.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const point = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, point) ? point : null;
  }

  previewPlacement(type, clientX, clientY) {
    const point = this.screenToGround(clientX, clientY, 0);
    if (!point || !this.factory) return null;
    return this.placement.show(type, point, this.factory);
  }

  dropPlacement(type, clientX, clientY) {
    const point = this.screenToGround(clientX, clientY, 0);
    this.placement.hide();
    if (!point || !this.factory) return null;
    return this.placement.snap(point, this.factory.grid.snap, this.factory.grid.spacing);
  }

  clearPlacementPreview() {
    this.placement.hide();
  }

  /** Project a world position onto client coordinates (used by acceptance tests). */
  projectToScreen(worldPosition) {
    const camera = this.cameraController.camera;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const point = worldPosition.clone().project(camera);
    return {
      x: rect.left + ((point.x + 1) / 2) * rect.width,
      y: rect.top + ((-point.y + 1) / 2) * rect.height,
      visible: point.z > -1 && point.z < 1 && Math.abs(point.x) <= 1.2 && Math.abs(point.y) <= 1.2,
    };
  }

  objectScreenPoint(id) {
    const group = this.objectManager.getGroup(id);
    if (!group) return null;
    group.updateWorldMatrix(true, false);
    const world = new THREE.Vector3();
    group.getWorldPosition(world);
    world.y += 0.65;
    return this.projectToScreen(world);
  }

  worldScreenPoint(x, y, z) {
    return this.projectToScreen(new THREE.Vector3(x, y, z));
  }

  portScreenPoint(id, kind) {
    const world = this.objectManager.portWorldPosition(id, kind);
    if (!world) return null;
    return this.projectToScreen(world);
  }

  cameraDebug() {
    const controller = this.cameraController;
    const camera = controller.camera;
    const orbit = controller.orbit;
    return {
      view: controller.view,
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: orbit.target.x, y: orbit.target.y, z: orbit.target.z },
      zoom: camera.zoom,
      distance: camera.position.distanceTo(orbit.target),
    };
  }

  cancelTransient() {
    this.interaction.cancelDrag();
    this.connectionManager.cancelPending();
    this.placement.hide();
    this.transform.detach();
  }

  resetCamera() {
    this.cameraController.reset();
  }

  fitAll() {
    this.cameraController.fitAll(this.factory);
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, true);
    this.cameraController.resize(width, height);
  }

  animate() {
    this.cameraController.update();
    this.renderer.render(this.scene, this.cameraController.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    this.interaction?.dispose();
    this.transform?.dispose();
    this.connectionManager?.dispose();
    this.placement?.dispose();
    this.objectManager?.dispose();
    this.cameraController?.dispose();
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry?.dispose();
      if (Array.isArray(this.grid.material)) this.grid.material.forEach((m) => m.dispose());
      else this.grid.material?.dispose();
    }
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    disposeSharedResources();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
