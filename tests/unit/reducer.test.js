import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, factoryReducer, canUndo, canRedo } from '../../src/state/factoryReducer.js';
import { createSeedFactory, createComponent } from '../../src/state/factoryModel.js';

function fresh() {
  return createInitialState(createSeedFactory());
}

test('addComponent selects the new component and records history', () => {
  const state = fresh();
  const component = createComponent('buffer', { id: 'B9', x: 2, z: 4 });
  const next = factoryReducer(state, { type: 'addComponent', component });
  assert.equal(next.factory.components.length, state.factory.components.length + 1);
  assert.deepEqual(next.selection, ['B9']);
  assert.equal(canUndo(next), true);
});

test('updateProps coalesces successive edits with the same tag', () => {
  const state = fresh();
  const first = factoryReducer(state, {
    type: 'updateProps',
    id: 'N3',
    props: { cycleTime: 25 },
    meta: { tag: 'props:N3:cycleTime' },
  });
  const second = factoryReducer(first, {
    type: 'updateProps',
    id: 'N3',
    props: { cycleTime: 30 },
    meta: { tag: 'props:N3:cycleTime' },
  });
  assert.equal(second.factory.components.find((c) => c.id === 'N3').props.cycleTime, 30);
  assert.equal(second.past.length, state.past.length + 1, 'one history entry for the edit burst');
});

test('delete removes attached connections and undo restores everything', () => {
  const state = fresh();
  const next = factoryReducer(state, { type: 'deleteComponents', ids: ['N3'] });
  assert.equal(next.factory.components.some((c) => c.id === 'N3'), false);
  assert.equal(next.factory.connections.some((c) => c.from === 'N3' || c.to === 'N3'), false);
  const restored = factoryReducer(next, { type: 'undo' });
  assert.equal(restored.factory.components.some((c) => c.id === 'N3'), true);
  assert.equal(restored.factory.connections.some((c) => c.to === 'N3'), true);
  assert.equal(canRedo(restored), true);
});

test('duplicate copies selected components and their internal connections', () => {
  const state = fresh();
  const next = factoryReducer(state, { type: 'duplicateComponents', ids: ['N1', 'N2'] });
  assert.equal(next.factory.components.length, state.factory.components.length + 2);
  const copies = next.factory.components.filter((c) => next.selection.includes(c.id));
  assert.equal(copies.length, 2);
  assert.equal(next.factory.connections.some((c) => c.from === copies[0].id && c.to === copies[1].id), true);
  assert.equal(new Set(next.factory.components.map((c) => c.id)).size, next.factory.components.length);
});

test('load prunes stale selection and resets history by default', () => {
  const state = factoryReducer(fresh(), { type: 'setSelection', ids: ['N5'] });
  const loaded = factoryReducer(state, { type: 'load', factory: createSeedFactory() });
  assert.equal(loaded.past.length, 0);
  assert.deepEqual(loaded.selection, []);
});

test('setGrid updates without producing a duplicate connection side-effect', () => {
  const state = fresh();
  const next = factoryReducer(state, { type: 'setGrid', patch: { snap: false, spacing: 2 } });
  assert.equal(next.factory.grid.snap, false);
  assert.equal(next.factory.grid.spacing, 2);
  assert.equal(next.factory.connections.length, state.factory.connections.length);
});
