/** Animated companions and their owner's bowls. */
import { appState } from '../core/state.js';
import { petAction } from '../services/pets.js';
import { getGroundHeight, clampPosAgainstWalls } from '../engine/physics.js';

const THREE = window.THREE;
let unitBox;
const materials = new Map();
let companion = null;
let ownerId = null;
const bowls = { food: null, water: null };
const BOWL_KINDS = ['food', 'water'];
const remotePets = new Map();
let remoteSnapshots = [];
let remoteSnapshotIds = new Set();

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
  return { group, body, head, legs, tail, eyes, glints, id, phase: 0, roamTimer: 0, targetX: 0, targetZ: 0, idleTime: 0, eatingTime: 0, stuck: 0, sidestep: 0, pending: false, retryAt: 0 };
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
  const user = appState.currentUser;
  const state = user?.progress?.pets;
  if (ctx.scene && user) stepRemotePets(ctx, dt);
  else if (remotePets.size) { updateRemotePets([]); if (ctx.scene) stepRemotePets(ctx, dt); }
  if (!ctx.scene || !ctx.playerPos || !user || !state) { if (companion || bowls.food || bowls.water) removeAll(); ownerId = null; return; }
  if (ownerId !== user.id) { removeAll(); ownerId = user.id; }
  updateBowl(ctx, 'food', state.bowls?.food);
  updateBowl(ctx, 'water', state.bowls?.water);
  if (companion?.id !== state.selected) {
    if (companion?.group.parent) companion.group.parent.remove(companion.group);
    companion = state.selected ? createAnimal(state.selected) : null;
    if (companion) {
      companion.group.position.set(ctx.playerPos.x + 1, ctx.playerPos.y, ctx.playerPos.z + 1);
      ctx.scene.add(companion.group);
    }
  }
  if (!companion || !ctx.inFps) return;
  const pet = companion;
  const pos = pet.group.position;
  const now = Date.now();
  const food = state.bowls?.food;
  const water = state.bowls?.water;
  let need = null;
  if (pet.id.startsWith('cat_') && food?.full && food.pos && (state.next_food?.[pet.id] || 0) * 1000 <= now) need = 'food';
  else if (water?.full && water.pos && (state.next_water?.[pet.id] || 0) * 1000 <= now) need = 'water';
  let tx, tz, stop;
  if (need) {
    const target = state.bowls[need].pos;
    tx = target.x; tz = target.z; stop = 0.48;
  } else if (state.mode === 'follow') {
    tx = ctx.playerPos.x; tz = ctx.playerPos.z; stop = 1.55;
  } else {
    pet.roamTimer -= dt;
    if (pet.roamTimer <= 0) {
      pet.roamTimer = 5 + Math.random() * 8;
      const nearOwner = Math.random() < 0.38 || Math.hypot(pos.x - ctx.playerPos.x, pos.z - ctx.playerPos.z) > 18;
      const base = nearOwner ? ctx.playerPos : pos;
      const a = Math.random() * Math.PI * 2;
      const r = nearOwner ? 1.6 + Math.random() * 2 : 2 + Math.random() * 4;
      pet.targetX = base.x + Math.cos(a) * r;
      pet.targetZ = base.z + Math.sin(a) * r;
    }
    tx = pet.targetX; tz = pet.targetZ; stop = 0.35;
  }
  if (!need && state.mode === 'follow' && Math.hypot(pos.x - ctx.playerPos.x, pos.z - ctx.playerPos.z) > 30) {
    pos.set(ctx.playerPos.x + 1, ctx.playerPos.y, ctx.playerPos.z + 1);
    clampPosAgainstWalls(ctx.physCtx, pos, 0.23);
    pos.y = getGroundHeight(ctx.physCtx, pos.x, pos.z, ctx.playerPos.y, null, ctx.playerPos.y + 0.5);
  }
  const dx = tx - pos.x, dz = tz - pos.z;
  const dist = Math.hypot(dx, dz);
  const walking = dist > stop;
  pet.motion = walking ? (need || dist > 6 ? 'run' : 'walk') : (need ? 'eat' : (pet.idleTime > 18 ? 'sleep' : 'idle'));
  if (walking) {
    pet.idleTime = 0;
    pet.eatingTime = 0;
    const speed = need || dist > 6 ? 3.1 : 1.3;
    const distance = Math.min(dist - stop, speed * dt);
    const oldX = pos.x, oldZ = pos.z;
    const side = pet.sidestep > 0 ? 0.85 : 0;
    pos.x += (dx / dist - dz / dist * side) * distance;
    pos.z += (dz / dist + dx / dist * side) * distance;
    clampPosAgainstWalls(ctx.physCtx, pos, 0.23);
    if (Math.hypot(tx - pos.x, tz - pos.z) >= dist - distance * 0.15) pet.stuck += dt;
    else pet.stuck = Math.max(0, pet.stuck - dt);
    if (pet.stuck > 0.7) { pet.sidestep = 2; pet.stuck = 0; }
    else pet.sidestep = Math.max(0, pet.sidestep - dt);
    if (Math.hypot(pos.x - oldX, pos.z - oldZ) < 0.001 && state.mode === 'roam' && !need) pet.roamTimer = 0;
    pos.y = getGroundHeight(ctx.physCtx, pos.x, pos.z, pos.y, null, pos.y + 0.5);
    pet.group.rotation.y = Math.atan2(dx, dz);
    pet.phase += dt * (speed > 2 ? 12 : 7);
  } else {
    pet.idleTime += dt;
    if (need) {
      pet.eatingTime += dt;
      if (pet.eatingTime > 2.5 && !pet.pending && now >= pet.retryAt) {
        pet.pending = true;
        pet.retryAt = now + 10000;
        petAction('consume_' + need).catch(() => {}).finally(() => { pet.pending = false; });
      }
    }
  }
  const swing = walking ? Math.sin(pet.phase) * (need ? 0.65 : 0.43) : 0;
  pet.legs[0].rotation.x = swing; pet.legs[3].rotation.x = swing;
  pet.legs[1].rotation.x = -swing; pet.legs[2].rotation.x = -swing;
  pet.head.rotation.x = need && !walking ? 0.4 + Math.sin(pet.eatingTime * 7) * 0.08 : Math.sin(now * 0.002) * 0.035;
  pet.tail.rotation.z = Math.sin(now * (walking ? 0.008 : 0.003)) * 0.28;
  pet.body.position.y = walking ? Math.abs(Math.sin(pet.phase)) * 0.025 : 0;
  const sleeping = !walking && !need && pet.idleTime > 18;
  pet.body.rotation.z = sleeping ? 0.4 : 0;
  if (sleeping) pet.body.position.y = -0.12;
  const blink = sleeping || now % 7000 < 160;
  for (const eye of pet.eyes) eye.scale.y = blink ? 0.008 : 0.07;
  for (const glint of pet.glints) glint.visible = !blink;
  if (!walking && !need && pet.idleTime > 5) {
    pet.body.rotation.x = 0.13;
    pet.legs[0].rotation.x = -0.6; pet.legs[2].rotation.x = -0.6;
  } else pet.body.rotation.x = 0;
}
