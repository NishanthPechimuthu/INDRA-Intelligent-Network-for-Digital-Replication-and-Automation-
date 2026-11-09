// Factory domain model: creation, migration and normalisation.

import {
  COMPONENT_TYPES,
  DEFAULT_PROPS,
  GRAPH_TYPES,
  TYPE_MAP,
  defaultProps,
} from '../data/componentDefs.js';

let idCounter = 0;

export function makeId(prefix = 'N') {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function nextComponentId(factory, prefix = 'N') {
  const used = new Set(factory.components.map((c) => c.id));
  let id = makeId(prefix);
  while (used.has(id)) id = makeId(prefix);
  return id;
}

export function createComponent(type, options = {}) {
  const def = TYPE_MAP[type];
  if (!def) throw new Error(`Unknown component type: ${type}`);
  const id = options.id || makeId('N');
  return {
    id,
    type,
    name: options.name || def.label,
    lineId: options.lineId || null,
    position: {
      x: round(options.x ?? 0),
      y: round(options.y ?? 0),
      z: round(options.z ?? 0),
    },
    rotation: {
      x: 0,
      y: round(options.rotationY ?? 0),
      z: 0,
    },
    scale: { x: 1, y: 1, z: 1 },
    props: { ...defaultProps(type), ...(options.props || {}) },
  };
}

export function createLine(name, color, id) {
  return { id: id || makeId('L'), name, color };
}

export function createEmptyFactory(name = 'New Factory') {
  return {
    schemaVersion: 2,
    id: makeId('F'),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    grid: { size: 50, spacing: 1, snap: true },
    lines: [createLine('Line 01', '#42bda2', 'L1')],
    components: [],
    connections: [],
    settings: { durationHours: 8, warmupMinutes: 0, seed: 12345, stochastic: true },
  };
}

export function createSeedFactory() {
  const layout = [
    ['source', 'Raw material source', -5, 0],
    ['conveyor', 'Infeed conveyor', -3, 0],
    ['workstation', 'Assembly station', -1, 0],
    ['buffer', 'Buffer A', 1, 0],
    ['workstation', 'Inspection station', 3, 0],
    ['conveyor', 'Output conveyor', 5, 0],
    ['output', 'Finished goods bin', 7, 0],
    ['worker', 'Worker hub', 0, 3],
  ];
  const factory = createEmptyFactory('Plant Demo / Line 01');
  factory.id = 'F-DEMO';
  factory.components = layout.map(([type, name, x, z], i) =>
    createComponent(type, { id: `N${i + 1}`, name, x, z, lineId: 'L1' }),
  );
  const chain = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7'];
  factory.connections = chain.slice(0, -1).map((from, i) => ({
    id: `C${i + 1}`,
    from,
    to: chain[i + 1],
    kind: 'material',
  }));
  factory.connections.push(
    { id: 'C8', from: 'N8', to: 'N3', kind: 'worker' },
    { id: 'C9', from: 'N8', to: 'N5', kind: 'worker' },
  );
  const inspection = factory.components.find((component) => component.id === 'N5');
  if (inspection) inspection.props.stationType = 'inspection';
  return factory;
}

function round(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseScale(value) {
  if (typeof value === 'number') {
    const s = Math.max(0.01, value);
    return { x: s, y: s, z: s };
  }
  return {
    x: Math.max(0.01, num(value?.x, 1)),
    y: Math.max(0.01, num(value?.y, 1)),
    z: Math.max(0.01, num(value?.z, 1)),
  };
}

/** Migrate legacy / partial factory documents into the current schema. */
export function normaliseFactory(raw, options = {}) {
  if (!raw || typeof raw !== 'object') throw new Error('Factory configuration must be an object.');
  const source = raw.factory && raw.factory.components ? raw.factory : raw;
  const preset = createEmptyFactory(source.name || options.name || 'Factory');

  const components = [];
  const rawComponents = Array.isArray(source.components)
    ? source.components
    : Array.isArray(source.nodes)
      ? source.nodes
      : [];

  for (const item of rawComponents) {
    if (!item || !TYPE_MAP[item.type]) continue;
    const position = item.position || {};
    const rotation = item.rotation || {};
    const id = String(item.id || makeId('N'));
    const props = { ...defaultProps(item.type) };
    for (const [key, value] of Object.entries(item.props || {})) {
      const sample = props[key];
      if (typeof sample === 'number') props[key] = num(value, sample);
      else if (typeof sample === 'boolean') props[key] = Boolean(value);
      else props[key] = value;
    }
    components.push({
      id,
      type: item.type,
      name: String(item.name || TYPE_MAP[item.type].label),
      lineId: item.lineId ?? null,
      position: {
        x: round(position.x ?? item.x ?? 0),
        y: round(position.y ?? 0),
        z: round(position.z ?? item.z ?? 0),
      },
      rotation: {
        x: round(rotation.x ?? 0),
        y: round(rotation.y ?? item.rotationY ?? 0),
        z: round(rotation.z ?? 0),
      },
      scale: normaliseScale(item.scale),
      props,
    });
  }

  const ids = new Set(components.map((c) => c.id));
  let connections = [];
  if (Array.isArray(source.connections)) {
    connections = source.connections
      .filter((c) => c && ids.has(String(c.from)) && ids.has(String(c.to)))
      .map((c, i) => ({
        id: String(c.id || `C${i + 1}`),
        from: String(c.from),
        to: String(c.to),
        kind: c.kind === 'worker' ? 'worker' : 'material',
      }));
  } else {
    connections = inferConnections(components);
  }

  const lines = Array.isArray(source.lines) && source.lines.length
    ? source.lines.map((l, i) => ({
        id: String(l.id || `L${i + 1}`),
        name: String(l.name || `Line ${i + 1}`),
        color: l.color || '#42bda2',
      }))
    : preset.lines;

  const lineIds = new Set(lines.map((l) => l.id));
  for (const c of components) {
    if (!c.lineId || !lineIds.has(c.lineId)) c.lineId = lines[0]?.id || null;
  }

  const grid = source.grid || {};
  const settings = source.settings || {};
  const factory = {
    schemaVersion: 2,
    id: String(source.id || preset.id),
    name: String(source.name || preset.name),
    createdAt: source.createdAt || preset.createdAt,
    updatedAt: source.updatedAt || new Date().toISOString(),
    grid: {
      size: Math.max(10, Math.min(400, num(grid.size, 50))),
      spacing: Math.max(0.25, Math.min(20, num(grid.spacing, 1))),
      snap: grid.snap !== false,
    },
    lines,
    components,
    connections,
    settings: {
      durationHours: Math.max(1, Math.min(168, num(settings.durationHours, 8))),
      warmupMinutes: Math.max(0, num(settings.warmupMinutes, 0)),
      seed: num(settings.seed, 12345),
      stochastic: settings.stochastic !== false,
    },
  };
  return factory;
}

/** Legacy configs without a connection list get a sensible left-to-right line. */
function inferConnections(components) {
  const flow = components
    .filter((c) => GRAPH_TYPES.has(c.type))
    .slice()
    .sort((a, b) => a.position.x - b.position.x);
  const result = [];
  for (let i = 0; i < flow.length - 1; i += 1) {
    const from = flow[i];
    const to = flow[i + 1];
    const fromOk = ['source', 'workstation', 'conveyor', 'buffer'].includes(from.type);
    const toOk = ['workstation', 'conveyor', 'buffer', 'output'].includes(to.type);
    if (fromOk && toOk) {
      result.push({ id: `C${result.length + 1}`, from: from.id, to: to.id, kind: 'material' });
    }
  }
  for (const hub of components.filter((c) => c.type === 'worker')) {
    for (const station of components.filter((c) => c.type === 'workstation')) {
      result.push({ id: `C${result.length + 1}`, from: hub.id, to: station.id, kind: 'worker' });
    }
  }
  return result;
}

export function cloneFactory(factory) {
  return typeof structuredClone === 'function'
    ? structuredClone(factory)
    : JSON.parse(JSON.stringify(factory));
}

export function duplicateComponent(component, factory, offset = { x: 2, z: 0 }) {
  return {
    ...cloneFactory(component),
    id: nextComponentId(factory, 'N'),
    name: `${component.name} copy`,
    position: {
      ...component.position,
      x: round(component.position.x + offset.x),
      z: round(component.position.z + offset.z),
    },
  };
}

export function knownTypes() {
  return COMPONENT_TYPES.map((t) => t.type);
}

export function normaliseRotation(value) {
  const twoPi = Math.PI * 2;
  let r = value % twoPi;
  if (r > Math.PI) r -= twoPi;
  if (r < -Math.PI) r += twoPi;
  return round(r, 4);
}

export { DEFAULT_PROPS };
