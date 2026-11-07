import test from 'node:test';
import assert from 'node:assert/strict';

import { createSeedFactory, normaliseFactory } from '../../src/state/factoryModel.js';
import { runSimulation } from '../../src/engine/SimulationEngine.js';

function seed() {
  return normaliseFactory(createSeedFactory());
}

test('seed factory produces good output and conserves mass', () => {
  const result = runSimulation(seed(), { hours: 4, stochastic: false });
  assert.equal(result.ok, true);
  assert.ok(result.good > 0, 'finished goods were produced');
  assert.ok(result.throughputPerHour > 0);
  assert.ok(result.energyKwh > 0);
  assert.ok(result.stations.length >= 2);
  assert.equal(result.connectionCount, 8);
  assert.ok(Math.abs(result.massBalance) <= result.finalWip + 1, 'mass balance is closed');
});

test('simulation is deterministic for a fixed seed', () => {
  const factory = seed();
  const a = runSimulation(factory, { hours: 2, seed: 7, stochastic: true });
  const b = runSimulation(factory, { hours: 2, seed: 7, stochastic: true });
  assert.equal(a.good, b.good);
  assert.equal(a.rejected, b.rejected);
  assert.equal(a.wip, b.wip);
  assert.equal(a.bottleneck, b.bottleneck);
});

test('the engine routes through the connection graph, not component counts', () => {
  const factory = seed();
  const broken = {
    ...factory,
    connections: factory.connections.filter((c) => c.id !== 'C1'),
  };
  const connected = runSimulation(factory, { hours: 1, stochastic: false });
  const cut = runSimulation(broken, { hours: 1, stochastic: false });
  assert.ok(connected.good > 0);
  assert.equal(cut.good, 0, 'removing the source connection stops the line');
  assert.ok(cut.notes.some((note) => note.includes('No material path')));
});

test('slower workstations reduce throughput and become the bottleneck', () => {
  const factory = seed();
  const fast = runSimulation(factory, { hours: 2, stochastic: false });
  const slowFactory = normaliseFactory({
    ...factory,
    components: factory.components.map((c) =>
      c.id === 'N3' ? { ...c, props: { ...c.props, cycleTime: 90 } } : c,
    ),
  });
  const slow = runSimulation(slowFactory, { hours: 2, stochastic: false });
  assert.ok(slow.good < fast.good);
  assert.equal(slow.bottleneck, 'Assembly station');
});

test('human-required stations starve without worker assignments', () => {
  const factory = seed();
  const unstaffed = {
    ...factory,
    connections: factory.connections.filter((c) => c.kind !== 'worker'),
  };
  const result = runSimulation(unstaffed, { hours: 1, stochastic: false });
  assert.equal(result.good, 0);
  assert.ok(result.notes.some((note) => note.includes('without a Worker hub assignment')));
});

test('buffer capacity and output capacity are respected', () => {
  const factory = seed();
  const constrained = normaliseFactory({
    ...factory,
    components: factory.components.map((c) => {
      if (c.id === 'N4') return { ...c, props: { ...c.props, capacity: 2 } };
      if (c.id === 'N7') return { ...c, props: { ...c.props, binCapacity: 5 } };
      return c;
    }),
  });
  const result = runSimulation(constrained, { hours: 3, stochastic: false });
  assert.equal(result.ok, true);
  assert.ok(result.good <= 5, 'output bin capacity caps deliveries');
});

test('a factory without source or output reports actionable notes', () => {
  const empty = normaliseFactory({ components: [], connections: [] });
  const result = runSimulation(empty, { hours: 1 });
  assert.equal(result.ok, false);
  assert.ok(result.notes.length >= 1);
});
