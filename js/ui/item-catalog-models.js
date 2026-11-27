import THREE from '../vendor/three-global.js';
import { createProceduralTextures } from '../engine/textures.js';
import { buildCampusWingsAndEquipment } from '../world/lab-tools.js';
import { createGardenModels, makeSubstrateBox } from '../world/campus-garden-models.js';
import { makeOrganicGardenBasket } from '../world/campus-garden.js';
import { MUSHROOM_SPECIES_CATALOG, createMushroomMeshBySpeciesName } from '../world/mushroom-species.js';
import { buildAvatarHat } from '../entities/avatars.js';
import { buildSnowboardRig } from '../entities/vehicles/snowboard.js';
import { createParagliderWingMesh } from '../entities/vehicles/paraglider.js';
import { registerPickable } from '../items/item-registry.js';
import { listItemPrefabs, spawnItemFromPrefab } from '../items/item-prefabs.js';
import { getCanonicalItemTitle, getItemFamily } from '../items/item-titles.js';
import { getCatalogPreview } from './item-catalog-preview.js';
import { ensureCoreAdminPrefabs } from '../systems/admin-editor.js';
import { COSMETIC_HATS, COSMETIC_TOYS } from './modal-shop.js';
import { t } from '../core/i18n.js';

const GROUPS = {
  equipment: ['equipment', 'device', 'station', 'appliance', 'machine', 'fruiting_chamber', 'sterilization', 'storage_equipment', 'analytical_equipment', 'heating'],
  tools: ['tool', 'tools', 'instrument', 'consumable', 'sanitization', 'sterilization_tool', 'sterilization_accessory', 'hydration', 'ppe', 'inoculation'],
  containers: ['glassware', 'container', 'containers', 'storage', 'packaging', 'tray', 'storage_jar', 'storage_case', 'spawn_container', 'tube', 'carrier', 'mixing', 'water_source'],
  cultivation: ['spawn', 'substrate', 'culture', 'reagent', 'ingredient', 'specimen', 'spent_substrate', 'nutrient', 'culture_liquid', 'liquid_culture', 'solid_culture', 'culture_plate', 'dried_harvest'],
  furniture: ['furniture', 'support'],
  garden: ['produce', 'gardening'],
  cosmetics: [],
  mushrooms: []
};

function groupFor(raw) {
  return Object.keys(GROUPS).find(key => GROUPS[key].includes(raw)) || 'other';
}

function makeCatalogContext() {
  const context = {
    scene: new THREE.Scene(), pickableMap: new Map(), clock: { elapsedTime: 0 },
    isTouchDevice: () => false, getHeldItem: () => null, isHeldByRemote: () => false,
    setHoodAirData: () => {}, ensureThermoTex: () => null
  };
  for (const key of [
    'solidColliders', 'wallSegments', 'walkableFloors', 'stairsList', 'supportSurfaces',
    'supportMeshes', 'pickableItems', 'campusDoors', 'doorHitMeshes', 'windowBlinds',
    'blindHitMeshes', 'seatMeshes', 'chalkboards', 'chalkboardMeshes', 'lightSwitchMeshes',
    'campusLightSwitches', 'roofZones', 'hoodSwitchMeshes', 'cookerPots', 'burnerDevices',
    'burnerSwitchMeshes', 'labSinks', 'labSinkMeshes', 'labTrashMeshes', 'labCabinets',
    'cabinetHitMeshes', 'cabinetLedMats', 'dehydrators', 'spawnGrowItems', 'scaleTareMeshes',
    'scaleDevices', 'stirSwitchMeshes', 'stirrerDevices', 'falconItems', 'ampouleCases'
  ]) context[key] = [];
  context.registerPickable = (...args) => registerPickable(context, ...args);
  return context;
}

function modelLabel(label) {
  return String(label).replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

export function getCatalogEntries() {
  const context = makeCatalogContext();
  const entries = new Map();

  function add(id, label, category, getView, detail = '', keywords = '') {
    const name = modelLabel(label);
    if (!name || entries.has(id)) return;
    let view;
    entries.set(id, { id, name, category, detail, keywords, model: () => (view ||= getView()).model,
      view: () => (view ||= getView()) });
  }

  function addItem(id, label, category, makeItem, detail = '', keywords = '') {
    add(id, getCanonicalItemTitle(id) || label, category, () => {
      const item = makeItem();
      return getCatalogPreview(item);
    }, detail, keywords);
  }

  function addStatic(id, label, category, makeModel, detail = '') {
    add(id, label, category, () => ({ model: makeModel() }), detail);
  }

  ensureCoreAdminPrefabs();
  const meshItems = new Map();
  try {
    createProceduralTextures();
    buildCampusWingsAndEquipment(context, { includeOutdoor: false });
  } catch (error) {
    console.error('Catálogo: erro ao montar itens fixos do campus.', error);
  }
  for (const item of context.pickableItems) {
    if (!item.mesh) continue;
    const family = getItemFamily(item);
    if (!meshItems.has(family)) meshItems.set(family, []);
    meshItems.get(family).push(item);
  }
  for (const def of listItemPrefabs()) {
    const copies = meshItems.get(def.prefabId) || [];
    addItem(def.prefabId, def.label, groupFor(copies[0]?.meta?.category || def.category),
      () => spawnItemFromPrefab(context, def.prefabId, { id: 'preview_' + def.prefabId }),
      copies[0]?.meta?.purpose || '', def.label);
  }

  const garden = createGardenModels(THREE);
  addStatic('organic_basket', t('catalog.basket'), 'garden', () => makeOrganicGardenBasket(context, 0, 0, 0, 'preview_basket').mesh);
  addStatic('lettuce', t('catalog.lettuce'), 'garden', garden.makeLettuce);
  addStatic('tomato', t('catalog.tomato'), 'garden', () => {
    const { stake, foliage } = garden.makeTomato();
    const plant = new THREE.Group();
    plant.add(stake, foliage);
    return plant;
  });
  addStatic('substrate_box', t('catalog.substrate'), 'garden', () => {
    const { group, fill } = makeSubstrateBox(THREE, 1.35, 0.68, 1.15);
    fill.position.y = 0.45;
    return group;
  });

  for (const { id, name } of COSMETIC_HATS) {
    addStatic(id, name, 'cosmetics', () => {
      const hat = new THREE.Group();
      buildAvatarHat(id, new THREE.MeshStandardMaterial({ color: 0xe59982 }), hat);
      return hat;
    });
  }
  for (const { id, name } of COSMETIC_TOYS) {
    addStatic(id, name, 'cosmetics', () => {
      if (id.includes('snowboard')) {
        let board;
        buildSnowboardRig({ scene: context.scene, getSnowboardGroup: () => board, setSnowboardGroup: (value) => { board = value; } });
        return board;
      }
      return createParagliderWingMesh(1);
    });
  }
  for (const species of MUSHROOM_SPECIES_CATALOG) {
    addStatic(species.scientific, species.common, 'mushrooms', () => createMushroomMeshBySpeciesName(species.scientific), species.scientific);
  }

  for (const [family, copies] of meshItems) {
    const item = copies.find(copy => copy.id === family) || copies[0];
    addItem(family, item.label, groupFor(item.meta?.category), () => item, item.meta?.purpose);
  }

  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
}
