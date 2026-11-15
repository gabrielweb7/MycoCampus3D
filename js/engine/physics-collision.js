/**
 * MycoCampus 3D — Physics, Terrain Height, Colliders & Pickable Registry
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.terrainHeight = function (x, z) {
    // Plato plano amplo para todo o mega-campus (-78..78, -50..52)
    var distCenter = Math.max(Math.abs(x) - 76, Math.abs(z - 1) - 50);
    if (distCenter <= 0) return 0;
    var blend = Math.min(1, distCenter / 24);

    // Anel de montanhas distantes ao redor do horizonte (r > 125m)
    var r = Math.hypot(x, z);
    var mtn = 0;
    if (r > 120) {
      var mt = Math.min(1, (r - 120) / 55);
      var ridge = Math.abs(Math.sin(x * 0.032 + z * 0.021) * Math.cos(z * 0.028 - x * 0.017));
      mtn = mt * mt * (14 + ridge * 26);
    }

    var hills = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 2.4 + Math.sin(x * 0.11 + z * 0.09) * 0.7;
    return blend * hills + mtn;
  }

  E.getGroundHeight = function (x, z, refY) {
    var h = E.terrainHeight(x, z);
    var curY = refY !== undefined ? refY : E.playerPos.y;

    // Escadas automaticas
    for (var s = 0; s < E.stairsList.length; s++) {
      var st = E.stairsList[s];
      if (x >= st.minX && x <= st.maxX && z <= Math.max(st.zStart, st.zEnd) && z >= Math.min(st.zStart, st.zEnd)) {
        var t = (z - st.zStart) / (st.zEnd - st.zStart);
        t = Math.max(0, Math.min(1, t));
        var sy = st.yStart + t * (st.yEnd - st.yStart);
        if (curY >= sy - 1.2) h = Math.max(h, sy);
      }
    }

    // Lajes caminhaveis automaticas (2o andar, passarela, terraco, terreo)
    for (var f = 0; f < E.walkableFloors.length; f++) {
      var fl = E.walkableFloors[f];
      if (x >= fl.minX && x <= fl.maxX && z >= fl.minZ && z <= fl.maxZ) {
        if (curY >= fl.topY - 1.1) {
          h = Math.max(h, fl.topY);
        }
      }
    }

    // Superfícies de apoio e tampos de mesas caminháveis (mesas inox, bancadas, estufas, carteiras, etc.)
    for (var u = 0; u < E.supportSurfaces.length; u++) {
      var ss = E.supportSurfaces[u];
      var sW = ss.maxX - ss.minX;
      var sD = ss.maxZ - ss.minZ;
      if (sW < 0.35 || sD < 0.35) continue; // ignora pequenos pratos ou suportes minúsculos
      if (x >= ss.minX - 0.08 && x <= ss.maxX + 0.08 && z >= ss.minZ - 0.08 && z <= ss.maxZ + 0.08) {
        if (curY >= ss.topY - 0.40) {
          h = Math.max(h, ss.topY);
        }
      }
    }

    return h;
  }

  E.getSurfaceTypeAt = function (x, y, z) {
    // Pontes de madeira e decks
    if ((x >= 8 && x <= 14 && z >= 30 && z <= 55) || (z >= 34 && z <= 52 && Math.abs(x) < 18)) {
      return 'wood';
    }
    // Interiores de edifícios (Lab, Estufa, Auditório, Salas de Aula)
    if ((x >= -24 && x <= 26 && z >= -24 && z <= 24 && y >= 0.12) || (x >= 40 && x <= 65 && z >= -20 && z <= 30)) {
      return 'lab';
    }
    // Calçadas da praça central e avenidas
    if ((Math.abs(x) < 24 && Math.abs(z) < 24) || Math.abs(x) > 60 || Math.abs(z) > 60) {
      return 'stone';
    }
    return 'grass';
  }

  E.registerPickable = function (id, label, mesh, x, y, z, ry, radius, height) {
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry || 0;
    if (E.isTouchDevice() && !mesh.userData.twoHanded) {
      mesh.traverse(function (ch) { if (ch.isMesh) ch.castShadow = false; });
    }
    E.scene.add(mesh);
    var entry = {
      id: id, label: label, mesh: mesh,
      homePos: new THREE.Vector3(x, y, z), homeRy: ry || 0,
      radius: radius || 0.25, height: height || 0.4, isMoved: false, movedAt: 0
    };
    E.pickableItems.push(entry);
    return entry;
  }

  E.clampPosAgainstWalls = function (pos, radius) {
    for (var i = 0; i < E.wallSegments.length; i++) {
      var w = E.wallSegments[i];
      if (w.minY !== undefined && (pos.y + 1.4 < w.minY || pos.y > w.maxY - 0.15)) continue;
      var vx = w.x2 - w.x1, vz = w.z2 - w.z1;
      var len2 = vx * vx + vz * vz;
      if (len2 === 0) continue;
      var t = Math.max(0, Math.min(1, ((pos.x - w.x1) * vx + (pos.z - w.z1) * vz) / len2));
      var cx = w.x1 + t * vx, cz = w.z1 + t * vz;
      var dx = pos.x - cx, dz = pos.z - cz;
      var dist = Math.hypot(dx, dz);
      var minD = radius + w.halfThick;
      if (dist < minD) {
        if (dist < 0.0001) { dx = 1; dz = 0; dist = 1; }
        pos.x = cx + (dx / dist) * minD;
        pos.z = cz + (dz / dist) * minD;
      }
    }
    for (var dIdx = 0; dIdx < E.campusDoors.length; dIdx++) {
      var dr = E.campusDoors[dIdx];
      if (!dr.open && pos.y < 3.4 && pos.z > dr.minZ - 0.1 && pos.z < dr.maxZ + 0.1 && Math.abs(pos.x - dr.frontX) < radius + 0.18) {
        pos.x = pos.x >= dr.frontX ? dr.frontX + radius + 0.18 : dr.frontX - radius - 0.18;
      }
    }
    for (var j = 0; j < E.solidColliders.length; j++) {
      var c = E.solidColliders[j];
      var surfY = (c.surfaceTopY !== undefined) ? c.surfaceTopY : c.maxY;
      if (pos.y >= surfY - 0.08 || pos.y + 1.5 < c.minY) continue;
      var nearX = Math.max(c.minX, Math.min(pos.x, c.maxX));
      var nearZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      var cdx = pos.x - nearX, cdz = pos.z - nearZ;
      var cdist = Math.hypot(cdx, cdz);
      if (cdist < radius) {
        if (cdist < 0.0001) { pos.x = c.minX - radius; }
        else {
          pos.x = nearX + (cdx / cdist) * radius;
          pos.z = nearZ + (cdz / cdist) * radius;
        }
      }
    }
    pos.x = Math.max(-200, Math.min(200, pos.x));
    pos.z = Math.max(-200, Math.min(200, pos.z));
  }

  E.lastGravityCheckAt = 0;
  E.hasFallingItems = true;
  E.dropUnsupportedItems = function () {
    var now = performance.now();
    if (!E.hasFallingItems && now - E.lastGravityCheckAt < 180) return;
    E.lastGravityCheckAt = now;
    var anyFalling = false;
    E.pickableItems.forEach(function (item) {
      if (item.potItem && item.isAttached) {
        var pot = item.potItem;
        item.mesh.position.set(pot.mesh.position.x, pot.mesh.position.y + 0.36, pot.mesh.position.z);
        item.mesh.rotation.copy(pot.mesh.rotation);
        return;
      }
      if (E.heldItem === item || E.isHeldByRemote(item.id)) {
        item.movedAt = now;
        return;
      }
      for (var cpi = 0; cpi < E.cookerPots.length; cpi++) {
        var cpRef = E.cookerPots[cpi];
        var slotIdx = cpRef.contents.indexOf(item);
        if (slotIdx !== -1) {
          var potP = cpRef.potItem.mesh.position;
          var ox = (slotIdx % 2 === 0 ? -0.06 : 0.06);
          var oz = (slotIdx < 2 ? -0.05 : 0.05);
          item.mesh.position.set(potP.x + ox, potP.y + 0.045, potP.z + oz);
          return;
        }
      }
      if (item.mesh.position.y < -5) {
        item.mesh.position.copy(item.homePos);
        item.mesh.rotation.y = item.homeRy;
        if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
        E.recentlyDropped[item.id] = now + 1500;
        E.pendingMovedItems[item.id] = {
          id: item.id, x: item.homePos.x, y: item.homePos.y, z: item.homePos.z, ry: item.homeRy
        };
        return;
      }
      var supportedY = E.getGroundHeight(item.mesh.position.x, item.mesh.position.z, item.mesh.position.y);
      if (!item.mesh.userData.isTable) {
        for (var i = 0; i < E.supportSurfaces.length; i++) {
          var s = E.supportSurfaces[i];
          if (s === item.mesh.userData.dynamicSurface) continue;
          if (item.mesh.userData.isHood && s.isHood) continue;
          if (item.mesh.position.x >= s.minX && item.mesh.position.x <= s.maxX &&
            item.mesh.position.z >= s.minZ && item.mesh.position.z <= s.maxZ &&
            item.mesh.position.y >= s.topY - 0.15) {
            supportedY = Math.max(supportedY, s.topY);
          }
        }
        if (item.mesh.userData.isPetri) {
          for (var pj = 0; pj < E.pickableItems.length; pj++) {
            var pBase = E.pickableItems[pj];
            if (!pBase || pBase === item || pBase === E.heldItem || E.isHeldByRemote(pBase.id)) continue;
            if (!pBase.mesh || !pBase.mesh.userData.isPetri) continue;
            if (Math.hypot(pBase.mesh.position.x - item.mesh.position.x, pBase.mesh.position.z - item.mesh.position.z) < 0.12 &&
              item.mesh.position.y >= pBase.mesh.position.y + 0.025 &&
              item.mesh.position.y <= pBase.mesh.position.y + 0.14) {
              supportedY = Math.max(supportedY, pBase.mesh.position.y + 0.055);
            }
          }
        }
      }
      if (item.mesh.position.y < supportedY - 0.005 && !item.mesh.userData.isTable && !item.mesh.userData.isHood) {
        item.mesh.position.y = supportedY;
        if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      } else if (item.mesh.position.y > supportedY + 0.015) {
        anyFalling = true;
        E.recentlyDropped[item.id] = now + 1500;
        item.mesh.position.y = Math.max(supportedY, item.mesh.position.y - 0.18);
        if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
        if (item.lidItem && item.lidItem.isAttached) {
          var attLid = item.lidItem;
          attLid.mesh.position.set(item.mesh.position.x, item.mesh.position.y + 0.36, item.mesh.position.z);
          E.recentlyDropped[attLid.id] = now + 1500;
        }
        if (Math.abs(item.mesh.position.y - supportedY) < 0.005) {
          item.mesh.position.y = supportedY;
          item.isMoved = true;
          E.pendingMovedItems[item.id] = {
            id: item.id,
            x: item.mesh.position.x,
            y: item.mesh.position.y,
            z: item.mesh.position.z,
            ry: item.mesh.rotation.y
          };
          if (item.lidItem && item.lidItem.isAttached) {
            var lid = item.lidItem;
            E.pendingMovedItems[lid.id] = {
              id: lid.id,
              x: lid.mesh.position.x,
              y: lid.mesh.position.y,
              z: lid.mesh.position.z,
              ry: lid.mesh.rotation.y
            };
          }
        }
      }
    });
    E.hasFallingItems = anyFalling;
  }

  // ---------------- Avatares Multiplayer ----------------

  E.findPickable = function (itemId) {
    for (var i = 0; i < E.pickableItems.length; i++) {
      if (E.pickableItems[i].id === itemId) return E.pickableItems[i];
    }
    return null;
  }

})();