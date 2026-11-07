import React from 'react';
import { Copy, Link2, SlidersHorizontal, Trash2, Unlink } from 'lucide-react';
import { PROPERTY_SCHEMAS, typeColor, typeLabel } from '../data/componentDefs.js';
import { workerHubsFor, workstationsForHub } from '../engine/graph.js';
import { layoutStats } from '../persistence/FactorySerializer.js';

function NumericInput({ value, onChange, step = 0.1, min, max, suffix, testId }) {
  return (
    <div className="numeric-field">
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        data-testid={testId}
        onChange={(event) => {
          const next = event.target.value === '' ? 0 : Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
      {suffix && <em>{suffix}</em>}
    </div>
  );
}

export default function PropertiesPanel({
  factory,
  selection,
  result,
  onUpdateComponent,
  onUpdateProps,
  onDelete,
  onDuplicate,
  onDeleteConnection,
  onSelect,
  onStatus,
  onActivateConnect,
}) {
  const map = new Map(factory.components.map((c) => [c.id, c]));
  const selectedComponents = selection.map((id) => map.get(id)).filter(Boolean);

  if (!selectedComponents.length) {
    const stats = layoutStats(factory);
    return (
      <section>
        <h3>Component properties</h3>
        <p>Select a scene object to edit it, or shift-click to select multiple objects.</p>
        <div className="overview-grid">
          <div><small>COMPONENTS</small><b>{stats.components}</b></div>
          <div><small>CONNECTIONS</small><b>{stats.connections}</b></div>
          <div><small>WORKSTATIONS</small><b>{stats.workstations}</b></div>
          <div><small>WORKERS</small><b>{stats.workers}</b></div>
        </div>
        <p className="tip">Drag components from the left onto the grid. Select a component and press W, E or R to switch between move, rotate and scale.</p>
        <p className="tip">Run the simulation to calculate performance from the connection graph rather than from component counts.</p>
      </section>
    );
  }

  if (selectedComponents.length > 1) {
    return (
      <section>
        <h3>{selectedComponents.length} objects selected</h3>
        <div className="multi-list">
          {selectedComponents.map((component) => (
            <button key={component.id} className="multi-row" onClick={() => onSelect([component.id])}>
              <i style={{ background: typeColor(component.type) }} />
              {component.name}
              <em>{typeLabel(component.type)}</em>
            </button>
          ))}
        </div>
        <div className="button-row">
          <button className="secondary" onClick={() => onDuplicate(selection)}>
            <Copy size={13} /> Duplicate
          </button>
          <button className="delete" onClick={() => onDelete(selection)}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
        <p className="tip">Moving or rotating the gizmo applies to the last selected object. Shift-click toggles selection.</p>
      </section>
    );
  }

  const component = selectedComponents[0];
  const schema = PROPERTY_SCHEMAS[component.type] || [];
  const line = factory.lines.find((l) => l.id === component.lineId);
  const rotationDeg = Math.round((component.rotation.y * 180) / Math.PI * 10) / 10;

  const incomingMaterial = factory.connections.filter(
    (c) => c.to === component.id && (c.kind || 'material') === 'material',
  );
  const outgoingMaterial = factory.connections.filter(
    (c) => c.from === component.id && (c.kind || 'material') === 'material',
  );
  const workerIn = factory.connections.filter((c) => c.to === component.id && c.kind === 'worker');
  const workerOut = factory.connections.filter((c) => c.from === component.id && c.kind === 'worker');

  const assignedHubs = workerHubsFor(factory, component.id, map);
  const assignedStations = workstationsForHub(factory, component.id, map);

  const connectionRow = (edge, direction) => {
    const other = map.get(direction === 'in' ? edge.from : edge.to);
    return (
      <div className="assignment-row" key={edge.id}>
        <Link2 size={11} />
        <span>{other?.name || 'Missing component'}</span>
        <em>{edge.kind === 'worker' ? 'worker' : direction === 'in' ? 'input' : 'output'}</em>
        <button className="icon-button" title="Disconnect" onClick={() => onDeleteConnection(edge.id)}>
          <Unlink size={11} />
        </button>
      </div>
    );
  };

  return (
    <section>
      <div className="property-head">
        <span className="type-badge" style={{ background: `${typeColor(component.type)}22`, color: typeColor(component.type) }}>
          {typeLabel(component.type)}
        </span>
        <small>ID {component.id}</small>
      </div>
      <h3>{component.name}</h3>

      <label>Name</label>
      <input
        value={component.name}
        onChange={(event) =>
          onUpdateComponent(component.id, { name: event.target.value }, { tag: `name:${component.id}` })
        }
        data-testid="component-name"
      />

      <label>Production line</label>
      <select
        value={component.lineId || ''}
        onChange={(event) => onUpdateComponent(component.id, { lineId: event.target.value || null })}
      >
        {factory.lines.map((lineOption) => (
          <option key={lineOption.id} value={lineOption.id}>
            {lineOption.name}
          </option>
        ))}
      </select>
      {line && <div className="line-chip"><i style={{ background: line.color }} /> {line.name}</div>}

      <h4>Transform</h4>
      <div className="transform-grid">
        {['x', 'y', 'z'].map((axis) => (
          <label key={axis}>
            Position {axis.toUpperCase()}
            <NumericInput
              value={component.position[axis]}
              step={0.5}
              testId={`transform-position-${axis}`}
              onChange={(value) =>
                onUpdateComponent(
                  component.id,
                  { position: { [axis]: value } },
                  { tag: `position:${component.id}:${axis}` },
                )
              }
            />
          </label>
        ))}
        <label>
          Rotation Y
          <NumericInput
            value={rotationDeg}
            step={15}
            suffix="deg"
            testId="transform-rotation-y"
            onChange={(value) =>
              onUpdateComponent(
                component.id,
                { rotation: { y: (value * Math.PI) / 180 } },
                { tag: `rotation:${component.id}` },
              )
            }
          />
        </label>
        {['x', 'y', 'z'].map((axis) => (
          <label key={`scale-${axis}`}>
            Scale {axis.toUpperCase()}
            <NumericInput
              value={component.scale[axis]}
              step={0.1}
              min={0.01}
              testId={`transform-scale-${axis}`}
              onChange={(value) =>
                onUpdateComponent(
                  component.id,
                  { scale: { [axis]: Math.max(0.01, value) } },
                  { tag: `scale:${component.id}:${axis}` },
                )
              }
            />
          </label>
        ))}
      </div>

      <h4>Properties</h4>
      <div className="fields">
        {schema.map((field) => {
          const value = component.props[field.key];
          const meta = { tag: `props:${component.id}:${field.key}` };
          if (field.type === 'boolean') {
            return (
              <div key={field.key} className="field-wide">
                <label>{field.label}</label>
                <button
                  className={`toggle ${value ? 'on' : ''}`}
                  onClick={() => onUpdateProps(component.id, { [field.key]: !value }, meta)}
                >
                  {value ? 'Required / enabled' : 'Not required / disabled'}
                </button>
              </div>
            );
          }
          if (field.type === 'select') {
            return (
              <div key={field.key} className="field-wide">
                <label>{field.label}</label>
                <select
                  value={value}
                  onChange={(event) => onUpdateProps(component.id, { [field.key]: event.target.value }, meta)}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            );
          }
          if (field.type === 'text') {
            return (
              <div key={field.key} className="field-wide">
                <label>{field.label}</label>
                <input
                  value={value ?? ''}
                  onChange={(event) => onUpdateProps(component.id, { [field.key]: event.target.value }, meta)}
                />
              </div>
            );
          }
          const displayValue =
            field.readOnly && component.type === 'output'
              ? result?.good ?? component.props.productCount ?? 0
              : value;
          return (
            <div key={field.key}>
              <label>{field.label}</label>
              {field.readOnly ? (
                <div className="readonly-value">{displayValue} {field.unit || ''}</div>
              ) : (
                <NumericInput
                  value={displayValue ?? 0}
                  step={field.step || 1}
                  min={field.min}
                  max={field.max}
                  suffix={field.unit}
                  testId={`prop-${field.key}`}
                  onChange={(next) => onUpdateProps(component.id, { [field.key]: next }, meta)}
                />
              )}
            </div>
          );
        })}
      </div>

      {component.type === 'workstation' && (
        <>
          <h4>Worker assignment</h4>
          {assignedHubs.length ? (
            <div className="assignment-list">
              {assignedHubs.map((hub) => (
                <div className="assignment-row" key={hub.id}>
                  <Link2 size={11} />
                  <span>{hub.name}</span>
                  <em>{hub.props.employees} employees</em>
                </div>
              ))}
            </div>
          ) : (
            <p className="tip warn">No worker hub assigned. This human-required station will starve.</p>
          )}
          <button className="secondary wide" onClick={() => onActivateConnect?.()}>
            <Link2 size={12} /> Connect worker hub
          </button>
        </>
      )}

      {component.type === 'worker' && (
        <>
          <h4>Assigned workstations</h4>
          {assignedStations.length ? (
            <div className="assignment-list">
              {assignedStations.map((station) => (
                <div className="assignment-row" key={station.id}>
                  <Link2 size={11} />
                  <span>{station.name}</span>
                  <em>requires {station.props.workers}</em>
                </div>
              ))}
            </div>
          ) : (
            <p className="tip warn">This hub is not assigned to a workstation.</p>
          )}
        </>
      )}

      <h4>Connections</h4>
      <div className="assignment-list">
        {incomingMaterial.map((edge) => connectionRow(edge, 'in'))}
        {outgoingMaterial.map((edge) => connectionRow(edge, 'out'))}
        {workerIn.map((edge) => connectionRow(edge, 'in'))}
        {workerOut.map((edge) => connectionRow(edge, 'out'))}
        {!incomingMaterial.length && !outgoingMaterial.length && !workerIn.length && !workerOut.length && (
          <p className="empty-note">No connections. Use Connect mode or drag from a port.</p>
        )}
      </div>

      <div className="button-row">
        <button className="secondary" onClick={() => onDuplicate([component.id])}>
          <Copy size={13} /> Duplicate
        </button>
        <button className="delete" onClick={() => onDelete([component.id])}>
          <Trash2 size={13} /> Remove
        </button>
      </div>
      <p className="tip">Changes update the proposed factory immediately. Use Ctrl+Z to undo.</p>
    </section>
  );
}
