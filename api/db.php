<?php
/**
 * MycoCampus3D - Conexao PDO, migracoes automaticas e helpers compartilhados da API.
 */
declare(strict_types=1);

const MC_SCHEMA_VERSION = 2;
const MC_TOKEN_TTL_DAYS = 30;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

$cfgPath = __DIR__ . '/config.php';
if (!file_exists($cfgPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Arquivo api/config.php nao configurado no servidor.']);
    exit;
}
require_once $cfgPath;

function mc_json(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Corpo JSON da requisicao (aceita tambem text/plain do sendBeacon e form-data). */
function mc_body(): array {
    static $body = null;
    if ($body !== null) return $body;
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw ?: '', true);
    $body = is_array($decoded) ? $decoded : ($_POST ?: []);
    return $body;
}

function mc_action(string $default): string {
    $body = mc_body();
    return (string)($_GET['action'] ?? $body['action'] ?? $default);
}

function mc_clean_hex($raw, string $fallback): string {
    $raw = (string)$raw;
    return preg_match('/^#[0-9a-fA-F]{6}$/', $raw) ? strtolower($raw) : $fallback;
}

function mc_table_exists(PDO $pdo, string $table): bool {
    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
    $st->execute([$table]);
    return (int)$st->fetchColumn() > 0;
}

function mc_column_exists(PDO $pdo, string $table, string $column): bool {
    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
    $st->execute([$table, $column]);
    return (int)$st->fetchColumn() > 0;
}

function mc_run_schema_file(PDO $pdo): void {
    $schemaFile = __DIR__ . '/../database/schema.sql';
    $sql = (string)file_get_contents($schemaFile);
    $sql = preg_replace('/^\s*--.*$/m', '', $sql);
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
        if ($stmt !== '') $pdo->exec($stmt);
    }
}

function mc_migrate(PDO $pdo): void {
    $version = 0;
    if (mc_table_exists($pdo, 'mc_meta')) {
        $version = (int)($pdo->query("SELECT meta_val FROM mc_meta WHERE meta_key = 'schema_version'")->fetchColumn() ?: 0);
    }
    if ($version >= MC_SCHEMA_VERSION) return;

    // v0/v1 -> v2: corrige tipos do schema inicial (cores/itens como INT, last_seen sem default...)
    if (mc_table_exists($pdo, 'mc_users')) {
        $pdo->exec("ALTER TABLE mc_users
            MODIFY username VARCHAR(48) NOT NULL,
            MODIFY display_name VARCHAR(64) NOT NULL,
            MODIFY hat_color VARCHAR(7) NOT NULL DEFAULT '#dc2626',
            MODIFY body_color VARCHAR(7) NOT NULL DEFAULT '#4f46e5'");
        $pdo->exec("UPDATE mc_users SET hat_color = '#dc2626' WHERE hat_color NOT REGEXP '^#[0-9a-fA-F]{6}$'");
        $pdo->exec("UPDATE mc_users SET body_color = '#4f46e5' WHERE body_color NOT REGEXP '^#[0-9a-fA-F]{6}$'");
        if (!mc_column_exists($pdo, 'mc_users', 'last_harvest_at')) {
            $pdo->exec('ALTER TABLE mc_users ADD COLUMN last_harvest_at DATETIME(3) NULL AFTER completed_modules');
        }
        if (!mc_column_exists($pdo, 'mc_users', 'login_fails')) {
            $pdo->exec('ALTER TABLE mc_users ADD COLUMN login_fails INT NOT NULL DEFAULT 0 AFTER last_harvest_at');
        }
        if (!mc_column_exists($pdo, 'mc_users', 'login_locked_until')) {
            $pdo->exec('ALTER TABLE mc_users ADD COLUMN login_locked_until DATETIME NULL AFTER login_fails');
        }
    }
    // Tabelas efemeras (posicoes online e objetos do lab): recriadas com os tipos corretos
    $pdo->exec('DROP TABLE IF EXISTS mc_sessions');
    $pdo->exec('DROP TABLE IF EXISTS mc_world_objects');

    mc_run_schema_file($pdo);

    $up = $pdo->prepare("INSERT INTO mc_meta (meta_key, meta_val) VALUES ('schema_version', ?) ON DUPLICATE KEY UPDATE meta_val = VALUES(meta_val)");
    $up->execute([(string)MC_SCHEMA_VERSION]);
}

function mc_db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    mc_migrate($pdo);
    return $pdo;
}

function mc_db_or_fail(): PDO {
    try {
        return mc_db();
    } catch (Throwable $e) {
        error_log('[MycoCampus3D] DB: ' . $e->getMessage());
        mc_json(['ok' => false, 'error' => 'Banco MySQL indisponivel. Verifique api/config.php.'], 500);
    }
}

function mc_is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function mc_set_auth_cookie(string $token): void {
    setcookie('mc_token', $token, [
        'expires' => time() + (86400 * MC_TOKEN_TTL_DAYS),
        'path' => '/',
        'secure' => mc_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function mc_clear_auth_cookie(): void {
    setcookie('mc_token', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => mc_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** Gera token de sessao (retorna o token puro; salva apenas o hash). */
function mc_issue_token(PDO $pdo, int $userId): string {
    $pdo->exec('DELETE FROM mc_auth_tokens WHERE last_used < (NOW() - INTERVAL ' . MC_TOKEN_TTL_DAYS . ' DAY)');
    $token = bin2hex(random_bytes(32));
    $ins = $pdo->prepare('INSERT INTO mc_auth_tokens (token_hash, user_id) VALUES (?, ?)');
    $ins->execute([hash('sha256', $token), $userId]);
    mc_set_auth_cookie($token);
    return $token;
}

/** Valida token (JSON ou cookie HttpOnly). Retorna a linha do usuario ou encerra com 401. */
function mc_require_user(PDO $pdo): array {
    $body = mc_body();
    $userId = (int)($body['user_id'] ?? 0);
    $token = (string)($body['token'] ?? $_COOKIE['mc_token'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        mc_json(['ok' => false, 'error' => 'Sessao invalida. Entre novamente.', 'auth' => false], 401);
    }
    $hash = hash('sha256', $token);
    if ($userId > 0) {
        $st = $pdo->prepare('SELECT u.* FROM mc_auth_tokens t JOIN mc_users u ON u.id = t.user_id WHERE t.token_hash = ? AND u.id = ? LIMIT 1');
        $st->execute([$hash, $userId]);
    } else {
        $st = $pdo->prepare('SELECT u.* FROM mc_auth_tokens t JOIN mc_users u ON u.id = t.user_id WHERE t.token_hash = ? LIMIT 1');
        $st->execute([$hash]);
    }
    $user = $st->fetch();
    if (!$user) {
        mc_clear_auth_cookie();
        mc_json(['ok' => false, 'error' => 'Sessao expirada. Entre novamente.', 'auth' => false], 401);
    }
    $touch = $pdo->prepare('UPDATE mc_auth_tokens SET last_used = NOW() WHERE token_hash = ? AND last_used < (NOW() - INTERVAL 60 SECOND)');
    $touch->execute([$hash]);
    return $user;
}

function mc_is_professor(array $user): bool {
    return in_array((string)$user['role'], ['professor', 'admin'], true);
}
