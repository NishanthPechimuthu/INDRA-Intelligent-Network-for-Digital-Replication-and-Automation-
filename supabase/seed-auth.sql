-- INDRA platform demo auth seed (Module 01, extended by Module 02 identities)
-- Run AFTER supabase/seed.sql:
--   psql "$DATABASE_URL" -f supabase/seed-auth.sql
-- or add it to the Supabase seed workflow.
--
-- Every account uses the demo password: IndraDemo!2026
-- These accounts exist only for local/demo environments. Never run this file
-- against a production project.
--
-- The fixed auth UUIDs are linked to the seeded employee records; the normal
-- public.user_profiles trigger keeps the profile row in sync.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Demo identities
-- ---------------------------------------------------------------------------
with accounts(id, email, full_name, employee_code) as (
  values
    ('22222222-2222-2222-2222-222222222801'::uuid, 'ananya.rao@indra.example', 'Ananya Rao', 'IND-0001'),
    ('22222222-2222-2222-2222-222222222802'::uuid, 'admin@indra.example', 'Rajesh Kumar', 'IND-0002'),
    ('22222222-2222-2222-2222-222222222803'::uuid, 'arjun.mehta@indra.example', 'Arjun Mehta', 'IND-0003'),
    ('22222222-2222-2222-2222-222222222804'::uuid, 'priya.nair@indra.example', 'Priya Nair', 'IND-0004'),
    ('22222222-2222-2222-2222-222222222805'::uuid, 'vikram.singh@indra.example', 'Vikram Singh', 'IND-0005'),
    ('22222222-2222-2222-2222-222222222818'::uuid, 'karthik.subramanian@indra.example', 'Karthik Subramanian', 'IND-0008'),
    ('22222222-2222-2222-2222-222222222819'::uuid, 'divya.sharma@indra.example', 'Divya Sharma', 'IND-0009'),
    ('22222222-2222-2222-2222-222222222820'::uuid, 'rahul.verma@indra.example', 'Rahul Verma', 'IND-0010'),
    ('22222222-2222-2222-2222-222222222815'::uuid, 'customer@partner.example', 'Elena Fischer', 'IND-C001')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  accounts.id,
  'authenticated',
  'authenticated',
  accounts.email,
  crypt('IndraDemo!2026', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', array['email']),
  jsonb_build_object('full_name', accounts.full_name, 'employee_code', accounts.employee_code),
  now(),
  now(),
  '', '', '', ''
from accounts
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

-- Email identities are required for password sign-in in recent GoTrue versions.
with accounts(id, email) as (
  values
    ('22222222-2222-2222-2222-222222222801'::uuid, 'ananya.rao@indra.example'),
    ('22222222-2222-2222-2222-222222222802'::uuid, 'admin@indra.example'),
    ('22222222-2222-2222-2222-222222222803'::uuid, 'arjun.mehta@indra.example'),
    ('22222222-2222-2222-2222-222222222804'::uuid, 'priya.nair@indra.example'),
    ('22222222-2222-2222-2222-222222222805'::uuid, 'vikram.singh@indra.example'),
    ('22222222-2222-2222-2222-222222222818'::uuid, 'karthik.subramanian@indra.example'),
    ('22222222-2222-2222-2222-222222222819'::uuid, 'divya.sharma@indra.example'),
    ('22222222-2222-2222-2222-222222222820'::uuid, 'rahul.verma@indra.example'),
    ('22222222-2222-2222-2222-222222222815'::uuid, 'customer@partner.example')
)
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  accounts.id,
  accounts.id::text,
  jsonb_build_object('sub', accounts.id::text, 'email', accounts.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
from accounts
on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Link auth identities to employee records
-- ---------------------------------------------------------------------------
update public.employees e
set user_id = accounts.id
from (
  values
    ('22222222-2222-2222-2222-222222222801'::uuid, 'IND-0001'),
    ('22222222-2222-2222-2222-222222222802'::uuid, 'IND-0002'),
    ('22222222-2222-2222-2222-222222222803'::uuid, 'IND-0003'),
    ('22222222-2222-2222-2222-222222222804'::uuid, 'IND-0004'),
    ('22222222-2222-2222-2222-222222222805'::uuid, 'IND-0005'),
    ('22222222-2222-2222-2222-222222222818'::uuid, 'IND-0008'),
    ('22222222-2222-2222-2222-222222222819'::uuid, 'IND-0009'),
    ('22222222-2222-2222-2222-222222222820'::uuid, 'IND-0010'),
    ('22222222-2222-2222-2222-222222222815'::uuid, 'IND-C001')
) as accounts(id, employee_code)
where e.employee_code = accounts.employee_code
  and e.organization_id = '11111111-1111-1111-1111-111111111111';

insert into public.user_profiles (id, full_name, email, timezone, locale)
select
  accounts.id,
  accounts.full_name,
  accounts.email,
  'Asia/Kolkata',
  'en-IN'
from (
  values
    ('22222222-2222-2222-2222-222222222801'::uuid, 'Ananya Rao', 'ananya.rao@indra.example'),
    ('22222222-2222-2222-2222-222222222802'::uuid, 'Rajesh Kumar', 'admin@indra.example'),
    ('22222222-2222-2222-2222-222222222803'::uuid, 'Arjun Mehta', 'arjun.mehta@indra.example'),
    ('22222222-2222-2222-2222-222222222804'::uuid, 'Priya Nair', 'priya.nair@indra.example'),
    ('22222222-2222-2222-2222-222222222805'::uuid, 'Vikram Singh', 'vikram.singh@indra.example'),
    ('22222222-2222-2222-2222-222222222818'::uuid, 'Karthik Subramanian', 'karthik.subramanian@indra.example'),
    ('22222222-2222-2222-2222-222222222819'::uuid, 'Divya Sharma', 'divya.sharma@indra.example'),
    ('22222222-2222-2222-2222-222222222820'::uuid, 'Rahul Verma', 'rahul.verma@indra.example'),
    ('22222222-2222-2222-2222-222222222815'::uuid, 'Elena Fischer', 'customer@partner.example')
) as accounts(id, full_name, email)
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  timezone = excluded.timezone,
  locale = excluded.locale;

commit;
