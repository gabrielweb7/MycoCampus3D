-- MycoCampus3D - Schema MySQL
-- Criado/migrado automaticamente por api/db.php no primeiro acesso.

CREATE TABLE IF NOT EXISTS mc_meta (
    meta_key VARCHAR(40) PRIMARY KEY,
    meta_val VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(48) NOT NULL UNIQUE,
    display_name VARCHAR(64) NOT NULL,
    role ENUM('student', 'professor', 'admin') NOT NULL DEFAULT 'student',
    pin_hash VARCHAR(255) NOT NULL,
    hat_color VARCHAR(7) NOT NULL DEFAULT '#dc2626',
    body_color VARCHAR(7) NOT NULL DEFAULT '#4f46e5',
    unlocked_hats TEXT NULL,
    current_hat VARCHAR(32) NOT NULL DEFAULT 'default',
    xp INT NOT NULL DEFAULT 0,
    mushrooms_harvested INT NOT NULL DEFAULT 0,
    myco_coins INT NOT NULL DEFAULT 250,
    completed_modules TEXT NULL,
    progress_json MEDIUMTEXT NULL,
    last_harvest_at DATETIME(3) NULL,
    login_fails INT NOT NULL DEFAULT 0,
    login_locked_until DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_leaderboard (xp, mushrooms_harvested)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_coin_operations (
    user_id INT NOT NULL,
    operation_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (user_id, operation_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mc_village_lots (
    lot_id TINYINT UNSIGNED PRIMARY KEY,
    owner_id INT NULL,
    expires_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
    lease_epoch BIGINT UNSIGNED NOT NULL DEFAULT 0,
    INDEX idx_village_owner (owner_id, expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mc_village_items (
    item_id VARCHAR(64) PRIMARY KEY,
    owner_id INT NOT NULL,
    lot_id TINYINT UNSIGNED NULL,
    lease_epoch BIGINT UNSIGNED NOT NULL DEFAULT 0,
    INDEX idx_village_item_owner (owner_id, lot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_village_sales (
    item_id VARCHAR(64) PRIMARY KEY,
    owner_id INT NOT NULL,
    lot_id TINYINT UNSIGNED NOT NULL,
    pickup_at BIGINT UNSIGNED NOT NULL,
    price INT UNSIGNED NOT NULL,
    paid TINYINT(1) NOT NULL DEFAULT 0,
    INDEX idx_village_sale_due (paid, pickup_at),
    INDEX idx_village_sale_owner (owner_id, paid, pickup_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_village_notes (
    owner_id INT PRIMARY KEY,
    body TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_auth_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tokens_user (user_id),
    INDEX idx_tokens_last_used (last_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    role ENUM('student', 'professor', 'admin') NOT NULL DEFAULT 'student',
    hat_color VARCHAR(7) NOT NULL DEFAULT '#dc2626',
    body_color VARCHAR(7) NOT NULL DEFAULT '#4f46e5',
    current_hat VARCHAR(32) NOT NULL DEFAULT 'default',
    emote VARCHAR(16) NOT NULL DEFAULT '',
    x DOUBLE NOT NULL DEFAULT 0,
    y DOUBLE NOT NULL DEFAULT 0,
    z DOUBLE NOT NULL DEFAULT 10.5,
    yaw DOUBLE NOT NULL DEFAULT 0,
    pitch DOUBLE NOT NULL DEFAULT 0,
    holding_item VARCHAR(64) NOT NULL DEFAULT '',
    walking TINYINT(1) NOT NULL DEFAULT 0,
    in_fps TINYINT(1) NOT NULL DEFAULT 0,
    pet_json TEXT NULL,
    chat_msg VARCHAR(140) NULL,
    chat_at DATETIME NULL,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sessions_seen (last_seen),
    INDEX idx_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_world_objects (
    item_id VARCHAR(64) PRIMARY KEY,
    x DOUBLE NOT NULL,
    y DOUBLE NOT NULL,
    z DOUBLE NOT NULL,
    ry DOUBLE NOT NULL DEFAULT 0,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_world_item_states (
    item_id VARCHAR(64) PRIMARY KEY,
    state_json MEDIUMTEXT NOT NULL,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_world_state (
    state_key VARCHAR(40) PRIMARY KEY,
    state_val VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_user_poses (
    user_id INT PRIMARY KEY,
    pose_json TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_admin_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    target_user_id INT NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    payload TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_target (target_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_board_strokes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stroke_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    stroke_json MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_board_stroke_key (stroke_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_world_layout_edits (
    item_id VARCHAR(64) PRIMARY KEY,
    prefab_id VARCHAR(64) NOT NULL DEFAULT '',
    label VARCHAR(96) NOT NULL DEFAULT '',
    scale DOUBLE NOT NULL DEFAULT 1,
    removed TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_admin_layout_defaults (
    item_id VARCHAR(64) PRIMARY KEY,
    prefab_id VARCHAR(64) NOT NULL DEFAULT '',
    label VARCHAR(96) NOT NULL DEFAULT '',
    scale DOUBLE NOT NULL DEFAULT 1,
    x DOUBLE NOT NULL DEFAULT 0,
    y DOUBLE NOT NULL DEFAULT 0,
    z DOUBLE NOT NULL DEFAULT 0,
    ry DOUBLE NOT NULL DEFAULT 0,
    removed TINYINT(1) NOT NULL DEFAULT 0,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inventário rápido: cada objeto continua sendo uma única entidade do mundo.
CREATE TABLE IF NOT EXISTS mc_inventory_slots (
    item_id VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id INT NOT NULL,
    slot TINYINT UNSIGNED NOT NULL,
    UNIQUE KEY uq_inventory_user_slot (user_id, slot),
    CONSTRAINT fk_inventory_slots_user FOREIGN KEY (user_id) REFERENCES mc_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mc_inventory_control (
    user_id INT NOT NULL PRIMARY KEY,
    session_id VARCHAR(40) NOT NULL,
    active_slot TINYINT UNSIGNED NOT NULL DEFAULT 0,
    operation_id VARCHAR(40) NOT NULL DEFAULT '',
    operation_result VARCHAR(100) NOT NULL DEFAULT '',
    CONSTRAINT fk_inventory_control_user FOREIGN KEY (user_id) REFERENCES mc_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO mc_meta (meta_key, meta_val) VALUES ('inventory_lock', '1');
