import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  Activity,
  Box,
  Factory,
  FolderOpen,
  Grid3X3,
  Play,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  BarChart3,
} from 'lucide-react';
import ComponentLibrary from './components/ComponentLibrary.jsx';
import FactoryCanvas from './components/FactoryCanvas.jsx';
import CanvasToolbar from './components/CanvasToolbar.jsx';
import PropertiesPanel from './components/PropertiesPanel.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import ChangePanel from './components/ChangePanel.jsx';
import FactoryFileDialog from './components/FactoryFileDialog.jsx';
import { createInitialState, factoryReducer, canUndo, canRedo } from './state/factoryReducer.js';
import {
  cloneFactory,
  createComponent,
  createEmptyFactory,
  createLine,
  createSeedFactory,
  makeId,
} from './state/factoryModel.js';
import { runSimulation, initSimulationEngine, getEngineName } from './engine/index.js';
import { validateConnection } from './engine/graph.js';
import { typeLabel } from './data/componentDefs.js';
import {
  deserializeFactory,
  downloadJson,
  safeFilename,
  serializeFactory,
} from './persistence/FactorySerializer.js';
import {
  appendAudit,
  deleteVersion as deleteStoredVersion,
  loadAudit,
  loadBaseline,
  loadDraft,
  loadVersions,
  saveBaseline,
  saveDraft,
  saveVersion,
} from './persistence/storage.js';

const LINE_COLORS = ['#42bda2', '#5b9bd5', '#e3a13d', '#c084fc', '#e07a7a', '#8ed36b'];

function makeInitialBaseline() {
  const stored = loadBaseline();
  if (stored) return stored;
  return {
    factory: createSeedFactory(),
    approvedAt: null,
    approvedBy: 'Initial baseline',
    approvedRole: 'System',
    reason: 'Initial demo factory',
    category: 'Machine',
    versionName: 'Plant Demo / Line 01',
  };
}

export default function App() {
  const [store, dispatch] = useReducer(
    factoryReducer,
    loadDraft() || createSeedFactory(),
    createInitialState,
  );
  const { factory, selection } = store;

  const [view, setView] = useState('3d');
  const [tab, setTab] = useState('props');
  const [mode, setMode] = useState('select');
  const [placementType, setPlacementType] = useState(null);
  const [connectMode, setConnectMode] = useState(false);
  const [transformMode, setTransformMode] = useState('translate');
  const [dragType, setDragType] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [result, setResult] = useState(() =>
    runSimulation(factory, {
      hours: factory.settings.durationHours,
      seed: factory.settings.seed,
      stochastic: factory.settings.stochastic,
    }),
  );
  const [resultStale, setResultStale] = useState(false);
  const [baselineRecord, setBaselineRecord] = useState(makeInitialBaseline);
  const [role, setRole] = useState('Engineer');
  const [versions, setVersions] = useState(() => loadVersions());
  const [audit, setAudit] = useState(() => loadAudit());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState('Ready · demo plant loaded');
  const [toast, setToast] = useState('');
  const [engineName, setEngineName] = useState(getEngineName());
  const [activeLineId, setActiveLineId] = useState(factory.lines[0]?.id || null);
  const canvasRef = useRef(null);
  const toastTimer = useRef(null);
  const factoryRef = useRef(factory);
  const previousFactory = useRef(factory);

  useEffect(() => {
    window.__ITS__ = {
      screenPoint: (id) => canvasRef.current?.objectScreenPoint(id) || null,
      portPoint: (id, kind) => canvasRef.current?.portScreenPoint(id, kind) || null,
      worldPoint: (x, y, z) => canvasRef.current?.worldScreenPoint(x, y, z) || null,
      camera: () => canvasRef.current?.cameraDebug() || null,
      fitAll: () => canvasRef.current?.fitAll(),
      getFactory: () => factoryRef.current,
      getResult: () => result,
      getView: () => view,
      getSelection: () => selection,
    };
    return () => {
      delete window.__ITS__;
    };
  }, [result, selection, view]);

  const notify = useCallback((message) => {
    setStatus(message);
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    initSimulationEngine({
      onError: (error) => {
        if (!cancelled) {
          setStatus(`C++/WASM core unavailable · using JavaScript fallback (${error.message || error}).`);
        }
      },
    }).then((ready) => {
      if (cancelled) return;
      setEngineName(getEngineName());
      if (ready) {
        const current = factoryRef.current;
        const next = runSimulation(current, {
          hours: current.settings.durationHours,
          seed: current.settings.seed,
          stochastic: current.settings.stochastic,
        });
        setResult(next);
        setResultStale(false);
        setStatus('C++/WebAssembly simulation core loaded.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!factory.lines.some((line) => line.id === activeLineId)) {
      setActiveLineId(factory.lines[0]?.id || null);
    }
  }, [factory.lines, activeLineId]);

  useEffect(() => {
    factoryRef.current = factory;
    if (previousFactory.current !== factory) {
      previousFactory.current = factory;
      setResultStale(true);
      const timer = setTimeout(() => saveDraft(factory), 650);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [factory]);

  const cancelTransient = useCallback(() => {
    setMode('select');
    setPlacementType(null);
    setConnectMode(false);
    setSelectedConnection(null);
    canvasRef.current?.cancelTransient();
  }, []);

  const selectObjects = useCallback((ids) => {
    dispatch({ type: 'setSelection', ids });
    setSelectedConnection(null);
  }, []);

  const toggleObject = useCallback((id) => {
    dispatch({ type: 'toggleSelection', id });
    setSelectedConnection(null);
  }, []);

  const activatePlacement = useCallback((type) => {
    setConnectMode(false);
    setSelectedConnection(null);
    canvasRef.current?.cancelTransient();
    if (mode === 'place' && placementType === type) {
      setPlacementType(null);
      setMode('select');
      notify('Placement cancelled.');
      return;
    }
    setPlacementType(type);
    setMode('place');
    notify(`Placement mode: click the grid to place ${typeLabel(type)}. Press Esc to exit.`);
  }, [mode, placementType, notify]);

  const placeComponent = useCallback((type, x, y, z) => {
    const currentFactory = factoryRef.current;
    const baseName = typeLabel(type);
    let index = 1;
    let name = baseName;
    const names = new Set(currentFactory.components.map((c) => c.name));
    while (names.has(name)) {
      index += 1;
      name = `${baseName} ${index}`;
    }
    const lineId =
      currentFactory.lines.some((line) => line.id === activeLineId)
        ? activeLineId
        : currentFactory.lines[0]?.id || null;
    const component = createComponent(type, { name, x, y, z, lineId });
    dispatch({ type: 'addComponent', component });
    notify(`Placed ${name} at X ${x}, Z ${z}.`);
  }, [activeLineId, notify]);

  const handleTransformLive = useCallback((updates, meta) => {
    dispatch({ type: 'updateTransforms', updates, meta });
  }, []);

  const handleTransformEnd = useCallback(() => {
    setResultStale(true);
  }, []);

  const handleConnect = useCallback((from, to, kind) => {
    const validation = validateConnection(factoryRef.current, from, to, kind);
    if (!validation.ok) {
      notify(validation.error);
      return;
    }
    dispatch({
      type: 'addConnection',
      connection: { id: makeId('C'), from, to, kind },
    });
    notify(kind === 'worker' ? 'Worker hub assigned to workstation.' : 'Material-flow connection created.');
  }, [notify]);

  const handleSelectConnection = useCallback((id) => {
    dispatch({ type: 'setSelection', ids: [] });
    setSelectedConnection(id);
    setStatus('Connection selected · press Delete to disconnect.');
    setToast('Connection selected · press Delete to disconnect.');
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4200);
  }, []);

  const handleDeleteConnection = useCallback((id) => {
    dispatch({ type: 'deleteConnection', id });
    setSelectedConnection(null);
    notify('Connection removed.');
  }, [notify]);

  const handleUpdateComponent = useCallback((id, patch, meta) => {
    dispatch({ type: 'updateComponent', id, patch, meta });
  }, []);

  const handleUpdateProps = useCallback((id, props, meta) => {
    dispatch({ type: 'updateProps', id, props, meta });
  }, []);

  const runSimulationNow = useCallback(() => {
    const current = factoryRef.current;
    const started = performance.now();
    const next = runSimulation(current, {
      hours: current.settings.durationHours,
      seed: current.settings.seed,
      stochastic: current.settings.stochastic,
    });
    const elapsed = Math.max(1, Math.round(performance.now() - started));
    setResult(next);
    setResultStale(false);
    setTab('results');
    if (next.ok) {
      notify(
        `Simulation completed in ${elapsed} ms · ${next.good} good · ${next.throughputPerHour}/hr · bottleneck ${next.bottleneck}.`,
      );
    } else {
      notify(next.notes[0] || 'Simulation could not run.');
    }
  }, [notify]);

  const handleSaveVersion = useCallback((name) => {
    const named = { ...factoryRef.current, name };
    try {
      dispatch({ type: 'setFactoryName', name });
      saveVersion(named, name);
      setVersions(loadVersions());
      notify(`Saved factory version “${name}”.`);
    } catch (error) {
      notify(error.message || 'Could not save the factory version.');
    }
  }, [notify]);

  const handleLoadVersion = useCallback((version) => {
    dispatch({ type: 'load', factory: cloneFactory(version.factory) });
    setDialogOpen(false);
    setTab('props');
    setResult(null);
    setResultStale(true);
    cancelTransient();
    notify(`Loaded “${version.name}” · ${version.factory.components.length} objects.`);
  }, [cancelTransient, notify]);

  const handleDeleteVersion = useCallback((id) => {
    setVersions(deleteStoredVersion(id));
    notify('Version deleted.');
  }, [notify]);

  const handleNew = useCallback(() => {
    dispatch({ type: 'load', factory: createEmptyFactory('New Factory') });
    setDialogOpen(false);
    setResult(null);
    setResultStale(true);
    cancelTransient();
    setTab('props');
    notify('New empty factory created.');
  }, [cancelTransient, notify]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'load', factory: createSeedFactory() });
    setDialogOpen(false);
    setResult(null);
    setResultStale(true);
    cancelTransient();
    setTab('props');
    notify('Factory reset to the demo production line.');
  }, [cancelTransient, notify]);

  const handleDuplicateFactory = useCallback(() => {
    const copy = cloneFactory(factoryRef.current);
    copy.id = makeId('F');
    copy.name = `${copy.name} copy`;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    dispatch({ type: 'load', factory: copy });
    setDialogOpen(false);
    setResult(null);
    setResultStale(true);
    cancelTransient();
    notify('Factory duplicated.');
  }, [cancelTransient, notify]);

  const handleExport = useCallback(() => {
    downloadJson(safeFilename(factoryRef.current.name), serializeFactory(factoryRef.current));
    notify('Factory configuration exported as JSON.');
  }, [notify]);

  const handleImport = useCallback(async (file) => {
    try {
      const text = await file.text();
      const imported = deserializeFactory(text);
      dispatch({ type: 'load', factory: imported.factory });
      setDialogOpen(false);
      setResult(null);
      setResultStale(true);
      cancelTransient();
      notify(
        imported.warnings.length
          ? `Imported factory with warnings: ${imported.warnings.join(' ')}`
          : `Imported “${imported.factory.name}”.`,
      );
    } catch (error) {
      notify(`Import failed: ${error.message}`);
    }
  }, [cancelTransient, notify]);

  const handleApprove = useCallback(({ role: approverRole, category, reason, comparison }) => {
    if (approverRole !== 'Plant Manager') {
      notify('Only a Plant Manager can approve and implement this change.');
      return;
    }
    try {
      const current = factoryRef.current;
      const record = saveBaseline(current, {
        approvedBy: approverRole,
        approvedRole: approverRole,
        reason,
        category,
        versionName: current.name,
      });
      const entries = appendAudit({
        role: approverRole,
        category,
        reason,
        versionName: current.name,
        approvedAt: record.approvedAt,
        baselineGood: comparison?.baselineResult?.good,
        proposedGood: comparison?.proposedResult?.good,
        bottleneck: comparison?.proposedResult?.bottleneck,
      });
      saveVersion(current, `${current.name} (approved)`);
      setBaselineRecord(record);
      setAudit(entries);
      setVersions(loadVersions());
      notify(`Baseline approved and replaced by “${current.name}”.`);
    } catch (error) {
      notify(error.message || 'Approval could not be saved.');
    }
  }, [notify]);

  const undo = useCallback(() => {
    dispatch({ type: 'undo' });
    cancelTransient();
    notify('Undo.');
  }, [cancelTransient, notify]);

  const redo = useCallback(() => {
    dispatch({ type: 'redo' });
    cancelTransient();
    notify('Redo.');
  }, [cancelTransient, notify]);

  const deleteSelection = useCallback(() => {
    if (selectedConnection) {
      handleDeleteConnection(selectedConnection);
      return;
    }
    if (selection.length) {
      dispatch({ type: 'deleteComponents', ids: selection });
      notify(`${selection.length} object${selection.length === 1 ? '' : 's'} deleted.`);
    }
  }, [selectedConnection, selection, handleDeleteConnection, notify]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        if (selection.length) {
          dispatch({ type: 'duplicateComponents', ids: selection });
          notify(`${selection.length} object${selection.length === 1 ? '' : 's'} duplicated.`);
        }
        return;
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSaveVersion(factoryRef.current.name);
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedConnection || selection.length) {
          event.preventDefault();
          deleteSelection();
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelTransient();
        setStatus('Selection mode.');
        return;
      }
      if (event.key.toLowerCase() === 'w' || event.key.toLowerCase() === 'e' || event.key.toLowerCase() === 'r') {
        setMode('select');
        setPlacementType(null);
        setConnectMode(false);
        setSelectedConnection(null);
        const nextMode = event.key.toLowerCase() === 'w' ? 'translate' : event.key.toLowerCase() === 'e' ? 'rotate' : 'scale';
        setTransformMode(nextMode);
        setStatus(`Transform mode: ${nextMode}.`);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection, selectedConnection, cancelTransient, deleteSelection, handleSaveVersion, notify, redo, undo]);

  const updateGrid = useCallback((patch) => {
    dispatch({ type: 'setGrid', patch });
  }, []);

  const addLine = useCallback(() => {
    const index = factoryRef.current.lines.length;
    const line = {
      ...createLine(`Line ${String(index + 1).padStart(2, '0')}`, LINE_COLORS[index % LINE_COLORS.length]),
    };
    dispatch({ type: 'addLine', line });
    setActiveLineId(line.id);
    notify(`Added ${line.name}.`);
  }, [notify]);

  const updateLine = useCallback((id, patch) => {
    dispatch({ type: 'updateLine', id, patch, meta: { tag: `line:${id}` } });
  }, []);

  const deleteLine = useCallback((id) => {
    dispatch({ type: 'deleteLine', id });
    notify('Production line removed. Its objects moved to the first line.');
  }, [notify]);

  const metrics = result || {
    good: 0,
    throughputPerHour: 0,
    utilization: 0,
    bottleneck: '—',
  };

  return (
    <div className="app">
      <header>
        <div className="brand">
          <Factory />
          <span>
            <b>INDUSTRIAL TWIN STUDIO</b>
            <small>DESIGN · SIMULATE · EVALUATE</small>
          </span>
        </div>
        <div className="project">
          ● {factory.name} <i>v2.0</i>
          <button className="ghost" onClick={() => setDialogOpen(true)} data-testid="open-file-dialog">
            <FolderOpen size={14} /> File
          </button>
          <button className="save" onClick={() => setDialogOpen(true)} data-testid="save-factory">
            <Save size={15} /> Save factory
          </button>
        </div>
      </header>

      <div className="layout">
        <ComponentLibrary
          factory={factory}
          selection={selection}
          activePlacement={placementType}
          activeLineId={activeLineId}
          selectedConnection={selectedConnection}
          onActivatePlacement={activatePlacement}
          onDragStart={(type) => {
            setDragType(type);
            setPlacementType(null);
            setMode('select');
            setConnectMode(false);
          }}
          onDragEnd={() => setDragType(null)}
          onSelect={selectObjects}
          onToggleSelect={toggleObject}
          onSetActiveLine={setActiveLineId}
          onAddLine={addLine}
          onUpdateLine={updateLine}
          onDeleteLine={deleteLine}
          onUpdateGrid={updateGrid}
          onSelectConnection={handleSelectConnection}
          onDeleteConnection={handleDeleteConnection}
        />

        <main>
          <CanvasToolbar
            view={view}
            onSetView={setView}
            transformMode={transformMode}
            onSetTransformMode={(next) => {
              setTransformMode(next);
              setMode('select');
              setPlacementType(null);
              setConnectMode(false);
            }}
            connectMode={connectMode}
            onSetConnectMode={(next) => {
              setConnectMode(next);
              setMode('select');
              setPlacementType(null);
              setSelectedConnection(null);
              notify(next ? 'Connect mode: drag from an output port to an input port.' : 'Connect mode off.');
            }}
            snap={factory.grid.snap}
            onToggleSnap={() => updateGrid({ snap: !factory.grid.snap })}
            onResetCamera={() => canvasRef.current?.resetCamera()}
            onFitAll={() => canvasRef.current?.fitAll()}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo(store)}
            canRedo={canRedo(store)}
            placementType={placementType}
            onCancelTransient={cancelTransient}
          />

          <FactoryCanvas
            ref={canvasRef}
            factory={factory}
            selection={selection}
            mode={mode}
            placementType={placementType}
            connectMode={connectMode}
            transformMode={transformMode}
            view={view}
            result={result}
            dragType={dragType}
            onSelect={selectObjects}
            onToggleSelect={toggleObject}
            onPlace={placeComponent}
            onTransformLive={handleTransformLive}
            onTransformEnd={handleTransformEnd}
            onConnect={handleConnect}
            onSelectConnection={handleSelectConnection}
            onStatus={notify}
            onCancelTransient={cancelTransient}
            onDragTypeChange={setDragType}
          >
            <div className="hint">
              {view === 'top' ? <Grid3X3 size={14} /> : <Box size={14} />}
              {view === 'top' ? 'Top orthographic view' : '3D perspective view'} · {factory.grid.size} × {factory.grid.size} grid · spacing {factory.grid.spacing}
              {factory.grid.snap ? ' · snap on' : ' · snap off'}
            </div>
            <div className="canvas-help">
              Left drag orbit · middle/right drag pan · wheel zoom · shift+click multi-select · W/E/R transform · Del remove
            </div>
            {toast && <div className="toast">{toast}</div>}
          </FactoryCanvas>

          <div className="simbar">
            <b><Activity size={15} /> Simulation controls</b>
            <label>
              Duration
              <select
                value={factory.settings.durationHours}
                onChange={(event) =>
                  dispatch({
                    type: 'setSettings',
                    patch: { durationHours: Number(event.target.value) },
                    meta: { tag: 'settings:duration' },
                  })
                }
              >
                <option value="1">1 hour</option>
                <option value="4">4 hours</option>
                <option value="8">8 hours / shift</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={factory.settings.stochastic}
                onChange={(event) =>
                  dispatch({
                    type: 'setSettings',
                    patch: { stochastic: event.target.checked },
                    meta: { tag: 'settings:stochastic' },
                  })
                }
              />
              Stochastic
            </label>
            <span className="graph-count">{factory.connections.length} graph links</span>
            <button className="run" onClick={runSimulationNow} data-testid="run-simulation">
              <Play size={14} /> Run simulation
            </button>
          </div>

          <div className="metrics">
            {[
              ['GOOD OUTPUT', metrics.good.toLocaleString(), 'pcs', 'metric-good'],
              ['THROUGHPUT', metrics.throughputPerHour, '/hr', 'metric-throughput'],
              ['MACHINE UTILIZATION', metrics.utilization, '%', 'metric-utilization'],
              ['BOTTLENECK', metrics.bottleneck, '', 'metric-bottleneck'],
            ].map(([label, value, unit, testId]) => (
              <div key={label} data-testid={testId}>
                <small>{label}</small>
                <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
                <em>{unit}</em>
              </div>
            ))}
          </div>
        </main>

        <aside className="right">
          <nav>
            <button className={tab === 'props' ? 'on' : ''} onClick={() => setTab('props')} data-testid="tab-properties">
              <SlidersHorizontal size={13} /> Properties
            </button>
            <button className={tab === 'results' ? 'on' : ''} onClick={() => setTab('results')} data-testid="tab-results">
              <BarChart3 size={13} /> Results
            </button>
            <button className={tab === 'change' ? 'on' : ''} onClick={() => setTab('change')} data-testid="tab-change">
              <ShieldCheck size={13} /> 4M change
            </button>
          </nav>

          {tab === 'props' && (
            <PropertiesPanel
              factory={factory}
              selection={selection}
              result={result}
              onUpdateComponent={handleUpdateComponent}
              onUpdateProps={handleUpdateProps}
              onDelete={(ids) => dispatch({ type: 'deleteComponents', ids })}
              onDuplicate={(ids) => dispatch({ type: 'duplicateComponents', ids })}
              onDeleteConnection={handleDeleteConnection}
              onSelect={selectObjects}
              onStatus={notify}
              onActivateConnect={() => {
                setConnectMode(true);
                setMode('select');
                setPlacementType(null);
                notify('Connect mode: drag from the worker hub worker port to the workstation worker port.');
              }}
            />
          )}

          {tab === 'results' && <ResultsPanel result={result} stale={resultStale} hours={factory.settings.durationHours} />}

          {tab === 'change' && (
            <ChangePanel
              factory={factory}
              baseline={baselineRecord}
              role={role}
              setRole={setRole}
              audit={audit}
              onApprove={handleApprove}
              onStatus={notify}
              stale={resultStale}
            />
          )}
        </aside>
      </div>

      <footer>
        <span>● {status}</span>
        <span>
          {factory.components.length} objects · {factory.connections.length} connections ·{' '}
          {view === '3d' ? 'Perspective' : 'Top orthographic'} · {engineName} · {selection.length} selected
        </span>
      </footer>

      <FactoryFileDialog
        open={dialogOpen}
        factory={factory}
        versions={versions}
        onClose={() => setDialogOpen(false)}
        onNew={handleNew}
        onReset={handleReset}
        onDuplicate={handleDuplicateFactory}
        onSave={handleSaveVersion}
        onLoad={handleLoadVersion}
        onDeleteVersion={handleDeleteVersion}
        onExport={handleExport}
        onImport={handleImport}
        onStatus={notify}
      />
    </div>
  );
}
