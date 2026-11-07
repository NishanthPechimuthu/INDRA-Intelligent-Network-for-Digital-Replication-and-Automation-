// OrbitControls wrapper managing perspective (3D) and orthographic (top) cameras.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const DEFAULT_DIRECTION = new THREE.Vector3(1, 0.95, 1.15).normalize();

export class CameraController {
  constructor(domElement, width, height) {
    this.domElement = domElement;
    this.view = '3d';
    this.orbitHeight = 30;

    this.perspective = new THREE.PerspectiveCamera(48, width / Math.max(1, height), 0.1, 600);
    this.perspective.position.copy(DEFAULT_DIRECTION).multiplyScalar(24);

    this.orthographic = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 600);
    this.orthographic.position.set(0, 40, 0.01);
    this.orthographic.up.set(0, 0, -1);

    this.perspectiveOrbit = new OrbitControls(this.perspective, domElement);
    this.orthographicOrbit = new OrbitControls(this.orthographic, domElement);
    for (const orbit of [this.perspectiveOrbit, this.orthographicOrbit]) {
      orbit.enableDamping = true;
      orbit.dampingFactor = 0.075;
      orbit.screenSpacePanning = true;
      orbit.zoomToCursor = true;
      orbit.minDistance = 2;
      orbit.maxDistance = 260;
      orbit.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN,
      };
      orbit.target.copy(DEFAULT_TARGET);
      orbit.update();
    }
    this.perspectiveOrbit.maxPolarAngle = Math.PI * 0.495;
    this.orthographicOrbit.enableRotate = false;
    this.orthographicOrbit.minZoom = 0.15;
    this.orthographicOrbit.maxZoom = 24;
    this.perspectiveOrbit.enabled = true;
    this.orthographicOrbit.enabled = false;

    this.resize(width, height);
    this._baseOrbitEnabled = true;
    this._leftOrbitEnabled = true;
  }

  get camera() {
    return this.view === 'top' ? this.orthographic : this.perspective;
  }

  get orbit() {
    return this.view === 'top' ? this.orthographicOrbit : this.perspectiveOrbit;
  }

  resize(width, height) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.perspective.aspect = w / h;
    this.perspective.updateProjectionMatrix();
    this.orbitHeight = 30;
    const aspect = w / h;
    this.orthographic.left = (-this.orbitHeight * aspect) / 2;
    this.orthographic.right = (this.orbitHeight * aspect) / 2;
    this.orthographic.top = this.orbitHeight / 2;
    this.orthographic.bottom = -this.orbitHeight / 2;
    this.orthographic.updateProjectionMatrix();
  }

  setView(view) {
    if (view === this.view) return;
    if (view === 'top') {
      const target = this.perspectiveOrbit.target.clone();
      this.orthographicOrbit.target.copy(target);
      this.orthographic.position.set(target.x, 40, target.z + 0.01);
      this.orthographic.up.set(0, 0, -1);
      this.orthographic.lookAt(target);
      this.orthographicOrbit.enabled = this._baseOrbitEnabled;
      this.orthographicOrbit.enableRotate = false;
      this.perspectiveOrbit.enabled = false;
    } else {
      const target = this.orthographicOrbit.target.clone();
      this.perspectiveOrbit.target.copy(target);
      this.perspective.position.copy(target).add(DEFAULT_DIRECTION.clone().multiplyScalar(24));
      this.perspective.up.set(0, 1, 0);
      this.perspective.lookAt(target);
      this.perspectiveOrbit.enabled = this._baseOrbitEnabled;
      this.orthographicOrbit.enabled = false;
    }
    this.view = view;
    this.applyMouseButtons();
    this.orbit.update();
  }

  reset() {
    this.perspective.position.copy(DEFAULT_DIRECTION).multiplyScalar(24);
    this.perspectiveOrbit.target.copy(DEFAULT_TARGET);
    this.orthographic.position.set(0, 40, 0.01);
    this.orthographicOrbit.target.copy(DEFAULT_TARGET);
    this.orthographic.zoom = 1;
    this.orthographic.updateProjectionMatrix();
    if (this.view === 'top') {
      this.orthographic.lookAt(DEFAULT_TARGET);
      this.orthographicOrbit.update();
    } else {
      this.perspective.lookAt(DEFAULT_TARGET);
      this.perspectiveOrbit.update();
    }
  }

  fitAll(factory) {
    const components = factory?.components || [];
    const box = new THREE.Box3();
    if (!components.length) {
      box.setFromCenterAndSize(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(10, 2, 10));
    } else {
      for (const component of components) {
        const position = component.position || { x: 0, y: 0, z: 0 };
        const half = component.type === 'conveyor' ? 1.4 : 1.1;
        const point = new THREE.Vector3(position.x, 0.6, position.z);
        box.expandByPoint(point.clone().add(new THREE.Vector3(-half, 0, -half)));
        box.expandByPoint(point.clone().add(new THREE.Vector3(half, 0, half)));
      }
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(3, Math.max(size.x, size.z) * 0.5 + 1.5);
    const desiredHeight = Math.max(10, Math.max(size.x, size.z) * 1.45);

    if (this.view === 'top') {
      this.orthographicOrbit.target.copy(new THREE.Vector3(center.x, 0, center.z));
      this.orthographic.position.set(center.x, 40, center.z + 0.01);
      this.orthographic.up.set(0, 0, -1);
      this.orthographic.zoom = Math.min(12, Math.max(0.2, this.orbitHeight / desiredHeight));
      this.orthographic.updateProjectionMatrix();
      this.orthographic.lookAt(this.orthographicOrbit.target);
      this.orthographicOrbit.update();
    } else {
      const target = new THREE.Vector3(center.x, 0.5, center.z);
      this.perspectiveOrbit.target.copy(target);
      const distance = radius / Math.tan(THREE.MathUtils.degToRad(this.perspective.fov * 0.5));
      this.perspective.position.copy(target).add(DEFAULT_DIRECTION.clone().multiplyScalar(Math.max(6, distance * 1.05)));
      this.perspective.up.set(0, 1, 0);
      this.perspective.lookAt(target);
      this.perspectiveOrbit.update();
    }
  }

  applyMouseButtons() {
    const orbit = this.orbit;
    if (!orbit) return;
    orbit.mouseButtons = {
      LEFT: this._leftOrbitEnabled ? THREE.MOUSE.ROTATE : null,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    };
  }

  setOrbitEnabled(enabled) {
    this._baseOrbitEnabled = enabled;
    this.orbit.enabled = enabled;
    if (!enabled) return;
    this.applyMouseButtons();
  }

  setLeftOrbitEnabled(enabled) {
    this._leftOrbitEnabled = enabled;
    this.applyMouseButtons();
  }

  setTransformActive(active) {
    // TransformControls handles its own left drags; keep the orbit off while it does.
    this.orbit.enabled = this._baseOrbitEnabled && !active;
  }

  update() {
    this.orbit?.update();
  }

  dispose() {
    this.perspectiveOrbit.dispose();
    this.orthographicOrbit.dispose();
  }
}
