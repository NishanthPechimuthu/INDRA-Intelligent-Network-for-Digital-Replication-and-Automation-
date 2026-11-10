// Bridge between the React application and the C++/WebAssembly DES core.
// The module is loaded lazily; until it is ready the JS reference engine is used.

import { sourceReachability, workerConnections } from './graph.js';

let modulePromise = null;
let wasmModule = null;
let wasmFailed = false;

const NODE_TYPE_CODE = {
  source: 0,
  workstation: 1,
  conveyor: 2,
  buffer: 3,
  output: 4,
  worker: 5,
  chart: 6,
  display: 6,
};

function num(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function browserUrl(path) {
  return new URL(path, window.location.origin).href;
}

export async function loadWasmEngine(options = {}) {
  if (wasmModule) return wasmModule;
  if (wasmFailed) return null;
  if (modulePromise) return modulePromise;

  modulePromise = (async () => {
    try {
      let factory;
      let locateFile;
      if (typeof window !== 'undefined') {
        const mod = await import(/* @vite-ignore */ browserUrl('/simulation.mjs'));
        factory = mod.default;
        locateFile = (path) => browserUrl(`/${path}`);
      } else {
        const { fileURLToPath } = process.getBuiltinModule('node:url');
        const base = import.meta.url;
        const wasmPath = new URL('../../public/', base);
        const mod = await import(/* @vite-ignore */ new URL('simulation.mjs', wasmPath).href);
        factory = mod.default;
        locateFile = (path) => fileURLToPath(new URL(path, wasmPath));
      }
      const instance = await factory({ locateFile });
      wasmModule = instance;
      return instance;
    } catch (error) {
      wasmFailed = true;
      if (options.onError) options.onError(error);
      return null;
    }
  })();

  return modulePromise;
}

export function isWasmReady() {
  return Boolean(wasmModule);
}

export function getLoadedModule() {
  return wasmModule;
}

function integer(value, fallback = 0) {
  return Math.round(num(value, fallback));
}

function buildNotes(factory, options) {
  const notes = [];
  const reach = sourceReachability(factory);
  if (reach.unreachable.length) {
    notes.push(`No material path from a source: ${reach.unreachable.slice(0, 6).join(', ')}.`);
  }
  const assigned = new Set(workerConnections(factory).map((c) => c.to));
  const unstaffed = factory.components.filter(
    (component) =>
      component.type === 'workstation' &&
      component.props.humanRequired &&
      !assigned.has(component.id),
  );
  if (unstaffed.length) {
    notes.push(
      `Human-required stations without a Worker hub assignment: ${unstaffed
        .map((component) => component.name)
        .slice(0, 6)
        .join(', ')}.`,
    );
  }
  if (!options.stochastic) {
    notes.push('Stochastic faults, tool damage and rejection sampling are disabled for this run.');
  }
  if (!notes.length) notes.push('Simulation completed using the connected factory graph.');
  return notes;
}

/**
 * Execute the WASM core against a normalised factory document.
 * @param {object} factory
 * @param {{hours?:number, seed?:number, stochastic?:boolean, stepSeconds?:number}} options
 * @param {object} [module] optionally pass an already loaded Emscripten module
 */
export function runWasmSimulation(factory, options = {}, module = wasmModule) {
  if (!module) throw new Error('The WebAssembly simulation core is not loaded.');
  const components = factory.components || [];
  const hours = Math.max(
    1,
    Math.min(168, Math.round(options.hours ?? factory.settings?.durationHours ?? 8)),
  );
  const seed = Math.max(1, Math.abs(Math.floor(num(options.seed ?? factory.settings?.seed, 12345))) || 1);
  const stochastic = options.stochastic ?? factory.settings?.stochastic ?? true;
  const step = Math.max(0.25, num(options.stepSeconds, 1));

  const ccall = module.ccall;
  const call = (name, type, argTypes, args) => ccall(name, type, argTypes, args);
  const metric = (code) => call('sim_metric', 'number', ['number'], [code]);

  call('sim_begin', null, ['number'], [components.length]);

  const nodeArgTypes = new Array(22).fill('number');
  for (const component of components) {
    const props = component.props || {};
    call('sim_add_node', null, nodeArgTypes, [
      NODE_TYPE_CODE[component.type] ?? 6,
      num(props.inputPerHour),
      num(props.initialQuantity),
      num(props.cycleTime),
      num(props.errorRate),
      num(props.toolDamage),
      num(props.powerKw),
      num(props.workers),
      props.humanRequired ? 1 : 0,
      num(props.workingTimePerShift, 480),
      num(props.breakMinutes),
      num(props.meetingMinutes),
      num(props.changeoverMinutes),
      num(props.errorRecoveryMinutes),
      num(props.moveTime, 1),
      num(props.faultRate),
      num(props.faultRecoveryMinutes),
      num(props.capacity, 1),
      num(props.binCapacity, 1),
      num(props.shiftMinutes, 480),
      num(props.employees),
      props.mode === 'LIFO' ? 1 : 0,
    ]);
  }

  const indexById = new Map(components.map((component, index) => [component.id, index]));
  for (const edge of factory.connections || []) {
    const from = indexById.get(edge.from);
    const to = indexById.get(edge.to);
    if (from === undefined || to === undefined) continue;
    call('sim_add_edge', null, ['number', 'number', 'number'], [
      from,
      to,
      edge.kind === 'worker' ? 1 : 0,
    ]);
  }

  const started = call('sim_run', 'number', ['number', 'number', 'number', 'number'], [
    hours,
    step,
    seed,
    stochastic ? 1 : 0,
  ]);

  if (!started) {
    return {
      ok: false,
      hours,
      input: 0,
      good: 0,
      rejected: 0,
      throughputPerHour: 0,
      rate: 0,
      utilization: 0,
      util: 0,
      workerUtilization: 0,
      avgCycleTime: 0,
      avgWaitingTime: 0,
      wip: 0,
      bottleneck: 'Add a complete production line',
      energyKwh: 0,
      stations: [],
      workers: [],
      hourly: Array.from({ length: hours }, (_, i) => ({
        hour: i,
        label: `${i + 1}h`,
        good: 0,
        rejected: 0,
        wip: 0,
        value: 0,
      })),
      chart: [],
      notes: [
        !components.some((c) => c.type === 'source')
          ? 'Add a Source component to generate products.'
          : null,
        !components.some((c) => c.type === 'output')
          ? 'Add an Output bin to collect finished goods.'
          : null,
        !components.some((c) => c.type === 'workstation')
          ? 'Add at least one Workstation to process products.'
          : null,
      ].filter(Boolean),
      finalWip: 0,
      massBalance: 0,
      engine: 'wasm',
    };
  }

  const stationCount = call('sim_station_count', 'number', [], []);
  const workerCount = call('sim_worker_count', 'number', [], []);
  const hourlyCount = call('sim_hourly_count', 'number', [], []);
  const round = (value, digits = 1) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  };

  const stations = Array.from({ length: stationCount }, (_, i) => {
    const nodeIndex = call('sim_station_index', 'number', ['number'], [i]);
    const component = components[nodeIndex] || {};
    const value = (code) => call('sim_station_metric', 'number', ['number', 'number'], [i, code]);
    return {
      id: component.id,
      name: component.name || 'Workstation',
      utilization: value(0),
      availability: value(1),
      busyHours: value(2),
      starvedHours: value(3),
      blockedHours: value(4),
      downHours: value(5),
      processed: value(6),
      good: value(7),
      rejected: value(8),
      throughput: value(9),
      cycleTime: value(10),
      workers: value(11),
    };
  });

  const workers = Array.from({ length: workerCount }, (_, i) => {
    const nodeIndex = call('sim_worker_index', 'number', ['number'], [i]);
    const component = components[nodeIndex] || {};
    const value = (code) => call('sim_worker_metric', 'number', ['number', 'number'], [i, code]);
    return {
      id: component.id,
      name: component.name || 'Worker hub',
      utilization: value(0),
      employees: value(1),
      availableHours: value(2),
      busyHours: value(3),
      assignments: value(4),
    };
  });

  const hourly = Array.from({ length: hourlyCount }, (_, i) => {
    const value = (code) => call('sim_hourly_metric', 'number', ['number', 'number'], [i, code]);
    return {
      hour: i,
      label: `${i + 1}h`,
      good: value(0),
      rejected: value(1),
      wip: value(2),
      value: value(0),
    };
  });

  const bottleneckIndex = Math.round(metric(12));
  const throughputPerHour = Math.round(metric(3) * 10) / 10;

  const result = {
    ok: true,
    hours,
    input: metric(2),
    good: metric(0),
    rejected: metric(1),
    throughputPerHour,
    rate: Math.round(throughputPerHour),
    utilization: round(metric(4), 1),
    util: Math.round(metric(4)),
    workerUtilization: round(metric(5), 1),
    avgCycleTime: round(metric(6), 1),
    avgWaitingTime: round(metric(7), 1),
    wip: round(metric(8), 1),
    finalWip: metric(9),
    bottleneck:
      bottleneckIndex >= 0 && stations[bottleneckIndex]
        ? stations[bottleneckIndex].name
        : stations[0]?.name || '—',
    energyKwh: round(metric(10), 2),
    stations,
    workers,
    hourly,
    chart: hourly,
    notes: buildNotes(factory, { stochastic }),
    initialStock: metric(17),
    massBalance: round(metric(11), 6),
    seed,
    stochastic,
    connectionCount: (factory.connections || []).length,
    engine: 'wasm',
  };
  return result;
}
