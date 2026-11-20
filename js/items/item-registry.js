/**
 * Registro e Metadados Compartilhados de Itens (MycoCampus3D)
 * Cada item define seu objetivo, configs, peso, temperatura base, compatibilidades e conexoes.
 */

const THREE = typeof window !== 'undefined' ? window.THREE : undefined;

const _canvasTextureCache = new Map();
const _pngTextureCache = new Map();
const _pngPendingMaterials = new Map();

/**
 * Carrega e compartilha uma textura PNG (com cache global + TextureLoader assíncrono)
 * e aplica em um ou vários materiais assim que estiver pronta. Seguro em Node/SSR.
 */
export function bindPngTexture(url, matOrMats, opts = {}) {
  const mats = (Array.isArray(matOrMats) ? matOrMats : [matOrMats]).filter(Boolean);
  if (typeof window === 'undefined' || !THREE || !THREE.TextureLoader) return null;
  const rx = opts.repeatX || 1;
  const ry = opts.repeatY || 1;
  const clamp = !!opts.clamp;
  const key = `${url}|${rx}|${ry}|${clamp ? 1 : 0}`;

  const cached = _pngTextureCache.get(key);
  if (cached) {
    for (let i = 0; i < mats.length; i++) {
      mats[i].map = cached;
      mats[i].needsUpdate = true;
    }
    return cached;
  }

  let waiters = _pngPendingMaterials.get(key);
  if (waiters) {
    for (let i = 0; i < mats.length; i++) waiters.push(mats[i]);
    return null;
  }

  waiters = [...mats];
  _pngPendingMaterials.set(key, waiters);

  const loader = new THREE.TextureLoader();
  loader.load(url, (loadedTex) => {
    if (!loadedTex) return;
    if (THREE.RepeatWrapping && !clamp) {
      loadedTex.wrapS = THREE.RepeatWrapping;
      loadedTex.wrapT = THREE.RepeatWrapping;
    } else if (THREE.ClampToEdgeWrapping && clamp) {
      loadedTex.wrapS = THREE.ClampToEdgeWrapping;
      loadedTex.wrapT = THREE.ClampToEdgeWrapping;
    }
    if (loadedTex.repeat) loadedTex.repeat.set(rx, ry);
    if (THREE.SRGBColorSpace && loadedTex.colorSpace !== undefined) {
      loadedTex.colorSpace = THREE.SRGBColorSpace;
    }
    loadedTex.userData = loadedTex.userData || {};
    loadedTex.userData.shared = true;
    _pngTextureCache.set(key, loadedTex);
    const list = _pngPendingMaterials.get(key) || [];
    _pngPendingMaterials.delete(key);
    for (let i = 0; i < list.length; i++) {
      list[i].map = loadedTex;
      list[i].needsUpdate = true;
    }
  });
  return null;
}

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

export function attachSurfaceOwner(surf, entry) {
  if (!surf) return;
  try {
    Object.defineProperty(surf, 'ownerItem', {
      value: entry || null,
      writable: true,
      configurable: true,
      enumerable: false
    });
  } catch (_e) {
    surf.ownerItem = entry || null;
  }
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
  if (mesh.userData.dynamicSurface) attachSurfaceOwner(mesh.userData.dynamicSurface, entry);
  if (Array.isArray(mesh.userData.dynamicSurfaces)) {
    for (let dsi = 0; dsi < mesh.userData.dynamicSurfaces.length; dsi++) {
      if (mesh.userData.dynamicSurfaces[dsi]) attachSurfaceOwner(mesh.userData.dynamicSurfaces[dsi], entry);
    }
  }
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
  return !item.mesh.userData.twoHanded && !item.mesh.userData.isSyringe && !item.mesh.userData.isAlcoholSpray && !item.mesh.userData.isH2O2Spray;
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

export function getItemSupportTopOffset(item) {
  if (!item || !item.mesh) return 0;
  const ud = item.mesh.userData || {};
  if (ud.isTable || ud.isHood || ud.isTray || ud.isScale || ud.isStirrer || ud.isBurner || ud.isCultureFridge) {
    return 0;
  }
  if (ud.isPetri || (item.spawnCtrl && item.spawnCtrl.isPP5)) return 0;
  if (ud.isSyringe || ud.isLabSpoon || ud.isThermometer || ud.isAlcoholSpray || ud.isH2O2Spray || ud.isPaperTowel ||
      item.scalpelCtrl || item.bladePackCtrl || item.wildMushroomCtrl || item.driedMushroomCtrl ||
      item.potItem || item.bowlCtrl) {
    return 0;
  }
  const sy = Math.abs(item.mesh.scale ? item.mesh.scale.y : 1) || 1;
  if (item.deliveryCrateCtrl) return 0.165 * sy;
  if (item.monotubCtrl) return item.monotubCtrl.lidOpen ? 0 : 0.32 * sy;
  if (item.dehydratorCtrl) return 0.28 * sy;
  if (item.sealerCtrl) return 0.11 * sy;
  if (item.silicaJarCtrl) return 0.21 * sy;
  if (item.organicBasketCtrl) return 0.14 * sy;
  if (ud.isCookerBase) return 0.036 * sy;
  if (item.lidItem && item.lidItem.isAttached) return 0.42 * sy;
  if (item.mushroomBagCtrl) return 0.035 * sy;
  const id = item.id || '';
  if (id.indexOf('gloves_box_') === 0) return 0.122 * sy;
  if (id.indexOf('substrate_') === 0) return 0.42 * sy;
  if (id.indexOf('flocao_500g_') === 0) return 0.22 * sy;
  if (id === 'falcon_rack_lab') return 0.08 * sy;
  if (id.indexOf('foil_roll_') === 0) return 0.065 * sy;
  return 0;
}

export function getItemSupportHalfExtents(item) {
  const sx = Math.abs(item && item.mesh && item.mesh.scale ? item.mesh.scale.x : 1) || 1;
  const sz = Math.abs(item && item.mesh && item.mesh.scale ? item.mesh.scale.z : 1) || 1;
  const ry = (item && item.mesh && item.mesh.rotation && item.mesh.rotation.y) || 0;
  let w = 0.24;
  let d = 0.24;
  if (item && item.deliveryCrateCtrl) { w = 0.42; d = 0.36; }
  else if (item && item.monotubCtrl) { w = 0.52; d = 0.40; }
  else if (item && item.dehydratorCtrl) { w = 0.34; d = 0.34; }
  else if (item && item.silicaJarCtrl) { w = 0.17; d = 0.17; }
  else if (item && item.organicBasketCtrl) { w = 0.32; d = 0.24; }
  else if (item && item.sealerCtrl) { w = 0.28; d = 0.16; }
  else if (item && item.id && item.id.indexOf('substrate_') === 0) { w = 0.30; d = 0.22; }
  else if (item && item.id && item.id.indexOf('gloves_box_') === 0) { w = 0.24; d = 0.13; }
  else if (item && item.id && item.id.indexOf('flocao_500g_') === 0) { w = 0.18; d = 0.12; }
  else {
    const r = (item && item.radius) || 0.18;
    w = r * 1.6;
    d = r * 1.6;
  }
  const sw = w * sx;
  const sd = d * sz;
  const cRot = Math.abs(Math.cos(ry));
  const sRot = Math.abs(Math.sin(ry));
  return {
    w: sw,
    d: sd,
    hw: (sw * cRot + sd * sRot) * 0.5,
    hd: (sw * sRot + sd * cRot) * 0.5
  };
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
      attachSurfaceOwner(surf, item);
      surf.minX = px - hw + 0.02; surf.maxX = px + hw - 0.02;
      surf.minZ = pz - hd + 0.02; surf.maxZ = pz + hd - 0.02;
      surf.topY = py + h + (dims.surfOffset || 0) * sy;
      surf.centerX = px; surf.centerZ = pz;
      surf.halfW = Math.max(0.05, w * 0.5 - 0.02);
      surf.halfD = Math.max(0.05, d * 0.5 - 0.02);
      surf.ry = ry;
    }
    if (item.fridgeCtrl && item.fridgeCtrl.roofSurface) {
      const rs = item.fridgeCtrl.roofSurface;
      attachSurfaceOwner(rs, item);
      rs.minX = px - hw + 0.02; rs.maxX = px + hw - 0.02;
      rs.minZ = pz - hd + 0.02; rs.maxZ = pz + hd - 0.02;
      rs.topY = py + h;
      rs.centerX = px; rs.centerZ = pz;
      rs.halfW = Math.max(0.05, w * 0.5 - 0.02);
      rs.halfD = Math.max(0.05, d * 0.5 - 0.02);
      rs.ry = ry;
    }
    if (item.fridgeCtrl && Array.isArray(item.fridgeCtrl.shelfSurfaces)) {
      const cosF = Math.cos(ry);
      const sinF = Math.sin(ry);
      const shelves = item.fridgeCtrl.shelfSurfaces;
      for (let sfi = 0; sfi < shelves.length; sfi++) {
        const sf = shelves[sfi];
        attachSurfaceOwner(sf, item);
        const lMinX = sf.localMinX * sx, lMaxX = sf.localMaxX * sx;
        const lMinZ = sf.localMinZ * sz, lMaxZ = sf.localMaxZ * sz;
        const x0 = px + lMinX * cosF + lMinZ * sinF;
        const x1 = px + lMinX * cosF + lMaxZ * sinF;
        const x2 = px + lMaxX * cosF + lMinZ * sinF;
        const x3 = px + lMaxX * cosF + lMaxZ * sinF;
        const z0 = pz - lMinX * sinF + lMinZ * cosF;
        const z1 = pz - lMinX * sinF + lMaxZ * cosF;
        const z2 = pz - lMaxX * sinF + lMinZ * cosF;
        const z3 = pz - lMaxX * sinF + lMaxZ * cosF;
        sf.minX = Math.min(x0, x1, x2, x3);
        sf.maxX = Math.max(x0, x1, x2, x3);
        sf.minZ = Math.min(z0, z1, z2, z3);
        sf.maxZ = Math.max(z0, z1, z2, z3);
        sf.topY = py + sf.localTopY * sy;
        const midZ = (lMinZ + lMaxZ) * 0.5;
        sf.centerX = px + midZ * sinF;
        sf.centerZ = pz + midZ * cosF;
        sf.halfW = (lMaxX - lMinX) * 0.5;
        sf.halfD = (lMaxZ - lMinZ) * 0.5;
        sf.ry = ry;
      }
      if (Array.isArray(item.fridgeCtrl.slots)) {
        for (let sli = 0; sli < item.fridgeCtrl.slots.length; sli++) {
          const sl = item.fridgeCtrl.slots[sli];
          if (sl && sl.worldPosition) {
            sl.worldPosition.set(
              px + (sl.localX * sx) * cosF + (sl.localZ * sz) * sinF,
              py + sl.localY * sy,
              pz - (sl.localX * sx) * sinF + (sl.localZ * sz) * cosF
            );
          }
        }
      }
      item.fridgeCtrl._lastX = px;
      item.fridgeCtrl._lastY = py;
      item.fridgeCtrl._lastZ = pz;
      item.fridgeCtrl._lastRy = ry;
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
