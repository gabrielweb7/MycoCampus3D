/**
 * Fachada de Sincronizacao Multiplayer do Mundo (MycoCampus3D)
 * Reexporta os modulos especializados de objetos fisicos e dispositivos fixos.
 */

export {
  consumeCampusMovedItems,
  requeueCampusMovedItems,
  applyCampusItemStates,
  applyCampusWorldObjects,
  resetCampusWorldObjects,
  applyCampusSavedPose
} from './world-objects-sync.js';

export {
  consumeCampusBoardStrokes,
  requeueCampusBoardStrokes,
  applyCampusBoardStrokes,
  consumeCampusStateChanges,
  requeueCampusStateChanges,
  applyCampusWorldState
} from './world-devices-sync.js';
