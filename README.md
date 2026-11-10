# INDRA · Industrial Digital Twin Studio

**Version 0.0.3** · Intelligent Network for Digital Replication and Automation

INDRA is a browser-based 3D factory design and discrete-event simulation studio. Lay out a
production line on the grid, connect real material routes, assign workers and watch products move
through the graph while live metrics update beside the scene. The dark industrial workspace keeps
the component library on the left, the Three.js canvas in the centre and Properties / Results / 4M
change management on the right, with simulation controls and headline KPIs along the bottom.

The project keeps the original C++/WebAssembly discrete-event core for instant batch runs and adds
one shared JavaScript live engine used by both **Continuous run** and **Step run**. Nothing is
rebuilt from a mock-up: the existing graph model, persistence, transforms, connection validation
and change-management workflow are preserved.

Since Module 01 the same build also ships the **INDRA operations platform**: authenticated
dashboards, organization and workforce master data, a sixteen-role permission model enforced by
PostgreSQL Row Level Security, employee profiles, and shift/attendance management. The 3D studio
still owns `/`; the platform lives on named routes such as `/login` and `/dashboard`. Both are the
same application and the same design system — see
[Platform foundation (Module 01)](#platform-foundation-module-01).

## Highlights

- **Local 3D models** – CC0 factory hardware (Kenney Factory Kit) and an animated CC0 worker
  (Quaternius/Cinevva), bundled under `assets/glb/` and loaded asynchronously with caching,
  normalisation, shadows and procedural fallbacks. See [ASSET_LICENSES.md](ASSET_LICENSES.md).
- **Worker avatars** – the editable *Assigned Workers* property controls how many avatars stand at
  a workstation. They are laid out in non-overlapping arcs, hidden at zero, and switch between
  available / working / unavailable animation and status colour from the live station state.
- **One live engine** – Continuous run and Step run drive the same deterministic runtime. Products
  follow real connections and conveyor/queue/processing locations; pause, resume, stop, reset,
  1× / 2× / 4×, next/previous operation and operation numbers are available in the simulation bar.
- **Graph-driven simulation** – directed routes, branching, buffers, conveyor delays, processing
  capacity, worker requirements, downtime, blocking, starvation, inspection rejection and product
  state. Products never teleport between stations.
- **Expanded analytics** – input / good / rejected, throughput, utilisation, OEE with explicit
  assumptions, downtime, average cycle and wait time, WIP, bottleneck, power, worker utilisation,
  per-line and per-station metrics, hourly good/rejected chart, diagnostics and a reset action.
  Actual, calculated and assumed values are labelled separately.
- **Industrial properties** – component-specific forms are grouped into collapsible sections for
  information, transform, operational, production, resource, energy, reliability/maintenance and
  live metrics. Numeric fields show SI or practical units, changed values are highlighted and can be
  reset, and calculated metrics are read-only. Unsupported telemetry is labelled as a future
  enhancement instead of being fabricated.
- **Engineering design system** – Midnight Black surfaces, Soft Ivory text and Neon Lime accents,
  with Inter for interface copy and JetBrains Mono for values, units and identifiers.
- **Branding** – INDRA logo, favicon, title and metadata come from `assets/logos/` and
  `assets/favicons/`. Header and footer show the product name and version.

## Requirements

- Node.js 20+
- npm
- Optional: Emscripten for rebuilding the C++/WASM core
- Optional: Docker 24+ and Docker Compose for the production container

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL (normally <http://localhost:5173>). The prebuilt WASM files are already in
`public/simulation.mjs` and `public/simulation.wasm`, so Emscripten is not required to run the app.

## Build and preview

```bash
npm run build
npm run preview
```

The production bundle is written to `dist/` and contains the GLBs, shared palette texture, logos
and favicon. `npm run preview` serves it on <http://localhost:4173>.

## Docker

The application is a static single-page app. It needs no backend, database or secrets; the runtime
image contains only nginx and the production bundle.

```bash
cp .env.example .env       # optional; defaults to host port 8080
docker compose up --build -d
```

Open <http://localhost:8080> (or the `INDRA_PORT` from `.env`). The container exposes an HTTP
health check at `GET /healthz`; `docker compose ps` reports the service as healthy. Hashed assets
are cached for one year, the SPA has a history fallback, and no persistent volume is required.

Stop the container with `docker compose down`.

## Platform foundation (Module 01)

Module 01 adds an authenticated operations layer on top of the studio. It is not a separate
application: `src/main.jsx` routes `/` to the existing studio and every other platform path to the
platform shell, and both share the Midnight Black / Soft Ivory / Neon Lime design system.

### Authentication

| Screen | Path | Notes |
|---|---|---|
| Sign in | `/login` | Email + password, Google OAuth, Microsoft (Azure) OAuth |
| Forgot password | `/forgot-password` | Sends a Supabase recovery link |
| Reset password | `/reset-password` | Handles the `PASSWORD_RECOVERY` session |
| MFA verification | `/mfa` | TOTP challenge when a verified factor exists |
| Activate account | `/activate` | Invitation acceptance and first password |
| Unauthorized | `/unauthorized` | Shown when a role lacks the route permission |
| Account suspended | `/suspended` | Shown for `suspended` / `terminated` employment |

Supported sign-in methods include email/password, Google OAuth and Microsoft OAuth
(`azure` provider — enabled only when the provider is configured in the Supabase project), plus
TOTP MFA, password recovery, invitation activation and per-device session management on the
profile screen.

After sign-in the client resolves the employee profile, roles, permissions, department and plant
from `get_my_context()` (or RLS-protected tables) and redirects to the dashboard home implied by
the employee's highest role. Multiple roles per employee are supported and merged.

### Screens

- **Workspace** – dashboard, my tasks, my requests, my approvals, my schedule, attendance,
  notifications.
- **People & access** – organization structure, employees, roles & permissions, shift management.
- **Personal** – profile (including MFA and active sessions), activity history, help & support.

Navigation is permission-driven, but route guards only control rendering. Every mutation is
authorized again by RLS or a protected RPC.

### Roles and permissions

Sixteen initial roles ship: Operator, Supervisor, Programmer, Technical Assistant, Technical
Analyst, Material Analyst, HR Analyst, Resource Analyst, HOD, Finance / Accounts, Plant Head,
Administrator, Quality Engineer, EHS Officer, Customer Approver, Verification Engineer.

Authorization is enforced in PostgreSQL, not by hiding buttons:

- `has_permission()`, `has_role()`, `is_admin()`, `can_access_scope()` and
  `can_access_employee()` resolve the caller from `auth.uid()`.
- 89 RLS policies cover every `public` table, scoped by organization, plant and department.
- Direct writes to `audit_logs`, `user_roles`, `role_permissions`, `requests` and `approvals` are
  revoked from `authenticated`; those paths require a `security definer` RPC.
- `guard_employee_self_update()` lets an employee edit contact details but not their own scope,
  employment status or auth linkage.
- Segregation of duties blocks approving your own request unless an approval-authority row
  explicitly allows self-approval.
- Customer approvers only see requests marked `customer_visible`.
- Medical records live in a separate `employee_medical` table with their own restricted policies
  behind `employees.medical.read`.

### Data model

34 normalized tables (UUID keys, foreign keys, indexes, `created_at`/`updated_at` and soft deletion
where appropriate) across organization structure, workforce, shifts/attendance, workflow and
governance:

```
organizations  plants  departments  production_lines  workstations  machines
employees  user_profiles  designations  job_categories  projects
roles  permissions  user_roles  role_permissions  approval_authorities
skills  certifications  employee_skills  employee_certifications  employee_medical
shifts  shift_breaks  employee_shift_assignments  attendance_records  holidays  leave_records
tasks  requests  approvals  notifications  documents  invitations  audit_logs
```

Operational fields are stored in typed columns; there is no single JSON blob for business data.
Migrations live in `supabase/migrations/` and seed data in `supabase/seed.sql` plus
`supabase/seed-auth.sql`:

| Migration | Contents |
|---|---|
| `20261110000100_platform_foundation.sql` | Enums, organization structure, profiles, employees |
| `20261110000200_rbac_and_workforce.sql` | Roles, permissions, skills, certifications, medical |
| `20261110000300_operations.sql` | Shifts, attendance, leave, tasks, requests, audit |
| `20261110000400_rls_policies.sql` | Row Level Security for every public table |
| `20261110000500_protected_rpcs.sql` | Context, approval, role, invitation and session RPCs |
| `20261110000600_storage.sql` | `employee-documents` (private) and `employee-avatars` buckets |
| `20261110000700_access_hardening.sql` | Customer-approver visibility, write revocation, self-update guard |

`supabase/functions/platform-operations/` is the existing backend used for protected invitation
operations. It verifies the caller's permission against their own JWT and only uses the
service-role client for the Auth invitation email.

Qdrant semantic search and LLM endpoints are reserved for later modules; Module 01 does not call
either. See `.env.example` for the reserved variable names.

### Demo mode

With no `VITE_SUPABASE_*` values the platform runs against a local demo identity provider and a
deterministic seeded dataset, so the static/Docker deployment keeps working without a backend. The
demo password is `IndraDemo!2026`; the six demo accounts are listed on the sign-in screen. Demo
mode is a presentation and test harness only — the same rules are implemented in the migrations.

### Supabase setup

```bash
# 1. Apply the schema and seed data
supabase db reset                      # runs migrations + seed.sql
psql "$DATABASE_URL" -f supabase/seed-auth.sql   # demo identities

# 2. Point the front end at the project
cp .env.example .env
# set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Optional: deploy the protected invitation function
supabase functions deploy platform-operations
supabase secrets set PLATFORM_URL=https://your-app.example
```

Enable the Google and Microsoft providers in the Supabase dashboard to activate those buttons.

### Verification

The platform unit suite runs with the studio suite:

```bash
npm test               # 69 tests, including access control, shifts, router and SQL contract
npm run lint
npm run typecheck
```

The SQL is verified by executing every migration against PostgreSQL 16 with the Supabase `auth`
and `storage` schemas stubbed, then applying both seed files and asserting RLS behaviour. Results
are recorded in [docs/INTEGRATION_REPORT.md](docs/INTEGRATION_REPORT.md).

## Workforce & production operations (Module 02)

Module 02 extends the same platform — no second application, no second employee store. Operator,
supervisor and programmer workspaces reuse the Module 01 identity, organization, shift, role and
approval infrastructure.

| Area | Routes | What it does |
| --- | --- | --- |
| Operator | `/operator`, `/production/tasks`, `/work-history` | Shift, machine and assigned production; accept, start, pause (with reason), resume, report completion |
| Supervisor | `/supervisor` | Team presence, target versus actual, open tickets, material requests, pending reassignments, shift reports |
| Programmer | `/programmer` | Assigned machines, program versions, revision history, review/approval, signed audited downloads |
| Reporting | `/production/reports` | Good / rejected / rework entry with downtime, material consumption and evidence |
| Issues | `/operations/issues` | Technical fault, tool damage, material requirement and restricted safety reporting |
| Workforce | `/workforce/employees`, `/workforce/schedule`, `/workforce/attendance` | Directory, weekly roster and daily attendance register |
| Workflow | `/operations/reassignment`, `/operations/handover` | Reassignment proposals through approval; shift completion and handover |

Guarantees enforced in PostgreSQL, not in the interface:

- **No self-reassignment.** A trigger rejects any change to a task's assignee, machine, workstation
  or target unless the caller holds `tasks.manage`.
- **Rework never inflates output.** `total_produced = good_pieces + rejected_pieces` and
  `rework_pieces <= rejected_pieces` are check constraints, re-validated in the RPC with a readable
  message.
- **Reassignments need approval.** Proposals validate approved leave, employment status, required
  skills and verified certifications, shift overlap, the 12-hour working limit and machine
  authorisation before a request is created. The original assignment is untouched until the
  configured approver decides; approval applies the move and records who decided and when.
- **Restricted medical data.** Clinical detail lives in `safety_incident_details`, readable only with
  `safety.medical.read`; supervisors receive the operational record only.
- **Approved programs are immutable.** A trigger rejects any rewrite of an approved version's payload
  or revision fields; new work must register a new version. Authors cannot approve their own version,
  and every program download is audited through `log_program_access`.
- **Material units are enforced.** A line item must use the unit declared for its material, checked by
  trigger and again in the request RPC.

Seed data: `supabase/seed-module2.sql` (permissions, role grants, approval routing, products,
materials, tools, orders, tasks, reports, issues, programs, one pending reassignment). Demo identities
now include `karthik.subramanian@indra.example` (supervisor), `divya.sharma@indra.example`
(programmer) and `rahul.verma@indra.example` (EHS) — same demo password.

## Interaction

- **Camera**: left-drag orbits, middle/right-drag pans, wheel zooms. Top view uses an orthographic
  camera; 3D view uses a perspective camera. Reset camera and Fit all are toolbar actions.
- **Placement**: drag a component from the library onto the canvas, or click a tool and click the
  grid to place repeatedly. `Esc` exits placement/connection modes.
- **Selection**: click an object in the canvas or the scene list. Shift-click toggles multi-select.
  A selected object shows the transform gizmo.
- **Transforms**: drag the gizmo with `W`/`E`/`R` (move/rotate/scale) or edit position, rotation and
  scale numerically in the properties panel. Dragging an object body also moves it (grid snapping
  respects the factory setting). GLB models inherit the same selection, transform and connection
  behaviour as the procedural visuals; an invisible footprint proxy keeps hollow models selectable.
- **Connections**: enable Connect mode, then drag from a green material output port or an amber
  worker output port to a compatible input port. Validation rejects duplicates, self-links,
  incompatible types and material-flow cycles. Individual connections can be selected and deleted.
- **Properties**: each component type has a typed schema. Editing a property updates the model and
  marks existing results stale. Live state, queue length and utilisation are shown read-only.
- **Persistence**: factory versions, the approved baseline, audit entries and the working draft are
  stored in `localStorage`. Versioned JSON export/import is available from the File dialog.
- **4M change management**: compare the approved baseline with the proposed working factory. The
  comparison includes layout/property/connection diffs and production metrics. Approval is gated by
  the Plant Manager role and an explicit implementation-confirmation checkbox.

## Simulation modes

| Mode | How it runs | Best for |
|---|---|---|
| **Batch simulation** | Instant deterministic C++/WASM run (JS reference fallback) for the selected duration and seed. | Fast scenario comparison, JS/WASM parity and the 4M baseline. |
| **Continuous run** | Shared JS live engine advanced by `requestAnimationFrame`; 1× maps to 6 simulated seconds per real second, with 2× and 4× multipliers. | Watching products, queues, workers and live metrics. |
| **Step run** | The same JS live engine advanced to the next production operation and paused. **Back** rewinds one recorded operation. | Operation-level debugging and explaining a bottleneck. |

Stop keeps the recorded live results visible; Reset clears the live engine and product tokens.
Starting a batch run does not discard a live run, and editing the factory resets the live engine so
results cannot silently describe an old layout.

### Metric types

- **actual** – recorded by the engine from products, events and station time (input, good, rejected,
  cycle time, waiting time, downtime).
- **calculated** – derived from actual values and configured inputs (throughput, utilisation,
  availability, OEE, energy, mass balance). Station performance uses configured ideal cycle time.
- **assumed** – modelling or batch-proxy assumptions, listed in the Results panel. Batch OEE is a
  proxy (station availability × average utilisation × quality); live OEE uses scheduled time,
  recorded downtime, ideal cycle time and actual output.

## Architecture

```
src/
  App.jsx                  React shell, branding, batch/live orchestration and test hooks
  components/              Library, canvas, properties, results, change and file UI
  three/
    SceneManager.js        renderer, lights, shadows, animation loop and test projection helpers
    CameraController.js    perspective/orthographic cameras + OrbitControls
    AssetLibrary.js        cached GLB loading, normalisation, texture mapping and clones
    ModelBinder.js         async model binding, fallback handling and animation mixers
    ObjectManager.js       incremental visual lifecycle for factory objects
    ObjectFactory.js       procedural fallback visuals, picking proxies, labels, ports, materials
    ProductManager.js      animated product tokens driven by live locations
    WorkerManager.js       worker avatar lifecycle, status colours and animation
    workerLayout.js        pure worker count/placement maths
    ConnectionManager.js   curved links, port picking and pending connection preview
    ObjectPlacement.js     placement ghost, snapping and grid-cell preview
    ObjectTransform.js     TransformControls integration
    InteractionManager.js  pointer arbitration between camera, objects, ports and gizmos
  engine/
    live/ProductionEngine.js  shared deterministic continuous/step runtime and live metrics
    SimulationEngine.js       JavaScript DES reference implementation (batch)
    wasmBridge.js             factory -> C++ model marshalling and result mapping
    index.js                  WASM-first batch engine facade with JS fallback
    graph.js                  graph helpers, reachability and connection validation
    random.js                 seeded random generator
  state/                   factory model, migration/normalisation and undo/redo
  persistence/             versioned serialiser, diffing and localStorage storage
  data/                    component catalogue, property schemas and GLB manifest
assets/
  glb/                     local CC0 models + shared Kenney palette texture
  logos/ favicons/         INDRA branding assets
wasm/simulation.cpp        C++ discrete-event simulation core
public/                    compiled Emscripten module and WASM binary
docker/nginx.conf          production static server configuration
tests/unit/                Node test runner unit, asset, worker and JS/WASM parity tests
tests/e2e/                 Playwright acceptance and live-simulation tests
```

The batch engine has no React or Three.js imports and can run headlessly. The live engine is also
renderer-independent: `SceneManager` reads its snapshot and animates the recorded state. Three.js
geometries are shared, while per-object materials and label textures are disposed when objects are
removed; renderer, controls, listeners and observers are disposed on unmount. The worker GLB is
loaded once and cloned with `SkeletonUtils` so skeletons and animations stay valid.

## Test hooks

`window.__ITS__` exposes the original projection, factory, result, view and selection helpers.
`window.__INDRA__` adds live controls and diagnostics used by the tests:

```js
window.__INDRA__.start();          // continuous run
window.__INDRA__.pause();
window.__INDRA__.resume();
window.__INDRA__.stop();
window.__INDRA__.reset();
window.__INDRA__.step();           // next operation
window.__INDRA__.previous();
window.__INDRA__.setSpeed(4);
window.__INDRA__.getLive();
window.__INDRA__.getLiveStatus();
window.__INDRA__.getWorkers();     // avatar counts/statuses/positions
window.__INDRA__.getProducts();    // product token positions
```

## Tests

```bash
npm test             # 69 unit tests: live engine, workers, assets, graph, parity, reducer, schema,
                     # platform access control, shifts, router and SQL contract
npm run test:e2e     # 19 Playwright tests using system Chrome + SwiftShader
```

Playwright starts its own Vite server on port 5183 and reuses an existing one if present. The unit
suite covers graph routing, queue/buffer capacity and blocking, inspection rejection, scheduled
downtime, starvation, branching, deterministic step/previous, mass balance, worker layout and asset
provenance, industrial section grouping, SI unit labels and future-enhancement markers. The browser
suite covers WASM loading, GLB assets, zoom/orbit/pan, top/3D switching, library placement,
body/gizmo transforms, duplicate/delete/undo, property editing and stale results, grouped property
units and reset controls, port-to-port connections, saved-layout reloads, graph-driven batch
simulation, 4M approval gating, step/previous, continuous pause/resume/stop/reset, speed changes,
product motion, worker counts/statuses and the live results dashboard. Docker Compose configuration is validated by
`docker compose config`; build/run requires a Docker daemon the current user can access.

## Asset provenance

All runtime models are CC0 1.0 and stored locally; no external model URL is requested by the
browser. Authors, source packs, file mappings and the exact licence text are documented in
[ASSET_LICENSES.md](ASSET_LICENSES.md). Attribution is not required by CC0 and is retained as a
courtesy.

## Limitations

- The studio's 4M *approval role claim* is still a browser-session control. The operations
  platform added in Module 01 is different: authorization there is enforced by PostgreSQL RLS and
  protected RPCs, and the studio change-management workflow is not yet wired to those RPCs.
- Platform deployments without `VITE_SUPABASE_*` configured run on the local demo provider. That
  demo is not a security boundary; connect a Supabase project for real authentication.
- The batch WASM core and JS reference are kept in parity by unit tests, but both are simplified
  DES models (aggregate worker availability, sampled faults) rather than validated industrial
  simulators. The live engine is a separate deterministic runtime; it is not numerically identical
  to the batch core.
- OEE is a calculated value from modelled availability, performance and quality, not a measured
  plant KPI. Batch performance is a proxy; use live mode for cycle-time-based performance.
- JSON import is validated and normalised, but files produced by other tools are not supported.
- The app is a design/simulation prototype; numerical output must not be used for real production
  decisions without an independent validated model.
