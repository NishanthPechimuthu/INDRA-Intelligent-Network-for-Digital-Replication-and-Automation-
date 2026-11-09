import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FLAT_PROPERTY_SCHEMAS,
  PROPERTY_SECTIONS,
  flatSchemaForType,
  sectionsForComponent,
} from '../../src/data/industrialSchema.js';
import {
  DEFAULT_PROPS,
  PROPERTY_SCHEMAS,
  schemaForComponent,
} from '../../src/data/componentDefs.js';

const REQUIRED_GROUPS = {
  source: ['Operational Parameters', 'Production Parameters', 'Live Metrics'],
  workstation: [
    'Operational Parameters',
    'Production Parameters',
    'Resource Parameters',
    'Energy Parameters',
    'Reliability and Maintenance',
    'Live Metrics',
  ],
  inspection: [
    'Operational Parameters',
    'Production Parameters',
    'Resource Parameters',
    'Energy Parameters',
    'Reliability and Maintenance',
    'Live Metrics',
  ],
  conveyor: [
    'Operational Parameters',
    'Production Parameters',
    'Energy Parameters',
    'Reliability and Maintenance',
    'Live Metrics',
  ],
  buffer: ['Operational Parameters', 'Production Parameters', 'Live Metrics'],
  output: ['Operational Parameters', 'Production Parameters', 'Live Metrics'],
  worker: ['Operational Parameters', 'Resource Parameters', 'Live Metrics'],
  display: ['Operational Parameters', 'Energy Parameters', 'Live Metrics'],
};

test('every industrial component exposes the required grouped sections', () => {
  for (const [type, titles] of Object.entries(REQUIRED_GROUPS)) {
    const sections = PROPERTY_SECTIONS[type] || [];
    assert.deepEqual(
      sections.map((section) => section.title),
      titles,
      `${type} section order and titles`,
    );
  }
});

test('every numeric configuration field displays an SI or practical unit', () => {
  for (const [type, sections] of Object.entries(PROPERTY_SECTIONS)) {
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.calculated) continue;
        if (field.type !== 'number') continue;
        assert.ok(
          typeof field.unit === 'string' && field.unit.length > 0,
          `${type}.${field.key} must show a unit`,
        );
        assert.ok(
          !field.label?.match(/SI\b/),
          `${type}.${field.key} must not label a unitless value as SI`,
        );
      }
    }
  }
});

test('calculated live fields are read-only and declare their source', () => {
  for (const [type, sections] of Object.entries(PROPERTY_SECTIONS)) {
    const live = sections.find((section) => section.title === 'Live Metrics');
    if (!live) continue;
    for (const field of live.fields) {
      assert.equal(field.calculated, true, `${type}.${field.id} is calculated`);
      if (field.format) continue;
      assert.ok(
        typeof field.unit === 'string',
        `${type}.${field.id} exposes a unit label, even when empty`,
      );
      assert.ok(
        typeof field.liveKey === 'string' ||
          typeof field.value === 'function',
        `${type}.${field.id} resolves a real engine value or an explicit future marker`,
      );
    }
  }
});

test('future enhancements are marked instead of fabricating values', () => {
  const futureFields = [];
  for (const [type, sections] of Object.entries(PROPERTY_SECTIONS)) {
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.future) futureFields.push({ type, ...field });
      }
    }
  }
  assert.ok(futureFields.length >= 4, 'unsupported telemetry is visibly marked');
  for (const field of futureFields) {
    assert.equal(field.calculated, true, `${field.id} is read-only`);
    assert.equal(field.value?.({}), null, `${field.id} does not fabricate a value`);
    assert.match(field.tooltip || '', /future enhancement/i, `${field.id} explains the gap`);
  }
});

test('schema defaults cover every editable property key', () => {
  for (const [type, fields] of Object.entries(FLAT_PROPERTY_SCHEMAS)) {
    const defaults = DEFAULT_PROPS[type] || {};
    for (const field of fields) {
      if (field.calculated || !field.key) continue;
      assert.ok(
        Object.hasOwn(defaults, field.key),
        `${type}.${field.key} has a default value for reset controls`,
      );
    }
  }
});

test('flattened schemas are de-duplicated and inspection is component-aware', () => {
  for (const [type, fields] of Object.entries(FLAT_PROPERTY_SCHEMAS)) {
    const keys = fields.map((field) => field.key || field.id);
    assert.equal(new Set(keys).size, keys.length, `${type} has no duplicate fields`);
  }

  const production = { type: 'workstation', props: { stationType: 'production' } };
  const inspection = { type: 'workstation', props: { stationType: 'inspection' } };
  assert.equal(sectionsForComponent(production), PROPERTY_SECTIONS.workstation);
  assert.equal(sectionsForComponent(inspection), PROPERTY_SECTIONS.inspection);
  assert.match(
    schemaForComponent(inspection).find((field) => field.key === 'cycleTime').label,
    /inspection/i,
  );
  assert.equal(PROPERTY_SCHEMAS.workstation, FLAT_PROPERTY_SCHEMAS.workstation);
  assert.equal(flatSchemaForType('display').length, FLAT_PROPERTY_SCHEMAS.display.length);
});
