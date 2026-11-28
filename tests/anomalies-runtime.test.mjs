import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };
globalThis.document = {
  createElement() {
    const context = {
      clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
      closePath() {}, fill() {}, fillText() {}
    };
    return { getContext: () => context };
  }
};

const { stepUfoAbduction } = await import('../js/world/ufo-abduction.js');
const { stepTripGnomes } = await import('../js/world/trip-gnomes.js');
const { collectEcologyTelemetrySnapshot } = await import('../js/world/ecology-station.js');

test('radar acompanha a nave e detecta o gnomo tenebroso no ciclo normal de jogo', () => {
  const notices = [];
  const ctx = {
    scene: new THREE.Scene(),
    playerPos: new THREE.Vector3(),
    sunElevation: 0.6,
    physCtx: { stairsList: [], walkableFloors: [], supportSurfaces: [], solidColliders: [], wallSegments: [] },
    callbacks: { onToast: message => notices.push(message) }
  };
  assert.equal(collectEcologyTelemetrySnapshot(ctx).ufo.active, false);
  stepUfoAbduction(ctx, 32);
  const arrival = collectEcologyTelemetrySnapshot(ctx).ufo;
  assert.equal(arrival.active, true);
  assert.equal(arrival.phase, 'flyby');
  assert.ok(Math.hypot(arrival.x, arrival.z) > 90);
  assert.equal(notices.length, 1);
  stepUfoAbduction(ctx, 2);
  const flying = collectEcologyTelemetrySnapshot(ctx).ufo;
  assert.ok(Math.hypot(flying.x - arrival.x, flying.z - arrival.z) > 10);
  stepUfoAbduction(ctx, 12);
  assert.equal(collectEcologyTelemetrySnapshot(ctx).ufo.active, false);

  for (let second = 0; second < 112 && !collectEcologyTelemetrySnapshot(ctx).gnome.active; second++) {
    stepTripGnomes(ctx, 1);
  }
  const gnome = collectEcologyTelemetrySnapshot(ctx).gnome;
  assert.equal(gnome.active, true);
  assert.ok(gnome.distToStation >= 0);
});
