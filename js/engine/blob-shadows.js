/**
 * Sombras de Contato Leves (Blob Shadows) via 1 InstancedMesh — para Mobile sem shadowMap
 * Desliga automaticamente (visible = false, custo zero) quando sombras reais estão ativas.
 */

import { getCachedCanvasTexture } from '../items/item-registry.js';

const THREE = (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || null;
const _Obj3D = THREE && THREE.Object3D ? THREE.Object3D : null;

const MAX_BLOB_SHADOWS = 36;
let _dummy = null;

function ensureDummy() {
  if (!_dummy && _Obj3D) _dummy = new _Obj3D();
  return _dummy;
}

export function createBlobShadows(scene) {
  if (!THREE || !scene || !THREE.InstancedMesh) return null;

  const tex = getCachedCanvasTexture('myco_blob_shadow_v1', 64, 64, (bctx) => {
    const grad = bctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0.0, 'rgba(15, 23, 42, 0.52)');
    grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.24)');
    grad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');
    bctx.fillStyle = grad;
    bctx.fillRect(0, 0, 64, 64);
  });

  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });
  mat.userData.shared = true;
  mat.userData.keepPbr = true;

  const inst = new THREE.InstancedMesh(geo, mat, MAX_BLOB_SHADOWS);
  inst.visible = false;
  inst.frustumCulled = false;
  inst.userData.isDynamic = true;
  inst.userData.keepDynamic = true;
  scene.add(inst);

  return { inst, count: 0 };
}

export function stepBlobShadows(ctrl, ctx, shadowsActive) {
  if (!ctrl || !ctrl.inst) return;
  if (shadowsActive || !ctx) {
    ctrl.inst.visible = false;
    return;
  }

  const dummy = ensureDummy();
  if (!dummy) return;

  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;
  let idx = 0;

  function pushBlob(x, y, z, size) {
    if (idx >= MAX_BLOB_SHADOWS) return;
    dummy.position.set(x, Math.max(0.03, y), z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(size, size, 1);
    dummy.updateMatrix();
    ctrl.inst.setMatrixAt(idx++, dummy.matrix);
  }

  if (ctx.pastureCows) {
    for (let i = 0; i < ctx.pastureCows.length && idx < MAX_BLOB_SHADOWS; i++) {
      const c = ctx.pastureCows[i];
      if (!c || !c.mesh || !c.mesh.visible) continue;
      const p = c.mesh.position;
      if ((p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz) < 2200) {
        pushBlob(p.x, p.y + 0.03, p.z, 2.0);
      }
    }
  }

  if (ctx.remoteAvatars && typeof ctx.remoteAvatars.forEach === 'function') {
    ctx.remoteAvatars.forEach((av) => {
      if (idx >= MAX_BLOB_SHADOWS || !av || !av.group || !av.group.visible) return;
      const p = av.group.position;
      if ((p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz) < 1600) {
        pushBlob(p.x, p.y + 0.03, p.z, 1.15);
      }
    });
  }

  if (ctx.wildMushrooms) {
    for (let i = 0; i < ctx.wildMushrooms.length && idx < MAX_BLOB_SHADOWS; i++) {
      const wm = ctx.wildMushrooms[i];
      if (!wm || !wm.active || !wm.group || !wm.group.visible) continue;
      const p = wm.group.position;
      if ((p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz) < 784) {
        pushBlob(p.x, p.y + 0.03, p.z, 0.9);
      }
    }
  }

  if (idx === 0) {
    ctrl.inst.visible = false;
    return;
  }
  ctrl.inst.visible = true;
  ctrl.inst.count = idx;
  ctrl.inst.instanceMatrix.needsUpdate = true;
}
