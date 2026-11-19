/**
 * Luneta Astronômica da Praça (MycoCampus3D)
 * Zoom óptico leve (altera apenas camera.fov sem custo extra de render) + curiosidades das constelações.
 */

import { FAMOUS_CONSTELLATIONS } from '../engine/sky-constellations.js';

const THREE = (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || null;

export const telescopeHitMeshes = [];

const SKY_FACTS = [
  '✦ Órion: suas Três Marias (Alnitak, Alnilam, Mintaka) alinham quase perfeitamente no equador celeste!',
  '✦ Betelgeuse em Órion é uma supergigante vermelha ~700x maior que o Sol!',
  '✦ Cruzeiro do Sul: aponta sempre para o Polo Sul Celeste — guia clássico do hemisfério sul.',
  '✦ Escorpião: Antares brilha em tom avermelhado como rival de Marte ("Anti-Ares").',
  '✦ Plêiades: aglomerado aberto das Sete Irmãs a cerca de 444 anos-luz da Terra!'
];

let factIdx = 0;

function syncTelescopeHudDom(active, isNight) {
  if (typeof document === 'undefined') return;
  let hud = document.getElementById('myco-telescope-hud');
  if (!active) {
    if (hud) hud.classList.add('hidden');
    return;
  }
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'myco-telescope-hud';
    hud.className = 'fixed inset-0 z-20 pointer-events-none flex flex-col justify-between items-center p-4';
    hud.innerHTML =
      '<div class="mt-12 px-4 py-2 rounded-2xl bg-slate-950/80 border border-cyan-400/50 text-cyan-200 text-xs font-bold shadow-xl backdrop-blur-sm text-center">' +
        '🔭 <span class="text-white">Luneta Astronômica MycoSky (Zoom 2.8x)</span> • ' +
        '<span id="myco-scope-sky-status">Olhe para o céu!</span><br>' +
        '<span id="myco-scope-const-list" class="text-[11px] text-sky-300 font-semibold"></span>' +
      '</div>' +
      '<div class="w-48 h-48 rounded-full border-2 border-cyan-400/35 shadow-[0_0_0_9999px_rgba(2,6,23,0.42)]"></div>' +
      '<div class="mb-14 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-700 text-[11px] text-slate-200 font-semibold">' +
        'Clique na luneta ou aperte [Esc] / [E] para sair do zoom' +
      '</div>';
    document.body.appendChild(hud);
  }
  const statusEl = hud.querySelector('#myco-scope-sky-status');
  const listEl = hud.querySelector('#myco-scope-const-list');
  if (statusEl) {
    statusEl.textContent = isNight
      ? '🌌 Céu noturno limpo — mire para cima!'
      : '☀️ Dica: clique no relógio do HUD para ir à Noite Estrelada!';
  }
  if (listEl) {
    listEl.textContent = 'Constelações no céu: ' + FAMOUS_CONSTELLATIONS.map((c) => c.name).join(' • ');
  }
  hud.classList.remove('hidden');
}

export function buildPlazaTelescope(ctx, px = 5.4, pz = 14.8) {
  telescopeHitMeshes.length = 0;
  if (!THREE || !ctx || !ctx.scene) return null;

  const group = new THREE.Group();
  group.position.set(px, 0.04, pz);

  const tripodMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.35 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.82, roughness: 0.25 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.55, roughness: 0.25 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.45, roughness: 0.1 });

  // 3 pernas do tripe
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 1.24, 8), tripodMat);
    leg.position.set(Math.cos(a) * 0.22, 0.56, Math.sin(a) * 0.22);
    leg.rotation.z = Math.cos(a) * 0.34;
    leg.rotation.x = -Math.sin(a) * 0.34;
    leg.castShadow = true;
    group.add(leg);
  }

  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.14, 12), brassMat);
  mount.position.y = 1.15;
  group.add(mount);

  const tubeWrap = new THREE.Group();
  tubeWrap.position.set(0, 1.24, 0);
  tubeWrap.rotation.x = 0.62;
  tubeWrap.rotation.y = -0.35;

  const mainTube = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.052, 0.92, 16), barrelMat);
  mainTube.rotation.x = Math.PI / 2;
  mainTube.castShadow = true;
  const frontCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.11, 16), brassMat);
  frontCollar.rotation.x = Math.PI / 2;
  frontCollar.position.z = 0.44;
  const objLens = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.02, 16), lensMat);
  objLens.rotation.x = Math.PI / 2;
  objLens.position.z = 0.50;
  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.030, 0.16, 12), tripodMat);
  eyepiece.rotation.x = Math.PI / 2;
  eyepiece.position.z = -0.50;

  tubeWrap.add(mainTube, frontCollar, objLens, eyepiece);
  group.add(tubeWrap);

  const hitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 1.55, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
  );
  hitMesh.position.y = 0.85;
  hitMesh.userData.isTelescope = true;
  group.add(hitMesh);

  ctx.scene.add(group);
  group.updateMatrixWorld(true);
  group.traverse((ch) => { ch.matrixAutoUpdate = false; });

  telescopeHitMeshes.push(hitMesh);
  if (ctx.solidColliders) {
    ctx.solidColliders.push({
      minX: px - 0.38, maxX: px + 0.38,
      minZ: pz - 0.38, maxZ: pz + 0.38,
      minY: 0, maxY: 1.55
    });
  }
  return group;
}

export function setTelescopeZoom(ctx, active) {
  if (!ctx || !ctx.camera) return false;
  ctx.telescopeZoomActive = !!active;
  const targetFov = active ? 26 : 72;
  if (ctx.camera.fov !== targetFov) {
    ctx.camera.fov = targetFov;
    ctx.camera.updateProjectionMatrix();
  }
  const isNight = !!(typeof window !== 'undefined' && window.getCampusClockInfo && window.getCampusClockInfo().isNight);
  syncTelescopeHudDom(active, isNight);
  if (active && ctx.callbacks && ctx.callbacks.onToast) {
    const fact = SKY_FACTS[factIdx % SKY_FACTS.length];
    factIdx++;
    ctx.callbacks.onToast(fact);
  }
  return ctx.telescopeZoomActive;
}
