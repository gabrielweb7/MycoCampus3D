<?php
declare(strict_types=1);

const MC_UFO_CYCLE_MS = 145000;
const MC_UFO_FLIGHT_MS = 36000;
const MC_UFO_HITS_TO_CRASH = 20;

function mc_ufo_flight_pose(int $cycle, int $ms): array {
    $progress = max(0, min(1, ($ms - $cycle * MC_UFO_CYCLE_MS) / MC_UFO_FLIGHT_MS));
    if ($cycle % 3 === 0) {
        $time = $progress * 36;
        if ($time < 11) {
            $approach = 1 - (1 - $time / 11) ** 2;
            return [127 - 53 * $approach, 30 - 18 * $approach, -39 + 41 * $approach];
        }
        if ($time < 17) return [74, 12, 2];
        $depart = ($time - 17) / 19;
        return [74 - 161 * $depart, 12 + 19 * sin($depart * M_PI * 0.5), 2 + 47 * $depart];
    }
    $side = $cycle % 2 ? 1 : -1;
    $line = ($cycle % 4 < 2) ? 35 : -35;
    return [
        $side * (-94 + 188 * $progress),
        25 + 2.4 * sin($progress * M_PI * 2),
        $line + sin($progress * M_PI) * 18,
    ];
}

function mc_ufo_intersects_shot(array $shot, array $pose): bool {
    [, , $x, $y, $z, $dx, $dy, $dz, $length] = $shot;
    [$ux, $uy, $uz] = $pose;
    $uy += 0.18;
    $last = min(42, $length + 0.55);
    for ($distance = 0; $distance <= $last;) {
        $drop = max(0, $distance - 12);
        $ox = ($x + $dx * $distance - $ux) / 3.1;
        $oy = ($y + $dy * $distance - 0.0012 * $drop * $drop - $uy) / 1.05;
        $oz = ($z + $dz * $distance - $uz) / 3.1;
        if ($ox * $ox + $oy * $oy + $oz * $oz <= 1) return true;
        if ($distance >= $last) break;
        $distance = min($last, $distance + 0.42);
    }
    return false;
}

function mc_sync_shared_ufo(PDO $pdo, int $now, array $shots, string $session): array {
    $cycle = intdiv($now, MC_UFO_CYCLE_MS);
    $start = $cycle * MC_UFO_CYCLE_MS;
    $candidates = [];
    foreach ($shots as $shot) {
        $firedAt = $shot[1] - 900;
        if ($firedAt >= $start && $firedAt < $start + MC_UFO_FLIGHT_MS &&
            mc_ufo_intersects_shot($shot, mc_ufo_flight_pose($cycle, $firedAt))) {
            $candidates[] = $shot[0];
        }
    }
    $read = $pdo->prepare('SELECT hit_count, last_hits, crash_at, crash_x, crash_y, crash_z FROM mc_ufo_flights WHERE cycle = ?');
    if ($candidates) {
        $pdo->beginTransaction();
        try {
            $pdo->prepare('INSERT IGNORE INTO mc_ufo_flights (cycle) VALUES (?)')->execute([$cycle]);
            $lock = $pdo->prepare('SELECT hit_count, last_hits, crash_at, crash_x, crash_y, crash_z FROM mc_ufo_flights WHERE cycle = ? FOR UPDATE');
            $lock->execute([$cycle]);
            $flight = $lock->fetch();
            if ($flight && !$flight['crash_at']) {
                $lastHits = json_decode((string)$flight['last_hits'], true) ?: [];
                $hits = (int)$flight['hit_count'];
                foreach ($candidates as $id) {
                    if ($id <= ($lastHits[$session] ?? 0)) continue;
                    $lastHits[$session] = $id;
                    $hits++;
                }
                if ($hits > (int)$flight['hit_count']) {
                    $crash = $hits >= MC_UFO_HITS_TO_CRASH ? $now : null;
                    $pose = $crash ? mc_ufo_flight_pose($cycle, $now) : [null, null, null];
                    $pdo->prepare('UPDATE mc_ufo_flights SET hit_count = ?, last_hits = ?, crash_at = ?,
                        crash_x = ?, crash_y = ?, crash_z = ? WHERE cycle = ?')
                        ->execute([min($hits, MC_UFO_HITS_TO_CRASH), json_encode($lastHits), $crash, ...$pose, $cycle]);
                    $pdo->prepare('DELETE FROM mc_ufo_flights WHERE cycle < ?')->execute([$cycle - 2]);
                }
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }
    $read->execute([$cycle]);
    $flight = $read->fetch() ?: [];
    $crash = (int)($flight['crash_at'] ?? 0);
    return [
        'cycle' => $cycle, 'now' => $now, 'start' => $start,
        'hits' => (int)($flight['hit_count'] ?? 0),
        'active' => $crash > 0 ? $now - $crash < 87000 : $now - $start < MC_UFO_FLIGHT_MS,
        'crash_at' => $crash,
        'crash_pos' => $crash ? [(float)$flight['crash_x'], (float)$flight['crash_y'], (float)$flight['crash_z']] : null,
    ];
}
