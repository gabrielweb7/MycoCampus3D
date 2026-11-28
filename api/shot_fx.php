<?php
declare(strict_types=1);

/** Validate the short visual/audio snapshots attached to multiplayer poses. */
function mp_clean_shot_fx(array $shots, float $x, float $y, float $z, int $nowMs): array {
    $clean = [];
    foreach (array_slice($shots, 0, 8) as $shot) {
        if (!is_array($shot) || !array_is_list($shot) || count($shot) !== 9) continue;
        [$id, $age, $sx, $sy, $sz, $dx, $dy, $dz, $distance] = $shot;
        if (!is_int($id) || $id <= 0 || $id > 9007199254740991 || !is_int($age) || $age < 0 || $age > 850) continue;
        foreach ([$sx, $sy, $sz, $dx, $dy, $dz, $distance] as $value) {
            if ((!is_int($value) && !is_float($value)) || !is_finite((float)$value)) continue 2;
        }
        $norm = hypot(hypot($dx, $dy), $dz);
        if (hypot(hypot($sx - $x, $sy - $y), $sz - $z) > 8.0 ||
            $norm < 0.99 || $norm > 1.01 || $distance < 0 || $distance > 42.01) continue;
        $clean[$id] = [$id, $nowMs + 900 - $age, $sx, $sy, $sz, $dx, $dy, $dz, min(42, $distance)];
    }
    ksort($clean, SORT_NUMERIC);
    return array_values($clean);
}

function mp_visible_shot_fx(?string $stored, int $nowMs, float $x, float $y, float $z): array {
    if (!$stored) return [];
    $shots = json_decode($stored, true);
    if (!is_array($shots)) return [];
    $visible = [];
    foreach ($shots as [$id, $expires, $sx, $sy, $sz, $dx, $dy, $dz, $distance]) {
        if ($expires <= $nowMs || hypot(hypot($sx - $x, $sy - $y), $sz - $z) > 170) continue;
        $visible[] = [$id, $sx, $sy, $sz, $dx, $dy, $dz, $distance];
    }
    return $visible;
}
