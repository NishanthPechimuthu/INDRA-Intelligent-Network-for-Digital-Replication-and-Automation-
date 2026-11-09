// Deterministic, renderer-independent production simulation.
//
// Both continuous mode and step mode drive this same engine. Continuous mode
// advances simulated time with fixed substeps; step mode advances until the next
// production operation and then pauses. Products only move through the configured
// material graph, so the Three.js layer can animate the exact runtime state.

import { seededRandom } from '../random.js';

const TICK = 0.1;
const EPSILON = 1e-9;
const MAX_STEPS_PER_ADVANCE = 500_000;
const MAX_PRODUCT_AGE = 1.8;
const GRAPH_TYPES = new Set(['source', 'workstation', 'conveyor', 'buffer', 'output']);

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback = 1) {
  return Math.max(EPSILON, n(value, fallback));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pct(value) {
  return round(clamp(n(value, 0), 0, 100), 1);
}

function isInspection(node) {
  return node.type === 'workstation' && node.props?.stationType === 'inspection';
}

function typeLabel(type) {
  return {
    source: 'Source',
    workstation: 'Workstation',
    inspection: 'Inspection',
    conveyor: 'Conveyor',
    buffer: 'Buffer',
    output: 'Output',
    worker: 'Worker hub',
  }[type] || type;
}

function stationLabel(node) {
  if (isInspection(node)) return `${node.name} (inspection)`;
  return node.name;
}

export class ProductionEngine {
  constructor(factory, options = {}) {
    if (!factory || !Array.isArray(factory.components)) {
      throw new Error('ProductionEngine needs a factory with components.');
    }
    this.factory = factory;
    this.options = {
      seed: n(options.seed, factory.settings?.seed ?? 12345),
      durationSeconds: Math.max(1, n(options.durationSeconds, n(factory.settings?.durationHours, 8) * 3600)),
      stochastic: options.stochastic !== false,
    };
    this.reset();
  }

  reset() {
    this._resetRuntime();
    this.stepHistory = [{ elapsed: 0, operationSeq: 0 }];
    return this.snapshot();
  }

  _resetRuntime() {
    this.elapsed = 0;
    this.accumulator = 0;
    this.productSeq = 0;
    this.operationSeq = 0;
    this.lastOperation = null;
    this.finished = false;
    this.notes = [];
    this.random = seededRandom(this.options.seed);
    this.products = new Map();
    this.nodes = new Map();
    this.hubs = new Map();
    this.transfers = new Map();
    this.componentMap = new Map(this.factory.components.map((component) => [component.id, component]));
    this.outgoing = new Map();
    this.incoming = new Map();
    this.hubsForStation = new Map();

    this.total = {
      input: 0,
      good: 0,
      rejected: 0,
      rejectedAtInspection: 0,
      rejectedAtOutput: 0,
      escapedDefects: 0,
      cycleTimeSum: 0,
      cycleCount: 0,
      waitingTimeSum: 0,
      waitingCount: 0,
    };
    this.initialStock = 0;
    this.hourly = [];

    for (const component of this.factory.components) {
      this.outgoing.set(component.id, []);
      this.incoming.set(component.id, []);
    }
    for (const edge of this.factory.connections) {
      if ((edge.kind || 'material') !== 'material') continue;
      if (!this.outgoing.has(edge.from) || !this.outgoing.has(edge.to)) continue;
      this.outgoing.get(edge.from).push({ id: edge.id, from: edge.from, to: edge.to });
      this.incoming.get(edge.to).push({ id: edge.id, from: edge.from, to: edge.to });
    }
    for (const edge of this.factory.connections) {
      if (edge.kind !== 'worker') continue;
      if (!this.hubsForStation.has(edge.to)) this.hubsForStation.set(edge.to, []);
      if (this.componentMap.get(edge.from)?.type === 'worker') {
        this.hubsForStation.get(edge.to).push(edge.from);
      }
    }

    for (const component of this.factory.components) {
      if (component.type === 'worker') {
        this.hubs.set(component.id, this._createHub(component));
      } else if (GRAPH_TYPES.has(component.type)) {
        this.nodes.set(component.id, this._createNode(component));
      }
    }

    // Pre-load buffers and output bins from the configured initial quantities.
    for (const node of this.nodes.values()) {
      if (node.type === 'buffer' && n(node.props.initialQuantity) > 0) {
        const count = Math.min(Math.round(n(node.props.initialQuantity)), Math.max(1, Math.round(n(node.props.capacity, 1))));
        for (let i = 0; i < count; i += 1) {
          const product = this._newProduct(node, { initial: true });
          product.state = 'queued';
          product.waitingSince = 0;
          product.location = { kind: 'queue', nodeId: node.id, index: node.queue.length };
          node.queue.push(product);
          node.inventory = node.queue.length;
          this.initialStock += 1;
        }
      }
      if (node.type === 'output') {
        node.count = Math.max(0, Math.round(n(node.props.productCount)));
      }
    }

    if (!this.factory.components.some((component) => component.type === 'source')) {
      this.notes.push('No material source is configured; the live run will not generate products.');
    }
    if (!this.factory.components.some((component) => component.type === 'output')) {
      this.notes.push('No output bin is configured; finished products will stop at the end of the line.');
    }
  }

  _createHub(component) {
    return {
      id: component.id,
      type: 'worker',
      name: component.name,
      props: component.props || {},
      employees: Math.max(0, Math.round(n(component.props?.employees))),
      busyWorkers: 0,
      onBreak: false,
      busyEmployeeSeconds: 0,
      availableEmployeeSeconds: 0,
      unavailableEmployeeSeconds: 0,
      state: 'available',
    };
  }

  _createNode(component) {
    const props = component.props || {};
    const node = {
      id: component.id,
      type: component.type,
      name: component.name,
      lineId: component.lineId,
      props,
      state: 'idle',
      queue: [],
      items: [],
      slots: [],
      processed: 0,
      good: 0,
      rejected: 0,
      accepted: 0,
      inputReceived: 0,
      outputSent: 0,
      overflowCount: 0,
      shortages: 0,
      consumed: 0,
      inventory: 0,
      currentProducts: 0,
      busyTime: 0,
      downTime: 0,
      blockedTime: 0,
      starvedTime: 0,
      idleTime: 0,
      scheduledTime: 0,
      offShiftTime: 0,
      unavailableTime: 0,
      waitTimeSum: 0,
      waitCount: 0,
      cycleTimeSum: 0,
      cycleCount: 0,
      energyKwh: 0,
      downRemaining: 0,
      faultEvents: 0,
      nextOutgoingIndex: 0,
      count: 0,
      nextGeneration: 0,
      generated: 0,
      workerRequirements: isInspection(component) ? Math.max(0, Math.round(n(props.workers))) : Math.max(0, Math.round(n(props.workers))),
      activeWorkers: 0,
      lastState: 'idle',
    };

    if (node.type === 'source') {
      const initial = Math.max(0, n(props.initialQuantity));
      node.maxStorage = Math.max(1, n(props.maxStorageCapacity, 500));
      node.unlimited = initial <= 0 && n(props.replenishmentRate) <= 0;
      node.inventory = node.unlimited ? node.maxStorage : Math.min(initial, node.maxStorage);
    }
    if (node.type === 'workstation') {
      node.queueCapacity = Math.max(1, Math.round(n(props.queueCapacity, 12)));
      node.processingCapacity = Math.max(1, Math.round(n(props.processingCapacity, 1)));
      node.slots = new Array(node.processingCapacity).fill(null);
      node.workerRequirements = Math.max(0, Math.round(n(props.workers)));
    }
    if (node.type === 'conveyor') {
      node.queueCapacity = Math.max(1, Math.round(n(props.capacity, 10)));
    }
    if (node.type === 'buffer') {
      node.queueCapacity = Math.max(1, Math.round(n(props.capacity, 30)));
    }
    if (node.type === 'output') {
      node.capacity = Math.max(1, Math.round(n(props.binCapacity, 1000)));
    }
    return node;
  }

  _newProduct(node, options = {}) {
    this.productSeq += 1;
    const id = `P${this.productSeq}`;
    const product = {
      id,
      type: options.type || this.factory.components.find((c) => c.type === 'source')?.props?.productType || 'Widget',
      state: 'queued',
      createdAt: options.initial ? 0 : this.elapsed,
      waitingSince: this.elapsed,
      waitTime: 0,
      defective: false,
      defectRolled: false,
      reinspections: 0,
      escapedDefect: false,
      rejected: false,
      sourceId: node.id,
      hops: 0,
      location: null,
      removeAt: null,
    };
    this.products.set(id, product);
    return product;
  }

  // ---------------------------------------------------------------------------
  // Graph helpers
  // ---------------------------------------------------------------------------

  _edgeDuration(fromId, toId) {
    const from = this.componentMap.get(fromId);
    const to = this.componentMap.get(toId);
    if (!from || !to) return 0.5;
    const dx = n(to.position?.x) - n(from.position?.x);
    const dz = n(to.position?.z) - n(from.position?.z);
    const distance = Math.hypot(dx, dz);
    // Hand-offs from or to a conveyor are short; the belt itself is modelled by
    // the conveyor node's transport duration.
    if (from.type === 'conveyor' || to.type === 'conveyor') return clamp(distance / 4, 0.35, 1.8);
    return clamp(distance / 2.5, 0.4, 4.5);
  }

  _conveyorDuration(node) {
    const props = node.props || {};
    const length = positive(props.length, 2.2);
    const speed = positive(props.speed, 1.2);
    return Math.max(0.25, n(props.moveTime, 3), length / speed);
  }

  _canAccept(node) {
    if (!node) return false;
    if (node.type === 'conveyor') return node.items.length < node.queueCapacity;
    if (node.type === 'buffer') return node.queue.length < node.queueCapacity;
    if (node.type === 'workstation') return node.queue.length < node.queueCapacity;
    if (node.type === 'output') return node.count < node.capacity;
    return false;
  }

  _availableHubs(node) {
    return (this.hubsForStation.get(node.id) || [])
      .map((hubId) => this.hubs.get(hubId))
      .filter(Boolean);
  }

  _hubAvailable(hub) {
    if (!hub || hub.onBreak) return 0;
    return Math.max(0, hub.employees - hub.busyWorkers);
  }

  _hubErrorRate(node) {
    const hubs = this._availableHubs(node);
    if (!hubs.length) return 0;
    return hubs.reduce((sum, hub) => sum + n(hub.props.errorRate, 0), 0) / hubs.length;
  }

  _allocateWorkers(node) {
    if (!node.props.humanRequired) return { ok: true, count: 0, allocations: [] };
    const required = Math.max(0, Math.round(n(node.workerRequirements, 0)));
    if (required === 0) return { ok: true, count: 0, allocations: [] };
    const hubs = this._availableHubs(node);
    // Legacy factories can have a human-required station without a hub. Keep it
    // running but surface the missing assignment in the diagnostics.
    if (!hubs.length) return { ok: true, count: 0, allocations: [], unassigned: true };

    let remaining = required;
    const available = hubs.reduce((sum, hub) => sum + this._hubAvailable(hub), 0);
    if (available < required) return { ok: false, count: 0, allocations: [] };

    const allocations = [];
    for (const hub of hubs) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, this._hubAvailable(hub));
      if (take > 0) {
        hub.busyWorkers += take;
        allocations.push({ hub, count: take });
        remaining -= take;
      }
    }
    return { ok: true, count: required, allocations };
  }

  _releaseWorkers(slot) {
    for (const allocation of slot.workers || []) {
      allocation.hub.busyWorkers = Math.max(0, allocation.hub.busyWorkers - allocation.count);
    }
    slot.workers = [];
  }

  _isStationScheduled(node) {
    const workMinutes = Math.max(1, n(node.props.workingTimePerShift, 420));
    const breakMinutes = Math.max(0, n(node.props.breakMinutes, 0));
    const meetingMinutes = Math.max(0, n(node.props.meetingMinutes, 0));
    const totalMinutes = workMinutes + breakMinutes + meetingMinutes;
    if (totalMinutes <= 0) return true;
    const phase = this.elapsed % (totalMinutes * 60);
    return phase < workMinutes * 60 - EPSILON;
  }

  _isHubOnBreak(hub) {
    const shiftMinutes = Math.max(1, n(hub.props.shiftMinutes, 480));
    const breakMinutes = clamp(n(hub.props.breakMinutes, 0), 0, shiftMinutes);
    if (breakMinutes <= 0) return false;
    const total = shiftMinutes * 60;
    const phase = this.elapsed % total;
    return phase >= (shiftMinutes - breakMinutes) * 60 - EPSILON;
  }

  // ---------------------------------------------------------------------------
  // Simulation stepping
  // ---------------------------------------------------------------------------

  advance(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return this.snapshot();
    let remaining = Math.min(deltaSeconds, 24 * 3600);
    this.accumulator += remaining;
    let steps = 0;
    while (this.accumulator >= TICK - EPSILON && steps < MAX_STEPS_PER_ADVANCE && !this.finished) {
      this.tick(TICK);
      this.accumulator -= TICK;
      steps += 1;
    }
    if (!this.finished && this.elapsed >= this.options.durationSeconds - TICK) {
      this.elapsed = this.options.durationSeconds;
      this.finished = true;
    }
    return this.snapshot();
  }

  /** Advance to the next production operation, then stop. */
  step() {
    if (this.finished) return this.snapshot();
    const target = this.operationSeq + 1;
    let guard = 0;
    // Do not freeze the UI when the graph cannot perform an operation (for
    // example an empty factory). Five simulated minutes is more than enough
    // for the usual source interval and cycle times.
    const maxTicks = Math.min(MAX_STEPS_PER_ADVANCE, 3000);
    while (this.operationSeq < target && !this.finished && guard < maxTicks) {
      this.tick(TICK);
      guard += 1;
    }
    this.stepHistory.push({ elapsed: this.elapsed, operationSeq: this.operationSeq });
    return this.snapshot();
  }

  previousStep() {
    if (this.stepHistory.length <= 1) return this.snapshot();
    this.stepHistory.pop();
    const target = this.stepHistory[this.stepHistory.length - 1];
    this._restoreTo(target);
    return this.snapshot();
  }

  _restoreTo(target) {
    const history = this.stepHistory;
    this._resetRuntime();
    let guard = 0;
    while (this.elapsed + EPSILON < target.elapsed && guard < MAX_STEPS_PER_ADVANCE) {
      this.tick(TICK);
      guard += 1;
    }
    this.operationSeq = target.operationSeq;
    this.stepHistory = history;
  }

  tick(dt) {
    this.elapsed += dt;
    if (this.elapsed >= this.options.durationSeconds - EPSILON) {
      this.elapsed = this.options.durationSeconds;
      this.finished = true;
    }

    for (const hub of this.hubs.values()) this._updateHub(hub, dt);
    for (const node of this.nodes.values()) {
      if (node.type === 'source') this._updateSource(node, dt);
    }
    for (const node of this.nodes.values()) {
      if (node.type === 'conveyor') this._updateConveyor(node, dt);
    }
    for (const product of this.products.values()) {
      if (product.location?.kind === 'transfer') this._updateTransfer(product, dt);
    }
    for (const node of this.nodes.values()) {
      if (node.type === 'workstation') this._updateWorkstation(node, dt);
      else if (node.type === 'buffer') this._updateBuffer(node, dt);
      else if (node.type === 'output') this._updateOutput(node, dt);
    }
    this._expireProducts();
    this._updateHourlyBucket();
  }

  _updateHub(hub, dt) {
    const onBreak = this._isHubOnBreak(hub);
    hub.onBreak = onBreak;
    hub.busyEmployeeSeconds += hub.busyWorkers * dt;
    if (onBreak) {
      hub.availableEmployeeSeconds += 0;
      hub.unavailableEmployeeSeconds += hub.employees * dt;
      hub.state = 'unavailable';
    } else {
      hub.availableEmployeeSeconds += hub.employees * dt;
      hub.state = hub.busyWorkers > 0 ? 'working' : 'available';
    }
  }

  _updateSource(node, dt) {
    const props = node.props || {};
    if (!node.unlimited) {
      const replenishment = Math.max(0, n(props.replenishmentRate, 0));
      node.inventory = Math.min(node.maxStorage, node.inventory + (replenishment * dt) / 3600);
    } else {
      node.inventory = node.maxStorage;
    }

    const interval = n(props.inputPerHour, 0) > 0 ? 3600 / n(props.inputPerHour) : Infinity;
    if (!Number.isFinite(interval)) {
      node.state = 'idle';
      return;
    }
    if (this.elapsed + EPSILON < node.nextGeneration) {
      node.state = node.queue.length ? 'blocked' : 'idle';
      return;
    }

    const edge = this._nextAvailableOutgoing(node);
    if (!edge) {
      node.state = 'blocked';
      node.blockedTime += dt;
      return;
    }
    if (!node.unlimited && node.inventory < 1) {
      node.shortages += 1;
      node.nextGeneration = this.elapsed + interval;
      node.state = 'shortage';
      return;
    }

    const product = this._newProduct(node);
    node.inventory = Math.max(0, node.inventory - 1);
    node.consumed += 1;
    node.generated += 1;
    this.total.input += 1;
    const bucket = this._currentHour();
    if (bucket) bucket.input += 1;
    this._startTransfer(node, product, edge, true);
    node.nextGeneration = this.elapsed + interval;
    node.state = 'generating';
    this._bumpOperation('source-generate', { nodeId: node.id, productId: product.id });
  }

  _nextAvailableOutgoing(node, options = {}) {
    const outgoing = this.outgoing.get(node.id) || [];
    if (!outgoing.length) return null;
    const start = node.nextOutgoingIndex || 0;
    for (let i = 0; i < outgoing.length; i += 1) {
      const index = (start + i) % outgoing.length;
      const edge = outgoing[index];
      const target = this.nodes.get(edge.to);
      if (target && this._canAccept(target)) {
        node.nextOutgoingIndex = (index + 1) % outgoing.length;
        return edge;
      }
    }
    return null;
  }

  _startTransfer(fromNode, product, edge, fromQueue = false) {
    const duration = this._edgeDuration(fromNode.id, edge.to);
    product.location = {
      kind: 'transfer',
      edgeId: edge.id,
      from: fromNode.id,
      to: edge.to,
      t: 0,
      duration,
    };
    product.state = 'moving';
    if (!fromQueue) {
      product.waitingSince = product.waitingSince ?? this.elapsed;
    }
    this.transfers.set(product.id, product);
  }

  _updateTransfer(product, dt) {
    const location = product.location;
    if (!location || location.kind !== 'transfer') return;
    if (product.state === 'blocked') {
      if (this._deliver(product, location.to)) return;
      return;
    }
    location.t = Math.min(1, location.t + dt / Math.max(0.05, location.duration));
    if (location.t >= 1 - EPSILON) {
      if (this._deliver(product, location.to)) return;
      product.state = 'blocked';
      const target = this.nodes.get(location.to);
      if (target) target.blockedTime += dt;
    }
  }

  _deliver(product, toId) {
    const target = this.nodes.get(toId);
    if (!target || !this._canAccept(target)) return false;
    this.transfers.delete(product.id);
    product.hops += 1;
    if (product.hops > 128) {
      this.notes.push('A product exceeded the maximum route length; check the graph for an unintended loop.');
      product.state = 'rejected';
      product.rejected = true;
      product.removeAt = this.elapsed + MAX_PRODUCT_AGE;
      return true;
    }

    if (target.type === 'conveyor') {
      target.items.push({
        product,
        progress: 0,
        duration: this._conveyorDuration(target),
        blocked: false,
      });
      target.inputReceived += 1;
      product.location = { kind: 'conveyor', nodeId: target.id, t: 0 };
      product.state = 'moving';
      this._bumpOperation('conveyor-enter', { nodeId: target.id, productId: product.id });
      return true;
    }
    if (target.type === 'buffer') {
      product.location = { kind: 'queue', nodeId: target.id, index: target.queue.length };
      product.state = 'queued';
      product.waitingSince = this.elapsed;
      target.queue.push(product);
      target.inventory = target.queue.length;
      target.inputReceived += 1;
      this._bumpOperation('buffer-enter', { nodeId: target.id, productId: product.id });
      return true;
    }
    if (target.type === 'workstation') {
      product.location = { kind: 'queue', nodeId: target.id, index: target.queue.length };
      product.state = 'queued';
      product.waitingSince = this.elapsed;
      target.queue.push(product);
      target.inputReceived += 1;
      this._bumpOperation('station-enter', { nodeId: target.id, productId: product.id });
      return true;
    }
    if (target.type === 'output') {
      target.count += 1;
      target.accepted += 1;
      target.outputSent += 1;
      const cycle = this.elapsed - product.createdAt;
      const waiting = product.waitTime + Math.max(0, this.elapsed - (product.waitingSince ?? this.elapsed));
      this.total.cycleTimeSum += cycle;
      this.total.cycleCount += 1;
      this.total.waitingTimeSum += waiting;
      this.total.waitingCount += 1;
      target.cycleTimeSum += cycle;
      target.cycleCount += 1;

      if (product.defective || product.escapedDefect) {
        target.rejected += 1;
        target.good = Math.max(0, target.good);
        this.total.rejected += 1;
        this.total.rejectedAtOutput += 1;
        this.total.escapedDefects += 1;
        product.rejected = true;
        product.state = 'rejected';
        const bucket = this._currentHour();
        if (bucket) bucket.rejected += 1;
      } else {
        target.good += 1;
        this.total.good += 1;
        product.state = 'done';
        const bucket = this._currentHour();
        if (bucket) bucket.good += 1;
      }
      product.location = { kind: 'output', nodeId: target.id, t: 0 };
      product.removeAt = this.elapsed + MAX_PRODUCT_AGE;
      this._bumpOperation('output', { nodeId: target.id, productId: product.id, rejected: product.rejected });
      return true;
    }
    return false;
  }

  _updateConveyor(node, dt) {
    const props = node.props || {};
    node.energyKwh += n(props.powerKw, 0) * (dt / 3600);
    if (node.downRemaining > 0) {
      node.downRemaining = Math.max(0, node.downRemaining - dt);
      node.downTime += dt;
      node.state = 'down';
      node.currentProducts = node.items.length;
      return;
    }
    const faultRate = n(props.faultRate, 0);
    if (this.options.stochastic && faultRate > 0 && node.items.length > 0) {
      const chance = (faultRate / 100) * (dt / 3600);
      if (this.random() < chance) {
        node.downRemaining = Math.max(0.2, n(props.faultRecoveryMinutes, 5) * 60);
        node.faultEvents += 1;
        node.downTime += dt;
        node.state = 'down';
        this.notes.push(`${node.name} conveyor fault; recovery ${round(node.downRemaining / 60, 1)} min.`);
        this._bumpOperation('conveyor-fault', { nodeId: node.id });
        return;
      }
    }

    let moving = false;
    for (let i = node.items.length - 1; i >= 0; i -= 1) {
      const item = node.items[i];
      if (item.progress < 1 - EPSILON) {
        item.progress = Math.min(1, item.progress + dt / Math.max(0.05, item.duration));
        item.product.location.t = item.progress;
        moving = true;
      }
      if (item.progress >= 1 - EPSILON) {
        item.product.location.t = 1;
        const edge = this._nextAvailableOutgoing(node);
        if (!edge) {
          item.blocked = true;
          node.blockedTime += dt;
          continue;
        }
        node.items.splice(i, 1);
        node.outputSent += 1;
        this._startTransfer(node, item.product, edge);
        node.state = 'running';
        this._bumpOperation('conveyor-dispatch', { nodeId: node.id, productId: item.product.id });
      }
    }

    node.currentProducts = node.items.length;
    if (moving || node.items.length) node.busyTime += dt;
    else node.idleTime += dt;
    node.state = node.downRemaining > 0 ? 'down' : node.items.some((item) => item.blocked) ? 'blocked' : node.items.length ? 'running' : 'idle';
  }

  _updateBuffer(node, dt) {
    node.inventory = node.queue.length;
    if (!node.queue.length && !node.idleTime) node.state = 'idle';
    const edge = this._nextAvailableOutgoing(node);
    if (!edge) {
      if (node.queue.length) {
        node.blockedTime += dt;
        node.state = 'blocked';
      } else {
        node.idleTime += dt;
        node.state = 'idle';
      }
      return;
    }
    if (!node.queue.length) {
      node.idleTime += dt;
      node.state = 'idle';
      return;
    }
    const product = node.props.mode === 'LIFO' ? node.queue.pop() : node.queue.shift();
    node.queue.forEach((queued, index) => {
      if (queued.location?.kind === 'queue') queued.location.index = index;
    });
    node.inventory = node.queue.length;
    node.waitTimeSum += Math.max(0, this.elapsed - (product.waitingSince ?? this.elapsed));
    node.waitCount += 1;
    product.waitTime += Math.max(0, this.elapsed - (product.waitingSince ?? this.elapsed));
    node.outputSent += 1;
    this._startTransfer(node, product, edge);
    node.state = 'dispatching';
    this._bumpOperation('buffer-dispatch', { nodeId: node.id, productId: product.id });
  }

  _updateWorkstation(node, dt) {
    const scheduled = this._isStationScheduled(node);
    if (scheduled) node.scheduledTime += dt;
    else {
      node.unavailableTime += dt;
      node.offShiftTime += dt;
    }
    node.energyKwh += n(node.props.powerKw, 0) * (dt / 3600);

    if (node.downRemaining > 0) {
      node.downRemaining = Math.max(0, node.downRemaining - dt);
      node.downTime += dt;
      node.state = 'down';
      node.unavailableTime += dt;
      return;
    }

    if (!scheduled) {
      node.state = 'off-shift';
      return;
    }

    if (node.slots.some((slot) => slot?.state === 'processing')) node.busyTime += dt;

    for (let index = 0; index < node.slots.length; index += 1) {
      const slot = node.slots[index];
      if (!slot) continue;
      if (slot.state === 'processing') {
        slot.remaining -= dt;
        if (slot.remaining <= EPSILON) {
          this._completeProcessing(node, slot, index);
        }
      } else if (slot.state === 'done') {
        const edge = this._nextAvailableOutgoing(node);
        if (edge) {
          node.outputSent += 1;
          const product = slot.product;
          this._startTransfer(node, product, edge);
          slot.product = null;
          node.slots[index] = null;
          this._bumpOperation('station-dispatch', { nodeId: node.id, productId: product.id });
        } else {
          slot.state = 'blocked';
          node.blockedTime += dt;
        }
      } else if (slot.state === 'blocked') {
        const edge = this._nextAvailableOutgoing(node);
        if (edge) {
          node.outputSent += 1;
          const product = slot.product;
          this._startTransfer(node, product, edge);
          slot.product = null;
          node.slots[index] = null;
          this._bumpOperation('station-dispatch', { nodeId: node.id, productId: product.id });
        } else {
          node.blockedTime += dt;
        }
      }
    }

    let started = false;
    for (let index = 0; index < node.slots.length; index += 1) {
      if (node.slots[index]) continue;
      if (!node.queue.length) break;
      const workers = this._allocateWorkers(node);
      if (!workers.ok) {
        node.state = 'waiting';
        break;
      }
      const product = node.queue.shift();
      node.queue.forEach((queued, queueIndex) => {
        if (queued.location?.kind === 'queue') queued.location.index = queueIndex;
      });
      product.waitTime += Math.max(0, this.elapsed - (product.waitingSince ?? this.elapsed));
      node.waitTimeSum += Math.max(0, this.elapsed - (product.waitingSince ?? this.elapsed));
      node.waitCount += 1;
      product.startedAt = this.elapsed;
      product.state = 'processing';
      product.location = { kind: 'processing', nodeId: node.id, slotIndex: index };
      if (!product.defectRolled) {
        const workerError = this._hubErrorRate(node);
        const defectChance = clamp((n(node.props.errorRate, 0) + workerError) / 100, 0, 1);
        if (this.options.stochastic && this.random() < defectChance) product.defective = true;
        product.defectRolled = true;
      }
      const cycleTime = Math.max(0.2, n(node.props.cycleTime, 20));
      node.slots[index] = {
        product,
        remaining: cycleTime,
        total: cycleTime,
        state: 'processing',
        workers: workers.allocations,
        workerCount: workers.count,
      };
      node.activeWorkers = Math.min(
        node.workerRequirements,
        node.slots.reduce((sum, slot) => sum + (slot?.workerCount || 0), 0),
      );
      started = true;
      this._bumpOperation('station-start', { nodeId: node.id, productId: product.id });
    }

    if (node.slots.some((slot) => slot?.state === 'processing')) node.state = 'processing';
    else if (node.slots.some((slot) => slot?.state === 'blocked')) node.state = 'blocked';
    else if (!scheduled) node.state = 'off-shift';
    else if (node.queue.length) node.state = started ? 'processing' : 'waiting';
    else {
      node.state = 'starved';
      node.starvedTime += dt;
    }
    node.activeWorkers = node.slots.reduce((sum, slot) => sum + (slot?.workerCount || 0), 0);
    node.currentProducts = node.queue.length + node.slots.filter(Boolean).length;
    node.inventory = node.queue.length;
  }

  _completeProcessing(node, slot, slotIndex) {
    const product = slot.product;
    slot.state = 'done';
    node.processed += 1;
    this._releaseWorkers(slot);
    product.processingFinishedAt = this.elapsed;
    this._maybeScheduleDowntime(node);

    if (!isInspection(node)) {
      node.good += 1;
      this._bumpOperation('station-complete', { nodeId: node.id, productId: product.id });
      return;
    }

    // Inspection: defective products are rejected when detected. A false reject
    // can be sent back for a bounded number of reinspections.
    const detection = pct(node.props.defectDetectionRate ?? 95) / 100;
    const accuracy = pct(node.props.inspectionAccuracy ?? 98) / 100;
    const maxReinspections = Math.max(0, Math.round(n(node.props.maxReinspection, 1)));
    let reject = false;
    let reason = null;

    if (product.defective) {
      if (!this.options.stochastic || this.random() < detection) {
        reject = true;
        reason = 'defect detected';
      } else {
        product.escapedDefect = true;
      }
    } else if (this.options.stochastic && this.random() > accuracy) {
      reject = true;
      reason = 'false reject';
    }

    if (reject && reason === 'false reject' && product.reinspections < maxReinspections) {
      product.reinspections += 1;
      node.rejected += 0;
      product.state = 'queued';
      product.waitingSince = this.elapsed;
      product.location = { kind: 'queue', nodeId: node.id, index: node.queue.length };
      node.queue.unshift(product);
      node.slots[slotIndex] = null;
      this.notes.push(`${node.name}: product ${product.id} sent for reinspection.`);
      this._bumpOperation('inspection-reinspect', { nodeId: node.id, productId: product.id });
      return;
    }

    if (reject) {
      product.state = 'rejected';
      product.rejected = true;
      product.location = { kind: 'rejected', nodeId: node.id, t: 0 };
      product.removeAt = this.elapsed + MAX_PRODUCT_AGE;
      node.rejected += 1;
      node.slots[slotIndex] = null;
      this.total.rejected += 1;
      this.total.rejectedAtInspection += 1;
      const bucket = this._currentHour();
      if (bucket) bucket.rejected += 1;
      this._bumpOperation('inspection-reject', { nodeId: node.id, productId: product.id, reason });
      return;
    }

    node.accepted += 1;
    node.good += 1;
    this._bumpOperation('inspection-accept', { nodeId: node.id, productId: product.id });
  }

  _updateOutput(node, dt) {
    node.currentProducts = node.count;
    node.state = node.count >= node.capacity ? 'full' : 'ready';
  }

  _expireProducts() {
    for (const [id, product] of this.products) {
      if (product.removeAt != null && this.elapsed >= product.removeAt) {
        this.products.delete(id);
        this.transfers.delete(id);
      }
    }
  }

  _maybeScheduleDowntime(node) {
    if (!this.options.stochastic) return;
    const recovery = Math.max(0.2, n(node.props.errorRecoveryMinutes, 5) * 60);
    const maintenanceInterval = Math.max(0, Math.round(n(node.props.maintenanceInterval, 0)));
    if (maintenanceInterval > 0 && node.processed % maintenanceInterval === 0) {
      const duration = Math.max(0, n(node.props.maintenanceMinutes, 0) * 60);
      if (duration > 0) {
        node.downRemaining = Math.max(node.downRemaining, duration);
        node.faultEvents += 1;
        this.notes.push(`${node.name}: scheduled maintenance for ${round(duration / 60, 1)} min.`);
        this._bumpOperation('station-maintenance', { nodeId: node.id });
        return;
      }
    }
    const toolDamage = clamp(n(node.props.toolDamage, 0), 0, 100) / 100;
    if (toolDamage > 0 && this.random() < toolDamage) {
      node.downRemaining = Math.max(node.downRemaining, recovery);
      node.faultEvents += 1;
      this.notes.push(`${node.name}: tool failure; recovery ${round(recovery / 60, 1)} min.`);
      this._bumpOperation('station-fault', { nodeId: node.id });
    }
  }

  _currentHour() {
    const hour = Math.floor(this.elapsed / 3600);
    if (hour < 0 || hour >= 168) return null;
    return this.hourly[hour] || null;
  }

  _updateHourlyBucket() {
    const hour = Math.floor(this.elapsed / 3600);
    while (this.hourly.length <= hour && this.hourly.length < 168) {
      this.hourly.push({ hour: this.hourly.length, label: `H${this.hourly.length + 1}`, good: 0, rejected: 0, input: 0 });
    }
  }

  _bumpOperation(type, payload = {}) {
    this.operationSeq += 1;
    this.lastOperation = { seq: this.operationSeq, type, at: this.elapsed, ...payload };
  }

  // ---------------------------------------------------------------------------
  // Metrics and snapshots
  // ---------------------------------------------------------------------------

  _nodeMetrics(node) {
    const elapsed = Math.max(1, this.elapsed);
    const scheduled = Math.max(1, node.scheduledTime);
    const utilization = node.type === 'conveyor'
      ? clamp((node.busyTime / elapsed) * 100, 0, 100)
      : clamp((node.busyTime / scheduled) * 100, 0, 100);
    const availability = clamp(100 - (node.downTime / scheduled) * 100, 0, 100);
    return {
      id: node.id,
      name: stationLabel(node),
      type: node.type,
      stationType: isInspection(node) ? 'inspection' : node.type,
      lineId: node.lineId,
      state: node.state,
      utilization: round(utilization, 1),
      availability: round(availability, 1),
      busyHours: round(node.busyTime / 3600, 2),
      starvedHours: round(node.starvedTime / 3600, 2),
      blockedHours: round(node.blockedTime / 3600, 2),
      downHours: round(node.downTime / 3600, 2),
      offShiftHours: round(node.offShiftTime / 3600, 2),
      processed: node.processed,
      good: node.good,
      rejected: node.rejected,
      accepted: node.accepted,
      throughput: round(node.processed / (elapsed / 3600), 1),
      queueLength: node.type === 'workstation' ? node.queue.length : node.queue.length + node.items.length,
      currentProducts: node.type === 'conveyor' ? node.items.length : node.type === 'buffer' ? node.queue.length : node.currentProducts || 0,
      inventory: node.type === 'source' ? Math.round(node.inventory) : node.inventory,
      shortageCount: node.shortages,
      consumed: node.consumed,
      overflowCount: node.overflowCount,
      cycleTime: n(node.props.cycleTime, 0),
      workers: node.type === 'workstation' ? Math.max(0, Math.round(n(node.props.workers))) : 0,
      activeWorkers: node.activeWorkers || 0,
      avgWaitingTime: round(node.waitCount ? node.waitTimeSum / node.waitCount : 0, 1),
      inputRate: round((node.inputReceived / elapsed) * 3600, 1),
      outputRate: round((node.outputSent / elapsed) * 3600, 1),
      energyKwh: round(node.energyKwh, 3),
      capacity: n(node.props.capacity, 0),
      interval: n(node.props.interval, 0),
      speed: n(node.props.speed, 0),
      accuracy: isInspection(node) ? n(node.props.inspectionAccuracy, 98) : 0,
      detectionRate: isInspection(node) ? n(node.props.defectDetectionRate, 95) : 0,
      defectRate: node.type === 'workstation' ? n(node.props.errorRate, 0) : 0,
    };
  }

  _workerMetrics(hub) {
    const elapsed = Math.max(1, this.elapsed);
    const available = Math.max(1, hub.availableEmployeeSeconds);
    const utilization = clamp((hub.busyEmployeeSeconds / available) * 100, 0, 100);
    const assigned = (this.hubsForStation.get(hub.id) ? [] : []);
    const stations = this.factory.connections
      .filter((edge) => edge.kind === 'worker' && edge.from === hub.id)
      .map((edge) => this.componentMap.get(edge.to)?.name)
      .filter(Boolean);
    return {
      id: hub.id,
      name: hub.name,
      employees: hub.employees,
      busyWorkers: hub.busyWorkers,
      availableWorkers: Math.max(0, hub.employees - hub.busyWorkers),
      unavailableWorkers: hub.onBreak ? hub.employees : 0,
      utilization: round(utilization, 1),
      busyHours: round(hub.busyEmployeeSeconds / 3600, 2),
      availableHours: round(hub.availableEmployeeSeconds / 3600, 2),
      assignments: stations.length,
      assignedWorkstations: stations.join(', '),
      state: hub.state,
    };
  }

  metrics() {
    const nodes = [...this.nodes.values()];
    const workstations = nodes.filter((node) => node.type === 'workstation');
    const processNodes = nodes.filter((node) => node.type !== 'output' && node.type !== 'source');
    const good = this.total.good;
    const rejected = this.total.rejected;
    const wip = [...this.products.values()].filter((product) => !['done', 'rejected'].includes(product.state)).length;
    const hours = Math.max(this.elapsed / 3600, 1 / 3600);
    const throughput = good / hours;
    const utilizationValues = processNodes.filter((node) => node.scheduledTime > 0 || node.type === 'conveyor');
    const utilization = utilizationValues.length
      ? utilizationValues.reduce((sum, node) => sum + (node.type === 'conveyor'
        ? clamp((node.busyTime / Math.max(1, this.elapsed)) * 100, 0, 100)
        : clamp((node.busyTime / Math.max(1, node.scheduledTime)) * 100, 0, 100)), 0) / utilizationValues.length
      : 0;
    const availabilityBase = workstations.length ? workstations : processNodes;
    const availability = availabilityBase.length
      ? availabilityBase.reduce((sum, node) => {
        const scheduled = Math.max(1, node.scheduledTime || this.elapsed);
        return sum + clamp(100 - (node.downTime / scheduled) * 100, 0, 100);
      }, 0) / availabilityBase.length
      : 0;
    const performanceBase = workstations.length
      ? workstations.reduce((sum, node) => {
        const scheduled = Math.max(1, node.scheduledTime || this.elapsed);
        const ideal = Math.max(0.2, n(node.props.cycleTime, 20));
        const processed = node.processed;
        return sum + clamp((ideal * processed) / scheduled * 100, 0, 100);
      }, 0) / workstations.length
      : 0;
    const quality = good + rejected > 0 ? (good / (good + rejected)) * 100 : 0;
    const oee = (availability / 100) * (performanceBase / 100) * (quality / 100) * 100;
    const busyWorker = [...this.hubs.values()].reduce((sum, hub) => sum + hub.busyEmployeeSeconds, 0);
    const availableWorker = [...this.hubs.values()].reduce((sum, hub) => sum + hub.availableEmployeeSeconds, 0);
    const workerUtilization = availableWorker > 0 ? clamp((busyWorker / availableWorker) * 100, 0, 100) : 0;
    const bottleneckNode = workstations
      .slice()
      .sort((a, b) => {
        const utilA = a.scheduledTime ? a.busyTime / a.scheduledTime : 0;
        const utilB = b.scheduledTime ? b.busyTime / b.scheduledTime : 0;
        return utilB - utilA || b.queue.length - a.queue.length;
      })[0];
    const energyKwh = nodes.reduce((sum, node) => sum + node.energyKwh, 0);
    const avgCycleTime = this.total.cycleCount ? this.total.cycleTimeSum / this.total.cycleCount : 0;
    const avgWaitingTime = this.total.waitingCount ? this.total.waitingTimeSum / this.total.waitingCount : 0;

    const stationResults = nodes
      .filter((node) => node.type !== 'source' || node.generated > 0)
      .map((node) => this._nodeMetrics(node));
    const workerResults = [...this.hubs.values()].map((hub) => this._workerMetrics(hub));

    const notes = [...new Set(this.notes)].slice(-8);
    if (!this.options.stochastic) notes.push('Stochastic defects, faults and tool damage are disabled for this run.');
    if (workerResults.some((hub) => hub.employees === 0)) notes.push('A worker hub has no employees; connected stations may wait.');
    if (workstations.some((node) => node.props.humanRequired && !(this.hubsForStation.get(node.id) || []).length)) {
      notes.push('At least one human-required station has no worker hub; it runs without a worker constraint.');
    }
    if (rejected > 0) notes.push(`${rejected} product(s) rejected by inspection or final quality.`);
    if (this.total.escapedDefects > 0) notes.push(`${this.total.escapedDefects} defective product(s) escaped inspection and were counted as rejected output.`);

    return {
      ok: true,
      live: true,
      source: 'live',
      engine: 'JS live DES',
      seed: this.options.seed,
      elapsed: round(this.elapsed, 2),
      durationSeconds: this.options.durationSeconds,
      hours: round(hours, 3),
      input: this.total.input,
      good,
      rejected,
      escapedDefects: this.total.escapedDefects,
      wip,
      finalWip: wip,
      throughputPerHour: round(throughput, 1),
      utilization: round(utilization, 1),
      workerUtilization: round(workerUtilization, 1),
      avgCycleTime: round(avgCycleTime, 1),
      avgWaitingTime: round(avgWaitingTime, 1),
      energyKwh: round(energyKwh, 3),
      downtimeHours: round(nodes.reduce((sum, node) => sum + node.downTime, 0) / 3600, 2),
      bottleneck: bottleneckNode ? bottleneckNode.name : '—',
      availability: round(availability, 1),
      performance: round(performanceBase, 1),
      quality: round(quality, 1),
      oee: round(oee, 1),
      initialStock: this.initialStock,
      massBalance: round(this.total.input + this.initialStock - good - rejected - wip, 2),
      stochastic: this.options.stochastic,
      connectionCount: this.factory.connections.length,
      materialConnectionCount: this.factory.connections.filter((edge) => (edge.kind || 'material') === 'material').length,
      stations: stationResults,
      workers: workerResults,
      hourly: this.hourly.map((bucket) => ({ ...bucket })),
      notes,
      assumptions: [
        'Availability is actual scheduled time minus recorded downtime.',
        'Performance uses the configured ideal cycle time and actual processed pieces; it does not assume a speed factor.',
        'Quality is good output divided by good plus rejected output.',
        'OEE is displayed only as a calculated value from the three factors above.',
      ],
      metricTypes: {
        input: 'actual',
        good: 'actual',
        rejected: 'actual',
        throughputPerHour: 'calculated',
        utilization: 'calculated',
        workerUtilization: 'calculated',
        oee: 'calculated',
        energyKwh: 'calculated',
        avgCycleTime: 'actual',
        avgWaitingTime: 'actual',
        downtimeHours: 'actual',
      },
    };
  }

  snapshot() {
    const metrics = this.metrics();
    const products = [...this.products.values()].map((product) => ({
      id: product.id,
      type: product.type,
      state: product.state,
      defective: product.defective,
      rejected: product.rejected,
      age: round(this.elapsed - product.createdAt, 2),
      location: product.location ? { ...product.location } : null,
    }));
    const stations = [...this.nodes.values()]
      .filter((node) => node.type === 'workstation')
      .map((node) => ({
        id: node.id,
        name: stationLabel(node),
        state: node.state,
        workerState: node.state === 'down' || node.state === 'off-shift'
          ? 'unavailable'
          : node.state === 'processing'
            ? 'working'
            : 'available',
        workers: Math.max(0, Math.round(n(node.props.workers))),
        activeWorkers: node.activeWorkers,
        queueLength: node.queue.length,
        processing: node.slots.filter((slot) => slot?.state === 'processing').length,
        capacity: node.processingCapacity,
        processed: node.processed,
        rejected: node.rejected,
        accepted: node.accepted,
      }));
    return {
      elapsed: round(this.elapsed, 3),
      operationSeq: this.operationSeq,
      finished: this.finished,
      lastOperation: this.lastOperation,
      products,
      stations,
      hubs: [...this.hubs.values()].map((hub) => ({
        id: hub.id,
        state: hub.state,
        busyWorkers: hub.busyWorkers,
        employees: hub.employees,
      })),
      metrics,
    };
  }
}

export { TICK };
