const memory = new Map();

function prefix(userId) {
  return `myco_coin_outbox:${userId}:`;
}

export function pendingCoinOperations(userId) {
  const scope = prefix(userId);
  const entries = new Map();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(scope)) entries.set(key, Number(localStorage.getItem(key)));
    }
  } catch (_) {}
  for (const [key, delta] of memory) {
    if (key.startsWith(scope)) entries.set(key, delta);
  }
  return [...entries]
    .filter(([, delta]) => Number.isInteger(delta) && delta !== 0 && Math.abs(delta) <= 5000)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, delta]) => ({ operation_id: key.slice(scope.length), delta }));
}

export function enqueueCoinDelta(userId, delta) {
  const amount = Math.trunc(Number(delta));
  if (!Number.isSafeInteger(amount) || !amount) return;
  let remaining = amount;
  for (let index = 0; remaining; index++) {
    const chunk = Math.max(-5000, Math.min(5000, remaining));
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
      byte.toString(16).padStart(2, '0')).join('');
    const id = `${Date.now().toString(36)}-${index.toString(36).padStart(4, '0')}-${nonce}`;
    const key = prefix(userId) + id;
    try {
      localStorage.setItem(key, String(chunk));
    } catch (_) {
      memory.set(key, chunk);
    }
    remaining -= chunk;
  }
}

export function acknowledgeCoinOperation(userId, operationId) {
  const key = prefix(userId) + operationId;
  memory.delete(key);
  try { localStorage.removeItem(key); } catch (_) {}
}
