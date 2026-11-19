/**
 * Detalhes Fofos & Vida Aconchegante do Campus (MycoCampus3D)
 * - Varal de luzinhas quentes (Fairy Lights) na Praça
 * - Borboletas coloridas de dia sobre a Praça e Horta
 * - Esporos luminosos suaves ao redor do Campus
 * - Explosões de corações/estrelinhas em interações fofas (carinho, colheita, gol/cesta)
 */

const THREE = (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || null;
const _Obj3D = THREE && THREE.Object3D ? THREE.Object3D : null;

const BUTTERFLY_BASES = [
  { x: 16.0, y: 1.35, z: 16.5, r: 2.8, sp: 0.95, ph: 0.0 },
  { x: 14.5, y: 1.55, z: 18.2, r: 2.2, sp: 1.15, ph: 1.4 },
  { x: 17.6, y: 1.25, z: 15.0, r: 2.5, sp: 0.85, ph: 2.7 },
  { x: 1.8, y: 1.60, z: 2.5, r: 3.4, sp: 0.90, ph: 3.9 },
  { x: -2.2, y: 1.45, z: 1.8, r: 3.0, sp: 1.05, ph: 5.1 },
  { x: 3.8, y: 1.40, z: 14.0, r: 2.4, sp: 1.10, ph: 0.8 },
  { x: -3.6, y: 1.50, z: 13.8, r: 2.6, sp: 0.88, ph: 2.2 },
  { x: 0.2, y: 1.65, z: 16.2, r: 3.1, sp: 1.02, ph: 4.3 }
];

const MAX_HEARTS = 16;
const SPORE_COUNT = 40;
let _dummy = null;
const activeBursts = [];

function ensureDummy() {
  if (!_dummy && _Obj3D) _dummy = new _Obj3D();
  return _dummy;
}

export function triggerCozyHeartBurst(x, y, z, hexColor = 0xf472b6) {
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return;
  for (let i = 0; i < 4; i++) {
    if (activeBursts.length >= MAX_HEARTS) activeBursts.shift();
    const ang = (i / 4) * Math.PI * 2 + Math.random() * 0.6;
    activeBursts.push({
      x: x + Math.cos(ang) * 0.18,
      y: y + 0.15,
      z: z + Math.sin(ang) * 0.18,
      vx: Math.cos(ang) * 0.45,
      vy: 1.15 + Math.random() * 0.45,
      vz: Math.sin(ang) * 0.45,
      life: 0,
      maxLife: 1.15,
      color: hexColor
    });
  }
}

function buildFairyString(scene, nightLampGlows, x1, z1, x2, z2, count, bulbInst, startIdx, dummy) {
  const cablePts = [];
  const baseY = 3.38;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const x = x1 + (x2 - x1) * t;
    const z = z1 + (z2 - z1) * t;
    const y = baseY - Math.sin(t * Math.PI) * 0.62;
    cablePts.push(new THREE.Vector3(x, y, z));
    if (i > 0 && i < count && bulbInst && dummy) {
      dummy.position.set(x, y - 0.05, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bulbInst.setMatrixAt(startIdx++, dummy.matrix);
    }
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(cablePts);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.65 });
  const wire = new THREE.Line(lineGeo, lineMat);
  wire.matrixAutoUpdate = false;
  wire.updateMatrix();
  scene.add(wire);
  return startIdx;
}

export function createCozyDetails(scene, nightLampGlows) {
  activeBursts.length = 0;
  if (!THREE || !scene || !THREE.InstancedMesh) return null;

  const dummy = ensureDummy();

  // 1. Varais de luzinhas aconchegantes ligando os postes da praça
  const bulbsPerString = 12;
  const bulbGeo = new THREE.SphereGeometry(0.068, 7, 6);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.15,
    roughness: 0.25
  });
  bulbMat.userData.keepPbr = true;
  bulbMat.userData.shared = true;
  bulbMat.userData.nightMaxEmissive = 1.65;
  if (Array.isArray(nightLampGlows)) nightLampGlows.push(bulbMat);

  const fairyBulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, (bulbsPerString - 1) * 2);
  fairyBulbs.userData.keepDynamic = true;
  let bIdx = buildFairyString(scene, nightLampGlows, -10.5, -10.5, -10.5, 12.0, bulbsPerString, fairyBulbs, 0, dummy);
  bIdx = buildFairyString(scene, nightLampGlows, 10.5, -10.5, 10.5, 12.0, bulbsPerString, fairyBulbs, bIdx, dummy);
  fairyBulbs.count = bIdx;
  fairyBulbs.instanceMatrix.needsUpdate = true;
  fairyBulbs.matrixAutoUpdate = false;
  fairyBulbs.updateMatrix();
  scene.add(fairyBulbs);

  // 2. Borboletas diurnas (1 único InstancedMesh, duas asas por instância usando Plane estilizado)
  const bflyGeo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    0, 0, 0, -0.14, 0.06, 0.08, -0.12, 0.05, -0.09,
    0, 0, 0, 0.12, 0.05, -0.09, 0.14, 0.06, 0.08
  ]);
  bflyGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  bflyGeo.computeVertexNormals();
  const bflyMat = new THREE.MeshBasicMaterial({ color: 0xfde047, side: THREE.DoubleSide });
  bflyMat.userData.shared = true;
  const butterflies = new THREE.InstancedMesh(bflyGeo, bflyMat, BUTTERFLY_BASES.length);
  butterflies.frustumCulled = false;
  butterflies.userData.isDynamic = true;
  butterflies.userData.keepDynamic = true;
  if (typeof butterflies.setColorAt === 'function' && THREE.Color) {
    const palette = [0xfef08a, 0xf9a8d4, 0x7dd3fc, 0xfdba74];
    const tmpCol = new THREE.Color();
    for (let i = 0; i < BUTTERFLY_BASES.length; i++) {
      tmpCol.setHex(palette[i % palette.length]);
      butterflies.setColorAt(i, tmpCol);
    }
    if (butterflies.instanceColor) butterflies.instanceColor.needsUpdate = true;
  }
  scene.add(butterflies);

  // 3. Esporos dourados/esmeralda flutuando suavemente (1 Points)
  const spArr = new Float32Array(SPORE_COUNT * 3);
  for (let i = 0; i < SPORE_COUNT; i++) {
    spArr[i * 3] = (Math.random() - 0.5) * 44;
    spArr[i * 3 + 1] = 0.6 + Math.random() * 3.8;
    spArr[i * 3 + 2] = (Math.random() - 0.5) * 44;
  }
  const spGeo = new THREE.BufferGeometry();
  const spAttr = new THREE.BufferAttribute(spArr, 3);
  spGeo.setAttribute('position', spAttr);
  const spMat = new THREE.PointsMaterial({
    color: 0xa7f3d0,
    size: 0.14,
    transparent: true,
    opacity: 0.52,
    depthWrite: false
  });
  spMat.userData.shared = true;
  const spores = new THREE.Points(spGeo, spMat);
  spores.frustumCulled = false;
  spores.userData.isDynamic = true;
  spores.userData.keepDynamic = true;
  scene.add(spores);

  // 4. Pool de estrelas/corações fofos de interação (Octahedron estilizado)
  const hGeo = new THREE.OctahedronGeometry(0.11, 0);
  const hMat = new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.92 });
  hMat.userData.shared = true;
  const hearts = new THREE.InstancedMesh(hGeo, hMat, MAX_HEARTS);
  hearts.visible = false;
  hearts.frustumCulled = false;
  hearts.userData.isDynamic = true;
  hearts.userData.keepDynamic = true;
  scene.add(hearts);

  return { fairyBulbs, butterflies, spores, spAttr, spMat, hearts };
}

export function stepCozyDetails(ctrl, dt, envTime, sunY, weatherMode, qualityTier) {
  if (!ctrl) return;
  const dummy = ensureDummy();
  if (!dummy) return;

  // Borboletas apenas de dia sem chuva e fora do tier min
  const showButterflies = qualityTier !== 'min' && sunY > 0.04 && weatherMode !== 'rain' && weatherMode !== 'snow';
  if (ctrl.butterflies) {
    ctrl.butterflies.visible = showButterflies;
    if (showButterflies) {
      for (let i = 0; i < BUTTERFLY_BASES.length; i++) {
        const b = BUTTERFLY_BASES[i];
        const t = envTime * b.sp + b.ph;
        const bx = b.x + Math.sin(t) * b.r;
        const bz = b.z + Math.sin(t * 2) * (b.r * 0.55);
        const by = b.y + Math.sin(t * 3.1) * 0.35;
        const flap = 0.65 + Math.abs(Math.sin(envTime * 11 + i * 2.1)) * 0.55;
        dummy.position.set(bx, by, bz);
        dummy.rotation.set(0, Math.atan2(Math.cos(t) * b.r, Math.cos(t * 2) * b.r * 1.1), 0);
        dummy.scale.set(1, flap, 1);
        dummy.updateMatrix();
        ctrl.butterflies.setMatrixAt(i, dummy.matrix);
      }
      ctrl.butterflies.instanceMatrix.needsUpdate = true;
    }
  }

  // Esporos mágicos suaves (pausa em min)
  if (ctrl.spores && ctrl.spAttr) {
    const showSpores = qualityTier !== 'min' && weatherMode !== 'rain';
    ctrl.spores.visible = showSpores;
    if (showSpores) {
      const arr = ctrl.spAttr.array;
      for (let i = 0; i < SPORE_COUNT; i++) {
        const idx = i * 3;
        arr[idx + 1] += dt * 0.22;
        arr[idx] += Math.sin(envTime * 0.7 + i) * dt * 0.14;
        if (arr[idx + 1] > 4.6) arr[idx + 1] = 0.45;
      }
      ctrl.spAttr.needsUpdate = true;
      ctrl.spMat.opacity = sunY < 0 ? 0.68 : 0.38;
    }
  }

  // Corações / estrelinhas fofas ao interagir
  if (ctrl.hearts) {
    if (activeBursts.length === 0) {
      ctrl.hearts.visible = false;
    } else {
      ctrl.hearts.visible = true;
      for (let i = activeBursts.length - 1; i >= 0; i--) {
        const p = activeBursts[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          activeBursts.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy *= 0.96;
      }
      for (let i = 0; i < activeBursts.length; i++) {
        const p = activeBursts[i];
        const frac = p.life / p.maxLife;
        const sc = Math.max(0.05, Math.sin(frac * Math.PI) * 1.15);
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(frac * 2.0, frac * 4.5, 0);
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        ctrl.hearts.setMatrixAt(i, dummy.matrix);
      }
      ctrl.hearts.count = activeBursts.length;
      ctrl.hearts.instanceMatrix.needsUpdate = true;
    }
  }
}
