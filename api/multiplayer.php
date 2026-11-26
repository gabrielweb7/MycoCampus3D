<?php
/**
 * MycoCampus3D - Sincronizacao multiplayer (polling), chat, objetos do lab e telao do auditorio.
 * Identidade (nome, cargo, cores) vem sempre do MySQL via token, nunca do cliente.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/multiplayer_schema.php';
require_once __DIR__ . '/inventory.php';
require_once __DIR__ . '/village_store.php';

const MP_SESSION_TIMEOUT_S = 12;
const MP_CHAT_TTL_S = 7;
const MP_SLIDE_COUNT = 5;
const MP_WORLD_LIMIT = 220.0;
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
    mp_inventory_lock($pdo);
    $protectedItems = array_fill_keys($pdo->query('SELECT item_id FROM mc_inventory_slots UNION SELECT item_id FROM mc_village_items')->fetchAll(PDO::FETCH_COLUMN), true);
    $rentedItems = mc_village_rented_world_item_ids($pdo, time());
    $protectedItems += array_fill_keys($rentedItems, true);
    $keepRented = $rentedItems ? ' AND item_id NOT IN (' . implode(',', array_fill(0, count($rentedItems), '?')) . ')' : '';
    foreach (['mc_world_objects', 'mc_world_item_states', 'mc_world_layout_edits'] as $table) {
        $pdo->prepare("DELETE FROM $table WHERE NOT EXISTS (SELECT 1 FROM mc_inventory_slots WHERE mc_inventory_slots.item_id = $table.item_id)
            AND NOT EXISTS (SELECT 1 FROM mc_village_items WHERE mc_village_items.item_id = $table.item_id)" . $keepRented)->execute($rentedItems);
    }

    // Se o Admin salvou um layout padrão, restaura tudo para a posição/configuração definida por ele
    $defaults = $pdo->query('SELECT item_id, prefab_id, label, scale, x, y, z, ry, removed FROM mc_admin_layout_defaults')->fetchAll();
    if ($defaults) {
        $insObj = $pdo->prepare('INSERT INTO mc_world_objects (item_id, x, y, z, ry) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y), z=VALUES(z), ry=VALUES(ry)');
        $insEdit = $pdo->prepare('INSERT INTO mc_world_layout_edits (item_id, prefab_id, label, scale, removed) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE prefab_id=VALUES(prefab_id), label=VALUES(label), scale=VALUES(scale), removed=VALUES(removed)');
        foreach ($defaults as $def) {
            $iid = (string)$def['item_id'];
            if (isset($protectedItems[$iid])) continue;
            $removed = (int)$def['removed'] ? 1 : 0;
            if (!$removed) {
                $insObj->execute([$iid, (float)$def['x'], (float)$def['y'], (float)$def['z'], (float)$def['ry']]);
            }
            if ($def['prefab_id'] !== '' || $def['label'] !== '' || abs((float)$def['scale'] - 1.0) > 0.001 || $removed) {
                $insEdit->execute([$iid, (string)$def['prefab_id'], (string)$def['label'], (float)$def['scale'], $removed]);
            }
        }
    }
    $pdo->commit();
    mc_json(['ok' => true, 'restored_from_default' => count($defaults)]);
}

if ($action === 'save_world_default') {
    $user = mc_require_user($pdo);
    if (!mc_is_professor($user)) {
        mc_json(['ok' => false, 'error' => 'Acesso restrito a professores e administradores.'], 403);
    }
    $snapshot = is_array($body['items'] ?? null) ? $body['items'] : [];
    mp_inventory_lock($pdo);
    $protectedItems = array_fill_keys($pdo->query('SELECT item_id FROM mc_village_items')->fetchAll(PDO::FETCH_COLUMN), true);
    $protectedItems += array_fill_keys(mc_village_rented_world_item_ids($pdo, time()), true);
    $pdo->exec('DELETE FROM mc_admin_layout_defaults');
    $insDef = $pdo->prepare('INSERT INTO mc_admin_layout_defaults (item_id, prefab_id, label, scale, x, y, z, ry, removed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $insObj = $pdo->prepare('INSERT INTO mc_world_objects (item_id, x, y, z, ry) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y), z=VALUES(z), ry=VALUES(ry)');
    $count = 0;
    foreach (array_slice($snapshot, 0, 500) as $row) {
        if (!is_array($row)) continue;
        $iid = (string)($row['id'] ?? '');
        if (!mp_is_allowed_item_id($iid) || isset($protectedItems[$iid])) continue;
        $prefabId = substr(preg_replace('/[^a-zA-Z0-9_]/', '', (string)($row['prefab_id'] ?? '')), 0, 64);
        $label = mb_substr(trim((string)($row['label'] ?? '')), 0, 96);
        $scale = max(0.25, min(4.0, (float)($row['scale'] ?? 1.0)));
        $removed = !empty($row['removed']) ? 1 : 0;
        $x = mp_num($row['x'] ?? 0, MP_WORLD_LIMIT);
        $y = mp_num($row['y'] ?? 0, 50.0);
        $z = mp_num($row['z'] ?? 0, MP_WORLD_LIMIT);
        if (mc_village_lot_at($x, $z) !== null) continue;
        $ry = mp_num($row['ry'] ?? 0, 1000.0);
        $insDef->execute([$iid, $prefabId, $label, $scale, $x, $y, $z, $ry, $removed]);
        if (!$removed) {
            $insObj->execute([$iid, $x, $y, $z, $ry]);
        }
        $count++;
    }
    $pdo->commit();
    mc_json(['ok' => true, 'saved_count' => $count]);
}

if ($action === 'admin_layout_edit') {
    $user = mc_require_user($pdo);
    if (!mc_is_professor($user)) {
        mc_json(['ok' => false, 'error' => 'Acesso restrito a professores e administradores.'], 403);
    }
    $iid = (string)($body['item_id'] ?? '');
    if (!mp_is_allowed_item_id($iid)) {
        mc_json(['ok' => false, 'error' => 'ID de item inválido.'], 400);
    }
    mp_inventory_lock($pdo);
    $itemLots = mc_village_world_item_lots($pdo, [$iid], (int)$user['id']);
    $lot = isset($itemLots[$iid]) ? mc_village_read_lot($pdo, $itemLots[$iid]) : null;
    $now = time();
    if (mc_village_item_rows($pdo, [$iid]) || ($lot && (int)$lot['expires_at'] > $now && (int)$lot['owner_id'] !== (int)$user['id'])) {
        $pdo->rollBack();
        mc_json(['ok' => false, 'error' => 'O item pertence a um jogador.'], 403);
    }
    $prefabId = substr(preg_replace('/[^a-zA-Z0-9_]/', '', (string)($body['prefab_id'] ?? '')), 0, 64);
    $label = mb_substr(trim((string)($body['label'] ?? '')), 0, 96);
    $scale = max(0.25, min(4.0, (float)($body['scale'] ?? 1.0)));
    $removed = !empty($body['removed']) ? 1 : 0;
    $newX = mp_num($body['x'] ?? 0, MP_WORLD_LIMIT);
    $newZ = mp_num($body['z'] ?? 0, MP_WORLD_LIMIT);
    $newLotId = mc_village_lot_at($newX, $newZ);
    if (!$removed && $newLotId !== null && !mc_village_has_lease(mc_village_read_lot($pdo, $newLotId), (int)$user['id'], $now)) {
        $pdo->rollBack();
        mc_json(['ok' => false, 'error' => 'Use o modo de posicionamento para colocar itens em um lote alugado.'], 403);
    }

    $pdo->prepare('INSERT INTO mc_world_layout_edits (item_id, prefab_id, label, scale, removed) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE prefab_id=IF(VALUES(prefab_id)<>"", VALUES(prefab_id), prefab_id), label=VALUES(label), scale=VALUES(scale), removed=VALUES(removed)')
        ->execute([$iid, $prefabId, $label, $scale, $removed]);

    if (!$removed && array_key_exists('x', $body) && array_key_exists('y', $body) && array_key_exists('z', $body)) {
        $pdo->prepare('INSERT INTO mc_world_objects (item_id, x, y, z, ry) VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y), z=VALUES(z), ry=VALUES(ry)')
            ->execute([$iid, $newX, mp_num($body['y'], 50.0), $newZ, mp_num($body['ry'] ?? 0, 1000.0)]);
    } elseif ($removed) {
        $pdo->prepare('DELETE FROM mc_world_objects WHERE item_id = ?')->execute([$iid]);
    }
    $pdo->commit();
    mc_json(['ok' => true, 'item_id' => $iid]);
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

if ($action === 'sync') {
    $user = mc_require_user($pdo);
    $userId = (int)$user['id'];
    $sessionKey = mp_session_key($userId, mp_client_sid($body));
    $initSync = !empty($body['init_sync']);
    $leaving = !$initSync && !empty($body['leaving']);

    // Garante sessão única por conta: novo acesso desconecta o anterior
    if ($initSync) {
        $delOther = $pdo->prepare('DELETE FROM mc_sessions WHERE user_id = ? AND session_id <> ?');
        $delOther->execute([$userId, $sessionKey]);
    } else {
        $chkOther = $pdo->prepare('SELECT 1 FROM mc_sessions WHERE user_id = ? AND session_id <> ? LIMIT 1');
        $chkOther->execute([$userId, $sessionKey]);
        if ($chkOther->fetchColumn()) {
            if ($leaving) {
                mc_json(['ok' => true]);
            }
            mc_json([
                'ok' => true,
                'kicked' => true,
                'error' => 'Sua conta foi conectada em outro dispositivo ou navegador. Atualize a página para jogar aqui.'
            ]);
        }
    }

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

    mp_inventory_lock($pdo);

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
    $y = $savedPose ? mp_num($savedPose['y'], 180.0) : mp_num($body['y'] ?? 0, 180.0);
    $z = $savedPose ? mp_num($savedPose['z'], MP_WORLD_LIMIT) : mp_num($body['z'] ?? 0, MP_WORLD_LIMIT);
    $yaw = $savedPose ? mp_num($savedPose['yaw'] ?? 0, 1000.0) : mp_num($body['yaw'] ?? 0, 1000.0);
    $pitch = $savedPose ? mp_num($savedPose['pitch'] ?? 0, 2.0) : mp_num($body['pitch'] ?? 0, 2.0);
    $holding = $savedPose ? (string)($savedPose['holding'] ?? '') : (string)($body['holding_item'] ?? '');
    $holding = mp_is_allowed_item_id($holding) ? $holding : '';
    $incomingItems = array_slice(is_array($body['moved_items'] ?? null) ? $body['moved_items'] : [], 0, 300);
    $candidateIds = [$holding];
    foreach ($incomingItems as $item) {
        if (!is_array($item)) continue;
        $candidateIds[] = $item['id'] ?? null;
        $crateId = $item['state']['crateCargo']['id'] ?? null;
        if (is_string($crateId) && mp_is_allowed_item_id($crateId)) $candidateIds[] = $crateId;
    }
    $villageItems = mc_village_item_rows($pdo, $candidateIds);
    $worldItemLots = mc_village_world_item_lots($pdo, $candidateIds, $userId);
    $villageLots = [];
    $villageNow = time();
    $getLot = static function (int $id) use ($pdo, &$villageLots): ?array {
        if (!array_key_exists($id, $villageLots)) $villageLots[$id] = mc_village_read_lot($pdo, $id);
        return $villageLots[$id];
    };
    $canAccessItem = static function (string $id) use ($pdo, $villageItems, $worldItemLots, $getLot, $userId, $villageNow): bool {
        $item = $villageItems[$id] ?? (str_starts_with($id, 'dyn_shop_') ? (mc_village_item_rows($pdo, [$id])[$id] ?? null) : null);
        if ($item) {
            if ((int)$item['owner_id'] !== $userId || !empty($item['on_sale'])) return false;
            return mc_village_item_active($item, $item['lot_id'] !== null ? $getLot((int)$item['lot_id']) : null, $villageNow);
        }
        $lot = isset($worldItemLots[$id]) ? $getLot($worldItemLots[$id]) : null;
        return !$lot || (int)$lot['expires_at'] <= $villageNow || (int)$lot['owner_id'] === $userId;
    };
    $inventory = mp_inventory_sync($pdo, $userId, $sessionKey, $holding, $initSync, $body, $canAccessItem);
    $holding = $inventory['holding'];
    if ($savedPose) $savedPose['holding'] = $holding;

    $seated = $savedPose ? !empty($savedPose['seated']) : !empty($body['seated']);
    $toyMode = (string)($body['toy_mode'] ?? '');
    $walking = ($toyMode === 'parachute') ? 5 : (($toyMode === 'paraglider') ? 4 : (($toyMode === 'snowboard') ? 3 : ($seated ? 2 : (!empty($body['walking']) ? 1 : 0))));
    $inFps = !empty($body['in_fps']) ? 1 : 0;
    // Only expose the selected, owned pet and bowl positions, never private progress.
    $userProgress = json_decode((string)($user['progress_json'] ?? ''), true);
    $petState = is_array($userProgress['pets'] ?? null) ? $userProgress['pets'] : [];
    $selectedPet = (string)($petState['selected'] ?? '');
    $ownedPets = is_array($petState['owned'] ?? null) ? $petState['owned'] : [];
    $petPose = is_array($body['pet_pose'] ?? null) ? $body['pet_pose'] : [];
    $publicPet = null;
    $anchor = ($petState['mode'] ?? '') === 'stay' ? mc_clean_pet_position($petState['anchor'] ?? null) : null;
    if (in_array($selectedPet, MC_PETS, true) && in_array($selectedPet, $ownedPets, true) && ($petPose['id'] ?? '') === $selectedPet &&
        isset($petPose['x'], $petPose['y'], $petPose['z']) && is_numeric($petPose['x']) && is_numeric($petPose['y']) && is_numeric($petPose['z'])) {
        $publicPet = [
            'id' => $selectedPet, 'x' => mp_num($petPose['x'], MP_WORLD_LIMIT),
            'y' => mp_num($petPose['y'], 180), 'z' => mp_num($petPose['z'], MP_WORLD_LIMIT),
            'yaw' => mp_num($petPose['yaw'] ?? 0, 1000),
            'motion' => in_array(($petPose['motion'] ?? ''), ['idle', 'walk', 'run', 'eat', 'sleep'], true) ? $petPose['motion'] : 'idle',
        ];
        if ($anchor && (hypot($publicPet['x'] - $anchor['x'], $publicPet['z'] - $anchor['z']) > 4.25 || abs($publicPet['y'] - $anchor['y']) > 2)) {
            $publicPet = array_merge($publicPet, $anchor, ['motion' => 'idle']);
        }
    }
    $publicBowls = [];
    foreach (['food', 'water'] as $kind) {
        $bowl = $petState['bowls'][$kind] ?? null;
        $p = is_array($bowl) ? ($bowl['pos'] ?? null) : null;
        if (!empty($bowl['owned']) && is_array($p) && isset($p['x'], $p['y'], $p['z']) && is_numeric($p['x']) && is_numeric($p['y']) && is_numeric($p['z'])) {
            $publicBowls[$kind] = ['x' => mp_num($p['x'], MP_WORLD_LIMIT), 'y' => mp_num($p['y'], 180), 'z' => mp_num($p['z'], MP_WORLD_LIMIT), 'full' => !empty($bowl['full'])];
        }
    }
    $petJson = json_encode(['pet' => $publicPet, 'bowls' => $publicBowls]);
    $vx = mp_num($body['vx'] ?? 0, 25.0);
    $vz = mp_num($body['vz'] ?? 0, 25.0);
    $hasApcu = function_exists('apcu_fetch') && function_exists('apcu_store');

    if ($hasApcu) {
        apcu_store('mc_vel_' . $sessionKey, ['vx' => round($vx, 2), 'vz' => round($vz, 2), 'ts' => microtime(true)], 10);
    }

    if (!$initSync && ($inventory['ready'] || empty($body['inventory_enabled']))) {
        $hasWorldWrites = !empty($body['moved_items']) || !empty($body['state_changes']);
        $shouldSavePose = $leaving || !empty($body['save_pose']) || $hasWorldWrites || $inventory['_did_swap'] || $inventory['conflict'];
        if (!$shouldSavePose) {
            if ($hasApcu) {
                $poseKey = 'mc_pose_ts_' . $userId;
                $lastSaved = (int)apcu_fetch($poseKey);
                $minInterval = ($walking === 1) ? 4 : 6;
                if ((time() - $lastSaved) >= $minInterval) {
                    $shouldSavePose = true;
                }
            } elseif (mt_rand(1, 16) === 1) {
                $shouldSavePose = true;
            }
        }
        if ($shouldSavePose) {
            if ($hasApcu) {
                apcu_store('mc_pose_ts_' . $userId, time(), 30);
            }
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
    }

    $chatMsg = trim((string)($body['chat_msg'] ?? ''));
    $chatMsg = $chatMsg !== '' ? mb_substr($chatMsg, 0, 140, 'UTF-8') : null;

    $currentHat = (string)($body['current_hat'] ?? ($user['current_hat'] ?? 'default'));
    $validHats = ['default', 'none', 'golden_shroom', 'wizard_hood', 'grad_cap', 'flower_crown', 'beret'];
    if (!in_array($currentHat, $validHats, true)) {
        $currentHat = 'default';
    }

    $emote = (string)($body['emote'] ?? '');
    $validEmotes = [
        'wave', 'dance', 'cheer', 'meditate', 'rainbow_trip',
        'fx_spray', 'fx_wipe', 'fx_syringe', 'fx_flame', 'fx_shake',
        'fx_mix', 'fx_level', 'fx_seal', 'fx_jar', 'fx_harvest',
    ];
    if (!in_array($emote, $validEmotes, true)) {
        $emote = '';
    }

    $params = [
        $sessionKey, $userId, (string)$user['display_name'], (string)$user['role'],
        mc_clean_hex($user['hat_color'], '#dc2626'), mc_clean_hex($user['body_color'], '#4f46e5'),
        $currentHat, $emote,
        $x, $y, $z, $yaw, $pitch, $holding, $walking, $inFps, $petJson,
    ];
    $baseCols = 'session_id, user_id, display_name, role, hat_color, body_color, current_hat, emote, x, y, z, yaw, pitch, holding_item, walking, in_fps, pet_json';
    $baseUpd = 'user_id=VALUES(user_id), display_name=VALUES(display_name), role=VALUES(role),
                hat_color=VALUES(hat_color), body_color=VALUES(body_color),
                current_hat=VALUES(current_hat), emote=VALUES(emote),
                x=VALUES(x), y=VALUES(y), z=VALUES(z), yaw=VALUES(yaw), pitch=VALUES(pitch),
                holding_item=VALUES(holding_item), walking=VALUES(walking), in_fps=VALUES(in_fps), pet_json=VALUES(pet_json), last_seen=NOW()';

    if ($chatMsg !== null) {
        $sql = "INSERT INTO mc_sessions ($baseCols, chat_msg, chat_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE $baseUpd, chat_msg=VALUES(chat_msg), chat_at=NOW()";
        $params[] = $chatMsg;
    } else {
        $sql = "INSERT INTO mc_sessions ($baseCols, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE $baseUpd";
    }
    $pdo->prepare($sql)->execute($params);

    if (!$initSync && $incomingItems) {
        $batchPlaceholders = [];
        $batchParams = [];
        $statePlaceholders = [];
        $stateParams = [];
        $layoutPlaceholders = [];
        $layoutParams = [];
        $moveVillageItem = $pdo->prepare('UPDATE mc_village_items SET lot_id = ?, lease_epoch = ? WHERE item_id = ? AND owner_id = ?');
        $cratePrefabs = [];
        $readCratePrefab = null;
        foreach ($incomingItems as $item) {
            if (!is_array($item)) continue;
            $iid = (string)($item['id'] ?? '');
            if (!mp_is_allowed_item_id($iid)) continue;
            if (!$canAccessItem($iid)) continue;
            $villageItem = $villageItems[$iid] ?? null;
            $itemState = mp_clean_item_state($iid, $item['state'] ?? null);
            $reservedOwner = $inventory['_reserved_owners'][$iid] ?? null;
            if (($reservedOwner !== null && ($reservedOwner !== $userId || !$inventory['ready'])) ||
                isset($inventory['_other_held'][$iid])) continue;
            $crateId = json_decode($itemState ?? '{}', true)['crateCargo']['id'] ?? null;
            if ($crateId !== null) {
                if (!$canAccessItem($crateId) || isset($inventory['_other_held'][$crateId])) continue;
                if (str_starts_with($crateId, 'dyn_')) {
                    if (!array_key_exists($crateId, $cratePrefabs)) {
                        $readCratePrefab ??= $pdo->prepare('SELECT prefab_id FROM mc_world_layout_edits WHERE item_id = ? AND removed = 0');
                        $readCratePrefab->execute([$crateId]);
                        $cratePrefabs[$crateId] = $readCratePrefab->fetchColumn();
                    }
                    if ($cratePrefabs[$crateId] !== 'delivery_crate') continue;
                }
            }

            if ($reservedOwner === null && array_key_exists('x', $item) && array_key_exists('y', $item) && array_key_exists('z', $item)) {
                $itemX = mp_num($item['x'], MP_WORLD_LIMIT);
                $itemZ = mp_num($item['z'], MP_WORLD_LIMIT);
                $lotId = mc_village_lot_at($itemX, $itemZ);
                $targetLot = $lotId !== null ? $getLot($lotId) : null;
                if ($lotId !== null && !mc_village_has_lease($targetLot, $userId, $villageNow)) continue;
                if ($villageItem && ($villageItem['lot_id'] === null ? null : (int)$villageItem['lot_id']) !== $lotId) {
                    $moveVillageItem->execute([$lotId, (int)($targetLot['lease_epoch'] ?? 0), $iid, $userId]);
                }
                if ($villageItem && $lotId !== null) {
                    mc_village_offer($pdo, $iid, $userId, $lotId, $itemX, mp_num($item['y'], 50.0), $itemZ, $villageNow, $itemState);
                }
                $batchPlaceholders[] = '(?, ?, ?, ?, ?)';
                $batchParams[] = $iid;
                $batchParams[] = $itemX;
                $batchParams[] = mp_num($item['y'], 50.0);
                $batchParams[] = $itemZ;
                $batchParams[] = mp_num($item['ry'] ?? 0, 1000.0);
            }
            $prefabId = trim((string)($item['prefabId'] ?? $item['prefab_id'] ?? ''));
            if (!$villageItem && $prefabId !== '' && strpos($iid, 'dyn_') === 0 && preg_match('/^[a-z0-9_]{2,40}$/', $prefabId)) {
                $dynLabel = mb_substr(trim(strip_tags((string)($item['label'] ?? ''))), 0, 120);
                $layoutPlaceholders[] = '(?, ?, ?, 1.0, 0)';
                $layoutParams[] = $iid;
                $layoutParams[] = $prefabId;
                $layoutParams[] = $dynLabel;
            }
            if ($itemState !== null) {
                $statePlaceholders[] = '(?, ?)';
                $stateParams[] = $iid;
                $stateParams[] = $itemState;
            }
        }
        if ($batchPlaceholders) {
            $batchSql = 'INSERT INTO mc_world_objects (item_id, x, y, z, ry) VALUES ' . implode(',', $batchPlaceholders)
                      . ' ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y), z=VALUES(z), ry=VALUES(ry)';
            $pdo->prepare($batchSql)->execute($batchParams);
        }
        if ($layoutPlaceholders) {
            $layoutSql = 'INSERT INTO mc_world_layout_edits (item_id, prefab_id, label, scale, removed) VALUES ' . implode(',', $layoutPlaceholders)
                       . ' ON DUPLICATE KEY UPDATE prefab_id=VALUES(prefab_id), label=IF(VALUES(label) <> \'\', VALUES(label), label), removed=0';
            $pdo->prepare($layoutSql)->execute($layoutParams);
        }
        if ($statePlaceholders) {
            $stateSql = 'INSERT INTO mc_world_item_states (item_id, state_json) VALUES ' . implode(',', $statePlaceholders)
                      . ' ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)';
            $pdo->prepare($stateSql)->execute($stateParams);
        }
    }

    $pdo->commit();

    // A nearby player's polling is enough to advance pickups for offline owners.
    if ($initSync || mt_rand(1, 15) === 1) mc_village_settle_sales($pdo, $initSync ? $userId : null);

    $pStmt = $pdo->prepare('SELECT session_id, display_name, role, hat_color, body_color, current_hat, emote, x, y, z, yaw, pitch, holding_item, walking, in_fps, pet_json,
            IF(chat_at IS NOT NULL AND chat_at >= (NOW() - INTERVAL ' . MP_CHAT_TTL_S . ' SECOND), chat_msg, NULL) AS chat_msg
        FROM mc_sessions WHERE session_id != ? ORDER BY session_id ASC LIMIT 60');
    $pStmt->execute([$sessionKey]);
    $players = [];
    foreach ($pStmt->fetchAll() as $p) {
        $pSid = (string)$p['session_id'];
        $pVx = 0.0;
        $pVz = 0.0;
        if ($hasApcu) {
            $vel = apcu_fetch('mc_vel_' . $pSid);
            if (is_array($vel)) {
                $pVx = (float)($vel['vx'] ?? 0.0);
                $pVz = (float)($vel['vz'] ?? 0.0);
            }
        }
        $players[] = [
            'id' => mp_public_id($pSid),
            'name' => (string)$p['display_name'],
            'role' => (string)$p['role'],
            'hat_color' => mc_clean_hex($p['hat_color'], '#dc2626'),
            'body_color' => mc_clean_hex($p['body_color'], '#4f46e5'),
            'current_hat' => (string)($p['current_hat'] ?? 'default'),
            'emote' => (string)($p['emote'] ?? ''),
            'x' => (float)$p['x'],
            'y' => (float)$p['y'],
            'z' => (float)$p['z'],
            'vx' => $pVx,
            'vz' => $pVz,
            'yaw' => (float)$p['yaw'],
            'pitch' => (float)$p['pitch'],
            'holding' => (string)$p['holding_item'],
            'walking' => ((int)$p['walking'] === 1),
            'seated' => ((int)$p['walking'] === 2),
            'toy_mode' => ((int)$p['walking'] === 5) ? 'parachute' : (((int)$p['walking'] === 4) ? 'paraglider' : (((int)$p['walking'] === 3) ? 'snowboard' : '')),
            'in_fps' => (bool)$p['in_fps'],
            'pets' => json_decode((string)($p['pet_json'] ?? ''), true) ?: null,
            'chat' => $p['chat_msg'],
        ];
    }

    // Salva mudancas de estado do mundo (portas, persianas, interruptores, fluxo laminar, cinema, cogumelos)
    if (!empty($body['state_changes']) && is_array($body['state_changes'])) {
        $stUpsert = $pdo->prepare('INSERT INTO mc_world_state (state_key, state_val) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_val = VALUES(state_val)');
        foreach ($body['state_changes'] as $sKey => $sVal) {
            $sKey = (string)$sKey;
            if (!mp_is_valid_state_key($sKey)) continue;
            if (strpos($sKey, 'wild_') === 0) {
                // Harvest cooldowns are written in the same transaction as the reward.
                continue;
            } elseif ($sKey === 'hood_sanitized_until') {
                $cleanVal = ($sVal === '1' || $sVal === 1 || $sVal === true) ? (string)(time() + 120) : '0';
            } elseif ($sKey === 'burner_level_lab' || $sKey === 'gas_tripod_sub_level' || $sKey === 'gas_tripod_level_sub') {
                $cleanVal = (string)max(0, min(3, (int)$sVal));
            } elseif ($sKey === 'cinema_lesson') {
                $cleanVal = (string)max(-1, min(10, (int)$sVal));
            } elseif ($sKey === 'auditorium_slide') {
                if (!mc_is_professor($user)) continue;
                $cleanVal = (string)max(0, min(MP_SLIDE_COUNT - 1, (int)$sVal));
                $stUpsert->execute(['auditorium_presenter', (string)$user['display_name']]);
            } elseif ($sKey === 'auditorium_presenter') {
                continue;
            } elseif (preg_match('/^greenhouse_slot_([0-9]|1[0-9]|2[0-3])_humidity$/', $sKey)) {
                $cleanVal = (string)max(0, min(100, (int)round((float)$sVal)));
            } elseif (preg_match('/^greenhouse_slot_([0-9]|1[0-9]|2[0-3])_stage$/', $sKey)) {
                $cleanVal = (string)max(-1, min(3, (int)$sVal));
            } elseif (preg_match('/^greenhouse_slot_([0-9]|1[0-9]|2[0-3])_empty$/', $sKey)) {
                $cleanVal = ($sVal === '1' || $sVal === 1 || $sVal === true) ? '1' : '0';
            } elseif (preg_match('/^greenhouse_slot_([0-9]|1[0-9]|2[0-3])_species$/', $sKey)) {
                $cleanVal = mb_substr(trim(strip_tags((string)$sVal)), 0, 80);
            } elseif (preg_match('/^greenhouse_slot_([0-9]|1[0-9]|2[0-3])_origin$/', $sKey)) {
                $cleanVal = mp_clean_culture_origin($sVal);
            } elseif ($sKey === 'greenhouse_hum') {
                $cleanVal = (string)max(20, min(100, (int)round((float)$sVal)));
            } elseif ($sKey === 'greenhouse_target_hum') {
                $cleanVal = (string)max(55, min(98, (int)round((float)$sVal)));
            } elseif ($sKey === 'greenhouse_co2') {
                $cleanVal = (string)max(380, min(2500, (int)round((float)$sVal)));
            } elseif ($sKey === 'greenhouse_target_co2') {
                $cleanVal = (string)max(420, min(2000, (int)round((float)$sVal)));
            } elseif ($sKey === 'greenhouse_temp') {
                $cleanVal = (string)max(100, min(400, (int)round((float)$sVal)));
            } elseif ($sKey === 'greenhouse_target_temp') {
                $cleanVal = (string)max(140, min(320, (int)round((float)$sVal)));
            } elseif ($sKey === 'greenhouse_humidifier') {
                $cleanVal = (string)max(0, min(3, (int)$sVal));
            } elseif ($sKey === 'greenhouse_exhaust') {
                $cleanVal = (string)max(0, min(2, (int)$sVal));
            } elseif ($sKey === 'ball_soccer' || $sKey === 'ball_basket') {
                $parts = array_map('trim', explode(',', (string)$sVal));
                if (count($parts) !== 6) continue;
                $cleanParts = [];
                $validBall = true;
                foreach ($parts as $p) {
                    if (!is_numeric($p) || !is_finite((float)$p)) { $validBall = false; break; }
                    $cleanParts[] = (string)round(max(-500.0, min(500.0, (float)$p)), 2);
                }
                if (!$validBall) continue;
                $cleanVal = implode(',', $cleanParts);
            } elseif (strpos($sKey, 'cooker_mode_') === 0) {
                $cleanVal = ($sVal === '1' || $sVal === 1 || $sVal === true) ? '1' : '0';
            } elseif (in_array($sKey, ['stand_packs', 'stand_sold', 'garden_compost', 'garden_richness', 'garden_harvested', 'garden_baskets', 'sport_soccer_goals', 'sport_basket_points', 'sport_basket_streak'], true)) {
                $maxMap = [
                    'stand_packs' => 200,
                    'stand_sold' => 1000000,
                    'garden_compost' => 50,
                    'garden_richness' => 100,
                    'garden_harvested' => 50,
                    'garden_baskets' => 1000000,
                    'sport_soccer_goals' => 1000000,
                    'sport_basket_points' => 1000000,
                    'sport_basket_streak' => 10000,
                ];
                $cleanVal = (string)max(0, min($maxMap[$sKey], (int)round((float)$sVal)));
            } elseif ($sKey === 'garden_plants') {
                $rawPlants = trim((string)$sVal);
                if (!preg_match('/^[0-2]:\d{1,3}(?::1)?(,[0-2]:\d{1,3}(?::1)?){0,23}$/', $rawPlants)) continue;
                $cleanVal = $rawPlants;
            } elseif ($sKey === 'burner_timer_preset_lab' || $sKey === 'burner_timer_preset_sub') {
                $preset = (int)$sVal;
                if (!in_array($preset, [0, 20, 60, 90, 120], true)) $preset = 0;
                $cleanVal = (string)$preset;
            } elseif ($sKey === 'burner_timer_end_lab' || $sKey === 'burner_timer_end_sub') {
                $endTs = (int)$sVal;
                if ($endTs <= 0) {
                    $cleanVal = '0';
                } else {
                    $nowTimerTs = time();
                    $cleanVal = (string)max($nowTimerTs - 3600, min($nowTimerTs + 86400, $endTs));
                }
            } else {
                $cleanVal = ($sVal === '1' || $sVal === 1 || $sVal === true) ? '1' : '0';
            }
            $stUpsert->execute([$sKey, $cleanVal]);
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
                $strokeId = $st['stroke_id'] ?? '';
                $strokeKey = is_string($strokeId) && preg_match('/\A[0-9a-f]{24}\z/', $strokeId)
                    ? hash('sha256', $sessionKey . ':' . $strokeId)
                    : null;
                $strokePlaceholders[] = '(?, ?)';
                $strokeParams[] = $strokeKey;
                $strokeParams[] = json_encode(['b' => $boardIdx, 'c' => $col, 'pts' => $pts]);
            }
        }
        if ($strokePlaceholders) {
            $pdo->prepare('INSERT INTO mc_board_strokes (stroke_key, stroke_json) VALUES ' . implode(',', $strokePlaceholders) .
                ' ON DUPLICATE KEY UPDATE id = id')
                ->execute($strokeParams);
            // Mantem ate 2500 tracos para preservar todo o desenho das 4 lousas
            $oldestKept = (int)$pdo->query('SELECT id FROM mc_board_strokes ORDER BY id DESC LIMIT 1 OFFSET 2499')->fetchColumn();
            if ($oldestKept > 0) {
                $delOld = $pdo->prepare('DELETE FROM mc_board_strokes WHERE id < ?');
                $delOld->execute([$oldestKept]);
            }
        }
    }

    if ($leaving) {
        $pdo->prepare('DELETE FROM mc_sessions WHERE session_id = ?')->execute([$sessionKey]);
        mc_json(['ok' => true]);
    }

    $meta = $pdo->query('SELECT
        (SELECT COUNT(*) FROM mc_world_objects) AS obj_c,
        (SELECT COALESCE(MAX(updated_at), "") FROM mc_world_objects) AS obj_u,
        (SELECT COUNT(*) FROM mc_world_item_states) AS st_obj_c,
        (SELECT COALESCE(MAX(updated_at), "") FROM mc_world_item_states) AS st_obj_u,
        (SELECT COUNT(*) FROM mc_world_state) AS ws_c,
        (SELECT COALESCE(MAX(updated_at), "") FROM mc_world_state) AS ws_u,
        (SELECT COUNT(*) FROM mc_world_layout_edits) AS le_c,
        (SELECT COALESCE(MAX(updated_at), "") FROM mc_world_layout_edits) AS le_u,
        (SELECT COALESCE(MAX(id), 0) FROM mc_board_strokes) AS brd_max')->fetch();

    $nowTs = time();
    $villageVersion = mc_village_layout_version($pdo, $nowTs);
    $leaseQuery = $pdo->prepare('SELECT lot_id, expires_at FROM mc_village_lots WHERE owner_id = ? AND expires_at > ? LIMIT 1');
    $leaseQuery->execute([$userId, $nowTs]);
    $activeLease = $leaseQuery->fetch();
    $clientObjVer = (string)($body['obj_ver'] ?? '');
    $objVer = ($meta ? ((string)$meta['obj_c'] . ':' . (string)$meta['obj_u']) : '0:') . ':' . $villageVersion;
    $objectsUnchanged = (!$initSync && $clientObjVer !== '' && $clientObjVer === $objVer);
    $objects = null;
    if (!$objectsUnchanged) {
        $objects = new stdClass();
        foreach ($pdo->query('SELECT w.item_id, w.x, w.y, w.z, w.ry FROM mc_world_objects w' . MC_VILLAGE_ITEM_JOINS . ' WHERE ' . MC_VILLAGE_ITEM_VISIBLE) as $obj) {
            $itemId = (string)$obj['item_id'];
            $objects->{$itemId} = [
                'x' => (float)$obj['x'],
                'y' => (float)$obj['y'],
                'z' => (float)$obj['z'],
                'ry' => (float)$obj['ry'],
            ];
            $lotId = mc_village_lot_at((float)$obj['x'], (float)$obj['z']);
            $lot = $lotId !== null ? $getLot($lotId) : null;
            if ($lot && (int)$lot['expires_at'] > $villageNow && (int)$lot['owner_id'] !== $userId) {
                $objects->{$itemId}['lot_locked'] = true;
            }
        }
    }

    $clientItemStateVer = (string)($body['item_state_ver'] ?? '');
    $itemStateVer = ($meta ? ((string)$meta['st_obj_c'] . ':' . (string)$meta['st_obj_u']) : '0:') . ':' . $villageVersion;
    $itemStatesUnchanged = (!$initSync && $clientItemStateVer !== '' && $clientItemStateVer === $itemStateVer);
    $itemStates = null;
    $itemStateAges = null;
    if (!$itemStatesUnchanged) {
        $itemStates = new stdClass();
        $itemStateAges = new stdClass();
        foreach ($pdo->query('SELECT w.item_id, w.state_json, UNIX_TIMESTAMP(w.updated_at) AS updated_ts FROM mc_world_item_states w' . MC_VILLAGE_ITEM_JOINS . ' WHERE ' . MC_VILLAGE_ITEM_VISIBLE) as $savedState) {
            $decodedState = json_decode((string)$savedState['state_json'], true);
            if (is_array($decodedState)) {
                $itemStateId = (string)$savedState['item_id'];
                $itemStates->{$itemStateId} = $decodedState;
                if ($initSync && (count($players) === 0 || in_array($itemStateId, $inventory['slots'], true)) && isset($savedState['updated_ts'])) {
                    $itemStateAges->{$itemStateId} = max(0, min(7200, $nowTs - (int)$savedState['updated_ts']));
                }
            }
        }
    }
    $clientStateVer = (string)($body['state_ver'] ?? '');
    // Inclui bucket de 2s para que respawns de wild_* (20s) sejam propagados sem polling pesado
    $stateVer = ($meta ? ((string)$meta['ws_c'] . ':' . (string)$meta['ws_u']) : '0:') . ':' . (string)floor($nowTs / 2);
    $stateUnchanged = (!$initSync && empty($body['state_changes']) && $clientStateVer !== '' && $clientStateVer === $stateVer);
    $state = null;
    if (!$stateUnchanged) {
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
    }

    $boardSince = max(0, (int)($body['board_since'] ?? 0));
    $boardMaxId = $meta ? (int)$meta['brd_max'] : 0;
    $boardStrokes = [];
    $lastBoardId = $boardSince;
    if ($boardMaxId > $boardSince) {
        $bStmt = $pdo->prepare('SELECT id, stroke_json FROM mc_board_strokes WHERE id > ? ORDER BY id ASC LIMIT 2500');
        $bStmt->execute([$boardSince]);
        foreach ($bStmt->fetchAll() as $row) {
            $dec = json_decode((string)$row['stroke_json'], true);
            if (is_array($dec)) {
                $boardStrokes[] = $dec;
            }
            $lastBoardId = (int)$row['id'];
        }
    }

    $appVersion = function_exists('apcu_fetch') ? apcu_fetch('mc_app_version') : false;
    if ($appVersion === false) {
        $appVersion = trim((string)@file_get_contents(__DIR__ . '/../VERSION'));
        if (function_exists('apcu_store')) {
            apcu_store('mc_app_version', $appVersion, 5);
        }
    }

    $clientLayoutVer = (string)($body['layout_ver'] ?? '');
    $layoutVer = ($meta ? ((string)$meta['le_c'] . ':' . (string)$meta['le_u']) : '0:') . ':' . $villageVersion;
    $layoutUnchanged = (!$initSync && $clientLayoutVer !== '' && $clientLayoutVer === $layoutVer);
    $layoutEdits = null;
    if (!$layoutUnchanged) {
        $layoutEdits = new stdClass();
        foreach ($pdo->query('SELECT w.item_id, w.prefab_id, w.label, w.scale, w.removed, vi.owner_id, vs.item_id IS NOT NULL AS on_sale, ' .
            MC_VILLAGE_ITEM_VISIBLE . ' AS visible FROM mc_world_layout_edits w' . MC_VILLAGE_ITEM_JOINS . ' LEFT JOIN mc_village_sales vs ON vs.item_id = w.item_id') as $le) {
            $leId = (string)$le['item_id'];
            $layoutEdits->{$leId} = [
                'prefab_id' => (string)$le['prefab_id'],
                'label' => (string)$le['label'],
                'scale' => (float)$le['scale'],
                'removed' => ((int)$le['removed'] === 1),
                'stored' => !(int)$le['visible'],
                'read_only' => !empty($le['on_sale']) || ($le['owner_id'] !== null && (int)$le['owner_id'] !== $userId),
                'personal' => $le['owner_id'] !== null,
            ];
        }
    }

    $resp = [
        'ok' => true,
        'server_ts' => $nowTs,
        'inventory' => array_diff_key($inventory, array_flip(['_did_swap', '_reserved_owners', '_other_held'])),

        'app_version' => $appVersion,
        'online_count' => count($players) + 1,
        'saved_pose' => $savedPose,
        'village_lease' => $activeLease ? ['id' => (int)$activeLease['lot_id'], 'expires_at' => (int)$activeLease['expires_at']] : null,
        'force_teleport' => $forceTeleport,
        'players' => $players,
        'obj_ver' => $objVer,
        'item_state_ver' => $itemStateVer,
        'state_ver' => $stateVer,
        'layout_ver' => $layoutVer,
        'objects_unchanged' => $objectsUnchanged,
        'item_states_unchanged' => $itemStatesUnchanged,
        'state_unchanged' => $stateUnchanged,
        'layout_unchanged' => $layoutUnchanged,
        'board_strokes' => $boardStrokes,
        'board_last_id' => $lastBoardId,
    ];
    if ($z >= 32 && $z <= 115 && abs($x) <= 110) {
        $traffic = $pdo->prepare('SELECT lot_id, pickup_at FROM mc_village_sales WHERE pickup_at BETWEEN ? AND ? GROUP BY lot_id, pickup_at ORDER BY pickup_at LIMIT 10');
        $traffic->execute([$nowTs - 10, $nowTs + 14]);
        $resp['village_traffic'] = $traffic->fetchAll();
    }
    if (!$objectsUnchanged) {
        $resp['objects'] = $objects;
    }
    if (!$itemStatesUnchanged) {
        $resp['item_states'] = $itemStates;
        if ($initSync && $itemStateAges !== null) {
            $resp['item_state_ages'] = $itemStateAges;
        }
    }
    if (!$stateUnchanged) {
        $resp['world_state'] = $state;
    }
    if (!$layoutUnchanged) {
        $resp['layout_edits'] = $layoutEdits;
    }
    mc_json($resp);
}

mc_json(['ok' => false, 'error' => 'Acao desconhecida.'], 400);
