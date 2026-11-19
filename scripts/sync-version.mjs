import fs from 'node:fs';

const version = fs.readFileSync('VERSION', 'utf8').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`VERSION inválida: "${version}"`);
}

// 1. package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = version;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// 2. sw.js
let sw = fs.readFileSync('sw.js', 'utf8');
sw = sw
  .replace(/const CACHE_NAME = 'mycocampus-v[^']+';/, `const CACHE_NAME = 'mycocampus-v${version}';`)
  .replace(/'css\/game\.css\?v=[^']+'/, `'css/game.css?v=${version}'`);
fs.writeFileSync('sw.js', sw, 'utf8');

// 3. index.html
let html = fs.readFileSync('index.html', 'utf8');
html = html
  .replace(/href="css\/game\.css\?v=[^"]+"/, `href="css/game.css?v=${version}"`)
  .replace(/(id="app-version"[^>]*>)v[^<]+(<\/span>)/, `$1v${version}$2`)
  .replace(/window\.MYCO_VERSION = '[^']+';/, `window.MYCO_VERSION = '${version}';`)
  .replace(/src="js\/main\.js\?v=[^"]+"/, `src="js/main.js?v=${version}"`);
fs.writeFileSync('index.html', html, 'utf8');

console.log(`Versão web sincronizada automaticamente para v${version} em package.json, sw.js e index.html.`);
