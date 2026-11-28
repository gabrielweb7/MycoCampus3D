<?php
/**
 * MycoCampus3D - Autenticacao (Nome + PIN), progresso, ranking e painel Master Admin.
 * Todo progresso fica no MySQL e e calculado no servidor (o cliente nao define XP).
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/village_store.php';
require_once __DIR__ . '/multiplayer_schema.php';
require_once __DIR__ . '/avatar_skins.php';

const MC_XP_HARVEST = 25;
const MC_XP_MODULE = 50;
const MC_XP_LAB_QUEST = 100;
const MC_LAB_QUEST_SLUG = 'lab_practica_v1';
const MC_HARVEST_COOLDOWN_MS = 1200;
const MC_MODULES = ['fluxo_laminar', 'esterilizacao', 'spawn_graos', 'contaminacao', 'frutificacao'];
const MC_MODULE_ANSWERS = [
    'fluxo_laminar' => 'Nunca bloquear a linha reta entre o filtro HEPA e o material estéril',
    'esterilizacao' => '121°C a 15 PSI (1 atm acima da pressão ambiente)',
    'spawn_graos' => 'Para confirmar que o micélio está puro e sem contaminação invisível',
    'contaminacao' => 'Manter fechado e remover do laboratório para não espalhar esporos',
    'frutificacao' => 'Troca gasosa fresca (redução de CO2), evaporação na superfície e luz ambiente',
];
const MC_LOGIN_MAX_FAILS = 12;
const MC_LOGIN_LOCK_MINUTES = 1;
const MC_ADMIN_USERNAMES = ['gabrieldaluz'];

const MC_COSMETIC_HATS = [
    'default' => [
        'id' => 'default',
        'name' => 'Cogumelo Vermelho Clássico',
        'desc' => 'O clássico Amanita com pintas brancas.',
        'req_xp' => 0,
        'req_mushrooms' => 0,
        'icon' => '🍄',
    ],
    'golden_shroom' => [
        'id' => 'golden_shroom',
        'name' => 'Cogumelo Dourado Radiante',
        'desc' => 'Dourado brilhante com esferas cintilantes.',
        'req_xp' => 200,
        'req_mushrooms' => 5,
        'icon' => '👑',
    ],
    'wizard_hood' => [
        'id' => 'wizard_hood',
        'name' => 'Capuz de Alquimista',
        'desc' => 'Cone pontudo com runas de micologia.',
        'req_xp' => 350,
        'req_mushrooms' => 10,
        'icon' => '🧙‍♂️',
    ],
    'grad_cap' => [
        'id' => 'grad_cap',
        'name' => 'Capelo Universitário',
        'desc' => 'Chapéu acadêmico de formatura com borla dourada.',
        'req_xp' => 500,
        'req_mushrooms' => 15,
        'icon' => '🎓',
    ],
    'flower_crown' => [
        'id' => 'flower_crown',
        'name' => 'Coroa de Flores Silvestres',
        'desc' => 'Grinalda botânica com pétalas da floresta.',
        'req_xp' => 150,
        'req_mushrooms' => 3,
        'icon' => '🌸',
    ],
    'beret' => [
        'id' => 'beret',
        'name' => 'Boina de Pesquisador',
        'desc' => 'Estilo elegante de cientista micologista.',
        'req_xp' => 100,
        'req_mushrooms' => 2,
        'icon' => '🎨',
    ],
];

const MC_COSMETIC_TOYS = [
    'skateboard' => [
        'id' => 'skateboard',
        'req_xp' => 60,
        'req_mushrooms' => 1,
        'price_coins' => 90,
    ],
    'snowboard' => [
        'id' => 'snowboard',
        'category' => 'toy',
        'name' => 'Snowboard Pro MycoRide',
        'desc' => 'Desça as montanhas com física real, carving e visão nos pés!',
        'req_xp' => 100,
        'req_mushrooms' => 2,
        'icon' => '🏂',
    ],
    'paraglider' => [
        'id' => 'paraglider',
        'category' => 'toy',
        'name' => 'Paraglider MycoWing',
        'desc' => 'Salte das montanhas, pegue correntes térmicas e voe pelo campus!',
        'req_xp' => 150,
        'req_mushrooms' => 3,
        'icon' => '🪂',
    ],
];

/** Pet state is only changed by the authenticated pet action, never by sync_progress. */
function mc_clean_pet_state($raw): array {
    if (!is_array($raw)) $raw = [];
    $owned = [];
    foreach (is_array($raw['owned'] ?? null) ? $raw['owned'] : [] as $id) {
        if (is_string($id) && in_array($id, MC_PETS, true) && !in_array($id, $owned, true)) $owned[] = $id;
    }
    $selected = is_string($raw['selected'] ?? null) && in_array($raw['selected'], $owned, true) ? $raw['selected'] : '';
    $bowls = [];
    foreach (['food', 'water'] as $kind) {
        $b = is_array($raw['bowls'][$kind] ?? null) ? $raw['bowls'][$kind] : [];
        $pos = mc_clean_pet_position($b['pos'] ?? null);
        $bowls[$kind] = ['owned' => !empty($b['owned']), 'pos' => $pos, 'full' => !empty($b['owned']) && !empty($b['full'])];
    }
    $nextFood = [];
    $nextWater = [];
    $rawFood = is_array($raw['next_food'] ?? null) ? $raw['next_food'] : [];
    $rawWater = is_array($raw['next_water'] ?? null) ? $raw['next_water'] : [];
    foreach ($owned as $id) {
        $nextFood[$id] = max(0, (int)($rawFood[$id] ?? 0));
        $nextWater[$id] = max(0, (int)($rawWater[$id] ?? 0));
    }
    $mode = $raw['mode'] ?? 'follow';
    $anchor = $mode === 'stay' ? mc_clean_pet_position($raw['anchor'] ?? null) : null;
    return [
        'owned' => $owned, 'selected' => $selected,
        'revision' => max(0, (int)($raw['revision'] ?? 0)),
        'mode' => $anchor ? 'stay' : ($mode === 'roam' ? 'roam' : 'follow'),
        'anchor' => $anchor,
        'bowls' => $bowls, 'cat_food' => max(0, min(999, (int)($raw['cat_food'] ?? 0))),
        'next_food' => $nextFood, 'next_water' => $nextWater,
    ];
}

const MC_SHOP_SUPPLIES = [
    'sup_pp5' => ['prefab_id' => 'pp5_cup', 'price_coins' => 30, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_ak47' => ['prefab_id' => 'ak47', 'price_coins' => 1300, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_syringe' => ['prefab_id' => 'syringe_10ml', 'price_coins' => 40, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_water_spray' => ['prefab_id' => 'water_spray', 'price_coins' => 35, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_lc_nutrient' => ['prefab_id' => 'lc_nutrient_bottle', 'price_coins' => 40, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_petri' => ['prefab_id' => 'petri_empty', 'price_coins' => 45, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_mylar' => ['prefab_id' => 'mylar_bag', 'price_coins' => 45, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_h2o2' => ['prefab_id' => 'h2o2_spray', 'price_coins' => 45, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_flocao' => ['prefab_id' => 'flocao_500g', 'price_coins' => 50, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_spray' => ['prefab_id' => 'alcohol_spray', 'price_coins' => 60, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_spawn_jar' => ['prefab_id' => 'spawn_jar', 'price_coins' => 70, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_spawn_bag' => ['prefab_id' => 'spawn_bag', 'price_coins' => 85, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_lc' => ['prefab_id' => 'liquid_culture', 'price_coins' => 90, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_glass_bottle_1l' => ['prefab_id' => 'pda_media_bottle', 'price_coins' => 80, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_crate' => ['prefab_id' => 'delivery_crate', 'price_coins' => 110, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_silica' => ['prefab_id' => 'silica_jar', 'price_coins' => 140, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_grow_tent' => ['prefab_id' => 'grow_tent', 'price_coins' => 620, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_grow_humidifier' => ['prefab_id' => 'grow_humidifier', 'price_coins' => 150, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_grow_exhaust' => ['prefab_id' => 'grow_exhaust', 'price_coins' => 170, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_flower_seeds' => ['prefab_id' => 'flower_seeds', 'price_coins' => 25, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_bee_bait' => ['prefab_id' => 'bee_bait', 'price_coins' => 75, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_beehive' => ['prefab_id' => 'beehive_starter', 'price_coins' => 180, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_pet_bowl' => ['prefab_id' => 'pet_food_bowl', 'price_coins' => 45, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_dog_food' => ['prefab_id' => 'dog_food_bag', 'price_coins' => 30, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_cat_food' => ['prefab_id' => 'cat_food_bag', 'price_coins' => 30, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_monotub' => ['prefab_id' => 'monotub_24l', 'price_coins' => 260, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_table' => ['prefab_id' => 'table_stainless', 'price_coins' => 320, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_dehydrator' => ['prefab_id' => 'dehydrator', 'price_coins' => 380, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_ampoule_case' => ['prefab_id' => 'ampoule_case', 'price_coins' => 1000, 'req_xp' => 1000, 'req_mushrooms' => 100],
    'sup_beaker_1l' => ['prefab_id' => 'beaker_1l', 'price_coins' => 75, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_vial_3ml' => ['prefab_id' => 'vial_3ml', 'price_coins' => 30, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_falcon_15ml' => ['prefab_id' => 'falcon_15ml', 'price_coins' => 35, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_falcon_50ml' => ['prefab_id' => 'falcon_50ml', 'price_coins' => 45, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_falcon_rack' => ['prefab_id' => 'falcon_rack', 'price_coins' => 65, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_petri_bare' => ['prefab_id' => 'petri_bare', 'price_coins' => 25, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_distilled_jug' => ['prefab_id' => 'distilled_jug', 'price_coins' => 75, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_mixing_bowl' => ['prefab_id' => 'mixing_bowl', 'price_coins' => 65, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_lab_spoon' => ['prefab_id' => 'lab_spoon', 'price_coins' => 20, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_lab_tray' => ['prefab_id' => 'lab_tray', 'price_coins' => 85, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_scalpel' => ['prefab_id' => 'scalpel', 'price_coins' => 65, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_scalpel_blade' => ['prefab_id' => 'scalpel_blade', 'price_coins' => 20, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_pda_bottle' => ['prefab_id' => 'pda_bottle', 'price_coins' => 80, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_substrate_grain' => ['prefab_id' => 'substrate_grain', 'price_coins' => 110, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_substrate_wheat' => ['prefab_id' => 'substrate_wheat', 'price_coins' => 110, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_substrate_sorghum' => ['prefab_id' => 'substrate_sorghum', 'price_coins' => 115, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_substrate_coco' => ['prefab_id' => 'substrate_coco', 'price_coins' => 95, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_substrate_vermiculite' => ['prefab_id' => 'substrate_vermiculite', 'price_coins' => 95, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_substrate_sawdust' => ['prefab_id' => 'substrate_sawdust', 'price_coins' => 100, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_paper_towel' => ['prefab_id' => 'paper_towel', 'price_coins' => 20, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_gloves_box' => ['prefab_id' => 'gloves_box', 'price_coins' => 35, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_foil_roll' => ['prefab_id' => 'foil_roll', 'price_coins' => 30, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_micropore' => ['prefab_id' => 'micropore', 'price_coins' => 30, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_parafilm' => ['prefab_id' => 'parafilm', 'price_coins' => 35, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_lab_trash' => ['prefab_id' => 'lab_trash', 'price_coins' => 90, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_magnetic_stirrer' => ['prefab_id' => 'magnetic_stirrer', 'price_coins' => 210, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_infrared_thermometer' => ['prefab_id' => 'infrared_thermometer', 'price_coins' => 150, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_precision_scale' => ['prefab_id' => 'precision_scale', 'price_coins' => 180, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_lab_microscope' => ['prefab_id' => 'lab_microscope', 'price_coins' => 350, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_alcohol_lamp' => ['prefab_id' => 'alcohol_lamp', 'price_coins' => 90, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_culture_fridge' => ['prefab_id' => 'culture_fridge', 'price_coins' => 480, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_heat_sealer' => ['prefab_id' => 'heat_sealer', 'price_coins' => 230, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_cooker_base' => ['prefab_id' => 'cooker_base', 'price_coins' => 65, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_electric_burner' => ['prefab_id' => 'electric_burner', 'price_coins' => 230, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_gas_tripod' => ['prefab_id' => 'gas_tripod', 'price_coins' => 270, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_pressure_cooker' => ['prefab_id' => 'pressure_cooker', 'price_coins' => 360, 'req_xp' => 0, 'req_mushrooms' => 0],
    'sup_laminar_hood' => ['prefab_id' => 'laminar_hood', 'price_coins' => 580, 'req_xp' => 0, 'req_mushrooms' => 0],
];

const MC_LAB_QUEST_KEYS = [
    'sanitize_hood', 'hood_on', 'cooker_heat', 'syringe_use',
    'greenhouse_care', 'monotub_harvest', 'dry_pack', 'sell_pack',
];

function mc_clean_progress($raw): array {
    if (is_string($raw)) {
        $raw = json_decode($raw, true);
    }
    if (!is_array($raw)) {
        $raw = [];
    }
    $species = [];
    if (!empty($raw['discovered_species']) && is_array($raw['discovered_species'])) {
        foreach (array_slice($raw['discovered_species'], 0, 120) as $sp) {
            if (!is_string($sp)) continue;
            $s = trim(mb_substr($sp, 0, 96, 'UTF-8'));
            if ($s !== '' && !in_array($s, $species, true)) {
                $species[] = $s;
            }
        }
    }
    $milestones = [];
    if (!empty($raw['micoteca_milestones']) && is_array($raw['micoteca_milestones'])) {
        foreach ($raw['micoteca_milestones'] as $m) {
            $val = (int)$m;
            if (in_array($val, [10, 25, 50, 75, 100], true) && !in_array($val, $milestones, true)) {
                $milestones[] = $val;
            }
        }
        sort($milestones);
    }
    $questSteps = [];
    if (!empty($raw['lab_quest_steps']) && is_array($raw['lab_quest_steps'])) {
        foreach ($raw['lab_quest_steps'] as $k) {
            if (is_string($k) && in_array($k, MC_LAB_QUEST_KEYS, true) && !in_array($k, $questSteps, true)) {
                $questSteps[] = $k;
            }
        }
    }
    $equippedToy = '';
    if (isset($raw['equipped_toy']) && is_string($raw['equipped_toy']) &&
        in_array($raw['equipped_toy'], ['', 'skateboard', 'snowboard', 'paraglider'], true)) {
        $equippedToy = $raw['equipped_toy'];
    }
    return [
        'discovered_species' => $species,
        'micoteca_milestones' => $milestones,
        'lab_quest_steps' => $questSteps,
        'lab_tutorial_done' => !empty($raw['lab_tutorial_done']),
        'equipped_toy' => $equippedToy,
        'pets' => mc_clean_pet_state($raw['pets'] ?? null),
    ];
}

function mc_clean_username(string $raw): string {
    $s = mb_strtolower(trim($raw), 'UTF-8');
    $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
    $s = preg_replace('/[^a-z0-9._-]/', '', $ascii !== false ? $ascii : $s);
    return substr((string)$s, 0, 40);
}

function mc_format_user(array $row): array {
    $modules = [];
    if (!empty($row['completed_modules'])) {
        $decoded = json_decode((string)$row['completed_modules'], true);
        if (is_array($decoded)) {
            $modules = array_values(array_unique(array_map('strval', $decoded)));
        }
    }
    $unlockedHats = ['default'];
    if (!empty($row['unlocked_hats'])) {
        $decHats = json_decode((string)$row['unlocked_hats'], true);
        if (is_array($decHats)) {
            foreach ($decHats as $h) {
                if (is_string($h) && (isset(MC_COSMETIC_HATS[$h]) || isset(MC_COSMETIC_TOYS[$h])) && !in_array($h, $unlockedHats, true)) {
                    $unlockedHats[] = $h;
                }
            }
        }
    }
    $currentHat = (string)($row['current_hat'] ?? 'default');
    if ($currentHat !== 'none' && !isset(MC_COSMETIC_HATS[$currentHat])) {
        $currentHat = 'default';
    }
    return [
        'id' => (int)$row['id'],
        'username' => (string)$row['username'],
        'display_name' => (string)$row['display_name'],
        'role' => (string)$row['role'],
        'hat_color' => mc_clean_hex($row['hat_color'] ?? '', '#dc2626'),
        'body_color' => mc_clean_hex($row['body_color'] ?? '', '#4f46e5'),
        'xp' => (int)$row['xp'],
        'mushrooms_harvested' => (int)$row['mushrooms_harvested'],
        'myco_coins' => isset($row['myco_coins']) ? (int)$row['myco_coins'] : 250,
        'completed_modules' => $modules,
        'unlocked_hats' => $unlockedHats,
        'current_hat' => $currentHat,
        'unlocked_skins' => mc_owned_skins($row),
        'current_skin' => mc_active_skin($row),
        'progress' => mc_clean_progress($row['progress_json'] ?? null),
    ];
}

function mc_fetch_user(PDO $pdo, int $id): array {
    $st = $pdo->prepare('SELECT * FROM mc_users WHERE id = ? LIMIT 1');
    $st->execute([$id]);
    return $st->fetch() ?: [];
}

$pdo = mc_db_or_fail();
$body = mc_body();
$action = mc_action('leaderboard');

function mc_require_post(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        mc_json(['ok' => false, 'error' => 'Método HTTP inválido. Use POST.'], 405);
    }
}

if ($action === 'version') {
    $ver = trim((string)@file_get_contents(__DIR__ . '/../VERSION'));
    mc_json(['ok' => true, 'version' => $ver]);
}

if ($action === 'login' || $action === 'register_or_login') {
    mc_require_post();
    $displayName = trim((string)($body['display_name'] ?? ''));
    $displayName = mb_substr((string)preg_replace('/\s+/u', ' ', $displayName), 0, 48, 'UTF-8');
    $pin = trim((string)($body['pin'] ?? ''));
    $profKey = trim((string)($body['professor_key'] ?? ''));
    $hatColor = mc_clean_hex($body['hat_color'] ?? '', '#dc2626');
    $bodyColor = mc_clean_hex($body['body_color'] ?? '', '#4f46e5');

    if (mb_strlen($displayName, 'UTF-8') < 2) {
        mc_json(['ok' => false, 'error' => 'Informe um nome com pelo menos 2 caracteres.'], 400);
    }
    if (strlen($pin) < 4 || strlen($pin) > 20) {
        mc_json(['ok' => false, 'error' => 'Use uma senha de 4 a 20 caracteres.'], 400);
    }

    $username = mc_clean_username($displayName);
    if (strlen($username) < 2) {
        $username = 'user_' . substr(md5($displayName), 0, 8);
    }

    $isOwnerAdmin = in_array($username, MC_ADMIN_USERNAMES, true);
    $isProfKeyValid = defined('PROFESSOR_KEY') && PROFESSOR_KEY !== '' && $profKey !== '' && hash_equals(PROFESSOR_KEY, $profKey);

    $stmt = $pdo->prepare('SELECT * FROM mc_users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user) {
        $lockedUntil = $user['login_locked_until'] ?? null;
        if (!$isOwnerAdmin && $lockedUntil !== null && strtotime((string)$lockedUntil) > time()) {
            mc_json(['ok' => false, 'error' => 'Muitas tentativas erradas. Aguarde 1 minuto e tente de novo.'], 429);
        }
        if (!password_verify($pin, (string)$user['pin_hash'])) {
            $fails = (int)($user['login_fails'] ?? 0) + 1;
            if ($fails >= MC_LOGIN_MAX_FAILS) {
                $lock = $pdo->prepare('UPDATE mc_users SET login_fails = 0, login_locked_until = (NOW() + INTERVAL ' . MC_LOGIN_LOCK_MINUTES . ' MINUTE) WHERE id = ?');
                $lock->execute([(int)$user['id']]);
            } else {
                $f = $pdo->prepare('UPDATE mc_users SET login_fails = ? WHERE id = ?');
                $f->execute([$fails, (int)$user['id']]);
            }
            mc_json(['ok' => false, 'error' => 'Esse nome já está cadastrado com outra senha.'], 401);
        }
        // Determina o cargo atualizado: Dono sempre admin, chave valida vira professor
        if ($isOwnerAdmin) {
            $newRole = 'admin';
        } elseif ($isProfKeyValid) {
            $newRole = 'professor';
        } else {
            $newRole = (string)$user['role'];
        }

        $upd = $pdo->prepare('UPDATE mc_users SET display_name = ?, role = ?, hat_color = ?, body_color = ?, login_fails = 0, login_locked_until = NULL, last_seen = NOW() WHERE id = ?');
        $upd->execute([$displayName, $newRole, $hatColor, $bodyColor, (int)$user['id']]);
        $userId = (int)$user['id'];
        $created = false;
    } else {
        if ($isOwnerAdmin) {
            $role = 'admin';
        } elseif ($isProfKeyValid) {
            $role = 'professor';
        } else {
            $role = 'student';
        }

        try {
            $ins = $pdo->prepare('INSERT INTO mc_users (username, display_name, role, pin_hash, hat_color, body_color, xp, mushrooms_harvested, myco_coins, completed_modules, progress_json) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 250, ?, ?)');
            $ins->execute([$username, $displayName, $role, password_hash($pin, PASSWORD_DEFAULT), $hatColor, $bodyColor, '[]', '{}']);
            $userId = (int)$pdo->lastInsertId();
            $created = true;
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                mc_json(['ok' => false, 'error' => 'Esse nome acabou de ser cadastrado. Tente entrar com sua senha.'], 409);
            }
            throw $e;
        }
    }

    mc_village_settle_sales($pdo, $userId);
    $token = mc_issue_token($pdo, $userId);
    mc_json(['ok' => true, 'created' => $created, 'token' => $token, 'user' => mc_format_user(mc_fetch_user($pdo, $userId))]);
}

if ($action === 'logout') {
    mc_require_post();
    $token = (string)($body['token'] ?? $_COOKIE['mc_token'] ?? '');
    if (preg_match('/^[a-f0-9]{64}$/', $token)) {
        $del = $pdo->prepare('DELETE FROM mc_auth_tokens WHERE token_hash = ?');
        $del->execute([hash('sha256', $token)]);
    }
    mc_clear_auth_cookie();
    mc_json(['ok' => true]);
}

if ($action === 'me') {
    $user = mc_require_user($pdo);
    mc_village_settle_sales($pdo, (int)$user['id']);
    mc_json(['ok' => true, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'harvest') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $mushId = trim((string)($body['mushroom_id'] ?? ''));
    if ($mushId !== '' && (!str_starts_with($mushId, 'wild_') || !mp_is_valid_state_key($mushId))) {
        mc_json(['ok' => false, 'error' => 'Cogumelo inválido.'], 400);
    }
    $isPoopCubensis = strpos($mushId, 'wild_poop_') === 0;
    $xpReward = $isPoopCubensis ? 40 : MC_XP_HARVEST;
    $specimen = $body['specimen'] ?? null;
    $request = $body['operation_id'] ?? null;
    $position = null;
    $pickedId = null;
    $speciesName = '';
    if ($specimen !== null || $request !== null) {
        $position = is_array($specimen) ? mc_clean_pet_position($specimen['pos'] ?? null) : null;
        $speciesName = is_string($specimen['species'] ?? null) ? mb_substr(trim(strip_tags($specimen['species'])), 0, 80) : '';
        if (!$mushId || !$position || !$speciesName || !is_string($request) || !preg_match('/\Aharvest_' . preg_quote($mushId, '/') . '_[a-f0-9]{24}\z/', $request)) {
            mc_json(['ok' => false, 'error' => 'Pedido de colheita inválido.'], 400);
        }
        $pickedId = 'wild_picked_' . substr(hash('sha256', $user['id'] . ':' . $request), 0, 32);
    }

    $awarded = false;
    $pdo->beginTransaction();
    try {
        $account = $pdo->prepare('SELECT progress_json FROM mc_users WHERE id = ? FOR UPDATE');
        $account->execute([(int)$user['id']]);
        $progress = mc_clean_progress($account->fetchColumn() ?: null);
        if ($request !== null) {
            $previous = $pdo->prepare('SELECT 1 FROM mc_coin_operations WHERE user_id = ? AND operation_id = ?');
            $previous->execute([(int)$user['id'], $request]);
            if ($previous->fetchColumn()) {
                $pdo->commit();
                mc_json(['ok' => true, 'awarded' => true, 'picked_id' => $pickedId, 'replayed' => true, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
            }
        }
        $canHarvest = true;
        if ($mushId !== '') {
            $pdo->prepare("INSERT IGNORE INTO mc_world_state (state_key, state_val) VALUES (?, '0')")->execute([$mushId]);
            $stMush = $pdo->prepare('SELECT state_val FROM mc_world_state WHERE state_key = ? FOR UPDATE');
            $stMush->execute([$mushId]);
            $until = (int)($stMush->fetchColumn() ?: 0);
            if ($until > time()) {
                $canHarvest = false;
            }
        }
        if ($canHarvest) {
            // Anti-spam de colheita: no maximo 1 a cada MC_HARVEST_COOLDOWN_MS
            $upd = $pdo->prepare('UPDATE mc_users SET xp = xp + ?, mushrooms_harvested = mushrooms_harvested + 1, last_harvest_at = NOW(3), last_seen = NOW()
                WHERE id = ? AND (last_harvest_at IS NULL OR last_harvest_at < (NOW(3) - INTERVAL ? MICROSECOND))');
            $upd->execute([$xpReward, (int)$user['id'], MC_HARVEST_COOLDOWN_MS * 1000]);
            $awarded = $upd->rowCount() > 0;
            if ($awarded && $mushId !== '') {
                $upState = $pdo->prepare('INSERT INTO mc_world_state (state_key, state_val) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_val = VALUES(state_val)');
                $upState->execute([$mushId, (string)(time() + 20)]);
            }
            if ($awarded && $pickedId !== null) {
                $state = ['speciesName' => $speciesName, 'grams' => 10,
                    'isMagic' => $isPoopCubensis || preg_match('/Psilocybe|Panaeolus/i', $speciesName) === 1];
                $pdo->prepare('INSERT INTO mc_world_objects (item_id, x, y, z, ry) VALUES (?, ?, ?, ?, 0)')
                    ->execute([$pickedId, $position['x'], $position['y'], $position['z']]);
                $pdo->prepare('INSERT INTO mc_world_item_states (item_id, state_json) VALUES (?, ?)')
                    ->execute([$pickedId, json_encode(['wildMushroom' => $state], JSON_UNESCAPED_UNICODE)]);
                $progress['discovered_species'] = array_slice(array_values(array_unique(array_merge($progress['discovered_species'], [$speciesName]))), 0, 120);
                $pdo->prepare('UPDATE mc_users SET progress_json = ? WHERE id = ?')
                    ->execute([json_encode($progress, JSON_UNESCAPED_UNICODE), (int)$user['id']]);
                $pdo->prepare('INSERT INTO mc_coin_operations (user_id, operation_id) VALUES (?, ?)')->execute([(int)$user['id'], $request]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    mc_json(['ok' => true, 'awarded' => $awarded, 'picked_id' => $awarded ? $pickedId : null, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'harvest_greenhouse') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $slotId = isset($body['slot_id']) ? (int)$body['slot_id'] : -1;
    if ($slotId < 0 || $slotId > 23) {
        mc_json(['ok' => false, 'error' => 'Slot da estufa inválido.'], 400);
    }

    $awarded = false;
    $slotCooldownKey = 'gh_harvest_cd_' . $slotId;
    $pdo->beginTransaction();
    try {
        $stCd = $pdo->prepare('SELECT state_val FROM mc_world_state WHERE state_key = ? FOR UPDATE');
        $stCd->execute([$slotCooldownKey]);
        $until = (int)($stCd->fetchColumn() ?: 0);
        if ($until <= time()) {
            // Colheita de bloco frutificado na estufa: concede 50 XP e 2 cogumelos colhidos
            $upd = $pdo->prepare('UPDATE mc_users SET xp = xp + 50, mushrooms_harvested = mushrooms_harvested + 2, last_harvest_at = NOW(3), last_seen = NOW()
                WHERE id = ? AND (last_harvest_at IS NULL OR last_harvest_at < (NOW(3) - INTERVAL ? MICROSECOND))');
            $upd->execute([(int)$user['id'], MC_HARVEST_COOLDOWN_MS * 1000]);
            $awarded = $upd->rowCount() > 0;
            if ($awarded) {
                $upState = $pdo->prepare('INSERT INTO mc_world_state (state_key, state_val) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_val = VALUES(state_val)');
                $upState->execute([$slotCooldownKey, (string)(time() + 15)]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    mc_json(['ok' => true, 'awarded' => $awarded, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'cosmetics_catalog') {
    $user = mc_require_user($pdo);
    mc_json(['ok' => true, 'catalog' => array_merge(array_values(MC_COSMETIC_HATS), array_values(MC_COSMETIC_TOYS)), 'user' => mc_format_user($user)]);
}

if ($action === 'buy_skin' || $action === 'equip_skin') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $skinId = (string)($body['skin_id'] ?? '');
    $skin = mc_skin_catalog()[$skinId] ?? null;
    if (!$skin) mc_json(['ok' => false, 'error' => 'Skin não encontrada.'], 404);
    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare('SELECT * FROM mc_users WHERE id = ? FOR UPDATE');
        $lock->execute([(int)$user['id']]);
        $row = $lock->fetch();
        if (!$row || !mc_skin_available($skin, (string)$row['role'])) {
            $pdo->rollBack();
            mc_json(['ok' => false, 'error' => 'Skin indisponível para esta conta.'], 403);
        }
        $owned = mc_owned_skins($row);
        if (!in_array($skinId, $owned, true)) {
            $price = (int)$skin['price'];
            if ($action !== 'buy_skin' || (int)($row['myco_coins'] ?? 250) < $price) {
                $pdo->rollBack();
                mc_json(['ok' => false, 'error' => 'Desbloqueie a skin com MycoCoins.'], 403);
            }
            $catalog = mc_skin_catalog();
            $paid = array_values(array_filter($owned, static fn(string $id): bool => (int)$catalog[$id]['price'] > 0));
            $paid[] = $skinId;
            $upd = $pdo->prepare('UPDATE mc_users SET unlocked_skins = ?, myco_coins = COALESCE(myco_coins, 250) - ?, current_skin = ? WHERE id = ?');
            $upd->execute([json_encode($paid, JSON_THROW_ON_ERROR), $price, $skinId, (int)$user['id']]);
        } else {
            $upd = $pdo->prepare('UPDATE mc_users SET current_skin = ? WHERE id = ?');
            $upd->execute([$skinId, (int)$user['id']]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    mc_json(['ok' => true, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'buy_cosmetic') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $hatId = (string)($body['hat_id'] ?? '');
    $byCoins = !empty($body['by_coins']);
    $isToy = isset(MC_COSMETIC_TOYS[$hatId]);
    if (!isset(MC_COSMETIC_HATS[$hatId]) && !$isToy) {
        mc_json(['ok' => false, 'error' => 'Item cosmético não encontrado.'], 404);
    }
    $hatDef = $isToy ? MC_COSMETIC_TOYS[$hatId] : MC_COSMETIC_HATS[$hatId];
    $coinPrices = [
        'golden_shroom' => 240,
        'wizard_hood' => 360,
        'grad_cap' => 480,
        'flower_crown' => 120,
        'beret' => 120,
        'skateboard' => 90,
        'snowboard' => 120,
        'paraglider' => 240,
    ];
    $coinPrice = $coinPrices[$hatId] ?? 0;

    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT xp, mushrooms_harvested, COALESCE(myco_coins, 250) AS myco_coins, unlocked_hats, current_hat FROM mc_users WHERE id = ? FOR UPDATE');
        $st->execute([(int)$user['id']]);
        $row = $st->fetch();
        $unlocked = json_decode((string)($row['unlocked_hats'] ?: '["default"]'), true);
        if (!is_array($unlocked)) $unlocked = ['default'];
        $alreadyUnlocked = in_array($hatId, $unlocked, true);

        if (!$alreadyUnlocked) {
            if ($byCoins) {
                if ($coinPrice <= 0) {
                    $pdo->rollBack();
                    mc_json(['ok' => false, 'error' => 'Este item não está disponível para compra com MycoCoins.'], 400);
                }
                if (!$row || (int)$row['myco_coins'] < $coinPrice) {
                    $pdo->rollBack();
                    mc_json(['ok' => false, 'error' => 'MycoCoins insuficientes (Requer ' . $coinPrice . ' moedas).'], 400);
                }
            } else {
                if (!$row || (int)$row['xp'] < $hatDef['req_xp']) {
                    $pdo->rollBack();
                    mc_json(['ok' => false, 'error' => 'XP insuficiente para desbloquear este item (Requer ' . $hatDef['req_xp'] . ' XP).'], 400);
                }
                if ((int)$row['mushrooms_harvested'] < $hatDef['req_mushrooms']) {
                    $pdo->rollBack();
                    mc_json(['ok' => false, 'error' => 'Cogumelos colhidos insuficientes (Requer ' . $hatDef['req_mushrooms'] . ' cogumelos).'], 400);
                }
            }
            $unlocked[] = $hatId;
            $coinsDelta = $byCoins ? -$coinPrice : 0;
            if ($isToy) {
                $upd = $pdo->prepare('UPDATE mc_users SET unlocked_hats = ?, myco_coins = GREATEST(0, COALESCE(myco_coins, 250) + ?), last_seen = NOW() WHERE id = ?');
                $upd->execute([json_encode(array_values($unlocked)), $coinsDelta, (int)$user['id']]);
            } else {
                $upd = $pdo->prepare('UPDATE mc_users SET unlocked_hats = ?, current_hat = ?, myco_coins = GREATEST(0, COALESCE(myco_coins, 250) + ?), last_seen = NOW() WHERE id = ?');
                $upd->execute([json_encode(array_values($unlocked)), $hatId, $coinsDelta, (int)$user['id']]);
                $updSes = $pdo->prepare('UPDATE mc_sessions SET current_hat = ? WHERE user_id = ?');
                $updSes->execute([$hatId, (int)$user['id']]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    mc_json(['ok' => true, 'unlocked' => true, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'equip_cosmetic') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $hatId = (string)($body['hat_id'] ?? 'default');
    if ($hatId !== 'none' && !isset(MC_COSMETIC_HATS[$hatId])) {
        mc_json(['ok' => false, 'error' => 'Chapéu não encontrado.'], 404);
    }
    $fmt = mc_format_user($user);
    if ($hatId !== 'none' && !in_array($hatId, $fmt['unlocked_hats'], true)) {
        mc_json(['ok' => false, 'error' => 'Você ainda não desbloqueou este chapéu.'], 403);
    }
    $upd = $pdo->prepare('UPDATE mc_users SET current_hat = ?, last_seen = NOW() WHERE id = ?');
    $upd->execute([$hatId, (int)$user['id']]);
    $updSes = $pdo->prepare('UPDATE mc_sessions SET current_hat = ? WHERE user_id = ?');
    $updSes->execute([$hatId, (int)$user['id']]);
    mc_json(['ok' => true, 'current_hat' => $hatId, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'complete_module') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $slug = (string)($body['module'] ?? '');
    if (!in_array($slug, MC_MODULES, true)) {
        mc_json(['ok' => false, 'error' => 'Modulo desconhecido.'], 400);
    }
    $answer = trim((string)($body['answer'] ?? ''));
    if (isset(MC_MODULE_ANSWERS[$slug]) && ($answer === '' || $answer !== MC_MODULE_ANSWERS[$slug])) {
        mc_json(['ok' => false, 'error' => 'Resposta incorreta para o módulo.'], 400);
    }

    $pdo->beginTransaction();
    $st = $pdo->prepare('SELECT completed_modules FROM mc_users WHERE id = ? FOR UPDATE');
    $st->execute([(int)$user['id']]);
    $modules = json_decode((string)($st->fetchColumn() ?: '[]'), true);
    if (!is_array($modules)) $modules = [];
    $isNew = !in_array($slug, $modules, true);
    if ($isNew) {
        $modules[] = $slug;
        $upd = $pdo->prepare('UPDATE mc_users SET xp = xp + ?, completed_modules = ?, last_seen = NOW() WHERE id = ?');
        $upd->execute([MC_XP_MODULE, json_encode(array_values($modules)), (int)$user['id']]);
    }
    $pdo->commit();
    mc_json(['ok' => true, 'new_module' => $isNew, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'complete_lab_quest') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT completed_modules, progress_json FROM mc_users WHERE id = ? FOR UPDATE');
        $st->execute([(int)$user['id']]);
        $row = $st->fetch();
        $modules = json_decode((string)($row['completed_modules'] ?? '[]'), true);
        if (!is_array($modules)) $modules = [];
        $isNew = !in_array(MC_LAB_QUEST_SLUG, $modules, true);
        if ($isNew) {
            $progress = mc_clean_progress($row['progress_json'] ?? null);
            if (array_diff(MC_LAB_QUEST_KEYS, $progress['lab_quest_steps'])) {
                $pdo->rollBack();
                mc_json(['ok' => false, 'error' => 'Conclua as oito etapas antes de receber a recompensa.'], 409);
            }
            $modules[] = MC_LAB_QUEST_SLUG;
            $upd = $pdo->prepare('UPDATE mc_users SET xp = xp + ?, completed_modules = ?, last_seen = NOW() WHERE id = ?');
            $upd->execute([MC_XP_LAB_QUEST, json_encode(array_values($modules)), (int)$user['id']]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    mc_json(['ok' => true, 'new_quest' => $isNew, 'awarded_xp' => $isNew ? MC_XP_LAB_QUEST : 0, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'sync_coins') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $delta = max(-5000, min(5000, (int)($body['delta'] ?? 0)));
    $operationId = $body['operation_id'] ?? null;
    if ($operationId !== null && (!is_string($operationId) || !preg_match('/\A[a-z0-9-]{12,64}\z/', $operationId))) {
        mc_json(['ok' => false, 'error' => 'Operação de moedas inválida.'], 400);
    }
    $userId = (int)$user['id'];
    $pdo->beginTransaction();
    try {
        if ($operationId !== null) {
            $lock = $pdo->prepare('SELECT id FROM mc_users WHERE id = ? FOR UPDATE');
            $lock->execute([$userId]);
            $seen = $pdo->prepare('SELECT 1 FROM mc_coin_operations WHERE user_id = ? AND operation_id = ?');
            $seen->execute([$userId, $operationId]);
            if ($seen->fetchColumn()) {
                $delta = 0;
            } else {
                $record = $pdo->prepare('INSERT INTO mc_coin_operations (user_id, operation_id) VALUES (?, ?)');
                $record->execute([$userId, $operationId]);
            }
        }
        if ($delta !== 0) {
            $upd = $pdo->prepare('UPDATE mc_users SET myco_coins = LEAST(999999, GREATEST(0, COALESCE(myco_coins, 250) + ?)), last_seen = NOW() WHERE id = ?');
            $upd->execute([$delta, $userId]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    mc_json(['ok' => true, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'shop_capabilities') {
    mc_json(['ok' => true, 'durable_delivery' => 1]);
}

if ($action === 'buy_supply' || $action === 'buy_supply_durable') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $supId = (string)($body['supply_id'] ?? '');
    if (!isset(MC_SHOP_SUPPLIES[$supId])) {
        mc_json(['ok' => false, 'error' => 'Insumo não encontrado na loja.', 'charged' => false], 404);
    }
    $sup = MC_SHOP_SUPPLIES[$supId];
    $price = (int)$sup['price_coins'];
    $reqXp = (int)$sup['req_xp'];
    $reqMush = (int)$sup['req_mushrooms'];
    // New clients request an idempotent, server-persisted delivery. The legacy
    // path remains available for clients deployed before this capability.
    $orderId = $action === 'buy_supply_durable' ? ($body['order_id'] ?? '') : null;
    $deliveryId = null;
    $pose = null;
    if ($orderId !== null) {
        if (!is_string($orderId) || !preg_match('/\Apurchase_' . preg_quote($supId, '/') . '_[a-f0-9]{32}\z/', $orderId)) {
            mc_json(['ok' => false, 'error' => 'Pedido inválido.', 'charged' => false], 400);
        }
        $pose = $body['delivery'] ?? null;
        if (!is_array($pose)) mc_json(['ok' => false, 'error' => 'Local de entrega inválido.', 'charged' => false], 400);
        foreach (['x' => 220, 'y' => 50, 'z' => 220, 'ry' => 1000] as $key => $limit) {
            if (!isset($pose[$key]) || !is_numeric($pose[$key]) || !is_finite((float)$pose[$key]) || abs((float)$pose[$key]) > $limit) {
                mc_json(['ok' => false, 'error' => 'Local de entrega inválido.', 'charged' => false], 400);
            }
        }
        $deliveryId = 'dyn_shop_' . substr(hash('sha256', (string)$user['id'] . ':' . $orderId), 0, 32);
    }

    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT xp, mushrooms_harvested, COALESCE(myco_coins, 250) AS myco_coins FROM mc_users WHERE id = ? FOR UPDATE');
        $st->execute([(int)$user['id']]);
        $row = $st->fetch();
        $alreadyPurchased = false;
        if ($orderId !== null) {
            $seen = $pdo->prepare('SELECT 1 FROM mc_coin_operations WHERE user_id = ? AND operation_id = ?');
            $seen->execute([(int)$user['id'], $orderId]);
            $alreadyPurchased = (bool)$seen->fetchColumn();
        }
        if (!$alreadyPurchased) {
            $lotId = $pose ? mc_village_lot_at((float)$pose['x'], (float)$pose['z']) : null;
            $lot = $lotId !== null ? mc_village_read_lot($pdo, $lotId) : null;
            if ($lotId !== null && !mc_village_has_lease($lot, (int)$user['id'], time())) {
                $pdo->rollBack();
                mc_json(['ok' => false, 'charged' => false, 'error' => 'Escolha uma área pública ou o seu próprio lote para a entrega.'], 403);
            }
            if (!$row || (int)$row['xp'] < $reqXp || (int)$row['mushrooms_harvested'] < $reqMush || (int)$row['myco_coins'] < $price) {
                $pdo->rollBack();
                mc_json(['ok' => false, 'error' => 'Requisitos ou MycoCoins insuficientes para comprar este item.', 'charged' => false], 400);
            }
            $upd = $pdo->prepare('UPDATE mc_users SET myco_coins = GREATEST(0, COALESCE(myco_coins, 250) - ?), last_seen = NOW() WHERE id = ?');
            $upd->execute([$price, (int)$user['id']]);
            if ($orderId !== null) {
                $pdo->prepare('INSERT INTO mc_coin_operations (user_id, operation_id) VALUES (?, ?)')->execute([(int)$user['id'], $orderId]);
                $pdo->prepare('INSERT INTO mc_world_objects (item_id, x, y, z, ry) VALUES (?, ?, ?, ?, ?)')
                    ->execute([$deliveryId, (float)$pose['x'], (float)$pose['y'], (float)$pose['z'], (float)$pose['ry']]);
                $pdo->prepare('INSERT INTO mc_world_layout_edits (item_id, prefab_id, label, scale, removed) VALUES (?, ?, ?, 1.0, 0)')
                    ->execute([$deliveryId, $sup['prefab_id'], '']);
                $pdo->prepare('INSERT INTO mc_village_items (item_id, owner_id, lot_id, lease_epoch) VALUES (?, ?, ?, ?)')
                    ->execute([$deliveryId, (int)$user['id'], $lotId, (int)($lot['lease_epoch'] ?? 0)]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    mc_json(['ok' => true, 'delivery_id' => $deliveryId, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'pet_action') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $op = (string)($body['operation'] ?? '');
    $petId = (string)($body['pet_id'] ?? '');
    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT progress_json, COALESCE(myco_coins, 250) AS myco_coins FROM mc_users WHERE id = ? FOR UPDATE');
        $st->execute([(int)$user['id']]);
        $row = $st->fetch();
        $progress = mc_clean_progress($row['progress_json'] ?? null);
        $pets = $progress['pets'];
        $price = 0;
        $operationId = null;
        if ($op === 'buy_pet') {
            if (!in_array($petId, MC_PETS, true)) throw new InvalidArgumentException('Pet desconhecido.');
            if (!in_array($petId, $pets['owned'], true)) {
                $price = 200;
                $pets['owned'][] = $petId;
            }
        } elseif ($op === 'select') {
            if ($petId !== '' && !in_array($petId, $pets['owned'], true)) throw new InvalidArgumentException('Você ainda não comprou este pet.');
            if ($petId !== '' && $pets['selected'] !== $petId && $pets['mode'] === 'stay') {
                $pets['mode'] = 'follow';
                $pets['anchor'] = null;
            }
            $pets['selected'] = $petId;
        } elseif ($op === 'mode') {
            $mode = (string)($body['mode'] ?? '');
            if (!in_array($mode, ['follow', 'roam', 'stay'], true)) throw new InvalidArgumentException('Modo de pet inválido.');
            $anchor = $mode === 'stay' ? mc_clean_pet_position($body['pos'] ?? null) : null;
            if ($mode === 'stay' && (!$pets['selected'] || !$anchor)) throw new InvalidArgumentException('Escolha um pet e um local no campus.');
            $pets['mode'] = $mode;
            $pets['anchor'] = $anchor;
        } elseif (in_array($op, ['buy_food_bowl', 'buy_water_bowl'], true)) {
            $kind = $op === 'buy_food_bowl' ? 'food' : 'water';
            if (!$pets['bowls'][$kind]['owned']) {
                $price = 40;
                $pets['bowls'][$kind]['owned'] = true;
            }
        } elseif ($op === 'buy_cat_food') {
            $operationId = (string)($body['operation_id'] ?? '');
            if (!preg_match('/^pet_food_[a-f0-9]{32}$/D', $operationId)) throw new InvalidArgumentException('Pedido de ração inválido.');
            $check = $pdo->prepare('SELECT 1 FROM mc_coin_operations WHERE user_id = ? AND operation_id = ?');
            $check->execute([(int)$user['id'], $operationId]);
            if (!$check->fetchColumn()) {
                if ($pets['cat_food'] > 994) throw new InvalidArgumentException('Você já tem bastante ração.');
                $price = 25;
                $pets['cat_food'] += 5;
            } else {
                $operationId = null;
            }
        } elseif (in_array($op, ['place_food', 'place_water'], true)) {
            $kind = $op === 'place_food' ? 'food' : 'water';
            if (!$pets['bowls'][$kind]['owned']) throw new InvalidArgumentException('Compre o potinho primeiro.');
            $candidate = mc_clean_pet_state(['bowls' => [$kind => ['owned' => true, 'pos' => $body['pos'] ?? null]]]);
            if (!$candidate['bowls'][$kind]['pos']) throw new InvalidArgumentException('Posição do potinho inválida.');
            $pets['bowls'][$kind]['pos'] = $candidate['bowls'][$kind]['pos'];
        } elseif (in_array($op, ['fill_food', 'fill_water'], true)) {
            $kind = $op === 'fill_food' ? 'food' : 'water';
            if (!$pets['bowls'][$kind]['pos']) throw new InvalidArgumentException('Coloque o potinho no chão primeiro.');
            if ($pets['bowls'][$kind]['full']) throw new InvalidArgumentException('O potinho já está cheio.');
            if ($kind === 'food') {
                if ($pets['cat_food'] < 1) throw new InvalidArgumentException('Compre ração para gatos primeiro.');
                $pets['cat_food']--;
            }
            $pets['bowls'][$kind]['full'] = true;
        } elseif (in_array($op, ['consume_food', 'consume_water'], true)) {
            $kind = $op === 'consume_food' ? 'food' : 'water';
            $selected = $pets['selected'];
            $nextKey = $kind === 'food' ? 'next_food' : 'next_water';
            if (!$selected || ($kind === 'food' && strpos($selected, 'cat_') !== 0) || !$pets['bowls'][$kind]['pos'] || !$pets['bowls'][$kind]['full'] || ($pets[$nextKey][$selected] ?? 0) > time()) {
                throw new InvalidArgumentException('O pet não precisa deste potinho agora.');
            }
            $pets['bowls'][$kind]['full'] = false;
            $pets[$nextKey][$selected] = time() + ($kind === 'food' ? 300 : 180);
        } else {
            throw new InvalidArgumentException('Ação de pet desconhecida.');
        }
        if ((int)($row['myco_coins'] ?? 0) < $price) throw new InvalidArgumentException('MycoCoins insuficientes.');
        $pets['revision']++;
        $progress['pets'] = mc_clean_pet_state($pets);
        $upd = $pdo->prepare('UPDATE mc_users SET progress_json = ?, myco_coins = COALESCE(myco_coins, 250) - ?, last_seen = NOW() WHERE id = ?');
        $upd->execute([json_encode($progress, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $price, (int)$user['id']]);
        if ($operationId !== null) $pdo->prepare('INSERT INTO mc_coin_operations (user_id, operation_id) VALUES (?, ?)')->execute([(int)$user['id'], $operationId]);
        $pdo->commit();
    } catch (InvalidArgumentException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        mc_json(['ok' => false, 'charged' => false, 'error' => $e->getMessage()], 400);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    mc_json(['ok' => true, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'sync_progress') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $inc = mc_clean_progress($body['progress'] ?? $body);

    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT progress_json FROM mc_users WHERE id = ? FOR UPDATE');
        $st->execute([(int)$user['id']]);
        $cur = mc_clean_progress($st->fetchColumn() ?: null);

        $nextToy = array_key_exists('equipped_toy', is_array($body['progress'] ?? null) ? $body['progress'] : ($body ?: []))
            ? $inc['equipped_toy']
            : ($cur['equipped_toy'] ?? '');
        $merged = [
            'discovered_species' => array_slice(array_values(array_unique(array_merge($cur['discovered_species'], $inc['discovered_species']))), 0, 120),
            'micoteca_milestones' => array_values(array_unique(array_merge($cur['micoteca_milestones'], $inc['micoteca_milestones']))),
            'lab_quest_steps' => array_values(array_unique(array_merge($cur['lab_quest_steps'], $inc['lab_quest_steps']))),
            'lab_tutorial_done' => ($cur['lab_tutorial_done'] || $inc['lab_tutorial_done']),
            'equipped_toy' => $nextToy,
            'pets' => $cur['pets'],
        ];
        sort($merged['micoteca_milestones']);

        $upd = $pdo->prepare('UPDATE mc_users SET progress_json = ?, last_seen = NOW() WHERE id = ?');
        $upd->execute([json_encode($merged, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), (int)$user['id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    mc_json(['ok' => true, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'leaderboard') {
    $leaders = [];
    try {
        $topStmt = $pdo->query('SELECT * FROM mc_users ORDER BY xp DESC, mushrooms_harvested DESC, id ASC LIMIT 15');
        foreach ($topStmt->fetchAll() as $row) {
            $u = mc_format_user($row);
            unset($u['username'], $u['progress']);
            $leaders[] = $u;
        }
        $stats = $pdo->query('SELECT COUNT(*) AS total_users, COALESCE(SUM(xp), 0) AS total_xp, COALESCE(SUM(mushrooms_harvested), 0) AS total_harvests FROM mc_users')->fetch() ?: [];
        mc_json([
            'ok' => true,
            'leaders' => $leaders,
            'total_modules' => count(MC_MODULES),
            'stats' => [
                'total_users' => (int)($stats['total_users'] ?? 0),
                'total_xp' => (int)($stats['total_xp'] ?? 0),
                'total_harvests' => (int)($stats['total_harvests'] ?? 0),
            ],
        ]);
    } catch (Throwable $e) {
        error_log('[MycoCampus3D] leaderboard error: ' . $e->getMessage());
        mc_json([
            'ok' => true,
            'leaders' => [],
            'total_modules' => count(MC_MODULES),
            'stats' => ['total_users' => 0, 'total_xp' => 0, 'total_harvests' => 0],
            'degraded' => true,
        ]);
    }
}

// -------------------------------------------------------------
// Endpoints Master Admin
// -------------------------------------------------------------

if ($action === 'admin_list_users') {
    $user = mc_require_user($pdo);
    if (!mc_is_admin($user)) {
        mc_json(['ok' => false, 'error' => 'Acesso restrito ao Administrador Master.'], 403);
    }
    $st = $pdo->query('
        SELECT u.id, u.username, u.display_name, u.role, u.hat_color, u.body_color,
               u.unlocked_hats, u.current_hat,
               u.xp, u.mushrooms_harvested, u.completed_modules, u.created_at, u.last_seen,
               (s.session_id IS NOT NULL) AS is_online, s.x, s.y, s.z
        FROM mc_users u
        LEFT JOIN mc_sessions s ON s.session_id = (
            SELECT s2.session_id FROM mc_sessions s2
            WHERE s2.user_id = u.id
            ORDER BY s2.last_seen DESC
            LIMIT 1
        )
        ORDER BY is_online DESC, u.xp DESC, u.id ASC
        LIMIT 100
    ');
    $users = [];
    foreach ($st->fetchAll() as $row) {
        $modules = [];
        if (!empty($row['completed_modules'])) {
            $dec = json_decode((string)$row['completed_modules'], true);
            if (is_array($dec)) $modules = array_values(array_unique(array_map('strval', $dec)));
        }
        $users[] = [
            'id' => (int)$row['id'],
            'username' => (string)$row['username'],
            'display_name' => (string)$row['display_name'],
            'role' => (string)$row['role'],
            'hat_color' => mc_clean_hex($row['hat_color'], '#dc2626'),
            'body_color' => mc_clean_hex($row['body_color'], '#4f46e5'),
            'xp' => (int)$row['xp'],
            'mushrooms_harvested' => (int)$row['mushrooms_harvested'],
            'completed_modules_count' => count($modules),
            'created_at' => (string)$row['created_at'],
            'last_seen' => (string)$row['last_seen'],
            'is_online' => (bool)$row['is_online'],
            'pos' => $row['is_online'] ? [
                'x' => round((float)$row['x'], 1),
                'y' => round((float)$row['y'], 1),
                'z' => round((float)$row['z'], 1),
            ] : null,
        ];
    }
    mc_json(['ok' => true, 'users' => $users]);
}

if ($action === 'admin_set_role') {
    mc_require_post();
    $user = mc_require_user($pdo);
    if (!mc_is_admin($user)) {
        mc_json(['ok' => false, 'error' => 'Acesso restrito ao Administrador Master.'], 403);
    }
    $targetId = (int)($body['target_id'] ?? 0);
    $newRole = (string)($body['new_role'] ?? 'student');
    if (!in_array($newRole, ['student', 'professor', 'admin'], true)) {
        mc_json(['ok' => false, 'error' => 'Cargo invalido.'], 400);
    }
    $target = mc_fetch_user($pdo, $targetId);
    if (!$target) {
        mc_json(['ok' => false, 'error' => 'Usuario nao encontrado.'], 404);
    }
    if (in_array((string)$target['username'], MC_ADMIN_USERNAMES, true) && $newRole !== 'admin') {
        mc_json(['ok' => false, 'error' => 'Nao e permitido rebaixar o dono principal.'], 400);
    }
    $upd = $pdo->prepare('UPDATE mc_users SET role = ? WHERE id = ?');
    $upd->execute([$newRole, $targetId]);
    $updSes = $pdo->prepare('UPDATE mc_sessions SET role = ? WHERE user_id = ?');
    $updSes->execute([$newRole, $targetId]);
    mc_json(['ok' => true, 'target_id' => $targetId, 'role' => $newRole]);
}

if ($action === 'admin_teleport') {
    mc_require_post();
    $user = mc_require_user($pdo);
    if (!mc_is_admin($user)) {
        mc_json(['ok' => false, 'error' => 'Acesso restrito ao Administrador Master.'], 403);
    }
    $targetId = (int)($body['target_id'] ?? 0);
    $target = mc_fetch_user($pdo, $targetId);
    if (!$target) {
        mc_json(['ok' => false, 'error' => 'Usuario nao encontrado.'], 404);
    }
    $tx = is_numeric($body['x'] ?? null) ? (float)$body['x'] : 0.0;
    $ty = is_numeric($body['y'] ?? null) ? (float)$body['y'] : 0.0;
    $tz = is_numeric($body['z'] ?? null) ? (float)$body['z'] : 0.0;
    $tyaw = is_numeric($body['yaw'] ?? null) ? (float)$body['yaw'] : 0.0;
    if (!is_finite($tx)) $tx = 0.0;
    if (!is_finite($ty)) $ty = 0.0;
    if (!is_finite($tz)) $tz = 0.0;
    if (!is_finite($tyaw)) $tyaw = 0.0;
    $tx = max(-220.0, min(220.0, $tx));
    $ty = max(-10.0, min(120.0, $ty));
    $tz = max(-220.0, min(220.0, $tz));
    $tyaw = max(-100.0, min(100.0, $tyaw));
    $payload = json_encode(['x' => round($tx, 2), 'y' => round($ty, 2), 'z' => round($tz, 2), 'yaw' => round($tyaw, 2)]);
    $ins = $pdo->prepare('INSERT INTO mc_admin_events (target_user_id, action_type, payload) VALUES (?, "teleport", ?)');
    $ins->execute([$targetId, $payload]);
    mc_json(['ok' => true, 'target_id' => $targetId, 'teleported' => true]);
}

if ($action === 'admin_kick') {
    mc_require_post();
    $user = mc_require_user($pdo);
    if (!mc_is_admin($user)) {
        mc_json(['ok' => false, 'error' => 'Acesso restrito ao Administrador Master.'], 403);
    }
    $targetId = (int)($body['target_id'] ?? 0);
    $reason = trim((string)($body['reason'] ?? 'Você foi desconectado pelo Administrador Master.'));
    $target = mc_fetch_user($pdo, $targetId);
    if (!$target) {
        mc_json(['ok' => false, 'error' => 'Usuario nao encontrado.'], 404);
    }
    if (in_array((string)$target['username'], MC_ADMIN_USERNAMES, true)) {
        mc_json(['ok' => false, 'error' => 'Nao e permitido desconectar o dono principal.'], 400);
    }
    $delSes = $pdo->prepare('DELETE FROM mc_sessions WHERE user_id = ?');
    $delSes->execute([$targetId]);
    $delTok = $pdo->prepare('DELETE FROM mc_auth_tokens WHERE user_id = ?');
    $delTok->execute([$targetId]);
    $ins = $pdo->prepare('INSERT INTO mc_admin_events (target_user_id, action_type, payload) VALUES (?, "kick", ?)');
    $ins->execute([$targetId, json_encode(['reason' => $reason])]);
    mc_json(['ok' => true, 'target_id' => $targetId, 'kicked' => true]);
}

mc_json(['ok' => false, 'error' => 'Acao desconhecida.'], 400);
