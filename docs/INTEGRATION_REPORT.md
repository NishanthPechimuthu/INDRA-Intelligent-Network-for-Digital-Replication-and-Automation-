# Module 01 — Platform Foundation · Integration Report

Branch: `feature/platform-foundation`
Scope: authentication, organization structure, employee profiles, RBAC, shift management,
common dashboard shell, migrations and seed data.
Module 02 was not started.

---

## 1. What was verified

| Check | Result |
|---|---|
| `npm run lint` | Passed — 0 errors, 15 pre-existing warnings in studio files |
| `npm run typecheck` (`tsc --noEmit`) | Passed — no errors |
| `npm test` (Node test runner) | Passed — 69/69 tests |
| Migrations against PostgreSQL 16 | Passed — all 7 applied in order, then both seed files |
| RLS read isolation | Passed — operator/admin/customer scopes behave as designed |
| RLS write boundaries | Passed — privilege escalation and direct writes rejected |
| Request → approval RPC chain | Passed — submit, segregation of duties, approval, audit |
| Existing 3D studio at `/` | Passed — canvas, `window.__INDRA__` and `window.__ITS__` present |
| Auth sign-in (demo provider) | Passed — admin lands on `/admin/organization` with resolved roles |

The Playwright end-to-end suite was **not** run for this report; it needs system Chrome plus a
SwiftShader software renderer, which is a heavier environment requirement than the checks above.
The studio was instead confirmed live in the browser (canvas and test hooks present).

## 2. How the database was verified

The procedure is committed as `supabase/verify/verify.sh`, which is what produced the numbers
below. Supabase's own tables (`auth.users`, `auth.sessions`, `auth.identities`,
`storage.buckets`, `storage.objects`) are stubbed in a `postgres:16-alpine` container by
`supabase/verify/supabase-stubs.sql`, mirroring their real column shapes and the unique
constraints the seed relies on. Then:

1. Stub `auth`/`storage` schemas, Supabase roles, `auth.uid()` reading
   `request.jwt.claim.sub`.
2. Apply `supabase/migrations/*.sql` in filename order with `ON_ERROR_STOP=1`.
3. Apply `supabase/seed.sql`, then `supabase/seed-auth.sql`.

Result: 34 tables created, 89 RLS policies defined, 6 auth identities, 15 employees, 18 role
assignments, 461 role-permission grants, 6 `user_profiles` rows created by the
`handle_new_user()` trigger.

Note: the two seed files are order-dependent (`seed-auth.sql` after `seed.sql`), and that ordering
is documented in both files. Running them in the other order leaves employees unlinked from
identities.

## 3. Authorization evidence

RLS was exercised by switching to the `authenticated` role and setting the JWT subject claim.

Read isolation:

| Caller | Employees visible | Plants | Medical | Requests |
|---|---|---|---|---|
| Operator (Chennai, Production) | 11 (plant scope) | 1 | 1 (own record only) | own |
| Administrator | 15 (all) | 2 | all | all |
| Customer Approver (external) | 1 (self only) | — | none | 1 (`customer_visible` only), 0 hidden |

Write boundaries — every attempt below was rejected:

| Attempt | Outcome |
|---|---|
| `assign_role(self, 'administrator')` | `You do not have permission to assign roles.` |
| Direct `insert into user_roles` | `permission denied for table user_roles` |
| Direct `insert into audit_logs` | `permission denied for table audit_logs` |
| Direct `insert into requests` | `permission denied for table requests` |
| `update employees set employment_status = 'terminated'` | `You may only update your own contact details.` |
| `update employees set designation_id = <Plant Head>` on a colleague | `UPDATE 0` (RLS filtered) |
| `delete from requests` for other employees | `permission denied for table requests` |

Workflow:

1. `submit_request('leave', ...)` created the request with status `submitted` and resolved
   approver IND-0001 from the approval-authority matrix, plus a `pending` approval step.
2. The requester calling `decide_approval` was rejected with
   `Segregation of duties: you cannot approve your own request.`
3. The assigned HOD approved successfully; the request became `approved` with `decided_at` set and
   two audit rows written.

## 4. Front-end verification

Checked in the browser against the Vite dev server in demo mode:

- `/login` renders email/password, Google, Microsoft, forgot-password, the six demo identities and
  the reserved OAuth note.
- Selecting the administrator identity then signing in redirected to `/admin/organization` and
  resolved "Administrator · Plant Head", Chennai Plant, 15 headcount, 2 plants, 9 departments.
- `/admin/roles` rendered all sixteen roles and the permission matrix.
- `/admin/shifts` rendered the four seeded shifts with times, breaks and working days.
- `/` still loads the 3D studio: `document.title` is the studio title, a `<canvas>` exists and both
  `window.__INDRA__` and `window.__ITS__` are present.

Permission-driven navigation was confirmed by the unit suite: an operator does not receive
`/admin/roles` or `/approvals` in the sidebar and `canVisit('/admin/roles', …)` is false, while the
administrator receives both.

## 5. Known limitations carried into Module 02

- OAuth buttons require Google/Azure to be enabled on the Supabase project; without that they
  return a provider error rather than a silent failure.
- The local demo provider is a presentation harness, not a security boundary. Deployments must set
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The studio's own 4M approval gate remains browser-session scoped and is not yet routed through
  `decide_approval`.
- `employee-documents` / `employee-avatars` buckets were created and their policies defined, but
  document upload UI was not part of Module 01's required screens.
- Qdrant and LLM integration are reserved and unimplemented by design.

## 6. Reproducing

```bash
npm install
npm run lint && npm run typecheck && npm test
npm run dev        # studio on /, platform on /login
```

For the database layer, either use the Supabase CLI (`supabase db reset` then
`psql "$DATABASE_URL" -f supabase/seed-auth.sql`) or run the repeatable Docker check:

```bash
./supabase/verify/verify.sh
```

It applies every migration and both seed files to a throwaway PostgreSQL container, then asserts
the read isolation, write denials and approval workflow summarized in sections 2 and 3. It
exits non-zero on the first failure and removes the container afterwards.


## 7. Module 02 · workforce and production operations

### Connected environment

The hosted Supabase project referenced by `.env` was empty, so Modules 01 and 02 were applied to it in
order: 11 migrations, `seed.sql`, `seed-auth.sql` and `seed-module2.sql`. `VITE_SUPABASE_URL` held a
PostgreSQL connection string, which the browser cannot use; it was corrected to the project's HTTPS
API URL and the connection strings were moved to server-side `SUPABASE_DB_URL` /
`SUPABASE_POOLER_URL` entries. `.env` remains gitignored.

The project's direct database host is IPv6-only from this network, so migrations were applied through
the `ap-south-1` connection pooler with the `postgres.<project-ref>` role.

### Verified against the live database

Sign-in, PostgREST and RLS were exercised with real demo tokens, and the write paths with
`set local role authenticated` plus a JWT claim inside transactions that were rolled back:

| Check | Result |
| --- | --- |
| Password sign-in (`admin@indra.example`) | HTTP 200, session issued |
| `get_my_context()` | roles and permissions returned |
| Admin employee visibility | 15 rows |
| Operator production tasks / orders / reports | 4 / 3 / 3 (own scope) |
| Operator assigns their own task to another employee | rejected: "Task assignment can only be changed by a supervisor" |
| Unbalanced production entry (50 = 40 + 5) | rejected with an explanatory message |
| Valid entry with material consumption | accepted, task and order totals refreshed |
| Supervisor: safety incidents / clinical detail | 1 / 0 |
| HR: clinical detail | 1 |
| Overwrite of an approved program version | rejected: "immutable; register a new version instead" |
| HOD approving an in-review version by another author | previous version superseded, `current_version` advanced |
| HOD approving the pending reassignment | task reassigned, blocked task cancelled, status `applied` |

### Local checks

`npm test` 78/78, `npx eslint .` 0 errors / 15 pre-existing warnings, `npx tsc --noEmit` clean,
`npm run build` succeeds. The 3D studio at `/` is untouched.

### Deliberate design decisions

- Production tasks extend the Module 01 `tasks` table rather than introducing a parallel task store.
- Every approval-bearing workflow (material, reassignment, repair, equipment, manpower, program
  modification) writes a row in the shared `requests` / `approvals` tables.
- Clinical safety detail is a separate table so a supervisor can be granted operational visibility
  without ever receiving medical data; this is enforced by policy, not by the UI.
- Machine program payloads live in a private bucket and are served through short-lived signed URLs
  recorded in the audit log.
