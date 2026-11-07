// Serialization, import validation and structural comparison of factory versions.

import { normaliseFactory, cloneFactory } from '../state/factoryModel.js';
import { validateFactoryGraph } from '../engine/graph.js';
import { DEFAULT_PROPS, TYPE_MAP } from '../data/componentDefs.js';

export const SCHEMA_VERSION = 2;

export function serializeFactory(factory) {
  const normalised = normaliseFactory(factory);
  const doc = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...normalised,
  };
  return JSON.stringify(doc, null, 2);
}

export function deserializeFactory(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
  return importFactoryObject(parsed);
}

export function importFactoryObject(parsed) {
  // Check declared references before normalisation drops unknown links.
  const rawSource = parsed?.factory && parsed.factory.components ? parsed.factory : parsed || {};
  const rawComponents = Array.isArray(rawSource.components)
    ? rawSource.components
    : Array.isArray(rawSource.nodes)
      ? rawSource.nodes
      : [];
  const rawIds = new Set(rawComponents.map((c) => String(c.id)));
  if (Array.isArray(rawSource.connections)) {
    const dangling = rawSource.connections.filter(
      (c) => c && (!rawIds.has(String(c.from)) || !rawIds.has(String(c.to))),
    );
    if (dangling.length) {
      throw new Error(
        `Connection ${dangling[0].id || '?'} references a missing component.`,
      );
    }
  }

  const factory = normaliseFactory(parsed);
  const warnings = [];
  const errors = validateFactoryGraph(factory);
  if (errors.length) throw new Error(errors.join(' '));

  for (const component of factory.components) {
    if (!TYPE_MAP[component.type]) {
      throw new Error(`Unknown component type "${component.type}" in ${component.name}.`);
    }
    for (const key of Object.keys(DEFAULT_PROPS[component.type] || {})) {
      if (component.props[key] === undefined) {
        component.props[key] = DEFAULT_PROPS[component.type][key];
      }
    }
  }
  if (!factory.components.length) warnings.push('The imported factory has no components.');
  return { factory, warnings };
}

export function downloadJson(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function safeFilename(name) {
  return `${String(name || 'factory').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'factory'}.json`;
}

export async function readFileText(file) {
  if (!file) throw new Error('No file selected.');
  return file.text();
}

function sameValue(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.0001;
  return a === b;
}

/** Structural + property diff between the approved baseline and a proposal. */
export function diffFactories(baseline, proposed) {
  const baseMap = new Map(baseline.components.map((c) => [c.id, c]));
  const propMap = new Map(proposed.components.map((c) => [c.id, c]));
  const added = proposed.components.filter((c) => !baseMap.has(c.id));
  const removed = baseline.components.filter((c) => !propMap.has(c.id));
  const modified = [];
  const propertyChanges = [];

  for (const [id, before] of baseMap) {
    const after = propMap.get(id);
    if (!after) continue;
    const structural = [];
    if (before.type !== after.type) structural.push({ field: 'type', from: before.type, to: after.type });
    if (before.name !== after.name) structural.push({ field: 'name', from: before.name, to: after.name });
    if (before.lineId !== after.lineId) structural.push({ field: 'line', from: before.lineId, to: after.lineId });
    for (const axis of ['x', 'y', 'z']) {
      if (!sameValue(before.position[axis], after.position[axis])) {
        structural.push({ field: `position.${axis}`, from: before.position[axis], to: after.position[axis] });
      }
      if (!sameValue(before.rotation[axis], after.rotation[axis])) {
        structural.push({ field: `rotation.${axis}`, from: before.rotation[axis], to: after.rotation[axis] });
      }
      if (!sameValue(before.scale[axis], after.scale[axis])) {
        structural.push({ field: `scale.${axis}`, from: before.scale[axis], to: after.scale[axis] });
      }
    }
    if (structural.length) modified.push({ id, name: after.name, changes: structural });

    const keys = new Set([...Object.keys(before.props || {}), ...Object.keys(after.props || {})]);
    for (const key of keys) {
      if (!sameValue(before.props?.[key], after.props?.[key])) {
        propertyChanges.push({
          id,
          name: after.name,
          type: after.type,
          key,
          from: before.props?.[key],
          to: after.props?.[key],
        });
      }
    }
  }

  const edgeKey = (c) => `${c.kind || 'material'}:${c.from}->${c.to}`;
  const baseEdges = new Set(baseline.connections.map(edgeKey));
  const propEdges = new Set(proposed.connections.map(edgeKey));
  const connectionsAdded = proposed.connections.filter((c) => !baseEdges.has(edgeKey(c)));
  const connectionsRemoved = baseline.connections.filter((c) => !propEdges.has(edgeKey(c)));

  return {
    added,
    removed,
    modified,
    propertyChanges,
    connectionsAdded,
    connectionsRemoved,
    hasChanges:
      added.length + removed.length + modified.length + propertyChanges.length +
        connectionsAdded.length + connectionsRemoved.length > 0,
  };
}

export function layoutStats(factory) {
  return {
    components: factory.components.length,
    connections: factory.connections.length,
    workstations: factory.components.filter((c) => c.type === 'workstation').length,
    workers: factory.components
      .filter((c) => c.type === 'worker')
      .reduce((sum, c) => sum + (c.props.employees || 0), 0),
    lines: factory.lines.length,
  };
}

export function copyFactory(factory) {
  return cloneFactory(factory);
}
