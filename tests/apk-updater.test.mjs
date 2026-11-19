import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkForApkUpdate, isRunningInApk } from '../js/services/apk-updater.js';
import {
  isIosDevice,
  isFullscreenActive,
  toggleCampusFullscreen
} from '../js/ui/dom-helpers.js';

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
}

test('apk-version.json, capacitor.config.json e build.gradle estão válidos e sincronizados', () => {
  const meta = JSON.parse(fs.readFileSync('assets/apk-version.json', 'utf8'));
  assert.ok(Number.isInteger(meta.versionCode) && meta.versionCode >= 1);
  assert.match(meta.versionName, /^\d+\.\d+\.\d+$/);
  assert.equal(meta.apkUrl, 'https://mycocampus3d.alquimistasmagicos.com.br/MycoCampus3D.apk');

  const cap = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
  assert.equal(cap.appId, 'br.com.alquimistasmagicos.mycocampus3d');
  assert.equal(cap.server.url, 'https://mycocampus3d.alquimistasmagicos.com.br/');
  assert.equal(cap.appendUserAgent, `MycoCampusAPK/${meta.versionCode}`);

  const gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
  assert.ok(gradle.includes(`versionCode ${meta.versionCode}`), 'versionCode do build.gradle desatualizado');
  assert.ok(gradle.includes(`versionName "${meta.versionName}"`), 'versionName do build.gradle desatualizado');

  const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  assert.ok(manifest.includes('android:scheme="mycocampus3d"'), 'AndroidManifest deve registrar deep link mycocampus3d://');

  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert.ok(indexHtml.includes("window.location.replace('android.html'"), 'index.html deve redirecionar navegador Android para android.html');
  assert.ok(indexHtml.includes('MycoCampusAPK'), 'index.html deve liberar o User-Agent do APK');

  assert.ok(fs.existsSync('android.html'), 'android.html deve existir');
  assert.ok(fs.existsSync('ios.html'), 'ios.html deve existir');
  const cpanel = fs.readFileSync('.cpanel.yml', 'utf8');
  assert.ok(cpanel.includes('android.html'), '.cpanel.yml deve incluir android.html no deploy');
  assert.ok(cpanel.includes('ios.html'), '.cpanel.yml deve incluir ios.html no deploy');
  assert.ok(indexHtml.includes("window.location.replace('ios.html'"), 'index.html deve direcionar navegadores iOS não-Safari/não-PWA para ios.html');
});

test('isRunningInApk retorna false fora do APK e true com Capacitor nativo', () => {
  const prevWin = globalThis.window;
  try {
    globalThis.window = {};
    assert.equal(isRunningInApk(), false);

    globalThis.window = { Capacitor: { isNativePlatform: () => true } };
    assert.equal(isRunningInApk(), true);
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
  }
});

test('checkForApkUpdate detecta versão mais nova no servidor e respeita adiamento não-obrigatório', async () => {
  const prevWin = globalThis.window;
  const prevFetch = globalThis.fetch;
  const prevLs = globalThis.localStorage;
  const prevDoc = globalThis.document;

  try {
    globalThis.localStorage = createLocalStorageMock();
    globalThis.document = undefined;
    globalThis.window = {
      MYCO_VERSION: '1.0.1',
      Capacitor: {
        isNativePlatform: () => true,
        Plugins: {
          App: {
            getInfo: async () => ({ version: '1.0.1', build: '1' })
          }
        }
      }
    };

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        versionCode: 2,
        versionName: '1.0.2',
        apkUrl: 'https://mycocampus3d.alquimistasmagicos.com.br/MycoCampus3D.apk',
        notes: 'Melhoria de FPS no WebView',
        mandatory: false
      })
    });

    const first = await checkForApkUpdate();
    assert.equal(first.inApk, true);
    assert.equal(first.updateAvailable, true);
    assert.equal(first.suppressed, undefined);
    assert.equal(first.remote.versionCode, 2);

    globalThis.localStorage.setItem('myco_apk_update_dismissed_vc', '2');
    const snoozed = await checkForApkUpdate();
    assert.equal(snoozed.updateAvailable, true);
    assert.equal(snoozed.suppressed, true);

    const forced = await checkForApkUpdate({ forcePrompt: true });
    assert.equal(forced.updateAvailable, true);
    assert.equal(forced.suppressed, undefined);
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = prevFetch;
    if (prevLs === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLs;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }
});

test('iPhone (iOS Safari sem requestFullscreen nativo) ativa modo imersivo e abre assistente de Tela Cheia', () => {
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const navDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        maxTouchPoints: 5,
        standalone: false
      },
      configurable: true
    });

    const bodyClasses = new Set();
    const modalClasses = new Set(['hidden']);
    const iosModal = {
      classList: {
        remove: (c) => modalClasses.delete(c),
        add: (c) => modalClasses.add(c),
        contains: (c) => modalClasses.has(c)
      }
    };

    globalThis.window = {
      navigator: globalThis.navigator,
      scrollTo: () => {},
      dispatchEvent: () => {}
    };
    globalThis.document = {
      documentElement: {}, // Sem requestFullscreen (comportamento real do iPhone Safari)
      body: {
        classList: {
          toggle: (c, force) => {
            const next = force !== undefined ? Boolean(force) : !bodyClasses.has(c);
            if (next) bodyClasses.add(c);
            else bodyClasses.delete(c);
            return next;
          },
          contains: (c) => bodyClasses.has(c)
        }
      },
      getElementById: (id) => (id === 'ios-fullscreen-modal' ? iosModal : null)
    };

    assert.equal(isIosDevice(), true);
    assert.equal(isFullscreenActive(), false);

    toggleCampusFullscreen({ explicitUserClick: true });
    assert.equal(bodyClasses.has('ios-immersive-fullscreen'), true, 'deve ativar classe ios-immersive-fullscreen no body');
    assert.equal(isFullscreenActive(), true);
    assert.equal(modalClasses.has('hidden'), false, 'deve abrir o modal assistente de Tela Cheia no iPhone Safari');

    const indexHtml = fs.readFileSync('index.html', 'utf8');
    assert.ok(indexHtml.includes('id="ios-fullscreen-modal"'), 'index.html deve conter modal de Tela Cheia para iPhone');
    const gameCss = fs.readFileSync('css/game.css', 'utf8');
    assert.ok(gameCss.includes('font-size: 16px !important'), 'css/game.css deve bloquear auto-zoom de inputs no iOS');
    const inputCtrl = fs.readFileSync('js/systems/input-controller.js', 'utf8');
    assert.ok(inputCtrl.includes('el.closest(\'[id$="-modal"]\')'), 'input-controller.js deve proteger todos os modais contra toque vazando para câmera 3D');
    const audioEng = fs.readFileSync('js/services/audio-engine.js', 'utf8');
    assert.ok(audioEng.includes("state === 'interrupted'"), 'audio-engine.js deve recuperar estado interrupted do iOS WebKit');
  } finally {
    if (navDesc) Object.defineProperty(globalThis, 'navigator', navDesc);
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }
});
