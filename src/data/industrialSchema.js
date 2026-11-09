// Presentation-only industrial property catalogue for the v0.0.3 properties panel.
//
// IMPORTANT: this module only describes labels, units, grouping, help text and
// read-only display fields. It never changes how a property is interpreted by
// the simulation engine. Properties marked `spec: true` are recorded machine
// specifications for the digital twin; they are not consumed by the current
// simulation calculations.

const pcs = 'pcs';
const pcsPerHour = 'pcs/h';
const secondsPerPiece = 's/pc';
const persons = 'persons';

const LIVE_HELP = 'Read-only value reported by the simulation engine.';

const stateField = (tooltip) => ({
  id: 'state',
  label: 'Current machine state',
  unit: '',
  calculated: true,
  format: 'state',
  liveKey: 'state',
  tooltip: tooltip || LIVE_HELP,
});

const WORKSTATION_LIVE = [
  {
    id: 'processed',
    label: 'Total processed pieces',
    unit: pcs,
    calculated: true,
    liveKey: 'processed',
    precision: 0,
    tooltip: 'Pieces completed by this station during the current run.',
  },
  {
    id: 'good',
    label: 'Good output',
    unit: pcs,
    calculated: true,
    liveKey: 'good',
    precision: 0,
    tooltip: 'Accepted, non-defective pieces produced by this station.',
  },
  {
    id: 'rejected',
    label: 'Rejected output',
    unit: pcs,
    calculated: true,
    liveKey: 'rejected',
    precision: 0,
    tooltip: 'Pieces rejected by this station during the current run.',
  },
  {
    id: 'throughput',
    label: 'Current throughput',
    unit: pcsPerHour,
    calculated: true,
    liveKey: 'throughput',
    precision: 1,
    tooltip: 'Completed pieces per simulated hour.',
  },
  {
    id: 'utilization',
    label: 'Machine utilization',
    unit: '%',
    calculated: true,
    liveKey: 'utilization',
    precision: 1,
    tooltip: 'Share of scheduled time spent processing pieces.',
  },
  {
    id: 'busyHours',
    label: 'Operating time',
    unit: 'h',
    calculated: true,
    liveKey: 'busyHours',
    precision: 2,
    tooltip: 'Accumulated time spent processing pieces.',
  },
  {
    id: 'idleHours',
    label: 'Idle / starved time',
    unit: 'h',
    calculated: true,
    liveKey: 'starvedHours',
    precision: 2,
    tooltip: 'Time the station was available but waiting for input.',
  },
  {
    id: 'blockedHours',
    label: 'Blocked time',
    unit: 'h',
    calculated: true,
    liveKey: 'blockedHours',
    precision: 2,
    tooltip: 'Time the station was unable to release a finished piece.',
  },
  {
    id: 'downMinutes',
    label: 'Downtime',
    unit: 'min',
    calculated: true,
    value: ({ liveNode, batchNode }) => {
      const hours = liveNode?.downHours ?? batchNode?.downHours;
      return Number.isFinite(Number(hours)) ? Number(hours) * 60 : null;
    },
    precision: 1,
    tooltip: 'Accumulated fault, maintenance and off-shift downtime.',
  },
  {
    id: 'avgCycleTime',
    label: 'Average processing time',
    unit: secondsPerPiece,
    calculated: true,
    value: ({ metrics, batch }) => metrics?.avgCycleTime ?? batch?.avgCycleTime,
    precision: 1,
    tooltip: 'Line-wide average time a delivered piece spent in processing.',
  },
  {
    id: 'queueLength',
    label: 'Queue length',
    unit: pcs,
    calculated: true,
    liveKey: 'queueLength',
    batchKey: 'queueLength',
    precision: 0,
    tooltip: 'Pieces currently waiting in the station input queue.',
  },
  {
    id: 'energyKwh',
    label: 'Energy consumption',
    unit: 'kWh',
    calculated: true,
    liveKey: 'energyKwh',
    precision: 3,
    tooltip: 'Electrical energy consumed since the run started.',
  },
  {
    id: 'toolCondition',
    label: 'Tool condition',
    unit: '%',
    calculated: true,
    future: true,
    value: () => null,
    precision: 0,
    tooltip:
      'Future enhancement. The current engine records tool-damage probability but does not expose tool-wear telemetry.',
  },
  stateField(),
];

const CONVEYOR_LIVE = [
  {
    id: 'currentSpeed',
    label: 'Current speed',
    unit: 'm/s',
    calculated: true,
    value: ({ component }) => Number(component?.props?.speed),
    precision: 2,
    tooltip: 'Configured belt speed; the live engine moves products at this rate.',
  },
  {
    id: 'transported',
    label: 'Products transported',
    unit: pcs,
    calculated: true,
    liveKey: 'processed',
    precision: 0,
    tooltip: 'Pieces released by the conveyor during the current run.',
  },
  {
    id: 'currentProducts',
    label: 'Products on belt',
    unit: pcs,
    calculated: true,
    liveKey: 'currentProducts',
    precision: 0,
    tooltip: 'Pieces currently travelling on the belt.',
  },
  {
    id: 'currentLoad',
    label: 'Current load',
    unit: 'kg',
    calculated: true,
    future: true,
    value: () => null,
    precision: 1,
    tooltip:
      'Future enhancement. Product mass is not part of the current product model, so live belt load cannot be derived.',
  },
  {
    id: 'utilization',
    label: 'Conveyor utilization',
    unit: '%',
    calculated: true,
    liveKey: 'utilization',
    precision: 1,
    tooltip: 'Share of elapsed time the conveyor carried at least one product.',
  },
  {
    id: 'busyHours',
    label: 'Running time',
    unit: 'h',
    calculated: true,
    liveKey: 'busyHours',
    precision: 2,
    tooltip: 'Accumulated time the belt was running with products.',
  },
  {
    id: 'idleHours',
    label: 'Idle time',
    unit: 'h',
    calculated: true,
    liveKey: 'starvedHours',
    precision: 2,
    tooltip: 'Time the conveyor was available but empty.',
  },
  {
    id: 'blockedMinutes',
    label: 'Blocked time',
    unit: 'min',
    calculated: true,
    value: ({ liveNode, batchNode }) => {
      const hours = liveNode?.blockedHours ?? batchNode?.blockedHours;
      return Number.isFinite(Number(hours)) ? Number(hours) * 60 : null;
    },
    precision: 1,
    tooltip: 'Time the conveyor could not discharge because the downstream station was full.',
  },
  {
    id: 'energyKwh',
    label: 'Energy consumption',
    unit: 'kWh',
    calculated: true,
    liveKey: 'energyKwh',
    precision: 3,
    tooltip: 'Electrical energy consumed by the conveyor motor.',
  },
  stateField('Current conveyor state reported by the live engine.'),
];

const BUFFER_LIVE = [
  {
    id: 'inventory',
    label: 'Current inventory',
    unit: pcs,
    calculated: true,
    liveKey: 'currentProducts',
    precision: 0,
    tooltip: 'Pieces currently stored in the buffer.',
  },
  {
    id: 'availableCapacity',
    label: 'Available capacity',
    unit: pcs,
    calculated: true,
    value: ({ liveNode, batchNode, component }) => {
      const capacity = Number(component?.props?.capacity);
      const current = liveNode?.currentProducts ?? batchNode?.queueLength;
      return Number.isFinite(capacity) && Number.isFinite(Number(current))
        ? Math.max(0, capacity - Number(current))
        : null;
    },
    precision: 0,
    tooltip: 'Free storage positions remaining in the buffer.',
  },
  {
    id: 'occupancy',
    label: 'Occupancy',
    unit: '%',
    calculated: true,
    value: ({ liveNode, batchNode, component }) => {
      const capacity = Number(component?.props?.capacity);
      const current = liveNode?.currentProducts ?? batchNode?.queueLength;
      return capacity > 0 && Number.isFinite(Number(current)) ? (Number(current) / capacity) * 100 : null;
    },
    precision: 1,
    tooltip: 'Share of buffer positions currently occupied.',
  },
  {
    id: 'avgWaitingTime',
    label: 'Average waiting time',
    unit: 's',
    calculated: true,
    liveKey: 'avgWaitingTime',
    precision: 1,
    tooltip: 'Average time pieces spent waiting in this buffer.',
  },
  {
    id: 'maxWaitingTime',
    label: 'Maximum waiting time',
    unit: 's',
    calculated: true,
    future: true,
    value: () => null,
    precision: 1,
    tooltip:
      'Future enhancement. The current engine reports average waiting time but does not retain a per-buffer maximum.',
  },
  {
    id: 'inputRate',
    label: 'Input rate',
    unit: pcsPerHour,
    calculated: true,
    liveKey: 'inputRate',
    precision: 1,
    tooltip: 'Pieces entering the buffer per simulated hour.',
  },
  {
    id: 'outputRate',
    label: 'Output rate',
    unit: pcsPerHour,
    calculated: true,
    liveKey: 'outputRate',
    precision: 1,
    tooltip: 'Pieces leaving the buffer per simulated hour.',
  },
  {
    id: 'overflowCount',
    label: 'Overflow events',
    unit: 'occurrences',
    calculated: true,
    liveKey: 'overflowCount',
    precision: 0,
    tooltip: 'Times an incoming piece could not enter because the buffer was full.',
  },
  {
    id: 'blockedEvents',
    label: 'Blocked events',
    unit: 'occurrences',
    calculated: true,
    future: true,
    value: () => null,
    precision: 0,
    tooltip:
      'Future enhancement. The engine records blocked duration but does not retain a per-buffer blocked-event count.',
  },
  {
    id: 'blockedMinutes',
    label: 'Blocked time',
    unit: 'min',
    calculated: true,
    value: ({ liveNode, batchNode }) => {
      const hours = liveNode?.blockedHours ?? batchNode?.blockedHours;
      return Number.isFinite(Number(hours)) ? Number(hours) * 60 : null;
    },
    precision: 1,
    tooltip: 'Time the buffer was unable to release stored pieces.',
  },
];

const OUTPUT_LIVE = [
  {
    id: 'inventory',
    label: 'Current inventory',
    unit: pcs,
    calculated: true,
    liveKey: 'currentProducts',
    precision: 0,
    tooltip: 'Finished pieces currently stored in the bin.',
  },
  {
    id: 'accepted',
    label: 'Accepted products',
    unit: pcs,
    calculated: true,
    liveKey: 'accepted',
    precision: 0,
    tooltip: 'Good pieces stored in this output bin.',
  },
  {
    id: 'rejected',
    label: 'Rejected products',
    unit: pcs,
    calculated: true,
    liveKey: 'rejected',
    precision: 0,
    tooltip: 'Rejected pieces stored in this output bin, when enabled.',
  },
  {
    id: 'remainingCapacity',
    label: 'Remaining capacity',
    unit: pcs,
    calculated: true,
    value: ({ liveNode, batchNode, component }) => {
      const capacity = Number(component?.props?.binCapacity);
      const current = liveNode?.currentProducts ?? batchNode?.queueLength;
      return Number.isFinite(capacity) && Number.isFinite(Number(current))
        ? Math.max(0, capacity - Number(current))
        : null;
    },
    precision: 0,
    tooltip: 'Free storage positions remaining in the bin.',
  },
  {
    id: 'storageUtilization',
    label: 'Storage utilization',
    unit: '%',
    calculated: true,
    value: ({ liveNode, batchNode, component }) => {
      const capacity = Number(component?.props?.binCapacity);
      const current = liveNode?.currentProducts ?? batchNode?.queueLength;
      return capacity > 0 && Number.isFinite(Number(current)) ? (Number(current) / capacity) * 100 : null;
    },
    precision: 1,
    tooltip: 'Share of bin capacity currently occupied.',
  },
  {
    id: 'storedMass',
    label: 'Total stored mass',
    unit: 'kg',
    calculated: true,
    value: ({ liveNode, batchNode, component }) => {
      const current = liveNode?.currentProducts ?? batchNode?.queueLength;
      const unitMass = Number(component?.props?.productUnitMassKg);
      return Number.isFinite(Number(current)) && Number.isFinite(unitMass)
        ? Number(current) * unitMass
        : null;
    },
    precision: 1,
    tooltip: 'Current inventory multiplied by the configured product unit mass.',
  },
  {
    id: 'outputRate',
    label: 'Output rate',
    unit: pcsPerHour,
    calculated: true,
    liveKey: 'outputRate',
    precision: 1,
    tooltip: 'Pieces delivered to the bin per simulated hour.',
  },
];

const WORKER_LIVE = [
  {
    id: 'availableWorkers',
    label: 'Available workers',
    unit: persons,
    calculated: true,
    liveKey: 'availableWorkers',
    precision: 0,
    tooltip: 'Assigned workers not currently busy or on a break.',
  },
  {
    id: 'activeWorkers',
    label: 'Active workers',
    unit: persons,
    calculated: true,
    liveKey: 'busyWorkers',
    precision: 0,
    tooltip: 'Workers currently allocated to a connected workstation.',
  },
  {
    id: 'unavailableWorkers',
    label: 'Workers on break',
    unit: persons,
    calculated: true,
    liveKey: 'unavailableWorkers',
    precision: 0,
    tooltip: 'Assigned workers currently unavailable because of a scheduled break.',
  },
  {
    id: 'utilization',
    label: 'Labor utilization',
    unit: '%',
    calculated: true,
    liveKey: 'utilization',
    precision: 1,
    tooltip: 'Busy employee-seconds divided by available employee-seconds.',
  },
  {
    id: 'productiveHours',
    label: 'Productive time',
    unit: 'h',
    calculated: true,
    liveKey: 'busyHours',
    precision: 2,
    tooltip: 'Accumulated busy employee-hours in this hub.',
  },
  {
    id: 'idleHours',
    label: 'Idle time',
    unit: 'h',
    calculated: true,
    value: ({ liveHub, batchHub }) => {
      const busy = Number(liveHub?.busyHours ?? batchHub?.busyHours);
      const available = Number(liveHub?.availableHours ?? batchHub?.availableHours);
      return Number.isFinite(busy) && Number.isFinite(available)
        ? Math.max(0, available - busy)
        : null;
    },
    precision: 2,
    tooltip: 'Available employee-hours that were not allocated to production.',
  },
  {
    id: 'totalLaborHours',
    label: 'Total labor hours',
    unit: 'person-hours',
    calculated: true,
    liveKey: 'availableHours',
    precision: 2,
    tooltip: 'Available employee-hours accumulated by this worker hub.',
  },
];

const DISPLAY_LIVE = [
  {
    id: 'online',
    label: 'Online status',
    unit: '',
    calculated: true,
    format: 'status',
    value: ({ liveAvailable }) => (liveAvailable ? 'Online' : 'Offline'),
    tooltip: 'Online while a live simulation snapshot is being received.',
  },
  {
    id: 'activeAlarms',
    label: 'Active alarms',
    unit: 'occurrences',
    calculated: true,
    future: true,
    value: () => null,
    precision: 0,
    tooltip:
      'Future enhancement. The current engine does not expose an alarm state for HMI displays.',
  },
  {
    id: 'connectedStations',
    label: 'Connected stations',
    unit: '',
    calculated: true,
    value: ({ metrics }) => metrics?.stations?.length ?? 0,
    precision: 0,
    tooltip: 'Graph stations currently reported by the simulation engine.',
  },
  {
    id: 'lastUpdate',
    label: 'Last update time',
    unit: '',
    calculated: true,
    format: 'time',
    value: ({ liveSnapshot }) => liveSnapshot?.elapsed ?? null,
    tooltip: 'Simulation clock at the most recent snapshot.',
  },
];

const WORKSTATION_SECTIONS = [
  {
    title: 'Operational Parameters',
    fields: [
      {
        key: 'stationType',
        label: 'Station role',
        type: 'select',
        options: [
          { value: 'production', label: 'Production' },
          { value: 'assembly', label: 'Assembly' },
          { value: 'inspection', label: 'Inspection' },
        ],
        tooltip: 'Role used by the property panel and station naming. Inspection stations also use inspection metrics.',
      },
      {
        key: 'cycleTime',
        label: 'Cycle time per piece',
        type: 'number',
        unit: secondsPerPiece,
        min: 1,
        step: 1,
        tooltip: 'Time required to process one piece at this station.',
      },
      {
        key: 'setupTimeSeconds',
        label: 'Setup time',
        type: 'number',
        unit: 's',
        min: 0,
        step: 5,
        spec: true,
        tooltip: 'Recorded initial setup duration. The current engine models changeover separately.',
      },
      {
        key: 'changeoverMinutes',
        label: 'Changeover time',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Scheduled time at the start of each shift for product or program changeover.',
      },
      {
        key: 'humanRequired',
        label: 'Human interaction required',
        type: 'boolean',
        onLabel: 'Required / enabled',
        offLabel: 'Not required / disabled',
        tooltip: 'When enabled, the station needs an assigned worker hub before it can process pieces.',
      },
    ],
  },
  {
    title: 'Production Parameters',
    fields: [
      {
        key: 'processingCapacity',
        label: 'Parallel processing capacity',
        type: 'number',
        unit: 'parallel pcs',
        min: 1,
        step: 1,
        tooltip: 'Number of pieces the station can process simultaneously. This is not pieces per hour.',
      },
      {
        id: 'configuredThroughput',
        label: 'Configured throughput',
        unit: pcsPerHour,
        calculated: true,
        value: ({ component }) => {
          const cycle = Number(component?.props?.cycleTime);
          const parallel = Number(component?.props?.processingCapacity);
          return cycle > 0 && parallel > 0 ? (3600 / cycle) * parallel : 0;
        },
        precision: 1,
        tooltip: 'Derived display value: 3600 / cycle time × parallel processing capacity.',
      },
      {
        key: 'queueCapacity',
        label: 'Input queue capacity',
        type: 'number',
        unit: pcs,
        min: 1,
        step: 1,
        tooltip: 'Maximum number of pieces that may wait in front of the station.',
      },
      {
        key: 'errorRate',
        label: 'Error / rejection rate',
        type: 'number',
        unit: '%',
        min: 0,
        max: 100,
        step: 0.1,
        tooltip: 'Expected fraction of processed pieces rejected by quality.',
      },
    ],
  },
  {
    title: 'Resource Parameters',
    fields: [
      {
        key: 'workers',
        label: 'Assigned workers',
        type: 'number',
        unit: persons,
        min: 0,
        step: 1,
        tooltip: 'Number of workers required from the connected worker hub.',
      },
      {
        key: 'workingTimePerShift',
        label: 'Working time per shift',
        type: 'number',
        unit: 'min',
        min: 1,
        step: 5,
        tooltip: 'Scheduled productive time in each shift.',
      },
      {
        key: 'breakMinutes',
        label: 'Break duration',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Scheduled break inside each shift.',
      },
      {
        key: 'meetingMinutes',
        label: 'Meeting duration',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Scheduled meeting time inside each shift.',
      },
    ],
  },
  {
    title: 'Energy Parameters',
    fields: [
      {
        key: 'powerKw',
        label: 'Power consumption',
        type: 'number',
        unit: 'kW',
        min: 0,
        step: 0.1,
        tooltip: 'Electrical power drawn while the station is operating.',
      },
      {
        key: 'operatingVoltage',
        label: 'Operating voltage',
        type: 'number',
        unit: 'V',
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded rated voltage of the machine.',
      },
      {
        key: 'operatingCurrent',
        label: 'Current consumption',
        type: 'number',
        unit: 'A',
        min: 0,
        step: 0.1,
        spec: true,
        tooltip: 'Recorded rated current of the machine.',
      },
      {
        key: 'operatingTemperature',
        label: 'Operating temperature',
        type: 'number',
        unit: '°C',
        step: 1,
        spec: true,
        tooltip: 'Recorded normal operating temperature.',
      },
      {
        key: 'machineLengthM',
        label: 'Machine length',
        type: 'number',
        unit: 'm',
        min: 0,
        step: 0.05,
        spec: true,
        tooltip: 'Physical machine footprint length.',
      },
      {
        key: 'machineWidthM',
        label: 'Machine width',
        type: 'number',
        unit: 'm',
        min: 0,
        step: 0.05,
        spec: true,
        tooltip: 'Physical machine footprint width.',
      },
      {
        key: 'machineHeightM',
        label: 'Machine height',
        type: 'number',
        unit: 'm',
        min: 0,
        step: 0.05,
        spec: true,
        tooltip: 'Physical machine height.',
      },
      {
        key: 'machineMassKg',
        label: 'Machine mass',
        type: 'number',
        unit: 'kg',
        min: 0,
        step: 10,
        spec: true,
        tooltip: 'Installed equipment mass.',
      },
    ],
  },
  {
    title: 'Reliability and Maintenance',
    fields: [
      {
        key: 'toolDamage',
        label: 'Tool damage probability',
        type: 'number',
        unit: '%/pc',
        min: 0,
        max: 100,
        step: 0.1,
        tooltip: 'Probability of a tool-related fault per processed piece.',
      },
      {
        key: 'errorRecoveryMinutes',
        label: 'Error recovery time',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Time required to recover after a station fault.',
      },
      {
        key: 'maintenanceInterval',
        label: 'Maintenance interval',
        type: 'number',
        unit: pcs,
        min: 0,
        step: 100,
        tooltip: 'The current engine schedules maintenance every N processed pieces. A value of 0 disables it.',
      },
      {
        key: 'maintenanceMinutes',
        label: 'Maintenance duration',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Planned duration of each maintenance event.',
      },
      {
        key: 'toolLifeHours',
        label: 'Tool life',
        type: 'number',
        unit: 'h',
        min: 0,
        step: 10,
        spec: true,
        tooltip: 'Recorded nominal tool life. Tool-life accounting is a future enhancement.',
      },
      {
        key: 'toolWearRate',
        label: 'Tool wear rate',
        type: 'number',
        unit: '%/h',
        min: 0,
        max: 100,
        step: 0.1,
        spec: true,
        tooltip: 'Recorded nominal tool wear. Wear telemetry is a future enhancement.',
      },
      {
        id: 'timeBasedMaintenance',
        label: 'Time-based maintenance interval',
        unit: 'h',
        calculated: true,
        future: true,
        value: () => null,
        precision: 1,
        tooltip:
          'Future enhancement. The existing engine triggers maintenance by piece count to preserve current behaviour.',
      },
    ],
  },
  { title: 'Live Metrics', fields: WORKSTATION_LIVE },
];

const INSPECTION_LIVE = [
  {
    id: 'inspected',
    label: 'Inspected products',
    unit: pcs,
    calculated: true,
    liveKey: 'processed',
    precision: 0,
    tooltip: 'Pieces that completed inspection at this station.',
  },
  {
    id: 'accepted',
    label: 'Accepted products',
    unit: pcs,
    calculated: true,
    liveKey: 'good',
    precision: 0,
    tooltip: 'Inspected pieces accepted as good output.',
  },
  {
    id: 'rejected',
    label: 'Rejected products',
    unit: pcs,
    calculated: true,
    liveKey: 'rejected',
    precision: 0,
    tooltip: 'Inspected pieces rejected by the quality rule.',
  },
  {
    id: 'defectRate',
    label: 'Defect rate',
    unit: '%',
    calculated: true,
    liveKey: 'defectRate',
    precision: 1,
    tooltip: 'Configured incoming defect rate used by the inspection model.',
  },
  {
    id: 'throughput',
    label: 'Inspection throughput',
    unit: pcsPerHour,
    calculated: true,
    liveKey: 'throughput',
    precision: 1,
    tooltip: 'Pieces inspected per simulated hour.',
  },
  {
    id: 'avgInspectionTime',
    label: 'Average inspection time',
    unit: secondsPerPiece,
    calculated: true,
    value: ({ metrics, batch }) => metrics?.avgCycleTime ?? batch?.avgCycleTime,
    precision: 1,
    tooltip: 'Line-wide average time a delivered piece spent in processing and inspection.',
  },
  {
    id: 'utilization',
    label: 'Inspection utilization',
    unit: '%',
    calculated: true,
    liveKey: 'utilization',
    precision: 1,
    tooltip: 'Share of scheduled time spent inspecting pieces.',
  },
  {
    id: 'energyKwh',
    label: 'Energy consumption',
    unit: 'kWh',
    calculated: true,
    liveKey: 'energyKwh',
    precision: 3,
    tooltip: 'Electrical energy consumed by the inspection equipment.',
  },
  stateField('Current inspection state reported by the live engine.'),
];

const INSPECTION_SECTIONS = [
  {
    title: 'Operational Parameters',
    fields: [
      {
        key: 'cycleTime',
        label: 'Inspection cycle time',
        type: 'number',
        unit: secondsPerPiece,
        min: 1,
        step: 1,
        tooltip: 'Time required to inspect one piece.',
      },
      {
        key: 'inspectionMethod',
        label: 'Inspection method',
        type: 'select',
        options: [
          { value: 'Automated', label: 'Automated' },
          { value: 'Manual', label: 'Manual' },
          { value: 'Hybrid', label: 'Hybrid' },
        ],
        spec: true,
        tooltip: 'Recorded inspection method. The current engine uses the same inspection model for all methods.',
      },
      {
        key: 'setupTimeSeconds',
        label: 'Setup time',
        type: 'number',
        unit: 's',
        min: 0,
        step: 5,
        spec: true,
        tooltip: 'Recorded setup duration for the inspection station.',
      },
    ],
  },
  {
    title: 'Production Parameters',
    fields: [
      {
        key: 'processingCapacity',
        label: 'Parallel inspection capacity',
        type: 'number',
        unit: 'parallel pcs',
        min: 1,
        step: 1,
        tooltip: 'Pieces that can be inspected simultaneously. This is not pieces per hour.',
      },
      {
        id: 'configuredThroughput',
        label: 'Configured inspection capacity',
        unit: pcsPerHour,
        calculated: true,
        value: ({ component }) => {
          const cycle = Number(component?.props?.cycleTime);
          const parallel = Number(component?.props?.processingCapacity);
          return cycle > 0 && parallel > 0 ? (3600 / cycle) * parallel : 0;
        },
        precision: 1,
        tooltip: 'Derived display value: 3600 / inspection cycle time × parallel capacity.',
      },
      {
        key: 'inspectionAccuracy',
        label: 'Inspection accuracy',
        type: 'number',
        unit: '%',
        min: 0,
        max: 100,
        step: 0.1,
        tooltip: 'Configured accuracy of defect classification.',
      },
      {
        key: 'defectDetectionRate',
        label: 'Defect detection rate',
        type: 'number',
        unit: '%',
        min: 0,
        max: 100,
        step: 0.1,
        tooltip: 'Configured probability that a defective piece is detected.',
      },
      {
        key: 'inspectionDistanceM',
        label: 'Inspection distance',
        type: 'number',
        unit: 'm',
        min: 0,
        step: 0.05,
        spec: true,
        tooltip: 'Recorded sensor or camera working distance.',
      },
      {
        key: 'maxReinspection',
        label: 'Maximum reinspections',
        type: 'number',
        unit: 'passes',
        min: 0,
        step: 1,
        tooltip: 'Maximum number of reinspection passes for a questionable piece.',
      },
      {
        key: 'queueCapacity',
        label: 'Input queue capacity',
        type: 'number',
        unit: pcs,
        min: 1,
        step: 1,
        tooltip: 'Maximum number of pieces that may wait for inspection.',
      },
      {
        key: 'errorRate',
        label: 'Error / rejection rate',
        type: 'number',
        unit: '%',
        min: 0,
        max: 100,
        step: 0.1,
        tooltip: 'Expected incoming defect rate used by the quality model.',
      },
    ],
  },
  {
    title: 'Resource Parameters',
    fields: [
      {
        key: 'workers',
        label: 'Assigned inspectors',
        type: 'number',
        unit: persons,
        min: 0,
        step: 1,
        tooltip: 'Number of inspectors required from the connected worker hub.',
      },
      {
        key: 'humanRequired',
        label: 'Human interaction required',
        type: 'boolean',
        onLabel: 'Required / enabled',
        offLabel: 'Not required / disabled',
        tooltip: 'When enabled, inspection needs an assigned worker hub.',
      },
      {
        key: 'workingTimePerShift',
        label: 'Working time per shift',
        type: 'number',
        unit: 'min',
        min: 1,
        step: 5,
        tooltip: 'Scheduled inspection time in each shift.',
      },
      {
        key: 'breakMinutes',
        label: 'Break duration',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Scheduled break inside each shift.',
      },
      {
        key: 'meetingMinutes',
        label: 'Meeting duration',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Scheduled meeting time inside each shift.',
      },
    ],
  },
  {
    title: 'Energy Parameters',
    fields: [
      {
        key: 'powerKw',
        label: 'Power consumption',
        type: 'number',
        unit: 'kW',
        min: 0,
        step: 0.1,
        tooltip: 'Electrical power drawn by the inspection equipment.',
      },
      {
        key: 'operatingVoltage',
        label: 'Operating voltage',
        type: 'number',
        unit: 'V',
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded rated voltage of the inspection equipment.',
      },
      {
        key: 'operatingCurrent',
        label: 'Current consumption',
        type: 'number',
        unit: 'A',
        min: 0,
        step: 0.1,
        spec: true,
        tooltip: 'Recorded rated current of the inspection equipment.',
      },
      {
        key: 'operatingTemperature',
        label: 'Operating temperature',
        type: 'number',
        unit: '°C',
        step: 1,
        spec: true,
        tooltip: 'Recorded normal operating temperature.',
      },
    ],
  },
  {
    title: 'Reliability and Maintenance',
    fields: [
      {
        key: 'toolDamage',
        label: 'Tool damage probability',
        type: 'number',
        unit: '%/pc',
        min: 0,
        max: 100,
        step: 0.1,
        tooltip: 'Probability of an equipment fault per inspected piece.',
      },
      {
        key: 'errorRecoveryMinutes',
        label: 'Error recovery time',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Time required to recover after an inspection fault.',
      },
      {
        key: 'maintenanceInterval',
        label: 'Maintenance interval',
        type: 'number',
        unit: pcs,
        min: 0,
        step: 100,
        tooltip: 'The current engine schedules maintenance every N inspected pieces.',
      },
      {
        key: 'maintenanceMinutes',
        label: 'Maintenance duration',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Planned duration of each maintenance event.',
      },
    ],
  },
  { title: 'Live Metrics', fields: INSPECTION_LIVE },
];

const SOURCE_SECTIONS = [
  {
    title: 'Operational Parameters',
    fields: [
      { key: 'materialType', label: 'Material type', type: 'text', tooltip: 'Type of raw material supplied by this source.' },
      {
        key: 'productType',
        label: 'Product type',
        type: 'text',
        tooltip: 'Name of the product generated from this material.',
      },
      {
        key: 'inputPerHour',
        label: 'Material arrival rate',
        type: 'number',
        unit: pcsPerHour,
        min: 0,
        step: 1,
        tooltip: 'Rate at which this source releases material into the production line.',
      },
    ],
  },
  {
    title: 'Production Parameters',
    fields: [
      {
        key: 'initialQuantity',
        label: 'Initial inventory',
        type: 'number',
        unit: pcs,
        min: 0,
        step: 1,
        tooltip: 'Material quantity available when the run starts.',
      },
      {
        key: 'maxStorageCapacity',
        label: 'Maximum capacity',
        type: 'number',
        unit: pcs,
        min: 1,
        step: 1,
        tooltip: 'Maximum material quantity the source can hold.',
      },
      {
        key: 'replenishmentRate',
        label: 'Replenishment rate',
        type: 'number',
        unit: pcsPerHour,
        min: 0,
        step: 1,
        tooltip: 'Continuous material supply rate used by the engine.',
      },
      {
        key: 'unitMassKg',
        label: 'Material unit mass',
        type: 'number',
        unit: 'kg/pc',
        min: 0,
        step: 0.1,
        spec: true,
        tooltip: 'Recorded mass of one piece for inventory mass display.',
      },
      {
        key: 'materialDensity',
        label: 'Material density',
        type: 'number',
        unit: 'kg/m³',
        min: 0,
        step: 10,
        spec: true,
        tooltip: 'Recorded material density for engineering reference.',
      },
      {
        key: 'supplyIntervalSeconds',
        label: 'Supply interval',
        type: 'number',
        unit: 's',
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded replenishment interval. The current engine replenishes continuously from the configured rate.',
      },
    ],
  },
  {
    title: 'Live Metrics',
    fields: [
      {
        id: 'inventory',
        label: 'Current inventory',
        unit: pcs,
        calculated: true,
        liveKey: 'inventory',
        precision: 0,
        tooltip: 'Current material quantity held by the source.',
      },
      {
        id: 'inventoryMass',
        label: 'Current inventory mass',
        unit: 'kg',
        calculated: true,
        value: ({ liveNode, component }) => {
          const inventory = Number(liveNode?.inventory);
          const unitMass = Number(component?.props?.unitMassKg);
          return Number.isFinite(inventory) && Number.isFinite(unitMass) ? inventory * unitMass : null;
        },
        precision: 1,
        tooltip: 'Current piece inventory multiplied by material unit mass.',
      },
      {
        id: 'consumptionRate',
        label: 'Material consumption',
        unit: pcsPerHour,
        calculated: true,
        value: ({ liveNode, metrics }) => {
          const consumed = Number(liveNode?.consumed);
          const hours = Number(metrics?.hours);
          return Number.isFinite(consumed) && hours > 0 ? consumed / hours : null;
        },
        precision: 1,
        tooltip: 'Pieces consumed per simulated hour, derived from the engine consumption count.',
      },
      {
        id: 'remainingCapacity',
        label: 'Remaining capacity',
        unit: pcs,
        calculated: true,
        value: ({ liveNode, component }) => {
          const capacity = Number(component?.props?.maxStorageCapacity);
          const inventory = Number(liveNode?.inventory);
          return Number.isFinite(capacity) && Number.isFinite(inventory)
            ? Math.max(0, capacity - inventory)
            : null;
        },
        precision: 0,
        tooltip: 'Free storage quantity remaining.',
      },
      {
        id: 'shortageCount',
        label: 'Material shortage count',
        unit: 'occurrences',
        calculated: true,
        liveKey: 'shortageCount',
        precision: 0,
        tooltip: 'Times the line requested material while the source was empty.',
      },
      {
        id: 'inventoryUtilization',
        label: 'Inventory utilization',
        unit: '%',
        calculated: true,
        value: ({ liveNode, component }) => {
          const capacity = Number(component?.props?.maxStorageCapacity);
          const inventory = Number(liveNode?.inventory);
          return capacity > 0 && Number.isFinite(inventory) ? (inventory / capacity) * 100 : null;
        },
        precision: 1,
        tooltip: 'Current inventory as a share of maximum storage capacity.',
      },
    ],
  },
];

const CONVEYOR_SECTIONS = [
  {
    title: 'Operational Parameters',
    fields: [
      {
        key: 'length',
        label: 'Conveyor length',
        type: 'number',
        unit: 'm',
        min: 0.1,
        step: 0.1,
        tooltip: 'Total transport length of the conveyor.',
      },
      {
        key: 'beltWidthM',
        label: 'Belt width',
        type: 'number',
        unit: 'm',
        min: 0,
        step: 0.05,
        spec: true,
        tooltip: 'Recorded belt width.',
      },
      {
        key: 'speed',
        label: 'Belt speed',
        type: 'number',
        unit: 'm/s',
        min: 0.01,
        step: 0.1,
        tooltip: 'Product movement speed.',
      },
      {
        key: 'moveTime',
        label: 'Transport time per product',
        type: 'number',
        unit: 's',
        min: 0.1,
        step: 0.1,
        tooltip: 'Minimum transport time. The engine uses the larger of this value and length / speed.',
      },
      {
        key: 'direction',
        label: 'Conveyor direction',
        type: 'select',
        options: [
          { value: 'forward', label: 'Forward' },
          { value: 'reverse', label: 'Reverse' },
        ],
        tooltip: 'Configured belt direction.',
      },
      {
        key: 'accelerationSeconds',
        label: 'Acceleration time',
        type: 'number',
        unit: 's',
        min: 0,
        step: 0.1,
        spec: true,
        tooltip: 'Recorded time to reach operating speed.',
      },
      {
        key: 'decelerationSeconds',
        label: 'Deceleration time',
        type: 'number',
        unit: 's',
        min: 0,
        step: 0.1,
        spec: true,
        tooltip: 'Recorded time to stop from operating speed.',
      },
    ],
  },
  {
    title: 'Production Parameters',
    fields: [
      {
        key: 'capacity',
        label: 'Maximum capacity',
        type: 'number',
        unit: pcs,
        min: 1,
        step: 1,
        tooltip: 'Maximum number of pieces supported on the belt.',
      },
      {
        key: 'maxLoadKg',
        label: 'Maximum load',
        type: 'number',
        unit: 'kg',
        min: 0,
        step: 5,
        spec: true,
        tooltip: 'Recorded maximum permitted belt load.',
      },
    ],
  },
  {
    title: 'Energy Parameters',
    fields: [
      {
        key: 'powerKw',
        label: 'Motor power',
        type: 'number',
        unit: 'kW',
        min: 0,
        step: 0.1,
        tooltip: 'Rated electrical power of the conveyor motor.',
      },
      {
        key: 'operatingVoltage',
        label: 'Operating voltage',
        type: 'number',
        unit: 'V',
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded electrical operating voltage.',
      },
    ],
  },
  {
    title: 'Reliability and Maintenance',
    fields: [
      {
        key: 'faultRate',
        label: 'Fault probability',
        type: 'number',
        unit: '%/h',
        min: 0,
        max: 100,
        step: 0.1,
        tooltip: 'Probability of a conveyor fault per operating hour.',
      },
      {
        key: 'faultRecoveryMinutes',
        label: 'Fault recovery time',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Time required to recover after a conveyor fault.',
      },
    ],
  },
  { title: 'Live Metrics', fields: CONVEYOR_LIVE },
];

const BUFFER_SECTIONS = [
  {
    title: 'Operational Parameters',
    fields: [
      {
        key: 'mode',
        label: 'Buffer configuration',
        type: 'select',
        options: [
          { value: 'FIFO', label: 'FIFO' },
          { value: 'LIFO', label: 'LIFO' },
        ],
        tooltip: 'Order in which stored pieces are released.',
      },
      {
        key: 'lengthM',
        label: 'Buffer length',
        type: 'number',
        unit: 'm',
        min: 0,
        step: 0.05,
        spec: true,
        tooltip: 'Recorded physical buffer length.',
      },
      {
        key: 'widthM',
        label: 'Buffer width',
        type: 'number',
        unit: 'm',
        min: 0,
        step: 0.05,
        spec: true,
        tooltip: 'Recorded physical buffer width.',
      },
    ],
  },
  {
    title: 'Production Parameters',
    fields: [
      {
        key: 'capacity',
        label: 'Maximum capacity',
        type: 'number',
        unit: pcs,
        min: 1,
        step: 1,
        tooltip: 'Maximum number of pieces the buffer can store.',
      },
      {
        key: 'initialQuantity',
        label: 'Initial inventory',
        type: 'number',
        unit: pcs,
        min: 0,
        step: 1,
        tooltip: 'Pieces present in the buffer when the run starts.',
      },
      {
        key: 'minInventory',
        label: 'Minimum inventory',
        type: 'number',
        unit: pcs,
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded target minimum stock level. Reorder control is a future enhancement.',
      },
      {
        key: 'maxWaitingTimeSeconds',
        label: 'Maximum waiting time',
        type: 'number',
        unit: 's',
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded maximum permitted waiting duration.',
      },
      {
        key: 'maxLoadKg',
        label: 'Maximum load',
        type: 'number',
        unit: 'kg',
        min: 0,
        step: 10,
        spec: true,
        tooltip: 'Recorded maximum supported mass.',
      },
    ],
  },
  { title: 'Live Metrics', fields: BUFFER_LIVE },
];

const OUTPUT_SECTIONS = [
  {
    title: 'Operational Parameters',
    fields: [
      {
        key: 'acceptsRejected',
        label: 'Accepts rejected products',
        type: 'boolean',
        onLabel: 'Accepted / enabled',
        offLabel: 'Excluded / disabled',
        tooltip: 'When enabled, rejected pieces are stored in this output bin.',
      },
    ],
  },
  {
    title: 'Production Parameters',
    fields: [
      {
        key: 'binCapacity',
        label: 'Maximum capacity',
        type: 'number',
        unit: pcs,
        min: 1,
        step: 1,
        tooltip: 'Maximum number of finished pieces the bin can hold.',
      },
      {
        key: 'lengthM',
        label: 'Bin length',
        type: 'number',
        unit: 'm',
        min: 0,
        step: 0.05,
        spec: true,
        tooltip: 'Recorded physical bin length.',
      },
      {
        key: 'widthM',
        label: 'Bin width',
        type: 'number',
        unit: 'm',
        min: 0,
        step: 0.05,
        spec: true,
        tooltip: 'Recorded physical bin width.',
      },
      {
        key: 'heightM',
        label: 'Bin height',
        type: 'number',
        unit: 'm',
        min: 0,
        step: 0.05,
        spec: true,
        tooltip: 'Recorded physical bin height.',
      },
      {
        key: 'productUnitMassKg',
        label: 'Product unit mass',
        type: 'number',
        unit: 'kg/pc',
        min: 0,
        step: 0.1,
        spec: true,
        tooltip: 'Recorded mass of one finished piece for stored-mass display.',
      },
      {
        key: 'maxLoadKg',
        label: 'Maximum load',
        type: 'number',
        unit: 'kg',
        min: 0,
        step: 10,
        spec: true,
        tooltip: 'Recorded maximum supported mass.',
      },
    ],
  },
  { title: 'Live Metrics', fields: OUTPUT_LIVE },
];

const WORKER_SECTIONS = [
  {
    title: 'Operational Parameters',
    fields: [
      {
        key: 'skill',
        label: 'Skill level',
        type: 'text',
        tooltip: 'Employee skill or primary task used for assignment.',
      },
      {
        key: 'shiftMinutes',
        label: 'Working time per shift',
        type: 'number',
        unit: 'min',
        min: 1,
        step: 5,
        tooltip: 'Scheduled shift duration for the worker hub.',
      },
      {
        key: 'breakMinutes',
        label: 'Break duration',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Scheduled break inside each shift.',
      },
      {
        key: 'meetingMinutes',
        label: 'Meeting duration',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Scheduled meeting time inside each shift.',
      },
      {
        key: 'changeoverMinutes',
        label: 'Changeover time',
        type: 'number',
        unit: 'min',
        min: 0,
        step: 1,
        tooltip: 'Scheduled changeover time at the start of a shift.',
      },
      {
        key: 'productivity',
        label: 'Productivity assumption',
        type: 'number',
        unit: '%',
        min: 0,
        max: 100,
        step: 0.1,
        tooltip: 'Configured productivity assumption.',
      },
      {
        key: 'errorRate',
        label: 'Worker error rate',
        type: 'number',
        unit: '%',
        min: 0,
        max: 100,
        step: 0.1,
        tooltip: 'Expected worker-attributable error rate.',
      },
    ],
  },
  {
    title: 'Resource Parameters',
    fields: [
      {
        key: 'employees',
        label: 'Total assigned workers',
        type: 'number',
        unit: persons,
        min: 0,
        step: 1,
        tooltip: 'Total manpower in this worker hub.',
      },
      {
        key: 'laborCostPerHour',
        label: 'Labor cost',
        type: 'number',
        unit: 'currency/h',
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded labor cost for planning reference. Currency is configured outside the engine.',
      },
    ],
  },
  { title: 'Live Metrics', fields: WORKER_LIVE },
];

const DISPLAY_SECTIONS = [
  {
    title: 'Operational Parameters',
    fields: [
      {
        key: 'metric',
        label: 'Bound metric',
        type: 'select',
        options: [
          { value: 'bottleneck', label: 'Bottleneck' },
          { value: 'good', label: 'Good output' },
          { value: 'throughput', label: 'Throughput' },
          { value: 'utilization', label: 'Utilization' },
          { value: 'wip', label: 'Work in progress' },
          { value: 'energy', label: 'Energy' },
        ],
        tooltip: 'Metric drawn on the HMI panel.',
      },
      {
        key: 'displaySizeInch',
        label: 'Display size',
        type: 'number',
        unit: 'inch',
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded diagonal screen size.',
      },
      {
        key: 'resolutionWidth',
        label: 'Resolution width',
        type: 'number',
        unit: 'px',
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded horizontal screen resolution.',
      },
      {
        key: 'resolutionHeight',
        label: 'Resolution height',
        type: 'number',
        unit: 'px',
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded vertical screen resolution.',
      },
      {
        key: 'mountingHeightM',
        label: 'Mounting height',
        type: 'number',
        unit: 'm',
        min: 0,
        step: 0.05,
        spec: true,
        tooltip: 'Recorded mounting height above the floor.',
      },
      {
        key: 'screenOrientation',
        label: 'Screen orientation',
        type: 'number',
        unit: '°',
        step: 15,
        spec: true,
        tooltip: 'Recorded screen orientation in degrees.',
      },
    ],
  },
  {
    title: 'Energy Parameters',
    fields: [
      {
        key: 'displayPowerW',
        label: 'Power consumption',
        type: 'number',
        unit: 'W',
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded display power consumption.',
      },
      {
        key: 'operatingVoltage',
        label: 'Operating voltage',
        type: 'number',
        unit: 'V',
        min: 0,
        step: 1,
        spec: true,
        tooltip: 'Recorded display operating voltage.',
      },
    ],
  },
  { title: 'Live Metrics', fields: DISPLAY_LIVE },
];

const CHART_SECTIONS = [
  {
    title: 'Operational Parameters',
    fields: [
      {
        key: 'metric',
        label: 'Bound metric',
        type: 'select',
        options: [
          { value: 'throughput', label: 'Throughput' },
          { value: 'good', label: 'Good output' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'utilization', label: 'Utilization' },
          { value: 'wip', label: 'Work in progress' },
          { value: 'energy', label: 'Energy' },
        ],
        tooltip: 'Metric drawn by the analytic chart component.',
      },
    ],
  },
];

export const PROPERTY_SECTIONS = {
  source: SOURCE_SECTIONS,
  workstation: WORKSTATION_SECTIONS,
  inspection: INSPECTION_SECTIONS,
  conveyor: CONVEYOR_SECTIONS,
  buffer: BUFFER_SECTIONS,
  output: OUTPUT_SECTIONS,
  worker: WORKER_SECTIONS,
  display: DISPLAY_SECTIONS,
  chart: CHART_SECTIONS,
};

export function sectionsForComponent(component) {
  if (!component) return [];
  if (component.type === 'workstation' && component.props?.stationType === 'inspection') {
    return PROPERTY_SECTIONS.inspection;
  }
  return PROPERTY_SECTIONS[component.type] || [];
}

export function flatSchemaForType(type) {
  const sections = PROPERTY_SECTIONS[type] || [];
  const seen = new Set();
  const result = [];
  for (const section of sections) {
    for (const field of section.fields) {
      const key = field.key || field.id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(field);
    }
  }
  return result;
}

/** Merge several flattened schemas, keeping the first label for a repeated key. */
function mergeSchemaTypes(...types) {
  const seen = new Set();
  const result = [];
  for (const type of types) {
    for (const field of flatSchemaForType(type)) {
      const key = field.key || field.id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(field);
    }
  }
  return result;
}

/** Flattened label catalogue used by the 4M change panel. */
export const FLAT_PROPERTY_SCHEMAS = {
  source: flatSchemaForType('source'),
  workstation: mergeSchemaTypes('workstation', 'inspection'),
  conveyor: flatSchemaForType('conveyor'),
  buffer: flatSchemaForType('buffer'),
  output: flatSchemaForType('output'),
  worker: flatSchemaForType('worker'),
  display: flatSchemaForType('display'),
  chart: flatSchemaForType('chart'),
};
