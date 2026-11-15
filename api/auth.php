<?php
/**
 * MycoCampus3D - MySQL Authentication & University Progress API
 * Zero localStorage for user profiles/progress: everything lives in MySQL.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once __DIR__ . '/db.php';

function mc_json(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function mc_clean_username(string $raw): string {
    $s = mb_strtolower(trim($raw), 'UTF-8');
    $s = preg_replace('/[^a-z0-9._-]/', '', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s);
    return substr($s, 0, 40);
}

function mc_clean_hex(string $raw, string $fallback): string {
    return preg_match('/^#[0-9a-fA-F]{6}$/', $raw) ? strtolower($raw) : $fallback;
}

function mc_format_user(array $row): array {
    $modules = [];
    if (!empty($row['completed_modules'])) {
        $decoded = json_decode((string)$row['completed_modules'], true);
        if (is_array($decoded)) {
            $modules = array_values(array_unique(array_map('strval', $decoded)));
        }
    }
    return [
        'id' => (int)$row['id'],
        'username' => (string)$row['username'],
        'display_name' => (string)$row['display_name'],
        'role' => (string)$row['role'],
        'hat_color' => (string)$row['hat_color'],
        'body_color' => (string)$row['body_color'],
        'xp' => (int)$row['xp'],
        'mushrooms_harvested' => (int)$row['mushrooms_harvested'],
        'completed_modules' => $modules,
    ];
}

try {
    $pdo = mc_db();
} catch (Throwable $e) {
    mc_json(['ok' => false, 'error' => 'Banco MySQL indisponivel. Verifique api/config.php.'], 500);
}

$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '', true);
if (!is_array($body)) {
    $body = $_POST ?: [];
}
$action = (string)($_GET['action'] ?? $body['action'] ?? 'leaderboard');

if ($action === 'login' || $action === 'register_or_login') {
    $displayName = trim((string)($body['display_name'] ?? ''));
    $displayName = mb_substr(preg_replace('/\s+/', ' ', $displayName), 0, 48, 'UTF-8');
    $pin = trim((string)($body['pin'] ?? ''));
    $profKey = trim((string)($body['professor_key'] ?? ''));
    $hatColor = mc_clean_hex((string)($body['hat_color'] ?? ''), '#d9534f');
    $bodyColor = mc_clean_hex((string)($body['body_color'] ?? ''), '#4f46e5');

    if (mb_strlen($displayName, 'UTF-8') < 2) {
        mc_json(['ok' => false, 'error' => 'Informe um nome com pelo menos 2 caracteres.'], 400);
    }
    if (strlen($pin) < 4 || strlen($pin) > 20) {
        mc_json(['ok' => false, 'error' => 'Use um PIN de 4 a 20 caracteres para salvar seu progresso no MySQL.'], 400);
    }

    $username = mc_clean_username($displayName);
    if (strlen($username) < 2) {
        $username = 'user_' . substr(md5($displayName), 0, 8);
    }

    $validProfKey = defined('PROFESSOR_KEY') && PROFESSOR_KEY !== '' && hash_equals(PROFESSOR_KEY, $profKey);

    $stmt = $pdo->prepare('SELECT * FROM mc_users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user) {
        if (!password_verify($pin, (string)$user['pin_hash'])) {
            mc_json(['ok' => false, 'error' => 'Nome ja cadastrado com outro PIN.'], 401);
        }
        $newRole = (string)$user['role'];
        if ($validProfKey && $newRole === 'student') {
            $newRole = 'professor';
        }
        $upd = $pdo->prepare('UPDATE mc_users SET display_name = ?, role = ?, hat_color = ?, body_color = ?, last_seen = NOW() WHERE id = ?');
        $upd->execute([$displayName, $newRole, $hatColor, $bodyColor, (int)$user['id']]);
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        mc_json(['ok' => true, 'created' => false, 'user' => mc_format_user($user)]);
    } else {
        $role = $validProfKey ? 'professor' : 'student';
        $pinHash = password_hash($pin, PASSWORD_DEFAULT);
        $ins = $pdo->prepare('INSERT INTO mc_users (username, display_name, role, pin_hash, hat_color, body_color, xp, mushrooms_harvested, completed_modules) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)');
        $ins->execute([$username, $displayName, $role, $pinHash, $hatColor, $bodyColor, '[]']);
        $id = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare('SELECT * FROM mc_users WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        mc_json(['ok' => true, 'created' => true, 'user' => mc_format_user($user)]);
    }
}

if ($action === 'add_progress') {
    $userId = (int)($body['user_id'] ?? 0);
    $xpDelta = max(0, min(500, (int)($body['xp_delta'] ?? 0)));
    $harvestDelta = max(0, min(20, (int)($body['harvest_delta'] ?? 0)));
    $moduleSlug = preg_replace('/[^a-z0-9_-]/', '', strtolower((string)($body['completed_module'] ?? '')));

    if ($userId <= 0) {
        mc_json(['ok' => false, 'error' => 'Usuario invalido.'], 400);
    }

    $stmt = $pdo->prepare('SELECT * FROM mc_users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) {
        mc_json(['ok' => false, 'error' => 'Usuario nao encontrado no MySQL.'], 404);
    }

    $modules = json_decode((string)($user['completed_modules'] ?? '[]'), true);
    if (!is_array($modules)) {
        $modules = [];
    }
    $newModuleAdded = false;
    if ($moduleSlug !== '' && !in_array($moduleSlug, $modules, true)) {
        $modules[] = $moduleSlug;
        $newModuleAdded = true;
    }

    $upd = $pdo->prepare('UPDATE mc_users SET xp = xp + ?, mushrooms_harvested = mushrooms_harvested + ?, completed_modules = ?, last_seen = NOW() WHERE id = ?');
    $upd->execute([$xpDelta, $harvestDelta, json_encode(array_values($modules)), $userId]);

    $stmt->execute([$userId]);
    $updated = $stmt->fetch();
    mc_json([
        'ok' => true,
        'new_module' => $newModuleAdded,
        'user' => mc_format_user($updated),
    ]);
}

if ($action === 'leaderboard') {
    $topStmt = $pdo->query('SELECT id, username, display_name, role, hat_color, body_color, xp, mushrooms_harvested, completed_modules FROM mc_users ORDER BY xp DESC, mushrooms_harvested DESC LIMIT 15');
    $leaders = [];
    foreach ($topStmt->fetchAll() as $row) {
        $leaders[] = mc_format_user($row);
    }
    $stats = $pdo->query('SELECT COUNT(*) AS total_users, COALESCE(SUM(xp), 0) AS total_xp, COALESCE(SUM(mushrooms_harvested), 0) AS total_harvests FROM mc_users')->fetch();
    mc_json([
        'ok' => true,
        'leaders' => $leaders,
        'stats' => [
            'total_users' => (int)($stats['total_users'] ?? 0),
            'total_xp' => (int)($stats['total_xp'] ?? 0),
            'total_harvests' => (int)($stats['total_harvests'] ?? 0),
        ],
    ]);
}

mc_json(['ok' => false, 'error' => 'Acao desconhecida.'], 400);

