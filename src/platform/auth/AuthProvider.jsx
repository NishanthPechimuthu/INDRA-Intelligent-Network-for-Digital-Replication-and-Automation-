import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../supabaseClient.js';
import { demoContext, DEMO_ACCOUNTS } from '../data/demoData.js';
import {
  activateInvitation,
  clearDemoSession,
  demoLogin,
  findDemoAccount,
  getDemoData,
  getDemoSession,
} from '../data/demoStore.js';
import { hasPermission, resolveHome } from '../data/accessControl.js';

const AuthContext = createContext(null);

function normaliseError(error) {
  if (!error) return { code: 'unknown', message: 'Something went wrong. Please try again.' };
  const code = error.code || error.error_code || error.name || 'request_failed';
  let message = error.message || 'Something went wrong. Please try again.';
  if (message === 'Invalid login credentials') message = 'The email address or password is incorrect.';
  if (message.includes('Email not confirmed')) message = 'Confirm your email address before signing in.';
  if (message.includes('rate limit')) message = 'Too many attempts. Wait a moment and try again.';
  return { code, message };
}

function contextFromDemo(employeeId) {
  const data = getDemoData();
  return demoContext(data, employeeId);
}

async function fetchSupabaseContext(session) {
  const client = supabase;
  if (!client || !session?.user) return null;

  const rpc = await client.rpc('get_my_context');
  if (!rpc.error && rpc.data) {
    const payload = rpc.data;
    return {
      ...payload,
      employeeId: payload.employee?.id || payload.employeeId,
      roleKeys: payload.roleKeys || (payload.roles || []).map((role) => role.key),
      permissions: payload.permissions || [],
    };
  }

  // Defence in depth: if the RPC has not been applied yet, derive the context
  // from RLS-protected tables. Authorization still comes from the database.
  const { data: profile } = await client
    .from('user_profiles')
    .select('id,full_name,email,phone,avatar_url,timezone,locale')
    .eq('id', session.user.id)
    .maybeSingle();

  const { data: employee, error: employeeError } = await client
    .from('employees')
    .select(
      'id,organization_id,plant_id,department_id,production_line_id,employee_code,first_name,last_name,full_name,work_email,phone,photo_url,designation_id,reporting_manager_id,job_category_id,employment_status,joined_on,designations(title),departments(name),plants(name,code),production_lines(name),job_categories(name)',
    )
    .eq('user_id', session.user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (employeeError) throw employeeError;

  const { data: assignments } = await client
    .from('user_roles')
    .select('role_id, roles!inner(id,key,name,level,organization_id), role_permissions(permissions!inner(key))')
    .eq('user_id', session.user.id);

  const roles = (assignments || []).map((assignment) => ({
    id: assignment.roles?.id,
    key: assignment.roles?.key,
    name: assignment.roles?.name,
    level: assignment.roles?.level,
  }));
  const permissions = [
    ...new Set(
      (assignments || []).flatMap((assignment) =>
        (assignment.role_permissions || []).map((entry) => entry.permissions?.key).filter(Boolean),
      ),
    ),
  ];

  if (!employee) return null;
  const mappedEmployee = {
    ...employee,
    fullName: employee.full_name || profile?.full_name || session.user.email,
    email: employee.work_email || profile?.email || session.user.email,
    designation: employee.designations?.title || '—',
    department: employee.departments?.name || '—',
    plant: employee.plants?.name || '—',
    plantCode: employee.plants?.code || '—',
    productionLine: employee.production_lines?.name || '—',
    jobCategory: employee.job_categories?.name || '—',
    roles: roles.map((role) => ({ key: role.key, name: role.name, level: role.level })),
    roleKeys: roles.map((role) => role.key),
  };

  const { data: organization } = await client
    .from('organizations')
    .select('*')
    .eq('id', employee.organization_id)
    .maybeSingle();

  return {
    employee: mappedEmployee,
    employeeId: employee.id,
    profile: {
      id: session.user.id,
      employeeId: employee.id,
      fullName: mappedEmployee.fullName,
      email: mappedEmployee.email,
      photoUrl: employee.photo_url || profile?.avatar_url,
      timezone: profile?.timezone || 'Asia/Kolkata',
      locale: profile?.locale || 'en-IN',
    },
    organization,
    roles,
    roleKeys: roles.map((role) => role.key),
    permissions,
    scope: {
      organizationId: employee.organization_id,
      plantId: employee.plant_id,
      departmentId: employee.department_id,
      productionLineId: employee.production_line_id,
    },
  };
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    mode: isSupabaseConfigured ? 'supabase' : 'demo',
    session: null,
    context: null,
    error: null,
    suspended: false,
    requiresMfa: false,
    recovery: false,
  });
  const mounted = useRef(true);
  const loadingSession = useRef(false);

  const applyContext = useCallback((context, session, extra = {}) => {
    const suspended = ['suspended', 'terminated'].includes(context?.employee?.employmentStatus);
    setState((current) => ({
      ...current,
      loading: false,
      session,
      context: suspended ? null : context,
      suspended,
      error: null,
      ...extra,
    }));
  }, []);

  const loadSession = useCallback(
    async (session, event = null) => {
      if (!session) {
        setState((current) => ({ ...current, loading: false, session: null, context: null, suspended: false }));
        return null;
      }
      if (loadingSession.current) return null;
      loadingSession.current = true;
      try {
        let mfa = false;
        if (supabase) {
          const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          mfa = data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2';
        }
        const context = await fetchSupabaseContext(session);
        if (!mounted.current) return null;
        if (!context) {
          applyContext(null, session, { error: { code: 'profile_missing', message: 'No employee profile is linked to this account. Contact your administrator.' } });
          return null;
        }
        if (event === 'PASSWORD_RECOVERY') {
          setState((current) => ({ ...current, loading: false, session, context: null, recovery: true }));
          return context;
        }
        applyContext(context, session, { requiresMfa: mfa });
        return context;
      } catch (error) {
        if (!mounted.current) return null;
        setState((current) => ({ ...current, loading: false, session, context: null, error: normaliseError(error) }));
        return null;
      } finally {
        loadingSession.current = false;
      }
    },
    [applyContext],
  );

  useEffect(() => {
    mounted.current = true;
    let subscription = null;
    if (isSupabaseConfigured && supabase) {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!mounted.current) return;
          if (data.session) loadSession(data.session);
          else setState((current) => ({ ...current, loading: false }));
        })
        .catch((error) => {
          if (mounted.current) setState((current) => ({ ...current, loading: false, error: normaliseError(error) }));
        });
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return;
        if (event === 'SIGNED_OUT') {
          setState((current) => ({ ...current, loading: false, session: null, context: null, suspended: false, requiresMfa: false }));
          return;
        }
        if (session) loadSession(session, event);
      });
      subscription = data.subscription;
    } else {
      const session = getDemoSession();
      if (session?.suspended) {
        setState((current) => ({ ...current, loading: false, session, suspended: true }));
      } else if (session) {
        const context = contextFromDemo(session.employeeId);
        if (context) applyContext(context, session);
        else setState((current) => ({ ...current, loading: false }));
      } else {
        setState((current) => ({ ...current, loading: false }));
      }
    }
    return () => {
      mounted.current = false;
      subscription?.unsubscribe();
    };
  }, [applyContext, loadSession]);

  const refreshContext = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return null;
      return loadSession(data.session);
    }
    const session = getDemoSession();
    if (!session) return null;
    if (session.suspended) {
      setState((current) => ({ ...current, suspended: true, context: null }));
      return null;
    }
    const context = contextFromDemo(session.employeeId);
    if (context) applyContext(context, session);
    return context;
  }, [applyContext, loadSession]);

  const signIn = useCallback(
    async (email, password) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: normaliseError(error) };
        if (data.session) {
          const context = await loadSession(data.session);
          if (data.user?.identities?.length === 0) {
            return { error: { code: 'invalid_credentials', message: 'The email address or password is incorrect.' } };
          }
          if (!context) {
            return { error: { code: 'profile_missing', message: 'No employee profile is linked to this account.' } };
          }
          if (['suspended', 'terminated'].includes(context.employee?.employmentStatus)) {
            return { error: { code: 'suspended', message: 'This account is suspended. Contact your HR administrator.' } };
          }
          const { data: levels } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          return {
            context,
            home: resolveHome(context.roles),
            requiresMfa: levels?.nextLevel === 'aal2' && levels?.currentLevel !== 'aal2',
          };
        }
        return { error: { code: 'session_missing', message: 'Sign-in did not return a session. Try again.' } };
      }
      const result = demoLogin(email, password);
      if (result.error) return { error: result.error };
      const context = contextFromDemo(result.session.employeeId);
      if (!context) return { error: { code: 'profile_missing', message: 'No employee profile is linked to this account.' } };
      applyContext(context, result.session);
      return { context, home: resolveHome(context.roles) };
    },
    [applyContext, loadSession],
  );

  const signInWithOAuth = useCallback(async (provider) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: { code: 'oauth_unavailable', message: 'OAuth is not configured in this demo. Add Supabase credentials to enable Google or Microsoft sign-in.' } };
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: provider === 'azure' ? { prompt: 'select_account' } : undefined,
        scopes: provider === 'azure' ? 'openid email profile' : undefined,
      },
    });
    if (error) return { error: normaliseError(error) };
    return { data };
  }, []);

  const signOut = useCallback(async ({ global = false } = {}) => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut({ scope: global ? 'global' : 'local' });
    }
    clearDemoSession();
    setState((current) => ({ ...current, session: null, context: null, suspended: false, requiresMfa: false }));
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    if (!isSupabaseConfigured || !supabase) {
      const account = findDemoAccount(email);
      return {
        demo: true,
        accountFound: Boolean(account),
        message: account
          ? 'Demo mode: use the reset form to set a new password locally. No email is sent.'
          : 'Demo mode: no local account matches that email. No email is sent.',
      };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: normaliseError(error) };
    return { message: 'If the address belongs to an INDRA account, a reset link is on its way.' };
  }, []);

  const completePasswordReset = useCallback(
    async (password) => {
      if (!isSupabaseConfigured || !supabase) {
        if (state.session?.email) {
          const { resetDemoPassword } = await import('../data/demoStore.js');
          resetDemoPassword(state.session.email, password);
          setState((current) => ({ ...current, recovery: false }));
          return { message: 'Demo password updated. Sign in with your new password.' };
        }
        return { demo: true, message: 'Demo mode: open the reset form from a known demo account to update its password.' };
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: normaliseError(error) };
      setState((current) => ({ ...current, recovery: false }));
      return { message: 'Password updated. You can continue to your dashboard.' };
    },
    [state.session],
  );

  const activateAccount = useCallback(
    async ({ invitationId, email, password }) => {
      if (!isSupabaseConfigured || !supabase) {
        return activateInvitation({ invitationId, email, password });
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: normaliseError(error) };
      if (invitationId) {
        const { error: rpcError } = await supabase.rpc('accept_invitation', {
          p_invitation_id: invitationId,
          p_password_set: true,
        });
        if (rpcError) return { error: normaliseError(rpcError) };
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) await loadSession(sessionData.session);
      return { message: 'Account activated. Welcome to INDRA.' };
    },
    [loadSession],
  );

  const challengeMfa = useCallback(async (factorId) => {
    if (!isSupabaseConfigured || !supabase) return { challengeId: 'demo-challenge' };
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error) return { error: normaliseError(error) };
    return { challengeId: data.id, data };
  }, []);

  const verifyMfa = useCallback(async ({ factorId, challengeId, code }) => {
    if (!isSupabaseConfigured || !supabase) {
      if (String(code) === '123456') {
        setState((current) => ({ ...current, requiresMfa: false }));
        return { ok: true };
      }
      return { error: { code: 'invalid_code', message: 'Demo verification code is 123456.' } };
    }
    const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    if (error) return { error: normaliseError(error) };
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) await loadSession(sessionData.session);
    return { ok: true, data };
  }, [loadSession]);

  const listMfaFactors = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return { factors: [{ id: 'demo-totp', friendlyName: 'INDRA Authenticator', factorType: 'totp', status: 'verified' }] };
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return { error: normaliseError(error), factors: [] };
    return { factors: data?.totp || [] };
  }, []);

  const enrollMfa = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return { demo: true, message: 'Demo mode: MFA is simulated with code 123456.' };
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'INDRA Authenticator' });
    if (error) return { error: normaliseError(error) };
    return { data };
  }, []);

  const unenrollMfa = useCallback(async (factorId) => {
    if (!isSupabaseConfigured || !supabase) return { message: 'Demo factor left unchanged.' };
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return { error: normaliseError(error) };
    return { message: 'Authenticator removed.' };
  }, []);

  const listSessions = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      const { getDemoSessions } = await import('../data/demoStore.js');
      return { sessions: getDemoSessions() };
    }
    const { data, error } = await supabase.rpc('list_my_sessions');
    if (error) return { error: normaliseError(error), sessions: [] };
    return { sessions: (data || []).map((item) => ({
      id: item.id,
      userAgent: item.user_agent || 'INDRA client',
      ipAddress: item.ip || '—',
      createdAt: item.created_at,
      lastSeenAt: item.updated_at,
      current: false,
    })) };
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      configured: isSupabaseConfigured,
      isDemo: !isSupabaseConfigured,
      demoAccounts: DEMO_ACCOUNTS,
      isAuthenticated: Boolean(state.context && state.session && !state.requiresMfa),
      hasPermission: (permission) => hasPermission(state.context?.permissions, permission),
      signIn,
      signInWithOAuth,
      signOut,
      sendPasswordReset,
      completePasswordReset,
      activateAccount,
      challengeMfa,
      verifyMfa,
      listMfaFactors,
      enrollMfa,
      unenrollMfa,
      listSessions,
      refreshContext,
    }),
    [
      state,
      signIn,
      signInWithOAuth,
      signOut,
      sendPasswordReset,
      completePasswordReset,
      activateAccount,
      challengeMfa,
      verifyMfa,
      listMfaFactors,
      enrollMfa,
      unenrollMfa,
      listSessions,
      refreshContext,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function usePermissions() {
  const { context } = useAuth();
  return context?.permissions || [];
}
