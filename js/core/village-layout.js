/** Geometria dos lotes em coordenadas do mundo. IDs permanentes para as locações. */
export const VILLAGE_STREET_Z = 69;
export const VILLAGE_ENTRY_X = -13;
export const VILLAGE_ENTRY = Object.freeze({ x: VILLAGE_ENTRY_X, y: 0, z: 66, yaw: Math.PI * 0.5 });
export const VILLAGE_BOUNDS = Object.freeze({ minX: -65, maxX: 65, minZ: 43, maxZ: 97 });
export const VILLAGE_HOUSE = Object.freeze({ width: 8.4, depth: 6.8, offset: -4, doorway: 1.9 });
export const VILLAGE_LOTS = Object.freeze(Array.from({ length: 10 }, (_, index) => {
  const front = index < 5 ? 1 : -1;
  const x = (index % 5 - 2) * 26;
  const z = front === 1 ? 54 : 84;
  return Object.freeze({
    id: index + 1, x, z, front,
    minX: x - 11, maxX: x + 11, minZ: z - 10, maxZ: z + 10,
    houseZ: z + front * VILLAGE_HOUSE.offset,
    doorZ: z + front * (VILLAGE_HOUSE.offset + VILLAGE_HOUSE.depth / 2),
    gateZ: z + front * 10,
    benchX: x + front * 4.6,
    benchZ: z + front * 8.48
  });
}));

export function villageDistance(x, z) {
  const b = VILLAGE_BOUNDS;
  return Math.hypot(Math.max(b.minX - x, x - b.maxX, 0), Math.max(b.minZ - z, z - b.maxZ, 0));
}

export function villageLotAt(x, z) {
  if (z < 44 || z > 94 || (z > 64 && z < 74) || Math.abs(x) > 63) return null;
  return VILLAGE_LOTS.find(lot => x >= lot.minX && x <= lot.maxX && z >= lot.minZ && z <= lot.maxZ) || null;
}

export function canPlaceVillageItem(x, z, item, lease, guestMove = false) {
  const lot = villageLotAt(x, z);
  if (guestMove) return !!lot && item?.villageEditLot === lot.id;
  if (!item || item.isReadOnly) return false;
  if (item.villageEditLot) return !!lot && item.villageEditLot === lot.id;
  return !lot || lease?.id === lot.id;
}
