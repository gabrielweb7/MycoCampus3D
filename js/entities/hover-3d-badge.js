/**
 * MycoCampus3D — Diegetic 3D World-Space Hover Badge
 * Renderiza um crachá holográfico diegético em 3D diretamente sobre o objeto
 * focado pela mira, exibindo Nome, Parâmetros/Estado em tempo real e Ação Contextual,
 * eliminando poluição e sobreposição de textos 2D na HUD.
 */

const THREE = window.THREE;
const _tmpBadgeProj = THREE ? new THREE.Vector3() : null;

export function createHover3dBadge(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 250;
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
  sprite.scale.set(0.55, 0.17, 1);

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

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = cur + ' ' + words[i];
    if (ctx.measureText(test).width <= maxWidth) {
      cur = test;
    } else {
      lines.push(cur);
      cur = words[i];
      if (maxLines && lines.length >= maxLines - 1) {
        cur = words.slice(i).join(' ');
        break;
      }
    }
  }
  lines.push(cur);
  return lines;
}

/**
 * Renderiza o cartão diegético no canvas da textura (texto completo, sem cortes "…")
 */
function renderBadgeTexture(badgeState, title, params, action) {
  const { canvas, ctx, texture } = badgeState;
  const w = canvas.width;
  const h = canvas.height;
  const maxTextW = w - 56;

  ctx.clearRect(0, 0, w, h);

  // Fundo com vidro escuro translúcido (Glassmorphism sci-fi)
  ctx.save();
  ctx.fillStyle = 'rgba(10, 16, 28, 0.92)';
  roundRect(ctx, 10, 8, w - 20, h - 16, 22);
  ctx.fill();

  // Borda neon degradê esmeralda/ciano nítida e vibrante
  const grad = ctx.createLinearGradient(10, 8, w - 20, h - 16);
  grad.addColorStop(0, 'rgba(52, 211, 153, 0.90)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0.90)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.8;
  ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.restore();

  // Linha 1: Título completo do Objeto (com quebra de linha se necessário)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "Segoe UI", -apple-system, Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleLines = wrapLines(ctx, title, maxTextW, 2);
  let yCursor = titleLines.length > 1 ? 36 : 46;
  for (let i = 0; i < titleLines.length; i++) {
    ctx.fillText(titleLines[i], w / 2, yCursor + i * 26, maxTextW);
  }
  yCursor += (titleLines.length - 1) * 26 + 28;

  // Linha 2: Parâmetros / Estado em tempo real (Ciano Celeste)
  if (params) {
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 19px "Segoe UI", -apple-system, Roboto, sans-serif';
    const paramLines = wrapLines(ctx, params, maxTextW, 2);
    for (let i = 0; i < paramLines.length; i++) {
      ctx.fillText(paramLines[i], w / 2, yCursor + i * 22, maxTextW);
    }
    ctx.restore();
    yCursor += (paramLines.length - 1) * 22 + 24;
  }

  // Divisor sutil entre título/parâmetros e ação
  const divY = Math.max(92, Math.min(148, yCursor - 4));
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(30, divY);
  ctx.lineTo(w - 30, divY);
  ctx.stroke();

  // Linha 3: Ação contextual completa (Dourado/Menta vibrante)
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 20px "Segoe UI", -apple-system, Roboto, sans-serif';
  const actionLines = wrapLines(ctx, '👉 ' + action, maxTextW, 2);
  const actStartY = divY + (actionLines.length > 1 ? 26 : 36);
  for (let i = 0; i < actionLines.length; i++) {
    ctx.fillText(actionLines[i], w / 2, actStartY + i * 24, maxTextW);
  }

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

  // Posição base acima do objeto com levitação senoidal muito sutil
  badgeState.targetPos.copy(worldPos);
  const floatOffset = Math.sin((now || performance.now()) * 0.003) * 0.015;

  if (!badgeState.visible) {
    // Primeiro frame visível: salta direto para a posição
    badgeState.currentPos.copy(badgeState.targetPos);
  } else {
    // Lerp suave para estabilidade visual
    badgeState.currentPos.lerp(badgeState.targetPos, 0.35);
  }

  badgeState.sprite.position.copy(badgeState.currentPos);
  badgeState.sprite.position.y += floatOffset;

  // Escala balanceada e confortável adaptada à distância da câmera
  if (camera) {
    const dist = camera.position.distanceTo(badgeState.sprite.position);
    const s = Math.max(0.32, Math.min(0.68, dist * 0.22));
    badgeState.sprite.scale.set(s * 1.65, s * 0.65, 1);

    // Evita que o crachá 3D projete atrás da barra de menu superior (#hud-top-bar)
    if (_tmpBadgeProj) {
      _tmpBadgeProj.copy(badgeState.sprite.position).project(camera);
      if (_tmpBadgeProj.y > 0.42 && _tmpBadgeProj.z < 1.0) {
        const pullDown = (_tmpBadgeProj.y - 0.42) * dist * 0.55;
        badgeState.sprite.position.y -= pullDown;
      }
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
