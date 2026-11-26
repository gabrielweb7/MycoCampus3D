import { registerPickable, disposeObjectResources, getCachedCanvasTexture } from './item-registry.js';
import { emptySpawnContainer, isFruitingBagReady } from './spawn-containers.js';
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
  const shell = material(kind === 'grow_humidifier' ? 0xeee9dc : 0x454c50, { metalness: 0.18 });
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
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.3, 14), shell);
  body.position.y = 0.15;
  group.add(body);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 14), dark);
  lip.position.y = 0.31;
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

function buildTent() {
  const THREE = window.THREE;
  const group = new THREE.Group();
  const cloth = material(0x242625);
  const piping = material(0x829d47);
  const lining = material(0xc3c7c8, { metalness: 0.26 });
  const steel = material(0x42484a);
  const floor = material(0x777c79);
  const led = material(0xf6efd3, { emissive: 0xffefb9, emissiveIntensity: 1.35 });
  const silver = material(0xb6b9b8, { metalness: 0.55, roughness: 0.45 });
  box(group, cloth, 1.77, 0.09, 0.89, 0, 2.29, 0);
  box(group, floor, 1.77, 0.1, 0.89, 0, 0.075, 0);
  box(group, cloth, 1.77, 2.13, 0.05, 0, 1.18, -0.425);
  box(group, lining, 1.68, 2.12, 0.02, 0, 1.18, -0.391);
  for (const side of [-1, 1]) {
    box(group, cloth, 0.048, 2.16, 0.89, side * 0.86, 1.18, 0);
    box(group, lining, 0.016, 2.1, 0.81, side * 0.826, 1.18, 0);
    box(group, piping, 0.035, 2.25, 0.035, side * 0.859, 1.17, 0.444);
  }
  for (const y of [0.12, 2.25]) box(group, piping, 1.72, 0.03, 0.035, 0, y, 0.444);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.071, 0.071, 1.65, 10), lining);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 2.15, 0.416);
  group.add(roll);
  for (const x of [-0.55, 0.55]) box(group, cloth, 0.064, 0.14, 0.15, x, 2.15, 0.416);
  box(group, led, 1.3, 0.034, 0.1, 0, 2.225, -0.05);
  box(group, steel, 0.25, 0.17, 0.05, 0.73, 1.94, 0.46);
  box(group, material(0x173a33, { emissive: 0x236852, emissiveIntensity: 0.55 }), 0.185, 0.09, 0.009, 0.73, 1.956, 0.489);

  const slotVisuals = [];
  const cakeMat = material(0xd7bd95, { flatShading: true });
  const trunkMat = material(0xf4dfbf);
  const capMat = material(0xb97c3c, { flatShading: true });
  const trayGeo = new THREE.CylinderGeometry(0.16, 0.145, 0.033, 12);
  const cakeGeo = new THREE.CylinderGeometry(0.109, 0.12, 0.13, 10);
  const stemGeo = new THREE.CylinderGeometry(0.014, 0.021, 0.11, 7);
  const capGeo = new THREE.SphereGeometry(0.055, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.53);
  for (const y of shelfLevels) {
    for (let i = 0; i < 9; i++) box(group, steel, 1.63, 0.027, 0.017, 0, y, -0.34 + 0.085 * i);
    for (const x of [-0.79, 0, 0.79]) box(group, steel, 0.042, 0.043, 0.74, x, y, 0);
    for (const x of [-0.52, 0, 0.52]) {
      const tray = new THREE.Mesh(trayGeo, steel);
      tray.position.set(x, y + 0.027, 0.03);
      group.add(tray);
      const cake = new THREE.Mesh(cakeGeo, cakeMat);
      cake.position.set(x, y + 0.11, 0.03);
      group.add(cake);
      const mushrooms = new THREE.Group();
      mushrooms.position.set(x, y + 0.17, 0.03);
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
      group.add(mushrooms);
      slotVisuals.push({ cake, mushrooms });
    }
  }

  const humidifier = buildModule('grow_humidifier');
  const exhaust = buildModule('grow_exhaust');
  humidifier.group.position.set(1.13, 0.04, 0.16);
  exhaust.group.position.set(-1.13, 0.04, -0.03);
  tube(humidifier.group, silver, [[0, 0.32, 0], [0, 0.95, 0], [-0.07, 1.2, 0], [-0.29, 1.28, 0]]);
  tube(exhaust.group, silver, [[0, 0.31, 0], [0.07, 0.39, -0.075], [0.2, 0.37, -0.115], [0.32, 0.32, -0.115], [0.49, 0.32, -0.115]]);
  group.add(humidifier.group, exhaust.group);

  const mist = new THREE.Group();
  const mistMat = material(0xb9f0ff, { transparent: true, opacity: 0.24, depthWrite: false });
  const mistGeo = new THREE.IcosahedronGeometry(0.04, 0);
  for (let i = 0; i < 14; i++) mist.add(new THREE.Mesh(mistGeo, mistMat));
  group.add(mist);
  return { group, slotVisuals, led, humidifier, exhaust, mist };
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
  view.group.scale.set(0.89, 1.16, 1);
  view.group.userData.twoHanded = true;
  view.group.userData.isRack = true;
  const grow = {
    auto: true, led: true, humidity: 64, air: 70,
    humidifier: false, exhaust: false, mistOn: false, fanOn: false,
    slots: Array(CAPACITY).fill(null), view
  };
  const item = registerPickable(ctx, id, opts.label || GROW_PREFABS[kind], view.group, opts.x, opts.y, opts.z, opts.ry, 0.84, 2.71, {
    category: 'equipment',
    weightGrams: 9500,
    serializeState: () => ({
      grow: {
        auto: grow.auto, led: grow.led, humidifier: grow.humidifier, exhaust: grow.exhaust,
        mistOn: grow.mistOn, fanOn: grow.fanOn, slots: grow.slots.map(slot => slot && { ...slot })
      }
    }),
    applyState: (_item, custom) => {
      const saved = custom?.grow;
      if (!saved) return;
      for (const key of ['auto', 'led', 'humidifier', 'exhaust', 'mistOn', 'fanOn']) {
        if (typeof saved[key] === 'boolean') grow[key] = saved[key];
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

function updateGrow(grow, dt, now) {
  const { view } = grow;
  const vapor = grow.humidifier && (grow.auto || grow.mistOn);
  const fan = grow.exhaust && (grow.auto || grow.fanOn);
  grow.humidity += ((vapor ? 88 : 64) - grow.humidity) * Math.min(1, dt * 0.3);
  grow.air += ((fan ? 94 : 70) - grow.air) * Math.min(1, dt * 0.25);
  view.led.emissiveIntensity = grow.led ? 1.35 : 0;
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
    if (item.growCtrl) updateGrow(item.growCtrl, dt, now);
  }
}

export function growHeldAction(item) {
  if (item?.growModule) return t('grow.connect');
  if (isFruitingBagReady(item)) return t('grow.load');
  return '';
}

function sync(ctx, item) {
  ctx.queueItemStateSync?.(item);
  ctx.notifyWorldAction?.();
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
  if (!grow || item.isReadOnly || held.isReadOnly || !growHeldAction(held)) return false;
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
    emptySpawnContainer(held);
    ctx.queueItemStateSync?.(held);
    ctx.callbacks?.onHoldChange?.(held.label);
    toast?.(t('grow.loaded'));
  }
  updateGrow(grow, 0, Date.now());
  sync(ctx, item);
  return true;
}

function takeFromSlot(ctx, item, index) {
  const grow = item.growCtrl;
  const slot = grow.slots[index];
  if (!slot || ctx.heldItem || item.isReadOnly || item._removedForSync || ctx.isHeldByRemote?.(item.id)) return false;
  if (!slot.spent && Date.now() < slot.started + slot.duration) return false;
  const stamp = Date.now().toString(36);
  let held;
  if (slot.spent) {
    const { x, y, z } = item.mesh.position;
    held = makeSpentCakeItem(ctx, 'spent_cake_' + stamp, slot.species, x, y + 0.4, z);
    if (!held) return false;
    grow.slots[index] = null;
    ctx.queueItemStateSync?.(held);
  } else {
    const isMagic = /psilocybe|cubensis|golden teacher/i.test(slot.species);
    held = spawnPersistedWildMushroom(ctx, 'harvest_gh_' + stamp, { speciesName: slot.species, isMagic, grams: 10 });
    if (!held) return false;
    grow.slots[index] = slot.flush >= 4 ? { ...slot, spent: true } : beginFlush(grow, slot.species, slot.flush + 1);
    ctx.callbacks?.onHarvestMushroom?.('portable_' + item.id + '_' + index + '_' + slot.started);
    window.MycoAudio?.playHarvest?.();
  }
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
  dialog.className = 'portable-grow-panel';
  const title = document.createElement('h2');
  title.textContent = GROW_PREFABS.grow_tent;
  const status = document.createElement('p');
  const controls = document.createElement('div');
  const slots = document.createElement('div');
  slots.className = 'portable-grow-slots';
  function button(parent, action) {
    const node = document.createElement('button');
    node.type = 'button';
    node.addEventListener('click', action);
    parent.append(node);
    return node;
  }
  function toggle(key) {
    if (item.isReadOnly || item._removedForSync || ctx.isHeldByRemote?.(item.id)) return;
    grow[key] = !grow[key];
    retimeFlushes(grow);
    updateGrow(grow, 0, Date.now());
    sync(ctx, item);
    refresh();
  }
  const auto = button(controls, () => toggle('auto'));
  const led = button(controls, () => toggle('led'));
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
        if (takeFromSlot(ctx, item, index)) dialog.close();
      });
    }
    slots.append(row);
  }
  const close = button(dialog, () => dialog.close());
  close.textContent = t('grow.close');
  dialog.prepend(title, status, controls, slots);
  function refresh() {
    const onOff = (value) => t(value ? 'grow.on' : 'grow.off');
    const moduleState = (installed, enabled) => t(!installed ? 'grow.absent' : grow.auto ? 'grow.auto' : enabled ? 'grow.on' : 'grow.off');
    status.textContent = t('grow.status', { humidity: Math.round(grow.humidity), air: Math.round(grow.air) });
    auto.textContent = t(grow.auto ? 'grow.auto' : 'grow.manual');
    led.textContent = 'LED · ' + onOff(grow.led);
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
      slotButtons[i].disabled = !slot || (!slot.spent && progress < 100);
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
