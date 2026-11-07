import React, { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  History,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

export default function FactoryFileDialog({
  open,
  factory,
  versions,
  onClose,
  onNew,
  onReset,
  onDuplicate,
  onSave,
  onLoad,
  onDeleteVersion,
  onExport,
  onImport,
  onStatus,
}) {
  const [name, setName] = useState('');
  const fileInput = useRef(null);

  useEffect(() => {
    if (open) setName(factory.name);
  }, [open, factory.name]);

  if (!open) return null;

  const handleSave = () => {
    const trimmed = name.trim() || factory.name;
    if (!trimmed) {
      onStatus?.('Enter a version name before saving.');
      return;
    }
    onSave(trimmed);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    onImport(file);
  };

  return (
    <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Factory file management">
        <header className="modal-head">
          <div>
            <b>FACTORY FILE</b>
            <small>Save, load and exchange factory configurations</small>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </header>

        <div className="modal-actions">
          <button className="secondary" onClick={onNew}>
            <FilePlus2 size={14} /> New factory
          </button>
          <button className="secondary" onClick={onDuplicate}>
            <Copy size={14} /> Duplicate factory
          </button>
          <button className="secondary" onClick={onReset}>
            <RotateCcw size={14} /> Reset to demo
          </button>
          <button className="secondary" onClick={onExport}>
            <Download size={14} /> Export JSON
          </button>
          <button className="secondary" onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> Import JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImport}
            data-testid="import-input"
          />
        </div>

        <div className="save-row">
          <label>
            Save current working factory as
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Version name"
              data-testid="save-name"
            />
          </label>
          <button className="run" onClick={handleSave} data-testid="save-version">
            <Save size={14} /> Save version
          </button>
        </div>

        <h4><History size={12} /> Saved versions</h4>
        <div className="version-list">
          {versions.map((version) => (
            <div className="version-row" key={version.id}>
              <div>
                <b>{version.name}</b>
                <small>
                  {new Date(version.savedAt).toLocaleString()} · {version.factory.components.length} objects ·{' '}
                  {version.factory.connections.length} connections
                </small>
              </div>
              <button className="secondary small" onClick={() => onLoad(version)} data-testid={`load-version-${version.id}`}>
                <FolderOpen size={12} /> Load
              </button>
              <button className="icon-button" title="Delete version" onClick={() => onDeleteVersion(version.id)} data-testid={`delete-version-${version.id}`}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {!versions.length && <p className="empty-note">No saved versions yet. Save the current factory to create one.</p>}
        </div>

        <p className="tip">
          Versions, the approved baseline and the audit trail are stored in this browser. Export JSON to
          move a factory to another machine or keep a permanent copy.
        </p>
      </div>
    </div>
  );
}
