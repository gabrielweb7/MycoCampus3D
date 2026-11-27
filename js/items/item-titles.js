const titles = {
  ampoule_case: 'Maleta Porta-Ampolas',
  beaker_1l: 'Béquer de Vidro 1 L',
  beehive_starter: 'Colmeia Inicial',
  water_spray: 'Borrifador de Água Destilada',
  cooker_base: 'Base Perfurada da Panela',
  culture_fridge: 'Geladeira de Culturas',
  delivery_crate: 'Caixa de Transporte',
  dehydrator: 'Desidratadora de Cogumelos',
  dried_batch: 'Cogumelos Desidratados',
  flower_seeds: 'Sementes de Flor',
  gas_tripod: 'Fogareiro a Gás com Tripé',
  gloves_box: 'Caixa de Luvas Nitrílicas',
  heat_sealer: 'Seladora Térmica',
  infrared_thermometer: 'Termômetro Infravermelho',
  lab_microscope: 'Microscópio Óptico',
  lab_spoon: 'Colher Inox de Laboratório',
  lab_trash: 'Lixeira de Laboratório',
  lab_tray: 'Bandeja Inox',
  liquid_culture: 'Frasco para Cultura Líquida 800 ml',
  micropore: 'Fita Micropore',
  monotub_24l: 'Caixa Monotub 24 L',
  mylar_bag: 'Embalagem Mylar para Cogumelos',
  parafilm: 'Rolo de Parafilm',
  paper_towel: 'Papel-toalha',
  pda_bottle: 'Pó BDA/PDA 500 g',
  pda_media_bottle: 'Frasco para Meio PDA 1 L',
  petri_bare: 'Placa de Petri',
  petri_empty: 'Placa de Petri com Meio PDA',
  pp5_cup: 'Copo PP5 145 ml',
  pressure_lid: 'Tampa da Panela 20 L',
  scalpel: 'Bisturi Inox',
  scalpel_blade: 'Sachê de Lâmina de Bisturi',
  silica_jar: 'Pote Hermético com Sílica Gel',
  spawn_bag: 'Saco de Cultivo 1,5 kg',
  spawn_jar: 'Pote de Spawn 800 ml',
  syringe_10ml: 'Seringa 10 ml',
  table_stainless: 'Bancada Inox 1,6 m',
  table_lc_lab: 'Bancada Inox 2 m',
  table_cooker_lab: 'Bancada Inox Dupla 2,4 m',
  table_sub_east: 'Bancada Inox Comprida 3,8 m',
  vial_3ml: 'Ampola de Vidro 5 ml'
};

// Match known world instances to their catalog family without conflating capacities or materials.
const families = [
  [/^table_pack_east$/, 'table_sub_east'],
  [/^table_hood_lab$/, 'table_cooker_lab'],
  [/^burner_lab$/, 'electric_burner'],
  [/^microscope_lab$/, 'lab_microscope'],
  [/^distilled_jug_5l$/, 'distilled_jug'],
  [/^pda_media_bottle_1l$/, 'pda_media_bottle'],
  [/^pressure_lid(?:_|$)/, 'pressure_lid'],
  [/^petri_(?:clean|contam|sterile)(?:_|$)/, 'petri_empty'],
  [/^mushroom_pack_bag(?:_|$)/, 'mylar_bag']
];
const instanceFamilies = new Set([
  'alcohol_lamp', 'alcohol_spray', 'beaker_1l', 'board_eraser', 'chalk_green', 'chalk_white',
  'chalk_yellow', 'cooker_base', 'culture_fridge', 'delivery_crate', 'dehydrator', 'dried_batch',
  'falcon_15ml', 'falcon_50ml', 'falcon_rack', 'flocao_500g', 'foil_roll', 'gas_tripod',
  'gloves_box', 'h2o2_spray', 'heat_sealer', 'infrared_thermometer', 'lab_spoon', 'lab_trash',
  'lab_tray', 'laminar_hood', 'lc_nutrient_bottle', 'liquid_culture', 'magnetic_stirrer',
  'micropore', 'mixing_bowl', 'monotub_24l', 'paper_towel', 'parafilm', 'pda_bottle',
  'petri_bare', 'petri_empty', 'pp5_cup', 'precision_scale', 'pressure_cooker', 'scalpel',
  'scalpel_blade', 'silica_jar', 'spawn_bag', 'spawn_jar', 'syringe_10ml', 'water_spray'
]);

export function getItemFamily(item) {
  const id = item?.meta?.prefabId || item?.mesh?.userData?.prefabId || item?.id || '';
  for (const [pattern, family] of families) {
    if (pattern.test(id)) return family;
  }
  const substrate = id.match(/^substrate_(?:dep_)?(grain|wheat|sorghum|coco|vermiculite|sawdust)(?:_|$)/);
  if (substrate) return 'substrate_' + substrate[1];
  let candidate = id;
  while (candidate) {
    if (instanceFamilies.has(candidate)) return candidate;
    const separator = candidate.lastIndexOf('_');
    if (separator < 0) break;
    candidate = candidate.slice(0, separator);
  }
  return id;
}

export function getCanonicalItemTitle(family) {
  return Object.hasOwn(titles, family) ? titles[family] : '';
}
