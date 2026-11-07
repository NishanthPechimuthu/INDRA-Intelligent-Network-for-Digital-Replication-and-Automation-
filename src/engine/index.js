// Simulation facade: prefer the C++/WebAssembly core and fall back to the
// JavaScript reference engine while the module loads or if it is unavailable.

import { runSimulation as runJsSimulation } from './SimulationEngine.js';
import {
  isWasmReady,
  loadWasmEngine,
  runWasmSimulation,
} from './wasmBridge.js';

let usingWasm = false;
let wasmError = null;

export async function initSimulationEngine(options = {}) {
  const module = await loadWasmEngine(options);
  usingWasm = Boolean(module);
  return usingWasm;
}

export function runSimulation(factory, options = {}) {
  if (usingWasm) {
    try {
      return runWasmSimulation(factory, options);
    } catch (error) {
      wasmError = error;
      usingWasm = false;
    }
  }
  return runJsSimulation(factory, options);
}

export function getEngineName() {
  return usingWasm ? 'C++/WASM DES' : 'JS DES';
}

export function getEngineDiagnostics() {
  return {
    engine: usingWasm ? 'wasm' : 'js',
    wasmReady: isWasmReady(),
    wasmError: wasmError ? String(wasmError.message || wasmError) : null,
  };
}

export { runJsSimulation, runWasmSimulation, loadWasmEngine, isWasmReady };
