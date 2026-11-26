/**
 * Veículo NPC, Avatar Comprador e Ciclo de Compra do Empório MycoCampus (MycoCampus3D).
 */

import { makeBox, updateTextSprite } from '../engine/textures.js';
import { disposeObjectResources } from '../items/item-registry.js';
import { t } from '../core/i18n.js';
import { buildCuteAvatar, drawAvatarFace } from '../entities/avatars.js';
import { unlockAchievement } from '../core/achievements.js';
import {
  MYCOCOIN_PRICE_PER_PACK,
  playEconomyAudio,
  addLocalMycoCoins
} from '../core/myco-coins.js';
import {
  createMushroomPackVisual,
  updateDeliveryCrateVisual
} from '../items/mushroom-packaging.js';
import {
  roadSaleDynamicObjects,
  roadStandState,
  getActiveVipOrders,
  matchVipOrder,
  createOrganicVeggieStandVisual,
  syncRoadStandVisual
} from './roadside-stand-state.js';

const THREE = window.THREE;

const NPC_PROFILES = [
  { name: 'Dr. Henrique (Neurocientista)', carColor: 0x2563eb, shirtColor: 0x0284c7, hatColor: 0x1e3a8a, quote: '🍄 "Qualidade clínica impecável! Aqui estão seus 🪙 120 MycoCoins!"' },
  { name: 'Chef Sofia (Gastronomia)', carColor: 0xdc2626, shirtColor: 0xf43f5e, hatColor: 0xfef08a, quote: '✨ "Crocantes a 0% de umidade e selados! Toma 🪙 120 MycoCoins!"' },
  { name: 'Prof. Otávio (Botânico)', carColor: 0x16a34a, shirtColor: 0x10b981, hatColor: 0x78350f, quote: '🌿 "Linhagem rizomórfica pura! Pagamento na mão: 🪙 120 MycoCoins!"' },
  { name: 'Marina (Terapeuta)', carColor: 0x9333ea, shirtColor: 0xa855f7, hatColor: 0xf472b6, quote: '💜 "Embalagem selada perfeita! Muito obrigada, +🪙 120 MycoCoins!"' },
  { name: 'Lucas (Colecionador)', carColor: 0xeab308, shirtColor: 0xf59e0b, hatColor: 0x111827, quote: '🤩 "Direto do laboratório do MycoCampus! Vale cada MycoCoin!"' }
];

export function buildNpcCarActor(scene) {
  const carGroup = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.28, metalness: 0.48 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.12, metalness: 0.65 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  const lowerBody = makeBox(3.7, 0.56, 1.72, bodyMat);
  lowerBody.position.set(0, 0.50, 0);
  const frontBumper = makeBox(0.14, 0.22, 1.76, chromeMat);
  frontBumper.position.set(1.86, 0.34, 0);
  const rearBumper = makeBox(0.14, 0.22, 1.76, chromeMat);
  rearBumper.position.set(-1.86, 0.34, 0);
  const grille = makeBox(0.08, 0.20, 0.82, chromeMat);
  grille.position.set(1.86, 0.52, 0);

  const cabinRoof = makeBox(1.55, 0.48, 1.50, bodyMat);
  cabinRoof.position.set(-0.20, 1.02, 0);
  const windshield = makeBox(0.55, 0.44, 1.44, glassMat);
  windshield.position.set(0.70, 0.98, 0);
  windshield.rotation.z = -0.58;
  const rearGlass = makeBox(0.50, 0.42, 1.44, glassMat);
  rearGlass.position.set(-1.08, 0.98, 0);
  rearGlass.rotation.z = 0.55;
  const sideWindows = makeBox(1.42, 0.34, 1.54, glassMat);
  sideWindows.position.set(-0.20, 1.01, 0);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(0.42, 0.56, -0.87);
  const doorPanel = makeBox(0.92, 0.48, 0.06, bodyMat);
  doorPanel.position.set(-0.46, 0, 0);
  const doorHandle = makeBox(0.14, 0.04, 0.08, chromeMat, { noShadow: true });
  doorHandle.position.set(-0.74, 0.12, -0.02);
  doorPivot.add(doorPanel, doorHandle);

  carGroup.add(lowerBody, frontBumper, rearBumper, grille, cabinRoof, windshield, rearGlass, sideWindows, doorPivot);

  const wheels = [];
  const wGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
  wGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.24, 10);
  rimGeo.rotateX(Math.PI / 2);
  [[-1.15, -0.84], [1.15, -0.84], [-1.15, 0.84], [1.15, 0.84]].forEach((wp) => {
    const wg = new THREE.Group();
    wg.position.set(wp[0], 0.32, wp[1]);
    wg.add(new THREE.Mesh(wGeo, wheelMat), new THREE.Mesh(rimGeo, chromeMat));
    carGroup.add(wg);
    wheels.push(wg);
  });

  [-0.58, 0.58].forEach((lz) => {
    const hl = makeBox(0.08, 0.15, 0.28, headlightMat, { noShadow: true });
    hl.position.set(1.86, 0.56, lz);
    const tl = makeBox(0.08, 0.14, 0.26, taillightMat, { noShadow: true });
    tl.position.set(-1.86, 0.58, lz);
    carGroup.add(hl, tl);
  });

  carGroup.visible = false;
  scene.add(carGroup);
  roadSaleDynamicObjects.push(carGroup);

  const avatar = buildCuteAvatar(scene, {
    id: 'npc_buyer',
    name: 'Cliente',
    role: 'student',
    hat_color: '#1e3a8a',
    body_color: '#0284c7',
    current_hat: 'default',
    x: 17.5,
    y: 0.04,
    z: 39.0
  });
  const npcGroup = avatar.group;
  npcGroup.visible = false;
  roadSaleDynamicObjects.push(npcGroup);

  const heldPackVis = createMushroomPackVisual(true, true);
  const heldPack = heldPackVis.wrap;
  heldPack.position.set(0, 0.62, -0.26);
  heldPack.scale.set(1.35, 1.35, 1.35);
  heldPack.visible = false;
  npcGroup.add(heldPack);

  const heldVeggie = createOrganicVeggieStandVisual();
  heldVeggie.position.set(0, 0.62, -0.26);
  heldVeggie.scale.set(0.88, 0.88, 0.88);
  heldVeggie.visible = false;
  npcGroup.add(heldVeggie);

  const cashGroup = new THREE.Group();
  const billMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  for (let i = 0; i < 6; i++) {
    const bill = makeBox(0.14, 0.015, 0.08, i % 2 === 0 ? billMat : coinMat, { noShadow: true });
    bill.position.set((i - 2.5) * 0.09, 1.35 + (i % 2) * 0.11, -0.18);
    cashGroup.add(bill);
  }
  cashGroup.visible = false;
  npcGroup.add(cashGroup);

  roadStandState.actor = {
    carGroup,
    bodyMat,
    doorPivot,
    wheels,
    avatar,
    npcGroup,
    shirtMat: avatar.bodyMat,
    hatMat: avatar.hatMat,
    heldPack,
    heldVeggie,
    carriedKind: 'mushroom',
    cashGroup
  };
}

function getFrontShelfSaleItems(ctx) {
  const found = [];
  if (!ctx || !Array.isArray(ctx.pickableItems)) return found;
  for (let i = 0; i < ctx.pickableItems.length; i++) {
    const it = ctx.pickableItems[i];
    if (!it || !it.mesh || !it.mesh.position || it === ctx.heldItem || it.crateParent || it.isReadOnly) continue;
    const p = it.mesh.position;
    if (p.x < 14.4 || p.x > 20.6 || p.z < 34.8 || p.z > 36.8 || p.y < 0.4) continue;
    if (it.deliveryCrateCtrl && it.deliveryCrateCtrl.packsCount > 0) {
      found.push({ item: it, kind: 'crate', count: it.deliveryCrateCtrl.packsCount });
    } else if (it.organicBasketCtrl && it.organicBasketCtrl.packsValue > 0) {
      found.push({ item: it, kind: 'veggie', count: it.organicBasketCtrl.packsValue });
    } else if (it.mushroomBagCtrl && it.mushroomBagCtrl.filled && it.mushroomBagCtrl.sealed) {
      found.push({ item: it, kind: 'bag', count: 1 });
    } else if (it.wildMushroomCtrl && !it.wildMushroomCtrl.removed) {
      found.push({ item: it, kind: 'mushroom', count: 1 });
    }
  }
  return found;
}

function walkRoadBuyer(actor, fromZ, toZ, elapsed, duration) {
  const progress = Math.min(1, elapsed / duration);
  const soften = Math.min(1, progress * 6, (1 - progress) * 6);
  const stride = Math.sin(progress * Math.PI * 5.6) * 0.36 * soften;
  const avatar = actor.avatar;
  const isCarrying = Boolean(actor.heldPack?.visible || actor.heldVeggie?.visible);
  actor.npcGroup.position.z = THREE.MathUtils.lerp(fromZ, toZ, THREE.MathUtils.smoothstep(progress, 0, 1));
  actor.npcGroup.position.y = 0.04 + Math.abs(stride) * 0.075;
  avatar.leftLeg.rotation.x = stride;
  avatar.rightLeg.rotation.x = -stride;
  // Avatar encara -Z e braços pendem em -Y: rotation.x positivo ergue os braços para a frente (-Z)
  if (isCarrying) {
    const carryBob = Math.sin(progress * Math.PI * 11.2) * 0.05 * soften;
    avatar.leftArm.rotation.x = 0.96 + carryBob;
    avatar.rightArm.rotation.x = 0.96 + carryBob;
    avatar.leftArm.rotation.z = 0.14;
    avatar.rightArm.rotation.z = -0.14;
    if (avatar.torso) avatar.torso.rotation.x = -0.05;
  } else {
    avatar.leftArm.rotation.x = -stride * 0.65;
    avatar.rightArm.rotation.x = stride * 0.65;
    avatar.leftArm.rotation.z = 0;
    avatar.rightArm.rotation.z = 0;
    if (avatar.torso) avatar.torso.rotation.x = 0;
  }
  avatar.headGroup.rotation.x = Math.cos(progress * Math.PI * 5.6) * 0.035 * soften;
}

export function stepRoadsideMushroomSales(ctx, dt) {
  const actor = roadStandState.actor;
  if (!actor) return;

  const shelfItems = getFrontShelfSaleItems(ctx);
  let shelfCount = 0;
  for (let i = 0; i < shelfItems.length; i++) shelfCount += shelfItems[i].count;
  const totalForSale = roadStandState.availablePacks + shelfCount;

  if (!roadStandState.activeNpcOrder) {
    if (totalForSale <= 0) return;
    roadStandState.npcSpawnCooldown -= dt;
    if (roadStandState.npcSpawnCooldown > 0) return;

    const profile = NPC_PROFILES[(roadStandState.totalSoldPacks + Math.floor(Math.random() * NPC_PROFILES.length)) % NPC_PROFILES.length];
    actor.bodyMat.color.setHex(profile.carColor);
    actor.shirtMat.color.setHex(0x0284c7);
    actor.hatMat.color.setHex(0x1e3a8a);
    actor.carGroup.position.set(-114, 0.04, 39.5);
    actor.carGroup.rotation.y = 0;
    actor.carGroup.visible = true;
    if (actor.doorPivot) actor.doorPivot.rotation.y = 0;
    actor.npcGroup.visible = false;
    actor.carriedKind = 'mushroom';
    actor.heldPack.visible = false;
    actor.heldPack.position.set(0, 0.62, -0.26);
    if (actor.heldVeggie) {
      actor.heldVeggie.visible = false;
      if (actor.heldVeggie.position && actor.heldVeggie.position.set) actor.heldVeggie.position.set(0, 0.62, -0.26);
    }
    actor.cashGroup.visible = false;
    actor.cashGroup.position.y = 0;
    actor.cashGroup.rotation.y = 0;
    actor.avatar.headGroup.rotation.set(0, 0, 0);
    if (actor.avatar) {
      if (actor.avatar.leftArm && actor.avatar.leftArm.rotation) {
        actor.avatar.leftArm.rotation.x = 0;
        actor.avatar.leftArm.rotation.z = 0;
      }
      if (actor.avatar.rightArm && actor.avatar.rightArm.rotation) {
        actor.avatar.rightArm.rotation.x = 0;
        actor.avatar.rightArm.rotation.z = 0;
      }
      if (actor.avatar.torso && actor.avatar.torso.rotation) {
        actor.avatar.torso.rotation.x = 0;
      }
      if (actor.avatar.labelSprite) updateTextSprite(actor.avatar.labelSprite, profile.name, '#ffffff');
      if (actor.avatar.chatSprite) actor.avatar.chatSprite.visible = false;
      if (actor.avatar.faceCtx) {
        drawAvatarFace(actor.avatar.faceCtx, 'happy', false);
        if (actor.avatar.faceTex) actor.avatar.faceTex.needsUpdate = true;
      }
    }

    const isVip = (roadStandState.totalSoldPacks % 3 === 2) || Math.random() < 0.28;
    const activeVips = isVip ? getActiveVipOrders() : [];
    const vipTargetSpecies = activeVips.length ? activeVips[roadStandState.totalSoldPacks % activeVips.length] : '';
    roadStandState.activeNpcOrder = {
      profile,
      isVip,
      vipTargetSpecies,
      phase: 'driving_in',
      timer: 0,
      mood: 'happy',
      lastBlink: false
    };
    if (isVip && actor.avatar && actor.avatar.labelSprite) {
      updateTextSprite(actor.avatar.labelSprite, `⭐ VIP: ${profile.name}`, '#fde047');
    }
    return;
  }

  const order = roadStandState.activeNpcOrder;
  const standX = 17.5;
  const roadZ = 39.5;
  const standStopZ = 36.65;

  const spinWheels = (speed) => {
    if (!actor.wheels) return;
    for (let wi = 0; wi < actor.wheels.length; wi++) {
      actor.wheels[wi].rotation.z -= dt * speed;
    }
  };

  const avatar = actor.avatar;
  const doorZ = roadZ - 1.15;
  order.timer += dt;

  if (actor.npcGroup.visible && avatar && avatar.faceCtx) {
    const blinkNow = (order.timer % 3.4) > 3.24;
    if (blinkNow !== !!order.lastBlink) {
      order.lastBlink = blinkNow;
      drawAvatarFace(avatar.faceCtx, order.mood || 'happy', blinkNow);
      if (avatar.faceTex) avatar.faceTex.needsUpdate = true;
    }
  }
  const setNpcMood = (mood) => {
    if (order.mood === mood) return;
    order.mood = mood;
    if (avatar && avatar.faceCtx) {
      drawAvatarFace(avatar.faceCtx, mood, !!order.lastBlink);
      if (avatar.faceTex) avatar.faceTex.needsUpdate = true;
    }
  };

  if (order.phase === 'driving_in') {
    const dist = Math.max(0.4, standX - actor.carGroup.position.x);
    const speed = Math.min(18, Math.max(1.8, dist * 1.1));
    actor.carGroup.position.x = Math.min(standX, actor.carGroup.position.x + dt * speed);
    spinWheels(speed * 2.2);
    if (actor.carGroup.position.x >= standX) {
      order.phase = 'opening_door';
      order.timer = 0;
    }
  } else if (order.phase === 'opening_door') {
    const door = THREE.MathUtils.smoothstep(order.timer, 0, 0.75);
    if (actor.doorPivot) actor.doorPivot.rotation.y = -1.08 * door;
    if (order.timer >= 0.82) {
      actor.npcGroup.position.set(standX, 0.04, doorZ);
      actor.npcGroup.rotation.y = 0;
      actor.npcGroup.visible = true;
      if (order.isVip && avatar.chatSprite) {
        const vipText = order.vipTargetSpecies
          ? `⭐ VIP: ${order.vipTargetSpecies} (+50%)`
          : '⭐ VIP (+50% 🪙)';
        updateTextSprite(avatar.chatSprite, vipText, '#fde047');
        avatar.chatSprite.visible = true;
      }
      order.phase = 'walking_to_stand';
      order.timer = 0;
    }
  } else if (order.phase === 'walking_to_stand') {
    walkRoadBuyer(actor, doorZ, standStopZ, order.timer, 2.1);
    if (actor.doorPivot) actor.doorPivot.rotation.y = -1.08 * (1 - THREE.MathUtils.smoothstep(order.timer, 0.3, 1));
    if (order.timer >= 2.1) {
      order.phase = 'examining';
      order.timer = 0;
      setNpcMood('focused');
      if (avatar.chatSprite) {
        updateTextSprite(avatar.chatSprite, t('stand.npc_examining'), '#aae3cf');
        avatar.chatSprite.visible = true;
      }
    }
  } else if (order.phase === 'examining') {
    const weight = THREE.MathUtils.smoothstep(order.timer, 0, 0.42);
    avatar.headGroup.rotation.x = -0.18 * weight;
    avatar.headGroup.rotation.y = Math.sin(order.timer * 2.15) * 0.21 * weight;
    avatar.leftArm.rotation.x = 0.18 * weight;
    avatar.rightArm.rotation.x = 0.18 * weight;
    avatar.leftArm.rotation.z = 0.05 * weight;
    avatar.rightArm.rotation.z = -0.05 * weight;
    if (avatar.torso) avatar.torso.rotation.x = -0.04 * weight;
    if (order.timer < 2.15) return;
    order.phase = 'paying';
    order.timer = 0;
    if (totalForSale > 0) {
      actor.cashGroup.visible = true;
      playEconomyAudio('playCashRegister');
      if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('success');
    }

    let soldOne = false;
    let soldSpecies = '';
    let soldGrams = 10;
    let soldKind = 'mushroom';
    if (roadStandState.availablePacks > 0) {
      roadStandState.availablePacks--;
      soldSpecies = roadStandState.speciesList.length ? (roadStandState.speciesList.shift() || '') : '';
      soldGrams = roadStandState.gramsList.length ? (Number(roadStandState.gramsList.shift()) || 10) : 10;
      soldKind = roadStandState.itemKinds.length ? (roadStandState.itemKinds.shift() || 'mushroom') : 'mushroom';
      soldOne = true;
    } else if (shelfItems.length > 0) {
      const entry = shelfItems[0];
      if (entry.kind === 'crate' && entry.item.deliveryCrateCtrl) {
        entry.item.deliveryCrateCtrl.packsCount = Math.max(0, entry.item.deliveryCrateCtrl.packsCount - 1);
        const cs = entry.item.deliveryCrateCtrl.speciesList;
        const cg = entry.item.deliveryCrateCtrl.gramsList;
        if (Array.isArray(cs) && cs.length) soldSpecies = cs.shift() || '';
        if (Array.isArray(cg) && cg.length) soldGrams = Number(cg.shift()) || 10;
        updateDeliveryCrateVisual(entry.item);
        ctx?.queueItemStateSync?.(entry.item);
        soldOne = true;
      } else {
        const soldIt = entry.item;
        soldSpecies = (soldIt.mushroomBagCtrl && soldIt.mushroomBagCtrl.speciesName) ||
          (soldIt.wildMushroomCtrl && soldIt.wildMushroomCtrl.speciesName) || '';
        if (soldIt.organicBasketCtrl) {
          soldKind = 'veggie';
          soldGrams = Math.max(10, Math.round(Number(soldIt.organicBasketCtrl.packsValue || 2) * 10));
        } else {
          soldGrams = Number(
            (soldIt.mushroomBagCtrl && soldIt.mushroomBagCtrl.grams) ||
            (soldIt.wildMushroomCtrl && soldIt.wildMushroomCtrl.grams) || 10
          ) || 10;
        }
        if (soldIt && soldIt.id) {
          soldIt._removedForSync = true;
          if (ctx && ctx.pendingMovedItems) {
            ctx.pendingMovedItems[soldIt.id] = {
              id: soldIt.id,
              state: {
                custom: {
                  dynamicKind: soldIt.organicBasketCtrl ? 'organic_basket' : 'mushroom_bag',
                  removed: true
                }
              }
            };
          }
        }
        if (soldIt.mesh && soldIt.mesh.parent) soldIt.mesh.parent.remove(soldIt.mesh);
        disposeObjectResources(soldIt.mesh);
        const idx = ctx.pickableItems.indexOf(soldIt);
        if (idx !== -1) ctx.pickableItems.splice(idx, 1);
        if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') ctx.pickableMap.delete(soldIt.id);
        soldOne = true;
      }
    }
    if (soldOne) {
      const vipMatch = matchVipOrder(soldSpecies);
      const isVipSale = !!(vipMatch || order.isVip);
      const packGrams = Math.max(1, Math.round(Number(soldGrams) || 10));
      const basePrice = Math.round(MYCOCOIN_PRICE_PER_PACK * (packGrams / 10));
      const earnedCoins = isVipSale ? Math.round(basePrice * 1.5) : basePrice;
      roadStandState.totalSoldPacks++;
      roadStandState.totalCoinsEarned += earnedCoins;
      if (isVipSale) unlockAchievement('vip_seller', ctx?.callbacks?.onToast);
      if (roadStandState.totalSoldPacks >= 10) unlockAchievement('emporium_10', ctx?.callbacks?.onToast);
      const newBalance = addLocalMycoCoins(earnedCoins);
      syncRoadStandVisual();
      if (ctx && ctx.queueWorldStateChange) {
        ctx.queueWorldStateChange('stand_packs', roadStandState.availablePacks);
        ctx.queueWorldStateChange('stand_sold', roadStandState.totalSoldPacks);
      }
      order.carriedKind = soldKind;
      actor.carriedKind = soldKind;
      if (soldKind === 'veggie' && actor.heldVeggie) {
        actor.heldPack.visible = false;
        actor.heldVeggie.visible = true;
      } else {
        actor.heldPack.visible = true;
        if (actor.heldVeggie) actor.heldVeggie.visible = false;
      }
      setNpcMood('love');
      if (actor.avatar && actor.avatar.chatSprite) {
        updateTextSprite(
          actor.avatar.chatSprite,
          vipMatch
            ? `⭐😍 VIP ${vipMatch.species}! +🪙 ${earnedCoins}!`
            : (isVipSale ? `⭐😍 VIP +🪙 ${earnedCoins}!` : t('items.dehydrationPackaging.npc_thanks', { earnedCoins })),
          isVipSale ? '#fde047' : '#34d399'
        );
        actor.avatar.chatSprite.visible = true;
      }
      if (ctx && ctx.callbacks && ctx.callbacks.onHarvestMushroom) {
        ctx.callbacks.onHarvestMushroom('sale_pack_' + roadStandState.totalSoldPacks);
      }
      if (ctx && ctx.callbacks && ctx.callbacks.onLabStep) {
        ctx.callbacks.onLabStep('sell_pack');
      }
      if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
        const vipPrefix = vipMatch
          ? `⭐ VIP ATENDIDO (${vipMatch.species}: +🪙 ${earnedCoins}!) `
          : (isVipSale ? `⭐ PEDIDO VIP (+🪙 ${earnedCoins})! ` : '');
        ctx.callbacks.onToast(t('items.dehydrationPackaging.m14', { vipPrefix, name: order.profile.name, quote: order.profile.quote, newBalance }));
      }
    } else {
      order.phase = 'turning';
      order.timer = 0;
      actor.cashGroup.visible = false;
      setNpcMood('sad');
      if (actor.avatar && actor.avatar.chatSprite) {
        updateTextSprite(actor.avatar.chatSprite, t('items.dehydrationPackaging.npc_soldout'), '#94a3b8');
        actor.avatar.chatSprite.visible = true;
      }
    }
  } else if (order.phase === 'paying') {
    const lift = THREE.MathUtils.smoothstep(order.timer, 0, 0.75);
    const settle = THREE.MathUtils.smoothstep(order.timer, 1.0, 2.4);
    const reach = lift * (1 - settle * 0.18);
    avatar.headGroup.rotation.x = -0.16 * (1 - settle);
    avatar.headGroup.rotation.y *= Math.exp(-dt * 4);
    avatar.leftArm.rotation.x = 0.98 * reach;
    avatar.rightArm.rotation.x = 1.02 * reach;
    avatar.leftArm.rotation.z = 0.14 * lift;
    avatar.rightArm.rotation.z = -0.14 * lift;
    if (avatar.torso) avatar.torso.rotation.x = -0.06 * lift * (1 - settle * 0.25);
    const holdObj = (actor.carriedKind === 'veggie' && actor.heldVeggie) ? actor.heldVeggie : actor.heldPack;
    if (holdObj && holdObj.position) {
      holdObj.position.y = 0.60 + 0.08 * reach;
      holdObj.position.z = -0.24 - 0.05 * reach;
    }
    actor.cashGroup.position.y = order.timer * 0.24;
    actor.cashGroup.rotation.y = order.timer * 0.9;
    if (order.timer >= 2.65) {
      order.phase = 'turning';
      order.timer = 0;
      actor.cashGroup.visible = false;
      if (avatar.chatSprite) avatar.chatSprite.visible = false;
    }
  } else if (order.phase === 'turning') {
    const turn = THREE.MathUtils.smoothstep(order.timer, 0, 0.9);
    const isCarrying = Boolean(actor.heldPack?.visible || actor.heldVeggie?.visible);
    actor.npcGroup.rotation.y = Math.PI * turn;
    avatar.headGroup.rotation.x *= Math.exp(-dt * 5);
    avatar.headGroup.rotation.y *= Math.exp(-dt * 5);
    if (isCarrying) {
      avatar.leftArm.rotation.x = 0.96;
      avatar.rightArm.rotation.x = 0.96;
      avatar.leftArm.rotation.z = 0.14;
      avatar.rightArm.rotation.z = -0.14;
      if (avatar.torso) avatar.torso.rotation.x = -0.05;
    } else {
      avatar.leftArm.rotation.x = 0;
      avatar.rightArm.rotation.x = 0;
      avatar.leftArm.rotation.z = 0;
      avatar.rightArm.rotation.z = 0;
      if (avatar.torso) avatar.torso.rotation.x = 0;
    }
    if (order.timer >= 0.9) {
      order.phase = 'walking_to_car';
      order.timer = 0;
    }
  } else if (order.phase === 'walking_to_car') {
    walkRoadBuyer(actor, standStopZ, doorZ, order.timer, 2.35);
    if (actor.doorPivot) actor.doorPivot.rotation.y = -1.08 * THREE.MathUtils.smoothstep(order.timer, 1.55, 2.25);
    if (order.timer >= 2.35) {
      actor.npcGroup.visible = false;
      if (avatar.chatSprite) avatar.chatSprite.visible = false;
      order.phase = 'closing_door';
      order.timer = 0;
    }
  } else if (order.phase === 'closing_door') {
    if (actor.doorPivot) actor.doorPivot.rotation.y = -1.08 * (1 - THREE.MathUtils.smoothstep(order.timer, 0, 0.7));
    if (order.timer >= 0.7) {
      order.phase = 'driving_away';
      order.timer = 0;
    }
  } else if (order.phase === 'driving_away') {
    const speed = Math.min(20, order.timer * 4.4);
    actor.carGroup.position.x += dt * speed;
    spinWheels(speed * 2.2);
    if (actor.carGroup.position.x >= 114) {
      actor.carGroup.visible = false;
      roadStandState.activeNpcOrder = null;
      roadStandState.npcSpawnCooldown = 3.5 + Math.random() * 4.0;
    }
  }
}
