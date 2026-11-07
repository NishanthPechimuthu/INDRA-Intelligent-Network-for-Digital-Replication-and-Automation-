import React from 'react';
import { Activity, AlertTriangle, BarChart3, Gauge, Zap } from 'lucide-react';

function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <span>{label}{hint && <small>{hint}</small>}</span>
      <b>{value}</b>
    </div>
  );
}

export default function ResultsPanel({ result, stale, hours }) {
  if (!result) {
    return (
      <section>
        <h3>Performance analytics</h3>
        <p>Run the simulation to calculate production metrics from the connected factory graph.</p>
      </section>
    );
  }

  const maxGood = Math.max(1, ...result.hourly.map((bucket) => bucket.good));

  return (
    <section>
      <div className="results-head">
        <h3>Performance analytics</h3>
        <span className={`run-badge ${stale ? 'stale' : 'fresh'}`}>{stale ? 'STALE' : 'CURRENT'}</span>
      </div>
      <p className="tip">
        <Activity size={12} /> {result.hours}h simulation · {result.connectionCount ?? 0} connections · seed {result.seed}
        {' · '}
        {result.engine === 'wasm' ? 'C++/WASM core' : 'JS fallback'}
      </p>

      <h4>Production</h4>
      <Stat label="Total input" value={result.input.toLocaleString()} hint="products generated" />
      <Stat label="Good output" value={result.good.toLocaleString()} hint="delivered to output bins" />
      <Stat label="Rejected" value={result.rejected.toLocaleString()} hint="scrapped at workstations" />
      <Stat label="Throughput" value={`${result.throughputPerHour}/hr`} hint="good output per hour" />
      <Stat label="Average cycle time" value={`${result.avgCycleTime}s`} hint="source to finished goods" />
      <Stat label="Average waiting time" value={`${result.avgWaitingTime}s`} hint="queue time per good product" />
      <Stat label="Work in progress" value={`${result.wip} avg`} hint={`${result.finalWip} at end of run`} />

      <h4><Gauge size={12} /> Utilization</h4>
      <Stat label="Machine utilization" value={`${result.utilization}%`} hint="average across stations" />
      <Stat label="Worker utilization" value={`${result.workerUtilization}%`} hint="busy vs available" />
      <Stat label="Bottleneck workstation" value={result.bottleneck} hint="highest effective utilization" />
      <Stat label="Energy consumption" value={`${result.energyKwh} kWh`} hint="workstations + conveyors" />

      {result.hourly.length > 0 && (
        <>
          <h4><BarChart3 size={12} /> Hourly good output</h4>
          <div className="bars">
            {result.hourly.map((bucket) => (
              <div key={bucket.hour} title={`Hour ${bucket.hour + 1}: ${bucket.good} good, ${bucket.rejected} rejected`}>
                <i style={{ height: `${(bucket.good / maxGood) * 100}%` }} />
                <small>{bucket.label}</small>
              </div>
            ))}
          </div>
        </>
      )}

      <h4>Workstation metrics</h4>
      {result.stations.map((station) => (
        <div className="station-card" key={station.id}>
          <div className="station-head">
            <span>{station.name}</span>
            <b>{station.utilization}%</b>
          </div>
          <div className="station-meta">
            <span>{station.cycleTime}s cycle</span>
            <span>{station.workers} workers</span>
            <span>{station.throughput}/hr</span>
          </div>
          <div className="util-bar"><i style={{ width: `${Math.min(100, station.utilization)}%` }} /></div>
          <div className="station-sub">
            <span>available {station.availability}%</span>
            <span>starved {station.starvedHours.toFixed(2)}h</span>
            <span>blocked {station.blockedHours.toFixed(2)}h</span>
            <span>down {station.downHours.toFixed(2)}h</span>
          </div>
          <div className="station-sub">
            <span>processed {station.processed}</span>
            <span>good {station.good}</span>
            <span>rejected {station.rejected}</span>
          </div>
        </div>
      ))}

      {result.workers.length > 0 && (
        <>
          <h4>Worker hubs</h4>
          {result.workers.map((worker) => (
            <div className="station-card" key={worker.id}>
              <div className="station-head">
                <span>{worker.name}</span>
                <b>{worker.utilization}%</b>
              </div>
              <div className="station-meta">
                <span>{worker.employees} employees</span>
                <span>{worker.assignments} assignments</span>
                <span>{worker.busyHours.toFixed(2)} busy h</span>
              </div>
              <div className="util-bar amber"><i style={{ width: `${Math.min(100, worker.utilization)}%` }} /></div>
            </div>
          ))}
        </>
      )}

      <h4><Zap size={12} /> Diagnostics</h4>
      {result.notes.map((note, index) => (
        <p className="tip" key={`${note}-${index}`}>
          {note.includes('without') || note.includes('No material') || note.includes('capacity') ? (
            <AlertTriangle size={11} />
          ) : null}{' '}
          {note}
        </p>
      ))}
      <p className="tip mono">
        Input = good + rejected + WIP · balance {result.massBalance > 0 ? '+' : ''}
        {result.massBalance} products over {hours}h requested.
      </p>
    </section>
  );
}
