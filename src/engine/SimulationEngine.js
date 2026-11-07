// Discrete, product-level factory simulation.
// Deliberately free of React and Three.js dependencies so it can run in a worker,
// in Node tests, or be replaced by the C++/WASM implementation through wasmBridge.

import { buildAdjacency, sourceReachability, workerConnections } from './graph.js';
import { seededRandom } from './random.js';

const GRAPH_NODE_TYPES = new Set(['source', 'workstation', 'conveyor', 'buffer', 'output']);
const EPSILON = 1e-9;

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback = 1) {
  return Math.max(EPSILON, n(value, fallback));
}

function isScheduled(t, totalMinutes, breakMinutes, meetingMinutes, changeoverMinutes) {
  const total = Math.max(60, positive(totalMinutes, 60) * 60);
  const change = Math.max(0, n(changeoverMinutes)) * 60;
  const work = Math.max(1, Math.max(1, n(totalMinutes, 60) - n(breakMinutes) - n(meetingMinutes))) * 60;
  const phase = t % total;
  return phase >= change - EPSILON && phase < Math.min(total, change + work) - EPSILON;
}

function createRuntime(component) {
  return {
    component,
    id: component.id,
    type: component.type,
    queue: [],
    processing: null,
    blocked: null,
    transit: [],
    downUntil: 0,
    roundRobin: 0,
    accepted: 0,
    generated: 0,
    processed: 0,
    good: 0,
    rejected: 0,
    faults: 0,
    busySeconds: 0,
    availableSeconds: 0,
    blockedSeconds: 0,
    starvedSeconds: 0,
    downSeconds: 0,
    energyKwh: 0,
    queueCapacity: Infinity,
  };
}

function emptyResult(hours, input = 0) {
  return {
    ok: false,
    hours,
    input,
    good: 0,
    rejected: 0,
    throughputPerHour: 0,
    rate: 0,
    utilization: 0,
    util: 0,
    workerUtilization: 0,
    avgCycleTime: 0,
    avgWaitingTime: 0,
    wip: 0,
    bottleneck: 'Add a complete production line',
    energyKwh: 0,
    stations: [],
    workers: [],
    hourly: Array.from({ length: Math.max(1, hours) }, (_, i) => ({
      hour: i,
      label: `${i + 1}h`,
      good: 0,
      rejected: 0,
      wip: 0,
      value: 0,
    })),
    chart: [],
    notes: ['A production line needs a source, at least one workstation and an output bin.'],
    finalWip: 0,
    massBalance: 0,
  };
}

/**
 * Run the factory simulation.
 * @param {object} factory normalised factory document
 * @param {{hours?:number, seed?:number, stochastic?:boolean, stepSeconds?:number}} options
 */
export function runSimulation(factory, options = {}) {
  const hours = Math.max(1, Math.min(168, Math.round(n(options.hours ?? factory.settings?.durationHours, 8))));
  const seed = n(options.seed ?? factory.settings?.seed, 12345);
  const stochastic = options.stochastic ?? factory.settings?.stochastic ?? true;
  const step = Math.max(0.25, n(options.stepSeconds, 1));
  const rng = seededRandom(seed);

  const components = factory.components || [];
  const sources = components.filter((c) => c.type === 'source');
  const workstations = components.filter((c) => c.type === 'workstation');
  const outputs = components.filter((c) => c.type === 'output');

  if (!sources.length || !outputs.length) {
    const result = emptyResult(hours);
    result.notes = [
      !sources.length ? 'Add a Source component to generate products.' : null,
      !outputs.length ? 'Add an Output bin to collect finished goods.' : null,
      !workstations.length ? 'Add at least one Workstation to process products.' : null,
    ].filter(Boolean);
    return result;
  }

  const map = new Map(components.map((c) => [c.id, c]));
  const { outgoing } = buildAdjacency(factory, 'material');
  const { incoming } = buildAdjacency(factory, 'material');
  const workersByStation = new Map();
  for (const edge of workerConnections(factory)) {
    if (!workersByStation.has(edge.to)) workersByStation.set(edge.to, []);
    const hub = components.find((c) => c.id === edge.from);
    if (hub) workersByStation.get(edge.to).push(hub);
  }
  const stationsByHub = new Map();
  for (const edge of workerConnections(factory)) {
    if (!stationsByHub.has(edge.from)) stationsByHub.set(edge.from, []);
    stationsByHub.get(edge.from).push(edge.to);
  }

  const nodes = new Map();
  for (const component of components) {
    if (!GRAPH_NODE_TYPES.has(component.type)) continue;
    const node = createRuntime(component);
    if (component.type === 'buffer') {
      node.queueCapacity = Math.max(1, Math.round(n(component.props.capacity, 1)));
    } else if (component.type === 'workstation') {
      node.queueCapacity = 1;
    } else if (component.type === 'conveyor') {
      node.queueCapacity = Math.max(1, Math.round(n(component.props.capacity, 1)));
    } else if (component.type === 'output') {
      node.queueCapacity = Math.max(1, Math.round(n(component.props.binCapacity, 1)));
    }
    nodes.set(component.id, node);
  }

  // ---- Precomputed worker supply -------------------------------------------------
  const hubRuntime = new Map();
  for (const hub of components.filter((c) => c.type === 'worker')) {
    const stationIds = stationsByHub.get(hub.id) || [];
    const employees = Math.max(0, n(hub.props.employees, 0));
    const share = stationIds.length ? employees / stationIds.length : 0;
    hubRuntime.set(hub.id, {
      component: hub,
      employees,
      share,
      stationIds,
      availableEmployeeSeconds: 0,
      busyEmployeeSeconds: 0,
    });
  }

  function hubAvailable(hub, t) {
    return isScheduled(
      t,
      hub.props.shiftMinutes,
      hub.props.breakMinutes,
      hub.props.meetingMinutes,
      hub.props.changeoverMinutes,
    );
  }

  function availableWorkersFor(station, t) {
    if (!station.component.props.humanRequired) return Infinity;
    const hubs = workersByStation.get(station.id) || [];
    if (!hubs.length) return 0;
    let available = 0;
    for (const hub of hubs) {
      const runtime = hubRuntime.get(hub.id);
      if (runtime && hubAvailable(hub, t)) available += runtime.share;
    }
    return available;
  }

  function requiredWorkers(station) {
    return Math.max(0, Math.round(n(station.component.props.workers, 0)));
  }

  function stationStaffed(station, t) {
    if (!station.component.props.humanRequired) return true;
    return availableWorkersFor(station, t) + EPSILON >= requiredWorkers(station);
  }

  function stationScheduled(station, t) {
    if (t < station.downUntil) return false;
    const p = station.component.props;
    return isScheduled(
      t,
      p.workingTimePerShift,
      p.breakMinutes,
      p.meetingMinutes,
      p.changeoverMinutes,
    );
  }

  // ---- Product movement ----------------------------------------------------------
  let productSeq = 0;
  const products = [];
  function makeProduct(t, fromSource = true, productType = 'Product') {
    productSeq += 1;
    const product = {
      id: productSeq,
      createdAt: t,
      queuedAt: t,
      waiting: 0,
      productType,
      fromSource,
    };
    products.push(product);
    return product;
  }

  function addWait(product, t) {
    product.waiting += Math.max(0, t - product.queuedAt);
  }

  function canAccept(node, t) {
    if (!node) return false;
    switch (node.type) {
      case 'workstation':
        return node.queue.length < node.queueCapacity && !node.blocked;
      case 'buffer':
        return node.queue.length < node.queueCapacity;
      case 'conveyor':
        return node.transit.length < node.queueCapacity;
      case 'output':
        return node.accepted < node.queueCapacity;
      default:
        return false;
    }
  }

  function acceptInto(node, product, t) {
    if (node.type === 'conveyor') {
      addWait(product, t);
      const moveTime = positive(node.component.props.moveTime, 1);
      node.transit.push({ product, readyAt: t + moveTime, queuedAt: t });
      return true;
    }
    if (node.type === 'output') {
      addWait(product, t);
      node.accepted += 1;
      node.good += 1;
      product.deliveredAt = t;
      product.cycleTime = t - product.createdAt;
      onGoodOutput(product, t);
      return true;
    }
    // workstation / buffer queues
    product.queuedAt = t;
    node.queue.push(product);
    if (node.type === 'buffer' && node.component.props.mode === 'LIFO') {
      // LIFO only affects the dequeue order, not the insertion order.
    }
    return true;
  }

  function outgoingEdges(node) {
    return (outgoing.get(node.id) || [])
      .map((id) => nodes.get(id))
      .filter(Boolean);
  }

  function pushToDownstream(node, product, t) {
    const targets = outgoingEdges(node);
    if (!targets.length) return false;
    const start = node.roundRobin % targets.length;
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[(start + i) % targets.length];
      if (canAccept(target, t)) {
        node.roundRobin = (start + i + 1) % Math.max(1, targets.length);
        acceptInto(target, product, t);
        return true;
      }
    }
    return false;
  }

  // ---- Source generation ---------------------------------------------------------
  const sourceState = new Map();
  for (const source of sources) {
    const rate = Math.max(0, n(source.props.inputPerHour, 0));
    const mean = rate > 0 ? 3600 / rate : Infinity;
    const nextArrival = rate > 0 ? (stochastic ? -Math.log(1 - rng()) * mean : mean) : Infinity;
    sourceState.set(source.id, { nextArrival, rate, mean });
    const node = nodes.get(source.id);
    const initial = Math.max(0, Math.round(n(source.props.initialQuantity, 0)));
    for (let i = 0; i < initial; i += 1) {
      node.queue.push(makeProduct(0, true, source.props.productType || 'Product'));
    }
    node.generated += initial;
  }

  function generateSource(node, t, dt) {
    const state = sourceState.get(node.id);
    if (!state || state.rate <= 0) return;
    const productType = node.component.props.productType || 'Product';
    while (state.nextArrival <= t + EPSILON) {
      node.queue.push(makeProduct(state.nextArrival, true, productType));
      node.generated += 1;
      if (stochastic) {
        state.nextArrival += -Math.log(1 - rng()) * state.mean;
      } else {
        state.nextArrival += state.mean;
      }
    }
  }

  // Initial buffer stock is not counted as source input but is part of mass balance.
  let initialStock = 0;
  for (const node of nodes.values()) {
    if (node.type !== 'buffer') continue;
    const initial = Math.max(0, Math.round(n(node.component.props.initialQuantity, 0)));
    const capped = Math.min(initial, node.queueCapacity);
    for (let i = 0; i < capped; i += 1) {
      node.queue.push(makeProduct(0, false, 'Initial stock'));
    }
    initialStock += capped;
  }

  // ---- Simulation bookkeeping ----------------------------------------------------
  const stepCount = Math.round((hours * 3600) / step);
  const hourly = Array.from({ length: hours }, (_, i) => ({
    hour: i,
    label: `${i + 1}h`,
    good: 0,
    rejected: 0,
    wip: 0,
    value: 0,
  }));

  let good = 0;
  let rejected = 0;
  let deliveredCycleTimeSum = 0;
  let deliveredWaitingSum = 0;
  let wipAccumulator = 0;
  let wipSamples = 0;
  let t = 0;

  function countWip() {
    let total = 0;
    for (const node of nodes.values()) {
      total += node.queue.length;
      if (node.processing) total += 1;
      if (node.blocked) total += 1;
      total += node.transit.length;
    }
    return total;
  }

  function onGoodOutput(product, time) {
    good += 1;
    deliveredCycleTimeSum += product.cycleTime || 0;
    deliveredWaitingSum += product.waiting || 0;
    const bucket = Math.min(hourly.length - 1, Math.max(0, Math.floor(time / 3600)));
    hourly[bucket].good += 1;
    hourly[bucket].value = hourly[bucket].good;
  }

  // ---- Topological order --------------------------------------------------------
  const flowNodes = [...nodes.values()];
  const inDegree = new Map(flowNodes.map((node) => [node.id, 0]));
  for (const node of flowNodes) {
    for (const target of outgoing.get(node.id) || []) {
      if (inDegree.has(target)) inDegree.set(target, (inDegree.get(target) || 0) + 1);
    }
  }
  const ready = flowNodes.filter((node) => (inDegree.get(node.id) || 0) === 0);
  const order = [];
  const seen = new Set();
  while (ready.length) {
    const node = ready.shift();
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    order.push(node);
    for (const targetId of outgoing.get(node.id) || []) {
      if (!inDegree.has(targetId)) continue;
      inDegree.set(targetId, inDegree.get(targetId) - 1);
      if (inDegree.get(targetId) === 0) {
        const target = nodes.get(targetId);
        if (target && !seen.has(targetId)) ready.push(target);
      }
    }
  }
  for (const node of flowNodes) if (!seen.has(node.id)) order.push(node);

  // ---- Main loop -----------------------------------------------------------------
  for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    t += step;

    // Worker calendars are evaluated once per tick.
    const hubAvailability = new Map();
    for (const [id, runtime] of hubRuntime) {
      const available = hubAvailable(runtime.component, t);
      hubAvailability.set(id, available);
      if (available) runtime.availableEmployeeSeconds += runtime.employees * step;
    }

    for (const node of order) {
      if (node.type === 'source') {
        generateSource(node, t, step);
        // Push as many products as downstream buffers will accept.
        while (node.queue.length) {
          const product = node.queue[0];
          if (!pushToDownstream(node, product, t)) break;
          node.queue.shift();
        }
        continue;
      }

      if (node.type === 'conveyor') {
        const props = node.component.props;
        const faultRate = Math.max(0, n(props.faultRate, 0));
        if (stochastic && faultRate > 0 && t >= node.downUntil) {
          const probability = (faultRate / 100) * (step / 3600);
          if (rng() < probability) {
            node.faults += 1;
            node.downUntil = t + Math.max(0, n(props.faultRecoveryMinutes, 0)) * 60;
            for (const item of node.transit) item.readyAt += node.downUntil - t;
          }
        }
        if (t >= node.downUntil) {
          node.energyKwh += Math.max(0, n(props.powerKw, 0)) * (step / 3600);
        }
        for (let i = node.transit.length - 1; i >= 0; i -= 1) {
          const item = node.transit[i];
          if (item.readyAt > t) continue;
          if (pushToDownstream(node, item.product, t)) {
            node.transit.splice(i, 1);
          }
        }
        continue;
      }

      if (node.type === 'buffer') {
        const items = node.queue;
        while (items.length) {
          const product = node.component.props.mode === 'LIFO' ? items[items.length - 1] : items[0];
          if (!pushToDownstream(node, product, t)) break;
          if (node.component.props.mode === 'LIFO') items.pop();
          else items.shift();
        }
        continue;
      }

      if (node.type === 'workstation') {
        const props = node.component.props;
        const scheduled = stationScheduled(node, t);
        const staffed = stationStaffed(node, t);
        const available = scheduled && staffed;

        if (available) node.availableSeconds += step;
        else if (scheduled) node.downSeconds += step;

        // Push a completed piece held by blocking.
        if (node.blocked) {
          if (pushToDownstream(node, node.blocked, t)) {
            node.blocked = null;
          } else {
            node.blockedSeconds += step;
          }
        }

        // Advance current processing.
        if (node.processing) {
          node.busySeconds += step;
          if (node.component.props.humanRequired) {
            const required = requiredWorkers(node);
            if (required > 0) {
              for (const hub of hubRuntime.values()) {
                if (hub.stationIds.includes(node.id)) {
                  hub.busyEmployeeSeconds += Math.min(hub.share, required) * step;
                }
              }
            }
          }
          node.processing.remaining -= step;
          if (node.processing.remaining <= EPSILON) {
            const product = node.processing.product;
            node.processing = null;
            node.processed += 1;
            const workerHubs = workersByStation.get(node.id) || [];
            const hubError = workerHubs.length
              ? workerHubs.reduce((sum, hub) => sum + n(hub.props.errorRate, 0), 0) / workerHubs.length / 100
              : 0;
            const rejectChance = Math.min(0.99, n(props.errorRate, 0) / 100 + hubError);
            const isRejected = stochastic && rng() < rejectChance;
            if (isRejected) {
              node.rejected += 1;
              rejected += 1;
              const bucket = Math.min(hourly.length - 1, Math.max(0, Math.floor(t / 3600)));
              hourly[bucket].rejected += 1;
              node.downUntil = Math.max(
                node.downUntil,
                t + Math.max(0, n(props.errorRecoveryMinutes, 0)) * 60,
              );
            } else {
              product.queuedAt = t;
              node.good += 1;
              node.blocked = product;
              if (pushToDownstream(node, node.blocked, t)) {
                node.blocked = null;
              }
            }

            if (stochastic && rng() < Math.min(0.99, n(props.toolDamage, 0) / 100)) {
              node.downUntil = Math.max(
                node.downUntil,
                t + Math.max(0, n(props.changeoverMinutes, 0)) * 60,
              );
            }
          }
        }

        // Start the next piece when the station is free and staffed.
        if (
          available &&
          !node.processing &&
          !node.blocked &&
          node.queue.length &&
          t >= node.downUntil
        ) {
          const product = node.component.props.mode === 'LIFO' ? node.queue.pop() : node.queue.shift();
          addWait(product, t);
          node.processing = {
            product,
            remaining: positive(props.cycleTime, 1),
          };
        }

        if (available && !node.processing && !node.blocked && !node.queue.length) {
          node.starvedSeconds += step;
        }
        continue;
      }

      if (node.type === 'output') {
        // Products are accepted directly by upstream nodes.
        node.energyKwh += 0;
      }
    }

    const wip = countWip();
    wipAccumulator += wip;
    wipSamples += 1;
    if (Math.abs(t % 3600) < EPSILON && t > 0) {
      const index = Math.min(hourly.length - 1, Math.round(t / 3600) - 1);
      hourly[index].wip = wip;
    }
  }

  // ---- Aggregate metrics ---------------------------------------------------------
  const finalWip = countWip();
  hourly[hourly.length - 1].wip = finalWip;

  const stationResults = workstations.map((station) => {
    const node = nodes.get(station.id);
    const productive = node.busySeconds + node.starvedSeconds + node.blockedSeconds;
    const utilization = productive > 0 ? (node.busySeconds / productive) * 100 : 0;
    return {
      id: station.id,
      name: station.name,
      utilization: Math.round(utilization * 10) / 10,
      availability: Math.round((node.availableSeconds / (hours * 3600)) * 1000) / 10,
      busyHours: node.busySeconds / 3600,
      starvedHours: node.starvedSeconds / 3600,
      blockedHours: node.blockedSeconds / 3600,
      downHours: node.downSeconds / 3600,
      processed: node.processed,
      good: node.good,
      rejected: node.rejected,
      throughput: Math.round((node.good / hours) * 10) / 10,
      cycleTime: n(station.props.cycleTime, 0),
      workers: n(station.props.workers, 0),
    };
  });

  const workerResults = [...hubRuntime.values()].map((hub) => {
    const utilization = hub.availableEmployeeSeconds > 0
      ? (hub.busyEmployeeSeconds / hub.availableEmployeeSeconds) * 100
      : 0;
    return {
      id: hub.component.id,
      name: hub.component.name,
      employees: hub.employees,
      utilization: Math.round(utilization * 10) / 10,
      availableHours: hub.availableEmployeeSeconds / 3600,
      busyHours: hub.busyEmployeeSeconds / 3600,
      assignments: hub.stationIds.length,
    };
  });

  const reach = sourceReachability(factory);
  const notes = [];
  if (reach.unreachable.length) {
    notes.push(`No material path from a source: ${reach.unreachable.slice(0, 6).join(', ')}.`);
  }
  const unstaffed = workstations.filter(
    (station) =>
      station.props.humanRequired &&
      (workersByStation.get(station.id) || []).length === 0,
  );
  if (unstaffed.length) {
    notes.push(
      `Human-required stations without a Worker hub assignment: ${unstaffed.map((s) => s.name).slice(0, 6).join(', ')}.`,
    );
  }
  const disconnectedEdges = factory.connections.filter((c) => {
    const from = map.get(c.from);
    const to = map.get(c.to);
    return !from || !to;
  });
  if (disconnectedEdges.length) notes.push('Some connections reference missing components and were ignored.');
  const fullOutputs = outputs.filter((output) => {
    const node = nodes.get(output.id);
    return node && node.accepted >= node.queueCapacity;
  });
  if (fullOutputs.length) notes.push('One or more output bins reached capacity; upstream flow was blocked.');
  if (!stochastic) notes.push('Stochastic faults, tool damage and rejection sampling are disabled for this run.');
  if (!notes.length) notes.push('Simulation completed using the connected factory graph.');

  const machineUtilization = stationResults.length
    ? stationResults.reduce((sum, s) => sum + s.utilization, 0) / stationResults.length
    : 0;
  const workerAvailable = [...hubRuntime.values()].reduce((sum, h) => sum + h.availableEmployeeSeconds, 0);
  const workerBusy = [...hubRuntime.values()].reduce((sum, h) => sum + h.busyEmployeeSeconds, 0);
  const workerUtilization = workerAvailable > 0 ? (workerBusy / workerAvailable) * 100 : 0;

  const bottleneckStation = stationResults
    .slice()
    .sort((a, b) => b.utilization - a.utilization)[0];
  const bottleneck = bottleneckStation && bottleneckStation.utilization > 0
    ? bottleneckStation.name
    : stationResults[0]?.name || '—';

  const totalInput = sources.reduce((sum, source) => sum + (nodes.get(source.id)?.generated || 0), 0);
  // Workstation energy is derived from busy time; conveyors accumulate it per tick.
  const stationEnergy = workstations.reduce(
    (sum, station) => sum + (nodes.get(station.id)?.busySeconds || 0) / 3600 * n(station.props.powerKw, 0),
    0,
  );
  const conveyorEnergy = components
    .filter((c) => c.type === 'conveyor')
    .reduce((sum, c) => sum + (nodes.get(c.id)?.energyKwh || 0), 0);

  const avgCycleTime = good > 0 ? deliveredCycleTimeSum / good : 0;
  const avgWaitingTime = good > 0 ? deliveredWaitingSum / good : 0;
  const avgWip = wipSamples > 0 ? wipAccumulator / wipSamples : 0;
  const throughputPerHour = good / hours;

  const chart = hourly.map((bucket) => ({
    ...bucket,
    value: bucket.good,
  }));

  return {
    ok: true,
    hours,
    input: totalInput,
    good,
    rejected,
    throughputPerHour: Math.round(throughputPerHour * 10) / 10,
    rate: Math.round(throughputPerHour),
    utilization: Math.round(machineUtilization * 10) / 10,
    util: Math.round(machineUtilization),
    workerUtilization: Math.round(workerUtilization * 10) / 10,
    avgCycleTime: Math.round(avgCycleTime * 10) / 10,
    avgWaitingTime: Math.round(avgWaitingTime * 10) / 10,
    wip: Math.round(avgWip * 10) / 10,
    finalWip,
    bottleneck,
    energyKwh: Math.round((stationEnergy + conveyorEnergy) * 100) / 100,
    stations: stationResults,
    workers: workerResults,
    hourly: chart,
    chart,
    notes,
    initialStock,
    massBalance: totalInput + initialStock - good - rejected - finalWip,
    seed,
    stochastic,
    connectionCount: factory.connections.length,
    engine: 'js',
  };
}

/** Backwards-compatible wrapper for callers that only have a node list. */
export function simulate(factoryOrNodes, hours = 8) {
  if (Array.isArray(factoryOrNodes)) {
    const factory = {
      components: factoryOrNodes,
      connections: [],
      settings: { durationHours: hours, seed: 12345, stochastic: true },
    };
    return runSimulation(factory, { hours });
  }
  return runSimulation(factoryOrNodes, { hours });
}
