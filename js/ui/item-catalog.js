import THREE from '../vendor/three-global.js';
import { getCatalogEntries } from './item-catalog-models.js';
import { initI18n, t } from '../core/i18n.js';
import { MYCO_PALETTE as palette } from '../engine/visual-style.js';

initI18n();
document.title = t('catalog.title') + ' · MycoCampus3D';

const byId = id => document.getElementById(id);
const search = byId('item-search');
const category = byId('item-category');
const list = byId('item-list');
const count = byId('item-count');
const canvas = byId('item-canvas');
const stage = byId('stage');
const status = byId('viewer-status');
const spinButton = byId('auto-spin');
const zoomOut = byId('zoom-out');
const zoomIn = byId('zoom-in');
const resetButton = byId('reset-camera');
const partButton = byId('toggle-part');
const controls = [spinButton, zoomOut, zoomIn, resetButton];
const symbols = { equipment: '⚙', tools: '⚒', containers: '▣', cultivation: '🧫', furniture: '▤', garden: '🌱', cosmetics: '✧', mushrooms: '🍄', other: '◇' };

let viewer;
let entries = [];
let selected;
let activeView;
let partOpen = false;

function updatePartButton() {
  partButton.hidden = !activeView?.setOpen;
  if (!partButton.hidden) {
    partButton.textContent = t('catalog.' + (partOpen ? 'close_' : 'open_') + activeView.part);
  }
}

function normalize(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
}

function setStatus(message = '') {
  status.textContent = message;
  status.hidden = !message;
}

function choose(entry) {
  selected = entry;
  for (const button of list.querySelectorAll('button')) {
    if (button.dataset.id === entry?.id) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
  const title = byId('item-title');
  const kind = byId('item-kind');
  const detail = byId('item-detail');
  title.textContent = entry?.name ?? t('catalog.viewer');
  kind.hidden = !entry;
  kind.textContent = entry ? t('catalog.group_' + entry.category) : '';
  detail.hidden = !entry?.detail;
  detail.textContent = entry?.detail ?? '';

  viewer?.clear();
  activeView = null;
  partOpen = false;
  setStatus(!viewer ? t('catalog.webgl') : '');
  let ready = false;
  if (viewer && entry) {
    try {
      const view = entry.view();
      view.setOpen?.(false);
      viewer.show(view.model);
      activeView = view;
      ready = true;
    } catch (error) {
      console.error('Catálogo: erro ao carregar o modelo', entry.id, error);
      setStatus(t('catalog.unavailable'));
    }
  }
  updatePartButton();
  for (const button of controls) button.disabled = !ready;
}

function filterEntries() {
  const query = normalize(search.value).trim().split(/\s+/).filter(Boolean);
  const matches = entries.filter(entry =>
    (!category.value || entry.category === category.value) &&
    query.every(word => entry.searchText.includes(word))
  );
  count.textContent = matches.length ? t('catalog.count', { count: matches.length }) : t('catalog.empty');
  const fragment = document.createDocumentFragment();
  for (const entry of matches) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.id = entry.id;
    const symbol = document.createElement('span');
    symbol.className = 'item-symbol';
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = symbols[entry.category];
    const label = document.createElement('span');
    label.textContent = entry.name;
    button.append(symbol, label);
    button.addEventListener('click', () => {
      choose(entry);
      if (matchMedia('(max-width: 680px)').matches) canvas.scrollIntoView({ block: 'nearest' });
    });
    fragment.append(button);
  }
  list.replaceChildren(fragment);
  const next = matches.includes(selected) ? selected : matches[0];
  if (!next || next !== selected) choose(next);
  else {
    const active = [...list.children].find(button => button.dataset.id === next.id);
    active?.setAttribute('aria-current', 'true');
  }
}

function copyModel(source, root = false) {
  if ((!root && !source.visible) || source.isLight || source.isSprite) return null;
  const material = source.material;
  if (material && !Array.isArray(material) && (!material.visible || !material.colorWrite || material.opacity === 0)) return null;
  let node;
  if (source.isInstancedMesh) {
    node = new THREE.InstancedMesh(source.geometry, material, source.count);
    node.instanceMatrix.copy(source.instanceMatrix);
    if (source.instanceColor) node.instanceColor = source.instanceColor.clone();
  } else if (source.isMesh) {
    node = new THREE.Mesh(source.geometry, material);
  } else if (source.isLineSegments) {
    node = new THREE.LineSegments(source.geometry, material);
  } else if (source.isLine) {
    node = new THREE.Line(source.geometry, material);
  } else {
    node = new THREE.Group();
  }
  node.position.copy(source.position);
  node.quaternion.copy(source.quaternion);
  node.scale.copy(source.scale);
  for (const child of source.children) {
    const copy = copyModel(child);
    if (copy) node.add(copy);
  }
  return node;
}

function createViewer() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, 0.05, 48);
  const pivot = new THREE.Group();
  scene.add(pivot, new THREE.HemisphereLight(palette.daylightFill, palette.bounce, 0.54));
  const key = new THREE.DirectionalLight(palette.daylight, 0.75);
  key.position.set(-3.8, 6, 4.5);
  const edge = new THREE.DirectionalLight(0xcbe0da, 0.33);
  edge.position.set(4, 5, -5);
  scene.add(key, edge);

  const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.71, 0.115, 64),
    new THREE.MeshStandardMaterial({ color: palette.petrol, roughness: 0.9 }));
  scene.add(disk);
  const accent = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.011, 5, 80),
    new THREE.MeshBasicMaterial({ color: 0x83a598, transparent: true, opacity: 0.6 }));
  accent.rotation.x = -Math.PI / 2;
  scene.add(accent);

  const pointers = new Map();
  const target = new THREE.Vector3();
  let pitch = 0.32;
  let yaw = 0.58;
  let zoom = 1;
  let framing = 5;
  let spinning = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = 0;
  let change = true;
  let ready = false;

  function refreshCamera() {
    const distance = framing * zoom;
    const horizontal = distance * Math.cos(pitch);
    camera.position.set(Math.sin(yaw) * horizontal, Math.sin(pitch) * distance, Math.cos(yaw) * horizontal);
    camera.lookAt(target);
    change = true;
  }

  function reset() {
    yaw = 0.58;
    pitch = 0.32;
    zoom = 1;
    pivot.rotation.y = 0;
    refreshCamera();
  }

  function setSpin(value) {
    spinning = value;
    spinButton.setAttribute('aria-pressed', String(value));
    change = true;
  }

  function zoomBy(factor) {
    if (!ready) return;
    zoom = THREE.MathUtils.clamp(zoom * factor, 0.44, 2.7);
    refreshCamera();
  }

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    framing = 4.7 / Math.min(1, camera.aspect);
    refreshCamera();
  }

  function show(original, keepCamera = false) {
    const model = copyModel(original, true);
    if (!model) throw new Error('Modelo vazio');
    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const dimensions = bounds.getSize(new THREE.Vector3());
    const limit = Math.max(dimensions.x, dimensions.y, dimensions.z);
    if (!Number.isFinite(limit) || limit <= 0) throw new Error('Modelo vazio');
    const holder = new THREE.Group();
    const scale = 2.25 / limit;
    holder.scale.setScalar(scale);
    holder.position.copy(bounds.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
    holder.add(model);
    pivot.clear();
    pivot.add(holder);
    const groundY = -dimensions.y * scale / 2 - 0.018;
    disk.position.y = groundY - 0.06;
    accent.position.y = groundY + 0.002;
    ready = true;
    if (keepCamera) {
      setSpin(false);
      refreshCamera();
    } else reset();
  }

  new ResizeObserver(resize).observe(stage);
  THREE.DefaultLoadingManager.onLoad = () => { change = true; };
  setSpin(spinning);
  resize();
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.045, last ? (now - last) * 0.001 : 0);
    last = now;
    if (ready && spinning && pointers.size === 0) {
      pivot.rotation.y += dt * 0.48;
      change = true;
    }
    if (change) {
      renderer.render(scene, camera);
      change = false;
    }
  });

  spinButton.addEventListener('click', () => setSpin(!spinning));
  resetButton.addEventListener('click', reset);
  zoomOut.addEventListener('click', () => zoomBy(1.18));
  zoomIn.addEventListener('click', () => zoomBy(0.85));
  canvas.addEventListener('wheel', event => {
    if (!ready) return;
    event.preventDefault();
    zoomBy(Math.exp(THREE.MathUtils.clamp(event.deltaY, -130, 130) * 0.003));
  }, { passive: false });
  canvas.addEventListener('pointerdown', event => {
    if (!ready || pointers.size >= 2 || event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    const point = pointers.get(event.pointerId);
    if (!point) return;
    const dx = event.clientX - point.x;
    const dy = event.clientY - point.y;
    if (pointers.size === 2) {
      const other = [...pointers.values()].find(p => p !== point);
      const old = Math.hypot(point.x - other.x, point.y - other.y);
      const next = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (old > 8 && next > 8) zoomBy(old / next);
    } else {
      yaw -= dx * 0.014;
      pitch = THREE.MathUtils.clamp(pitch + dy * 0.011, -0.48, 1.34);
      if (dx || dy) setSpin(false);
      refreshCamera();
    }
    point.x = event.clientX;
    point.y = event.clientY;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(event, e => pointers.delete(e.pointerId));
  }
  canvas.addEventListener('keydown', event => {
    if (!ready) return;
    switch (event.key) {
      case 'ArrowLeft': yaw -= 0.15; break;
      case 'ArrowRight': yaw += 0.15; break;
      case 'ArrowUp': pitch = Math.min(1.34, pitch + 0.13); break;
      case 'ArrowDown': pitch = Math.max(-0.48, pitch - 0.13); break;
      case '+': case '=': zoomBy(0.85); break;
      case '-': zoomBy(1.18); break;
      case '0': reset(); break;
      default: return;
    }
    setSpin(false);
    refreshCamera();
    event.preventDefault();
  });

  return {
    show,
    clear() {
      pivot.clear();
      ready = false;
      change = true;
    }
  };
}

try {
  viewer = createViewer();
} catch (error) {
  console.warn('Catálogo: WebGL indisponível.', error);
}

// Let the page paint before building the laboratory models in a separate scene.
setTimeout(() => {
  entries = getCatalogEntries();
  for (const entry of entries) {
    entry.searchText = normalize([entry.name, entry.detail, entry.keywords, t('catalog.group_' + entry.category)].join(' '));
  }
  for (const key of Object.keys(symbols)) {
    if (!entries.some(entry => entry.category === key)) continue;
    category.add(new Option(t('catalog.group_' + key), key));
  }
  const first = entries.find(entry => entry.id === 'grow_tent');
  if (first && !search.value && !category.value) {
    selected = first;
    filterEntries();
    choose(first);
  } else {
    filterEntries();
  }
}, 0);

search.addEventListener('input', filterEntries);
category.addEventListener('change', filterEntries);
partButton.addEventListener('click', () => {
  if (!activeView?.setOpen) return;
  partOpen = !partOpen;
  activeView.setOpen(partOpen);
  viewer.show(activeView.model, true);
  updatePartButton();
});
