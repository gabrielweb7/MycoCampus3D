import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const JS_DIR = path.join(ROOT, 'js');
const VENDOR_DIR = path.join(JS_DIR, 'vendor');

function listJsFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (full === VENDOR_DIR) continue;
    if (ent.isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (ent.isFile() && ent.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out.sort();
}

function stripCommentsPreservingStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c;
      out += c;
      i++;
      while (i < n) {
        const ch = src[i];
        out += ch;
        if (ch === '\\') {
          i++;
          if (i < n) out += src[i];
        } else if (ch === q) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function parseModuleExports(code) {
  const names = new Set();
  const reExportAll = [];
  const reExportNamed = [];

  for (const m of code.matchAll(/\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }
  for (const m of code.matchAll(/\bexport\s+class\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }
  for (const m of code.matchAll(/\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }
  if (/\bexport\s+default\b/.test(code)) {
    names.add('default');
  }
  for (const m of code.matchAll(/\bexport\s*\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/g)) {
    const list = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    const fromSpec = m[2];
    for (const item of list) {
      const asMatch = item.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      const exported = asMatch ? asMatch[2] : item;
      const local = asMatch ? asMatch[1] : item;
      names.add(exported);
      if (fromSpec) {
        reExportNamed.push({ spec: fromSpec, local, exported });
      }
    }
  }
  for (const m of code.matchAll(/\bexport\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    reExportAll.push(m[1]);
  }
  return { names, reExportAll, reExportNamed };
}

function parseModuleImports(code) {
  const imports = [];
  // Matches: import ... from '...'; without crossing semicolons or unrelated quotes
  const fromRe = /\bimport\s+([^;'"]+?)\s+from\s+['"]([^'"]+)['"]\s*;/g;
  for (const m of code.matchAll(fromRe)) {
    const clause = m[1].trim();
    const spec = m[2];
    const named = [];
    let hasDefault = false;
    let hasNamespace = false;
    const braceMatch = clause.match(/\{([\s\S]*?)\}/);
    if (braceMatch) {
      for (const raw of braceMatch[1].split(',')) {
        const clean = raw.trim();
        if (!clean) continue;
        const orig = clean.split(/\s+as\s+/)[0].trim();
        if (orig) named.push(orig);
      }
    }
    const beforeBrace = clause.replace(/\{[\s\S]*?\}/, '').replace(/\*\s+as\s+[A-Za-z_$][\w$]*/, () => {
      hasNamespace = true;
      return '';
    }).replace(/,/g, '').trim();
    if (beforeBrace) hasDefault = true;
    imports.push({ spec, named, hasDefault, hasNamespace });
  }
  const sideEffectRe = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]\s*;/g;
  for (const m of code.matchAll(sideEffectRe)) {
    imports.push({ spec: m[1], named: [], hasDefault: false, hasNamespace: false });
  }
  return imports;
}

test('todos os imports e exports estáticos entre módulos ES de js/ resolvem sem erros e sem arquivos órfãos', () => {
  const files = listJsFiles(JS_DIR);
  const meta = new Map();

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const clean = stripCommentsPreservingStrings(raw);
    meta.set(file, {
      raw,
      imports: parseModuleImports(clean),
      exports: parseModuleExports(clean)
    });
  }

  function resolveExportSet(file, seen = new Set()) {
    if (seen.has(file) || !meta.has(file)) return new Set();
    seen.add(file);
    const info = meta.get(file);
    const out = new Set(info.exports.names);
    for (const rel of info.exports.reExportAll) {
      const target = path.resolve(path.dirname(file), rel);
      for (const sym of resolveExportSet(target, seen)) {
        if (sym !== 'default') out.add(sym);
      }
    }
    return out;
  }

  const adj = new Map();
  for (const file of files) {
    const info = meta.get(file);
    const edges = [];
    for (const imp of info.imports) {
      assert.ok(imp.spec.startsWith('.'), `Import não relativo inesperado em ${path.relative(ROOT, file)}: ${imp.spec}`);
      const target = path.resolve(path.dirname(file), imp.spec);
      assert.ok(fs.existsSync(target), `Arquivo importado inexistente: ${path.relative(ROOT, file)} -> ${imp.spec}`);
      if (!target.startsWith(VENDOR_DIR)) {
        edges.push(target);
        const exported = resolveExportSet(target);
        for (const sym of imp.named) {
          assert.ok(
            exported.has(sym),
            `Símbolo "${sym}" importado em ${path.relative(ROOT, file)} não é exportado por ${path.relative(ROOT, target)}`
          );
        }
        if (imp.hasDefault) {
          assert.ok(
            exported.has('default'),
            `Default export ausente em ${path.relative(ROOT, target)} (importado por ${path.relative(ROOT, file)})`
          );
        }
      }
    }
    for (const reSpec of [...info.exports.reExportAll, ...info.exports.reExportNamed.map((r) => r.spec)]) {
      const target = path.resolve(path.dirname(file), reSpec);
      assert.ok(fs.existsSync(target), `Arquivo re-exportado inexistente: ${path.relative(ROOT, file)} -> ${reSpec}`);
      if (!target.startsWith(VENDOR_DIR)) edges.push(target);
    }
    adj.set(file, edges);
  }

  const entryPages = ['index.html', 'catalogo.html'];
  const queue = entryPages.flatMap(page => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    return [...html.matchAll(/<script[^>]*type="module"[^>]*src="(js\/[^"?]+)(?:\?[^"]*)?"/g)]
      .map(match => path.join(ROOT, match[1]));
  });
  assert.ok(queue.includes(path.join(JS_DIR, 'main.js')));
  assert.ok(queue.includes(path.join(JS_DIR, 'ui', 'item-catalog.js')));
  const visited = new Set(queue);
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const nxt of (adj.get(cur) || [])) {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push(nxt);
      }
    }
  }
  const orphans = files.filter((f) => !visited.has(f)).map((f) => path.relative(ROOT, f));
  assert.deepEqual(orphans, [], `Módulos órfãos sem entrada no jogo ou no catálogo: ${orphans.join(', ')}`);
});

test('proteção contra regressões de referências corrigidas na refatoração', () => {
  const interSys = fs.readFileSync(path.join(JS_DIR, 'systems/interaction-system.js'), 'utf8');
  assert.match(interSys, /\btriggerMagicCubensisEffect\b/);
  assert.match(interSys, /\bbeginHeldItemPlacement\b/);
  assert.match(interSys, /from\s+['"]\.\/mycoteca\.js['"]/);
  assert.match(interSys, /from\s+['"]\.\/held-item-placement\.js['"]/);

  const spawnCont = fs.readFileSync(path.join(JS_DIR, 'items/spawn-containers.js'), 'utf8');
  assert.match(spawnCont, /\bisAsepticWorkArea\b/);
  assert.match(spawnCont, /from\s+['"]\.\/laminar-hood\.js['"]/);

  const appBoot = fs.readFileSync(path.join(JS_DIR, 'ui/app-boot.js'), 'utf8');
  assert.match(appBoot, /\bevents\b/);
  assert.match(appBoot, /\binitPwaFeatures\b/);

  const cooker = fs.readFileSync(path.join(JS_DIR, 'items/pressure-cooker.js'), 'utf8');
  assert.match(cooker, /ctx\.burnerDevices/);

  // Garante que nenhum módulo acesse `THREE.` no escopo de módulo antes de `const THREE = ...` (evita TDZ no boot)
  const jsFiles = listJsFiles(JS_DIR).filter((f) => !f.startsWith(VENDOR_DIR));
  for (const jf of jsFiles) {
    const src = fs.readFileSync(jf, 'utf8');
    const declMatch = src.match(/^(?:const|let)\s+THREE\s*=/m);
    if (!declMatch) continue;
    const beforeDecl = src.slice(0, declMatch.index)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.equal(
      /\bnew\s+THREE\./.test(beforeDecl),
      false,
      `Uso de "new THREE." antes de declarar THREE em ${path.relative(ROOT, jf)}`
    );
  }
  assert.doesNotMatch(cooker, /ctx\.burnerStations/);

  const opt = fs.readFileSync(path.join(JS_DIR, 'engine/scene-optimizer.js'), 'utf8');
  assert.match(opt, /hover3dBadge\.sprite/);
  assert.match(opt, /cw\.mesh\s*\|\|\s*cw\.group/);
  assert.match(opt, /cp\.group\s*\|\|\s*cp\.mesh/);
  assert.match(opt, /sim\.pastureBees/);
  assert.match(opt, /sim\.beehives/);
  assert.match(opt, /sim\.campusFlowers/);
  assert.match(opt, /sim\.beehiveHitMeshes/);
  assert.match(opt, /sim\.flowerHitMeshes/);
});
