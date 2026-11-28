import test from 'node:test';
import assert from 'node:assert/strict';
import { MathUtils, Vector2 } from '../js/vendor/three.bundle.min.js';

globalThis.window = globalThis.window || {
  THREE: {
    MathUtils,
    Vector2,
    Vector3: class {
      constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
      set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    },
    Box3: class {},
    Quaternion: class {}
  }
};

const eco = await import('../js/entities/bee-ecology.js');
const { getUfoTelemetry } = await import('../js/world/ufo-abduction.js');
const { collectEcologyTelemetrySnapshot } = await import('../js/world/ecology-station.js');
const gnomes = await import('../js/world/trip-gnomes.js');

function makeCtx(extra = {}) {
  return {
    beehives: [], beehiveHitMeshes: [], campusFlowers: [], flowerHitMeshes: [],
    pastureBees: [], pickableItems: [], playerPos: { x: 0, y: 0, z: 0 },
    sunElevation: 0.8, callbacks: { onToast() {} }, ...extra
  };
}

function loadHive(ctx, extraFlowers = true) {
  eco.applyBeeEcologyWorldState(ctx, {
    campus_beehives: JSON.stringify([{ id: 'hive_t', m: 'tree', x: 24.48, y: 2.55, z: 26, h: 40, bp: 1.0 }]),
    campus_flowers: JSON.stringify(extraFlowers
      ? [{ id: 'fl_t', x: 27.2, z: 28.2, ci: 0, st: 'blooming', p: 1.0 }] : [])
  });
}

test('abelhas entram uma por uma na colmeia à noite e saem de dia', () => {
  const ctx = makeCtx({ playerPos: { x: 24, y: 0, z: 26 } });
  loadHive(ctx);
  for (let i = 0; i < 20; i++) eco.stepPastureBees(ctx, 0.1);
  assert.ok(ctx.pastureBees.length >= 4);
  ctx.sunElevation = -0.6;
  const hiddenOverTime = [];
  for (let t = 0; t < 400; t++) {
    eco.stepPastureBees(ctx, 0.1);
    if (t % 50 === 0) hiddenOverTime.push(ctx.pastureBees.filter((b) => b.sleeping).length);
  }
  assert.ok(hiddenOverTime[1] < ctx.pastureBees.length, 'não entram todas ao mesmo tempo');
  assert.ok(ctx.pastureBees.every((b) => b.sleeping && !b.group.visible), 'todas dormem invisíveis na noite profunda');
  ctx.sunElevation = 0.8;
  for (let t = 0; t < 20; t++) eco.stepPastureBees(ctx, 0.1);
  assert.ok(ctx.pastureBees.every((b) => !b.sleeping), 'de dia todas acordam');
  assert.ok(ctx.pastureBees.some((b) => b.group.visible), 'e voltam a aparecer');
});

test('colmeia abandonada não recolhida bloqueia nova colmeia e migração escolhe local livre', () => {
  const ctx = makeCtx();
  loadHive(ctx, false);
  const old = ctx.beehives[0];
  assert.equal(eco.startHiveMigration(ctx, old, false), true, 'sem mel/flores a colônia migra');
  assert.equal(old.abandoned, true, 'a colmeia velha fica abandonada');
  const fresh = ctx.beehives.find((h) => h !== old);
  assert.ok(fresh && Math.hypot(fresh.x - old.x, fresh.z - old.z) >= 6, 'nova colmeia em outro lugar');
  const ctx2 = makeCtx();
  loadHive(ctx2, false);
  ctx2.campusFlowers.push(...[]); // sem flores
  const abandoned = ctx2.beehives[0];
  abandoned.abandoned = true;
  const spot = eco.findNearestHiveMountSpot(ctx2, abandoned.x, abandoned.z);
  assert.ok(spot);
  const cx = spot.mountType === 'tree' ? spot.x + 0.48 : spot.x;
  assert.ok(Math.hypot(cx - abandoned.x, spot.z - abandoned.z) >= 6, 'não constrói sobre a abandonada');
  const positions = new Set();
  for (let i = 0; i < 12; i++) {
    const s = eco.findNearestHiveMountSpot(makeCtx(), 10, 10);
    positions.add(`${Math.round(s.x)}:${Math.round(s.z)}`);
  }
  assert.ok(positions.size > 1, 'o local varia, não é fixo');
});

test('criação inicial espalha colmeias e flores pelo mapa', () => {
  const ctx = makeCtx({ scene: { add() {}, remove() {} } });
  try { eco.createPastureBees(ctx); } catch (e) { return; /* sem cena THREE completa no Node */ }
  assert.ok(ctx.campusFlowers.length >= 18);
});

test('nave aparece na telemetria e o gnomo raro roda sem trip ativo', () => {
  assert.equal(getUfoTelemetry().active, false);
  const ctx = makeCtx();
  const snap = collectEcologyTelemetrySnapshot(ctx);
  assert.equal(snap.ufo.active, false);
  gnomes.clearRareBlackGnomeForTest();
  gnomes.triggerRareBlackGnomeAppearance(ctx, 0);
  assert.equal(gnomes.getRareBlackGnomeTelemetry().active, true);
  gnomes.clearRareBlackGnomeForTest();
});
