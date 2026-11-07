# INDRA (Intelligent Network for Digital Replication and Automation)

**A browser-based industrial factory design, simulation, and AI-assisted 4M change-management platform.**

> **Status:** Early prototype. The current application provides a Three.js factory scene, component properties, simplified KPI estimates, and a draft 4M proposal comparison. It is not a validated industrial simulator.

## 1. Project objectives

Industrial Twin Studio combines four capabilities:

1. **Factory Design Studio** — construct and edit a 3D factory layout.
2. **Production Simulation** — simulate material flow and resource behaviour.
3. **4M Change Management** — compare proposed changes against an approved baseline.
4. **Industrial AI Assistant** — use a local LLM and RAG to retrieve engineering knowledge and explain simulation evidence.

Example production line:

```text
Source -> Conveyor -> Workstation -> Buffer
                                  |
                                  v
Output <- Conveyor <- Workstation
             Worker hubs assigned to workstations
```

## 2. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React |
| 3D rendering | Three.js |
| 3D model format | GLB / glTF |
| Simulation | JavaScript prototype; C++ / WebAssembly planned |
| Backend (planned) | Python Flask |
| Database (planned) | MongoDB |
| Live updates (planned) | WebSocket |
| Local LLM (planned) | Qwen3-4B |
| RAG (planned) | LlamaIndex or LangChain |
| Vector database (planned) | Qdrant |

**Architecture rule:** Three.js renders the factory; the simulation engine calculates process behaviour; Flask manages persistence and workflows; the LLM explains evidence and retrieves documents. The LLM must not invent KPI values or approve changes.

## 3. Factory designer

Provide a grid-based 3D workspace with:

- **Top view:** orthographic camera looking down.
- **3D view:** perspective camera with orbit, pan, and zoom.

### Camera interactions

| Interaction | Behaviour |
|---|---|
| Mouse wheel | Zoom in / out |
| Left drag on empty canvas | Orbit in 3D mode |
| Middle/right drag | Pan |
| Top view | Switch to orthographic top camera |
| Reset camera | Restore default view |
| Fit to scene | Frame all factory objects |

Use Three.js `OrbitControls` for camera navigation.

### Component toolbar

| Component | Purpose |
|---|---|
| Source | Introduces raw material or products |
| Workstation | Processes products |
| Worker Hub | Defines employees and workstation assignments |
| Conveyor Belt | Transports products |
| Buffer | Holds work-in-progress |
| Output Bin | Collects finished products |
| Chart | Displays selected simulation metrics |
| Display | Shows numerical values and status |

### Object editing

Every component should support selection, move on X/Y/Z, rotation, numeric transforms, duplicate, delete, multi-select, grid snapping, undo, and redo.

Use Three.js `TransformControls` for object manipulation and `Raycaster` for picking and placement. Prevent camera controls from conflicting with object transforms.

### Drag-and-drop placement

Users should drag toolbar components onto the grid. Show a placement preview, convert pointer coordinates to world coordinates, optionally snap to grid, place the object, and select it. Clicking a toolbar item may also activate placement mode.

## 4. Component properties

### Workstation

- Cycle time per piece (seconds).
- Error/rejection rate (%).
- Tool damage (%).
- Power consumption (kW).
- Human interaction required.
- Assigned worker count.
- Available working time per shift.
- Break, meeting, and changeover durations.
- Error recovery time.

### Worker Hub

- Employee count.
- Skill or assigned task.
- Worker error rate.
- Break, meeting, and changeover durations.
- Available shift time.
- Workstation assignments.

### Conveyor Belt

- Product transport time.
- Conveyor speed.
- Fault rate.
- Fault recovery time.
- Power consumption.
- Maximum capacity.

### Buffer

- Maximum capacity.
- Initial product quantity.
- Buffer configuration.

### Source and Output Bin

- Source: product type, arrival rate/inter-arrival time, initial quantity.
- Output: maximum capacity and current product count.

Properties must be stored in the factory configuration and used by the simulation where implemented. Do not present a property as an active simulation input until its behaviour exists.

## 5. Connections and material flow

The simulator must use an explicit directed process graph, not merely component count or position.

Example:

```text
Source -> Conveyor -> Workstation -> Buffer
                                  |
                                  v
Output <- Conveyor <- Workstation
```

Requirements:

- Compatible input/output ports.
- Create, remove, and reconnect links.
- Store links by stable component and port IDs.
- Validate invalid connections and cycles according to supported process rules.
- Support parallel production paths.
- Assign worker hubs to workstations separately from material-flow links.
- Highlight selected and connected components.

Example configuration:

```json
{
  "nodes": [
    {"id": "SRC-01", "type": "source"},
    {"id": "WS-01", "type": "workstation"},
    {"id": "OUT-01", "type": "output"}
  ],
  "edges": [
    {"from": "SRC-01", "to": "WS-01"},
    {"from": "WS-01", "to": "OUT-01"}
  ]
}
```

The production schema should additionally define ports, conveyor segments, and validation metadata.

## 6. Production simulation

The target approach is **Discrete-Event Simulation (DES)**. Model events such as:

- Product arrival.
- Conveyor entry and exit.
- Processing start and completion.
- Buffer entry and exit.
- Worker availability, breaks, and meetings.
- Changeover.
- Machine fault and repair.
- Product rejection.
- Product completion.

Use a simulation clock and event queue. Process events in timestamp order and record an event log.

### Required metrics

| Metric | Purpose |
|---|---|
| Input quantity | Products introduced |
| Good output | Accepted finished products |
| Rejected quantity | Rejected products |
| Throughput | Finished products per unit time |
| Cycle time | Processing time |
| Lead time | Total elapsed time through the system |
| WIP | Work-in-progress inventory |
| Machine utilization | Busy time / available time |
| Worker utilization | Productive time / available time |
| Waiting time | Time waiting for resources or processes |
| Blocking time | Time a resource cannot release output |
| Starvation time | Time a resource waits for input |
| Buffer occupancy | Current and maximum buffer quantity |
| Energy | Energy consumed during the run |
| Bottleneck | Resource constraining system throughput |

Do not identify a bottleneck using utilization alone. Consider capacity, queue length, blocking, starvation, and downstream constraints.

Support configurable run durations such as 1, 4, 8, 12, and 24 hours. Stochastic models should support repeated replications, variability reporting, and warm-up handling where appropriate.

**Numerical validity:** Current prototype figures are illustrative estimates only. A production-grade simulator requires a validated event-based model, defined assumptions, tests, and comparison against known scenarios.

## 7. Charts and displays

Allow chart and display components to select metrics such as:

- Good output over time.
- Input versus output.
- Accepted versus rejected products.
- Workstation and worker utilization.
- Buffer occupancy and queue length.
- Waiting time and machine downtime.
- Power consumption.
- Bottleneck comparison.

Every visualization should identify its metric, unit, simulation run, and time interval.

## 8. Factory configuration and persistence

Support new, save, load, duplicate, reset, JSON export/import, and named versions.

Persist:

- Factory metadata and version.
- Stable component IDs and types.
- Names, positions, rotations, and scales.
- Component properties.
- Input/output ports and connections.
- Worker assignments.
- Simulation settings.

Do not use array positions as component identifiers.

## 9. AI-assisted 4M Change Management

Maintain two independent configurations:

1. **Approved Factory Baseline** — currently approved design.
2. **Proposed Factory Configuration** — engineer's editable draft.

### 4M categories

| Category | Examples |
|---|---|
| Man | Employee count, skills, shifts, task assignments |
| Machine | Add/remove machines, cycle time, speed, tools |
| Material | Product type, material properties, supply, quality |
| Method | Process sequence, SOP, program, changeover |

An engineer edits the proposed design, runs simulation, and submits a change request. Officers review:

- Baseline and proposed layouts.
- Added, removed, and modified components.
- Changed properties and simulation assumptions.
- Production, quality, utilization, and bottleneck differences.
- WIP, waiting time, and energy differences where modeled.
- Cost impact where supported.
- Supporting documents, missing information, and AI explanation.

Workflow:

```text
Engineer proposal
      |
      v
Simulation and impact assessment
      |
      v
Quality / safety / department review
      |
      v
Authorized officer decision
      |
      +---- Rejected -> retain baseline
      |
      v
Approved -> implementation confirmation
      |
      v
Create new approved baseline version
      |
      v
Audit history updated
```

Never overwrite the approved baseline merely because a proposal was submitted or approved. Require implementation confirmation before activating the new baseline.

## 10. Local LLM and RAG (planned)

Potential knowledge sources:

- Machine manuals and SOPs.
- Safety and quality documents.
- Maintenance records.
- Historical 4M requests.
- Previous simulation reports.

Potential capabilities:

- Explain bottlenecks.
- Retrieve relevant manual/SOP sections.
- Summarize proposed changes.
- Suggest what-if experiments.
- Compare experiment results.
- Draft evidence-based change reports.

The LLM must call controlled backend tools for factory configurations and simulation results. Numerical claims must come from the simulation engine or stored records. The LLM must not independently approve changes or bypass authorization.

## 11. Suggested source structure

```text
industrial-twin-studio/
├── public/assets/
├── src/
│   ├── components/
│   │   ├── FactoryCanvas.jsx
│   │   ├── ComponentToolbar.jsx
│   │   ├── PropertiesPanel.jsx
│   │   ├── SceneTree.jsx
│   │   ├── SimulationPanel.jsx
│   │   ├── AnalyticsPanel.jsx
│   │   └── ChangeManagementPanel.jsx
│   ├── editor/
│   │   ├── CameraController.js
│   │   ├── ObjectPlacement.js
│   │   ├── ObjectTransform.js
│   │   ├── ConnectionManager.js
│   │   └── SelectionManager.js
│   ├── factory/
│   │   ├── FactoryState.js
│   │   ├── FactorySerializer.js
│   │   ├── componentDefinitions.js
│   │   └── validation.js
│   ├── simulation/
│   │   ├── SimulationEngine.js
│   │   ├── EventQueue.js
│   │   ├── ResourceScheduler.js
│   │   └── metrics.js
│   ├── services/api.js
│   ├── App.jsx
│   └── main.jsx
├── wasm/simulation.cpp
├── package.json
└── README.md
```

Adapt this structure to the existing repository; do not create duplicate modules unnecessarily.

## 12. Development roadmap

1. **Interactive 3D editor:** camera controls, placement, transforms, snapping, undo/redo.
2. **Factory configuration:** dynamic properties, stable IDs, JSON import/export, save/load.
3. **Process graph:** ports, connections, validation, worker assignments.
4. **Discrete-event simulation:** product routing, processing, transport, workers, breaks, buffers, faults, recovery, rejection.
5. **4M governance:** baseline, proposal, simulation comparison, review, approval, implementation confirmation, audit.
6. **AI and RAG:** local model, document retrieval, citations, controlled tool calls, reports.

## 13. Acceptance checklist

- [ ] Zoom, pan, and orbit work.
- [ ] Top and 3D camera modes work.
- [ ] Components can be dragged from toolbar and placed.
- [ ] Objects can be moved and rotated.
- [ ] Numeric transforms update the scene.
- [ ] Duplicate and delete work.
- [ ] Grid snapping can be toggled.
- [ ] Undo and redo work.
- [ ] Connections can be created and removed.
- [ ] Worker hubs can be assigned to workstations.
- [ ] JSON export/import preserves the layout.
- [ ] Simulation uses the actual process graph.
- [ ] Metrics are derived from recorded simulation events.
- [ ] Baseline and proposed configurations remain separate.
- [ ] Approval requires the correct role.
- [ ] Implementation confirmation creates a new baseline version.

## 14. Current prototype limitations

The early prototype is a UI and interaction foundation. The following still require implementation and validation:

- Full drag-and-drop and transform-gizmo interactions.
- Persistent factory configuration.
- Directed material-flow graph.
- True discrete-event simulation.
- Product-level routing and event history.
- Blocking, starvation, queueing, and resource scheduling.
- Stochastic failures and repeated runs.
- Validated worker and energy models.
- Backend persistence and role-based approvals.
- RAG retrieval and secure LLM tool execution.

Do not use prototype KPI estimates for real factory design, safety, quality, staffing, or investment decisions.

## 15. Getting started

For the current Vite frontend:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

If an Emscripten build script exists and the SDK is installed and activated:

```bash
npm run build:wasm
```

Check the actual `package.json` scripts before running optional commands.

---

## Project principle

**Design the factory. Simulate the process. Evaluate the change. Approve with evidence.**

Industrial Twin Studio aims to make factory design and 4M change decisions measurable, explainable, traceable, and reviewable.
