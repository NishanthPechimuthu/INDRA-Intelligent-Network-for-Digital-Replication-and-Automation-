// Three.js object visuals for every factory component.
// Geometries are shared; materials and label textures are per-object and disposed with it.

import * as THREE from 'three';
import { ANALYTIC_TYPES, METRIC_LABELS, typeColor } from '../data/componentDefs.js';

const geometryCache = new Map();
const labelTextures = new Set();

const PICK_FOOTPRINTS = {
  source: [1.5, 1.25, 1.5],
  workstation: [1.55, 1.5, 1.4],
  worker: [1.3, 1.0, 1.3],
  conveyor: [2.25, 0.65, 0.95],
  buffer: [1.4, 0.95, 1.3],
  output: [1.45, 0.95, 1.35],
  display: [0.95, 1.7, 0.75],
};

function geo(key, create) {
  if (!geometryCache.has(key)) geometryCache.set(key, create());
  return geometryCache.get(key);
}

function baseMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.55,
    metalness: options.metalness ?? 0.28,
    emissive: 0x000000,
    emissiveIntensity: 0,
    ...options,
  });
}

function darkMaterial() {
  return baseMaterial(0x1c1f23, { roughness: 0.72, metalness: 0.38 });
}

function addMesh(group, geometry, material, x, y, z, materials) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  if (materials && material) materials.push(material);
  return mesh;
}

function makeLabelTexture(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 84;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(8, 9, 11, 0.9)';
  roundRect(ctx, 3, 3, 378, 78, 10);
  ctx.fill();
  ctx.strokeStyle = `${color}99`;
  ctx.lineWidth = 2;
  roundRect(ctx, 3, 3, 378, 78, 10);
  ctx.stroke();
  ctx.fillStyle = '#faf8f3';
  ctx.font = '600 30px Inter, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = String(name || 'Component');
  ctx.fillText(text.length > 28 ? `${text.slice(0, 27)}…` : text, 192, 43);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  labelTextures.add(texture);
  return texture;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeLabel(name, color, y) {
  const texture = makeLabelTexture(name, color);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.05, 0.45, 1);
  sprite.position.set(0, y, 0);
  sprite.renderOrder = 20;
  // Labels are billboards with a wide screen footprint. If they take part in
  // raycasting they can sit in front of a neighbouring object and steal its
  // pointer press, so labels are visual-only and never pick a component.
  sprite.raycast = () => {};
  return { sprite, texture, material, name };
}

function updateLabel(label, name, color) {
  if (label.name === name) return;
  label.name = name;
  const old = label.texture;
  label.texture = makeLabelTexture(name, color);
  label.material.map = label.texture;
  label.material.needsUpdate = true;
  old?.dispose();
  labelTextures.delete(old);
}

const SELECT_COLOR = new THREE.Color(0xcdf22b);
const CONNECTED_COLOR = new THREE.Color(0x8fa3b5);
const HOVER_COLOR = new THREE.Color(0xe6ff86);

function ringFor(type) {
  if (type === 'conveyor') return geo('ring-conveyor', () => new THREE.RingGeometry(1.3, 1.45, 40));
  if (ANALYTIC_TYPES.has(type)) return geo('ring-panel', () => new THREE.RingGeometry(1.2, 1.34, 40));
  return geo('ring-standard', () => new THREE.RingGeometry(0.95, 1.08, 40));
}

const PORT_POSITIONS = {
  source: [{ kind: 'material-out', x: 0.9, y: 0.55, z: 0 }],
  workstation: [
    { kind: 'material-in', x: -0.85, y: 0.65, z: 0 },
    { kind: 'material-out', x: 0.85, y: 0.65, z: 0 },
    { kind: 'worker-in', x: 0, y: 1.78, z: -0.55 },
  ],
  worker: [{ kind: 'worker-out', x: 0.55, y: 1.35, z: 0 }],
  conveyor: [
    { kind: 'material-in', x: -1.25, y: 0.42, z: 0 },
    { kind: 'material-out', x: 1.25, y: 0.42, z: 0 },
  ],
  buffer: [
    { kind: 'material-in', x: -0.8, y: 0.55, z: 0 },
    { kind: 'material-out', x: 0.8, y: 0.55, z: 0 },
  ],
  output: [{ kind: 'material-in', x: -0.8, y: 0.55, z: 0 }],
};

function portColor(kind) {
  if (kind === 'worker-in' || kind === 'worker-out') return 0xf0b35a;
  return kind === 'material-in' ? 0x4aa3ff : 0x57d6b0;
}

function makePorts(group, component, materials) {
  const ports = [];
  for (const definition of PORT_POSITIONS[component.type] || []) {
    const material = new THREE.MeshStandardMaterial({
      color: portColor(definition.kind),
      emissive: portColor(definition.kind),
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo('port', () => new THREE.SphereGeometry(0.14, 14, 10)), material);
    mesh.position.set(definition.x, definition.y, definition.z);
    mesh.userData.port = {
      nodeId: component.id,
      kind: definition.kind,
      nodeType: component.type,
    };
    mesh.name = `port-${definition.kind}`;
    group.add(mesh);
    ports.push(mesh);
    materials.push(material);
  }
  return ports;
}

function makeAnalyticPanel(component, materials) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
  const panel = new THREE.Mesh(geo('panel', () => new THREE.PlaneGeometry(2.1, 1.3)), material);
  panel.position.set(0, 1.55, 0);
  materials.push(material);
  const standMaterial = darkMaterial();
  materials.push(standMaterial);
  const stand = addMesh(
    panel,
    geo('panel-stand', () => new THREE.CylinderGeometry(0.06, 0.09, 1, 8)),
    standMaterial,
    0,
    -1.05,
    0,
  );
  stand.rotation.x = 0;
  panel.userData.panelCanvas = canvas;
  panel.userData.panelTexture = texture;
  panel.userData.metric = component.props.metric || 'throughput';
  drawPanel(panel, component.props.metric, null, component.name);
  return panel;
}

export function createVisual(component) {
  const group = new THREE.Group();
  group.userData.nodeId = component.id;
  group.userData.nodeType = component.type;
  const color = typeColor(component.type);
  const materials = [];
  const main = baseMaterial(color);
  materials.push(main);
  let labelY = 2;

  if (component.type === 'source') {
    addMesh(group, geo('source-body', () => new THREE.CylinderGeometry(0.66, 0.72, 0.95, 24)), main, 0, 0.48, 0, materials);
    const accent = darkMaterial();
    addMesh(group, geo('source-cap', () => new THREE.CylinderGeometry(0.52, 0.66, 0.18, 24)), accent, 0, 1.02, 0, materials);
    labelY = 1.9;
  } else if (component.type === 'workstation') {
    addMesh(group, geo('ws-body', () => new THREE.BoxGeometry(1.35, 1.3, 1.2)), main, 0, 0.65, 0, materials);
    const accent = darkMaterial();
    addMesh(group, geo('ws-top', () => new THREE.BoxGeometry(0.78, 0.16, 0.7)), accent, 0, 1.4, 0, materials);
    const screen = new THREE.MeshStandardMaterial({ color: 0xd8ef7a, emissive: 0x6f8412, emissiveIntensity: 0.7, roughness: 0.3 });
    addMesh(group, geo('ws-screen', () => new THREE.BoxGeometry(0.46, 0.28, 0.04)), screen, 0, 0.95, 0.62, materials);
    labelY = 2.1;
  } else if (component.type === 'worker') {
    addMesh(group, geo('worker-body', () => new THREE.CylinderGeometry(0.66, 0.66, 0.48, 22)), main, 0, 0.24, 0, materials);
    const accent = darkMaterial();
    for (let i = 0; i < 3; i += 1) {
      addMesh(group, geo('worker-head', () => new THREE.SphereGeometry(0.16, 14, 10)), accent, -0.28 + i * 0.28, 0.72, 0, materials);
    }
    labelY = 1.9;
  } else if (component.type === 'conveyor') {
    addMesh(group, geo('conv-body', () => new THREE.BoxGeometry(2.2, 0.24, 0.85)), main, 0, 0.36, 0, materials);
    const accent = darkMaterial();
    for (let i = 0; i < 5; i += 1) {
      const roller = addMesh(
        group,
        geo('conv-roller', () => new THREE.CylinderGeometry(0.09, 0.09, 0.81, 12)),
        accent,
        -0.82 + i * 0.41,
        0.22,
        0,
        materials,
      );
      roller.rotation.x = Math.PI / 2;
    }
    labelY = 1.75;
  } else if (component.type === 'buffer') {
    addMesh(group, geo('buffer-body', () => new THREE.BoxGeometry(1.3, 0.82, 1.2)), main, 0, 0.41, 0, materials);
    const accent = darkMaterial();
    for (let i = 0; i < 3; i += 1) {
      addMesh(group, geo('buffer-slot', () => new THREE.BoxGeometry(0.9, 0.045, 0.8)), accent, 0, 0.32 + i * 0.2, 0, materials);
    }
    labelY = 1.85;
  } else if (component.type === 'output') {
    addMesh(group, geo('output-body', () => new THREE.BoxGeometry(1.35, 0.82, 1.25)), main, 0, 0.41, 0, materials);
    const accent = darkMaterial();
    addMesh(group, geo('output-rim', () => new THREE.BoxGeometry(1.2, 0.08, 1.1)), accent, 0, 0.86, 0, materials);
    labelY = 1.85;
  } else if (ANALYTIC_TYPES.has(component.type)) {
    const standMaterial = darkMaterial();
    addMesh(group, geo('analytic-base', () => new THREE.CylinderGeometry(0.42, 0.55, 0.16, 16)), standMaterial, 0, 0.08, 0, materials);
    const panel = makeAnalyticPanel(component, materials);
    group.add(panel);
    group.userData.panel = panel;
    labelY = 2.3;
  }

  // Everything created before the label/selection ring/ports is the procedural
  // fallback body. It is hidden when a GLB asset finishes loading.
  const proceduralMeshes = group.children.slice();

  const label = makeLabel(component.name, color, labelY);
  group.add(label.sprite);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: SELECT_COLOR,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringFor(component.type), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;
  ring.raycast = () => {};
  group.add(ring);
  materials.push(ringMaterial);

  const ports = makePorts(group, component, materials);

  const modelRoot = new THREE.Group();
  modelRoot.name = `model-${component.id}`;
  group.add(modelRoot);

  // Invisible picking proxy with the component's footprint. Some GLB models are
  // hollow or open (for example the inspection scanner), so a ray through the
  // object centre could reach a component behind it. The proxy keeps body
  // selection and dragging anchored to this node without drawing anything.
  const proxySize = PICK_FOOTPRINTS[component.type] || [1.2, 1.2, 1.2];
  const proxyMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  materials.push(proxyMaterial);
  const proxy = new THREE.Mesh(
    geo(`pick-${component.type}`, () => new THREE.BoxGeometry(...proxySize)),
    proxyMaterial,
  );
  proxy.position.y = proxySize[1] / 2 - 0.25;
  proxy.castShadow = false;
  proxy.receiveShadow = false;
  proxy.name = `pick-${component.id}`;
  group.add(proxy);

  const visual = {
    id: component.id,
    type: component.type,
    group,
    materials,
    mainMaterial: main,
    label,
    ring,
    ports,
    panel: group.userData.panel || null,
    proceduralMeshes,
    modelRoot,
    model: null,
    assetKey: null,
    assetError: null,
    baseColor: new THREE.Color(color),
    highlight: 'none',
  };
  group.userData.visual = visual;
  return visual;
}

export function updateVisualLabel(visual, component) {
  updateLabel(visual.label, component.name, typeColor(component.type));
  if (visual.panel) {
    visual.panel.userData.componentName = component.name;
  }
}

export function setVisualHighlight(visual, mode) {
  if (visual.highlight === mode) return;
  visual.highlight = mode;
  const selected = mode === 'selected';
  visual.ring.visible = selected;
  if (selected) {
    visual.ring.material.color.copy(SELECT_COLOR);
  }
  const color = selected ? SELECT_COLOR : mode === 'connected' ? CONNECTED_COLOR : mode === 'hover' ? HOVER_COLOR : null;
  for (const material of visual.materials) {
    if (!material.emissive) continue;
    if (material === visual.ring.material) continue;
    if (color) {
      material.emissive.copy(color);
      material.emissiveIntensity = selected ? 0.55 : 0.3;
    } else {
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0;
    }
  }
}

export function setPortsActive(visual, active) {
  for (const port of visual.ports) {
    port.scale.setScalar(active ? 1.35 : 1);
    const material = port.material;
    if (material) material.emissiveIntensity = active ? 1.1 : 0.35;
  }
}

export function setPortsForSelection(visual, selected) {
  for (const port of visual.ports) {
    port.scale.setScalar(selected ? 1.25 : 1);
    if (port.material) port.material.emissiveIntensity = selected ? 0.95 : 0.35;
  }
}

export function updateAnalyticPanel(visual, metric, result) {
  if (!visual.panel) return;
  const panel = visual.panel;
  if (panel.userData.metric === metric && panel.userData.lastResult === result) return;
  panel.userData.metric = metric;
  panel.userData.lastResult = result;
  drawPanel(panel, metric, result, visual.label.name);
}

function drawPanel(panel, metric, result, name) {
  const canvas = panel.userData.panelCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.fillStyle = '#08090b';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#2a2e34';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.fillStyle = '#8b8f86';
  ctx.font = '500 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(String(name || 'DISPLAY').slice(0, 26), 24, 42);
  ctx.fillStyle = '#cdf22b';
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.fillText((METRIC_LABELS[metric] || metric || '').toUpperCase(), 24, 78);

  let value = '—';
  let sub = result ? `${result.hours} h run` : 'Run simulation';
  if (result) {
    if (metric === 'throughput') value = `${result.throughputPerHour}/hr`;
    else if (metric === 'good') value = result.good.toLocaleString();
    else if (metric === 'rejected') value = result.rejected.toLocaleString();
    else if (metric === 'utilization') value = `${result.utilization}%`;
    else if (metric === 'wip') value = `${result.wip}`;
    else if (metric === 'energy') value = `${result.energyKwh} kWh`;
    else if (metric === 'bottleneck') {
      value = String(result.bottleneck).slice(0, 16);
      sub = 'bottleneck station';
    }
  }
  ctx.fillStyle = '#faf8f3';
  ctx.font = `600 ${String(value).length > 10 ? 52 : 68}px "JetBrains Mono", monospace`;
  ctx.fillText(String(value), 24, 178);
  ctx.fillStyle = '#8b8f86';
  ctx.font = '20px Inter, Arial';
  ctx.fillText(sub, 24, 216);

  if (result && metric === 'throughput' && result.hourly?.length) {
    const bars = result.hourly.slice(0, 12);
    const max = Math.max(1, ...bars.map((b) => b.good));
    const barWidth = (width - 60) / bars.length;
    bars.forEach((bar, i) => {
      const barHeight = (bar.good / max) * 54;
      ctx.fillStyle = '#a9c722';
      ctx.fillRect(24 + i * barWidth, 294 - barHeight, Math.max(2, barWidth - 6), barHeight);
    });
  }
  panel.userData.panelTexture.needsUpdate = true;
}

export function createGhost(type) {
  const group = new THREE.Group();
  const color = new THREE.Color(typeColor(type));
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    emissive: color,
    emissiveIntensity: 0.25,
    roughness: 0.5,
  });
  let geometry;
  if (type === 'source') geometry = geo('source-body', () => new THREE.CylinderGeometry(0.66, 0.72, 0.95, 24));
  else if (type === 'workstation' || type === 'inspection') geometry = geo('ws-body', () => new THREE.BoxGeometry(1.35, 1.3, 1.2));
  else if (type === 'worker') geometry = geo('worker-body', () => new THREE.CylinderGeometry(0.66, 0.66, 0.48, 22));
  else if (type === 'conveyor') geometry = geo('conv-body', () => new THREE.BoxGeometry(2.2, 0.24, 0.85));
  else if (type === 'buffer') geometry = geo('buffer-body', () => new THREE.BoxGeometry(1.3, 0.82, 1.2));
  else if (type === 'output') geometry = geo('output-body', () => new THREE.BoxGeometry(1.35, 0.82, 1.25));
  else geometry = geo('panel', () => new THREE.PlaneGeometry(2.1, 1.3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = ANALYTIC_TYPES.has(type) ? 1.55 : type === 'conveyor' ? 0.36 : type === 'source' ? 0.48 : 0.6;
  group.add(mesh);
  group.userData.ghostMaterial = material;
  group.userData.ghostMesh = mesh;

  const cellMaterial = new THREE.LineBasicMaterial({ color: 0xcdf22b, transparent: true, opacity: 0.9 });
  const cell = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, 0, -0.5),
      new THREE.Vector3(0.5, 0, -0.5),
      new THREE.Vector3(0.5, 0, 0.5),
      new THREE.Vector3(-0.5, 0, 0.5),
      new THREE.Vector3(-0.5, 0, -0.5),
    ]),
    cellMaterial,
  );
  cell.position.y = 0.01;
  group.add(cell);
  group.userData.cell = cell;
  group.userData.cellMaterial = cellMaterial;
  group.visible = false;
  return group;
}

export function setGhostCell(group, snapping, spacing) {
  const cell = group.userData.cell;
  if (!cell) return;
  cell.visible = Boolean(snapping);
  const size = Math.max(0.25, spacing || 1);
  cell.scale.set(size, size, size);
}

export function disposeVisual(visual) {
  if (!visual) return;
  visual.disposed = true;
  visual.mixer?.stopAllAction();
  if (visual.modelRoot) {
    visual.modelRoot.clear();
    visual.modelRoot.removeFromParent();
  }
  visual.label?.texture?.dispose();
  labelTextures.delete(visual.label?.texture);
  visual.label?.material?.dispose();
  if (visual.panel?.userData?.panelTexture) {
    visual.panel.userData.panelTexture.dispose();
  }
  for (const material of visual.materials || []) material?.dispose();
  if (visual.group?.parent) visual.group.parent.remove(visual.group);
}

export function disposeGhost(group) {
  if (!group) return;
  group.userData.ghostMaterial?.dispose();
  group.userData.cellMaterial?.dispose();
  group.userData.cell?.geometry?.dispose();
  if (group.parent) group.parent.remove(group);
}

export function disposeSharedResources() {
  for (const geometry of geometryCache.values()) geometry.dispose();
  geometryCache.clear();
  for (const texture of labelTextures) texture.dispose();
  labelTextures.clear();
}
