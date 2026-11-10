import { ROLES, ROLE_BY_KEY } from './accessControl.js';
import { addDays, dateKey, evaluateAttendance, isWorkingDay, shiftWindow } from '../lib/shift.js';
import { withProductionDemo } from './demoProduction.js';

/**
 * Deterministic demo dataset used when Supabase environment variables are absent.
 * It mirrors `supabase/seed.sql` in shape and demonstrates scoped, multi-role
 * authorization. Real deployments never consult this file for authorization:
 * the same rules live in PostgreSQL RLS policies and protected RPCs.
 */

const ORG_ID = 'org-indra-demo';
const CHENNAI = 'plant-chennai';
const PUNE = 'plant-pune';

export const DEMO_PASSWORD = 'IndraDemo!2026';

const today = () => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

const dayOffset = (offset) => dateKey(addDays(today(), offset));

function roleAssignment(employeeId, roleKey) {
  const role = ROLE_BY_KEY[roleKey];
  return {
    id: `user-role-${employeeId}-${roleKey}`,
    employeeId,
    roleId: `role-${roleKey}`,
    roleKey,
    roleName: role.name,
    level: role.level,
    assignedAt: '2026-01-05T09:00:00.000Z',
  };
}

const ORGANIZATION = {
  id: ORG_ID,
  name: 'INDRA Industrial Systems',
  legalName: 'INDRA Industrial Systems Private Limited',
  code: 'INDRA',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  locale: 'en-IN',
  website: 'https://indra.example',
  supportEmail: 'support@indra.example',
  supportPhone: '+91 44 4000 1200',
  address: 'Plot 14, Ambattur Industrial Estate, Chennai 600058, India',
  createdAt: '2025-11-02T04:00:00.000Z',
};

const PLANTS = [
  {
    id: CHENNAI,
    organizationId: ORG_ID,
    name: 'Chennai Plant',
    code: 'PLT-CHN',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    timezone: 'Asia/Kolkata',
    address: 'Ambattur Industrial Estate, Chennai 600058',
    isActive: true,
    headEmployeeId: 'emp-001',
  },
  {
    id: PUNE,
    organizationId: ORG_ID,
    name: 'Pune Plant',
    code: 'PLT-PUN',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    timezone: 'Asia/Kolkata',
    address: 'Chakan MIDC, Pune 410501',
    isActive: true,
    headEmployeeId: 'emp-006',
  },
];

const DEPARTMENTS = [
  { id: 'dept-production', organizationId: ORG_ID, plantId: CHENNAI, name: 'Production', code: 'PROD', costCenter: 'CC-1001', managerEmployeeId: 'emp-001' },
  { id: 'dept-maintenance', organizationId: ORG_ID, plantId: CHENNAI, name: 'Maintenance', code: 'MAINT', costCenter: 'CC-1002', managerEmployeeId: 'emp-008' },
  { id: 'dept-quality', organizationId: ORG_ID, plantId: CHENNAI, name: 'Quality', code: 'QUAL', costCenter: 'CC-1003', managerEmployeeId: 'emp-005' },
  { id: 'dept-hr', organizationId: ORG_ID, plantId: CHENNAI, name: 'Human Resources', code: 'HR', costCenter: 'CC-2001', managerEmployeeId: 'emp-004' },
  { id: 'dept-finance', organizationId: ORG_ID, plantId: CHENNAI, name: 'Finance & Accounts', code: 'FIN', costCenter: 'CC-2002', managerEmployeeId: 'emp-007' },
  { id: 'dept-ehs', organizationId: ORG_ID, plantId: CHENNAI, name: 'Environment, Health & Safety', code: 'EHS', costCenter: 'CC-2003', managerEmployeeId: 'emp-010' },
  { id: 'dept-engineering', organizationId: ORG_ID, plantId: CHENNAI, name: 'Engineering', code: 'ENG', costCenter: 'CC-1004', managerEmployeeId: 'emp-009' },
  { id: 'dept-planning', organizationId: ORG_ID, plantId: PUNE, name: 'Planning', code: 'PLAN', costCenter: 'CC-3001', managerEmployeeId: 'emp-011' },
  { id: 'dept-customer', organizationId: ORG_ID, plantId: CHENNAI, name: 'Customer Projects', code: 'CUST', costCenter: 'CC-3002', managerEmployeeId: 'emp-001' },
];

const PRODUCTION_LINES = [
  { id: 'line-assembly-01', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', name: 'Assembly Line 01', code: 'CHN-ASM-01', status: 'running', shiftPattern: 'three_shift' },
  { id: 'line-machining-02', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', name: 'Machining Line 02', code: 'CHN-MAC-02', status: 'running', shiftPattern: 'two_shift' },
  { id: 'line-press-03', organizationId: ORG_ID, plantId: PUNE, departmentId: 'dept-production', name: 'Press Line 03', code: 'PUN-PRS-03', status: 'idle', shiftPattern: 'general' },
];

const WORKSTATIONS = [
  { id: 'ws-asm-010', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', productionLineId: 'line-assembly-01', name: 'Frame Fit-up', code: 'ASM-010', stationType: 'assembly', sequence: 10 },
  { id: 'ws-asm-020', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', productionLineId: 'line-assembly-01', name: 'Robot Welding', code: 'ASM-020', stationType: 'welding', sequence: 20 },
  { id: 'ws-asm-030', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', productionLineId: 'line-assembly-01', name: 'Final Inspection', code: 'ASM-030', stationType: 'inspection', sequence: 30 },
  { id: 'ws-mac-010', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', productionLineId: 'line-machining-02', name: 'CNC Turning', code: 'MAC-010', stationType: 'machining', sequence: 10 },
  { id: 'ws-mac-020', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', productionLineId: 'line-machining-02', name: 'Grinding', code: 'MAC-020', stationType: 'machining', sequence: 20 },
  { id: 'ws-press-010', organizationId: ORG_ID, plantId: PUNE, departmentId: 'dept-production', productionLineId: 'line-press-03', name: 'Hydraulic Press', code: 'PRS-010', stationType: 'press', sequence: 10 },
];

const MACHINES = [
  { id: 'machine-cnc-01', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', workstationId: 'ws-mac-010', name: 'CNC Lathe 01', assetTag: 'CHN-CNC-001', manufacturer: 'Mazak', model: 'QT-250', status: 'running', criticality: 'high' },
  { id: 'machine-robot-02', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', workstationId: 'ws-asm-020', name: 'Welding Robot 02', assetTag: 'CHN-ROB-002', manufacturer: 'FANUC', model: 'ARC Mate 120iD', status: 'running', criticality: 'high' },
  { id: 'machine-press-03', organizationId: ORG_ID, plantId: PUNE, departmentId: 'dept-production', workstationId: 'ws-press-010', name: 'Hydraulic Press 03', assetTag: 'PUN-PRS-003', manufacturer: 'Godrej', model: 'H-Press 250T', status: 'idle', criticality: 'medium' },
  { id: 'machine-cmm-04', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-quality', workstationId: 'ws-asm-030', name: 'CMM Station 04', assetTag: 'CHN-CMM-004', manufacturer: 'Zeiss', model: 'Contura', status: 'running', criticality: 'medium' },
];

const JOB_CATEGORIES = [
  { id: 'jc-management', organizationId: ORG_ID, name: 'Management', code: 'MGMT', description: 'Plant and departmental leadership' },
  { id: 'jc-engineering', organizationId: ORG_ID, name: 'Engineering', code: 'ENGG', description: 'Technical engineering and programming' },
  { id: 'jc-skilled', organizationId: ORG_ID, name: 'Skilled trade', code: 'SKILL', description: 'Certified machine operators and technicians' },
  { id: 'jc-semi-skilled', organizationId: ORG_ID, name: 'Semi-skilled', code: 'SEMI', description: 'Assisted production and material handling' },
  { id: 'jc-analytical', organizationId: ORG_ID, name: 'Analytical', code: 'ANLY', description: 'Planning, quality and business analysis' },
  { id: 'jc-support', organizationId: ORG_ID, name: 'Support', code: 'SUPP', description: 'HR, finance, EHS and administrative support' },
];

const DESIGNATIONS = [
  { id: 'des-plant-head', organizationId: ORG_ID, title: 'Plant Head', level: 'leadership', jobCategoryId: 'jc-management' },
  { id: 'des-hod', organizationId: ORG_ID, title: 'Head of Department', level: 'leadership', jobCategoryId: 'jc-management' },
  { id: 'des-supervisor', organizationId: ORG_ID, title: 'Production Supervisor', level: 'supervisory', jobCategoryId: 'jc-management' },
  { id: 'des-operator', organizationId: ORG_ID, title: 'Senior CNC Operator', level: 'skilled', jobCategoryId: 'jc-skilled' },
  { id: 'des-programmer', organizationId: ORG_ID, title: 'CNC Programmer', level: 'engineering', jobCategoryId: 'jc-engineering' },
  { id: 'des-quality', organizationId: ORG_ID, title: 'Quality Engineer', level: 'engineering', jobCategoryId: 'jc-analytical' },
  { id: 'des-hr', organizationId: ORG_ID, title: 'HR Analyst', level: 'analyst', jobCategoryId: 'jc-support' },
  { id: 'des-finance', organizationId: ORG_ID, title: 'Finance Analyst', level: 'analyst', jobCategoryId: 'jc-support' },
  { id: 'des-ehs', organizationId: ORG_ID, title: 'EHS Officer', level: 'engineering', jobCategoryId: 'jc-support' },
  { id: 'des-tech-analyst', organizationId: ORG_ID, title: 'Technical Analyst', level: 'analyst', jobCategoryId: 'jc-analytical' },
  { id: 'des-tech-assistant', organizationId: ORG_ID, title: 'Technical Assistant', level: 'support', jobCategoryId: 'jc-support' },
  { id: 'des-material', organizationId: ORG_ID, title: 'Material Analyst', level: 'analyst', jobCategoryId: 'jc-analytical' },
  { id: 'des-verification', organizationId: ORG_ID, title: 'Verification Engineer', level: 'engineering', jobCategoryId: 'jc-analytical' },
  { id: 'des-customer', organizationId: ORG_ID, title: 'Customer Approver', level: 'external', jobCategoryId: 'jc-analytical' },
];

const RAW_EMPLOYEES = [
  {
    id: 'emp-001', employeeCode: 'IND-0001', firstName: 'Ananya', lastName: 'Rao', email: 'ananya.rao@indra.example',
    personalEmail: 'ananya.rao@example.in', phone: '+91 98400 11001', designationId: 'des-hod', departmentId: 'dept-production',
    plantId: CHENNAI, productionLineId: 'line-assembly-01', jobCategoryId: 'jc-management', reportingManagerId: 'emp-002',
    employmentStatus: 'active', joinedOn: '2018-06-11', shiftId: 'shift-general', location: 'Chennai',
    roles: ['hod', 'supervisor'], employmentType: 'full_time', workMode: 'onsite',
  },
  {
    id: 'emp-002', employeeCode: 'IND-0002', firstName: 'Rajesh', lastName: 'Kumar', email: 'admin@indra.example',
    personalEmail: 'rajesh.kumar@example.in', phone: '+91 98400 11002', designationId: 'des-plant-head', departmentId: 'dept-production',
    plantId: CHENNAI, productionLineId: null, jobCategoryId: 'jc-management', reportingManagerId: null,
    employmentStatus: 'active', joinedOn: '2015-02-16', shiftId: 'shift-general', location: 'Chennai',
    roles: ['administrator', 'plant_head'], employmentType: 'full_time', workMode: 'onsite',
  },
  {
    id: 'emp-003', employeeCode: 'IND-0003', firstName: 'Arjun', lastName: 'Mehta', email: 'arjun.mehta@indra.example',
    personalEmail: 'arjun.mehta@example.in', phone: '+91 98400 11003', designationId: 'des-operator', departmentId: 'dept-production',
    plantId: CHENNAI, productionLineId: 'line-machining-02', jobCategoryId: 'jc-skilled', reportingManagerId: 'emp-001',
    employmentStatus: 'active', joinedOn: '2021-09-06', shiftId: 'shift-night', location: 'Chennai',
    roles: ['operator'], employmentType: 'full_time', workMode: 'onsite',
  },
  {
    id: 'emp-004', employeeCode: 'IND-0004', firstName: 'Priya', lastName: 'Nair', email: 'priya.nair@indra.example',
    personalEmail: 'priya.nair@example.in', phone: '+91 98400 11004', designationId: 'des-hr', departmentId: 'dept-hr',
    plantId: CHENNAI, productionLineId: null, jobCategoryId: 'jc-support', reportingManagerId: 'emp-002',
    employmentStatus: 'active', joinedOn: '2019-11-18', shiftId: 'shift-general', location: 'Chennai',
    roles: ['hr_analyst'], employmentType: 'full_time', workMode: 'hybrid',
  },
  {
    id: 'emp-005', employeeCode: 'IND-0005', firstName: 'Vikram', lastName: 'Singh', email: 'vikram.singh@indra.example',
    personalEmail: 'vikram.singh@example.in', phone: '+91 98220 11005', designationId: 'des-quality', departmentId: 'dept-quality',
    plantId: PUNE, productionLineId: 'line-press-03', jobCategoryId: 'jc-analytical', reportingManagerId: 'emp-006',
    employmentStatus: 'active', joinedOn: '2020-03-02', shiftId: 'shift-general', location: 'Pune',
    roles: ['quality_engineer', 'verification_engineer'], employmentType: 'full_time', workMode: 'onsite',
  },
  {
    id: 'emp-006', employeeCode: 'IND-0006', firstName: 'Suresh', lastName: 'Menon', email: 'suresh.menon@indra.example',
    personalEmail: 'suresh.menon@example.in', phone: '+91 98220 11006', designationId: 'des-plant-head', departmentId: 'dept-production',
    plantId: PUNE, productionLineId: null, jobCategoryId: 'jc-management', reportingManagerId: 'emp-002',
    employmentStatus: 'active', joinedOn: '2016-08-22', shiftId: 'shift-general', location: 'Pune',
    roles: ['plant_head'], employmentType: 'full_time', workMode: 'onsite',
  },
  {
    id: 'emp-007', employeeCode: 'IND-0007', firstName: 'Meera', lastName: 'Iyer', email: 'meera.iyer@indra.example',
    personalEmail: 'meera.iyer@example.in', phone: '+91 98400 11007', designationId: 'des-finance', departmentId: 'dept-finance',
    plantId: CHENNAI, productionLineId: null, jobCategoryId: 'jc-support', reportingManagerId: 'emp-002',
    employmentStatus: 'active', joinedOn: '2020-07-13', shiftId: 'shift-general', location: 'Chennai',
    roles: ['finance'], employmentType: 'full_time', workMode: 'hybrid',
  },
  {
    id: 'emp-008', employeeCode: 'IND-0008', firstName: 'Karthik', lastName: 'Subramanian', email: 'karthik.subramanian@indra.example',
    personalEmail: 'karthik.s@example.in', phone: '+91 98400 11008', designationId: 'des-supervisor', departmentId: 'dept-production',
    plantId: CHENNAI, productionLineId: 'line-machining-02', jobCategoryId: 'jc-management', reportingManagerId: 'emp-001',
    employmentStatus: 'active', joinedOn: '2019-01-21', shiftId: 'shift-early', location: 'Chennai',
    roles: ['supervisor'], employmentType: 'full_time', workMode: 'onsite',
  },
  {
    id: 'emp-009', employeeCode: 'IND-0009', firstName: 'Divya', lastName: 'Sharma', email: 'divya.sharma@indra.example',
    personalEmail: 'divya.sharma@example.in', phone: '+91 98400 11009', designationId: 'des-programmer', departmentId: 'dept-engineering',
    plantId: CHENNAI, productionLineId: 'line-assembly-01', jobCategoryId: 'jc-engineering', reportingManagerId: 'emp-001',
    employmentStatus: 'active', joinedOn: '2022-04-04', shiftId: 'shift-general', location: 'Chennai',
    roles: ['programmer'], employmentType: 'full_time', workMode: 'hybrid',
  },
  {
    id: 'emp-010', employeeCode: 'IND-0010', firstName: 'Rahul', lastName: 'Verma', email: 'rahul.verma@indra.example',
    personalEmail: 'rahul.verma@example.in', phone: '+91 98400 11010', designationId: 'des-ehs', departmentId: 'dept-ehs',
    plantId: CHENNAI, productionLineId: null, jobCategoryId: 'jc-support', reportingManagerId: 'emp-002',
    employmentStatus: 'active', joinedOn: '2021-02-08', shiftId: 'shift-general', location: 'Chennai',
    roles: ['ehs_officer'], employmentType: 'full_time', workMode: 'onsite',
  },
  {
    id: 'emp-011', employeeCode: 'IND-0011', firstName: 'Nisha', lastName: 'Patel', email: 'nisha.patel@indra.example',
    personalEmail: 'nisha.patel@example.in', phone: '+91 98220 11011', designationId: 'des-tech-analyst', departmentId: 'dept-planning',
    plantId: PUNE, productionLineId: null, jobCategoryId: 'jc-analytical', reportingManagerId: 'emp-006',
    employmentStatus: 'active', joinedOn: '2022-10-10', shiftId: 'shift-general', location: 'Pune',
    roles: ['technical_analyst'], employmentType: 'full_time', workMode: 'hybrid',
  },
  {
    id: 'emp-012', employeeCode: 'IND-0012', firstName: 'Farhan', lastName: 'Ali', email: 'farhan.ali@indra.example',
    personalEmail: 'farhan.ali@example.in', phone: '+91 98400 11012', designationId: 'des-material', departmentId: 'dept-production',
    plantId: CHENNAI, productionLineId: 'line-machining-02', jobCategoryId: 'jc-analytical', reportingManagerId: 'emp-001',
    employmentStatus: 'on_leave', joinedOn: '2020-12-01', shiftId: 'shift-general', location: 'Chennai',
    roles: ['material_analyst'], employmentType: 'full_time', workMode: 'onsite',
  },
  {
    id: 'emp-013', employeeCode: 'IND-0013', firstName: 'Lakshmi', lastName: 'Narayanan', email: 'lakshmi.narayanan@indra.example',
    personalEmail: 'lakshmi.n@example.in', phone: '+91 98400 11013', designationId: 'des-tech-assistant', departmentId: 'dept-engineering',
    plantId: CHENNAI, productionLineId: 'line-assembly-01', jobCategoryId: 'jc-support', reportingManagerId: 'emp-001',
    employmentStatus: 'active', joinedOn: '2023-05-15', shiftId: 'shift-general', location: 'Chennai',
    roles: ['technical_assistant'], employmentType: 'full_time', workMode: 'onsite',
  },
  {
    id: 'emp-014', employeeCode: 'IND-0014', firstName: 'Aditya', lastName: 'Bose', email: 'aditya.bose@indra.example',
    personalEmail: 'aditya.bose@example.in', phone: '+91 98220 11014', designationId: 'des-verification', departmentId: 'dept-quality',
    plantId: PUNE, productionLineId: 'line-press-03', jobCategoryId: 'jc-analytical', reportingManagerId: 'emp-006',
    employmentStatus: 'active', joinedOn: '2021-08-30', shiftId: 'shift-general', location: 'Pune',
    roles: ['verification_engineer'], employmentType: 'full_time', workMode: 'hybrid',
  },
  {
    id: 'emp-015', employeeCode: 'IND-C001', firstName: 'Elena', lastName: 'Fischer', email: 'customer@partner.example',
    personalEmail: 'elena.fischer@partner.example', phone: '+49 151 2200 4415', designationId: 'des-customer', departmentId: 'dept-customer',
    plantId: CHENNAI, productionLineId: null, jobCategoryId: 'jc-analytical', reportingManagerId: 'emp-001',
    employmentStatus: 'active', joinedOn: '2026-01-12', shiftId: 'shift-general', location: 'Customer site',
    roles: ['customer_approver'], employmentType: 'external', workMode: 'remote',
  },
];

export const DEMO_ACCOUNTS = [
  { employeeId: 'emp-002', email: 'admin@indra.example', label: 'Administrator · Chennai', roles: ['Administrator', 'Plant Head'], password: DEMO_PASSWORD },
  { employeeId: 'emp-001', email: 'ananya.rao@indra.example', label: 'HOD Production · Chennai', roles: ['HOD', 'Supervisor'], password: DEMO_PASSWORD },
  { employeeId: 'emp-003', email: 'arjun.mehta@indra.example', label: 'Operator · Night shift', roles: ['Operator'], password: DEMO_PASSWORD },
  { employeeId: 'emp-004', email: 'priya.nair@indra.example', label: 'HR Analyst · Chennai', roles: ['HR Analyst'], password: DEMO_PASSWORD },
  { employeeId: 'emp-005', email: 'vikram.singh@indra.example', label: 'Quality Engineer · Pune', roles: ['Quality Engineer', 'Verification Engineer'], password: DEMO_PASSWORD },
  { employeeId: 'emp-008', email: 'karthik.subramanian@indra.example', label: 'Supervisor · Machining', roles: ['Supervisor'], password: DEMO_PASSWORD },
  { employeeId: 'emp-009', email: 'divya.sharma@indra.example', label: 'Programmer · Digital twin', roles: ['Programmer'], password: DEMO_PASSWORD },
  { employeeId: 'emp-010', email: 'rahul.verma@indra.example', label: 'EHS Officer · Pune', roles: ['EHS Officer'], password: DEMO_PASSWORD },
  { employeeId: 'emp-015', email: 'customer@partner.example', label: 'Customer Approver · External', roles: ['Customer Approver'], password: DEMO_PASSWORD },
];

const SHIFTS = [
  {
    id: 'shift-general', organizationId: ORG_ID, plantId: null, departmentId: null, code: 'GEN', name: 'General shift',
    startTime: '09:00', endTime: '18:00', timezone: 'Asia/Kolkata', lunchStart: '13:00', lunchEnd: '13:30',
    graceMinutes: 10, overtimePolicy: 'manager_approval', overtimeMultiplier: 1.5,
    weeklyWorkingDays: [1, 2, 3, 4, 5], effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    color: '#cdf22b',
    breaks: [
      { id: 'break-gen-1', name: 'Morning break', startTime: '11:00', endTime: '11:15', isPaid: true },
      { id: 'break-gen-2', name: 'Afternoon break', startTime: '16:00', endTime: '16:10', isPaid: true },
    ],
  },
  {
    id: 'shift-early', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', code: 'EARLY', name: 'Early shift',
    startTime: '06:00', endTime: '14:00', timezone: 'Asia/Kolkata', lunchStart: '10:00', lunchEnd: '10:30',
    graceMinutes: 10, overtimePolicy: 'after_shift', overtimeMultiplier: 1.5,
    weeklyWorkingDays: [1, 2, 3, 4, 5, 6], effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    color: '#8fa3b8',
    breaks: [{ id: 'break-early-1', name: 'Tea break', startTime: '08:00', endTime: '08:15', isPaid: true }],
  },
  {
    id: 'shift-night', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', code: 'NIGHT', name: 'Night shift',
    startTime: '22:00', endTime: '06:00', timezone: 'Asia/Kolkata', lunchStart: '02:00', lunchEnd: '02:30',
    graceMinutes: 15, overtimePolicy: 'after_shift', overtimeMultiplier: 1.75,
    weeklyWorkingDays: [1, 2, 3, 4, 5], effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true,
    color: '#a69fb6',
    breaks: [{ id: 'break-night-1', name: 'Midnight break', startTime: '00:00', endTime: '00:20', isPaid: true }],
  },
  {
    id: 'shift-rotating', organizationId: ORG_ID, plantId: PUNE, departmentId: 'dept-production', code: 'ROT', name: 'Rotating shift',
    startTime: '08:00', endTime: '20:00', timezone: 'Asia/Kolkata', lunchStart: '12:30', lunchEnd: '13:15',
    graceMinutes: 10, overtimePolicy: 'weekly', overtimeMultiplier: 1.5,
    weeklyWorkingDays: [1, 2, 3, 4], effectiveFrom: '2026-04-01', effectiveTo: null, isActive: true,
    color: '#d9b45b',
    breaks: [
      { id: 'break-rot-1', name: 'Tea break', startTime: '10:30', endTime: '10:45', isPaid: true },
      { id: 'break-rot-2', name: 'Evening break', startTime: '16:30', endTime: '16:45', isPaid: true },
    ],
  },
];

const CURRENT_ASSIGNMENTS = [
  ['emp-001', 'shift-general', -320, null],
  ['emp-002', 'shift-general', -320, null],
  ['emp-003', 'shift-night', -40, 21],
  ['emp-003', 'shift-early', 22, null],
  ['emp-004', 'shift-general', -320, null],
  ['emp-005', 'shift-general', -320, null],
  ['emp-006', 'shift-general', -320, null],
  ['emp-007', 'shift-general', -320, null],
  ['emp-008', 'shift-early', -320, null],
  ['emp-009', 'shift-general', -320, null],
  ['emp-010', 'shift-general', -320, null],
  ['emp-011', 'shift-general', -320, null],
  ['emp-012', 'shift-general', -320, null],
  ['emp-013', 'shift-general', -320, null],
  ['emp-014', 'shift-general', -320, null],
  ['emp-015', 'shift-general', -320, null],
];

const SKILLS = [
  { id: 'skill-cnc', organizationId: ORG_ID, name: 'CNC operation', category: 'Machining', description: 'Fanuc-controlled turning and milling' },
  { id: 'skill-welding', organizationId: ORG_ID, name: 'Robotic welding', category: 'Assembly', description: 'FANUC arc welding cell operation' },
  { id: 'skill-quality', organizationId: ORG_ID, name: 'GD&T inspection', category: 'Quality', description: 'Geometric dimensioning and tolerancing' },
  { id: 'skill-cmm', organizationId: ORG_ID, name: 'CMM programming', category: 'Quality', description: 'Zeiss Calypso programming' },
  { id: 'skill-lean', organizationId: ORG_ID, name: 'Lean manufacturing', category: 'Operations', description: 'Value-stream and 5S facilitation' },
  { id: 'skill-safety', organizationId: ORG_ID, name: 'Machine safety', category: 'EHS', description: 'LOTO and machine guarding assessment' },
  { id: 'skill-sap', organizationId: ORG_ID, name: 'SAP production planning', category: 'Systems', description: 'Production orders and confirmations' },
  { id: 'skill-solidworks', organizationId: ORG_ID, name: 'SolidWorks', category: 'Engineering', description: 'Fixture and layout design' },
  { id: 'skill-reporting', organizationId: ORG_ID, name: 'Operational reporting', category: 'Analytics', description: 'OEE, downtime and workforce reporting' },
  { id: 'skill-first-aid', organizationId: ORG_ID, name: 'First aid', category: 'EHS', description: 'Emergency response and first aid' },
];

const CERTIFICATIONS = [
  { id: 'cert-sixsigma', organizationId: ORG_ID, name: 'Six Sigma Green Belt', issuingBody: 'ASQ', validityMonths: 36 },
  { id: 'cert-cnc', organizationId: ORG_ID, name: 'CNC Machining Level 3', issuingBody: 'NIMS', validityMonths: 48 },
  { id: 'cert-safety', organizationId: ORG_ID, name: 'Industrial Safety Practitioner', issuingBody: 'NEBOSH', validityMonths: 24 },
  { id: 'cert-welding', organizationId: ORG_ID, name: 'Robotic Welding Specialist', issuingBody: 'FANUC Academy', validityMonths: 36 },
  { id: 'cert-cmm', organizationId: ORG_ID, name: 'CMM Inspection Specialist', issuingBody: 'Zeiss Academy', validityMonths: 36 },
  { id: 'cert-audit', organizationId: ORG_ID, name: 'ISO 9001 Internal Auditor', issuingBody: 'TÜV SÜD', validityMonths: 36 },
];

const EMPLOYEE_SKILLS = [
  ['emp-001', 'skill-lean', 5, true], ['emp-001', 'skill-reporting', 5, true], ['emp-001', 'skill-safety', 4, true],
  ['emp-002', 'skill-lean', 5, true], ['emp-002', 'skill-reporting', 4, true],
  ['emp-003', 'skill-cnc', 4, true], ['emp-003', 'skill-safety', 4, true],
  ['emp-004', 'skill-reporting', 4, true], ['emp-004', 'skill-lean', 3, true],
  ['emp-005', 'skill-quality', 5, true], ['emp-005', 'skill-cmm', 4, true], ['emp-005', 'skill-reporting', 4, true],
  ['emp-006', 'skill-lean', 5, true], ['emp-006', 'skill-reporting', 4, true],
  ['emp-007', 'skill-reporting', 4, true],
  ['emp-008', 'skill-cnc', 4, true], ['emp-008', 'skill-safety', 4, true], ['emp-008', 'skill-lean', 3, true],
  ['emp-009', 'skill-cnc', 5, true], ['emp-009', 'skill-solidworks', 4, true],
  ['emp-010', 'skill-safety', 5, true], ['emp-010', 'skill-first-aid', 5, true],
  ['emp-011', 'skill-reporting', 4, true], ['emp-011', 'skill-sap', 3, false],
  ['emp-012', 'skill-sap', 4, true], ['emp-012', 'skill-lean', 3, true],
  ['emp-013', 'skill-solidworks', 3, false],
  ['emp-014', 'skill-quality', 5, true], ['emp-014', 'skill-cmm', 4, true],
];

const EMPLOYEE_CERTIFICATIONS = [
  ['emp-001', 'cert-sixsigma', '2024-05-10', '2027-05-10', 'verified'],
  ['emp-003', 'cert-cnc', '2023-11-20', '2027-11-20', 'verified'],
  ['emp-005', 'cert-cmm', '2024-02-14', '2027-02-14', 'verified'],
  ['emp-005', 'cert-audit', '2025-01-09', '2028-01-09', 'verified'],
  ['emp-008', 'cert-sixsigma', '2025-08-11', '2028-08-11', 'verified'],
  ['emp-009', 'cert-cnc', '2022-09-01', '2026-09-01', 'expired'],
  ['emp-010', 'cert-safety', '2024-06-18', '2026-06-18', 'expired'],
  ['emp-014', 'cert-audit', '2025-03-12', '2028-03-12', 'verified'],
];

const PROJECTS = [
  { id: 'proj-twin', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-engineering', code: 'PRJ-TWIN', name: 'Assembly line digital twin', description: 'Validated digital twin for assembly line capacity and change approval.', status: 'active', managerEmployeeId: 'emp-009', startDate: '2026-04-01', endDate: '2027-03-31', progress: 68 },
  { id: 'proj-oee', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-production', code: 'PRJ-OEE', name: 'OEE recovery programme', description: 'Recover machining line OEE from 61% to 75%.', status: 'active', managerEmployeeId: 'emp-001', startDate: '2026-07-01', endDate: '2027-06-30', progress: 42 },
  { id: 'proj-safety', organizationId: ORG_ID, plantId: PUNE, departmentId: 'dept-ehs', code: 'PRJ-EHS', name: 'Machine guarding upgrade', description: 'Guard and interlock upgrade across press shop.', status: 'active', managerEmployeeId: 'emp-010', startDate: '2026-08-15', endDate: '2027-02-28', progress: 55 },
  { id: 'proj-customer', organizationId: ORG_ID, plantId: CHENNAI, departmentId: 'dept-customer', code: 'PRJ-CUS', name: 'Customer PPAP evidence pack', description: 'Consolidated evidence and approval trail for new programme.', status: 'at_risk', managerEmployeeId: 'emp-002', startDate: '2026-09-01', endDate: '2026-12-15', progress: 36 },
];

const HOLIDAYS = [
  { id: 'holiday-1', organizationId: ORG_ID, plantId: null, name: 'Diwali', holidayDate: '2026-11-08', isOptional: false },
  { id: 'holiday-2', organizationId: ORG_ID, plantId: null, name: 'Christmas', holidayDate: '2026-12-25', isOptional: false },
  { id: 'holiday-3', organizationId: ORG_ID, plantId: null, name: 'New Year', holidayDate: '2027-01-01', isOptional: false },
  { id: 'holiday-4', organizationId: ORG_ID, plantId: CHENNAI, name: 'Pongal', holidayDate: '2027-01-15', isOptional: false },
  { id: 'holiday-5', organizationId: ORG_ID, plantId: null, name: 'Republic Day', holidayDate: '2027-01-26', isOptional: false },
  { id: 'holiday-6', organizationId: ORG_ID, plantId: null, name: 'Holi', holidayDate: '2027-03-03', isOptional: true },
];

function buildAttendance(employees, shiftsById) {
  const records = [];
  const leave = [
    { employeeId: 'emp-001', startDate: '2026-11-20', endDate: '2026-11-21' },
    { employeeId: 'emp-012', startDate: dayOffset(-4), endDate: dayOffset(-1) },
    { employeeId: 'emp-004', startDate: dayOffset(-8), endDate: dayOffset(-8) },
  ];
  employees.forEach((employee, employeeIndex) => {
    const shift = shiftsById[employee.shiftId];
    if (!shift) return;
    for (let offset = -35; offset <= 6; offset += 1) {
      const date = addDays(today(), offset);
      const key = dateKey(date);
      if (!isWorkingDay(date, shift.weeklyWorkingDays)) continue;
      if (['emp-015'].includes(employee.id)) continue;
      const onLeave = leave.some((item) => item.employeeId === employee.id && key >= item.startDate && key <= item.endDate);
      const window = shiftWindow(shift, date);
      const badDay = (employeeIndex * 7 + Math.abs(offset)) % 19 === 0;
      const late = (employeeIndex + Math.abs(offset)) % 11 === 0;
      const clockIn = new Date(window.start.getTime() + (late ? 24 : -6) * 60000);
      const clockOut = new Date(window.end.getTime() + (badDay ? -45 : 8) * 60000);
      const evaluation = evaluateAttendance({
        shift,
        date,
        clockIn: onLeave ? null : clockIn,
        clockOut: onLeave ? null : clockOut,
        approvedLeave: onLeave,
      });
      records.push({
        id: `att-${employee.id}-${key}`,
        organizationId: ORG_ID,
        employeeId: employee.id,
        shiftId: shift.id,
        workDate: key,
        scheduledStart: window.start.toISOString(),
        scheduledEnd: window.end.toISOString(),
        actualIn: onLeave ? null : clockIn.toISOString(),
        actualOut: onLeave ? null : clockOut.toISOString(),
        status: onLeave ? 'on_leave' : evaluation.status,
        lateMinutes: evaluation.lateMinutes,
        earlyOutMinutes: evaluation.earlyOutMinutes,
        overtimeMinutes: evaluation.overtimeMinutes,
        workedMinutes: evaluation.workedMinutes,
        source: 'biometric',
        approvedBy: null,
        notes: onLeave ? 'Approved leave' : null,
      });
    }
  });
  return records;
}

/**
 * Build a fresh copy of the demo organization. Dates are relative to "today" so
 * schedule and attendance screens always have useful data.
 */
export function createDemoData() {
  const shiftsById = Object.fromEntries(SHIFTS.map((shift) => [shift.id, shift]));
  const designationsById = Object.fromEntries(DESIGNATIONS.map((item) => [item.id, item]));
  const departmentsById = Object.fromEntries(DEPARTMENTS.map((item) => [item.id, item]));
  const plantsById = Object.fromEntries(PLANTS.map((item) => [item.id, item]));
  const linesById = Object.fromEntries(PRODUCTION_LINES.map((item) => [item.id, item]));
  const categoriesById = Object.fromEntries(JOB_CATEGORIES.map((item) => [item.id, item]));

  const employees = RAW_EMPLOYEES.map((employee) => {
    const designation = designationsById[employee.designationId];
    const department = departmentsById[employee.departmentId];
    const plant = plantsById[employee.plantId];
    const line = employee.productionLineId ? linesById[employee.productionLineId] : null;
    const category = categoriesById[employee.jobCategoryId];
    const manager = RAW_EMPLOYEES.find((item) => item.id === employee.reportingManagerId);
    return {
      ...employee,
      fullName: `${employee.firstName} ${employee.lastName}`,
      displayName: `${employee.firstName} ${employee.lastName}`,
      photoUrl: null,
      designation: designation?.title || '—',
      designationLevel: designation?.level || null,
      department: department?.name || '—',
      plant: plant?.name || '—',
      plantCode: plant?.code || '—',
      productionLine: line?.name || '—',
      jobCategory: category?.name || '—',
      reportingManagerName: manager ? `${manager.firstName} ${manager.lastName}` : '—',
      organizationId: ORG_ID,
      workEmail: employee.email,
      roles: employee.roles.map((roleKey) => ({
        key: roleKey,
        name: ROLE_BY_KEY[roleKey]?.name || roleKey,
        level: ROLE_BY_KEY[roleKey]?.level || 0,
      })),
      roleKeys: employee.roles,
      skills: EMPLOYEE_SKILLS.filter(([employeeId]) => employeeId === employee.id).map(([, skillId, proficiency, verified]) => {
        const skill = SKILLS.find((item) => item.id === skillId);
        return { id: `${employee.id}-${skillId}`, skillId, name: skill?.name, category: skill?.category, proficiency, verified };
      }),
      certifications: EMPLOYEE_CERTIFICATIONS.filter(([employeeId]) => employeeId === employee.id).map(([, certificationId, issuedOn, expiresOn, status]) => {
        const certification = CERTIFICATIONS.find((item) => item.id === certificationId);
        return { id: `${employee.id}-${certificationId}`, certificationId, name: certification?.name, issuingBody: certification?.issuingBody, issuedOn, expiresOn, status };
      }),
      shift: shiftsById[employee.shiftId] || null,
    };
  });

  const employeesById = Object.fromEntries(employees.map((employee) => [employee.id, employee]));

  const shiftAssignments = CURRENT_ASSIGNMENTS.map(([employeeId, shiftId, fromOffset, toOffset], index) => ({
    id: `assignment-${index + 1}`,
    organizationId: ORG_ID,
    employeeId,
    shiftId,
    effectiveFrom: dayOffset(fromOffset),
    effectiveTo: toOffset == null ? null : dayOffset(toOffset),
    status: toOffset != null ? 'active' : 'active',
    assignedBy: 'emp-002',
    notes: toOffset != null ? 'Rotating roster change' : null,
    createdAt: '2026-01-02T04:30:00.000Z',
  }));

  const attendanceRecords = buildAttendance(employees, shiftsById);

  const leaveRecords = [
    { id: 'leave-1', organizationId: ORG_ID, employeeId: 'emp-001', leaveType: 'casual', startDate: '2026-11-20', endDate: '2026-11-21', days: 2, reason: 'Family function', status: 'approved', approvedBy: 'emp-002', approvedAt: '2026-11-02T06:20:00.000Z', createdAt: '2026-11-01T09:12:00.000Z' },
    { id: 'leave-2', organizationId: ORG_ID, employeeId: 'emp-003', leaveType: 'sick', startDate: dayOffset(8), endDate: dayOffset(9), days: 2, reason: 'Viral fever — medical certificate attached', status: 'submitted', approvedBy: null, approvedAt: null, createdAt: dayOffset(-1) + 'T07:10:00.000Z' },
    { id: 'leave-3', organizationId: ORG_ID, employeeId: 'emp-004', leaveType: 'earned', startDate: dayOffset(-8), endDate: dayOffset(-8), days: 1, reason: 'Personal', status: 'approved', approvedBy: 'emp-002', approvedAt: dayOffset(-10) + 'T08:00:00.000Z', createdAt: dayOffset(-12) + 'T09:00:00.000Z' },
  ];

  const notifications = [
    { id: 'notif-1', recipientEmployeeId: 'emp-002', title: '3 approval requests need your review', body: 'Two leave requests and one capital expenditure request are awaiting your decision.', category: 'approval', link: '/approvals', readAt: null, createdAt: new Date(Date.now() - 38 * 60000).toISOString() },
    { id: 'notif-2', recipientEmployeeId: 'emp-002', title: 'Night shift roster published', body: 'The Machining Line 02 roster for the next two weeks has been published by Ananya Rao.', category: 'schedule', link: '/schedule', readAt: null, createdAt: new Date(Date.now() - 3 * 3600000).toISOString() },
    { id: 'notif-3', recipientEmployeeId: 'emp-002', title: 'Invitation pending activation', body: 'Nisha Patel has not activated the account invitation sent 2 days ago.', category: 'people', link: '/admin/employees', readAt: new Date(Date.now() - 2 * 3600000).toISOString(), createdAt: new Date(Date.now() - 26 * 3600000).toISOString() },
    { id: 'notif-4', recipientEmployeeId: 'emp-001', title: 'Overtime threshold reached', body: 'Machining Line 02 has reached 92% of the weekly overtime allowance.', category: 'attendance', link: '/attendance', readAt: null, createdAt: new Date(Date.now() - 55 * 60000).toISOString() },
    { id: 'notif-5', recipientEmployeeId: 'emp-001', title: 'Arjun Mehta requested leave', body: 'Sick leave for 2 days starting ' + dayOffset(8) + '.', category: 'approval', link: '/approvals', readAt: null, createdAt: new Date(Date.now() - 6 * 3600000).toISOString() },
    { id: 'notif-6', recipientEmployeeId: 'emp-003', title: 'Shift reassignment confirmed', body: 'You move from Night shift to Early shift on ' + dayOffset(22) + '.', category: 'schedule', link: '/schedule', readAt: null, createdAt: new Date(Date.now() - 20 * 3600000).toISOString() },
    { id: 'notif-7', recipientEmployeeId: 'emp-003', title: 'Payslip available', body: 'Your October payslip is available in documents.', category: 'payroll', link: '/profile', readAt: new Date(Date.now() - 30 * 3600000).toISOString(), createdAt: new Date(Date.now() - 48 * 3600000).toISOString() },
    { id: 'notif-8', recipientEmployeeId: 'emp-004', title: '2 invitations awaiting activation', body: 'Follow up with employees who have not accepted their invitation.', category: 'people', link: '/admin/employees', readAt: null, createdAt: new Date(Date.now() - 4 * 3600000).toISOString() },
    { id: 'notif-9', recipientEmployeeId: 'emp-005', title: 'Certification expires soon', body: 'Industrial Safety Practitioner certification for Rahul Verma expired on 18 June 2026.', category: 'compliance', link: '/admin/employees', readAt: null, createdAt: new Date(Date.now() - 15 * 3600000).toISOString() },
    { id: 'notif-10', recipientEmployeeId: 'emp-015', title: 'Customer evidence pack ready for approval', body: 'The PPAP evidence pack is ready for your review.', category: 'approval', link: '/approvals', readAt: null, createdAt: new Date(Date.now() - 90 * 60000).toISOString() },
  ];

  const tasks = [
    { id: 'task-1', organizationId: ORG_ID, assigneeEmployeeId: 'emp-002', createdByEmployeeId: 'emp-001', title: 'Approve November overtime plan', description: 'Review and sign off the machining line overtime plan before the payroll cut-off.', status: 'in_progress', priority: 'high', dueAt: dayOffset(1) + 'T12:00:00.000Z', projectId: 'proj-oee', createdAt: '2026-11-06T05:00:00.000Z' },
    { id: 'task-2', organizationId: ORG_ID, assigneeEmployeeId: 'emp-002', createdByEmployeeId: 'emp-004', title: 'Review customer approval workflow', description: 'Confirm approval authority thresholds for external customer approvers.', status: 'todo', priority: 'medium', dueAt: dayOffset(4) + 'T12:00:00.000Z', projectId: 'proj-customer', createdAt: '2026-11-04T05:00:00.000Z' },
    { id: 'task-3', organizationId: ORG_ID, assigneeEmployeeId: 'emp-001', createdByEmployeeId: 'emp-002', title: 'Close OEE recovery actions', description: 'Verify the six actions assigned after the October performance review.', status: 'in_progress', priority: 'high', dueAt: dayOffset(2) + 'T12:00:00.000Z', projectId: 'proj-oee', createdAt: '2026-11-03T05:00:00.000Z' },
    { id: 'task-4', organizationId: ORG_ID, assigneeEmployeeId: 'emp-001', createdByEmployeeId: 'emp-002', title: 'Publish December roster', description: 'Publish the December shift roster for production and maintenance.', status: 'todo', priority: 'high', dueAt: dayOffset(6) + 'T12:00:00.000Z', projectId: null, createdAt: '2026-11-05T05:00:00.000Z' },
    { id: 'task-5', organizationId: ORG_ID, assigneeEmployeeId: 'emp-003', createdByEmployeeId: 'emp-008', title: 'Complete night-shift handover checklist', description: 'Record tooling condition and open work orders at handover.', status: 'todo', priority: 'medium', dueAt: dayOffset(0) + 'T22:00:00.000Z', projectId: 'proj-oee', createdAt: '2026-11-09T05:00:00.000Z' },
    { id: 'task-6', organizationId: ORG_ID, assigneeEmployeeId: 'emp-003', createdByEmployeeId: 'emp-009', title: 'Verify CNC program revision 14', description: 'Dry-run program rev 14 on the QT-250 and record cycle time.', status: 'in_progress', priority: 'high', dueAt: dayOffset(3) + 'T12:00:00.000Z', projectId: 'proj-twin', createdAt: '2026-11-07T05:00:00.000Z' },
    { id: 'task-7', organizationId: ORG_ID, assigneeEmployeeId: 'emp-004', createdByEmployeeId: 'emp-002', title: 'Activate pending employee invitations', description: 'Follow up on the two outstanding invitations.', status: 'todo', priority: 'medium', dueAt: dayOffset(1) + 'T12:00:00.000Z', projectId: null, createdAt: '2026-11-08T05:00:00.000Z' },
    { id: 'task-8', organizationId: ORG_ID, assigneeEmployeeId: 'emp-005', createdByEmployeeId: 'emp-006', title: 'Review press line inspection plan', description: 'Update the inspection plan for the new press tooling.', status: 'in_progress', priority: 'high', dueAt: dayOffset(2) + 'T12:00:00.000Z', projectId: 'proj-customer', createdAt: '2026-11-04T05:00:00.000Z' },
    { id: 'task-9', organizationId: ORG_ID, assigneeEmployeeId: 'emp-006', createdByEmployeeId: 'emp-002', title: 'Sign off plant safety audit', description: 'Approve the corrective actions from the October safety audit.', status: 'todo', priority: 'critical', dueAt: dayOffset(0) + 'T12:00:00.000Z', projectId: 'proj-safety', createdAt: '2026-11-02T05:00:00.000Z' },
    { id: 'task-10', organizationId: ORG_ID, assigneeEmployeeId: 'emp-015', createdByEmployeeId: 'emp-005', title: 'Review PPAP evidence pack', description: 'Review dimensional and material evidence before customer sign-off.', status: 'in_progress', priority: 'high', dueAt: dayOffset(3) + 'T12:00:00.000Z', projectId: 'proj-customer', createdAt: '2026-11-06T05:00:00.000Z' },
  ];

  const requests = [
    { id: 'req-1', organizationId: ORG_ID, employeeId: 'emp-003', requestType: 'leave', title: 'Sick leave — 2 days', details: 'Viral fever. Medical certificate uploaded to documents.', amount: null, status: 'submitted', currentApproverId: 'emp-001', departmentId: 'dept-production', plantId: CHENNAI, customerVisible: false, submittedAt: dayOffset(-1) + 'T07:10:00.000Z', decidedAt: null, decisionNotes: null },
    { id: 'req-2', organizationId: ORG_ID, employeeId: 'emp-001', requestType: 'expense', title: 'Lean training — team enrolment', details: 'Five operator seats for the advanced lean certification programme.', amount: 85000, status: 'submitted', currentApproverId: 'emp-002', departmentId: 'dept-production', plantId: CHENNAI, customerVisible: false, submittedAt: dayOffset(-2) + 'T09:15:00.000Z', decidedAt: null, decisionNotes: null },
    { id: 'req-3', organizationId: ORG_ID, employeeId: 'emp-009', requestType: 'access', title: 'Digital twin editor access', details: 'Requesting edit access to the Assembly Line 01 twin for program validation.', amount: null, status: 'submitted', currentApproverId: 'emp-001', departmentId: 'dept-engineering', plantId: CHENNAI, customerVisible: false, submittedAt: dayOffset(-3) + 'T06:20:00.000Z', decidedAt: null, decisionNotes: null },
    { id: 'req-4', organizationId: ORG_ID, employeeId: 'emp-010', requestType: 'purchase', title: 'Machine guarding sensors', details: 'Six safety interlock sensors for press line upgrade.', amount: 142000, status: 'submitted', currentApproverId: 'emp-002', departmentId: 'dept-ehs', plantId: PUNE, customerVisible: false, submittedAt: dayOffset(-1) + 'T11:40:00.000Z', decidedAt: null, decisionNotes: null },
    { id: 'req-5', organizationId: ORG_ID, employeeId: 'emp-005', requestType: 'customer_evidence', title: 'PPAP evidence pack approval', details: 'Dimensional, material and process evidence for customer programme P-774.', amount: null, status: 'submitted', currentApproverId: 'emp-015', departmentId: 'dept-customer', plantId: CHENNAI, customerVisible: true, submittedAt: dayOffset(-1) + 'T13:00:00.000Z', decidedAt: null, decisionNotes: null },
    { id: 'req-6', organizationId: ORG_ID, employeeId: 'emp-004', requestType: 'leave', title: 'Earned leave — 1 day', details: 'Personal work.', amount: null, status: 'approved', currentApproverId: null, departmentId: 'dept-hr', plantId: CHENNAI, customerVisible: false, submittedAt: dayOffset(-14) + 'T09:00:00.000Z', decidedAt: dayOffset(-12) + 'T08:00:00.000Z', decisionNotes: 'Approved by Plant Head.' },
    { id: 'req-7', organizationId: ORG_ID, employeeId: 'emp-003', requestType: 'shift_swap', title: 'Shift swap — 18 November', details: 'Swap night shift with Karthik for family commitment.', amount: null, status: 'rejected', currentApproverId: null, departmentId: 'dept-production', plantId: CHENNAI, customerVisible: false, submittedAt: dayOffset(-20) + 'T09:00:00.000Z', decidedAt: dayOffset(-18) + 'T09:30:00.000Z', decisionNotes: 'Coverage unavailable on the requested date.' },
    { id: 'req-8', organizationId: ORG_ID, employeeId: 'emp-001', requestType: 'expense', title: 'Plant benchmarking visit', details: 'Travel to Pune plant for cross-plant OEE benchmarking.', amount: 32000, status: 'approved', currentApproverId: null, departmentId: 'dept-production', plantId: CHENNAI, customerVisible: false, submittedAt: dayOffset(-30) + 'T09:00:00.000Z', decidedAt: dayOffset(-28) + 'T10:00:00.000Z', decisionNotes: 'Approved within departmental budget.' },
  ];

  const approvals = [
    { id: 'appr-1', requestId: 'req-1', step: 2, approverEmployeeId: 'emp-001', status: 'pending', decidedAt: null, comments: null },
    { id: 'appr-2', requestId: 'req-2', step: 1, approverEmployeeId: 'emp-002', status: 'pending', decidedAt: null, comments: null },
    { id: 'appr-3', requestId: 'req-2', step: 2, approverEmployeeId: 'emp-007', status: 'waiting', decidedAt: null, comments: null },
    { id: 'appr-4', requestId: 'req-3', step: 1, approverEmployeeId: 'emp-001', status: 'pending', decidedAt: null, comments: null },
    { id: 'appr-5', requestId: 'req-4', step: 1, approverEmployeeId: 'emp-002', status: 'pending', decidedAt: null, comments: null },
    { id: 'appr-6', requestId: 'req-4', step: 2, approverEmployeeId: 'emp-007', status: 'waiting', decidedAt: null, comments: null },
    { id: 'appr-7', requestId: 'req-5', step: 1, approverEmployeeId: 'emp-005', status: 'approved', decidedAt: dayOffset(-2) + 'T09:00:00.000Z', comments: 'Quality evidence verified.' },
    { id: 'appr-8', requestId: 'req-5', step: 2, approverEmployeeId: 'emp-015', status: 'pending', decidedAt: null, comments: null },
    { id: 'appr-9', requestId: 'req-6', step: 1, approverEmployeeId: 'emp-002', status: 'approved', decidedAt: dayOffset(-12) + 'T08:00:00.000Z', comments: 'Approved.' },
  ];

  const approvalAuthorities = [
    { id: 'auth-1', organizationId: ORG_ID, scopeType: 'department', scopeId: 'dept-production', requestType: 'leave', roleId: 'role-hod', level: 1, thresholdAmount: null, selfApprovalAllowed: false, canDelegate: true },
    { id: 'auth-2', organizationId: ORG_ID, scopeType: 'plant', scopeId: CHENNAI, requestType: 'expense', roleId: 'role-plant_head', level: 1, thresholdAmount: 100000, selfApprovalAllowed: false, canDelegate: true },
    { id: 'auth-3', organizationId: ORG_ID, scopeType: 'organization', scopeId: ORG_ID, requestType: 'expense', roleId: 'role-finance', level: 2, thresholdAmount: null, selfApprovalAllowed: false, canDelegate: true },
    { id: 'auth-4', organizationId: ORG_ID, scopeType: 'plant', scopeId: PUNE, requestType: 'purchase', roleId: 'role-plant_head', level: 1, thresholdAmount: 250000, selfApprovalAllowed: false, canDelegate: false },
    { id: 'auth-5', organizationId: ORG_ID, scopeType: 'organization', scopeId: ORG_ID, requestType: 'customer_evidence', roleId: 'role_customer_approver', level: 2, thresholdAmount: null, selfApprovalAllowed: false, canDelegate: false },
    { id: 'auth-6', organizationId: ORG_ID, scopeType: 'department', scopeId: 'dept-production', requestType: 'access', roleId: 'role-hod', level: 1, thresholdAmount: null, selfApprovalAllowed: false, canDelegate: true },
  ];

  const auditLogs = [
    { id: 'audit-1', organizationId: ORG_ID, actorEmployeeId: 'emp-001', action: 'shift.assigned', entityType: 'employee_shift_assignment', entityId: 'assignment-3', summary: 'Assigned Night shift to Arjun Mehta from ' + dayOffset(-40), ipAddress: '10.20.1.18', createdAt: new Date(Date.now() - 3 * 3600000).toISOString() },
    { id: 'audit-2', organizationId: ORG_ID, actorEmployeeId: 'emp-002', action: 'request.approved', entityType: 'request', entityId: 'req-8', summary: 'Approved expense request: Plant benchmarking visit', ipAddress: '10.20.1.10', createdAt: new Date(Date.now() - 26 * 3600000).toISOString() },
    { id: 'audit-3', organizationId: ORG_ID, actorEmployeeId: 'emp-004', action: 'invitation.sent', entityType: 'invitation', entityId: 'inv-2', summary: 'Invited Nisha Patel as Technical Analyst', ipAddress: '10.20.1.22', createdAt: new Date(Date.now() - 50 * 3600000).toISOString() },
    { id: 'audit-4', organizationId: ORG_ID, actorEmployeeId: 'emp-005', action: 'approval.completed', entityType: 'request', entityId: 'req-5', summary: 'Verified quality evidence for PPAP pack', ipAddress: '10.30.2.14', createdAt: new Date(Date.now() - 52 * 3600000).toISOString() },
    { id: 'audit-5', organizationId: ORG_ID, actorEmployeeId: 'emp-009', action: 'digital_twin.updated', entityType: 'factory', entityId: 'line-assembly-01', summary: 'Updated Assembly Line 01 digital twin', ipAddress: '10.20.1.31', createdAt: new Date(Date.now() - 70 * 3600000).toISOString() },
    { id: 'audit-6', organizationId: ORG_ID, actorEmployeeId: 'emp-006', action: 'role.assigned', entityType: 'user_role', entityId: 'user-role-emp-014-verification_engineer', summary: 'Assigned Verification Engineer role to Aditya Bose', ipAddress: '10.30.1.6', createdAt: new Date(Date.now() - 74 * 3600000).toISOString() },
    { id: 'audit-7', organizationId: ORG_ID, actorEmployeeId: 'emp-002', action: 'employee.updated', entityType: 'employee', entityId: 'emp-012', summary: 'Updated Farhan Ali employment status to on leave', ipAddress: '10.20.1.10', createdAt: new Date(Date.now() - 96 * 3600000).toISOString() },
    { id: 'audit-8', organizationId: ORG_ID, actorEmployeeId: 'emp-001', action: 'attendance.corrected', entityType: 'attendance_record', entityId: 'att-emp-003', summary: 'Corrected clock-in for night shift handover', ipAddress: '10.20.1.18', createdAt: new Date(Date.now() - 110 * 3600000).toISOString() },
    { id: 'audit-9', organizationId: ORG_ID, actorEmployeeId: 'emp-004', action: 'shift.updated', entityType: 'shift', entityId: 'shift-night', summary: 'Added midnight paid break to Night shift', ipAddress: '10.20.1.22', createdAt: new Date(Date.now() - 130 * 3600000).toISOString() },
    { id: 'audit-10', organizationId: ORG_ID, actorEmployeeId: 'emp-002', action: 'approval_authority.updated', entityType: 'approval_authority', entityId: 'auth-2', summary: 'Set Chennai expense approval threshold to ₹1,00,000', ipAddress: '10.20.1.10', createdAt: new Date(Date.now() - 150 * 3600000).toISOString() },
  ];

  const invitations = [
    { id: 'inv-1', organizationId: ORG_ID, email: 'new.operator@indra.example', employeeId: null, roleKey: 'operator', departmentId: 'dept-production', plantId: CHENNAI, status: 'pending', invitedBy: 'emp-004', expiresAt: dayOffset(5) + 'T12:00:00.000Z', createdAt: dayOffset(-2) + 'T06:00:00.000Z' },
    { id: 'inv-2', organizationId: ORG_ID, email: 'nisha.patel@indra.example', employeeId: 'emp-011', roleKey: 'technical_analyst', departmentId: 'dept-planning', plantId: PUNE, status: 'pending', invitedBy: 'emp-004', expiresAt: dayOffset(5) + 'T09:00:00.000Z', createdAt: dayOffset(-2) + 'T07:00:00.000Z' },
    { id: 'inv-3', organizationId: ORG_ID, email: 'aditya.bose@indra.example', employeeId: 'emp-014', roleKey: 'verification_engineer', departmentId: 'dept-quality', plantId: PUNE, status: 'accepted', invitedBy: 'emp-004', expiresAt: dayOffset(-30) + 'T09:00:00.000Z', createdAt: dayOffset(-40) + 'T07:00:00.000Z' },
  ];

  const documents = [
    { id: 'doc-1', organizationId: ORG_ID, ownerEmployeeId: 'emp-003', ownerName: 'Arjun Mehta', name: 'Medical certificate — Nov 2026.pdf', category: 'medical', entityType: 'leave_record', entityId: 'leave-2', mimeType: 'application/pdf', sizeBytes: 184320, createdAt: dayOffset(-1) + 'T07:05:00.000Z' },
    { id: 'doc-2', organizationId: ORG_ID, ownerEmployeeId: 'emp-005', ownerName: 'Vikram Singh', name: 'PPAP dimensional report.pdf', category: 'quality', entityType: 'request', entityId: 'req-5', mimeType: 'application/pdf', sizeBytes: 1245184, createdAt: dayOffset(-2) + 'T08:45:00.000Z' },
    { id: 'doc-3', organizationId: ORG_ID, ownerEmployeeId: 'emp-010', ownerName: 'Rahul Verma', name: 'Machine guarding risk assessment.pdf', category: 'ehs', entityType: 'project', entityId: 'proj-safety', mimeType: 'application/pdf', sizeBytes: 812340, createdAt: dayOffset(-5) + 'T10:20:00.000Z' },
    { id: 'doc-4', organizationId: ORG_ID, ownerEmployeeId: 'emp-009', ownerName: 'Divya Sharma', name: 'Assembly line twin validation.xlsx', category: 'engineering', entityType: 'project', entityId: 'proj-twin', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeBytes: 420880, createdAt: dayOffset(-8) + 'T05:40:00.000Z' },
    { id: 'doc-5', organizationId: ORG_ID, ownerEmployeeId: 'emp-004', ownerName: 'Priya Nair', name: 'Employee handbook 2026.pdf', category: 'policy', entityType: 'organization', entityId: ORG_ID, mimeType: 'application/pdf', sizeBytes: 2457600, createdAt: '2026-01-05T04:00:00.000Z' },
  ];

  const medicalRecords = [
    { employeeId: 'emp-003', bloodGroup: 'B+', allergies: 'Penicillin', conditions: 'None declared', emergencyContactName: 'Ritu Mehta', emergencyContactPhone: '+91 98400 22003', lastCheckupOn: '2026-04-18', notes: 'Restricted — HR and EHS only.' },
    { employeeId: 'emp-010', bloodGroup: 'O+', allergies: 'None', conditions: 'Asthma (controlled)', emergencyContactName: 'Sneha Verma', emergencyContactPhone: '+91 98400 22010', lastCheckupOn: '2026-06-02', notes: 'Restricted — occupational health.' },
  ];

  return withProductionDemo({
    organization: ORGANIZATION,
    plants: PLANTS,
    departments: DEPARTMENTS,
    productionLines: PRODUCTION_LINES,
    workstations: WORKSTATIONS,
    machines: MACHINES,
    employees,
    employeesById,
    jobCategories: JOB_CATEGORIES,
    designations: DESIGNATIONS,
    roles: ROLES.map((role) => ({ ...role, id: `role-${role.key}`, organizationId: ORG_ID, isSystem: true })),
    permissions: [],
    userRoles: employees.flatMap((employee) => employee.roleKeys.map((roleKey) => roleAssignment(employee.id, roleKey))),
    skills: SKILLS,
    certifications: CERTIFICATIONS,
    employeeSkills: EMPLOYEE_SKILLS.map(([employeeId, skillId, proficiency, verified]) => ({ id: `es-${employeeId}-${skillId}`, employeeId, skillId, proficiency, verified })),
    employeeCertifications: EMPLOYEE_CERTIFICATIONS.map(([employeeId, certificationId, issuedOn, expiresOn, status]) => ({ id: `ec-${employeeId}-${certificationId}`, employeeId, certificationId, issuedOn, expiresOn, status })),
    projects: PROJECTS,
    shifts: SHIFTS,
    shiftBreaks: SHIFTS.flatMap((shift) => shift.breaks.map((item) => ({ ...item, shiftId: shift.id }))),
    shiftAssignments,
    attendanceRecords,
    holidays: HOLIDAYS,
    leaveRecords,
    notifications,
    tasks,
    requests,
    approvals,
    approvalAuthorities,
    auditLogs,
    invitations,
    documents,
    medicalRecords,
    sessions: [
      { id: 'session-current', userAgent: 'Chrome · Linux', ipAddress: '10.20.1.18', createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), lastSeenAt: new Date().toISOString(), current: true },
      { id: 'session-mobile', userAgent: 'INDRA Mobile · Android', ipAddress: '49.207.14.22', createdAt: new Date(Date.now() - 26 * 3600000).toISOString(), lastSeenAt: new Date(Date.now() - 5 * 3600000).toISOString(), current: false },
    ],
  });
}

/** Context payload equivalent to the Supabase `get_my_context()` RPC. */
export function demoContext(data, employeeId) {
  const employee = data.employeesById[employeeId];
  if (!employee) return null;
  const roleObjects = employee.roleKeys.map((key) => data.roles?.find((role) => role.key === key) || ROLE_BY_KEY[key]).filter(Boolean);
  const permissions = [...new Set(roleObjects.flatMap((role) => role.permissions))];
  return {
    employee,
    employeeId: employee.id,
    profile: {
      id: employee.id,
      employeeId: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      photoUrl: employee.photoUrl,
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
    },
    organization: data.organization,
    roles: employee.roles,
    roleKeys: employee.roleKeys,
    permissions,
    scope: {
      organizationId: data.organization.id,
      plantId: employee.plantId,
      departmentId: employee.departmentId,
      productionLineId: employee.productionLineId,
    },
  };
}
