/**
 * Layout & Montagem das Alas Leste/Oeste e Equipamentos (MycoCampus3D)
 * Cada item e equipamento possui seu proprio modulo dedicado em js/items/.
 */

import { makeBox } from '../engine/textures.js';
import { createBanner } from './nature-plaza.js';
import { buildCampusBuildingWing } from './buildings.js';
import { buildGreenhouseBench } from './greenhouse.js';
import { registerPickable } from '../items/item-registry.js';
import { addMovableStainlessTable } from '../items/stainless-table.js';
import { buildLaminarHoodAndBenches } from '../items/laminar-hood.js';
import { createPressureCookerPair, makeElectricBurner } from '../items/pressure-cooker.js';
import { makePetriDish, getPetriMeta, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, PETRI_STACK_SPACING } from '../items/petri-dish.js';
import { makeCultureFridge } from '../items/culture-fridge.js';
import { createPdaBottleGroup, PDA_BOTTLE_META } from '../items/pda-bottle.js';
import { attachPdaMediumCtrl, attachPdaReagentCtrl, makePdaMediaBottle1L } from '../items/pda-mix.js';
import { makeSpawnJar800, makeSpawnBag1500 } from '../items/spawn-containers.js';
import { createPrecisionScale } from '../items/precision-scale.js';
import { makeAlcoholSprayBottle } from '../items/alcohol-spray.js';
import { createHeatSealer } from '../items/heat-sealer.js';
import { makeLiquidJar800, makeBeaker1L } from '../items/liquid-culture.js';
import { makeMagneticStirrer } from '../items/magnetic-stirrer.js';
import { makeSyringe10ml } from '../items/syringe.js';
import { makeInfraredThermometer } from '../items/thermometer.js';
import { makeLabTray } from '../items/lab-tray.js';
import { buildLabSink } from '../items/lab-sink.js';
import { makeDistilledJug5L } from '../items/distilled-jug.js';
import { makeFalconTube, makeFalconRack } from '../items/falcon-tubes.js';
import { makeCookerBase } from '../items/cooker-base.js';
import { makeGasTripodBurner } from '../items/gas-tripod.js';
import { makeScalpel, makeScalpelBladePack } from '../items/scalpel.js';
import { makePP5Cup145ml } from '../items/pp5-cup.js';
import { makeFlocao500g } from '../items/flocao-corn.js';
import { makeMixingBowl, makeLabSpoon } from '../items/mixing-bowl.js';
import {
  addStoragePortaPalletRack,
  makeSubstrateBag5kg,
  makeGlovesBox,
  makeTapeRoll,
  makeFoilRoll
} from '../items/storage-rack.js';

const THREE = window.THREE;

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

export function buildCampusWingsAndEquipment(ctx) {
  const scene = ctx.scene;
  const solidColliders = ctx.solidColliders;
  const supportSurfaces = ctx.supportSurfaces;
  const supportMeshes = ctx.supportMeshes;

  // ALA OESTE (Esquerda) — 2 blocos de 2 andares (x: -24..-14)
  buildCampusBuildingWing(ctx, { cx: -19, cz: -7, width: 10, depth: 11.6, faceDir: 1, doorLabel: 'Porta do Laboratório', doorSign: '🔬 LAB', style: 'brick', connectNorth2F: true, connectSouth2F: true, boardIndex: 0 });
  buildCampusBuildingWing(ctx, { cx: -19, cz: 8, width: 10, depth: 11.6, faceDir: 1, doorLabel: 'Porta do Depósito', doorSign: '📦 DEPÓSITO', style: 'brick', connectNorth2F: true, boardIndex: 1 });

  createBanner(scene, -13.85, 5.1, -11.6, Math.PI / 2, '#6d28d9', '🔬');
  createBanner(scene, -13.85, 5.1, -2.4, Math.PI / 2, '#1d4ed8', '🧬');
  createBanner(scene, -13.85, 5.1, 12.6, Math.PI / 2, '#d97706', '📦');

  // Bancada fixa: capela, preparo de meios e trabalho asséptico.
  buildLaminarHoodAndBenches(ctx);

  // Autoclave, Base Perfurada & Fogareiro
  addMovableStainlessTable(ctx, 'table_cooker_lab', 'Mesa Inox (Autoclave/Spawn)', -18.5, 0.12, -5.0, 1.5, 0.85, 2.4);
  makeElectricBurner(ctx, 'burner_lab', -18.5, 0.97, -4.6);
  createPressureCookerPair(ctx, 'pressure_cooker_lab', 'pressure_lid_lab', 'Lab', -18.5, 1.058, -4.6);
  makeCookerBase(ctx, 'cooker_base_lab', -18.5, 0.97, -5.5);

  // Pia Inox com Torneira + Garrafao 5L Agua Destilada
  buildLabSink(ctx, -23.15, 1.02, -10.8);
  makeDistilledJug5L(ctx, 'distilled_jug_5l', -22.15, 1.02, -12.3, 5000);
  makeCultureFridge(ctx, 'culture_fridge_lab', -15.1, 0.12, -9.7);

  // Materiais assépticos ficam na bancada fixa, à direita da capela.
  registerPickable(ctx, 'petri_clean', 'Placa de Petri (Micélio Rizomórfico)', makePetriDish('clean'), -16.55, 1.02, -11.45, 0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, getPetriMeta('clean'));
  registerPickable(ctx, 'petri_contam', 'Placa Contaminada (Mofo/Bactéria)', makePetriDish('contam'), -15.55, 1.02, -11.45, 0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, getPetriMeta('contam'));
  registerPickable(ctx, 'petri_empty', 'Placa de Petri Estéril (PDA)', makePetriDish('empty'), -19.2, 1.34, -1.85, 0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, getPetriMeta('empty'));

  // Frasco PDA 500g
  const pdaGroup = createPdaBottleGroup();
  const pdaBottle = registerPickable(ctx, 'pda_bottle', 'Pó desidratado BDA/PDA 500g', pdaGroup, -22.15, 1.02, -11.45, 0, 0.15, 0.34, PDA_BOTTLE_META);
  attachPdaReagentCtrl(pdaBottle);

  // Spawn, Balanca, Borrifador & Seladora
  makeSpawnJar800(ctx, 'spawn_jar', true, -23.1, 1.02, -4.5);
  makeSpawnJar800(ctx, 'spawn_jar_empty', false, -23.1, 1.02, -3.7);
  makeSpawnBag1500(ctx, 'spawn_bag_colonized', true, -23.1, 1.02, -8.5);
  makeSpawnBag1500(ctx, 'spawn_bag_empty', false, -23.1, 1.02, -7.8);
  createPrecisionScale(ctx, 'precision_scale', -23.1, 1.02, -9.6);
  makeMixingBowl(ctx, 'mixing_bowl_01', -23.1, 1.02, -10.1);
  makeLabSpoon(ctx, 'lab_spoon_01', -23.1, 1.02, -10.35);
  makeAlcoholSprayBottle(ctx, 'alcohol_spray', -23.1, 1.02, -7.1);
  createHeatSealer(ctx, 'heat_sealer', -23.1, 1.02, -6.2);

  // Estacao de preparo de meios e cultura liquida na bancada fixa.
  makeMagneticStirrer(ctx, 'magnetic_stirrer', -21.65, 1.02, -11.75);
  makeLiquidJar800(ctx, 'liquid_culture', -21.65, 1.125, -11.79, 350);
  makePdaMediaBottle1L(ctx, 'pda_media_bottle_1l', -22.0, 1.02, -11.8);
  const beakerA = makeBeaker1L(ctx, 'beaker_1l_a', -21.10, 1.02, -11.8, 0);
  const beakerB = makeBeaker1L(ctx, 'beaker_1l_b', -20.75, 1.02, -11.8, 500);
  attachPdaMediumCtrl(beakerA, 'beaker', false);
  attachPdaMediumCtrl(beakerB, 'beaker', false);
  makeLabTray(ctx, 'lab_tray_01', 'Bandeja Inox Cirúrgica', -20.75, 1.02, -11.3);
  makeLabTray(ctx, 'lab_tray_02', 'Bandeja Inox (Fluxo)', -16.0, 1.02, -12.2);
  makeLabTray(ctx, 'lab_tray_03', 'Bandeja Inox (Preparo)', -21.45, 1.02, -12.3);
  makeSyringe10ml(ctx, 'syringe_10ml_a', -20.25, 1.028, -12.25);
  makeSyringe10ml(ctx, 'syringe_10ml_b', -20.25, 1.028, -12.05);
  makeInfraredThermometer(ctx, 'infrared_thermometer', -20.75, 1.02, -12.3);

  // Estante azul + Tubos Falcon 15ml (azul) e 50ml (laranja)
  makeFalconRack(ctx, -20.0, 1.02, -11.55);
  const falcon15a = makeFalconTube(ctx, 'falcon_15ml_01', 15, -20.06, 1.03, -11.59, 0);
  const falcon15b = makeFalconTube(ctx, 'falcon_15ml_02', 15, -20.01, 1.03, -11.59, 10);
  const falcon15c = makeFalconTube(ctx, 'falcon_15ml_03', 15, -19.96, 1.03, -11.59, 0);
  const falcon15d = makeFalconTube(ctx, 'falcon_15ml_04', 15, -19.91, 1.03, -11.59, 0);
  const falcon50a = makeFalconTube(ctx, 'falcon_50ml_01', 50, -20.05, 1.03, -11.5, 0);
  const falcon50b = makeFalconTube(ctx, 'falcon_50ml_02', 50, -19.95, 1.03, -11.5, 35);
  [falcon15a, falcon15b, falcon15c, falcon15d].forEach((item) => attachPdaMediumCtrl(item, 'falcon', true));
  [falcon50a, falcon50b].forEach((item) => attachPdaMediumCtrl(item, 'falcon', false));

  // Bisturi, laminas e PP5 ficam na area asséptica a direita da capela.
  makeScalpel(ctx, 'scalpel_01', -15.1, 1.02, -12.2);
  for (let bpi = 0; bpi < 4; bpi++) {
    makeScalpelBladePack(ctx, 'scalpel_blade_' + pad2(bpi + 1), -15.35 + bpi * 0.04, 1.02, -12.2);
  }
  makeFlocao500g(ctx, 'flocao_500g_01', -23.10, 1.02, -5.30);
  makeFlocao500g(ctx, 'flocao_500g_02', -23.10, 1.02, -5.05);
  for (let ppIdx = 0; ppIdx < 8; ppIdx++) {
    const ppRow = Math.floor(ppIdx / 4);
    const ppCol = ppIdx % 4;
    makePP5Cup145ml(ctx, 'pp5_cup_' + pad2(ppIdx + 1), false, -17.05 + ppCol * 0.12, 1.02, -12.35 + ppRow * 0.35);
  }

  // Estantes Porta-Pallet & Estoque do Deposito
  addStoragePortaPalletRack(ctx, -23.05, 8.0, 7.6, 0.86, Math.PI / 2);
  addStoragePortaPalletRack(ctx, -19.2, 3.05, 5.4, 0.86, 0);
  addStoragePortaPalletRack(ctx, -19.8, 12.95, 4.8, 0.86, Math.PI);

  for (let bi = 0; bi < 15; bi++) {
    const bRow = Math.floor(bi / 8);
    const bCol = bi % 8;
    makeSpawnBag1500(ctx, 'spawn_bag_empty_' + pad2(bi + 1), false, -21.4 + bCol * 0.62, 1.118, 2.86 + bRow * 0.36);
  }
  for (let si = 0; si < 4; si++) {
    makeSubstrateBag5kg(ctx, 'substrate_grain_' + pad2(si + 1), 'grain', -21.35 + si * 0.58, 0.438, 3.05);
    makeSubstrateBag5kg(ctx, 'substrate_sawdust_' + pad2(si + 1), 'sawdust', -18.85 + si * 0.58, 0.438, 3.05);
  }
  for (let pIdx = 0; pIdx < 40; pIdx++) {
    const stackIdx = Math.floor(pIdx / 7);
    const stackLvl = pIdx % 7;
    registerPickable(
      ctx,
      'petri_bare_' + pad2(pIdx + 1),
      'Placa de Petri Vazia',
      makePetriDish('bare'),
      -21.3 + stackIdx * 0.56,
      1.798 + stackLvl * PETRI_STACK_SPACING,
      3.05,
      0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT,
      getPetriMeta('bare')
    );
  }
  const pdaBottle2 = registerPickable(ctx, 'pda_bottle_02', 'Pó desidratado BDA/PDA 500g', pdaGroup.clone(), -17.55, 1.798, 3.05, 0, 0.14, 0.31, PDA_BOTTLE_META);
  const pdaBottle3 = registerPickable(ctx, 'pda_bottle_03', 'Pó desidratado BDA/PDA 500g', pdaGroup.clone(), -17.15, 1.798, 3.05, 0, 0.14, 0.31, PDA_BOTTLE_META);
  attachPdaReagentCtrl(pdaBottle2);
  attachPdaReagentCtrl(pdaBottle3);

  for (let ji = 0; ji < 15; ji++) {
    const jRow = Math.floor(ji / 8);
    const jCol = ji % 8;
    makeSpawnJar800(ctx, 'spawn_jar_empty_' + pad2(ji + 1), false, -23.22 + jRow * 0.34, 1.118, 4.75 + jCol * 0.85);
  }
  for (let gi = 0; gi < 3; gi++) {
    makeGlovesBox(ctx, 'gloves_box_' + pad2(gi + 1), -23.05, 0.438, 4.9 + gi * 0.65);
    makeFoilRoll(ctx, 'foil_roll_' + pad2(gi + 1), -23.05, 0.438, 7.2 + gi * 0.65);
  }
  makeAlcoholSprayBottle(ctx, 'alcohol_spray_02', -23.05, 0.438, 9.8);
  makeAlcoholSprayBottle(ctx, 'alcohol_spray_03', -23.05, 0.438, 10.4);
  for (let mi = 0; mi < 4; mi++) {
    makeTapeRoll(ctx, 'micropore_' + pad2(mi + 1), 'micropore', -23.05, 1.798, 4.8 + mi * 0.45);
  }
  for (let pfi = 0; pfi < 3; pfi++) {
    makeTapeRoll(ctx, 'parafilm_' + pad2(pfi + 1), 'parafilm', -23.05, 1.798, 7.1 + pfi * 0.45);
  }
  const beakerC = makeBeaker1L(ctx, 'beaker_1l_03', -23.05, 1.798, 9.2, 0);
  const beakerD = makeBeaker1L(ctx, 'beaker_1l_04', -23.05, 1.798, 9.9, 0);
  attachPdaMediumCtrl(beakerC, 'beaker', false);
  attachPdaMediumCtrl(beakerD, 'beaker', false);
  for (let syi = 0; syi < 20; syi++) {
    const sRow = Math.floor(syi / 10);
    const sCol = syi % 10;
    makeSyringe10ml(ctx, 'syringe_10ml_' + pad2(syi + 1), -21.75 + sCol * 0.43, 1.118, 12.78 + sRow * 0.34);
  }

  // ALA LESTE (Direita) — 2 blocos de 2 andares (x: 14..24)
  buildCampusBuildingWing(ctx, { cx: 19, cz: -7, width: 10, depth: 11.6, faceDir: -1, doorLabel: 'Porta de Substratos', doorSign: '🧪 SUBSTRATOS', style: 'brick', connectNorth2F: true, connectSouth2F: true, boardIndex: 2 });
  buildCampusBuildingWing(ctx, { cx: 19, cz: 8, width: 10, depth: 11.6, faceDir: -1, doorLabel: 'Porta da Estufa', doorSign: '🍄 ESTUFA', style: 'wood', connectNorth2F: true, boardIndex: 3 });

  createBanner(scene, 13.85, 5.1, -11.6, -Math.PI / 2, '#0284c7', '🧪');
  createBanner(scene, 13.85, 5.1, 3.6, -Math.PI / 2, '#15803d', '🍄');

  // Equipamentos de Substratos (Leste-Norte): Tripe a Gas + Panela + Base Perfurada
  addMovableStainlessTable(ctx, 'table_sub_east', 'Mesa Inox (Substratos)', 21.2, 0.12, -5.2, 1.5, 0.82, 3.2);
  makeCookerBase(ctx, 'cooker_base_sub', 21.2, 0.94, -5.3);
  makeGasTripodBurner(ctx, 'gas_tripod_sub', 21.2, 0.12, -3.1);
  createPressureCookerPair(ctx, 'pressure_cooker_sub', 'pressure_lid_sub', 'Substrato', 21.2, 0.74, -3.1);

  // Equipamentos da Estufa (Leste-Sul)
  const rack = makeBox(1.6, 0.72, 4.0, 0x1e293b);
  rack.position.set(21.0, 0.14 + 0.36, 8.0);
  scene.add(rack);
  const ledBar = makeBox(0.28, 0.08, 3.6, 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 1.1 });
  ledBar.position.set(21.0, 2.55, 8.0);
  scene.add(ledBar);
  const estufaLight = new THREE.PointLight(0xfef08a, 1.25, 14, 1.35);
  estufaLight.position.set(21.0, 2.45, 8.0);
  scene.add(estufaLight);
  solidColliders.push({ minX: 20.15, maxX: 21.85, minZ: 5.95, maxZ: 10.05, minY: 0.14, maxY: 0.86, surfaceTopY: 0.86 });
  const estufaSurf = { minX: 20.25, maxX: 21.75, minZ: 6.05, maxZ: 9.95, topY: 0.86 };
  supportSurfaces.push(estufaSurf);
  rack.userData.supportSurface = estufaSurf;
  supportMeshes.push(rack);

  buildGreenhouseBench(scene);
}
