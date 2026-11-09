import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  GLB_MODELS,
  REQUIRED_GLB_FILES,
  WORKER_CLIPS,
  modelForComponent,
} from '../../src/data/assetManifest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const glbDir = path.join(root, 'assets', 'glb');
const licences = readFileSync(path.join(root, 'ASSET_LICENSES.md'), 'utf8');

test('every required component has a local GLB model', () => {
  const types = ['source', 'workstation', 'conveyor', 'buffer', 'output', 'display', 'worker'];
  for (const type of types) {
    const model = modelForComponent({ type, props: {} });
    assert.ok(model, `${type} maps to a model`);
  }
  const inspection = modelForComponent({ type: 'workstation', props: { stationType: 'inspection' } });
  assert.equal(inspection.key, 'inspection');
  assert.ok(WORKER_CLIPS.idle.includes('Idle'));
});

test('all bundled GLB files exist locally and are non-trivial', () => {
  for (const file of REQUIRED_GLB_FILES) {
    const full = path.join(glbDir, file);
    assert.ok(existsSync(full), `${file} is bundled`);
    assert.ok(statSync(full).size > 1024, `${file} is a real model file`);
  }
  assert.ok(existsSync(path.join(glbDir, 'Textures', 'colormap.png')), 'shared texture is bundled');
});

test('models are free licences and documented with provenance', () => {
  for (const [key, model] of Object.entries(GLB_MODELS)) {
    assert.equal(model.license, 'CC0-1.0', `${key} uses a commercially compatible licence`);
    assert.ok(model.author, `${key} records an author`);
    assert.ok(licences.includes(model.file), `${model.file} is documented in ASSET_LICENSES.md`);
  }
});

test('runtime model metadata contains no remote URLs', () => {
  const source = readFileSync(path.join(root, 'src', 'data', 'assetManifest.js'), 'utf8');
  assert.ok(!/https?:\/\//.test(source), 'asset manifest has no runtime external URLs');
  for (const model of Object.values(GLB_MODELS)) {
    assert.ok(!/^https?:/i.test(model.file));
    assert.ok(!model.file.includes('://'));
  }
});
