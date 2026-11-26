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
 * Remove tags de estado (ex: "Esterilizado", "Pronta", "%", "ml") do título do item,
 * deixando apenas o nome limpo; detalhes completos ficam em Inspecionar.
 */
export function cleanItemTitle(rawTitle) {
  let s = String(rawTitle || '').trim();
  if (!s) return '';
  // Remove sufixos após " • " ou " — "
  s = s.split(/\s+[•—]\s+/)[0].trim();
  // Remove parênteses de estado/esterilização/progresso, preservando identificadores como (Spawn), (PDA), (1.6m), (50 Vagas)
  s = s.replace(/\s*\((?:[^)]*(?:esteril|steril|pront|ready|vazi|empty|chei|full|vencid|expir|contam|mofo|mold|seco|dry|umid|wet|inocul|coloniz|incub|crescen|growing|frutific|fruiting|ativo|active|deslig|off|ligad|on|\d+%|\d+\/\d+|\d+\s*ml|\d+\s*g\b)[^)]*)\)/gi, '').trim();
  // Remove sufixos soltos após o nome base
  s = s.replace(/\s+(?:n[aã]o\s+)?esterilizad[oa]s?\b/gi, '');
  s = s.replace(/\s+(?:un)?sterilized\b/gi, '');
  s = s.replace(/\s+(?:sin\s+)?esterilizar\b/gi, '');
  s = s.replace(/\s+(?:vazi[oa]|chei[oa]|pront[oa]|vencid[oa]|selad[oa]|contaminad[oa])\b/gi, '');
  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Converte um prompt textual e objeto alvo em título, parâmetros e ação formatados.
 */
export function formatHoverInfo(prompt, targetObj) {
  if (!prompt) return null;

  const LEADING_EMOJI_RE = /^(?:[\p{Extended_Pictographic}\u2600-\u27BF][\uFE0E\uFE0F]?(?:\u200D[\p{Extended_Pictographic}\u2600-\u27BF][\uFE0E\uFE0F]?)*)/u;
  const stripEmojis = (s) => String(s || '').replace(/^[\s\p{Extended_Pictographic}\uFE0E\uFE0F\u200D\u2600-\u27BF•\-–—:]+/gu, '').trim();

  let title = '';
  let params = '';
  let action = prompt.trim();

  // 1. Extrai primeiro bloco de parênteses balanceado (suporta parênteses aninhados)
  let parenOuter = null;
  const openIdx = action.indexOf('(');
  if (openIdx !== -1) {
    let depth = 0;
    for (let i = openIdx; i < action.length; i++) {
      if (action[i] === '(') depth++;
      else if (action[i] === ')') {
        depth--;
        if (depth === 0) {
          parenOuter = action.slice(openIdx, i + 1);
          params = action.slice(openIdx + 1, i).trim();
          action = (action.slice(0, openIdx) + action.slice(i + 1)).replace(/\s{2,}/g, ' ').trim();
          break;
        }
      }
    }
  }

  // 2. Extrai traço separador " — " ou " • "
  if (action.includes(' — ')) {
    const parts = action.split(' — ');
    action = parts[0].trim();
    params = params ? (params + ' • ' + parts.slice(1).join(' • ').trim()) : parts.slice(1).join(' • ').trim();
  } else if (action.includes(' • ')) {
    const parts = action.split(' • ');
    action = parts[0].trim();
    const extraParams = parts.slice(1).join(' • ').trim();
    if (extraParams) {
      params = params ? (params + ' • ' + extraParams) : extraParams;
    }
  }

  // 3. Define título com base no alvo ou ação (preservando emoji completo com \uFE0F!)
  const emojiMatch = prompt.trim().match(LEADING_EMOJI_RE);
  const rawBase = targetObj && (targetObj.spawnCtrl?.baseLabel || targetObj.liquidCtrl?.baseLabel || targetObj.falconCtrl?.baseLabel || targetObj.label || targetObj.name);
  if (rawBase) {
    title = cleanItemTitle(rawBase);
    const titleHasEmoji = LEADING_EMOJI_RE.test(title);
    if (emojiMatch && !titleHasEmoji) {
      title = emojiMatch[0] + ' ' + title;
    }
  } else {
    title = cleanItemTitle(action) || action;
  }

  // Remove parâmetros redundantes do título quando já aparecem na linha de parâmetros
  if (params) {
    if (title.includes(params)) {
      params = '';
    } else if (parenOuter && title.includes(parenOuter)) {
      title = title.replace(parenOuter, '').replace(/\s+•.*$/, '').trim();
    }
  }

  // Remove emojis iniciais da linha de ação (pois já recebe "👉 " e o título já tem o ícone do item)
  let cleanAction = stripEmojis(action);
  const cleanTitle = stripEmojis(title);
  const cleanTitleNoParen = cleanTitle.replace(/\s*\([^)]+\)/g, '').trim();

  // Remove duplicação do nome do objeto dentro da linha de ação (ex: "Abrir Armário de 2 Alturas" -> "Abrir")
  if (cleanTitleNoParen && cleanAction.length > cleanTitleNoParen.length) {
    const escapedTitle = cleanTitleNoParen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const trailingTitleRe = new RegExp(`(?:\\s+(?:em|no|na|do|da|de|para|com))?\\s*${escapedTitle}$`, 'i');
    if (trailingTitleRe.test(cleanAction)) {
      cleanAction = cleanAction.replace(trailingTitleRe, '').trim();
    }
  }

  if (
    !cleanAction ||
    /^Pegar\b/i.test(cleanAction) ||
    cleanAction.toLowerCase() === cleanTitle.toLowerCase() ||
    cleanAction.toLowerCase() === cleanTitleNoParen.toLowerCase()
  ) {
    action = '';
  } else {
    action = cleanAction;
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
  const maxTextW = w - 56;

  ctx.clearRect(0, 0, w, canvas.height);

  const FONT_STACK = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  // Calcula layout antes de desenhar o fundo para ajustar a altura exata sem espaço sobrando
  ctx.font = `bold 24px ${FONT_STACK}`;
  const titleLines = wrapLines(ctx, title, maxTextW, 2);

  ctx.font = `600 19px ${FONT_STACK}`;
  const paramLines = params ? wrapLines(ctx, params, maxTextW, 2) : [];

  ctx.font = `bold 20px ${FONT_STACK}`;
  const actionLines = action ? wrapLines(ctx, '👉 ' + action, maxTextW, 2) : [];

  let maxLineW = 0;
  ctx.font = `bold 24px ${FONT_STACK}`;
  for (let i = 0; i < titleLines.length; i++) maxLineW = Math.max(maxLineW, ctx.measureText(titleLines[i]).width);
  ctx.font = `600 19px ${FONT_STACK}`;
  for (let i = 0; i < paramLines.length; i++) maxLineW = Math.max(maxLineW, ctx.measureText(paramLines[i]).width);
  ctx.font = `bold 20px ${FONT_STACK}`;
  for (let i = 0; i < actionLines.length; i++) maxLineW = Math.max(maxLineW, ctx.measureText(actionLines[i]).width);

  const boxW = Math.min(w - 20, Math.max(150, Math.ceil(maxLineW) + 38));
  const boxX = (w - boxW) * 0.5;

  const padTop = 26;
  const titleH = titleLines.length * 28;
  const paramH = paramLines.length ? (paramLines.length * 24 + 6) : 0;
  const divGap = actionLines.length ? 14 : 0;
  const actionH = actionLines.length ? (actionLines.length * 26) : 0;
  const padBottom = actionLines.length ? 22 : 16;
  const boxH = Math.min(canvas.height - 16, padTop + titleH + paramH + divGap + actionH + padBottom);

  // Fundo escuro nítido ajustado exatamente ao conteúdo (largura e altura)
  ctx.save();
  ctx.fillStyle = 'rgba(8, 13, 24, 0.95)';
  roundRect(ctx, boxX, 8, boxW, boxH, 20);
  ctx.fill();

  const grad = ctx.createLinearGradient(boxX, 8, boxX + boxW, 8 + boxH);
  grad.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0.95)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.8;
  ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Linha 1: Título completo (Branco puro)
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 24px ${FONT_STACK}`;
  let yCursor = 8 + padTop + 12;
  for (let i = 0; i < titleLines.length; i++) {
    ctx.fillText(titleLines[i], w / 2, yCursor, maxTextW);
    yCursor += 28;
  }

  // Linha 2: Parâmetros / Estado (Azul-ciano claro de alto contraste)
  if (paramLines.length) {
    yCursor += 2;
    ctx.fillStyle = '#7dd3fc';
    ctx.font = `600 19px ${FONT_STACK}`;
    for (let i = 0; i < paramLines.length; i++) {
      ctx.fillText(paramLines[i], w / 2, yCursor, maxTextW);
      yCursor += 24;
    }
  }

  if (actionLines.length) {
    // Divisor sutil
    const divY = yCursor - 4;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.30)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(boxX + 20, divY);
    ctx.lineTo(boxX + boxW - 20, divY);
    ctx.stroke();

    // Linha 3: Ação contextual (Amarelo-ouro brilhante de leitura fácil)
    ctx.fillStyle = '#fde047';
    ctx.font = `bold 20px ${FONT_STACK}`;
    let actY = divY + 20;
    for (let i = 0; i < actionLines.length; i++) {
      ctx.fillText(actionLines[i], w / 2, actY, maxTextW);
      actY += 26;
    }
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

  // Escala balanceada e confortável: perto mantém o tamanho ideal; longe aumenta suavemente para manter leitura fácil
  if (camera) {
    const dist = camera.position.distanceTo(badgeState.sprite.position);
    const s = dist <= 1.8
      ? Math.max(0.32, dist * 0.22)
      : Math.min(1.24, 0.396 + (dist - 1.8) * 0.265);
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
