<?php
$cfgPath = __DIR__ . '/config.php';
if (!file_exists($cfgPath)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'error' => 'Arquivo api/config.php não configurado no servidor.'
    ]);
    exit;
}
require_once $cfgPath;

function mc_db() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    // Garante que as tabelas existam automaticamente no primeiro acesso
    $schemaFile = __DIR__ . '/../database/schema.sql';
    if (file_exists($schemaFile)) {
        $checked = false;
        try {
            $pdo->query('SELECT 1 FROM mc_users LIMIT 1');
            $checked = true;
        } catch (Throwable $e) {
            $checked = false;
        }
        if (!$checked) {
            $sql = file_get_contents($schemaFile);
            foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
                if ($stmt !== '') $pdo->exec($stmt);
            }
        }
    }
    return $pdo;
}
