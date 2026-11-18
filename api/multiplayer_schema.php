<?php
/**
 * MycoCampus3D - Registro de Itens, Regras de Sanitizacao e Chaves de Estado Multiplayer.
 *
 * Para adicionar um novo item ao jogo com replicacao multiplayer:
 *  1. Adicione o ID (ou serie numerada) em mp_build_allowed_items().
 *  2. Se o item possuir estado interno customizado, adicione seu sanitizador em mp_clean_item_state().
 *  3. Se for um dispositivo fixo de estado global (interruptor, porta, estufa), registre a chave em mp_is_valid_state_key().
 */
declare(strict_types=1);

function mp_build_allowed_items(): array {
    $items = [
        // === Culturas, Placas & Frascos Base ===
        'petri_clean', 'petri_contam', 'petri_empty',
        'pda_bottle', 'pda_bottle_02', 'pda_bottle_03', 'pda_media_bottle_1l',
        'spawn_jar', 'spawn_jar_empty', 'spawn_bag_empty', 'spawn_bag_colonized',
        'liquid_culture', 'distilled_jug_5l',

        // === Equipamentos & Ferramentas de Lab ===
        'heat_sealer', 'magnetic_stirrer', 'precision_scale',
        'alcohol_spray', 'alcohol_spray_02', 'alcohol_spray_03',
        'paper_towel_01', 'paper_towel_02', 'lab_trash_01',
        'burner_lab', 'gas_tripod_sub', 'infrared_thermometer',
        'lab_tray_01', 'lab_tray_02', 'lab_tray_03',
        'syringe_10ml_a', 'syringe_10ml_b',
        'beaker_1l_a', 'beaker_1l_b', 'beaker_1l_03', 'beaker_1l_04',
        'pressure_cooker_lab', 'pressure_lid_lab', 'cooker_base_lab',
        'pressure_cooker_sub', 'pressure_lid_sub', 'cooker_base_sub',
        'culture_fridge_lab', 'laminar_hood_lab',
        'table_hood_lab', 'table_cooker_lab', 'table_lc_lab', 'table_sub_east',
        'mixing_bowl_01', 'lab_spoon_01', 'scalpel_01',
        'flocao_500g_01', 'flocao_500g_02',

        // === Lousas & Acessórios ===
        'chalk_white', 'chalk_green', 'chalk_yellow', 'board_eraser',
        'chalk_white_1', 'chalk_green_1', 'chalk_yellow_1', 'board_eraser_1',
        'chalk_white_2', 'chalk_green_2', 'chalk_yellow_2', 'board_eraser_2',
        'chalk_white_3', 'chalk_green_3', 'chalk_yellow_3', 'board_eraser_3',
    ];

    // Series numeradas geradas dinamicamente
    foreach (range(1, 15) as $n) {
        $p = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
        $items[] = "spawn_bag_empty_$p";
        $items[] = "spawn_jar_empty_$p";
    }
    foreach (range(1, 20) as $n) {
        $items[] = 'syringe_10ml_' . str_pad((string)$n, 2, '0', STR_PAD_LEFT);
    }
    foreach (range(1, 40) as $n) {
        $items[] = 'petri_bare_' . str_pad((string)$n, 2, '0', STR_PAD_LEFT);
    }
    foreach (range(1, 4) as $n) {
        $p = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
        $items[] = "substrate_grain_$p";
        $items[] = "substrate_sawdust_$p";
        $items[] = "micropore_$p";
        $items[] = "scalpel_blade_$p";
        $items[] = "falcon_15ml_$p";
    }
    foreach (range(1, 8) as $n) {
        $items[] = 'pp5_cup_' . str_pad((string)$n, 2, '0', STR_PAD_LEFT);
    }
    foreach (range(1, 2) as $n) {
        $items[] = 'falcon_50ml_' . str_pad((string)$n, 2, '0', STR_PAD_LEFT);
    }
    foreach (range(1, 3) as $n) {
        $p = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
        $items[] = "gloves_box_$p";
        $items[] = "foil_roll_$p";
        $items[] = "parafilm_$p";
    }

    return $items;
}

define('MP_ITEMS', mp_build_allowed_items());

/**
 * Aceita itens fixos da whitelist ou itens dinâmicos criados no Modo Admin Editor (dyn_<prefab>_<id>).
 */
function mp_is_allowed_item_id(string $itemId): bool {
    if (in_array($itemId, MP_ITEMS, true)) return true;
    return (bool)preg_match('/^dyn_[a-z0-9_]{2,56}$/', $itemId);
}

/**
 * Sanitiza o JSON de estado interno de cada objeto interativo antes de salvar no MySQL.
 */
function mp_clean_item_state(string $itemId, $raw): ?string {
    if (!is_array($raw)) return null;
    $clean = [];

    $hasItemState = strpos($itemId, 'spawn_') === 0 || strpos($itemId, 'pp5_cup_') === 0 ||
        strpos($itemId, 'petri_') === 0 ||
        strpos($itemId, 'pda_bottle') === 0 || strpos($itemId, 'pda_media_bottle_') === 0 ||
        strpos($itemId, 'liquid_culture') === 0 || strpos($itemId, 'beaker_1l_') === 0 ||
        strpos($itemId, 'distilled_jug_') === 0 || strpos($itemId, 'culture_fridge_') === 0 ||
        strpos($itemId, 'falcon_') === 0 || strpos($itemId, 'syringe_10ml_') === 0 ||
        strpos($itemId, 'mixing_bowl_') === 0 || strpos($itemId, 'scalpel_') === 0;
    if ($hasItemState && array_key_exists('containerId', $raw) && is_string($raw['containerId']) &&
        ($raw['containerId'] === '' || in_array($raw['containerId'], ['pressure_cooker_lab', 'pressure_cooker_sub'], true))) {
        $clean['containerId'] = $raw['containerId'];
    }

    $isSpawn = strpos($itemId, 'spawn_') === 0 || strpos($itemId, 'pp5_cup_') === 0;
    if ($isSpawn && isset($raw['spawn']) && is_array($raw['spawn'])) {
        $src = $raw['spawn'];
        $spawn = [];
        foreach (['filled', 'sterilized', 'sealed', 'inoculated', 'colonized', 'contaminated', 'burned', 'expired'] as $key) {
            if (array_key_exists($key, $src) && is_bool($src[$key])) $spawn[$key] = $src[$key];
        }
        foreach (['fillGrams' => 5000, 'waterMl' => 5000, 'sterilizeProgress' => 100, 'colonization' => 100, 'ageGameDays' => 365, 'shelfLifeAgeDays' => 365] as $key => $limit) {
            if (array_key_exists($key, $src) && is_numeric($src[$key]) && is_finite((float)$src[$key])) {
                $spawn[$key] = max(0, min($limit, round((float)$src[$key], 2)));
            }
        }
        $validSubstrates = ['grain', 'sawdust', 'flocao', 'corn'];
        if (strpos($itemId, 'pp5_cup_') === 0) $validSubstrates[] = 'pda';
        if (in_array($src['substrateKind'] ?? '', $validSubstrates, true)) {
            $spawn['substrateKind'] = $src['substrateKind'];
        }
        if ($spawn) $clean['spawn'] = $spawn;
    }

    if (strpos($itemId, 'petri_') === 0 && isset($raw['petri']) && is_array($raw['petri'])) {
        $p = $raw['petri'];
        $cleanPetri = [];
        if (in_array($p['mode'] ?? '', ['bare', 'filled', 'empty', 'clean', 'contam', 'colonizing'], true)) {
            $cleanPetri['mode'] = $p['mode'];
        }
        foreach (['lidOpen', 'sterilized', 'inoculated', 'expired', 'parafilmSealed'] as $boolKey) {
            if (isset($p[$boolKey]) && is_bool($p[$boolKey])) {
                $cleanPetri[$boolKey] = $p[$boolKey];
            }
        }
        if (isset($p['inoculationMethod']) && is_string($p['inoculationMethod'])) {
            $cleanPetri['inoculationMethod'] = substr($p['inoculationMethod'], 0, 32);
        }
        foreach (['colonization' => 100, 'ageGameDays' => 365, 'shelfLifeAgeDays' => 365] as $numKey => $maxVal) {
            if (isset($p[$numKey]) && is_numeric($p[$numKey]) && is_finite((float)$p[$numKey])) {
                $cleanPetri[$numKey] = max(0, min($maxVal, round((float)$p[$numKey], 2)));
            }
        }
        if ($cleanPetri) $clean['petri'] = $cleanPetri;
    }

    if ((strpos($itemId, 'liquid_culture') === 0 || strpos($itemId, 'beaker_1l_') === 0 ||
        strpos($itemId, 'distilled_jug_') === 0 ||
        strpos($itemId, 'falcon_') === 0 || strpos($itemId, 'pda_media_bottle_') === 0 ||
        strpos($itemId, 'pp5_cup_') === 0) &&
        isset($raw['liquid']) && is_array($raw['liquid']) &&
        isset($raw['liquid']['volMl']) && is_numeric($raw['liquid']['volMl']) && is_finite((float)$raw['liquid']['volMl'])) {
        $maxVolumeMl = strpos($itemId, 'pp5_cup_') === 0 ? 100 : 5000;
        $clean['liquid'] = ['volMl' => max(0, min($maxVolumeMl, (int)round((float)$raw['liquid']['volMl'])))];
    }

    if (strpos($itemId, 'liquid_culture') === 0 && isset($raw['culture']) && is_array($raw['culture'])) {
        $src = $raw['culture'];
        $culture = [];
        foreach (['colonized', 'contaminated', 'expired'] as $key) {
            if (isset($src[$key]) && is_bool($src[$key])) $culture[$key] = $src[$key];
        }
        foreach (['ageGameDays' => 365, 'shelfLifeAgeDays' => 365] as $key => $limit) {
            if (isset($src[$key]) && is_numeric($src[$key]) && is_finite((float)$src[$key])) {
                $culture[$key] = max(0, min($limit, round((float)$src[$key], 2)));
            }
        }
        if ($culture) $clean['culture'] = $culture;
    }

    if ((strpos($itemId, 'beaker_1l_') === 0 || strpos($itemId, 'falcon_') === 0 ||
        strpos($itemId, 'pda_media_bottle_') === 0 || strpos($itemId, 'pp5_cup_') === 0) &&
        isset($raw['pdaMedium']) && is_array($raw['pdaMedium'])) {
        $src = $raw['pdaMedium'];
        $medium = [];
        foreach (['mixed', 'sterilized', 'burned'] as $key) {
            if (isset($src[$key]) && is_bool($src[$key])) $medium[$key] = $src[$key];
        }
        foreach (['powderGrams' => 500, 'stirProgress' => 4] as $key => $limit) {
            if ($key === 'powderGrams' && strpos($itemId, 'pp5_cup_') === 0) $limit = 4;
            if (isset($src[$key]) && is_numeric($src[$key]) && is_finite((float)$src[$key])) {
                $medium[$key] = max(0, min($limit, round((float)$src[$key], 1)));
            }
        }
        if ($medium) $clean['pdaMedium'] = $medium;
    }

    if (strpos($itemId, 'pda_bottle') === 0 && isset($raw['pdaReagent']) &&
        is_array($raw['pdaReagent']) && isset($raw['pdaReagent']['remainingGrams']) &&
        is_numeric($raw['pdaReagent']['remainingGrams']) &&
        is_finite((float)$raw['pdaReagent']['remainingGrams'])) {
        $clean['pdaReagent'] = [
            'remainingGrams' => max(0, min(500, (int)round((float)$raw['pdaReagent']['remainingGrams'])))
        ];
    }

    if (strpos($itemId, 'syringe_10ml_') === 0 && isset($raw['syringe']) && is_array($raw['syringe']) &&
        isset($raw['syringe']['volMl']) && is_numeric($raw['syringe']['volMl']) && is_finite((float)$raw['syringe']['volMl'])) {
        $clean['syringe'] = ['volMl' => max(0, min(10, round((float)$raw['syringe']['volMl'], 1)))];
    }

    if (strpos($itemId, 'mixing_bowl_') === 0 && isset($raw['bowl']) && is_array($raw['bowl'])) {
        $src = $raw['bowl'];
        $bowl = [];
        if (isset($src['ingredients']) && is_array($src['ingredients'])) {
            $ingredients = [];
            foreach (['flocao', 'water', 'corn', 'sawdust'] as $key) {
                $value = $src['ingredients'][$key] ?? 0;
                if (is_numeric($value) && is_finite((float)$value)) {
                    $ingredients[$key] = max(0, min(5000, (int)round((float)$value)));
                }
            }
            $bowl['ingredients'] = $ingredients;
        }
        if (isset($src['mixed']) && is_bool($src['mixed'])) $bowl['mixed'] = $src['mixed'];
        if (isset($src['stirCount']) && is_numeric($src['stirCount'])) {
            $bowl['stirCount'] = max(0, min(3, (int)$src['stirCount']));
        }
        if ($bowl) $clean['bowl'] = $bowl;
    }

    if (strpos($itemId, 'scalpel_') === 0 && isset($raw['scalpel']) && is_array($raw['scalpel'])) {
        $scalpel = [];
        foreach (['hasBlade', 'sterile', 'hasMycelium'] as $key) {
            if (isset($raw['scalpel'][$key]) && is_bool($raw['scalpel'][$key])) $scalpel[$key] = $raw['scalpel'][$key];
        }
        if ($scalpel) $clean['scalpel'] = $scalpel;
    }

    if (strpos($itemId, 'pressure_cooker_') === 0 && isset($raw['cooker']) && is_array($raw['cooker'])) {
        $src = $raw['cooker'];
        $cooker = [];
        if (isset($src['waterMl']) && is_numeric($src['waterMl']) && is_finite((float)$src['waterMl'])) {
            $cooker['waterMl'] = max(0, min(20000, (int)round((float)$src['waterMl'])));
        }
        if (in_array($src['mode'] ?? '', ['sterilize', 'pasteurize'], true)) $cooker['mode'] = $src['mode'];
        foreach (['temp' => 200, 'psi' => 25, 'progress' => 100, 'overheatTimer' => 3600] as $key => $limit) {
            if (isset($src[$key]) && is_numeric($src[$key]) && is_finite((float)$src[$key])) {
                $cooker[$key] = max(0, min($limit, (float)$src[$key]));
            }
        }
        foreach (['sterilized', 'burned'] as $key) {
            if (isset($src[$key]) && is_bool($src[$key])) $cooker[$key] = $src[$key];
        }
        if (isset($src['contents']) && is_array($src['contents'])) {
            $contents = [];
            foreach (array_slice($src['contents'], 0, 6) as $contentId) {
                if (is_string($contentId) && in_array($contentId, MP_ITEMS, true)) $contents[] = $contentId;
            }
            $cooker['contents'] = array_values(array_unique($contents));
        }
        if ($cooker) $clean['cooker'] = $cooker;
    }

    if (strpos($itemId, 'culture_fridge_') === 0 && isset($raw['fridge']) && is_array($raw['fridge'])) {
        if (isset($raw['fridge']['doorOpen']) && is_bool($raw['fridge']['doorOpen'])) {
            $clean['fridge'] = ['doorOpen' => $raw['fridge']['doorOpen']];
        }
    }

    if (isset($raw['custom']) && is_array($raw['custom'])) {
        $customJson = json_encode($raw['custom'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (is_string($customJson) && strlen($customJson) <= 2048) {
            $clean['custom'] = $raw['custom'];
        }
    }

    if (!$clean) return null;
    $encoded = json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return is_string($encoded) ? $encoded : null;
}

/**
 * Valida chaves de estado global do campus/laboratorio.
 */
function mp_is_valid_state_key(string $k): bool {
    if (in_array($k, [
        'hood_lab', 'hood_sanitized_until', 'stir_lab',
        'burner_lab', 'burner_level_lab',
        'gas_tripod_sub', 'gas_tripod_sub_level', 'gas_tripod_level_sub',
        'culture_fridge_lab', 'cinema_power', 'cinema_playing', 'cinema_lesson',
        'auditorium_slide', 'cooker_mode_lab', 'cooker_mode_sub'
    ], true)) {
        return true;
    }
    if (preg_match('/^(door_[0-3]|light_[0-7])$/', $k)) return true;
    if (preg_match('/^blind_([0-9]|1[0-5])$/', $k)) return true;
    if (preg_match('/^cab_[a-z0-9_]+$/', $k)) return true;
    if (preg_match('/^wild_([0-9]|[12][0-9]|3[01])$/', $k)) return true;
    if (preg_match('/^greenhouse_slot_[0-3]_(humidity|stage)$/', $k)) return true;
    return false;
}
