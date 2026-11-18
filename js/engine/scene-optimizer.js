/**
 * MycoCampus3D — Otimizador de Cena & Congelador de Matrizes Estáticas
 * Congela a transformação de milhares de elementos que nunca se movem
 * (paredes, vidros, pisos, montanhas, calçadas, bancadas, colunas).
 * Economiza tempo maciço de CPU por frame no mobile sem alterar nada visualmente.
 */

export function freezeStaticWorld(sim) {
  if (!sim || !sim.scene) return 0;
  const scene = sim.scene;

  // Garante que todo o grafo de cena tenha suas matrizes mundiais perfeitamente calculadas
  scene.updateMatrixWorld(true);

  // Conjunto de raízes e nós dinâmicos que NUNCA devem ser congelados
  const dynamicObjects = new Set();

  function markDynamicTree(obj) {
    if (!obj) return;
    dynamicObjects.add(obj);
    if (obj.children && obj.children.length > 0) {
      for (let i = 0; i < obj.children.length; i++) {
        markDynamicTree(obj.children[i]);
      }
    }
  }

  // 1. Elementos do jogador e UI 3D
  markDynamicTree(sim.localAvatar && sim.localAvatar.group);
  markDynamicTree(sim.fpsArmGroup);
  markDynamicTree(sim.fpsLeftArmGroup);
  markDynamicTree(sim.placementGhost && sim.placementGhost.root);
  markDynamicTree(sim.hover3dBadge && sim.hover3dBadge.mesh);
  markDynamicTree(sim.thermoLaserLine);
  markDynamicTree(sim.thermoLaserDot);
  markDynamicTree(sim.snowboardGroup);
  markDynamicTree(sim.paragliderGroup);
  markDynamicTree(sim.roundParachuteGroup);

  // 2. Elementos celestes e clima dinâmico
  markDynamicTree(sim.sunDisc);
  markDynamicTree(sim.sunHalo);
  markDynamicTree(sim.moonDisc);
  markDynamicTree(sim.starPoints);
  markDynamicTree(sim.weatherPoints);
  markDynamicTree(sim.envSun);
  markDynamicTree(sim.envSun && sim.envSun.target);
  markDynamicTree(sim.envHemi);
  markDynamicTree(sim.rainbowMesh);
  if (sim.envClouds) {
    for (let c = 0; c < sim.envClouds.length; c++) markDynamicTree(sim.envClouds[c]);
  }

  // 3. Portas que abrem e fecham
  if (sim.campusDoors) {
    for (let d = 0; d < sim.campusDoors.length; d++) {
      markDynamicTree(sim.campusDoors[d].pivot);
    }
  }

  // 4. Persianas móveis
  if (sim.windowBlinds) {
    for (let b = 0; b < sim.windowBlinds.length; b++) {
      const wb = sim.windowBlinds[b];
      if (wb.slats) {
        for (let s = 0; s < wb.slats.length; s++) dynamicObjects.add(wb.slats[s]);
      }
      if (wb.tapes) {
        for (let t = 0; t < wb.tapes.length; t++) dynamicObjects.add(wb.tapes[t]);
      }
      if (wb.bottomRail) dynamicObjects.add(wb.bottomRail);
      if (wb.cordKnob) dynamicObjects.add(wb.cordKnob);
    }
  }

  // 5. Entidades e veículos dinâmicos
  if (sim.sportBalls) {
    for (let sp = 0; sp < sim.sportBalls.length; sp++) markDynamicTree(sim.sportBalls[sp].mesh);
  }
  if (sim.pastureCows) {
    for (let cw = 0; cw < sim.pastureCows.length; cw++) markDynamicTree(sim.pastureCows[cw].group);
  }
  if (sim.cowPoops) {
    for (let cp = 0; cp < sim.cowPoops.length; cp++) markDynamicTree(sim.cowPoops[cp].mesh);
  }
  if (sim.wildMushrooms) {
    for (let wm = 0; wm < sim.wildMushrooms.length; wm++) {
      if (sim.wildMushrooms[wm].capMesh) dynamicObjects.add(sim.wildMushrooms[wm].capMesh);
    }
  }

  // 6. Itens pegáveis
  if (sim.pickableItems) {
    for (let pi = 0; pi < sim.pickableItems.length; pi++) {
      markDynamicTree(sim.pickableItems[pi].mesh);
    }
  }

  // 7. Congela tudo o que é puramente estático
  let frozenCount = 0;
  scene.traverse((obj) => {
    if (!obj || dynamicObjects.has(obj)) return;
    if (obj.userData && (obj.userData.isDynamic || obj.userData.keepDynamic)) return;

    obj.matrixAutoUpdate = false;
    frozenCount++;
  });

  return frozenCount;
}
