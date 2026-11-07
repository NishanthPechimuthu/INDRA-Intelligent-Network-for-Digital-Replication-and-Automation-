// Directed material-flow graph helpers and connection validation.
// No Three.js or React imports here.

import { MATERIAL_SINKS, MATERIAL_SOURCES } from '../data/componentDefs.js';

export function componentMap(factory) {
  return new Map(factory.components.map((c) => [c.id, c]));
}

export function materialConnections(factory) {
  return factory.connections.filter((c) => (c.kind || 'material') === 'material');
}

export function workerConnections(factory) {
  return factory.connections.filter((c) => c.kind === 'worker');
}

export function buildAdjacency(factory, kind = 'material') {
  const outgoing = new Map();
  const incoming = new Map();
  for (const c of factory.components) {
    outgoing.set(c.id, []);
    incoming.set(c.id, []);
  }
  for (const edge of factory.connections) {
    if ((edge.kind || 'material') !== kind) continue;
    if (!outgoing.has(edge.from) || !outgoing.has(edge.to)) continue;
    outgoing.get(edge.from).push(edge.to);
    incoming.get(edge.to).push(edge.from);
  }
  return { outgoing, incoming };
}

function reachable(outgoing, start, target) {
  if (start === target) return true;
  const stack = [start];
  const seen = new Set([start]);
  while (stack.length) {
    const node = stack.pop();
    for (const next of outgoing.get(node) || []) {
      if (next === target) return true;
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return false;
}

export function wouldCreateCycle(factory, fromId, toId) {
  const { outgoing } = buildAdjacency(factory, 'material');
  // Adding from -> to closes a cycle when `from` is already reachable from `to`.
  return reachable(outgoing, toId, fromId);
}

export function validateConnection(factory, fromId, toId, kind = 'material') {
  const map = componentMap(factory);
  const from = map.get(fromId);
  const to = map.get(toId);
  if (!from || !to) return { ok: false, error: 'Both components must exist.' };
  if (fromId === toId) return { ok: false, error: 'A component cannot connect to itself.' };

  const duplicate = factory.connections.some(
    (c) => c.from === fromId && c.to === toId && (c.kind || 'material') === kind,
  );
  if (duplicate) return { ok: false, error: 'These components are already connected.' };

  if (kind === 'worker') {
    if (from.type !== 'worker' || to.type !== 'workstation') {
      return { ok: false, error: 'Worker hubs can only be assigned to workstations.' };
    }
    return { ok: true };
  }

  if (!MATERIAL_SOURCES.has(from.type)) {
    return { ok: false, error: `${from.name} has no material output.` };
  }
  if (!MATERIAL_SINKS.has(to.type)) {
    return { ok: false, error: `${to.name} has no material input.` };
  }
  if (wouldCreateCycle(factory, fromId, toId)) {
    return { ok: false, error: 'That connection would create a circular material flow.' };
  }
  return { ok: true };
}

export function connectedComponentIds(factory, kind = 'material') {
  const { outgoing, incoming } = buildAdjacency(factory, kind);
  const result = new Set();
  for (const [id, outs] of outgoing) {
    if (outs.length || (incoming.get(id) || []).length) result.add(id);
  }
  return result;
}

export function connectionsFor(factory, id) {
  return factory.connections.filter((c) => c.from === id || c.to === id);
}

export function workerHubsFor(factory, workstationId, map = componentMap(factory)) {
  return workerConnections(factory)
    .filter((c) => c.to === workstationId)
    .map((c) => map.get(c.from))
    .filter(Boolean);
}

export function workstationsForHub(factory, hubId, map = componentMap(factory)) {
  return workerConnections(factory)
    .filter((c) => c.from === hubId)
    .map((c) => map.get(c.to))
    .filter(Boolean);
}

/** Validate that every component ID is unique and references are resolvable. */
export function validateFactoryGraph(factory) {
  const errors = [];
  const ids = new Set();
  for (const c of factory.components) {
    if (!c.id) errors.push('A component is missing its ID.');
    else if (ids.has(c.id)) errors.push(`Duplicate component ID: ${c.id}`);
    ids.add(c.id);
  }
  for (const edge of factory.connections) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      errors.push(`Connection ${edge.id || '?'} references a missing component.`);
    }
  }
  return errors;
}

/** Return upstream product sources for each node (used for diagnostics). */
export function sourceReachability(factory) {
  const { outgoing, incoming } = buildAdjacency(factory, 'material');
  const map = componentMap(factory);
  const sources = factory.components.filter((c) => c.type === 'source').map((c) => c.id);
  const reached = new Set(sources);
  const queue = [...sources];
  while (queue.length) {
    const id = queue.shift();
    for (const next of outgoing.get(id) || []) {
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  const unreachable = factory.components
    .filter((c) => ['workstation', 'conveyor', 'buffer', 'output'].includes(c.type) && !reached.has(c.id))
    .map((c) => c.name);
  return { reached, unreachable, incoming, outgoing, map };
}
