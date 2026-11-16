/**
 * Tripe Fogareiro a Gas + Botijao GLP e Mangueira (MycoCampus3D)
 * Baseado no fogareiro alta-pressao de 3 pernas com niveis de chama (0=OFF, 1=Baixo, 2=Medio, 3=Alto).
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable, updateItemBounds, isSurfaceOccupied } from './item-registry.js';

const THREE = window.THREE;

export const GAS_TRIPOD_META = {
  category: 'heating',
  purpose: 'Tripé fogareiro a gás GLP de alta potência com 3 níveis de chama (Baixo/Médio/Alto)',
  weightGrams: 4800,
  baseTempC: 24.0,
  compatibilities: {
    canEnterCooker: false,
    heatsCookerOnSurface: true
  },
  connections: ['pressure_cooker']
};

export function makeGasTripodBurner(ctx, id, px, py, pz) {
  const tg = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.65, metalness: 0.45 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.25 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });
  const hoseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });

  const totalH = 0.62;
  // 3 pernas inclinadas do tripe
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + 0.35;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.60, 10), legMat);
    leg.position.set(Math.cos(ang) * 0.23, 0.29, Math.sin(ang) * 0.23);
    leg.rotation.z = Math.cos(ang) * 0.14;
    leg.rotation.x = -Math.sin(ang) * 0.14;
    tg.add(leg);
  }

  // Aro duplo preto (chassi do queimador)
  const upperRing = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.075, 22, 1, true), ironMat);
  upperRing.position.y = totalH - 0.038;
  const lowerRing = new THREE.Mesh(new THREE.CylinderGeometry(0.220, 0.220, 0.055, 22, 1, true), ironMat);
  lowerRing.position.y = totalH - 0.115;

  // Queimador central + anel de chama azul
  const burnerHead = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.032, 18), ironMat);
  burnerHead.position.y = totalH - 0.055;
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.0 });
  const flameRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 8, 22), flameMat);
  flameRing.rotation.x = Math.PI / 2;
  flameRing.position.y = totalH - 0.035;
  flameRing.visible = false;

  // Registro de gas + mangueira + botijao verde ao lado
  const valve = makeBox(0.038, 0.032, 0.038, brassMat);
  valve.position.set(-0.24, totalH - 0.09, 0.02);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.018, 12), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 }));
  knob.rotation.z = Math.PI / 2;
  knob.position.set(-0.27, totalH - 0.09, 0.02);

  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.25, totalH - 0.09, 0.02),
    new THREE.Vector3(-0.38, totalH - 0.22, -0.08),
    new THREE.Vector3(-0.46, 0.44, -0.20)
  ]);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 12, 0.010, 8, false), hoseMat);

  // Botijao GLP verde (P13) ao lado do tripe
  const gasMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.42, metalness: 0.28 });
  const cylBody = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.34, 18), gasMat);
  cylBody.position.set(-0.46, 0.18, -0.22);
  const cylTop = new THREE.Mesh(new THREE.SphereGeometry(0.165, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), gasMat);
  cylTop.scale.set(1, 0.45, 1);
  cylTop.position.set(-0.46, 0.35, -0.22);
  const cylCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.07, 14, 1, true), gasMat);
  cylCollar.position.set(-0.46, 0.43, -0.22);
  const cylValve = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 10), brassMat);
  cylValve.position.set(-0.46, 0.44, -0.20);

  const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const topHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.02, 18),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  topHit.position.y = totalH;

  tg.add(
    upperRing, lowerRing, burnerHead, flameRing,
    valve, knob, hose,
    cylBody, cylTop, cylCollar, cylValve, topHit
  );

  const bSurf = { minX: px - 0.22, maxX: px + 0.22, minZ: pz - 0.22, maxZ: pz + 0.22, topY: py + totalH };
  ctx.supportSurfaces.push(bSurf);
  topHit.userData.supportSurface = bSurf;
  upperRing.userData.supportSurface = bSurf;
  ctx.supportMeshes.push(topHit, upperRing);

  tg.userData.isBurner = true;
  tg.userData.twoHanded = true;
  tg.userData.tableDims = { w: 0.46, h: totalH, d: 0.46, surfOffset: 0 };
  tg.userData.dynamicSurface = bSurf;
  tg.userData.updateBounds = updateItemBounds;
  tg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(ctx, bSurf, it); };

  const bState = {
    id,
    kind: 'gas_tripod',
    on: false,
    level: 0, // 0=OFF, 1=BAIXO, 2=MEDIO, 3=ALTO
    heat: 0,
    coilMat: flameMat,
    flameRing,
    reflectorMat: null,
    ledMat,
    knobGroup: knob,
    surface: bSurf
  };
  const bIdx = ctx.burnerDevices.length;
  valve.userData.burnerSwitchIdx = bIdx;
  knob.userData.burnerSwitchIdx = bIdx;
  ctx.burnerSwitchMeshes.push(valve, knob);
  ctx.burnerDevices.push(bState);

  return registerPickable(ctx, id, 'Tripé Fogareiro a Gás (GLP)', tg, px, py, pz, 0, 0.34, totalH, GAS_TRIPOD_META);
}
