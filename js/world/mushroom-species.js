/**
 * Catálogo de 100 Espécies de Cogumelos + Bosques Expandidos (MycoCampus3D)
 * Inclui espécies lignícolas (madeira/troncos), de mata (solo) e de pasto,
 * além de 5 tipos de árvores e culling por distância para manter 60 FPS.
 */
import { qualityState } from '../core/quality.js';

import { terrainHeight } from '../engine/physics.js';

const THREE = window.THREE;

const WOOD_SPECIES = [
  ['Pleurotus ostreatus', 'Shimeji Branco/Cinza', 0xe2e8f0, 0xf8fafc, 0.08],
  ['Pleurotus djamor', 'Shimeji Rosa', 0xf472b6, 0xfbcfe8, 0.075],
  ['Pleurotus citrinopileatus', 'Shimeji Amarelo', 0xfacc15, 0xfef9c3, 0.07],
  ['Pleurotus eryngii', 'Eryngii (King Oyster)', 0xd6b588, 0xf5f5f4, 0.09],
  ['Lentinula edodes', 'Shiitake', 0x78350f, 0xfef3c7, 0.085],
  ['Hericium erinaceus', 'Juba de Leão', 0xf8fafc, 0xf1f5f9, 0.095],
  ['Ganoderma lucidum', 'Reishi Vermelho', 0xb91c1c, 0xfef3c7, 0.10],
  ['Ganoderma applanatum', 'Orelha-de-Pau Artista', 0x7c2d12, 0xf5f5f4, 0.11],
  ['Trametes versicolor', 'Cauda de Peru', 0x0ea5e9, 0xfef3c7, 0.065],
  ['Laetiporus sulphureus', 'Galinha-do-Bosque', 0xf97316, 0xfef08a, 0.11],
  ['Flammulina velutipes', 'Enoki Selvagem', 0xf59e0b, 0xfef3c7, 0.055],
  ['Auricularia auricula', 'Orelha-de-Judas', 0x572617, 0x78350f, 0.07],
  ['Grifola frondosa', 'Maitake', 0x64748b, 0xe2e8f0, 0.10],
  ['Fomes fomentarius', 'Cogumelo Isca', 0x94a3b8, 0x475569, 0.09],
  ['Pycnoporus sanguineus', 'Orelha Vermelha', 0xef4444, 0xf97316, 0.06],
  ['Schizophyllum commune', 'Fenda-Comum', 0xcbd5e1, 0xf8fafc, 0.045],
  ['Hypholoma fasciculare', 'Enxofre-de-Tronco', 0xeab308, 0xfef08a, 0.06],
  ['Armillaria mellea', 'Cogumelo-do-Mel', 0xd97706, 0xfde68a, 0.075],
  ['Pholiota nameko', 'Nameko Dourado', 0xea580c, 0xfef3c7, 0.065],
  ['Agrocybe aegerita', 'Pioppino', 0x92400e, 0xfafaf9, 0.07],
  ['Piptoporus betulinus', 'Políporo da Bétula', 0xe7e5e4, 0xd6d3d1, 0.09],
  ['Cookeina speciosa', 'Taça-da-Mata', 0xfb7185, 0xfda4af, 0.045],
  ['Mycena haematopus', 'Mycena Sangrenta', 0x9f1239, 0xfecdd3, 0.045],
  ['Panellus stipticus', 'Panellus Bioluminescente', 0x86efac, 0xdcfce7, 0.04],
  ['Xylaria polymorpha', 'Dedos-de-Morto', 0x334155, 0x1e293b, 0.05],
  ['Tremella fuciformis', 'Cogumelo-da-Neve', 0xffffff, 0xf1f5f9, 0.07],
  ['Tremella mesenterica', 'Manteiga-de-Bruxa', 0xfacc15, 0xfde047, 0.06],
  ['Lentinus crinitus', 'Lentinus Peludo', 0xa16207, 0xfef3c7, 0.06],
  ['Oudemansiella canarii', 'Cogumelo-Porcelana', 0xf8fafc, 0xe2e8f0, 0.065],
  ['Coprinellus disseminatus', 'Touceira-de-Tronco', 0xd6d3d1, 0xf5f5f4, 0.045],
  ['Pluteus cervinus', 'Pluteus-de-Cervo', 0x78350f, 0xf5f5f4, 0.075],
  ['Gymnopilus junonius', 'Riso-Gigante', 0xea580c, 0xfacc15, 0.095],
  ['Polyporus squamosus', 'Sela-de-Dríade', 0xb45309, 0xfef3c7, 0.10],
  ['Sarcoscypha coccinea', 'Taça-Escarlate', 0xdc2626, 0xfef2f2, 0.05],
  ['Chlorociboria aeruginascens', 'Elfo-Turquesa', 0x14b8a6, 0x99f6e4, 0.04]
];

const FOREST_SPECIES = [
  ['Amanita muscaria', 'Agárico-das-Moscas', 0xef4444, 0xffffff, 0.10],
  ['Amanita caesarea', 'Cogumelo-de-César', 0xf97316, 0xfef08a, 0.095],
  ['Amanita phalloides', 'Chapéu-da-Morte', 0x84cc16, 0xf8fafc, 0.09],
  ['Boletus edulis', 'Porcini Real', 0x92400e, 0xfef3c7, 0.105],
  ['Cantharellus cibarius', 'Cantarelo Dourado', 0xfacc15, 0xfef08a, 0.075],
  ['Craterellus cornucopioides', 'Trombeta-Negra', 0x1e293b, 0x334155, 0.07],
  ['Morchella esculenta', 'Morchela (Morel)', 0xb45309, 0xfef3c7, 0.08],
  ['Lactarius deliciosus', 'Níscaro Laranja', 0xea580c, 0xfed7aa, 0.08],
  ['Lactarius indigo', 'Lactário Azul-Índigo', 0x2563eb, 0x93c5fd, 0.08],
  ['Russula emetica', 'Rússula Vermelha', 0xdc2626, 0xffffff, 0.075],
  ['Russula virescens', 'Rússula Verde-Acolchoada', 0x22c55e, 0xf8fafc, 0.08],
  ['Cortinarius violaceus', 'Cortinário Violeta', 0x7e22ce, 0xd8b4fe, 0.085],
  ['Mycena chlorophos', 'Cogumelo Neon-Verde', 0x4ade80, 0xbbf7d0, 0.05],
  ['Mycena interrupta', 'Chapéu-de-Fada Azul', 0x06b6d4, 0xe0f2fe, 0.045],
  ['Clathrus archeri', 'Dedos-do-Diabo', 0xe11d48, 0xfda4af, 0.08],
  ['Hydnellum peckii', 'Dente-Sangrante', 0xf8fafc, 0xdc2626, 0.07],
  ['Phallus indusiatus', 'Dama-do-Véu', 0xfef3c7, 0xffffff, 0.09],
  ['Suillus luteus', 'Boleto-Manteiga', 0x713f12, 0xfef08a, 0.085],
  ['Leccinum scabrum', 'Boleto-da-Bétula', 0x78350f, 0xf5f5f4, 0.09],
  ['Macrolepiota procera', 'Guarda-Sol Gigante', 0xd6b588, 0xfafaf9, 0.12],
  ['Laccaria amethystina', 'Enganador-Ametista', 0x9333ea, 0xe9d5ff, 0.06],
  ['Clitocybe odora', 'Anis-Verde', 0x2dd4bf, 0xccfbf1, 0.065],
  ['Tricholoma matsutake', 'Matsutake Aromático', 0xa8a29e, 0xf5f5f4, 0.09],
  ['Calvatia gigantea', 'Bufa-de-Lobo Gigante', 0xf5f5f4, 0xe7e5e4, 0.13],
  ['Lycoperdon perlatum', 'Bufa-de-Pérola', 0xe7e5e4, 0xd6d3d1, 0.065],
  ['Geastrum triplex', 'Estrela-da-Terra', 0xa16207, 0xfef3c7, 0.07],
  ['Coprinus comatus', 'Cabeleira-de-Advogado', 0xf8fafc, 0xf1f5f9, 0.095],
  ['Stropharia aeruginosa', 'Chapéu-Verde-Azulado', 0x0d9488, 0xf5f5f4, 0.07],
  ['Entoloma hochstetteri', 'Azul-Celeste da Mata', 0x0284c7, 0x7dd3fc, 0.06],
  ['Hygrocybe conica', 'Chapéu-de-Bruxa', 0xf97316, 0xfef08a, 0.055],
  ['Hygrocybe psittacina', 'Cogumelo-Papagaio', 0x10b981, 0xa7f3d0, 0.055],
  ['Lepista nuda', 'Pé-Azul (Wood Blewit)', 0x8b5cf6, 0xddd6fe, 0.08],
  ['Marasmius oreades', 'Anel-de-Fada', 0xeab308, 0xfef3c7, 0.055],
  ['Ramaria botrytis', 'Coral-da-Mata', 0xf472b6, 0xfef3c7, 0.08],
  ['Sparassis crispa', 'Cogumelo-Couve-Flor', 0xfef3c7, 0xfde68a, 0.10],
  ['Cordyceps militaris', 'Cordyceps Laranja', 0xf97316, 0xfdba74, 0.05],
  ['Psilocybe cyanescens', 'Chapéu-Ondulado', 0xb45309, 0xf8fafc, 0.06],
  ['Psilocybe azurescens', 'Disco-Voador Azul', 0x92400e, 0xe0f2fe, 0.065],
  ['Psilocybe semilanceata', 'Chapéu-da-Liberdade', 0xd97706, 0xfef3c7, 0.048],
  ['Gomphus clavatus', 'Orelha-de-Porco Violeta', 0xa855f7, 0xf3e8ff, 0.075],
  ['Fistulina hepatica', 'Língua-de-Boi', 0xbe123c, 0xfda4af, 0.095],
  ['Inonotus obliquus', 'Chaga-da-Floresta', 0x1c1917, 0xb45309, 0.08],
  ['Phellinus igniarius', 'Casco-de-Salgueiro', 0x44403c, 0xa8a29e, 0.085],
  ['Peziza vesiculosa', 'Taça-de-Folhas', 0xd6b588, 0xfef3c7, 0.06],
  ['Tuber melanosporum', 'Trufa-Negra Superficial', 0x18181b, 0x3f3f46, 0.06]
];

const PASTURE_SPECIES = [
  ['Psilocybe cubensis', 'Cubensis Dourado', 0xf59e0b, 0xfef3c7, 0.085],
  ['Psilocybe cubensis (Golden Teacher)', 'Golden Teacher', 0xfbbf24, 0xfef9c3, 0.09],
  ['Psilocybe cubensis (B+)', 'Cubensis B+', 0xd97706, 0xfef3c7, 0.085],
  ['Psilocybe cubensis (Albino A+)', 'Albino A+', 0xf8fafc, 0xe0f2fe, 0.085],
  ['Psilocybe cubensis (Penis Envy)', 'Penis Envy', 0xeab308, 0xfef3c7, 0.095],
  ['Psilocybe cubensis (Cambodian)', 'Cubensis Cambodian', 0xf97316, 0xfef3c7, 0.08],
  ['Psilocybe cubensis (Mazatapec)', 'Cubensis Mazatapec', 0xb45309, 0xfef3c7, 0.085],
  ['Panaeolus cyanescens', 'Blue Meanie (Pasto)', 0xcbd5e1, 0x93c5fd, 0.055],
  ['Panaeolus antillarum', 'Panaeolus Branco', 0xf1f5f9, 0xe2e8f0, 0.06],
  ['Panaeolus foenisecii', 'Cogumelo-da-Grama', 0x78350f, 0xd6d3d1, 0.05],
  ['Agaricus campestris', 'Champignon-do-Campo', 0xf8fafc, 0xfda4af, 0.085],
  ['Agaricus arvensis', 'Cogumelo-de-Cavalo', 0xfef9c3, 0xfef3c7, 0.095],
  ['Chlorophyllum molybdites', 'Guarda-Sol-do-Pasto', 0xe7e5e4, 0x86efac, 0.10],
  ['Coprinopsis nivea', 'Coprinus-da-Neve', 0xffffff, 0xf1f5f9, 0.055],
  ['Coprinus sterquilinus', 'Tinteiro-do-Esterco', 0xe2e8f0, 0x94a3b8, 0.065],
  ['Stropharia semiglobata', 'Estrofária-do-Pasto', 0xfde047, 0xfef9c3, 0.055],
  ['Bolbitius titubans', 'Chapéu-de-Gema', 0xfacc15, 0xf8fafc, 0.05],
  ['Conocybe apala', 'Cone-Branco-da-Grama', 0xfafaf9, 0xfef3c7, 0.05],
  ['Deconica coprophila', 'Deconica-do-Esterco', 0x92400e, 0xfde68a, 0.05],
  ['Vascellum pratense', 'Bufa-do-Prado', 0xf5f5f4, 0xe7e5e4, 0.06]
];

export const MUSHROOM_SPECIES_CATALOG = [
  ...WOOD_SPECIES.map((s) => ({ scientific: s[0], common: s[1], capColor: s[2], stemColor: s[3], scale: s[4], habitat: 'wood' })),
  ...FOREST_SPECIES.map((s) => ({ scientific: s[0], common: s[1], capColor: s[2], stemColor: s[3], scale: s[4], habitat: 'forest' })),
  ...PASTURE_SPECIES.map((s) => ({ scientific: s[0], common: s[1], capColor: s[2], stemColor: s[3], scale: s[4], habitat: 'pasture' }))
];

function seededRand(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function makeCreativeTree(kind, x, y, z, scale) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);

  const trunkColor = kind === 'birch' ? 0xf1f5f9 : (kind === 'pine' ? 0x5c3a21 : 0x6b4423);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 3.2, 8),
    new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9 })
  );
  trunk.position.y = 1.6;
  g.add(trunk);

  if (kind === 'pine') {
    const mat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85 });
    [2.6, 3.6, 4.5].forEach((cy, idx) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5 - idx * 0.35, 1.8 - idx * 0.2, 8), mat);
      cone.position.y = cy;
      g.add(cone);
    });
  } else if (kind === 'ipe_yellow' || kind === 'ipe_purple') {
    const col = kind === 'ipe_yellow' ? 0xfacc15 : 0xa855f7;
    const crownMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.78 });
    [[-0.7, 3.4, 0.2], [0.7, 3.3, -0.3], [0, 3.9, 0.1], [0.2, 3.2, 0.7]].forEach((p) => {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 1), crownMat);
      puff.position.set(p[0], p[1], p[2]);
      g.add(puff);
    });
  } else {
    const leafCol = kind === 'birch' ? 0x4ade80 : 0x15803d;
    const crownMat = new THREE.MeshStandardMaterial({ color: leafCol, roughness: 0.85 });
    const main = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 1), crownMat);
    main.position.y = 3.7;
    g.add(main);
  }
  return g;
}

function getSpeciesShape(spec) {
  const n = spec.scientific;
  if (n.indexOf('Hericium') !== -1) return 'lions_mane';
  if (n.indexOf('Pleurotus eryngii') !== -1 || n.indexOf('Boletus') !== -1 || n.indexOf('Leccinum') !== -1) return 'king_oyster';
  if (n.indexOf('Pleurotus') !== -1 || n.indexOf('Ganoderma') !== -1 || n.indexOf('Trametes') !== -1 ||
      n.indexOf('Laetiporus') !== -1 || n.indexOf('Auricularia') !== -1 || n.indexOf('Grifola') !== -1 ||
      n.indexOf('Fomes') !== -1 || n.indexOf('Pycnoporus') !== -1 || n.indexOf('Polyporus') !== -1) return 'shelf';
  if (n.indexOf('Flammulina') !== -1 || n.indexOf('Coprinellus') !== -1 || n.indexOf('Mycena') !== -1) return 'enoki';
  if (n.indexOf('Morchella') !== -1) return 'morel';
  if (n.indexOf('Cantharellus') !== -1 || n.indexOf('Craterellus') !== -1 || n.indexOf('Cookeina') !== -1 || n.indexOf('Sarcoscypha') !== -1) return 'funnel';
  if (n.indexOf('Cordyceps') !== -1 || n.indexOf('Xylaria') !== -1) return 'cordyceps';
  if (n.indexOf('Calvatia') !== -1 || n.indexOf('Lycoperdon') !== -1 || n.indexOf('Geastrum') !== -1 || n.indexOf('Tuber') !== -1) return 'puffball';
  if (n.indexOf('Amanita muscaria') !== -1) return 'amanita_dots';
  if (n.indexOf('Psilocybe') !== -1) return 'cubensis';
  return 'classic';
}

function makeSpeciesMushroomMesh(spec) {
  const g = new THREE.Group();
  const s = spec.scale || 0.08;
  const shape = getSpeciesShape(spec);
  const isGlow = spec.scientific.indexOf('chlorophos') !== -1 || spec.scientific.indexOf('Panellus') !== -1;
  const isGlossy = spec.scientific.indexOf('Ganoderma') !== -1;

  const stemMat = new THREE.MeshStandardMaterial({ color: spec.stemColor, roughness: 0.72 });
  const capMat = new THREE.MeshStandardMaterial({
    color: spec.capColor,
    roughness: isGlossy ? 0.16 : 0.48,
    metalness: isGlossy ? 0.15 : 0.02,
    emissive: isGlow ? spec.capColor : 0x000000,
    emissiveIntensity: isGlow ? 0.75 : 0,
    side: THREE.DoubleSide
  });

  let cap = null;
  if (shape === 'lions_mane') {
    cap = new THREE.Mesh(new THREE.DodecahedronGeometry(s * 1.15, 1), capMat);
    cap.position.y = s * 1.05;
    for (let i = 0; i < 4; i++) {
      const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(s * 0.65, 1), capMat);
      const a = (i / 4) * Math.PI * 2;
      tuft.position.set(Math.cos(a) * s * 0.55, s * 0.85, Math.sin(a) * s * 0.55);
      g.add(tuft);
    }
    g.add(cap);
  } else if (shape === 'shelf') {
    for (let i = 0; i < 3; i++) {
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(s * (1.0 - i * 0.15), s * 0.45, s * 0.24, 10), capMat);
      fan.position.set((i - 1) * s * 0.5, s * (0.45 + i * 0.35), i * s * 0.2);
      fan.rotation.x = 0.22;
      g.add(fan);
      if (i === 0) cap = fan;
    }
  } else if (shape === 'enoki') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const r = i === 0 ? 0 : s * 0.48;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.12, s * 0.15, s * 2.4, 6), stemMat);
      st.position.set(Math.cos(a) * r, s * 1.2, Math.sin(a) * r);
      const cp = new THREE.Mesh(new THREE.SphereGeometry(s * 0.42, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), capMat);
      cp.position.set(Math.cos(a) * r, s * 2.35, Math.sin(a) * r);
      g.add(st, cp);
      if (i === 0) cap = cp;
    }
  } else if (shape === 'king_oyster') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.55, s * 0.68, s * 2.1, 10), stemMat);
    st.position.y = s * 1.05;
    cap = new THREE.Mesh(new THREE.SphereGeometry(s * 0.88, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
    cap.position.y = s * 2.0;
    g.add(st, cap);
  } else if (shape === 'morel') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.30, s * 0.38, s * 1.3, 8), stemMat);
    st.position.y = s * 0.65;
    cap = new THREE.Mesh(new THREE.ConeGeometry(s * 0.65, s * 1.5, 7), capMat);
    cap.position.y = s * 1.85;
    g.add(st, cap);
  } else if (shape === 'funnel') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.40, s * 0.22, s * 1.5, 9), capMat);
    st.position.y = s * 0.75;
    cap = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.05, s * 0.42, s * 0.55, 10, 1, true), capMat);
    cap.position.y = s * 1.65;
    g.add(st, cap);
  } else if (shape === 'cordyceps') {
    for (let i = 0; i < 3; i++) {
      const club = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.24, s * 0.16, s * (2.2 + i * 0.25), 7), capMat);
      club.position.set((i - 1) * s * 0.42, s * 1.1, 0);
      club.rotation.z = (i - 1) * 0.14;
      g.add(club);
      if (i === 1) cap = club;
    }
  } else if (shape === 'puffball') {
    cap = new THREE.Mesh(new THREE.DodecahedronGeometry(s * 0.95, 1), capMat);
    cap.position.y = s * 0.85;
    g.add(cap);
  } else if (shape === 'cubensis') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.22, s * 0.30, s * 2.3, 8), stemMat);
    st.position.y = s * 1.15;
    const veil = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.24, s * 0.42, s * 0.24, 8, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x4c1d95, side: THREE.DoubleSide })
    );
    veil.position.y = s * 1.45;
    cap = new THREE.Mesh(new THREE.ConeGeometry(s * 1.05, s * 0.62, 12), capMat);
    cap.position.y = s * 2.35;
    g.add(st, veil, cap);
  } else {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.26, s * 0.36, s * 2.1, 7), stemMat);
    stem.position.y = s * 1.05;
    cap = new THREE.Mesh(new THREE.SphereGeometry(s * 0.95, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), capMat);
    cap.position.y = s * 1.95;
    g.add(stem, cap);
    if (shape === 'amanita_dots') {
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (let di = 0; di < 5; di++) {
        const a = (di / 5) * Math.PI * 2;
        const dot = new THREE.Mesh(new THREE.SphereGeometry(s * 0.14, 5, 5), dotMat);
        dot.position.set(Math.cos(a) * s * 0.52, s * 2.42, Math.sin(a) * s * 0.52);
        g.add(dot);
      }
    }
  }
  return { g, cap };
}

/**
 * Constrói bosques expandidos (Leste, Oeste, Norte, Sul), troncos caídos
 * e popula as 100 espécies de cogumelos respeitando habitat e culling por distância.
 */
export function buildExpandedForestAndMushrooms(ctx) {
  if (!THREE || !ctx || !ctx.scene) return;
  const { scene, wildMushrooms } = ctx;
  ctx.forestCullGroups = ctx.forestCullGroups || [];
  ctx.mushroomCullGroups = ctx.mushroomCullGroups || [];

  const treeKinds = ['oak', 'pine', 'ipe_yellow', 'ipe_purple', 'birch'];
  const woodLogs = [];

  // 48 árvores extras + 18 troncos caídos em anel de bosques (r = 52m..106m)
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2 + seededRand(i + 10) * 0.12;
    const rad = 52 + seededRand(i + 50) * 52;
    const tx = Math.cos(angle) * rad;
    const tz = Math.sin(angle) * rad;
    // Evita o pasto das vaquinhas (x: 34..72, z: 12..48)
    if (tx > 32 && tx < 74 && tz > 10 && tz < 50) continue;
    const ty = terrainHeight(tx, tz);
    const kind = treeKinds[i % treeKinds.length];
    const tree = makeCreativeTree(kind, tx, ty, tz, 0.85 + seededRand(i + 99) * 0.65);
    scene.add(tree);
    tree.updateMatrixWorld(true);
    tree.traverse((ch) => { ch.matrixAutoUpdate = false; });
    ctx.forestCullGroups.push({ obj: tree, x: tx, z: tz, maxDistSq: 62 * 62 });

    if (i % 3 === 0) {
      const lx = tx + (seededRand(i + 200) - 0.5) * 4.2;
      const lz = tz + (seededRand(i + 300) - 0.5) * 4.2;
      const ly = terrainHeight(lx, lz);
      const logMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.26, 2.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.95 })
      );
      logMesh.rotation.z = Math.PI / 2;
      logMesh.rotation.y = seededRand(i + 400) * Math.PI;
      logMesh.position.set(lx, ly + 0.18, lz);
      scene.add(logMesh);
      logMesh.updateMatrixWorld(true);
      logMesh.matrixAutoUpdate = false;
      ctx.forestCullGroups.push({ obj: logMesh, x: lx, z: lz, maxDistSq: 54 * 54 });
      woodLogs.push({ x: lx, y: ly + 0.36, z: lz });
    }
  }

  // Distribui todas as 100 espécies no mapa conforme o habitat
  const startIdx = wildMushrooms.length;
  for (let si = 0; si < MUSHROOM_SPECIES_CATALOG.length; si++) {
    const spec = MUSHROOM_SPECIES_CATALOG[si];
    let mx = 0, my = 0, mz = 0;

    if (spec.habitat === 'wood' && woodLogs.length > 0) {
      const log = woodLogs[si % woodLogs.length];
      mx = log.x + (seededRand(si * 7 + 1) - 0.5) * 1.4;
      mz = log.z + (seededRand(si * 7 + 2) - 0.5) * 1.4;
      my = log.y;
    } else if (spec.habitat === 'pasture') {
      mx = 38 + seededRand(si * 11 + 3) * 28;
      mz = 16 + seededRand(si * 11 + 4) * 28;
      my = terrainHeight(mx, mz);
    } else {
      const ang = seededRand(si * 13 + 5) * Math.PI * 2;
      const r = 48 + seededRand(si * 13 + 6) * 54;
      mx = Math.cos(ang) * r;
      mz = Math.sin(ang) * r;
      my = terrainHeight(mx, mz);
    }

    const { g, cap } = makeSpeciesMushroomMesh(spec);
    g.position.set(mx, my, mz);
    const id = `wild_${startIdx + si}`;
    cap.userData.wildMushId = id;
    cap.userData.speciesName = `${spec.common} (${spec.scientific})`;
    scene.add(g);
    g.updateMatrixWorld(true);
    g.traverse((ch) => { ch.matrixAutoUpdate = false; });

    wildMushrooms.push({
      id,
      group: g,
      capMesh: cap,
      species: spec,
      active: true,
      respawnAt: 0
    });
    ctx.mushroomCullGroups.push({ obj: g, x: mx, z: mz, maxDistSq: 38 * 38 });
  }
}

/**
 * Oculta árvores/troncos e cogumelos distantes para manter FPS alto no PC e Mobile.
 */
let lastForestCullAt = 0;
let lastForestCullX = 9999;
let lastForestCullZ = 9999;

export function stepForestDistanceCulling(ctx) {
  if (!ctx || !ctx.playerPos) return;
  const px = ctx.playerPos.x;
  const pz = ctx.playerPos.z;
  const now = performance.now();
  const movedSq = (px - lastForestCullX) * (px - lastForestCullX) + (pz - lastForestCullZ) * (pz - lastForestCullZ);
  if (now - lastForestCullAt < 180 && movedSq < 4.0) return;
  lastForestCullAt = now;
  lastForestCullX = px;
  lastForestCullZ = pz;

  const scale = (qualityState.forestScale || 1) * (qualityState.indoorForestFactor || 1);
  const scaleSq = scale * scale;
  const fList = ctx.forestCullGroups;
  if (fList) {
    for (let i = 0; i < fList.length; i++) {
      const it = fList[i];
      const dx = it.x - px, dz = it.z - pz;
      it.obj.visible = (dx * dx + dz * dz) <= (it.maxDistSq * scaleSq);
    }
  }
  const mList = ctx.mushroomCullGroups;
  if (mList) {
    for (let i = 0; i < mList.length; i++) {
      const it = mList[i];
      const dx = it.x - px, dz = it.z - pz;
      it.obj.visible = (dx * dx + dz * dz) <= (it.maxDistSq * scaleSq);
    }
  }
}
