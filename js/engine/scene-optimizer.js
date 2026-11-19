/**
 * MycoCampus3D — Otimizador de Cena, Merging Estático, BVH & Pool de PointLights
 *
 * Responsabilidades:
 * 1. Proteger toda a subárvore dinâmica (jogador, portas, persianas, móveis articulados,
 *    entidades, itens pegáveis, grupos com culling por distância, hitboxes e materiais mutáveis).
 * 2. Virtualizar PointLights em um pool fixo de 4 luzes reais no shader (evita loop de 13+ luzes
 *    em todos os shaders do jogo e evita recompilação ao alternar interruptores).
 * 3. Mesclar geometrias estáticas opacas em células espaciais de 32x32m agrupadas por material
 *    e flags de sombra, preservando frustum culling e cortando centenas de draw calls.
 * 4. Gerar BVH (`computeBoundsTree`) para malhas estáticas densas (terreno e chunks mesclados).
 */
import { snowableEntries } from './textures.js';
import { greenhouseDynamicObjects, greenhouseControlMeshes } from '../world/greenhouse.js';
import { monotubRackHitMeshes } from '../items/monotub.js';
import { gardenHitMeshes, gardenPlants, gardenState, gardenDynamicObjects } from '../world/campus-garden.js';
import { alcoholLamps } from '../items/lab-advanced-tools.js';
import { roadSaleStandMeshes, roadSaleDynamicObjects } from '../items/dehydration-packaging.js';
import { telescopeHitMeshes } from '../world/plaza-telescope.js';

const THREE = window.THREE;
const CHUNK_SIZE = 32;
const POINT_LIGHT_POOL_SIZE = 4;

const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const _tmpPos = new THREE.Vector3();

function collectDynamicObjects(sim) {
  const dynamicObjects = new Set();

  function markDynamicTree(obj) {
    if (!obj) return;
    dynamicObjects.add(obj);
    if (obj.children && obj.children.length > 0) {
      for (let i = 0; i < obj.children.length; i++) {
        markDynamicTree(obj.children[i]);
      }
    }
  }

  function markList(arr, getObj) {
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      const entry = arr[i];
      const obj = getObj ? getObj(entry) : entry;
      if (obj) dynamicObjects.add(obj);
    }
  }

  function markTreeList(arr, getObj) {
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      const entry = arr[i];
      const obj = getObj ? getObj(entry) : entry;
      if (obj) markDynamicTree(obj);
    }
  }

  // A Câmera e a Scene NUNCA podem ser congeladas/mescladas!
  dynamicObjects.add(sim.scene);
  markDynamicTree(sim.camera);

  // 1. Elementos do jogador e UI 3D
  markDynamicTree(sim.localAvatar && sim.localAvatar.group);
  markDynamicTree(sim.fpsArmGroup);
  markDynamicTree(sim.fpsLeftArmGroup);
  markDynamicTree(sim.placementGhost && (sim.placementGhost.root || sim.placementGhost));
  markDynamicTree(sim.hover3dBadge && (sim.hover3dBadge.sprite || sim.hover3dBadge.mesh));
  markDynamicTree(sim.thermoLaserLine);
  markDynamicTree(sim.thermoLaserDot);
  markDynamicTree(sim.snowboardGroup);
  markDynamicTree(sim.paragliderGroup);
  markDynamicTree(sim.roundParachuteGroup);

  // 2. Elementos celestes e clima dinâmico
  markDynamicTree(sim.sunDisc);
  markDynamicTree(sim.sunHalo);
  markDynamicTree(sim.moonDisc);
  markDynamicTree(sim.starPoints);
  markDynamicTree(sim.celestialDome && sim.celestialDome.group);
  markDynamicTree(sim.rainPuddles && sim.rainPuddles.inst);
  markDynamicTree(sim.weatherPoints);
  markDynamicTree(sim.envSun);
  markDynamicTree(sim.envSun && sim.envSun.target);
  markDynamicTree(sim.envHemi);
  markDynamicTree(sim.rainbowMesh);
  markDynamicTree(sim.envCloudsInst);
  markTreeList(sim.envClouds);
  markDynamicTree(sim.confettiMesh);

  // 3. Portas que abrem e fecham
  markTreeList(sim.campusDoors, (d) => d && d.pivot);

  // 4. Persianas móveis (InstancedMesh ou legado)
  if (sim.windowBlinds) {
    for (let b = 0; b < sim.windowBlinds.length; b++) {
      const wb = sim.windowBlinds[b];
      if (!wb) continue;
      if (wb.slatInst) dynamicObjects.add(wb.slatInst);
      if (wb.slats) markList(wb.slats);
      if (wb.tapesMesh) markDynamicTree(wb.tapesMesh);
      if (wb.tapes) markList(wb.tapes);
      if (wb.bottomRail) dynamicObjects.add(wb.bottomRail);
      if (wb.cordKnob) dynamicObjects.add(wb.cordKnob);
    }
  }

  // 5. Entidades, partículas, veículos e grupos com distance culling
  markTreeList(sim.sportBalls, (sp) => sp && sp.mesh);
  markTreeList(sim.pastureCows, (cw) => cw && (cw.mesh || cw.group));
  markTreeList(sim.cowPoops, (cp) => cp && (cp.group || cp.mesh));
  markTreeList(sim.wildMushrooms, (wm) => wm && wm.group);
  markTreeList(sim.forestCullGroups, (fg) => fg && fg.obj);
  markTreeList(sim.mushroomCullGroups, (mg) => mg && mg.obj);
  markList(sim.fountainRipples, (rp) => rp && rp.mesh);

  // 6. Itens pegáveis e bancadas/equipamentos interativos
  markTreeList(sim.pickableItems, (pi) => pi && pi.mesh);
  markTreeList(sim.labSinks, (s) => s && s.waterStream);
  markList(sim.labSinks, (s) => s && s.handle);
  markTreeList(sim.greenhouseHitMeshes, (gh) => gh && gh.parent);
  markTreeList(greenhouseControlMeshes, (gm) => gm && gm.parent);
  markTreeList(greenhouseDynamicObjects);
  markList(monotubRackHitMeshes);
  markList(gardenHitMeshes);
  markTreeList(gardenPlants, (pl) => pl && pl.group);
  markTreeList(gardenDynamicObjects);
  markTreeList(alcoholLamps, (al) => al && al.mesh);
  markList(roadSaleStandMeshes);
  markTreeList(roadSaleDynamicObjects);
  markList(telescopeHitMeshes);
  if (gardenState.compostFillMesh) markDynamicTree(gardenState.compostFillMesh);

  // Armários (portas e gavetas articuladas)
  if (sim.cabinetHitMeshes) {
    for (let i = 0; i < sim.cabinetHitMeshes.length; i++) {
      const hit = sim.cabinetHitMeshes[i];
      if (!hit) continue;
      dynamicObjects.add(hit);
      const part = hit.userData && hit.userData.cabinetPart;
      if (part && part.kind === 'doors' && hit.parent && hit.parent.parent) {
        markDynamicTree(hit.parent.parent);
      } else if (hit.parent) {
        markDynamicTree(hit.parent);
      }
    }
  }

  // Interruptores, hitboxes e malhas de raycast individual
  markList(sim.supportMeshes);
  markList(sim.doorHitMeshes);
  markList(sim.blindHitMeshes);
  markList(sim.seatMeshes);
  markList(sim.chalkboardMeshes);
  markList(sim.lightSwitchMeshes);
  markList(sim.rankingBtnMeshes);
  markList(sim.hoodSwitchMeshes);
  markList(sim.burnerSwitchMeshes);
  markList(sim.stirSwitchMeshes);
  markList(sim.scaleTareMeshes);
  markList(sim.labSinkMeshes);
  markList(sim.labTrashMeshes);
  markList(sim.cowHitMeshes);
  if (sim.cinemaScreenMesh) dynamicObjects.add(sim.cinemaScreenMesh);
  if (sim.cinemaBeam) dynamicObjects.add(sim.cinemaBeam);
  if (sim.campusLightSwitches) {
    for (let i = 0; i < sim.campusLightSwitches.length; i++) {
      const sw = sim.campusLightSwitches[i];
      if (sw && sw.rocker) dynamicObjects.add(sw.rocker);
    }
  }

  return dynamicObjects;
}

function collectProtectedMaterials(sim) {
  const mats = new Set();
  for (let i = 0; i < snowableEntries.length; i++) {
    if (snowableEntries[i] && snowableEntries[i].mat) mats.add(snowableEntries[i].mat);
  }
  if (sim.campusLightSwitches) {
    for (let i = 0; i < sim.campusLightSwitches.length; i++) {
      const sw = sim.campusLightSwitches[i];
      if (sw && sw.tubeMat) mats.add(sw.tubeMat);
      if (sw && sw.ledMat) mats.add(sw.ledMat);
    }
  }
  if (sim.cabinetLedMats) {
    for (let i = 0; i < sim.cabinetLedMats.length; i++) mats.add(sim.cabinetLedMats[i]);
  }
  if (sim.hoodAirData) {
    if (sim.hoodAirData.hepaMat) mats.add(sim.hoodAirData.hepaMat);
    if (sim.hoodAirData.ledMat) mats.add(sim.hoodAirData.ledMat);
  }
  if (sim.envCloudMat) mats.add(sim.envCloudMat);
  if (sim.terrainSnowMat) mats.add(sim.terrainSnowMat);
  return mats;
}

function installPointLightPool(sim, dynamicObjects) {
  const scene = sim.scene;
  if (!scene) return 0;

  const sources = [];
  scene.traverse((obj) => {
    if (!obj || !obj.isPointLight) return;
    if (obj.userData && obj.userData.isLightPoolSlot) return;
    sources.push(obj);
  });

  if (sources.length <= POINT_LIGHT_POOL_SIZE) {
    return 0;
  }

  const virtualLights = [];
  for (let i = 0; i < sources.length; i++) {
    const light = sources[i];
    const parent = light.parent || scene;
    let isDynamic = false;
    let cur = parent;
    while (cur) {
      if (cur !== scene && dynamicObjects.has(cur)) {
        isDynamic = true;
        break;
      }
      cur = cur.parent;
    }
    const worldPos = new THREE.Vector3();
    parent.updateWorldMatrix(true, false);
    worldPos.copy(light.position).applyMatrix4(parent.matrixWorld);
    light.removeFromParent();
    virtualLights.push({
      light,
      parent,
      isDynamic,
      worldPos,
      baseIntensity: light.intensity
    });
  }

  const pool = [];
  for (let i = 0; i < POINT_LIGHT_POOL_SIZE; i++) {
    const slot = new THREE.PointLight(0xffffff, 0, 1, 1.5);
    slot.visible = true;
    slot.userData.isLightPoolSlot = true;
    scene.add(slot);
    pool.push(slot);
  }

  scene.userData._virtualPointLights = virtualLights;
  scene.userData._pointLightPool = pool;
  return virtualLights.length;
}

function getMaterialKey(mat, protectedMaterials) {
  if (protectedMaterials.has(mat) || mat.map) {
    return 'uuid:' + mat.uuid;
  }
  if (mat.isMeshStandardMaterial) {
    return 'std|' + mat.color.getHexString() + '|' +
      mat.roughness.toFixed(3) + '|' + mat.metalness.toFixed(3) + '|' +
      mat.emissive.getHexString() + '|' + (mat.emissiveIntensity || 0).toFixed(3) + '|' +
      mat.side + '|' + (mat.alphaTest || 0);
  }
  if (mat.isMeshBasicMaterial) {
    return 'bas|' + mat.color.getHexString() + '|' + mat.side + '|' + (mat.alphaTest || 0);
  }
  return 'uuid:' + mat.uuid;
}

function normalizeForMerge(mesh, hasUv) {
  const srcGeo = mesh.geometry;
  if (!srcGeo || !srcGeo.attributes || !srcGeo.attributes.position) return null;
  const g = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo.clone();
  g.applyMatrix4(mesh.matrixWorld);

  if (!g.attributes.normal) {
    g.computeVertexNormals();
  }
  if (hasUv && !g.attributes.uv) {
    const count = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  // Remove atributos extras (ex.: color, tangent) para todos os chunks casarem exatamente
  const attrNames = Object.keys(g.attributes);
  for (let i = 0; i < attrNames.length; i++) {
    const name = attrNames[i];
    if (name === 'position' || name === 'normal' || (hasUv && name === 'uv')) continue;
    g.deleteAttribute(name);
  }
  g.morphAttributes = {};
  return g;
}

function mergeStaticWorld(sim, dynamicObjects, protectedMaterials) {
  if (!THREE || !THREE.mergeGeometries) return 0;
  const scene = sim.scene;
  const buckets = new Map();

  scene.traverse((obj) => {
    if (!obj || !obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh) return;
    if (!obj.visible) return;
    if (obj.isCamera || obj === sim.camera || obj === scene) return;
    if (dynamicObjects.has(obj)) return;
    if (obj.userData && (obj.userData.isDynamic || obj.userData.keepDynamic || obj.userData.noMerge)) return;

    const mat = obj.material;
    if (!mat || Array.isArray(mat)) return;
    // Transparência e vertexColors ficam fora do merge para preservar ordem alfa e efeitos
    if (mat.transparent || mat.vertexColors) return;
    if (!mat.isMeshStandardMaterial && !mat.isMeshBasicMaterial && !mat.isMeshLambertMaterial) return;

    const geo = obj.geometry;
    if (!geo || !geo.attributes || !geo.attributes.position) return;

    // Malhas muito grandes (terreno, calçadão, avenidas) já são 1 draw call cada
    if (!geo.boundingBox) geo.computeBoundingBox();
    if (!geo.boundingBox) return;
    _box.copy(geo.boundingBox).applyMatrix4(obj.matrixWorld);
    const sx = _box.max.x - _box.min.x;
    const sz = _box.max.z - _box.min.z;
    if (sx > CHUNK_SIZE || sz > CHUNK_SIZE) return;

    _box.getCenter(_center);
    const cellX = Math.floor(_center.x / CHUNK_SIZE);
    const cellZ = Math.floor(_center.z / CHUNK_SIZE);
    const hasUv = !!mat.map;
    const key = getMaterialKey(mat, protectedMaterials) + '|' +
      (obj.castShadow ? 1 : 0) + '|' + (obj.receiveShadow ? 1 : 0) + '|' +
      (hasUv ? 1 : 0) + '|' + cellX + ',' + cellZ;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        mat,
        castShadow: !!obj.castShadow,
        receiveShadow: !!obj.receiveShadow,
        hasUv,
        meshes: []
      };
      buckets.set(key, bucket);
    }
    bucket.meshes.push(obj);
  });

  const mergedGroup = new THREE.Group();
  mergedGroup.name = 'StaticMergedWorld';
  mergedGroup.matrixAutoUpdate = false;
  let mergedSourceCount = 0;
  let mergedChunkCount = 0;

  // Conta referências de geometrias antes de descartar originais
  const geoRefCounts = new Map();
  scene.traverse((obj) => {
    if (obj && obj.geometry) {
      geoRefCounts.set(obj.geometry, (geoRefCounts.get(obj.geometry) || 0) + 1);
    }
  });

  buckets.forEach((bucket) => {
    if (bucket.meshes.length < 2) return;
    const geoms = [];
    const okMeshes = [];
    for (let i = 0; i < bucket.meshes.length; i++) {
      const m = bucket.meshes[i];
      const norm = normalizeForMerge(m, bucket.hasUv);
      if (norm) {
        geoms.push(norm);
        okMeshes.push(m);
      }
    }
    if (geoms.length < 2) {
      for (let i = 0; i < geoms.length; i++) geoms[i].dispose();
      return;
    }

    const combined = THREE.mergeGeometries(geoms, false);
    for (let i = 0; i < geoms.length; i++) geoms[i].dispose();
    if (!combined) return;

    combined.computeBoundingBox();
    combined.computeBoundingSphere();
    if (combined.computeBoundsTree && combined.attributes.position.count > 150) {
      combined.computeBoundsTree();
    }

    const chunk = new THREE.Mesh(combined, bucket.mat);
    chunk.castShadow = bucket.castShadow;
    chunk.receiveShadow = bucket.receiveShadow;
    chunk.matrixAutoUpdate = false;
    chunk.updateMatrix();
    mergedGroup.add(chunk);
    mergedChunkCount++;

    for (let i = 0; i < okMeshes.length; i++) {
      const orig = okMeshes[i];
      const origGeo = orig.geometry;
      if (orig.parent) orig.parent.remove(orig);
      if (origGeo) {
        const left = (geoRefCounts.get(origGeo) || 1) - 1;
        geoRefCounts.set(origGeo, left);
        if (left <= 0 && !origGeo.boundsTree && !(origGeo.userData && origGeo.userData.shared)) origGeo.dispose();
      }
      mergedSourceCount++;
    }
  });

  if (mergedChunkCount > 0) {
    scene.add(mergedGroup);
    mergedGroup.updateMatrixWorld(true);
    sim.staticMergedGroup = mergedGroup;
  }
  return mergedSourceCount;
}

export function freezeStaticWorld(sim) {
  if (!sim || !sim.scene) return 0;
  const scene = sim.scene;

  scene.updateMatrixWorld(true);

  const dynamicObjects = collectDynamicObjects(sim);
  const protectedMaterials = collectProtectedMaterials(sim);

  // 1. Virtualiza PointLights em um pool fixo de 4 luzes
  const virtualizedLights = installPointLightPool(sim, dynamicObjects);

  // 2. Mescla geometrias estáticas opacas em chunks espaciais de 32x32m
  const mergedCount = mergeStaticWorld(sim, dynamicObjects, protectedMaterials);

  // 3. Congela matrizes estáticas e calcula BVH nas malhas estáticas densas restantes (ex.: terreno)
  let frozenCount = 0;
  scene.traverse((obj) => {
    if (!obj || !obj.isMesh) return;
    if (obj.isCamera || obj === sim.camera || obj === scene) return;
    if (dynamicObjects.has(obj)) return;
    if (obj.userData && (obj.userData.isDynamic || obj.userData.keepDynamic)) return;

    obj.matrixAutoUpdate = false;
    const posAttr = obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position;
    if (posAttr && posAttr.count > 300 && obj.geometry.computeBoundsTree && !obj.geometry.boundsTree) {
      obj.geometry.computeBoundsTree();
    }
    frozenCount++;
  });

  if (sim) {
    sim._mergedStaticCount = mergedCount;
    sim._virtualLightCount = virtualizedLights;
  }
  return frozenCount;
}
