// Origin and number of transfers are independent. Older saves have unknown origin.
export function normalizeCultureOrigin(origin) {
  return origin === 'monospore' || origin === 'tissue_clone' || origin === 'hybrid' ? origin : '';
}

export function getCultureOriginLabel(origin) {
  if (origin === 'monospore') return 'Monoesporo';
  if (origin === 'tissue_clone') return 'Isolado por clonagem';
  if (origin === 'hybrid') return 'Híbrido';
  return '';
}

export function calculateHarvestYieldGrams(baseGrams = 10, origin = '', hasCasing = false) {
  const cloneMultiplier = origin === 'tissue_clone' ? 1.35 : 1;
  return Math.max(1, Math.round((Number(baseGrams) || 10) * cloneMultiplier * (hasCasing ? 1.25 : 1)));
}
