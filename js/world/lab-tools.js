import { makeBox } from '../engine/textures.js';
import { createBanner } from './nature-plaza.js';
import { buildCampusBuildingWing } from './buildings.js';
import { buildGreenhouseBench } from './greenhouse.js';
import { buildLaminarHoodAndBenches, createPressureCookerPair, makeElectricBurner } from './lab-sterilization.js';

export function registerPickable(ctx, id, label, mesh, x, y, z, ry, radius, height) {
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry || 0;
  if (ctx.isTouchDevice && ctx.isTouchDevice() && !mesh.userData.twoHanded) {
    mesh.traverse(function (ch) { if (ch.isMesh) ch.castShadow = false; });
  }
  ctx.scene.add(mesh);
  var entry = {
    id: id, label: label, mesh: mesh,
    homePos: new THREE.Vector3(x, y, z), homeRy: ry || 0,
    radius: radius || 0.25, height: height || 0.4, isMoved: false, movedAt: 0
  };
  mesh.userData.pickableId = id;
  mesh.userData.pickableLabel = label;
  ctx.pickableItems.push(entry);
  return entry;
}

export function updateContainerVolume(item, newVol) {
  if (!item || !item.mesh || !item.mesh.userData.liquidCtrl) return;
  var ctrl = item.mesh.userData.liquidCtrl;
  var clamped = Math.max(0, Math.min(ctrl.maxMl, Math.round(newVol)));
  ctrl.volMl = clamped;
  var frac = clamped / ctrl.maxMl;
  if (clamped <= 0) {
    ctrl.liqMesh.visible = false;
    if (ctrl.mycCloud) ctrl.mycCloud.visible = false;
  } else {
    ctrl.liqMesh.visible = true;
    ctrl.liqMesh.scale.y = Math.max(0.02, frac);
    ctrl.liqMesh.position.y = ctrl.baseY + (ctrl.maxH * frac) * 0.5;
    if (ctrl.mycCloud) {
      ctrl.mycCloud.visible = true;
      ctrl.mycCloud.position.y = ctrl.baseY + Math.min(ctrl.maxH * frac * 0.45, 0.048);
    }
  }
  item.label = ctrl.baseLabel + ' (' + clamped + 'ml/' + ctrl.maxMl + 'ml)';
}

export function updateSyringeVolume(item, newVol) {
  if (!item || !item.mesh || !item.mesh.userData.syrCtrl) return;
  var sc = item.mesh.userData.syrCtrl;
  var clamped = Math.max(0, Math.min(10, Number(newVol) || 0));
  sc.volMl = clamped;
  var frac = clamped / 10;
  if (clamped <= 0.05) {
    sc.liqMesh.visible = false;
  } else {
    sc.liqMesh.visible = true;
    sc.liqMesh.scale.y = Math.max(0.02, frac);
    sc.liqMesh.position.y = 0.085 + (0.09 * frac) * 0.5;
  }
  sc.plunger.position.y = 0.095 + 0.09 * frac;
  var dispVal = Math.round(clamped * 10) / 10;
  item.label = clamped > 0.1 ? 'Seringa 10ml (' + (dispVal % 1 === 0 ? dispVal.toFixed(0) : dispVal.toFixed(1)) + 'ml CL)' : 'Seringa 10ml (Vazia)';
}

function updateItemBounds(item) {
  if (!item || !item.mesh) return;
  var px = item.mesh.position.x, py = item.mesh.position.y, pz = item.mesh.position.z;
  var surf = item.mesh.userData.dynamicSurface;
  var col = item.mesh.userData.dynamicCollider;
  var dims = item.mesh.userData.tableDims;
  if (dims) {
    var cRot = Math.abs(Math.cos(item.mesh.rotation.y));
    var sRot = Math.abs(Math.sin(item.mesh.rotation.y));
    var hw = (dims.w * cRot + dims.d * sRot) / 2;
    var hd = (dims.w * sRot + dims.d * cRot) / 2;
    if (surf) {
      surf.minX = px - hw + 0.02; surf.maxX = px + hw - 0.02;
      surf.minZ = pz - hd + 0.02; surf.maxZ = pz + hd - 0.02;
      surf.topY = py + dims.h + (dims.surfOffset || 0);
    }
    if (col) {
      col.minX = px - hw - 0.05; col.maxX = px + hw + 0.05;
      col.minZ = pz - hd - 0.05; col.maxZ = pz + hd + 0.05;
      col.minY = py; col.maxY = py + dims.h; col.surfaceTopY = py + dims.h;
    }
  }
}

function isSurfaceOccupied(ctx, surf, ignoreItem) {
  if (!surf) return false;
  var heldItem = ctx.getHeldItem ? ctx.getHeldItem() : null;
  for (var i = 0; i < ctx.pickableItems.length; i++) {
    var o = ctx.pickableItems[i];
    if (o === ignoreItem || o === heldItem || (ctx.isHeldByRemote && ctx.isHeldByRemote(o.id))) continue;
    var p = o.mesh.position;
    if (p.x >= surf.minX - 0.08 && p.x <= surf.maxX + 0.08 &&
      p.z >= surf.minZ - 0.08 && p.z <= surf.maxZ + 0.08 &&
      p.y >= surf.topY - 0.12 && p.y <= surf.topY + 0.55) {
      return true;
    }
  }
  return false;
}

export function buildCampusWingsAndEquipment(ctx) {
  var scene = ctx.scene;
  var solidColliders = ctx.solidColliders;
  var supportSurfaces = ctx.supportSurfaces;
  var supportMeshes = ctx.supportMeshes;

  var helpers = {
    registerPickable: function (id, label, mesh, x, y, z, ry, radius, height) {
      return registerPickable(ctx, id, label, mesh, x, y, z, ry, radius, height);
    },
    updateItemBounds: updateItemBounds,
    isSurfaceOccupied: function (surf, ignoreItem) {
      return isSurfaceOccupied(ctx, surf, ignoreItem);
    },
    addMovableStainlessTable: addMovableStainlessTable
  };

  function addMovableStainlessTable(id, label, tx, floorY, tz, tw, th, td) {
    var inoxMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.22 });
    var legMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9, roughness: 0.15 });
    var footMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    var tg = new THREE.Group();
    var top = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.055, td), inoxMat);
    top.position.y = th - 0.0275; top.castShadow = true; top.receiveShadow = true;
    var shelf = new THREE.Mesh(new THREE.BoxGeometry(tw - 0.08, 0.035, td - 0.08), inoxMat);
    shelf.position.y = th * 0.28; shelf.receiveShadow = true;
    tg.add(top, shelf);
    var lx = tw / 2 - 0.07, lz = td / 2 - 0.07;
    [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(function (lp) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, th - 0.04, 10), legMat);
      leg.position.set(lp[0], (th - 0.04) / 2 + 0.02, lp[1]);
      var foot = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10), footMat);
      foot.position.set(lp[0], 0.015, lp[1]);
      tg.add(leg, foot);
    });
    var surf = { minX: tx - tw / 2 + 0.02, maxX: tx + tw / 2 - 0.02, minZ: tz - td / 2 + 0.02, maxZ: tz + td / 2 - 0.02, topY: floorY + th };
    var col = { minX: tx - tw / 2 - 0.05, maxX: tx + tw / 2 + 0.05, minZ: tz - td / 2 - 0.05, maxZ: tz + td / 2 + 0.05, minY: floorY, maxY: floorY + th, surfaceTopY: floorY + th };
    supportSurfaces.push(surf);
    top.userData.supportSurface = surf;
    supportMeshes.push(top);
    solidColliders.push(col);
    tg.userData.twoHanded = true;
    tg.userData.isTable = true;
    tg.userData.tableDims = { w: tw, h: th, d: td, surfOffset: 0 };
    tg.userData.dynamicSurface = surf;
    tg.userData.dynamicCollider = col;
    tg.userData.updateBounds = updateItemBounds;
    tg.userData.isBlockedPickup = function (item) { return isSurfaceOccupied(ctx, surf, item); };
    helpers.registerPickable(id, label, tg, tx, floorY, tz, 0, Math.max(tw, td) * 0.5, th);
  }

  // ALA OESTE (Esquerda) — 2 blocos de 2 andares (x: -24..-14)
  buildCampusBuildingWing(ctx, { cx: -19, cz: -7, width: 10, depth: 11.6, faceDir: 1, doorLabel: 'Porta do Laboratório', doorSign: '🔬 LAB', style: 'brick', connectNorth2F: true, connectSouth2F: true, boardIndex: 0 });
  buildCampusBuildingWing(ctx, { cx: -19, cz: 8, width: 10, depth: 11.6, faceDir: 1, doorLabel: 'Porta do Depósito', doorSign: '📦 DEPÓSITO', style: 'brick', connectNorth2F: true, boardIndex: 1 });

  createBanner(scene, -13.85, 5.1, -11.6, Math.PI / 2, '#6d28d9', '🔬');
  createBanner(scene, -13.85, 5.1, -2.4, Math.PI / 2, '#1d4ed8', '🧬');
  createBanner(scene, -13.85, 5.1, 12.6, Math.PI / 2, '#d97706', '📦');

  buildLaminarHoodAndBenches(ctx, helpers);

  addMovableStainlessTable('table_cooker_lab', 'Mesa Inox (Autoclave/Spawn)', -18.5, 0.12, -5.0, 1.5, 0.85, 2.4);
  makeElectricBurner(ctx, helpers, 'burner_lab', -18.5, 0.97, -4.6);
  createPressureCookerPair(ctx, helpers, 'pressure_cooker_lab', 'pressure_lid_lab', 'Lab', -18.5, 1.058, -4.6);

  addMovableStainlessTable('table_lc_lab', 'Mesa Inox (Cultura Líquida)', -20.5, 0.12, -10.6, 2.0, 0.79, 1.0);

  function makePetriDish(mode) {
    var pg = new THREE.Group();
    var glassMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.34, roughness: 0.08, metalness: 0.15 });
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.048, 22, 1, true), glassMat);
    rim.position.y = 0.024;
    var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.012, 22), glassMat);
    lid.position.y = 0.048;

    var c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    var pctx = c.getContext('2d');
    pctx.fillStyle = mode === 'contam' ? '#d9b36c' : '#efe7d2';
    pctx.fillRect(0, 0, 256, 256);
    if (mode === 'clean') {
      pctx.strokeStyle = 'rgba(255,255,255,0.88)';
      pctx.lineWidth = 1.6;
      for (var a = 0; a < 110; a++) {
        var ang = (a / 110) * Math.PI * 2;
        var rEnd = 88 + Math.sin(a * 7) * 14;
        pctx.beginPath();
        pctx.moveTo(128, 128);
        pctx.quadraticCurveTo(128 + Math.cos(ang + 0.12) * rEnd * 0.55, 128 + Math.sin(ang + 0.12) * rEnd * 0.55, 128 + Math.cos(ang) * rEnd, 128 + Math.sin(ang) * rEnd);
        pctx.stroke();
      }
      pctx.fillStyle = '#f8fafc';
      pctx.beginPath(); pctx.moveTo(120, 120); pctx.lineTo(138, 122); pctx.lineTo(128, 138); pctx.closePath(); pctx.fill();
    } else if (mode === 'contam') {
      pctx.fillStyle = '#4a3f28';
      pctx.beginPath(); pctx.arc(88, 132, 62, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#1c1917';
      pctx.beginPath(); pctx.arc(86, 134, 24, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#e7dcc8';
      pctx.beginPath(); pctx.arc(174, 118, 44, 0, Math.PI * 2); pctx.fill();
    }
    if (mode !== 'bare') {
      var agarTex = new THREE.CanvasTexture(c);
      var agar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.156, 0.156, 0.022, 22),
        new THREE.MeshStandardMaterial({ map: agarTex, roughness: 0.35 })
      );
      agar.position.y = 0.015;
      pg.add(agar);
    }
    pg.add(rim, lid);
    pg.userData.isPetri = true;
    return pg;
  }

  helpers.registerPickable('petri_clean', 'Placa de Petri (Micélio Rizomórfico)', makePetriDish('clean'), -18.3, 1.065, -8.6, 0, 0.20, 0.08);
  helpers.registerPickable('petri_contam', 'Placa Contaminada (Mofo/Bactéria)', makePetriDish('contam'), -18.3, 1.065, -7.8, 0, 0.20, 0.08);
  helpers.registerPickable('petri_empty', 'Placa de Petri Estéril (PDA)', makePetriDish('empty'), -19.2, 1.34, -1.85, 0, 0.20, 0.08);

  // Frasco PDA / BDA 500g
  var pdaGroup = new THREE.Group();
  var hdpeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.05 });
  var pdaBody = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.21, 28), hdpeMat);
  pdaBody.position.y = 0.105;
  pdaBody.castShadow = true;
  var pdaShoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.102, 0.038, 28), hdpeMat);
  pdaShoulder.position.y = 0.228;
  var pdaNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.070, 0.024, 24), hdpeMat);
  pdaNeck.position.y = 0.255;

  var pdaC = document.createElement('canvas');
  pdaC.width = 512; pdaC.height = 256;
  var pdaCtx = pdaC.getContext('2d');
  pdaCtx.fillStyle = '#ffffff';
  pdaCtx.fillRect(0, 0, 512, 256);
  [0, 256].forEach(function (ox) {
    pdaCtx.fillStyle = '#f8fafc';
    pdaCtx.fillRect(ox + 10, 8, 236, 240);
    pdaCtx.strokeStyle = '#cbd5e1';
    pdaCtx.lineWidth = 3;
    pdaCtx.strokeRect(ox + 10, 8, 236, 240);
    pdaCtx.fillStyle = '#0284c7';
    pdaCtx.fillRect(ox + 12, 10, 232, 38);
    pdaCtx.fillStyle = '#ffffff';
    pdaCtx.font = 'bold 17px system-ui, sans-serif';
    pdaCtx.textAlign = 'center';
    pdaCtx.fillText('🧪 MYCOLAB • REAGENTE', ox + 128, 35);
    pdaCtx.fillStyle = '#0f172a';
    pdaCtx.font = '900 32px system-ui, sans-serif';
    pdaCtx.fillText('BDA / PDA', ox + 128, 86);
    pdaCtx.fillStyle = '#0369a1';
    pdaCtx.font = 'bold 20px system-ui, sans-serif';
    pdaCtx.fillText('POTATO DEXTROSE', ox + 128, 118);
    pdaCtx.fillText('AGAR • MEIO SÓLIDO', ox + 128, 144);
    pdaCtx.fillStyle = '#059669';
    pdaCtx.fillRect(ox + 28, 162, 200, 32);
    pdaCtx.fillStyle = '#ffffff';
    pdaCtx.font = 'bold 17px system-ui, sans-serif';
    pdaCtx.fillText('CULTIVO DE COGUMELOS', ox + 128, 184);
    pdaCtx.fillStyle = '#334155';
    pdaCtx.font = 'bold 21px system-ui, sans-serif';
    pdaCtx.fillText('PESO LÍQ. 500g  •  pH 5.6', ox + 128, 222);
    pdaCtx.fillStyle = '#ea580c';
    pdaCtx.fillRect(ox + 12, 236, 232, 10);
  });
  var pdaLabelTex = new THREE.CanvasTexture(pdaC);
  pdaLabelTex.anisotropy = 4;
  var pdaLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1035, 0.1035, 0.175, 32, 1, true),
    new THREE.MeshStandardMaterial({ map: pdaLabelTex, roughness: 0.32 })
  );
  pdaLabel.position.y = 0.105;

  var capMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.32 });
  var pdaCap = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.080, 0.056, 24), capMat);
  pdaCap.position.y = 0.285;
  var pdaSealRing = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.010, 24), new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.4 }));
  pdaSealRing.position.y = 0.254;
  pdaGroup.add(pdaBody, pdaShoulder, pdaNeck, pdaLabel, pdaCap, pdaSealRing);
  helpers.registerPickable('pda_bottle', 'Frasco PDA 500g (Ágar Batata Dextrose)', pdaGroup, -19.6, 1.02, -12.0, 0, 0.15, 0.34);

  function updateSpawnVisual(item) {
    if (!item || !item.spawnCtrl) return;
    var sc = item.spawnCtrl;
    if (sc.mycOverlay) {
      sc.mycOverlay.visible = sc.burned || sc.colonization > 0;
      var f = sc.burned ? 1 : Math.min(1, sc.colonization / 100);
      sc.mycOverlay.material.opacity = sc.burned ? 0.85 : (sc.contaminated ? 0.72 : (0.15 + f * 0.78));
      sc.mycOverlay.material.color.setHex(sc.burned ? 0x1c1917 : (sc.contaminated ? 0x15803d : 0xf8fafc));
      sc.mycOverlay.scale.set(1, Math.max(0.15, f), 1);
    }
    if (sc.burned) {
      item.label = sc.baseLabel + ' (Queimado 🔥 Jogue fora)';
    } else if (sc.contaminated) {
      item.label = sc.baseLabel + ' (Contaminado ⚠️)';
    } else if (sc.colonization >= 100) {
      item.label = sc.baseLabel + ' (100% Colonizado ✅)';
    } else if (sc.inoculated) {
      item.label = sc.baseLabel + ' (Colonizando ' + Math.floor(sc.colonization) + '%)';
    } else if (sc.sterilized) {
      item.label = sc.baseLabel + ' (Estéril • Pronto)';
    } else {
      item.label = sc.baseLabel + ' (Não Esterilizado)';
    }
  }

  function makeSpawnJar800(id, filled, px, py, pz) {
    var jg = new THREE.Group();
    var glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.24, 16),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.1, depthWrite: false })
    );
    glass.position.y = 0.12;
    var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.035, 16), new THREE.MeshStandardMaterial({ color: filled ? 0xdc2626 : 0xf8fafc, roughness: 0.4 }));
    lid.position.y = 0.255;
    jg.add(glass, lid);
    var jc = document.createElement('canvas'); jc.width = 128; jc.height = 128;
    var jctx = jc.getContext('2d');
    jctx.fillStyle = filled ? '#eab308' : '#d97706'; jctx.fillRect(0, 0, 128, 128);
    for (var k = 0; k < 140; k++) {
      jctx.fillStyle = k % 3 === 0 ? '#ca8a04' : '#fde047';
      jctx.beginPath(); jctx.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 3, 0, Math.PI * 2); jctx.fill();
    }
    var corn = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.096, 0.195, 16), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(jc), roughness: 0.75 }));
    corn.position.y = 0.108;
    var mycOverlay = new THREE.Mesh(
      new THREE.CylinderGeometry(0.099, 0.099, 0.198, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.0, roughness: 0.85 })
    );
    mycOverlay.position.y = 0.108;
    if (filled) jg.add(corn, mycOverlay);
    var item = helpers.registerPickable(id, 'Vidro 800ml', jg, px, py, pz, 0, 0.16, 0.28);
    item.spawnCtrl = {
      baseLabel: filled ? 'Vidro 800ml (Milho)' : 'Vidro 800ml Vazio',
      sterilized: filled, inoculated: filled, colonized: filled,
      colonization: filled ? 100 : 0, contaminated: false,
      mycOverlay: filled ? mycOverlay : null,
      updateVisual: function () { updateSpawnVisual(item); }
    };
    item.mesh.userData.spawnCtrl = item.spawnCtrl;
    updateSpawnVisual(item);
    ctx.spawnGrowItems.push(item);
    return item;
  }
  makeSpawnJar800('spawn_jar', true, -23.1, 1.02, -4.5);
  makeSpawnJar800('spawn_jar_empty', false, -23.1, 1.02, -3.7);

  function makeSpawnBag1500(id, filled, px, py, pz) {
    var bg = new THREE.Group();
    var filmMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: filled ? 0.34 : 0.28, roughness: 0.2, depthWrite: false });
    var outer = makeBox(0.24, 0.36, 0.18, filmMat, { noShadow: true });
    outer.position.y = 0.18;
    var filterPatch = makeBox(0.09, 0.09, 0.012, 0xffffff, { noShadow: true });
    filterPatch.position.set(0, 0.30, 0.092);
    var injPort = makeBox(0.036, 0.036, 0.016, 0x64748b, { noShadow: true });
    injPort.position.set(0, 0.11, 0.094);
    bg.add(outer, filterPatch, injPort);
    var bc = document.createElement('canvas'); bc.width = 128; bc.height = 128;
    var bctx = bc.getContext('2d');
    bctx.fillStyle = '#eab308'; bctx.fillRect(0, 0, 128, 128);
    for (var g = 0; g < 180; g++) {
      bctx.fillStyle = g % 4 === 0 ? '#78350f' : '#fde047';
      bctx.fillRect(Math.random() * 124, Math.random() * 124, 3, 4);
    }
    var block = makeBox(0.215, 0.215, 0.155, new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(bc), roughness: 0.85 }));
    block.position.y = 0.115;
    var mycOverlay = makeBox(0.222, 0.22, 0.162, new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.0, roughness: 0.85 }));
    mycOverlay.position.y = 0.115;
    if (filled) bg.add(block, mycOverlay);
    var item = helpers.registerPickable(id, 'Bag 1,5kg', bg, px, py, pz, 0, 0.22, 0.38);
    item.spawnCtrl = {
      baseLabel: filled ? 'Bag 1,5kg Spawn' : 'Bag 1,5kg Vazio',
      sterilized: filled, inoculated: filled, colonized: filled,
      colonization: filled ? 100 : 0, contaminated: false,
      mycOverlay: filled ? mycOverlay : null,
      updateVisual: function () { updateSpawnVisual(item); }
    };
    item.mesh.userData.spawnCtrl = item.spawnCtrl;
    updateSpawnVisual(item);
    ctx.spawnGrowItems.push(item);
    return item;
  }
  makeSpawnBag1500('spawn_bag_colonized', true, -23.1, 1.02, -8.5);
  makeSpawnBag1500('spawn_bag_empty', false, -23.1, 1.02, -7.8);

  // Balanca Digital de Precisao
  (function () {
    var sg = new THREE.Group();
    var body = makeBox(0.32, 0.065, 0.38, 0x1e293b, { roughness: 0.45 });
    body.position.y = 0.0325;
    var pan = makeBox(0.28, 0.016, 0.26, 0xe2e8f0, { metalness: 0.82, roughness: 0.22 });
    pan.position.set(0, 0.073, -0.04);
    var lcdC = document.createElement('canvas'); lcdC.width = 256; lcdC.height = 96;
    var lcdCtx = lcdC.getContext('2d');
    var lcdTex = new THREE.CanvasTexture(lcdC);
    var lcdScreen = makeBox(0.18, 0.045, 0.01, new THREE.MeshBasicMaterial({ map: lcdTex }), { noShadow: true });
    lcdScreen.position.set(-0.04, 0.045, 0.192);
    lcdScreen.rotation.x = -0.35;
    var tareBtn = makeBox(0.065, 0.028, 0.016, 0x22c55e, { noShadow: true });
    tareBtn.position.set(0.095, 0.042, 0.194);
    tareBtn.rotation.x = -0.35;
    sg.add(body, pan, lcdScreen, tareBtn);

    var sx = -23.1, sy = 1.02, sz = -9.6;
    var scSurf = { minX: sx - 0.15, maxX: sx + 0.15, minZ: sz - 0.18, maxZ: sz + 0.10, topY: sy + 0.082 };
    supportSurfaces.push(scSurf);
    pan.userData.supportSurface = scSurf;
    supportMeshes.push(pan);
    sg.userData.isScale = true;
    sg.userData.tableDims = { w: 0.32, h: 0.082, d: 0.38, surfOffset: 0 };
    sg.userData.dynamicSurface = scSurf;
    sg.userData.updateBounds = updateItemBounds;
    sg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(ctx, scSurf, it); };

    var scaleObj = {
      tare: 0, lastText: '', lastGross: 0, surface: scSurf,
      lcdCtx: lcdCtx, lcdTex: lcdTex,
      draw: function (grams) {
        var txt = (grams).toFixed(1) + ' g';
        if (txt === this.lastText) return;
        this.lastText = txt;
        lcdCtx.fillStyle = '#064e3b'; lcdCtx.fillRect(0, 0, 256, 96);
        lcdCtx.fillStyle = '#34d399'; lcdCtx.font = 'bold 46px monospace';
        lcdCtx.textAlign = 'right'; lcdCtx.textBaseline = 'middle';
        lcdCtx.fillText(txt, 240, 50);
        lcdTex.needsUpdate = true;
      }
    };
    scaleObj.draw(0);
    tareBtn.userData.scaleObj = scaleObj;
    ctx.scaleTareMeshes.push(tareBtn);
    ctx.scaleDevices.push(scaleObj);
    helpers.registerPickable('precision_scale', 'Balança de Precisão Digital', sg, sx, sy, sz, Math.PI / 2, 0.24, 0.12);
  })();

  function makeAlcoholSprayBottle(id, px, py, pz) {
    var ag = new THREE.Group();
    var bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.062, 0.18, 16),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, roughness: 0.25 })
    );
    bottle.position.y = 0.09;
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.036, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }));
    neck.position.y = 0.205;
    var nozzle = makeBox(0.028, 0.028, 0.08, 0xf8fafc, { noShadow: true });
    nozzle.position.set(0, 0.235, 0.025);
    var trig = makeBox(0.012, 0.045, 0.018, 0x0284c7, { noShadow: true });
    trig.position.set(0, 0.212, 0.042);
    ag.add(bottle, neck, nozzle, trig);
    ag.userData.isAlcoholSpray = true;
    return helpers.registerPickable(id, 'Borrifador Álcool 70%', ag, px, py, pz, Math.PI / 2, 0.12, 0.26);
  }
  makeAlcoholSprayBottle('alcohol_spray', -23.1, 1.02, -7.1);

  var sealerGroup = new THREE.Group();
  var sealerBase = makeBox(0.46, 0.08, 0.18, 0x1d4ed8, { roughness: 0.4, metalness: 0.35 });
  sealerBase.position.y = 0.04;
  var sealerArm = makeBox(0.44, 0.04, 0.05, 0x94a3b8, { metalness: 0.7, roughness: 0.25 });
  sealerArm.position.set(0, 0.11, -0.02);
  sealerArm.rotation.x = 0.18;
  var sealerLed = makeBox(0.02, 0.02, 0.02, 0xef4444, { noShadow: true });
  sealerLed.position.set(0.18, 0.085, 0.06);
  sealerGroup.add(sealerBase, sealerArm, sealerLed);
  helpers.registerPickable('heat_sealer', 'Seladora Térmica de Bags', sealerGroup, -23.1, 1.02, -6.2, Math.PI / 2, 0.28, 0.16);

  function makeScaleTex(maxVal, stepVal, brandTitle) {
    var sc = document.createElement('canvas');
    sc.width = 256; sc.height = 256;
    var sx = sc.getContext('2d');
    sx.clearRect(0, 0, 256, 256);
    sx.strokeStyle = 'rgba(248, 250, 252, 0.88)';
    sx.fillStyle = 'rgba(248, 250, 252, 0.92)';
    sx.lineWidth = 2;
    sx.font = 'bold 20px sans-serif';
    sx.fillText(brandTitle, 18, 46);
    sx.font = 'bold 16px monospace';
    sx.fillText('Boro 3.3', 24, 72);
    sx.beginPath(); sx.moveTo(138, 36); sx.lineTo(138, 232); sx.stroke();
    for (var v = stepVal; v <= maxVal; v += stepVal) {
      var frac = v / maxVal;
      var yy = 232 - frac * 186;
      sx.beginPath(); sx.moveTo(138, yy); sx.lineTo(174, yy); sx.stroke();
      sx.fillText(String(v), 180, yy + 5);
    }
    return new THREE.CanvasTexture(sc);
  }

  function makeLiquidJar800(id, px, py, pz, initMl) {
    var jg = new THREE.Group();
    var glassMat = new THREE.MeshStandardMaterial({ color: 0xf0f9ff, transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0.12, depthWrite: false });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.21, 22, 1, true), glassMat);
    body.position.y = 0.11;
    var bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.01, 22), glassMat);
    bottom.position.y = 0.005;
    var shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.088, 0.035, 22), glassMat);
    shoulder.position.y = 0.232;
    var scaleCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.089, 0.089, 0.19, 20, 1, true),
      new THREE.MeshBasicMaterial({ map: makeScaleTex(800, 200, '800ml'), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })
    );
    scaleCyl.position.y = 0.11;
    var liqMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xca8a04, emissiveIntensity: 0.14, transparent: true, opacity: 0.58, roughness: 0.15 });
    var liqMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.19, 20), liqMat);
    var mycCloud = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf8fafc, emissiveIntensity: 0.25, transparent: true, opacity: 0.72, roughness: 0.85 })
    );
    mycCloud.scale.set(1.25, 0.55, 1.15);
    var stirBar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.052, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
    stirBar.rotation.z = Math.PI / 2;
    stirBar.position.set(0, 0.018, 0);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.074, 0.034, 20), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }));
    cap.position.y = 0.266;
    var injPort = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 12), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }));
    injPort.position.set(0.036, 0.290, 0);
    var filterPort = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.022, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.9 }));
    filterPort.position.set(-0.036, 0.292, 0);

    jg.add(liqMesh, mycCloud, stirBar, body, bottom, shoulder, scaleCyl, cap, injPort, filterPort);
    jg.userData.liquidCtrl = {
      volMl: initMl, maxMl: 800, baseY: 0.012, maxH: 0.19,
      liqMesh: liqMesh, mycCloud: mycCloud, stirBar: stirBar,
      baseLabel: 'Cultura Líquida 800ml'
    };
    var item = helpers.registerPickable(id, 'Cultura Líquida 800ml', jg, px, py, pz, 0, 0.14, 0.30);
    item.setVolume = function (v) { updateContainerVolume(item, v); };
    updateContainerVolume(item, initMl);
    return item;
  }

  function makeBeaker1L(id, px, py, pz, initMl) {
    var bg = new THREE.Group();
    var glassMat = new THREE.MeshStandardMaterial({ color: 0xf0f9ff, transparent: true, opacity: 0.26, roughness: 0.08, metalness: 0.12, depthWrite: false });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.23, 22, 1, true), glassMat);
    body.position.y = 0.12;
    var bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.01, 22), glassMat);
    bottom.position.y = 0.005;
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.097, 0.006, 8, 22), glassMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.235;
    var scaleCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.096, 0.096, 0.21, 20, 1, true),
      new THREE.MeshBasicMaterial({ map: makeScaleTex(1000, 200, '1000ml'), transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide })
    );
    scaleCyl.position.y = 0.12;
    var liqMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x0284c7, emissiveIntensity: 0.10, transparent: true, opacity: 0.52, roughness: 0.15 });
    var liqMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.089, 0.089, 0.20, 20), liqMat);
    var stirBar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.052, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
    stirBar.rotation.z = Math.PI / 2;
    stirBar.position.set(0, 0.018, 0);
    bg.add(liqMesh, stirBar, body, bottom, rim, scaleCyl);
    bg.userData.liquidCtrl = {
      volMl: initMl, maxMl: 1000, baseY: 0.012, maxH: 0.20,
      liqMesh: liqMesh, mycCloud: null, stirBar: stirBar,
      baseLabel: 'Béquer 1L'
    };
    var item = helpers.registerPickable(id, 'Béquer 1L', bg, px, py, pz, 0, 0.14, 0.24);
    item.setVolume = function (v) { updateContainerVolume(item, v); };
    updateContainerVolume(item, initMl);
    return item;
  }

  function makeMagneticStirrer(id, px, py, pz) {
    var sg = new THREE.Group();
    var baseMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.12 });
    var plateMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.18 });
    var body = makeBox(0.30, 0.078, 0.28, baseMat, { roughness: 0.35 });
    body.position.set(0, 0.039, -0.04);
    var plate = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.118, 0.018, 24), plateMat);
    plate.position.set(0, 0.088, -0.04);
    var plateRim = new THREE.Mesh(new THREE.TorusGeometry(0.116, 0.006, 8, 24), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 }));
    plateRim.rotation.x = Math.PI / 2; plateRim.position.set(0, 0.082, -0.04);

    var pCan = document.createElement('canvas'); pCan.width = 256; pCan.height = 96;
    var pCtx = pCan.getContext('2d');
    pCtx.fillStyle = '#1d4ed8'; pCtx.fillRect(0, 0, 256, 96);
    pCtx.fillStyle = '#ffffff'; pCtx.font = 'bold 18px system-ui, sans-serif';
    pCtx.textAlign = 'center'; pCtx.fillText('IKA • MYCO-MAG SH-2', 128, 22);
    pCtx.font = 'bold 12px system-ui, sans-serif';
    pCtx.fillStyle = '#bfdbfe';
    pCtx.fillText('STIRRING', 56, 84);
    pCtx.fillText('POWER', 128, 84);
    pCtx.fillText('HEATING', 200, 84);
    var panelMat = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(pCan), roughness: 0.3 });
    var frontPanel = makeBox(0.28, 0.068, 0.075, panelMat, { noShadow: true });
    frontPanel.position.set(0, 0.036, 0.12);
    frontPanel.rotation.x = 0.42;

    function makeRotaryKnob(kx) {
      var kg = new THREE.Group();
      var kBase = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.016, 16), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
      var kCap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.006, 16), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 }));
      kCap.position.y = 0.010;
      kg.add(kBase, kCap);
      kg.rotation.x = Math.PI / 2 - 1.15;
      kg.position.set(kx, 0.056, 0.135);
      return kg;
    }
    var knob1 = makeRotaryKnob(-0.075);
    var knob2 = makeRotaryKnob(0.075);
    var ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    var ledBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
    ledBezel.rotation.x = Math.PI / 2 - 1.15;
    ledBezel.position.set(0, 0.052, 0.139);
    var powerLed = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 10), ledMat);
    powerLed.position.set(0, 0.056, 0.145);
    sg.add(body, plate, plateRim, frontPanel, knob1, knob2, ledBezel, powerLed);

    var stirSurf = { minX: px - 0.13, maxX: px + 0.13, minZ: pz - 0.16, maxZ: pz + 0.08, topY: py + 0.098 };
    supportSurfaces.push(stirSurf);
    plate.userData.supportSurface = stirSurf;
    supportMeshes.push(plate);
    sg.userData.isStirrer = true;
    sg.userData.tableDims = { w: 0.30, h: 0.098, d: 0.34, surfOffset: 0 };
    sg.userData.dynamicSurface = stirSurf;
    sg.userData.updateBounds = updateItemBounds;
    sg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(ctx, stirSurf, it); };

    var stirState = { on: false, ledMat: ledMat, surface: stirSurf };
    frontPanel.userData.stirSwitch = stirState;
    knob1.children.forEach(function (c) { c.userData.stirSwitch = stirState; ctx.stirSwitchMeshes.push(c); });
    knob2.children.forEach(function (c) { c.userData.stirSwitch = stirState; ctx.stirSwitchMeshes.push(c); });
    ctx.stirSwitchMeshes.push(frontPanel);
    ctx.stirrerDevices.push(stirState);
    return helpers.registerPickable(id, 'Agitador Magnético (MYCO-MAG)', sg, px, py, pz, 0, 0.24, 0.14);
  }

  function makeSyringe10ml(id, px, py, pz) {
    var sg = new THREE.Group();
    var barrelMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.36, roughness: 0.12, depthWrite: false });
    var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 14, 1, true), barrelMat);
    barrel.position.y = 0.135;
    var flange = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.005, 14), barrelMat);
    flange.position.y = 0.195;
    var liqMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.09, 12),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, transparent: true, opacity: 0.78 })
    );
    liqMesh.visible = false;
    var plunger = new THREE.Group();
    var stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.014, 12), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    stopper.position.y = 0;
    var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.11, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
    rod.position.y = 0.06;
    var thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.005, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
    thumb.position.y = 0.115;
    plunger.add(stopper, rod, thumb);
    plunger.position.y = 0.095;
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.018, 10), new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.35 }));
    hub.position.y = 0.068;
    var needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.001, 0.058, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 }));
    needle.position.y = 0.030;
    var layWrap = new THREE.Group();
    layWrap.add(liqMesh, plunger, barrel, flange, hub, needle);
    layWrap.rotation.z = Math.PI / 2;
    layWrap.position.set(0.12, 0.022, 0);
    sg.add(layWrap);
    sg.userData.isSyringe = true;
    sg.userData.syrCtrl = { volMl: 0, liqMesh: liqMesh, plunger: plunger };
    var item = helpers.registerPickable(id, 'Seringa 10ml (Vazia)', sg, px, py, pz, 0, 0.14, 0.06);
    item.setVolume = function (v) { updateSyringeVolume(item, v); };
    updateSyringeVolume(item, 0);
    return item;
  }

  function makeInfraredThermometer(id, px, py, pz) {
    var thermoTex = ctx.ensureThermoTex ? ctx.ensureThermoTex() : null;
    var tg = new THREE.Group();
    var yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.05 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55, metalness: 0.15 });
    var redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });

    var head = makeBox(0.062, 0.084, 0.145, yellowMat);
    head.position.set(0, 0.155, 0);
    var topCap = makeBox(0.054, 0.012, 0.11, darkMat);
    topCap.position.set(0, 0.202, -0.01);
    var snout = makeBox(0.054, 0.076, 0.024, darkMat);
    snout.position.set(0, 0.155, -0.082);
    var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 14), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.145, -0.096);
    var laserDiode = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.008, 10), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
    laserDiode.rotation.x = Math.PI / 2;
    laserDiode.position.set(0, 0.178, -0.096);

    var backBezel = makeBox(0.058, 0.078, 0.016, darkMat);
    backBezel.position.set(0, 0.155, 0.076);
    var screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.048, 0.046),
      new THREE.MeshBasicMaterial({ map: thermoTex })
    );
    screenMesh.position.set(0, 0.163, 0.0865);

    [-0.015, 0, 0.015].forEach(function (bx) {
      var btn = makeBox(0.009, 0.009, 0.004, yellowMat);
      btn.position.set(bx, 0.128, 0.086);
      tg.add(btn);
    });

    var handle = new THREE.Group();
    handle.position.set(0, 0.085, 0.015);
    handle.rotation.x = -0.16;
    var gripCore = makeBox(0.046, 0.135, 0.052, yellowMat);
    var gripRubberF = makeBox(0.048, 0.125, 0.016, darkMat);
    gripRubberF.position.set(0, 0, -0.022);
    var gripRubberB = makeBox(0.048, 0.125, 0.016, darkMat);
    gripRubberB.position.set(0, 0, 0.022);
    handle.add(gripCore, gripRubberF, gripRubberB);

    var trigger = makeBox(0.014, 0.032, 0.018, redMat);
    trigger.position.set(0, 0.105, -0.022);
    var sticker = makeBox(0.065, 0.026, 0.055, new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    sticker.position.set(0, 0.165, 0);

    tg.add(head, topCap, snout, lens, laserDiode, backBezel, screenMesh, handle, trigger, sticker);
    tg.userData.isThermometer = true;
    return helpers.registerPickable(id, 'Termômetro Laser Infravermelho', tg, px, py, pz, 0, 0.18, 0.22);
  }

  function makeRoundedRectShape(w, d, r) {
    var s = new THREE.Shape();
    var hw = w / 2, hd = d / 2;
    s.moveTo(-hw + r, -hd);
    s.lineTo(hw - r, -hd);
    s.quadraticCurveTo(hw, -hd, hw, -hd + r);
    s.lineTo(hw, hd - r);
    s.quadraticCurveTo(hw, hd, hw - r, hd);
    s.lineTo(-hw + r, hd);
    s.quadraticCurveTo(-hw, hd, -hw, hd - r);
    s.lineTo(-hw, -hd + r);
    s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    return s;
  }

  function makeLabTray(id, label, px, py, pz) {
    var tg = new THREE.Group();
    var steelMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, metalness: 0.90, roughness: 0.14,
      emissive: 0x334155, emissiveIntensity: 0.12
    });
    var innerSteelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, metalness: 0.85, roughness: 0.22,
      emissive: 0x1e293b, emissiveIntensity: 0.08
    });

    var baseShape = makeRoundedRectShape(0.38, 0.26, 0.032);
    var baseGeo = new THREE.ExtrudeGeometry(baseShape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
    baseGeo.rotateX(-Math.PI / 2);
    var floorPlate = new THREE.Mesh(baseGeo, innerSteelMat);
    floorPlate.position.y = 0.002;
    floorPlate.castShadow = true;
    floorPlate.receiveShadow = true;

    var outerWall = makeRoundedRectShape(0.40, 0.28, 0.036);
    var innerHole = makeRoundedRectShape(0.36, 0.24, 0.026);
    outerWall.holes.push(innerHole);
    var wallGeo = new THREE.ExtrudeGeometry(outerWall, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
    wallGeo.rotateX(-Math.PI / 2);
    var wallMesh = new THREE.Mesh(wallGeo, steelMat);
    wallMesh.position.y = 0.006;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    var lipShape = makeRoundedRectShape(0.43, 0.31, 0.040);
    var lipHole = makeRoundedRectShape(0.37, 0.25, 0.028);
    lipShape.holes.push(lipHole);
    var lipGeo = new THREE.ExtrudeGeometry(lipShape, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2 });
    lipGeo.rotateX(-Math.PI / 2);
    var lipMesh = new THREE.Mesh(lipGeo, steelMat);
    lipMesh.position.y = 0.024;
    lipMesh.castShadow = true;

    tg.add(floorPlate, wallMesh, lipMesh);

    var traySurf = { minX: px - 0.175, maxX: px + 0.175, minZ: pz - 0.115, maxZ: pz + 0.115, topY: py + 0.009 };
    supportSurfaces.push(traySurf);
    floorPlate.userData.supportSurface = traySurf;
    supportMeshes.push(floorPlate);

    tg.userData.isTray = true;
    tg.userData.tableDims = { w: 0.36, h: 0.009, d: 0.24, surfOffset: 0 };
    tg.userData.dynamicSurface = traySurf;
    tg.userData.updateBounds = updateItemBounds;
    return helpers.registerPickable(id, label, tg, px, py, pz, 0, 0.22, 0.03);
  }

  makeMagneticStirrer('magnetic_stirrer', -20.95, 0.91, -10.55);
  makeLiquidJar800('liquid_culture', -20.95, 1.015, -10.59, 350);
  makeBeaker1L('beaker_1l_a', -20.42, 0.91, -10.55, 0);
  makeBeaker1L('beaker_1l_b', -20.08, 0.91, -10.55, 500);
  makeLabTray('lab_tray_01', 'Bandeja Inox Cirúrgica', -19.70, 0.91, -10.57);
  makeLabTray('lab_tray_02', 'Bandeja Inox (Fluxo)', -18.30, 1.065, -8.20);
  makeLabTray('lab_tray_03', 'Bandeja Inox (Preparo)', -20.42, 0.91, -10.18);
  makeSyringe10ml('syringe_10ml_a', -19.70, 0.918, -10.50);
  makeSyringe10ml('syringe_10ml_b', -19.70, 0.918, -10.64);
  makeInfraredThermometer('infrared_thermometer', -20.0, 0.91, -10.2);

  // Estantes Industriais Porta-Pallet no DEPOSITO
  function addStoragePortaPalletRack(rx, rz, totalLen, depth, rotY) {
    var floorY = 0.12;
    var rackH = 2.34;
    var rg = new THREE.Group();
    rg.position.set(rx, floorY, rz);
    rg.rotation.y = rotY || 0;

    var blueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.34, metalness: 0.48 });
    var orangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.32, metalness: 0.42 });
    var darkFootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.4 });

    var halfL = totalLen / 2;
    var halfD = depth / 2;
    var colPositions = [-halfL + 0.04, 0, halfL - 0.04];

    colPositions.forEach(function (cx) {
      [-halfD + 0.04, halfD - 0.04].forEach(function (cz) {
        var post = makeBox(0.065, rackH, 0.065, blueMat);
        post.position.set(cx, rackH / 2, cz);
        var foot = makeBox(0.11, 0.018, 0.11, darkFootMat, { noShadow: true });
        foot.position.set(cx, 0.009, cz);
        rg.add(post, foot);
      });
      [0.18, 0.88, 1.58, 2.26].forEach(function (by) {
        var hBrace = makeBox(0.036, 0.036, depth - 0.08, blueMat, { noShadow: true });
        hBrace.position.set(cx, by, 0);
        rg.add(hBrace);
      });
      var diagSpanZ = depth - 0.12;
      var diagSpanY = 0.66;
      var diagLen = Math.hypot(diagSpanZ, diagSpanY);
      var diagAng = Math.atan2(diagSpanY, diagSpanZ);
      [[0.53, 1], [1.23, -1], [1.92, 1]].forEach(function (dg) {
        var dBar = makeBox(0.030, 0.030, diagLen, blueMat, { noShadow: true });
        dBar.position.set(cx, dg[0], 0);
        dBar.rotation.x = dg[1] * diagAng;
        rg.add(dBar);
      });
    });

    var rotSwap = Math.abs(Math.sin(rotY || 0)) > 0.707;
    var worldHalfX = rotSwap ? halfD : halfL;
    var worldHalfZ = rotSwap ? halfL : halfD;
    var shelfLevels = [0.28, 0.96, 1.64];
    shelfLevels.forEach(function (sy) {
      var rSurf = {
        minX: rx - worldHalfX + 0.04, maxX: rx + worldHalfX - 0.04,
        minZ: rz - worldHalfZ + 0.04, maxZ: rz + worldHalfZ - 0.04,
        topY: floorY + sy + 0.038
      };
      supportSurfaces.push(rSurf);
      [-halfD + 0.04, halfD - 0.04].forEach(function (bz) {
        var beam = makeBox(totalLen - 0.04, 0.072, 0.042, orangeMat);
        beam.position.set(0, sy, bz);
        beam.userData.supportSurface = rSurf;
        supportMeshes.push(beam);
        rg.add(beam);
        colPositions.forEach(function (cx) {
          var bracket = makeBox(0.082, 0.12, 0.082, orangeMat, { noShadow: true });
          bracket.position.set(cx, sy, bz);
          rg.add(bracket);
        });
      });
      var tray = makeBox(totalLen - 0.10, 0.032, depth - 0.08, orangeMat);
      tray.position.set(0, sy + 0.022, 0);
      tray.userData.supportSurface = rSurf;
      supportMeshes.push(tray);
      rg.add(tray);
    });

    [-halfD + 0.04, halfD - 0.04].forEach(function (bz) {
      var topBeam = makeBox(totalLen - 0.04, 0.068, 0.042, orangeMat);
      topBeam.position.set(0, 2.24, bz);
      rg.add(topBeam);
      colPositions.forEach(function (cx) {
        var topBracket = makeBox(0.082, 0.11, 0.082, orangeMat, { noShadow: true });
        topBracket.position.set(cx, 2.24, bz);
        rg.add(topBracket);
      });
    });

    scene.add(rg);
    solidColliders.push({
      minX: rx - worldHalfX, maxX: rx + worldHalfX,
      minZ: rz - worldHalfZ, maxZ: rz + worldHalfZ,
      minY: floorY, maxY: floorY + rackH
    });
  }

  addStoragePortaPalletRack(-23.05, 8.0, 7.6, 0.86, Math.PI / 2);
  addStoragePortaPalletRack(-19.2, 3.05, 5.4, 0.86, 0);
  addStoragePortaPalletRack(-19.8, 12.95, 4.8, 0.86, Math.PI);

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function makeSubstrateBag5kg(id, kind, px, py, pz) {
    var sg = new THREE.Group();
    var isGrain = kind === 'grain';
    var bagColor = isGrain ? 0xd97706 : 0x78350f;
    var bag = makeBox(0.30, 0.42, 0.22, bagColor, { roughness: 0.85 });
    bag.position.y = 0.21;
    var c = document.createElement('canvas'); c.width = 256; c.height = 128;
    var sctx = c.getContext('2d');
    sctx.fillStyle = '#f8fafc'; sctx.fillRect(0, 0, 256, 128);
    sctx.fillStyle = isGrain ? '#b45309' : '#065f46';
    sctx.fillRect(0, 0, 256, 36);
    sctx.fillStyle = '#ffffff'; sctx.font = 'bold 20px system-ui, sans-serif';
    sctx.textAlign = 'center';
    sctx.fillText(isGrain ? 'GRÃOS • MILHO 5KG' : 'SUBSTRATO BULK 5KG', 128, 25);
    sctx.fillStyle = '#1e293b'; sctx.font = 'bold 18px system-ui, sans-serif';
    sctx.fillText(isGrain ? 'Spawn / Semente' : 'Serragem + Fibra Coco', 128, 72);
    sctx.fillStyle = '#64748b'; sctx.font = '15px system-ui, sans-serif';
    sctx.fillText('Uso Laboratorial • Estoque', 128, 102);
    var lbl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.12),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })
    );
    lbl.position.set(0, 0.24, 0.112);
    sg.add(bag, lbl);
    var label = isGrain ? 'Saco de Grãos/Milho 5kg' : 'Saco de Substrato (Serragem/Coco) 5kg';
    return helpers.registerPickable(id, label, sg, px, py, pz, 0, 0.26, 0.42);
  }

  function makeGlovesBox(id, px, py, pz) {
    var gg = new THREE.Group();
    var box = makeBox(0.24, 0.12, 0.13, 0x0284c7, { roughness: 0.45 });
    box.position.y = 0.06;
    var slot = makeBox(0.12, 0.008, 0.05, 0xe0f2fe, { noShadow: true });
    slot.position.set(0, 0.122, 0);
    var strip = makeBox(0.242, 0.04, 0.132, 0xf8fafc, { noShadow: true });
    strip.position.y = 0.085;
    gg.add(box, slot, strip);
    return helpers.registerPickable(id, 'Caixa de Luvas Nitrílicas Estéreis', gg, px, py, pz, 0, 0.18, 0.14);
  }

  function makeTapeRoll(id, kind, px, py, pz) {
    var tg = new THREE.Group();
    var isMicro = kind === 'micropore';
    var outer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, isMicro ? 0.032 : 0.055, 18),
      new THREE.MeshStandardMaterial({ color: isMicro ? 0xf8fafc : 0xe2e8f0, roughness: 0.6 })
    );
    outer.position.y = isMicro ? 0.016 : 0.0275;
    var core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, isMicro ? 0.034 : 0.057, 14),
      new THREE.MeshStandardMaterial({ color: isMicro ? 0x0284c7 : 0x7c3aed, roughness: 0.5 })
    );
    core.position.y = outer.position.y;
    tg.add(outer, core);
    var lbl = isMicro ? 'Rolo de Fita Micropore (Troca Gasosa)' : 'Rolo de Parafilm M (Vedação Petri)';
    return helpers.registerPickable(id, lbl, tg, px, py, pz, 0, 0.08, 0.06);
  }

  function makeFoilRoll(id, px, py, pz) {
    var fg = new THREE.Group();
    var box = makeBox(0.32, 0.065, 0.065, 0xdc2626, { roughness: 0.45 });
    box.position.y = 0.0325;
    var band = makeBox(0.322, 0.025, 0.067, 0xfef08a, { noShadow: true });
    band.position.y = 0.04;
    fg.add(box, band);
    return helpers.registerPickable(id, 'Papel Alumínio (Autoclave)', fg, px, py, pz, 0, 0.18, 0.08);
  }

  // Popular Estoque do Deposito
  for (var bi = 0; bi < 15; bi++) {
    var bRow = Math.floor(bi / 8);
    var bCol = bi % 8;
    makeSpawnBag1500('spawn_bag_empty_' + pad2(bi + 1), false, -21.4 + bCol * 0.62, 1.118, 2.86 + bRow * 0.36);
  }
  for (var si = 0; si < 4; si++) {
    makeSubstrateBag5kg('substrate_grain_' + pad2(si + 1), 'grain', -21.35 + si * 0.58, 0.438, 3.05);
    makeSubstrateBag5kg('substrate_sawdust_' + pad2(si + 1), 'sawdust', -18.85 + si * 0.58, 0.438, 3.05);
  }
  for (var pIdx = 0; pIdx < 40; pIdx++) {
    var stackIdx = Math.floor(pIdx / 7);
    var stackLvl = pIdx % 7;
    helpers.registerPickable(
      'petri_bare_' + pad2(pIdx + 1),
      'Placa de Petri Vazia',
      makePetriDish('bare'),
      -21.3 + stackIdx * 0.56,
      1.798 + stackLvl * 0.055,
      3.05,
      0, 0.20, 0.08
    );
  }
  helpers.registerPickable('pda_bottle_02', 'Ágar PDA / BDA (500g)', pdaGroup.clone(), -17.55, 1.798, 3.05, 0, 0.14, 0.31);
  helpers.registerPickable('pda_bottle_03', 'Ágar PDA / BDA (500g)', pdaGroup.clone(), -17.15, 1.798, 3.05, 0, 0.14, 0.31);

  for (var ji = 0; ji < 15; ji++) {
    var jRow = Math.floor(ji / 8);
    var jCol = ji % 8;
    makeSpawnJar800('spawn_jar_empty_' + pad2(ji + 1), false, -23.22 + jRow * 0.34, 1.118, 4.75 + jCol * 0.85);
  }
  for (var gi = 0; gi < 3; gi++) {
    makeGlovesBox('gloves_box_' + pad2(gi + 1), -23.05, 0.438, 4.9 + gi * 0.65);
    makeFoilRoll('foil_roll_' + pad2(gi + 1), -23.05, 0.438, 7.2 + gi * 0.65);
  }
  makeAlcoholSprayBottle('alcohol_spray_02', -23.05, 0.438, 9.8);
  makeAlcoholSprayBottle('alcohol_spray_03', -23.05, 0.438, 10.4);
  for (var mi = 0; mi < 4; mi++) {
    makeTapeRoll('micropore_' + pad2(mi + 1), 'micropore', -23.05, 1.798, 4.8 + mi * 0.45);
  }
  for (var pfi = 0; pfi < 3; pfi++) {
    makeTapeRoll('parafilm_' + pad2(pfi + 1), 'parafilm', -23.05, 1.798, 7.1 + pfi * 0.45);
  }
  makeBeaker1L('beaker_1l_03', -23.05, 1.798, 9.2, 0);
  makeBeaker1L('beaker_1l_04', -23.05, 1.798, 9.9, 0);

  for (var syi = 0; syi < 20; syi++) {
    var sRow = Math.floor(syi / 10);
    var sCol = syi % 10;
    makeSyringe10ml('syringe_10ml_' + pad2(syi + 1), -21.75 + sCol * 0.43, 1.118, 12.78 + sRow * 0.34);
  }

  // ALA LESTE (Direita) — 2 blocos de 2 andares (x: 14..24)
  buildCampusBuildingWing(ctx, { cx: 19, cz: -7, width: 10, depth: 11.6, faceDir: -1, doorLabel: 'Porta de Substratos', doorSign: '🧪 SUBSTRATOS', style: 'brick', connectNorth2F: true, connectSouth2F: true, boardIndex: 2 });
  buildCampusBuildingWing(ctx, { cx: 19, cz: 8, width: 10, depth: 11.6, faceDir: -1, doorLabel: 'Porta da Estufa', doorSign: '🍄 ESTUFA', style: 'wood', connectNorth2F: true, boardIndex: 3 });

  createBanner(scene, 13.85, 5.1, -11.6, -Math.PI / 2, '#0284c7', '🧪');
  createBanner(scene, 13.85, 5.1, 3.6, -Math.PI / 2, '#15803d', '🍄');

  // Equipamentos de Substratos (Leste-Norte)
  addMovableStainlessTable('table_sub_east', 'Mesa Inox (Substratos)', 21.2, 0.12, -5.2, 1.5, 0.82, 3.2);
  createPressureCookerPair(ctx, helpers, 'pressure_cooker_sub', 'pressure_lid_sub', 'Substrato', 21.2, 0.94, -4.3);

  // Equipamentos da Estufa (Leste-Sul)
  var rack = makeBox(1.6, 0.72, 4.0, 0x1e293b);
  rack.position.set(21.0, 0.14 + 0.36, 8.0);
  scene.add(rack);
  var ledBar = makeBox(0.28, 0.08, 3.6, 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 1.1 });
  ledBar.position.set(21.0, 2.55, 8.0);
  scene.add(ledBar);
  var estufaLight = new THREE.PointLight(0xfef08a, 1.25, 14, 1.35);
  estufaLight.position.set(21.0, 2.45, 8.0);
  scene.add(estufaLight);
  solidColliders.push({ minX: 20.15, maxX: 21.85, minZ: 5.95, maxZ: 10.05, minY: 0.14, maxY: 0.86, surfaceTopY: 0.86 });
  var estufaSurf = { minX: 20.25, maxX: 21.75, minZ: 6.05, maxZ: 9.95, topY: 0.86 };
  supportSurfaces.push(estufaSurf);
  rack.userData.supportSurface = estufaSurf;
  supportMeshes.push(rack);

  buildGreenhouseBench(scene);
}
