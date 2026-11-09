import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { SceneManager } from '../three/SceneManager.js';

const FactoryCanvas = forwardRef(function FactoryCanvas(
  {
    factory,
    selection,
    mode,
    placementType,
    connectMode,
    transformMode,
    view,
    result,
    simulation,
    dragType,
    onSelect,
    onToggleSelect,
    onPlace,
    onTransformLive,
    onTransformEnd,
    onConnect,
    onSelectConnection,
    onStatus,
    onCancelTransient,
    onDragTypeChange,
    children,
  },
  ref,
) {
  const host = useRef(null);
  const managerRef = useRef(null);
  const callbacksRef = useRef({});
  const initialFactoryRef = useRef(factory);

  callbacksRef.current = {
    onSelect,
    onToggleSelect,
    onPlace,
    onTransformLive,
    onTransformEnd,
    onConnect,
    onSelectConnection,
    onStatus,
    onCancelTransient,
  };

  useEffect(() => {
    if (!host.current) return undefined;
    const manager = new SceneManager(
      host.current,
      {
        onSelect: (ids) => callbacksRef.current.onSelect?.(ids),
        onToggleSelect: (id) => callbacksRef.current.onToggleSelect?.(id),
        onPlace: (type, x, y, z) => callbacksRef.current.onPlace?.(type, x, y, z),
        onTransformLive: (updates, meta) => callbacksRef.current.onTransformLive?.(updates, meta),
        onTransformEnd: (ids) => callbacksRef.current.onTransformEnd?.(ids),
        onConnect: (from, to, kind) => callbacksRef.current.onConnect?.(from, to, kind),
        onSelectConnection: (id) => callbacksRef.current.onSelectConnection?.(id),
        onStatus: (message) => callbacksRef.current.onStatus?.(message),
        onCancelTransient: () => callbacksRef.current.onCancelTransient?.(),
      },
      initialFactoryRef.current,
    );
    managerRef.current = manager;
    return () => {
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  useEffect(() => {
    managerRef.current?.update({
      factory,
      selection,
      mode,
      placementType,
      connectMode,
      transformMode,
      result,
      simulation,
    });
  }, [factory, selection, mode, placementType, connectMode, transformMode, result, simulation]);

  useEffect(() => {
    managerRef.current?.setView(view);
  }, [view]);

  useEffect(() => {
    if (!dragType) managerRef.current?.clearPlacementPreview();
  }, [dragType]);

  useImperativeHandle(ref, () => ({
    fitAll: () => managerRef.current?.fitAll(),
    resetCamera: () => managerRef.current?.resetCamera(),
    setView: (next) => managerRef.current?.setView(next),
    cancelTransient: () => managerRef.current?.cancelTransient(),
    screenToGround: (clientX, clientY) => managerRef.current?.screenToGround(clientX, clientY),
    objectScreenPoint: (id) => managerRef.current?.objectScreenPoint(id) || null,
    portScreenPoint: (id, kind) => managerRef.current?.portScreenPoint(id, kind) || null,
    worldScreenPoint: (x, y, z) => managerRef.current?.worldScreenPoint(x, y, z) || null,
    cameraDebug: () => managerRef.current?.cameraDebug() || null,
    workerDebug: () => managerRef.current?.workerDebug() || null,
    productDebug: () => managerRef.current?.productDebug() || null,
  }), []);

  const handleDragOver = (event) => {
    if (!dragType) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    managerRef.current?.previewPlacement(dragType, event.clientX, event.clientY);
  };

  const handleDragLeave = (event) => {
    if (event.relatedTarget && host.current?.contains(event.relatedTarget)) return;
    managerRef.current?.clearPlacementPreview();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const type =
      event.dataTransfer.getData('application/x-indra-component') ||
      event.dataTransfer.getData('application/x-its-component') ||
      dragType;
    if (!type) return;
    const point = managerRef.current?.dropPlacement(type, event.clientX, event.clientY);
    managerRef.current?.clearPlacementPreview();
    onDragTypeChange?.(null);
    if (point) onPlace?.(type, point.x, 0, point.z);
  };

  return (
    <div
      className="scene"
      ref={host}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="factory-canvas"
    >
      {children}
    </div>
  );
});

export default FactoryCanvas;
