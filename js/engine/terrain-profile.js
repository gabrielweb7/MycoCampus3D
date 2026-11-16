export const WILDLANDS_SIZE = 2048;

export const CAVE_TUNNELS = [
  { startX: 325, startZ: -615, endX: 555, endZ: -570, floorY: 82, width: 15, height: 12 },
  { startX: -735, startZ: -350, endX: -505, endZ: -275, floorY: 108, width: 15, height: 13 },
  { startX: 535, startZ: 320, endX: 765, endZ: 385, floorY: 96, width: 15, height: 12 }
];

const RIVERS = [
  { startX: -990, startZ: -670, endX: 990, endZ: -670, amplitude: 90, waves: 1.3, phase: 0.4 },
  { startX: 760, startZ: -990, endX: 760, endZ: 990, amplitude: 120, waves: 1.5, phase: 2.1 },
  { startX: -990, startZ: 760, endX: 990, endZ: 760, amplitude: 110, waves: 1.2, phase: 4.2 }
];

const MOUNTAIN_PEAKS = [
  { x: 405, z: -525, height: 730, widthX: 190, widthZ: 230 },
  { x: -610, z: -395, height: 840, widthX: 220, widthZ: 180 },
  { x: 685, z: 420, height: 780, widthX: 210, widthZ: 230 },
  { x: -345, z: 735, height: 650, widthX: 250, widthZ: 190 },
  { x: 845, z: -125, height: 910, widthX: 175, widthZ: 220 },
  { x: -845, z: 590, height: 790, widthX: 210, widthZ: 200 }
];

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function riverPoint(river, t) {
  const dx = river.endX - river.startX;
  const dz = river.endZ - river.startZ;
  const length = Math.hypot(dx, dz) || 1;
  const wave = Math.sin(t * Math.PI * 2 * river.waves + river.phase) * river.amplitude;
  return {
    x: river.startX + dx * t - (dz / length) * wave,
    z: river.startZ + dz * t + (dx / length) * wave
  };
}

function distanceToRiver(river, x, z) {
  const dx = river.endX - river.startX;
  const dz = river.endZ - river.startZ;
  const lengthSquared = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((x - river.startX) * dx + (z - river.startZ) * dz) / lengthSquared));
  const length = Math.sqrt(lengthSquared);
  const signedDistance = ((x - river.startX) * -dz + (z - river.startZ) * dx) / length;
  const wave = Math.sin(t * Math.PI * 2 * river.waves + river.phase) * river.amplitude;
  return Math.abs(signedDistance - wave);
}

function caveDistance(cave, x, z) {
  const dx = cave.endX - cave.startX;
  const dz = cave.endZ - cave.startZ;
  const lengthSquared = dx * dx + dz * dz;
  const rawT = ((x - cave.startX) * dx + (z - cave.startZ) * dz) / lengthSquared;
  const t = Math.max(0, Math.min(1, rawT));
  const closestX = cave.startX + dx * t;
  const closestZ = cave.startZ + dz * t;
  return { distance: Math.hypot(x - closestX, z - closestZ), t, rawT };
}

export function getRiverCenterline(riverIndex, segments) {
  const river = RIVERS[riverIndex];
  if (!river) return [];
  const count = Math.max(2, segments || 180);
  const points = [];
  for (let i = 0; i <= count; i++) points.push(riverPoint(river, i / count));
  return points;
}

export function getRiverDistance(x, z) {
  let closest = Infinity;
  for (let i = 0; i < RIVERS.length; i++) {
    closest = Math.min(closest, distanceToRiver(RIVERS[i], x, z));
  }
  return closest;
}

export function getCaveCenterline(cave, segments) {
  const count = Math.max(2, segments || 32);
  const points = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    points.push({
      x: cave.startX + (cave.endX - cave.startX) * t,
      z: cave.startZ + (cave.endZ - cave.startZ) * t
    });
  }
  return points;
}

export function terrainHeight(x, z) {
  const campusDistance = Math.max(Math.abs(x) - 76, Math.abs(z - 1) - 50);
  const campusBlend = smoothstep(0, 30, campusDistance);
  const radius = Math.hypot(x, z);
  const hills = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 2.4
    + Math.sin(x * 0.11 + z * 0.09) * 0.7;
  const mountainBlend = smoothstep(140, 320, radius) * (1 - smoothstep(900, 1080, radius));
  const broadRidge = Math.sin(x * 0.005 + Math.sin(z * 0.0024))
    * Math.cos(z * 0.0045 - x * 0.0028);
  let height = campusBlend * hills + mountainBlend * Math.pow(Math.max(0, broadRidge + 0.18), 2) * 255;

  for (let i = 0; i < MOUNTAIN_PEAKS.length; i++) {
    const peak = MOUNTAIN_PEAKS[i];
    const dx = (x - peak.x) / peak.widthX;
    const dz = (z - peak.z) / peak.widthZ;
    height += peak.height * Math.exp(-1.35 * (dx * dx + dz * dz));
  }

  for (let i = 0; i < RIVERS.length; i++) {
    const distance = distanceToRiver(RIVERS[i], x, z);
    height -= (1 - smoothstep(5, 28, distance)) * 11;
  }

  for (let i = 0; i < CAVE_TUNNELS.length; i++) {
    const cave = CAVE_TUNNELS[i];
    const nearest = caveDistance(cave, x, z);
    if (nearest.rawT > -0.15 && nearest.rawT < 1.15 && nearest.distance < cave.width * 0.78) {
      const acrossBlend = 1 - smoothstep(cave.width * 0.58, cave.width * 0.78, nearest.distance);
      const alongBlend = nearest.rawT < 0
        ? smoothstep(-0.15, 0, nearest.rawT)
        : (nearest.rawT > 1 ? 1 - smoothstep(1, 1.15, nearest.rawT) : 1);
      height += (cave.floorY - height) * acrossBlend * alongBlend;
    }
  }

  return height;
}
