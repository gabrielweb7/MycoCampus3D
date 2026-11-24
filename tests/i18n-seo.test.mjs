import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SUPPORTED_LANGS,
  TRANSLATIONS,
  normalizeLang,
  setLanguage,
  getLanguage,
  t
} from '../js/core/i18n.js';

test('i18n: todas as chaves de pt-BR existem em en e es', () => {
  const baseKeys = Object.keys(TRANSLATIONS['pt-BR']);
  assert.ok(baseKeys.length > 40);
  for (const lang of SUPPORTED_LANGS) {
    for (const key of baseKeys) {
      assert.ok(
        typeof TRANSLATIONS[lang][key] === 'string' && TRANSLATIONS[lang][key].length > 0,
        `Chave "${key}" ausente ou vazia no idioma "${lang}"`
      );
    }
  }
});

test('i18n: normalizeLang e setLanguage alternam corretamente entre pt-BR, en e es', () => {
  assert.equal(normalizeLang('pt-BR'), 'pt-BR');
  assert.equal(normalizeLang('pt_PT'), 'pt-BR');
  assert.equal(normalizeLang('en-US'), 'en');
  assert.equal(normalizeLang('es-ES'), 'es');
  assert.equal(normalizeLang('es-419'), 'es');
  assert.equal(normalizeLang('fr-FR'), null);

  setLanguage('en', { persist: false, apply: false });
  assert.equal(getLanguage(), 'en');
  assert.ok(t('lobby.enter_btn').includes('Enter 3D Campus'));
  assert.equal(t('inventory.title'), 'Quick inventory');

  setLanguage('es', { persist: false, apply: false });
  assert.equal(getLanguage(), 'es');
  assert.ok(t('lobby.enter_btn').includes('Entrar al Campus 3D'));
  assert.equal(t('inventory.title'), 'Inventario rápido');

  setLanguage('pt-BR', { persist: false, apply: false });
  assert.equal(getLanguage(), 'pt-BR');
  assert.ok(t('lobby.enter_btn').includes('Entrar no Campus 3D'));
  assert.equal(t('inventory.title'), 'Inventário rápido');
});

test('SEO: robots.txt, sitemap.xml e index.html possuem configuração multi-idioma completa', () => {
  const robots = fs.readFileSync('robots.txt', 'utf8');
  assert.ok(robots.includes('Sitemap: https://mycocampus3d.alquimistasmagicos.com.br/sitemap.xml'));
  assert.ok(robots.includes('Allow: /'));

  const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
  assert.ok(sitemap.includes('hreflang="pt-BR"'));
  assert.ok(sitemap.includes('hreflang="en"'));
  assert.ok(sitemap.includes('hreflang="es"'));
  assert.ok(sitemap.includes('hreflang="x-default"'));

  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.includes('hreflang="pt-BR"'));
  assert.ok(html.includes('hreflang="en"'));
  assert.ok(html.includes('hreflang="es"'));
  assert.ok(html.includes('og:locale:alternate'));
  assert.ok(html.includes('"@type": "VideoGame"'));
  assert.ok(html.includes('id="settings-modal"'));
  assert.ok(html.includes('id="btn-open-settings"'));
});
