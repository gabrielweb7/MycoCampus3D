/**
 * Sistema Central de Contaminações Fúngicas & Bacterianas (MycoCampus3D)
 * Define os 6 patógenos reais do cultivo (Trichoderma, Cobweb, Wet Spot, Penicillium,
 * Aspergillus niger e Lipstick Mold), cores por recipiente, tratamento c/ H2O2 3% e morfologia microscópica.
 */

export const CONTAMINATION_CATALOG = {
  trichoderma: {
    id: 'trichoderma',
    name: 'Trichoderma (Duende Verde)',
    scientific: 'Trichoderma harzianum',
    shortLabel: 'Trichoderma Verde',
    emoji: '🟢',
    badgeHex: '#16a34a',
    hex: 0x16a34a,
    accentHex: 0x4ade80,
    liquidHex: 0x166534,
    sporeHex: '#16a34a',
    curableWithH2O2: false,
    airborneHazard: true,
    causeHint: 'Esporos em suspensão / tampa aberta fora do Fluxo Laminar.',
    microscopeNote: 'Conidióforos ramificados em pinheiro com conídios esféricos verde-esmeralda (alta esporulação!).'
  },
  cobweb: {
    id: 'cobweb',
    name: 'Cobweb Mold (Teia de Aranha)',
    scientific: 'Cladobotryum / Dactylium',
    shortLabel: 'Cobweb (Tratável H₂O₂)',
    emoji: '🕸️',
    badgeHex: '#94a3b8',
    hex: 0x94a3b8,
    accentHex: 0xcbd5e1,
    liquidHex: 0x64748b,
    sporeHex: '#64748b',
    curableWithH2O2: true,
    airborneHazard: false,
    causeHint: 'Umidade estagnada + pouca troca gasosa (FAE). Tratável com Água Oxigenada 3%!',
    microscopeNote: 'Hifas finas cinza-translúcidas de crescimento explosivo sem grampos de conexão.'
  },
  wet_spot: {
    id: 'wet_spot',
    name: 'Wet Spot (Bactéria / Bacilo)',
    scientific: 'Bacillus spp.',
    shortLabel: 'Wet Spot Bacteriano',
    emoji: '🟡',
    badgeHex: '#eab308',
    hex: 0xca8a04,
    accentHex: 0xfde047,
    liquidHex: 0xa16207,
    sporeHex: '#eab308',
    curableWithH2O2: false,
    airborneHazard: false,
    causeHint: 'Grãos muito encharcados ou esterilização abaixo de 121°C / 15 PSI.',
    microscopeNote: 'Bastonetes móveis (bacilos endosporulados) em biofilme viscoso amarelado.'
  },
  penicillium: {
    id: 'penicillium',
    name: 'Penicillium (Mofo Azul-Verde)',
    scientific: 'Penicillium chrysogenum',
    shortLabel: 'Penicillium Azul-Verde',
    emoji: '🩵',
    badgeHex: '#0d9488',
    hex: 0x0d9488,
    accentHex: 0x5eead4,
    liquidHex: 0x115e59,
    sporeHex: '#0d9488',
    curableWithH2O2: false,
    airborneHazard: true,
    causeHint: 'Contato com ar não filtrado ou ferramenta sem flambagem.',
    microscopeNote: 'Estruturas em forma de pincel (penicilos) soltando cadeias de conídios azul-esverdeados.'
  },
  aspergillus: {
    id: 'aspergillus',
    name: 'Aspergillus niger (Mofo Negro)',
    scientific: 'Aspergillus niger',
    shortLabel: 'Mofo Negro (Aspergillus)',
    emoji: '⚫',
    badgeHex: '#334155',
    hex: 0x1e293b,
    accentHex: 0x475569,
    liquidHex: 0x0f172a,
    sporeHex: '#0f172a',
    curableWithH2O2: false,
    airborneHazard: true,
    causeHint: 'Contaminação pesada ambiental — mantenha fechado e descarte no lixo!',
    microscopeNote: 'Vesículas globosas negras irradiando cadeias escuras de esporos (risco respiratório!).'
  },
  lipstick: {
    id: 'lipstick',
    name: 'Lipstick Mold (Mofo Batom)',
    scientific: 'Sporendonema purpureum',
    shortLabel: 'Lipstick Rosa',
    emoji: '🩷',
    badgeHex: '#f43f5e',
    hex: 0xe11d48,
    accentHex: 0xfb7185,
    liquidHex: 0x9f1239,
    sporeHex: '#f43f5e',
    curableWithH2O2: false,
    airborneHazard: false,
    causeHint: 'Substrato bulk mal pasteurizado ou excesso térmico na incubação.',
    microscopeNote: 'Artrosporos rosados em cadeias fragmentadas densas (típico de bulk/casing).'
  }
};

export const CONTAM_IDS = Object.keys(CONTAMINATION_CATALOG);

const POOL_BY_CONTAINER = {
  petri: ['trichoderma', 'penicillium', 'aspergillus', 'wet_spot', 'lipstick'],
  pp5: ['trichoderma', 'wet_spot', 'penicillium', 'aspergillus'],
  liquid: ['wet_spot', 'trichoderma', 'penicillium', 'aspergillus'],
  spawn: ['wet_spot', 'trichoderma', 'cobweb', 'aspergillus'],
  monotub: ['cobweb', 'trichoderma', 'lipstick', 'aspergillus'],
  greenhouse: ['cobweb', 'trichoderma', 'lipstick']
};

export function pickContamKind(containerType = 'petri', preferred = '') {
  if (preferred && CONTAMINATION_CATALOG[preferred]) return preferred;
  const pool = POOL_BY_CONTAINER[containerType] || CONTAM_IDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getContamInfo(kind) {
  return CONTAMINATION_CATALOG[kind] || CONTAMINATION_CATALOG.trichoderma;
}
