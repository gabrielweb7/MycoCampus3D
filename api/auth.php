<?php
/**
 * MycoCampus3D - Autenticacao (Nome + PIN), progresso, ranking e painel Master Admin.
 * Todo progresso fica no MySQL e e calculado no servidor (o cliente nao define XP).
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

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
        'completed_modules' => $modules,
        'unlocked_hats' => $unlockedHats,
        'current_hat' => $currentHat,
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
            $ins = $pdo->prepare('INSERT INTO mc_users (username, display_name, role, pin_hash, hat_color, body_color, xp, mushrooms_harvested, completed_modules) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)');
            $ins->execute([$username, $displayName, $role, password_hash($pin, PASSWORD_DEFAULT), $hatColor, $bodyColor, '[]']);
            $userId = (int)$pdo->lastInsertId();
            $created = true;
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                mc_json(['ok' => false, 'error' => 'Esse nome acabou de ser cadastrado. Tente entrar com sua senha.'], 409);
            }
            throw $e;
        }
    }

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
    mc_json(['ok' => true, 'user' => mc_format_user($user)]);
}

if ($action === 'harvest') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $mushId = trim((string)($body['mushroom_id'] ?? ''));
    if ($mushId !== '' && !preg_match('/^wild_(?:[0-9]|[12][0-9]|3[01])$/', $mushId)) {
        mc_json(['ok' => false, 'error' => 'Cogumelo inválido.'], 400);
    }

    $awarded = false;
    $pdo->beginTransaction();
    try {
        $canHarvest = true;
        if ($mushId !== '') {
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
            $upd->execute([MC_XP_HARVEST, (int)$user['id'], MC_HARVEST_COOLDOWN_MS * 1000]);
            $awarded = $upd->rowCount() > 0;
            if ($awarded && $mushId !== '') {
                $upState = $pdo->prepare('INSERT INTO mc_world_state (state_key, state_val) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_val = VALUES(state_val)');
                $upState->execute([$mushId, (string)(time() + 20)]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    mc_json(['ok' => true, 'awarded' => $awarded, 'user' => mc_format_user(mc_fetch_user($pdo, (int)$user['id']))]);
}

if ($action === 'harvest_greenhouse') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $slotId = isset($body['slot_id']) ? (int)$body['slot_id'] : -1;
    if ($slotId < 0 || $slotId > 3) {
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

if ($action === 'buy_cosmetic') {
    mc_require_post();
    $user = mc_require_user($pdo);
    $hatId = (string)($body['hat_id'] ?? '');
    $isToy = isset(MC_COSMETIC_TOYS[$hatId]);
    if (!isset(MC_COSMETIC_HATS[$hatId]) && !$isToy) {
        mc_json(['ok' => false, 'error' => 'Item cosmético não encontrado.'], 404);
    }
    $hatDef = $isToy ? MC_COSMETIC_TOYS[$hatId] : MC_COSMETIC_HATS[$hatId];

    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT xp, mushrooms_harvested, unlocked_hats, current_hat FROM mc_users WHERE id = ? FOR UPDATE');
        $st->execute([(int)$user['id']]);
        $row = $st->fetch();
        if (!$row || (int)$row['xp'] < $hatDef['req_xp']) {
            $pdo->rollBack();
            mc_json(['ok' => false, 'error' => 'XP insuficiente para desbloquear este item (Requer ' . $hatDef['req_xp'] . ' XP).'], 400);
        }
        if ((int)$row['mushrooms_harvested'] < $hatDef['req_mushrooms']) {
            $pdo->rollBack();
            mc_json(['ok' => false, 'error' => 'Cogumelos colhidos insuficientes (Requer ' . $hatDef['req_mushrooms'] . ' cogumelos).'], 400);
        }
        $unlocked = json_decode((string)($row['unlocked_hats'] ?: '["default"]'), true);
        if (!is_array($unlocked)) $unlocked = ['default'];
        if (!in_array($hatId, $unlocked, true)) {
            $unlocked[] = $hatId;
            if ($isToy) {
                $upd = $pdo->prepare('UPDATE mc_users SET unlocked_hats = ?, last_seen = NOW() WHERE id = ?');
                $upd->execute([json_encode(array_values($unlocked)), (int)$user['id']]);
            } else {
                $upd = $pdo->prepare('UPDATE mc_users SET unlocked_hats = ?, current_hat = ?, last_seen = NOW() WHERE id = ?');
                $upd->execute([json_encode(array_values($unlocked)), $hatId, (int)$user['id']]);
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
        $st = $pdo->prepare('SELECT completed_modules FROM mc_users WHERE id = ? FOR UPDATE');
        $st->execute([(int)$user['id']]);
        $modules = json_decode((string)($st->fetchColumn() ?: '[]'), true);
        if (!is_array($modules)) $modules = [];
        $isNew = !in_array(MC_LAB_QUEST_SLUG, $modules, true);
        if ($isNew) {
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

if ($action === 'leaderboard') {
    $topStmt = $pdo->query('SELECT id, username, display_name, role, hat_color, body_color, unlocked_hats, current_hat, xp, mushrooms_harvested, completed_modules FROM mc_users ORDER BY xp DESC, mushrooms_harvested DESC, id ASC LIMIT 15');
    $leaders = [];
    foreach ($topStmt->fetchAll() as $row) {
        $u = mc_format_user($row);
        unset($u['username']);
        $leaders[] = $u;
    }
    $stats = $pdo->query('SELECT COUNT(*) AS total_users, COALESCE(SUM(xp), 0) AS total_xp, COALESCE(SUM(mushrooms_harvested), 0) AS total_harvests FROM mc_users')->fetch();
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
