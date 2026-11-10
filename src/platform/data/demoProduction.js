/**
 * Module 02 demo dataset.
 *
 * Mirrors `supabase/seed-module2.sql` so the workforce and production screens
 * behave identically in demo mode. Authorization is still computed from the
 * Module 01 role catalogue; this file only supplies rows.
 */

const iso = (offsetHours = 0) => new Date(Date.now() + offsetHours * 3600000).toISOString();
const day = (offsetDays = 0) => {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
};

const ORG_ID = 'org-indra-demo';

export const DEMO_PRODUCTS = [
  { id: 'product-axle', organizationId: ORG_ID, code: 'PRD-AXLE-01', name: 'Front axle housing', unit: 'pcs', specification: 'IS 210 / Grade FG260', standardCycleSeconds: 240, isActive: true },
  { id: 'product-bracket', organizationId: ORG_ID, code: 'PRD-BRKT-02', name: 'Weldment bracket', unit: 'pcs', specification: 'EN 10025 S355', standardCycleSeconds: 96, isActive: true },
  { id: 'product-shaft', organizationId: ORG_ID, code: 'PRD-SHAFT-03', name: 'Drive shaft', unit: 'pcs', specification: '42CrMo4', standardCycleSeconds: 310, isActive: true },
];

export const DEMO_MATERIALS = [
  { id: 'material-aluminium', organizationId: ORG_ID, code: 'MAT-ALB-01', name: 'Aluminium bar 80mm', specification: '6061-T6 extruded bar', unit: 'kg', category: 'raw', stockQuantity: 1420, reorderLevel: 400, unitCost: 312.5, isActive: true },
  { id: 'material-coolant', organizationId: ORG_ID, code: 'MAT-CLT-02', name: 'Cutting coolant', specification: 'Water soluble semi-synthetic', unit: 'l', category: 'consumable', stockQuantity: 380, reorderLevel: 120, unitCost: 148, isActive: true },
  { id: 'material-bolt', organizationId: ORG_ID, code: 'MAT-BLT-03', name: 'M8 flange bolt', specification: 'Zinc plated, 30mm', unit: 'pcs', category: 'consumable', stockQuantity: 12400, reorderLevel: 3000, unitCost: 3.2, isActive: true },
  { id: 'material-wire', organizationId: ORG_ID, code: 'MAT-WIR-04', name: 'Welding wire 1.2mm', specification: 'Copper coated G3Si1', unit: 'kg', category: 'consumable', stockQuantity: 240, reorderLevel: 80, unitCost: 210, isActive: true },
];

export const DEMO_TOOLS = [
  { id: 'tool-boring-bar', organizationId: ORG_ID, plantId: 'plant-chennai', code: 'TL-CBN-01', name: 'Carbide boring bar', toolType: 'cutting', unit: 'pcs', quantityInService: 6, status: 'in_service', machineId: 'machine-cnc-01' },
  { id: 'tool-torque', organizationId: ORG_ID, plantId: 'plant-chennai', code: 'TL-TOR-02', name: 'Torque wrench 200Nm', toolType: 'assembly', unit: 'pcs', quantityInService: 2, status: 'in_service', machineId: 'machine-robot-02' },
];

export const DEMO_PRODUCTION_ORDERS = [
  {
    id: 'po-0141', organizationId: ORG_ID, plantId: 'plant-chennai', departmentId: 'dept-production', productionLineId: 'line-machining-02',
    projectId: 'proj-oee', productId: 'product-axle', orderNo: 'PO-2026-0141', batchNo: 'B-2026-0141-A',
    quantityPlanned: 500, quantityCompleted: 46, quantityRejected: 3, priority: 'high', status: 'in_progress',
    plannedStartAt: iso(-4), plannedEndAt: iso(8), releasedAt: iso(-48), completedAt: null,
    notes: 'Axle housing batch for the OEE recovery programme.', createdByEmployeeId: 'emp-001',
  },
  {
    id: 'po-0142', organizationId: ORG_ID, plantId: 'plant-chennai', departmentId: 'dept-production', productionLineId: 'line-assembly-01',
    projectId: 'proj-twin', productId: 'product-bracket', orderNo: 'PO-2026-0142', batchNo: 'B-2026-0142-A',
    quantityPlanned: 300, quantityCompleted: 22, quantityRejected: 1, priority: 'medium', status: 'paused',
    plannedStartAt: iso(-2), plannedEndAt: iso(10), releasedAt: iso(-24), completedAt: null,
    notes: 'Bracket weldment for the assembly twin build.', createdByEmployeeId: 'emp-001',
  },
  {
    id: 'po-0139', organizationId: ORG_ID, plantId: 'plant-chennai', departmentId: 'dept-production', productionLineId: 'line-machining-02',
    projectId: 'proj-oee', productId: 'product-shaft', orderNo: 'PO-2026-0139', batchNo: 'B-2026-0139-B',
    quantityPlanned: 120, quantityCompleted: 40, quantityRejected: 2, priority: 'low', status: 'completed',
    plannedStartAt: iso(-56), plannedEndAt: iso(-30), releasedAt: iso(-72), completedAt: iso(-28),
    notes: 'Drive shaft pilot batch, closed.', createdByEmployeeId: 'emp-001',
  },
];

export const DEMO_PRODUCTION_TASKS = [
  {
    id: 'task-prod-01', organizationId: ORG_ID, assigneeEmployeeId: 'emp-003', createdByEmployeeId: 'emp-001',
    supervisorEmployeeId: 'emp-001', projectId: 'proj-oee', productionOrderId: 'po-0141',
    workstationId: 'ws-mac-010', machineId: 'machine-cnc-01', title: 'Turn axle housing batch A',
    description: 'Rough and finish turn 120 axle housings on CNC Lathe 01.', status: 'in_progress',
    priority: 'high', dueAt: iso(6), workInstructions: '1. Load bar stock per setup sheet CNC-01.\n2. Verify first-off against drawing AX-114 rev C.\n3. Record every rejected piece with the defect code.',
    productionStatus: 'in_progress', targetQuantity: 120, completedQuantity: 46, rejectedQuantity: 3,
    plannedStartAt: iso(-4), plannedEndAt: iso(6), startedAt: iso(-3), acceptedAt: iso(-4), pausedReason: null,
  },
  {
    id: 'task-prod-02', organizationId: ORG_ID, assigneeEmployeeId: 'emp-003', createdByEmployeeId: 'emp-001',
    supervisorEmployeeId: 'emp-001', projectId: 'proj-twin', productionOrderId: 'po-0142',
    workstationId: 'ws-asm-020', machineId: 'machine-robot-02', title: 'Weld bracket lot 0142',
    description: 'Robot weld 80 brackets after the fixture change.', status: 'todo',
    priority: 'medium', dueAt: iso(10), workInstructions: 'Check robot program O2201 rev 2 is loaded before starting.',
    productionStatus: 'assigned', targetQuantity: 80, completedQuantity: 0, rejectedQuantity: 0,
    plannedStartAt: iso(2), plannedEndAt: iso(10),
  },
  {
    id: 'task-prod-03', organizationId: ORG_ID, assigneeEmployeeId: 'emp-003', createdByEmployeeId: 'emp-001',
    supervisorEmployeeId: 'emp-001', projectId: 'proj-oee', productionOrderId: 'po-0141',
    workstationId: 'ws-mac-020', machineId: 'machine-cnc-01', title: 'Grind bearing journal',
    description: 'Grind journals for the axle batch.', status: 'blocked', priority: 'high', dueAt: iso(2),
    workInstructions: 'Dress the wheel before the first pass.', productionStatus: 'paused',
    targetQuantity: 60, completedQuantity: 22, rejectedQuantity: 1,
    plannedStartAt: iso(-2), plannedEndAt: iso(2), pausedReason: 'Awaiting M8 flange bolts from stores.',
  },
  {
    id: 'task-prod-04', organizationId: ORG_ID, assigneeEmployeeId: 'emp-003', createdByEmployeeId: 'emp-001',
    supervisorEmployeeId: 'emp-001', projectId: 'proj-oee', productionOrderId: 'po-0139',
    workstationId: 'ws-asm-030', machineId: 'machine-cmm-04', title: 'Inspect drive shaft pilot batch',
    description: 'CMM inspection of the 40 piece pilot batch.', status: 'done', priority: 'low',
    dueAt: iso(-24), workInstructions: 'Record roundness and runout for each piece.',
    productionStatus: 'completed', targetQuantity: 40, completedQuantity: 40, rejectedQuantity: 2,
  },
];

export const DEMO_TASK_EVENTS = [
  { id: 'task-event-1', organizationId: ORG_ID, taskId: 'task-prod-01', employeeId: 'emp-003', event: 'accepted', reason: null, createdAt: iso(-4) },
  { id: 'task-event-2', organizationId: ORG_ID, taskId: 'task-prod-01', employeeId: 'emp-003', event: 'in_progress', reason: null, createdAt: iso(-3) },
  { id: 'task-event-3', organizationId: ORG_ID, taskId: 'task-prod-03', employeeId: 'emp-003', event: 'paused', reason: 'Awaiting M8 flange bolts from stores.', createdAt: iso(-5) },
];

export const DEMO_PRODUCTION_REPORTS = [
  {
    id: 'report-1', organizationId: ORG_ID, productionOrderId: 'po-0141', taskId: 'task-prod-01', productId: 'product-axle',
    workstationId: 'ws-mac-010', machineId: 'machine-cnc-01', shiftId: 'shift-early', reportedByEmployeeId: 'emp-003',
    workDate: day(0), shiftCode: 'EARLY', batchNo: 'B-2026-0141-A', startedAt: iso(-6), endedAt: iso(-2),
    totalProduced: 32, goodPieces: 30, rejectedPieces: 2, reworkPieces: 1, downtimeMinutes: 12,
    downtimeReason: 'Coolant pressure drop', remarks: 'First half of the shift.',
  },
  {
    id: 'report-2', organizationId: ORG_ID, productionOrderId: 'po-0141', taskId: 'task-prod-01', productId: 'product-axle',
    workstationId: 'ws-mac-010', machineId: 'machine-cnc-01', shiftId: 'shift-early', reportedByEmployeeId: 'emp-003',
    workDate: day(0), shiftCode: 'EARLY', batchNo: 'B-2026-0141-A', startedAt: iso(-2), endedAt: iso(2),
    totalProduced: 17, goodPieces: 16, rejectedPieces: 1, reworkPieces: 0, downtimeMinutes: 0,
    downtimeReason: null, remarks: 'Second entry after lunch.',
  },
  {
    id: 'report-3', organizationId: ORG_ID, productionOrderId: 'po-0139', taskId: 'task-prod-04', productId: 'product-shaft',
    workstationId: 'ws-asm-030', machineId: 'machine-cmm-04', shiftId: 'shift-early', reportedByEmployeeId: 'emp-003',
    workDate: day(-1), shiftCode: 'EARLY', batchNo: 'B-2026-0139-B', startedAt: iso(-30), endedAt: iso(-22),
    totalProduced: 42, goodPieces: 40, rejectedPieces: 2, reworkPieces: 0, downtimeMinutes: 20,
    downtimeReason: 'CMM probe calibration', remarks: 'Pilot batch closed with two rejects for runout.',
  },
];

export const DEMO_REPORT_MATERIALS = [
  { id: 'report-material-1', organizationId: ORG_ID, reportId: 'report-1', materialId: 'material-aluminium', quantity: 96, unit: 'kg' },
  { id: 'report-material-2', organizationId: ORG_ID, reportId: 'report-1', materialId: 'material-coolant', quantity: 3.5, unit: 'l' },
  { id: 'report-material-3', organizationId: ORG_ID, reportId: 'report-2', materialId: 'material-aluminium', quantity: 51, unit: 'kg' },
  { id: 'report-material-4', organizationId: ORG_ID, reportId: 'report-3', materialId: 'material-bolt', quantity: 160, unit: 'pcs' },
];

export const DEMO_TECHNICAL_ISSUES = [
  {
    id: 'issue-tech-1', organizationId: ORG_ID, plantId: 'plant-chennai', departmentId: 'dept-production',
    productionLineId: 'line-machining-02', workstationId: 'ws-mac-010', machineId: 'machine-cnc-01',
    productionOrderId: 'po-0141', taskId: 'task-prod-01', reportedByEmployeeId: 'emp-003',
    category: 'Hydraulic pressure', description: 'Coolant pressure dropped below 2 bar during roughing; spindle stopped at 41% feed.',
    occurredAt: iso(-5), severity: 'high', machineState: 'down', downtimeMinutes: 45,
    productionImpact: 'Half shift of axle housings deferred.', status: 'open', assignedToEmployeeId: 'emp-008',
  },
  {
    id: 'issue-tech-2', organizationId: ORG_ID, plantId: 'plant-chennai', departmentId: 'dept-production',
    productionLineId: 'line-machining-02', workstationId: 'ws-mac-020', machineId: 'machine-cnc-01',
    productionOrderId: 'po-0141', taskId: 'task-prod-03', reportedByEmployeeId: 'emp-003',
    category: 'Spindle vibration', description: 'Audible vibration above 4000 rpm on the grinding spindle.',
    occurredAt: iso(-30), severity: 'medium', machineState: 'idle', downtimeMinutes: 25,
    productionImpact: 'Grinding task paused pending inspection.', status: 'acknowledged',
  },
];

export const DEMO_TOOL_DAMAGE = [
  {
    id: 'tool-damage-1', organizationId: ORG_ID, toolId: 'tool-boring-bar', toolName: 'Carbide boring bar',
    machineId: 'machine-cnc-01', workstationId: 'ws-mac-010', productionOrderId: 'po-0141',
    damagedQuantity: 2, unit: 'pcs', damageCategory: 'Chipping',
    description: 'Insert edge chipped on interrupted cut; two bars scrapped.',
    productionImpact: 'Replacement bars pulled from stores; no line stoppage.',
    reportedByEmployeeId: 'emp-003', status: 'open',
  },
];

export const DEMO_SAFETY_INCIDENTS = [
  {
    id: 'incident-1', organizationId: ORG_ID, plantId: 'plant-chennai', departmentId: 'dept-production',
    workstationId: 'ws-mac-010', affectedEmployeeId: 'emp-003', reportedByEmployeeId: 'emp-003',
    incidentAt: iso(-24), category: 'near_miss', severity: 'medium',
    operationalSummary: 'Coolant hose detached while the guard was open; no contact with the operator. Area made safe.',
    immediateAction: 'Machine isolated, hose clamp replaced, toolbox talk delivered.',
    lostTimeHours: 0.5, workStopped: true, status: 'under_review',
  },
];

export const DEMO_SAFETY_DETAILS = [
  {
    incidentId: 'incident-1', organizationId: ORG_ID,
    medicalNarrative: 'Operator reported no pain at the time; first aid reviewed 30 minutes later as a precaution.',
    injuryType: 'None (near miss)', bodyPart: 'Right forearm', treatmentGiven: 'Precautionary assessment only, no treatment required.',
    hospitalReferral: false, diagnosis: 'No injury recorded', fitToWork: 'Fit for full duties', restrictions: 'None',
    physicianNotes: 'Reviewed by plant physician; no follow-up required.',
  },
];

export const DEMO_SHIFT_REPORTS = [
  {
    id: 'shift-report-1', organizationId: ORG_ID, employeeId: 'emp-003', shiftId: 'shift-early', productionOrderId: 'po-0141',
    workDate: day(0), shiftCode: 'EARLY', tasksCompleted: 1, totalProduced: 49, goodPieces: 46, rejectedPieces: 3,
    machineIssueCount: 1, toolIssueCount: 1, materialShortageCount: 0,
    remainingWork: 'Grinding task still paused pending spindle inspection.',
    handoverNotes: 'Axle batch continues on the next shift. Coolant line repaired but monitor pressure for the first hour.',
    status: 'submitted', submittedAt: iso(-1), acknowledgedByEmployeeId: null, acknowledgedAt: null,
  },
  {
    id: 'shift-report-2', organizationId: ORG_ID, employeeId: 'emp-008', shiftId: 'shift-early', productionOrderId: 'po-0142',
    workDate: day(-1), shiftCode: 'EARLY', tasksCompleted: 2, totalProduced: 22, goodPieces: 21, rejectedPieces: 1,
    machineIssueCount: 0, toolIssueCount: 0, materialShortageCount: 1,
    remainingWork: 'Bracket lot awaiting M8 bolts.',
    handoverNotes: 'Stores to deliver bolts before the next shift; fixture change verified.',
    status: 'acknowledged', submittedAt: iso(-24), acknowledgedByEmployeeId: 'emp-001', acknowledgedAt: iso(-20),
  },
];

export const DEMO_SHIFT_REPORT_TASKS = [
  { reportId: 'shift-report-1', taskId: 'task-prod-01' },
  { reportId: 'shift-report-1', taskId: 'task-prod-03' },
  { reportId: 'shift-report-2', taskId: 'task-prod-02' },
];

export const DEMO_MACHINE_PROGRAMS = [
  {
    id: 'program-1', organizationId: ORG_ID, machineId: 'machine-cnc-01', programNumber: 'O1001',
    name: 'Axle housing roughing', description: 'Turning cycle for front axle housings.',
    controllerType: 'Mazatrol SmoothG', currentVersion: 2, approvedVersionId: 'program-version-2',
    status: 'approved', ownerEmployeeId: 'emp-009',
  },
  {
    id: 'program-2', organizationId: ORG_ID, machineId: 'machine-robot-02', programNumber: 'O2201',
    name: 'Bracket weld path', description: 'Robot weld path for bracket lot.',
    controllerType: 'FANUC R-30iB', currentVersion: 1, approvedVersionId: 'program-version-4',
    status: 'approved', ownerEmployeeId: 'emp-009',
  },
];

export const DEMO_PROGRAM_VERSIONS = [
  {
    id: 'program-version-1', organizationId: ORG_ID, programId: 'program-1', version: 1, status: 'superseded',
    storagePath: 'org-indra-demo/machine-cnc-01/program-1/v1.nc', fileName: 'O1001_v1.nc', mimeType: 'text/plain',
    sizeBytes: 18432, checksum: 'sha256:2f1c9a', changeSummary: 'Initial release for the QT-250.',
    revisionNotes: 'Baseline cycle verified on first-off.', productionOrderId: 'po-0141',
    createdByEmployeeId: 'emp-009', submittedAt: iso(-720), approvedByEmployeeId: 'emp-001', approvedAt: iso(-696),
    decisionNotes: 'Approved after first-off inspection.', supersededByVersionId: 'program-version-2',
  },
  {
    id: 'program-version-2', organizationId: ORG_ID, programId: 'program-1', version: 2, status: 'approved',
    storagePath: 'org-indra-demo/machine-cnc-01/program-1/v2.nc', fileName: 'O1001_v2.nc', mimeType: 'text/plain',
    sizeBytes: 19011, checksum: 'sha256:7b4e10', changeSummary: 'Raised feed by 8% and added coolant pressure check.',
    revisionNotes: 'Cycle time reduced from 240s to 226s.', productionOrderId: 'po-0141',
    createdByEmployeeId: 'emp-009', submittedAt: iso(-216), approvedByEmployeeId: 'emp-001', approvedAt: iso(-192),
    decisionNotes: 'Verified on three pieces; approved.', supersededByVersionId: null,
  },
  {
    id: 'program-version-3', organizationId: ORG_ID, programId: 'program-1', version: 3, status: 'in_review',
    storagePath: 'org-indra-demo/machine-cnc-01/program-1/v3.nc', fileName: 'O1001_v3.nc', mimeType: 'text/plain',
    sizeBytes: 19240, checksum: 'sha256:c93aa1', changeSummary: 'Tool-life improvement: reduced depth of cut on the interrupted pass.',
    revisionNotes: 'Awaiting technical review; test evidence attached.', productionOrderId: 'po-0141',
    createdByEmployeeId: 'emp-009', submittedAt: iso(-24), approvedByEmployeeId: null, approvedAt: null,
    decisionNotes: null, supersededByVersionId: null,
  },
  {
    id: 'program-version-4', organizationId: ORG_ID, programId: 'program-2', version: 1, status: 'approved',
    storagePath: 'org-indra-demo/machine-robot-02/program-2/v1.ls', fileName: 'O2201_v1.ls', mimeType: 'text/plain',
    sizeBytes: 9216, checksum: 'sha256:11ab77', changeSummary: 'Initial robot weld path.',
    revisionNotes: 'Fixture change incorporated.', productionOrderId: 'po-0142',
    createdByEmployeeId: 'emp-009', submittedAt: iso(-504), approvedByEmployeeId: 'emp-001', approvedAt: iso(-480),
    decisionNotes: 'Approved after weld coupon test.', supersededByVersionId: null,
  },
];

export const DEMO_MACHINE_AUTHORIZATIONS = [
  { id: 'machine-auth-1', organizationId: ORG_ID, employeeId: 'emp-003', machineId: 'machine-cnc-01', authorizedOn: day(-120), expiresOn: day(245), authorizedByEmployeeId: 'emp-001' },
  { id: 'machine-auth-2', organizationId: ORG_ID, employeeId: 'emp-003', machineId: 'machine-robot-02', authorizedOn: day(-120), expiresOn: day(245), authorizedByEmployeeId: 'emp-001' },
  { id: 'machine-auth-3', organizationId: ORG_ID, employeeId: 'emp-003', machineId: 'machine-cmm-04', authorizedOn: day(-60), expiresOn: null, authorizedByEmployeeId: 'emp-001' },
];

export const DEMO_REASSIGNMENTS = [
  {
    requestId: 'req-reassign-1', organizationId: ORG_ID, employeeId: 'emp-003',
    currentTaskId: 'task-prod-03', proposedTaskId: 'task-prod-02',
    currentWorkstationId: 'ws-mac-020', proposedWorkstationId: 'ws-asm-020',
    currentShiftId: 'shift-early', proposedShiftId: 'shift-early',
    competencyRequirements: 'Robot welding authorization and current machine authorization for CHN-ROB-002.',
    reason: 'Grinding is blocked on spindle inspection; the weld cell needs a second operator for lot 0142.',
    effectiveAt: iso(30), status: 'submitted', approvedByEmployeeId: null, decidedAt: null,
    appliedAt: null, createdByEmployeeId: 'emp-008',
  },
];

export const DEMO_MATERIAL_REQUESTS = [
  {
    requestId: 'req-material-1', organizationId: ORG_ID, materialId: 'material-bolt', specification: 'Zinc plated, 30mm',
    requiredQuantity: 800, unit: 'pcs', availableQuantity: 60, requiredBy: iso(6),
    productionOrderId: 'po-0142', reason: 'M8 bolts exhausted before the bracket lot could restart.',
  },
];

/** Merge the Module 02 collections into the Module 01 demo dataset. */
export function withProductionDemo(base) {
  return {
    ...base,
    products: DEMO_PRODUCTS,
    materials: DEMO_MATERIALS,
    tools: DEMO_TOOLS,
    productionOrders: DEMO_PRODUCTION_ORDERS,
    productionTasks: DEMO_PRODUCTION_TASKS,
    taskEvents: DEMO_TASK_EVENTS,
    productionReports: DEMO_PRODUCTION_REPORTS,
    reportMaterials: DEMO_REPORT_MATERIALS,
    technicalIssues: DEMO_TECHNICAL_ISSUES,
    toolDamageReports: DEMO_TOOL_DAMAGE,
    safetyIncidents: DEMO_SAFETY_INCIDENTS,
    safetyIncidentDetails: DEMO_SAFETY_DETAILS,
    shiftReports: DEMO_SHIFT_REPORTS,
    shiftReportTasks: DEMO_SHIFT_REPORT_TASKS,
    machinePrograms: DEMO_MACHINE_PROGRAMS,
    programVersions: DEMO_PROGRAM_VERSIONS,
    machineAuthorizations: DEMO_MACHINE_AUTHORIZATIONS,
    reassignmentRequests: DEMO_REASSIGNMENTS,
    materialRequests: DEMO_MATERIAL_REQUESTS,
  };
}
