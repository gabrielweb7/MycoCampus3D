<?php
/**
 * MycoCampus3D - Sincronizacao multiplayer (polling), chat, objetos do lab e telao do auditorio.
 * Identidade (nome, cargo, cores) vem sempre do MySQL via token, nunca do cliente.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

const MP_SESSION_TIMEOUT_S = 12;
const MP_CHAT_TTL_S = 7;
const MP_SLIDE_COUNT = 5;
const MP_WORLD_LIMIT = 100.0;
const MP_ITEMS = [
    'petri_clean', 'petri_contam', 'spawn_jar', 'liquid_culture',
    'substrate_bag', 'fruiting_block',
    'chalk_white', 'chalk_green', 'chalk_yellow', 'board_eraser'
];
const MP_STROKE_COLORS = ['#f8fafc', '#4ade80', '#facc15', 'erase'];

/** session_id interno ligado ao usuario: impede que alguem sobrescreva a sessao de outro jogador. */
function mp_session_key(int $userId, string $clientSid): string {
    return substr(hash('sha256', $userId . ':' . $clientSid), 0, 40);
}

function mp_public_id(string $sessionKey): string {
    return substr(hash('sha256', 'pub:' . $sessionKey), 0, 12);
}

function mp_client_sid(array $body): string {
    $sid = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($body['session_id'] ?? ''));
    $sid = substr((string)$sid, 0, 64);
    if ($sid === '') {
        mc_json(['ok' => false, 'error' => 'session_id obrigatorio.'], 400);
    }
    return $sid;
}

function mp_num($v, float $limit): float {
    $f = is_numeric($v) ? (float)$v : 0.0;
    if (!is_finite($f)) $f = 0.0;
    return max(-$limit, min($limit, $f));
}

$pdo = mc_db_or_fail();
$body = mc_body();
$action = mc_action('sync');

if ($action === 'leave') {
    $user = mc_require_user($pdo);
    $del = $pdo->prepare('DELETE FROM mc_sessions WHERE session_id = ?');
    $del->execute([mp_session_key((int)$user['id'], mp_client_sid($body))]);
    mc_json(['ok' => true]);
}

if ($action === 'reset_world') {
    mc_require_user($pdo);
    $pdo->exec('DELETE FROM mc_world_objects');
    mc_json(['ok' => true]);
}

if ($action === 'set_slide') {
    $user = mc_require_user($pdo);
    if (!mc_is_professor($user)) {
        mc_json(['ok' => false, 'error' => 'Apenas professores podem controlar o telao ao vivo.'], 403);
    }
    $slideIndex = max(0, min(MP_SLIDE_COUNT - 1, (int)($body['slide_index'] ?? 0)));
    $upsert = $pdo->prepare('INSERT INTO mc_world_state (state_key, state_val) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_val = VALUES(state_val)');
    $upsert->execute(['auditorium_slide', (string)$slideIndex]);
    $upsert->execute(['auditorium_presenter', (string)$user['display_name']]);
    mc_json(['ok' => true, 'slide_index' => $slideIndex, 'presenter' => (string)$user['display_name']]);
}

if ($action === 'sync') {
    $user = mc_require_user($pdo);
    $userId = (int)$user['id'];
    $sessionKey = mp_session_key($userId, mp_client_sid($body));

    // Limpa jogadores inativos
    $pdo->exec('DELETE FROM mc_sessions WHERE last_seen < (NOW() - INTERVAL ' . MP_SESSION_TIMEOUT_S . ' SECOND)');

    $x = mp_num($body['x'] ?? 0, MP_WORLD_LIMIT);
    $y = mp_num($body['y'] ?? 0, 50.0);
    $z = mp_num($body['z'] ?? 0, MP_WORLD_LIMIT);
    $yaw = mp_num($body['yaw'] ?? 0, 1000.0);
    $pitch = mp_num($body['pitch'] ?? 0, 2.0);
    $holding = (string)($body['holding_item'] ?? '');
    $holding = in_array($holding, MP_ITEMS, true) ? $holding : '';
    $walking = !empty($body['walking']) ? 1 : 0;
    $inFps = !empty($body['in_fps']) ? 1 : 0;
    $chatMsg = trim((string)($body['chat_msg'] ?? ''));
    $chatMsg = $chatMsg !== '' ? mb_substr($chatMsg, 0, 140, 'UTF-8') : null;

    $params = [
        $sessionKey, $userId, (string)$user['display_name'], (string)$user['role'],
        mc_clean_hex($user['hat_color'], '#dc2626'), mc_clean_hex($user['body_color'], '#4f46e5'),
        $x, $y, $z, $yaw, $pitch, $holding, $walking, $inFps,
    ];
    $baseCols = 'session_id, user_id, display_name, role, hat_color, body_color, x, y, z, yaw, pitch, holding_item, walking, in_fps';
    $baseUpd = 'user_id=VALUES(user_id), display_name=VALUES(display_name), role=VALUES(role),
                hat_color=VALUES(hat_color), body_color=VALUES(body_color),
                x=VALUES(x), y=VALUES(y), z=VALUES(z), yaw=VALUES(yaw), pitch=VALUES(pitch),
                holding_item=VALUES(holding_item), walking=VALUES(walking), in_fps=VALUES(in_fps), last_seen=NOW()';

    if ($chatMsg !== null) {
        $sql = "INSERT INTO mc_sessions ($baseCols, chat_msg, chat_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE $baseUpd, chat_msg=VALUES(chat_msg), chat_at=NOW()";
        $params[] = $chatMsg;
    } else {
        $sql = "INSERT INTO mc_sessions ($baseCols, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE $baseUpd";
    }
    $pdo->prepare($sql)->execute($params);

    if (!empty($body['moved_items']) && is_array($body['moved_items'])) {
        $itemUpsert = $pdo->prepare('INSERT INTO mc_world_objects (item_id, x, y, z, ry) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y), z=VALUES(z), ry=VALUES(ry)');
        foreach (array_slice($body['moved_items'], 0, count(MP_ITEMS)) as $item) {
            if (!is_array($item)) continue;
            $iid = (string)($item['id'] ?? '');
            if (!in_array($iid, MP_ITEMS, true)) continue;
            $itemUpsert->execute([
                $iid,
                mp_num($item['x'] ?? 0, MP_WORLD_LIMIT),
                mp_num($item['y'] ?? 0, 50.0),
                mp_num($item['z'] ?? 0, MP_WORLD_LIMIT),
                mp_num($item['ry'] ?? 0, 1000.0),
            ]);
        }
    }

    $pStmt = $pdo->prepare('SELECT session_id, display_name, role, hat_color, body_color, x, y, z, yaw, pitch, holding_item, walking, in_fps,
            IF(chat_at IS NOT NULL AND chat_at >= (NOW() - INTERVAL ' . MP_CHAT_TTL_S . ' SECOND), chat_msg, NULL) AS chat_msg
        FROM mc_sessions WHERE session_id != ? ORDER BY session_id ASC LIMIT 60');
    $pStmt->execute([$sessionKey]);
    $players = [];
    foreach ($pStmt->fetchAll() as $p) {
        $players[] = [
            'id' => mp_public_id((string)$p['session_id']),
            'name' => (string)$p['display_name'],
            'role' => (string)$p['role'],
            'hat_color' => mc_clean_hex($p['hat_color'], '#dc2626'),
            'body_color' => mc_clean_hex($p['body_color'], '#4f46e5'),
            'x' => (float)$p['x'],
            'y' => (float)$p['y'],
            'z' => (float)$p['z'],
            'yaw' => (float)$p['yaw'],
            'pitch' => (float)$p['pitch'],
            'holding' => (string)$p['holding_item'],
            'walking' => (bool)$p['walking'],
            'in_fps' => (bool)$p['in_fps'],
            'chat' => $p['chat_msg'],
        ];
    }

    $objects = new stdClass();
    foreach ($pdo->query('SELECT item_id, x, y, z, ry FROM mc_world_objects')->fetchAll() as $obj) {
        $objects->{$obj['item_id']} = [
            'x' => (float)$obj['x'],
            'y' => (float)$obj['y'],
            'z' => (float)$obj['z'],
            'ry' => (float)$obj['ry'],
        ];
    }

    $state = ['auditorium_slide' => 0, 'auditorium_presenter' => ''];
    foreach ($pdo->query("SELECT state_key, state_val FROM mc_world_state WHERE state_key IN ('auditorium_slide', 'auditorium_presenter')")->fetchAll() as $st) {
        if ($st['state_key'] === 'auditorium_slide') $state['auditorium_slide'] = (int)$st['state_val'];
        if ($st['state_key'] === 'auditorium_presenter') $state['auditorium_presenter'] = (string)$st['state_val'];
    }

    // Salva novos tracos da lousa enviados pelo jogador
    if (!empty($body['board_strokes']) && is_array($body['board_strokes'])) {
        $stIns = $pdo->prepare('INSERT INTO mc_board_strokes (stroke_json) VALUES (?)');
        foreach (array_slice($body['board_strokes'], 0, 20) as $st) {
            if (!is_array($st)) continue;
            $col = (string)($st['c'] ?? '');
            if (!in_array($col, MP_STROKE_COLORS, true)) continue;
            if (empty($st['pts']) || !is_array($st['pts'])) continue;
            $pts = [];
            foreach (array_slice($st['pts'], 0, 80) as $pt) {
                if (!is_array($pt) || count($pt) < 2) continue;
                $pts[] = [round(max(0, min(512, (float)$pt[0])), 1), round(max(0, min(256, (float)$pt[1])), 1)];
            }
            if (count($pts) >= 1) {
                $stIns->execute([json_encode(['c' => $col, 'pts' => $pts])]);
            }
        }
        // Mantem no maximo os ultimos 500 tracos para a tabela nao crescer infinito
        $maxId = (int)$pdo->query('SELECT COALESCE(MAX(id), 0) FROM mc_board_strokes')->fetchColumn();
        if ($maxId > 500) {
            $delOld = $pdo->prepare('DELETE FROM mc_board_strokes WHERE id <= ?');
            $delOld->execute([$maxId - 500]);
        }
    }

    $boardSince = max(0, (int)($body['board_since'] ?? 0));
    $bStmt = $pdo->prepare('SELECT id, stroke_json FROM mc_board_strokes WHERE id > ? ORDER BY id ASC LIMIT 200');
    $bStmt->execute([$boardSince]);
    $boardStrokes = [];
    $lastBoardId = $boardSince;
    foreach ($bStmt->fetchAll() as $row) {
        $dec = json_decode((string)$row['stroke_json'], true);
        if (is_array($dec)) {
            $boardStrokes[] = $dec;
        }
        $lastBoardId = (int)$row['id'];
    }

    mc_json([
        'ok' => true,
        'online_count' => count($players) + 1,
        'players' => $players,
        'objects' => $objects,
        'world_state' => $state,
        'board_strokes' => $boardStrokes,
        'board_last_id' => $lastBoardId,
    ]);
}

mc_json(['ok' => false, 'error' => 'Acao desconhecida.'], 400);
