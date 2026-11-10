-- INDRA platform demo seed (Module 01)
-- Destructive only in the sense that fixed demo ids are reused; all inserts are
-- idempotent. Run with a service-role connection or during `supabase db reset`.
-- Demo sign-in accounts are created by supabase/seed-auth.sql.

begin;

-- ---------------------------------------------------------------------------
-- Organization, sites and structure
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, legal_name, code, timezone, currency, locale, website, support_email, support_phone, address)
values (
  '11111111-1111-1111-1111-111111111111',
  'INDRA Industrial Systems',
  'INDRA Industrial Systems Private Limited',
  'INDRA',
  'Asia/Kolkata',
  'INR',
  'en-IN',
  'https://indra.example',
  'support@indra.example',
  '+91 44 4000 1200',
  'Plot 14, Ambattur Industrial Estate, Chennai 600058, India'
)
on conflict (id) do update set
  name = excluded.name,
  legal_name = excluded.legal_name,
  code = excluded.code,
  timezone = excluded.timezone,
  currency = excluded.currency,
  locale = excluded.locale,
  website = excluded.website,
  support_email = excluded.support_email,
  support_phone = excluded.support_phone,
  address = excluded.address;

insert into public.plants (id, organization_id, name, code, city, state, country, timezone, address, is_active)
values
  ('11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111111', 'Chennai Plant', 'PLT-CHN', 'Chennai', 'Tamil Nadu', 'India', 'Asia/Kolkata', 'Ambattur Industrial Estate, Chennai 600058', true),
  ('11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111111', 'Pune Plant', 'PLT-PUN', 'Pune', 'Maharashtra', 'India', 'Asia/Kolkata', 'Chakan MIDC, Pune 410501', true)
on conflict (id) do update set name = excluded.name, code = excluded.code, city = excluded.city, state = excluded.state, address = excluded.address, is_active = excluded.is_active;

insert into public.job_categories (id, organization_id, name, code, description)
values
  ('11111111-1111-1111-1111-111111111201', '11111111-1111-1111-1111-111111111111', 'Management', 'MGMT', 'Plant and departmental leadership'),
  ('11111111-1111-1111-1111-111111111202', '11111111-1111-1111-1111-111111111111', 'Engineering', 'ENGG', 'Technical engineering and programming'),
  ('11111111-1111-1111-1111-111111111203', '11111111-1111-1111-1111-111111111111', 'Skilled trade', 'SKILL', 'Certified machine operators and technicians'),
  ('11111111-1111-1111-1111-111111111204', '11111111-1111-1111-1111-111111111111', 'Semi-skilled', 'SEMI', 'Assisted production and material handling'),
  ('11111111-1111-1111-1111-111111111205', '11111111-1111-1111-1111-111111111111', 'Analytical', 'ANLY', 'Planning, quality and business analysis'),
  ('11111111-1111-1111-1111-111111111206', '11111111-1111-1111-1111-111111111111', 'Support', 'SUPP', 'HR, finance, EHS and administrative support')
on conflict (id) do update set name = excluded.name, code = excluded.code, description = excluded.description;

insert into public.designations (id, organization_id, title, level, job_category_id)
values
  ('11111111-1111-1111-1111-111111111301', '11111111-1111-1111-1111-111111111111', 'Plant Head', 'leadership', '11111111-1111-1111-1111-111111111201'),
  ('11111111-1111-1111-1111-111111111302', '11111111-1111-1111-1111-111111111111', 'Head of Department', 'leadership', '11111111-1111-1111-1111-111111111201'),
  ('11111111-1111-1111-1111-111111111303', '11111111-1111-1111-1111-111111111111', 'Production Supervisor', 'supervisory', '11111111-1111-1111-1111-111111111201'),
  ('11111111-1111-1111-1111-111111111304', '11111111-1111-1111-1111-111111111111', 'Senior CNC Operator', 'skilled', '11111111-1111-1111-1111-111111111203'),
  ('11111111-1111-1111-1111-111111111305', '11111111-1111-1111-1111-111111111111', 'CNC Programmer', 'engineering', '11111111-1111-1111-1111-111111111202'),
  ('11111111-1111-1111-1111-111111111306', '11111111-1111-1111-1111-111111111111', 'Quality Engineer', 'engineering', '11111111-1111-1111-1111-111111111205'),
  ('11111111-1111-1111-1111-111111111307', '11111111-1111-1111-1111-111111111111', 'HR Analyst', 'analyst', '11111111-1111-1111-1111-111111111206'),
  ('11111111-1111-1111-1111-111111111308', '11111111-1111-1111-1111-111111111111', 'Finance Analyst', 'analyst', '11111111-1111-1111-1111-111111111206'),
  ('11111111-1111-1111-1111-111111111309', '11111111-1111-1111-1111-111111111111', 'EHS Officer', 'engineering', '11111111-1111-1111-1111-111111111206'),
  ('11111111-1111-1111-1111-111111111310', '11111111-1111-1111-1111-111111111111', 'Technical Analyst', 'analyst', '11111111-1111-1111-1111-111111111205'),
  ('11111111-1111-1111-1111-111111111311', '11111111-1111-1111-1111-111111111111', 'Technical Assistant', 'support', '11111111-1111-1111-1111-111111111206'),
  ('11111111-1111-1111-1111-111111111312', '11111111-1111-1111-1111-111111111111', 'Material Analyst', 'analyst', '11111111-1111-1111-1111-111111111205'),
  ('11111111-1111-1111-1111-111111111313', '11111111-1111-1111-1111-111111111111', 'Verification Engineer', 'engineering', '11111111-1111-1111-1111-111111111205'),
  ('11111111-1111-1111-1111-111111111314', '11111111-1111-1111-1111-111111111111', 'Customer Approver', 'external', '11111111-1111-1111-1111-111111111205')
on conflict (id) do update set title = excluded.title, level = excluded.level, job_category_id = excluded.job_category_id;

insert into public.departments (id, organization_id, plant_id, name, code, cost_center)
values
  ('11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Production', 'PROD', 'CC-1001'),
  ('11111111-1111-1111-1111-111111111402', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Maintenance', 'MAINT', 'CC-1002'),
  ('11111111-1111-1111-1111-111111111403', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Quality', 'QUAL', 'CC-1003'),
  ('11111111-1111-1111-1111-111111111404', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Human Resources', 'HR', 'CC-2001'),
  ('11111111-1111-1111-1111-111111111405', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Finance & Accounts', 'FIN', 'CC-2002'),
  ('11111111-1111-1111-1111-111111111406', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Environment, Health & Safety', 'EHS', 'CC-2003'),
  ('11111111-1111-1111-1111-111111111407', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Engineering', 'ENG', 'CC-1004'),
  ('11111111-1111-1111-1111-111111111408', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', 'Planning', 'PLAN', 'CC-3001'),
  ('11111111-1111-1111-1111-111111111409', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Customer Projects', 'CUST', 'CC-3002')
on conflict (id) do update set name = excluded.name, code = excluded.code, cost_center = excluded.cost_center, plant_id = excluded.plant_id;

insert into public.production_lines (id, organization_id, plant_id, department_id, name, code, status, shift_pattern)
values
  ('11111111-1111-1111-1111-111111111501', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', 'Assembly Line 01', 'CHN-ASM-01', 'running', 'three_shift'),
  ('11111111-1111-1111-1111-111111111502', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', 'Machining Line 02', 'CHN-MAC-02', 'running', 'two_shift'),
  ('11111111-1111-1111-1111-111111111503', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111401', 'Press Line 03', 'PUN-PRS-03', 'idle', 'general')
on conflict (id) do update set name = excluded.name, code = excluded.code, status = excluded.status, shift_pattern = excluded.shift_pattern;

insert into public.workstations (id, organization_id, plant_id, department_id, production_line_id, name, code, station_type, sequence)
values
  ('11111111-1111-1111-1111-111111111601', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111501', 'Frame Fit-up', 'ASM-010', 'assembly', 10),
  ('11111111-1111-1111-1111-111111111602', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111501', 'Robot Welding', 'ASM-020', 'welding', 20),
  ('11111111-1111-1111-1111-111111111603', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111501', 'Final Inspection', 'ASM-030', 'inspection', 30),
  ('11111111-1111-1111-1111-111111111604', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111502', 'CNC Turning', 'MAC-010', 'machining', 10),
  ('11111111-1111-1111-1111-111111111605', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111502', 'Grinding', 'MAC-020', 'machining', 20),
  ('11111111-1111-1111-1111-111111111606', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111503', 'Hydraulic Press', 'PRS-010', 'press', 10)
on conflict (id) do update set name = excluded.name, code = excluded.code, station_type = excluded.station_type, sequence = excluded.sequence;

insert into public.machines (id, organization_id, plant_id, department_id, workstation_id, name, asset_tag, manufacturer, model, status, criticality)
values
  ('11111111-1111-1111-1111-111111111701', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111604', 'CNC Lathe 01', 'CHN-CNC-001', 'Mazak', 'QT-250', 'running', 'high'),
  ('11111111-1111-1111-1111-111111111702', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111602', 'Welding Robot 02', 'CHN-ROB-002', 'FANUC', 'ARC Mate 120iD', 'running', 'high'),
  ('11111111-1111-1111-1111-111111111703', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111606', 'Hydraulic Press 03', 'PUN-PRS-003', 'Godrej', 'H-Press 250T', 'idle', 'medium'),
  ('11111111-1111-1111-1111-111111111704', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111403', '11111111-1111-1111-1111-111111111603', 'CMM Station 04', 'CHN-CMM-004', 'Zeiss', 'Contura', 'running', 'medium')
on conflict (id) do update set name = excluded.name, asset_tag = excluded.asset_tag, status = excluded.status, criticality = excluded.criticality;

-- ---------------------------------------------------------------------------
-- Employees (auth.user_id is linked by seed-auth.sql)
-- ---------------------------------------------------------------------------
insert into public.employees (
  id, organization_id, plant_id, department_id, production_line_id, employee_code,
  first_name, last_name, full_name, work_email, personal_email, phone,
  designation_id, reporting_manager_id, job_category_id, employment_status,
  employment_type, work_mode, joined_on, location
)
values
  ('11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111501', 'IND-0001', 'Ananya', 'Rao', 'Ananya Rao', 'ananya.rao@indra.example', 'ananya.rao@example.in', '+91 98400 11001', '11111111-1111-1111-1111-111111111302', '11111111-1111-1111-1111-111111111802', '11111111-1111-1111-1111-111111111201', 'active', 'full_time', 'onsite', '2018-06-11', 'Chennai'),
  ('11111111-1111-1111-1111-111111111802', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', null, 'IND-0002', 'Rajesh', 'Kumar', 'Rajesh Kumar', 'admin@indra.example', 'rajesh.kumar@example.in', '+91 98400 11002', '11111111-1111-1111-1111-111111111301', null, '11111111-1111-1111-1111-111111111201', 'active', 'full_time', 'onsite', '2015-02-16', 'Chennai'),
  ('11111111-1111-1111-1111-111111111803', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111502', 'IND-0003', 'Arjun', 'Mehta', 'Arjun Mehta', 'arjun.mehta@indra.example', 'arjun.mehta@example.in', '+91 98400 11003', '11111111-1111-1111-1111-111111111304', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111203', 'active', 'full_time', 'onsite', '2021-09-06', 'Chennai'),
  ('11111111-1111-1111-1111-111111111804', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111404', null, 'IND-0004', 'Priya', 'Nair', 'Priya Nair', 'priya.nair@indra.example', 'priya.nair@example.in', '+91 98400 11004', '11111111-1111-1111-1111-111111111307', '11111111-1111-1111-1111-111111111802', '11111111-1111-1111-1111-111111111206', 'active', 'full_time', 'hybrid', '2019-11-18', 'Chennai'),
  ('11111111-1111-1111-1111-111111111805', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111403', '11111111-1111-1111-1111-111111111503', 'IND-0005', 'Vikram', 'Singh', 'Vikram Singh', 'vikram.singh@indra.example', 'vikram.singh@example.in', '+91 98220 11005', '11111111-1111-1111-1111-111111111306', '11111111-1111-1111-1111-111111111806', '11111111-1111-1111-1111-111111111205', 'active', 'full_time', 'onsite', '2020-03-02', 'Pune'),
  ('11111111-1111-1111-1111-111111111806', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111401', null, 'IND-0006', 'Suresh', 'Menon', 'Suresh Menon', 'suresh.menon@indra.example', 'suresh.menon@example.in', '+91 98220 11006', '11111111-1111-1111-1111-111111111301', '11111111-1111-1111-1111-111111111802', '11111111-1111-1111-1111-111111111201', 'active', 'full_time', 'onsite', '2016-08-22', 'Pune'),
  ('11111111-1111-1111-1111-111111111807', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111405', null, 'IND-0007', 'Meera', 'Iyer', 'Meera Iyer', 'meera.iyer@indra.example', 'meera.iyer@example.in', '+91 98400 11007', '11111111-1111-1111-1111-111111111308', '11111111-1111-1111-1111-111111111802', '11111111-1111-1111-1111-111111111206', 'active', 'full_time', 'hybrid', '2020-07-13', 'Chennai'),
  ('11111111-1111-1111-1111-111111111808', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111502', 'IND-0008', 'Karthik', 'Subramanian', 'Karthik Subramanian', 'karthik.subramanian@indra.example', 'karthik.s@example.in', '+91 98400 11008', '11111111-1111-1111-1111-111111111303', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111201', 'active', 'full_time', 'onsite', '2019-01-21', 'Chennai'),
  ('11111111-1111-1111-1111-111111111809', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111407', '11111111-1111-1111-1111-111111111501', 'IND-0009', 'Divya', 'Sharma', 'Divya Sharma', 'divya.sharma@indra.example', 'divya.sharma@example.in', '+91 98400 11009', '11111111-1111-1111-1111-111111111305', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111202', 'active', 'full_time', 'hybrid', '2022-04-04', 'Chennai'),
  ('11111111-1111-1111-1111-111111111810', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111406', null, 'IND-0010', 'Rahul', 'Verma', 'Rahul Verma', 'rahul.verma@indra.example', 'rahul.verma@example.in', '+91 98400 11010', '11111111-1111-1111-1111-111111111309', '11111111-1111-1111-1111-111111111802', '11111111-1111-1111-1111-111111111206', 'active', 'full_time', 'onsite', '2021-02-08', 'Chennai'),
  ('11111111-1111-1111-1111-111111111811', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111408', null, 'IND-0011', 'Nisha', 'Patel', 'Nisha Patel', 'nisha.patel@indra.example', 'nisha.patel@example.in', '+91 98220 11011', '11111111-1111-1111-1111-111111111310', '11111111-1111-1111-1111-111111111806', '11111111-1111-1111-1111-111111111205', 'active', 'full_time', 'hybrid', '2022-10-10', 'Pune'),
  ('11111111-1111-1111-1111-111111111812', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111502', 'IND-0012', 'Farhan', 'Ali', 'Farhan Ali', 'farhan.ali@indra.example', 'farhan.ali@example.in', '+91 98400 11012', '11111111-1111-1111-1111-111111111312', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111205', 'on_leave', 'full_time', 'onsite', '2020-12-01', 'Chennai'),
  ('11111111-1111-1111-1111-111111111813', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111407', '11111111-1111-1111-1111-111111111501', 'IND-0013', 'Lakshmi', 'Narayanan', 'Lakshmi Narayanan', 'lakshmi.narayanan@indra.example', 'lakshmi.n@example.in', '+91 98400 11013', '11111111-1111-1111-1111-111111111311', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111206', 'active', 'full_time', 'onsite', '2023-05-15', 'Chennai'),
  ('11111111-1111-1111-1111-111111111814', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111403', '11111111-1111-1111-1111-111111111503', 'IND-0014', 'Aditya', 'Bose', 'Aditya Bose', 'aditya.bose@indra.example', 'aditya.bose@example.in', '+91 98220 11014', '11111111-1111-1111-1111-111111111313', '11111111-1111-1111-1111-111111111806', '11111111-1111-1111-1111-111111111205', 'active', 'full_time', 'hybrid', '2021-08-30', 'Pune'),
  ('11111111-1111-1111-1111-111111111815', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111409', null, 'IND-C001', 'Elena', 'Fischer', 'Elena Fischer', 'customer@partner.example', 'elena.fischer@partner.example', '+49 151 2200 4415', '11111111-1111-1111-1111-111111111314', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111205', 'active', 'external', 'remote', '2026-01-12', 'Customer site')
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  full_name = excluded.full_name,
  work_email = excluded.work_email,
  personal_email = excluded.personal_email,
  phone = excluded.phone,
  designation_id = excluded.designation_id,
  reporting_manager_id = excluded.reporting_manager_id,
  job_category_id = excluded.job_category_id,
  employment_status = excluded.employment_status,
  employment_type = excluded.employment_type,
  work_mode = excluded.work_mode,
  location = excluded.location;

update public.plants set head_employee_id = '11111111-1111-1111-1111-111111111802' where id = '11111111-1111-1111-1111-111111111101';
update public.plants set head_employee_id = '11111111-1111-1111-1111-111111111806' where id = '11111111-1111-1111-1111-111111111102';

update public.departments set manager_employee_id = '11111111-1111-1111-1111-111111111801' where id in ('11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111409');
update public.departments set manager_employee_id = '11111111-1111-1111-1111-111111111808' where id = '11111111-1111-1111-1111-111111111402';
update public.departments set manager_employee_id = '11111111-1111-1111-1111-111111111805' where id = '11111111-1111-1111-1111-111111111403';
update public.departments set manager_employee_id = '11111111-1111-1111-1111-111111111804' where id = '11111111-1111-1111-1111-111111111404';
update public.departments set manager_employee_id = '11111111-1111-1111-1111-111111111807' where id = '11111111-1111-1111-1111-111111111405';
update public.departments set manager_employee_id = '11111111-1111-1111-1111-111111111810' where id = '11111111-1111-1111-1111-111111111406';
update public.departments set manager_employee_id = '11111111-1111-1111-1111-111111111809' where id = '11111111-1111-1111-1111-111111111407';
update public.departments set manager_employee_id = '11111111-1111-1111-1111-111111111811' where id = '11111111-1111-1111-1111-111111111408';

-- Permissions
insert into public.permissions (key, module, action, description) values ('organization.read', 'organization', 'read', 'View organization profile and settings') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('organization.manage', 'organization', 'manage', 'Create and update organization records') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('plants.read', 'plants', 'read', 'View plants') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('plants.manage', 'plants', 'manage', 'Create and update plants') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('departments.read', 'departments', 'read', 'View departments') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('departments.manage', 'departments', 'manage', 'Create and update departments') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('production_lines.read', 'production_lines', 'read', 'View production lines') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('production_lines.manage', 'production_lines', 'manage', 'Create and update production lines') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('workstations.read', 'workstations', 'read', 'View workstations') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('workstations.manage', 'workstations', 'manage', 'Create and update workstations') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('machines.read', 'machines', 'read', 'View machines') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('machines.manage', 'machines', 'manage', 'Create and update machines') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('employees.read', 'employees', 'read', 'View employee directory and profiles') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('employees.read.all', 'employees', 'read.all', 'View employees beyond own plant/department') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('employees.manage', 'employees', 'manage', 'Invite and maintain employees') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('employees.medical.read', 'employees', 'medical.read', 'View restricted medical information') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('designations.read', 'designations', 'read', 'View designations') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('designations.manage', 'designations', 'manage', 'Maintain designations') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('job_categories.read', 'job_categories', 'read', 'View job categories') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('job_categories.manage', 'job_categories', 'manage', 'Maintain job categories') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('skills.read', 'skills', 'read', 'View skills matrix') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('skills.manage', 'skills', 'manage', 'Maintain skills and certifications') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('certifications.read', 'certifications', 'read', 'View certifications') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('certifications.manage', 'certifications', 'manage', 'Maintain certifications') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('roles.read', 'roles', 'read', 'View roles and permission matrix') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('roles.manage', 'roles', 'manage', 'Assign roles and maintain permissions') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('approval_authorities.manage', 'approval_authorities', 'manage', 'Configure approval authority thresholds') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('shifts.read', 'shifts', 'read', 'View shifts and schedules') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('shifts.manage', 'shifts', 'manage', 'Create and update shift definitions') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('shifts.assign', 'shifts', 'assign', 'Assign shifts to employees') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('attendance.read.self', 'attendance', 'read.self', 'View own attendance') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('attendance.read.all', 'attendance', 'read.all', 'View team or plant attendance') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('attendance.manage', 'attendance', 'manage', 'Correct attendance records') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('leave.read', 'leave', 'read', 'View leave records') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('leave.approve', 'leave', 'approve', 'Approve or reject leave') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('projects.read', 'projects', 'read', 'View projects') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('projects.manage', 'projects', 'manage', 'Create and update projects') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('tasks.read.self', 'tasks', 'read.self', 'View own tasks') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('tasks.read.all', 'tasks', 'read.all', 'View all tasks in scope') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('tasks.manage', 'tasks', 'manage', 'Create and reassign tasks') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('requests.create', 'requests', 'create', 'Raise requests') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('requests.read.self', 'requests', 'read.self', 'View own requests') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('requests.read.all', 'requests', 'read.all', 'View requests in scope') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('requests.approve', 'requests', 'approve', 'Approve requests') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('notifications.read', 'notifications', 'read', 'Read own notifications') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('notifications.manage', 'notifications', 'manage', 'Send organization notifications') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('audit.read', 'audit', 'read', 'Read audit and activity history') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('reports.read', 'reports', 'read', 'View operational reports') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('documents.read', 'documents', 'read', 'View documents and evidence') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('documents.upload', 'documents', 'upload', 'Upload documents and evidence') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('documents.delete', 'documents', 'delete', 'Delete documents and evidence') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('security.sessions.read', 'security', 'sessions.read', 'View own active sessions') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('digital_twin.read', 'digital_twin', 'read', 'Open the digital twin studio') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;
insert into public.permissions (key, module, action, description) values ('digital_twin.manage', 'digital_twin', 'manage', 'Edit and approve digital twin changes') on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;

-- Roles
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'operator', 'Operator', 10, 'Runs assigned workstations and records production activity.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'supervisor', 'Supervisor', 30, 'Leads a shift, approves operational requests and manages attendance.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'programmer', 'Programmer', 25, 'Maintains machine programs and production configuration.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'technical_assistant', 'Technical Assistant', 20, 'Supports engineering documentation, evidence and machine records.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'technical_analyst', 'Technical Analyst', 30, 'Analyses technical performance and prepares evidence packs.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'material_analyst', 'Material Analyst', 30, 'Tracks material flow, buffers and consumption variances.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'hr_analyst', 'HR Analyst', 35, 'Maintains workforce records, invitations and attendance policy.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'resource_analyst', 'Resource Analyst', 35, 'Plans people, machines and shift capacity across plants.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'hod', 'HOD', 50, 'Heads a department with department-scoped approvals and reporting.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'finance', 'Finance / Accounts', 40, 'Owns financial approvals, cost centres and expenditure requests.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'plant_head', 'Plant Head', 70, 'Accountable for a plant: full plant-scoped operations and approvals.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'administrator', 'Administrator', 90, 'Platform administrator for the organization.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'quality_engineer', 'Quality Engineer', 35, 'Owns inspection, quality evidence and rejection analysis.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'ehs_officer', 'EHS Officer', 35, 'Owns environment, health and safety controls and evidence.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'customer_approver', 'Customer Approver', 20, 'External customer reviewer with read-only access to assigned approvals.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;
insert into public.roles (organization_id, key, name, level, description) values ('11111111-1111-1111-1111-111111111111', 'verification_engineer', 'Verification Engineer', 35, 'Independently verifies records, evidence and change approvals.') on conflict (organization_id, key) do update set name = excluded.name, level = excluded.level, description = excluded.description;

-- Role permissions
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'operator' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'documents.upload') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'supervisor' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'requests.approve', 'requests.read.all', 'leave.approve', 'tasks.read.all', 'attendance.read.all', 'shifts.assign', 'attendance.manage', 'documents.upload') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'programmer' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'machines.manage', 'workstations.manage', 'digital_twin.manage', 'documents.upload') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'technical_assistant' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'documents.upload', 'tasks.manage') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'technical_analyst' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'reports.read', 'documents.upload', 'tasks.read.all') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'material_analyst' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'reports.read', 'production_lines.manage', 'tasks.read.all') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'hr_analyst' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'employees.read.all', 'employees.manage', 'attendance.read.all', 'attendance.manage', 'shifts.assign', 'leave.approve', 'reports.read', 'documents.upload', 'tasks.read.all', 'requests.read.all', 'employees.medical.read') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'resource_analyst' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'employees.read.all', 'shifts.assign', 'shifts.manage', 'reports.read', 'tasks.read.all', 'attendance.read.all') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'hod' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'requests.approve', 'requests.read.all', 'leave.approve', 'tasks.read.all', 'attendance.read.all', 'shifts.assign', 'reports.read', 'audit.read', 'tasks.manage', 'documents.upload', 'projects.manage', 'machines.manage') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'finance' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'requests.approve', 'requests.read.all', 'leave.approve', 'tasks.read.all', 'reports.read', 'audit.read', 'documents.upload', 'tasks.read.all') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'plant_head' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'requests.approve', 'requests.read.all', 'leave.approve', 'tasks.read.all', 'employees.read.all', 'attendance.read.all', 'shifts.assign', 'shifts.manage', 'reports.read', 'audit.read', 'tasks.manage', 'documents.upload', 'projects.manage', 'machines.manage', 'production_lines.manage', 'workstations.manage', 'departments.manage', 'digital_twin.manage', 'approval_authorities.manage') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'administrator' and p.key in ('organization.read', 'organization.manage', 'plants.read', 'plants.manage', 'departments.read', 'departments.manage', 'production_lines.read', 'production_lines.manage', 'workstations.read', 'workstations.manage', 'machines.read', 'machines.manage', 'employees.read', 'employees.read.all', 'employees.manage', 'employees.medical.read', 'designations.read', 'designations.manage', 'job_categories.read', 'job_categories.manage', 'skills.read', 'skills.manage', 'certifications.read', 'certifications.manage', 'roles.read', 'roles.manage', 'approval_authorities.manage', 'shifts.read', 'shifts.manage', 'shifts.assign', 'attendance.read.self', 'attendance.read.all', 'attendance.manage', 'leave.read', 'leave.approve', 'projects.read', 'projects.manage', 'tasks.read.self', 'tasks.read.all', 'tasks.manage', 'requests.create', 'requests.read.self', 'requests.read.all', 'requests.approve', 'notifications.read', 'notifications.manage', 'audit.read', 'reports.read', 'documents.read', 'documents.upload', 'documents.delete', 'security.sessions.read', 'digital_twin.read', 'digital_twin.manage') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'quality_engineer' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'reports.read', 'documents.upload', 'documents.delete', 'tasks.read.all', 'machines.manage') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'ehs_officer' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'employees.medical.read', 'reports.read', 'documents.upload', 'audit.read', 'tasks.read.all') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'customer_approver' and p.key in ('organization.read', 'projects.read', 'tasks.read.self', 'requests.read.self', 'requests.approve', 'notifications.read', 'documents.read') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key) select r.id, p.key from public.roles r cross join public.permissions p where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'verification_engineer' and p.key in ('organization.read', 'plants.read', 'departments.read', 'production_lines.read', 'workstations.read', 'machines.read', 'employees.read', 'designations.read', 'job_categories.read', 'skills.read', 'certifications.read', 'shifts.read', 'attendance.read.self', 'leave.read', 'projects.read', 'tasks.read.self', 'requests.create', 'requests.read.self', 'notifications.read', 'documents.read', 'security.sessions.read', 'digital_twin.read', 'employees.read.all', 'reports.read', 'audit.read', 'documents.upload', 'tasks.read.all', 'requests.approve') on conflict do nothing;
-- ---------------------------------------------------------------------------
-- Role assignments for seeded employees
-- ---------------------------------------------------------------------------
insert into public.user_roles (organization_id, employee_id, role_id, assigned_by)
select
  e.organization_id,
  e.id,
  r.id,
  '11111111-1111-1111-1111-111111111802'
from (values
  ('IND-0001', 'hod'), ('IND-0001', 'supervisor'),
  ('IND-0002', 'administrator'), ('IND-0002', 'plant_head'),
  ('IND-0003', 'operator'),
  ('IND-0004', 'hr_analyst'),
  ('IND-0005', 'quality_engineer'), ('IND-0005', 'verification_engineer'),
  ('IND-0006', 'plant_head'),
  ('IND-0007', 'finance'),
  ('IND-0008', 'supervisor'),
  ('IND-0009', 'programmer'),
  ('IND-0010', 'ehs_officer'),
  ('IND-0011', 'technical_analyst'),
  ('IND-0012', 'material_analyst'),
  ('IND-0013', 'technical_assistant'),
  ('IND-0014', 'verification_engineer'),
  ('IND-C001', 'customer_approver')
) as assignment(employee_code, role_key)
join public.employees e on e.employee_code = assignment.employee_code and e.organization_id = '11111111-1111-1111-1111-111111111111'
join public.roles r on r.organization_id = e.organization_id and r.key = assignment.role_key
on conflict (employee_id, role_id) do nothing;

-- ---------------------------------------------------------------------------
-- Skills and certifications
-- ---------------------------------------------------------------------------
insert into public.skills (id, organization_id, name, category, description)
values
  ('11111111-1111-1111-1111-111111111901', '11111111-1111-1111-1111-111111111111', 'CNC operation', 'Machining', 'Fanuc-controlled turning and milling'),
  ('11111111-1111-1111-1111-111111111902', '11111111-1111-1111-1111-111111111111', 'Robotic welding', 'Assembly', 'FANUC arc welding cell operation'),
  ('11111111-1111-1111-1111-111111111903', '11111111-1111-1111-1111-111111111111', 'GD&T inspection', 'Quality', 'Geometric dimensioning and tolerancing'),
  ('11111111-1111-1111-1111-111111111904', '11111111-1111-1111-1111-111111111111', 'CMM programming', 'Quality', 'Zeiss Calypso programming'),
  ('11111111-1111-1111-1111-111111111905', '11111111-1111-1111-1111-111111111111', 'Lean manufacturing', 'Operations', 'Value-stream and 5S facilitation'),
  ('11111111-1111-1111-1111-111111111906', '11111111-1111-1111-1111-111111111111', 'Machine safety', 'EHS', 'LOTO and machine guarding assessment'),
  ('11111111-1111-1111-1111-111111111907', '11111111-1111-1111-1111-111111111111', 'SAP production planning', 'Systems', 'Production orders and confirmations'),
  ('11111111-1111-1111-1111-111111111908', '11111111-1111-1111-1111-111111111111', 'SolidWorks', 'Engineering', 'Fixture and layout design'),
  ('11111111-1111-1111-1111-111111111909', '11111111-1111-1111-1111-111111111111', 'Operational reporting', 'Analytics', 'OEE, downtime and workforce reporting'),
  ('11111111-1111-1111-1111-111111111910', '11111111-1111-1111-1111-111111111111', 'First aid', 'EHS', 'Emergency response and first aid')
on conflict (organization_id, name) do update set category = excluded.category, description = excluded.description;

insert into public.certifications (id, organization_id, name, issuing_body, validity_months)
values
  ('11111111-1111-1111-1111-111111111951', '11111111-1111-1111-1111-111111111111', 'Six Sigma Green Belt', 'ASQ', 36),
  ('11111111-1111-1111-1111-111111111952', '11111111-1111-1111-1111-111111111111', 'CNC Machining Level 3', 'NIMS', 48),
  ('11111111-1111-1111-1111-111111111953', '11111111-1111-1111-1111-111111111111', 'Industrial Safety Practitioner', 'NEBOSH', 24),
  ('11111111-1111-1111-1111-111111111954', '11111111-1111-1111-1111-111111111111', 'Robotic Welding Specialist', 'FANUC Academy', 36),
  ('11111111-1111-1111-1111-111111111955', '11111111-1111-1111-1111-111111111111', 'CMM Inspection Specialist', 'Zeiss Academy', 36),
  ('11111111-1111-1111-1111-111111111956', '11111111-1111-1111-1111-111111111111', 'ISO 9001 Internal Auditor', 'TUV SUD', 36)
on conflict (organization_id, name) do update set issuing_body = excluded.issuing_body, validity_months = excluded.validity_months;

insert into public.employee_skills (organization_id, employee_id, skill_id, proficiency, verified, verified_by)
select e.organization_id, e.id, s.id, v.proficiency, v.verified, '11111111-1111-1111-1111-111111111802'
from (values
  ('IND-0001', 'CNC operation', 4, true), ('IND-0001', 'Operational reporting', 5, true),
  ('IND-0002', 'Lean manufacturing', 5, true), ('IND-0002', 'Operational reporting', 4, true),
  ('IND-0003', 'CNC operation', 4, true), ('IND-0003', 'Machine safety', 4, true),
  ('IND-0004', 'Operational reporting', 4, true), ('IND-0004', 'Lean manufacturing', 3, true),
  ('IND-0005', 'GD&T inspection', 5, true), ('IND-0005', 'CMM programming', 4, true),
  ('IND-0006', 'Lean manufacturing', 5, true), ('IND-0007', 'Operational reporting', 4, true),
  ('IND-0008', 'CNC operation', 4, true), ('IND-0008', 'Lean manufacturing', 3, true),
  ('IND-0009', 'CNC operation', 5, true), ('IND-0009', 'SolidWorks', 4, true),
  ('IND-0010', 'Machine safety', 5, true), ('IND-0010', 'First aid', 5, true),
  ('IND-0011', 'Operational reporting', 4, true), ('IND-0011', 'SAP production planning', 3, false),
  ('IND-0012', 'SAP production planning', 4, true), ('IND-0013', 'SolidWorks', 3, false),
  ('IND-0014', 'GD&T inspection', 5, true), ('IND-0014', 'CMM programming', 4, true)
) as v(employee_code, skill_name, proficiency, verified)
join public.employees e on e.employee_code = v.employee_code
join public.skills s on s.organization_id = e.organization_id and s.name = v.skill_name
on conflict (employee_id, skill_id) do nothing;

insert into public.employee_certifications (organization_id, employee_id, certification_id, issued_on, expires_on, status)
select e.organization_id, e.id, c.id, v.issued_on::date, v.expires_on::date, v.status::public.certification_status
from (values
  ('IND-0001', 'Six Sigma Green Belt', '2024-05-10', '2027-05-10', 'verified'),
  ('IND-0003', 'CNC Machining Level 3', '2023-11-20', '2027-11-20', 'verified'),
  ('IND-0005', 'CMM Inspection Specialist', '2024-02-14', '2027-02-14', 'verified'),
  ('IND-0005', 'ISO 9001 Internal Auditor', '2025-01-09', '2028-01-09', 'verified'),
  ('IND-0008', 'Six Sigma Green Belt', '2025-08-11', '2028-08-11', 'verified'),
  ('IND-0009', 'CNC Machining Level 3', '2022-09-01', '2026-09-01', 'expired'),
  ('IND-0010', 'Industrial Safety Practitioner', '2024-06-18', '2026-06-18', 'expired'),
  ('IND-0014', 'ISO 9001 Internal Auditor', '2025-03-12', '2028-03-12', 'verified')
) as v(employee_code, certification_name, issued_on, expires_on, status)
join public.employees e on e.employee_code = v.employee_code
join public.certifications c on c.organization_id = e.organization_id and c.name = v.certification_name
on conflict (employee_id, certification_id, issued_on) do nothing;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
insert into public.projects (id, organization_id, plant_id, department_id, code, name, description, status, manager_employee_id, start_date, end_date, progress)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111407', 'PRJ-TWIN', 'Assembly line digital twin', 'Validated digital twin for assembly line capacity and change approval.', 'active', '11111111-1111-1111-1111-111111111809', '2026-04-01', '2027-03-31', 68),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', 'PRJ-OEE', 'OEE recovery programme', 'Recover machining line OEE from 61% to 75%.', 'active', '11111111-1111-1111-1111-111111111801', '2026-07-01', '2027-06-30', 42),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111406', 'PRJ-EHS', 'Machine guarding upgrade', 'Guard and interlock upgrade across press shop.', 'active', '11111111-1111-1111-1111-111111111810', '2026-08-15', '2027-02-28', 55),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111409', 'PRJ-CUS', 'Customer PPAP evidence pack', 'Consolidated evidence and approval trail for new programme.', 'at_risk', '11111111-1111-1111-1111-111111111802', '2026-09-01', '2026-12-15', 36)
on conflict (id) do update set name = excluded.name, description = excluded.description, status = excluded.status, progress = excluded.progress, manager_employee_id = excluded.manager_employee_id;

-- ---------------------------------------------------------------------------
-- Shifts, breaks and assignments
-- ---------------------------------------------------------------------------
insert into public.shifts (id, organization_id, plant_id, department_id, code, name, start_time, end_time, timezone, lunch_start, lunch_end, grace_minutes, overtime_policy, overtime_multiplier, weekly_working_days, effective_from, is_active, color)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', null, null, 'GEN', 'General shift', '09:00', '18:00', 'Asia/Kolkata', '13:00', '13:30', 10, 'manager_approval', 1.50, '{1,2,3,4,5}', '2026-01-01', true, '#cdf22b'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', 'EARLY', 'Early shift', '06:00', '14:00', 'Asia/Kolkata', '10:00', '10:30', 10, 'after_shift', 1.50, '{1,2,3,4,5,6}', '2026-01-01', true, '#8fa3b8'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', 'NIGHT', 'Night shift', '22:00', '06:00', 'Asia/Kolkata', '02:00', '02:30', 15, 'after_shift', 1.75, '{1,2,3,4,5}', '2026-01-01', true, '#a69fb6'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111401', 'ROT', 'Rotating shift', '08:00', '20:00', 'Asia/Kolkata', '12:30', '13:15', 10, 'weekly', 1.50, '{1,2,3,4}', '2026-04-01', true, '#d9b45b')
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  lunch_start = excluded.lunch_start,
  lunch_end = excluded.lunch_end,
  grace_minutes = excluded.grace_minutes,
  overtime_policy = excluded.overtime_policy,
  overtime_multiplier = excluded.overtime_multiplier,
  weekly_working_days = excluded.weekly_working_days,
  is_active = excluded.is_active,
  color = excluded.color;

insert into public.shift_breaks (id, shift_id, name, start_time, end_time, is_paid, sort_order)
values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Morning break', '11:00', '11:15', true, 1),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Afternoon break', '16:00', '16:10', true, 2),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Tea break', '08:00', '08:15', true, 1),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc4', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'Midnight break', '00:00', '00:20', true, 1),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc5', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Tea break', '10:30', '10:45', true, 1),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc6', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Evening break', '16:30', '16:45', true, 2)
on conflict (id) do update set name = excluded.name, start_time = excluded.start_time, end_time = excluded.end_time, is_paid = excluded.is_paid, sort_order = excluded.sort_order;

insert into public.employee_shift_assignments (id, organization_id, employee_id, shift_id, effective_from, effective_to, status, assigned_by, notes)
values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111801', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', current_date - 320, null, 'active', '11111111-1111-1111-1111-111111111802', null),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111802', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', current_date - 320, null, 'active', '11111111-1111-1111-1111-111111111802', null),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', current_date - 40, current_date + 21, 'active', '11111111-1111-1111-1111-111111111802', 'Rotating roster change'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd4', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', current_date + 22, null, 'planned', '11111111-1111-1111-1111-111111111802', 'Rotating roster change'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd5', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111804', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', current_date - 320, null, 'active', '11111111-1111-1111-1111-111111111802', null),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd6', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111805', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', current_date - 60, null, 'active', '11111111-1111-1111-1111-111111111806', null),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd7', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111806', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', current_date - 320, null, 'active', '11111111-1111-1111-1111-111111111802', null),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd8', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111807', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', current_date - 320, null, 'active', '11111111-1111-1111-1111-111111111802', null),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd9', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111808', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', current_date - 320, null, 'active', '11111111-1111-1111-1111-111111111802', null),
  ('dddddddd-dddd-dddd-dddd-dddddddddd10', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111809', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', current_date - 320, null, 'active', '11111111-1111-1111-1111-111111111802', null),
  ('dddddddd-dddd-dddd-dddd-dddddddddd11', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111810', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', current_date - 320, null, 'active', '11111111-1111-1111-1111-111111111802', null),
  ('dddddddd-dddd-dddd-dddd-dddddddddd12', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111811', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', current_date - 320, null, 'active', '11111111-1111-1111-1111-111111111806', null),
  ('dddddddd-dddd-dddd-dddd-dddddddddd13', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111812', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', current_date - 320, null, 'active', '11111111-1111-1111-1111-111111111802', null),
  ('dddddddd-dddd-dddd-dddd-dddddddddd14', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111813', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', current_date - 320, null, 'active', '11111111-1111-1111-1111-111111111802', null),
  ('dddddddd-dddd-dddd-dddd-dddddddddd15', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111814', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', current_date - 60, null, 'active', '11111111-1111-1111-1111-111111111806', null),
  ('dddddddd-dddd-dddd-dddd-dddddddddd16', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111815', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', current_date - 40, null, 'active', '11111111-1111-1111-1111-111111111801', null)
on conflict (id) do update set effective_from = excluded.effective_from, effective_to = excluded.effective_to, status = excluded.status, notes = excluded.notes;

insert into public.holidays (id, organization_id, plant_id, name, holiday_date, is_optional)
values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '11111111-1111-1111-1111-111111111111', null, 'Diwali', '2026-11-08', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', '11111111-1111-1111-1111-111111111111', null, 'Christmas', '2026-12-25', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '11111111-1111-1111-1111-111111111111', null, 'New Year', '2027-01-01', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Pongal', '2027-01-15', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', '11111111-1111-1111-1111-111111111111', null, 'Republic Day', '2027-01-26', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6', '11111111-1111-1111-1111-111111111111', null, 'Holi', '2027-03-03', true)
on conflict (id) do update set name = excluded.name, holiday_date = excluded.holiday_date, is_optional = excluded.is_optional;

-- ---------------------------------------------------------------------------
-- Attendance for the last ten weekdays, generated from each shift definition
-- ---------------------------------------------------------------------------
insert into public.attendance_records (
  organization_id, employee_id, shift_id, work_date, scheduled_start, scheduled_end,
  actual_in, actual_out, status, late_minutes, early_out_minutes, overtime_minutes,
  worked_minutes, source, notes
)
select
  e.organization_id,
  e.id,
  s.id,
  d.day_ts::date,
  (d.day_ts::date + s.start_time)::timestamptz,
  ((d.day_ts::date + s.end_time) + case when s.end_time <= s.start_time then interval '1 day' else interval '0' end)::timestamptz,
  ((d.day_ts::date + s.start_time) + interval '6 minutes')::timestamptz,
  (((d.day_ts::date + s.end_time) + case when s.end_time <= s.start_time then interval '1 day' else interval '0' end) - interval '2 minutes')::timestamptz,
  (case when extract(day from d.day_ts)::int % 9 = 0 then 'late' else 'present' end)::public.attendance_status,
  case when extract(day from d.day_ts)::int % 9 = 0 then 12 else 0 end,
  0,
  0,
  480,
  'biometric',
  null
from public.employees e
cross join lateral generate_series(current_date - 10, current_date - 1, interval '1 day') as d(day_ts)
join lateral (
  select a.shift_id
  from public.employee_shift_assignments a
  where a.employee_id = e.id
    and a.effective_from <= d.day_ts::date
    and (a.effective_to is null or a.effective_to >= d.day_ts::date)
  order by a.effective_from desc
  limit 1
) a on true
join public.shifts s on s.id = a.shift_id
where e.employee_code <> 'IND-C001'
  and extract(isodow from d.day_ts) between 1 and 5
on conflict (employee_id, work_date) do nothing;

-- ---------------------------------------------------------------------------
-- Leave
-- ---------------------------------------------------------------------------
insert into public.leave_records (id, organization_id, employee_id, leave_type, start_date, end_date, days, reason, status, approved_by, approved_at)
values
  ('f7777777-7777-7777-7777-777777777771', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111801', 'casual', '2026-11-20', '2026-11-21', 2, 'Family function', 'approved', '11111111-1111-1111-1111-111111111802', now() - interval '7 days'),
  ('f7777777-7777-7777-7777-777777777772', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', 'sick', current_date + 8, current_date + 9, 2, 'Viral fever - medical certificate attached', 'submitted', null, null),
  ('f7777777-7777-7777-7777-777777777773', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111804', 'earned', current_date - 8, current_date - 8, 1, 'Personal', 'approved', '11111111-1111-1111-1111-111111111802', now() - interval '10 days')
on conflict (id) do update set status = excluded.status, approved_by = excluded.approved_by, approved_at = excluded.approved_at;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
insert into public.notifications (id, organization_id, recipient_employee_id, title, body, category, link, read_at, created_at)
values
  ('f4444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111802', '3 approval requests need your review', 'Two leave requests and one capital expenditure request are awaiting your decision.', 'approval', '/approvals', null, now() - interval '38 minutes'),
  ('f4444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111802', 'Night shift roster published', 'The Machining Line 02 roster for the next two weeks has been published by Ananya Rao.', 'schedule', '/schedule', null, now() - interval '3 hours'),
  ('f4444444-4444-4444-4444-444444444443', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111801', 'Overtime threshold reached', 'Machining Line 02 has reached 92% of the weekly overtime allowance.', 'attendance', '/attendance', null, now() - interval '55 minutes'),
  ('f4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', 'Shift reassignment confirmed', 'You move from Night shift to Early shift in three weeks.', 'schedule', '/schedule', null, now() - interval '20 hours'),
  ('f4444444-4444-4444-4444-444444444445', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111804', '2 invitations awaiting activation', 'Follow up with employees who have not accepted their invitation.', 'people', '/admin/employees', null, now() - interval '4 hours'),
  ('f4444444-4444-4444-4444-444444444446', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111805', 'Certification expires soon', 'Industrial Safety Practitioner certification for Rahul Verma expired on 18 June 2026.', 'compliance', '/admin/employees', null, now() - interval '15 hours'),
  ('f4444444-4444-4444-4444-444444444447', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111815', 'Customer evidence pack ready for approval', 'The PPAP evidence pack is ready for your review.', 'approval', '/approvals', null, now() - interval '90 minutes')
on conflict (id) do update set title = excluded.title, body = excluded.body, category = excluded.category, link = excluded.link, read_at = excluded.read_at, created_at = excluded.created_at;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
insert into public.tasks (id, organization_id, assignee_employee_id, created_by_employee_id, project_id, title, description, status, priority, due_at)
values
  ('f3333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111802', '11111111-1111-1111-1111-111111111801', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Approve November overtime plan', 'Review and sign off the machining line overtime plan before the payroll cut-off.', 'in_progress', 'high', now() + interval '1 day'),
  ('f3333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111802', '11111111-1111-1111-1111-111111111804', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'Review customer approval workflow', 'Confirm approval authority thresholds for external customer approvers.', 'todo', 'medium', now() + interval '4 days'),
  ('f3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111802', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Close OEE recovery actions', 'Verify the six actions assigned after the October performance review.', 'in_progress', 'high', now() + interval '2 days'),
  ('f3333333-3333-3333-3333-333333333334', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', '11111111-1111-1111-1111-111111111808', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Complete night-shift handover checklist', 'Record tooling condition and open work orders at handover.', 'todo', 'medium', now() + interval '1 day'),
  ('f3333333-3333-3333-3333-333333333335', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111804', '11111111-1111-1111-1111-111111111802', null, 'Activate pending employee invitations', 'Follow up on the two outstanding invitations.', 'todo', 'medium', now() + interval '1 day'),
  ('f3333333-3333-3333-3333-333333333336', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111815', '11111111-1111-1111-1111-111111111805', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'Review PPAP evidence pack', 'Review dimensional and material evidence before customer sign-off.', 'in_progress', 'high', now() + interval '3 days')
on conflict (id) do update set title = excluded.title, description = excluded.description, status = excluded.status, priority = excluded.priority, due_at = excluded.due_at;

-- ---------------------------------------------------------------------------
-- Requests and approvals
-- ---------------------------------------------------------------------------
insert into public.requests (id, organization_id, employee_id, request_type, title, details, amount, status, current_approver_id, department_id, plant_id, customer_visible, submitted_at)
values
  ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', 'leave', 'Sick leave - 2 days', 'Viral fever. Medical certificate uploaded to documents.', null, 'submitted', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111101', false, now() - interval '1 day'),
  ('f1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111801', 'expense', 'Lean training - team enrolment', 'Five operator seats for the advanced lean certification programme.', 85000, 'submitted', '11111111-1111-1111-1111-111111111802', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111101', false, now() - interval '2 days'),
  ('f1111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111809', 'access', 'Digital twin editor access', 'Requesting edit access to the Assembly Line 01 twin for program validation.', null, 'submitted', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111407', '11111111-1111-1111-1111-111111111101', false, now() - interval '3 days'),
  ('f1111111-1111-1111-1111-111111111114', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111810', 'purchase', 'Machine guarding sensors', 'Six safety interlock sensors for press line upgrade.', 142000, 'submitted', '11111111-1111-1111-1111-111111111802', '11111111-1111-1111-1111-111111111406', '11111111-1111-1111-1111-111111111102', false, now() - interval '1 day'),
  ('f1111111-1111-1111-1111-111111111115', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111805', 'customer_evidence', 'PPAP evidence pack approval', 'Dimensional, material and process evidence for customer programme P-774.', null, 'submitted', '11111111-1111-1111-1111-111111111815', '11111111-1111-1111-1111-111111111409', '11111111-1111-1111-1111-111111111101', true, now() - interval '1 day')
on conflict (id) do update set title = excluded.title, details = excluded.details, amount = excluded.amount, status = excluded.status, current_approver_id = excluded.current_approver_id, customer_visible = excluded.customer_visible;

insert into public.approvals (id, organization_id, request_id, step, approver_employee_id, status, comments)
values
  ('f2222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 1, '11111111-1111-1111-1111-111111111801', 'pending', null),
  ('f2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111112', 1, '11111111-1111-1111-1111-111111111802', 'pending', null),
  ('f2222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111112', 2, '11111111-1111-1111-1111-111111111807', 'waiting', null),
  ('f2222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111113', 1, '11111111-1111-1111-1111-111111111801', 'pending', null),
  ('f2222222-2222-2222-2222-222222222225', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111114', 1, '11111111-1111-1111-1111-111111111802', 'pending', null),
  ('f2222222-2222-2222-2222-222222222226', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111115', 1, '11111111-1111-1111-1111-111111111815', 'pending', null)
on conflict (request_id, step) do update set approver_employee_id = excluded.approver_employee_id, status = excluded.status, comments = excluded.comments;

-- ---------------------------------------------------------------------------
-- Approval authority matrix
-- ---------------------------------------------------------------------------
insert into public.approval_authorities (id, organization_id, scope_type, scope_id, request_type, role_id, level, threshold_amount, self_approval_allowed, can_delegate)
values
  ('f5555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 'department', '11111111-1111-1111-1111-111111111401', 'leave', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'hod'), 1, null, false, true),
  ('f5555555-5555-5555-5555-555555555552', '11111111-1111-1111-1111-111111111111', 'plant', '11111111-1111-1111-1111-111111111101', 'expense', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'plant_head'), 1, 100000, false, true),
  ('f5555555-5555-5555-5555-555555555553', '11111111-1111-1111-1111-111111111111', 'organization', '11111111-1111-1111-1111-111111111111', 'expense', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'finance'), 2, null, false, true),
  ('f5555555-5555-5555-5555-555555555554', '11111111-1111-1111-1111-111111111111', 'plant', '11111111-1111-1111-1111-111111111102', 'purchase', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'plant_head'), 1, 250000, false, false),
  ('f5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'organization', '11111111-1111-1111-1111-111111111111', 'customer_evidence', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'customer_approver'), 2, null, false, false),
  ('f5555555-5555-5555-5555-555555555556', '11111111-1111-1111-1111-111111111111', 'department', '11111111-1111-1111-1111-111111111401', 'access', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'hod'), 1, null, false, true)
on conflict (id) do update set level = excluded.level, threshold_amount = excluded.threshold_amount, self_approval_allowed = excluded.self_approval_allowed, can_delegate = excluded.can_delegate, request_type = excluded.request_type;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
insert into public.invitations (id, organization_id, email, employee_id, department_id, plant_id, role_key, status, invited_by, expires_at, created_at)
values
  ('f6666666-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111', 'new.operator@indra.example', null, '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111101', 'operator', 'pending', '11111111-1111-1111-1111-111111111804', now() + interval '5 days', now() - interval '2 days'),
  ('f6666666-6666-6666-6666-666666666662', '11111111-1111-1111-1111-111111111111', 'nisha.patel@indra.example', '11111111-1111-1111-1111-111111111811', '11111111-1111-1111-1111-111111111408', '11111111-1111-1111-1111-111111111102', 'technical_analyst', 'pending', '11111111-1111-1111-1111-111111111804', now() + interval '5 days', now() - interval '2 days'),
  ('f6666666-6666-6666-6666-666666666663', '11111111-1111-1111-1111-111111111111', 'aditya.bose@indra.example', '11111111-1111-1111-1111-111111111814', '11111111-1111-1111-1111-111111111403', '11111111-1111-1111-1111-111111111102', 'verification_engineer', 'accepted', '11111111-1111-1111-1111-111111111804', now() - interval '30 days', now() - interval '40 days')
on conflict (id) do update set status = excluded.status, role_key = excluded.role_key, expires_at = excluded.expires_at;

-- ---------------------------------------------------------------------------
-- Restricted medical records (RLS: self or employees.medical.read)
-- ---------------------------------------------------------------------------
insert into public.employee_medical (employee_id, organization_id, blood_group, allergies, conditions, emergency_contact_name, emergency_contact_phone, last_checkup_on, notes)
values
  ('11111111-1111-1111-1111-111111111803', '11111111-1111-1111-1111-111111111111', 'B+', 'Penicillin', 'None declared', 'Ritu Mehta', '+91 98400 22003', '2026-04-18', 'Restricted - HR and EHS only.'),
  ('11111111-1111-1111-1111-111111111810', '11111111-1111-1111-1111-111111111111', 'O+', 'None', 'Asthma (controlled)', 'Sneha Verma', '+91 98400 22010', '2026-06-02', 'Restricted - occupational health.')
on conflict (employee_id) do update set blood_group = excluded.blood_group, allergies = excluded.allergies, conditions = excluded.conditions, emergency_contact_name = excluded.emergency_contact_name, emergency_contact_phone = excluded.emergency_contact_phone, last_checkup_on = excluded.last_checkup_on, notes = excluded.notes;

-- ---------------------------------------------------------------------------
-- Audit history
-- ---------------------------------------------------------------------------
insert into public.audit_logs (id, organization_id, actor_employee_id, action, entity_type, entity_id, summary, ip_address, created_at)
values
  ('abababab-abab-abab-abab-ababababab01', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111801', 'shift.assigned', 'employee_shift_assignment', 'dddddddd-dddd-dddd-dddd-ddddddddddd3', 'Assigned Night shift to Arjun Mehta', '10.20.1.18', now() - interval '3 hours'),
  ('abababab-abab-abab-abab-ababababab02', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111802', 'request.approved', 'request', 'f1111111-1111-1111-1111-111111111112', 'Reviewed the lean training expense request', '10.20.1.10', now() - interval '26 hours'),
  ('abababab-abab-abab-abab-ababababab03', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111804', 'invitation.sent', 'invitation', 'f6666666-6666-6666-6666-666666666662', 'Invited Nisha Patel as Technical Analyst', '10.20.1.22', now() - interval '50 hours'),
  ('abababab-abab-abab-abab-ababababab04', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111809', 'digital_twin.updated', 'production_line', '11111111-1111-1111-1111-111111111501', 'Updated Assembly Line 01 digital twin', '10.20.1.31', now() - interval '70 hours'),
  ('abababab-abab-abab-abab-ababababab05', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111802', 'role.assigned', 'user_role', '11111111-1111-1111-1111-111111111814', 'Assigned Verification Engineer role to Aditya Bose', '10.20.1.10', now() - interval '74 hours')
on conflict (id) do update set action = excluded.action, summary = excluded.summary, created_at = excluded.created_at;

commit;
