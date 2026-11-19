/**
 * Catálogo de 100 Espécies de Cogumelos + Bosques Expandidos (MycoCampus3D)
 * Inclui espécies lignícolas (madeira/troncos), de mata (solo) e de pasto,
 * além de 5 tipos de árvores e culling por distância para manter 60 FPS.
 */
import { qualityState } from '../core/quality.js';

import { terrainHeight } from '../engine/physics.js';
import { isNaturalSoilSpot } from './nature-plaza.js';

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

let sharedSpeciesGeos = null;
const speciesMatCache = new Map();

function getMushroomSharedGeos() {
  if (sharedSpeciesGeos) return sharedSpeciesGeos;
  sharedSpeciesGeos = {
    cylStem: new THREE.CylinderGeometry(0.75, 1.0, 1.0, 8),
    cylFan: new THREE.CylinderGeometry(1.0, 0.36, 1.0, 10),
    cylFunnel: new THREE.CylinderGeometry(1.0, 0.38, 1.0, 10, 1, true),
    cylClub: new THREE.CylinderGeometry(1.0, 0.67, 1.0, 7),
    cylVeil: new THREE.CylinderGeometry(0.57, 1.0, 1.0, 8, 1, true),
    dome: new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.56),
    cup: new THREE.SphereGeometry(1, 10, 7, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65),
    dot: new THREE.SphereGeometry(1, 5, 5),
    cone12: new THREE.ConeGeometry(1, 1, 12),
    cone7: new THREE.ConeGeometry(1, 1, 7),
    dodeca: new THREE.DodecahedronGeometry(1, 1),
    torus: new THREE.TorusGeometry(1, 0.21, 6, 12)
  };
  Object.keys(sharedSpeciesGeos).forEach((k) => {
    sharedSpeciesGeos[k].userData.shared = true;
  });
  return sharedSpeciesGeos;
}

function getCachedSpeciesMat(colorHex, roughness, metalness, emissiveHex, emissiveInt, doubleSide, basic) {
  const key = `${colorHex}|${roughness}|${metalness}|${emissiveHex}|${emissiveInt}|${doubleSide ? 1 : 0}|${basic ? 1 : 0}`;
  let m = speciesMatCache.get(key);
  if (!m) {
    m = basic
      ? new THREE.MeshBasicMaterial({ color: colorHex })
      : new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness,
          metalness,
          emissive: emissiveHex,
          emissiveIntensity: emissiveInt,
          side: doubleSide ? THREE.DoubleSide : THREE.FrontSide
        });
    m.userData.shared = true;
    speciesMatCache.set(key, m);
  }
  return m;
}

function getSpeciesShape(spec) {
  const n = spec.scientific;
  if (n.indexOf('Hericium') !== -1) return 'lions_mane';
  if (n.indexOf('Ramaria') !== -1 || n.indexOf('Sparassis') !== -1 || n.indexOf('Clathrus') !== -1) return 'coral';
  if (n.indexOf('Macrolepiota') !== -1 || n.indexOf('Chlorophyllum') !== -1) return 'parasol';
  if (n.indexOf('Pleurotus eryngii') !== -1 || n.indexOf('Boletus') !== -1 || n.indexOf('Suillus') !== -1 || n.indexOf('Leccinum') !== -1) return 'king_oyster';
  if (n.indexOf('Pleurotus') !== -1 || n.indexOf('Ganoderma') !== -1 || n.indexOf('Trametes') !== -1 ||
      n.indexOf('Laetiporus') !== -1 || n.indexOf('Auricularia') !== -1 || n.indexOf('Grifola') !== -1 ||
      n.indexOf('Fomes') !== -1 || n.indexOf('Pycnoporus') !== -1 || n.indexOf('Polyporus') !== -1) return 'shelf';
  if (n.indexOf('Flammulina') !== -1 || n.indexOf('Coprinellus') !== -1 || n.indexOf('Mycena') !== -1) return 'enoki';
  if (n.indexOf('Morchella') !== -1) return 'morel';
  if (n.indexOf('Cookeina') !== -1 || n.indexOf('Sarcoscypha') !== -1 || n.indexOf('Peziza') !== -1) return 'cup';
  if (n.indexOf('Cantharellus') !== -1 || n.indexOf('Craterellus') !== -1 || n.indexOf('Lactarius') !== -1 || n.indexOf('Gomphus') !== -1) return 'funnel';
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

  const geos = getMushroomSharedGeos();
  const stemMat = getCachedSpeciesMat(spec.stemColor, 0.72, 0, 0x000000, 0, false, false);
  const capMat = getCachedSpeciesMat(
    spec.capColor,
    isGlossy ? 0.16 : 0.48,
    isGlossy ? 0.15 : 0.02,
    isGlow ? spec.capColor : 0x000000,
    isGlow ? 0.75 : 0,
    true,
    false
  );

  let cap = null;
  if (shape === 'lions_mane') {
    cap = new THREE.Mesh(geos.dodeca, capMat);
    cap.scale.setScalar(s * 1.15);
    cap.position.y = s * 1.05;
    for (let i = 0; i < 4; i++) {
      const tuft = new THREE.Mesh(geos.dodeca, capMat);
      const a = (i / 4) * Math.PI * 2;
      tuft.scale.setScalar(s * 0.65);
      tuft.position.set(Math.cos(a) * s * 0.55, s * 0.85, Math.sin(a) * s * 0.55);
      g.add(tuft);
    }
    g.add(cap);
  } else if (shape === 'shelf') {
    for (let i = 0; i < 6; i++) {
      const fanW = 1.05 - (i % 3) * 0.18;
      const fan = new THREE.Mesh(geos.cylFan, capMat);
      fan.scale.set(s * fanW, s * 0.18, s * fanW);
      fan.position.set(((i % 3) - 1) * s * 0.48, s * (0.35 + i * 0.24), Math.floor(i / 3) * s * 0.34);
      fan.rotation.x = 0.26;
      fan.rotation.z = ((i % 2) - 0.5) * 0.22;
      g.add(fan);
      if (i === 0) cap = fan;
    }
  } else if (shape === 'enoki') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const r = i === 0 ? 0 : s * 0.48;
      const st = new THREE.Mesh(geos.cylStem, stemMat);
      st.scale.set(s * 0.15, s * 2.4, s * 0.15);
      st.position.set(Math.cos(a) * r, s * 1.2, Math.sin(a) * r);
      const cp = new THREE.Mesh(geos.dome, capMat);
      cp.scale.setScalar(s * 0.42);
      cp.position.set(Math.cos(a) * r, s * 2.35, Math.sin(a) * r);
      g.add(st, cp);
      if (i === 0) cap = cp;
    }
  } else if (shape === 'king_oyster') {
    const st = new THREE.Mesh(geos.cylStem, stemMat);
    st.scale.set(s * 0.72, s * 1.9, s * 0.72);
    st.position.y = s * 0.95;
    cap = new THREE.Mesh(geos.dome, capMat);
    cap.scale.setScalar(s * 0.98);
    cap.position.y = s * 1.85;
    g.add(st, cap);
    [[s * 0.85, 0.52], [-s * 0.68, 0.40]].forEach(([bx, bSc]) => {
      const bst = new THREE.Mesh(geos.cylStem, stemMat);
      bst.scale.set(s * 0.5 * bSc, s * 1.4 * bSc, s * 0.5 * bSc);
      bst.position.set(bx, s * 0.7 * bSc, s * 0.25);
      const bcp = new THREE.Mesh(geos.dome, capMat);
      bcp.scale.setScalar(s * 0.75 * bSc);
      bcp.position.set(bx, s * 1.35 * bSc, s * 0.25);
      g.add(bst, bcp);
    });
  } else if (shape === 'morel') {
    const st = new THREE.Mesh(geos.cylStem, stemMat);
    st.scale.set(s * 0.38, s * 1.3, s * 0.38);
    st.position.y = s * 0.65;
    cap = new THREE.Mesh(geos.cone7, capMat);
    cap.scale.set(s * 0.65, s * 1.5, s * 0.65);
    cap.position.y = s * 1.85;
    g.add(st, cap);
  } else if (shape === 'cup') {
    for (let i = 0; i < 4; i++) {
      const scCup = i === 0 ? 1.0 : (0.65 + (i % 2) * 0.18);
      const ox = (i - 1.5) * s * 0.65;
      const oz = (i % 2 === 0 ? 0.2 : -0.25) * s;
      const st = new THREE.Mesh(geos.cylClub, stemMat);
      st.scale.set(s * 0.20 * scCup, s * 0.9 * scCup, s * 0.20 * scCup);
      st.position.set(ox, s * 0.45 * scCup, oz);
      const cup = new THREE.Mesh(geos.cup, capMat);
      cup.scale.setScalar(s * 0.55 * scCup);
      cup.position.set(ox, s * 1.15 * scCup, oz);
      cup.rotation.z = (i - 1.5) * 0.18;
      g.add(st, cup);
      if (i === 0) cap = cup;
    }
  } else if (shape === 'funnel') {
    for (let i = 0; i < 4; i++) {
      const fSc = i === 0 ? 1.0 : 0.72;
      const ang = (i / 4) * Math.PI * 2;
      const fx = i === 0 ? 0 : Math.cos(ang) * s * 0.55;
      const fz = i === 0 ? 0 : Math.sin(ang) * s * 0.55;
      const st = new THREE.Mesh(geos.cylClub, capMat);
      st.scale.set(s * 0.36 * fSc, s * 1.45 * fSc, s * 0.36 * fSc);
      st.position.set(fx, s * 0.72 * fSc, fz);
      const fn = new THREE.Mesh(geos.cylFunnel, capMat);
      fn.scale.set(s * 0.95 * fSc, s * 0.52 * fSc, s * 0.95 * fSc);
      fn.position.set(fx, s * 1.60 * fSc, fz);
      fn.rotation.z = (i === 0 ? 0 : Math.cos(ang)) * 0.16;
      g.add(st, fn);
      if (i === 0) cap = fn;
    }
  } else if (shape === 'coral') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const br = new THREE.Mesh(geos.cylClub, capMat);
      br.scale.set(s * 0.20, s * 1.9, s * 0.20);
      br.position.set(Math.cos(a) * s * 0.32, s * 0.95, Math.sin(a) * s * 0.32);
      br.rotation.set(Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28);
      g.add(br);
      if (i === 0) cap = br;
    }
  } else if (shape === 'parasol') {
    const st = new THREE.Mesh(geos.cylStem, stemMat);
    st.scale.set(s * 0.24, s * 3.1, s * 0.24);
    st.position.y = s * 1.55;
    const ring = new THREE.Mesh(geos.torus, stemMat);
    ring.scale.setScalar(s * 0.24);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = s * 2.25;
    cap = new THREE.Mesh(geos.cone12, capMat);
    cap.scale.set(s * 1.28, s * 0.42, s * 1.28);
    cap.position.y = s * 3.15;
    g.add(st, ring, cap);
  } else if (shape === 'cordyceps') {
    for (let i = 0; i < 3; i++) {
      const club = new THREE.Mesh(geos.cylClub, capMat);
      club.scale.set(s * 0.24, s * (2.2 + i * 0.25), s * 0.24);
      club.position.set((i - 1) * s * 0.42, s * 1.1, 0);
      club.rotation.z = (i - 1) * 0.14;
      g.add(club);
      if (i === 1) cap = club;
    }
  } else if (shape === 'puffball') {
    cap = new THREE.Mesh(geos.dodeca, capMat);
    cap.scale.setScalar(s * 0.95);
    cap.position.y = s * 0.88;
    g.add(cap);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const mini = new THREE.Mesh(geos.dodeca, capMat);
      mini.scale.setScalar(s * 0.42);
      mini.position.set(Math.cos(a) * s * 0.72, s * 0.38, Math.sin(a) * s * 0.72);
      g.add(mini);
    }
  } else if (shape === 'cubensis') {
    const st = new THREE.Mesh(geos.cylStem, stemMat);
    st.scale.set(s * 0.30, s * 2.3, s * 0.30);
    st.position.y = s * 1.15;
    const veilMat = getCachedSpeciesMat(0x4c1d95, 0.7, 0, 0x000000, 0, true, false);
    const veil = new THREE.Mesh(geos.cylVeil, veilMat);
    veil.scale.set(s * 0.42, s * 0.24, s * 0.42);
    veil.position.y = s * 1.45;
    cap = new THREE.Mesh(geos.cone12, capMat);
    cap.scale.set(s * 1.05, s * 0.62, s * 1.05);
    cap.position.y = s * 2.35;
    g.add(st, veil, cap);
  } else {
    const stem = new THREE.Mesh(geos.cylStem, stemMat);
    stem.scale.set(s * 0.36, s * 2.1, s * 0.36);
    stem.position.y = s * 1.05;
    cap = new THREE.Mesh(geos.dome, capMat);
    cap.scale.setScalar(s * 0.95);
    cap.position.y = s * 1.95;
    g.add(stem, cap);
    if (shape === 'amanita_dots') {
      const dotMat = getCachedSpeciesMat(0xffffff, 0.5, 0, 0, 0, false, true);
      for (let di = 0; di < 5; di++) {
        const a = (di / 5) * Math.PI * 2;
        const dot = new THREE.Mesh(geos.dot, dotMat);
        dot.scale.setScalar(s * 0.14);
        dot.position.set(Math.cos(a) * s * 0.52, s * 2.42, Math.sin(a) * s * 0.52);
        g.add(dot);
      }
    }
  }
  return { g, cap };
}

/**
 * Constrói bosques expandidos via InstancedMesh (4 draw calls para 48 árvores + 16 troncos)
 * e popula as 100 espécies de cogumelos compartilhando geometrias e materiais.
 */
export function buildExpandedForestAndMushrooms(ctx) {
  if (!THREE || !ctx || !ctx.scene) return;
  const { scene, wildMushrooms } = ctx;
  ctx.forestCullGroups = ctx.forestCullGroups || [];
  ctx.forestInstChunks = ctx.forestInstChunks || [];
  ctx.mushroomCullGroups = ctx.mushroomCullGroups || [];

  const treeKinds = ['oak', 'pine', 'ipe_yellow', 'ipe_purple', 'birch'];
  const treeSpecs = [];
  const woodLogs = [];

  for (let i = 0; i < 48; i++) {
    let tx = 0, tz = 0, foundTree = false;
    for (let att = 0; att < 8; att++) {
      const angle = ((i + att * 3.7) / 48) * Math.PI * 2 + seededRand(i + 10 + att * 19) * 0.14;
      const rad = 52 + seededRand(i + 50 + att * 23) * 52;
      tx = Math.cos(angle) * rad;
      tz = Math.sin(angle) * rad;
      if (isNaturalSoilSpot(tx, tz, 2.2) && !(tx > 32 && tx < 74 && tz > 10 && tz < 50)) {
        foundTree = true;
        break;
      }
    }
    if (!foundTree) continue;
    const ty = terrainHeight(tx, tz);
    const kind = treeKinds[i % treeKinds.length];
    const sc = 0.85 + seededRand(i + 99) * 0.65;
    treeSpecs.push({ x: tx, y: ty, z: tz, kind, scale: sc });

    if (i % 3 === 0) {
      const lx = tx + (seededRand(i + 200) - 0.5) * 4.2;
      const lz = tz + (seededRand(i + 300) - 0.5) * 4.2;
      if (isNaturalSoilSpot(lx, lz, 1.8)) {
        const ly = terrainHeight(lx, lz);
        woodLogs.push({ x: lx, y: ly + 0.36, baseY: ly + 0.18, z: lz, rotY: seededRand(i + 400) * Math.PI });
      }
    }
  }

  let pineConeTotal = 0;
  let foliageTotal = 0;
  for (let i = 0; i < treeSpecs.length; i++) {
    const k = treeSpecs[i].kind;
    if (k === 'pine') pineConeTotal += 3;
    else if (k === 'ipe_yellow' || k === 'ipe_purple') foliageTotal += 4;
    else foliageTotal += 1;
  }

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 8);
  trunkGeo.userData.shared = true;
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  trunkMat.userData.shared = true;
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, treeSpecs.length));
  trunkInst.frustumCulled = false;
  trunkInst.userData.isDynamic = true;

  let pineInst = null;
  if (pineConeTotal > 0) {
    const pGeo = new THREE.ConeGeometry(1, 1, 8);
    pGeo.userData.shared = true;
    const pMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85 });
    pMat.userData.shared = true;
    pineInst = new THREE.InstancedMesh(pGeo, pMat, pineConeTotal);
    pineInst.frustumCulled = false;
    pineInst.userData.isDynamic = true;
  }

  let foliageInst = null;
  if (foliageTotal > 0) {
    const fGeo = new THREE.DodecahedronGeometry(1, 1);
    fGeo.userData.shared = true;
    const fMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
    fMat.userData.shared = true;
    foliageInst = new THREE.InstancedMesh(fGeo, fMat, foliageTotal);
    foliageInst.frustumCulled = false;
    foliageInst.userData.isDynamic = true;
  }

  let pineCursor = 0;
  let foliageCursor = 0;
  const IPE_PUFFS = [[-0.7, 3.4, 0.2], [0.7, 3.3, -0.3], [0, 3.9, 0.1], [0.2, 3.2, 0.7]];

  for (let i = 0; i < treeSpecs.length; i++) {
    const ts = treeSpecs[i];
    const items = [];
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(ts.x, ts.y + 1.6 * ts.scale, ts.z);
    dummy.scale.setScalar(ts.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    tmpColor.setHex(ts.kind === 'birch' ? 0xf1f5f9 : (ts.kind === 'pine' ? 0x5c3a21 : 0x6b4423));
    trunkInst.setColorAt(i, tmpColor);
    items.push({ inst: trunkInst, idx: i, activeMat: dummy.matrix.clone() });

    if (ts.kind === 'pine' && pineInst) {
      for (let pi = 0; pi < 3; pi++) {
        const cy = 2.6 + pi * 0.95;
        const radC = (1.5 - pi * 0.35) * ts.scale;
        const hC = (1.8 - pi * 0.2) * ts.scale;
        dummy.position.set(ts.x, ts.y + cy * ts.scale, ts.z);
        dummy.scale.set(radC, hC, radC);
        dummy.updateMatrix();
        pineInst.setMatrixAt(pineCursor, dummy.matrix);
        items.push({ inst: pineInst, idx: pineCursor, activeMat: dummy.matrix.clone() });
        pineCursor++;
      }
    } else if ((ts.kind === 'ipe_yellow' || ts.kind === 'ipe_purple') && foliageInst) {
      tmpColor.setHex(ts.kind === 'ipe_yellow' ? 0xfacc15 : 0xa855f7);
      for (let pk = 0; pk < IPE_PUFFS.length; pk++) {
        const p = IPE_PUFFS[pk];
        dummy.position.set(ts.x + p[0] * ts.scale, ts.y + p[1] * ts.scale, ts.z + p[2] * ts.scale);
        dummy.scale.setScalar(0.95 * ts.scale);
        dummy.updateMatrix();
        foliageInst.setMatrixAt(foliageCursor, dummy.matrix);
        foliageInst.setColorAt(foliageCursor, tmpColor);
        items.push({ inst: foliageInst, idx: foliageCursor, activeMat: dummy.matrix.clone() });
        foliageCursor++;
      }
    } else if (foliageInst) {
      tmpColor.setHex(ts.kind === 'birch' ? 0x4ade80 : 0x15803d);
      dummy.position.set(ts.x, ts.y + 3.7 * ts.scale, ts.z);
      dummy.scale.setScalar(1.5 * ts.scale);
      dummy.updateMatrix();
      foliageInst.setMatrixAt(foliageCursor, dummy.matrix);
      foliageInst.setColorAt(foliageCursor, tmpColor);
      items.push({ inst: foliageInst, idx: foliageCursor, activeMat: dummy.matrix.clone() });
      foliageCursor++;
    }

    ctx.forestInstChunks.push({ x: ts.x, z: ts.z, maxDistSq: 62 * 62, visible: true, items });
  }

  trunkInst.instanceMatrix.needsUpdate = true;
  if (trunkInst.instanceColor) trunkInst.instanceColor.needsUpdate = true;
  scene.add(trunkInst);
  if (pineInst) {
    pineInst.instanceMatrix.needsUpdate = true;
    scene.add(pineInst);
  }
  if (foliageInst) {
    foliageInst.instanceMatrix.needsUpdate = true;
    if (foliageInst.instanceColor) foliageInst.instanceColor.needsUpdate = true;
    scene.add(foliageInst);
  }

  if (woodLogs.length > 0) {
    const logGeo = new THREE.CylinderGeometry(0.22, 0.26, 2.4, 8);
    logGeo.userData.shared = true;
    const logMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.95 });
    logMat.userData.shared = true;
    const logInst = new THREE.InstancedMesh(logGeo, logMat, woodLogs.length);
    logInst.frustumCulled = false;
    logInst.userData.isDynamic = true;
    for (let li = 0; li < woodLogs.length; li++) {
      const lg = woodLogs[li];
      dummy.position.set(lg.x, lg.baseY, lg.z);
      dummy.rotation.set(0, lg.rotY, Math.PI / 2);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      logInst.setMatrixAt(li, dummy.matrix);
      ctx.forestInstChunks.push({
        x: lg.x,
        z: lg.z,
        maxDistSq: 54 * 54,
        visible: true,
        items: [{ inst: logInst, idx: li, activeMat: dummy.matrix.clone() }]
      });
    }
    logInst.instanceMatrix.needsUpdate = true;
    scene.add(logInst);
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
      for (let att = 0; att < 14; att++) {
        const candX = 54 + seededRand(si * 11 + 3 + att * 17) * 26;
        const candZ = -26 + seededRand(si * 11 + 4 + att * 29) * 58;
        if (isNaturalSoilSpot(candX, candZ, 1.0)) { mx = candX; mz = candZ; break; }
      }
      if (mx === 0 && mz === 0) { mx = 68; mz = 8; }
      my = terrainHeight(mx, mz);
    } else {
      for (let att = 0; att < 14; att++) {
        const ang = seededRand(si * 13 + 5 + att * 23) * Math.PI * 2;
        const r = 48 + seededRand(si * 13 + 6 + att * 31) * 54;
        const candX = Math.cos(ang) * r;
        const candZ = Math.sin(ang) * r;
        if (isNaturalSoilSpot(candX, candZ, 1.0)) { mx = candX; mz = candZ; break; }
      }
      if (mx === 0 && mz === 0) { mx = -72; mz = -20; }
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
let lastForestScale = -1;
const _zeroScaleMat4 = (THREE && THREE.Matrix4) ? new THREE.Matrix4().makeScale(0, 0, 0) : null;
const _dirtyInstMeshes = new Set();

export function stepForestDistanceCulling(ctx) {
  if (!ctx || !ctx.playerPos) return;
  const px = ctx.playerPos.x;
  const pz = ctx.playerPos.z;
  const now = performance.now();
  const scale = (qualityState.forestScale || 1) * (qualityState.indoorForestFactor || 1);
  const movedSq = (px - lastForestCullX) * (px - lastForestCullX) + (pz - lastForestCullZ) * (pz - lastForestCullZ);
  if (now - lastForestCullAt < 180 && movedSq < 4.0 && Math.abs(scale - lastForestScale) < 0.02) return;
  lastForestCullAt = now;
  lastForestCullX = px;
  lastForestCullZ = pz;
  lastForestScale = scale;

  const scaleSq = scale * scale;
  const fChunks = ctx.forestInstChunks;
  if (fChunks && fChunks.length && _zeroScaleMat4) {
    _dirtyInstMeshes.clear();
    for (let i = 0; i < fChunks.length; i++) {
      const ch = fChunks[i];
      const dx = ch.x - px, dz = ch.z - pz;
      const shouldShow = (dx * dx + dz * dz) <= (ch.maxDistSq * scaleSq);
      if (shouldShow === ch.visible) continue;
      ch.visible = shouldShow;
      const mat4 = shouldShow ? null : _zeroScaleMat4;
      for (let k = 0; k < ch.items.length; k++) {
        const ref = ch.items[k];
        ref.inst.setMatrixAt(ref.idx, mat4 || ref.activeMat);
        _dirtyInstMeshes.add(ref.inst);
      }
    }
    if (_dirtyInstMeshes.size > 0) {
      _dirtyInstMeshes.forEach((inst) => { inst.instanceMatrix.needsUpdate = true; });
      _dirtyInstMeshes.clear();
    }
  }
  const fList = ctx.forestCullGroups;
  if (fList && fList.length) {
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
