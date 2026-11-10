import { isSupabaseConfigured, supabase } from '../supabaseClient.js';
import * as demo from './demoStore.js';

/**
 * Mutations used by the platform UI. In demo mode they update the local dataset;
 * with Supabase configured every call lands on PostgREST/RLS or a protected RPC.
 * The browser never decides whether an operation is authorized.
 */

function failure(error) {
  return { error: { code: error?.code || 'operation_failed', message: error?.message || 'The operation could not be completed.' } };
}

async function guarded(operation) {
  try {
    const result = await operation();
    if (result?.error) return failure(result.error);
    // Demo mutations persist a snapshot and return { data, result }; the caller
    // wants the mutation result, while Supabase responses expose PostgREST data.
    if (result && typeof result === 'object' && 'result' in result && 'data' in result) {
      return { data: result.result ?? null };
    }
    return { data: result?.data ?? result ?? true };
  } catch (error) {
    return failure(error);
  }
}

export function markNotificationRead(notificationId) {
  if (!isSupabaseConfigured) return guarded(() => demo.markNotificationRead(notificationId));
  return guarded(async () => supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId));
}

export function markAllNotificationsRead(employeeId) {
  if (!isSupabaseConfigured) return guarded(() => demo.markAllNotificationsRead(employeeId));
  return guarded(async () =>
    supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_employee_id', employeeId).is('read_at', null),
  );
}

export function updateTaskStatus(taskId, status) {
  if (!isSupabaseConfigured) return guarded(() => demo.updateTaskStatus(taskId, status, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.from('tasks').update({ status }).eq('id', taskId));
}

export function createRequest(payload) {
  if (!isSupabaseConfigured) return guarded(() => demo.createRequest(payload, demo.getDemoSession()?.employeeId));
  return guarded(async () =>
    supabase.rpc('submit_request', {
      p_request_type: payload.requestType,
      p_title: payload.title,
      p_details: payload.details,
      p_amount: payload.amount ? Number(payload.amount) : null,
      p_customer_visible: Boolean(payload.customerVisible),
    }),
  );
}

export function decideApproval({ requestId, approvalId, decision, comments }) {
  if (!isSupabaseConfigured) return guarded(() => demo.decideApproval({ requestId, approvalId, decision, comments }, demo.getDemoSession()?.employeeId));
  return guarded(async () =>
    supabase.rpc('decide_approval', {
      p_approval_id: approvalId,
      p_decision: decision,
      p_comments: comments || null,
    }),
  );
}

export function updateEmployee(employeeId, patch) {
  if (!isSupabaseConfigured) return guarded(() => demo.updateEmployee(employeeId, patch, demo.getDemoSession()?.employeeId));
  const mapped = {
    ...(patch.employmentStatus != null ? { employment_status: patch.employmentStatus } : {}),
    ...(patch.employmentType != null ? { employment_type: patch.employmentType } : {}),
    ...(patch.workMode != null ? { work_mode: patch.workMode } : {}),
    ...(patch.phone != null ? { phone: patch.phone } : {}),
    ...(patch.workEmail != null ? { work_email: patch.workEmail } : {}),
    ...(patch.personalEmail != null ? { personal_email: patch.personalEmail } : {}),
    ...(patch.photoUrl !== undefined ? { photo_url: patch.photoUrl } : {}),
    ...(patch.reportingManagerId !== undefined ? { reporting_manager_id: patch.reportingManagerId || null } : {}),
    ...(patch.designationId != null ? { designation_id: patch.designationId } : {}),
    ...(patch.jobCategoryId != null ? { job_category_id: patch.jobCategoryId } : {}),
    ...(patch.plantId != null ? { plant_id: patch.plantId } : {}),
    ...(patch.departmentId != null ? { department_id: patch.departmentId } : {}),
    ...(patch.productionLineId !== undefined ? { production_line_id: patch.productionLineId || null } : {}),
  };
  return guarded(async () => supabase.from('employees').update(mapped).eq('id', employeeId).select().single());
}

export function assignRole(employeeId, roleKey) {
  if (!isSupabaseConfigured) return guarded(() => demo.assignRole(employeeId, roleKey, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.rpc('assign_role', { p_employee_id: employeeId, p_role_key: roleKey }));
}

export function removeRole(employeeId, roleKey) {
  if (!isSupabaseConfigured) return guarded(() => demo.removeRole(employeeId, roleKey, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.rpc('remove_role', { p_employee_id: employeeId, p_role_key: roleKey }));
}

export function createShift(payload) {
  if (!isSupabaseConfigured) return guarded(() => demo.createShift(payload, demo.getDemoSession()?.employeeId));
  return guarded(async () => {
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        organization_id: payload.organizationId || undefined,
        plant_id: payload.plantId || null,
        department_id: payload.departmentId || null,
        code: payload.code,
        name: payload.name,
        start_time: payload.startTime,
        end_time: payload.endTime,
        timezone: payload.timezone,
        lunch_start: payload.lunchStart || null,
        lunch_end: payload.lunchEnd || null,
        grace_minutes: Number(payload.graceMinutes) || 0,
        overtime_policy: payload.overtimePolicy,
        overtime_multiplier: Number(payload.overtimeMultiplier) || 1,
        weekly_working_days: payload.weeklyWorkingDays,
        effective_from: payload.effectiveFrom,
        effective_to: payload.effectiveTo || null,
      })
      .select()
      .single();
    if (error) return { error };
    if (payload.breaks?.length) {
      await supabase.from('shift_breaks').insert(
        payload.breaks.map((item, index) => ({
          shift_id: data.id,
          name: item.name,
          start_time: item.startTime,
          end_time: item.endTime,
          is_paid: Boolean(item.isPaid),
          sort_order: index + 1,
        })),
      );
    }
    return { data };
  });
}

export function updateShift(shiftId, patch) {
  if (!isSupabaseConfigured) return guarded(() => demo.updateShift(shiftId, patch, demo.getDemoSession()?.employeeId));
  return guarded(async () => {
    const mapped = {
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(patch.code != null ? { code: patch.code } : {}),
      ...(patch.plantId !== undefined ? { plant_id: patch.plantId || null } : {}),
      ...(patch.departmentId !== undefined ? { department_id: patch.departmentId || null } : {}),
      ...(patch.startTime != null ? { start_time: patch.startTime } : {}),
      ...(patch.endTime != null ? { end_time: patch.endTime } : {}),
      ...(patch.timezone != null ? { timezone: patch.timezone } : {}),
      ...(patch.lunchStart !== undefined ? { lunch_start: patch.lunchStart || null } : {}),
      ...(patch.lunchEnd !== undefined ? { lunch_end: patch.lunchEnd || null } : {}),
      ...(patch.graceMinutes !== undefined ? { grace_minutes: Number(patch.graceMinutes) || 0 } : {}),
      ...(patch.overtimePolicy != null ? { overtime_policy: patch.overtimePolicy } : {}),
      ...(patch.overtimeMultiplier !== undefined ? { overtime_multiplier: Number(patch.overtimeMultiplier) || 1 } : {}),
      ...(patch.weeklyWorkingDays ? { weekly_working_days: patch.weeklyWorkingDays } : {}),
      ...(patch.effectiveFrom != null ? { effective_from: patch.effectiveFrom } : {}),
      ...(patch.effectiveTo !== undefined ? { effective_to: patch.effectiveTo || null } : {}),
      ...(patch.color != null ? { color: patch.color } : {}),
      ...(patch.isActive !== undefined ? { is_active: Boolean(patch.isActive) } : {}),
    };
    const { data, error } = await supabase.from('shifts').update(mapped).eq('id', shiftId).select().single();
    if (error) return { error };
    if (patch.breaks) {
      await supabase.from('shift_breaks').delete().eq('shift_id', shiftId);
      if (patch.breaks.length) {
        await supabase.from('shift_breaks').insert(
          patch.breaks.map((item, index) => ({
            shift_id: shiftId,
            name: item.name,
            start_time: item.startTime,
            end_time: item.endTime,
            is_paid: Boolean(item.isPaid),
            sort_order: index + 1,
          })),
        );
      }
    }
    return { data };
  });
}

export function assignShift(employeeId, shiftId, effectiveFrom) {
  if (!isSupabaseConfigured) return guarded(() => demo.assignShift(employeeId, shiftId, effectiveFrom, demo.getDemoSession()?.employeeId));
  return guarded(async () => {
    await supabase
      .from('employee_shift_assignments')
      .update({ effective_to: new Date(new Date(`${effectiveFrom}T00:00:00`).getTime() - 86400000).toISOString().slice(0, 10) })
      .eq('employee_id', employeeId)
      .is('effective_to', null);
    return supabase
      .from('employee_shift_assignments')
      .insert({ employee_id: employeeId, shift_id: shiftId, effective_from: effectiveFrom, status: 'planned' })
      .select()
      .single();
  });
}

export function inviteEmployee(payload) {
  if (!isSupabaseConfigured) return guarded(() => demo.inviteEmployee(payload, demo.getDemoSession()?.employeeId));
  return guarded(async () => {
    const { data, error } = await supabase.functions.invoke('platform-operations', {
      body: { action: 'invite-employee', ...payload },
    });
    if (!error) return data;
    return supabase
      .from('invitations')
      .insert({
        email: payload.email,
        employee_id: payload.employeeId || null,
        department_id: payload.departmentId || null,
        plant_id: payload.plantId || null,
        role_key: payload.roleKey,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .select()
      .single();
  });
}

export function revokeInvitation(invitationId) {
  if (!isSupabaseConfigured) return guarded(() => demo.revokeInvitation(invitationId, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.from('invitations').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', invitationId));
}

export function updateApprovalAuthority(authorityId, patch) {
  if (!isSupabaseConfigured) return guarded(() => demo.updateApprovalAuthority(authorityId, patch, demo.getDemoSession()?.employeeId));
  return guarded(async () => {
    const mapped = {
      ...(patch.level != null ? { level: Number(patch.level) } : {}),
      ...(patch.thresholdAmount !== undefined ? { threshold_amount: patch.thresholdAmount } : {}),
      ...(patch.selfApprovalAllowed !== undefined ? { self_approval_allowed: Boolean(patch.selfApprovalAllowed) } : {}),
      ...(patch.canDelegate !== undefined ? { can_delegate: Boolean(patch.canDelegate) } : {}),
      ...(patch.requestType != null ? { request_type: patch.requestType } : {}),
    };
    return supabase.from('approval_authorities').update(mapped).eq('id', authorityId).select().single();
  });
}

export function updateProfilePhoto(employeeId, photoUrl) {
  if (!isSupabaseConfigured) return guarded(() => demo.updateEmployee(employeeId, { photoUrl }, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.from('employees').update({ photo_url: photoUrl }).eq('id', employeeId).select().single());
}

export function createDepartment(payload) {
  if (!isSupabaseConfigured) return guarded(() => demo.createDepartment(payload, demo.getDemoSession()?.employeeId));
  return guarded(async () =>
    supabase
      .from('departments')
      .insert({
        organization_id: payload.organizationId,
        plant_id: payload.plantId,
        name: payload.name,
        code: payload.code,
        cost_center: payload.costCenter || null,
        manager_employee_id: payload.managerEmployeeId || null,
      })
      .select()
      .single(),
  );
}

export function updateDepartment(departmentId, patch) {
  if (!isSupabaseConfigured) return guarded(() => demo.updateDepartment(departmentId, patch, demo.getDemoSession()?.employeeId));
  const mapped = {
    ...(patch.name != null ? { name: patch.name } : {}),
    ...(patch.code != null ? { code: patch.code } : {}),
    ...(patch.costCenter !== undefined ? { cost_center: patch.costCenter } : {}),
    ...(patch.managerEmployeeId !== undefined ? { manager_employee_id: patch.managerEmployeeId } : {}),
    ...(patch.plantId !== undefined ? { plant_id: patch.plantId } : {}),
  };
  return guarded(async () => supabase.from('departments').update(mapped).eq('id', departmentId).select().single());
}

export function updateRolePermissions(roleKey, permissions) {
  if (!isSupabaseConfigured) return guarded(() => demo.updateRolePermissions(roleKey, permissions, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.rpc('set_role_permissions', { p_role_key: roleKey, p_permissions: permissions }));
}

export function updateOrganization(organizationId, patch) {
  if (!isSupabaseConfigured) return guarded(() => demo.updateOrganization(patch, demo.getDemoSession()?.employeeId));
  const mapped = {
    ...(patch.name != null ? { name: patch.name } : {}),
    ...(patch.legalName !== undefined ? { legal_name: patch.legalName } : {}),
    ...(patch.code != null ? { code: patch.code } : {}),
    ...(patch.timezone != null ? { timezone: patch.timezone } : {}),
    ...(patch.currency != null ? { currency: patch.currency } : {}),
    ...(patch.locale != null ? { locale: patch.locale } : {}),
    ...(patch.website !== undefined ? { website: patch.website } : {}),
    ...(patch.supportEmail !== undefined ? { support_email: patch.supportEmail } : {}),
    ...(patch.supportPhone !== undefined ? { support_phone: patch.supportPhone } : {}),
    ...(patch.address !== undefined ? { address: patch.address } : {}),
  };
  return guarded(async () => supabase.from('organizations').update(mapped).eq('id', organizationId).select().single());
}

export async function uploadDocument({ file, entityType, entityId, category, organizationId, employeeId }) {
  if (!isSupabaseConfigured) {
    return { error: { code: 'demo_storage', message: 'Storage uploads require Supabase credentials. Demo mode keeps documents local.' } };
  }
  const extension = file.name.split('.').pop() || 'bin';
  const path = `${organizationId}/${employeeId}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage.from('employee-documents').upload(path, file, { upsert: false, contentType: file.type });
  if (upload.error) return failure(upload.error);
  const insert = await supabase.from('documents').insert({
    bucket: 'employee-documents',
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    category,
    entity_type: entityType,
    entity_id: entityId,
    owner_employee_id: employeeId,
  }).select().single();
  if (insert.error) return failure(insert.error);
  const signed = await supabase.storage.from('employee-documents').createSignedUrl(path, 3600);
  return { data: { ...insert.data, url: signed.data?.signedUrl || null } };
}

// ---------------------------------------------------------------------------
// Module 02 · workforce and production operations
// ---------------------------------------------------------------------------
export function transitionTask(taskId, action, reason) {
  if (!isSupabaseConfigured) {
    return guarded(() => demo.transitionProductionTask(taskId, action, reason, demo.getDemoSession()?.employeeId));
  }
  const rpc = {
    accepted: 'production_task_transition',
    pause: 'pause_production_task',
    resume: 'resume_production_task',
    start: 'start_production_task',
    complete: 'complete_production_task',
    blocked: 'production_task_transition',
    cancelled: 'production_task_transition',
  }[action];
  if (!rpc) return { error: { code: 'unsupported_action', message: `Unknown task action ${action}.` } };
  return guarded(async () => {
    if (action === 'accepted' || action === 'blocked' || action === 'cancelled') {
      return supabase.rpc('production_task_transition', { p_task_id: taskId, p_status: action, p_reason: reason || null });
    }
    return supabase.rpc(rpc, action === 'pause' ? { p_task_id: taskId, p_reason: reason || null } : { p_task_id: taskId });
  });
}

export function submitProductionReport(payload) {
  if (!isSupabaseConfigured) return guarded(() => demo.recordProductionReport(payload, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.rpc('record_production_report', { p_payload: payload }));
}

export function submitTechnicalIssue(payload) {
  if (!isSupabaseConfigured) return guarded(() => demo.createTechnicalIssue(payload, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.rpc('report_technical_issue', { p_payload: payload }));
}

export function submitToolDamage(payload) {
  if (!isSupabaseConfigured) return guarded(() => demo.createToolDamage(payload, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.rpc('report_tool_damage', { p_payload: payload }));
}

export function submitMaterialRequest(payload) {
  if (!isSupabaseConfigured) return guarded(() => demo.createMaterialRequest(payload, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.rpc('request_material', { p_payload: payload }));
}

export function submitReassignment(payload) {
  if (!isSupabaseConfigured) return guarded(() => demo.createReassignment(payload, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.rpc('request_reassignment', { p_payload: payload }));
}

export function submitShiftHandover(payload) {
  if (!isSupabaseConfigured) return guarded(() => demo.submitShiftReport(payload, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.rpc('submit_shift_report', { p_payload: payload }));
}

export function acknowledgeHandover(reportId) {
  if (!isSupabaseConfigured) return guarded(() => demo.acknowledgeShiftReport(reportId, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.rpc('acknowledge_shift_report', { p_report_id: reportId }));
}

export function registerProgramVersion(payload) {
  if (!isSupabaseConfigured) return guarded(() => demo.registerProgramVersion(payload, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.rpc('register_program_version', { p_payload: payload }));
}

export function decideProgramVersion(versionId, decision, notes) {
  if (!isSupabaseConfigured) {
    return guarded(() => demo.decideProgramVersion(versionId, decision, notes, demo.getDemoSession()?.employeeId));
  }
  return guarded(async () => supabase.rpc('decide_program_version', { p_version_id: versionId, p_decision: decision, p_notes: notes || null }));
}

export function setIssueStatus(issueId, status) {
  if (!isSupabaseConfigured) return guarded(() => demo.updateIssueStatus(issueId, status, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.from('technical_issues').update({ status }).eq('id', issueId).select().single());
}

/**
 * Machine program payload upload. Files are private: the signed URL is created
 * on demand and every access is written to the audit trail by the
 * log_program_access RPC.
 */
export async function uploadProgramFile({ file, organizationId, machineId, programId }) {
  if (!isSupabaseConfigured) {
    return { error: { code: 'demo_storage', message: 'Program uploads require Supabase storage. Demo mode records the revision metadata only.' } };
  }
  const extension = file.name.split('.').pop() || 'bin';
  const path = `${organizationId}/${machineId}/${programId}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage.from('machine-programs').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (upload.error) return failure(upload.error);
  return { data: { storagePath: path, fileName: file.name, sizeBytes: file.size, mimeType: file.type } };
}

export async function programDownloadUrl(versionId, storagePath) {
  if (!isSupabaseConfigured) {
    return { error: { code: 'demo_storage', message: 'Signed program downloads require Supabase storage.' } };
  }
  await supabase.rpc('log_program_access', { p_version_id: versionId, p_action: 'program.download' });
  const signed = await supabase.storage.from('machine-programs').createSignedUrl(storagePath, 300);
  if (signed.error) return failure(signed.error);
  return { data: { url: signed.data.signedUrl } };
}

export async function uploadEvidence({ file, organizationId, employeeId }) {
  if (!isSupabaseConfigured) {
    return { error: { code: 'demo_storage', message: 'Evidence uploads require Supabase storage. Demo mode keeps the report text only.' } };
  }
  const extension = file.name.split('.').pop() || 'bin';
  const path = `${organizationId}/${employeeId}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage.from('incident-evidence').upload(path, file, { upsert: false, contentType: file.type });
  if (upload.error) return failure(upload.error);
  const insert = await supabase.from('documents').insert({
    bucket: 'incident-evidence',
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    category: 'evidence',
    entity_type: 'safety_incident',
    owner_employee_id: employeeId,
  }).select().single();
  if (insert.error) return failure(insert.error);
  return { data: { ...insert.data, storagePath: path } };
}

/** Supervisor task creation. Assignment fields are writable only with tasks.manage. */
export function createProductionTask(payload) {
  if (!isSupabaseConfigured) {
    return guarded(() => demo.createProductionTask(payload, demo.getDemoSession()?.employeeId));
  }
  return guarded(async () => {
    const { data, error } = await supabase.from('tasks').insert({
      organization_id: payload.organizationId,
      assignee_employee_id: payload.assigneeEmployeeId,
      created_by_employee_id: payload.createdByEmployeeId,
      supervisor_employee_id: payload.supervisorEmployeeId,
      project_id: payload.projectId || null,
      production_order_id: payload.productionOrderId,
      workstation_id: payload.workstationId || null,
      machine_id: payload.machineId || null,
      title: payload.title,
      description: payload.description || null,
      work_instructions: payload.workInstructions || null,
      status: 'todo',
      priority: payload.priority || 'medium',
      due_at: payload.dueAt || null,
      planned_start_at: payload.plannedStartAt || null,
      planned_end_at: payload.plannedEndAt || null,
      target_quantity: Number(payload.targetQuantity) || null,
      production_status: 'assigned',
      required_skill_id: payload.requiredSkillId || null,
      required_certification_id: payload.requiredCertificationId || null,
    }).select().single();
    if (error) return { error };
    return { data };
  });
}

export function updateTaskPriority(taskId, priority) {
  if (!isSupabaseConfigured) return guarded(() => demo.updateTaskPriority(taskId, priority, demo.getDemoSession()?.employeeId));
  return guarded(async () => supabase.from('tasks').update({ priority }).eq('id', taskId).select().single());
}
