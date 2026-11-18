import { getItemGroundHeight } from '../engine/physics.js';
import {
  PETRI_DISH_HEIGHT,
  PETRI_STACK_SPACING,
  PETRI_STACK_ALIGNMENT_RADIUS,
  PETRI_STACK_AIM_DISTANCE_SQ
} from '../items/petri-dish.js';
import {
  PP5_STACK_SPACING,
  PP5_STACK_ALIGNMENT_RADIUS,
  PP5_STACK_AIM_DISTANCE_SQ
} from '../items/pp5-cup.js';

function getStackConfig(item) {
  if (!item || !item.mesh) return null;
  if (item.mesh.userData.isPetri) {
    return {
      kind: 'petri',
      spacing: PETRI_STACK_SPACING,
      alignRadius: PETRI_STACK_ALIGNMENT_RADIUS,
      aimDistSq: PETRI_STACK_AIM_DISTANCE_SQ,
      halfHeight: PETRI_DISH_HEIGHT * 0.5,
      maxStack: 7
    };
  }
  if (item.spawnCtrl && item.spawnCtrl.isPP5) {
    return {
      kind: 'pp5',
      spacing: PP5_STACK_SPACING,
      alignRadius: PP5_STACK_ALIGNMENT_RADIUS,
      aimDistSq: PP5_STACK_AIM_DISTANCE_SQ,
      halfHeight: PP5_STACK_SPACING * 0.5,
      maxStack: 6
    };
  }
  return null;
}

var placementGhost = null;
var placementRing = null;
var placementDot = null;
var placementHoloWrap = null;
var placementHoloMats = [];
var placementGhostItemId = null;
var placementGhostHasLid = false;
var placementGhostLastValid = null;

var _cGhostGreenTint = new THREE.Color(0x22c55e);
var _cGhostGreenEmi  = new THREE.Color(0x10b981);
var _cGhostRedTint   = new THREE.Color(0xef4444);
var _cGhostRedEmi    = new THREE.Color(0xdc2626);

var _tmpPlacePt = new THREE.Vector3();
var _tmpBestPt = new THREE.Vector3();
var _tmpPlaceCenter = new THREE.Vector3();
var _vZero2 = new THREE.Vector2(0, 0);

var placementBlockedReason = '';
var lastGravityCheckAt = 0;
var hasFallingItems = true;

export function markItemsFalling() {
  hasFallingItems = true;
}

export function getPlacementGhost() {
  return placementGhost;
}

export function getPlacementBlockedReason() {
  return placementBlockedReason;
}

export function createPlacementGhost(scene) {
  placementGhost = new THREE.Group();
  placementRing = new THREE.Mesh(
    new THREE.RingGeometry(0.11, 0.142, 48),
    new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false })
  );
  placementRing.rotation.x = -Math.PI / 2;
  placementRing.position.y = 0.008;
  placementGhost.add(placementRing);

  placementDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.024, 24),
    new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
  );
  placementDot.rotation.x = -Math.PI / 2;
  placementDot.position.y = 0.009;
  placementGhost.add(placementDot);

  placementHoloWrap = new THREE.Group();
  placementGhost.add(placementHoloWrap);

  placementGhost.visible = false;
  scene.add(placementGhost);
  return placementGhost;
}

function prepareGhostCloneMesh(rootGroup, matList) {
  rootGroup.traverse(function (ch) {
    ch.userData.ignoreRay = true;
    ch.userData.supportSurface = null;
    ch.userData.dynamicSurface = null;
    ch.userData.burnerSwitchIdx = null;
    ch.userData.stirSwitch = null;
    ch.userData.hoodSwitch = null;
    ch.userData.scaleObj = null;
    ch.userData.isTable = false;
    ch.userData.isHood = false;
    ch.userData.isBurner = false;
    ch.userData.isStirrer = false;
    if (ch.isPoints) {
      ch.visible = false;
      return;
    }
    if (ch.isMesh && ch.material) {
      ch.castShadow = false;
      ch.receiveShadow = false;
      var cloneOneMat = function (origM) {
        var m = origM.clone();
        m.userData._baseColor = m.color ? m.color.clone() : new THREE.Color(0xffffff);
        m.transparent = true;
        var origOp = origM.transparent ? origM.opacity : 1.0;
        m.opacity = origM.transparent ? Math.max(0.38, origOp * 0.90) : 0.76;
        m.depthWrite = false;
        matList.push(m);
        return m;
      };
      if (Array.isArray(ch.material)) {
        ch.material = ch.material.map(cloneOneMat);
      } else {
        ch.material = cloneOneMat(ch.material);
      }
    }
  });
}

export function updatePlacementGhostVisual(item, isValid, rotY, elapsedTime) {
  if (!placementGhost || !item) return;
  var hasLid = !!(item.lidItem && item.lidItem.isAttached);
  if (placementGhostItemId !== item.id || placementGhostHasLid !== hasLid) {
    while (placementHoloWrap.children.length > 0) {
      placementHoloWrap.remove(placementHoloWrap.children[0]);
    }
    placementHoloMats = [];
    var clone = item.mesh.clone(true);
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.visible = true;
    prepareGhostCloneMesh(clone, placementHoloMats);
    placementHoloWrap.add(clone);

    if (hasLid && item.lidItem && item.lidItem.mesh) {
      var lidClone = item.lidItem.mesh.clone(true);
      lidClone.position.set(0, 0.36, 0);
      lidClone.rotation.set(0, 0, 0);
      lidClone.visible = true;
      prepareGhostCloneMesh(lidClone, placementHoloMats);
      placementHoloWrap.add(lidClone);
    }

    placementGhostItemId = item.id;
    placementGhostHasLid = hasLid;
    placementGhostLastValid = null;
  }
  var col = isValid ? 0x10b981 : 0xef4444;
  placementRing.material.color.setHex(col);
  placementDot.material.color.setHex(col);

  var tintCol = isValid ? _cGhostGreenTint : _cGhostRedTint;
  var emiCol = isValid ? _cGhostGreenEmi : _cGhostRedEmi;
  var tintRatio = isValid ? 0.74 : 0.82;
  var pulse = 0.52 + Math.sin(elapsedTime * 6.0) * 0.16;

  if (placementGhostLastValid !== isValid) {
    placementGhostLastValid = isValid;
    for (var i = 0; i < placementHoloMats.length; i++) {
      var m = placementHoloMats[i];
      if (m.color && m.userData._baseColor) {
        m.color.copy(m.userData._baseColor).lerp(tintCol, tintRatio);
      }
      if (m.emissive) {
        m.emissive.copy(emiCol);
      }
    }
  }

  for (var j = 0; j < placementHoloMats.length; j++) {
    if (placementHoloMats[j].emissive) {
      placementHoloMats[j].emissiveIntensity = pulse;
    }
  }

  placementHoloWrap.rotation.y = rotY;
  var ringPulse = 1 + Math.sin(elapsedTime * 6.0) * 0.06;
  placementRing.scale.set(ringPulse, ringPulse, 1);
}

export function findPlacementTarget(ctx, customNdc) {
  var heldItem = ctx.heldItem;
  var cookerPots = ctx.cookerPots;
  var pickableItems = ctx.pickableItems;
  var supportMeshes = ctx.supportMeshes;
  var supportSurfaces = ctx.supportSurfaces;
  var raycaster = ctx.raycaster;
  var camera = ctx.camera;
  var playerPos = ctx.playerPos;
  var physCtx = ctx.physCtx;

  ctx.setSnapClosePot(null);
  ctx.setSnapPetriStack(false);

  var rayNdc = customNdc || (ctx.inFps ? _vZero2 : ctx.pointerNdc);
  raycaster.setFromCamera(rayNdc, camera);
  var dir = raycaster.ray.direction;
  var origin = raycaster.ray.origin;
  var bestPt = null;
  var bestT = Infinity;

  // 0. Tampa de Panela -> Panela aberta
  if (heldItem && heldItem.potItem) {
    for (var cpi = 0; cpi < cookerPots.length; cpi++) {
      var cp = cookerPots[cpi];
      var targetPot = cp.potItem;
      if (targetPot.lidItem && targetPot.lidItem.isAttached && targetPot.lidItem !== heldItem) continue;
      _tmpPlaceCenter.set(targetPot.mesh.position.x, targetPot.mesh.position.y + 0.24, targetPot.mesh.position.z);
      var camDist = origin.distanceTo(_tmpPlaceCenter);
      var potHits = raycaster.intersectObject(targetPot.mesh, true);
      if ((potHits.length > 0 && potHits[0].distance < 4.5) || (camDist < 4.5 && raycaster.ray.distanceSqToPoint(_tmpPlaceCenter) < 0.25)) {
        ctx.setSnapClosePot(targetPot);
        ctx.setHeldRotY(targetPot.mesh.rotation.y);
        return _tmpPlacePt.set(targetPot.mesh.position.x, targetPot.mesh.position.y + 0.36, targetPot.mesh.position.z);
      }
    }
  }

  // 0b. Pilha de Placas de Petri (max 7) e Potinhos PP5 de Flocao (max 6)
  var stackCfg = getStackConfig(heldItem);
  if (stackCfg) {
    var stackBest = null;
    var stackDist = 4.2;
    for (var pi = 0; pi < pickableItems.length; pi++) {
      var cand = pickableItems[pi];
      if (!cand || cand === heldItem) continue;
      var candCfg = getStackConfig(cand);
      if (!candCfg || candCfg.kind !== stackCfg.kind) continue;
      if (ctx.isHeldByRemote(cand.id)) continue;
      var cpos = cand.mesh.position;
      _tmpPlaceCenter.set(cpos.x, cpos.y + stackCfg.halfHeight, cpos.z);
      var dCam = origin.distanceTo(_tmpPlaceCenter);
      if (dCam < stackDist && raycaster.ray.distanceSqToPoint(_tmpPlaceCenter) < stackCfg.aimDistSq) {
        stackDist = dCam;
        stackBest = cand;
      }
    }
    if (stackBest) {
      var bx = stackBest.mesh.position.x;
      var bz = stackBest.mesh.position.z;
      var stackCount = 0;
      var maxY = stackBest.mesh.position.y;
      for (var pj = 0; pj < pickableItems.length; pj++) {
        var pOther = pickableItems[pj];
        if (!pOther || pOther === heldItem) continue;
        var pOtherCfg = getStackConfig(pOther);
        if (!pOtherCfg || pOtherCfg.kind !== stackCfg.kind) continue;
        if (Math.hypot(pOther.mesh.position.x - bx, pOther.mesh.position.z - bz) < stackCfg.alignRadius) {
          stackCount++;
          if (pOther.mesh.position.y > maxY) maxY = pOther.mesh.position.y;
        }
      }
      if (stackCount < stackCfg.maxStack) {
        ctx.setSnapPetriStack(true);
        return _tmpPlacePt.set(bx, maxY + stackCfg.spacing, bz);
      }
    }
  }

  // 1. Raycast direto nas meshes de suporte
  if (supportMeshes.length) {
    for (var sm = 0; sm < supportMeshes.length; sm++) {
      if (supportMeshes[sm]) supportMeshes[sm].updateWorldMatrix(true, false);
    }
    var sHits = raycaster.intersectObjects(supportMeshes, false);
    for (var si = 0; si < sHits.length; si++) {
      var sh = sHits[si];
      if (sh.distance < 0.02 || sh.distance > 5.8) continue;
      if (sh.object.userData.ignoreRay) continue;
      var sSurf = sh.object.userData.supportSurface;
      if (!sSurf) continue;
      if (sSurf.isCabinetShelf && sSurf.requiresOpenPart && !sSurf.requiresOpenPart.open) continue;
      if (heldItem && heldItem.mesh) {
        if (heldItem.mesh.userData.dynamicSurface === sSurf) continue;
        if (heldItem.mesh === sh.object || heldItem.mesh.getObjectById(sh.object.id)) continue;
      }
      var cx = Math.max(sSurf.minX + 0.02, Math.min(sSurf.maxX - 0.02, sh.point.x));
      var cz = Math.max(sSurf.minZ + 0.02, Math.min(sSurf.maxZ - 0.02, sh.point.z));
      return _tmpPlacePt.set(cx, sSurf.topY, cz);
    }
  }

  // 1b. Interseção matemática com plano e volume de suportes
  for (var i = 0; i < supportSurfaces.length; i++) {
    var s = supportSurfaces[i];
    if (heldItem && heldItem.mesh && heldItem.mesh.userData.dynamicSurface === s) continue;
    if (s.isCabinetShelf && s.requiresOpenPart && !s.requiresOpenPart.open) continue;

    var dy = s.topY - origin.y;
    if (Math.abs(dir.y) > 0.001) {
      var tPlane = dy / dir.y;
      if (tPlane >= 0.05 && tPlane <= 5.8 && tPlane < bestT) {
        var hx = origin.x + dir.x * tPlane;
        var hz = origin.z + dir.z * tPlane;
        if (hx >= s.minX - 0.12 && hx <= s.maxX + 0.12 && hz >= s.minZ - 0.12 && hz <= s.maxZ + 0.12) {
          var scx = Math.max(s.minX + 0.02, Math.min(s.maxX - 0.02, hx));
          var scz = Math.max(s.minZ + 0.02, Math.min(s.maxZ - 0.02, hz));
          bestT = tPlane;
          bestPt = _tmpBestPt.set(scx, s.topY, scz);
        }
      }
    }

    var bMinX = s.minX - 0.05, bMaxX = s.maxX + 0.05;
    var bMinZ = s.minZ - 0.05, bMaxZ = s.maxZ + 0.05;
    var bMinY = Math.max(0.12, s.topY - 0.95), bMaxY = s.topY + 0.08;
    var invDx = 1 / (Math.abs(dir.x) > 1e-6 ? dir.x : 1e-6);
    var invDy = 1 / (Math.abs(dir.y) > 1e-6 ? dir.y : 1e-6);
    var invDz = 1 / (Math.abs(dir.z) > 1e-6 ? dir.z : 1e-6);
    var t1 = (bMinX - origin.x) * invDx, t2 = (bMaxX - origin.x) * invDx;
    var t3 = (bMinY - origin.y) * invDy, t4 = (bMaxY - origin.y) * invDy;
    var t5 = (bMinZ - origin.z) * invDz, t6 = (bMaxZ - origin.z) * invDz;
    var tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
    var tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
    if (tmax >= tmin && tmax >= 0.05 && tmin <= 5.5 && tmin < bestT) {
      var boxHitX = origin.x + dir.x * Math.max(0.05, tmin);
      var boxHitZ = origin.z + dir.z * Math.max(0.05, tmin);
      var bcx = Math.max(s.minX + 0.02, Math.min(s.maxX - 0.02, boxHitX));
      var bcz = Math.max(s.minZ + 0.02, Math.min(s.maxZ - 0.02, boxHitZ));
      bestT = tmin;
      bestPt = _tmpBestPt.set(bcx, s.topY, bcz);
    }
  }
  if (bestPt) return _tmpPlacePt.copy(bestPt);

  // 2. Piso / terreno
  for (var t = 0.45; t <= 5.0; t += 0.08) {
    var px = origin.x + dir.x * t;
    var py = origin.y + dir.y * t;
    var pz = origin.z + dir.z * t;
    var gh = getItemGroundHeight(physCtx, px, pz, py);
    if (py <= gh + 0.04) {
      return _tmpPlacePt.set(px, gh, pz);
    }
  }

  // 3. Fallback suave
  var hLen = Math.hypot(dir.x, dir.z) || 1;
  var fx = playerPos.x + (dir.x / hLen) * 1.8;
  var fz = playerPos.z + (dir.z / hLen) * 1.8;
  return _tmpPlacePt.set(fx, getItemGroundHeight(physCtx, fx, fz, playerPos.y), fz);
}

export function isPlacementBlocked(ctx, pt) {
  placementBlockedReason = '';
  var heldItem = ctx.heldItem;
  if (!heldItem || !heldItem.mesh) return false;
  if (ctx.snapClosePot || ctx.snapPetriStack) return false;

  var heldH = heldItem.height || (heldItem.mesh.userData.tableDims ? heldItem.mesh.userData.tableDims.h : 0.32);
  var heldMinY = pt.y;
  var heldMaxY = pt.y + heldH;

  if (ctx.supportSurfaces) {
    for (var csi = 0; csi < ctx.supportSurfaces.length; csi++) {
      var cs = ctx.supportSurfaces[csi];
      if (!cs.isCabinetShelf) continue;
      if (pt.x >= cs.minX - 0.05 && pt.x <= cs.maxX + 0.05 &&
          pt.z >= cs.minZ - 0.05 && pt.z <= cs.maxZ + 0.05 &&
          Math.abs(pt.y - cs.topY) < 0.12) {
        if (cs.requiresOpenPart && !cs.requiresOpenPart.open) {
          placementBlockedReason = '🚫 Abra a porta do armário para guardar itens dentro';
          return true;
        }
        var hUdCab = heldItem.mesh.userData;
        if (hUdCab.isTable || hUdCab.isHood || hUdCab.isCultureFridge || hUdCab.twoHanded || heldH > 0.35) {
          placementBlockedReason = '🚫 Objeto grande demais para guardar dentro do armário';
          return true;
        }
        break;
      }
    }
  }

  var heldIsBox = !!(heldItem.mesh.userData.tableDims);
  var heldHw = 0, heldHd = 0, heldRad = 0;
  if (heldIsBox) {
    var dims = heldItem.mesh.userData.tableDims;
    var cRot = Math.abs(Math.cos(ctx.heldRotY)), sRot = Math.abs(Math.sin(ctx.heldRotY));
    heldHw = (dims.w * cRot + dims.d * sRot) * 0.5;
    heldHd = (dims.w * sRot + dims.d * cRot) * 0.5;
    heldRad = Math.max(heldHw, heldHd);
  } else {
    heldRad = heldItem.radius || 0.16;
    heldHw = heldRad;
    heldHd = heldRad;
  }

  var pickableItems = ctx.pickableItems;
  for (var k = 0; k < pickableItems.length; k++) {
    var other = pickableItems[k];
    if (!other || !other.mesh) continue;
    if (other === heldItem) continue;
    if (heldItem.lidItem && other === heldItem.lidItem) continue;
    if (heldItem.potItem && other === heldItem.potItem) continue;
    if (other.isAttached && other.potItem) continue;
    if (heldItem.trayContents && heldItem.trayContents.some(function (tc) { return tc.item === other; })) continue;
    if (ctx.isHeldByRemote(other.id)) continue;

    var oPos = other.mesh.position;
    var otherH = other.height || (other.mesh.userData.tableDims ? other.mesh.userData.tableDims.h : 0.32);
    var otherMinY = oPos.y;
    var otherMaxY = oPos.y + otherH;

    if (other.mesh.userData.dynamicSurface) {
      var dynSurf = other.mesh.userData.dynamicSurface;
      var onDynSurfXZ = (
        pt.x >= dynSurf.minX - 0.02 && pt.x <= dynSurf.maxX + 0.02 &&
        pt.z >= dynSurf.minZ - 0.02 && pt.z <= dynSurf.maxZ + 0.02
      );
      if (onDynSurfXZ && pt.y >= dynSurf.topY - 0.04 && pt.y <= dynSurf.topY + 0.12) {
        if (other.mesh.userData.isTable && heldItem.mesh.userData.isTable) {
          placementBlockedReason = '🚫 Não é permitido sobrepor mesas';
          return true;
        }
        if (other.mesh.userData.isHood && heldItem.mesh.userData.isTable) {
          placementBlockedReason = '🚫 Não cabe aqui';
          return true;
        }
        if (other.mesh.userData.isScale || other.mesh.userData.isStirrer || other.mesh.userData.isBurner) {
          var hUd = heldItem.mesh.userData;
          if (hUd.isTable || hUd.isHood || hUd.isScale || hUd.isStirrer || hUd.isBurner) {
            placementBlockedReason = '🚫 Equipamento incompatível com esta superfície';
            return true;
          }
          if ((other.mesh.userData.isScale || other.mesh.userData.isStirrer) && hUd.twoHanded) {
            placementBlockedReason = '🚫 Objeto grande demais para este aparelho';
            return true;
          }
        }
        continue;
      }
    }

    if (other.fridgeCtrl) {
      var fShelves = other.fridgeCtrl.shelfSurfaces;
      var onFridgeShelf = false;
      if (fShelves) {
        for (var sfi = 0; sfi < fShelves.length; sfi++) {
          var fs = fShelves[sfi];
          if (pt.x >= fs.minX - 0.05 && pt.x <= fs.maxX + 0.05 &&
              pt.z >= fs.minZ - 0.05 && pt.z <= fs.maxZ + 0.05 &&
              Math.abs(pt.y - fs.topY) < 0.10) {
            onFridgeShelf = true;
            break;
          }
        }
      }
      if (onFridgeShelf) {
        if (!other.fridgeCtrl.doorOpen) {
          placementBlockedReason = '🚫 Abra a porta da geladeira para colocar itens dentro';
          return true;
        }
        var hUdFridge = heldItem.mesh.userData;
        if (hUdFridge.isTable || hUdFridge.isHood || hUdFridge.isCultureFridge || (heldItem.height && heldItem.height > 0.40)) {
          placementBlockedReason = '🚫 Objeto grande demais para a prateleira da geladeira';
          return true;
        }
        continue;
      }
    }

    if (heldMinY >= otherMaxY - 0.02 || heldMaxY <= otherMinY + 0.02) {
      continue;
    }

    if (!heldIsBox && !other.mesh.userData.tableDims) {
      var oRad = other.radius || 0.16;
      var minDist = (heldRad + oRad) * 0.94;
      var dx = pt.x - oPos.x;
      var dz = pt.z - oPos.z;
      if (dx * dx + dz * dz < minDist * minDist) {
        placementBlockedReason = '🚫 Espaço ocupado por outro objeto';
        return true;
      }
    } else {
      var oHw, oHd;
      if (other.mesh.userData.tableDims) {
        var od = other.mesh.userData.tableDims;
        var oc = Math.abs(Math.cos(other.mesh.rotation.y)), os = Math.abs(Math.sin(other.mesh.rotation.y));
        oHw = (od.w * oc + od.d * os) * 0.5;
        oHd = (od.w * os + od.d * oc) * 0.5;
      } else {
        var oR = other.radius || 0.16;
        oHw = oR * 0.90;
        oHd = oR * 0.90;
      }
      var cW = (heldHw + oHw) * 0.93;
      var cD = (heldHd + oHd) * 0.93;
      if (Math.abs(pt.x - oPos.x) < cW && Math.abs(pt.z - oPos.z) < cD) {
        placementBlockedReason = '🚫 Espaço ocupado por outro objeto';
        return true;
      }
    }
  }

  if (pt.y > 3.2) return false;
  var wallSegments = ctx.wallSegments;
  for (var wIdx = 0; wIdx < wallSegments.length; wIdx++) {
    var w = wallSegments[wIdx];
    var vx = w.x2 - w.x1, vz = w.z2 - w.z1;
    var len2 = vx * vx + vz * vz;
    var t = Math.max(0, Math.min(1, ((pt.x - w.x1) * vx + (pt.z - w.z1) * vz) / len2));
    var dist = Math.hypot(pt.x - (w.x1 + t * vx), pt.z - (w.z1 + t * vz));
    var effectiveHalf = heldIsBox ? Math.min(heldHw, heldHd) : heldRad;
    var minWallDist = Math.max(0.16, effectiveHalf * 0.78 + 0.08);
    if (dist < minWallDist) {
      placementBlockedReason = '🚫 Muito próximo da parede';
      return true;
    }
  }

  return false;
}

export function dropUnsupportedItems(ctx) {
  var now = performance.now();
  if (!hasFallingItems && now - lastGravityCheckAt < 180) return;
  lastGravityCheckAt = now;
  var anyFalling = false;
  var pickableItems = ctx.pickableItems;
  var cookerPots = ctx.cookerPots;
  var supportSurfaces = ctx.supportSurfaces;
  var recentlyDropped = ctx.recentlyDropped;
  var pendingMovedItems = ctx.pendingMovedItems;
  var heldItem = ctx.heldItem;
  var physCtx = ctx.physCtx;

  pickableItems.forEach(function (item) {
    if (item.potItem && item.isAttached) {
      var pot = item.potItem;
      item.mesh.position.set(pot.mesh.position.x, pot.mesh.position.y + 0.36, pot.mesh.position.z);
      item.mesh.rotation.copy(pot.mesh.rotation);
      return;
    }
    if (heldItem === item || ctx.isHeldByRemote(item.id)) {
      item.movedAt = now;
      ctx.removeFromCookerContents(item);
      return;
    }
    for (var cpi = 0; cpi < cookerPots.length; cpi++) {
      var cpRef = cookerPots[cpi];
      var slotIdx = cpRef.contents.indexOf(item);
      if (slotIdx !== -1) {
        var potP = cpRef.potItem.mesh.position;
        if (item.mesh && item.mesh.userData.isCookerBase) {
          item.mesh.position.set(potP.x, potP.y + 0.036, potP.z);
        } else {
          var nonBaseIdx = 0;
          for (var ci = 0; ci < slotIdx; ci++) {
            var prev = cpRef.contents[ci];
            if (prev && (!prev.mesh || !prev.mesh.userData.isCookerBase)) nonBaseIdx++;
          }
          var ox = (nonBaseIdx % 2 === 0 ? -0.065 : 0.065);
          var oz = (nonBaseIdx < 2 ? -0.055 : 0.055);
          item.mesh.position.set(potP.x + ox, potP.y + 0.080, potP.z + oz);
        }
        return;
      }
    }
    if (item.mesh.position.y < -5) {
      item.mesh.position.copy(item.homePos);
      item.mesh.rotation.y = item.homeRy;
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      recentlyDropped[item.id] = now + 1500;
      pendingMovedItems[item.id] = {
        id: item.id, x: item.homePos.x, y: item.homePos.y, z: item.homePos.z, ry: item.homeRy
      };
      return;
    }
    var ignoreTargetSurf = item.fridgeCtrl ? 'fridge' : item.mesh.userData.dynamicSurface;
    var supportedY = getItemGroundHeight(physCtx, item.mesh.position.x, item.mesh.position.z, item.mesh.position.y, ignoreTargetSurf, item.mesh.position.y + 0.04);
    if (!item.mesh.userData.isTable) {
      for (var i = 0; i < supportSurfaces.length; i++) {
        var s = supportSurfaces[i];
        if (s === item.mesh.userData.dynamicSurface) continue;
        if (item.fridgeCtrl && s.isCultureFridgeShelf) continue;
        if (item.mesh.userData.isHood && s.isHood) continue;
        if (item.mesh.position.x >= s.minX - 0.09 && item.mesh.position.x <= s.maxX + 0.09 &&
          item.mesh.position.z >= s.minZ - 0.09 && item.mesh.position.z <= s.maxZ + 0.09 &&
          item.mesh.position.y >= s.topY - 0.04) {
          supportedY = Math.max(supportedY, s.topY);
        }
      }
      var itemStackCfg = getStackConfig(item);
      if (itemStackCfg) {
        var myIdx = pickableItems.indexOf(item);
        for (var pj = 0; pj < pickableItems.length; pj++) {
          var pBase = pickableItems[pj];
          if (!pBase || pBase === item || pBase === heldItem || ctx.isHeldByRemote(pBase.id)) continue;
          var baseStackCfg = getStackConfig(pBase);
          if (!baseStackCfg || baseStackCfg.kind !== itemStackCfg.kind) continue;
          if (Math.hypot(pBase.mesh.position.x - item.mesh.position.x, pBase.mesh.position.z - item.mesh.position.z) < itemStackCfg.alignRadius) {
            var dyStack = item.mesh.position.y - pBase.mesh.position.y;
            if (dyStack > 0.008 || (Math.abs(dyStack) <= 0.008 && myIdx > pj)) {
              supportedY = Math.max(supportedY, pBase.mesh.position.y + itemStackCfg.spacing);
            }
          }
        }
      }
    }
    if (item.mesh.position.y < supportedY - 0.005 && !item.mesh.userData.isTable && !item.mesh.userData.isHood) {
      item.mesh.position.y = supportedY;
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
    } else if (item.mesh.position.y > supportedY + 0.015) {
      anyFalling = true;
      recentlyDropped[item.id] = now + 1500;
      item.mesh.position.y = Math.max(supportedY, item.mesh.position.y - 0.18);
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      if (item.lidItem && item.lidItem.isAttached) {
        var attLid = item.lidItem;
        attLid.mesh.position.set(item.mesh.position.x, item.mesh.position.y + 0.36, item.mesh.position.z);
        recentlyDropped[attLid.id] = now + 1500;
      }
      if (Math.abs(item.mesh.position.y - supportedY) < 0.005) {
        item.mesh.position.y = supportedY;
        item.isMoved = true;
        pendingMovedItems[item.id] = {
          id: item.id,
          x: item.mesh.position.x,
          y: item.mesh.position.y,
          z: item.mesh.position.z,
          ry: item.mesh.rotation.y
        };
        if (item.lidItem && item.lidItem.isAttached) {
          var lid = item.lidItem;
          pendingMovedItems[lid.id] = {
            id: lid.id,
            x: lid.mesh.position.x,
            y: lid.mesh.position.y,
            z: lid.mesh.position.z,
            ry: lid.mesh.rotation.y
          };
        }
      }
    }
  });
  hasFallingItems = anyFalling;
}
