import { makeBox, makeTextSprite, updateTextSprite } from '../engine/textures.js';
import { disposeObjectResources } from '../items/item-registry.js';
import { updateSpawnVisual } from '../items/spawn-containers.js';

export var greenhouseSlots = [
  {
    id: 0,
    name: 'Shimeji Dourado',
    sci: 'Pleurotus citrinopileatus',
    x: 21.0, y: 0.86, z: 6.65,
    stage: 1,
    humidity: 82,
    growth: 20,
    color: 0xfacc15,
    group: null,
    mushGroup: null,
    badgeSprite: null
  },
  {
    id: 1,
    name: 'Shiitake',
    sci: 'Lentinula edodes',
    x: 21.0, y: 0.86, z: 7.55,
    stage: 2,
    humidity: 78,
    growth: 50,
    color: 0x78350f,
    group: null,
    mushGroup: null,
    badgeSprite: null
  },
  {
    id: 2,
    name: 'Juba de Leão',
    sci: 'Hericium erinaceus',
    x: 21.0, y: 0.86, z: 8.45,
    stage: 0,
    humidity: 88,
    growth: 10,
    color: 0xf8fafc,
    group: null,
    mushGroup: null,
    badgeSprite: null
  },
  {
    id: 3,
    name: 'Golden Teacher',
    sci: 'Psilocybe cubensis',
    x: 21.0, y: 0.86, z: 9.35,
    stage: 3,
    humidity: 92,
    growth: 100,
    color: 0xd97706,
    group: null,
    mushGroup: null,
    badgeSprite: null
  }
];

export var greenhouseHitMeshes = [];
var MAX_GH_PARTICLES = 30;
var sporeParticles = [];
var waterSprayParticles = [];
var sporePoints = null;
var waterPoints = null;
var sporePosAttr = null;
var waterPosAttr = null;
var ghShared = null;

function getSharedGreenhouseAssets() {
  if (ghShared) return ghShared;
  const THREE = window.THREE;
  ghShared = {
    fuzzGeo: new THREE.SphereGeometry(0.04, 6, 6),
    pinStemGeo: new THREE.CylinderGeometry(0.012, 0.016, 0.05, 6),
    pinCapGeo: new THREE.SphereGeometry(0.022, 6, 6),
    medStemGeo: new THREE.CylinderGeometry(0.024, 0.032, 0.12, 8),
    medCapGeo: new THREE.SphereGeometry(0.055, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
    shimejiStemGeo: new THREE.CylinderGeometry(0.016, 0.026, 0.20, 8),
    shimejiCapGeo: new THREE.SphereGeometry(0.065, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    shiitakeStemGeo: new THREE.CylinderGeometry(0.03, 0.04, 0.18, 8),
    shiitakeCapGeo: new THREE.CylinderGeometry(0.09, 0.08, 0.04, 12),
    lionStemGeo: new THREE.CylinderGeometry(0.04, 0.05, 0.12, 8),
    lionBallGeo: new THREE.SphereGeometry(0.12, 12, 10),
    gtStemGeo: new THREE.CylinderGeometry(0.022, 0.032, 0.26, 8),
    gtVeilGeo: new THREE.RingGeometry(0.022, 0.045, 10),
    gtCapGeo: new THREE.ConeGeometry(0.08, 0.09, 12),
    fuzzMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.95 }),
    pinStemMat: new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.8 }),
    medStemMat: new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.7 }),
    matureStemMat: new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.65 }),
    lionMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    gtVeilMat: new THREE.MeshBasicMaterial({ color: 0x1e1b4b, side: THREE.DoubleSide }),
    capMatsByKey: new Map()
  };
  Object.keys(ghShared).forEach((k) => {
    const val = ghShared[k];
    if (val && val.userData) val.userData.shared = true;
  });
  return ghShared;
}

function getGreenhouseCapMat(col, roughness, emissiveHex, emissiveInt) {
  const assets = getSharedGreenhouseAssets();
  const key = `${col}|${roughness}|${emissiveHex || 0}|${emissiveInt || 0}`;
  let m = assets.capMatsByKey.get(key);
  if (!m) {
    m = new window.THREE.MeshStandardMaterial({
      color: col,
      roughness: roughness,
      emissive: emissiveHex || 0x000000,
      emissiveIntensity: emissiveInt || 0
    });
    m.userData.shared = true;
    assets.capMatsByKey.set(key, m);
  }
  return m;
}

export function initGreenhouseParticlePools(scene) {
  const THREE = window.THREE;
  sporeParticles.length = 0;
  waterSprayParticles.length = 0;

  const sArr = new Float32Array(MAX_GH_PARTICLES * 3);
  const sGeo = new THREE.BufferGeometry();
  sporePosAttr = new THREE.BufferAttribute(sArr, 3);
  sGeo.setAttribute('position', sporePosAttr);
  sporePoints = new THREE.Points(sGeo, new THREE.PointsMaterial({
    color: 0xfef08a,
    size: 0.06,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  }));
  sporePoints.visible = false;
  sporePoints.frustumCulled = false;
  sporePoints.userData.isDynamic = true;
  scene.add(sporePoints);

  const wArr = new Float32Array(MAX_GH_PARTICLES * 3);
  const wGeo = new THREE.BufferGeometry();
  waterPosAttr = new THREE.BufferAttribute(wArr, 3);
  wGeo.setAttribute('position', waterPosAttr);
  waterPoints = new THREE.Points(wGeo, new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: 0.05,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  }));
  waterPoints.visible = false;
  waterPoints.frustumCulled = false;
  waterPoints.userData.isDynamic = true;
  scene.add(waterPoints);

  for (let i = 0; i < MAX_GH_PARTICLES; i++) {
    sArr[i * 3 + 1] = -999;
    wArr[i * 3 + 1] = -999;
    sporeParticles.push({ active: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 2.0 });
    waterSprayParticles.push({ active: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1.2 });
  }
}

export function triggerSporeBurst(ox, oy, oz, col) {
  if (!sporePoints || !sporePosAttr) return;
  if (col && sporePoints.material && sporePoints.material.color) {
    sporePoints.material.color.setHex(col);
  }
  const arr = sporePosAttr.array;
  for (let i = 0; i < sporeParticles.length; i++) {
    const sp = sporeParticles[i];
    sp.x = ox + (Math.random() - 0.5) * 0.25;
    sp.y = oy;
    sp.z = oz + (Math.random() - 0.5) * 0.25;
    sp.vx = (Math.random() - 0.5) * 1.5;
    sp.vy = Math.random() * 1.8 + 0.5;
    sp.vz = (Math.random() - 0.5) * 1.5;
    sp.life = 0;
    sp.maxLife = 1.5 + Math.random() * 0.8;
    sp.active = true;
    arr[i * 3] = sp.x;
    arr[i * 3 + 1] = sp.y;
    arr[i * 3 + 2] = sp.z;
  }
  sporePosAttr.needsUpdate = true;
  sporePoints.visible = true;
}

export function triggerWaterSprayFx(ox, oy, oz) {
  if (!waterPoints || !waterPosAttr) return;
  const arr = waterPosAttr.array;
  for (let i = 0; i < waterSprayParticles.length; i++) {
    const wp = waterSprayParticles[i];
    wp.x = ox + (Math.random() - 0.5) * 0.35;
    wp.y = oy + 0.65;
    wp.z = oz + (Math.random() - 0.5) * 0.35;
    wp.vx = (Math.random() - 0.5) * 0.4;
    wp.vy = -(Math.random() * 1.5 + 1.2);
    wp.vz = (Math.random() - 0.5) * 0.4;
    wp.life = 0;
    wp.maxLife = 0.8 + Math.random() * 0.4;
    wp.active = true;
    arr[i * 3] = wp.x;
    arr[i * 3 + 1] = wp.y;
    arr[i * 3 + 2] = wp.z;
  }
  waterPosAttr.needsUpdate = true;
  waterPoints.visible = true;
}

export function stepGreenhouseParticles(dt) {
  if (sporePoints && sporePoints.visible && sporePosAttr) {
    const sArr = sporePosAttr.array;
    let anySpore = false;
    let avgOp = 0;
    let activeCount = 0;
    for (let i = 0; i < sporeParticles.length; i++) {
      const sp = sporeParticles[i];
      if (!sp.active) {
        sArr[i * 3 + 1] = -999;
        continue;
      }
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        sArr[i * 3 + 1] = -999;
        continue;
      }
      anySpore = true;
      activeCount++;
      avgOp += Math.max(0, 1 - sp.life / sp.maxLife);
      sp.vy -= 0.6 * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.z += sp.vz * dt;
      sArr[i * 3] = sp.x;
      sArr[i * 3 + 1] = sp.y;
      sArr[i * 3 + 2] = sp.z;
    }
    sporePosAttr.needsUpdate = true;
    sporePoints.material.opacity = activeCount > 0 ? (avgOp / activeCount) * 0.85 : 0;
    if (!anySpore) sporePoints.visible = false;
  }

  if (waterPoints && waterPoints.visible && waterPosAttr) {
    const wArr = waterPosAttr.array;
    let anyWater = false;
    for (let j = 0; j < waterSprayParticles.length; j++) {
      const wp = waterSprayParticles[j];
      if (!wp.active) {
        wArr[j * 3 + 1] = -999;
        continue;
      }
      wp.life += dt;
      if (wp.life >= wp.maxLife) {
        wp.active = false;
        wArr[j * 3 + 1] = -999;
        continue;
      }
      anyWater = true;
      wp.x += wp.vx * dt;
      wp.y += wp.vy * dt;
      wp.z += wp.vz * dt;
      wArr[j * 3] = wp.x;
      wArr[j * 3 + 1] = wp.y;
      wArr[j * 3 + 2] = wp.z;
    }
    waterPosAttr.needsUpdate = true;
    if (!anyWater) waterPoints.visible = false;
  }
}

export function updateGreenhouseSlotMesh(slot) {
  if (!slot.mushGroup) return;
  disposeObjectResources(slot.mushGroup);
  while (slot.mushGroup.children.length > 0) {
    slot.mushGroup.remove(slot.mushGroup.children[0]);
  }

  const THREE = window.THREE;
  const assets = getSharedGreenhouseAssets();
  const stage = slot.stage;
  const col = slot.color;

  if (stage === 0) {
    for (let fz = -2; fz <= 2; fz++) {
      const dot = new THREE.Mesh(assets.fuzzGeo, assets.fuzzMat);
      dot.scale.set(1.4, 0.35, 1.2);
      dot.position.set(fz * 0.05, 0.14, (fz % 2) * 0.04);
      slot.mushGroup.add(dot);
    }
  } else if (stage === 1) {
    const pinMat = getGreenhouseCapMat(col, 0.5, 0, 0);
    for (let p = -2; p <= 2; p++) {
      const pStem = new THREE.Mesh(assets.pinStemGeo, assets.pinStemMat);
      pStem.position.set(p * 0.05, 0.15, ((p * 3) % 4) * 0.025);
      const pCap = new THREE.Mesh(assets.pinCapGeo, pinMat);
      pCap.position.set(p * 0.05, 0.18, ((p * 3) % 4) * 0.025);
      slot.mushGroup.add(pStem, pCap);
    }
  } else if (stage === 2) {
    const medMat = getGreenhouseCapMat(col, 0.45, 0, 0);
    for (let m = -1; m <= 1; m++) {
      const mStem = new THREE.Mesh(assets.medStemGeo, assets.medStemMat);
      mStem.position.set(m * 0.08, 0.18, (m % 2) * 0.03);
      const mCap = new THREE.Mesh(assets.medCapGeo, medMat);
      mCap.position.set(m * 0.08, 0.24, (m % 2) * 0.03);
      slot.mushGroup.add(mStem, mCap);
    }
  } else {
    const matureMat = getGreenhouseCapMat(col, 0.38, slot.id === 3 ? 0xf59e0b : 0x000000, slot.id === 3 ? 0.35 : 0);

    if (slot.id === 0) {
      for (let sb = -2; sb <= 2; sb++) {
        const sStem = new THREE.Mesh(assets.shimejiStemGeo, assets.matureStemMat);
        sStem.position.set(sb * 0.055, 0.22, ((sb * 2) % 3) * 0.035);
        sStem.rotation.z = sb * 0.12;
        const sCap = new THREE.Mesh(assets.shimejiCapGeo, matureMat);
        sCap.position.set(sb * 0.07, 0.32, ((sb * 2) % 3) * 0.035);
        slot.mushGroup.add(sStem, sCap);
      }
    } else if (slot.id === 1) {
      for (let sh = -1; sh <= 1; sh++) {
        const shStem = new THREE.Mesh(assets.shiitakeStemGeo, assets.matureStemMat);
        shStem.position.set(sh * 0.10, 0.21, 0);
        const shCap = new THREE.Mesh(assets.shiitakeCapGeo, matureMat);
        shCap.position.set(sh * 0.10, 0.30, 0);
        slot.mushGroup.add(shStem, shCap);
      }
    } else if (slot.id === 2) {
      const jStem = new THREE.Mesh(assets.lionStemGeo, assets.matureStemMat);
      jStem.position.set(0, 0.18, 0);
      const lionBall = new THREE.Mesh(assets.lionBallGeo, assets.lionMat);
      lionBall.position.set(0, 0.28, 0);
      lionBall.scale.set(1.2, 0.9, 1.1);
      slot.mushGroup.add(jStem, lionBall);
    } else {
      for (let gt = -1; gt <= 1; gt++) {
        const gtStem = new THREE.Mesh(assets.gtStemGeo, assets.matureStemMat);
        gtStem.position.set(gt * 0.085, 0.25, gt * 0.03);
        const gtVeil = new THREE.Mesh(assets.gtVeilGeo, assets.gtVeilMat);
        gtVeil.rotation.x = Math.PI / 2;
        gtVeil.position.set(gt * 0.085, 0.30, gt * 0.03);
        const gtCap = new THREE.Mesh(assets.gtCapGeo, matureMat);
        gtCap.position.set(gt * 0.085, 0.38, gt * 0.03);
        slot.mushGroup.add(gtStem, gtVeil, gtCap);
      }
    }
  }

  if (slot.badgeSprite) {
    const sNames = ['Micélio', 'Primórdios', 'Crescendo', '✨ MADURO!'];
    const sColors = ['#94a3b8', '#38bdf8', '#fbbf24', '#34d399'];
    const infoText = slot.name + ' • ' + Math.round(slot.humidity) + '% UR\n' + sNames[slot.stage];
    updateTextSprite(slot.badgeSprite, infoText, sColors[slot.stage]);
  }
}

export function buildGreenhouseBench(scene) {
  greenhouseHitMeshes.length = 0;
  greenhouseSlots.forEach(function (slot) {
    var g = new THREE.Group();
    g.position.set(slot.x, slot.y, slot.z);

    var blockMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    var blockMesh = makeBox(0.36, 0.18, 0.28, blockMat);
    blockMesh.position.y = 0.09;
    blockMesh.castShadow = true;
    blockMesh.userData.greenhouseSlot = slot;
    g.add(blockMesh);
    greenhouseHitMeshes.push(blockMesh);

    var ledColor = slot.humidity >= 70 ? 0x10b981 : (slot.humidity >= 45 ? 0xf59e0b : 0xef4444);
    var ledStrip = makeBox(0.32, 0.02, 0.02, ledColor, { emissive: ledColor, emissiveIntensity: 0.8 });
    ledStrip.position.set(0, 0.02, 0.145);
    g.add(ledStrip);

    var mg = new THREE.Group();
    g.add(mg);
    slot.group = g;
    slot.mushGroup = mg;

    var badge = makeTextSprite(slot.name, '#34d399');
    badge.position.set(0, 0.54, 0);
    badge.scale.set(1.2, 0.30, 1);
    g.add(badge);
    slot.badgeSprite = badge;

    updateGreenhouseSlotMesh(slot);
    scene.add(g);
  });
}

export function interactGreenhouseSlot(slot, ctx) {
  var heldItem = ctx.heldItem;
  var callbacks = ctx.callbacks;
  var queueWorldStateChange = ctx.queueWorldStateChange;
  var isHoldingSpray = heldItem && (heldItem.id.indexOf('alcohol_spray') !== -1 || heldItem.id.indexOf('spray') !== -1);
  var isHoldingColonizedBag = !!(heldItem && heldItem.spawnCtrl && heldItem.spawnCtrl.isBag && heldItem.spawnCtrl.colonized && !heldItem.spawnCtrl.contaminated);

  if (isHoldingColonizedBag) {
    if (slot.stage === 0) {
      var sp = heldItem.spawnCtrl;
      sp.filled = false;
      sp.fillGrams = 0;
      sp.waterMl = 0;
      sp.substrateKind = '';
      sp.sterilized = false;
      sp.sterilizeProgress = 0;
      sp.sealed = false;
      sp.inoculated = false;
      sp.colonized = false;
      sp.colonization = 0;
      sp.contaminated = false;
      sp.burned = false;
      sp.expired = false;
      sp.ageGameDays = 0;
      updateSpawnVisual(heldItem);
      heldItem.mesh.position.copy(heldItem.homePos);
      heldItem.mesh.rotation.set(0, heldItem.homeRy || 0, 0);
      heldItem.isMoved = false;
      if (heldItem.mesh.userData.updateBounds) heldItem.mesh.userData.updateBounds(heldItem);
      if (ctx.pendingMovedItems) {
        ctx.pendingMovedItems[heldItem.id] = {
          id: heldItem.id, x: heldItem.homePos.x, y: heldItem.homePos.y, z: heldItem.homePos.z, ry: heldItem.homeRy || 0
        };
      }
      ctx.heldItem = null;
      if (ctx.placementGhost) ctx.placementGhost.visible = false;
      if (callbacks.onHoldChange) callbacks.onHoldChange(null);

      slot.stage = 1;
      slot.growth = 25;
      if (sp.speciesName) slot.speciesName = sp.speciesName;
      slot.humidity = Math.max(85, slot.humidity);
      if (window.MycoAudio) window.MycoAudio.playHarvest();
      triggerSporeBurst(slot.x, slot.y + 0.25, slot.z, slot.color);
      updateGreenhouseSlotMesh(slot);
      queueWorldStateChange('greenhouse_slot_' + slot.id + '_stage', 1);
      queueWorldStateChange('greenhouse_slot_' + slot.id + '_humidity', Math.round(slot.humidity));
      if (callbacks.onLabStep) callbacks.onLabStep('greenhouse_care');
      if (callbacks.onToast) {
        callbacks.onToast('🍄 Spawn Colonizado transferido para ' + slot.name + '! Primórdios iniciados na estufa!');
      }
      if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    } else {
      if (window.MycoAudio) window.MycoAudio.playClick();
      if (callbacks.onToast) {
        callbacks.onToast('🌱 ' + slot.name + ' já possui micélio ativo em frutificação!');
      }
    }
    return;
  }

  if (slot.stage === 3) {
    if (window.MycoAudio) window.MycoAudio.playHarvest();
    triggerSporeBurst(slot.x, slot.y + 0.35, slot.z, slot.color);
    if (callbacks.onHarvestGreenhouse) {
      callbacks.onHarvestGreenhouse(slot);
    }
    slot.stage = 0;
    slot.growth = 0;
    slot.humidity = 70;
    updateGreenhouseSlotMesh(slot);
    queueWorldStateChange('greenhouse_slot_' + slot.id + '_stage', 0);
    queueWorldStateChange('greenhouse_slot_' + slot.id + '_humidity', 70);
    if (callbacks.onLabStep) callbacks.onLabStep('greenhouse_care');
    return;
  }

  if (isHoldingSpray) {
    slot.humidity = Math.min(100, slot.humidity + 25);
    if (window.MycoAudio) window.MycoAudio.playSpray();
    triggerWaterSprayFx(slot.x, slot.y + 0.30, slot.z);
    updateGreenhouseSlotMesh(slot);
    queueWorldStateChange('greenhouse_slot_' + slot.id + '_humidity', Math.round(slot.humidity));
    if (callbacks.onLabStep) callbacks.onLabStep('greenhouse_care');
    return;
  }

  if (window.MycoAudio) window.MycoAudio.playClick();
  if (callbacks.onToast) {
    var stageNames = ['Micélio colonizando', 'Primórdios (Pins)', 'Crescimento médio', 'Maduro para colheita'];
    var stLabel = stageNames[slot.stage] || 'Em cultivo';
    var hum = Math.round(slot.humidity);
    callbacks.onToast('🍄 ' + slot.name + ' • ' + stLabel + ' (' + hum + '% UR) — Use o Borrifador para hidratar ou aguarde amadurecer!');
  }
}

export function stepGreenhouse(ctx, dt) {
  for (let gi = 0; gi < greenhouseSlots.length; gi++) {
    const gSlot = greenhouseSlots[gi];
    gSlot.humidity = Math.max(20, gSlot.humidity - dt * 0.12);
    if (gSlot.humidity >= 60 && gSlot.stage < 3) {
      gSlot.growth += dt * (gSlot.humidity / 100) * 1.6;
      if (gSlot.growth >= 100) {
        gSlot.stage++;
        gSlot.growth = 0;
        updateGreenhouseSlotMesh(gSlot);
        ctx.queueWorldStateChange('greenhouse_slot_' + gSlot.id + '_stage', gSlot.stage);
      }
    }
  }
  stepGreenhouseParticles(dt);
}
