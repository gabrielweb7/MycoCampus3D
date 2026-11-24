/**
 * MycoCampus3D — Texturas Procedurais & Fábrica de Primitivas 3D
 */
const THREE = window.THREE;

export const snowableEntries = [];
let texBrick = null;
let texPaving = null;
let texWood = null;
let texBark = null;
let texWater = null;
let groundTextures = null;

export function getGroundTextures() {
  if (groundTextures) return groundTextures;
  const loader = new THREE.TextureLoader();
  function loadTile(file) {
    const texture = loader.load('assets/textures/' + file);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.userData.shared = true;
    return texture;
  }
  groundTextures = { grass: loadTile('campus-grass.jpg'), dirt: loadTile('village-dirt.jpg') };
  return groundTextures;
}

export function registerSnowable(mat) {
  if (mat && mat.color && !mat._snowRegistered) {
    mat._snowRegistered = true;
    snowableEntries.push({ mat, base: mat.color.clone() });
  }
  return mat;
}

export function createProceduralTextures() {
  // 1. Tijolinho à vista
  const bc = document.createElement('canvas');
  bc.width = 256; bc.height = 256;
  const bctx = bc.getContext('2d');
  bctx.fillStyle = '#9e9589';
  bctx.fillRect(0, 0, 256, 256);
  const brickPalette = ['#8c4632', '#7a3b29', '#994e38', '#6f3424', '#85422f'];
  const rows = 8, cols = 4, bh = 256 / rows, bw = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    for (let c = -1; c <= cols; c++) {
      bctx.fillStyle = brickPalette[(r * 5 + c + 10) % brickPalette.length];
      bctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
    }
  }
  texBrick = new THREE.CanvasTexture(bc);
  texBrick.colorSpace = THREE.SRGBColorSpace;
  texBrick.wrapS = THREE.RepeatWrapping;
  texBrick.wrapT = THREE.RepeatWrapping;

  // 2. Bloquete da praça
  const pc = document.createElement('canvas');
  pc.width = 256; pc.height = 256;
  const pctx = pc.getContext('2d');
  pctx.fillStyle = '#8b8175';
  pctx.fillRect(0, 0, 256, 256);
  const pavePalette = ['#bfb1a0', '#b2a392', '#c8bba9', '#a89a8a'];
  for (let pr = 0; pr < 16; pr++) {
    const poff = (pr % 2) * 16;
    for (let pcCol = -1; pcCol < 9; pcCol++) {
      pctx.fillStyle = pavePalette[(pr * 3 + pcCol + 20) % pavePalette.length];
      pctx.fillRect(pcCol * 32 + poff + 1.5, pr * 16 + 1.5, 29, 13);
    }
  }
  texPaving = new THREE.CanvasTexture(pc);
  texPaving.colorSpace = THREE.SRGBColorSpace;
  texPaving.wrapS = THREE.RepeatWrapping;
  texPaving.wrapT = THREE.RepeatWrapping;
  texPaving.repeat.set(16, 18);

  // 3. Madeira ripada
  const wc = document.createElement('canvas');
  wc.width = 128; wc.height = 128;
  const wctx = wc.getContext('2d');
  wctx.fillStyle = '#6b4226';
  wctx.fillRect(0, 0, 128, 128);
  const woodCols = ['#8b5a2b', '#7a4b22', '#966332', '#6f421d'];
  for (let i = 0; i < 8; i++) {
    wctx.fillStyle = woodCols[i % woodCols.length];
    wctx.fillRect(i * 16 + 1, 0, 14, 128);
  }
  texWood = new THREE.CanvasTexture(wc);
  texWood.colorSpace = THREE.SRGBColorSpace;
  texWood.wrapS = THREE.RepeatWrapping;
  texWood.wrapT = THREE.RepeatWrapping;

  const barkCanvas = document.createElement('canvas');
  barkCanvas.width = barkCanvas.height = 64;
  const bark = barkCanvas.getContext('2d');
  bark.fillStyle = '#aa8d76';
  bark.fillRect(0, 0, 64, 64);
  for (let x = 1; x < 64; x += 4) {
    bark.strokeStyle = x % 3 === 0 ? '#735747' : (x % 19 === 0 ? '#bfa28b' : '#95806b');
    bark.lineWidth = x % 7 === 0 ? 2.1 : 1;
    bark.beginPath();
    for (let y = 0; y <= 64; y += 4) {
      const wobble = Math.sin(y * Math.PI / 32 + x) * 1.3 + Math.sin(y * Math.PI / 16) * 0.4;
      if (y === 0) bark.moveTo(x + wobble, y);
      else bark.lineTo(x + wobble, y);
    }
    bark.stroke();
  }
  texBark = new THREE.CanvasTexture(barkCanvas);
  texBark.colorSpace = THREE.SRGBColorSpace;
  texBark.wrapS = texBark.wrapT = THREE.RepeatWrapping;
  texBark.userData.shared = true;

  // 4. Água cristalina com cáusticas
  const watC = document.createElement('canvas');
  watC.width = 256; watC.height = 256;
  const watCtx = watC.getContext('2d');
  watCtx.fillStyle = '#0369a1';
  watCtx.fillRect(0, 0, 256, 256);
  for (let wi = 0; wi < 48; wi++) {
    const wx = (wi * 53 + 17) % 256;
    const wy = (wi * 79 + 29) % 256;
    const wr = 14 + (wi % 5) * 7;
    watCtx.strokeStyle = wi % 2 === 0 ? 'rgba(186, 230, 253, 0.26)' : 'rgba(56, 189, 248, 0.30)';
    watCtx.lineWidth = 2.0;
    [-256, 0, 256].forEach((ox) => {
      [-256, 0, 256].forEach((oy) => {
        if (wx + ox < -50 || wx + ox > 306 || wy + oy < -50 || wy + oy > 306) return;
        watCtx.beginPath();
        watCtx.ellipse(wx + ox, wy + oy, wr * 1.25, wr * 0.62, (wi % 4) * 0.45, 0, Math.PI * 2);
        watCtx.stroke();
      });
    });
  }
  for (let wj = 0; wj < 24; wj++) {
    const bx = (wj * 67 + 11) % 256;
    const by = (wj * 43 + 19) % 256;
    const br = 3 + (wj % 3) * 2.5;
    watCtx.fillStyle = 'rgba(224, 242, 254, 0.18)';
    watCtx.beginPath();
    watCtx.arc(bx, by, br, 0, Math.PI * 2);
    watCtx.fill();
  }
  texWater = new THREE.CanvasTexture(watC);
  texWater.colorSpace = THREE.SRGBColorSpace;
  texWater.wrapS = THREE.RepeatWrapping;
  texWater.wrapT = THREE.RepeatWrapping;
  texWater.repeat.set(4, 4);

  return { texBrick, texPaving, texWood, texBark, texWater };
}

export function getTextures() {
  return { texBrick, texPaving, texWood, texBark, texWater };
}

const _brickMatCache = new Map();
const _woodMatCache = new Map();
const _boxMatCache = new Map();

export function brickMat(repX, repY) {
  const rx = repX || 2;
  const ry = repY || 2;
  const key = rx + '|' + ry;
  let mat = _brickMatCache.get(key);
  if (!mat) {
    const t = texBrick.clone();
    t.needsUpdate = true;
    t.repeat.set(rx, ry);
    mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.86, metalness: 0.04 });
    _brickMatCache.set(key, mat);
  }
  return mat;
}

export function woodMat(repX, repY) {
  const rx = repX || 2;
  const ry = repY || 1;
  const key = rx + '|' + ry;
  let mat = _woodMatCache.get(key);
  if (!mat) {
    const t = texWood.clone();
    t.needsUpdate = true;
    t.repeat.set(rx, ry);
    mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.78, metalness: 0.05 });
    _woodMatCache.set(key, mat);
  }
  return mat;
}

export function makeBox(w, h, d, colorOrMat, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  let mat;
  if (colorOrMat && colorOrMat.isMaterial) {
    mat = colorOrMat;
  } else {
    const r = opts.roughness !== undefined ? opts.roughness : 0.7;
    const met = opts.metalness !== undefined ? opts.metalness : 0.1;
    const tr = !!opts.transparent;
    const op = opts.opacity !== undefined ? opts.opacity : 1.0;
    const em = opts.emissive || 0x000000;
    const ei = opts.emissiveIntensity || 0;
    if (opts.uniqueMat) {
      mat = new THREE.MeshStandardMaterial({
        color: colorOrMat,
        roughness: r,
        metalness: met,
        transparent: tr,
        opacity: op,
        emissive: em,
        emissiveIntensity: ei
      });
    } else {
      const mKey = `${colorOrMat}|${r}|${met}|${tr ? 1 : 0}|${op}|${em}|${ei}`;
      mat = _boxMatCache.get(mKey);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          color: colorOrMat,
          roughness: r,
          metalness: met,
          transparent: tr,
          opacity: op,
          emissive: em,
          emissiveIntensity: ei
        });
        _boxMatCache.set(mKey, mat);
      }
    }
  }
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = !opts.noShadow;
  m.receiveShadow = true;
  return m;
}

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function updateTextSprite(sp, text, colorHex) {
  var tex = sp.material.map;
  var canvas = tex.image;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!text) { tex.needsUpdate = true; return; }
  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  roundRectPath(ctx, 16, 12, 480, 72, 24);
  ctx.fill();
  ctx.fillStyle = colorHex || '#ffffff';
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 30), 256, 48);
  tex.needsUpdate = true;
}

export function makeTextSprite(text, colorHex) {
  var canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  var tex = new THREE.CanvasTexture(canvas);
  var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  var sp = new THREE.Sprite(mat);
  sp.scale.set(2.2, 0.42, 1);
  updateTextSprite(sp, text, colorHex);
  return sp;
}
