#!/usr/bin/env bash
# Apply the INDRA Module 01 migrations and seeds to a throwaway PostgreSQL
# container, then assert that Row Level Security isolates reads and blocks
# unauthorized writes. Requires Docker; changes nothing outside the container.
#
#   ./supabase/verify/verify.sh
#
# Exits non-zero on the first failed migration, seed or assertion.

set -euo pipefail

CONTAINER=indra-pg-verify
PORT=${INDRA_VERIFY_PORT:-55433}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

pass() { printf '  ok  %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1" >&2; exit 1; }

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

command -v docker >/dev/null || fail "docker is required"

echo "Starting $CONTAINER on port $PORT"
cleanup
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=verify -e POSTGRES_DB=indra \
  -p "$PORT:5432" postgres:16-alpine >/dev/null

# The postgres entrypoint starts a temporary server, stops it, then starts the
# real one. Require a successful query on two consecutive attempts.
ready=0
for _ in $(seq 1 90); do
  if docker exec "$CONTAINER" psql -U postgres -d indra -tAc 'select 1' >/dev/null 2>&1; then
    ready=$((ready + 1))
    [ "$ready" -ge 2 ] && break
  else
    ready=0
  fi
  sleep 1
done
[ "$ready" -ge 2 ] || fail "database did not start"

psql_file() {
  docker cp "$1" "$CONTAINER:/tmp/apply.sql" >/dev/null
  docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d indra -q -f /tmp/apply.sql
}

echo "Applying Supabase stubs"
psql_file "$ROOT/supabase/verify/supabase-stubs.sql"
pass "auth and storage schemas stubbed"

echo "Applying migrations"
for file in "$ROOT"/supabase/migrations/*.sql; do
  psql_file "$file"
  pass "applied $(basename "$file")"
done

echo "Applying seeds"
psql_file "$ROOT/supabase/seed.sql"
pass "applied seed.sql"
psql_file "$ROOT/supabase/seed-auth.sql"
pass "applied seed-auth.sql"

# Queries that begin with `set role` / `set request.jwt...` print SET lines, so
# keep only the final line before trimming.
read_scalar() {
  docker exec "$CONTAINER" psql -U postgres -d indra -tA -c "$1" | tail -n1 | tr -d '[:space:]'
}

expect() {
  local label=$1 expected=$2 actual=$3
  [ "$actual" = "$expected" ] || fail "$label: expected $expected, got $actual"
  pass "$label = $expected"
}

echo "Checking seeded volume"
expect "tables" 34 "$(read_scalar "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'")"
expect "employees" 15 "$(read_scalar 'select count(*) from public.employees')"
expect "user_profiles" 6 "$(read_scalar 'select count(*) from public.user_profiles')"
expect "auth users" 6 "$(read_scalar 'select count(*) from auth.users')"

echo "Checking RLS read isolation"
expect "operator sees own plant employees" 11 "$(read_scalar "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222803'; select count(*) from public.employees")"
expect "administrator sees all employees" 15 "$(read_scalar "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222802'; select count(*) from public.employees")"
expect "operator sees only own medical record" 1 "$(read_scalar "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222803'; select count(*) from public.employee_medical")"
expect "customer approver sees only shared requests" 0 "$(read_scalar "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222815'; select count(*) from public.requests where customer_visible = false")"

echo "Checking RLS write boundaries"
denied() {
  local label=$1 sql=$2
  if docker exec "$CONTAINER" psql -U postgres -d indra -q -c "$sql" >/dev/null 2>&1; then
    fail "$label was allowed"
  fi
  pass "$label denied"
}

denied "direct audit_logs insert" "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222803'; insert into public.audit_logs (organization_id, actor_employee_id, action, entity_type, entity_id, summary) values ('11111111-1111-1111-1111-111111111111', (select id from public.employees where user_id = auth.uid()), 'forged', 'test', gen_random_uuid(), 'forged');"
denied "direct user_roles insert" "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222803'; insert into public.user_roles (organization_id, employee_id, role_id) values ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', (select id from public.roles where key = 'administrator' limit 1));"
denied "direct requests insert" "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222803'; insert into public.requests (organization_id, employee_id, request_type, title) values ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', 'leave', 'bypass');"
denied "self privilege escalation via assign_role" "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222803'; select public.assign_role('22222222-2222-2222-2222-222222222803'::uuid, 'administrator');"
denied "self employment-status change" "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222803'; update public.employees set employment_status = 'terminated' where user_id = auth.uid();"

echo "Checking the approval workflow"
expect "submit_request assigns a level-1 approver" 1 "$(read_scalar "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222803'; select count(*) from public.submit_request('leave', 'Verification request', 'Automated check.', null, false) s where s.current_approver_id is not null")"

REQUEST_ID=$(read_scalar "select id from public.requests where title = 'Verification request' order by created_at desc limit 1")
APPROVAL_ID=$(read_scalar "select id from public.approvals where request_id = '$REQUEST_ID' limit 1")

denied "requester self-approval" "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222803'; select public.decide_approval('$APPROVAL_ID'::uuid, 'approved', 'self');"

docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d indra -q -c "set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222801'; select public.decide_approval('$APPROVAL_ID'::uuid, 'approved', 'Reviewed.');" >/dev/null
expect "assigned approver can approve" approved "$(read_scalar "select status from public.requests where id = '$REQUEST_ID'")"

echo "All checks passed."
