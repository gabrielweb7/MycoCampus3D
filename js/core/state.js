/**
 * MycoCampus3D — Estado Centralizado da Aplicação e do Mundo 3D
 */
import { HAT_COLORS, BODY_COLORS, createSessionId } from './constants.js';

export const appState = {
  sessionId: createSessionId(),
  currentUser: null,
  authToken: '',
  selectedHat: HAT_COLORS[0],
  selectedBody: BODY_COLORS[0],
  currentSlideIdx: 0,
  currentPresenter: '',
  pendingChatMsg: '',
  boardLastId: 0,
  lastObjVer: '',
  lastItemStateVer: '',
  lastStateVer: '',
  villageLease: null,
  syncTimer: null,
  syncInFlight: false,
  syncQueued: false,
  isInitialSync: true,
  syncFailures: 0,
  inFps: false
};

export const worldState = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  clock: null,

  // Listas espaciais e entidades
  solidColliders: [],
  wallSegments: [],
  walkableFloors: [],
  stairsList: [],
  supportSurfaces: [],
  supportMeshes: [],
  pickableItems: [],
  wildMushrooms: [],
  campusDoors: [],
  doorHitMeshes: [],
  windowBlinds: [],
  blindHitMeshes: [],
  seats: [],

  // Estado do jogador local
  lobbyTourActive: true,
  tourTime: 0,
  inFps: false
};
