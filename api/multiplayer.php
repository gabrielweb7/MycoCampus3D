<?php
/**
 * MycoCampus3D - MySQL Multiplayer & Shared Auditorium Sync API
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once __DIR__ . '/db.php';

function mp_json(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = mc_db();
} catch (Throwable $e) {
    mp_json(['ok' => false, 'error' => 'MySQL indisponivel.'], 500);
}

$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '', true);
if (!is_array($body)) {
    $body = $_POST ?: [];
}
$action = (string)($_GET['action'] ?? $body['action'] ?? 'sync');

// Prune inactive sessions (> 12 seconds)
$pdo->exec('DELETE FROM mc_sessions WHERE last_seen < (NOW() - INTERVAL 12 SECOND)');

if ($action === 'leave') {
    $sid = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($body['session_id'] ?? ''));
    if ($sid !== '') {
        $del = $pdo->prepare('DELETE FROM mc_sessions WHERE session_id = ?');
        $del->execute([$sid]);
    }
    mp_json(['ok' => true]);
}

if ($action === 'reset_world') {
    $pdo->exec('DELETE FROM mc_world_objects');
    mp_json(['ok' => true]);
}

if ($action === 'set_slide') {
    $userId = (int)($body['user_id'] ?? 0);
    $slideIndex = max(0, min(20, (int)($body['slide_index'] ?? 0)));
    if ($userId <= 0) {
        mp_json(['ok' => false, 'error' => 'Usuario invalido.'], 400);
    }
    $uStmt = $pdo->prepare('SELECT display_name, role FROM mc_users WHERE id = ? LIMIT 1');
    $uStmt->execute([$userId]);
    $u = $uStmt->fetch();
    if (!$u || !in_array($u['role'], ['professor', 'admin'], true)) {
        mp_json(['ok' => false, 'error' => 'Apenas professores podem controlar o telao ao vivo.'], 403);
    }
    $upsert = $pdo->prepare('INSERT INTO mc_world_state (state_key, state_val) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_val = VALUES(state_val)');
    $upsert->execute(['auditorium_slide', (string)$slideIndex]);
    $upsert->execute(['auditorium_presenter', (string)$u['display_name']]);
    mp_json(['ok' => true, 'slide_index' => $slideIndex, 'presenter' => (string)$u['display_name']]);
}

if ($action === 'sync') {
    $sid = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($body['session_id'] ?? ''));
    if ($sid === '') {
        mp_json(['ok' => false, 'error' => 'session_id obrigatorio.'], 400);
    }

    $userId = isset($body['user_id']) && (int)$body['user_id'] > 0 ? (int)$body['user_id'] : null;
    $displayName = mb_substr(trim((string)($body['display_name'] ?? 'Visitante')), 0, 48, 'UTF-8');
    $role = in_array(($body['role'] ?? 'student'), ['student', 'professor', 'admin'], true) ? (string)$body['role'] : 'student';
    $hatColor = preg_match('/^#[0-9a-fA-F]{6}$/', (string)($body['hat_color'] ?? '')) ? strtolower((string)$body['hat_color']) : '#d9534f';
    $bodyColor = preg_match('/^#[0-9a-fA-F]{6}$/', (string)($body['body_color'] ?? '')) ? strtolower((string)$body['body_color']) : '#4f46e5';

    $x = (float)($body['x'] ?? 0);
    $y = (float)($body['y'] ?? 0);
    $z = (float)($body['z'] ?? 0);
    $yaw = (float)($body['yaw'] ?? 0);
    $pitch = (float)($body['pitch'] ?? 0);
    $holding = substr(preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($body['holding_item'] ?? '')), 0, 64);
    $walking = !empty($body['walking']) ? 1 : 0;
    $inFps = !empty($body['in_fps']) ? 1 : 0;
    $chatMsg = trim((string)($body['chat_msg'] ?? ''));
    $chatMsg = $chatMsg !== '' ? mb_substr($chatMsg, 0, 140, 'UTF-8') : null;

    if ($chatMsg !== null) {
        $sql = 'INSERT INTO mc_sessions (session_id, user_id, display_name, role, hat_color, body_color, x, y, z, yaw, pitch, holding_item, walking, in_fps, chat_msg, chat_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                  user_id=VALUES(user_id), display_name=VALUES(display_name), role=VALUES(role),
                  hat_color=VALUES(hat_color), body_color=VALUES(body_color),
                  x=VALUES(x), y=VALUES(y), z=VALUES(z), yaw=VALUES(yaw), pitch=VALUES(pitch),
                  holding_item=VALUES(holding_item), walking=VALUES(walking), in_fps=VALUES(in_fps),
                  chat_msg=VALUES(chat_msg), chat_at=NOW(), last_seen=NOW()';
        $pdo->prepare($sql)->execute([$sid, $userId, $displayName, $role, $hatColor, $bodyColor, $x, $y, $z, $yaw, $pitch, $holding, $walking, $inFps, $chatMsg]);
    } else {
        $sql = 'INSERT INTO mc_sessions (session_id, user_id, display_name, role, hat_color, body_color, x, y, z, yaw, pitch, holding_item, walking, in_fps)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  user_id=VALUES(user_id), display_name=VALUES(display_name), role=VALUES(role),
                  hat_color=VALUES(hat_color), body_color=VALUES(body_color),
                  x=VALUES(x), y=VALUES(y), z=VALUES(z), yaw=VALUES(yaw), pitch=VALUES(pitch),
                  holding_item=VALUES(holding_item), walking=VALUES(walking), in_fps=VALUES(in_fps),
                  chat_msg=IF(chat_at IS NOT NULL AND chat_at < (NOW() - INTERVAL 7 SECOND), NULL, chat_msg),
                  last_seen=NOW()';
        $pdo->prepare($sql)->execute([$sid, $userId, $displayName, $role, $hatColor, $bodyColor, $x, $y, $z, $yaw, $pitch, $holding, $walking, $inFps]);
    }

    if (!empty($body['moved_items']) && is_array($body['moved_items'])) {
        $itemUpsert = $pdo->prepare('INSERT INTO mc_world_objects (item_id, x, y, z, ry) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y), z=VALUES(z), ry=VALUES(ry)');
        foreach ($body['moved_items'] as $item) {
            if (!is_array($item) || empty($item['id'])) continue;
            $iid = substr(preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$item['id']), 0, 64);
            if ($iid === '') continue;
            $itemUpsert->execute([$iid, (float)($item['x'] ?? 0), (float)($item['y'] ?? 0), (float)($item['z'] ?? 0), (float)($item['ry'] ?? 0)]);
        }
    }

    $pStmt = $pdo->prepare('SELECT session_id, display_name, role, hat_color, body_color, x, y, z, yaw, pitch, holding_item, walking, in_fps, IF(chat_at IS NOT NULL AND chat_at >= (NOW() - INTERVAL 7 SECOND), chat_msg, NULL) AS chat_msg FROM mc_sessions WHERE session_id != ? ORDER BY session_id ASC');
    $pStmt->execute([$sid]);
    $players = [];
    foreach ($pStmt->fetchAll() as $p) {
        $players[] = [
            'id' => $p['session_id'],
            'name' => $p['display_name'],
            'role' => $p['role'],
            'hat_color' => $p['hat_color'],
            'body_color' => $p['body_color'],
            'x' => (float)$p['x'],
            'y' => (float)$p['y'],
            'z' => (float)$p['z'],
            'yaw' => (float)$p['yaw'],
            'pitch' => (float)$p['pitch'],
            'holding' => $p['holding_item'],
            'walking' => (bool)$p['walking'],
            'in_fps' => (bool)$p['in_fps'],
            'chat' => $p['chat_msg'],
        ];
    }

    $objects = [];
    foreach ($pdo->query('SELECT item_id, x, y, z, ry FROM mc_world_objects')->fetchAll() as $obj) {
        $objects[$obj['item_id']] = [
            'x' => (float)$obj['x'],
            'y' => (float)$obj['y'],
            'z' => (float)$obj['z'],
            'ry' => (float)$obj['ry'],
        ];
    }

    $state = ['auditorium_slide' => 0, 'auditorium_presenter' => ''];
    foreach ($pdo->query('SELECT state_key, state_val FROM mc_world_state')->fetchAll() as $st) {
        if ($st['state_key'] === 'auditorium_slide') $state['auditorium_slide'] = (int)$st['state_val'];
        if ($st['state_key'] === 'auditorium_presenter') $state['auditorium_presenter'] = (string)$st['state_val'];
    }

    mp_json([
        'ok' => true,
        'online_count' => count($players) + 1,
        'players' => $players,
        'objects' => $objects,
        'world_state' => $state,
    ]);
}

mp_json(['ok' => false, 'error' => 'Acao desconhecida.'], 400);
