<?php
declare(strict_types=1);

/** Keep the five columns and two rows aligned with js/core/village-layout.js. */
function mc_village_lot_at(float $x, float $z): ?int {
    $row = $z >= 44 && $z <= 64 ? 0 : ($z >= 74 && $z <= 94 ? 5 : null);
    if ($row === null) return null;
    $column = (int)round($x / 26) + 2;
    if ($column < 0 || $column > 4 || abs($x - ($column - 2) * 26) > 11) return null;
    return $row + $column + 1;
}

function mc_village_read_lot(PDO $pdo, int $lotId): ?array {
    $query = $pdo->prepare('SELECT owner_id, expires_at, lease_epoch FROM mc_village_lots WHERE lot_id = ? LOCK IN SHARE MODE');
    $query->execute([$lotId]);
    return $query->fetch() ?: null;
}

function mc_village_has_lease(?array $lot, int $userId, int $now): bool {
    return $lot && (int)$lot['owner_id'] === $userId && (int)$lot['expires_at'] > $now;
}

function mc_village_item_rows(PDO $pdo, array $itemIds): array {
    $itemIds = array_values(array_unique(array_filter($itemIds, static fn($id) => is_string($id) && str_starts_with($id, 'dyn_shop_'))));
    if (!$itemIds) return [];
    $placeholders = implode(',', array_fill(0, count($itemIds), '?'));
    $query = $pdo->prepare("SELECT i.item_id, i.owner_id, i.lot_id, i.lease_epoch, s.item_id IS NOT NULL AS on_sale
        FROM mc_village_items i LEFT JOIN mc_village_sales s ON s.item_id = i.item_id WHERE i.item_id IN ($placeholders) LOCK IN SHARE MODE");
    $query->execute($itemIds);
    $rows = [];
    foreach ($query as $item) $rows[$item['item_id']] = $item;
    return $rows;
}

function mc_village_item_active(array $item, ?array $lot, int $now): bool {
    return $item['lot_id'] === null || (mc_village_has_lease($lot, (int)$item['owner_id'], $now) &&
        (int)$lot['lease_epoch'] === (int)$item['lease_epoch']);
}

// Used in delta snapshots. Stored items retain every database row and are
// marked removed in the client's layout until the owner withdraws them.
const MC_VILLAGE_ITEM_JOINS = ' LEFT JOIN mc_village_items vi ON vi.item_id = w.item_id LEFT JOIN mc_village_lots vl ON vl.lot_id = vi.lot_id ';
const MC_VILLAGE_ITEM_VISIBLE = '(vi.lot_id IS NULL OR (vl.owner_id = vi.owner_id AND vl.lease_epoch = vi.lease_epoch AND vl.expires_at > UNIX_TIMESTAMP()))';

function mc_village_layout_version(PDO $pdo, int $now): string {
    $active = $pdo->prepare('SELECT lot_id, lease_epoch FROM mc_village_lots WHERE expires_at > ? ORDER BY lot_id');
    $active->execute([$now]);
    return substr(hash('sha256', json_encode($active->fetchAll())), 0, 12);
}

function mc_village_sale_position(int $lotId): array {
    $front = $lotId <= 5 ? 1 : -1;
    return [((($lotId - 1) % 5) - 2) * 26 + $front * 4.6, $front === 1 ? 62.48 : 75.52];
}

function mc_village_offer(PDO $pdo, string $itemId, int $ownerId, int $lotId, float $x, float $y, float $z, int $now, ?string $state): void {
    [$benchX, $benchZ] = mc_village_sale_position($lotId);
    if (abs($x - $benchX) > 1.02 || abs($z - $benchZ) > 0.49 || abs($y - 0.89) > 0.14) return;
    $query = $pdo->prepare("SELECT l.prefab_id, st.state_json FROM mc_world_layout_edits l
        LEFT JOIN mc_world_item_states st ON st.item_id = l.item_id WHERE l.item_id = ? AND l.removed = 0");
    $query->execute([$itemId]);
    $row = $query->fetch();
    if (!$row || $row['prefab_id'] !== 'mylar_bag') return;
    $custom = json_decode($state ?? (string)($row['state_json'] ?? ''), true)['custom'] ?? [];
    if (empty($custom['filled']) || empty($custom['sealed']) || !empty($custom['removed'])) return;
    $grams = (int)($custom['grams'] ?? 0);
    if (!in_array($grams, [10, 25], true)) return;
    $wave = $pdo->prepare('SELECT MAX(pickup_at) FROM mc_village_sales WHERE lot_id = ? AND paid = 0');
    $wave->execute([$lotId]);
    $eta = max($now + 23, (int)$wave->fetchColumn());
    $pdo->prepare('INSERT IGNORE INTO mc_village_sales (item_id, owner_id, lot_id, pickup_at, price) VALUES (?, ?, ?, ?, ?)')
        ->execute([$itemId, $ownerId, $lotId, $eta, $grams * 12]);
    $pdo->prepare('UPDATE mc_world_layout_edits SET updated_at = NOW(6) WHERE item_id = ?')->execute([$itemId]);
}

/** The sale is settled against its real pickup time even if the owner is away. */
function mc_village_settle_sales(PDO $pdo, ?int $ownerId = null): void {
    $now = time();
    $query = $pdo->prepare('SELECT item_id, owner_id FROM mc_village_sales WHERE paid = 0 AND pickup_at <= ?' .
        ($ownerId !== null ? ' AND owner_id = ?' : '') . ' ORDER BY pickup_at LIMIT 12');
    $query->execute($ownerId !== null ? [$now, $ownerId] : [$now]);
    $due = $query->fetchAll();
    foreach ($due as $sale) {
        $pdo->beginTransaction();
        try {
            $lock = $pdo->prepare('SELECT id FROM mc_users WHERE id = ? FOR UPDATE');
            $lock->execute([(int)$sale['owner_id']]);
            $lock->fetchColumn();
            $update = $pdo->prepare('UPDATE mc_village_sales SET paid = 1 WHERE item_id = ? AND paid = 0');
            $update->execute([$sale['item_id']]);
            if ($update->rowCount() === 1) {
                $pdo->prepare('UPDATE mc_users u JOIN mc_village_sales s ON s.owner_id = u.id SET u.myco_coins = LEAST(999999, u.myco_coins + s.price) WHERE s.item_id = ?')
                    ->execute([$sale['item_id']]);
                $pdo->prepare('UPDATE mc_world_layout_edits SET removed = 1 WHERE item_id = ?')->execute([$sale['item_id']]);
                $pdo->prepare('DELETE FROM mc_world_objects WHERE item_id = ?')->execute([$sale['item_id']]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }
}
