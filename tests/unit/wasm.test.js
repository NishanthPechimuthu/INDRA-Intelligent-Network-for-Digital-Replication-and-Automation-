import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import createSimulationModule from '../../public/simulation.mjs';
import { createSeedFactory, normaliseFactory } from '../../src/state/factoryModel.js';
import { runSimulation } from '../../src/engine/SimulationEngine.js';
import { runWasmSimulation } from '../../src/engine/wasmBridge.js';

const wasmRoot = new URL('../../public/', import.meta.url);

async function loadModule() {
  return createSimulationModule({
    locateFile: (path) => fileURLToPath(new URL(path, wasmRoot)),
  });
}

const GLOBAL_KEYS = [
  'good',
  'rejected',
  'input',
  'throughputPerHour',
  'rate',
  'utilization',
  'util',
  'workerUtilization',
  'avgCycleTime',
  'avgWaitingTime',
  'wip',
  'finalWip',
  'energyKwh',
  'massBalance',
  'bottleneck',
  'initialStock',
];

function assertParity(js, wasm) {
  for (const key of GLOBAL_KEYS) {
    assert.equal(wasm[key], js[key], `global metric ${key}`);
  }
  assert.equal(wasm.stations.length, js.stations.length);
  for (let i = 0; i < js.stations.length; i += 1) {
    for (const key of [
      'id',
      'utilization',
      'availability',
      'processed',
      'good',
      'rejected',
      'throughput',
    ]) {
      assert.equal(wasm.stations[i][key], js.stations[i][key], `station ${i} ${key}`);
    }
  }
  assert.equal(wasm.workers.length, js.workers.length);
  for (let i = 0; i < js.workers.length; i += 1) {
    for (const key of ['id', 'utilization', 'employees', 'assignments']) {
      assert.equal(wasm.workers[i][key], js.workers[i][key], `worker ${i} ${key}`);
    }
  }
  assert.equal(wasm.hourly.length, js.hourly.length);
  for (let i = 0; i < js.hourly.length; i += 1) {
    for (const key of ['good', 'rejected', 'wip']) {
      assert.equal(wasm.hourly[i][key], js.hourly[i][key], `hour ${i} ${key}`);
    }
  }
}

test('C++/WASM core matches the JS reference on the demo line', async () => {
  const module = await loadModule();
  const factory = normaliseFactory(createSeedFactory());
  for (const options of [
    { hours: 1, stochastic: false, seed: 1 },
    { hours: 8, stochastic: false, seed: 1 },
    { hours: 8, stochastic: true, seed: 12345 },
    { hours: 4, stochastic: true, seed: 99 },
  ]) {
    const reference = runSimulation(factory, options);
    const wasm = runWasmSimulation(factory, options, module);
    assert.equal(wasm.engine, 'wasm');
    assertParity(reference, wasm);
  }
});

test('C++/WASM core agrees on a constrained, long-running layout', async () => {
  const module = await loadModule();
  const factory = normaliseFactory({
    ...createSeedFactory(),
    settings: { durationHours: 12, seed: 7, stochastic: true },
  });
  factory.components = factory.components.map((component) => {
    if (component.id === 'N3') {
      return { ...component, props: { ...component.props, cycleTime: 45, errorRate: 3 } };
    }
    if (component.id === 'N4') {
      return { ...component, props: { ...component.props, capacity: 6 } };
    }
    if (component.id === 'N8') {
      return { ...component, props: { ...component.props, employees: 2 } };
    }
    return component;
  });
  const options = { hours: 12, stochastic: true, seed: 7 };
  const reference = runSimulation(factory, options);
  const wasm = runWasmSimulation(factory, options, module);
  assertParity(reference, wasm);
});

test('C++/WASM core reports an empty factory without crashing', async () => {
  const module = await loadModule();
  const factory = normaliseFactory({ components: [], connections: [] });
  const result = runWasmSimulation(factory, { hours: 2 }, module);
  assert.equal(result.ok, false);
  assert.ok(result.notes.length > 0);
});
