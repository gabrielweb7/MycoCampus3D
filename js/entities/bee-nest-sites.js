import { VILLAGE_LOTS, VILLAGE_HOUSE } from '../core/village-layout.js';

function getStaticCampusEavesSpots() {
  return [
    { x: 17.5, y: 3.15, z: 35.15, mountType: 'eaves', label: 'Beiral do Empório' },
    { x: 50.0, y: 3.35, z: 33.35, mountType: 'eaves', label: 'Beiral da Estação Ecológica' },
    { x: 58.0, y: 3.35, z: 17.35, mountType: 'eaves', label: 'Beiral do Dormitório' },
    { x: 48.0, y: 3.45, z: -3.65, mountType: 'eaves', label: 'Beiral do Cinema' }
  ];
}

export function getHiveMountSpots(ctx, random = Math.random) {
  const candidates = [];
  for (let i = 0; i < VILLAGE_LOTS.length; i++) {
    const lot = VILLAGE_LOTS[i];
    const alongSide = (random() - 0.5) * 3;
    candidates.push(
      { x: lot.x + lot.front * 2.1, y: 2.86, z: lot.doorZ + lot.front * 0.45, mountType: 'eaves', label: `Beiral Casa #${lot.id}` },
      { x: lot.x - (VILLAGE_HOUSE.width / 2 + 0.36), y: 2.86, z: lot.houseZ + alongSide, mountType: 'eaves', label: `Beiral Casa #${lot.id}` },
      { x: lot.x + (VILLAGE_HOUSE.width / 2 + 0.36), y: 2.86, z: lot.houseZ - alongSide, mountType: 'eaves', label: `Beiral Casa #${lot.id}` }
    );
  }
  const zones = ctx && Array.isArray(ctx.roofZones) ? ctx.roofZones : null;
  if (zones && zones.length) {
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (!z || typeof z.minX !== 'number') continue;
      if (Math.abs((z.roofY || 0) - 3.02) < 0.15) continue;
      const midX = (z.minX + z.maxX) * 0.5;
      const midZ = (z.minZ + z.maxZ) * 0.5;
      const ey = Math.max(2.65, Math.min(3.55, (z.roofY || 3.4) - 0.55));
      candidates.push(
        { x: midX, y: ey, z: z.maxZ + 0.25, mountType: 'eaves', label: 'Beiral do Prédio' },
        { x: midX, y: ey, z: z.minZ - 0.25, mountType: 'eaves', label: 'Beiral do Prédio' },
        { x: z.minX - 0.25, y: ey, z: midZ, mountType: 'eaves', label: 'Beiral do Prédio' },
        { x: z.maxX + 0.25, y: ey, z: midZ, mountType: 'eaves', label: 'Beiral do Prédio' }
      );
    }
  } else {
    const statics = getStaticCampusEavesSpots();
    for (let i = 0; i < statics.length; i++) candidates.push(statics[i]);
  }
  for (const spot of ctx?.beeTreeMounts || []) candidates.push(spot);
  return candidates;
}

export function isHiveMountOccupied(spot, hives, minGap) {
  return hives.some(hive => hive && !hive.collected && Math.hypot(hive.x - spot.x, hive.z - spot.z) < minGap);
}

export function findNearestHiveMountSpot(ctx, fromX = 0, fromZ = 0) {
  const candidates = getHiveMountSpots(ctx);
  const existing = (ctx && Array.isArray(ctx.beehives)) ? ctx.beehives : [];
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    // Colmeia abandonada que ninguém recolheu continua ocupando o lugar.
    if (isHiveMountOccupied(cand, existing, 6)) continue;
    const d = Math.hypot(cand.x - fromX, cand.z - fromZ) * (0.7 + Math.random() * 0.6);
    if (d < bestDist) {
      bestDist = d;
      best = cand;
    }
  }
  return best;
}
