/**
 * MycoCampus3D — Diegetic 3D World-Space Hover Badge
 * Renderiza um crachá holográfico diegético em 3D diretamente sobre o objeto
 * focado pela mira, exibindo Nome, Parâmetros/Estado em tempo real e Ação Contextual,
 * eliminando poluição e sobreposição de textos 2D na HUD.
 */

const THREE = window.THREE;

export function createHover3dBadge(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 9999;
  sprite.visible = false;
  sprite.scale.set(1.5, 0.52, 1);

  if (scene) {
    scene.add(sprite);
  }

  return {
    sprite,
    canvas,
    ctx,
    texture,
    currentKey: '',
    visible: false,
    basePos: new THREE.Vector3(),
    currentPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3()
  };
}

function roundRect(ctx, x, y, w, h, r) {
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

/**
 * Converte um prompt textual e objeto alvo em título, parâmetros e ação formatados.
 */
export function formatHoverInfo(prompt, targetObj) {
  if (!prompt) return null;

  let title = '';
  let params = '';
  let action = prompt.trim();

  // 1. Extrai parâmetros entre parênteses
  const parenMatch = action.match(/\(([^)]+)\)/);
  if (parenMatch) {
    params = parenMatch[1].trim();
    action = action.replace(/\s*\([^)]+\)/g, '').trim();
  }

  // 2. Extrai traço separador " — "
  if (action.includes(' — ')) {
    const parts = action.split(' — ');
    action = parts[0].trim();
    if (!params) {
      params = parts[1].trim();
    } else {
      params = params + ' • ' + parts[1].trim();
    }
  }

  // 3. Define título com base no alvo ou ação
  if (targetObj && (targetObj.label || targetObj.name)) {
    title = targetObj.label || targetObj.name;
    // Garante que se o prompt tem emoji e o título não tem, preserva o emoji
    const emojiMatch = prompt.match(/^(\p{Extended_Pictographic}|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83E[\uDD00-\uDDFF]|\u2600-\u27BF)/u);
    if (emojiMatch && !title.startsWith(emojiMatch[0])) {
      title = emojiMatch[0] + ' ' + title;
    }
  } else {
    // Tenta separar emoji e texto
    title = action;
  }

  // Limpa prefixos redundantes de ação para manter o crachá limpo
  if (action === title && params) {
    action = 'Interagir';
  }

  return { title, params, action };
}

/**
 * Renderiza o cartão diegético no canvas da textura
 */
function renderBadgeTexture(badgeState, title, params, action) {
  const { canvas, ctx, texture } = badgeState;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Fundo com vidro escuro translúcido (Glassmorphism sci-fi)
  ctx.save();
  ctx.fillStyle = 'rgba(10, 18, 32, 0.90)';
  roundRect(ctx, 10, 8, w - 20, h - 16, 22);
  ctx.fill();

  // Borda neon degradê esmeralda/ciano com brilho
  const grad = ctx.createLinearGradient(10, 8, w - 20, h - 16);
  grad.addColorStop(0, 'rgba(52, 211, 153, 0.9)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0.9)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = 'rgba(52, 211, 153, 0.6)';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();

  // Divisor sutil
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(30, params ? 116 : 96);
  ctx.lineTo(w - 30, params ? 116 : 96);
  ctx.stroke();

  // Linha 1: Título do Objeto (Branco Brilhante)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Segoe UI", Roboto, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const displayTitle = title.length > 30 ? title.slice(0, 29) + '…' : title;
  ctx.fillText(displayTitle, w / 2, params ? 44 : 54);

  // Linha 2: Parâmetros / Estado em tempo real (Ciano Celeste)
  if (params) {
    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 20px "Segoe UI", Roboto, system-ui, sans-serif';
    const displayParams = params.length > 38 ? params.slice(0, 37) + '…' : params;
    ctx.fillText(displayParams, w / 2, 82);
  }

  // Linha 3: Ação contextual (Âmbar / Menta de alto contraste)
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 22px "Segoe UI", Roboto, system-ui, sans-serif';
  const displayAction = action.length > 34 ? action.slice(0, 33) + '…' : action;
  ctx.fillText('👉 ' + displayAction, w / 2, params ? 148 : 138);

  texture.needsUpdate = true;
}

/**
 * Atualiza o crachá 3D a cada frame de hover
 */
export function updateHover3dBadge(badgeState, data, camera, now) {
  if (!badgeState || !badgeState.sprite) return;

  if (!data || !data.visible || !data.title || !data.worldPos) {
    badgeState.sprite.visible = false;
    badgeState.visible = false;
    badgeState.currentKey = '';
    return;
  }

  const { title, params, action, worldPos } = data;
  const key = `${title}|${params}|${action}`;

  if (badgeState.currentKey !== key) {
    badgeState.currentKey = key;
    renderBadgeTexture(badgeState, title, params, action);
  }

  // Posição base acima do objeto com leve levitação senoidal
  badgeState.targetPos.copy(worldPos);
  const floatOffset = Math.sin((now || performance.now()) * 0.0035) * 0.035;

  if (!badgeState.visible) {
    // Primeiro frame visível: salta direto para a posição
    badgeState.currentPos.copy(badgeState.targetPos);
  } else {
    // Lerp suave para não vibrar se a mira oscilar
    badgeState.currentPos.lerp(badgeState.targetPos, 0.35);
  }

  badgeState.sprite.position.copy(badgeState.currentPos);
  badgeState.sprite.position.y += floatOffset;

  // Escala dinâmica adaptada à distância da câmera (mantém legibilidade perfeita de 0.8m a 6m)
  if (camera) {
    const dist = camera.position.distanceTo(badgeState.sprite.position);
    const s = Math.max(1.05, Math.min(2.5, dist * 0.38));
    badgeState.sprite.scale.set(s * 1.5, s * 0.53, 1);

    // Evita que o crachá 3D projete atrás da barra de menu superior (#hud-top-bar)
    // Projeta em coordenadas de tela NDC (-1 a +1)
    const _proj = new THREE.Vector3().copy(badgeState.sprite.position).project(camera);
    if (_proj.y > 0.42 && _proj.z < 1.0) {
      // Rebaixa suavemente a altura 3D para manter o crachá abaixo da barra superior
      const pullDown = (_proj.y - 0.42) * dist * 0.55;
      badgeState.sprite.position.y -= pullDown;
    }
  }

  badgeState.sprite.visible = true;
  badgeState.visible = true;
}

export function hideHover3dBadge(badgeState) {
  if (!badgeState || !badgeState.sprite) return;
  badgeState.sprite.visible = false;
  badgeState.visible = false;
  badgeState.currentKey = '';
}
