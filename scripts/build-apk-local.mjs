import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidDir = path.join(root, 'android');
const distDir = path.join(root, 'dist');

function findJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'))) {
    return process.env.JAVA_HOME;
  }
  const candidates = [
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Java',
    'D:\\Android\\jdk'
  ];
  for (const base of candidates) {
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base)) {
      const candidate = path.join(base, entry);
      if (fs.existsSync(path.join(candidate, 'bin', 'java.exe'))) {
        return candidate;
      }
    }
  }
  return '';
}

function findAndroidSdk() {
  if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) {
    return process.env.ANDROID_HOME;
  }
  const candidates = [
    'D:\\Android\\Sdk',
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
  ];
  for (const dir of candidates) {
    if (dir && fs.existsSync(dir)) return dir;
  }
  return '';
}

const javaHome = findJavaHome();
const androidHome = findAndroidSdk();

if (!javaHome) {
  console.error('Java JDK não encontrado. Instale o JDK 21 (Eclipse Temurin) e tente novamente.');
  process.exit(1);
}
if (!androidHome) {
  console.error('Android SDK não encontrado em D:\\Android\\Sdk ou ANDROID_HOME.');
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || 'D:\\Android\\.gradle',
  PATH: `${path.join(javaHome, 'bin')};${path.join(androidHome, 'platform-tools')};${process.env.PATH || ''}`
};

// Keystore permanente local (para que futuras atualizações do APK instalem por cima sem desinstalar)
const defaultKeystore = 'D:\\Android\\myco-release.keystore';
if (!env.MYCO_KEYSTORE_PATH && fs.existsSync(defaultKeystore)) {
  env.MYCO_KEYSTORE_PATH = defaultKeystore;
  env.MYCO_KEYSTORE_PASSWORD = env.MYCO_KEYSTORE_PASSWORD || 'myco3d2026';
  env.MYCO_KEY_ALIAS = env.MYCO_KEY_ALIAS || 'mycocampus';
  env.MYCO_KEY_PASSWORD = env.MYCO_KEY_PASSWORD || 'myco3d2026';
}

execFileSync(process.execPath, [path.join(root, 'scripts', 'prepare-apk.mjs')], { stdio: 'inherit', env });

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const syncRes = spawnSync(npxCmd, ['cap', 'sync', 'android'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env
});
if (syncRes.status !== 0) {
  process.exit(syncRes.status || 1);
}

const hasKeystore = Boolean(env.MYCO_KEYSTORE_PATH && fs.existsSync(env.MYCO_KEYSTORE_PATH));
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const gradleTask = hasKeystore ? 'assembleRelease' : 'assembleDebug';

console.log(`\nCompilando APK (${gradleTask}) usando JAVA_HOME=${javaHome} e ANDROID_HOME=${androidHome}...`);
const buildRes = spawnSync(gradlew, [gradleTask, '--no-daemon'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env
});

if (buildRes.status !== 0) {
  console.error('\nFalha ao compilar o APK localmente.');
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
const rootApk = path.join(root, 'MycoCampus3D.apk');
const distApk = path.join(distDir, 'MycoCampus3D.apk');
fs.copyFileSync(apkSource, rootApk);
fs.copyFileSync(apkSource, distApk);

const sizeMb = (fs.statSync(rootApk).size / (1024 * 1024)).toFixed(2);
console.log(`\n✅ APK gerado com sucesso na raiz do projeto: ${rootApk} (${sizeMb} MB)`);
console.log(`   Assinatura: ${hasKeystore ? 'Release permanente (atualiza por cima sem desinstalar)' : 'Debug'}`);
