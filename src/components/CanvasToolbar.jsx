import React from 'react';
import {
  Box,
  Grid3X3,
  Link2,
  LocateFixed,
  Magnet,
  Maximize2,
  Move,
  RotateCw,
  Scaling,
  Undo2,
  Redo2,
  X,
} from 'lucide-react';

export default function CanvasToolbar({
  view,
  onSetView,
  transformMode,
  onSetTransformMode,
  connectMode,
  onSetConnectMode,
  snap,
  onToggleSnap,
  onResetCamera,
  onFitAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  placementType,
  onCancelTransient,
}) {
  return (
    <div className="toolbar canvas-toolbar">
      <span>
        Factory / <b>Production line</b>
        {placementType && <i className="mode-pill">PLACING {placementType.toUpperCase()} · ESC TO EXIT</i>}
        {connectMode && <i className="mode-pill connect">CONNECT MODE</i>}
      </span>
      <div className="toolbar-groups">
        <div className="toolbar-group">
          <button className={view === 'top' ? 'active' : ''} onClick={() => onSetView('top')} data-testid="view-top">
            <Grid3X3 size={14} /> Top view
          </button>
          <button className={view === '3d' ? 'active' : ''} onClick={() => onSetView('3d')} data-testid="view-3d">
            <Box size={14} /> 3D view
          </button>
        </div>
        <div className="toolbar-group">
          <button
            className={transformMode === 'translate' ? 'active' : ''}
            onClick={() => onSetTransformMode('translate')}
            title="Move (W)"
            data-testid="mode-move"
          >
            <Move size={13} /> Move
          </button>
          <button
            className={transformMode === 'rotate' ? 'active' : ''}
            onClick={() => onSetTransformMode('rotate')}
            title="Rotate (E)"
            data-testid="mode-rotate"
          >
            <RotateCw size={13} /> Rotate
          </button>
          <button
            className={transformMode === 'scale' ? 'active' : ''}
            onClick={() => onSetTransformMode('scale')}
            title="Scale (R)"
            data-testid="mode-scale"
          >
            <Scaling size={13} /> Scale
          </button>
        </div>
        <div className="toolbar-group">
          <button
            className={connectMode ? 'active' : ''}
            onClick={() => onSetConnectMode(!connectMode)}
            title="Connect components"
            data-testid="mode-connect"
          >
            <Link2 size={13} /> Connect
          </button>
          <button className={snap ? 'active' : ''} onClick={onToggleSnap} title="Toggle grid snapping" data-testid="toolbar-snap">
            <Magnet size={13} /> Snap
          </button>
        </div>
        <div className="toolbar-group">
          <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo2 size={13} />
          </button>
          <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={13} />
          </button>
          <button onClick={onResetCamera} title="Reset camera" data-testid="reset-camera">
            <LocateFixed size={13} />
          </button>
          <button onClick={onFitAll} title="Fit all factory objects" data-testid="fit-all">
            <Maximize2 size={13} />
          </button>
          {placementType && (
            <button onClick={onCancelTransient} title="Cancel placement">
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
