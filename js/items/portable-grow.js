import { registerPickable, disposeObjectResources, getCachedCanvasTexture, bindPngTexture } from './item-registry.js';
import { emptySpawnContainer, isBulkSubstrate, isFruitingBagReady } from './spawn-containers.js';
import { makeSpentCakeItem } from './monotub.js';
import { spawnPersistedWildMushroom } from '../systems/world-interactions.js';
import { releaseInputForModal } from '../ui/dom-helpers.js';
import { t } from '../core/i18n.js';

export const GROW_PREFABS = {
  grow_tent: '🌱 Grow ESP32',
  grow_humidifier: '💧 Umidificador para Grow',
  grow_exhaust: '🌀 Exaustor para Grow'
};

const CAPACITY = 9;
const FLUSH_MS = 90000;
const DOOR_HEIGHT = 2.08;
const shelfLevels = [0.37, 1.04, 1.71];
const positiveNumber = (value, max) => Math.min(max, Math.max(0, Number(value) || 0));

function material(color, props = {}) {
  return new window.THREE.MeshStandardMaterial({ color, roughness: 0.72, ...props });
}

function box(parent, mat, w, h, d, x, y, z) {
  const THREE = window.THREE;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function tube(parent, mat, points) {
  const THREE = window.THREE;
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  parent.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.055, 9, false), mat));
  const rib = new THREE.TorusGeometry(0.056, 0.006, 5, 10);
  const axis = new THREE.Vector3(0, 0, 1);
  const ribs = new THREE.InstancedMesh(rib, mat, 37);
  const band = new THREE.Object3D();
  for (let i = 0; i < ribs.count; i++) {
    const fraction = i / 36;
    band.position.copy(curve.getPoint(fraction));
    band.quaternion.setFromUnitVectors(axis, curve.getTangent(fraction));
    band.updateMatrix();
    ribs.setMatrixAt(i, band.matrix);
  }
  parent.add(ribs);
}

function buildModule(kind) {
  const THREE = window.THREE;
  const group = new THREE.Group();
  const dark = material(0x252a2d);
  const shell = material(kind === 'grow_humidifier' ? 0xe8e0ce : 0x454c50, { metalness: 0.18 });
  if (kind === 'grow_humidifier') {
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.165, 0.13, 14), material(0x71cbd5));
    water.position.y = 0.165;
    group.add(water);
    const map = getCachedCanvasTexture('grow_humidifier_h2o', 128, 64, canvas => {
      canvas.fillStyle = '#1e434e';
      canvas.font = 'bold 45px sans-serif';
      canvas.textAlign = 'center';
      canvas.textBaseline = 'middle';
      canvas.fillText('H₂O', 64, 34);
    });
    if (map) {
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.133, 0.064), new THREE.MeshBasicMaterial({ map, transparent: true }));
      label.position.set(0, 0.165, 0.167);
      group.add(label);
    }
  }
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, kind === 'grow_humidifier' ? 0.11 : 0.3, 14), shell);
  body.position.y = kind === 'grow_humidifier' ? 0.055 : 0.15;
  group.add(body);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.163, 0.074, 14), kind === 'grow_humidifier' ? shell : dark);
  lip.position.y = 0.267;
  group.add(lip);
  const status = material(0x53d7bd, { emissive: 0x32d1b1, emissiveIntensity: 0 });
  box(group, status, 0.046, 0.018, 0.018, 0, 0.07, 0.162);
  const rotor = new THREE.Group();
  rotor.position.set(0, 0.18, 0.165);
  if (kind === 'grow_exhaust') {
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Group();
      blade.rotation.z = i * 2 * Math.PI / 5;
      box(blade, dark, 0.035, 0.095, 0.012, 0.015, 0.045, 0);
      rotor.add(blade);
    }
    group.add(rotor);
  }
  return { group, rotor, status };
}

function roundedOutline(path, width, height, radius) {
  const x = width * 0.5;
  const y = height * 0.5;
  path.moveTo(-x + radius, -y);
  path.lineTo(x - radius, -y);
  path.quadraticCurveTo(x, -y, x, -y + radius);
  path.lineTo(x, y - radius);
  path.quadraticCurveTo(x, y, x - radius, y);
  path.lineTo(-x + radius, y);
  path.quadraticCurveTo(-x, y, -x, y - radius);
  path.lineTo(-x, -y + radius);
  path.quadraticCurveTo(-x, -y, -x + radius, -y);
  return path;
}

function frontFrame(THREE, mat, width, height, edge, depth) {
  const outline = roundedOutline(new THREE.Shape(), width, height, 0.105);
  outline.holes.push(roundedOutline(new THREE.Path(), width - 2 * edge, height - 2 * edge, 0.067));
  const geo = new THREE.ExtrudeGeometry(outline, {
    depth, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 4
  });
  return new THREE.Mesh(geo, mat);
}

function makeTravelBag(THREE, cloth, trim) {
  const bag = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.108, 0.36, 5, 14), cloth);
  shell.rotation.z = Math.PI / 2;
  shell.position.y = 0.11;
  bag.add(shell);
  const strapGeo = new THREE.TorusGeometry(0.109, 0.012, 6, 18);
  for (const x of [-0.15, 0.15]) {
    const strap = new THREE.Mesh(strapGeo, trim);
    strap.rotation.y = Math.PI / 2;
    strap.position.set(x, 0.11, 0);
    bag.add(strap);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.012, 6, 16, Math.PI), trim);
  handle.position.y = 0.207;
  bag.add(handle);
  bag.visible = false;
  bag.userData.hideInPlacement = true;
  return bag;
}

function buildTent() {
  const THREE = window.THREE;
  const itemRoot = new THREE.Group();
  const group = new THREE.Group();
  group.userData.visibleInPlacement = true;
  itemRoot.add(group);
  const cloth = material(0x777674, { roughness: 0.96 });
  const piping = material(0x687d3b, { roughness: 0.88 });
  const seam = material(0xc6ad71, { roughness: 0.9 });
  const lining = material(0xd7d1c4, { roughness: 0.56, metalness: 0.17, emissive: 0xcdb890, emissiveIntensity: 0.12 });
  const steel = material(0x55534d, { roughness: 0.46, metalness: 0.28 });
  const floor = material(0x8d897f);
  const led = material(0xffebc1, { emissive: 0xffdeb0, emissiveIntensity: 1.35 });
  const silver = material(0xc1c2bc, { metalness: 0.38, roughness: 0.36 });
  if (typeof document !== 'undefined') {
    bindPngTexture('assets/textures/grow-ripstop.jpg', cloth, { repeatX: 2, repeatY: 3 });
    bindPngTexture('assets/textures/grow-foil.jpg', lining, { repeatX: 1, repeatY: 2 });
  }
  const carry = makeTravelBag(THREE, cloth, piping);
  itemRoot.add(carry);

  box(group, cloth, 1.15, 0.075, 0.76, 0, 2.274, -0.018);
  box(group, cloth, 1.15, 0.08, 0.76, 0, 0.084, -0.018);
  box(group, cloth, 1.15, 2.19, 0.05, 0, 1.18, -0.386);
  box(group, lining, 1.08, 2.13, 0.017, 0, 1.18, -0.351);
  box(group, lining, 1.08, 0.025, 0.72, 0, 0.132, -0.01);
  box(group, lining, 1.08, 0.018, 0.72, 0, 2.225, -0.01);
  for (const side of [-1, 1]) {
    box(group, cloth, 0.047, 2.16, 0.76, side * 0.565, 1.18, -0.018);
    box(group, lining, 0.017, 2.1, 0.70, side * 0.534, 1.18, -0.01);
    for (const z of [-0.30, 0.28]) {
      box(group, floor, 0.105, 0.07, 0.105, side * 0.47, 0.035, z);
    }
    box(group, steel, 0.023, 2.02, 0.022, side * 0.503, 1.17, -0.301);
  }
  const frame = frontFrame(THREE, cloth, 1.18, 2.25, 0.091, 0.038);
  frame.position.set(0, 1.179, 0.35);
  group.add(frame);
  const binding = frontFrame(THREE, piping, 1.181, 2.255, 0.021, 0.011);
  binding.position.set(0, 1.179, 0.391);
  group.add(binding);
  const zipper = frontFrame(THREE, floor, 1.041, 2.108, 0.011, 0.008);
  zipper.position.set(0, 1.178, 0.393);
  group.add(zipper);
  const stitchGeo = new THREE.BoxGeometry(0.003, 0.017, 0.004);
  const stitches = new THREE.InstancedMesh(stitchGeo, seam, 100);
  const stitch = new THREE.Object3D();
  for (let i = 0; i < 100; i++) {
    stitch.position.set(i < 50 ? -0.576 : 0.576, 0.165 + (i % 50) * 0.041, 0.407);
    stitch.updateMatrix();
    stitches.setMatrixAt(i, stitch.matrix);
  }
  group.add(stitches);
  const doorFlap = new THREE.Group();
  doorFlap.position.set(0, 2.22, 0.399);
  box(doorFlap, cloth, 1.017, DOOR_HEIGHT, 0.018, 0, -DOOR_HEIGHT / 2, 0);
  for (const x of [-0.486, 0.486]) box(doorFlap, piping, 0.015, DOOR_HEIGHT, 0.006, x, -DOOR_HEIGHT / 2, 0.01);
  box(doorFlap, piping, 1.016, 0.025, 0.006, 0, -DOOR_HEIGHT + 0.016, 0.01);
  group.add(doorFlap);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.059, 0.059, 1.00, 14), cloth);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 2.146, 0.365);
  group.add(roll);
  const doorStraps = new THREE.Group();
  for (const x of [-0.335, 0.335]) box(doorStraps, cloth, 0.045, 0.13, 0.126, x, 2.15, 0.363);
  group.add(doorStraps);
  box(group, steel, 0.85, 0.025, 0.106, 0, 2.152, 0.16);
  box(group, led, 0.80, 0.013, 0.055, 0, 2.133, 0.16);
  box(group, piping, 0.174, 0.113, 0.037, 0.493, 1.955, 0.412);
  const screenMap = getCachedCanvasTexture('portable_grow_display', 192, 96, ctx => {
    ctx.fillStyle = '#0b211f';
    ctx.fillRect(0, 0, 192, 96);
    ctx.fillStyle = '#b4f2d6';
    ctx.font = 'bold 34px monospace';
    ctx.fillText('ESP32', 13, 41);
    ctx.fillStyle = '#4addad';
    for (let i = 0; i < 4; i++) ctx.fillRect(16 + i * 20, 71 - i * 5, 12, 9 + i * 5);
  });
  box(group, new THREE.MeshBasicMaterial({ color: screenMap ? 0xffffff : 0x64a98c, map: screenMap }), 0.133, 0.073, 0.007, 0.493, 1.957, 0.434);

  const slotVisuals = [];
  const cakeMat = material(0xd7bd95, { flatShading: true });
  const trunkMat = material(0xf4dfbf);
  const capMat = material(0xb97c3c, { flatShading: true });
  const cakeGeo = new THREE.CylinderGeometry(0.096, 0.101, 0.13, 10);
  cakeGeo.translate(0, 0.065, 0);
  const stemGeo = new THREE.CylinderGeometry(0.014, 0.021, 0.11, 7);
  const capGeo = new THREE.SphereGeometry(0.055, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.53);
  for (const y of shelfLevels) {
    for (let i = 0; i < 9; i++) box(group, steel, 1.035, 0.023, 0.014, 0, y, -0.31 + 0.077 * i);
    for (const x of [-0.498, 0, 0.498]) box(group, steel, 0.032, 0.033, 0.69, x, y, 0);
    box(group, steel, 1.032, 0.041, 0.029, 0, y, 0.325);
    for (const x of [-0.34, 0, 0.34]) {
      const slotIndex = slotVisuals.length;
      const cake = new THREE.Mesh(cakeGeo, cakeMat);
      cake.userData.growSlotIndex = slotIndex;
      cake.position.set(x, y + 0.017, 0.03);
      group.add(cake);
      const mushrooms = new THREE.Group();
      mushrooms.position.set(x, y + 0.147, 0.03);
      for (let m = 0; m < 4; m++) {
        const fruit = new THREE.Group();
        fruit.position.set(Math.sin(m * 2.4) * 0.064, 0, Math.cos(m * 2.4) * 0.064);
        fruit.rotation.z = Math.sin(m * 2.4) * 0.2;
        fruit.scale.setScalar(0.66 + m * 0.15);
        const stem = new THREE.Mesh(stemGeo, trunkMat);
        const cap = new THREE.Mesh(capGeo, capMat);
        stem.position.y = 0.055;
        cap.position.y = 0.11;
        fruit.add(stem, cap);
        mushrooms.add(fruit);
      }
      mushrooms.traverse(part => { part.userData.growSlotIndex = slotIndex; });
      group.add(mushrooms);
      slotVisuals.push({ cake, mushrooms });
    }
  }

  const humidifier = buildModule('grow_humidifier');
  const exhaust = buildModule('grow_exhaust');
  humidifier.group.position.set(0.81, 0.04, 0.16);
  exhaust.group.position.set(-0.84, 0.04, -0.03);
  tube(humidifier.group, silver, [[0, 0.32, 0], [0, 0.95, 0], [-0.07, 1.2, 0], [-0.29, 1.28, 0]]);
  tube(exhaust.group, silver, [[0, 0.31, 0], [0.07, 0.39, -0.075], [0.2, 0.37, -0.115], [0.29, 0.32, -0.115]]);
  group.add(humidifier.group, exhaust.group);

  const mist = new THREE.Group();
  const mistMat = material(0xb9f0ff, { transparent: true, opacity: 0.24, depthWrite: false });
  const mistGeo = new THREE.IcosahedronGeometry(0.04, 0);
  for (let i = 0; i < 14; i++) mist.add(new THREE.Mesh(mistGeo, mistMat));
  group.add(mist);
  return { group: itemRoot, deployed: group, carry, slotVisuals, led, lining, humidifier, exhaust, mist,
    doorFlap, doorRoll: roll, doorStraps, doorProgress: 0 };
}

export function makeGrowShopItem(ctx, opts, kind) {
  const id = opts.id || ('dyn_' + kind + '_' + Date.now().toString(36));
  if (kind !== 'grow_tent') {
    const { group } = buildModule(kind);
    const item = registerPickable(ctx, id, opts.label || GROW_PREFABS[kind], group, opts.x, opts.y, opts.z, opts.ry, 0.18, 0.34);
    item.growModule = kind;
    return item;
  }
  const view = buildTent();
  view.group.userData.twoHanded = true;
  view.group.userData.isRack = true;
  const grow = {
    auto: true, led: true, doorClosed: false, humidity: 64, air: 70,
    humidifier: false, exhaust: false, mistOn: false, fanOn: false,
    slots: Array(CAPACITY).fill(null), view
  };
  const item = registerPickable(ctx, id, opts.label || GROW_PREFABS[kind], view.group, opts.x, opts.y, opts.z, opts.ry, 0.66, 2.32, {
    category: 'equipment',
    weightGrams: 9500,
    serializeState: () => ({
      grow: {
        auto: grow.auto, led: grow.led, doorClosed: grow.doorClosed, humidifier: grow.humidifier, exhaust: grow.exhaust,
        mistOn: grow.mistOn, fanOn: grow.fanOn, slots: grow.slots.map(slot => slot && { ...slot })
      }
    }),
    applyState: (_item, custom) => {
      const saved = custom?.grow;
      if (!saved) return;
      for (const key of ['auto', 'led', 'humidifier', 'exhaust', 'mistOn', 'fanOn']) {
        if (typeof saved[key] === 'boolean') grow[key] = saved[key];
      }
      if (typeof saved.doorClosed === 'boolean' && grow.doorClosed !== saved.doorClosed) {
        grow.doorClosed = saved.doorClosed;
        grow.view.doorProgress = Number(saved.doorClosed);
      }
      if (Array.isArray(saved.slots)) {
        for (let i = 0; i < CAPACITY; i++) {
          const slot = saved.slots[i];
          grow.slots[i] = slot?.species ? {
            species: String(slot.species).slice(0, 80),
            flush: Math.min(4, Math.max(1, Math.trunc(Number(slot.flush) || 1))),
            started: positiveNumber(slot.started, Date.now()),
            duration: positiveNumber(slot.duration, 3 * FLUSH_MS) || FLUSH_MS,
            spent: slot.spent === true
          } : null;
        }
      }
      updateGrow(grow, 0, Date.now());
    }
  });
  item.growCtrl = grow;
  updateGrow(grow, 0, Date.now());
  return item;
}

function updateGrow(grow, dt, now, ctx) {
  const { view } = grow;
  const vapor = grow.humidifier && (grow.auto || grow.mistOn);
  const fan = grow.exhaust && (grow.auto || grow.fanOn);
  const sealed = grow.doorClosed && !fan;
  const humidityTarget = vapor ? (sealed ? 93 : 88) : 64;
  const humidityRate = sealed && grow.humidity > humidityTarget ? 0.08 : 0.3;
  grow.humidity += (humidityTarget - grow.humidity) * Math.min(1, dt * humidityRate);
  grow.air += ((fan ? 94 : grow.doorClosed ? 50 : 70) - grow.air) * Math.min(1, dt * 0.25);
  const door = view.doorProgress = grow.doorClosed
    ? Math.min(1, view.doorProgress + dt * 2.4)
    : Math.max(0, view.doorProgress - dt * 2.4);
  view.doorFlap.visible = door > 0;
  view.doorFlap.scale.y = door;
  view.doorRoll.visible = door < 1;
  view.doorRoll.position.y = 2.146 - door * (DOOR_HEIGHT - 0.1);
  view.doorRoll.scale.x = view.doorRoll.scale.z = 1 - door * 0.7;
  view.doorStraps.visible = door === 0;
  const isNight = !!(ctx && ctx.sunElevation !== undefined && ctx.sunElevation < 0.08);
  const nightFactor = isNight ? Math.min(1, Math.max(0, (0.08 - ctx.sunElevation) / 0.25)) : 0;
  const targetLedIntensity = grow.led ? (1.35 + nightFactor * 0.75) : 0;
  const targetLiningIntensity = grow.led ? (0.16 + nightFactor * 0.12) : 0.015;
  const ledBlend = Math.min(1, dt * 3.0);
  view.led.emissiveIntensity += (targetLedIntensity - view.led.emissiveIntensity) * ledBlend;
  view.lining.emissiveIntensity += (targetLiningIntensity - view.lining.emissiveIntensity) * ledBlend;
  view.led.color.setHex(grow.led ? 0xf6efd3 : 0x5d605b);
  view.humidifier.group.visible = grow.humidifier;
  view.exhaust.group.visible = grow.exhaust;
  view.humidifier.status.emissiveIntensity = vapor ? 1.2 : 0;
  view.exhaust.status.emissiveIntensity = fan ? 1.2 : 0;
  if (fan) view.exhaust.rotor.rotation.z += dt * 14;
  view.mist.visible = vapor;
  if (vapor) {
    for (let i = 0; i < view.mist.children.length; i++) {
      const p = (now / 3000 + i / 14) % 1;
      view.mist.children[i].position.set(0.72 - p * 1.3, 1.3 - p * 0.9, Math.sin(i * 2.4 + p * 4) * 0.25);
      view.mist.children[i].scale.setScalar(Math.sin(p * Math.PI) * (1 + p * 2));
    }
  }
  for (let i = 0; i < CAPACITY; i++) {
    const slot = grow.slots[i];
    const { cake, mushrooms } = view.slotVisuals[i];
    const growth = slot ? Math.min(1, Math.max(0, (now - slot.started) / slot.duration)) : 0;
    cake.visible = !!slot;
    cake.scale.y = slot?.spent ? 0.68 : 1;
    mushrooms.visible = !!slot && !slot.spent && growth > 0.22;
    if (mushrooms.visible) mushrooms.scale.setScalar(Math.min(1, (growth - 0.18) / 0.82));
  }
}

export function stepPortableGrows(ctx, dt) {
  const now = Date.now();
  for (const item of ctx.pickableItems) {
    if (!item.growCtrl) continue;
    const carried = item === ctx.heldItem || !!ctx.isHeldByRemote?.(item.id);
    const { carry, deployed } = item.growCtrl.view;
    deployed.visible = !carried;
    carry.visible = carried;
    if (!carried) updateGrow(item.growCtrl, dt, now, ctx);
    const grow = item.growCtrl;
    if (grow.notifyHarvest) {
      let mask = 0;
      let count = 0;
      for (let i = 0; i < grow.slots.length; i++) {
        if (!isReady(grow.slots[i], now)) continue;
        mask |= 1 << i;
        if (grow.readyMask != null && !(grow.readyMask & (1 << i))) count++;
      }
      grow.readyMask = mask;
      if (count) ctx.callbacks?.onToast?.(t('grow.harvest_notice', { count }));
    }
  }
}

function isReady(slot, now) {
  return !!slot && !slot.spent && now >= slot.started + slot.duration;
}

export function countReadyGrowSlots(grow, now = Date.now()) {
  return grow.slots.reduce((count, slot) => count + Number(isReady(slot, now)), 0);
}

export function growSlotActionLabel(grow, index) {
  const slot = grow.slots[index];
  if (grow.doorClosed || !slot) return '';
  if (slot.spent) return t('grow.spent', { species: slot.species });
  return isReady(slot, Date.now()) ? t('grow.harvest', { species: slot.species, flush: slot.flush }) : '';
}

export function growHeldFeedback(item, grow) {
  const sc = item?.spawnCtrl;
  if (item?.growModule) return t('grow.connect');
  if (!sc?.isBag || !sc.filled) return '';
  if (sc.contaminated || sc.burned || sc.expired) return t('grow.bag_unusable');
  if (grow?.doorClosed) return t('grow.open_to_access');
  if (isFruitingBagReady(item)) return grow && !grow.slots.includes(null) ? t('grow.full') : t('grow.bag_place');
  if (!sc.pasteurized || !isBulkSubstrate(sc.substrateKind)) return t('grow.bag_needs_bulk');
  if (!sc.inoculated) return t('grow.bag_needs_spawn');
  if (!sc.shaken) return t('grow.bag_shake');
  return t('grow.bag_growing', { progress: Math.floor(sc.colonization || 0) });
}

function growHeldAction(item) {
  if (item?.growModule) return t('grow.connect');
  if (isFruitingBagReady(item)) return t('grow.load');
  return '';
}

function sync(ctx, item) {
  ctx.queueItemStateSync?.(item);
  ctx.notifyWorldAction?.();
}

export function growDoorActionLabel(grow) {
  return t(grow.doorClosed ? 'grow.open_door' : 'grow.close_door');
}

export function toggleGrowDoor(ctx, item) {
  const grow = item?.growCtrl;
  if (!grow || item.isReadOnly || item._removedForSync || ctx.isHeldByRemote?.(item.id) ||
      ctx.heldItem === item || ctx.inventory?.pending) return false;
  grow.doorClosed = !grow.doorClosed;
  window.MycoAudio?.playClick?.();
  sync(ctx, item);
  return true;
}

function flushDuration(grow) {
  const active = Number(grow.humidifier && (grow.auto || grow.mistOn)) +
    Number(grow.exhaust && (grow.auto || grow.fanOn)) + Number(grow.led);
  return Math.round(FLUSH_MS * (1.8 - active * 0.27));
}

function beginFlush(grow, species, flush) {
  return { species, flush, started: Date.now(), duration: flushDuration(grow), spent: false };
}

function retimeFlushes(grow) {
  const now = Date.now();
  const duration = flushDuration(grow);
  for (const slot of grow.slots) {
    if (!slot || slot.spent || now >= slot.started + slot.duration) continue;
    const fraction = Math.max(0, (now - slot.started) / slot.duration);
    slot.started = Math.round(now - fraction * duration);
    slot.duration = duration;
  }
}

export function installInGrow(ctx, item) {
  const held = ctx.heldItem;
  const grow = item.growCtrl;
  if (!grow || !held || item.isReadOnly || held.isReadOnly) return false;
  if (grow.doorClosed && held.spawnCtrl?.isBag && held.spawnCtrl.filled) {
    ctx.callbacks?.onToast?.(t('grow.open_to_access'));
    return true;
  }
  if (!growHeldAction(held)) {
    const feedback = growHeldFeedback(held, grow);
    if (!feedback) return false;
    ctx.callbacks?.onToast?.(feedback);
    return true;
  }
  const toast = ctx.callbacks?.onToast;
  if (held.growModule) {
    const key = held.growModule === 'grow_humidifier' ? 'humidifier' : 'exhaust';
    if (grow[key]) {
      toast?.(t('grow.already'));
      return true;
    }
    grow[key] = true;
    retimeFlushes(grow);
    ctx.markItemRemoved?.(held);
    held.mesh.removeFromParent();
    disposeObjectResources(held.mesh);
    const index = ctx.pickableItems.indexOf(held);
    if (index >= 0) ctx.pickableItems.splice(index, 1);
    ctx.pickableMap?.delete(held.id);
    ctx.heldItem = null;
    ctx.callbacks?.onHoldChange?.(null);
    toast?.(t('grow.connected'));
  } else {
    const index = grow.slots.indexOf(null);
    if (index < 0) {
      toast?.(t('grow.full'));
      return true;
    }
    const spawn = held.spawnCtrl;
    grow.slots[index] = beginFlush(grow, spawn.speciesName || 'Cogumelo', 1);
    if (!grow.notifyHarvest) grow.readyMask = null;
    else if (grow.readyMask != null) grow.readyMask &= ~(1 << index);
    grow.notifyHarvest = true;
    emptySpawnContainer(held);
    ctx.queueItemStateSync?.(held);
    ctx.callbacks?.onHoldChange?.(held.label);
    toast?.(t('grow.loaded'));
  }
  updateGrow(grow, 0, Date.now());
  sync(ctx, item);
  return true;
}

export function takeFromGrowSlot(ctx, item, index) {
  const grow = item.growCtrl;
  const slot = grow.slots[index];
  if (!slot || grow.doorClosed || ctx.heldItem || ctx.inventory?.pending ||
      item.isReadOnly || item._removedForSync || ctx.isHeldByRemote?.(item.id)) return false;
  if (!slot.spent && Date.now() < slot.started + slot.duration) return false;
  const stamp = Date.now().toString(36) + '_' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const { x, y, z } = item.mesh.position;
  let held;
  if (slot.spent) {
    held = makeSpentCakeItem(ctx, 'spent_cake_' + stamp, slot.species, x, y + 0.4, z);
    if (!held) return false;
    grow.slots[index] = null;
  } else {
    const isMagic = /psilocybe|cubensis|golden teacher/i.test(slot.species);
    held = spawnPersistedWildMushroom(ctx, 'harvest_gh_' + stamp, { speciesName: slot.species, isMagic, grams: 10 });
    if (!held) return false;
    held.mesh.position.set(x, y + 0.4, z);
    held.wildMushroomCtrl.bodyGroup.rotation.z = 0;
    held.wildMushroomCtrl.bodyGroup.position.y = 0;
    grow.slots[index] = slot.flush >= 4 ? { ...slot, spent: true } : beginFlush(grow, slot.species, slot.flush + 1);
    ctx.callbacks?.onHarvestMushroom?.('portable_' + item.id + '_' + index + '_' + slot.started);
    window.MycoAudio?.playHarvest?.();
  }
  held.isMoved = true;
  held.movedAt = performance.now();
  ctx.queueItemStateSync?.(held);
  ctx.heldItem = held;
  ctx.lastPickupAt = performance.now();
  ctx.callbacks?.onHoldChange?.(held.label);
  updateGrow(grow, 0, Date.now());
  sync(ctx, item);
  return true;
}

export function openPortableGrowPanel(ctx, item) {
  if (item.isReadOnly || item._removedForSync || document.getElementById('portable-grow-panel')) return;
  const grow = item.growCtrl;
  const dialog = document.createElement('dialog');
  dialog.id = 'portable-grow-panel';
  dialog.className = 'glass-panel portable-grow-panel';
  dialog.setAttribute('aria-labelledby', 'grow-panel-title');
  const header = document.createElement('header');
  header.className = 'grow-panel-header';
  const headerText = document.createElement('div');
  const title = document.createElement('h2');
  title.id = 'grow-panel-title';
  title.textContent = GROW_PREFABS.grow_tent;
  const subtitle = document.createElement('p');
  subtitle.textContent = t('grow.subtitle');
  headerText.append(title, subtitle);
  header.append(headerText);
  const body = document.createElement('div');
  body.className = 'grow-panel-body';
  const metrics = document.createElement('div');
  metrics.className = 'grow-metrics';
  const controls = document.createElement('div');
  controls.className = 'grow-device-controls';
  const modes = document.createElement('div');
  modes.className = 'grow-mode-controls';
  const slots = document.createElement('div');
  slots.className = 'portable-grow-slots';
  function button(parent, action) {
    const node = document.createElement('button');
    node.type = 'button';
    node.addEventListener('click', action);
    parent.append(node);
    return node;
  }
  function metric(label, accent) {
    const card = document.createElement('div');
    card.className = 'grow-metric';
    card.dataset.accent = accent;
    const caption = document.createElement('span');
    caption.textContent = label;
    const value = document.createElement('strong');
    const note = document.createElement('small');
    card.append(caption, value, note);
    metrics.append(card);
    return { value, note };
  }
  const humidity = metric('💧 ' + t('grow.humidity'), 'sky');
  const air = metric('🌬 ' + t('grow.air'), 'green');
  const light = metric('💡 LED Grow', 'violet');
  const capacity = metric('📦 ' + t('grow.shelves'), 'amber');

  function toggle(key) {
    if (item.isReadOnly || item._removedForSync || ctx.isHeldByRemote?.(item.id)) return;
    grow[key] = !grow[key];
    retimeFlushes(grow);
    updateGrow(grow, 0, Date.now());
    sync(ctx, item);
    refresh();
  }
  const auto = button(modes, () => { if (!grow.auto) toggle('auto'); });
  const manual = button(modes, () => { if (grow.auto) toggle('auto'); });
  auto.textContent = '🤖 ' + t('grow.auto');
  manual.textContent = '🎛 ' + t('grow.manual');
  const led = button(controls, () => toggle('led'));
  const door = button(controls, () => { if (toggleGrowDoor(ctx, item)) refresh(); });
  const notice = button(controls, () => {
    grow.notifyHarvest = !grow.notifyHarvest;
    grow.readyMask = null;
    refresh();
  });
  const mist = button(controls, () => toggle('mistOn'));
  const fan = button(controls, () => toggle('fanOn'));
  const slotButtons = [];
  for (let tier = 2; tier >= 0; tier--) {
    const row = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = t('grow.tier', { count: tier + 1 });
    row.append(legend);
    for (let col = 0; col < 3; col++) {
      const index = tier * 3 + col;
      slotButtons[index] = button(row, () => {
        if (takeFromGrowSlot(ctx, item, index)) dialog.close();
      });
    }
    slots.append(row);
  }
  const close = button(header, () => dialog.close());
  close.className = 'grow-close';
  close.textContent = '× ' + t('grow.close');
  body.append(metrics, modes, controls, slots);
  dialog.append(header, body);
  function refresh() {
    const onOff = (value) => t(value ? 'grow.on' : 'grow.off');
    const moduleState = (installed, enabled) => t(!installed ? 'grow.absent' : grow.auto ? 'grow.auto' : enabled ? 'grow.on' : 'grow.off');
    humidity.value.textContent = Math.round(grow.humidity) + '%';
    humidity.note.textContent = t(grow.doorClosed ? 'grow.door_closed' : 'grow.door_open') + ' · ' +
      t('grow.humidifier') + ' ' + moduleState(grow.humidifier, grow.mistOn);
    air.value.textContent = Math.round(grow.air) + '%';
    air.note.textContent = t('grow.exhaust') + ' · ' + moduleState(grow.exhaust, grow.fanOn);
    light.value.textContent = onOff(grow.led);
    light.note.textContent = t('grow.integrated');
    capacity.value.textContent = grow.slots.filter(Boolean).length + ' / ' + CAPACITY;
    capacity.note.textContent = t('grow.occupied');
    auto.setAttribute('aria-pressed', String(grow.auto));
    manual.setAttribute('aria-pressed', String(!grow.auto));
    led.textContent = 'LED · ' + onOff(grow.led);
    door.textContent = growDoorActionLabel(grow);
    door.setAttribute('aria-pressed', String(grow.doorClosed));
    notice.textContent = '🔔 ' + t(grow.notifyHarvest ? 'grow.notice_on' : 'grow.notice_off');
    notice.setAttribute('aria-pressed', String(!!grow.notifyHarvest));
    const ready = countReadyGrowSlots(grow);
    if (grow.doorClosed) capacity.note.textContent = t('grow.open_to_access');
    else if (ready) capacity.note.textContent = t('grow.ready_count', { count: ready });
    mist.textContent = t('grow.humidifier') + ' · ' + moduleState(grow.humidifier, grow.mistOn);
    fan.textContent = t('grow.exhaust') + ' · ' + moduleState(grow.exhaust, grow.fanOn);
    mist.disabled = !grow.humidifier || grow.auto;
    fan.disabled = !grow.exhaust || grow.auto;
    const now = Date.now();
    for (let i = 0; i < CAPACITY; i++) {
      const slot = grow.slots[i];
      const progress = slot ? Math.min(100, Math.max(0, Math.floor((now - slot.started) * 100 / slot.duration))) : 0;
      const action = !slot ? 'grow.empty' : slot.spent ? 'grow.spent' : progress === 100 ? 'grow.harvest' : 'grow.progress';
      slotButtons[i].textContent = t(action, { progress, species: slot?.species, flush: slot?.flush });
      slotButtons[i].disabled = grow.doorClosed || !slot || (!slot.spent && progress < 100);
      slotButtons[i].dataset.state = !slot ? 'empty' : slot.spent || progress === 100 ? 'ready' : 'growing';
    }
  }
  document.body.append(dialog);
  releaseInputForModal();
  refresh();
  const timer = setInterval(refresh, 500);
  dialog.addEventListener('close', () => {
    clearInterval(timer);
    dialog.remove();
  }, { once: true });
  dialog.showModal();
}
