// Component catalogue, default properties and typed property schemas.
// Kept renderer-agnostic so the simulation engine can use the same definitions.

import { FLAT_PROPERTY_SCHEMAS, flatSchemaForType } from './industrialSchema.js';

export const COMPONENT_TYPES = [
  { type: 'source', label: 'Source', color: '#8fa3b8', physical: true, graph: true, ports: { in: false, out: true, workerIn: false, workerOut: false } },
  { type: 'workstation', label: 'Workstation', color: '#afb9c4', physical: true, graph: true, ports: { in: true, out: true, workerIn: true, workerOut: false } },
  { type: 'worker', label: 'Worker hub', color: '#d9b45b', physical: true, graph: false, ports: { in: false, out: false, workerIn: false, workerOut: true } },
  { type: 'conveyor', label: 'Conveyor belt', color: '#8b939d', physical: true, graph: true, ports: { in: true, out: true, workerIn: false, workerOut: false } },
  { type: 'buffer', label: 'Buffer station', color: '#93a89d', physical: true, graph: true, ports: { in: true, out: true, workerIn: false, workerOut: false } },
  { type: 'output', label: 'Output bin', color: '#b3a88f', physical: true, graph: true, ports: { in: true, out: false, workerIn: false, workerOut: false } },
  { type: 'chart', label: 'Chart', color: '#7f94a6', physical: false, graph: false, ports: {} },
  { type: 'display', label: 'Display', color: '#a69fb6', physical: false, graph: false, ports: {} },
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
    materialType: 'Steel billet',
    maxStorageCapacity: 500,
    replenishmentRate: 0,
    unitMassKg: 2.5,
    materialDensity: 7850,
    supplyIntervalSeconds: 0,
  },
  workstation: {
    stationType: 'production',
    cycleTime: 20,
    processingCapacity: 1,
    queueCapacity: 12,
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
    maintenanceMinutes: 0,
    maintenanceInterval: 0,
    inspectionAccuracy: 98,
    defectDetectionRate: 95,
    maxReinspection: 1,
    setupTimeSeconds: 60,
    operatingVoltage: 415,
    operatingCurrent: 6,
    operatingTemperature: 45,
    machineLengthM: 1.7,
    machineWidthM: 1.45,
    machineHeightM: 1.65,
    machineMassKg: 850,
    toolLifeHours: 500,
    toolWearRate: 0,
    inspectionDistanceM: 0.8,
    inspectionMethod: 'Automated',
  },
  worker: {
    employees: 4,
    skill: 'Assembly',
    errorRate: 1.5,
    breakMinutes: 30,
    meetingMinutes: 10,
    changeoverMinutes: 5,
    shiftMinutes: 480,
    productivity: 92,
    laborCostPerHour: 28,
  },
  conveyor: {
    moveTime: 3,
    speed: 1.2,
    length: 2.2,
    direction: 'forward',
    faultRate: 1,
    faultRecoveryMinutes: 5,
    powerKw: 0.5,
    capacity: 10,
    beltWidthM: 0.6,
    maxLoadKg: 120,
    operatingVoltage: 415,
    accelerationSeconds: 1.5,
    decelerationSeconds: 2,
  },
  buffer: {
    capacity: 30,
    initialQuantity: 0,
    mode: 'FIFO',
    lengthM: 1.4,
    widthM: 1.25,
    maxLoadKg: 300,
    minInventory: 0,
    maxWaitingTimeSeconds: 0,
  },
  output: {
    binCapacity: 1000,
    productCount: 0,
    acceptsRejected: false,
    lengthM: 1.35,
    widthM: 1.25,
    heightM: 0.9,
    productUnitMassKg: 2.5,
    maxLoadKg: 500,
  },
  chart: { metric: 'throughput' },
  display: {
    metric: 'bottleneck',
    displaySizeInch: 21.5,
    resolutionWidth: 1920,
    resolutionHeight: 1080,
    displayPowerW: 45,
    operatingVoltage: 24,
    mountingHeightM: 1.6,
    screenOrientation: 0,
  },
};

export const LIBRARY_ITEMS = [
  ...COMPONENT_TYPES.map((definition) => ({ ...definition, dragType: definition.type })),
  {
    type: 'inspection',
    dragType: 'inspection',
    componentType: 'workstation',
    label: 'Inspection station',
    color: '#d9b45b',
    physical: true,
    graph: true,
    preset: { stationType: 'inspection' },
    ports: { in: true, out: true, workerIn: true, workerOut: false },
  },
];

const PSEUDO_LABELS = { inspection: 'Inspection station' };

export const PROPERTY_SCHEMAS = FLAT_PROPERTY_SCHEMAS;

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
  return PSEUDO_LABELS[type] || TYPE_MAP[type]?.label || type;
}

export function typeColor(type) {
  if (type === 'inspection') return '#d9b45b';
  return TYPE_MAP[type]?.color || '#8b939d';
}

export function schemaForComponent(component) {
  if (!component) return [];
  if (component.type === 'workstation' && component.props?.stationType === 'inspection') {
    return flatSchemaForType('inspection');
  }
  return PROPERTY_SCHEMAS[component.type] || [];
}
