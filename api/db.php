<?php
/**
 * MycoCampus3D - Conexao PDO, migracoes automaticas e helpers compartilhados da API.
 */
declare(strict_types=1);

const MC_SCHEMA_VERSION = 21;
const MC_TOKEN_TTL_DAYS = 30;
const MC_PETS = ['cat_orange', 'cat_black', 'cat_calico', 'dog_golden', 'dog_husky', 'dog_pug'];

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

function mc_run_schema_file(PDO $pdo): void {
    $schemaFile = __DIR__ . '/../database/schema.sql';
    if (!file_exists($schemaFile)) return;
    $sql = (string)file_get_contents($schemaFile);
    $sql = preg_replace('/^\s*--.*$/m', '', $sql);
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
        if ($stmt !== '') {
            try { $pdo->exec($stmt); } catch (Throwable $e) {}
        }
    }
}

/**
 * Executa migracoes do schema se necessario.
 * Usa arquivo de flag em data/.migrated_vX para NUNCA consultar information_schema
 * nem mc_meta repetidamente durante o polling de 200ms.
 */
function mc_migrate(PDO $pdo): void {
    $flagFile = __DIR__ . '/../data/.migrated_v' . MC_SCHEMA_VERSION;
    if (file_exists($flagFile)) {
        return;
    }

    $version = 0;
    try {
        $st = $pdo->query("SELECT meta_val FROM mc_meta WHERE meta_key = 'schema_version'");
        $version = (int)($st ? $st->fetchColumn() : 0);
    } catch (Throwable $e) {
        $version = 0;
    }

    if ($version < MC_SCHEMA_VERSION) {
        mc_run_schema_file($pdo);
        if ($version < 21) {
            $pdo->query('SELECT lot_id, upgrades_json FROM mc_village_upgrades LIMIT 0');
        }
        if ($version < 20) {
            $pdo->query('SELECT owner_id, guest_id FROM mc_village_trusted LIMIT 0');
        }
        if ($version < 19) {
            $pdo->query('SELECT lot_id, user_id, lease_epoch FROM mc_village_editors LIMIT 0');
        }

        if ($version < 16) {
            $pdo->query('SELECT lot_id, owner_id, expires_at, lease_epoch FROM mc_village_lots LIMIT 0');
            $pdo->query('SELECT item_id, owner_id, lot_id, lease_epoch FROM mc_village_items LIMIT 0');
            $pdo->query('SELECT item_id, owner_id, pickup_at, paid FROM mc_village_sales LIMIT 0');
            $pdo->query('SELECT owner_id, body FROM mc_village_notes LIMIT 0');
            $pdo->exec('INSERT IGNORE INTO mc_village_lots (lot_id) VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10)');
        }

        if ($version < 15) {
            $petColumn = $pdo->query("SHOW COLUMNS FROM mc_sessions LIKE 'pet_json'")->fetch();
            if (!$petColumn) $pdo->exec('ALTER TABLE mc_sessions ADD COLUMN pet_json TEXT NULL');
            // Do not advance the migration marker if either inventory table is missing.
            $pdo->query('SELECT item_id FROM mc_inventory_slots LIMIT 0');
            $pdo->query('SELECT user_id FROM mc_inventory_control LIMIT 0');
            $pdo->query("SELECT meta_key FROM mc_meta WHERE meta_key = 'inventory_lock'");
        }

        if ($version < 13) {
            $pdo->query('SELECT operation_id FROM mc_coin_operations LIMIT 0');
            $strokeColumn = $pdo->query("SHOW COLUMNS FROM mc_board_strokes LIKE 'stroke_key'")->fetch();
            if (!$strokeColumn) {
                $pdo->exec('ALTER TABLE mc_board_strokes ADD COLUMN stroke_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL, ADD UNIQUE KEY idx_board_stroke_key (stroke_key)');
            }
        }

        // v3 -> v4: Isolamento de poses em mc_user_poses e limpeza de mc_world_state
        try {
            $pdo->exec("DELETE FROM mc_world_state WHERE state_key LIKE 'upose_%'");
        } catch (Throwable $e) {}

        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS mc_user_poses (
                user_id INT PRIMARY KEY,
                pose_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS mc_admin_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                target_user_id INT NOT NULL,
                action_type VARCHAR(32) NOT NULL,
                payload TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_target (target_user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("ALTER TABLE mc_sessions ADD INDEX idx_sessions_user (user_id)");
        } catch (Throwable $e) {}

        // v4 -> v5: Cosméticos (chapéus) e Emotes Multiplayer
        try {
            $pdo->exec("ALTER TABLE mc_users ADD COLUMN unlocked_hats TEXT NULL");
        } catch (Throwable $e) {}
        try {
            $pdo->exec("ALTER TABLE mc_users ADD COLUMN current_hat VARCHAR(32) NOT NULL DEFAULT 'default'");
        } catch (Throwable $e) {}
        try {
            $pdo->exec("ALTER TABLE mc_sessions ADD COLUMN current_hat VARCHAR(32) NOT NULL DEFAULT 'default'");
        } catch (Throwable $e) {}
        try {
            $pdo->exec("ALTER TABLE mc_sessions ADD COLUMN emote VARCHAR(16) NOT NULL DEFAULT ''");
        } catch (Throwable $e) {}

        // v5 -> v7: Tabela de lousa garantida + Índices de performance (ranking e limpeza de tokens)
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS mc_board_strokes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                stroke_json MEDIUMTEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        } catch (Throwable $e) {}
        try {
            $pdo->exec("ALTER TABLE mc_users ADD INDEX idx_users_leaderboard (xp, mushrooms_harvested)");
        } catch (Throwable $e) {}
        try {
            $pdo->exec("ALTER TABLE mc_auth_tokens ADD INDEX idx_tokens_last_used (last_used)");
        } catch (Throwable $e) {}
        try {
            $pdo->exec("ALTER TABLE mc_users ADD COLUMN myco_coins INT NOT NULL DEFAULT 250");
        } catch (Throwable $e) {}

        // v8 -> v9: Tabelas de layout persistente do Modo Admin Editor (edições em tempo real + padrão salvo)
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS mc_world_layout_edits (
                item_id VARCHAR(64) PRIMARY KEY,
                prefab_id VARCHAR(64) NOT NULL DEFAULT '',
                label VARCHAR(96) NOT NULL DEFAULT '',
                scale DOUBLE NOT NULL DEFAULT 1,
                removed TINYINT(1) NOT NULL DEFAULT 0,
                updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $pdo->exec("CREATE TABLE IF NOT EXISTS mc_admin_layout_defaults (
                item_id VARCHAR(64) PRIMARY KEY,
                prefab_id VARCHAR(64) NOT NULL DEFAULT '',
                label VARCHAR(96) NOT NULL DEFAULT '',
                scale DOUBLE NOT NULL DEFAULT 1,
                x DOUBLE NOT NULL DEFAULT 0,
                y DOUBLE NOT NULL DEFAULT 0,
                z DOUBLE NOT NULL DEFAULT 0,
                ry DOUBLE NOT NULL DEFAULT 0,
                removed TINYINT(1) NOT NULL DEFAULT 0,
                saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        } catch (Throwable $e) {}

        // v9 -> v10: Precisão de microssegundos em mc_world_objects.updated_at para sync instantâneo sem colisões no mesmo segundo
        try {
            $pdo->exec("ALTER TABLE mc_world_objects MODIFY updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        } catch (Throwable $e) {}

        // v10 -> v12: Garantia idempotente de colunas de moedas/chapéus/progresso do jogador
        foreach ([
            "ALTER TABLE mc_users ADD COLUMN unlocked_hats TEXT NULL",
            "ALTER TABLE mc_users ADD COLUMN current_hat VARCHAR(32) NOT NULL DEFAULT 'default'",
            "ALTER TABLE mc_users ADD COLUMN myco_coins INT NOT NULL DEFAULT 250",
            "ALTER TABLE mc_users ADD COLUMN progress_json MEDIUMTEXT NULL",
        ] as $ddl) {
            try { $pdo->exec($ddl); } catch (Throwable $e) {}
        }

        // v16 -> v17: Expande state_val em mc_world_state para suportar ecologia persistente (colmeias & flores)
        if ($version < 17) {
            try { $pdo->exec("ALTER TABLE mc_world_state MODIFY state_val TEXT NOT NULL"); } catch (Throwable $e) {}
        }

        if ($version < 18) {
            foreach (['unlocked_skins' => 'TEXT NULL', 'current_skin' => "VARCHAR(32) NOT NULL DEFAULT ''"] as $column => $definition) {
                if (!$pdo->query("SHOW COLUMNS FROM mc_users WHERE Field = '$column'")->fetch()) {
                    try {
                        $pdo->exec("ALTER TABLE mc_users ADD COLUMN $column $definition");
                    } catch (PDOException $e) {
                        if ((int)($e->errorInfo[1] ?? 0) !== 1060) throw $e;
                    }
                }
            }
        }

        try {
            $up = $pdo->prepare("INSERT INTO mc_meta (meta_key, meta_val) VALUES ('schema_version', ?) ON DUPLICATE KEY UPDATE meta_val = VALUES(meta_val)");
            $up->execute([(string)MC_SCHEMA_VERSION]);
        } catch (Throwable $e) {}
    }

    $dataDir = __DIR__ . '/../data';
    if (!is_dir($dataDir)) {
        @mkdir($dataDir, 0755, true);
    }
    @touch($flagFile);
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
    $delOld = $pdo->prepare('DELETE FROM mc_auth_tokens WHERE user_id = ?');
    $delOld->execute([$userId]);
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
        $st = $pdo->prepare('SELECT u.*, t.last_used AS _token_last_used FROM mc_auth_tokens t JOIN mc_users u ON u.id = t.user_id WHERE t.token_hash = ? AND u.id = ? LIMIT 1');
        $st->execute([$hash, $userId]);
    } else {
        $st = $pdo->prepare('SELECT u.*, t.last_used AS _token_last_used FROM mc_auth_tokens t JOIN mc_users u ON u.id = t.user_id WHERE t.token_hash = ? LIMIT 1');
        $st->execute([$hash]);
    }
    $user = $st->fetch();
    if (!$user) {
        mc_clear_auth_cookie();
        mc_json(['ok' => false, 'error' => 'Sessao expirada. Entre novamente.', 'auth' => false], 401);
    }
    $lastUsed = (string)($user['_token_last_used'] ?? '');
    unset($user['_token_last_used']);
    $lastTs = $lastUsed !== '' ? strtotime($lastUsed) : 0;
    if ($lastTs === 0 || (time() - $lastTs) >= 60) {
        $touch = $pdo->prepare('UPDATE mc_auth_tokens SET last_used = NOW() WHERE token_hash = ?');
        $touch->execute([$hash]);
    }
    return $user;
}

function mc_is_admin(array $user): bool {
    return ((string)$user['role']) === 'admin';
}

function mc_is_professor(array $user): bool {
    return in_array((string)$user['role'], ['professor', 'admin'], true);
}

function mc_clean_pet_position($position): ?array {
    if (!is_array($position)) return null;
    $point = [];
    foreach (['x' => 500, 'y' => 180, 'z' => 500] as $axis => $limit) {
        if (!is_numeric($position[$axis] ?? null)) return null;
        $value = (float)$position[$axis];
        if (!is_finite($value) || abs($value) > $limit) return null;
        $point[$axis] = $value;
    }
    return $point;
}
