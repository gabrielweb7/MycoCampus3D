import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const wwwDir = path.join(root, 'www-apk');
const apkMetaPath = path.join(root, 'assets', 'apk-version.json');
const versionFilePath = path.join(root, 'VERSION');

const appVersion = fs.readFileSync(versionFilePath, 'utf8').trim();
const apkMeta = JSON.parse(fs.readFileSync(apkMetaPath, 'utf8'));
const versionCode = Number(apkMeta.versionCode) || 1;
const versionName = String(apkMeta.versionName || appVersion || '1.0.1').trim();

fs.mkdirSync(wwwDir, { recursive: true });

const iconSrc = path.join(root, 'assets', 'icon-512.png');
const icon192Src = path.join(root, 'assets', 'icon-192.png');
if (fs.existsSync(icon192Src)) {
  fs.copyFileSync(icon192Src, path.join(wwwDir, 'icon-192.png'));
}

const offlineHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>MycoCampus3D</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: radial-gradient(circle at top, #13233d, #0b1220 70%);
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-align: center;
    }
    .card {
      max-width: 380px;
      width: 100%;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(52, 211, 153, 0.35);
      border-radius: 20px;
      padding: 28px 22px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    img { width: 76px; height: 76px; border-radius: 18px; margin-bottom: 12px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { font-size: 14px; line-height: 1.5; color: #cbd5e1; margin: 0 0 20px; }
    button {
      width: 100%;
      border: 0;
      border-radius: 12px;
      padding: 13px 16px;
      background: #10b981;
      color: #052e16;
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="icon-192.png" alt="MycoCampus3D">
    <h1>MycoCampus3D</h1>
    <p>Não foi possível conectar ao servidor do Campus 3D agora. Verifique sua internet e tente novamente.</p>
    <button onclick="window.location.href='https://mycocampus3d.alquimistasmagicos.com.br/'">Tentar conectar novamente</button>
  </div>
</body>
</html>
`;

fs.writeFileSync(path.join(wwwDir, 'index.html'), offlineHtml, 'utf8');
fs.writeFileSync(path.join(wwwDir, 'offline.html'), offlineHtml, 'utf8');

// Sincroniza appendUserAgent em capacitor.config.json com o versionCode atual
const capConfigPath = path.join(root, 'capacitor.config.json');
if (fs.existsSync(capConfigPath)) {
  const capCfg = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));
  capCfg.appendUserAgent = `MycoCampusAPK/${versionCode}`;
  fs.writeFileSync(capConfigPath, JSON.stringify(capCfg, null, 2) + '\n', 'utf8');
}

// Sincroniza versionCode e versionName no android/app/build.gradle quando o projeto Android existir
const buildGradlePath = path.join(root, 'android', 'app', 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  let gradle = fs.readFileSync(buildGradlePath, 'utf8');
  gradle = gradle
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
  fs.writeFileSync(buildGradlePath, gradle, 'utf8');
  console.log(`APK build.gradle sincronizado: versionCode=${versionCode}, versionName="${versionName}"`);
}

// Copia o ícone oficial do jogo para os diretórios mipmap do Android quando existirem
const androidResDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(androidResDir) && fs.existsSync(iconSrc)) {
  const mipmapDirs = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
  for (const dir of mipmapDirs) {
    const targetDir = path.join(androidResDir, dir);
    if (!fs.existsSync(targetDir)) continue;
    const launcherIcon = path.join(targetDir, 'ic_launcher.png');
    const roundIcon = path.join(targetDir, 'ic_launcher_round.png');
    const fgIcon = path.join(targetDir, 'ic_launcher_foreground.png');
    const source = (dir === 'mipmap-mdpi' || dir === 'mipmap-hdpi') && fs.existsSync(icon192Src) ? icon192Src : iconSrc;
    if (fs.existsSync(launcherIcon)) fs.copyFileSync(source, launcherIcon);
    if (fs.existsSync(roundIcon)) fs.copyFileSync(source, roundIcon);
    if (fs.existsSync(fgIcon)) fs.copyFileSync(source, fgIcon);
  }
  console.log('Ícones do MycoCampus3D aplicados em android/app/src/main/res.');
}

console.log(`www-apk preparado (v${versionName}, versionCode ${versionCode}).`);
