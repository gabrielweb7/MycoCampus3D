<?php
declare(strict_types=1);

function mc_skin_catalog(): array {
    static $catalog = null;
    if ($catalog === null) {
        $data = json_decode((string)file_get_contents(__DIR__ . '/../assets/avatar-skins.json'), true, 512, JSON_THROW_ON_ERROR);
        $catalog = array_column($data, null, 'id');
    }
    return $catalog;
}

function mc_skin_available(array $skin, string $role): bool {
    return empty($skin['faculty']) || in_array($role, ['professor', 'admin'], true);
}

function mc_owned_skins(array $row): array {
    $stored = json_decode((string)($row['unlocked_skins'] ?? ''), true);
    if (!is_array($stored)) $stored = [];
    $owned = [];
    foreach (mc_skin_catalog() as $id => $skin) {
        if (mc_skin_available($skin, (string)$row['role']) &&
            ((int)$skin['price'] === 0 || in_array($id, $stored, true))) {
            $owned[] = $id;
        }
    }
    return $owned;
}

function mc_active_skin(array $row): string {
    $skin = (string)($row['current_skin'] ?? '');
    $owned = mc_owned_skins($row);
    if (in_array($skin, $owned, true)) return $skin;
    return in_array('faculty', $owned, true) ? 'faculty' : 'campus';
}
