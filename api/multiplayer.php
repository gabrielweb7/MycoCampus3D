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
const MP_WORLD_LIMIT = 220.0;
$mpBaseItems = [
    'petri_clean', 'petri_contam', 'petri_empty', 'pda_bottle', 'pda_bottle_02', 'pda_bottle_03',
    'spawn_jar', 'spawn_jar_empty', 'spawn_bag_empty', 'spawn_bag_colonized',
    'heat_sealer', 'liquid_culture', 'magnetic_stirrer',
    'precision_scale', 'alcohol_spray', 'alcohol_spray_02', 'alcohol_spray_03', 'burner_lab',
    'infrared_thermometer',
    'syringe_10ml_a', 'syringe_10ml_b', 'beaker_1l_a', 'beaker_1l_b', 'beaker_1l_03', 'beaker_1l_04',
    'substrate_bag', 'fruiting_block',
    'pressure_cooker_lab', 'pressure_lid_lab', 'pressure_cooker_sub', 'pressure_lid_sub',
    'table_hood_lab', 'table_cooker_lab', 'table_lc_lab', 'table_sub_east', 'laminar_hood_lab',
    'chalk_white', 'chalk_green', 'chalk_yellow', 'board_eraser',
    'chalk_white_1', 'chalk_green_1', 'chalk_yellow_1', 'board_eraser_1',
    'chalk_white_2', 'chalk_green_2', 'chalk_yellow_2', 'board_eraser_2',
    'chalk_white_3', 'chalk_green_3', 'chalk_yellow_3', 'board_eraser_3'
];
foreach (range(1, 15) as $n) {
    $p = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
    $mpBaseItems[] = "spawn_bag_empty_$p";
    $mpBaseItems[] = "spawn_jar_empty_$p";
}
foreach (range(1, 20) as $n) {
    $mpBaseItems[] = 'syringe_10ml_' . str_pad((string)$n, 2, '0', STR_PAD_LEFT);
}
foreach (range(1, 40) as $n) {
    $mpBaseItems[] = 'petri_bare_' . str_pad((string)$n, 2, '0', STR_PAD_LEFT);
}
foreach (range(1, 4) as $n) {
    $p = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
    $mpBaseItems[] = "substrate_grain_$p";
    $mpBaseItems[] = "substrate_sawdust_$p";
    $mpBaseItems[] = "micropore_$p";
}
foreach (range(1, 3) as $n) {
    $p = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
    $mpBaseItems[] = "gloves_box_$p";
    $mpBaseItems[] = "foil_roll_$p";
    $mpBaseItems[] = "parafilm_$p";
}
define('MP_ITEMS', $mpBaseItems);
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

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    mc_json(['ok' => false, 'error' => 'Método HTTP inválido. Use POST.'], 405);
}

if ($action === 'leave') {
    $user = mc_require_user($pdo);
    $del = $pdo->prepare('DELETE FROM mc_sessions WHERE session_id = ?');
    $del->execute([mp_session_key((int)$user['id'], mp_client_sid($body))]);
    mc_json(['ok' => true]);
}

if ($action === 'reset_world') {
    $user = mc_require_user($pdo);
    if (!mc_is_professor($user)) {
        mc_json(['ok' => false, 'error' => 'Acesso restrito a professores e administradores.'], 403);
    }
    $pdo->exec('DELETE FROM mc_world_objects');
    mc_json(['ok' => true]);
}

if ($action === 'set_slide') {
    $user = mc_require_user($pdo);
    if (!mc_is_professor($user)) {
        mc_json(['ok' => false, 'error' => 'Acesso restrito a professores e administradores.'], 403);
    }
    $slideIndex = max(0, min(MP_SLIDE_COUNT - 1, (int)($body['slide_index'] ?? 0)));
    $upsert = $pdo->prepare('INSERT INTO mc_world_state (state_key, state_val) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_val = VALUES(state_val)');
    $upsert->execute(['auditorium_slide', (string)$slideIndex]);
    $upsert->execute(['auditorium_presenter', (string)$user['display_name']]);
    mc_json(['ok' => true, 'slide_index' => $slideIndex, 'presenter' => (string)$user['display_name']]);
}

function mp_is_valid_state_key(string $k): bool {
    if (in_array($k, ['hood_lab', 'stir_lab', 'burner_lab', 'cinema_power', 'cinema_playing', 'cinema_lesson', 'auditorium_slide'], true)) {
        return true;
    }
    if (preg_match('/^(door_[0-3]|light_[0-7])$/', $k)) return true;
    if (preg_match('/^blind_([0-9]|1[0-5])$/', $k)) return true;
    if (preg_match('/^wild_([0-9]|[12][0-9]|3[01])$/', $k)) return true;
    if (preg_match('/^greenhouse_slot_[0-3]_(humidity|stage)$/', $k)) return true;
    return false;
}

if ($action === 'sync') {
    $user = mc_require_user($pdo);
    $userId = (int)$user['id'];
    $sessionKey = mp_session_key($userId, mp_client_sid($body));
    $initSync = !empty($body['init_sync']);

    // 1. Processa eventos pendentes do Master Admin (kick ou teleport)
    $forceTeleport = null;
    $evStmt = $pdo->prepare('SELECT id, action_type, payload FROM mc_admin_events WHERE target_user_id = ? ORDER BY id ASC');
    $evStmt->execute([$userId]);
    $adminEvents = $evStmt->fetchAll();
    if (!empty($adminEvents)) {
        $delEv = $pdo->prepare('DELETE FROM mc_admin_events WHERE target_user_id = ?');
        $delEv->execute([$userId]);
        foreach ($adminEvents as $ev) {
            if ($ev['action_type'] === 'kick') {
                $dec = json_decode((string)$ev['payload'], true);
                mc_json([
                    'ok' => true,
                    'kicked' => true,
                    'error' => is_array($dec) ? ($dec['reason'] ?? 'Você foi desconectado pelo Administrador.') : 'Desconectado.'
                ]);
            }
            if ($ev['action_type'] === 'teleport') {
                $forceTeleport = json_decode((string)$ev['payload'], true);
            }
        }
    }

    // 2. Limpeza probabilistica de sessoes inativas (1 em cada 20 polls) para poupar I/O
    if (mt_rand(1, 20) === 1) {
        $pdo->exec('DELETE FROM mc_sessions WHERE last_seen < (NOW() - INTERVAL ' . MP_SESSION_TIMEOUT_S . ' SECOND)');
    }

    // 3. Pose persistente isolada em mc_user_poses (nunca polui mc_world_state)
    $savedPose = null;
    if ($initSync) {
        $ps = $pdo->prepare('SELECT pose_json FROM mc_user_poses WHERE user_id = ? LIMIT 1');
        $ps->execute([$userId]);
        $rawPose = $ps->fetchColumn();
        if (is_string($rawPose) && $rawPose !== '') {
            $decPose = json_decode($rawPose, true);
            if (is_array($decPose) && isset($decPose['x'], $decPose['y'], $decPose['z'])) {
                $savedPose = $decPose;
            }
        }
    }

    $x = $savedPose ? mp_num($savedPose['x'], MP_WORLD_LIMIT) : mp_num($body['x'] ?? 0, MP_WORLD_LIMIT);
    $y = $savedPose ? mp_num($savedPose['y'], 50.0) : mp_num($body['y'] ?? 0, 50.0);
    $z = $savedPose ? mp_num($savedPose['z'], MP_WORLD_LIMIT) : mp_num($body['z'] ?? 0, MP_WORLD_LIMIT);
    $yaw = $savedPose ? mp_num($savedPose['yaw'] ?? 0, 1000.0) : mp_num($body['yaw'] ?? 0, 1000.0);
    $pitch = $savedPose ? mp_num($savedPose['pitch'] ?? 0, 2.0) : mp_num($body['pitch'] ?? 0, 2.0);
    $holding = $savedPose ? (string)($savedPose['holding'] ?? '') : (string)($body['holding_item'] ?? '');
    $holding = in_array($holding, MP_ITEMS, true) ? $holding : '';
    $seated = $savedPose ? !empty($savedPose['seated']) : !empty($body['seated']);
    $walking = $seated ? 2 : (!empty($body['walking']) ? 1 : 0);
    $inFps = !empty($body['in_fps']) ? 1 : 0;

    if (!$initSync) {
        $poseJson = json_encode([
            'x' => round($x, 2),
            'y' => round($y, 2),
            'z' => round($z, 2),
            'yaw' => round($yaw, 3),
            'pitch' => round($pitch, 3),
            'holding' => $holding,
            'seated' => $seated ? 1 : 0,
        ]);
        $pdo->prepare('INSERT INTO mc_user_poses (user_id, pose_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE pose_json = VALUES(pose_json)')
            ->execute([$userId, $poseJson]);
    }

    $chatMsg = trim((string)($body['chat_msg'] ?? ''));
    $chatMsg = $chatMsg !== '' ? mb_substr($chatMsg, 0, 140, 'UTF-8') : null;

    $currentHat = (string)($body['current_hat'] ?? ($user['current_hat'] ?? 'default'));
    $validHats = ['default', 'golden_shroom', 'wizard_hood', 'grad_cap', 'flower_crown', 'beret'];
    if (!in_array($currentHat, $validHats, true)) {
        $currentHat = 'default';
    }

    $emote = (string)($body['emote'] ?? '');
    $validEmotes = ['wave', 'dance', 'cheer', 'meditate'];
    if (!in_array($emote, $validEmotes, true)) {
        $emote = '';
    }

    $params = [
        $sessionKey, $userId, (string)$user['display_name'], (string)$user['role'],
        mc_clean_hex($user['hat_color'], '#dc2626'), mc_clean_hex($user['body_color'], '#4f46e5'),
        $currentHat, $emote,
        $x, $y, $z, $yaw, $pitch, $holding, $walking, $inFps,
    ];
    $baseCols = 'session_id, user_id, display_name, role, hat_color, body_color, current_hat, emote, x, y, z, yaw, pitch, holding_item, walking, in_fps';
    $baseUpd = 'user_id=VALUES(user_id), display_name=VALUES(display_name), role=VALUES(role),
                hat_color=VALUES(hat_color), body_color=VALUES(body_color),
                current_hat=VALUES(current_hat), emote=VALUES(emote),
                x=VALUES(x), y=VALUES(y), z=VALUES(z), yaw=VALUES(yaw), pitch=VALUES(pitch),
                holding_item=VALUES(holding_item), walking=VALUES(walking), in_fps=VALUES(in_fps), last_seen=NOW()';

    if ($chatMsg !== null) {
        $sql = "INSERT INTO mc_sessions ($baseCols, chat_msg, chat_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE $baseUpd, chat_msg=VALUES(chat_msg), chat_at=NOW()";
        $params[] = $chatMsg;
    } else {
        $sql = "INSERT INTO mc_sessions ($baseCols, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE $baseUpd";
    }
    $pdo->prepare($sql)->execute($params);

    if (!empty($body['moved_items']) && is_array($body['moved_items'])) {
        $batchPlaceholders = [];
        $batchParams = [];
        foreach (array_slice($body['moved_items'], 0, count(MP_ITEMS)) as $item) {
            if (!is_array($item)) continue;
            $iid = (string)($item['id'] ?? '');
            if (!in_array($iid, MP_ITEMS, true)) continue;
            $batchPlaceholders[] = '(?, ?, ?, ?, ?)';
            $batchParams[] = $iid;
            $batchParams[] = mp_num($item['x'] ?? 0, MP_WORLD_LIMIT);
            $batchParams[] = mp_num($item['y'] ?? 0, 50.0);
            $batchParams[] = mp_num($item['z'] ?? 0, MP_WORLD_LIMIT);
            $batchParams[] = mp_num($item['ry'] ?? 0, 1000.0);
        }
        if ($batchPlaceholders) {
            $batchSql = 'INSERT INTO mc_world_objects (item_id, x, y, z, ry) VALUES ' . implode(',', $batchPlaceholders)
                      . ' ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y), z=VALUES(z), ry=VALUES(ry)';
            $pdo->prepare($batchSql)->execute($batchParams);
        }
    }

    $pStmt = $pdo->prepare('SELECT session_id, display_name, role, hat_color, body_color, current_hat, emote, x, y, z, yaw, pitch, holding_item, walking, in_fps,
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
            'current_hat' => (string)($p['current_hat'] ?? 'default'),
            'emote' => (string)($p['emote'] ?? ''),
            'x' => (float)$p['x'],
            'y' => (float)$p['y'],
            'z' => (float)$p['z'],
            'yaw' => (float)$p['yaw'],
            'pitch' => (float)$p['pitch'],
            'holding' => (string)$p['holding_item'],
            'walking' => ((int)$p['walking'] === 1),
            'seated' => ((int)$p['walking'] === 2),
            'in_fps' => (bool)$p['in_fps'],
            'chat' => $p['chat_msg'],
        ];
    }

    $objects = new stdClass();
    foreach ($pdo->query('SELECT item_id, x, y, z, ry FROM mc_world_objects')->fetchAll() as $obj) {
        $itemId = (string)$obj['item_id'];
        $objects->{$itemId} = [
            'x' => (float)$obj['x'],
            'y' => (float)$obj['y'],
            'z' => (float)$obj['z'],
            'ry' => (float)$obj['ry'],
        ];
    }

    // Salva mudancas de estado do mundo (portas, persianas, interruptores, fluxo laminar, cinema, cogumelos)
    if (!empty($body['state_changes']) && is_array($body['state_changes'])) {
        $stUpsert = $pdo->prepare('INSERT INTO mc_world_state (state_key, state_val) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_val = VALUES(state_val)');
        foreach ($body['state_changes'] as $sKey => $sVal) {
            $sKey = (string)$sKey;
            if (!mp_is_valid_state_key($sKey)) continue;
            if (strpos($sKey, 'wild_') === 0) {
                $cleanVal = (string)(time() + 20);
            } elseif ($sKey === 'cinema_lesson') {
                $cleanVal = (string)max(-1, min(10, (int)$sVal));
            } elseif ($sKey === 'auditorium_slide') {
                if (!mc_is_professor($user)) continue;
                $cleanVal = (string)max(0, min(MP_SLIDE_COUNT - 1, (int)$sVal));
                $stUpsert->execute(['auditorium_presenter', (string)$user['display_name']]);
            } elseif ($sKey === 'auditorium_presenter') {
                continue;
            } else {
                $cleanVal = ($sVal === '1' || $sVal === 1 || $sVal === true) ? '1' : '0';
            }
            $stUpsert->execute([$sKey, $cleanVal]);
        }
    }

    $nowTs = time();
    $state = ['auditorium_slide' => 0, 'auditorium_presenter' => ''];
    foreach ($pdo->query('SELECT state_key, state_val FROM mc_world_state')->fetchAll() as $st) {
        $k = (string)$st['state_key'];
        $v = (string)$st['state_val'];
        if ($k === 'auditorium_slide') {
            $state['auditorium_slide'] = (int)$v;
        } elseif ($k === 'auditorium_presenter') {
            $state['auditorium_presenter'] = $v;
        } elseif (strpos($k, 'wild_') === 0) {
            $state[$k] = ((int)$v > $nowTs) ? '0' : '1';
        } elseif (mp_is_valid_state_key($k)) {
            $state[$k] = $v;
        }
    }

    // Salva novos tracos da lousa enviados pelo jogador (batch insert)
    if (!empty($body['board_strokes']) && is_array($body['board_strokes'])) {
        $strokePlaceholders = [];
        $strokeParams = [];
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
                $boardIdx = max(0, min(3, (int)($st['b'] ?? 0)));
                $strokePlaceholders[] = '(?)';
                $strokeParams[] = json_encode(['b' => $boardIdx, 'c' => $col, 'pts' => $pts]);
            }
        }
        if ($strokePlaceholders) {
            $pdo->prepare('INSERT INTO mc_board_strokes (stroke_json) VALUES ' . implode(',', $strokePlaceholders))
                ->execute($strokeParams);
            // Mantem ate 2500 tracos para preservar todo o desenho das 4 lousas
            $maxId = (int)$pdo->query('SELECT COALESCE(MAX(id), 0) FROM mc_board_strokes')->fetchColumn();
            if ($maxId > 2500) {
                $delOld = $pdo->prepare('DELETE FROM mc_board_strokes WHERE id <= ?');
                $delOld->execute([$maxId - 2500]);
            }
        }
    }

    $boardSince = max(0, (int)($body['board_since'] ?? 0));
    $bStmt = $pdo->prepare('SELECT id, stroke_json FROM mc_board_strokes WHERE id > ? ORDER BY id ASC LIMIT 2500');
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

    $appVersion = function_exists('apcu_fetch') ? apcu_fetch('mc_app_version') : false;
    if ($appVersion === false) {
        $appVersion = trim((string)@file_get_contents(__DIR__ . '/../VERSION'));
        if (function_exists('apcu_store')) {
            apcu_store('mc_app_version', $appVersion, 5);
        }
    }

    mc_json([
        'ok' => true,
        'app_version' => $appVersion,
        'online_count' => count($players) + 1,
        'saved_pose' => $savedPose,
        'force_teleport' => $forceTeleport,
        'players' => $players,
        'objects' => $objects,
        'world_state' => $state,
        'board_strokes' => $boardStrokes,
        'board_last_id' => $lastBoardId,
    ]);
}

mc_json(['ok' => false, 'error' => 'Acao desconhecida.'], 400);
