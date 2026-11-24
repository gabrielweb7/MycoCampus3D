/**
 * MycoCampus3D — Sistema Multi-Idioma (i18n) Automático & Configurável
 * Suporta Português (pt-BR), Inglês (en) e Espanhol (es).
 * Detecta automaticamente ?lang= na URL, preferência salva no localStorage ou idioma do navegador.
 */
import { events } from './events.js';

export const SUPPORTED_LANGS = ['pt-BR', 'en', 'es'];
export const LANG_STORAGE_KEY = 'myco_lang';

export const LANG_META = {
  'pt-BR': { code: 'pt-BR', short: 'PT', flag: '🇧🇷', label: 'Português (Brasil)', ogLocale: 'pt_BR' },
  en: { code: 'en', short: 'EN', flag: '🇺🇸', label: 'English (US)', ogLocale: 'en_US' },
  es: { code: 'es', short: 'ES', flag: '🇪🇸', label: 'Español', ogLocale: 'es_ES' }
};

export const TRANSLATIONS = {
  'pt-BR': {
    'seo.title': 'MycoCampus3D — Universidade 3D do Cultivo de Cogumelos',
    'seo.description': 'Entre no campus 3D multiplayer e aprenda cultivo de cogumelos na prática: fluxo laminar, esterilização, spawn, contaminações e frutificação. Grátis, direto no navegador, no PC e no celular.',
    'lobby.badge': '🍄 Campus Virtual Multiplayer 3D',
    'lobby.subtitle': 'Universidade do Cultivo de Cogumelos',
    'lobby.name_label': 'Seu Nome no Campus',
    'lobby.name_placeholder': 'Ex: Gabriel ou Prof. Alquimista',
    'lobby.pin_label': 'Senha (mínimo 4 caracteres)',
    'lobby.pin_placeholder': 'Crie ou digite sua senha',
    'lobby.hat_label': 'Chapéu Cogu',
    'lobby.coat_label': 'Jaleco / Roupa',
    'lobby.enter_btn': '🚀 Entrar no Campus 3D',
    'lobby.connecting': 'Conectando ao servidor da Universidade...',
    'lobby.lang_label': 'Idioma',

    'hud.role_student': '🎓 Aluno',
    'hud.map': 'Mapa',
    'hud.map_title': 'Mapa & Teleporte Rápido',
    'hud.quest': 'Missão',
    'hud.quest_title': 'Missão Prática do Laboratório',
    'hud.shop': 'Loja',
    'hud.shop_title': 'Loja de Cosméticos, Chapéus & Brinquedos',
    'hud.quality_title': 'Qualidade Gráfica (clique para alternar)',
    'hud.fullscreen': 'Tela Cheia',
    'hud.fullscreen_title': 'Tela Cheia (Fullscreen)',
    'hud.menu': 'Menu',
    'hud.menu_title': 'Menu de Funções',
    'hud.lessons': '📚 Aulas',
    'hud.lessons_title': 'Módulos & Aulas Teóricas',
    'hud.ranking': '🏆 Ranking',
    'hud.ranking_title': 'Ranking Geral de Alunos',
    'hud.guide': '📖 Guia',
    'hud.guide_title': 'Controles, tutorial opcional e compatibilidade dos itens',
    'hud.mycoteca': '🍄 Micoteca',
    'hud.mycoteca_title': 'Coleção de Espécies de Cogumelos',
    'hud.admin': '🛡️ Admin',
    'hud.admin_title': 'Painel Master Admin',
    'hud.emotes': '💃 Emotes',
    'hud.emotes_title': 'Emotes & Animações',
    'hud.discord': '💬 Discord',
    'hud.discord_title': 'Entrar no Discord oficial (ou digite /discord no chat)',
    'hud.sound': '🔊 Som',
    'hud.sound_title': 'Ativar/Desativar Som',
    'hud.settings': '⚙️ Config',
    'hud.settings_title': 'Configurações & Idioma',
    'hud.install': '📲 Instalar App',
    'hud.install_title': 'Instalar MycoCampus3D no Celular',

    'hud.fps_hint': 'WASD anda • Shift corre • Ctrl agacha • Espaço pula • R gira • Clique interage',
    'hud.interact': 'Interagir',
    'hud.in_hand': 'Em Mãos',
    'hud.drop': '⬇️ Largar',
    'hud.place': '📦 Posicionar',
    'hud.rotate': '🔄 Girar',
    'hud.status': '🔍 Status',
    'hud.item_status_title': 'Status do Item',
    'hud.emote_wave': '👋 Acenar',
    'hud.emote_dance': '💃 Dançar',
    'hud.emote_cheer': '🎉 Festa',
    'hud.emote_meditate': '🧘 Meditar',
    'hud.chat_btn': 'Chat',
    'hud.chat_placeholder': '💬 Escreva no chat...',
    'hud.chat_send': 'Enviar',

    'settings.title': '⚙️ Configurações do Jogo',
    'settings.subtitle': 'Idioma, gráficos, áudio e tela cheia',
    'settings.close': '✕ Fechar',
    'settings.lang_section': '🌐 Idioma / Language / Idioma',
    'settings.lang_desc': 'Detectado automaticamente pelo navegador. Você pode alterar quando quiser:',
    'settings.lang_auto': '✨ Automático (Navegador)',
    'settings.graphics_section': '⚡ Qualidade Gráfica',
    'settings.graphics_desc': 'Alterne entre Auto, Alto, Médio, Baixo ou Mínimo para melhor FPS.',
    'settings.graphics_cycle': 'Alternar Qualidade',
    'settings.audio_section': '🔊 Áudio & Tela',
    'settings.audio_toggle': '🔊 Ativar / Desativar Som',
    'settings.fullscreen_toggle': '⛶ Alternar Tela Cheia',
    'settings.toast_changed': '🌐 Idioma alterado para Português (BR)!',

    'modal.guide_title': '📖 Guia de Jogabilidade',
    'modal.guide_tab_controls': 'Controles',
    'modal.guide_tab_tutorial': 'Tutorial opcional',
    'modal.guide_tab_items': 'Itens e compatibilidade',
    'modal.lessons_title': '📚 Universidade MycoCampus — Módulos Práticos',
    'modal.ranking_title': '🏆 Ranking da Universidade',
    'modal.shop_title': 'Loja de Cosméticos & Brinquedos',
    'modal.shop_subtitle': 'Equipe ou desative chapéus e brinquedos a qualquer momento',
    'modal.shop_hats': '🎩 Chapéus',
    'modal.shop_toys': '🏂 Brinquedos',
    'modal.map_title': 'Mapa Rápido do Campus',
    'modal.map_subtitle': 'Escolha um setor para ir direto até lá',
    'modal.quest_title': 'Missão Prática: Cultivo Asséptico',
    'modal.quest_tab_tracks': '📘 Aprender Sozinho',
    'modal.quest_tab_calculator': '🧮 Calculadora Real',
    'modal.quest_species': '🍄 Espécies',
    'modal.quest_amount': 'Quantidade base (ml ou g)',
    'modal.quest_next_step': 'Próximo passo',
    'modal.quest_reward_confirming': 'Confirmando recompensa…',
    'modal.quest_reward_retry': 'Recompensa pendente · Tentar novamente',
    'modal.quest_subtitle': 'Complete as 8 etapas no campus e ganhe +100 XP',
    'modal.quest_go_to_sector': 'Ir para o setor',
    'modal.mycoteca_title': '🍄 Micoteca — Coleção de Espécies',
    'modal.mycoteca_summary': 'Explore os bosques, troncos e o pasto para catalogar todas as espécies.',
    'modal.greenhouse_title': '🍄 Estufa Climatizada'
  },

  en: {
    'seo.title': 'MycoCampus3D — 3D Mushroom Cultivation Simulator & Online Game',
    'seo.description': 'Join the free 3D multiplayer browser game and learn mushroom cultivation hands-on: laminar flow hood, sterilization, spawn, liquid culture, and fruiting on PC & mobile.',
    'lobby.badge': '🍄 3D Multiplayer Virtual Campus',
    'lobby.subtitle': 'Mushroom Cultivation University',
    'lobby.name_label': 'Your Campus Name',
    'lobby.name_placeholder': 'e.g. Alex or Prof. Myco',
    'lobby.pin_label': 'Password (min 4 characters)',
    'lobby.pin_placeholder': 'Create or enter your password',
    'lobby.hat_label': 'Mushroom Hat',
    'lobby.coat_label': 'Lab Coat / Outfit',
    'lobby.enter_btn': '🚀 Enter 3D Campus',
    'lobby.connecting': 'Connecting to University server...',
    'lobby.lang_label': 'Language',

    'hud.role_student': '🎓 Student',
    'hud.map': 'Map',
    'hud.map_title': 'Map & Fast Teleport',
    'hud.quest': 'Quest',
    'hud.quest_title': 'Practical Lab Quest',
    'hud.shop': 'Shop',
    'hud.shop_title': 'Cosmetics, Hats & Toys Shop',
    'hud.quality_title': 'Graphics Quality (click to switch)',
    'hud.fullscreen': 'Fullscreen',
    'hud.fullscreen_title': 'Fullscreen Mode',
    'hud.menu': 'Menu',
    'hud.menu_title': 'Features Menu',
    'hud.lessons': '📚 Lessons',
    'hud.lessons_title': 'Modules & Theory Lessons',
    'hud.ranking': '🏆 Ranking',
    'hud.ranking_title': 'University Leaderboard',
    'hud.guide': '📖 Guide',
    'hud.guide_title': 'Controls, optional tutorial & item compatibility',
    'hud.mycoteca': '🍄 Mycoteca',
    'hud.mycoteca_title': 'Mushroom Species Collection',
    'hud.admin': '🛡️ Admin',
    'hud.admin_title': 'Master Admin Panel',
    'hud.emotes': '💃 Emotes',
    'hud.emotes_title': 'Emotes & Animations',
    'hud.discord': '💬 Discord',
    'hud.discord_title': 'Join official Discord (or type /discord in chat)',
    'hud.sound': '🔊 Sound',
    'hud.sound_title': 'Mute / Unmute Sound',
    'hud.settings': '⚙️ Settings',
    'hud.settings_title': 'Settings & Language',
    'hud.install': '📲 Install App',
    'hud.install_title': 'Install MycoCampus3D on Mobile',

    'hud.fps_hint': 'WASD move • Shift sprint • Ctrl crouch • Space jump • R rotate • Click interact',
    'hud.interact': 'Interact',
    'hud.in_hand': 'In Hand',
    'hud.drop': '⬇️ Drop',
    'hud.place': '📦 Place',
    'hud.rotate': '🔄 Rotate',
    'hud.status': '🔍 Status',
    'hud.item_status_title': 'Item Status',
    'hud.emote_wave': '👋 Wave',
    'hud.emote_dance': '💃 Dance',
    'hud.emote_cheer': '🎉 Cheer',
    'hud.emote_meditate': '🧘 Meditate',
    'hud.chat_btn': 'Chat',
    'hud.chat_placeholder': '💬 Type in chat...',
    'hud.chat_send': 'Send',

    'settings.title': '⚙️ Game Settings',
    'settings.subtitle': 'Language, graphics, audio and fullscreen',
    'settings.close': '✕ Close',
    'settings.lang_section': '🌐 Language / Idioma',
    'settings.lang_desc': 'Auto-detected from your browser. You can switch anytime:',
    'settings.lang_auto': '✨ Auto (Browser)',
    'settings.graphics_section': '⚡ Graphics Quality',
    'settings.graphics_desc': 'Cycle between Auto, High, Medium, Low or Min for better FPS.',
    'settings.graphics_cycle': 'Cycle Quality',
    'settings.audio_section': '🔊 Audio & Display',
    'settings.audio_toggle': '🔊 Toggle Sound',
    'settings.fullscreen_toggle': '⛶ Toggle Fullscreen',
    'settings.toast_changed': '🌐 Language changed to English (US)!',

    'modal.guide_title': '📖 Gameplay Guide',
    'modal.guide_tab_controls': 'Controls',
    'modal.guide_tab_tutorial': 'Optional Tutorial',
    'modal.guide_tab_items': 'Items & Compatibility',
    'modal.lessons_title': '📚 MycoCampus University — Practical Modules',
    'modal.ranking_title': '🏆 University Leaderboard',
    'modal.shop_title': 'Cosmetics & Toys Shop',
    'modal.shop_subtitle': 'Equip or unequip hats and toys anytime',
    'modal.shop_hats': '🎩 Hats',
    'modal.shop_toys': '🏂 Toys',
    'modal.map_title': 'Quick Campus Map',
    'modal.map_subtitle': 'Choose a sector to teleport there directly',
    'modal.quest_title': 'Practical Quest: Aseptic Cultivation',
    'modal.quest_tab_tracks': '📘 Learn Solo',
    'modal.quest_tab_calculator': '🧮 Calculator',
    'modal.quest_species': '🍄 Species',
    'modal.quest_amount': 'Base amount (ml or g)',
    'modal.quest_next_step': 'Next step',
    'modal.quest_reward_confirming': 'Confirming reward…',
    'modal.quest_reward_retry': 'Reward pending · Try again',
    'modal.quest_subtitle': 'Complete all 8 campus steps to earn +100 XP',
    'modal.quest_go_to_sector': 'Go to sector',
    'modal.mycoteca_title': '🍄 Mycoteca — Species Collection',
    'modal.mycoteca_summary': 'Explore the woods, logs, and pasture to catalog all species.',
    'modal.greenhouse_title': '🍄 Climate-Controlled Greenhouse'
  },

  es: {
    'seo.title': 'MycoCampus3D — Simulador y Juego 3D de Cultivo de Hongos',
    'seo.description': 'Entra al campus 3D multijugador y aprende cultivo de hongos y setas en la práctica: flujo laminar, esterilización, spawn, micelio y fructificación. Gratis en tu navegador.',
    'lobby.badge': '🍄 Campus Virtual Multijugador 3D',
    'lobby.subtitle': 'Universidad del Cultivo de Hongos',
    'lobby.name_label': 'Tu Nombre en el Campus',
    'lobby.name_placeholder': 'Ej: Mateo o Prof. Micólogo',
    'lobby.pin_label': 'Contraseña (mínimo 4 caracteres)',
    'lobby.pin_placeholder': 'Crea o escribe tu contraseña',
    'lobby.hat_label': 'Sombrero Hongo',
    'lobby.coat_label': 'Bata / Ropa',
    'lobby.enter_btn': '🚀 Entrar al Campus 3D',
    'lobby.connecting': 'Conectando al servidor de la Universidad...',
    'lobby.lang_label': 'Idioma',

    'hud.role_student': '🎓 Alumno',
    'hud.map': 'Mapa',
    'hud.map_title': 'Mapa y Teletransporte Rápido',
    'hud.quest': 'Misión',
    'hud.quest_title': 'Misión Práctica de Laboratorio',
    'hud.shop': 'Tienda',
    'hud.shop_title': 'Tienda de Cosméticos, Sombreros y Juguetes',
    'hud.quality_title': 'Calidad Gráfica (clic para cambiar)',
    'hud.fullscreen': 'Pantalla Completa',
    'hud.fullscreen_title': 'Pantalla Completa (Fullscreen)',
    'hud.menu': 'Menú',
    'hud.menu_title': 'Menú de Funciones',
    'hud.lessons': '📚 Clases',
    'hud.lessons_title': 'Módulos y Clases Teóricas',
    'hud.ranking': '🏆 Ranking',
    'hud.ranking_title': 'Clasificación de Alumnos',
    'hud.guide': '📖 Guía',
    'hud.guide_title': 'Controles, tutorial opcional y compatibilidad de objetos',
    'hud.mycoteca': '🍄 Micoteca',
    'hud.mycoteca_title': 'Colección de Especies de Hongos',
    'hud.admin': '🛡️ Admin',
    'hud.admin_title': 'Panel Master Admin',
    'hud.emotes': '💃 Emotes',
    'hud.emotes_title': 'Emotes y Animaciones',
    'hud.discord': '💬 Discord',
    'hud.discord_title': 'Unirse al Discord oficial (o escribe /discord en el chat)',
    'hud.sound': '🔊 Sonido',
    'hud.sound_title': 'Activar/Desactivar Sonido',
    'hud.settings': '⚙️ Ajustes',
    'hud.settings_title': 'Ajustes e Idioma',
    'hud.install': '📲 Instalar App',
    'hud.install_title': 'Instalar MycoCampus3D en el Móvil',

    'hud.fps_hint': 'WASD caminar • Shift correr • Ctrl agacharse • Espacio saltar • R girar • Clic interactuar',
    'hud.interact': 'Interactuar',
    'hud.in_hand': 'En Mano',
    'hud.drop': '⬇️ Soltar',
    'hud.place': '📦 Colocar',
    'hud.rotate': '🔄 Girar',
    'hud.status': '🔍 Estado',
    'hud.item_status_title': 'Estado del Objeto',
    'hud.emote_wave': '👋 Saludar',
    'hud.emote_dance': '💃 Bailar',
    'hud.emote_cheer': '🎉 Fiesta',
    'hud.emote_meditate': '🧘 Meditar',
    'hud.chat_btn': 'Chat',
    'hud.chat_placeholder': '💬 Escribe en el chat...',
    'hud.chat_send': 'Enviar',

    'settings.title': '⚙️ Ajustes del Juego',
    'settings.subtitle': 'Idioma, gráficos, audio y pantalla completa',
    'settings.close': '✕ Cerrar',
    'settings.lang_section': '🌐 Idioma / Language',
    'settings.lang_desc': 'Detectado automáticamente por tu navegador. Puedes cambiarlo cuando quieras:',
    'settings.lang_auto': '✨ Automático (Navegador)',
    'settings.graphics_section': '⚡ Calidad Gráfica',
    'settings.graphics_desc': 'Cambia entre Auto, Alto, Medio, Bajo o Mínimo para mejor FPS.',
    'settings.graphics_cycle': 'Cambiar Calidad',
    'settings.audio_section': '🔊 Audio y Pantalla',
    'settings.audio_toggle': '🔊 Activar / Silenciar Sonido',
    'settings.fullscreen_toggle': '⛶ Alternar Pantalla Completa',
    'settings.toast_changed': '🌐 ¡Idioma cambiado a Español!',

    'modal.guide_title': '📖 Guía de Juego',
    'modal.guide_tab_controls': 'Controles',
    'modal.guide_tab_tutorial': 'Tutorial opcional',
    'modal.guide_tab_items': 'Objetos y compatibilidad',
    'modal.lessons_title': '📚 Universidad MycoCampus — Módulos Prácticos',
    'modal.ranking_title': '🏆 Clasificación de la Universidad',
    'modal.shop_title': 'Tienda de Cosméticos y Juguetes',
    'modal.shop_subtitle': 'Equipa o quita sombreros y juguetes en cualquier momento',
    'modal.shop_hats': '🎩 Sombreros',
    'modal.shop_toys': '🏂 Juguetes',
    'modal.map_title': 'Mapa Rápido del Campus',
    'modal.map_subtitle': 'Elige un sector para teletransportarte allí',
    'modal.quest_title': 'Misión Práctica: Cultivo Aséptico',
    'modal.quest_tab_tracks': '📘 Aprender en Solitario',
    'modal.quest_tab_calculator': '🧮 Calculadora',
    'modal.quest_species': '🍄 Especies',
    'modal.quest_amount': 'Cantidad base (ml o g)',
    'modal.quest_next_step': 'Siguiente paso',
    'modal.quest_reward_confirming': 'Confirmando recompensa…',
    'modal.quest_reward_retry': 'Recompensa pendiente · Volver a intentar',
    'modal.quest_subtitle': 'Completa las 8 etapas en el campus y gana +100 XP',
    'modal.quest_go_to_sector': 'Ir al sector',
    'modal.mycoteca_title': '🍄 Micoteca — Colección de Especies',
    'modal.mycoteca_summary': 'Explora los bosques, troncos y el pasto para catalogar todas las especies.',
    'modal.greenhouse_title': '🍄 Invernadero Climatizado'
  }
};

let currentLang = 'pt-BR';

export function normalizeLang(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim().toLowerCase().replace('_', '-');
  if (clean === 'pt' || clean.startsWith('pt-')) return 'pt-BR';
  if (clean === 'es' || clean.startsWith('es-')) return 'es';
  if (clean === 'en' || clean.startsWith('en-')) return 'en';
  return null;
}

export function detectBrowserLanguage() {
  if (typeof navigator === 'undefined') return 'pt-BR';
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || navigator.userLanguage || ''];
  for (const cand of candidates) {
    const norm = normalizeLang(cand);
    if (norm) return norm;
  }
  return 'en';
}

export function detectInitialLanguage() {
  // 1. Query param ?lang= (usado também por hreflang SEO)
  if (typeof window !== 'undefined' && window.location && window.location.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const qLang = normalizeLang(params.get('lang'));
      if (qLang) return qLang;
    } catch (e) {}
  }
  // 2. Preferência salva pelo usuário
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = normalizeLang(localStorage.getItem(LANG_STORAGE_KEY));
      if (saved) return saved;
    } catch (e) {}
  }
  // 3. Detecção automática pelo navegador
  return detectBrowserLanguage();
}

export function getLanguage() {
  return currentLang;
}

export function t(key, vars) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS['pt-BR'];
  let text = dict[key] ?? TRANSLATIONS['pt-BR'][key] ?? key;
  if (vars && typeof vars === 'object') {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function applyTranslations(root) {
  if (typeof document === 'undefined') return;
  const target = root || document;

  if (target === document) {
    document.documentElement.lang = currentLang;
    document.title = t('seo.title');
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', t('seo.description'));
  }

  target.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  target.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });

  target.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  });

  target.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (key) el.setAttribute('aria-label', t(key));
  });

  // Atualiza destaque visual dos botões de idioma (Lobby e Configurações)
  target.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    const btnLang = btn.getAttribute('data-lang-btn');
    const isActive = btnLang === currentLang;
    btn.classList.toggle('ring-2', isActive);
    btn.classList.toggle('ring-emerald-400', isActive);
    btn.classList.toggle('bg-emerald-500/25', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

export function setLanguage(lang, { persist = true, apply = true } = {}) {
  const norm = normalizeLang(lang) || 'pt-BR';
  currentLang = norm;

  if (persist && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, norm);
    } catch (e) {}
  }

  if (apply) {
    applyTranslations();
  }

  events.emit('language:changed', norm);
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('myco:langchange', { detail: { lang: norm } }));
  }
  return norm;
}

export function resetLanguageToAuto() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(LANG_STORAGE_KEY);
    } catch (e) {}
  }
  return setLanguage(detectBrowserLanguage(), { persist: false, apply: true });
}

export function initI18n() {
  const initial = detectInitialLanguage();
  return setLanguage(initial, { persist: false, apply: true });
}
