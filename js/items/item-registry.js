/**
 * Registro e Metadados Compartilhados de Itens (MycoCampus3D)
 * Cada item define seu objetivo, configs, peso, temperatura base, compatibilidades e conexoes.
 */

const THREE = window.THREE;

export function registerPickable(ctx, id, label, mesh, x, y, z, ry, radius, height, meta) {
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry || 0;
  if (ctx.isTouchDevice && ctx.isTouchDevice() && !mesh.userData.twoHanded) {
    mesh.traverse(function (ch) { if (ch.isMesh) ch.castShadow = false; });
  }
  ctx.scene.add(mesh);
  const resolvedMeta = Object.assign({
    category: 'tool',
    purpose: '',
    weightGrams: 150,
    baseTempC: 23.3,
    compatibilities: {},
    connections: []
  }, meta || {});

  const entry = {
    id,
    label,
    mesh,
    meta: resolvedMeta,
    homePos: new THREE.Vector3(x, y, z),
    homeRy: ry || 0,
    radius: radius || 0.25,
    height: height || 0.4,
    isMoved: false,
    movedAt: 0
  };
  mesh.userData.pickableId = id;
  mesh.userData.pickableLabel = label;
  mesh.userData.itemMeta = resolvedMeta;
  ctx.pickableItems.push(entry);
  return entry;
}

export function getItemWeightGrams(item) {
  if (!item) return 0;
  const meta = item.meta || (item.mesh && item.mesh.userData && item.mesh.userData.itemMeta);
  if (meta && typeof meta.getWeightGrams === 'function') {
    return meta.getWeightGrams(item);
  }
  if (meta && typeof meta.weightGrams === 'number') {
    return meta.weightGrams;
  }
  return 150;
}

export function getItemBaseTempC(item, ctx) {
  if (!item) return 23.3;
  const meta = item.meta || (item.mesh && item.mesh.userData && item.mesh.userData.itemMeta);
  if (meta && typeof meta.getTempC === 'function') {
    return meta.getTempC(item, ctx);
  }
  if (meta && typeof meta.baseTempC === 'number') {
    return meta.baseTempC;
  }
  return 23.3;
}

export function canItemEnterCooker(item) {
  if (!item || !item.mesh) return false;
  const meta = item.meta || item.mesh.userData.itemMeta;
  if (meta && meta.compatibilities && meta.compatibilities.canEnterCooker !== undefined) {
    return !!meta.compatibilities.canEnterCooker;
  }
  return !item.mesh.userData.twoHanded && !item.mesh.userData.isSyringe && !item.mesh.userData.isAlcoholSpray;
}

export function canSyringeTarget(item) {
  if (!item || !item.mesh) return false;
  if (item.mesh.userData.isPetri) {
    const petriCtrl = item.mesh.userData.petriCtrl;
    return !!(petriCtrl && petriCtrl.mode === 'empty');
  }
  const spawnCtrl = item.spawnCtrl;
  if (spawnCtrl && (
    !spawnCtrl.filled ||
    spawnCtrl.inoculated ||
    !spawnCtrl.sterilized ||
    spawnCtrl.burned ||
    spawnCtrl.contaminated ||
    (spawnCtrl.isBag && !spawnCtrl.sealed) ||
    (spawnCtrl.isPP5 && (spawnCtrl.waterMl || 0) < 35)
  )) {
    return false;
  }
  const meta = item.meta || item.mesh.userData.itemMeta;
  if (meta && meta.compatibilities && meta.compatibilities.receivesSyringe !== undefined) {
    return !!meta.compatibilities.receivesSyringe;
  }
  return !!(item.mesh.userData.liquidCtrl || item.id.indexOf('spawn_') === 0 || (item.id.indexOf('petri_') === 0 && item.id.indexOf('petri_bare_') !== 0));
}

export function canSealSpawnBag(item) {
  const sc = item && item.spawnCtrl;
  return !!(sc && sc.isBag && sc.filled && !sc.sealed && !sc.sterilized && !sc.inoculated && !sc.burned && !sc.contaminated);
}

const compatibilityLabels = {
  canEnterCooker: 'Pode ir à panela de pressão',
  sealsBags: 'Pode selar bags de spawn',
  receivesSyringe: 'Recebe cultura líquida pela seringa',
  transfersLiquidCulture: 'Aspira e transfere cultura líquida',
  stirsOnMagneticPlate: 'Pode ser agitado na placa magnética',
  receivesIngredients: 'Recebe ingredientes para mistura',
  receivesWater: 'Recebe água',
  stirsMixingBowl: 'Mistura ingredientes no pote',
  fillsPP5WithFlocao: 'Adiciona flocão ao PP5',
  receivesFlocao: 'Recebe flocão',
  receivesMyceliumCut: 'Recebe transferência de micélio',
  acceptsContents: 'Recebe itens para processamento',
  heatsOnBurner: 'Aquece sobre um fogareiro',
  fillsFromSink: 'Pode ser preenchida na pia',
  heatsCookerOnSurface: 'Aquece uma panela apoiada na superfície',
  transfersMycelium: 'Corta e transfere micélio',
  snapsToCookerPot: 'Encaixa na panela de pressão'
};

function getGuideItemName(item) {
  const meshData = item.mesh && item.mesh.userData;
  return (item.spawnCtrl && item.spawnCtrl.baseLabel) ||
    (meshData && meshData.liquidCtrl && meshData.liquidCtrl.baseLabel) ||
    item.label || item.id;
}

export function getLabItemGuide(items) {
  const source = Array.isArray(items) ? items : [];
  const groups = new Map();
  source.forEach(function (item) {
    if (!item || !item.meta) return;
    const meta = item.meta;
    const name = getGuideItemName(item);
    const groupKey = [meta.category || 'tool', name, meta.purpose || ''].join('|');
    let entry = groups.get(groupKey);
    if (!entry) {
      entry = {
        category: meta.category || 'tool',
        name,
        purpose: meta.purpose || '',
        compatibilities: Object.keys(meta.compatibilities || {})
          .filter((key) => meta.compatibilities[key] === true && compatibilityLabels[key])
          .map((key) => compatibilityLabels[key]),
        connections: []
      };
      groups.set(groupKey, entry);
    }

    (meta.connections || []).forEach(function (connection) {
      const connected = source.find(function (candidate) {
        return candidate && (
          candidate.id === connection ||
          candidate.id.indexOf(connection + '_') === 0 ||
          (connection === 'spawn_bag' && candidate.id.indexOf('spawn_bag_') === 0)
        );
      });
      if (!connected) return;
      const connectedName = getGuideItemName(connected);
      if (connectedName !== name && entry.connections.indexOf(connectedName) === -1) {
        entry.connections.push(connectedName);
      }
    });
  });
  return Array.from(groups.values()).sort(function (a, b) {
    return a.category.localeCompare(b.category, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR');
  });
}

export function updateItemBounds(item) {
  if (!item || !item.mesh) return;
  const px = item.mesh.position.x, py = item.mesh.position.y, pz = item.mesh.position.z;
  const surf = item.mesh.userData.dynamicSurface;
  const col = item.mesh.userData.dynamicCollider;
  const dims = item.mesh.userData.tableDims;
  if (dims) {
    const cRot = Math.abs(Math.cos(item.mesh.rotation.y));
    const sRot = Math.abs(Math.sin(item.mesh.rotation.y));
    const hw = (dims.w * cRot + dims.d * sRot) / 2;
    const hd = (dims.w * sRot + dims.d * cRot) / 2;
    if (surf) {
      surf.minX = px - hw + 0.02; surf.maxX = px + hw - 0.02;
      surf.minZ = pz - hd + 0.02; surf.maxZ = pz + hd - 0.02;
      surf.topY = py + dims.h + (dims.surfOffset || 0);
    }
    if (col) {
      col.minX = px - hw - 0.05; col.maxX = px + hw + 0.05;
      col.minZ = pz - hd - 0.05; col.maxZ = pz + hd + 0.05;
      col.minY = py; col.maxY = py + dims.h; col.surfaceTopY = py + dims.h;
    }
  }
}

export function isSurfaceOccupied(ctx, surf, ignoreItem) {
  if (!surf) return false;
  const heldItem = ctx.getHeldItem ? ctx.getHeldItem() : null;
  for (let i = 0; i < ctx.pickableItems.length; i++) {
    const o = ctx.pickableItems[i];
    if (o === ignoreItem || o === heldItem || (ctx.isHeldByRemote && ctx.isHeldByRemote(o.id))) continue;
    const p = o.mesh.position;
    if (p.x >= surf.minX - 0.08 && p.x <= surf.maxX + 0.08 &&
      p.z >= surf.minZ - 0.08 && p.z <= surf.maxZ + 0.08 &&
      p.y >= surf.topY - 0.12 && p.y <= surf.topY + 0.55) {
      return true;
    }
  }
  return false;
}

export function makeScaleTex(maxVal, stepVal, brandTitle) {
  const sc = document.createElement('canvas');
  sc.width = 256; sc.height = 256;
  const sx = sc.getContext('2d');
  sx.clearRect(0, 0, 256, 256);
  sx.strokeStyle = 'rgba(248, 250, 252, 0.88)';
  sx.fillStyle = 'rgba(248, 250, 252, 0.92)';
  sx.lineWidth = 2;
  sx.font = 'bold 20px sans-serif';
  sx.fillText(brandTitle, 18, 46);
  sx.font = 'bold 16px monospace';
  sx.fillText('Boro 3.3', 24, 72);
  sx.beginPath(); sx.moveTo(138, 36); sx.lineTo(138, 232); sx.stroke();
  for (let v = stepVal; v <= maxVal; v += stepVal) {
    const frac = v / maxVal;
    const yy = 232 - frac * 186;
    sx.beginPath(); sx.moveTo(138, yy); sx.lineTo(174, yy); sx.stroke();
    sx.fillText(String(v), 180, yy + 5);
  }
  return new THREE.CanvasTexture(sc);
}

export function makeRoundedRectShape(w, d, r) {
  const s = new THREE.Shape();
  const hw = w / 2, hd = d / 2;
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r);
  s.quadraticCurveTo(hw, hd, hw - r, hd);
  s.lineTo(-hw + r, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - r);
  s.lineTo(-hw, -hd + r);
  s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return s;
}
