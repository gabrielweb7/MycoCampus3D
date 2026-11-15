/**
 * MycoCampus 3D — Collaborative Greenhouse Cultivation Bench
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.greenhouseSlots = [
    {
      id: 0,
      name: 'Shimeji Dourado',
      sci: 'Pleurotus citrinopileatus',
      x: 21.0, y: 0.86, z: 6.65,
      stage: 1,
      humidity: 82,
      growth: 20,
      color: 0xfacc15,
      group: null,
      mushGroup: null,
      badgeSprite: null
    },
    {
      id: 1,
      name: 'Shiitake',
      sci: 'Lentinula edodes',
      x: 21.0, y: 0.86, z: 7.55,
      stage: 2,
      humidity: 78,
      growth: 50,
      color: 0x78350f,
      group: null,
      mushGroup: null,
      badgeSprite: null
    },
    {
      id: 2,
      name: 'Juba de Leão',
      sci: 'Hericium erinaceus',
      x: 21.0, y: 0.86, z: 8.45,
      stage: 0,
      humidity: 88,
      growth: 10,
      color: 0xf8fafc,
      group: null,
      mushGroup: null,
      badgeSprite: null
    },
    {
      id: 3,
      name: 'Golden Teacher',
      sci: 'Psilocybe cubensis',
      x: 21.0, y: 0.86, z: 9.35,
      stage: 3,
      humidity: 92,
      growth: 100,
      color: 0xd97706,
      group: null,
      mushGroup: null,
      badgeSprite: null
    }
  ];
  E.updateGreenhouseSlotMesh = function (slot) {
    if (!slot.mushGroup) return;
    while (slot.mushGroup.children.length > 0) {
      slot.mushGroup.remove(slot.mushGroup.children[0]);
    }

    var stage = slot.stage;
    var col = slot.color;

    if (stage === 0) {
      var fuzzMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.95 });
      for (var fz = -2; fz <= 2; fz++) {
        var dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), fuzzMat);
        dot.scale.set(1.4, 0.35, 1.2);
        dot.position.set(fz * 0.05, 0.14, (fz % 2) * 0.04);
        slot.mushGroup.add(dot);
      }
    } else if (stage === 1) {
      var pinMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 });
      var stemMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.8 });
      for (var p = -2; p <= 2; p++) {
        var pStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.05, 6), stemMat);
        pStem.position.set(p * 0.05, 0.15, ((p * 3) % 4) * 0.025);
        var pCap = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), pinMat);
        pCap.position.set(p * 0.05, 0.18, ((p * 3) % 4) * 0.025);
        slot.mushGroup.add(pStem, pCap);
      }
    } else if (stage === 2) {
      var medMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 });
      var medStemMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.7 });
      for (var m = -1; m <= 1; m++) {
        var mStem = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.12, 8), medStemMat);
        mStem.position.set(m * 0.08, 0.18, (m % 2) * 0.03);
        var mCap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), medMat);
        mCap.position.set(m * 0.08, 0.24, (m % 2) * 0.03);
        slot.mushGroup.add(mStem, mCap);
      }
    } else {
      var matureMat = new THREE.MeshStandardMaterial({
        color: col, roughness: 0.38,
        emissive: slot.id === 3 ? 0xf59e0b : 0x000000,
        emissiveIntensity: slot.id === 3 ? 0.35 : 0
      });
      var matureStemMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.65 });

      if (slot.id === 0) {
        for (var sb = -2; sb <= 2; sb++) {
          var sStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.026, 0.20, 8), matureStemMat);
          sStem.position.set(sb * 0.055, 0.22, ((sb * 2) % 3) * 0.035);
          sStem.rotation.z = sb * 0.12;
          var sCap = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), matureMat);
          sCap.position.set(sb * 0.07, 0.32, ((sb * 2) % 3) * 0.035);
          slot.mushGroup.add(sStem, sCap);
        }
      } else if (slot.id === 1) {
        for (var sh = -1; sh <= 1; sh++) {
          var shStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.18, 8), matureStemMat);
          shStem.position.set(sh * 0.10, 0.21, 0);
          var shCap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.04, 12), matureMat);
          shCap.position.set(sh * 0.10, 0.30, 0);
          slot.mushGroup.add(shStem, shCap);
        }
      } else if (slot.id === 2) {
        var jStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 8), matureStemMat);
        jStem.position.set(0, 0.18, 0);
        var lionBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
        lionBall.position.set(0, 0.28, 0);
        lionBall.scale.set(1.2, 0.9, 1.1);
        slot.mushGroup.add(jStem, lionBall);
      } else {
        for (var gt = -1; gt <= 1; gt++) {
          var gtStem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.26, 8), matureStemMat);
          gtStem.position.set(gt * 0.085, 0.25, gt * 0.03);
          var gtVeil = new THREE.Mesh(new THREE.RingGeometry(0.022, 0.045, 10), new THREE.MeshBasicMaterial({ color: 0x1e1b4b, side: THREE.DoubleSide }));
          gtVeil.rotation.x = Math.PI / 2;
          gtVeil.position.set(gt * 0.085, 0.30, gt * 0.03);
          var gtCap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.09, 12), matureMat);
          gtCap.position.set(gt * 0.085, 0.38, gt * 0.03);
          slot.mushGroup.add(gtStem, gtVeil, gtCap);
        }
      }
    }

    if (slot.badgeSprite) {
      var sNames = ['Micélio', 'Primórdios', 'Crescendo', '✨ MADURO!'];
      var sColors = ['#94a3b8', '#38bdf8', '#fbbf24', '#34d399'];
      var infoText = slot.name + ' • ' + Math.round(slot.humidity) + '% UR\n' + sNames[slot.stage];
      E.updateTextSprite(slot.badgeSprite, infoText, sColors[slot.stage]);
    }
  }

  E.buildGreenhouseBench = function (estufaSurf) {
    E.greenhouseSlots.forEach(function (slot) {
      var g = new THREE.Group();
      g.position.set(slot.x, slot.y, slot.z);

      var blockMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
      var blockMesh = E.makeBox(0.36, 0.18, 0.28, blockMat);
      blockMesh.position.y = 0.09;
      blockMesh.castShadow = true;
      blockMesh.userData.greenhouseSlot = slot;
      g.add(blockMesh);
      E.greenhouseHitMeshes.push(blockMesh);

      var ledColor = slot.humidity >= 70 ? 0x10b981 : (slot.humidity >= 45 ? 0xf59e0b : 0xef4444);
      var ledStrip = E.makeBox(0.32, 0.02, 0.02, ledColor, { emissive: ledColor, emissiveIntensity: 0.8 });
      ledStrip.position.set(0, 0.02, 0.145);
      g.add(ledStrip);

      var mg = new THREE.Group();
      g.add(mg);
      slot.group = g;
      slot.mushGroup = mg;

      var badge = E.makeTextSprite(slot.name, '#34d399');
      badge.position.set(0, 0.54, 0);
      badge.scale.set(1.2, 0.30, 1);
      g.add(badge);
      slot.badgeSprite = badge;

      E.updateGreenhouseSlotMesh(slot);
      E.scene.add(g);
    });
  }

  E.interactGreenhouseSlot = function (slot) {
    var isHoldingSpray = E.heldItem && (E.heldItem.id.indexOf('alcohol_spray') !== -1 || E.heldItem.id.indexOf('spray') !== -1);
    if (slot.stage === 3) {
      if (window.MycoAudio) window.MycoAudio.playHarvest();
      E.triggerSporeBurst(slot.x, slot.y + 0.35, slot.z, slot.color);
      if (E.callbacks.onHarvestGreenhouse) {
        E.callbacks.onHarvestGreenhouse(slot);
      }
      slot.stage = 0;
      slot.growth = 0;
      slot.humidity = 70;
      E.updateGreenhouseSlotMesh(slot);
      E.queueWorldStateChange('greenhouse_slot_' + slot.id + '_stage', 0);
      E.queueWorldStateChange('greenhouse_slot_' + slot.id + '_humidity', 70);
      return;
    }

    if (isHoldingSpray) {
      slot.humidity = Math.min(100, slot.humidity + 25);
      if (window.MycoAudio) window.MycoAudio.playSpray();
      E.triggerWaterSprayFx(slot.x, slot.y + 0.30, slot.z);
      E.updateGreenhouseSlotMesh(slot);
      E.queueWorldStateChange('greenhouse_slot_' + slot.id + '_humidity', Math.round(slot.humidity));
      return;
    }

    if (window.MycoAudio) window.MycoAudio.playClick();
  }

})();