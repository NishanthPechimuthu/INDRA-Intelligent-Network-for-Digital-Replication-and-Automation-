import test from 'node:test';
import assert from 'node:assert/strict';

import {
  serializeFactory,
  deserializeFactory,
  diffFactories,
  layoutStats,
} from '../../src/persistence/FactorySerializer.js';
import { createSeedFactory, normaliseFactory } from '../../src/state/factoryModel.js';

function seed() {
  return normaliseFactory(createSeedFactory());
}

test('serialization round-trips a factory without loss', () => {
  const factory = seed();
  const restored = deserializeFactory(serializeFactory(factory));
  assert.equal(restored.factory.name, factory.name);
  assert.equal(restored.factory.components.length, factory.components.length);
  assert.equal(restored.factory.connections.length, factory.connections.length);
  assert.deepEqual(restored.factory.grid, factory.grid);
  assert.deepEqual(restored.factory.settings, factory.settings);
});

test('invalid JSON and dangling connections are rejected', () => {
  assert.throws(() => deserializeFactory('{ not json'), /Invalid JSON/);
  assert.throws(
    () =>
      deserializeFactory(
        JSON.stringify({
          components: [{ id: 'A', type: 'source', position: { x: 0, z: 0 } }],
          connections: [{ id: 'C', from: 'A', to: 'MISSING' }],
        }),
      ),
    /missing component/,
  );
});

test('diff detects added, removed, moved and property-changed components', () => {
  const baseline = seed();
  const proposed = structuredClone(baseline);
  proposed.components = proposed.components.filter((c) => c.id !== 'N6');
  proposed.components.push({
    id: 'N9',
    type: 'buffer',
    name: 'Extra buffer',
    lineId: 'L1',
    position: { x: 9, y: 0, z: 3 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    props: { capacity: 20, initialQuantity: 0, mode: 'FIFO' },
  });
  proposed.components.find((c) => c.id === 'N3').position.x = 0.5;
  proposed.components.find((c) => c.id === 'N5').props.cycleTime = 42;
  proposed.connections = proposed.connections.filter((c) => c.id !== 'C2');
  proposed.connections.push({ id: 'C10', from: 'N4', to: 'N9', kind: 'material' });

  const diff = diffFactories(baseline, proposed);
  assert.equal(diff.hasChanges, true);
  assert.deepEqual(diff.added.map((c) => c.id), ['N9']);
  assert.deepEqual(diff.removed.map((c) => c.id), ['N6']);
  assert.ok(diff.modified.some((entry) => entry.id === 'N3'));
  assert.ok(diff.propertyChanges.some((entry) => entry.id === 'N5' && entry.key === 'cycleTime'));
  assert.equal(diff.connectionsAdded.length, 1);
  assert.equal(diff.connectionsRemoved.length, 1);
});

test('diff reports no changes for identical factories', () => {
  const baseline = seed();
  const diff = diffFactories(baseline, structuredClone(baseline));
  assert.equal(diff.hasChanges, false);
  assert.equal(diff.added.length, 0);
  assert.equal(diff.modified.length, 0);
});

test('layout stats aggregate components, connections and workers', () => {
  const stats = layoutStats(seed());
  assert.equal(stats.components, 8);
  assert.equal(stats.connections, 8);
  assert.equal(stats.workstations, 2);
  assert.equal(stats.workers, 4);
  assert.equal(stats.lines, 1);
});
