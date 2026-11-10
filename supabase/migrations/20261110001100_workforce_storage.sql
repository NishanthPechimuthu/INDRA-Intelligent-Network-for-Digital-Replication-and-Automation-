-- INDRA Platform Foundation · Module 02
-- 01100: private storage for machine programs and incident evidence.
--
--   machine-programs   <org_id>/<machine_id>/<program_id>/<uuid>.<ext>
--   incident-evidence  <org_id>/<employee_id>/<uuid>.<ext>
--
-- Machine programs are executable payloads. They are never public: only holders
-- of programs.read may download, and every access is written to the audit log by
-- the application before the signed URL is created.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'machine-programs',
    'machine-programs',
    false,
    52428800,
    array[
      'text/plain',
      'application/octet-stream',
      'application/zip',
      'application/json',
      'application/pdf',
      'application/x-gcode',
      'text/x-gcode'
    ]
  ),
  (
    'incident-evidence',
    'incident-evidence',
    false,
    26214400,
    array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'application/pdf']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy machine_programs_read on storage.objects
for select to authenticated
using (
  bucket_id = 'machine-programs'
  and public.storage_object_org(name) = public.current_org_id()
  and public.has_permission('programs.read')
);

create policy machine_programs_write on storage.objects
for insert to authenticated
with check (
  bucket_id = 'machine-programs'
  and public.storage_object_org(name) = public.current_org_id()
  and public.has_permission('programs.manage')
);

create policy machine_programs_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'machine-programs'
  and public.storage_object_org(name) = public.current_org_id()
  and public.has_permission('programs.manage')
  -- Approved payloads are evidence and must never be deleted.
  and not exists (
    select 1 from public.machine_program_versions v
    where v.storage_path = storage.objects.name and v.status in ('approved', 'superseded')
  )
);

create policy incident_evidence_read on storage.objects
for select to authenticated
using (
  bucket_id = 'incident-evidence'
  and public.storage_object_org(name) = public.current_org_id()
  and (
    public.storage_object_employee(name) = public.current_employee_id()
    or public.has_permission('safety.operational.read')
    or public.has_permission('production.issues.read')
  )
);

create policy incident_evidence_write on storage.objects
for insert to authenticated
with check (
  bucket_id = 'incident-evidence'
  and public.storage_object_org(name) = public.current_org_id()
  and public.storage_object_employee(name) = public.current_employee_id()
);
