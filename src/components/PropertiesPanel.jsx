import React from 'react';
import {
  ChevronDown,
  Copy,
  Info,
  Link2,
  Lock,
  RotateCcw,
  Trash2,
  Unlink,
} from 'lucide-react';
import { DEFAULT_PROPS, typeColor, typeLabel } from '../data/componentDefs.js';
import { sectionsForComponent } from '../data/industrialSchema.js';
import { workerHubsFor, workstationsForHub } from '../engine/graph.js';
import { layoutStats } from '../persistence/FactorySerializer.js';

const STATE_LABELS = {
  processing: 'Running',
  running: 'Running',
  ready: 'Idle',
  idle: 'Idle',
  starved: 'Starved',
  blocked: 'Blocked',
  full: 'Blocked',
  down: 'Fault',
  fault: 'Fault',
  maintenance: 'Maintenance',
  'off-shift': 'Maintenance',
};

const FUTURE_NOTE = 'Future enhancement';

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function sameValue(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
  return a === b;
}

function formatValue(value, field) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number' && !Number.isFinite(value)) return '—';
  if (field?.format === 'state') return STATE_LABELS[String(value)] || String(value);
  if (field?.format === 'status') return String(value);
  if (field?.format === 'time') return formatClock(value);
  if (typeof value === 'number') {
    const digits = Number.isFinite(field?.precision) ? field.precision : 1;
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  }
  return String(value);
}

function HelpTip({ text }) {
  if (!text) return null;
  return (
    <span className="hint-tip" tabIndex={0} aria-label={text} data-tip={text} title={text}>
      <Info size={11} />
    </span>
  );
}

function Section({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className={`prop-section ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="prop-section-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown size={13} className="chevron" />
        <h4>{title}</h4>
        {Number.isFinite(count) && <span className="section-count">{count}</span>}
      </button>
      {open && <div className="prop-section-body">{children}</div>}
    </section>
  );
}

function UnitInput({ field, value, onChange, testId }) {
  return (
    <div className="unit-input">
      <input
        type="number"
        value={Number.isFinite(Number(value)) ? Number(value) : 0}
        step={field.step || 1}
        min={field.min}
        max={field.max}
        id={field.key ? `field-${field.key}` : undefined}
        data-testid={testId}
        aria-label={field.label}
        onChange={(event) => {
          const next = event.target.value === '' ? 0 : Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
      {field.unit && <span className="unit-pill">{field.unit}</span>}
    </div>
  );
}

function FieldHead({ field, modified, onReset }) {
  return (
    <div className="prop-field-head">
      <label htmlFor={`field-${field.key || field.id}`}>
        {field.label}
        {field.spec && <em className="spec-badge" title="Recorded specification: presentation metadata, not a simulation input.">spec</em>}
        {modified && <span className="modified-dot" title="Modified from default" />}
      </label>
      <span className="prop-field-tools">
        {modified && onReset && (
          <button
            type="button"
            className="reset-prop"
            onClick={onReset}
            title="Reset to default"
            aria-label={`Reset ${field.label} to default`}
          >
            <RotateCcw size={11} />
          </button>
        )}
        <HelpTip text={field.tooltip} />
      </span>
    </div>
  );
}

function ConfigField({ field, component, defaults, onUpdateProps }) {
  const value = component.props[field.key] ?? defaults[field.key];
  const defaultValue = defaults[field.key];
  const modified = defaultValue !== undefined && !sameValue(value, defaultValue);
  const meta = { tag: `props:${component.id}:${field.key}` };
  const reset = () => onUpdateProps(component.id, { [field.key]: defaultValue }, meta);
  const wide = field.type === 'text' || field.type === 'select' || field.type === 'boolean';

  return (
    <div className={`prop-field ${wide ? 'wide' : ''} ${modified ? 'modified' : ''}`}>
      <FieldHead field={field} modified={modified} onReset={reset} />
      {field.type === 'boolean' && (
        <button
          type="button"
          className={`toggle ${value ? 'on' : ''}`}
          onClick={() => onUpdateProps(component.id, { [field.key]: !value }, meta)}
        >
          {value ? field.onLabel || 'Required / enabled' : field.offLabel || 'Not required / disabled'}
        </button>
      )}
      {field.type === 'select' && (
        <select
          id={`field-${field.key}`}
          value={value ?? ''}
          data-testid={`prop-${field.key}`}
          onChange={(event) => onUpdateProps(component.id, { [field.key]: event.target.value }, meta)}
        >
          {(field.options || []).map((option) => {
            const optionValue = typeof option === 'string' ? option : option.value;
            const optionLabel = typeof option === 'string' ? option : option.label;
            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
      )}
      {field.type === 'text' && (
        <input
          id={`field-${field.key}`}
          value={value ?? ''}
          data-testid={`prop-${field.key}`}
          onChange={(event) => onUpdateProps(component.id, { [field.key]: event.target.value }, meta)}
        />
      )}
      {field.type === 'number' && (
        <UnitInput
          field={field}
          value={value}
          onChange={(next) => onUpdateProps(component.id, { [field.key]: next }, meta)}
          testId={`prop-${field.key}`}
        />
      )}
    </div>
  );
}

function CalculatedField({ field, value, sourceLabel }) {
  const isFuture = Boolean(field.future);
  return (
    <div className={`prop-field calculated-field ${isFuture ? 'future' : ''}`}>
      <div className="prop-field-head">
        <label>
          {field.label}
          <em className={`calc-badge ${isFuture ? 'future' : ''}`}>
            <Lock size={9} /> {isFuture ? FUTURE_NOTE : sourceLabel}
          </em>
        </label>
        <span className="prop-field-tools">
          <HelpTip text={field.tooltip} />
        </span>
      </div>
      <div className="readonly-value">
        <b>{formatValue(value, field)}</b>
        {field.unit && <em>{field.unit}</em>}
      </div>
    </div>
  );
}

function TransformSection({ component, onUpdateComponent }) {
  const rotationDeg = Math.round((component.rotation.y * 180) / Math.PI * 10) / 10;
  return (
    <Section title="Transform" defaultOpen>
      <div className="transform-grid">
        {['x', 'y', 'z'].map((axis) => (
          <label key={axis}>
            Position {axis.toUpperCase()}
            <UnitInput
              field={{ label: `Position ${axis.toUpperCase()}`, unit: 'm', step: 0.5 }}
              value={component.position[axis]}
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
          <UnitInput
            field={{ label: 'Rotation Y', unit: '°', step: 15 }}
            value={rotationDeg}
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
            <UnitInput
              field={{ label: `Scale ${axis.toUpperCase()}`, unit: '×', step: 0.1, min: 0.01 }}
              value={component.scale[axis]}
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
    </Section>
  );
}

export default function PropertiesPanel({
  factory,
  selection,
  result,
  liveSnapshot,
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
      <section className="properties-panel">
        <div className="panel-intro">
          <span className="eyebrow">Properties</span>
          <h3>Component properties</h3>
          <p>Select a scene object to inspect its industrial configuration and live performance.</p>
        </div>
        <div className="overview-grid">
          <div><small>Components</small><b>{stats.components}</b></div>
          <div><small>Connections</small><b>{stats.connections}</b></div>
          <div><small>Workstations</small><b>{stats.workstations}</b></div>
          <div><small>Workers</small><b>{stats.workers}</b></div>
        </div>
        <div className="panel-legend">
          <span><i className="legend-swatch editable" /> Editable configuration</span>
          <span><i className="legend-swatch calculated" /> Calculated metric</span>
        </div>
        <p className="tip">Drag components from the left onto the grid. Select a component and press W, E or R to switch between move, rotate and scale.</p>
        <p className="tip">Run continuous or batch simulation to populate the read-only live metrics for the selected component.</p>
      </section>
    );
  }

  if (selectedComponents.length > 1) {
    return (
      <section className="properties-panel">
        <div className="panel-intro">
          <span className="eyebrow">Selection</span>
          <h3>{selectedComponents.length} objects selected</h3>
        </div>
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
  const sections = sectionsForComponent(component);
  const defaults = DEFAULT_PROPS[component.type] || {};
  const line = factory.lines.find((l) => l.id === component.lineId);

  const metrics = liveSnapshot?.metrics || null;
  const liveAvailable = Boolean(metrics);
  const liveNode = metrics?.stations?.find((node) => node.id === component.id) || null;
  const liveHub = metrics?.workers?.find((hub) => hub.id === component.id) || null;
  const batchNode = result?.stations?.find((node) => node.id === component.id) || null;
  const batchHub = result?.workers?.find((hub) => hub.id === component.id) || null;
  const batchAvailable = Boolean(result?.ok);

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

  const resolveValue = (field) => {
    if (typeof field.value === 'function') {
      return field.value({
        component,
        liveNode,
        liveHub,
        batchNode,
        batchHub,
        metrics,
        batch: result,
        liveSnapshot,
        liveAvailable,
      });
    }
    const liveSource = component.type === 'worker' ? liveHub : liveNode;
    if (field.liveKey && liveSource && liveSource[field.liveKey] !== undefined) {
      return liveSource[field.liveKey];
    }
    const batchSource = component.type === 'worker' ? batchHub : batchNode;
    if (field.batchKey && batchSource && batchSource[field.batchKey] !== undefined) {
      return batchSource[field.batchKey];
    }
    if (field.liveKey && batchSource && batchSource[field.liveKey] !== undefined) {
      return batchSource[field.liveKey];
    }
    return null;
  };

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
    <section className="properties-panel">
      <div className="property-head">
        <span className="type-badge" style={{ background: `${typeColor(component.type)}22`, color: typeColor(component.type) }}>
          {typeLabel(component.type)}
        </span>
        <small>ID {component.id}</small>
      </div>
      <h3>{component.name}</h3>

      <div className="panel-legend">
        <span><i className="legend-swatch editable" /> Editable</span>
        <span><i className="legend-swatch calculated" /> Calculated</span>
      </div>

      <Section title="Component Information" defaultOpen>
        <div className="prop-grid">
          <div className="prop-field wide">
            <div className="prop-field-head">
              <label htmlFor="component-name">Name</label>
              <span className="prop-field-tools"><HelpTip text="Display name used in the scene, object list and results." /></span>
            </div>
            <input
              id="component-name"
              value={component.name}
              onChange={(event) =>
                onUpdateComponent(component.id, { name: event.target.value }, { tag: `name:${component.id}` })
              }
              data-testid="component-name"
            />
          </div>
          <div className="prop-field wide">
            <div className="prop-field-head">
              <label htmlFor="component-line">Production line</label>
              <span className="prop-field-tools"><HelpTip text="Production line that owns this component for reporting and filtering." /></span>
            </div>
            <select
              id="component-line"
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
          </div>
          <div className="prop-field">
            <div className="prop-field-head"><label>Component type</label></div>
            <div className="readonly-value compact"><b>{typeLabel(component.type)}</b></div>
          </div>
          <div className="prop-field">
            <div className="prop-field-head"><label>Identifier</label></div>
            <div className="readonly-value compact mono"><b>{component.id}</b></div>
          </div>
        </div>
      </Section>

      <TransformSection component={component} onUpdateComponent={onUpdateComponent} />

      {sections.map((section) => {
        const isLive = section.title === 'Live Metrics';
        const sourceLabel = liveAvailable ? 'Live' : batchAvailable ? 'Batch' : 'Calculated';
        return (
          <Section key={section.title} title={section.title} count={section.fields.length}>
            {isLive && !liveAvailable && !batchAvailable && (
              <p className="empty-note">Run continuous or batch simulation to populate live metrics.</p>
            )}
            <div className="prop-grid">
              {section.fields.map((field) => {
                if (field.calculated) {
                  return (
                    <CalculatedField
                      key={field.id || field.key}
                      field={field}
                      value={resolveValue(field)}
                      sourceLabel={field.id === 'configuredThroughput' ? 'Calculated' : sourceLabel}
                    />
                  );
                }
                return (
                  <ConfigField
                    key={field.key}
                    field={field}
                    component={component}
                    defaults={defaults}
                    onUpdateProps={onUpdateProps}
                  />
                );
              })}
            </div>
          </Section>
        );
      })}

      {component.type === 'workstation' && (
        <Section title="Worker Assignment">
          {assignedHubs.length ? (
            <div className="assignment-list">
              {assignedHubs.map((hub) => (
                <div className="assignment-row" key={hub.id}>
                  <Link2 size={11} />
                  <span>{hub.name}</span>
                  <em>{hub.props.employees} persons</em>
                </div>
              ))}
            </div>
          ) : (
            <p className="tip warn">No worker hub assigned. This human-required station will starve.</p>
          )}
          <button className="secondary wide" onClick={() => onActivateConnect?.()}>
            <Link2 size={12} /> Connect worker hub
          </button>
        </Section>
      )}

      {component.type === 'worker' && (
        <Section title="Workstation Assignment">
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
        </Section>
      )}

      <Section title="Connections">
        <div className="assignment-list">
          {incomingMaterial.map((edge) => connectionRow(edge, 'in'))}
          {outgoingMaterial.map((edge) => connectionRow(edge, 'out'))}
          {workerIn.map((edge) => connectionRow(edge, 'in'))}
          {workerOut.map((edge) => connectionRow(edge, 'out'))}
          {!incomingMaterial.length && !outgoingMaterial.length && !workerIn.length && !workerOut.length && (
            <p className="empty-note">No connections. Use Connect mode or drag from a port.</p>
          )}
        </div>
      </Section>

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
