<?php
/** Rental transactions for the ten campus village lots. */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/village_store.php';
require_once __DIR__ . '/inventory.php';

const MC_VILLAGE_DAILY_PRICE = 25;
const MC_VILLAGE_RENTAL_DAYS = [1, 3, 7];
const MC_HOUSE_UPGRADE_PRICES = [
    'house_lights' => 60,
    'garden_lights' => 80,
    'blinds' => 50,
    'front_door' => 75,
    'back_door' => 110,
    'second_floor' => 220,
];
const MC_VILLAGE_DAY_SECONDS = 86400;
const MC_VILLAGE_MAX_DAYS = 30;

function mc_village_status(PDO $pdo, int $userId): array {
    $now = time();
    $lots = [];
    $rentalQuery = 'SELECT l.lot_id, l.owner_id, l.expires_at, u.display_name FROM mc_village_lots l' .
        ' LEFT JOIN mc_users u ON u.id = l.owner_id WHERE l.lot_id BETWEEN 1 AND 10 ORDER BY l.lot_id';
    $upgradesMap = [];
    foreach ($pdo->query('SELECT lot_id, upgrades_json FROM mc_village_upgrades') as $uRow) {
        $dec = json_decode((string)$uRow['upgrades_json'], true);
        if (is_array($dec)) $upgradesMap[(int)$uRow['lot_id']] = $dec;
    }
    foreach ($pdo->query($rentalQuery) as $row) {
        $id = (int)$row['lot_id'];
        $expires = (int)$row['expires_at'];
        $occupied = $expires > $now && (int)$row['owner_id'] > 0;
        $lots[] = [
            'id' => $id,
            'occupied' => $occupied,
            'mine' => $occupied && (int)$row['owner_id'] === $userId,
            'expires_at' => $occupied ? $expires : 0,
            'tenant_name' => $occupied ? $row['display_name'] : null,
            'upgrades' => $occupied ? ($upgradesMap[$id] ?? new stdClass()) : new stdClass(),
        ];
    }
    $storage = $pdo->prepare('SELECT w.item_id, w.prefab_id, w.label FROM mc_world_layout_edits w' . MC_VILLAGE_ITEM_JOINS .
        ' LEFT JOIN mc_world_item_states st ON st.item_id = w.item_id WHERE vi.owner_id = ? AND w.removed = 0 AND NOT ' . MC_VILLAGE_ITEM_VISIBLE .
        ' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(st.state_json, \'$.custom.removed\')), \'false\') <> \'true\' ORDER BY w.item_id');
    $storage->execute([$userId]);
    $notebook = $pdo->prepare('SELECT body FROM mc_village_notes WHERE owner_id = ?');
    $notebook->execute([$userId]);
    return ['lots' => $lots, 'stored_items' => $storage->fetchAll(), 'daily_price' => MC_VILLAGE_DAILY_PRICE,
        'notebook' => (string)$notebook->fetchColumn(), 'days' => MC_VILLAGE_RENTAL_DAYS, 'server_ts' => $now];
}

function mc_village_restore_item(PDO $pdo, int $userId, string $id): void {
    mp_inventory_lock($pdo);
    try {
        $now = time();
        $lease = $pdo->prepare('SELECT lot_id, lease_epoch FROM mc_village_lots WHERE owner_id = ? AND expires_at > ? LIMIT 1 FOR UPDATE');
        $lease->execute([$userId, $now]);
        $lot = $lease->fetch();
        if (!$lot) throw new InvalidArgumentException('Alugue uma casa para retirar o item.');
        $item = mc_village_item_rows($pdo, [$id])[$id] ?? null;
        if (!$item || (int)$item['owner_id'] !== $userId) throw new InvalidArgumentException('Item indisponível no seu depósito.');
        $priorLot = $item['lot_id'] !== null ? mc_village_read_lot($pdo, (int)$item['lot_id']) : null;
        if (mc_village_item_active($item, $priorLot, $now)) {
            $pdo->commit();
            return;
        }
        $number = (int)$lot['lot_id'];
        $x = (($number - 1) % 5 - 2) * 26 + ($number <= 5 ? 4.25 : -4.25);
        $z = $number <= 5 ? 59.0 : 79.0;
        $near = $pdo->prepare('SELECT w.item_id FROM mc_world_objects w' . MC_VILLAGE_ITEM_JOINS .
            ' WHERE w.x BETWEEN ? AND ? AND w.z BETWEEN ? AND ? AND w.y BETWEEN -0.5 AND 2 AND ' . MC_VILLAGE_ITEM_VISIBLE . ' LIMIT 1');
        $near->execute([$x - 1.1, $x + 1.1, $z - 1.1, $z + 1.1]);
        if ($near->fetchColumn()) throw new InvalidArgumentException('Retire o item que está no ponto de entrega antes de buscar outro.');
        $pdo->prepare('DELETE FROM mc_inventory_slots WHERE item_id = ? AND user_id = ?')->execute([$id, $userId]);
        $pdo->prepare('UPDATE mc_village_items SET lot_id = ?, lease_epoch = ? WHERE item_id = ?')->execute([$number, (int)$lot['lease_epoch'], $id]);
        $pdo->prepare('UPDATE mc_world_objects SET x = ?, y = 0.03, z = ?, ry = 0, updated_at = NOW(6) WHERE item_id = ?')->execute([$x, $z, $id]);
        $pdo->prepare('UPDATE mc_world_layout_edits SET updated_at = NOW(6) WHERE item_id = ?')->execute([$id]);
        // A previously unavailable item also needs its state resent after withdrawal.
        $pdo->prepare('UPDATE mc_world_item_states SET updated_at = NOW(6) WHERE item_id = ?')->execute([$id]);
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    mc_json(['ok' => false, 'error' => 'Método HTTP inválido. Use POST.'], 405);
}

$pdo = mc_db_or_fail();
$userId = (int)mc_require_user($pdo)['id'];
$body = mc_body();
$action = mc_action('status');

if ($action === 'set_editor' || $action === 'move_as_editor') {
    $lotId = filter_var($body['lot_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$lotId || $lotId < 1 || $lotId > 10) mc_json(['ok' => false], 400);
    mp_inventory_lock($pdo);
    try {
        $now = time();
        $lot = mc_village_read_lot($pdo, $lotId);
        $poses = $pdo->prepare('SELECT x, z FROM mc_sessions WHERE user_id = ? AND in_fps = 1
            AND last_seen >= NOW() - INTERVAL 12 SECOND ORDER BY last_seen DESC LIMIT 1');
        $inside = static function (int $person) use ($poses, $lotId): bool {
            $poses->execute([$person]);
            $position = $poses->fetch();
            return $position && mc_village_lot_at((float)$position['x'], (float)$position['z']) === $lotId;
        };
        if ($action === 'set_editor') {
            $guest = filter_var($body['guest_id'] ?? null, FILTER_VALIDATE_INT);
            $allowed = $body['allowed'] ?? null;
            if (!$guest || $guest === $userId || !is_bool($allowed) ||
                !mc_village_has_lease($lot, $userId, $now) || !$inside($userId) || ($allowed && !$inside($guest))) {
                $pdo->rollBack();
                mc_json(['ok' => false], 403);
            }
            if ($allowed) {
                $pdo->prepare('INSERT IGNORE INTO mc_village_trusted (owner_id, guest_id) VALUES (?, ?)')->execute([$userId, $guest]);
                $pdo->prepare('INSERT INTO mc_village_editors (lot_id, user_id, lease_epoch) VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE lease_epoch=VALUES(lease_epoch)')->execute([$lotId, $guest, (int)$lot['lease_epoch']]);
            } else {
                $pdo->prepare('DELETE FROM mc_village_trusted WHERE owner_id=? AND guest_id=?')->execute([$userId, $guest]);
                $pdo->prepare('DELETE FROM mc_village_editors WHERE lot_id=? AND user_id=? AND lease_epoch=?')
                    ->execute([$lotId, $guest, (int)$lot['lease_epoch']]);
            }
            $pdo->commit();
            mc_json(['ok' => true, 'allowed' => $allowed]);
        }

        $id = $body['item_id'] ?? null;
        $pose = $body['pose'] ?? null;
        if (!is_string($id) || !preg_match('/\A[a-z0-9_]{2,64}\z/D', $id) ||
            !is_array($pose) || !mc_village_can_edit($pdo, $lotId, $userId, $lot, $now) || !$inside($userId)) {
            $pdo->rollBack();
            mc_json(['ok' => false], 403);
        }
        foreach (['x', 'y', 'z', 'ry'] as $key) {
            if (!is_numeric($pose[$key] ?? null) || !is_finite((float)$pose[$key])) {
                $pdo->rollBack();
                mc_json(['ok' => false], 400);
            }
        }
        $source = $pdo->prepare('SELECT w.x, w.z FROM mc_world_objects w
            LEFT JOIN mc_world_layout_edits le ON le.item_id=w.item_id
            LEFT JOIN mc_village_items vi ON vi.item_id=w.item_id
            LEFT JOIN mc_village_sales vs ON vs.item_id=w.item_id
            WHERE w.item_id=? AND COALESCE(le.removed, 0)=0 AND vs.item_id IS NULL
              AND (vi.item_id IS NULL OR (vi.lot_id=? AND vi.owner_id=? AND vi.lease_epoch=?))
              AND NOT EXISTS (SELECT 1 FROM mc_inventory_slots WHERE item_id=w.item_id)
              AND NOT EXISTS (SELECT 1 FROM mc_sessions WHERE holding_item=w.item_id AND last_seen >= NOW() - INTERVAL 12 SECOND)
            FOR UPDATE');
        $source->execute([$id, $lotId, (int)$lot['owner_id'], (int)$lot['lease_epoch']]);
        $position = $source->fetch();
        if (!$position || mc_village_lot_at((float)$position['x'], (float)$position['z']) !== $lotId ||
            mc_village_lot_at((float)$pose['x'], (float)$pose['z']) !== $lotId ||
            (float)$pose['y'] < -0.02 || (float)$pose['y'] > 12 || abs((float)$pose['ry']) > 1000) {
            $pdo->rollBack();
            mc_json(['ok' => false], 409);
        }
        $pdo->prepare('UPDATE mc_world_objects SET x=?, y=?, z=?, ry=? WHERE item_id=?')
            ->execute([(float)$pose['x'], (float)$pose['y'], (float)$pose['z'], (float)$pose['ry'], $id]);
        $pdo->commit();
        mc_json(['ok' => true]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log($error->getMessage());
        mc_json(['ok' => false], 500);
    }
}

if ($action === 'status') {
    mc_village_settle_sales($pdo, $userId);
    $balance = $pdo->prepare('SELECT myco_coins FROM mc_users WHERE id = ?');
    $balance->execute([$userId]);
    mc_json(['ok' => true, 'myco_coins' => (int)$balance->fetchColumn()] + mc_village_status($pdo, $userId));
}
if ($action === 'save_note') {
    $note = $body['note'] ?? null;
    if (!is_string($note) || mb_strlen($note, 'UTF-8') > 4000) {
        mc_json(['ok' => false, 'error' => 'O caderno aceita até 4.000 caracteres.'], 400);
    }
    $pdo->prepare('INSERT INTO mc_village_notes (owner_id, body) VALUES (?, ?) ON DUPLICATE KEY UPDATE body = VALUES(body)')
        ->execute([$userId, $note]);
    mc_json(['ok' => true]);
}
if ($action === 'withdraw') {
    $id = $body['item_id'] ?? null;
    if (!is_string($id) || !preg_match('/\Adyn_shop_[a-f0-9]{32}\z/', $id)) {
        mc_json(['ok' => false, 'error' => 'Item inválido.'], 400);
    }
    try {
        mc_village_restore_item($pdo, $userId, $id);
        mc_json(['ok' => true] + mc_village_status($pdo, $userId));
    } catch (InvalidArgumentException $error) {
        mc_json(['ok' => false, 'error' => $error->getMessage()], 409);
    }
}
if ($action === 'buy_upgrade') {
    $lotId = filter_var($body['lot_id'] ?? null, FILTER_VALIDATE_INT);
    $upgradeId = (string)($body['upgrade_id'] ?? '');
    if (!$lotId || $lotId < 1 || $lotId > 10 || !isset(MC_HOUSE_UPGRADE_PRICES[$upgradeId])) {
        mc_json(['ok' => false, 'error' => 'Melhoria inválida.'], 400);
    }
    $price = MC_HOUSE_UPGRADE_PRICES[$upgradeId];
    $pdo->beginTransaction();
    try {
        $now = time();
        $lot = mc_village_read_lot($pdo, $lotId);
        if (!mc_village_has_lease($lot, $userId, $now)) {
            $pdo->rollBack();
            mc_json(['ok' => false, 'error' => 'Apenas o dono do terreno pode comprar melhorias.'], 403);
        }
        $uq = $pdo->prepare('SELECT upgrades_json FROM mc_village_upgrades WHERE lot_id = ? FOR UPDATE');
        $uq->execute([$lotId]);
        $cur = json_decode((string)($uq->fetchColumn() ?: '{}'), true);
        if (!is_array($cur)) $cur = [];
        if (!empty($cur[$upgradeId])) {
            $pdo->rollBack();
            mc_json(['ok' => true, 'already' => true, 'upgrades' => $cur] + mc_village_status($pdo, $userId));
        }
        $acc = $pdo->prepare('SELECT myco_coins FROM mc_users WHERE id = ? FOR UPDATE');
        $acc->execute([$userId]);
        $coins = (int)$acc->fetchColumn();
        if ($coins < $price) {
            $pdo->rollBack();
            mc_json(['ok' => false, 'error' => 'MycoCoins insuficientes.'], 409);
        }
        $pdo->prepare('UPDATE mc_users SET myco_coins = myco_coins - ? WHERE id = ?')->execute([$price, $userId]);
        $cur[$upgradeId] = true;
        $json = json_encode($cur);
        $pdo->prepare('INSERT INTO mc_village_upgrades (lot_id, upgrades_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE upgrades_json = VALUES(upgrades_json)')
            ->execute([$lotId, $json]);
        $pdo->commit();
        mc_json(['ok' => true, 'myco_coins' => $coins - $price, 'upgrades' => $cur] + mc_village_status($pdo, $userId));
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[MycoCampus3D] village buy_upgrade: ' . $e->getMessage());
        mc_json(['ok' => false, 'error' => 'Erro ao comprar melhoria.'], 500);
    }
}

if ($action !== 'rent') {
    mc_json(['ok' => false, 'error' => 'Ação desconhecida.'], 404);
}

$lotId = filter_var($body['lot_id'] ?? null, FILTER_VALIDATE_INT);
$days = filter_var($body['days'] ?? null, FILTER_VALIDATE_INT);
$operationId = $body['operation_id'] ?? null;
if ($lotId === false || $lotId < 1 || $lotId > 10 || !in_array($days, MC_VILLAGE_RENTAL_DAYS, true) ||
    !is_string($operationId) || !preg_match('/\Avillage_rent_' . $lotId . '_' . $days . '_[a-f0-9]{32}\z/', $operationId)) {
    mc_json(['ok' => false, 'charged' => false, 'error' => 'Escolha um lote e um prazo de aluguel válidos.'], 400);
}

$pdo->beginTransaction();
try {
    // Serialize charges and rental requests from both tabs of the same account.
    $account = $pdo->prepare('SELECT myco_coins FROM mc_users WHERE id = ? FOR UPDATE');
    $account->execute([$userId]);
    $coins = (int)$account->fetchColumn();
    $seen = $pdo->prepare('SELECT 1 FROM mc_coin_operations WHERE user_id = ? AND operation_id = ?');
    $seen->execute([$userId, $operationId]);
    if (!$seen->fetchColumn()) {
        // Every lot has a seeded row, so even the first rental locks a real row.
        $lotQuery = $pdo->prepare('SELECT owner_id, expires_at, lease_epoch FROM mc_village_lots WHERE lot_id = ? FOR UPDATE');
        $lotQuery->execute([$lotId]);
        $lot = $lotQuery->fetch();
        if (!$lot) throw new InvalidArgumentException('Lote indisponível.');
        $now = time();
        $expires = (int)$lot['expires_at'];
        if ($expires > $now && (int)$lot['owner_id'] !== $userId) {
            throw new InvalidArgumentException('Este lote já está alugado.');
        }
        $other = $pdo->prepare('SELECT 1 FROM mc_village_lots WHERE owner_id = ? AND expires_at > ? AND lot_id <> ? LIMIT 1');
        $other->execute([$userId, $now, $lotId]);
        if ($other->fetchColumn()) throw new InvalidArgumentException('Cada conta pode alugar uma casa por vez.');
        $price = $days * MC_VILLAGE_DAILY_PRICE;
        if ($coins < $price) throw new InvalidArgumentException('MycoCoins insuficientes.');
        $nextExpiry = max($expires, $now) + $days * MC_VILLAGE_DAY_SECONDS;
        if ($nextExpiry > $now + MC_VILLAGE_MAX_DAYS * MC_VILLAGE_DAY_SECONDS) {
            throw new InvalidArgumentException('O aluguel pode ficar pago por até 30 dias.');
        }
        $leaseEpoch = $expires > $now ? (int)$lot['lease_epoch'] : $now;
        $pdo->prepare('UPDATE mc_village_lots SET owner_id = ?, expires_at = ?, lease_epoch = ? WHERE lot_id = ?')
            ->execute([$userId, $nextExpiry, $leaseEpoch, $lotId]);
        $pdo->prepare('UPDATE mc_users SET myco_coins = myco_coins - ? WHERE id = ?')->execute([$price, $userId]);
        $pdo->prepare('INSERT INTO mc_coin_operations (user_id, operation_id) VALUES (?, ?)')->execute([$userId, $operationId]);
        $coins -= $price;
    }
    $pdo->commit();
} catch (InvalidArgumentException $error) {
    $pdo->rollBack();
    mc_json(['ok' => false, 'charged' => false, 'error' => $error->getMessage()], 409);
} catch (Throwable $error) {
    $pdo->rollBack();
    error_log('[MycoCampus3D] village rent: ' . $error->getMessage());
    mc_json(['ok' => false, 'error' => 'Não foi possível confirmar o aluguel.'], 500);
}

mc_json(['ok' => true, 'myco_coins' => $coins] + mc_village_status($pdo, $userId));
