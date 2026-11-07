import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSeedFactory,
  createEmptyFactory,
  createComponent,
  normaliseFactory,
} from '../../src/state/factoryModel.js';
import {
  buildAdjacency,
  sourceReachability,
  validateConnection,
  validateFactoryGraph,
  wouldCreateCycle,
} from '../../src/engine/graph.js';

test('seed factory is normalised, unique and fully connected', () => {
  const factory = normaliseFactory(createSeedFactory());
  assert.equal(factory.schemaVersion, 2);
  assert.equal(validateFactoryGraph(factory).length, 0);
  assert.equal(new Set(factory.components.map((c) => c.id)).size, factory.components.length);
  assert.equal(factory.connections.filter((c) => c.kind === 'material').length, 6);
  assert.equal(factory.connections.filter((c) => c.kind === 'worker').length, 2);
  const { outgoing } = buildAdjacency(factory);
  assert.deepEqual(outgoing.get('N1'), ['N2']);
  assert.deepEqual(outgoing.get('N7'), []);
});

test('seed graph is acyclic and reaches every production node from a source', () => {
  const factory = normaliseFactory(createSeedFactory());
  assert.equal(wouldCreateCycle(factory, 'N7', 'N1'), true);
  const reach = sourceReachability(factory);
  assert.deepEqual(reach.unreachable, []);
  assert.ok(reach.reached.has('N7'));
});

test('connection validation enforces direction, type and cycles', () => {
  const factory = normaliseFactory(createSeedFactory());
  assert.equal(validateConnection(factory, 'N1', 'N2').ok, false, 'duplicate rejected');
  assert.equal(validateConnection(factory, 'N3', 'N3').ok, false, 'self rejected');
  assert.equal(validateConnection(factory, 'N7', 'N1').ok, false, 'cycle rejected');
  assert.equal(validateConnection(factory, 'N2', 'N2').ok, false);
  assert.equal(validateConnection(factory, 'N8', 'N7').ok, false, 'worker must target a workstation');
  assert.equal(validateConnection(factory, 'N1', 'N8').ok, false, 'worker hub is not a material sink');

  const buffer = createComponent('buffer', { id: 'B1', x: 2, z: 2 });
  const output = createComponent('output', { id: 'O1', x: 4, z: 2 });
  const extended = {
    ...factory,
    components: [...factory.components, buffer, output],
    connections: [...factory.connections, { id: 'CX', from: 'N4', to: 'B1' }],
  };
  assert.equal(validateConnection(extended, 'N4', 'B1').ok, false, 'still duplicate');
  const fresh = { ...extended, connections: [...factory.connections] };
  assert.equal(validateConnection(fresh, 'N4', 'B1').ok, true);
  assert.equal(validateConnection(fresh, 'B1', 'O1').ok, true);
});

test('legacy documents migrate x/z, props and infer a left-to-right graph', () => {
  const legacy = {
    name: 'Legacy',
    nodes: [
      { id: 'A', type: 'source', name: 'In', x: -4, z: 0, props: { inputPerHour: 60 } },
      { id: 'B', type: 'conveyor', name: 'Belt', x: -2, z: 0, props: { moveTime: 2 } },
      { id: 'C', type: 'workstation', name: 'Cell', x: 0, z: 0, props: { cycleTime: 30 } },
      { id: 'D', type: 'output', name: 'Bin', x: 2, z: 0, props: {} },
      { id: 'W', type: 'worker', name: 'Crew', x: 0, z: 2, props: { employees: 3 } },
    ],
  };
  const factory = normaliseFactory(legacy);
  assert.equal(factory.components.length, 5);
  assert.equal(factory.components[0].position.x, -4);
  assert.equal(factory.components[0].props.inputPerHour, 60);
  assert.equal(factory.components[2].props.cycleTime, 30);
  assert.ok(factory.connections.some((c) => c.from === 'A' && c.to === 'B'));
  assert.ok(factory.connections.some((c) => c.from === 'C' && c.to === 'D'));
  assert.ok(factory.connections.some((c) => c.from === 'W' && c.to === 'C' && c.kind === 'worker'));
});

test('empty factory has a line, grid and settings defaults', () => {
  const factory = createEmptyFactory('Blank');
  assert.equal(factory.name, 'Blank');
  assert.equal(factory.components.length, 0);
  assert.equal(factory.connections.length, 0);
  assert.equal(factory.lines.length, 1);
  assert.ok(factory.grid.snap);
  assert.equal(factory.settings.stochastic, true);
});
