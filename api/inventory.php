<?php
declare(strict_types=1);

/** Only synchronized portable items. Furniture and vessels with exposed contents stay in the world. */
function mp_inventory_kind(PDO $pdo, string $itemId): string {
    if (!mp_is_allowed_item_id($itemId)) return '';
    if (str_starts_with($itemId, 'dyn_')) {
        $find = $pdo->prepare('SELECT prefab_id FROM mc_world_layout_edits WHERE item_id = ? AND removed = 0');
        $find->execute([$itemId]);
        $prefab = (string)$find->fetchColumn();
        if (str_starts_with($itemId, 'dyn_vial3ml_') || str_starts_with($itemId, 'dyn_vial') || $prefab === 'vial3ml' || $prefab === 'vial_3ml' || $prefab === 'vial_5ml') return 'portable';
        if (str_starts_with($prefab, 'petri')) return 'petri';
        if (str_starts_with($prefab, 'pp5')) return 'pp5';
        if (str_starts_with($prefab, 'spawn_bag')) return 'bag';
        return preg_match('/^(?:syringe|scalpel|falcon_(?:15|50)ml|spawn_jar|liquid_culture|alcohol_spray|water_spray|h2o2_spray|paper_towel|gloves|infrared_thermometer|lab_spoon|parafilm|micropore|foil_roll)/', $prefab) ? 'portable' : '';
    }
    if (str_starts_with($itemId, 'petri_')) return 'petri';
    if (str_starts_with($itemId, 'pp5_cup_')) return 'pp5';
    if (str_starts_with($itemId, 'spawn_bag')) return 'bag';
    if (str_starts_with($itemId, 'mushroom_pack_bag_')) return 'package';
    return preg_match('/^(?:syringe_10ml_|scalpel_|spawn_jar|liquid_culture|falcon_(?:15|50)ml_|alcohol_spray|water_spray|h2o2_spray|paper_towel|gloves_box|infrared_thermometer|lab_spoon|parafilm|micropore|foil_roll|wild_picked_|harvest_tub_|harvest_gh_|dried_batch_|vial_?[35]ml_)/', $itemId)
        ? 'portable' : '';
}

function mp_inventory_lock(PDO $pdo): void {
    $pdo->beginTransaction();
    $pdo->query("SELECT meta_val FROM mc_meta WHERE meta_key = 'inventory_lock' FOR UPDATE")->fetchColumn();
}

/** A single transaction covers reservations, carried poses and item writes. */
function mp_inventory_sync(PDO $pdo, int $userId, string $sessionKey, string $holding, bool $initial, array $body, callable $canAccessItem): array {
    $fetch = $pdo->prepare('SELECT session_id, active_slot, operation_id, operation_result FROM mc_inventory_control WHERE user_id = ?');
    $fetch->execute([$userId]);
    $control = $fetch->fetch();
    $supported = !empty($body['inventory_enabled']);
    if ($supported && (!$control || ($initial && $control['session_id'] !== $sessionKey))) {
        $pdo->prepare('INSERT INTO mc_inventory_control (user_id, session_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE session_id=VALUES(session_id), operation_id=\'\', operation_result=\'\'')
            ->execute([$userId, $sessionKey]);
        $pdo->prepare("UPDATE mc_sessions SET holding_item='' WHERE user_id=? AND session_id<>?")->execute([$userId, $sessionKey]);
        $fetch->execute([$userId]);
        $control = $fetch->fetch();
    }
    $owner = $supported && $control && $control['session_id'] === $sessionKey;
    $active = $owner ? (int)$control['active_slot'] : 0;
    $reservations = [];
    $slots = [null, null, null];
    foreach ($pdo->query('SELECT item_id, user_id, slot FROM mc_inventory_slots')->fetchAll() as $row) {
        $id = (string)$row['item_id'];
        if ((int)$row['user_id'] === $userId && !$canAccessItem($id)) {
            $pdo->prepare('DELETE FROM mc_inventory_slots WHERE item_id = ? AND user_id = ?')->execute([$id, $userId]);
            continue;
        }
        $reservations[$id] = (int)$row['user_id'];
        if ($owner && (int)$row['user_id'] === $userId) $slots[(int)$row['slot']] = $id;
    }
    $currentQuery = $pdo->prepare('SELECT holding_item FROM mc_sessions WHERE session_id=?');
    $currentQuery->execute([$sessionKey]);
    $previousHolding = (string)$currentQuery->fetchColumn();
    $heldQuery = $pdo->prepare('SELECT holding_item FROM mc_sessions WHERE session_id <> ? AND holding_item <> \'\' AND last_seen >= NOW() - INTERVAL 12 SECOND');
    $heldQuery->execute([$sessionKey]);
    $otherHeld = array_fill_keys($heldQuery->fetchAll(PDO::FETCH_COLUMN), true);
    $op = is_array($body['inventory_op'] ?? null) && !$initial ? $body['inventory_op'] : [];
    $opId = is_string($op['id'] ?? null) && preg_match('/^[a-z0-9_-]{8,40}$/D', $op['id']) ? $op['id'] : '';
    $replay = $owner && $opId !== '' && hash_equals((string)$control['operation_id'], $opId);
    if ($owner && ($initial || $replay) && $slots[$active] !== null) $holding = $slots[$active];
    if ($replay && $control['operation_result'] === 'ok') $holding = $slots[$active] ?? '';
    $conflict = $holding !== '' && (
        !$canAccessItem($holding) || (isset($reservations[$holding]) && $reservations[$holding] !== $userId) || isset($otherHeld[$holding])
    );
    if ($conflict) $holding = '';

    $result = '';
    $didSwap = false;
    if ($opId !== '' && !$owner) {
        $result = 'session';
    } elseif ($replay) {
        $result = (string)$control['operation_result'];
        $didSwap = $result === 'ok';
    } elseif ($opId !== '') {
        $target = $op['slot'] ?? null;
        $result = !is_int($target) || $target < 0 || $target > 2 || $target === $active ? 'slot' : '';
        if ($conflict || ($op['held'] ?? null) !== $holding) $result = 'busy';
        $kind = $holding !== '' && $result === '' ? mp_inventory_kind($pdo, $holding) : '';
        if ($holding !== '' && $result === '' && $kind === '') $result = 'large';

        // Check against a sanitized snapshot of the item being put away.
        $state = $kind !== '' && $result === '' ? mp_clean_item_state($holding, $op['state'] ?? null) : null;
        $decoded = $state !== null ? json_decode($state, true) : [];
        if ($result === '' && $holding !== '') {
            if ($kind === 'petri' && ($decoded['petri']['lidOpen'] ?? true)) $result = 'open';
            if ($kind === 'pp5' && ($decoded['spawn']['lidOpen'] ?? true)) $result = 'open';
            if ($kind === 'package' && (!isset($decoded['custom']) || (!empty($decoded['custom']['filled']) && empty($decoded['custom']['sealed'])))) $result = 'open';
            if ($kind === 'bag' && (!isset($decoded['spawn']) || (!empty($decoded['spawn']['filled']) && empty($decoded['spawn']['sealed'])))) $result = 'open';
        }
        if ($result === '') {
            if ($holding !== '') {
                if ($state !== null) {
                    $pdo->prepare('INSERT INTO mc_world_item_states (item_id,state_json) VALUES (?,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)')
                        ->execute([$holding, $state]);
                }
                $pdo->prepare('DELETE FROM mc_inventory_slots WHERE item_id=? OR (user_id=? AND slot=?)')->execute([$holding, $userId, $active]);
                $pdo->prepare('INSERT INTO mc_inventory_slots (item_id,user_id,slot) VALUES (?,?,?)')->execute([$holding, $userId, $active]);
                $slots[$active] = $holding;
                $reservations[$holding] = $userId;
            } else {
                $pdo->prepare('DELETE FROM mc_inventory_slots WHERE user_id=? AND slot=?')->execute([$userId, $active]);
                if ($slots[$active] !== null) unset($reservations[$slots[$active]]);
                $slots[$active] = null;
            }
            $active = $target;
            $holding = $slots[$target] ?? '';
            $result = 'ok';
            $didSwap = true;
        }
        $pdo->prepare('UPDATE mc_inventory_control SET active_slot=?, operation_id=?, operation_result=? WHERE user_id=?')
            ->execute([$active, $opId, $result, $userId]);
    } elseif ($owner && !$initial && !$conflict && $slots[$active] !== ($holding !== '' ? $holding : null)) {
        $old = $slots[$active];
        if ($old !== null) {
            $pdo->prepare('DELETE FROM mc_inventory_slots WHERE user_id=? AND slot=?')->execute([$userId, $active]);
            unset($reservations[$old]);
            $slots[$active] = null;
        }
        if ($holding !== '' && mp_inventory_kind($pdo, $holding) !== '') {
            $pdo->prepare('DELETE FROM mc_inventory_slots WHERE item_id=?')->execute([$holding]);
            $pdo->prepare('INSERT INTO mc_inventory_slots (item_id,user_id,slot) VALUES (?,?,?)')->execute([$holding, $userId, $active]);
            $slots[$active] = $holding;
            $reservations[$holding] = $userId;
        }
    }

    if ($owner && !$initial && !$conflict && $opId === '' && $holding !== '' && $slots[$active] === $holding) {
        $hand = $body['inventory_hand'] ?? null;
        if (is_array($hand) && ($hand['id'] ?? null) === $holding) {
            $state = mp_clean_item_state($holding, $hand['state'] ?? null);
            if ($state !== null) {
                $pdo->prepare('INSERT INTO mc_world_item_states (item_id,state_json) VALUES (?,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)')
                    ->execute([$holding, $state]);
            }
        }
    }

    return [
        'active' => $active, 'slots' => $slots, 'reserved' => array_keys($reservations),
        'op' => $opId, 'result' => $result, 'holding' => $holding, 'conflict' => $conflict,
        'ready' => (bool)$owner, '_did_swap' => $didSwap || $holding !== $previousHolding, '_reserved_owners' => $reservations, '_other_held' => $otherHeld,
    ];
}
