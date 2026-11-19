/**
 * Abobada Celeste Realista & Constelacoes Famosas (MycoCampus3D)
 * Constelacoes reais em coordenadas esfericas (RA/Dec simplificadas), cores estelares (O/B/A/F/G/K/M),
 * cintilacao e rotacao celeste continua acompanhando o ciclo Dia/Noite.
 */

const THREE = (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || null;

// Coordenadas (raDeg: 0..360, decDeg: -65..+85), mag relativa (0.4..1.0) e cor espectral realista
export const FAMOUS_CONSTELLATIONS = [
  {
    id: 'orion',
    name: 'Órion',
    stars: [
      { id: 'betelgeuse', ra: 88.8, dec: 24.4, mag: 1.0, col: 0xffa06b },  // Gigante vermelha
      { id: 'bellatrix', ra: 81.3, dec: 22.3, mag: 0.82, col: 0xcfe8ff },
      { id: 'alnitak', ra: 85.2, dec: 15.0, mag: 0.85, col: 0xbfe0ff },    // Tres Marias
      { id: 'alnilam', ra: 84.1, dec: 15.8, mag: 0.90, col: 0xdbeafe },
      { id: 'mintaka', ra: 83.0, dec: 16.6, mag: 0.82, col: 0xdbeafe },
      { id: 'saiph', ra: 86.9, dec: 7.3, mag: 0.78, col: 0xcfe8ff },
      { id: 'rigel', ra: 78.6, dec: 8.8, mag: 1.0, col: 0x93c5fd },        // Supergigante azul
      { id: 'meissa', ra: 83.8, dec: 28.9, mag: 0.65, col: 0xe0f2fe }
    ],
    edges: [[0, 1], [0, 7], [1, 7], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [5, 6]]
  },
  {
    id: 'crux',
    name: 'Cruzeiro do Sul',
    stars: [
      { id: 'acrux', ra: 186.6, dec: 35.0, mag: 1.0, col: 0x93c5fd },
      { id: 'mimosa', ra: 191.9, dec: 40.8, mag: 0.96, col: 0xbfdbfe },
      { id: 'gacrux', ra: 187.8, dec: 46.5, mag: 0.92, col: 0xfdba74 },   // Laranja
      { id: 'imai', ra: 183.8, dec: 41.2, mag: 0.76, col: 0xe0f2fe },
      { id: 'intrometida', ra: 185.3, dec: 38.0, mag: 0.58, col: 0xfef3c7 }
    ],
    edges: [[0, 2], [1, 3]]
  },
  {
    id: 'ursa_major',
    name: 'Ursa Maior (Grande Carro)',
    stars: [
      { id: 'dubhe', ra: 280.9, dec: 61.7, mag: 0.94, col: 0xfde68a },
      { id: 'merak', ra: 280.5, dec: 56.4, mag: 0.82, col: 0xf8fafc },
      { id: 'phecda', ra: 292.5, dec: 53.7, mag: 0.80, col: 0xf8fafc },
      { id: 'megrez', ra: 298.9, dec: 57.0, mag: 0.68, col: 0xf1f5f9 },
      { id: 'alioth', ra: 308.5, dec: 55.9, mag: 0.94, col: 0xe0f2fe },
      { id: 'mizar', ra: 316.0, dec: 54.9, mag: 0.88, col: 0xe0f2fe },
      { id: 'alkaid', ra: 326.9, dec: 49.3, mag: 0.92, col: 0xbfdbfe }
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]]
  },
  {
    id: 'cassiopeia',
    name: 'Cassiopeia',
    stars: [
      { id: 'caph', ra: 2.3, dec: 59.1, mag: 0.84, col: 0xfef3c7 },
      { id: 'schedar', ra: 10.1, dec: 56.5, mag: 0.90, col: 0xfdba74 },
      { id: 'navi', ra: 14.2, dec: 60.7, mag: 0.88, col: 0xbfdbfe },
      { id: 'ruchbah', ra: 21.5, dec: 60.2, mag: 0.78, col: 0xe0f2fe },
      { id: 'segin', ra: 28.6, dec: 63.7, mag: 0.72, col: 0xdbeafe }
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]]
  },
  {
    id: 'scorpius',
    name: 'Escorpião',
    stars: [
      { id: 'graffias', ra: 241.3, dec: 30.4, mag: 0.80, col: 0xdbeafe },
      { id: 'dschubba', ra: 240.1, dec: 26.7, mag: 0.82, col: 0xcfe8ff },
      { id: 'antares', ra: 247.3, dec: 24.0, mag: 1.0, col: 0xfb7185 },   // Supergigante vermelha
      { id: 'epsilon_sco', ra: 252.5, dec: 15.8, mag: 0.82, col: 0xfdba74 },
      { id: 'sargas', ra: 264.3, dec: 10.1, mag: 0.84, col: 0xfef3c7 },
      { id: 'shaula', ra: 263.4, dec: 14.9, mag: 0.94, col: 0xbfdbfe },
      { id: 'lesath', ra: 262.7, dec: 15.7, mag: 0.78, col: 0xdbeafe }
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]
  },
  {
    id: 'cygnus',
    name: 'Cisne (Cruz do Norte)',
    stars: [
      { id: 'deneb', ra: 310.3, dec: 45.3, mag: 1.0, col: 0xe0f2fe },
      { id: 'sadr', ra: 305.5, dec: 40.2, mag: 0.88, col: 0xfef3c7 },
      { id: 'albireo', ra: 292.7, dec: 27.9, mag: 0.76, col: 0xfde68a },
      { id: 'gienah', ra: 311.5, dec: 33.9, mag: 0.80, col: 0xfdba74 },
      { id: 'fawaris', ra: 296.2, dec: 45.1, mag: 0.78, col: 0xdbeafe }
    ],
    edges: [[0, 1], [1, 2], [3, 1], [1, 4]]
  },
  {
    id: 'pleiades',
    name: 'Plêiades (Sete Irmãs)',
    stars: [
      { id: 'alcyone', ra: 56.9, dec: 34.1, mag: 0.90, col: 0x93c5fd },
      { id: 'atlas', ra: 57.3, dec: 34.0, mag: 0.76, col: 0xbfdbfe },
      { id: 'electra', ra: 56.2, dec: 34.1, mag: 0.78, col: 0xbfdbfe },
      { id: 'maia', ra: 56.5, dec: 34.4, mag: 0.76, col: 0xcfe8ff },
      { id: 'merope', ra: 56.6, dec: 33.8, mag: 0.74, col: 0x93c5fd },
      { id: 'taygeta', ra: 56.3, dec: 34.6, mag: 0.72, col: 0xdbeafe }
    ],
    edges: [[2, 3], [3, 0], [0, 1], [0, 4], [3, 5]]
  }
];

export function equatorialToDomeXYZ(raDeg, decDeg, radius = 205) {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (Math.max(4, Math.min(88, decDeg)) * Math.PI) / 180;
  const cosD = Math.cos(dec);
  return [
    Math.cos(ra) * cosD * radius,
    Math.sin(dec) * radius + 12,
    Math.sin(ra) * cosD * radius
  ];
}

function createStarSpriteTexture() {
  if (typeof document === 'undefined' || !THREE) return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.28, 'rgba(240,248,255,0.92)');
  grad.addColorStop(0.58, 'rgba(186,230,253,0.35)');
  grad.addColorStop(1.0, 'rgba(186,230,253,0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.userData.shared = true;
  return tex;
}

export function createCelestialSkyDome(scene) {
  if (!THREE || !scene) return null;

  const domeGroup = new THREE.Group();
  domeGroup.userData.isDynamic = true;
  domeGroup.userData.keepDynamic = true;

  const starSpriteTex = createStarSpriteTexture();
  const cStarsPos = [];
  const cStarsCol = [];
  const cLinePos = [];
  const cLineCol = [];
  const tmpColor = new THREE.Color();

  for (let ci = 0; ci < FAMOUS_CONSTELLATIONS.length; ci++) {
    const con = FAMOUS_CONSTELLATIONS[ci];
    const pts = [];
    for (let si = 0; si < con.stars.length; si++) {
      const s = con.stars[si];
      const p = equatorialToDomeXYZ(s.ra, s.dec, 204);
      pts.push(p);
      cStarsPos.push(p[0], p[1], p[2]);
      tmpColor.setHex(s.col);
      const bright = 0.65 + s.mag * 0.45;
      cStarsCol.push(tmpColor.r * bright, tmpColor.g * bright, tmpColor.b * bright);
    }
    for (let ei = 0; ei < con.edges.length; ei++) {
      const e = con.edges[ei];
      const a = pts[e[0]];
      const b = pts[e[1]];
      if (!a || !b) continue;
      cLinePos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      cLineCol.push(0.45, 0.78, 0.98, 0.45, 0.78, 0.98);
    }
  }

  const conStarGeo = new THREE.BufferGeometry();
  conStarGeo.setAttribute('position', new THREE.Float32BufferAttribute(cStarsPos, 3));
  conStarGeo.setAttribute('color', new THREE.Float32BufferAttribute(cStarsCol, 3));
  const conStarMat = new THREE.PointsMaterial({
    size: starSpriteTex ? 5.8 : 2.6,
    map: starSpriteTex || null,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const conStars = new THREE.Points(conStarGeo, conStarMat);

  const conLineGeo = new THREE.BufferGeometry();
  conLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(cLinePos, 3));
  conLineGeo.setAttribute('color', new THREE.Float32BufferAttribute(cLineCol, 3));
  const conLineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false
  });
  const conLines = new THREE.LineSegments(conLineGeo, conLineMat);

  // Campo de estrelas de fundo (Via Lactea e estrelas gerais)
  const bgCount = 420;
  const bgPos = new Float32Array(bgCount * 3);
  const bgCol = new Float32Array(bgCount * 3);
  const bgPalette = [0xf8fafc, 0xdbeafe, 0xfef3c7, 0xfed7aa, 0xe0f2fe];
  for (let st = 0; st < bgCount; st++) {
    const sTheta = (st * 2.399963) % (Math.PI * 2);
    const sPhi = Math.asin(Math.max(0.05, Math.min(0.99, ((st * 0.618034) % 1))));
    const dist = 214;
    bgPos[st * 3] = Math.cos(sTheta) * Math.cos(sPhi) * dist;
    bgPos[st * 3 + 1] = Math.sin(sPhi) * dist + 14;
    bgPos[st * 3 + 2] = Math.sin(sTheta) * Math.cos(sPhi) * dist;
    tmpColor.setHex(bgPalette[st % bgPalette.length]);
    const lum = 0.55 + ((st * 17) % 10) * 0.045;
    bgCol[st * 3] = tmpColor.r * lum;
    bgCol[st * 3 + 1] = tmpColor.g * lum;
    bgCol[st * 3 + 2] = tmpColor.b * lum;
  }
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
  bgGeo.setAttribute('color', new THREE.BufferAttribute(bgCol, 3));
  const bgMat = new THREE.PointsMaterial({
    size: starSpriteTex ? 2.4 : 1.35,
    map: starSpriteTex || null,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false
  });
  const bgStars = new THREE.Points(bgGeo, bgMat);

  domeGroup.add(bgStars, conLines, conStars);
  scene.add(domeGroup);

  return {
    group: domeGroup,
    bgStars,
    bgMat,
    conStars,
    conStarMat,
    conLines,
    conLineMat
  };
}

export function updateCelestialSkyDome(dome, dayFrac, sunY, weatherMode, elapsedTime) {
  if (!dome || !dome.group) return;
  const skyMul = weatherMode === 'rain' ? 0.12 : (weatherMode === 'overcast' ? 0.25 : (weatherMode === 'snow' ? 0.55 : 1.0));
  const nightVis = Math.max(0, Math.min(1, (-sunY + 0.04) * 2.8)) * skyMul;
  const visible = nightVis > 0.02;
  dome.group.visible = visible;
  if (!visible) return;

  // Movimento sideral continuo passando pelo ceu ao longo da noite + leve inclinacao axial
  dome.group.rotation.y = (dayFrac * Math.PI * 2) + (elapsedTime || 0) * 0.004;
  dome.group.rotation.z = 0.12;

  const twinkle = 0.90 + Math.sin((elapsedTime || 0) * 2.2) * 0.10;
  dome.bgMat.opacity = Math.min(0.92, nightVis * 0.88);
  dome.conStarMat.opacity = Math.min(1.0, nightVis * twinkle);
  dome.conLineMat.opacity = Math.min(0.32, nightVis * 0.30);
}
