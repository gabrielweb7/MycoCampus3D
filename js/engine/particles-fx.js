/**
 * MycoCampus 3D — Particle Effects (Confetti, Spores & Water Spray)
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.greenhouseHitMeshes = [];
  E.hoveredGreenhouseSlot = null;
  E.sporeParticles = [];
  E.waterSprayParticles = [];

  // ---------------- Confetes Dinâmicos de Celebração (Emotes) ----------------
  E.confettiParticles = [];
  E.initConfettiSystem = function () {
    var geo = new THREE.PlaneGeometry(0.09, 0.09);
    var colors = [0xf43f5e, 0x3b82f6, 0x10b981, 0xfbbf24, 0xa855f7, 0x06b6d4, 0xf97316];
    for (var i = 0; i < 48; i++) {
      var mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      E.scene.add(mesh);
      E.confettiParticles.push({
        mesh: mesh,
        vx: 0, vy: 0, vz: 0,
        vrx: 0, vry: 0,
        life: 0, maxLife: 2.2
      });
    }
  }

  E.triggerConfettiBurst = function (x, y, z) {
    var spawnCount = 0;
    for (var i = 0; i < E.confettiParticles.length && spawnCount < 36; i++) {
      var p = E.confettiParticles[i];
      if (p.mesh.visible && p.life < p.maxLife) continue;
      p.mesh.position.set(
        x + (Math.random() - 0.5) * 0.45,
        y + 1.25 + Math.random() * 0.35,
        z + (Math.random() - 0.5) * 0.45
      );
      var ang = Math.random() * Math.PI * 2;
      var speed = 1.6 + Math.random() * 2.8;
      p.vx = Math.cos(ang) * speed;
      p.vy = 2.4 + Math.random() * 2.8;
      p.vz = Math.sin(ang) * speed;
      p.vrx = (Math.random() - 0.5) * 12;
      p.vry = (Math.random() - 0.5) * 12;
      p.life = 0;
      p.maxLife = 1.8 + Math.random() * 0.8;
      p.mesh.visible = true;
      spawnCount++;
    }
  }

  E.stepConfetti = function (dt) {
    for (var i = 0; i < E.confettiParticles.length; i++) {
      var p = E.confettiParticles[i];
      if (!p.mesh.visible) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 9.8 * dt * 0.65;
      p.vx *= 0.98;
      p.vz *= 0.98;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.vrx * dt;
      p.mesh.rotation.y += p.vry * dt;
    }
  }

  E.initGreenhouseParticlePools = function () {
    var sGeo = new THREE.SphereGeometry(0.025, 6, 6);
    for (var i = 0; i < 30; i++) {
      var sMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 });
      var sMesh = new THREE.Mesh(sGeo, sMat);
      sMesh.visible = false;
      E.scene.add(sMesh);
      E.sporeParticles.push({
        mesh: sMesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 2.0
      });
    }
    var wGeo = new THREE.SphereGeometry(0.018, 6, 6);
    for (var j = 0; j < 30; j++) {
      var wMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
      var wMesh = new THREE.Mesh(wGeo, wMat);
      wMesh.visible = false;
      E.scene.add(wMesh);
      E.waterSprayParticles.push({
        mesh: wMesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.2
      });
    }
  }

  E.triggerSporeBurst = function (ox, oy, oz, col) {
    E.sporeParticles.forEach(function (sp) {
      sp.mesh.position.set(ox + (Math.random() - 0.5) * 0.25, oy, oz + (Math.random() - 0.5) * 0.25);
      if (col) sp.mesh.material.color.setHex(col);
      sp.mesh.visible = true;
      sp.vel.set((Math.random() - 0.5) * 1.5, Math.random() * 1.8 + 0.5, (Math.random() - 0.5) * 1.5);
      sp.life = 0;
      sp.maxLife = 1.5 + Math.random() * 0.8;
    });
  }

  E.triggerWaterSprayFx = function (ox, oy, oz) {
    E.waterSprayParticles.forEach(function (wp) {
      wp.mesh.position.set(ox + (Math.random() - 0.5) * 0.35, oy + 0.65, oz + (Math.random() - 0.5) * 0.35);
      wp.mesh.visible = true;
      wp.vel.set((Math.random() - 0.5) * 0.4, -(Math.random() * 1.5 + 1.2), (Math.random() - 0.5) * 0.4);
      wp.life = 0;
      wp.maxLife = 0.8 + Math.random() * 0.4;
    });
  }

  E.stepGreenhouseParticles = function (dt) {
    for (var i = 0; i < E.sporeParticles.length; i++) {
      var sp = E.sporeParticles[i];
      if (!sp.mesh.visible) continue;
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        sp.mesh.visible = false;
        continue;
      }
      sp.vel.y -= 0.6 * dt;
      sp.mesh.position.x += sp.vel.x * dt;
      sp.mesh.position.y += sp.vel.y * dt;
      sp.mesh.position.z += sp.vel.z * dt;
      sp.mesh.material.opacity = Math.max(0, 1 - sp.life / sp.maxLife);
    }
    for (var j = 0; j < E.waterSprayParticles.length; j++) {
      var wp = E.waterSprayParticles[j];
      if (!wp.mesh.visible) continue;
      wp.life += dt;
      if (wp.life >= wp.maxLife) {
        wp.mesh.visible = false;
        continue;
      }
      wp.mesh.position.x += wp.vel.x * dt;
      wp.mesh.position.y += wp.vel.y * dt;
      wp.mesh.position.z += wp.vel.z * dt;
    }
  }

})();