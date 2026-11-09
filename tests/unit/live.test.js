import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createComponent,
  createEmptyFactory,
  createSeedFactory,
  normaliseFactory,
} from '../../src/state/factoryModel.js';
import { ProductionEngine } from '../../src/engine/live/ProductionEngine.js';

function seed() {
  return normaliseFactory(createSeedFactory());
}

function lineFactory(components, connections, settings = {}) {
  const factory = createEmptyFactory('Live unit test');
  factory.components = components.map((definition) =>
    createComponent(definition.type, { lineId: 'L1', ...definition }),
  );
  factory.connections = connections.map(([from, to], index) => ({
    id: `C${index + 1}`,
    from,
    to,
    kind: 'material',
  }));
  factory.settings = { ...factory.settings, ...settings };
  return normaliseFactory(factory);
}

test('continuous live run produces mass-balanced metrics on the demo graph', () => {
  const engine = new ProductionEngine(seed(), { durationSeconds: 3600, seed: 42 });
  const snapshot = engine.advance(3600);

  assert.equal(snapshot.finished, true);
  assert.equal(snapshot.elapsed, 3600);
  assert.ok(snapshot.metrics.input > 0, 'products were generated');
  assert.ok(snapshot.metrics.good > 0, 'finished goods were delivered');
  assert.equal(snapshot.metrics.connectionCount, 8);
  assert.ok(Math.abs(snapshot.metrics.massBalance) <= 1, 'input + stock = good + rejected + WIP');
  assert.ok(snapshot.metrics.stations.length >= 2);
  assert.ok(Number.isFinite(snapshot.metrics.oee));
  assert.ok(snapshot.metrics.bottleneck);
});

test('continuous live run is deterministic for a fixed seed', () => {
  const factory = seed();
  const a = new ProductionEngine(factory, { durationSeconds: 1800, seed: 7 }).advance(1800);
  const b = new ProductionEngine(factory, { durationSeconds: 1800, seed: 7 }).advance(1800);
  assert.equal(a.metrics.input, b.metrics.input);
  assert.equal(a.metrics.good, b.metrics.good);
  assert.equal(a.metrics.rejected, b.metrics.rejected);
  assert.equal(a.metrics.wip, b.metrics.wip);
  assert.equal(a.metrics.bottleneck, b.metrics.bottleneck);
});

test('step mode advances one operation and previous restores the earlier state', () => {
  const engine = new ProductionEngine(seed(), { durationSeconds: 3600, seed: 42 });
  const first = engine.step();
  assert.ok(first.operationSeq >= 1);
  assert.ok(first.elapsed > 0);
  assert.ok(first.lastOperation?.type);

  let snapshot = first;
  for (let index = 0; index < 4; index += 1) {
    const next = engine.step();
    assert.ok(next.operationSeq > snapshot.operationSeq, 'each step advances the operation number');
    snapshot = next;
  }

  const earlier = engine.previousStep();
  assert.ok(earlier.operationSeq < snapshot.operationSeq);
  assert.ok(earlier.elapsed <= snapshot.elapsed);

  const reset = engine.reset();
  assert.equal(reset.elapsed, 0);
  assert.equal(reset.operationSeq, 0);
  assert.equal(reset.products.length, 0);
});

test('products move only along declared graph connections', () => {
  const factory = seed();
  const connections = new Set(
    factory.connections
      .filter((edge) => (edge.kind || 'material') === 'material')
      .map((edge) => `${edge.from}->${edge.to}`),
  );
  const componentIds = new Set(factory.components.map((component) => component.id));
  const engine = new ProductionEngine(factory, { durationSeconds: 900, seed: 11 });
  const snapshot = engine.advance(900);

  for (const product of snapshot.products) {
    const location = product.location;
    assert.ok(location, `product ${product.id} has a runtime location`);
    if (location.kind === 'transfer') {
      assert.ok(componentIds.has(location.from));
      assert.ok(componentIds.has(location.to));
      assert.ok(
        connections.has(`${location.from}->${location.to}`),
        `transfer ${location.from}->${location.to} is a real material connection`,
      );
    } else if (location.nodeId) {
      assert.ok(componentIds.has(location.nodeId), `product ${product.id} sits on a real node`);
    }
  }
});

test('inspection and worker metrics are exposed for every station type', () => {
  const factory = seed();
  const engine = new ProductionEngine(factory, { durationSeconds: 3600, seed: 42, stochastic: true });
  const snapshot = engine.advance(3600);

  const inspection = snapshot.metrics.stations.find((station) => station.stationType === 'inspection');
  assert.ok(inspection, 'the inspection station is tracked');
  assert.ok(inspection.processed > 0);
  assert.ok(inspection.rejected >= 0);
  assert.ok(inspection.accuracy >= 0);

  const station = snapshot.metrics.stations.find((item) => item.id === 'N3');
  assert.ok(station.workers >= 1, 'assigned workers are reported');
  assert.ok(station.activeWorkers >= 0);

  const hub = snapshot.metrics.workers.find((worker) => worker.id === 'N8');
  assert.ok(hub);
  assert.ok(hub.employees >= 1);
  assert.ok(Number.isFinite(hub.utilization));
});

test('a run stops at the configured duration instead of overrunning', () => {
  const engine = new ProductionEngine(seed(), { durationSeconds: 120, seed: 5 });
  const snapshot = engine.advance(5000);
  assert.equal(snapshot.finished, true);
  assert.equal(snapshot.elapsed, 120);
});

test('queues and buffers respect capacity and block upstream stations', () => {
  const factory = lineFactory(
    [
      { type: 'source', id: 'S', x: 0, props: { inputPerHour: 120 } },
      {
        type: 'workstation',
        id: 'W',
        x: 2,
        props: {
          humanRequired: false,
          cycleTime: 120,
          processingCapacity: 1,
          queueCapacity: 2,
          errorRate: 0,
        },
      },
      { type: 'buffer', id: 'B', x: 4, props: { capacity: 1 } },
      { type: 'output', id: 'O', x: 6, props: { binCapacity: 1 } },
    ],
    [
      ['S', 'W'],
      ['W', 'B'],
      ['B', 'O'],
    ],
  );
  const engine = new ProductionEngine(factory, {
    durationSeconds: 600,
    seed: 3,
    stochastic: false,
  });
  let observedBlocking = false;
  for (let elapsed = 0; elapsed < 600; elapsed += 2) {
    engine.advance(2);
    const workstation = engine.nodes.get('W');
    const buffer = engine.nodes.get('B');
    const output = engine.nodes.get('O');
    assert.ok(workstation.queue.length <= workstation.queueCapacity, 'workstation queue never overflows');
    assert.ok(buffer.queue.length <= buffer.queueCapacity, 'buffer never exceeds its capacity');
    assert.ok(output.count <= output.capacity, 'output bin never exceeds its capacity');
    if (workstation.blockedTime > 0) observedBlocking = true;
  }
  assert.ok(observedBlocking, 'a full downstream buffer blocks the upstream workstation');
});

test('inspection rejects defective products and records rejection reasons', () => {
  const factory = lineFactory(
    [
      { type: 'source', id: 'S', x: 0, props: { inputPerHour: 120 } },
      {
        type: 'workstation',
        id: 'W',
        x: 2,
        props: {
          humanRequired: false,
          cycleTime: 1,
          errorRate: 100,
          queueCapacity: 20,
        },
      },
      {
        type: 'workstation',
        id: 'I',
        x: 4,
        props: {
          stationType: 'inspection',
          humanRequired: false,
          cycleTime: 1,
          errorRate: 0,
          defectDetectionRate: 100,
          inspectionAccuracy: 100,
          queueCapacity: 20,
        },
      },
      { type: 'output', id: 'O', x: 6, props: { binCapacity: 1000 } },
    ],
    [
      ['S', 'W'],
      ['W', 'I'],
      ['I', 'O'],
    ],
  );
  const engine = new ProductionEngine(factory, {
    durationSeconds: 600,
    seed: 9,
    stochastic: true,
  });
  const snapshot = engine.advance(600);

  assert.ok(snapshot.metrics.rejected > 0, 'defective products are rejected');
  assert.equal(snapshot.metrics.good, 0, 'nothing defective reaches the output as good');
  const inspection = snapshot.metrics.stations.find((station) => station.id === 'I');
  assert.ok(inspection, 'inspection metrics are exposed');
  assert.ok(inspection.rejected > 0, 'the inspection station records its rejections');
  assert.equal(
    inspection.processed,
    inspection.rejected + inspection.accepted,
    'every inspected product is either rejected or accepted',
  );
});

test('scheduled maintenance records downtime and stops processing', () => {
  const factory = lineFactory(
    [
      { type: 'source', id: 'S', x: 0, props: { inputPerHour: 60 } },
      {
        type: 'workstation',
        id: 'W',
        x: 2,
        props: {
          humanRequired: false,
          cycleTime: 1,
          errorRate: 0,
          maintenanceInterval: 1,
          maintenanceMinutes: 5,
          queueCapacity: 20,
        },
      },
      { type: 'output', id: 'O', x: 4, props: { binCapacity: 1000 } },
    ],
    [
      ['S', 'W'],
      ['W', 'O'],
    ],
  );
  const engine = new ProductionEngine(factory, {
    durationSeconds: 600,
    seed: 4,
    stochastic: true,
  });
  const snapshot = engine.advance(600);
  const workstation = snapshot.metrics.stations.find((station) => station.id === 'W');

  assert.ok(engine.nodes.get('W').faultEvents >= 1, 'maintenance is scheduled after the first piece');
  assert.ok(workstation.downHours > 0, 'downtime is recorded against the station');
  assert.ok(workstation.availability < 100, 'availability drops while the station is down');
  assert.ok(workstation.processed < 10, 'processing stops for the maintenance window');
});

test('a starved station records waiting and a branching line fills both outputs', () => {
  const starvedFactory = lineFactory(
    [
      { type: 'source', id: 'S', x: 0, props: { inputPerHour: 0 } },
      {
        type: 'workstation',
        id: 'W',
        x: 2,
        props: { humanRequired: false, cycleTime: 1, errorRate: 0 },
      },
      { type: 'output', id: 'O', x: 4, props: { binCapacity: 1000 } },
    ],
    [
      ['S', 'W'],
      ['W', 'O'],
    ],
  );
  const starved = new ProductionEngine(starvedFactory, {
    durationSeconds: 60,
    seed: 2,
    stochastic: false,
  }).advance(60);
  const idle = starved.metrics.stations.find((station) => station.id === 'W');
  assert.ok(idle.starvedHours > 0, 'a station with no arrivals records starvation');

  const branchFactory = lineFactory(
    [
      { type: 'source', id: 'S', x: 0, props: { inputPerHour: 180 } },
      {
        type: 'workstation',
        id: 'W',
        x: 2,
        props: { humanRequired: false, cycleTime: 1, errorRate: 0, queueCapacity: 20 },
      },
      { type: 'output', id: 'O1', x: 4, z: -1, props: { binCapacity: 1000 } },
      { type: 'output', id: 'O2', x: 4, z: 1, props: { binCapacity: 1000 } },
    ],
    [
      ['S', 'W'],
      ['W', 'O1'],
      ['W', 'O2'],
    ],
  );
  const branched = new ProductionEngine(branchFactory, {
    durationSeconds: 300,
    seed: 6,
    stochastic: false,
  }).advance(300);
  const first = branched.metrics.stations.find((station) => station.id === 'O1');
  const second = branched.metrics.stations.find((station) => station.id === 'O2');
  assert.ok(first && second, 'both branch outputs report metrics');
  assert.ok(first.accepted > 0 && second.accepted > 0, 'both branches receive products');
});
