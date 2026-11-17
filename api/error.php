<?php
/**
 * Receives browser errors and serves recent reports to authenticated admins.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

const MC_ERROR_MAX_BODY_BYTES = 16384;
const MC_ERROR_MAX_LOG_BYTES = 4194304;
const MC_ERROR_KEEP_LOG_BYTES = 2097152;
const MC_ERROR_MAX_PER_IP_PER_MINUTE = 20;

function mc_error_clean(string $value, int $maxLength): string {
    $value = preg_replace('/[\x00-\x1F\x7F]/', ' ', $value) ?? '';
    $value = preg_replace('/([?&](?:token|pin|password|authorization|key)=)[^&\s]*/i', '$1[redacted]', $value) ?? $value;
    $value = preg_replace('/\b(token|pin|password|authorization)\s*[:=]\s*[^,\s;]+/i', '$1=[redacted]', $value) ?? $value;
    return mb_substr(trim($value), 0, $maxLength, 'UTF-8');
}

function mc_error_rate_status(string $dataDir): int {
    if (!is_dir($dataDir) && !@mkdir($dataDir, 0750, true) && !is_dir($dataDir)) {
        return -1;
    }

    $fp = @fopen($dataDir . '/.error-rate.json', 'c+');
    if ($fp === false || !flock($fp, LOCK_EX)) {
        if (is_resource($fp)) fclose($fp);
        return -1;
    }

    rewind($fp);
    $state = json_decode((string)stream_get_contents($fp), true);
    if (!is_array($state)) $state = [];

    $window = intdiv(time(), 60);
    foreach ($state as $key => $entry) {
        if (!is_array($entry) || (int)($entry['window'] ?? 0) < $window - 1) {
            unset($state[$key]);
        }
    }

    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $key = hash('sha256', $ip) . ':' . $window;
    $count = (int)($state[$key]['count'] ?? 0);
    if ($count >= MC_ERROR_MAX_PER_IP_PER_MINUTE) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return 0;
    }

    $state[$key] = ['window' => $window, 'count' => $count + 1];
    $encoded = json_encode($state);
    if ($encoded === false) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return -1;
    }

    rewind($fp);
    ftruncate($fp, 0);
    $written = fwrite($fp, $encoded);
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $written === strlen($encoded) ? 1 : -1;
}

function mc_error_write(array $record, string $dataDir): bool {
    if (!is_dir($dataDir) && !@mkdir($dataDir, 0750, true) && !is_dir($dataDir)) {
        return false;
    }

    $encoded = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) return false;

    $fp = @fopen($dataDir . '/game-errors.jsonl', 'c+');
    if ($fp === false || !flock($fp, LOCK_EX)) {
        if (is_resource($fp)) fclose($fp);
        return false;
    }

    fseek($fp, 0, SEEK_END);
    $size = ftell($fp);
    if ($size !== false && $size >= MC_ERROR_MAX_LOG_BYTES) {
        fseek($fp, max(0, $size - MC_ERROR_KEEP_LOG_BYTES));
        $tail = stream_get_contents($fp);
        $lineBreak = strpos((string)$tail, "\n");
        $tail = $lineBreak === false ? '' : substr((string)$tail, $lineBreak + 1);
        rewind($fp);
        ftruncate($fp, 0);
        if ($tail !== '' && fwrite($fp, $tail) !== strlen($tail)) {
            flock($fp, LOCK_UN);
            fclose($fp);
            return false;
        }
    }

    fseek($fp, 0, SEEK_END);
    $line = $encoded . "\n";
    $written = fwrite($fp, $line);
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $written === strlen($line);
}

$action = (string)($_GET['action'] ?? 'report');
$method = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');
$dataDir = __DIR__ . '/../data';
$logPath = $dataDir . '/game-errors.jsonl';

if ($action === 'report') {
    if ($method !== 'POST') {
        mc_json(['ok' => false, 'error' => 'Método HTTP inválido. Use POST.'], 405);
    }

    $raw = file_get_contents('php://input', false, null, 0, MC_ERROR_MAX_BODY_BYTES + 1);
    if ($raw === false || strlen($raw) > MC_ERROR_MAX_BODY_BYTES) {
        mc_json(['ok' => false, 'error' => 'Relatório de erro muito grande.'], 413);
    }
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        mc_json(['ok' => false, 'error' => 'Relatório de erro inválido.'], 400);
    }

    $message = mc_error_clean((string)($body['message'] ?? ''), 500);
    if ($message === '') {
        mc_json(['ok' => false, 'error' => 'Mensagem do erro obrigatória.'], 400);
    }

    $rateStatus = mc_error_rate_status($dataDir);
    if ($rateStatus === 0) {
        mc_json(['ok' => false, 'error' => 'Limite de relatórios atingido.'], 429);
    }
    if ($rateStatus < 0) {
        error_log('[MycoCampus3D] Não foi possível atualizar o limite de relatórios de erro.');
        mc_json(['ok' => false, 'error' => 'Não foi possível registrar o erro.'], 500);
    }

    $detail = $body['detail'] ?? '';
    if (is_array($detail) || is_object($detail)) {
        $detail = json_encode($detail, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
    } elseif (!is_scalar($detail)) {
        $detail = '';
    }

    $record = [
        'server_time' => gmdate('c'),
        'client_time' => mc_error_clean((string)($body['client_time'] ?? ''), 40),
        'app_version' => mc_error_clean((string)($body['app_version'] ?? ''), 30),
        'scope' => mc_error_clean((string)($body['scope'] ?? ''), 80),
        'message' => $message,
        'detail' => mc_error_clean((string)$detail, 8000),
    ];

    if (!mc_error_write($record, $dataDir)) {
        error_log('[MycoCampus3D] Não foi possível gravar o relatório de erro.');
        mc_json(['ok' => false, 'error' => 'Não foi possível registrar o erro.'], 500);
    }
    mc_json(['ok' => true], 202);
}

if ($action === 'list') {
    if ($method !== 'GET') {
        mc_json(['ok' => false, 'error' => 'Método HTTP inválido. Use GET.'], 405);
    }

    $user = mc_require_user(mc_db_or_fail());
    if (!mc_is_admin($user)) {
        mc_json(['ok' => false, 'error' => 'Acesso restrito ao Administrador.'], 403);
    }

    $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
    $errors = [];
    if (is_file($logPath) && is_readable($logPath)) {
        $lines = file($logPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach (array_slice($lines ?: [], -$limit) as $line) {
            $entry = json_decode($line, true);
            if (is_array($entry)) $errors[] = $entry;
        }
    }
    mc_json(['ok' => true, 'errors' => array_reverse($errors)]);
}

if ($action === 'clear') {
    if ($method !== 'POST') {
        mc_json(['ok' => false, 'error' => 'Método HTTP inválido. Use POST.'], 405);
    }

    $user = mc_require_user(mc_db_or_fail());
    if (!mc_is_admin($user)) {
        mc_json(['ok' => false, 'error' => 'Acesso restrito ao Administrador.'], 403);
    }

    if (is_file($logPath)) {
        $fp = @fopen($logPath, 'c+');
        if ($fp === false || !flock($fp, LOCK_EX)) {
            if (is_resource($fp)) fclose($fp);
            mc_json(['ok' => false, 'error' => 'Não foi possível limpar o arquivo de erros.'], 500);
        }
        ftruncate($fp, 0);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    }
    mc_json(['ok' => true]);
}

mc_json(['ok' => false, 'error' => 'Ação desconhecida.'], 400);
