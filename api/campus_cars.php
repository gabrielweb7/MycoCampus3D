<?php
declare(strict_types=1);

const MC_CAR_SEAT_LEASE_MS = 7500;

function mp_sync_campus_car(PDO $pdo, $request, int $userId, string $session, float $x, float $z, int $now): ?array {
    if (!is_array($request)) return null;
    $id = $request['id'] ?? '';
    $seat = $request['seat'] ?? '';
    $op = $request['op'] ?? '';
    if (!is_string($id) || !mp_is_allowed_item_id($id) || !in_array($seat, ['driver', 'passenger'], true) ||
        !in_array($op, ['enter', 'leave', 'ride'], true)) return null;

    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare("SELECT c.* FROM mc_campus_cars c
            JOIN mc_world_layout_edits l ON l.item_id = c.item_id AND l.prefab_id = 'campus_pickup' AND l.removed = 0
            WHERE c.item_id = ? FOR UPDATE");
        $lock->execute([$id]);
        $car = $lock->fetch();
        if (!$car) {
            $pdo->commit();
            return ['id' => $id, 'seat' => '', 'error' => 'missing'];
        }

        $cleanup = $pdo->prepare('DELETE FROM mc_car_seats WHERE item_id = ? AND last_seen_ms < ?');
        $cleanup->execute([$id, $now - MC_CAR_SEAT_LEASE_MS]);
        $find = $pdo->prepare('SELECT seat, session_id FROM mc_car_seats WHERE item_id = ? AND seat = ?');
        $find->execute([$id, $seat]);
        $occupant = (string)$find->fetchColumn(1);
        $mySeat = $occupant === $session ? $seat : '';
        $error = '';
        if ($op === 'leave') {
            $release = $pdo->prepare('DELETE FROM mc_car_seats WHERE item_id = ? AND session_id = ?');
            $release->execute([$id, $session]);
            if ($mySeat === 'driver') {
                $pdo->prepare('UPDATE mc_campus_cars SET speed = 0, steer = 0 WHERE item_id = ?')->execute([$id]);
            }
            $mySeat = '';
        } elseif ($op === 'enter' && !$mySeat) {
            $side = $seat === 'driver' ? -1 : 1;
            $doorX = (float)$car['x'] + $side * 1.27 * cos((float)$car['yaw']);
            $doorZ = (float)$car['z'] - $side * 1.27 * sin((float)$car['yaw']);
            if ($seat === 'driver' && (int)$car['owner_id'] !== $userId) $error = 'owner';
            elseif ($occupant !== '' || ((int)$car['drive_seen_ms'] > $now - MC_CAR_SEAT_LEASE_MS && abs((float)$car['speed']) > 1.4)) $error = 'busy';
            elseif (hypot($x - $doorX, $z - $doorZ) > 3.15) $error = 'door';
            else {
                $claim = $pdo->prepare('INSERT IGNORE INTO mc_car_seats (session_id, item_id, seat, last_seen_ms) VALUES (?, ?, ?, ?)');
                $claim->execute([$session, $id, $seat, $now]);
                if ($claim->rowCount()) $mySeat = $seat;
                else $error = 'busy';
            }
        }

        if ($mySeat) {
            $renew = $pdo->prepare('UPDATE mc_car_seats SET last_seen_ms = ? WHERE session_id = ? AND item_id = ?');
            $renew->execute([$now, $session, $id]);
        }
        if ($mySeat === 'driver' && $op === 'ride' && is_array($request['pose'] ?? null)) {
            $pose = $request['pose'];
            $tx = mp_num($pose['x'] ?? $car['x'], MP_WORLD_LIMIT);
            $ty = mp_num($pose['y'] ?? $car['y'], 100);
            $tz = mp_num($pose['z'] ?? $car['z'], MP_WORLD_LIMIT);
            $yaw = mp_num($pose['yaw'] ?? $car['yaw'], 1000);
            $speed = mp_num($pose['speed'] ?? 0, 13);
            $steer = mp_num($pose['steer'] ?? 0, 1);
            $dt = min(2, max(0, ($now - (int)$car['drive_seen_ms']) / 1000));
            if (hypot($tx - (float)$car['x'], $tz - (float)$car['z']) <= 3 + $dt * 14 &&
                abs($ty - (float)$car['y']) <= 3 + $dt * 5) {
                $update = $pdo->prepare('UPDATE mc_campus_cars
                    SET x = ?, y = ?, z = ?, yaw = ?, speed = ?, steer = ?, lights = ?, drive_seen_ms = ? WHERE item_id = ?');
                $update->execute([$tx, $ty, $tz, $yaw, $speed, $steer, empty($pose['lights']) ? 0 : 1, $now, $id]);
            }
        }
        $pdo->commit();
        return ['id' => $id, 'seat' => $mySeat, 'error' => $error];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function mp_campus_car_snapshot(PDO $pdo, int $userId, int $now): array {
    $query = $pdo->prepare("SELECT c.*, d.session_id AS driver, p.session_id AS passenger
        FROM mc_campus_cars c JOIN mc_world_layout_edits l
          ON l.item_id = c.item_id AND l.prefab_id = 'campus_pickup' AND l.removed = 0
        LEFT JOIN mc_car_seats d ON d.item_id = c.item_id AND d.seat = 'driver' AND d.last_seen_ms >= ?
        LEFT JOIN mc_car_seats p ON p.item_id = c.item_id AND p.seat = 'passenger' AND p.last_seen_ms >= ?
        ORDER BY c.item_id LIMIT 70");
    $query->execute([$now - MC_CAR_SEAT_LEASE_MS, $now - MC_CAR_SEAT_LEASE_MS]);
    $cars = [];
    foreach ($query->fetchAll() as $car) {
        $cars[(string)$car['item_id']] = [
            'owned' => (int)$car['owner_id'] === $userId,
            'x' => (float)$car['x'], 'y' => (float)$car['y'], 'z' => (float)$car['z'],
            'yaw' => (float)$car['yaw'], 'lights' => (bool)$car['lights'],
            'speed' => $car['driver'] ? (float)$car['speed'] : 0,
            'steer' => $car['driver'] ? (float)$car['steer'] : 0,
            'driver' => $car['driver'] ? mp_public_id((string)$car['driver']) : '',
            'passenger' => $car['passenger'] ? mp_public_id((string)$car['passenger']) : '',
        ];
    }
    return $cars;
}
