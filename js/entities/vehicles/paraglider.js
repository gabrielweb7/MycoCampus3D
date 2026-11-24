import { terrainHeight } from '../../engine/physics.js';

export function createParagliderWingMesh(scale) {
  var wg = new THREE.Group();
  var s = scale || 1;
  var panelColors = [0xec4899, 0x8b5cf6, 0x3b82f6, 0x06b6d4, 0xfacc15, 0xf97316, 0xef4444];
  var spanCount = panelColors.length;
  var segW = 0.56 * s;
  for (var i = 0; i < spanCount; i++) {
    var offset = i - (spanCount - 1) / 2;
    var arcX = offset * segW * 0.92;
    var arcY = -Math.pow(Math.abs(offset) / 3.2, 2) * 0.55 * s;
    var tiltZ = -offset * 0.16;
    var cellMat = new THREE.MeshStandardMaterial({
      color: panelColors[i], roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide
    });
    var cell = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.08 * s, 1.35 * s), cellMat);
    cell.position.set(arcX, 2.55 * s + arcY, 0);
    cell.rotation.z = tiltZ;
    wg.add(cell);
  }
  var lineMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.72 });
  var linePts = [];
  [-1.45 * s, -0.75 * s, 0.75 * s, 1.45 * s].forEach(function (lx) {
    var handX = lx < 0 ? -0.34 * s : 0.34 * s;
    var topY = 2.52 * s - Math.pow(Math.abs(lx) / (1.8 * s), 2) * 0.45 * s;
    linePts.push(lx, topY, -0.38 * s, handX, 0.95 * s, -0.18 * s);
    linePts.push(lx, topY, 0.38 * s, handX, 0.95 * s, -0.18 * s);
  });
  var lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
  wg.add(new THREE.LineSegments(lGeo, lineMat));
  var handleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  [-0.34 * s, 0.34 * s].forEach(function (hx) {
    var hdl = new THREE.Mesh(new THREE.TorusGeometry(0.055 * s, 0.015 * s, 6, 12), handleMat);
    hdl.position.set(hx, 0.93 * s, -0.18 * s);
    wg.add(hdl);
  });
  return wg;
}

export function createRoundParachuteMesh(scale) {
  var pg = new THREE.Group();
  var s = scale || 1;
  var gores = 8;
  var radius = 1.85 * s;
  var topY = 2.95 * s;
  var redMat = new THREE.MeshLambertMaterial({ color: 0xef4444, side: THREE.DoubleSide });
  var whiteMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc, side: THREE.DoubleSide });
  var segAngle = (Math.PI * 2) / gores;

  for (var i = 0; i < gores; i++) {
    var geo = new THREE.SphereGeometry(radius, 4, 8, i * segAngle, segAngle, 0, Math.PI * 0.52);
    var gore = new THREE.Mesh(geo, i % 2 === 0 ? redMat : whiteMat);
    gore.position.y = topY - radius * 0.15;
    gore.scale.set(1, 0.72, 1);
    pg.add(gore);
  }

  var lineMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.8 });
  var linePts = [];
  var rimY = topY - radius * 0.15;
  for (var li = 0; li < gores; li++) {
    var ang = li * segAngle;
    var rx = Math.cos(ang) * radius * 0.96;
    var rz = Math.sin(ang) * radius * 0.96;
    linePts.push(rx, rimY, rz, rx < 0 ? -0.22 * s : 0.22 * s, 0.95 * s, 0);
  }
  var lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
  pg.add(new THREE.LineSegments(lGeo, lineMat));
  return pg;
}

export function buildParagliderRig(ctx) {
  if (ctx.getParagliderGroup()) return;
  var paragliderGroup = createParagliderWingMesh(1.0);
  paragliderGroup.visible = false;
  ctx.scene.add(paragliderGroup);
  ctx.setParagliderGroup(paragliderGroup);
}

const THERMAL_RING_COUNT = 6;
const THERMAL_RING_GAP = 14;
let thermalDummy;

export function buildThermalColumns(ctx) {
  if (ctx.thermalColumns.length) return;
  const spots = [
    { x: 0, z: -135 },
    { x: -70, z: -125 },
    { x: 70, z: -125 },
    { x: 0, z: -72 },
    { x: -105, z: 12 },
    { x: 105, z: 12 }
  ];
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9, transparent: true, opacity: 0.24, side: THREE.DoubleSide,
    forceSinglePass: true, depthWrite: false
  });
  const ringGeo = new THREE.RingGeometry(0.945, 1, 24).rotateX(-Math.PI / 2);
  thermalDummy ||= new THREE.Object3D();
  for (const { x, z } of spots) {
    const baseY = terrainHeight(x, z);
    const rings = new THREE.InstancedMesh(ringGeo, ringMat, THERMAL_RING_COUNT);
    rings.name = 'ParagliderThermal';
    rings.position.set(x, baseY, z);
    rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    rings.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 44, 0), 44);
    rings.visible = false;
    rings.userData.ignoreRay = true;
    ctx.scene.add(rings);
    ctx.thermalColumns.push({ x, z, maxH: 118, radius: 13, rings });
  }
}

export function stepThermalGuides(ctx) {
  const show = ctx.inFps && ctx.paragliderActive && !ctx.lobbyTourActive;
  const elapsed = show ? ctx.clock.elapsedTime : 0;
  for (const { rings } of ctx.thermalColumns) {
    rings.visible = !!show;
    if (!show) continue;
    for (let i = 0; i < THERMAL_RING_COUNT; i++) {
      const y = (elapsed * 7.5 + i * THERMAL_RING_GAP) % (THERMAL_RING_COUNT * THERMAL_RING_GAP);
      thermalDummy.position.y = 2 + y;
      thermalDummy.scale.setScalar(4.5 + i * 0.9);
      thermalDummy.updateMatrix();
      rings.setMatrixAt(i, thermalDummy.matrix);
    }
    rings.instanceMatrix.needsUpdate = true;
  }
}
