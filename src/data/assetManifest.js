// Local GLB asset catalogue. Every runtime model is bundled with the application;
// no external model URL is requested by the browser.
//
// `target` is the approximate world-space footprint used to normalise each model
// so the existing grid, ports and transform controls keep working.

export const GLB_MODELS = {
  source: {
    key: 'material-source',
    file: 'material-source.glb',
    label: 'Material hopper',
    target: [1.35, 1.55, 1.35],
    license: 'CC0-1.0',
    author: 'Kenney',
  },
  workstation: {
    key: 'workstation',
    file: 'workstation.glb',
    label: 'Industrial workstation',
    target: [1.7, 1.65, 1.45],
    license: 'CC0-1.0',
    author: 'Kenney',
  },
  inspection: {
    key: 'inspection',
    file: 'inspection.glb',
    label: 'Inspection scanner',
    target: [1.45, 1.6, 1.4],
    license: 'CC0-1.0',
    author: 'Kenney',
    rotationY: Math.PI / 2,
  },
  conveyor: {
    key: 'conveyor',
    file: 'conveyor.glb',
    label: 'Conveyor belt',
    target: [2.2, 0.8, 0.95],
    license: 'CC0-1.0',
    author: 'Kenney',
  },
  buffer: {
    key: 'buffer',
    file: 'buffer.glb',
    label: 'Buffer storage',
    target: [1.4, 1.05, 1.25],
    license: 'CC0-1.0',
    author: 'Kenney',
  },
  output: {
    key: 'output-bin',
    file: 'output-bin.glb',
    label: 'Finished goods bin',
    target: [1.35, 0.9, 1.25],
    license: 'CC0-1.0',
    author: 'Kenney',
  },
  display: {
    key: 'control-panel',
    file: 'control-panel.glb',
    label: 'Industrial control panel',
    target: [1.35, 1.95, 0.55],
    license: 'CC0-1.0',
    author: 'Kenney',
  },
  worker: {
    key: 'worker',
    file: 'worker.glb',
    label: 'Animated worker',
    target: [0.62, 1.78, 0.62],
    license: 'CC0-1.0',
    author: 'Quaternius / Cinevva',
    animated: true,
  },
};

const TYPE_TO_MODEL = {
  source: 'source',
  workstation: 'workstation',
  conveyor: 'conveyor',
  buffer: 'buffer',
  output: 'output',
  display: 'display',
  worker: 'worker',
};

export function modelKeyForComponent(component) {
  if (!component) return null;
  if (component.type === 'workstation' && component.props?.stationType === 'inspection') {
    return 'inspection';
  }
  return TYPE_TO_MODEL[component.type] || null;
}

export function modelForComponent(component) {
  const key = modelKeyForComponent(component);
  return key ? GLB_MODELS[key] : null;
}

export const REQUIRED_GLB_FILES = Object.values(GLB_MODELS).map((model) => model.file);

export const WORKER_CLIPS = {
  idle: ['Idle'],
  working: ['PickUp', 'Punch'],
  inspecting: ['PickUp'],
  assembly: ['PickUp'],
  material: ['Walk_Carry', 'Run_Carry'],
  walking: ['Walk'],
  unavailable: ['SitDown'],
};
