const LOCAL_MOVED_STORAGE_KEY = 'myco_local_world_objects_v1';
let localMovedCache = null;
let localMovedDirty = false;

export function readLocalMovedMap({ reload = false } = {}) {
  if (reload) localMovedCache = null;
  if (localMovedCache !== null) return localMovedCache;
  if (typeof localStorage === 'undefined') {
    localMovedCache = {};
    return localMovedCache;
  }
  try {
    const raw = localStorage.getItem(LOCAL_MOVED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    localMovedCache = (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    localMovedCache = {};
  }
  return localMovedCache;
}

function writeLocalMovedMap(map) {
  localMovedCache = (map && typeof map === 'object') ? map : {};
  localMovedDirty = false;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_MOVED_STORAGE_KEY, JSON.stringify(localMovedCache));
  } catch (e) {}
}

export function flushLocalMovedObjects() {
  if (!localMovedDirty || localMovedCache === null) return;
  writeLocalMovedMap(localMovedCache);
}

export function setLocalMovedEntry(itemId, entry, deferFlush = false) {
  const map = readLocalMovedMap();
  const prev = map[itemId];
  if (prev &&
    prev.x === entry.x && prev.y === entry.y && prev.z === entry.z && prev.ry === entry.ry &&
    prev.prefabId === entry.prefabId &&
    JSON.stringify(prev.state || null) === JSON.stringify(entry.state || null)) {
    return;
  }
  map[itemId] = entry;
  localMovedDirty = true;
  if (!deferFlush) flushLocalMovedObjects();
}

export function saveLocalMovedObject(item, state, deferFlush = false) {
  if (!item || !item.id || !item.mesh || item.isPersonal) return;
  const map = readLocalMovedMap();
  const prev = map[item.id] || {};
  const entry = {
    x: Number(item.mesh.position.x.toFixed(4)),
    y: Number(item.mesh.position.y.toFixed(4)),
    z: Number(item.mesh.position.z.toFixed(4)),
    ry: Number((item.mesh.rotation.y || 0).toFixed(4))
  };
  const prefabId = (item.meta && item.meta.prefabId) || (item.mesh.userData && item.mesh.userData.prefabId) || prev.prefabId;
  if (prefabId) entry.prefabId = prefabId;
  if (state !== undefined) entry.state = state;
  else if (prev.state !== undefined) entry.state = prev.state;
  setLocalMovedEntry(item.id, entry, deferFlush);
}

export function saveLocalItemState(item, state, deferFlush = false) {
  if (item.isPersonal) return;
  const entry = readLocalMovedMap()[item.id];
  if (entry) setLocalMovedEntry(item.id, { ...entry, state }, deferFlush);
}

export function clearLocalMovedObjects() {
  localMovedCache = {};
  localMovedDirty = false;
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(LOCAL_MOVED_STORAGE_KEY); } catch (e) {}
}
