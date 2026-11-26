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
        'petri_clean', 'petri_clean_02', 'petri_clean_fridge',
        'petri_sterile_fridge_01', 'petri_sterile_fridge_02',
        'petri_contam', 'petri_empty',
        'pda_bottle', 'pda_bottle_02', 'pda_bottle_03', 'pda_media_bottle_1l',
        'spawn_jar', 'spawn_jar_colonized_02', 'spawn_jar_empty',
        'spawn_bag_empty', 'spawn_bag_colonized',
        'spawn_bag_colonized_02', 'spawn_bag_colonized_03', 'spawn_bag_colonized_04',
        'spawn_bag_pasteurized_01', 'spawn_bag_pasteurized_02',
        'liquid_culture', 'distilled_jug_5l',

        // === Equipamentos & Ferramentas de Lab ===
        'heat_sealer', 'magnetic_stirrer', 'precision_scale',
        'alcohol_spray', 'alcohol_spray_02', 'alcohol_spray_03', 'alcohol_spray_east_01',
        'water_spray_lab_01', 'water_spray_east_01', 'water_spray_greenhouse_01',
        'lc_nutrient_bottle_01',
        'h2o2_spray_lab',
        'paper_towel_01', 'paper_towel_02', 'paper_towel_east_01', 'lab_trash_01',
        'gloves_box_lab_01', 'gloves_box_lab_02',
        'burner_lab', 'gas_tripod_sub', 'infrared_thermometer', 'infrared_thermometer_02',
        'lab_tray_01', 'lab_tray_02', 'lab_tray_03',
        'syringe_10ml_a', 'syringe_10ml_b', 'syringe_10ml_c', 'syringe_10ml_d',
        'beaker_1l_a', 'beaker_1l_b', 'beaker_1l_03', 'beaker_1l_04',
        'pressure_cooker_lab', 'pressure_lid_lab', 'cooker_base_lab',
        'pressure_cooker_sub', 'pressure_lid_sub', 'cooker_base_sub',
        'culture_fridge_lab', 'laminar_hood_lab',
        'table_hood_lab', 'table_cooker_lab', 'table_lc_lab', 'table_sub_east', 'table_pack_east', 'table_emporio_east',
        'mixing_bowl_01', 'lab_spoon_01', 'scalpel_01', 'dehydrator_lab',
        'flocao_500g_01', 'flocao_500g_02', 'flocao_500g_03', 'flocao_500g_04',
        'alcohol_lamp_hood', 'alcohol_lamp_hood_02',
        'microscope_lab', 'microscope_lab_02',
        'silica_jar_01', 'silica_jar_02', 'silica_jar_03', 'silica_jar_04',
        'dried_batch_demo', 'dried_batch_demo_02',
        'dried_batch_east_01', 'dried_batch_east_02', 'dried_batch_east_03', 'dried_batch_east_04',
        'heat_sealer_east_01', 'heat_sealer_east_02', 'heat_sealer_east_03',
        'precision_scale_east',

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
        $items[] = "liquid_culture_empty_stock_$p";
    }
    foreach (range(1, 20) as $n) {
        $p = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
        $items[] = "syringe_10ml_$p";
        $items[] = "syringe_10ml_lab_$p";
    }
    foreach (range(1, 40) as $n) {
        $items[] = 'petri_bare_' . str_pad((string)$n, 2, '0', STR_PAD_LEFT);
    }
    foreach (range(1, 12) as $n) {
        $p = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
        $items[] = "pp5_cup_$p";
        $items[] = "scalpel_blade_$p";
        $items[] = "liquid_culture_empty_cab_$p";
        $items[] = "liquid_culture_$p";
        $items[] = "petri_empty_$p";
        $items[] = "petri_sterile_hood_$p";
    }
    foreach (range(1, 8) as $n) {
        $p = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
        $items[] = "scalpel_$p";
        $items[] = "lab_spoon_$p";
        $items[] = "mixing_bowl_$p";
        $items[] = "monotub_24l_$p";
        $items[] = "dehydrator_east_$p";
        $items[] = "delivery_crate_$p";
    }
    foreach (range(1, 16) as $n) {
        $p = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
        $items[] = "mushroom_pack_bag_$p";
    }
    foreach (range(1, 4) as $n) {
        $p = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
        $items[] = "substrate_grain_$p";
        $items[] = "substrate_wheat_$p";
        $items[] = "substrate_sorghum_$p";
        $items[] = "substrate_sawdust_$p";
        $items[] = "substrate_vermiculite_$p";
        $items[] = "substrate_coco_$p";
        $items[] = "micropore_$p";
        $items[] = "micropore_lab_$p";
        $items[] = "parafilm_lab_$p";
        $items[] = "beaker_1l_lab_$p";
        $items[] = "pda_bottle_lab_$p";
        $items[] = "alcohol_spray_lab_$p";
        $items[] = "paper_towel_lab_$p";
        $items[] = "falcon_15ml_$p";
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
 * Aceita itens fixos da whitelist, cogumelos colhidos (wild_picked_*) ou itens dinâmicos do Admin (dyn_*).
 */
function mp_is_allowed_item_id(string $itemId): bool {
    if (in_array($itemId, MP_ITEMS, true)) return true;
    if (preg_match('/^wild_picked_[a-z0-9_]{2,40}$/', $itemId)) return true;
    if (preg_match('/^(?:harvest_tub_|harvest_gh_|dried_batch_|spent_cake_|organic_basket_)[a-z0-9_]{2,40}$/', $itemId)) return true;
    if (preg_match('/^vial_?[35]ml_[a-z0-9_]{2,40}$/', $itemId)) return true;
    return (bool)preg_match('/^dyn_[a-z0-9_]{2,56}$/', $itemId);
}

/**
 * Sanitiza o JSON de estado interno de cada objeto interativo antes de salvar no MySQL.
 */
function mp_clean_culture_origin($origin): string {
    return in_array($origin, ['monospore', 'tissue_clone', 'hybrid'], true) ? $origin : '';
}

function mp_clean_item_state(string $itemId, $raw): ?string {
    if (!is_array($raw)) return null;
    $clean = [];
    $isDyn = strpos($itemId, 'dyn_') === 0;

    if (array_key_exists('crateCargo', $raw)) {
        $cargo = $raw['crateCargo'];
        if ($cargo === null) {
            $clean['crateCargo'] = null;
        } elseif (is_array($cargo) && isset($cargo['id'], $cargo['slot']) &&
            is_string($cargo['id']) && $cargo['id'] !== $itemId && mp_is_allowed_item_id($cargo['id']) &&
            (strpos($cargo['id'], 'delivery_crate_') === 0 || strpos($cargo['id'], 'dyn_') === 0) &&
            is_int($cargo['slot']) && $cargo['slot'] >= 0 && $cargo['slot'] <= 8) {
            $clean['crateCargo'] = ['id' => $cargo['id'], 'slot' => $cargo['slot']];
        }
    }

    $hasItemState = $isDyn || strpos($itemId, 'spawn_') === 0 || strpos($itemId, 'pp5_cup_') === 0 ||
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

    $validContamKinds = ['trichoderma', 'cobweb', 'wet_spot', 'penicillium', 'aspergillus', 'lipstick'];
    $isSpawn = strpos($itemId, 'spawn_') === 0 || strpos($itemId, 'pp5_cup_') === 0 || ($isDyn && isset($raw['spawn']));
    if ($isSpawn && isset($raw['spawn']) && is_array($raw['spawn'])) {
        $src = $raw['spawn'];
        $spawn = [];
        foreach (['filled', 'sterilized', 'pasteurized', 'pasteurizedOnly', 'shaken', 'hydrated', 'foilWrapped', 'microporeSealed', 'lidOpen', 'sealed', 'inoculated', 'colonized', 'contaminated', 'burned', 'expired', 'refrigerated'] as $key) {
            if (array_key_exists($key, $src) && is_bool($src[$key])) $spawn[$key] = $src[$key];
        }
        foreach (['fillGrams' => 5000, 'waterMl' => 5000, 'sterilizeProgress' => 100, 'colonization' => 100, 'ageGameDays' => 1000, 'shelfLifeAgeDays' => 1000, 'g2gUses' => 3] as $key => $limit) {
            if (array_key_exists($key, $src) && is_numeric($src[$key]) && is_finite((float)$src[$key])) {
                $spawn[$key] = max(0, min($limit, round((float)$src[$key], 2)));
            }
        }
        if (array_key_exists('tempC', $src) && is_numeric($src['tempC']) && is_finite((float)$src['tempC'])) {
            $spawn['tempC'] = max(-20, min(140, round((float)$src['tempC'], 1)));
        }
        if (isset($src['generation']) && is_numeric($src['generation'])) {
            $spawn['generation'] = max(0, min(5, (int)$src['generation']));
        }
        if (isset($src['contamKind']) && is_string($src['contamKind']) && in_array($src['contamKind'], $validContamKinds, true)) {
            $spawn['contamKind'] = $src['contamKind'];
        }
        $validSubstrates = ['grain', 'sorghum', 'wheat', 'coco_verm', 'sawdust', 'flocao', 'corn'];
        if (strpos($itemId, 'pp5_cup_') === 0 || $isDyn) $validSubstrates[] = 'pda';
        if (in_array($src['substrateKind'] ?? '', $validSubstrates, true)) {
            $spawn['substrateKind'] = $src['substrateKind'];
        }
        if (isset($src['speciesName']) && is_string($src['speciesName'])) {
            $spawn['speciesName'] = substr($src['speciesName'], 0, 80);
        }
        if (isset($raw['spawn']['origin'])) $spawn['origin'] = mp_clean_culture_origin($raw['spawn']['origin']);
        if ($spawn) $clean['spawn'] = $spawn;
    }

    if ((strpos($itemId, 'petri_') === 0 || ($isDyn && isset($raw['petri']))) && isset($raw['petri']) && is_array($raw['petri'])) {
        $p = $raw['petri'];
        $cleanPetri = [];
        if (in_array($p['mode'] ?? '', ['bare', 'filled', 'empty', 'clean', 'contam', 'colonizing', 'spore_print'], true)) {
            $cleanPetri['mode'] = $p['mode'];
        }
        if (isset($p['contamKind']) && is_string($p['contamKind']) && in_array($p['contamKind'], $validContamKinds, true)) {
            $cleanPetri['contamKind'] = $p['contamKind'];
        }
        foreach (['lidOpen', 'sterilized', 'inoculated', 'expired', 'parafilmSealed', 'microporeSealed', 'sporeContaminated', 'refrigerated'] as $boolKey) {
            if (isset($p[$boolKey]) && is_bool($p[$boolKey])) {
                $cleanPetri[$boolKey] = $p[$boolKey];
            }
        }
        if (isset($p['inoculationMethod']) && is_string($p['inoculationMethod'])) {
            $cleanPetri['inoculationMethod'] = substr($p['inoculationMethod'], 0, 32);
        }
        if (isset($p['speciesName']) && is_string($p['speciesName'])) {
            $cleanPetri['speciesName'] = substr($p['speciesName'], 0, 80);
        }
        if (isset($p['hybridMutant']) && is_string($p['hybridMutant']) && in_array($p['hybridMutant'], ['', 'gold', 'albino'], true)) {
            $cleanPetri['hybridMutant'] = $p['hybridMutant'];
        }
        if (isset($p['generation']) && is_numeric($p['generation'])) {
            $cleanPetri['generation'] = max(0, min(5, (int)$p['generation']));
        }
        foreach (['colonization' => 100, 'ageGameDays' => 1000, 'shelfLifeAgeDays' => 1000, 'cutWedges' => 4, 'delayedContamAtPct' => 100] as $numKey => $maxVal) {
            if (isset($p[$numKey]) && is_numeric($p[$numKey]) && is_finite((float)$p[$numKey])) {
                $cleanPetri[$numKey] = max(0, min($maxVal, round((float)$p[$numKey], 2)));
            }
        }
        if (isset($p['tempC']) && is_numeric($p['tempC']) && is_finite((float)$p['tempC'])) {
            $cleanPetri['tempC'] = max(-20, min(140, round((float)$p['tempC'], 1)));
        }
        if (isset($raw['petri']['origin'])) $cleanPetri['origin'] = mp_clean_culture_origin($raw['petri']['origin']);
        if ($cleanPetri) $clean['petri'] = $cleanPetri;
    }

    if ((strpos($itemId, 'liquid_culture') === 0 || strpos($itemId, 'beaker_1l_') === 0 ||
        strpos($itemId, 'distilled_jug_') === 0 ||
        strpos($itemId, 'falcon_') === 0 || strpos($itemId, 'pda_media_bottle_') === 0 ||
        strpos($itemId, 'pp5_cup_') === 0 || ($isDyn && isset($raw['liquid']))) &&
        isset($raw['liquid']) && is_array($raw['liquid']) &&
        isset($raw['liquid']['volMl']) && is_numeric($raw['liquid']['volMl']) && is_finite((float)$raw['liquid']['volMl'])) {
        $maxVolumeMl = strpos($itemId, 'pp5_cup_') === 0 ? 100 : 5000;
        $liq = ['volMl' => max(0, min($maxVolumeMl, round((float)$raw['liquid']['volMl'], 1)))];
        if (isset($raw['liquid']['sterilized']) && is_bool($raw['liquid']['sterilized'])) {
            $liq['sterilized'] = $raw['liquid']['sterilized'];
        }
        $clean['liquid'] = $liq;
    }
    if (isset($raw['sterilized']) && is_bool($raw['sterilized'])) {
        $clean['sterilized'] = $raw['sterilized'];
    }
    if (isset($raw['foilWrapped']) && is_bool($raw['foilWrapped'])) {
        $clean['foilWrapped'] = $raw['foilWrapped'];
    }
    if (isset($raw['microporeSealed']) && is_bool($raw['microporeSealed'])) {
        $clean['microporeSealed'] = $raw['microporeSealed'];
    }

    if ((strpos($itemId, 'liquid_culture') === 0 || strpos($itemId, 'falcon_') === 0 || ($isDyn && isset($raw['culture']))) &&
        isset($raw['culture']) && is_array($raw['culture'])) {
        $src = $raw['culture'];
        $culture = [];
        foreach (['inoculated', 'colonized', 'contaminated', 'expired', 'refrigerated', 'hasNutrient', 'sterilized', 'foilWrapped'] as $key) {
            if (isset($src[$key]) && is_bool($src[$key])) $culture[$key] = $src[$key];
        }
        foreach (['colonization' => 100, 'ageGameDays' => 1000, 'shelfLifeAgeDays' => 1000] as $key => $limit) {
            if (isset($src[$key]) && is_numeric($src[$key]) && is_finite((float)$src[$key])) {
                $culture[$key] = max(0, min($limit, round((float)$src[$key], 2)));
            }
        }
        if (isset($src['tempC']) && is_numeric($src['tempC']) && is_finite((float)$src['tempC'])) {
            $culture['tempC'] = max(-20, min(140, round((float)$src['tempC'], 1)));
        }
        if (isset($src['speciesName']) && is_string($src['speciesName'])) {
            $culture['speciesName'] = substr($src['speciesName'], 0, 80);
        }
        if (isset($src['contamKind']) && is_string($src['contamKind']) && in_array($src['contamKind'], $validContamKinds, true)) {
            $culture['contamKind'] = $src['contamKind'];
        }
        if (isset($src['generation']) && is_numeric($src['generation'])) {
            $culture['generation'] = max(0, min(3, (int)$src['generation']));
        }
        if (isset($raw['culture']['origin'])) $culture['origin'] = mp_clean_culture_origin($raw['culture']['origin']);
        if ($culture) $clean['culture'] = $culture;
    }

    if ((strpos($itemId, 'beaker_1l_') === 0 || strpos($itemId, 'falcon_') === 0 ||
        strpos($itemId, 'pda_media_bottle_') === 0 || strpos($itemId, 'pp5_cup_') === 0) &&
        isset($raw['pdaMedium']) && is_array($raw['pdaMedium'])) {
        $src = $raw['pdaMedium'];
        $medium = [];
        foreach (['mixed', 'sterilized', 'burned', 'refrigerated'] as $key) {
            if (isset($src[$key]) && is_bool($src[$key])) $medium[$key] = $src[$key];
        }
        if (isset($src['tempC']) && is_numeric($src['tempC']) && is_finite((float)$src['tempC'])) {
            $medium['tempC'] = max(-20, min(140, round((float)$src['tempC'], 1)));
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

    if ((strpos($itemId, 'syringe_10ml_') === 0 || $isDyn) && isset($raw['syringe']) && is_array($raw['syringe']) &&
        isset($raw['syringe']['volMl']) && is_numeric($raw['syringe']['volMl']) && is_finite((float)$raw['syringe']['volMl'])) {
        $syr = ['volMl' => max(0, min(10, round((float)$raw['syringe']['volMl'], 1)))];
        if (isset($raw['syringe']['sourceContam']) && is_bool($raw['syringe']['sourceContam'])) {
            $syr['sourceContam'] = $raw['syringe']['sourceContam'];
        }
        if (isset($raw['syringe']['refrigerated']) && is_bool($raw['syringe']['refrigerated'])) {
            $syr['refrigerated'] = $raw['syringe']['refrigerated'];
        }
        if (isset($raw['syringe']['tempC']) && is_numeric($raw['syringe']['tempC']) && is_finite((float)$raw['syringe']['tempC'])) {
            $syr['tempC'] = max(-20, min(140, round((float)$raw['syringe']['tempC'], 1)));
        }
        if (isset($raw['syringe']['speciesName']) && is_string($raw['syringe']['speciesName'])) {
            $syr['speciesName'] = substr($raw['syringe']['speciesName'], 0, 80);
        }
        if (array_key_exists('generation', $raw['syringe'])) {
            $generation = $raw['syringe']['generation'];
            if ($generation === null || (is_numeric($generation) && is_finite((float)$generation))) {
                $syr['generation'] = $generation === null ? null : max(0, min(5, (int)$generation));
            }
        }
        if (isset($raw['syringe']['mix']) && is_array($raw['syringe']['mix'])) {
            $mix = [];
            foreach (['waterMl', 'distilledMl', 'lcMl', 'pdaMl'] as $mk) {
                $mv = $raw['syringe']['mix'][$mk] ?? 0;
                if (is_numeric($mv) && is_finite((float)$mv)) {
                    $mix[$mk] = max(0, min(10, round((float)$mv, 1)));
                }
            }
            $syr['mix'] = $mix;
        }
        if (isset($raw['syringe']['origin'])) $syr['origin'] = mp_clean_culture_origin($raw['syringe']['origin']);
        $clean['syringe'] = $syr;
    }

    if (isset($raw['liquidMix']) && is_array($raw['liquidMix'])) {
        $lm = [];
        foreach (['waterMl', 'distilledMl', 'lcMl', 'pdaMl'] as $mk) {
            $mv = $raw['liquidMix'][$mk] ?? 0;
            if (is_numeric($mv) && is_finite((float)$mv)) {
                $lm[$mk] = max(0, min(5000, round((float)$mv, 1)));
            }
        }
        if ($lm) $clean['liquidMix'] = $lm;
    }

    if (strpos($itemId, 'mixing_bowl_') === 0 && isset($raw['bowl']) && is_array($raw['bowl'])) {
        $src = $raw['bowl'];
        $bowl = [];
        if (isset($src['ingredients']) && is_array($src['ingredients'])) {
            $ingredients = [];
            foreach (['flocao', 'water', 'corn', 'wheat', 'sorghum', 'vermiculite', 'coco', 'sawdust'] as $key) {
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
        foreach (['hasBlade', 'sterile', 'hasMycelium', 'bladeContaminated', 'cutContaminated'] as $key) {
            if (isset($raw['scalpel'][$key]) && is_bool($raw['scalpel'][$key])) $scalpel[$key] = $raw['scalpel'][$key];
        }
        if (isset($raw['scalpel']['bladeRemainingMs']) && is_numeric($raw['scalpel']['bladeRemainingMs']) && is_finite((float)$raw['scalpel']['bladeRemainingMs'])) {
            $scalpel['bladeRemainingMs'] = max(0, min(160000, (int)round((float)$raw['scalpel']['bladeRemainingMs'])));
        }
        if (isset($raw['scalpel']['origin'])) $scalpel['origin'] = mp_clean_culture_origin($raw['scalpel']['origin']);
        foreach (['isSporeSample', 'biopsyAseptic'] as $key) {
            if (isset($raw['scalpel'][$key]) && is_bool($raw['scalpel'][$key])) $scalpel[$key] = $raw['scalpel'][$key];
        }
        if (isset($raw['scalpel']['cutGeneration']) && is_numeric($raw['scalpel']['cutGeneration'])) {
            $scalpel['cutGeneration'] = max(0, min(3, (int)$raw['scalpel']['cutGeneration']));
        }
        if (isset($raw['scalpel']['biopsySpecies']) && is_string($raw['scalpel']['biopsySpecies'])) {
            $scalpel['biopsySpecies'] = mb_substr($raw['scalpel']['biopsySpecies'], 0, 80);
        }
        if ($scalpel) $clean['scalpel'] = $scalpel;
    }

    if (strpos($itemId, 'scalpel_blade_') === 0 && isset($raw['bladePack']) && is_array($raw['bladePack'])) {
        if (isset($raw['bladePack']['empty']) && is_bool($raw['bladePack']['empty'])) {
            $clean['bladePack'] = ['empty' => $raw['bladePack']['empty']];
        }
    }

    if ((strpos($itemId, 'wild_picked_') === 0 || strpos($itemId, 'harvest_tub_') === 0 || strpos($itemId, 'harvest_gh_') === 0) &&
        isset($raw['wildMushroom']) && is_array($raw['wildMushroom'])) {
        $wm = [];
        if (isset($raw['wildMushroom']['speciesName']) && is_string($raw['wildMushroom']['speciesName'])) {
            $wm['speciesName'] = substr($raw['wildMushroom']['speciesName'], 0, 80);
        }
        if (isset($raw['wildMushroom']['isMagic']) && is_bool($raw['wildMushroom']['isMagic'])) {
            $wm['isMagic'] = $raw['wildMushroom']['isMagic'];
        }
        if (isset($raw['wildMushroom']['grams']) && is_numeric($raw['wildMushroom']['grams'])) {
            $wm['grams'] = max(1, min(200, (int)round((float)$raw['wildMushroom']['grams'])));
        }
        if (isset($raw['wildMushroom']['removed']) && is_bool($raw['wildMushroom']['removed'])) {
            $wm['removed'] = $raw['wildMushroom']['removed'];
        }
        if ($wm) $clean['wildMushroom'] = $wm;
    }

    if (isset($raw['sanitizedRemainingSec']) && is_numeric($raw['sanitizedRemainingSec']) && is_finite((float)$raw['sanitizedRemainingSec'])) {
        $clean['sanitizedRemainingSec'] = max(0, min(300, (int)round((float)$raw['sanitizedRemainingSec'])));
    }

    if (strpos($itemId, 'pressure_cooker_') === 0 && isset($raw['cooker']) && is_array($raw['cooker'])) {
        $src = $raw['cooker'];
        $cooker = [];
        if (isset($src['waterMl']) && is_numeric($src['waterMl']) && is_finite((float)$src['waterMl'])) {
            $cooker['waterMl'] = max(0, min(20000, (int)round((float)$src['waterMl'])));
        }
        if (in_array($src['mode'] ?? '', ['sterilize', 'pasteurize'], true)) $cooker['mode'] = $src['mode'];
        foreach (['temp' => 200, 'psi' => 25, 'progress' => 100, 'overheatTimer' => 3600, 'grainGrams' => 5000, 'grainCookSec' => 3600] as $key => $limit) {
            if (isset($src[$key]) && is_numeric($src[$key]) && is_finite((float)$src[$key])) {
                $cooker[$key] = max(0, min($limit, (float)$src[$key]));
            }
        }
        foreach (['sterilized', 'burned', 'grainAlDente', 'hasBase'] as $key) {
            if (isset($src[$key]) && is_bool($src[$key])) $cooker[$key] = $src[$key];
        }
        if (isset($src['contents']) && is_array($src['contents'])) {
            $contents = [];
            foreach (array_slice($src['contents'], 0, 6) as $contentId) {
                if (is_string($contentId) && mp_is_allowed_item_id($contentId)) $contents[] = $contentId;
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

    if (isset($raw['customTag']) && is_string($raw['customTag'])) {
        $clean['customTag'] = trim(mb_substr($raw['customTag'], 0, 32, 'UTF-8'));
    }

    if (isset($raw['custom']) && is_array($raw['custom'])) {
        if (array_key_exists('grow', $raw['custom'])) {
            $grow = $raw['custom']['grow'];
            unset($raw['custom']['grow']);
            if ($isDyn && is_array($grow)) {
                $validGrow = [];
                foreach (['auto', 'led', 'humidifier', 'exhaust', 'mistOn', 'fanOn'] as $key) {
                    if (isset($grow[$key]) && is_bool($grow[$key])) $validGrow[$key] = $grow[$key];
                }
                if (isset($grow['slots']) && is_array($grow['slots'])) {
                    $validGrow['slots'] = array_fill(0, 9, null);
                    $nowMs = (int)round(microtime(true) * 1000);
                    for ($i = 0; $i < 9; $i++) {
                        $slot = $grow['slots'][$i] ?? null;
                        if (!is_array($slot) || !is_string($slot['species'] ?? null) || trim($slot['species']) === '') continue;
                        if (!is_numeric($slot['started'] ?? null) || !is_numeric($slot['duration'] ?? null)) continue;
                        $validGrow['slots'][$i] = [
                            'species' => mb_substr(trim($slot['species']), 0, 80, 'UTF-8'),
                            'flush' => max(1, min(4, is_numeric($slot['flush'] ?? null) ? (int)$slot['flush'] : 1)),
                            'started' => max(0, min($nowMs, (int)$slot['started'])),
                            'duration' => max(89000, min(162000, (int)$slot['duration'])),
                            'spent' => ($slot['spent'] ?? false) === true
                        ];
                    }
                }
                $raw['custom']['grow'] = $validGrow;
            }
        }
        $customJson = json_encode($raw['custom'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (is_string($customJson) && strlen($customJson) <= 16384) {
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
        'auditorium_slide', 'cooker_mode_lab', 'cooker_mode_sub',
        'ball_soccer', 'ball_basket',
        'greenhouse_auto', 'greenhouse_hum', 'greenhouse_co2', 'greenhouse_temp',
        'greenhouse_target_hum', 'greenhouse_target_co2', 'greenhouse_target_temp',
        'greenhouse_humidifier', 'greenhouse_exhaust', 'greenhouse_cooler', 'greenhouse_light',
        'stand_packs', 'stand_sold',
        'garden_compost', 'garden_richness', 'garden_harvested', 'garden_baskets', 'garden_plants',
        'burner_timer_preset_lab', 'burner_timer_end_lab',
        'burner_timer_preset_sub', 'burner_timer_end_sub',
        'sport_soccer_goals', 'sport_basket_points', 'sport_basket_streak'
    ], true)) {
        return true;
    }
    if (preg_match('/^(door_[0-3]|light_[0-7])$/', $k)) return true;
    if (preg_match('/^blind_([0-9]|1[0-5])$/', $k)) return true;
    if (preg_match('/^cab_[a-z0-9_]+$/', $k)) return true;
    if (preg_match('/\Awild_(?:[0-9]|[1-9][0-9]|1[0-2][0-9]|13[01]|poop_[0-5]_[0-9]{1,12})\z/', $k)) return true;
    if (preg_match('/^greenhouse_slot_([0-9]|1[0-9]|2[0-3])_(humidity|stage|empty|species|contam|origin)$/', $k)) return true;
    return false;
}
