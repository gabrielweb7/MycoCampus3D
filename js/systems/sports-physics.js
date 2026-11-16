/**
 * Fisica das Bolas Esportivas (Futebol e Basquete) e Deteccao de Gol (MycoCampus3D)
 */

import { triggerConfettiBurst } from '../entities/confetti.js';

export function stepSportBalls(ctx, dt) {
  if (!ctx.sportBalls.length) return;

  for (let sbi = 0; sbi < ctx.sportBalls.length; sbi++) {
    const sb = ctx.sportBalls[sbi];
    const bPos = sb.mesh.position;
    if (sb.goalCooldown > 0) {
      sb.goalCooldown -= dt;
      if (sb.goalCooldown <= 0) {
        bPos.set(sb.homeX, sb.groundY + sb.r, sb.homeZ);
        sb.vx = 0; sb.vy = 0; sb.vz = 0;
      }
    }
    const bdx = bPos.x - ctx.playerPos.x;
    const bdz = bPos.z - ctx.playerPos.z;
    const bDistSq = bdx * bdx + bdz * bdz;
    const touchR = 0.42 + sb.r;
    if (bDistSq < touchR * touchR && Math.abs(ctx.playerPos.y - bPos.y) < 1.25) {
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
    if (sb.kind === 'soccer' && sb.goalCooldown <= 0 && (bPos.x < -61.2 || bPos.x > -38.8) && Math.abs(bPos.z - (-15)) < 2.1 && bPos.y < 2.1) {
      sb.goalCooldown = 1.6;
      triggerConfettiBurst(bPos.x, bPos.y + 0.6, bPos.z);
      if (window.MycoAudio) window.MycoAudio.playHarvest();
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚽ GOOOOL! 🎉');
    }
    if (bPos.x < sb.minX) { bPos.x = sb.minX; sb.vx = Math.abs(sb.vx) * 0.7; }
    if (bPos.x > sb.maxX) { bPos.x = sb.maxX; sb.vx = -Math.abs(sb.vx) * 0.7; }
    if (bPos.z < sb.minZ) { bPos.z = sb.minZ; sb.vz = Math.abs(sb.vz) * 0.7; }
    if (bPos.z > sb.maxZ) { bPos.z = sb.maxZ; sb.vz = -Math.abs(sb.vz) * 0.7; }
    sb.mesh.rotation.z -= (sb.vx * dt) / sb.r;
    sb.mesh.rotation.x += (sb.vz * dt) / sb.r;
  }
}
