import { GAME_CONFIG } from '../core/config.js';

const THREE = window.THREE;
const SOLAR_DISTANCE_SCALE = 7000;
const EARTH_OFFSET_X = 5000;
const PLANETS = [
  { name: 'Mercúrio', au: 0.39, radius: 11, color: 0x9ca3af, angle: -1.7 },
  { name: 'Vênus', au: 0.72, radius: 18, color: 0xfbbf24, angle: 0.9 },
  { name: 'Terra', au: 1, radius: 420, color: 0x2563eb, angle: 0 },
  { name: 'Marte', au: 1.52, radius: 15, color: 0xef4444, angle: 2.1 },
  { name: 'Júpiter', au: 5.2, radius: 74, color: 0xd6a77a, angle: 3.1 },
  { name: 'Saturno', au: 9.58, radius: 64, color: 0xe7d3a6, angle: -0.55 },
  { name: 'Urano', au: 19.2, radius: 43, color: 0x67e8f9, angle: 2.55 },
  { name: 'Netuno', au: 30.05, radius: 41, color: 0x3b82f6, angle: 0.35 },
  { name: 'Plutão', au: 39.5, radius: 9, color: 0xc4b5a5, angle: -2.7 }
];

function orbitDistance(au) {
  return SOLAR_DISTANCE_SCALE * Math.log1p(au);
}

function createLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.font = 'bold 34px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = 'rgba(2, 6, 23, 0.78)';
  context.fillRect(12, 12, 488, 72);
  context.strokeStyle = 'rgba(147, 197, 253, 0.75)';
  context.lineWidth = 3;
  context.strokeRect(12, 12, 488, 72);
  context.fillStyle = '#f8fafc';
  context.fillText(text, 256, 49, 460);
  const texture = new THREE.CanvasTexture(canvas);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    fog: false
  }));
  label.scale.set(150, 28, 1);
  return label;
}

function createEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#1d4ed8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#4d8b57';
  const landmasses = [
    [125, 80, 68, 34], [174, 143, 28, 58], [270, 75, 58, 28],
    [350, 125, 92, 48], [438, 180, 34, 20], [56, 184, 28, 15]
  ];
  landmasses.forEach(([x, y, rx, ry]) => {
    context.beginPath();
    context.ellipse(x, y, rx, ry, -0.18, 0, Math.PI * 2);
    context.fill();
  });
  context.fillStyle = 'rgba(226, 232, 240, 0.78)';
  context.fillRect(0, 0, canvas.width, 16);
  context.fillRect(0, canvas.height - 16, canvas.width, 16);
  return new THREE.CanvasTexture(canvas);
}

export function buildSolarSystem(scene) {
  const group = new THREE.Group();
  const earthOrbit = orbitDistance(1);
  group.position.set(EARTH_OFFSET_X - earthOrbit, GAME_CONFIG.atmosphere.solarSystemHeight, 0);
  group.visible = false;

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(170, 24, 18),
    new THREE.MeshBasicMaterial({ color: 0xffc857 })
  );
  group.add(sun);
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(245, 20, 16),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.17,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  group.add(sunGlow);
  const solarLight = new THREE.PointLight(0xfff1c1, 15000000, 60000, 2);
  group.add(solarLight);

  PLANETS.forEach((planet) => {
    const distance = orbitDistance(planet.au);
    const orbitPoints = [];
    for (let i = 0; i < 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      orbitPoints.push(new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance));
    }
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    group.add(new THREE.LineLoop(
      orbitGeometry,
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.16, depthWrite: false })
    ));

    const x = Math.cos(planet.angle) * distance;
    const z = Math.sin(planet.angle) * distance;
    const material = planet.name === 'Terra'
      ? new THREE.MeshStandardMaterial({ map: createEarthTexture(), roughness: 0.82, metalness: 0.02 })
      : new THREE.MeshStandardMaterial({ color: planet.color, roughness: 0.88, metalness: 0.01 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(planet.radius, 24, 18), material);
    const planetY = planet.name === 'Terra' ? -planet.radius : 0;
    body.position.set(x, planetY, z);
    group.add(body);

    if (planet.name === 'Saturno') {
      const rings = new THREE.Mesh(
        new THREE.RingGeometry(planet.radius * 1.3, planet.radius * 2.1, 36),
        new THREE.MeshBasicMaterial({
          color: 0xd6c39a,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      rings.rotation.x = -Math.PI / 2;
      rings.position.copy(body.position);
      group.add(rings);
    }

    const label = createLabel(planet.name + ' · ' + planet.au.toFixed(2) + ' AU');
    label.position.set(x, planetY + planet.radius + 68, z);
    group.add(label);

    if (planet.name === 'Terra') {
      const moonOrbit = new THREE.Mesh(
        new THREE.RingGeometry(72, 74, 48),
        new THREE.MeshBasicMaterial({
          color: 0xcbd5e1,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      moonOrbit.rotation.x = -Math.PI / 2;
      moonOrbit.position.set(x, 0, z);
      group.add(moonOrbit);

      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(13, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.94 })
      );
      moon.position.set(x + 73, 0, z);
      group.add(moon);
      const moonLabel = createLabel('Lua · 384 mil km');
      moonLabel.position.set(x + 73, 43, z);
      group.add(moonLabel);
    }
  });

  scene.add(group);
  return group;
}

export function stepSolarSystem(group, altitude) {
  if (!group) return;
  group.visible = altitude >= GAME_CONFIG.atmosphere.spaceTransitionAltitude;
}
