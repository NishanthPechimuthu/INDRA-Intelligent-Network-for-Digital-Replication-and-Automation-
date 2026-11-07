import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, GitCompareArrows, ShieldCheck, XCircle } from 'lucide-react';
import { runSimulation } from '../engine/index.js';
import { diffFactories } from '../persistence/FactorySerializer.js';
import { typeColor, PROPERTY_SCHEMAS } from '../data/componentDefs.js';

function TopDownMap({ factory, title }) {
  const view = useMemo(() => {
    const components = factory.components;
    if (!components.length) {
      return { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
    }
    const xs = components.map((c) => c.position.x);
    const zs = components.map((c) => c.position.z);
    return {
      minX: Math.min(...xs) - 3,
      maxX: Math.max(...xs) + 3,
      minZ: Math.min(...zs) - 3,
      maxZ: Math.max(...zs) + 3,
    };
  }, [factory]);

  const width = Math.max(4, view.maxX - view.minX);
  const height = Math.max(4, view.maxZ - view.minZ);
  const byId = new Map(factory.components.map((c) => [c.id, c]));
  const project = (component) => ({
    x: ((component.position.x - view.minX) / width) * 280 + 10,
    y: ((component.position.z - view.minZ) / height) * 160 + 20,
  });

  return (
    <div className="layout-map">
      <b>{title}</b>
      <svg viewBox="0 0 300 200" role="img" aria-label={`${title} top-down layout`}>
        <rect x="0" y="0" width="300" height="200" fill="#0b1621" stroke="#2a4051" />
        {factory.connections.map((edge) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          const a = project(from);
          const b = project(to);
          return (
            <line
              key={edge.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={edge.kind === 'worker' ? '#e3a13d88' : '#52c9ad77'}
              strokeWidth="1.2"
              strokeDasharray={edge.kind === 'worker' ? '3 3' : undefined}
            />
          );
        })}
        {factory.components.map((component) => {
          const point = project(component);
          const isConveyor = component.type === 'conveyor';
          return (
            <g key={component.id}>
              <rect
                x={point.x - (isConveyor ? 9 : 6)}
                y={point.y - 5}
                width={isConveyor ? 18 : 12}
                height="10"
                rx="2"
                fill={typeColor(component.type)}
                opacity="0.9"
              >
                <title>{component.name}</title>
              </rect>
              <text x={point.x} y={point.y + 14} textAnchor="middle" fill="#8fa6b8" fontSize="6">
                {component.name.slice(0, 14)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Delta({ from, to, suffix = '' }) {
  if (typeof from !== 'number' || typeof to !== 'number') {
    return <span className="delta neutral">—</span>;
  }
  const delta = to - from;
  const sign = delta > 0 ? '+' : '';
  return (
    <span className={`delta ${delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral'}`}>
      {sign}{Math.round(delta * 10) / 10}{suffix}
    </span>
  );
}

export default function ChangePanel({
  factory,
  baseline,
  role,
  setRole,
  audit,
  onApprove,
  onStatus,
  stale,
}) {
  const [category, setCategory] = useState('Machine');
  const [reason, setReason] = useState('Evaluate proposed factory configuration and production impact.');
  const [confirmed, setConfirmed] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [comparisonStale, setComparisonStale] = useState(true);

  useEffect(() => {
    setComparisonStale(true);
  }, [factory, baseline]);

  const compare = () => {
    const hours = factory.settings.durationHours;
    const options = {
      hours,
      seed: factory.settings.seed,
      stochastic: factory.settings.stochastic,
    };
    const baselineResult = runSimulation(baseline.factory, options);
    const proposedResult = runSimulation(factory, options);
    const diff = diffFactories(baseline.factory, factory);
    setComparison({
      baselineResult,
      proposedResult,
      diff,
      at: new Date().toLocaleString(),
      hours,
    });
    setComparisonStale(false);
    onStatus?.('Baseline and proposed configurations compared.');
  };

  const canApprove =
    role === 'Plant Manager' &&
    confirmed &&
    comparison &&
    !comparisonStale &&
    comparison.diff.hasChanges;

  const approve = () => {
    if (!canApprove) {
      onStatus?.('Approval requires the Plant Manager role and implementation confirmation.');
      return;
    }
    onApprove?.({ role, category, reason, comparison });
    setConfirmed(false);
    setComparisonStale(true);
  };

  const metricRows = comparison
    ? [
        ['Good output', comparison.baselineResult.good, comparison.proposedResult.good, ' pcs'],
        ['Throughput', comparison.baselineResult.throughputPerHour, comparison.proposedResult.throughputPerHour, '/hr'],
        ['Rejected', comparison.baselineResult.rejected, comparison.proposedResult.rejected, ' pcs'],
        ['WIP (avg)', comparison.baselineResult.wip, comparison.proposedResult.wip, ' pcs'],
        ['Machine utilization', comparison.baselineResult.utilization, comparison.proposedResult.utilization, '%'],
        ['Worker utilization', comparison.baselineResult.workerUtilization, comparison.proposedResult.workerUtilization, '%'],
        ['Energy', comparison.baselineResult.energyKwh, comparison.proposedResult.energyKwh, ' kWh'],
      ]
    : [];

  return (
    <section>
      <h3>4M change management</h3>
      <p className="tip">
        Approved baseline: <b>{baseline.factory.name}</b>
        {baseline.approvedAt ? ` · ${new Date(baseline.approvedAt).toLocaleString()}` : ' · initial baseline'}
        {baseline.approvedBy ? ` · ${baseline.approvedBy}` : ''}
      </p>

      <div className="change-actions">
        <button className="run wide" onClick={compare} data-testid="compare-change">
          <GitCompareArrows size={14} /> Compare baseline vs proposed
        </button>
        {comparison && comparisonStale && <span className="run-badge stale">RESULTS STALE</span>}
        {stale && <span className="run-badge stale">SIMULATION STALE</span>}
      </div>
      {comparison && (
        <p className="tip mono">
          Compared {comparison.at} · {comparison.hours}h · seed {factory.settings.seed}
        </p>
      )}

      <h4>Factory layouts</h4>
      <div className="layout-compare">
        <TopDownMap factory={baseline.factory} title="Approved baseline" />
        <TopDownMap factory={factory} title="Proposed (working)" />
      </div>

      {comparison && (
        <>
          <h4>Component changes</h4>
          <div className="diff-grid">
            <div>
              <span className="diff-label added"><CheckCircle2 size={11} /> Added</span>
              {comparison.diff.added.length ? comparison.diff.added.map((c) => (
                <div className="diff-item" key={c.id}>{c.name} <em>{c.type}</em></div>
              )) : <p className="empty-note">None</p>}
            </div>
            <div>
              <span className="diff-label removed"><XCircle size={11} /> Removed</span>
              {comparison.diff.removed.length ? comparison.diff.removed.map((c) => (
                <div className="diff-item" key={c.id}>{c.name} <em>{c.type}</em></div>
              )) : <p className="empty-note">None</p>}
            </div>
          </div>

          <h4>Modified components</h4>
          {comparison.diff.modified.length ? comparison.diff.modified.map((entry) => (
            <div className="diff-item" key={entry.id}>
              <b>{entry.name}</b>
              <span>
                {entry.changes.map((change) => `${change.field}: ${format(change.from)} → ${format(change.to)}`).join(' · ')}
              </span>
            </div>
          )) : <p className="empty-note">No layout or identity changes.</p>}

          <h4>Changed machine properties</h4>
          {comparison.diff.propertyChanges.length ? comparison.diff.propertyChanges.map((change, index) => (
            <div className="diff-item" key={`${change.id}-${change.key}-${index}`}>
              <b>{change.name}</b>
              <span>{propertyLabel(change.type, change.key)}: {format(change.from)} → {format(change.to)}</span>
            </div>
          )) : <p className="empty-note">No property changes.</p>}

          <h4>Connection changes</h4>
          <div className="stat">
            <span>Added connections</span>
            <b>{comparison.diff.connectionsAdded.length}</b>
          </div>
          <div className="stat">
            <span>Removed connections</span>
            <b>{comparison.diff.connectionsRemoved.length}</b>
          </div>

          <h4>Production comparison</h4>
          <div className="metric-table">
            <div className="metric-row head">
              <span>Metric</span><b>Baseline</b><b>Proposed</b><span>Delta</span>
            </div>
            {metricRows.map(([label, from, to, suffix]) => (
              <div className="metric-row" key={label}>
                <span>{label}</span>
                <b>{format(from)}{suffix}</b>
                <b>{format(to)}{suffix}</b>
                <Delta from={from} to={to} suffix={suffix} />
              </div>
            ))}
            <div className="metric-row">
              <span>Bottleneck</span>
              <b>{comparison.baselineResult.bottleneck}</b>
              <b>{comparison.proposedResult.bottleneck}</b>
              <span className="delta neutral">
                {comparison.baselineResult.bottleneck === comparison.proposedResult.bottleneck ? 'same' : 'changed'}
              </span>
            </div>
          </div>
        </>
      )}

      <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ShieldCheck size={12} /> Approval
      </h4>
      <label>Reviewer role</label>
      <select value={role} onChange={(event) => setRole(event.target.value)} data-testid="approval-role">
        <option>Engineer</option>
        <option>Supervisor</option>
        <option>Plant Manager</option>
      </select>
      <label>4M category</label>
      <select value={category} onChange={(event) => setCategory(event.target.value)}>
        <option>Machine</option>
        <option>Man</option>
        <option>Material</option>
        <option>Method</option>
      </select>
      <label>Reason / impact summary</label>
      <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
      <label className="confirm-row">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          data-testid="implementation-confirmed"
        />
        Implementation confirmed and change reviewed
      </label>
      <button
        className="run wide"
        disabled={!canApprove}
        onClick={approve}
        data-testid="approve-change"
      >
        <ShieldCheck size={14} /> Approve &amp; replace baseline
      </button>
      {role !== 'Plant Manager' && (
        <p className="tip warn">
          Only a Plant Manager (authorized officer) can approve and implement a change.
        </p>
      )}
      {role === 'Plant Manager' && !confirmed && (
        <p className="tip warn">Confirm that the implementation was reviewed before approving.</p>
      )}
      <p className="tip">
        Approval is enforced in the browser session. The approved baseline is not overwritten until
        an authorized role confirms implementation.
      </p>

      <h4>Audit trail</h4>
      {audit.length ? audit.map((entry) => (
        <div className="audit-row" key={entry.id}>
          <CheckCircle2 size={11} />
          <span>
            <b>{entry.role}</b> approved “{entry.versionName}” · {entry.category}
            <small>{new Date(entry.at).toLocaleString()} · {entry.reason}</small>
          </span>
        </div>
      )) : <p className="empty-note">No approvals recorded.</p>}
    </section>
  );
}

function format(value) {
  if (typeof value === 'number') return Math.round(value * 10) / 10;
  if (value === undefined || value === null) return '—';
  return String(value);
}

function propertyLabel(type, key) {
  const field = (PROPERTY_SCHEMAS[type] || []).find((entry) => entry.key === key);
  return field?.label || key;
}
