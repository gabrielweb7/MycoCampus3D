/**
 * MycoCampus3D — Logger & Depuracao Centralizada de Erros
 * Captura erros globais, rejeicoes de Promises e logs estruturados por modulo.
 */

const MAX_LOGS = 120;
const logBuffer = [];
let globalHandlersInstalled = false;
let reportWindowStartedAt = Date.now();
let reportsInWindow = 0;
const recentErrorReports = new Map();

function reportError(entry) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;

  const now = Date.now();
  if (now - reportWindowStartedAt >= 60000) {
    reportWindowStartedAt = now;
    reportsInWindow = 0;
    recentErrorReports.clear();
  }
  if (reportsInWindow >= 10) return;

  const fingerprint = `${entry.scope}:${entry.message}`;
  const previousAt = recentErrorReports.get(fingerprint);
  if (previousAt && now - previousAt < 30000) return;
  recentErrorReports.set(fingerprint, now);
  reportsInWindow++;

  let detail = '';
  try {
    detail = JSON.stringify(entry.detail);
  } catch (e) {
    detail = String(entry.detail || '');
  }

  const payload = {
    client_time: entry.ts,
    scope: entry.scope,
    message: entry.message,
    detail: String(detail || '').slice(0, 8000),
    app_version: window.MYCO_VERSION || 'unknown'
  };

  fetch('api/error.php?action=report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'omit',
    keepalive: true
  }).then((res) => {
    if (!res.ok) console.warn('[Myco] Falha ao enviar erro para o servidor:', res.status);
  }).catch((err) => {
    console.warn('[Myco] Falha de rede ao enviar erro para o servidor:', err);
  });
}

function pushEntry(level, scope, message, detail) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope: scope || 'app',
    message: String(message || ''),
    detail: detail !== undefined ? detail : null
  };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  return entry;
}

export const logger = {
  info(scope, message, detail) {
    return pushEntry('info', scope, message, detail);
  },

  warn(scope, message, detail) {
    const entry = pushEntry('warn', scope, message, detail);
    console.warn(`[Myco:${entry.scope}] ${entry.message}`, detail !== undefined ? detail : '');
    return entry;
  },

  error(scope, message, err) {
    const detail = err && err.stack ? { message: err.message, stack: err.stack } : err;
    const entry = pushEntry('error', scope, message, detail);
    console.error(`[Myco:${entry.scope}] ${entry.message}`, err || '');
    reportError(entry);
    return entry;
  },

  getLogs(levelFilter) {
    if (!levelFilter) return logBuffer.slice();
    return logBuffer.filter((e) => e.level === levelFilter);
  },

  getErrors() {
    return logBuffer.filter((e) => e.level === 'error');
  },

  clear() {
    logBuffer.length = 0;
  },

  tryCall(scope, fn, fallback) {
    try {
      return fn();
    } catch (err) {
      logger.error(scope, err && err.message ? err.message : 'Erro inesperado', err);
      return fallback;
    }
  }
};

export function installGlobalErrorHandlers() {
  if (globalHandlersInstalled || typeof window === 'undefined') return;
  globalHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    logger.error('global', event.message || 'Erro de execucao', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error && event.error.stack ? event.error.stack : event.error
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logger.error('promise', reason && reason.message ? reason.message : 'Promise rejeitada sem tratamento', reason);
  });
}
