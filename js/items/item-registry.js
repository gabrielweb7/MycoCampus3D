/**
 * Registro e Metadados Compartilhados de Itens (MycoCampus3D)
 * Cada item define seu objetivo, configs, peso, temperatura base, compatibilidades e conexoes.
 */

const THREE = typeof window !== 'undefined' ? window.THREE : undefined;

const _canvasTextureCache = new Map();

/**
 * Gera ou reutiliza uma CanvasTexture compartilhada (marcada com userData.shared = true)
 * para evitar dezenas de texturas Canvas duplicadas em GPU mobile.
 */
export function getCachedCanvasTexture(cacheKey, width, height, drawFn) {
  const existing = _canvasTextureCache.get(cacheKey);
  if (existing) return existing;
  if (typeof document === 'undefined' || !THREE || !THREE.CanvasTexture) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx2d = canvas.getContext('2d');
  if (ctx2d && typeof drawFn === 'function') drawFn(ctx2d, canvas);
  const tex = new THREE.CanvasTexture(canvas);
  tex.userData = tex.userData || {};
  tex.userData.shared = true;
  if (THREE.SRGBColorSpace && tex.colorSpace !== undefined) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  _canvasTextureCache.set(cacheKey, tex);
  return tex;
}

/**
 * Mescla várias geometrias em coordenadas locais mantendo atributos compatíveis.
 * Retorna BufferGeometry marcada com userData.shared = true, ou null em fallback.
 */
export function mergeStaticGeos(specs, opts = {}) {
  const ThreeRef = typeof window !== 'undefined' ? window.THREE : undefined;
  if (!ThreeRef || !ThreeRef.mergeGeometries || !Array.isArray(specs) || specs.length === 0) return null;
  const keepUv = !!opts.keepUv;
  const dummy = new ThreeRef.Object3D();
  const list = [];
  let result = null;
  try {
    for (let i = 0; i < specs.length; i++) {
      const sp = specs[i];
      if (!sp || !sp.geo) continue;
      const g = sp.geo.index ? sp.geo.toNonIndexed() : sp.geo.clone();
      dummy.position.set(sp.x || 0, sp.y || 0, sp.z || 0);
      dummy.rotation.set(sp.rx || 0, sp.ry || 0, sp.rz || 0);
      dummy.scale.set(sp.sx !== undefined ? sp.sx : 1, sp.sy !== undefined ? sp.sy : 1, sp.sz !== undefined ? sp.sz : 1);
      dummy.updateMatrix();
      g.applyMatrix4(dummy.matrix);
      if (!g.attributes.normal && g.computeVertexNormals) g.computeVertexNormals();
      if (keepUv && !g.attributes.uv && g.attributes.position) {
        g.setAttribute('uv', new ThreeRef.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      }
      const attrNames = Object.keys(g.attributes);
      for (let ai = 0; ai < attrNames.length; ai++) {
        const nm = attrNames[ai];
        if (nm === 'position' || nm === 'normal' || (keepUv && nm === 'uv')) continue;
        g.deleteAttribute(nm);
      }
      g.morphAttributes = {};
      list.push(g);
    }
    if (list.length > 0) {
      result = ThreeRef.mergeGeometries(list, false);
      if (result) {
        result.userData = result.userData || {};
        if (opts.shared !== false) result.userData.shared = true;
      }
    }
  } catch (e) {
    result = null;
  } finally {
    for (let i = 0; i < list.length; i++) list[i].dispose();
  }
  return result;
}

function disposeMaterialIfOwned(mat) {
  if (!mat || (mat.userData && mat.userData.shared)) return;
  if (mat.map && !(mat.map.userData && mat.map.userData.shared) && typeof mat.map.dispose === 'function') {
    mat.map.dispose();
  }
  if (typeof mat.dispose === 'function') mat.dispose();
}

/**
 * Libera geometrias, materiais e texturas exclusivas de um objeto 3D,
 * preservando qualquer recurso compartilhado (`userData.shared === true`).
 */
export function disposeObjectResources(root) {
  if (!root || typeof root.traverse !== 'function') return;
  root.traverse((obj) => {
    if (!obj) return;
    if (obj.geometry && !(obj.geometry.userData && obj.geometry.userData.shared)) {
      if (typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        for (let i = 0; i < obj.material.length; i++) disposeMaterialIfOwned(obj.material[i]);
      } else {
        disposeMaterialIfOwned(obj.material);
      }
    }
  });
}

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
  if (ctx.pickableMap && typeof ctx.pickableMap.set === 'function') {
    ctx.pickableMap.set(id, entry);
  }
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
  if (item.id && item.id.indexOf('distilled_jug') === 0) return false;
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
    return !!(petriCtrl && petriCtrl.mode === 'empty' && petriCtrl.lidOpen && petriCtrl.sterilized);
  }
  const spawnCtrl = item.spawnCtrl;
  if (item.pdaMediumCtrl && hasPdaContents(item) &&
      (!spawnCtrl || spawnCtrl.substrateKind !== 'pda')) return false;
  const liquid = item.mesh.userData.liquidCtrl;
  if (liquid && !(spawnCtrl && spawnCtrl.isPP5)) {
    return liquid.volMl < liquid.maxMl;
  }
  const pdaAgarReady = item.pdaMediumCtrl && item.pdaMediumCtrl.powderGrams > 0 &&
    liquid && liquid.volMl > 0;
  if (spawnCtrl && (
    !spawnCtrl.filled ||
    spawnCtrl.inoculated ||
    !spawnCtrl.sterilized ||
    spawnCtrl.burned ||
    spawnCtrl.contaminated ||
    (spawnCtrl.isBag && !spawnCtrl.sealed) ||
    (spawnCtrl.isPP5 && (spawnCtrl.waterMl || 0) < 35 && !pdaAgarReady)
  )) {
    return false;
  }
  if (spawnCtrl && spawnCtrl.substrateKind === 'pda') {
    const medium = item.pdaMediumCtrl;
    if (!medium || !medium.mixed || !medium.sterilized || medium.burned) return false;
  }
  const meta = item.meta || item.mesh.userData.itemMeta;
  if (meta && meta.compatibilities) return !!meta.compatibilities.receivesSyringe;
  return !!(item.mesh.userData.liquidCtrl || item.id.indexOf('spawn_') === 0 || (item.id.indexOf('petri_') === 0 && item.id.indexOf('petri_bare_') !== 0));
}

export function canFillFromSink(item) {
  if (!item || !item.mesh || !item.mesh.userData.liquidCtrl) return false;
  const medium = item.pdaMediumCtrl;
  if ((medium && medium.burned) || hasPdaContents(item)) return false;
  const meta = item.meta || item.mesh.userData.itemMeta;
  const compatibilities = meta && meta.compatibilities;
  return !compatibilities || compatibilities.fillsFromSink !== false;
}

export function canSyringeSource(item) {
  if (!item || !item.mesh || !item.mesh.userData.liquidCtrl || item.mesh.userData.liquidCtrl.volMl <= 0) return false;
  if (item.spawnCtrl && item.spawnCtrl.isPP5) return false;
  return true;
}

export function hasPdaContents(item) {
  const medium = item && item.pdaMediumCtrl;
  const liquid = item && item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl;
  return !!(medium && (medium.powderGrams > 0 ||
    (liquid && liquid.volMl > 0 && (medium.mixed || medium.sterilized || medium.burned))));
}

export function canSealSpawnBag(item) {
  const sc = item && item.spawnCtrl;
  return !!(sc && sc.isBag && sc.filled && !sc.sealed && !sc.sterilized && !sc.inoculated && !sc.burned && !sc.contaminated);
}

const compatibilityLabels = {
  canEnterCooker: 'Pode ir à panela de pressão',
  acceptsPdaMedium: 'Recebe meio PDA/BDA preparado',
  addsPdaPowder: 'Adiciona pó PDA/BDA ao béquer',
  receivesPdaPowder: 'Recebe pó PDA/BDA para preparo',
  receivesPdaWater: 'Recebe água para preparo de PDA/BDA',
  poursWater: 'Pode despejar água ou solução',
  sealsBags: 'Pode selar bags de spawn',
  receivesSyringe: 'Recebe cultura líquida pela seringa',
  providesLiquidCulture: 'Fornece cultura líquida para aspiração',
  transfersLiquidCulture: 'Aspira e transfere cultura líquida',
  stirsOnMagneticPlate: 'Pode ser agitado na placa magnética',
  stirsLiquidContainers: 'Agita recipientes com barra magnética',
  canSanitizeHood: 'Higieniza o fluxo laminar',
  canSanitizeItems: 'Higieniza equipamentos e itens',
  canHydrateGreenhouse: 'Hidrata a estufa',
  requiresSanitization: 'Requer higienização antes do uso',
  carriesItemsOnSurface: 'Transporta itens em sua superfície',
  supportsItemsOnSurface: 'Oferece superfície de apoio',
  weighsItemsOnSurface: 'Pesa itens colocados na plataforma',
  receivesIngredients: 'Recebe ingredientes para mistura',
  receivesSubstrate: 'Recebe grãos ou substrato',
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
  scansTemperature: 'Mede a temperatura por laser',
  isScalpelBladePack: 'Fornece lâminas para o bisturi',
  snapsToCookerPot: 'Encaixa na panela de pressão'
};

function getGuideItemName(item) {
  const meshData = item.mesh && item.mesh.userData;
  return (item.spawnCtrl && item.spawnCtrl.baseLabel) ||
    (item.pdaReagentCtrl && item.pdaReagentCtrl.baseLabel) ||
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

export function isPointInBoundsXZ(x, z, box, margin) {
  if (!box) return false;
  const m = margin || 0;
  if (typeof box.halfW === 'number' && typeof box.halfD === 'number' &&
      typeof box.centerX === 'number' && typeof box.centerZ === 'number' && box.ry) {
    const dx = x - box.centerX;
    const dz = z - box.centerZ;
    const cosR = Math.cos(box.ry);
    const sinR = Math.sin(box.ry);
    const lx = dx * cosR - dz * sinR;
    const lz = dx * sinR + dz * cosR;
    return Math.abs(lx) <= box.halfW + m && Math.abs(lz) <= box.halfD + m;
  }
  return x >= box.minX - m && x <= box.maxX + m && z >= box.minZ - m && z <= box.maxZ + m;
}

export function updateItemBounds(item) {
  if (!item || !item.mesh) return;
  const px = item.mesh.position.x, py = item.mesh.position.y, pz = item.mesh.position.z;
  const sx = Math.abs(item.mesh.scale ? item.mesh.scale.x : 1) || 1;
  const sy = Math.abs(item.mesh.scale ? item.mesh.scale.y : 1) || 1;
  const sz = Math.abs(item.mesh.scale ? item.mesh.scale.z : 1) || 1;
  const ry = item.mesh.rotation.y || 0;
  const surf = item.mesh.userData.dynamicSurface;
  const col = item.mesh.userData.dynamicCollider;
  const dims = item.mesh.userData.tableDims;
  if (dims) {
    const w = dims.w * sx;
    const h = dims.h * sy;
    const d = dims.d * sz;
    const cRot = Math.abs(Math.cos(ry));
    const sRot = Math.abs(Math.sin(ry));
    const hw = (w * cRot + d * sRot) / 2;
    const hd = (w * sRot + d * cRot) / 2;
    if (surf) {
      surf.minX = px - hw + 0.02; surf.maxX = px + hw - 0.02;
      surf.minZ = pz - hd + 0.02; surf.maxZ = pz + hd - 0.02;
      surf.topY = py + h + (dims.surfOffset || 0) * sy;
      surf.centerX = px; surf.centerZ = pz;
      surf.halfW = Math.max(0.05, w * 0.5 - 0.02);
      surf.halfD = Math.max(0.05, d * 0.5 - 0.02);
      surf.ry = ry;
    }
    if (col) {
      col.minX = px - hw - 0.05; col.maxX = px + hw + 0.05;
      col.minZ = pz - hd - 0.05; col.maxZ = pz + hd + 0.05;
      col.minY = py; col.maxY = py + h; col.surfaceTopY = py + h;
      col.centerX = px; col.centerZ = pz;
      col.halfW = w * 0.5 + 0.05;
      col.halfD = d * 0.5 + 0.05;
      col.ry = ry;
    }
  }
  if (item.mesh.userData.hoodLight) {
    item.mesh.userData.hoodLight.position.set(px, py + 0.80 * sy, pz);
  }
}

export function isSurfaceOccupied(ctx, surf, ignoreItem) {
  if (!surf) return false;
  const heldItem = ctx.getHeldItem ? ctx.getHeldItem() : null;
  for (let i = 0; i < ctx.pickableItems.length; i++) {
    const o = ctx.pickableItems[i];
    if (o === ignoreItem || o === heldItem || (ctx.isHeldByRemote && ctx.isHeldByRemote(o.id))) continue;
    const p = o.mesh.position;
    if (isPointInBoundsXZ(p.x, p.z, surf, 0.08) &&
      p.y >= surf.topY - 0.12 && p.y <= surf.topY + 0.55) {
      return true;
    }
  }
  return false;
}

export function makeScaleTex(maxVal, stepVal, brandTitle) {
  const key = `scale_${brandTitle}_${maxVal}_${stepVal}`;
  return getCachedCanvasTexture(key, 256, 256, (sx) => {
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
  });
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
