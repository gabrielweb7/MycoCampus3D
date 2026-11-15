/**
 * MycoCampus 3D — Procedural Textures, Materials & Mesh Factories
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.createProceduralTextures = function () {
    // 1. Tijolinho a vista
    var bc = document.createElement('canvas');
    bc.width = 256; bc.height = 256;
    var bctx = bc.getContext('2d');
    bctx.fillStyle = '#9e9589'; // argamassa
    bctx.fillRect(0, 0, 256, 256);
    var brickPalette = ['#8c4632', '#7a3b29', '#994e38', '#6f3424', '#85422f'];
    var rows = 8, cols = 4, bh = 256 / rows, bw = 256 / cols;
    for (var r = 0; r < rows; r++) {
      var off = (r % 2) * (bw / 2);
      for (var c = -1; c <= cols; c++) {
        bctx.fillStyle = brickPalette[(r * 5 + c + 10) % brickPalette.length];
        bctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
    E.texBrick = new THREE.CanvasTexture(bc);
    E.texBrick.wrapS = THREE.RepeatWrapping;
    E.texBrick.wrapT = THREE.RepeatWrapping;

    // 2. Bloquete da praca
    var pc = document.createElement('canvas');
    pc.width = 256; pc.height = 256;
    var pctx = pc.getContext('2d');
    pctx.fillStyle = '#8b8175';
    pctx.fillRect(0, 0, 256, 256);
    var pavePalette = ['#bfb1a0', '#b2a392', '#c8bba9', '#a89a8a'];
    for (var pr = 0; pr < 16; pr++) {
      var poff = (pr % 2) * 16;
      for (var pcCol = -1; pcCol < 9; pcCol++) {
        pctx.fillStyle = pavePalette[(pr * 3 + pcCol + 20) % pavePalette.length];
        pctx.fillRect(pcCol * 32 + poff + 1.5, pr * 16 + 1.5, 29, 13);
      }
    }
    E.texPaving = new THREE.CanvasTexture(pc);
    E.texPaving.wrapS = THREE.RepeatWrapping;
    E.texPaving.wrapT = THREE.RepeatWrapping;
    E.texPaving.repeat.set(16, 18);

    // 3. Madeira ripada
    var wc = document.createElement('canvas');
    wc.width = 128; wc.height = 128;
    var wctx = wc.getContext('2d');
    wctx.fillStyle = '#6b4226';
    wctx.fillRect(0, 0, 128, 128);
    var woodCols = ['#8b5a2b', '#7a4b22', '#966332', '#6f421d'];
    for (var i = 0; i < 8; i++) {
      wctx.fillStyle = woodCols[i % woodCols.length];
      wctx.fillRect(i * 16 + 1, 0, 14, 128);
    }
    E.texWood = new THREE.CanvasTexture(wc);
    E.texWood.wrapS = THREE.RepeatWrapping;
    E.texWood.wrapT = THREE.RepeatWrapping;

    // 4. Agua cristalina com caustics / ondulacoes suaves
    var watC = document.createElement('canvas');
    watC.width = 256; watC.height = 256;
    var watCtx = watC.getContext('2d');
    watCtx.fillStyle = '#0369a1';
    watCtx.fillRect(0, 0, 256, 256);
    // Causticas organicas sem emendas (seamless wrap 256x256)
    for (var wi = 0; wi < 48; wi++) {
      var wx = (wi * 53 + 17) % 256;
      var wy = (wi * 79 + 29) % 256;
      var wr = 14 + (wi % 5) * 7;
      watCtx.strokeStyle = wi % 2 === 0 ? 'rgba(186, 230, 253, 0.26)' : 'rgba(56, 189, 248, 0.30)';
      watCtx.lineWidth = 2.0;
      [-256, 0, 256].forEach(function (ox) {
        [-256, 0, 256].forEach(function (oy) {
          if (wx + ox < -50 || wx + ox > 306 || wy + oy < -50 || wy + oy > 306) return;
          watCtx.beginPath();
          watCtx.ellipse(wx + ox, wy + oy, wr * 1.25, wr * 0.62, (wi % 4) * 0.45, 0, Math.PI * 2);
          watCtx.stroke();
        });
      });
    }
    for (var wj = 0; wj < 24; wj++) {
      var bx = (wj * 67 + 11) % 256;
      var by = (wj * 43 + 19) % 256;
      var br = 3 + (wj % 3) * 2.5;
      watCtx.fillStyle = 'rgba(224, 242, 254, 0.18)';
      watCtx.beginPath();
      watCtx.arc(bx, by, br, 0, Math.PI * 2);
      watCtx.fill();
    }
    E.texWater = new THREE.CanvasTexture(watC);
    E.texWater.wrapS = THREE.RepeatWrapping;
    E.texWater.wrapT = THREE.RepeatWrapping;
    E.texWater.repeat.set(4, 4);
  }

  E.brickMat = function (repX, repY) {
    var t = E.texBrick.clone();
    t.needsUpdate = true;
    t.repeat.set(repX || 2, repY || 2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.86, metalness: 0.04 });
  }

  E.woodMat = function (repX, repY) {
    var t = E.texWood.clone();
    t.needsUpdate = true;
    t.repeat.set(repX || 2, repY || 1);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.78, metalness: 0.05 });
  }

  E.makeBox = function (w, h, d, colorOrMat, opts) {
    opts = opts || {};
    var geo = new THREE.BoxGeometry(w, h, d);
    var mat = (colorOrMat && colorOrMat.isMaterial) ? colorOrMat : new THREE.MeshStandardMaterial({
      color: colorOrMat,
      roughness: opts.roughness !== undefined ? opts.roughness : 0.7,
      metalness: opts.metalness !== undefined ? opts.metalness : 0.1,
      transparent: !!opts.transparent,
      opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity || 0
    });
    var m = new THREE.Mesh(geo, mat);
    m.castShadow = !opts.noShadow;
    m.receiveShadow = true;
    return m;
  }

  // ---------------- Altura do Terreno & Pisos Elevados ----------------

  E.addWalkableSlab = function (cx, topY, cz, w, thickness, d, colorOrMat, opts) {
    var mesh = E.makeBox(w, thickness, d, colorOrMat, opts);
    mesh.position.set(cx, topY - thickness / 2, cz);
    E.scene.add(mesh);
    E.walkableFloors.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
      topY: topY
    });
    return mesh;
  }

  E.addSolidWall = function (x1, z1, x2, z2, minY, height, thickness, colorOrMat, opts) {
    var dx = x2 - x1, dz = z2 - z1;
    var len = Math.hypot(dx, dz);
    if (len < 0.01) return null;
    var mesh = E.makeBox(len, height, thickness, colorOrMat, opts);
    mesh.position.set((x1 + x2) / 2, minY + height / 2, (z1 + z2) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    E.scene.add(mesh);
    E.wallSegments.push({
      x1: x1, z1: z1, x2: x2, z2: z2,
      halfThick: thickness / 2 + 0.06,
      minY: minY, maxY: minY + height
    });
    return mesh;
  }

  // ---------------- Mundo Natural & Lago ----------------

  E.makeTextSprite = function (text, colorHex) {
    var canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 96;
    var tex = new THREE.CanvasTexture(canvas);
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    var sp = new THREE.Sprite(mat);
    sp.scale.set(2.2, 0.42, 1);
    E.updateTextSprite(sp, text, colorHex);
    return sp;
  }

  E.updateTextSprite = function (sp, text, colorHex) {
    var tex = sp.material.map;
    var canvas = tex.image;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!text) { tex.needsUpdate = true; return; }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    E.roundRectPath(ctx, 16, 12, 480, 72, 24);
    ctx.fill();
    ctx.fillStyle = colorHex || '#ffffff';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 30), 256, 48);
    tex.needsUpdate = true;
  }
})();