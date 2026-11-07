// Browser persistence for factory versions, the approved baseline and audit trail.

import { normaliseFactory } from '../state/factoryModel.js';

const PREFIX = 'its:v2:';
const VERSIONS_KEY = `${PREFIX}versions`;
const BASELINE_KEY = `${PREFIX}baseline`;
const AUDIT_KEY = `${PREFIX}audit`;
const DRAFT_KEY = `${PREFIX}draft`;

function hasStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function read(key, fallback) {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadVersions() {
  const list = read(VERSIONS_KEY, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && item.factory)
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

export function saveVersion(factory, name) {
  const versions = loadVersions();
  const version = {
    id: `V${Date.now().toString(36)}`,
    name: String(name || factory.name || 'Factory version'),
    savedAt: new Date().toISOString(),
    factory: normaliseFactory({ ...factory, name: name || factory.name }),
  };
  const next = [version, ...versions].slice(0, 50);
  if (!write(VERSIONS_KEY, next)) throw new Error('Browser storage is unavailable.');
  return version;
}

export function deleteVersion(id) {
  const next = loadVersions().filter((v) => v.id !== id);
  write(VERSIONS_KEY, next);
  return next;
}

export function loadBaseline() {
  const record = read(BASELINE_KEY, null);
  if (!record || !record.factory) return null;
  try {
    return {
      ...record,
      factory: normaliseFactory(record.factory),
    };
  } catch {
    return null;
  }
}

export function saveBaseline(factory, meta = {}) {
  const record = {
    factory: normaliseFactory(factory),
    approvedAt: meta.approvedAt || new Date().toISOString(),
    approvedBy: meta.approvedBy || 'Approver',
    approvedRole: meta.approvedRole || 'Plant Manager',
    reason: meta.reason || '',
    category: meta.category || 'Machine',
    versionName: meta.versionName || factory.name,
  };
  if (!write(BASELINE_KEY, record)) throw new Error('Browser storage is unavailable.');
  return record;
}

export function loadAudit() {
  const list = read(AUDIT_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function appendAudit(entry) {
  const list = loadAudit();
  const next = [
    {
      id: `A${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      ...entry,
    },
    ...list,
  ].slice(0, 100);
  write(AUDIT_KEY, next);
  return next;
}

export function saveDraft(factory) {
  return write(DRAFT_KEY, normaliseFactory(factory));
}

export function loadDraft() {
  const draft = read(DRAFT_KEY, null);
  if (!draft) return null;
  try {
    return normaliseFactory(draft);
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (hasStorage()) window.localStorage.removeItem(DRAFT_KEY);
}

export const STORAGE_KEYS = { VERSIONS_KEY, BASELINE_KEY, AUDIT_KEY, DRAFT_KEY };
