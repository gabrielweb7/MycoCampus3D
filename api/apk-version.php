<?php
/**
 * MycoCampus3D - Metadados da versão mais recente do APK Android.
 * Consultado automaticamente pelo app APK para avisar e baixar novas versões nativas.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$manifestPath = __DIR__ . '/../assets/apk-version.json';
$fallbackVersion = @file_get_contents(__DIR__ . '/../VERSION');
$fallbackVersionName = is_string($fallbackVersion) && trim($fallbackVersion) !== '' ? trim($fallbackVersion) : '1.0.1';

$data = [
    'versionCode' => 1,
    'versionName' => $fallbackVersionName,
    'apkUrl' => 'https://github.com/gabrielweb7/MycoCampus3D/releases/latest/download/MycoCampus3D.apk',
    'notes' => '',
    'mandatory' => false,
];

if (is_file($manifestPath)) {
    $raw = @file_get_contents($manifestPath);
    if (is_string($raw)) {
        $parsed = json_decode($raw, true);
        if (is_array($parsed)) {
            $data['versionCode'] = isset($parsed['versionCode']) ? (int) $parsed['versionCode'] : $data['versionCode'];
            $data['versionName'] = isset($parsed['versionName']) ? (string) $parsed['versionName'] : $data['versionName'];
            $data['apkUrl'] = isset($parsed['apkUrl']) ? (string) $parsed['apkUrl'] : $data['apkUrl'];
            $data['notes'] = isset($parsed['notes']) ? (string) $parsed['notes'] : $data['notes'];
            $data['mandatory'] = !empty($parsed['mandatory']);
        }
    }
}

echo json_encode([
    'ok' => true,
    'versionCode' => $data['versionCode'],
    'versionName' => $data['versionName'],
    'apkUrl' => $data['apkUrl'],
    'notes' => $data['notes'],
    'mandatory' => $data['mandatory'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
