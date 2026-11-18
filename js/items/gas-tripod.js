/**
 * Tripé Fogareiro a Gás GLP de Alta Pressão + Botijão P13 e Regulador (MycoCampus3D)
 * Modelo industrial realista de ferro fundido com trempe aranha, anel reforçado,
 * queimador duplo e chama azul realista diegética.
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

  // Materiais realistas de laboratório/culinária industrial
  const castIronMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.78,
    metalness: 0.40
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.35,
    metalness: 0.85
  });
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.92,
    metalness: 0.1
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.30,
    metalness: 0.88
  });
  const hoseMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.85
  });

  const totalH = 0.62;

  // 1. Pernas do Tripé em Aço Tubular com sapatas antiderrapantes de borracha
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + 0.35;
    const legG = new THREE.Group();
    legG.position.set(Math.cos(ang) * 0.23, 0.28, Math.sin(ang) * 0.23);
    legG.rotation.z = Math.cos(ang) * 0.12;
    legG.rotation.x = -Math.sin(ang) * 0.12;

    // Tubo principal da perna
    const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.015, 0.58, 12), steelMat);
    legG.add(legMesh);

    // Sapata de borracha na base
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.035, 12), rubberMat);
    foot.position.y = -0.28;
    legG.add(foot);

    tg.add(legG);
  }

  // Anel inferior de reforço estrutural entre as 3 pernas
  const braceRing = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.009, 8, 28), castIronMat);
  braceRing.rotation.x = Math.PI / 2;
  braceRing.position.y = 0.18;
  tg.add(braceRing);

  // 2. Chassi do Queimador: Anel Pesado de Ferro Fundido
  const chassisRing = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.018, 12, 32), castIronMat);
  chassisRing.rotation.x = Math.PI / 2;
  chassisRing.position.y = totalH - 0.035;
  tg.add(chassisRing);

  // Saia defletora de vento cilíndrica com espessura dupla
  const windShield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.235, 0.235, 0.075, 28, 1, false),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.5, side: THREE.DoubleSide })
  );
  windShield.position.y = totalH - 0.072;
  tg.add(windShield);

  // 3. Trempe Industrial (Grelha Aranha): 6 braços radiais robustos que sustentam a panela
  for (let a = 0; a < 6; a++) {
    const armAng = (a / 6) * Math.PI * 2;
    const arm = makeBox(0.024, 0.032, 0.19, castIronMat);
    arm.position.set(Math.cos(armAng) * 0.13, totalH - 0.016, Math.sin(armAng) * 0.13);
    arm.rotation.y = -armAng;
    tg.add(arm);

    // Dentes de apoio para travar a base da panela
    const tooth = makeBox(0.022, 0.012, 0.018, castIronMat);
    tooth.position.set(Math.cos(armAng) * 0.20, totalH + 0.006, Math.sin(armAng) * 0.20);
    tooth.rotation.y = -armAng;
    tg.add(tooth);
  }

  // 4. Cabeça do Queimador Central de Ferro Fundido (Queimador Duplo)
  const burnerBase = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.045, 20), castIronMat);
  burnerBase.position.y = totalH - 0.065;
  const burnerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.016, 20), castIronMat);
  burnerCap.position.y = totalH - 0.040;

  // Coroa de orifícios de gás em latão
  const orificeRing = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.007, 8, 24), brassMat);
  orificeRing.rotation.x = Math.PI / 2;
  orificeRing.position.y = totalH - 0.034;
  tg.add(burnerBase, burnerCap, orificeRing);

  // Tubo misturador de gás que entra por baixo do queimador
  const mixPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 12), castIronMat);
  mixPipe.rotation.z = Math.PI / 2;
  mixPipe.position.set(-0.12, totalH - 0.085, 0.0);
  tg.add(mixPipe);

  // 5. Sistema de Chamas Realista em Camadas (Brilho Aditivo)
  // Camada 1: Chama externa azul celeste
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x0099ff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const flameRing = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.022, 10, 26), flameMat);
  flameRing.rotation.x = Math.PI / 2;
  flameRing.position.y = totalH - 0.022;
  flameRing.visible = false;

  // Camada 2: Núcleo quente interno ciano/branco
  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const innerFlame = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.016, 10, 24), innerFlameMat);
  innerFlame.rotation.x = Math.PI / 2;
  innerFlame.position.y = totalH - 0.020;
  innerFlame.visible = false;

  // Camada 3: Pontas laranjas incandescentes sutis em alta potência
  const flameTipsMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const flameTips = new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.010, 8, 24), flameTipsMat);
  flameTips.rotation.x = Math.PI / 2;
  flameTips.position.y = totalH - 0.016;
  flameTips.visible = false;

  // Luz dinâmica da chama projetada no chão, na panela e no ambiente
  const flameLight = new THREE.PointLight(0x38bdf8, 0, 2.8, 1.6);
  flameLight.position.set(0, totalH + 0.03, 0);

  tg.add(flameRing, innerFlame, flameTips, flameLight);

  // 6. Registro de Gás de Latão com Manípulo Vermelho
  const valve = makeBox(0.042, 0.036, 0.042, brassMat);
  valve.position.set(-0.24, totalH - 0.085, 0.0);

  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.020, 14),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 })
  );
  knob.rotation.z = Math.PI / 2;
  knob.position.set(-0.27, totalH - 0.085, 0.0);

  // 7. Mangueira de Gás Reforçada conectando ao Botijão
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.24, totalH - 0.085, 0.0),
    new THREE.Vector3(-0.35, totalH - 0.24, -0.06),
    new THREE.Vector3(-0.46, 0.44, -0.20)
  ]);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 16, 0.011, 8, false), hoseMat);

  // Abraçadeiras de aço nas pontas da mangueira
  const clamp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.018, 10), steelMat);
  clamp1.rotation.z = Math.PI / 2;
  clamp1.position.set(-0.25, totalH - 0.085, 0.0);

  // 8. Botijão GLP P13 Realista (Verde Petrobras / Ultragaz) com Alças e Regulador
  const gasMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.40, metalness: 0.30 });
  const cylBody = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.34, 20), gasMat);
  cylBody.position.set(-0.46, 0.18, -0.22);

  // Solda central do botijão
  const cylWeld = new THREE.Mesh(new THREE.TorusGeometry(0.167, 0.005, 6, 22), gasMat);
  cylWeld.rotation.x = Math.PI / 2;
  cylWeld.position.set(-0.46, 0.18, -0.22);

  const cylTop = new THREE.Mesh(new THREE.SphereGeometry(0.165, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), gasMat);
  cylTop.scale.set(1, 0.45, 1);
  cylTop.position.set(-0.46, 0.35, -0.22);

  const cylCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.088, 0.075, 16, 1, true), gasMat);
  cylCollar.position.set(-0.46, 0.43, -0.22);

  // Válvula reguladora de pressão com manômetro dourado
  const cylValve = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.045, 10), brassMat);
  cylValve.position.set(-0.46, 0.44, -0.20);
  const regulator = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.022, 14), steelMat);
  regulator.rotation.x = Math.PI / 2;
  regulator.position.set(-0.46, 0.45, -0.17);

  const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const topHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.02, 20),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  topHit.position.y = totalH;

  tg.add(
    valve, knob, clamp1, hose,
    cylBody, cylWeld, cylTop, cylCollar, cylValve, regulator,
    topHit
  );

  // Superfície de apoio para panelas de pressão e recipientes
  const bSurf = {
    minX: px - 0.24,
    maxX: px + 0.24,
    minZ: pz - 0.24,
    maxZ: pz + 0.24,
    topY: py + totalH
  };
  ctx.supportSurfaces.push(bSurf);
  topHit.userData.supportSurface = bSurf;
  chassisRing.userData.supportSurface = bSurf;
  ctx.supportMeshes.push(topHit, chassisRing);

  tg.userData.isBurner = true;
  tg.userData.twoHanded = true;
  tg.userData.tableDims = { w: 0.50, h: totalH, d: 0.50, surfOffset: 0 };
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
    innerFlame,
    innerFlameMat,
    flameTips,
    flameTipsMat,
    flameLight,
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

  return registerPickable(ctx, id, 'Tripé Fogareiro a Gás (GLP)', tg, px, py, pz, 0, 0.36, totalH, GAS_TRIPOD_META);
}
