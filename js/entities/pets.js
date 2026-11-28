/** Animated companions and their owner's bowls. */
import { appState } from '../core/state.js';
import { petAction } from '../services/pets.js';
import { getGroundHeight, clampPosAgainstWalls } from '../engine/physics.js';
import { makeTextSprite, updateTextSprite } from '../engine/textures.js';
import { triggerPettingAnimation, stepPettingHands } from './petting-hand.js';
import { t } from '../core/i18n.js';

const THREE = window.THREE;
let unitBox;
const materials = new Map();
let companion = null;
let ownerId = null;
const bowls = { food: null, water: null };
const BOWL_KINDS = ['food', 'water'];
const STAY_RADIUS = 4;
const remotePets = new Map();
let remoteSnapshots = [];
let remoteSnapshotIds = new Set();
const peePuddles = [];
let peeGeo = null;
let peeMat = null;
const petPoops = [];
let poopGeo = null;
let poopMat = null;

function spawnPetPoop(scene, x, y, z) {
  if (!scene || !THREE) return;
  if (!poopGeo) poopGeo = new THREE.ConeGeometry(0.085, 0.11, 8);
  if (!poopMat) poopMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const mesh = new THREE.Mesh(poopGeo, poopMat);
  mesh.position.set(x, y + 0.05, z);
  scene.add(mesh);
  petPoops.push({ mesh, age: 0, maxAge: 45 });
  while (petPoops.length > 4) {
    const old = petPoops.shift();
    if (old.mesh?.parent) old.mesh.parent.remove(old.mesh);
  }
}

function spawnPetPeePuddle(scene, x, y, z) {
  if (!THREE || !scene) return;
  if (!peeGeo) peeGeo = new THREE.CylinderGeometry(0.18, 0.21, 0.014, 14);
  if (!peeMat) peeMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.72
  });
  const mesh = new THREE.Mesh(peeGeo, peeMat);
  mesh.position.set(x, y + 0.012, z);
  mesh.scale.set(0.25, 1, 0.25);
  scene.add(mesh);
  peePuddles.push({ mesh, age: 0, maxAge: 22 });
  while (peePuddles.length > 4) {
    const old = peePuddles.shift();
    if (old?.mesh?.parent) old.mesh.parent.remove(old.mesh);
  }
}

function stepPetPeePuddles(dt) {
  for (let i = petPoops.length - 1; i >= 0; i--) {
    const pp = petPoops[i];
    pp.age += dt;
    if (pp.age >= pp.maxAge) {
      if (pp.mesh?.parent) pp.mesh.parent.remove(pp.mesh);
      petPoops.splice(i, 1);
    }
  }
  for (let i = peePuddles.length - 1; i >= 0; i--) {
    const p = peePuddles[i];
    p.age += dt;
    if (p.age >= p.maxAge) {
      if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
      peePuddles.splice(i, 1);
      continue;
    }
    if (p.age < 1.2) {
      const grow = 0.25 + (p.age / 1.2) * 0.75;
      p.mesh.scale.set(grow, 1, grow);
    } else if (p.age > p.maxAge - 5) {
      const dry = Math.max(0.04, (p.maxAge - p.age) / 5);
      p.mesh.scale.set(dry, 1, dry);
    } else {
      p.mesh.scale.set(1, 1, 1);
    }
  }
}

export function getLocalCompanionPet() {
  if (!companion || !companion.group || !companion.group.visible) return null;
  return companion;
}

export function petLocalCompanion(ctx) {
  const pet = getLocalCompanionPet();
  if (!pet || !ctx || !ctx.scene) return false;
  pet.loveUntil = performance.now() + 2600;
  pet.hopUntil = performance.now() + 900;
  pet.peeUntil = 0;
  triggerPettingAnimation(ctx.scene, pet.group, pet.id.startsWith('cat_') ? 0.92 : 0.98);
  if (typeof window !== 'undefined') {
    if (window.MycoAudio?.playClick) window.MycoAudio.playClick();
    if (window.triggerCampusHaptic) window.triggerCampusHaptic('light');
  }
  if (ctx.callbacks?.onToast) {
    ctx.callbacks.onToast(t('misc.pet.petted'));
  }
  return true;
}

export function getLocalPetPose() {
  if (!companion || companion.id !== appState.currentUser?.progress?.pets?.selected) return null;
  const p = companion.group.position;
  return { id: companion.id, x: p.x, y: p.y, z: p.z, yaw: companion.group.rotation.y, motion: companion.motion || 'idle' };
}

export function updateRemotePets(players) {
  remoteSnapshots = Array.isArray(players) ? players : [];
  remoteSnapshotIds = new Set(remoteSnapshots.filter(player => player?.id && player.pets).map(player => player.id));
}

function material(color) {
  if (!materials.has(color)) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
    mat.userData.shared = true;
    materials.set(color, mat);
  }
  return materials.get(color);
}
function box(parent, color, x, y, z, w, h, d) {
  if (!unitBox) { unitBox = new THREE.BoxGeometry(1, 1, 1); unitBox.userData.shared = true; }
  const mesh = new THREE.Mesh(unitBox, material(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  parent.add(mesh);
  return mesh;
}

function createAnimal(id) {
  const cat = id.startsWith('cat_');
  const orange = id === 'cat_orange';
  const black = id === 'cat_black';
  const calico = id === 'cat_calico';
  const husky = id === 'dog_husky';
  const pug = id === 'dog_pug';
  const fur = orange ? 0xe99935 : black ? 0x272730 : calico ? 0xf2eee4 : husky ? 0x59616b : pug ? 0xd8b88b : 0xe5ad45;
  const white = 0xf7f3e9;
  const dark = pug ? 0x211b1a : 0x272329;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const bodyHeight = pug ? 0.37 : 0.43;
  box(body, fur, 0, bodyHeight, -0.06, 0.43, 0.35, pug ? 0.55 : 0.62);
  if (calico || husky) {
    box(body, calico ? 0xe58a21 : white, 0.221, 0.46, -0.05, 0.014, 0.21, 0.29);
    box(body, calico ? 0x292123 : white, -0.221, 0.46, -0.17, 0.014, 0.20, 0.19);
  }
  if (orange) for (let i = 0; i < 3; i++) {
    box(body, 0xbf6720, 0.222, 0.48, -0.28 + i * 0.13, 0.014, 0.20, 0.045);
    box(body, 0xbf6720, -0.222, 0.48, -0.28 + i * 0.13, 0.014, 0.20, 0.045);
  }
  box(body, white, 0, 0.34, 0.254, 0.25, 0.18, 0.02);
  const head = new THREE.Group();
  const eyes = [];
  const glints = [];
  head.position.set(0, cat ? 0.57 : 0.59, 0.29);
  body.add(head);
  box(head, fur, 0, 0, 0, pug ? 0.42 : 0.43, 0.32, cat ? 0.28 : 0.32);
  if (calico) {
    box(head, 0xe38921, -0.115, 0.02, 0.146, 0.19, 0.28, 0.012);
    box(head, 0x342423, 0.115, 0.02, 0.146, 0.19, 0.28, 0.012);
  }
  for (const side of [-1, 1]) {
    if (cat || husky) {
      box(head, fur, side * 0.15, 0.19, -0.01, 0.11, 0.15, 0.10);
      box(head, cat ? 0xc68183 : 0xb0b5ba, side * 0.15, 0.19, 0.045, 0.062, 0.085, 0.01);
    } else {
      box(head, pug ? dark : 0xba7b2e, side * 0.23, 0.0, -0.02, 0.12, 0.24, 0.15);
    }
    const eyeColor = black ? 0xc4e535 : dark;
    eyes.push(box(head, eyeColor, side * 0.115, 0.035, cat ? 0.146 : 0.166, 0.065, 0.07, 0.013));
    glints.push(box(head, white, side * 0.105, 0.055, cat ? 0.154 : 0.174, 0.018, 0.021, 0.008));
  }
  box(head, pug ? dark : (black ? 0x444148 : (!cat && !husky ? 0xe5ad45 : white)), 0, -0.08, cat ? 0.17 : 0.21, pug ? 0.30 : 0.22, 0.13, cat ? 0.09 : 0.16);
  box(head, cat ? 0xd98998 : dark, 0, -0.055, cat ? 0.222 : 0.295, 0.067, 0.045, 0.018);
  if (!cat && !husky && !pug) box(head, 0xe77f8e, 0, -0.17, 0.255, 0.075, 0.08, 0.03);
  if (husky) {
    box(head, white, -0.18, -0.08, 0.17, 0.07, 0.16, 0.025);
    box(head, white, 0.18, -0.08, 0.17, 0.07, 0.16, 0.025);
  }
  const legs = [];
  for (const x of [-0.14, 0.14]) for (const z of [-0.25, 0.18]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.29, z);
    box(leg, fur, 0, -0.11, 0, 0.12, 0.22, 0.13);
    if (black || calico || husky) box(leg, white, 0, -0.20, 0.01, 0.125, 0.045, 0.14);
    body.add(leg);
    legs.push(leg);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.53, -0.37);
  tail.rotation.x = -0.72;
  body.add(tail);
  box(tail, fur, 0, pug ? 0.10 : 0.15, 0, 0.09, pug ? 0.20 : 0.34, 0.09);
  if (pug) {
    box(tail, fur, 0, 0.22, 0.045, 0.09, 0.08, 0.17);
    box(tail, fur, 0, 0.18, 0.11, 0.09, 0.10, 0.08);
  }
  if (orange) for (let i = 0; i < 2; i++) box(tail, 0xbf6720, 0, 0.09 + i * 0.11, 0.052, 0.092, 0.045, 0.01);
  if (husky || calico) box(tail, husky ? white : dark, 0, 0.31, 0, 0.095, 0.08, 0.095);
  const moodSprite = typeof document !== 'undefined' ? makeTextSprite('😊', '#fef08a') : null;
  if (moodSprite) {
    moodSprite.scale.set(0.48, 0.24, 1);
    moodSprite.position.set(0, 1.05, 0.12);
    moodSprite.visible = false;
    group.add(moodSprite);
  }
  return {
    group, body, head, legs, tail, eyes, glints, id, moodSprite,
    lastMoodEmoji: '',
    phase: 0, roamTimer: 0, targetX: 0, targetZ: 0, idleTime: 0, eatingTime: 0, stuck: 0, sidestep: 0, pending: false, retryAt: 0,
    followMoving: false,
    nextPeeAt: 35 + Math.random() * 28,
    peeUntil: 0,
    peeSpawned: false,
    nextPoopAt: 55 + Math.random() * 40,
    poopUntil: 0,
    poopSpawned: false,
    hunger: 20,
    nextCuriousAt: 12 + Math.random() * 10,
    curiousUntil: 0,
    loveUntil: 0,
    hopUntil: 0
  };
}

function createBowl(kind) {
  const group = new THREE.Group();
  const outer = kind === 'food' ? 0xe89563 : 0x67a9c2;
  box(group, outer, 0, 0.035, 0, 0.40, 0.07, 0.33);
  box(group, outer, 0, 0.09, -0.145, 0.40, 0.10, 0.04);
  box(group, outer, 0, 0.09, 0.145, 0.40, 0.10, 0.04);
  box(group, outer, -0.18, 0.09, 0, 0.04, 0.10, 0.25);
  box(group, outer, 0.18, 0.09, 0, 0.04, 0.10, 0.25);
  const contents = box(group, kind === 'food' ? 0x8d552d : 0x77d0ef, 0, 0.082, 0, 0.31, 0.025, 0.23);
  return { group, contents };
}
function removeAll() {
  if (companion?.group.parent) companion.group.parent.remove(companion.group);
  companion = null;
  for (const kind of BOWL_KINDS) {
    if (bowls[kind]?.group.parent) bowls[kind].group.parent.remove(bowls[kind].group);
    bowls[kind] = null;
  }
}
function updateBowl(ctx, kind, state) {
  if (!state?.owned || !state.pos) {
    if (bowls[kind]?.group.parent) bowls[kind].group.parent.remove(bowls[kind].group);
    bowls[kind] = null;
    return;
  }
  if (!bowls[kind]) { bowls[kind] = createBowl(kind); ctx.scene.add(bowls[kind].group); }
  bowls[kind].group.position.set(state.pos.x, state.pos.y, state.pos.z);
  bowls[kind].contents.visible = !!state.full;
}

function stepRemotePets(ctx, dt) {
  for (const player of remoteSnapshots) {
    if (!player?.id || !player.pets) continue;
    let entry = remotePets.get(player.id);
    if (!entry) { entry = { animal: null, food: null, water: null }; remotePets.set(player.id, entry); }
    const snapshot = player.pets.pet;
    if (entry.animal?.id !== snapshot?.id) {
      if (entry.animal?.group.parent) entry.animal.group.parent.remove(entry.animal.group);
      entry.animal = snapshot?.id ? createAnimal(snapshot.id) : null;
      if (entry.animal) {
        entry.animal.group.position.set(snapshot.x, snapshot.y, snapshot.z);
        ctx.scene.add(entry.animal.group);
      }
    }
    if (entry.animal && snapshot) {
      const animal = entry.animal;
      const pos = animal.group.position;
      animal.group.visible = Math.hypot(ctx.playerPos.x - snapshot.x, ctx.playerPos.z - snapshot.z) <= 60;
      const blend = 1 - Math.exp(-8 * dt);
      if (Math.hypot(pos.x - snapshot.x, pos.z - snapshot.z) > 15) pos.set(snapshot.x, snapshot.y, snapshot.z);
      else { pos.x += (snapshot.x - pos.x) * blend; pos.y += (snapshot.y - pos.y) * blend; pos.z += (snapshot.z - pos.z) * blend; }
      const turn = Math.atan2(Math.sin(snapshot.yaw - animal.group.rotation.y), Math.cos(snapshot.yaw - animal.group.rotation.y));
      animal.group.rotation.y += turn * blend;
      const walking = snapshot.motion === 'walk' || snapshot.motion === 'run';
      animal.phase += dt * (snapshot.motion === 'run' ? 12 : 7);
      const swing = walking ? Math.sin(animal.phase) * 0.43 : 0;
      animal.legs[0].rotation.x = swing; animal.legs[3].rotation.x = swing;
      animal.legs[1].rotation.x = -swing; animal.legs[2].rotation.x = -swing;
      animal.head.rotation.x = snapshot.motion === 'eat' ? 0.4 + Math.sin(performance.now() * 0.007) * 0.08 : 0;
      animal.tail.rotation.z = Math.sin(performance.now() * 0.004) * 0.25;
      animal.body.rotation.z = snapshot.motion === 'sleep' ? 0.4 : 0;
      animal.body.position.y = snapshot.motion === 'sleep' ? -0.12 : 0;
      for (const eye of animal.eyes) eye.scale.y = snapshot.motion === 'sleep' ? 0.008 : 0.07;
      for (const glint of animal.glints) glint.visible = snapshot.motion !== 'sleep';
    }
    for (const kind of BOWL_KINDS) {
      const bowl = player.pets.bowls?.[kind];
      if (!bowl) {
        if (entry[kind]?.group.parent) entry[kind].group.parent.remove(entry[kind].group);
        entry[kind] = null;
      } else {
        if (!entry[kind]) { entry[kind] = createBowl(kind); ctx.scene.add(entry[kind].group); }
        entry[kind].group.position.set(bowl.x, bowl.y, bowl.z);
        entry[kind].group.visible = Math.hypot(ctx.playerPos.x - bowl.x, ctx.playerPos.z - bowl.z) <= 60;
        entry[kind].contents.visible = !!bowl.full;
      }
    }
  }
  for (const [id, entry] of remotePets) if (!remoteSnapshotIds.has(id)) {
    if (entry.animal?.group.parent) entry.animal.group.parent.remove(entry.animal.group);
    if (entry.food?.group.parent) entry.food.group.parent.remove(entry.food.group);
    if (entry.water?.group.parent) entry.water.group.parent.remove(entry.water.group);
    remotePets.delete(id);
  }
}

export function stepPets(ctx, dt) {
  stepPettingHands(dt);
  stepPetPeePuddles(dt);
  const user = appState.currentUser;
  const state = user?.progress?.pets;
  if (ctx.scene && user) stepRemotePets(ctx, dt);
  else if (remotePets.size) { updateRemotePets([]); if (ctx.scene) stepRemotePets(ctx, dt); }
  if (!ctx.scene || !ctx.playerPos || !user || !state) { if (companion || bowls.food || bowls.water) removeAll(); ownerId = null; return; }
  if (ownerId !== user.id) { removeAll(); ownerId = user.id; }
  updateBowl(ctx, 'food', state.bowls?.food);
  updateBowl(ctx, 'water', state.bowls?.water);
  const anchor = state.mode === 'stay' ? state.anchor : null;
  if (companion?.id !== state.selected) {
    if (companion?.group.parent) companion.group.parent.remove(companion.group);
    companion = state.selected ? createAnimal(state.selected) : null;
    if (companion) {
      if (anchor) companion.group.position.set(anchor.x, anchor.y, anchor.z);
      else companion.group.position.set(ctx.playerPos.x + 1, ctx.playerPos.y, ctx.playerPos.z + 1);
      ctx.scene.add(companion.group);
    }
  }
  if (!companion || !ctx.inFps) return;
  const pet = companion;
  const pos = pet.group.position;
  if (pet.anchor !== anchor) {
    const previous = pet.anchor;
    pet.anchor = anchor;
    if (!anchor || !previous || previous.x !== anchor.x || previous.z !== anchor.z || previous.y !== anchor.y) {
      pet.roamTimer = 0;
    }
  }
  if (anchor && (Math.hypot(pos.x - anchor.x, pos.z - anchor.z) > STAY_RADIUS || Math.abs(pos.y - anchor.y) > 2)) {
    pos.set(anchor.x, anchor.y, anchor.z);
  }
  const now = Date.now();
  const food = state.bowls?.food;
  const water = state.bowls?.water;
  let need = null;
  if (pet.id.startsWith('cat_') && food?.full && canReachBowlFromAnchor(food.pos, anchor) && (state.next_food?.[pet.id] || 0) * 1000 <= now) need = 'food';
  else if (water?.full && canReachBowlFromAnchor(water.pos, anchor) && (state.next_water?.[pet.id] || 0) * 1000 <= now) need = 'water';
  let tx, tz, stop;
  if (need) {
    const target = state.bowls[need].pos;
    tx = target.x; tz = target.z; stop = 0.48;
    pet.followMoving = true;
  } else if (state.mode === 'follow') {
    tx = ctx.playerPos.x; tz = ctx.playerPos.z;
    const ownerDist = Math.hypot(tx - pos.x, tz - pos.z);
    if (ownerDist > 3.2) pet.followMoving = true;
    else if (ownerDist <= 1.75) pet.followMoving = false;
    stop = pet.followMoving ? 1.65 : 999;
  } else {
    pet.followMoving = false;
    pet.roamTimer -= dt;
    if (pet.roamTimer <= 0) {
      pet.roamTimer = 5 + Math.random() * 8;
      const nearOwner = !anchor && (Math.random() < 0.38 || Math.hypot(pos.x - ctx.playerPos.x, pos.z - ctx.playerPos.z) > 18);
      const base = anchor || (nearOwner ? ctx.playerPos : pos);
      const a = Math.random() * Math.PI * 2;
      const r = anchor ? 0.7 + Math.random() * 2.4 : (nearOwner ? 1.6 + Math.random() * 2 : 2 + Math.random() * 4);
      pet.targetX = base.x + Math.cos(a) * r;
      pet.targetZ = base.z + Math.sin(a) * r;
    }
    tx = pet.targetX; tz = pet.targetZ; stop = 0.35;
  }
  if (!need && state.mode === 'follow' && Math.hypot(pos.x - ctx.playerPos.x, pos.z - ctx.playerPos.z) > 30) {
    const oldX = pos.x, oldZ = pos.z;
    pos.set(ctx.playerPos.x + 1, ctx.playerPos.y, ctx.playerPos.z + 1);
    clampPosAgainstWalls(ctx.physCtx, pos, 0.23);
    if (anchor && Math.hypot(pos.x - anchor.x, pos.z - anchor.z) > STAY_RADIUS) {
      pos.x = oldX;
      pos.z = oldZ;
      pet.roamTimer = 0;
    }
    pos.y = getGroundHeight(ctx.physCtx, pos.x, pos.z, ctx.playerPos.y, null, ctx.playerPos.y + 0.5);
  }
  const dx = tx - pos.x, dz = tz - pos.z;
  const dist = Math.hypot(dx, dz);
  const nowPerf = performance.now();
  const isPeeing = pet.peeUntil > nowPerf;
  const isPooping = pet.poopUntil > nowPerf;
  const walking = !isPeeing && dist > stop;
  pet.motion = isPeeing ? 'pee' : (walking ? (need || dist > 6 ? 'run' : 'walk') : (need ? 'eat' : (pet.idleTime > 20 ? 'sleep' : (pet.idleTime > 1.5 ? 'sit' : 'idle'))));
  if (walking) {
    pet.idleTime = 0;
    pet.eatingTime = 0;
    pet.curiousUntil = 0;
    const speed = need || dist > 6 ? 3.1 : 1.3;
    const distance = Math.min(dist - stop, speed * dt);
    const oldX = pos.x, oldZ = pos.z;
    const side = pet.sidestep > 0 ? 0.95 : (pet.sidestep < 0 ? -0.95 : 0);
    pos.x += (dx / dist - dz / dist * side) * distance;
    pos.z += (dz / dist + dx / dist * side) * distance;
    clampPosAgainstWalls(ctx.physCtx, pos, 0.25);
    // Desvia de bancadas, capelas, estantes e geladeira para não atravessar objetos
    if (Array.isArray(ctx.pickableItems)) {
      for (let oi = 0; oi < ctx.pickableItems.length; oi++) {
        const ob = ctx.pickableItems[oi];
        if (!ob || !ob.mesh) continue;
        const ud = ob.mesh.userData;
        if (!ud || (!ud.isTable && !ud.isHood && !ud.isRack && !ob.fridgeCtrl)) continue;
        if (Math.abs(ob.mesh.position.y - pos.y) > 1.4) continue;
        const rad = (ob.radius || 0.75) + 0.28;
        const odx = pos.x - ob.mesh.position.x;
        const odz = pos.z - ob.mesh.position.z;
        const odSq = odx * odx + odz * odz;
        if (odSq > 1e-5 && odSq < rad * rad) {
          const od = Math.sqrt(odSq);
          pos.x = ob.mesh.position.x + (odx / od) * rad;
          pos.z = ob.mesh.position.z + (odz / od) * rad;
        }
      }
    }
    if (Math.hypot(tx - pos.x, tz - pos.z) >= dist - distance * 0.15) pet.stuck += dt;
    else pet.stuck = Math.max(0, pet.stuck - dt);
    if (pet.stuck > 0.45) {
      pet.sidestepDir = -(pet.sidestepDir || (Math.random() < 0.5 ? 1 : -1));
      pet.sidestep = 1.8 * pet.sidestepDir;
      pet.stuck = 0;
    } else if (pet.sidestep > 0) {
      pet.sidestep = Math.max(0, pet.sidestep - dt);
    } else if (pet.sidestep < 0) {
      pet.sidestep = Math.min(0, pet.sidestep + dt);
    }
    if (Math.hypot(pos.x - oldX, pos.z - oldZ) < 0.001 && state.mode !== 'follow' && !need) pet.roamTimer = 0;
    pos.y = getGroundHeight(ctx.physCtx, pos.x, pos.z, pos.y, null, pos.y + 0.5);
    pet.group.rotation.y = Math.atan2(dx, dz);
    pet.phase += dt * (speed > 2 ? 12 : 7);
  } else {
    pet.idleTime += dt;
    if (!need && !isPeeing && state.mode === 'follow' && dist > 0.4) {
      // Olha suavemente para o dono enquanto está sentado perto
      const targetYaw = Math.atan2(dx, dz);
      let diff = targetYaw - pet.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      pet.group.rotation.y += diff * Math.min(1, dt * 3.5);
    }
    if (need) {
      pet.eatingTime += dt;
      if (pet.eatingTime > 2.5 && !pet.pending && now >= pet.retryAt) {
        pet.pending = true;
        pet.retryAt = now + 10000;
        petAction('consume_' + need).catch(() => {}).finally(() => { pet.pending = false; });
      }
    } else if (!isPeeing && !isPooping && pet.idleTime > 2.2) {
      pet.nextPeeAt -= dt;
      pet.nextPoopAt -= dt;
      pet.nextCuriousAt -= dt;
      if (pet.nextPeeAt <= 0) {
        pet.peeUntil = nowPerf + 2400;
        pet.peeSpawned = false;
        pet.nextPeeAt = 45 + Math.random() * 35;
      } else if (pet.nextPoopAt <= 0) {
        pet.poopUntil = nowPerf + 2200;
        pet.poopSpawned = false;
        pet.nextPoopAt = 65 + Math.random() * 45;
      } else if (pet.nextCuriousAt <= 0) {
        pet.curiousUntil = nowPerf + 2800;
        pet.nextCuriousAt = 14 + Math.random() * 12;
      }
    }
  }
  if (isPooping && !pet.poopSpawned && (pet.poopUntil - nowPerf) < 1300) {
    pet.poopSpawned = true;
    const backX = pos.x - Math.sin(pet.group.rotation.y) * 0.25;
    const backZ = pos.z - Math.cos(pet.group.rotation.y) * 0.25;
    spawnPetPoop(ctx.scene, backX, pos.y, backZ);
  }
  pet.hunger = Math.min(100, (pet.hunger || 0) + dt * 0.45);
  // Procura potinho móvel cheio perto quando estiver com fome
  if (pet.hunger >= 55 && Array.isArray(ctx.pickableItems)) {
    for (let bi = 0; bi < ctx.pickableItems.length; bi++) {
      const bw = ctx.pickableItems[bi];
      if (!bw?.petBowlCtrl || bw.petBowlCtrl.grams <= 5 || bw === ctx.heldItem) continue;
      if (Math.hypot(bw.mesh.position.x - pos.x, bw.mesh.position.z - pos.z) < 2.2) {
        bw.petBowlCtrl.grams = Math.max(0, bw.petBowlCtrl.grams - 60);
        bw.petBowlCtrl.updateVisual?.();
        pet.hunger = Math.max(0, pet.hunger - 45);
        pet.loveUntil = nowPerf + 2600;
        ctx.queueItemStateSync?.(bw);
        break;
      }
    }
  }
  if (isPeeing && !pet.peeSpawned && (pet.peeUntil - nowPerf) < 1700) {
    pet.peeSpawned = true;
    const backX = pos.x - Math.sin(pet.group.rotation.y) * 0.25;
    const backZ = pos.z - Math.cos(pet.group.rotation.y) * 0.25;
    spawnPetPeePuddle(ctx.scene, backX, pos.y, backZ);
  }
  const swing = walking ? Math.sin(pet.phase) * (need ? 0.65 : 0.43) : 0;
  pet.legs[0].rotation.x = swing; pet.legs[3].rotation.x = swing;
  pet.legs[1].rotation.x = -swing; pet.legs[2].rotation.x = -swing;
  pet.legs[2].rotation.z = isPeeing ? 0.72 : 0;
  const isCurious = !walking && !need && !isPeeing && pet.curiousUntil > nowPerf;
  pet.head.rotation.z = isCurious ? Math.sin(now * 0.004) * 0.26 : 0;
  pet.head.rotation.x = need && !walking ? 0.4 + Math.sin(pet.eatingTime * 7) * 0.08 : Math.sin(now * 0.002) * 0.035;
  pet.tail.rotation.z = Math.sin(now * (walking || pet.loveUntil > nowPerf ? 0.012 : 0.003)) * 0.30;
  const hopY = pet.hopUntil > nowPerf ? Math.abs(Math.sin(nowPerf * 0.014)) * 0.14 : 0;
  pet.body.position.y = (walking ? Math.abs(Math.sin(pet.phase)) * 0.025 : 0) + hopY;
  const sleeping = !walking && !need && !isPeeing && !isPooping && (pet.idleTime > 20 || (pet.hunger || 0) >= 75) && pet.loveUntil <= nowPerf;
  pet.body.rotation.z = sleeping ? 0.4 : (isPeeing ? -0.14 : 0);
  if (sleeping) pet.body.position.y = -0.12;
  const blink = sleeping || now % 7000 < 160;
  for (const eye of pet.eyes) eye.scale.y = blink ? 0.008 : 0.07;
  for (const glint of pet.glints) glint.visible = !blink;
  if (!walking && !need && !isPeeing && (pet.idleTime > 1.5 || isPooping) && !sleeping) {
    pet.body.rotation.x = isPooping ? -0.22 : 0.14;
    pet.legs[0].rotation.x = -0.62; pet.legs[2].rotation.x = -0.62;
  } else pet.body.rotation.x = 0;

  // Emoji emotivo acima do pet (atualiza só quando muda)
  if (pet.moodSprite) {
    let emoji = '';
    if (pet.loveUntil > nowPerf) emoji = '❤️';
    else if (isPooping) emoji = '💩';
    else if (isPeeing) emoji = '💦';
    else if (need === 'food') emoji = '🍽️';
    else if (need === 'water') emoji = '💧';
    else if ((pet.hunger || 0) >= 75) emoji = '😢';
    else if (sleeping) emoji = '💤';
    else if (isCurious) emoji = '❓';
    else if (!walking && pet.idleTime > 1.5 && state.mode === 'follow') emoji = '😊';
    if (emoji !== pet.lastMoodEmoji) {
      pet.lastMoodEmoji = emoji;
      if (emoji && typeof document !== 'undefined') {
        updateTextSprite(pet.moodSprite, emoji, '#ffffff');
        pet.moodSprite.visible = true;
      } else {
        pet.moodSprite.visible = false;
      }
    }
  }
}

function canReachBowlFromAnchor(pos, anchor) {
  return pos && (!anchor || (Math.hypot(pos.x - anchor.x, pos.z - anchor.z) < STAY_RADIUS && Math.abs(pos.y - anchor.y) < 1.1));
}
