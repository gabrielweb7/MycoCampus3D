/**
 * Catálogo de Prefabs de Itens e Móveis (MycoCampus3D)
 * Base extensível para criação dinâmica (Admin Editor, Loja, Presets de Vidros/Equipamentos).
 */

const prefabRegistry = new Map();

/**
 * Registra um prefab reutilizável no catálogo.
 * @param {string} prefabId
 * @param {{ label: string, category?: string, factory: function(object, object): object }} def
 */
export function registerItemPrefab(prefabId, def) {
  if (!prefabId || !def || typeof def.factory !== 'function') {
    throw new Error('Prefab inválido: informe prefabId e factory(ctx, opts).');
  }
  prefabRegistry.set(prefabId, {
    prefabId,
    label: def.label || prefabId,
    category: def.category || 'misc',
    factory: def.factory
  });
}

export function getItemPrefab(prefabId) {
  return prefabRegistry.get(prefabId) || null;
}

export function listItemPrefabs(category) {
  const all = Array.from(prefabRegistry.values());
  return category ? all.filter((p) => p.category === category) : all;
}

/**
 * Instancia um item no mundo a partir de um prefabId registrado.
 * @param {object} ctx
 * @param {string} prefabId
 * @param {{ id?: string, x?: number, y?: number, z?: number, ry?: number, label?: string }} [opts]
 */
export function spawnItemFromPrefab(ctx, prefabId, opts) {
  const def = getItemPrefab(prefabId);
  if (!def) return null;
  const resolvedOpts = Object.assign({ x: 0, y: 0, z: 0, ry: 0 }, opts || {});
  const item = def.factory(ctx, resolvedOpts);
  if (item && item.meta) {
    item.meta.prefabId = prefabId;
  }
  if (item && item.mesh && item.mesh.userData) {
    item.mesh.userData.prefabId = prefabId;
  }
  return item;
}
