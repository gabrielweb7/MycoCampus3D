/**
 * MycoCampus 3D — Global Constants & Configuration
 * Centralizes colors, sync intervals, player physics constants, and cosmetic catalog.
 */
(function () {
  'use strict';

  var MycoConfig = window.MycoConfig || {};

  MycoConfig.HAT_COLORS = ['#dc2626', '#d97706', '#9333ea', '#059669', '#2563eb', '#db2777'];
  MycoConfig.BODY_COLORS = ['#4f46e5', '#0f766e', '#1e293b', '#b45309', '#be185d', '#334155'];

  MycoConfig.SYNC_INTERVAL_MS = 350;
  MycoConfig.SYNC_BG_INTERVAL_MS = 1200;

  MycoConfig.PLAYER_EYE = 1.62;
  MycoConfig.PLAYER_RADIUS = 0.38;

  MycoConfig.COSMETIC_HATS = [
    {
      id: 'default',
      name: 'Cogumelo Vermelho Clássico',
      desc: 'O clássico Amanita com pintas brancas.',
      req_xp: 0,
      req_mushrooms: 0,
      icon: '🍄'
    },
    {
      id: 'golden_shroom',
      name: 'Cogumelo Dourado Radiante',
      desc: 'Dourado brilhante com esferas cintilantes.',
      req_xp: 200,
      req_mushrooms: 5,
      icon: '👑'
    },
    {
      id: 'wizard_hood',
      name: 'Capuz de Alquimista',
      desc: 'Cone místico com runas de micologia.',
      req_xp: 350,
      req_mushrooms: 10,
      icon: '🧙‍♂️'
    },
    {
      id: 'grad_cap',
      name: 'Capelo Universitário',
      desc: 'Chapéu acadêmico de formatura com borla dourada.',
      req_xp: 500,
      req_mushrooms: 15,
      icon: '🎓'
    },
    {
      id: 'flower_crown',
      name: 'Coroa de Flores Silvestres',
      desc: 'Grinalda botânica com pétalas da floresta.',
      req_xp: 150,
      req_mushrooms: 3,
      icon: '🌸'
    },
    {
      id: 'beret',
      name: 'Boina de Pesquisador',
      desc: 'Estilo elegante de cientista micologista.',
      req_xp: 100,
      req_mushrooms: 2,
      icon: '🎨'
    }
  ];

  window.MycoConfig = MycoConfig;
})();
