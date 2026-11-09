import React from 'react';
import {
  ArrowDownToLine,
  BarChart3,
  Cable,
  GripVertical,
  Layers,
  Link2,
  Magnet,
  Monitor,
  Package,
  Plus,
  ScanLine,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react';
import { LIBRARY_ITEMS, typeColor } from '../data/componentDefs.js';

const ICONS = {
  source: Package,
  workstation: Wrench,
  inspection: ScanLine,
  worker: Users,
  conveyor: Cable,
  buffer: Layers,
  output: ArrowDownToLine,
  chart: BarChart3,
  display: Monitor,
};

const LINE_COLORS = ['#9db83a', '#8fa3b8', '#d9b45b', '#93a89d', '#b3a88f', '#a69fb6'];

export default function ComponentLibrary({
  factory,
  selection,
  activePlacement,
  activeLineId,
  selectedConnection,
  onActivatePlacement,
  onDragStart,
  onDragEnd,
  onSelect,
  onToggleSelect,
  onSetActiveLine,
  onAddLine,
  onUpdateLine,
  onDeleteLine,
  onUpdateGrid,
  onSelectConnection,
  onDeleteConnection,
}) {
  const nameById = new Map(factory.components.map((c) => [c.id, c.name]));
  const lineById = new Map(factory.lines.map((line) => [line.id, line]));
  const selected = new Set(selection);

  const handleDragStart = (event, definition) => {
    const dragType = definition.dragType || definition.type;
    event.dataTransfer.setData('application/x-indra-component', dragType);
    event.dataTransfer.setData('application/x-its-component', dragType);
    event.dataTransfer.effectAllowed = 'copy';
    onDragStart?.(dragType);
  };

  return (
    <aside className="left">
      <h4>COMPONENTS</h4>
      <p className="library-hint">Drag onto the grid, or click to place repeatedly.</p>
      {LIBRARY_ITEMS.map((definition) => {
        const Icon = ICONS[definition.type] || Package;
        return (
          <button
            className={`tool ${activePlacement === definition.dragType ? 'placing' : ''}`}
            onClick={() => onActivatePlacement(definition.dragType)}
            key={definition.dragType}
            draggable
            onDragStart={(event) => handleDragStart(event, definition)}
            onDragEnd={() => onDragEnd?.()}
            title={`Drag ${definition.label} onto the grid`}
            data-testid={`tool-${definition.dragType}`}
          >
            <span className="tool-grip"><GripVertical size={11} /></span>
            <Icon size={16} />
            {definition.label}
            <Plus size={13} />
          </button>
        );
      })}

      <hr />
      <h4>PRODUCTION LINES</h4>
      <div className="line-list">
        {factory.lines.map((line) => (
          <div
            key={line.id}
            className={`line-row ${activeLineId === line.id ? 'active' : ''}`}
            onClick={() => onSetActiveLine(line.id)}
          >
            <i style={{ background: line.color }} />
            <input
              className="line-name"
              value={line.name}
              onFocus={() => onSetActiveLine(line.id)}
              onChange={(event) => onUpdateLine(line.id, { name: event.target.value })}
              aria-label="Production line name"
            />
            <button
              className="icon-button"
              title="Delete production line"
              disabled={factory.lines.length <= 1}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteLine(line.id);
              }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        <button className="add-line" onClick={onAddLine}>
          <Plus size={12} /> Add production line
        </button>
      </div>

      <hr />
      <h4>FACTORY SETTINGS</h4>
      <div className="grid-settings">
        <label>
          Grid size
          <input
            type="number"
            min="10"
            max="400"
            step="1"
            value={factory.grid.size}
            onChange={(event) => onUpdateGrid({ size: Math.max(10, Math.min(400, Number(event.target.value) || 10)) })}
          />
        </label>
        <label>
          Spacing
          <input
            type="number"
            min="0.25"
            max="20"
            step="0.25"
            value={factory.grid.spacing}
            onChange={(event) =>
              onUpdateGrid({ spacing: Math.max(0.25, Math.min(20, Number(event.target.value) || 1)) })
            }
          />
        </label>
        <button
          className={`snap-toggle ${factory.grid.snap ? 'on' : ''}`}
          onClick={() => onUpdateGrid({ snap: !factory.grid.snap })}
          title="Toggle grid snapping"
          data-testid="snap-toggle"
        >
          <Magnet size={12} /> Snap {factory.grid.snap ? 'on' : 'off'}
        </button>
      </div>

      <hr />
      <h4>SCENE OBJECTS <span className="count-badge">{factory.components.length}</span></h4>
      <div className="object-list">
        {factory.components.map((component) => (
          <button
            className={`object ${selected.has(component.id) ? 'sel' : ''}`}
            onClick={(event) => {
              if (event.shiftKey) onToggleSelect(component.id);
              else onSelect([component.id]);
            }}
            key={component.id}
            data-testid={`object-${component.id}`}
          >
            <i className="type-dot" style={{ background: typeColor(component.type) }} />
            <span className="object-name">{component.name}</span>
            <em style={{ color: lineById.get(component.lineId)?.color || '#718698' }}>
              {lineById.get(component.lineId)?.name || '—'}
            </em>
          </button>
        ))}
        {!factory.components.length && <p className="empty-note">No objects yet. Drag a component onto the grid.</p>}
      </div>

      <hr />
      <h4>CONNECTIONS <span className="count-badge">{factory.connections.length}</span></h4>
      <div className="connection-list">
        {factory.connections.map((connection) => (
          <div
            key={connection.id}
            data-testid={`connection-${connection.id}`}
            className={`connection-row ${connection.kind === 'worker' ? 'worker' : ''} ${
              selectedConnection === connection.id ? 'active' : ''
            }`}
            onClick={() => onSelectConnection(connection.id)}
            title="Select connection (Delete disconnects)"
          >
            <Link2 size={11} />
            <span>
              {nameById.get(connection.from) || '?'} → {nameById.get(connection.to) || '?'}
            </span>
            <button
              className="icon-button"
              title="Disconnect"
              data-testid={`disconnect-${connection.id}`}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteConnection(connection.id);
              }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {!factory.connections.length && <p className="empty-note">Use Connect mode or drag from a port.</p>}
      </div>
    </aside>
  );
}
