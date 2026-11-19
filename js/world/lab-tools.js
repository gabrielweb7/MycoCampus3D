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
import { buildLaminarHoodAndBenches, addWallLabBench } from '../items/laminar-hood.js';
import { createPressureCookerPair, makeElectricBurner } from '../items/pressure-cooker.js';
import { makePetriDish, getPetriMeta, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, PETRI_STACK_SPACING } from '../items/petri-dish.js';
import { makeCultureFridge } from '../items/culture-fridge.js';
import { createPdaBottleGroup, PDA_BOTTLE_META } from '../items/pda-bottle.js';
import { attachPdaMediumCtrl, attachPdaReagentCtrl, makePdaMediaBottle1L } from '../items/pda-mix.js';
import { makeSpawnJar800, makeSpawnBag1500 } from '../items/spawn-containers.js';
import { createPrecisionScale } from '../items/precision-scale.js';
import { makeAlcoholSprayBottle } from '../items/alcohol-spray.js';
import { makePaperTowelRoll } from '../items/paper-towel.js';
import { buildLabTrashBin } from '../items/lab-trash.js';
import { createHeatSealer } from '../items/heat-sealer.js';
import { makeLiquidJar800, makeBeaker1L } from '../items/liquid-culture.js';
import { makeMagneticStirrer } from '../items/magnetic-stirrer.js';
import { makeDehydrator } from '../items/dehydrator.js';
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
import { makeMonotub24L, buildMonotubLedRack } from '../items/monotub.js';
import { buildCampusVegetableGarden } from './campus-garden.js';
import {
  makeAlcoholLamp,
  makeLabMicroscope,
  makeSilicaStorageJar,
  makeDriedMushroomBatch
} from '../items/lab-advanced-tools.js';
import {
  makeMushroomBag,
  makeDeliveryCrate,
  buildRoadsideMushroomStand
} from '../items/dehydration-packaging.js';

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

  // Bancadas, Estante e Capela de Fluxo Laminar
  buildLaminarHoodAndBenches(ctx);

  // Autoclave, Base Perfurada & Fogareiro
  addMovableStainlessTable(ctx, 'table_cooker_lab', 'Mesa Inox (Autoclave/Spawn)', -18.5, 0.12, -5.0, 1.5, 0.85, 2.4);
  makeElectricBurner(ctx, 'burner_lab', -18.5, 0.97, -4.6);
  createPressureCookerPair(ctx, 'pressure_cooker_lab', 'pressure_lid_lab', 'Lab', -18.5, 1.058, -4.6);
  makeCookerBase(ctx, 'cooker_base_lab', -18.5, 0.97, -5.5);

  // Pia Inox com Torneira + Garrafao 5L Agua Destilada
  buildLabSink(ctx, -23.15, 1.02, -10.8);
  makeDistilledJug5L(ctx, 'distilled_jug_5l', -21.95, 1.02, -11.9, 5000);
  makeCultureFridge(ctx, 'culture_fridge_lab', -15.55, 0.12, -10.7);

  // Mesa de Cultura Liquida & Placas de Petri (Organizada e sem excessos!)
  addMovableStainlessTable(ctx, 'table_lc_lab', 'Mesa Inox (Cultura Líquida)', -20.5, 0.12, -10.6, 2.0, 0.79, 1.0);
  registerPickable(ctx, 'petri_clean', 'Placa de Petri (Micélio Rizomórfico)', makePetriDish('clean'), -18.38, 1.065, -8.62, 0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, getPetriMeta('clean'));
  registerPickable(ctx, 'petri_clean_02', 'Placa de Petri (Micélio Rizomórfico)', makePetriDish('clean'), -18.38, 1.065, -8.42, 0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, getPetriMeta('clean'));
  registerPickable(ctx, 'petri_clean_fridge', 'Placa de Petri (Micélio Rizomórfico)', makePetriDish('clean'), -15.35, 1.22, -10.66, 0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, getPetriMeta('clean'));
  registerPickable(ctx, 'petri_contam', 'Placa Contaminada (Mofo/Bactéria)', makePetriDish('contam'), -18.3, 0.78, -1.85, 0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, getPetriMeta('contam'));
  registerPickable(ctx, 'petri_empty', 'Placa de Petri Estéril (PDA)', makePetriDish('empty'), -19.2, 1.34, -1.85, 0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, getPetriMeta('empty'));
  for (let pse = 0; pse < 4; pse++) {
    registerPickable(ctx, 'petri_sterile_hood_' + pad2(pse + 1), 'Placa de Petri Estéril (PDA)', makePetriDish('empty'), -18.18, 1.065, -7.80 - pse * 0.16, 0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, getPetriMeta('empty'));
  }
  registerPickable(ctx, 'petri_sterile_fridge_01', 'Placa de Petri Estéril (PDA)', makePetriDish('empty'), -15.65, 1.22, -10.66, 0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, getPetriMeta('empty'));
  registerPickable(ctx, 'petri_sterile_fridge_02', 'Placa de Petri Estéril (PDA)', makePetriDish('empty'), -15.50, 1.22, -10.66, 0, PETRI_DISH_RADIUS, PETRI_DISH_HEIGHT, getPetriMeta('empty'));

  // Frasco PDA 500g
  const pdaGroup = createPdaBottleGroup();
  const pdaBottle = registerPickable(ctx, 'pda_bottle', 'Pó desidratado BDA/PDA 500g', pdaGroup, -19.6, 1.02, -12.0, 0, 0.15, 0.34, PDA_BOTTLE_META);
  attachPdaReagentCtrl(pdaBottle);

  // Spawn Colonizado, Substrato, Balança, Borrifadores, Papel Toalha & Seladoras (Cada item no seu lugar exato!)
  makeSpawnJar800(ctx, 'spawn_jar', true, -23.1, 1.02, -4.5);
  makeSpawnJar800(ctx, 'spawn_jar_colonized_02', true, -23.1, 1.02, -4.1);
  makeSpawnJar800(ctx, 'spawn_jar_empty', false, -23.1, 1.02, -3.7);
  makeSpawnBag1500(ctx, 'spawn_bag_colonized', true, -23.1, 1.02, -8.25);
  makeSpawnBag1500(ctx, 'spawn_bag_colonized_02', true, -22.8, 1.02, -8.25);
  makeSpawnBag1500(ctx, 'spawn_bag_empty', false, -23.1, 1.02, -7.65);
  createPrecisionScale(ctx, 'precision_scale', -23.1, 1.02, -9.65);
  makeMixingBowl(ctx, 'mixing_bowl_01', -23.1, 1.02, -10.15);
  makeLabSpoon(ctx, 'lab_spoon_01', -23.1, 1.02, -10.42);
  makeAlcoholSprayBottle(ctx, 'alcohol_spray', -22.85, 1.02, -7.1);
  makeAlcoholSprayBottle(ctx, 'alcohol_spray_lab_03', -17.20, 1.02, -12.00);
  makeAlcoholSprayBottle(ctx, 'alcohol_spray_lab_04', -20.20, 0.91, -10.18);
  makePaperTowelRoll(ctx, 'paper_towel_01', -22.85, 1.02, -7.45);
  makePaperTowelRoll(ctx, 'paper_towel_lab_03', -16.85, 1.02, -12.00);
  makePaperTowelRoll(ctx, 'paper_towel_lab_04', -19.85, 0.91, -10.18);
  makeGlovesBox(ctx, 'gloves_box_lab_01', -17.60, 1.02, -12.00);
  makeGlovesBox(ctx, 'gloves_box_lab_02', -22.85, 1.02, -6.75);
  createHeatSealer(ctx, 'heat_sealer', -23.1, 1.02, -6.2);
  buildLabTrashBin(ctx, -17.3, 0, -9.2);

  // Agitador, Culturas Liquidas Saudaveis, Bequeres, Bandejas, Seringas & Termometros (Bem alinhados na mesa!)
  makeMagneticStirrer(ctx, 'magnetic_stirrer', -20.95, 0.91, -10.55);
  const lc1 = makeLiquidJar800(ctx, 'liquid_culture', -20.95, 1.015, -10.59, 350);
  if (lc1 && lc1.cultureCtrl) lc1.cultureCtrl.colonized = true;
  const lc2 = makeLiquidJar800(ctx, 'liquid_culture_02', -15.72, 0.46, -10.66, 500);
  if (lc2 && lc2.cultureCtrl) lc2.cultureCtrl.colonized = true;
  const lc3 = makeLiquidJar800(ctx, 'liquid_culture_03', -21.25, 0.91, -10.40, 420);
  if (lc3 && lc3.cultureCtrl) lc3.cultureCtrl.colonized = true;
  makePdaMediaBottle1L(ctx, 'pda_media_bottle_1l', -21.30, 0.91, -10.55);
  const beakerA = makeBeaker1L(ctx, 'beaker_1l_a', -20.42, 0.91, -10.55, 0);
  const beakerB = makeBeaker1L(ctx, 'beaker_1l_b', -20.08, 0.91, -10.55, 500);
  attachPdaMediumCtrl(beakerA, 'beaker', false);
  attachPdaMediumCtrl(beakerB, 'beaker', false);
  makeLabTray(ctx, 'lab_tray_01', 'Bandeja Inox Cirúrgica', -19.70, 0.91, -10.57);
  makeLabTray(ctx, 'lab_tray_02', 'Bandeja Inox (Fluxo)', -18.35, 1.065, -8.12);
  makeLabTray(ctx, 'lab_tray_03', 'Bandeja Inox (Preparo)', -20.42, 0.91, -10.18);
  makeSyringe10ml(ctx, 'syringe_10ml_a', -19.70, 0.918, -10.50);
  makeSyringe10ml(ctx, 'syringe_10ml_b', -19.70, 0.918, -10.64);
  makeSyringe10ml(ctx, 'syringe_10ml_c', -19.58, 0.918, -10.50);
  makeSyringe10ml(ctx, 'syringe_10ml_d', -19.58, 0.918, -10.64);
  makeInfraredThermometer(ctx, 'infrared_thermometer', -20.0, 0.91, -10.2);
  makeInfraredThermometer(ctx, 'infrared_thermometer_02', -22.78, 1.02, -10.05);

  // Estante azul + Tubos Falcon 15ml (azul) e 50ml (laranja) sobre a bancada norte fixa (y = 1.02)
  makeFalconRack(ctx, -20.50, 1.02, -12.00);
  const falcon15a = makeFalconTube(ctx, 'falcon_15ml_01', 15, -20.56, 1.03, -12.04, 0);
  const falcon15b = makeFalconTube(ctx, 'falcon_15ml_02', 15, -20.51, 1.03, -12.04, 10);
  const falcon15c = makeFalconTube(ctx, 'falcon_15ml_03', 15, -20.46, 1.03, -12.04, 0);
  const falcon15d = makeFalconTube(ctx, 'falcon_15ml_04', 15, -20.41, 1.03, -12.04, 0);
  const falcon50a = makeFalconTube(ctx, 'falcon_50ml_01', 50, -20.55, 1.03, -11.95, 0);
  const falcon50b = makeFalconTube(ctx, 'falcon_50ml_02', 50, -20.45, 1.03, -11.95, 35);
  [falcon15a, falcon15b, falcon15c, falcon15d].forEach((item) => attachPdaMediumCtrl(item, 'falcon', true));
  [falcon50a, falcon50b].forEach((item) => attachPdaMediumCtrl(item, 'falcon', false));

  // Bisturi Inox, Saches de Lamina #24, Lamparina a Alcool, Microscópio (na Bancada Norte!), Potes de Sílica & Flocão
  makeScalpel(ctx, 'scalpel_01', -18.32, 1.065, -8.92);
  for (let bpi = 0; bpi < 3; bpi++) {
    makeScalpelBladePack(ctx, 'scalpel_blade_' + pad2(bpi + 1), -18.18 + bpi * 0.045, 1.065, -8.92);
  }
  makeAlcoholLamp(ctx, 'alcohol_lamp_hood', -18.62, 1.065, -8.86);
  makeLabMicroscope(ctx, 'microscope_lab', -18.45, 1.02, -12.00);
  makeSilicaStorageJar(ctx, 'silica_jar_01', -22.85, 1.02, -9.25, {
    storedGrams: 50,
    speciesName: 'Golden Teacher (Psilocybe cubensis)'
  });
  makeSilicaStorageJar(ctx, 'silica_jar_02', -22.85, 1.02, -8.98, {
    storedGrams: 20,
    speciesName: 'B+ Cubensis'
  });
  makeSilicaStorageJar(ctx, 'silica_jar_03', -23.22, 1.02, -9.25, {
    storedGrams: 0
  });
  makeSilicaStorageJar(ctx, 'silica_jar_04', -23.22, 1.02, -8.98, {
    storedGrams: 0
  });
  makeDriedMushroomBatch(ctx, 'dried_batch_demo', 'Golden Teacher (Psilocybe cubensis)', -22.85, 1.02, -8.68);
  makeDriedMushroomBatch(ctx, 'dried_batch_demo_02', 'B+ Cubensis', -23.22, 1.02, -8.68);
  makeFlocao500g(ctx, 'flocao_500g_01', -23.10, 1.02, -5.30);
  makeFlocao500g(ctx, 'flocao_500g_02', -23.10, 1.02, -5.05);
  makeFlocao500g(ctx, 'flocao_500g_03', -23.10, 1.02, -4.80);
  makeFlocao500g(ctx, 'flocao_500g_04', -22.85, 1.02, -5.18);
  for (let ppIdx = 0; ppIdx < 4; ppIdx++) {
    makePP5Cup145ml(ctx, 'pp5_cup_' + pad2(ppIdx + 1), false, -18.58 + ppIdx * 0.13, 1.065, -7.35);
  }

  // Itens extras organizados dentro das Gavetas e Armarios do Lab (Bancada Norte)
  makeScalpel(ctx, 'scalpel_02', -20.42, 0.810, -11.72);
  for (let bpi2 = 0; bpi2 < 4; bpi2++) {
    makeScalpelBladePack(ctx, 'scalpel_blade_' + pad2(bpi2 + 5), -20.28 + bpi2 * 0.05, 0.810, -11.72);
  }
  makeTapeRoll(ctx, 'parafilm_lab_01', 'parafilm', -17.75, 0.460, -11.72);
  makeTapeRoll(ctx, 'parafilm_lab_02', 'parafilm', -17.60, 0.460, -11.72);
  makeTapeRoll(ctx, 'micropore_lab_01', 'micropore', -17.45, 0.460, -11.72);
  makeScalpel(ctx, 'scalpel_03', -17.78, 0.646, -11.72);
  makeScalpel(ctx, 'scalpel_04', -17.68, 0.646, -11.72);
  makeScalpelBladePack(ctx, 'scalpel_blade_09', -17.56, 0.646, -11.72);
  makeScalpelBladePack(ctx, 'scalpel_blade_10', -17.48, 0.646, -11.72);
  const beakerLab3 = makeBeaker1L(ctx, 'beaker_1l_lab_03', -19.64, 0.60, -11.95, 0);
  attachPdaMediumCtrl(beakerLab3, 'beaker', false);
  const pdaBottleLab2 = registerPickable(ctx, 'pda_bottle_lab_02', 'Pó desidratado BDA/PDA 500g', pdaGroup.clone(), -19.42, 0.60, -11.95, 0, 0.15, 0.34, PDA_BOTTLE_META);
  attachPdaReagentCtrl(pdaBottleLab2);
  for (let ppEx = 0; ppEx < 4; ppEx++) {
    makePP5Cup145ml(ctx, 'pp5_cup_' + pad2(ppEx + 9), false, -16.92 + ppEx * 0.13, 0.60, -11.95);
  }
  makeAlcoholSprayBottle(ctx, 'alcohol_spray_lab_02', -16.75, 0.245, -11.95);
  makePaperTowelRoll(ctx, 'paper_towel_lab_02', -16.50, 0.245, -11.95);
  // 4 colheres extras e 6 seringas extras nas gavetas do Lab
  for (let lsp = 0; lsp < 4; lsp++) {
    makeLabSpoon(ctx, 'lab_spoon_' + pad2(lsp + 2), -20.52 + lsp * 0.12, 0.635, -11.72);
  }
  for (let lsy = 0; lsy < 6; lsy++) {
    const sr = Math.floor(lsy / 3);
    const sc = lsy % 3;
    makeSyringe10ml(ctx, 'syringe_10ml_lab_' + pad2(lsy + 1), -20.52 + sc * 0.14, 0.460, -11.65 - sr * 0.16);
  }
  // 5 bacias extras nos armarios (6 bacias no total no Lab)
  makeMixingBowl(ctx, 'mixing_bowl_02', -18.55, 0.245, -11.95);
  makeMixingBowl(ctx, 'mixing_bowl_03', -18.20, 0.245, -11.95);
  makeMixingBowl(ctx, 'mixing_bowl_04', -18.55, 0.60, -11.95);
  makeMixingBowl(ctx, 'mixing_bowl_05', -18.20, 0.60, -11.95);
  makeMixingBowl(ctx, 'mixing_bowl_06', -17.02, 0.245, -11.95);
  // 8 frascos de cultura liquida vazios nos armarios do Lab (afastados da divisoria)
  for (let lca = 0; lca < 6; lca++) {
    const lcCol = lca % 3;
    const lcRow = Math.floor(lca / 3);
    makeLiquidJar800(ctx, 'liquid_culture_empty_cab_' + pad2(lca + 1), -19.62 + lcCol * 0.18, 0.245, -12.04 + lcRow * 0.20, 0);
  }
  makeLiquidJar800(ctx, 'liquid_culture_empty_cab_07', -19.20, 0.60, -12.04, 0);
  makeLiquidJar800(ctx, 'liquid_culture_empty_cab_08', -19.20, 0.60, -11.84, 0);

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
    makeSubstrateBag5kg(ctx, 'substrate_wheat_' + pad2(si + 1), 'wheat', -21.35 + si * 0.58, 1.118, 3.05);
    makeSubstrateBag5kg(ctx, 'substrate_sorghum_' + pad2(si + 1), 'sorghum', -18.85 + si * 0.58, 1.118, 3.05);
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
  makeAlcoholSprayBottle(ctx, 'alcohol_spray_02', -22.78, 0.438, 9.8);
  makeAlcoholSprayBottle(ctx, 'alcohol_spray_03', -22.78, 0.438, 10.4);
  makePaperTowelRoll(ctx, 'paper_towel_02', -22.78, 0.438, 10.1);
  makeDehydrator(ctx, 'dehydrator_lab', -22.9, 1.02, 2.2);
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
  // 10 frascos de cultura liquida vazios no estoque (prateleira superior da estante 3)
  for (let lce = 0; lce < 10; lce++) {
    const eRow = Math.floor(lce / 5);
    const eCol = lce % 5;
    makeLiquidJar800(ctx, 'liquid_culture_empty_stock_' + pad2(lce + 1), -21.65 + eCol * 0.42, 1.798, 12.78 + eRow * 0.34, 0);
  }
  // Bancada & Pia Inox com água corrente no Depósito de Insumos (Sala Oeste-Sul)
  addWallLabBench(ctx, -18.8, 7.6, 2.4, 1.1, {
    hole: { cx: -19.4, cz: 7.6, w: 0.60, d: 0.50 },
    sinkPos: { x: -19.4, z: 7.6 }
  });

  // ALA LESTE (Direita) — 2 blocos de 2 andares (x: 14..24)
  // Leste-Norte: SALA DE DESIDRATAÇÃO, EMBALAGEM & EXPEDIÇÃO (+ Pasteurização e Estante LED de Monotubes)
  buildCampusBuildingWing(ctx, { cx: 19, cz: -7, width: 10, depth: 11.6, faceDir: -1, doorLabel: 'Porta da Sala de Desidratação', doorSign: '♨️ DESIDRATAÇÃO', style: 'brick', connectNorth2F: true, connectSouth2F: true, boardIndex: 2 });
  buildCampusBuildingWing(ctx, { cx: 19, cz: 8, width: 10, depth: 11.6, faceDir: -1, doorLabel: 'Porta da Estufa', doorSign: '🍄 ESTUFA', style: 'wood', connectNorth2F: true, boardIndex: 3 });

  createBanner(scene, 13.85, 5.1, -11.6, -Math.PI / 2, '#d97706', '♨️');
  createBanner(scene, 13.85, 5.1, 3.6, -Math.PI / 2, '#15803d', '🍄');

  // 1. Bancada Leste (x: 21.8): 6 Desidratadoras para vários jogadores desidratarem cogumelos simultaneamente!
  addMovableStainlessTable(ctx, 'table_sub_east', 'Bancada Inox (6 Desidratadoras 55°C)', 21.8, 0.12, -7.2, 1.3, 0.82, 3.8);
  // Bancada & Pia Inox com água corrente na Sala de Desidratação (parede Norte)
  addWallLabBench(ctx, 19.5, -12.0, 3.4, 1.1, {
    hole: { cx: 18.5, cz: -12.0, w: 0.60, d: 0.50 },
    sinkPos: { x: 18.5, z: -12.0 }
  });
  const dehydCoords = [
    [21.55, -8.55], [22.05, -8.55],
    [21.55, -7.20], [22.05, -7.20],
    [21.55, -5.85], [22.05, -5.85]
  ];
  for (let di = 0; di < dehydCoords.length; di++) {
    const dc = dehydCoords[di];
    const dItem = makeDehydrator(ctx, 'dehydrator_east_' + pad2(di + 1), dc[0], 0.94, dc[1]);
    // As 3 primeiras Desidratadoras já começam com lotes crocantes prontos para vários players retirarem e embalarem!
    if (di < 3 && dItem && dItem.dehydratorCtrl) {
      dItem.dehydratorCtrl.hasMushroom = true;
      dItem.dehydratorCtrl.on = true;
      dItem.dehydratorCtrl.progress = 100;
      dItem.dehydratorCtrl.crisp = true;
      dItem.label = 'Desidratadora de Cogumelos • ✅ Crocante (0% umidade)';
    }
  }

  // 2. Bancada Central da Sala de Desidratação (x: 18.6): Embalagem em Sacos Mylar + 3 Seladoras Térmicas + Balança + Caixas de Entrega!
  addMovableStainlessTable(ctx, 'table_pack_east', 'Bancada Inox (Embalagem, Seladoras & Caixas)', 18.6, 0.12, -7.2, 1.4, 0.82, 3.8);
  createHeatSealer(ctx, 'heat_sealer_east_01', 18.25, 0.94, -8.65);
  createHeatSealer(ctx, 'heat_sealer_east_02', 18.25, 0.94, -7.35);
  createHeatSealer(ctx, 'heat_sealer_east_03', 18.25, 0.94, -6.05);
  createPrecisionScale(ctx, 'precision_scale_east', 18.95, 0.94, -8.65);

  // 4 lotes de 25g de cogumelos crocantes prontos sobre a bancada de embalagem para vários jogadores testarem
  makeDriedMushroomBatch(ctx, 'dried_batch_east_01', 'Golden Teacher (Psilocybe cubensis)', 18.95, 0.94, -8.25);
  makeDriedMushroomBatch(ctx, 'dried_batch_east_02', 'B+ Cubensis', 18.95, 0.94, -8.00);
  makeDriedMushroomBatch(ctx, 'dried_batch_east_03', 'Penis Envy (Psilocybe cubensis)', 18.95, 0.94, -7.75);
  makeDriedMushroomBatch(ctx, 'dried_batch_east_04', 'Cambodian Cubensis', 18.95, 0.94, -7.50);

  // 16 Sacos Mylar/Zip para embalar cogumelos desidratados:
  // - 6 já SELADOS e prontos para pôr na caixa ou vender direto!
  // - 4 já CHEIOS com cogumelos nos saquinhos aguardando só passar na Seladora Térmica!
  // - 6 VAZIOS para encher com os lotes crocantes!
  for (let mbi = 0; mbi < 16; mbi++) {
    const mbRow = Math.floor(mbi / 4);
    const mbCol = mbi % 4;
    const isPreSealed = mbi < 6;
    const isPreFilled = mbi >= 6 && mbi < 10;
    makeMushroomBag(
      ctx,
      'mushroom_pack_bag_' + pad2(mbi + 1),
      18.55 + mbCol * 0.14,
      0.945,
      -7.25 + mbRow * 0.22,
      {
        filled: isPreSealed || isPreFilled,
        sealed: isPreSealed,
        grams: 10,
        speciesName: mbi % 2 === 0 ? 'Golden Teacher' : 'B+ Cubensis'
      }
    );
  }

  // 8 Caixas de Entrega Comercial:
  // - 3 CAIXAS JÁ 100% CHEIAS (4/4 pacotes selados = 🪙 480 MycoCoins cada!) na bancada e no chão prontas para pegar e vender na Estrada!
  // - 1 CAIXA quase cheia (3/4 pacotes) na bancada para testar colocar o 4º saquinho!
  // - 2 CAIXAS VAZIAS na Sala de Desidratação + 2 CAIXAS CHEIAS extras ao lado do Quiosque Drive-Thru na Estrada Sul para teste imediato!
  makeDeliveryCrate(ctx, 'delivery_crate_01', 18.55, 0.94, -5.65, { packsCount: 4 });
  makeDeliveryCrate(ctx, 'delivery_crate_02', 19.00, 0.94, -5.65, { packsCount: 4 });
  makeDeliveryCrate(ctx, 'delivery_crate_03', 18.55, 0.94, -6.10, { packsCount: 4 });
  makeDeliveryCrate(ctx, 'delivery_crate_04', 19.00, 0.94, -6.10, { packsCount: 3 });
  makeDeliveryCrate(ctx, 'delivery_crate_05', 18.55, 0.12, -9.50, { packsCount: 0 });
  makeDeliveryCrate(ctx, 'delivery_crate_06', 19.05, 0.12, -9.50, { packsCount: 0 });
  // 2 Caixas Cheias (4/4 pacotes) já posicionadas na bancada dentro do Empório da Estrada (x: 19.5, z: 32.3) para empilhar/levar às estantes da frente!
  makeDeliveryCrate(ctx, 'delivery_crate_07', 19.5, 0.94, 32.0, { packsCount: 4 });
  makeDeliveryCrate(ctx, 'delivery_crate_08', 19.5, 0.94, 32.6, { packsCount: 4 });

  // 3. Zona Sul da Sala (z: -3.8..-2.2): Tripé a Gás + Panela de Pasteurização + Spawn & Substrato Pasteurizado prontos para múltiplos players!
  makeCookerBase(ctx, 'cooker_base_sub', 21.8, 0.94, -5.35);
  makeGasTripodBurner(ctx, 'gas_tripod_sub', 21.8, 0.12, -3.1);
  createPressureCookerPair(ctx, 'pressure_cooker_sub', 'pressure_lid_sub', 'Substrato', 21.8, 0.74, -3.1);

  // Kits prontos de Spawn 100% Colonizado + Substrato Pasteurizado + Álcool 70% + Papel Toalha na Sala de Desidratação/Monotubs para vários players montarem Monotubs 24L!
  makeSpawnBag1500(ctx, 'spawn_bag_colonized_03', true, 16.5, 0.12, -9.3);
  makeSpawnBag1500(ctx, 'spawn_bag_colonized_04', true, 16.9, 0.12, -9.3);
  const subBag1 = makeSpawnBag1500(ctx, 'spawn_bag_pasteurized_01', true, 17.3, 0.12, -9.3);
  const subBag2 = makeSpawnBag1500(ctx, 'spawn_bag_pasteurized_02', true, 17.7, 0.12, -9.3);
  [subBag1, subBag2].forEach((sb) => {
    if (sb && sb.spawnCtrl) {
      sb.spawnCtrl.substrateKind = 'coco_verm';
      sb.spawnCtrl.baseLabel = 'Bag 1,5kg Substrato (Coco + Vermiculita)';
      sb.spawnCtrl.pasteurized = true;
      sb.spawnCtrl.sterilized = true;
      sb.spawnCtrl.inoculated = false;
      sb.spawnCtrl.colonized = false;
      sb.spawnCtrl.colonization = 0;
      if (sb.spawnCtrl.mycOverlay) sb.spawnCtrl.mycOverlay.visible = false;
      sb.spawnCtrl.updateVisual();
    }
  });
  makeAlcoholSprayBottle(ctx, 'alcohol_spray_east_01', 18.25, 0.94, -5.35);
  makePaperTowelRoll(ctx, 'paper_towel_east_01', 18.55, 0.94, -5.35);

  for (let vi = 0; vi < 4; vi++) {
    makeSubstrateBag5kg(ctx, 'substrate_vermiculite_' + pad2(vi + 1), 'vermiculite', 23.05, 0.12, -9.2 + vi * 0.65);
    makeSubstrateBag5kg(ctx, 'substrate_coco_' + pad2(vi + 1), 'coco', 23.05, 0.12, -6.4 + vi * 0.65);
  }

  // 4. Estante Exclusiva para Monotubes 24L com Luz LED embaixo de cada prateleira (Parede Oeste, z = -3.8 para deixar a porta 100% livre!)
  buildMonotubLedRack(ctx, 15.3, -3.8);

  // 8 Caixas Monotub 24L Transparentes para vários jogadores cultivarem juntos!
  makeMonotub24L(ctx, 'monotub_24l_01', 15.3, 1.80, -4.68, { ry: Math.PI / 2 });
  makeMonotub24L(ctx, 'monotub_24l_02', 15.3, 1.80, -4.09, { ry: Math.PI / 2 });
  makeMonotub24L(ctx, 'monotub_24l_03', 15.3, 0.48, -4.68, {
    ry: Math.PI / 2,
    boxSanitized: true,
    hasSpawn: true,
    hasBulk: true,
    mixed: true,
    leveled: true,
    colonization: 100,
    onLedRack: true,
    rackSlotId: 0,
    fruitingStage: 3,
    flush: 1,
    speciesName: 'Golden Teacher (Psilocybe cubensis)'
  });
  makeMonotub24L(ctx, 'monotub_24l_04', 15.3, 0.48, -4.09, {
    ry: Math.PI / 2,
    boxSanitized: true,
    hasSpawn: true,
    hasBulk: true,
    mixed: true,
    leveled: true,
    colonization: 100,
    onLedRack: true,
    rackSlotId: 1,
    fruitingStage: 2,
    growth: 60,
    flush: 2,
    speciesName: 'B+ Cubensis'
  });
  makeMonotub24L(ctx, 'monotub_24l_05', 15.3, 1.14, -4.68, { ry: Math.PI / 2 });
  makeMonotub24L(ctx, 'monotub_24l_06', 15.3, 1.14, -4.09, { ry: Math.PI / 2 });
  makeMonotub24L(ctx, 'monotub_24l_07', 15.3, 1.14, -3.51, { ry: Math.PI / 2 });
  makeMonotub24L(ctx, 'monotub_24l_08', 15.3, 1.14, -2.92, { ry: Math.PI / 2 });

  // Equipamentos da Estufa Climatizada Inteligente (Leste-Sul) + Bancada e Pia Inox com água (longe do Umidificador!)
  buildGreenhouseBench(scene, ctx);
  addWallLabBench(ctx, 20.6, 2.9, 2.8, 1.0, {
    hole: { cx: 19.8, cz: 2.9, w: 0.60, d: 0.50 },
    sinkPos: { x: 19.8, z: 2.9 }
  });

  // Horta Orgânica Externa com Alfaces, Tomates e Caixa de Substrato / Compostagem (Sul da Estufa)
  buildCampusVegetableGarden(ctx);

  // Quiosque Drive-Thru de Venda de Cogumelos na Estrada Sul + Carros e NPCs Compradores!
  buildRoadsideMushroomStand(ctx);
}
