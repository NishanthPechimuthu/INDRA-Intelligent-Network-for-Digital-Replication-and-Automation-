// INDRA Platform Foundation · Module 01
// Protected invitation operations.
//
// Deploy with: supabase functions deploy platform-operations
// Secrets:     supabase secrets set PLATFORM_URL=https://your-app.example
//
// Authorization is checked twice: the caller must hold the workforce
// permission (server-side, using their own JWT and the database helper), and
// the invitation insert itself runs through RLS with the caller's JWT. The
// service-role client is only used for the Auth admin invitation email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface InvitePayload {
  action: 'invite-employee';
  email?: string;
  employeeId?: string | null;
  roleKey?: string;
  plantId?: string | null;
  departmentId?: string | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400, code = 'operation_failed') {
  return json({ error: { code, message } }, status);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return errorResponse('Method not allowed.', 405, 'method_not_allowed');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const platformUrl = Deno.env.get('PLATFORM_URL') ?? Deno.env.get('SITE_URL') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse('The function is missing Supabase runtime secrets.', 500, 'not_configured');
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return errorResponse('Authentication is required.', 401, 'unauthenticated');
  }

  let payload: InvitePayload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('The request body must be valid JSON.', 400, 'invalid_body');
  }

  if (payload.action !== 'invite-employee') {
    return errorResponse(`Unsupported action: ${payload.action ?? 'none'}.`, 400, 'unsupported_action');
  }

  const email = payload.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse('A valid email address is required.', 400, 'invalid_email');
  }
  if (!payload.roleKey) {
    return errorResponse('An initial role is required.', 400, 'invalid_role');
  }

  // Caller-scoped client: every query and RPC is subject to RLS.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return errorResponse('The session is invalid or has expired.', 401, 'unauthenticated');
  }

  const { data: allowed, error: permissionError } = await caller.rpc('has_permission', {
    p_permission: 'employees.manage',
  });
  if (permissionError) return errorResponse(permissionError.message, 500, permissionError.code);
  if (!allowed) {
    return errorResponse('You do not have permission to invite employees.', 403, 'forbidden');
  }

  const { data: callerEmployee, error: employeeError } = await caller
    .from('employees')
    .select('id, organization_id')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (employeeError || !callerEmployee) {
    return errorResponse('No active employee record is linked to this account.', 403, 'employee_not_linked');
  }

  const { data: existing } = await caller
    .from('invitations')
    .select('id, status, expires_at')
    .eq('organization_id', callerEmployee.organization_id)
    .eq('email', email)
    .in('status', ['pending'])
    .maybeSingle();
  if (existing) {
    return errorResponse('A pending invitation already exists for this email address.', 409, 'invitation_exists');
  }

  const { data: invitation, error: invitationError } = await caller
    .from('invitations')
    .insert({
      organization_id: callerEmployee.organization_id,
      email,
      employee_id: payload.employeeId || null,
      department_id: payload.departmentId || null,
      plant_id: payload.plantId || null,
      role_key: payload.roleKey,
      status: 'pending',
      invited_by: callerEmployee.id,
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    })
    .select()
    .single();

  if (invitationError) return errorResponse(invitationError.message, 400, invitationError.code);
  if (!invitation) return errorResponse('The invitation could not be created.', 500);

  const redirectTo = platformUrl
    ? `${platformUrl.replace(/\/$/, '')}/activate?invitation=${invitation.id}&email=${encodeURIComponent(email)}`
    : undefined;

  let emailSent = false;
  let emailWarning: string | null = null;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { invitation_id: invitation.id, role_key: payload.roleKey },
  });

  if (invite.error) {
    // An existing Auth user is not an invitation failure: the employee can
    // sign in and activate against the pending invitation record.
    const alreadyRegistered = /already been registered|already exists/i.test(invite.error.message);
    if (!alreadyRegistered) emailWarning = invite.error.message;
    emailSent = alreadyRegistered;
  } else {
    emailSent = true;
  }

  return json({
    data: invitation,
    emailSent,
    emailWarning,
  });
});
