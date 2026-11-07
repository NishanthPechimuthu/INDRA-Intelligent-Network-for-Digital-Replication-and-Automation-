// Central factory reducer with undo/redo and transaction coalescing.

import { createSeedFactory, normaliseFactory, cloneFactory, makeId } from './factoryModel.js';

const HISTORY_LIMIT = 80;
const COALESCE_WINDOW = 900;

export function createInitialState(factory) {
  const seeded = normaliseFactory(factory || createSeedFactory());
  return {
    factory: seeded,
    selection: seeded.components.find((c) => c.type === 'workstation')?.id
      ? [seeded.components.find((c) => c.type === 'workstation').id]
      : [],
    past: [],
    future: [],
    lastTag: null,
    lastTagAt: 0,
  };
}

function touch(factory) {
  return { ...factory, updatedAt: new Date().toISOString() };
}

function commit(state, factory, meta = {}) {
  if (!factory || factory === state.factory) return state;
  const now = Date.now();
  const tag = meta.tag || null;
  const coalesce = Boolean(tag) && state.lastTag === tag && now - state.lastTagAt < COALESCE_WINDOW;
  const past = coalesce ? state.past : [...state.past.slice(-(HISTORY_LIMIT - 1)), state.factory];
  return {
    ...state,
    factory: touch(factory),
    past,
    future: [],
    lastTag: tag,
    lastTagAt: now,
  };
}

function validSelection(factory, selection) {
  const ids = new Set(factory.components.map((c) => c.id));
  return selection.filter((id) => ids.has(id));
}

function patchComponent(factory, id, patch) {
  return {
    ...factory,
    components: factory.components.map((component) => {
      if (component.id !== id) return component;
      return {
        ...component,
        ...patch,
        position: patch.position ? { ...component.position, ...patch.position } : component.position,
        rotation: patch.rotation ? { ...component.rotation, ...patch.rotation } : component.rotation,
        scale: patch.scale ? { ...component.scale, ...patch.scale } : component.scale,
        props: patch.props ? { ...component.props, ...patch.props } : component.props,
      };
    }),
  };
}

function deleteComponents(factory, ids) {
  const remove = new Set(ids);
  return {
    ...factory,
    components: factory.components.filter((c) => !remove.has(c.id)),
    connections: factory.connections.filter((c) => !remove.has(c.from) && !remove.has(c.to)),
  };
}

function duplicateSelection(state, ids) {
  const factory = state.factory;
  const selected = factory.components.filter((c) => ids.includes(c.id));
  if (!selected.length) return state;
  const spacing = factory.grid.spacing;
  const offset = { x: spacing * 2, z: spacing * 2 };
  const idMap = new Map();
  let next = factory;
  const copies = selected.map((component) => {
    const copy = {
      ...cloneFactory(component),
      id: makeId('N'),
      name: `${component.name} copy`,
      position: {
        ...component.position,
        x: Math.round((component.position.x + offset.x) * 1000) / 1000,
        z: Math.round((component.position.z + offset.z) * 1000) / 1000,
      },
    };
    idMap.set(component.id, copy.id);
    next = { ...next, components: [...next.components, copy] };
    return copy;
  });
  const copiedConnections = [];
  for (const edge of factory.connections) {
    if (idMap.has(edge.from) && idMap.has(edge.to)) {
      copiedConnections.push({
        ...edge,
        id: makeId('C'),
        from: idMap.get(edge.from),
        to: idMap.get(edge.to),
      });
    }
  }
  next = { ...next, connections: [...next.connections, ...copiedConnections] };
  const committed = commit(state, next, { tag: null });
  return { ...committed, selection: copies.map((c) => c.id) };
}

export function factoryReducer(state, action) {
  switch (action.type) {
    case 'load':
      return {
        ...state,
        factory: normaliseFactory(action.factory),
        selection: validSelection(normaliseFactory(action.factory), action.selection || []),
        past: action.keepHistory ? state.past : [],
        future: [],
        lastTag: null,
        lastTagAt: 0,
      };

    case 'setFactoryName':
      return commit(state, { ...state.factory, name: action.name }, { tag: 'factory:name' });

    case 'addComponent': {
      const next = {
        ...state.factory,
        components: [...state.factory.components, action.component],
      };
      const committed = commit(state, next, { tag: null });
      return { ...committed, selection: [action.component.id] };
    }

    case 'updateComponent':
      return commit(state, patchComponent(state.factory, action.id, action.patch), action.meta);

    case 'updateProps':
      return commit(
        state,
        patchComponent(state.factory, action.id, { props: action.props }),
        action.meta,
      );

    case 'updateTransforms': {
      let next = state.factory;
      for (const update of action.updates) {
        next = patchComponent(next, update.id, {
          position: update.position,
          rotation: update.rotation,
          scale: update.scale,
        });
      }
      return commit(state, next, action.meta);
    }

    case 'deleteComponents': {
      const ids = action.ids?.length ? action.ids : state.selection;
      if (!ids.length) return state;
      const next = deleteComponents(state.factory, ids);
      const committed = commit(state, next, { tag: null });
      return { ...committed, selection: validSelection(next, state.selection) };
    }

    case 'duplicateComponents': {
      const ids = action.ids?.length ? action.ids : state.selection;
      return duplicateSelection(state, ids);
    }

    case 'addConnection': {
      if (state.factory.connections.some((c) => c.id === action.connection.id)) return state;
      const next = {
        ...state.factory,
        connections: [...state.factory.connections, action.connection],
      };
      return commit(state, next, { tag: null });
    }

    case 'deleteConnection': {
      const next = {
        ...state.factory,
        connections: state.factory.connections.filter((c) => c.id !== action.id),
      };
      return commit(state, next, { tag: null });
    }

    case 'setGrid':
      return commit(
        state,
        { ...state.factory, grid: { ...state.factory.grid, ...action.patch } },
        { tag: action.meta?.tag || null },
      );

    case 'setSettings':
      return commit(
        state,
        { ...state.factory, settings: { ...state.factory.settings, ...action.patch } },
        { tag: action.meta?.tag || null },
      );

    case 'addLine': {
      const line = action.line;
      const next = { ...state.factory, lines: [...state.factory.lines, line] };
      return commit(state, next, { tag: null });
    }

    case 'updateLine': {
      const lines = state.factory.lines.map((line) =>
        line.id === action.id ? { ...line, ...action.patch } : line,
      );
      return commit(state, { ...state.factory, lines }, { tag: action.meta?.tag || null });
    }

    case 'deleteLine': {
      if (state.factory.lines.length <= 1) return state;
      const lines = state.factory.lines.filter((line) => line.id !== action.id);
      const fallback = lines[0]?.id || null;
      const components = state.factory.components.map((c) =>
        c.lineId === action.id ? { ...c, lineId: fallback } : c,
      );
      return commit(state, { ...state.factory, lines, components }, { tag: null });
    }

    case 'setSelection':
      return { ...state, selection: validSelection(state.factory, action.ids || []) };

    case 'toggleSelection': {
      const has = state.selection.includes(action.id);
      return {
        ...state,
        selection: has
          ? state.selection.filter((id) => id !== action.id)
          : [...state.selection, action.id],
      };
    }

    case 'undo': {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        factory: previous,
        past: state.past.slice(0, -1),
        future: [state.factory, ...state.future].slice(0, HISTORY_LIMIT),
        selection: validSelection(previous, state.selection),
        lastTag: null,
        lastTagAt: 0,
      };
    }

    case 'redo': {
      if (!state.future.length) return state;
      const next = state.future[0];
      return {
        ...state,
        factory: next,
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.factory],
        future: state.future.slice(1),
        selection: validSelection(next, state.selection),
        lastTag: null,
        lastTagAt: 0,
      };
    }

    default:
      return state;
  }
}

export function canUndo(state) {
  return state.past.length > 0;
}

export function canRedo(state) {
  return state.future.length > 0;
}
