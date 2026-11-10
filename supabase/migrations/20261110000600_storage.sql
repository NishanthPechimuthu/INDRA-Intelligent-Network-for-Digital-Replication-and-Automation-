-- INDRA Platform Foundation · Module 01
-- 00600: private document storage and public employee avatars.
--
-- Object paths are namespaced by organization and employee:
--   employee-documents  <organization_id>/<employee_id>/<uuid>.<ext>
--   employee-avatars    <organization_id>/<employee_id>/<uuid>.<ext>
--
-- Authorization mirrors the documents table policies: owners may manage their
-- own files, HR/administrators may manage files for employees in scope, and
-- everyone else in the organization may only read documents when they hold
-- documents.read and can access that employee.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'employee-documents',
    'employee-documents',
    false,
    26214400,
    array[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'employee-avatars',
    'employee-avatars',
    true,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Path helpers (avoid repeating casts and folder parsing in every policy)
-- ---------------------------------------------------------------------------
create or replace function public.storage_object_org(p_name text)
returns uuid
language sql
immutable
as $$
  select nullif((storage.foldername(p_name))[1], '')::uuid;
$$;

create or replace function public.storage_object_employee(p_name text)
returns uuid
language sql
immutable
as $$
  select nullif((storage.foldername(p_name))[2], '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- employee-documents
-- ---------------------------------------------------------------------------
create policy employee_documents_read on storage.objects
for select to authenticated
using (
  bucket_id = 'employee-documents'
  and public.storage_object_org(name) = public.current_org_id()
  and (
    public.storage_object_employee(name) = public.current_employee_id()
    or public.is_admin()
    or (
      public.has_permission('documents.read')
      and public.can_access_employee(public.storage_object_employee(name))
    )
  )
);

create policy employee_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'employee-documents'
  and public.storage_object_org(name) = public.current_org_id()
  and public.has_permission('documents.upload')
  and (
    public.storage_object_employee(name) = public.current_employee_id()
    or public.has_permission('employees.manage')
    or public.is_admin()
  )
);

create policy employee_documents_update on storage.objects
for update to authenticated
using (
  bucket_id = 'employee-documents'
  and public.storage_object_org(name) = public.current_org_id()
  and (
    public.storage_object_employee(name) = public.current_employee_id()
    or public.is_admin()
  )
)
with check (
  bucket_id = 'employee-documents'
  and public.storage_object_org(name) = public.current_org_id()
  and (
    public.storage_object_employee(name) = public.current_employee_id()
    or public.is_admin()
  )
);

create policy employee_documents_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'employee-documents'
  and public.storage_object_org(name) = public.current_org_id()
  and (
    public.storage_object_employee(name) = public.current_employee_id()
    or public.is_admin()
    or (
      public.has_permission('documents.delete')
      and public.can_access_employee(public.storage_object_employee(name))
    )
  )
);

-- ---------------------------------------------------------------------------
-- employee-avatars (bucket is public for read; writes stay scoped)
-- ---------------------------------------------------------------------------
create policy employee_avatars_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'employee-avatars'
  and public.storage_object_org(name) = public.current_org_id()
  and (
    public.storage_object_employee(name) = public.current_employee_id()
    or public.has_permission('employees.manage')
    or public.is_admin()
  )
);

create policy employee_avatars_update on storage.objects
for update to authenticated
using (
  bucket_id = 'employee-avatars'
  and public.storage_object_org(name) = public.current_org_id()
  and (
    public.storage_object_employee(name) = public.current_employee_id()
    or public.has_permission('employees.manage')
    or public.is_admin()
  )
)
with check (
  bucket_id = 'employee-avatars'
  and public.storage_object_org(name) = public.current_org_id()
  and (
    public.storage_object_employee(name) = public.current_employee_id()
    or public.has_permission('employees.manage')
    or public.is_admin()
  )
);

create policy employee_avatars_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'employee-avatars'
  and public.storage_object_org(name) = public.current_org_id()
  and (
    public.storage_object_employee(name) = public.current_employee_id()
    or public.has_permission('employees.manage')
    or public.is_admin()
  )
);
