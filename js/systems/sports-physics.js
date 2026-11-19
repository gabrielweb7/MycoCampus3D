/**
 * Física das Bolas Esportivas (Futebol e Basquete), Cestas e Sync Multiplayer (MycoCampus3D)
 */

import { triggerConfettiBurst } from '../entities/confetti.js';
import { recordSportScore } from '../world/sports-scoreboard.js';
import { addLocalMycoCoins } from '../items/dehydration-packaging.js';
import { triggerCozyHeartBurst } from '../world/cozy-details.js';

function getBallStateKey(sb) {
  return sb.kind === 'soccer' ? 'ball_soccer' : 'ball_basket';
}

export function syncSportBallState(ctx, sb) {
  if (!ctx || !ctx.queueWorldStateChange || !sb || !sb.mesh) return;
  const p = sb.mesh.position;
  const val = [
    p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2),
    sb.vx.toFixed(2), sb.vy.toFixed(2), sb.vz.toFixed(2)
  ].join(',');
  sb.lastSyncVal = val;
  ctx.queueWorldStateChange(getBallStateKey(sb), val);
}

export function applySportBallStates(sim, stateMap) {
  if (!sim || !Array.isArray(sim.sportBalls) || !stateMap) return;
  for (let i = 0; i < sim.sportBalls.length; i++) {
    const sb = sim.sportBalls[i];
    if (sim.heldSportBall === sb) continue;
    const raw = stateMap[getBallStateKey(sb)];
    if (typeof raw !== 'string' || raw === sb.lastSyncVal) continue;
    const parts = raw.split(',').map(Number);
    if (parts.length === 6 && parts.every(Number.isFinite)) {
      sb.lastSyncVal = raw;
      sb.mesh.position.set(parts[0], parts[1], parts[2]);
      sb.vx = parts[3]; sb.vy = parts[4]; sb.vz = parts[5];
    }
  }
}

export function grabSportBall(ctx, sb) {
  if (!ctx || !sb || ctx.heldItem || ctx.heldSportBall) return false;
  ctx.heldSportBall = sb;
  sb.vx = 0; sb.vy = 0; sb.vz = 0;
  if (window.MycoAudio) window.MycoAudio.playClick();
  if (ctx.callbacks && ctx.callbacks.onToast) {
    ctx.callbacks.onToast('🏀 Bola na mão! Mire para cima da cesta e clique para arremessar.');
  }
  return true;
}

export function throwHeldSportBall(ctx) {
  const sb = ctx && ctx.heldSportBall;
  if (!sb) return false;
  ctx.heldSportBall = null;
  const yaw = ctx.playerYaw || 0;
  const pitch = ctx.playerPitch || 0;
  const cosP = Math.cos(pitch);
  const dx = -Math.sin(yaw) * cosP;
  const dy = Math.sin(pitch);
  const dz = -Math.cos(yaw) * cosP;
  const power = 11.2;
  sb.vx = dx * power;
  sb.vy = Math.max(4.6, dy * power + 4.4);
  sb.vz = dz * power;
  sb.throwGrace = 0.35;
  syncSportBallState(ctx, sb);
  if (window.MycoAudio) window.MycoAudio.playClick();
  return true;
}

export function stepSportBalls(ctx, dt) {
  if (!ctx.sportBalls || !ctx.sportBalls.length) return;

  for (let sbi = 0; sbi < ctx.sportBalls.length; sbi++) {
    const sb = ctx.sportBalls[sbi];
    const bPos = sb.mesh.position;

    if (ctx.heldSportBall === sb) {
      const yaw = ctx.playerYaw || 0;
      bPos.set(
        ctx.playerPos.x - Math.sin(yaw) * 0.72,
        ctx.playerPos.y + 1.15,
        ctx.playerPos.z - Math.cos(yaw) * 0.72
      );
      sb.vx = 0; sb.vy = 0; sb.vz = 0;
      continue;
    }

    if (sb.throwGrace > 0) sb.throwGrace -= dt;
    if (sb.goalCooldown > 0) {
      sb.goalCooldown -= dt;
      if (sb.goalCooldown <= 0) {
        bPos.set(sb.homeX, sb.groundY + sb.r, sb.homeZ);
        sb.vx = 0; sb.vy = 0; sb.vz = 0;
        syncSportBallState(ctx, sb);
      }
    }

    const bdx = bPos.x - ctx.playerPos.x;
    const bdz = bPos.z - ctx.playerPos.z;
    const bDistSq = bdx * bdx + bdz * bdz;
    const touchR = 0.42 + sb.r;
    if ((sb.throwGrace || 0) <= 0 && bDistSq < touchR * touchR && Math.abs(ctx.playerPos.y - bPos.y) < 1.25) {
      const bDist = Math.sqrt(bDistSq) || 0.01;
      const nx = bdx / bDist;
      const nz = bdz / bDist;
      const pSpeed = Math.hypot(ctx.playerVelX, ctx.playerVelZ);
      const kickPow = Math.max(4.5, pSpeed * 1.65);
      sb.vx = nx * kickPow;
      sb.vz = nz * kickPow;
      sb.vy = Math.max(sb.vy, sb.bounceUp * (pSpeed > 1 ? 1.0 : 0.6));
      bPos.x = ctx.playerPos.x + nx * (touchR + 0.03);
      bPos.z = ctx.playerPos.z + nz * (touchR + 0.03);
      syncSportBallState(ctx, sb);
      if (window.MycoAudio) window.MycoAudio.playClick();
    }

    sb.vy -= 14.0 * dt;
    bPos.x += sb.vx * dt;
    bPos.y += sb.vy * dt;
    bPos.z += sb.vz * dt;
    const floorY = sb.groundY + sb.r;
    if (bPos.y <= floorY) {
      bPos.y = floorY;
      if (Math.abs(sb.vy) > 0.8) {
        sb.vy = -sb.vy * 0.62;
      } else {
        sb.vy = 0;
      }
      const fric = Math.pow(0.18, dt);
      sb.vx *= fric;
      sb.vz *= fric;
    } else {
      const airFric = Math.pow(0.75, dt);
      sb.vx *= airFric;
      sb.vz *= airFric;
    }

    // Gol no Futebol
    if (sb.kind === 'soccer' && sb.goalCooldown <= 0 && (bPos.x < -61.2 || bPos.x > -38.8) && Math.abs(bPos.z - (-15)) < 2.1 && bPos.y < 2.1) {
      sb.goalCooldown = 1.6;
      triggerConfettiBurst(bPos.x, bPos.y + 0.6, bPos.z);
      triggerCozyHeartBurst(bPos.x, bPos.y + 0.9, bPos.z, 0x4ade80);
      const res = recordSportScore('soccer');
      addLocalMycoCoins(res.coins);
      if (window.MycoAudio) window.MycoAudio.playHarvest();
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(`⚽ GOOOOL! Placar: ⚽ ${res.soccerGoals} (+🪙 ${res.coins} MycoCoins!)`);
      syncSportBallState(ctx, sb);
    }

    // Cesta no Basquete
    if (sb.kind === 'basketball' && sb.goalCooldown <= 0 && sb.vy < 0 && Array.isArray(ctx.basketballHoops)) {
      for (let hi = 0; hi < ctx.basketballHoops.length; hi++) {
        const hoop = ctx.basketballHoops[hi];
        const hDist = Math.hypot(bPos.x - hoop.x, bPos.z - hoop.z);
        if (hDist < 0.34 && Math.abs(bPos.y - hoop.y) < 0.25) {
          sb.goalCooldown = 1.6;
          triggerConfettiBurst(hoop.x, hoop.y + 0.3, hoop.z);
          triggerCozyHeartBurst(hoop.x, hoop.y + 0.6, hoop.z, 0xfbbf24);
          const res = recordSportScore('basketball');
          addLocalMycoCoins(res.coins);
          if (window.MycoAudio) window.MycoAudio.playHarvest();
          const comboTxt = res.streak >= 2 ? ` 🔥 COMBO x${res.streak}!` : '';
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(`🏀 CESTA!${comboTxt} Placar: 🏀 ${res.basketPoints} (+🪙 ${res.coins} MycoCoins!)`);
          syncSportBallState(ctx, sb);
          break;
        }
      }
    }

    if (bPos.x < sb.minX) { bPos.x = sb.minX; sb.vx = Math.abs(sb.vx) * 0.7; }
    if (bPos.x > sb.maxX) { bPos.x = sb.maxX; sb.vx = -Math.abs(sb.vx) * 0.7; }
    if (bPos.z < sb.minZ) { bPos.z = sb.minZ; sb.vz = Math.abs(sb.vz) * 0.7; }
    if (bPos.z > sb.maxZ) { bPos.z = sb.maxZ; sb.vz = -Math.abs(sb.vz) * 0.7; }
    sb.mesh.rotation.z -= (sb.vx * dt) / sb.r;
    sb.mesh.rotation.x += (sb.vz * dt) / sb.r;
  }
}
