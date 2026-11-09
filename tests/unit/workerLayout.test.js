import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_AVATARS_PER_STATION,
  workerCount,
  workerLayout,
} from '../../src/three/workerLayout.js';

const station = {
  type: 'workstation',
  position: { x: 3, y: 0, z: 0 },
  rotation: { y: 0 },
  props: { workers: 2 },
};

test('worker count follows the editable Assigned Workers property', () => {
  assert.equal(workerCount(station), 2);
  assert.equal(workerCount({ ...station, props: { workers: 0 } }), 0);
  assert.equal(workerCount({ ...station, props: { workers: -4 } }), 0);
  assert.equal(workerCount({ ...station, props: { workers: 999 } }), MAX_AVATARS_PER_STATION);
  assert.equal(workerCount({ ...station, type: 'buffer' }), 0);
});

test('zero assigned workers yields no avatars', () => {
  assert.deepEqual(workerLayout(station, 0), []);
});

test('one avatar is placed in front of its own workstation', () => {
  const [position] = workerLayout(station, 1);
  assert.ok(position.z > station.position.z, 'single worker stands in front of the station');
  assert.equal(position.x, station.position.x);
  assert.equal(position.y, 0);
});

test('multiple avatars do not overlap and stay around their workstation', () => {
  const positions = workerLayout(station, 8);
  assert.equal(positions.length, 8);
  for (let a = 0; a < positions.length; a += 1) {
    const distance = Math.hypot(
      positions[a].x - station.position.x,
      positions[a].z - station.position.z,
    );
    assert.ok(distance > 0.8 && distance < 2.4, 'avatar remains in the station arc');
    for (let b = a + 1; b < positions.length; b += 1) {
      const gap = Math.hypot(positions[a].x - positions[b].x, positions[a].z - positions[b].z);
      assert.ok(gap > 0.35, `avatars ${a} and ${b} do not overlap`);
    }
  }
});

test('more than eight workers use a non-overlapping outer ring', () => {
  const positions = workerLayout(station, 12);
  assert.equal(positions.length, 12);
  const inner = positions.slice(0, 8);
  const outer = positions.slice(8);
  for (const position of outer) {
    const distance = Math.hypot(position.x - station.position.x, position.z - station.position.z);
    assert.ok(distance > 2.0, 'outer-ring avatar is farther from the station');
    for (const other of inner) {
      const gap = Math.hypot(position.x - other.x, position.z - other.z);
      assert.ok(gap > 0.35, 'outer ring does not overlap the inner ring');
    }
  }
});

test('layout rotates with the workstation rotation', () => {
  const rotated = { ...station, rotation: { y: Math.PI / 2 } };
  const [a] = workerLayout(station, 1);
  const [b] = workerLayout(rotated, 1);
  assert.ok(Math.abs(a.x - b.x) > 0.5 || Math.abs(a.z - b.z) > 0.5);
});
