/**
 * Tripé Fogareiro a Gás GLP de Alta Pressão com Queimador Duplo de Caulim
 * Fiel ao modelo comercial brasileiro (tambor zincado, trempe 3 garras, queimador duplo de caulim).
 * Simulação física real de 4 estados:
 *   - 0: DESLIGADO (Ambos os anéis apagados)
 *   - 1: FOGO BAIXO (Apenas anel interno aceso nos 6 bicos centrais)
 *   - 2: FOGO MÉDIO (Anel interno + anel externo acesos em potência média)
 *   - 3: FOGO ALTO (Ambos os anéis em potência máxima, chamas altas e vivas)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable, updateItemBounds, isSurfaceOccupied } from './item-registry.js';

const THREE = window.THREE;

export const GAS_TRIPOD_META = {
  category: 'heating',
  purpose: 'Tripé fogareiro alta pressão com queimador duplo de caulim (Desligado / Baixo / Médio / Alto)',
  weightGrams: 4200,
  baseTempC: 24.0,
  compatibilities: {
    canEnterCooker: false,
    heatsCookerOnSurface: true
  },
  connections: ['pressure_cooker']
};

export function makeGasTripodBurner(ctx, id, px, py, pz) {
  const tg = new THREE.Group();

  // 1. Materiais fiéis ao produto real da foto (Aço zincado/galvanizado brilhante, latão e borracha)
  const zincMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.85,
    roughness: 0.30,
    side: THREE.DoubleSide
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.92,
    roughness: 0.18
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.88,
    roughness: 0.25
  });
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.90,
    metalness: 0.10
  });
  const hoseMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.85
  });

  const totalH = 0.65;
  const drumR = 0.205;
  const drumH = 0.125;

  // 2. Tambor Cilíndrico Corta-Vento em Chapa de Aço Zincado
  const drumGeo = new THREE.CylinderGeometry(drumR, drumR, drumH, 32, 1, true);
  const drumMesh = new THREE.Mesh(drumGeo, zincMat);
  drumMesh.position.y = totalH - drumH / 2;
  tg.add(drumMesh);

  // Borda superior e inferior enroladas (reforço estrutural do tambor)
  const lipTop = new THREE.Mesh(new THREE.TorusGeometry(drumR, 0.007, 8, 32), chromeMat);
  lipTop.rotation.x = Math.PI / 2;
  lipTop.position.y = totalH;

  const lipBot = new THREE.Mesh(new THREE.TorusGeometry(drumR, 0.007, 8, 32), chromeMat);
  lipBot.rotation.x = Math.PI / 2;
  lipBot.position.y = totalH - drumH;
  tg.add(lipTop, lipBot);

  // 3. Trempe Superior com 3 Garras Radiais em Barra de Aço (Cruzeta para Panela)
  for (let g = 0; g < 3; g++) {
    const ang = (g / 3) * Math.PI * 2 + Math.PI / 6;
    const bar = makeBox(0.010, 0.024, drumR * 0.96, chromeMat);
    bar.position.set(Math.cos(ang) * (drumR * 0.48), totalH - 0.004, Math.sin(ang) * (drumR * 0.48));
    bar.rotation.y = -ang;
    tg.add(bar);

    // Dente vertical limitador para travar o fundo da panela
    const notch = makeBox(0.010, 0.018, 0.016, chromeMat);
    notch.position.set(Math.cos(ang) * (drumR * 0.78), totalH + 0.009, Math.sin(ang) * (drumR * 0.78));
    notch.rotation.y = -ang;
    tg.add(notch);
  }

  // 4. Pernas do Tripé em Tubo de Aço com Dobra no Topo e Sapatas Pretas
  const legR = 0.22;
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const legG = new THREE.Group();
    legG.position.set(Math.cos(ang) * drumR, totalH - drumH + 0.02, Math.sin(ang) * drumR);

    // Dobra superior que afasta as pernas ligeiramente para fora
    const bend = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.06, 12), chromeMat);
    bend.position.set(Math.cos(ang) * 0.012, -0.02, Math.sin(ang) * 0.012);
    bend.rotation.z = Math.cos(ang) * 0.22;
    bend.rotation.x = -Math.sin(ang) * 0.22;
    legG.add(bend);

    // Haste vertical principal da perna
    const legMain = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, totalH - drumH, 12), chromeMat);
    legMain.position.set(Math.cos(ang) * 0.022, -(totalH - drumH) / 2, Math.sin(ang) * 0.022);
    legG.add(legMain);

    // Sapata preta de borracha no chão
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.016, 0.028, 12), rubberMat);
    foot.position.set(Math.cos(ang) * 0.022, -(totalH - drumH) + 0.014, Math.sin(ang) * 0.022);
    legG.add(foot);

    tg.add(legG);
  }

  // Travessa triangular de reforço inferior entre as pernas
  const braceY = 0.20;
  for (let b = 0; b < 3; b++) {
    const a1 = (b / 3) * Math.PI * 2 + Math.PI / 6;
    const a2 = ((b + 1) / 3) * Math.PI * 2 + Math.PI / 6;
    const p1 = new THREE.Vector3(Math.cos(a1) * legR, braceY, Math.sin(a1) * legR);
    const p2 = new THREE.Vector3(Math.cos(a2) * legR, braceY, Math.sin(a2) * legR);
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const len = p1.distanceTo(p2);
    const brace = makeBox(0.016, 0.006, len, chromeMat);
    brace.position.copy(mid);
    brace.lookAt(p2);
    tg.add(brace);
  }

  // 5. Queimador Duplo de Caulim em Tubo de Aço
  // Anel Interno (Queimador Pequeno - Fogo Baixo): raio 0.062m com 6 bicos de caulim
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.007, 8, 24), chromeMat);
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = totalH - 0.048;
  tg.add(innerRing);

  // Anel Externo (Queimador Grande - Fogo Médio/Alto): raio 0.138m com 12 bicos de caulim
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.138, 0.007, 8, 32), chromeMat);
  outerRing.rotation.x = Math.PI / 2;
  outerRing.position.y = totalH - 0.048;
  tg.add(outerRing);

  // Tubos radiais de sustentação interna dos queimadores
  for (let r = 0; r < 3; r++) {
    const rAng = (r / 3) * Math.PI * 2;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.26, 8), chromeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.rotation.y = rAng;
    pipe.position.set(0, totalH - 0.056, 0);
    tg.add(pipe);
  }

  // 6. Materiais Compartilhados das Chamas (Estilo Additive Sci-Fi/Realista)
  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.90,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: 0x0284c7,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const flameTipMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  // Função auxiliar para gerar um bico de caulim com sua coroa de fogo
  function createCaulimNozzleWithFlame(radius, count, targetFlameGroup) {
    for (let n = 0; n < count; n++) {
      const ang = (n / count) * Math.PI * 2;
      const nx = Math.cos(ang) * radius;
      const nz = Math.sin(ang) * radius;

      // Corpo metálico do bico de caulim (corpo cilíndrico furadinho)
      const nozzleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.016, 10), brassMat);
      nozzleBase.position.set(nx, totalH - 0.038, nz);

      const nozzleDome = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), chromeMat);
      nozzleDome.position.set(nx, totalH - 0.030, nz);
      tg.add(nozzleBase, nozzleDome);

      // Chamas do bico: cone interno ciano + cone externo azul + ponta amarela
      const flameCluster = new THREE.Group();
      flameCluster.position.set(nx, 0, nz);

      // Núcleo quente interno
      const fCore = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.034, 8), flameCoreMat);
      fCore.position.y = 0.017;
      flameCluster.add(fCore);

      // Envoltória externa azul
      const fOuter = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.046, 8), flameOuterMat);
      fOuter.position.y = 0.023;
      flameCluster.add(fOuter);

      // Pontinha de fogo incandescente no topo
      const fTip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), flameTipMat);
      fTip.position.y = 0.046;
      fTip.scale.set(1, 1.6, 1);
      flameCluster.add(fTip);

      targetFlameGroup.add(flameCluster);
    }
  }

  // Grupos separados para controle independente de chama:
  // Grupo de Chamas Internas (6 bicos de caulim do anel central)
  const innerFlamesGroup = new THREE.Group();
  innerFlamesGroup.position.y = totalH - 0.026;
  createCaulimNozzleWithFlame(0.062, 6, innerFlamesGroup);
  innerFlamesGroup.visible = false;
  tg.add(innerFlamesGroup);

  // Grupo de Chamas Externas (12 bicos de caulim do anel periférico)
  const outerFlamesGroup = new THREE.Group();
  outerFlamesGroup.position.y = totalH - 0.026;
  createCaulimNozzleWithFlame(0.138, 12, outerFlamesGroup);
  outerFlamesGroup.visible = false;
  tg.add(outerFlamesGroup);

  // Luz dinâmica pontual da chama
  const flameLight = new THREE.PointLight(0x38bdf8, 0, 3.2, 1.4);
  flameLight.position.set(0, totalH + 0.04, 0);
  tg.add(flameLight);

  // 7. Tubos Duplos de Injeção Laterais e Registros de Latão (Idêntico à Foto 2)
  // Tubos horizontais projetados para fora do tambor
  const manifoldX = -drumR;
  const pipeLen = 0.22;
  const pipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, pipeLen, 10), chromeMat);
  pipe1.rotation.z = Math.PI / 2;
  pipe1.position.set(manifoldX - pipeLen / 2, totalH - 0.060, 0.016);

  const pipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, pipeLen, 10), chromeMat);
  pipe2.rotation.z = Math.PI / 2;
  pipe2.position.set(manifoldX - pipeLen / 2, totalH - 0.060, -0.016);
  tg.add(pipe1, pipe2);

  // Registros de latão com manípulos vermelhos visíveis (um para anel interno e um para externo)
  const redValveMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.15 });
  function makeRedKnob(zPos) {
    const kg = new THREE.Group();
    kg.position.set(manifoldX - pipeLen - 0.008, totalH - 0.060, zPos);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.016, 12), redValveMat);
    cap.rotation.z = Math.PI / 2;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.052, 0.012), redValveMat);
    bar.position.x = -0.006;
    kg.add(cap, bar);
    return kg;
  }

  const valve1 = makeBox(0.024, 0.028, 0.024, brassMat);
  valve1.position.set(manifoldX - pipeLen + 0.02, totalH - 0.060, 0.016);
  const knob1 = makeRedKnob(0.018);

  const valve2 = makeBox(0.024, 0.028, 0.024, brassMat);
  valve2.position.set(manifoldX - pipeLen + 0.02, totalH - 0.060, -0.016);
  const knob2 = makeRedKnob(-0.018);

  const valveHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.11, 0.12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  valveHit.position.set(manifoldX - pipeLen, totalH - 0.060, 0);

  // Conexão T em latão e borboleta de alta pressão para regulador P13
  const tee = makeBox(0.020, 0.038, 0.048, brassMat);
  tee.position.set(manifoldX - pipeLen - 0.032, totalH - 0.060, 0);

  const butterflyWing1 = makeBox(0.006, 0.018, 0.014, brassMat);
  butterflyWing1.position.set(manifoldX - pipeLen - 0.046, totalH - 0.048, 0);
  const butterflyWing2 = makeBox(0.006, 0.018, 0.014, brassMat);
  butterflyWing2.position.set(manifoldX - pipeLen - 0.046, totalH - 0.072, 0);

  tg.add(valve1, knob1, valve2, knob2, valveHit, tee, butterflyWing1, butterflyWing2);

  // 8. Mangueira Espiralada Preta Conectada ao Regulador no Topo do Botijão GLP P13
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(manifoldX - pipeLen - 0.04, totalH - 0.060, 0),
    new THREE.Vector3(manifoldX - pipeLen - 0.14, totalH - 0.12, -0.06),
    new THREE.Vector3(-0.36, 0.52, -0.18),
    new THREE.Vector3(-0.43, 0.465, -0.22)
  ]);
  const hoseMesh = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 20, 0.009, 8, false), hoseMat);
  tg.add(hoseMesh);

  // Botijão GLP P13 verde com colar, válvula e regulador
  const gasMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.40, metalness: 0.30 });
  const cylBody = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.34, 20), gasMat);
  cylBody.position.set(-0.46, 0.18, -0.22);

  const cylWeld = new THREE.Mesh(new THREE.TorusGeometry(0.167, 0.005, 6, 22), gasMat);
  cylWeld.rotation.x = Math.PI / 2;
  cylWeld.position.set(-0.46, 0.18, -0.22);

  const cylTop = new THREE.Mesh(new THREE.SphereGeometry(0.165, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), gasMat);
  cylTop.scale.set(1, 0.45, 1);
  cylTop.position.set(-0.46, 0.35, -0.22);

  const cylCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.088, 0.075, 16, 1, true), gasMat);
  cylCollar.position.set(-0.46, 0.43, -0.22);

  const cylValve = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.055, 10), brassMat);
  cylValve.position.set(-0.46, 0.445, -0.22);

  const cylReg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.022, 12), brassMat);
  cylReg.position.set(-0.46, 0.468, -0.22);

  const cylNipple = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.036, 8), brassMat);
  cylNipple.rotation.z = Math.PI / 2;
  cylNipple.position.set(-0.442, 0.465, -0.22);

  tg.add(cylBody, cylWeld, cylTop, cylCollar, cylValve, cylReg, cylNipple);

  // 9. Superfície Superior e Hitbox de Apoio para Panela
  const topHit = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR, drumR, 0.022, 20),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
  );
  topHit.position.y = totalH;
  tg.add(topHit);

  const bSurf = {
    minX: px - drumR,
    maxX: px + drumR,
    minZ: pz - drumR,
    maxZ: pz + drumR,
    topY: py + totalH
  };
  ctx.supportSurfaces.push(bSurf);
  topHit.userData.supportSurface = bSurf;
  drumMesh.userData.supportSurface = bSurf;
  ctx.supportMeshes.push(topHit, drumMesh);

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
    level: 0, // 0=DESLIGADO, 1=BAIXO (só interno), 2=MÉDIO (ambos médio), 3=ALTO (ambos máximo)
    heat: 0,
    innerFlamesGroup,
    outerFlamesGroup,
    flameLight,
    knob1,
    knob2,
    knobGroup: knob1,
    coilMat: flameCoreMat,
    reflectorMat: null,
    surface: bSurf
  };

  const bIdx = ctx.burnerDevices.length;
  valve1.userData.burnerSwitchIdx = bIdx;
  knob1.userData.burnerSwitchIdx = bIdx;
  valve2.userData.burnerSwitchIdx = bIdx;
  knob2.userData.burnerSwitchIdx = bIdx;
  valveHit.userData.burnerSwitchIdx = bIdx;

  // Apenas válvulas/registros controlam a chama; nunca o suporte/fundo sob a panela
  ctx.burnerSwitchMeshes.push(valve1, knob1, valve2, knob2, valveHit);
  ctx.burnerDevices.push(bState);

  return registerPickable(ctx, id, 'Tripé Fogareiro a Gás (GLP)', tg, px, py, pz, 0, 0.36, totalH, GAS_TRIPOD_META);
}
