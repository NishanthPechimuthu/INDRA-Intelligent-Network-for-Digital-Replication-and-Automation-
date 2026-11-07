# INDRA (Intelligent Network for Digital Replication and Automation)

Browser-based factory design and discrete-event simulation. The UI keeps the original dark
industrial visual language: component library on the left, Three.js factory canvas in the
centre, typed properties/results/4M change management on the right.

The simulation runs as a deterministic, product-level discrete-event model. The primary core is
C++ compiled to WebAssembly; a JavaScript reference implementation provides an identical
fallback while the WASM module loads or if it cannot be loaded.

## Requirements

- Node.js 20+
- npm
- Optional: Emscripten for rebuilding the C++/WASM core

## Run

```bash
npm install
npm run dev
```

Open the Vite URL (normally http://localhost:5173). The prebuilt WASM files are already in
`public/simulation.mjs` and `public/simulation.wasm`, so no Emscripten install is required to run
the app.

## Build

```bash
npm run build
npm run preview
```

## Rebuilding the WebAssembly core

Install/activate Emscripten, then:

```bash
source "$HOME/emsdk/emsdk_env.sh"
npm run build:wasm
```

`npm run build:wasm` compiles `wasm/simulation.cpp` into `public/simulation.mjs` plus
`public/simulation.wasm` (ES module, `createSimulationModule` factory). The generated files are
served from the site root and loaded lazily by `src/engine/wasmBridge.js`.

## Interaction

- **Camera**: left-drag orbits, middle/right-drag pans, wheel zooms. Top view uses an
  orthographic camera; 3D view uses a perspective camera. Reset camera and Fit all are toolbar
  actions.
- **Placement**: drag a component from the library onto the canvas, or click a tool and click the
  grid to place repeatedly. `Esc` exits placement/connection modes.
- **Selection**: click an object in the canvas or the scene list. Shift-click toggles multi-select.
  A selected object shows the transform gizmo.
- **Transforms**: drag the gizmo with `W`/`E`/`R` (move/rotate/scale) or edit position, rotation and
  scale numerically in the properties panel. Dragging an object body also moves it (grid snapping
  respects the factory setting).
- **Connections**: enable Connect mode, then drag from a green material output port or an amber
  worker output port to a compatible input port. Connection validation rejects duplicates,
  self-links, incompatible types and material-flow cycles. Individual connections can be selected
  and deleted from the connection list.
- **Properties**: every component type has a typed schema. Editing a property updates the model and
  marks existing simulation results stale.
- **Simulation**: choose duration and stochastic mode, then Run simulation. Results are computed
  from the actual connection graph (arrivals, processing, transport, buffers, workers, faults and
  repairs), not component counts. The footer reports the active engine (`C++/WASM DES` or JS).
- **Persistence**: factory versions, the approved baseline, audit entries and the working draft are
  stored in `localStorage`. Versioned JSON export/import is available from the File dialog.
- **4M change management**: compare the approved baseline with the proposed working factory; the
  comparison includes layout/property/connection diffs and production metrics. Approval is gated
  by the Plant Manager role and an explicit implementation-confirmation checkbox. The baseline is
  only replaced after approval and the audit trail is appended.

## Architecture

```
src/
  components/        React shell and panels (canvas, library, properties, results, change/file UI)
  three/             Three.js layer
    SceneManager.js         scene lifecycle, renderer, lights, grid, resize, test projection helpers
    CameraController.js     perspective/orthographic cameras + OrbitControls
    ObjectManager.js        incremental visual lifecycle for factory objects
    ObjectFactory.js        procedural component visuals, labels, ports, materials
    ConnectionManager.js    curved links, port picking, pending connection preview
    ObjectPlacement.js      placement ghost, snapping and grid-cell preview
    ObjectTransform.js      TransformControls integration
    InteractionManager.js   pointer arbitration between camera, objects, ports and gizmos
  engine/
    SimulationEngine.js     JavaScript DES reference implementation
    wasmBridge.js           factory -> C++ model marshalling and result mapping
    index.js                WASM-first engine facade with JS fallback
    graph.js                graph helpers, reachability and connection validation
    random.js               seeded random generator
  state/              factory model, migration/normalisation and reducer with undo/redo
  persistence/        versioned serializer, diffing and localStorage storage
  data/               component catalogue and typed property schemas
wasm/simulation.cpp   C++ discrete-event simulation core
public/               compiled Emscripten module and WASM binary
tests/unit/           Node test runner unit + JS/WASM parity tests
tests/e2e/            Playwright acceptance tests driving the real UI and WebGL canvas
```

The simulation engine has no React or Three.js imports and can be replaced or run headlessly.
Three.js geometries are shared, while per-object materials and label textures are disposed when
objects are removed; renderer, controls, listeners and observers are disposed on unmount.

## Tests

```bash
npm test             # unit tests, including exact JS/WASM parity
npm run test:e2e     # Playwright acceptance tests (system Chrome + SwiftShader)
```

Playwright starts its own Vite server on port 5183. If one is already running it is reused. The
tests cover WASM loading, zoom/orbit/pan, top/3D switching, library drag placement, body/gizmo
transforms, duplicate/delete/undo, typed property editing and stale results, port-to-port graph
connections, saved-layout reloads, graph-driven simulation, and baseline comparison/approval
gating.

## Limitations

- Approval roles and persistence are enforced in the browser session only; there is no backend or
  authenticated server-side enforcement.
- WASM output and the JS reference implementation are kept in parity by the unit tests, but the
  model is still a simplified DES (single product route, aggregate worker availability, sampled
  faults) rather than a validated industrial simulator.
- JSON import is validated and normalised, but files produced by other tools are not supported.
- The app is a design/simulation prototype; numerical output must not be used for real production
  decisions without an independent validated model.
