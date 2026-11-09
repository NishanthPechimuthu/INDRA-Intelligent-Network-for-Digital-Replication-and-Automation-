import React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Gauge,
  RotateCcw,
  Users,
  Zap,
} from 'lucide-react';

function Stat({ label, value, hint, metric }) {
  return (
    <div className="stat">
      <span>
        {label}
        {metric && <em className={`metric-tag ${metric}`}>{metric}</em>}
        {hint && <small>{hint}</small>}
      </span>
      <b>{value}</b>
    </div>
  );
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percent(value) {
  return `${Math.round(number(value) * 10) / 10}%`;
}

function deriveOee(data) {
  if (!data) return null;
  if (Number.isFinite(Number(data.oee))) {
    return {
      availability: number(data.availability),
      performance: number(data.performance),
      quality: number(data.quality),
      oee: number(data.oee),
      calculated: true,
      live: true,
    };
  }
  const stations = data.stations || [];
  const availability = stations.length
    ? stations.reduce((sum, station) => sum + number(station.availability, 100), 0) / stations.length
    : 100;
  const performance = Math.min(100, number(data.utilization));
  const totalOutput = number(data.good) + number(data.rejected);
  const quality = totalOutput > 0 ? (number(data.good) / totalOutput) * 100 : 0;
  return {
    availability,
    performance,
    quality,
    oee: (availability / 100) * (performance / 100) * (quality / 100) * 100,
    calculated: true,
    live: false,
  };
}

function lineMetrics(data, factory) {
  const componentById = new Map((factory?.components || []).map((component) => [component.id, component]));
  const lines = new Map();
  for (const line of factory?.lines || []) {
    lines.set(line.id, { id: line.id, name: line.name, color: line.color, processed: 0, good: 0, rejected: 0, utilization: 0, stations: 0 });
  }
  for (const station of data?.stations || []) {
    const lineId = station.lineId || componentById.get(station.id)?.lineId;
    if (!lineId) continue;
    if (!lines.has(lineId)) {
      lines.set(lineId, { id: lineId, name: lineId, color: '#687e91', processed: 0, good: 0, rejected: 0, utilization: 0, stations: 0 });
    }
    const line = lines.get(lineId);
    line.processed += number(station.processed);
    line.good += number(station.good);
    line.rejected += number(station.rejected);
    line.utilization += number(station.utilization);
    line.stations += 1;
  }
  return [...lines.values()]
    .filter((line) => line.stations > 0 || (factory?.lines || []).length <= 2)
    .map((line) => ({
      ...line,
      utilization: line.stations ? line.utilization / line.stations : 0,
    }));
}

export default function ResultsPanel({
  factory,
  result,
  liveResult,
  liveStatus,
  liveSnapshot,
  onResetLive,
  stale,
  hours,
}) {
  const live = Boolean(liveResult);
  const data = live ? liveResult : result;

  if (!data) {
    return (
      <section>
        <h3>Performance analytics</h3>
        <p>Run the simulation to calculate production metrics from the connected factory graph.</p>
        {liveStatus === 'idle' && (
          <p className="tip">Continuous run and Step run share the same live engine and animate products along the real graph.</p>
        )}
      </section>
    );
  }

  const hourly = data.hourly || [];
  const maxHour = Math.max(1, ...hourly.map((bucket) => number(bucket.good) + number(bucket.rejected)));
  const oee = deriveOee(data);
  const downtime = Number.isFinite(Number(data.downtimeHours))
    ? number(data.downtimeHours)
    : (data.stations || []).reduce((sum, station) => sum + number(station.downHours), 0);
  const massBalance = number(data.massBalance);
  const lines = lineMetrics(data, factory);
  const assumptions = data.assumptions || [
    'Batch simulation uses a fixed seed and the discrete-event engine.',
    'Availability uses station availability reported by the engine.',
    'Performance is the average station utilisation for batch results; live runs derive it from ideal cycle time.',
    'Quality is good output divided by good plus rejected output.',
    'OEE is calculated from availability × performance × quality and is not a measured plant KPI.',
  ];

  return (
    <section>
      <div className="results-head">
        <h3>Performance analytics</h3>
        <span className={`run-badge ${live ? 'live' : stale ? 'stale' : 'fresh'}`}>
          {live ? 'LIVE' : stale ? 'STALE' : 'CURRENT'}
        </span>
      </div>
      <p className="tip">
        <Activity size={12} />{' '}
        {live ? (
          <>
            Live DES · {number(data.hours).toFixed(2)}h simulated · operation {liveSnapshot?.operationSeq ?? 0} · {liveStatus}
          </>
        ) : (
          <>
            {data.hours}h batch · {data.connectionCount ?? 0} connections · seed {data.seed} ·{' '}
            {data.engine === 'wasm' ? 'C++/WASM core' : 'JS fallback'}
          </>
        )}
      </p>
      <p className="tip mono">
        {live
          ? 'Products are moving through the graph in the 3D scene. Pause, step, or reset from the simulation bar.'
          : 'Instant batch result. Use Continuous run or Step run for animated, operation-level live results.'}
      </p>

      <div className="summary-card">
        <b>Summary</b>
        <p>
          {number(data.good).toLocaleString()} good and {number(data.rejected).toLocaleString()} rejected
          {' '}with {number(data.wip).toFixed(live ? 0 : 1)} WIP at {percent(data.utilization)} utilisation.
          Bottleneck: <strong>{data.bottleneck || '—'}</strong>.
        </p>
        {live && (
          <button className="reset-live" onClick={onResetLive} data-testid="results-reset-live">
            <RotateCcw size={12} /> Reset live run
          </button>
        )}
      </div>

      <h4>Production</h4>
      <Stat label="Total input" value={number(data.input).toLocaleString()} hint="products generated" metric="actual" />
      <Stat label="Good output" value={number(data.good).toLocaleString()} hint="delivered to output bins" metric="actual" />
      <Stat label="Rejected" value={number(data.rejected).toLocaleString()} hint="inspection or final quality" metric="actual" />
      <Stat label="Throughput" value={`${number(data.throughputPerHour)}/hr`} hint="good output per simulated hour" metric="calculated" />
      <Stat label="Average cycle time" value={`${number(data.avgCycleTime)}s`} hint="source to finished goods" metric="actual" />
      <Stat label="Average waiting time" value={`${number(data.avgWaitingTime)}s`} hint="queue time per delivered product" metric="actual" />
      <Stat label="Work in progress" value={live ? `${number(data.wip)} now` : `${number(data.wip)} avg`} hint={`${number(data.finalWip)} at end of run`} metric="actual" />

      <h4><Gauge size={12} /> OEE and efficiency</h4>
      <div className="oee-card">
        <div className="oee-main">
          <span>OEE {oee?.live ? '' : 'proxy'}</span>
          <b>{oee ? percent(oee.oee) : '—'}</b>
          <em className="metric-tag calculated">calculated</em>
        </div>
        <div className="oee-parts">
          <div><span>Availability</span><b>{oee ? percent(oee.availability) : '—'}</b></div>
          <div><span>Performance</span><b>{oee ? percent(oee.performance) : '—'}</b></div>
          <div><span>Quality</span><b>{oee ? percent(oee.quality) : '—'}</b></div>
        </div>
        <p className="tip">
          {oee?.live
            ? 'Live OEE uses actual scheduled time and recorded downtime, ideal cycle time, and actual good/rejected output.'
            : 'Batch OEE is a calculated proxy: station availability × average utilisation × quality. Use live mode for cycle-time-based performance.'}
        </p>
      </div>

      <h4>Operations</h4>
      <Stat label="Machine utilization" value={percent(data.utilization)} hint="average across stations" metric="calculated" />
      <Stat label="Worker utilization" value={percent(data.workerUtilization)} hint="busy vs available employees" metric="calculated" />
      <Stat label="Bottleneck workstation" value={data.bottleneck || '—'} hint="highest effective utilization" metric="calculated" />
      <Stat label="Downtime" value={`${number(downtime).toFixed(2)} h`} hint="recorded station and conveyor downtime" metric="actual" />
      <Stat label="Energy consumption" value={`${number(data.energyKwh).toFixed(2)} kWh`} hint="workstations + conveyors" metric="calculated" />
      <Stat label="Mass balance" value={`${massBalance > 0 ? '+' : ''}${massBalance.toFixed(2)}`} hint="input + initial stock − good − rejected − WIP" metric="calculated" />

      {hourly.length > 0 && (
        <>
          <h4><BarChart3 size={12} /> Hourly output</h4>
          <div className="bars">
            {hourly.map((bucket) => {
              const good = number(bucket.good);
              const rejected = number(bucket.rejected);
              return (
                <div key={bucket.hour} title={`Hour ${bucket.hour + 1}: ${good} good, ${rejected} rejected, ${number(bucket.input)} input`}>
                  <span className="bar-stack">
                    <i className="good" style={{ height: `${(good / maxHour) * 100}%` }} />
                    <i className="bad" style={{ height: `${(rejected / maxHour) * 100}%` }} />
                  </span>
                  <small>{bucket.label}</small>
                </div>
              );
            })}
          </div>
          <p className="tip chart-legend"><i className="good" /> good output <i className="bad" /> rejected</p>
        </>
      )}

      {lines.length > 1 && (
        <>
          <h4>Production lines</h4>
          {lines.map((line) => (
            <div className="line-card" key={line.id}>
              <div className="station-head">
                <span><i className="line-swatch" style={{ background: line.color }} />{line.name}</span>
                <b>{percent(line.utilization)}</b>
              </div>
              <div className="station-meta">
                <span>{line.stations} stations</span>
                <span>{line.processed} processed</span>
                <span>{line.good} good</span>
                <span>{line.rejected} rejected</span>
              </div>
              <div className="util-bar"><i style={{ width: `${Math.min(100, line.utilization)}%` }} /></div>
            </div>
          ))}
        </>
      )}

      <h4><Clock size={12} /> Station metrics</h4>
      {(data.stations || []).map((station) => (
        <div className="station-card" key={station.id}>
          <div className="station-head">
            <span>{station.name}</span>
            <b>{percent(station.utilization)}</b>
          </div>
          <div className="station-meta">
            {station.state && <span className={`state ${station.state}`}>{station.state}</span>}
            <span>{number(station.cycleTime)}s cycle</span>
            <span>{number(station.workers)} workers{station.activeWorkers != null ? ` · ${station.activeWorkers} active` : ''}</span>
            <span>{number(station.throughput)}/hr</span>
          </div>
          <div className="util-bar"><i style={{ width: `${Math.min(100, number(station.utilization))}%` }} /></div>
          <div className="station-sub">
            <span>available {percent(station.availability)}</span>
            <span>starved {number(station.starvedHours).toFixed(2)}h</span>
            <span>blocked {number(station.blockedHours).toFixed(2)}h</span>
            <span>down {number(station.downHours).toFixed(2)}h</span>
          </div>
          <div className="station-sub">
            <span>processed {number(station.processed)}</span>
            <span>good {number(station.good)}</span>
            <span>rejected {number(station.rejected)}</span>
            {station.queueLength != null && <span>queue {number(station.queueLength)}</span>}
            {station.avgWaitingTime != null && <span>wait {number(station.avgWaitingTime)}s</span>}
          </div>
        </div>
      ))}

      {(data.workers || []).length > 0 && (
        <>
          <h4><Users size={12} /> Worker hubs</h4>
          {data.workers.map((worker) => (
            <div className="station-card" key={worker.id}>
              <div className="station-head">
                <span>{worker.name}</span>
                <b>{percent(worker.utilization)}</b>
              </div>
              <div className="station-meta">
                <span>{number(worker.employees)} employees</span>
                <span>{number(worker.assignments)} assignments</span>
                <span>{number(worker.busyHours).toFixed(2)} busy h</span>
                {worker.availableWorkers != null && <span>{number(worker.availableWorkers)} available</span>}
                {worker.unavailableWorkers != null && <span>{number(worker.unavailableWorkers)} unavailable</span>}
              </div>
              <div className="util-bar amber"><i style={{ width: `${Math.min(100, number(worker.utilization))}%` }} /></div>
              {worker.assignedWorkstations && (
                <div className="station-sub"><span>{worker.assignedWorkstations}</span></div>
              )}
            </div>
          ))}
        </>
      )}

      <h4><Zap size={12} /> Diagnostics</h4>
      {(data.notes || []).map((note, index) => (
        <p className="tip" key={`${note}-${index}`}>
          {note.includes('without') || note.includes('No material') || note.includes('capacity') ? (
            <AlertTriangle size={11} />
          ) : null}{' '}
          {note}
        </p>
      ))}

      <h4>Assumptions and metric types</h4>
      <div className="assumption-list">
        <p><em className="metric-tag actual">actual</em> Recorded by the engine from products and events.</p>
        <p><em className="metric-tag calculated">calculated</em> Derived from recorded values and configured inputs.</p>
        <p><em className="metric-tag assumed">assumed</em> Batch proxy or modelling assumption, not a measurement.</p>
        {assumptions.map((assumption, index) => (
          <p key={`${assumption}-${index}`}><em className="metric-tag assumed">assumed</em> {assumption}</p>
        ))}
      </div>

      <p className="tip mono">
        Input = good + rejected + WIP · balance {massBalance > 0 ? '+' : ''}
        {massBalance.toFixed(2)} products over {live ? number(data.hours).toFixed(2) : hours}h.
      </p>
    </section>
  );
}
