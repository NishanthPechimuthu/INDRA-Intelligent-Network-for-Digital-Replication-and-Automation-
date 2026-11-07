// Component catalogue, default properties and typed property schemas.
// Kept renderer-agnostic so the simulation engine can use the same definitions.

export const COMPONENT_TYPES = [
  { type: 'source', label: 'Source', color: '#3988d8', physical: true, graph: true, ports: { in: false, out: true, workerIn: false, workerOut: false } },
  { type: 'workstation', label: 'Workstation', color: '#8c6be8', physical: true, graph: true, ports: { in: true, out: true, workerIn: true, workerOut: false } },
  { type: 'worker', label: 'Worker hub', color: '#e3a13d', physical: true, graph: false, ports: { in: false, out: false, workerIn: false, workerOut: true } },
  { type: 'conveyor', label: 'Conveyor belt', color: '#687e91', physical: true, graph: true, ports: { in: true, out: true, workerIn: false, workerOut: false } },
  { type: 'buffer', label: 'Buffer station', color: '#17a9a1', physical: true, graph: true, ports: { in: true, out: true, workerIn: false, workerOut: false } },
  { type: 'output', label: 'Output bin', color: '#36b76b', physical: true, graph: true, ports: { in: true, out: false, workerIn: false, workerOut: false } },
  { type: 'chart', label: 'Chart', color: '#5b9bd5', physical: false, graph: false, ports: {} },
  { type: 'display', label: 'Display', color: '#c084fc', physical: false, graph: false, ports: {} },
];

export const TYPE_MAP = Object.fromEntries(COMPONENT_TYPES.map((t) => [t.type, t]));

export const PHYSICAL_TYPES = new Set(COMPONENT_TYPES.filter((t) => t.physical).map((t) => t.type));
export const GRAPH_TYPES = new Set(['source', 'workstation', 'conveyor', 'buffer', 'output']);
export const MATERIAL_SOURCES = new Set(['source', 'workstation', 'conveyor', 'buffer']);
export const MATERIAL_SINKS = new Set(['workstation', 'conveyor', 'buffer', 'output']);
export const ANALYTIC_TYPES = new Set(['chart', 'display']);

export const DEFAULT_PROPS = {
  source: {
    inputPerHour: 180,
    productType: 'Widget A',
    initialQuantity: 0,
  },
  workstation: {
    cycleTime: 20,
    errorRate: 1,
    toolDamage: 2,
    powerKw: 2.5,
    humanRequired: true,
    workers: 2,
    workingTimePerShift: 420,
    breakMinutes: 30,
    meetingMinutes: 10,
    changeoverMinutes: 5,
    errorRecoveryMinutes: 5,
  },
  worker: {
    employees: 4,
    skill: 'Assembly',
    errorRate: 1.5,
    breakMinutes: 30,
    meetingMinutes: 10,
    changeoverMinutes: 5,
    shiftMinutes: 480,
  },
  conveyor: {
    moveTime: 3,
    speed: 1.2,
    faultRate: 1,
    faultRecoveryMinutes: 5,
    powerKw: 0.5,
    capacity: 10,
  },
  buffer: {
    capacity: 30,
    initialQuantity: 0,
    mode: 'FIFO',
  },
  output: {
    binCapacity: 1000,
    productCount: 0,
  },
  chart: { metric: 'throughput' },
  display: { metric: 'bottleneck' },
};

export const PROPERTY_SCHEMAS = {
  source: [
    { key: 'inputPerHour', label: 'Product arrival rate', type: 'number', unit: 'pcs/hr', min: 0, step: 1 },
    { key: 'productType', label: 'Product type', type: 'text' },
    { key: 'initialQuantity', label: 'Initial product quantity', type: 'number', unit: 'pcs', min: 0, step: 1 },
  ],
  workstation: [
    { key: 'cycleTime', label: 'Cycle time per piece', type: 'number', unit: 's', min: 1, step: 1 },
    { key: 'errorRate', label: 'Error / rejection rate', type: 'number', unit: '%', min: 0, max: 100, step: 0.1 },
    { key: 'toolDamage', label: 'Tool damage', type: 'number', unit: '%', min: 0, max: 100, step: 0.1 },
    { key: 'powerKw', label: 'Power consumption', type: 'number', unit: 'kW', min: 0, step: 0.1 },
    { key: 'humanRequired', label: 'Human interaction required', type: 'boolean' },
    { key: 'workers', label: 'Assigned workers', type: 'number', unit: 'people', min: 0, step: 1 },
    { key: 'workingTimePerShift', label: 'Working time per shift', type: 'number', unit: 'min', min: 1, step: 5 },
    { key: 'breakMinutes', label: 'Break duration', type: 'number', unit: 'min', min: 0, step: 1 },
    { key: 'meetingMinutes', label: 'Meeting duration', type: 'number', unit: 'min', min: 0, step: 1 },
    { key: 'changeoverMinutes', label: 'Tool / product / program changeover', type: 'number', unit: 'min', min: 0, step: 1 },
    { key: 'errorRecoveryMinutes', label: 'Error recovery time', type: 'number', unit: 'min', min: 0, step: 1 },
  ],
  worker: [
    { key: 'employees', label: 'Total employees', type: 'number', unit: 'people', min: 0, step: 1 },
    { key: 'skill', label: 'Employee skill / assigned task', type: 'text' },
    { key: 'errorRate', label: 'Worker error rate', type: 'number', unit: '%', min: 0, max: 100, step: 0.1 },
    { key: 'breakMinutes', label: 'Break time', type: 'number', unit: 'min', min: 0, step: 1 },
    { key: 'meetingMinutes', label: 'Meeting time', type: 'number', unit: 'min', min: 0, step: 1 },
    { key: 'changeoverMinutes', label: 'Changeover time', type: 'number', unit: 'min', min: 0, step: 1 },
    { key: 'shiftMinutes', label: 'Available working time per shift', type: 'number', unit: 'min', min: 1, step: 5 },
  ],
  conveyor: [
    { key: 'moveTime', label: 'Transport time per product', type: 'number', unit: 's', min: 0.1, step: 0.1 },
    { key: 'speed', label: 'Conveyor speed', type: 'number', unit: 'm/s', min: 0.01, step: 0.1 },
    { key: 'faultRate', label: 'Fault probability', type: 'number', unit: '%/hr', min: 0, max: 100, step: 0.1 },
    { key: 'faultRecoveryMinutes', label: 'Fault recovery time', type: 'number', unit: 'min', min: 0, step: 1 },
    { key: 'powerKw', label: 'Power consumption', type: 'number', unit: 'kW', min: 0, step: 0.1 },
    { key: 'capacity', label: 'Maximum product capacity', type: 'number', unit: 'pcs', min: 1, step: 1 },
  ],
  buffer: [
    { key: 'capacity', label: 'Maximum storage capacity', type: 'number', unit: 'pcs', min: 1, step: 1 },
    { key: 'initialQuantity', label: 'Initial product quantity', type: 'number', unit: 'pcs', min: 0, step: 1 },
    { key: 'mode', label: 'Buffer configuration', type: 'select', options: ['FIFO', 'LIFO'] },
  ],
  output: [
    { key: 'binCapacity', label: 'Maximum capacity', type: 'number', unit: 'pcs', min: 1, step: 1 },
    { key: 'productCount', label: 'Product count', type: 'number', unit: 'pcs', readOnly: true },
  ],
  chart: [
    { key: 'metric', label: 'Bound metric', type: 'select', options: ['throughput', 'good', 'rejected', 'utilization', 'wip', 'energy'] },
  ],
  display: [
    { key: 'metric', label: 'Bound metric', type: 'select', options: ['bottleneck', 'good', 'throughput', 'utilization', 'wip', 'energy'] },
  ],
};

export const METRIC_LABELS = {
  throughput: 'Throughput / hr',
  good: 'Good output',
  rejected: 'Rejected',
  utilization: 'Utilization',
  wip: 'Work in progress',
  energy: 'Energy',
  bottleneck: 'Bottleneck',
};

export function defaultProps(type) {
  return { ...(DEFAULT_PROPS[type] || {}) };
}

export function typeLabel(type) {
  return TYPE_MAP[type]?.label || type;
}

export function typeColor(type) {
  return TYPE_MAP[type]?.color || '#687e91';
}
