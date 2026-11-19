import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidDir = path.join(root, 'android');
const distDir = path.join(root, 'dist');

execFileSync(process.execPath, [path.join(root, 'scripts', 'prepare-apk.mjs')], { stdio: 'inherit' });

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const syncRes = spawnSync(npxCmd, ['cap', 'sync', 'android'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (syncRes.status !== 0) {
  process.exit(syncRes.status || 1);
}

const hasKeystore = Boolean(
  process.env.MYCO_KEYSTORE_PATH &&
  fs.existsSync(process.env.MYCO_KEYSTORE_PATH)
);

const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const gradleTask = hasKeystore ? 'assembleRelease' : 'assembleDebug';
console.log(`\nCompilando APK (${gradleTask}) em ${androidDir}...`);

const buildRes = spawnSync(gradlew, [gradleTask, '--no-daemon'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (buildRes.status !== 0) {
  console.error('\nFalha ao compilar o APK localmente.');
  console.error('Verifique se Java (JDK 21) e Android SDK (ANDROID_HOME) estão instalados ou use o GitHub Actions.');
  process.exit(buildRes.status || 1);
}

const apkSource = hasKeystore
  ? path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
  : path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

if (!fs.existsSync(apkSource)) {
  console.error(`APK não encontrado em: ${apkSource}`);
  process.exit(1);
}

fs.mkdirSync(distDir, { recursive: true });
const outApk = path.join(distDir, 'MycoCampus3D.apk');
fs.copyFileSync(apkSource, outApk);
console.log(`\nAPK gerado com sucesso: ${outApk}`);
