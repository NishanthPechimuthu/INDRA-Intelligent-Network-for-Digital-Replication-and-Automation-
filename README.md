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
npm test             # 52 unit tests: live engine, workers, assets, graph, parity, reducer, schema
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

- Approval roles and persistence are enforced in the browser session only; there is no backend or
  authenticated server-side enforcement.
- The batch WASM core and JS reference are kept in parity by unit tests, but both are simplified
  DES models (aggregate worker availability, sampled faults) rather than validated industrial
  simulators. The live engine is a separate deterministic runtime; it is not numerically identical
  to the batch core.
- OEE is a calculated value from modelled availability, performance and quality, not a measured
  plant KPI. Batch performance is a proxy; use live mode for cycle-time-based performance.
- JSON import is validated and normalised, but files produced by other tools are not supported.
- The app is a design/simulation prototype; numerical output must not be used for real production
  decisions without an independent validated model.
