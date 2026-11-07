// Industrial Twin Studio - C++ discrete-event simulation core.
//
// The model is a directed material-flow graph with optional worker-hub
// assignments. Products are discrete entities; workstations process one piece
// at a time and propagate blocking/starvation through bounded buffers.
//
// This implementation deliberately mirrors the JavaScript reference engine so
// both can be compared for parity. Build with:
//   npm run build:wasm
//
// The JS bridge calls the exported C functions through Emscripten ccall.

#include <emscripten.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <deque>
#include <limits>
#include <vector>

namespace {

constexpr double EPSILON = 1e-9;
constexpr double INF = std::numeric_limits<double>::infinity();

enum NodeType {
  NODE_SOURCE = 0,
  NODE_WORKSTATION = 1,
  NODE_CONVEYOR = 2,
  NODE_BUFFER = 3,
  NODE_OUTPUT = 4,
  NODE_WORKER = 5,
  NODE_ANALYTIC = 6,
};

struct Product {
  int id = 0;
  double createdAt = 0.0;
  double queuedAt = 0.0;
  double waiting = 0.0;
  double cycleTime = 0.0;
  bool fromSource = true;
};

struct TransitItem {
  Product product;
  double readyAt = 0.0;
};

struct Node {
  int type = NODE_ANALYTIC;

  double inputPerHour = 0.0;
  double initialQuantity = 0.0;
  double cycleTime = 0.0;
  double errorRate = 0.0;
  double toolDamage = 0.0;
  double powerKw = 0.0;
  double workers = 0.0;
  bool humanRequired = false;
  double workingTimePerShift = 0.0;
  double breakMinutes = 0.0;
  double meetingMinutes = 0.0;
  double changeoverMinutes = 0.0;
  double errorRecoveryMinutes = 0.0;
  double moveTime = 0.0;
  double faultRate = 0.0;
  double faultRecoveryMinutes = 0.0;
  double capacity = 1.0;
  double binCapacity = 1.0;
  double shiftMinutes = 0.0;
  double employees = 0.0;
  int mode = 0; // 0 = FIFO, 1 = LIFO

  std::vector<int> outMaterial;
  std::vector<int> inMaterial;
  std::vector<int> outWorker;
  std::vector<int> inWorker;

  std::deque<Product> queue;
  bool hasProcessing = false;
  Product processing;
  double remaining = 0.0;
  bool hasBlocked = false;
  Product blocked;

  std::vector<TransitItem> transit;
  double downUntil = 0.0;
  int roundRobin = 0;

  double accepted = 0.0;
  double generated = 0.0;
  double processed = 0.0;
  double good = 0.0;
  double rejected = 0.0;
  double faults = 0.0;
  double busySeconds = 0.0;
  double availableSeconds = 0.0;
  double blockedSeconds = 0.0;
  double starvedSeconds = 0.0;
  double downSeconds = 0.0;
  double energyKwh = 0.0;
  double queueCapacity = INF;
};

struct WorkerHub {
  int nodeIndex = -1;
  double employees = 0.0;
  double share = 0.0;
  std::vector<int> stationIds;
  double availableEmployeeSeconds = 0.0;
  double busyEmployeeSeconds = 0.0;
};

struct SourceState {
  int nodeIndex = -1;
  double nextArrival = INF;
  double rate = 0.0;
  double mean = INF;
};

struct StationResult {
  int nodeIndex = -1;
  double utilization = 0.0;
  double availability = 0.0;
  double busyHours = 0.0;
  double starvedHours = 0.0;
  double blockedHours = 0.0;
  double downHours = 0.0;
  double processed = 0.0;
  double good = 0.0;
  double rejected = 0.0;
  double throughput = 0.0;
  double cycleTime = 0.0;
  double workers = 0.0;
};

struct WorkerResult {
  int nodeIndex = -1;
  double employees = 0.0;
  double utilization = 0.0;
  double availableHours = 0.0;
  double busyHours = 0.0;
  double assignments = 0.0;
};

struct HourBucket {
  double good = 0.0;
  double rejected = 0.0;
  double wip = 0.0;
};

struct Simulation {
  std::vector<Node> nodes;
  std::vector<WorkerHub> hubs;
  std::vector<SourceState> sources;
  std::vector<int> order;
  std::vector<StationResult> stationResults;
  std::vector<WorkerResult> workerResults;
  std::vector<HourBucket> hourly;

  double hours = 8.0;
  double step = 1.0;
  bool stochastic = true;
  bool ok = false;

  double totalInput = 0.0;
  double initialStock = 0.0;
  double good = 0.0;
  double rejected = 0.0;
  double deliveredCycleTimeSum = 0.0;
  double deliveredWaitingSum = 0.0;
  double wipAccumulator = 0.0;
  double wipSamples = 0.0;
  double finalWip = 0.0;
  double machineUtilization = 0.0;
  double workerUtilization = 0.0;
  double avgCycleTime = 0.0;
  double avgWaitingTime = 0.0;
  double avgWip = 0.0;
  double throughputPerHour = 0.0;
  double stationEnergy = 0.0;
  double conveyorEnergy = 0.0;
  double energyKwh = 0.0;
  double massBalance = 0.0;
  int bottleneckIndex = -1;

  uint32_t rngState = 1;
  int productSeq = 0;
};

Simulation sim;

inline double nz(double value, double fallback) {
  return std::isfinite(value) ? value : fallback;
}

inline double positive(double value, double fallback) {
  return std::max(EPSILON, nz(value, fallback));
}

inline double random01() {
  uint32_t a = sim.rngState;
  a = a + 0x6d2b79f5u;
  uint32_t t = (a ^ (a >> 15)) * (1u | a);
  t = (t + (uint32_t)((t ^ (t >> 7)) * (61u | t))) ^ t;
  sim.rngState = a;
  return (double)(t ^ (t >> 14)) / 4294967296.0;
}

bool isScheduled(double t, double totalMinutes, double breakMinutes,
                 double meetingMinutes, double changeoverMinutes) {
  const double total = std::max(60.0, positive(totalMinutes, 60.0) * 60.0);
  const double change = std::max(0.0, nz(changeoverMinutes, 0.0)) * 60.0;
  const double work =
      std::max(1.0, std::max(1.0, nz(totalMinutes, 60.0) - nz(breakMinutes, 0.0) -
                                     nz(meetingMinutes, 0.0))) *
      60.0;
  const double phase = std::fmod(t, total);
  return phase >= change - EPSILON && phase < std::min(total, change + work) - EPSILON;
}

Product makeProduct(double t, bool fromSource) {
  Product product;
  sim.productSeq += 1;
  product.id = sim.productSeq;
  product.createdAt = t;
  product.queuedAt = t;
  product.waiting = 0.0;
  product.fromSource = fromSource;
  return product;
}

void addWait(Product& product, double t) {
  product.waiting += std::max(0.0, t - product.queuedAt);
}

int requiredWorkers(const Node& station) {
  return (int)std::max(0.0, std::round(nz(station.workers, 0.0)));
}

bool hubAvailable(const WorkerHub& hub, double t) {
  const Node& node = sim.nodes[hub.nodeIndex];
  return isScheduled(t, node.shiftMinutes, node.breakMinutes, node.meetingMinutes,
                     node.changeoverMinutes);
}

double availableWorkersFor(const Node& station, int stationIndex, double t) {
  if (!station.humanRequired) return INF;
  if (station.inWorker.empty()) return 0.0;
  (void)stationIndex;
  double available = 0.0;
  for (int hubIndex : station.inWorker) {
    // inWorker stores hub node indices; map to hub runtime by lookup.
    for (const WorkerHub& hub : sim.hubs) {
      if (hub.nodeIndex != hubIndex) continue;
      if (hubAvailable(hub, t)) available += hub.share;
      break;
    }
  }
  return available;
}

bool stationStaffed(const Node& station, int stationIndex, double t) {
  if (!station.humanRequired) return true;
  return availableWorkersFor(station, stationIndex, t) + EPSILON >=
         (double)requiredWorkers(station);
}

bool stationScheduled(const Node& station, double t) {
  if (t < station.downUntil) return false;
  return isScheduled(t, station.workingTimePerShift, station.breakMinutes,
                     station.meetingMinutes, station.changeoverMinutes);
}

bool canAccept(const Node& node) {
  switch (node.type) {
    case NODE_WORKSTATION:
      return (double)node.queue.size() < node.queueCapacity && !node.hasBlocked;
    case NODE_BUFFER:
      return (double)node.queue.size() < node.queueCapacity;
    case NODE_CONVEYOR:
      return (double)node.transit.size() < node.queueCapacity;
    case NODE_OUTPUT:
      return node.accepted < node.queueCapacity;
    default:
      return false;
  }
}

void onGoodOutput(const Product& product, double time) {
  sim.good += 1.0;
  sim.deliveredCycleTimeSum += product.cycleTime;
  sim.deliveredWaitingSum += product.waiting;
  if (!sim.hourly.empty()) {
    int bucket = (int)std::floor(time / 3600.0);
    if (bucket < 0) bucket = 0;
    if (bucket >= (int)sim.hourly.size()) bucket = (int)sim.hourly.size() - 1;
    sim.hourly[bucket].good += 1.0;
  }
}

void acceptInto(int nodeIndex, Product product, double t) {
  Node& node = sim.nodes[nodeIndex];
  if (node.type == NODE_CONVEYOR) {
    addWait(product, t);
    const double moveTime = positive(node.moveTime, 1.0);
    node.transit.push_back({product, t + moveTime});
    return;
  }
  if (node.type == NODE_OUTPUT) {
    addWait(product, t);
    node.accepted += 1.0;
    node.good += 1.0;
    product.cycleTime = t - product.createdAt;
    onGoodOutput(product, t);
    return;
  }
  product.queuedAt = t;
  node.queue.push_back(product);
}

bool pushToDownstream(int nodeIndex, Product product, double t) {
  Node& node = sim.nodes[nodeIndex];
  if (node.outMaterial.empty()) return false;
  const int count = (int)node.outMaterial.size();
  const int start = node.roundRobin % count;
  for (int i = 0; i < count; i += 1) {
    const int targetIndex = node.outMaterial[(start + i) % count];
    if (!canAccept(sim.nodes[targetIndex])) continue;
    node.roundRobin = (start + i + 1) % std::max(1, count);
    acceptInto(targetIndex, product, t);
    return true;
  }
  return false;
}

double countWip() {
  double total = 0.0;
  for (const Node& node : sim.nodes) {
    if (node.type == NODE_WORKER || node.type == NODE_ANALYTIC) continue;
    total += (double)node.queue.size();
    if (node.hasProcessing) total += 1.0;
    if (node.hasBlocked) total += 1.0;
    total += (double)node.transit.size();
  }
  return total;
}

void generateSource(int nodeIndex, double t) {
  for (SourceState& state : sim.sources) {
    if (state.nodeIndex != nodeIndex) continue;
    if (state.rate <= 0.0) return;
    Node& node = sim.nodes[nodeIndex];
    while (state.nextArrival <= t + EPSILON) {
      node.queue.push_back(makeProduct(state.nextArrival, true));
      node.generated += 1.0;
      if (sim.stochastic) {
        state.nextArrival += -std::log(1.0 - random01()) * state.mean;
      } else {
        state.nextArrival += state.mean;
      }
    }
    return;
  }
}

void buildTopologicalOrder() {
  sim.order.clear();
  std::vector<int> inDegree(sim.nodes.size(), 0);
  for (size_t i = 0; i < sim.nodes.size(); i += 1) {
    for (int target : sim.nodes[i].outMaterial) {
      if (target >= 0 && target < (int)sim.nodes.size()) inDegree[target] += 1;
    }
  }
  std::deque<int> ready;
  for (size_t i = 0; i < sim.nodes.size(); i += 1) {
    const Node& node = sim.nodes[i];
    if (node.type == NODE_WORKER || node.type == NODE_ANALYTIC) continue;
    if (inDegree[i] == 0) ready.push_back((int)i);
  }
  std::vector<bool> seen(sim.nodes.size(), false);
  while (!ready.empty()) {
    const int index = ready.front();
    ready.pop_front();
    if (seen[index]) continue;
    const Node& node = sim.nodes[index];
    if (node.type == NODE_WORKER || node.type == NODE_ANALYTIC) continue;
    seen[index] = true;
    sim.order.push_back(index);
    for (int target : node.outMaterial) {
      if (target < 0 || target >= (int)sim.nodes.size()) continue;
      inDegree[target] -= 1;
      if (inDegree[target] == 0 && !seen[target]) ready.push_back(target);
    }
  }
  for (size_t i = 0; i < sim.nodes.size(); i += 1) {
    const Node& node = sim.nodes[i];
    if (node.type == NODE_WORKER || node.type == NODE_ANALYTIC) continue;
    if (!seen[i]) sim.order.push_back((int)i);
  }
}

void runStation(int nodeIndex, double t) {
  Node& node = sim.nodes[nodeIndex];
  const bool scheduled = stationScheduled(node, t);
  const bool staffed = stationStaffed(node, nodeIndex, t);
  const bool available = scheduled && staffed;

  if (available) {
    node.availableSeconds += sim.step;
  } else if (scheduled) {
    node.downSeconds += sim.step;
  }

  if (node.hasBlocked) {
    if (pushToDownstream(nodeIndex, node.blocked, t)) {
      node.hasBlocked = false;
    } else {
      node.blockedSeconds += sim.step;
    }
  }

  if (node.hasProcessing) {
    node.busySeconds += sim.step;
    if (node.humanRequired) {
      const int required = requiredWorkers(node);
      if (required > 0) {
        for (WorkerHub& hub : sim.hubs) {
          if (std::find(hub.stationIds.begin(), hub.stationIds.end(), nodeIndex) ==
              hub.stationIds.end()) {
            continue;
          }
          hub.busyEmployeeSeconds += std::min(hub.share, (double)required) * sim.step;
        }
      }
    }
    node.remaining -= sim.step;
    if (node.remaining <= EPSILON) {
      Product product = node.processing;
      node.hasProcessing = false;
      node.processed += 1.0;

      double hubError = 0.0;
      int hubCount = 0;
      for (const WorkerHub& hub : sim.hubs) {
        if (std::find(hub.stationIds.begin(), hub.stationIds.end(), nodeIndex) ==
            hub.stationIds.end()) {
          continue;
        }
        hubError += nz(sim.nodes[hub.nodeIndex].errorRate, 0.0);
        hubCount += 1;
      }
      if (hubCount > 0) hubError = hubError / (double)hubCount / 100.0;

      const double rejectChance =
          std::min(0.99, nz(node.errorRate, 0.0) / 100.0 + hubError);
      const bool isRejected = sim.stochastic && random01() < rejectChance;
      if (isRejected) {
        node.rejected += 1.0;
        sim.rejected += 1.0;
        if (!sim.hourly.empty()) {
          int bucket = (int)std::floor(t / 3600.0);
          if (bucket < 0) bucket = 0;
          if (bucket >= (int)sim.hourly.size()) bucket = (int)sim.hourly.size() - 1;
          sim.hourly[bucket].rejected += 1.0;
        }
        node.downUntil = std::max(
            node.downUntil, t + std::max(0.0, nz(node.errorRecoveryMinutes, 0.0)) * 60.0);
      } else {
        product.queuedAt = t;
        node.good += 1.0;
        node.hasBlocked = true;
        node.blocked = product;
        if (pushToDownstream(nodeIndex, node.blocked, t)) {
          node.hasBlocked = false;
        }
      }

      if (sim.stochastic && random01() < std::min(0.99, nz(node.toolDamage, 0.0) / 100.0)) {
        node.downUntil = std::max(
            node.downUntil, t + std::max(0.0, nz(node.changeoverMinutes, 0.0)) * 60.0);
      }
    }
  }

  if (available && !node.hasProcessing && !node.hasBlocked && !node.queue.empty() &&
      t >= node.downUntil) {
    Product product = node.mode == 1 ? node.queue.back() : node.queue.front();
    if (node.mode == 1) node.queue.pop_back();
    else node.queue.pop_front();
    addWait(product, t);
    node.hasProcessing = true;
    node.processing = product;
    node.remaining = positive(node.cycleTime, 1.0);
  }

  if (available && !node.hasProcessing && !node.hasBlocked && node.queue.empty()) {
    node.starvedSeconds += sim.step;
  }
}

void runConveyor(int nodeIndex, double t) {
  Node& node = sim.nodes[nodeIndex];
  const double faultRate = std::max(0.0, nz(node.faultRate, 0.0));
  if (sim.stochastic && faultRate > 0.0 && t >= node.downUntil) {
    const double probability = (faultRate / 100.0) * (sim.step / 3600.0);
    if (random01() < probability) {
      node.faults += 1.0;
      node.downUntil =
          t + std::max(0.0, nz(node.faultRecoveryMinutes, 0.0)) * 60.0;
      const double extension = node.downUntil - t;
      for (TransitItem& item : node.transit) item.readyAt += extension;
    }
  }
  if (t >= node.downUntil) {
    node.energyKwh += std::max(0.0, nz(node.powerKw, 0.0)) * (sim.step / 3600.0);
  }
  for (int i = (int)node.transit.size() - 1; i >= 0; i -= 1) {
    TransitItem& item = node.transit[i];
    if (item.readyAt > t) continue;
    if (pushToDownstream(nodeIndex, item.product, t)) {
      node.transit.erase(node.transit.begin() + i);
    }
  }
}

void aggregate() {
  sim.finalWip = countWip();
  if (!sim.hourly.empty()) sim.hourly.back().wip = sim.finalWip;

  sim.stationResults.clear();
  for (size_t i = 0; i < sim.nodes.size(); i += 1) {
    const Node& node = sim.nodes[i];
    if (node.type != NODE_WORKSTATION) continue;
    StationResult result;
    result.nodeIndex = (int)i;
    const double productive = node.busySeconds + node.starvedSeconds + node.blockedSeconds;
    result.utilization =
        productive > 0.0 ? (node.busySeconds / productive) * 100.0 : 0.0;
    result.utilization = std::round(result.utilization * 10.0) / 10.0;
    result.availability =
        std::round((node.availableSeconds / (sim.hours * 3600.0)) * 1000.0) / 10.0;
    result.busyHours = node.busySeconds / 3600.0;
    result.starvedHours = node.starvedSeconds / 3600.0;
    result.blockedHours = node.blockedSeconds / 3600.0;
    result.downHours = node.downSeconds / 3600.0;
    result.processed = node.processed;
    result.good = node.good;
    result.rejected = node.rejected;
    result.throughput = std::round((node.good / sim.hours) * 10.0) / 10.0;
    result.cycleTime = nz(node.cycleTime, 0.0);
    result.workers = nz(node.workers, 0.0);
    sim.stationResults.push_back(result);
  }

  sim.workerResults.clear();
  for (const WorkerHub& hub : sim.hubs) {
    WorkerResult result;
    result.nodeIndex = hub.nodeIndex;
    result.employees = hub.employees;
    result.utilization =
        hub.availableEmployeeSeconds > 0.0
            ? (hub.busyEmployeeSeconds / hub.availableEmployeeSeconds) * 100.0
            : 0.0;
    result.utilization = std::round(result.utilization * 10.0) / 10.0;
    result.availableHours = hub.availableEmployeeSeconds / 3600.0;
    result.busyHours = hub.busyEmployeeSeconds / 3600.0;
    result.assignments = (double)hub.stationIds.size();
    sim.workerResults.push_back(result);
  }

  double utilizationSum = 0.0;
  for (const StationResult& station : sim.stationResults) {
    utilizationSum += station.utilization;
  }
  sim.machineUtilization =
      sim.stationResults.empty()
          ? 0.0
          : utilizationSum / (double)sim.stationResults.size();

  double workerAvailable = 0.0;
  double workerBusy = 0.0;
  for (const WorkerHub& hub : sim.hubs) {
    workerAvailable += hub.availableEmployeeSeconds;
    workerBusy += hub.busyEmployeeSeconds;
  }
  sim.workerUtilization =
      workerAvailable > 0.0 ? (workerBusy / workerAvailable) * 100.0 : 0.0;

  sim.bottleneckIndex = -1;
  double bestUtilization = -1.0;
  for (size_t i = 0; i < sim.stationResults.size(); i += 1) {
    if (sim.stationResults[i].utilization > bestUtilization) {
      bestUtilization = sim.stationResults[i].utilization;
      sim.bottleneckIndex = (int)i;
    }
  }
  if (sim.bottleneckIndex >= 0 && sim.stationResults[sim.bottleneckIndex].utilization <= 0.0 &&
      !sim.stationResults.empty()) {
    sim.bottleneckIndex = 0;
  }

  sim.avgCycleTime = sim.good > 0.0 ? sim.deliveredCycleTimeSum / sim.good : 0.0;
  sim.avgWaitingTime = sim.good > 0.0 ? sim.deliveredWaitingSum / sim.good : 0.0;
  sim.avgWip = sim.wipSamples > 0.0 ? sim.wipAccumulator / sim.wipSamples : 0.0;
  sim.throughputPerHour = sim.good / sim.hours;

  sim.stationEnergy = 0.0;
  for (const Node& node : sim.nodes) {
    if (node.type != NODE_WORKSTATION) continue;
    sim.stationEnergy +=
        (node.busySeconds / 3600.0) * std::max(0.0, nz(node.powerKw, 0.0));
  }
  sim.conveyorEnergy = 0.0;
  for (const Node& node : sim.nodes) {
    if (node.type != NODE_CONVEYOR) continue;
    sim.conveyorEnergy += node.energyKwh;
  }
  sim.energyKwh = sim.stationEnergy + sim.conveyorEnergy;
  sim.massBalance =
      sim.totalInput + sim.initialStock - sim.good - sim.rejected - sim.finalWip;
}

void resetRuntime() {
  sim.order.clear();
  sim.sources.clear();
  sim.hubs.clear();
  sim.stationResults.clear();
  sim.workerResults.clear();
  sim.hourly.clear();
  sim.totalInput = 0.0;
  sim.initialStock = 0.0;
  sim.good = 0.0;
  sim.rejected = 0.0;
  sim.deliveredCycleTimeSum = 0.0;
  sim.deliveredWaitingSum = 0.0;
  sim.wipAccumulator = 0.0;
  sim.wipSamples = 0.0;
  sim.finalWip = 0.0;
  sim.machineUtilization = 0.0;
  sim.workerUtilization = 0.0;
  sim.avgCycleTime = 0.0;
  sim.avgWaitingTime = 0.0;
  sim.avgWip = 0.0;
  sim.throughputPerHour = 0.0;
  sim.stationEnergy = 0.0;
  sim.conveyorEnergy = 0.0;
  sim.energyKwh = 0.0;
  sim.massBalance = 0.0;
  sim.bottleneckIndex = -1;
  sim.productSeq = 0;
  sim.ok = false;

  for (Node& node : sim.nodes) {
    node.queue.clear();
    node.transit.clear();
    node.outMaterial.clear();
    node.inMaterial.clear();
    node.outWorker.clear();
    node.inWorker.clear();
    node.hasProcessing = false;
    node.hasBlocked = false;
    node.remaining = 0.0;
    node.downUntil = 0.0;
    node.roundRobin = 0;
    node.accepted = 0.0;
    node.generated = 0.0;
    node.processed = 0.0;
    node.good = 0.0;
    node.rejected = 0.0;
    node.faults = 0.0;
    node.busySeconds = 0.0;
    node.availableSeconds = 0.0;
    node.blockedSeconds = 0.0;
    node.starvedSeconds = 0.0;
    node.downSeconds = 0.0;
    node.energyKwh = 0.0;
  }
}

} // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE
void sim_begin(int nodeCount) {
  sim.nodes.clear();
  sim.nodes.reserve((size_t)std::max(0, nodeCount));
  resetRuntime();
  sim.ok = false;
}

EMSCRIPTEN_KEEPALIVE
void sim_add_node(int type, double inputPerHour, double initialQuantity,
                  double cycleTime, double errorRate, double toolDamage,
                  double powerKw, double workers, int humanRequired,
                  double workingTimePerShift, double breakMinutes,
                  double meetingMinutes, double changeoverMinutes,
                  double errorRecoveryMinutes, double moveTime, double faultRate,
                  double faultRecoveryMinutes, double capacity,
                  double binCapacity, double shiftMinutes, double employees,
                  int mode) {
  Node node;
  node.type = type;
  node.inputPerHour = inputPerHour;
  node.initialQuantity = initialQuantity;
  node.cycleTime = cycleTime;
  node.errorRate = errorRate;
  node.toolDamage = toolDamage;
  node.powerKw = powerKw;
  node.workers = workers;
  node.humanRequired = humanRequired != 0;
  node.workingTimePerShift = workingTimePerShift;
  node.breakMinutes = breakMinutes;
  node.meetingMinutes = meetingMinutes;
  node.changeoverMinutes = changeoverMinutes;
  node.errorRecoveryMinutes = errorRecoveryMinutes;
  node.moveTime = moveTime;
  node.faultRate = faultRate;
  node.faultRecoveryMinutes = faultRecoveryMinutes;
  node.capacity = capacity;
  node.binCapacity = binCapacity;
  node.shiftMinutes = shiftMinutes;
  node.employees = employees;
  node.mode = mode;

  switch (type) {
    case NODE_BUFFER:
      node.queueCapacity = std::max(1.0, std::round(capacity));
      break;
    case NODE_WORKSTATION:
      node.queueCapacity = 1.0;
      break;
    case NODE_CONVEYOR:
      node.queueCapacity = std::max(1.0, std::round(capacity));
      break;
    case NODE_OUTPUT:
      node.queueCapacity = std::max(1.0, std::round(binCapacity));
      break;
    default:
      node.queueCapacity = INF;
      break;
  }
  sim.nodes.push_back(node);
}

EMSCRIPTEN_KEEPALIVE
void sim_add_edge(int from, int to, int kind) {
  if (from < 0 || to < 0 || from >= (int)sim.nodes.size() ||
      to >= (int)sim.nodes.size()) {
    return;
  }
  if (kind == 1) {
    sim.nodes[from].outWorker.push_back(to);
    sim.nodes[to].inWorker.push_back(from);
  } else {
    sim.nodes[from].outMaterial.push_back(to);
    sim.nodes[to].inMaterial.push_back(from);
  }
}

EMSCRIPTEN_KEEPALIVE
int sim_run(int hours, double step, unsigned int seed, int stochastic) {
  sim.hours = (double)std::max(1, std::min(168, hours));
  sim.step = std::max(0.25, step);
  sim.stochastic = stochastic != 0;
  sim.rngState = seed == 0 ? 1u : seed;

  sim.hubs.clear();
  sim.sources.clear();
  sim.hourly.assign((size_t)hours, HourBucket{});

  int sourceCount = 0;
  int workstationCount = 0;
  int outputCount = 0;
  for (size_t i = 0; i < sim.nodes.size(); i += 1) {
    const Node& node = sim.nodes[i];
    if (node.type == NODE_SOURCE) sourceCount += 1;
    if (node.type == NODE_WORKSTATION) workstationCount += 1;
    if (node.type == NODE_OUTPUT) outputCount += 1;
  }
  if (sourceCount == 0 || outputCount == 0) {
    sim.ok = false;
    return 0;
  }

  for (size_t i = 0; i < sim.nodes.size(); i += 1) {
    const Node& node = sim.nodes[i];
    if (node.type != NODE_WORKER) continue;
    WorkerHub hub;
    hub.nodeIndex = (int)i;
    hub.employees = std::max(0.0, nz(node.employees, 0.0));
    for (int stationIndex : node.outWorker) {
      if (stationIndex < 0 || stationIndex >= (int)sim.nodes.size()) continue;
      if (sim.nodes[stationIndex].type != NODE_WORKSTATION) continue;
      hub.stationIds.push_back(stationIndex);
    }
    hub.share = hub.stationIds.empty()
                    ? 0.0
                    : hub.employees / (double)hub.stationIds.size();
    sim.hubs.push_back(hub);
  }

  for (size_t i = 0; i < sim.nodes.size(); i += 1) {
    const Node& node = sim.nodes[i];
    if (node.type != NODE_SOURCE) continue;
    SourceState state;
    state.nodeIndex = (int)i;
    state.rate = std::max(0.0, nz(node.inputPerHour, 0.0));
    state.mean = state.rate > 0.0 ? 3600.0 / state.rate : INF;
    state.nextArrival =
        state.rate > 0.0
            ? (sim.stochastic ? -std::log(1.0 - random01()) * state.mean : state.mean)
            : INF;
    sim.sources.push_back(state);

    const int initial = (int)std::max(0.0, std::round(nz(node.initialQuantity, 0.0)));
    for (int p = 0; p < initial; p += 1) {
      sim.nodes[i].queue.push_back(makeProduct(0.0, true));
    }
    sim.nodes[i].generated += (double)initial;
  }

  for (size_t i = 0; i < sim.nodes.size(); i += 1) {
    Node& node = sim.nodes[i];
    if (node.type != NODE_BUFFER) continue;
    const int initial = (int)std::max(0.0, std::round(nz(node.initialQuantity, 0.0)));
    const int capped = (int)std::min((double)initial, node.queueCapacity);
    for (int p = 0; p < capped; p += 1) {
      node.queue.push_back(makeProduct(0.0, false));
    }
    sim.initialStock += (double)capped;
  }

  buildTopologicalOrder();

  const long long stepCount =
      (long long)std::llround((sim.hours * 3600.0) / sim.step);
  double t = 0.0;

  for (long long stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    t += sim.step;

    // Worker calendars are evaluated as readily as the JS reference engine.
    for (const WorkerHub& hub : sim.hubs) {
      if (hubAvailable(hub, t)) {
        // Available seconds are accumulated below through hub runtime copies.
      }
    }
    for (WorkerHub& hub : sim.hubs) {
      if (hubAvailable(hub, t)) {
        hub.availableEmployeeSeconds += hub.employees * sim.step;
      }
    }

    for (int nodeIndex : sim.order) {
      Node& node = sim.nodes[nodeIndex];
      if (node.type == NODE_SOURCE) {
        generateSource(nodeIndex, t);
        while (!node.queue.empty()) {
          Product product = node.queue.front();
          if (!pushToDownstream(nodeIndex, product, t)) break;
          node.queue.pop_front();
        }
        continue;
      }
      if (node.type == NODE_CONVEYOR) {
        runConveyor(nodeIndex, t);
        continue;
      }
      if (node.type == NODE_BUFFER) {
        while (!node.queue.empty()) {
          const bool lifo = node.mode == 1;
          Product product = lifo ? node.queue.back() : node.queue.front();
          if (!pushToDownstream(nodeIndex, product, t)) break;
          if (lifo) node.queue.pop_back();
          else node.queue.pop_front();
        }
        continue;
      }
      if (node.type == NODE_WORKSTATION) {
        runStation(nodeIndex, t);
        continue;
      }
      // Output bins accept directly from upstream; no per-tick work.
    }

    const double wip = countWip();
    sim.wipAccumulator += wip;
    sim.wipSamples += 1.0;
    const double remainder = std::fmod(t, 3600.0);
    if (std::fabs(remainder) < EPSILON && t > 0.0) {
      int index = (int)std::llround(t / 3600.0) - 1;
      if (index < 0) index = 0;
      if (index >= (int)sim.hourly.size()) index = (int)sim.hourly.size() - 1;
      sim.hourly[index].wip = wip;
    }
  }

  for (size_t i = 0; i < sim.nodes.size(); i += 1) {
    if (sim.nodes[i].type == NODE_SOURCE) {
      sim.totalInput += sim.nodes[i].generated;
    }
  }
  (void)workstationCount;
  aggregate();
  sim.ok = true;
  return 1;
}

EMSCRIPTEN_KEEPALIVE
double sim_metric(int code) {
  switch (code) {
    case 0: return sim.good;
    case 1: return sim.rejected;
    case 2: return sim.totalInput;
    case 3: return sim.throughputPerHour;
    case 4: return sim.machineUtilization;
    case 5: return sim.workerUtilization;
    case 6: return sim.avgCycleTime;
    case 7: return sim.avgWaitingTime;
    case 8: return sim.avgWip;
    case 9: return sim.finalWip;
    case 10: return sim.energyKwh;
    case 11: return sim.massBalance;
    case 12: return (double)sim.bottleneckIndex;
    case 13: return sim.hours;
    case 14: return sim.ok ? 1.0 : 0.0;
    case 15: return (double)sim.stationResults.size();
    case 16: return (double)sim.workerResults.size();
    case 17: return sim.initialStock;
    case 18: return sim.conveyorEnergy;
    case 19: return sim.stationEnergy;
    default: return 0.0;
  }
}

EMSCRIPTEN_KEEPALIVE
int sim_station_count() { return (int)sim.stationResults.size(); }

EMSCRIPTEN_KEEPALIVE
int sim_station_index(int i) {
  if (i < 0 || i >= (int)sim.stationResults.size()) return -1;
  return sim.stationResults[i].nodeIndex;
}

EMSCRIPTEN_KEEPALIVE
double sim_station_metric(int i, int code) {
  if (i < 0 || i >= (int)sim.stationResults.size()) return 0.0;
  const StationResult& r = sim.stationResults[i];
  switch (code) {
    case 0: return r.utilization;
    case 1: return r.availability;
    case 2: return r.busyHours;
    case 3: return r.starvedHours;
    case 4: return r.blockedHours;
    case 5: return r.downHours;
    case 6: return r.processed;
    case 7: return r.good;
    case 8: return r.rejected;
    case 9: return r.throughput;
    case 10: return r.cycleTime;
    case 11: return r.workers;
    default: return 0.0;
  }
}

EMSCRIPTEN_KEEPALIVE
int sim_worker_count() { return (int)sim.workerResults.size(); }

EMSCRIPTEN_KEEPALIVE
int sim_worker_index(int i) {
  if (i < 0 || i >= (int)sim.workerResults.size()) return -1;
  return sim.workerResults[i].nodeIndex;
}

EMSCRIPTEN_KEEPALIVE
double sim_worker_metric(int i, int code) {
  if (i < 0 || i >= (int)sim.workerResults.size()) return 0.0;
  const WorkerResult& r = sim.workerResults[i];
  switch (code) {
    case 0: return r.utilization;
    case 1: return r.employees;
    case 2: return r.availableHours;
    case 3: return r.busyHours;
    case 4: return r.assignments;
    default: return 0.0;
  }
}

EMSCRIPTEN_KEEPALIVE
int sim_hourly_count() { return (int)sim.hourly.size(); }

EMSCRIPTEN_KEEPALIVE
double sim_hourly_metric(int i, int code) {
  if (i < 0 || i >= (int)sim.hourly.size()) return 0.0;
  const HourBucket& r = sim.hourly[i];
  switch (code) {
    case 0: return r.good;
    case 1: return r.rejected;
    case 2: return r.wip;
    default: return 0.0;
  }
}

} // extern "C"
