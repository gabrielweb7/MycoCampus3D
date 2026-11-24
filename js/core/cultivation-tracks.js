/**
 * Trilhas Guiadas de Autonomia + Calculadora Real de Receitas + Diagnóstico Pedagógico (MycoCampus3D)
 */

export const CULTIVATION_TRACKS = [
  {
    id: 'pf_tek_pp5',
    title: 'Trilha 1 • Iniciante Caseiro (PF-Tek / PP5)',
    level: 'Iniciante',
    speciesHint: 'Golden Teacher, B+ Cubensis, Cambodian',
    summary: 'Ideal para o primeiro cultivo sem fluxo laminar profissional, usando potinho PP5, Flocão de Milho, panela caseira e caixa simples.',
    gameVsReal: 'No jogo: Potinho PP5 + Flocão + Água (35ml) + Esterilizar 1h20 na Panela + Inocular no Fluxo. Na vida real: use 2 partes Vermiculita + 1 parte Arroz Integral moído/Flocão + 1 parte Água, furinhos na tampa com Fita Micropore + Papel Alumínio e panela de pressão 60–90 min; inocule dentro de uma SAB (Still Air Box).',
    steps: [
      'Coloque 45g de Flocão de Milho no Potinho PP5 145ml e hidrate com 35ml de água.',
      'Leve à Panela de Pressão com Base Perfurada (3–4L água) no modo ESTERILIZAR (15 PSI) até 100%.',
      'Ligue o Fluxo Laminar (ou monte sua SAB em casa), higienize 3x com Álcool 70% + Papel Toalha e vista Luvas.',
      'Com a Seringa 10ml com Cultura Líquida (ou Bisturi de esporos), inocule 1ml no PP5 estéril.',
      'Deixe colonizar a 24–27°C até 100% branco e leve para a Estufa ou Monotub 24L.'
    ]
  },
  {
    id: 'grains_monotub',
    title: 'Trilha 2 • Produção em Grãos + Monotub 24L',
    level: 'Intermediário',
    speciesHint: 'Cubensis (Golden Teacher, Penis Envy, Jack Frost)',
    summary: 'Spawn de Milho/Trigo/Sorgo expandido para substrato bulk Coco + Vermiculita pasteurizado rendendo 4 flushs.',
    gameVsReal: 'No jogo: cozinhe grãos 20 min ao dente ou hidrate no vidro/bag, esterilize 15 PSI, faça Break & Shake com 20–30%, prepare Coco + Vermiculita + Água na bacia, pasteurize no bag e misture no Monotub 24L higienizado. Na vida real: escorra muito bem o grão até secar por fora antes de envidraçar/esterilizar 90–120 min; coco + vermiculita pede apenas água fervente em balde fechado ("Bucket Tek" a ~75°C por 6h).',
    steps: [
      'Cozinhe Milho/Trigo/Sorgo 20 min na panela sem tampa (ou hidrate grãos no vidro/bag) e sele o Bag 1,5kg.',
      'Esterilize grãos a 15 PSI (121°C). Use Alumínio na tampa do vidro e nunca pule esterilização (75°C NÃO serve para grãos!).',
      'Inocule com 2.5ml (Vidro) ou 4ml (Bag) de CL no Fluxo Laminar; aos 25% faça Break & Shake.',
      'Misture Vermiculita + Pó de Coco + Água na Bacia com a Colher, passe para Bag e PASTEURIZE (75–85°C • Tecla M).',
      'Higienize Monotub 24L com Álcool + Papel, despeje Spawn + Bulk, misture e nivele; após 100%, borrife Água Destilada (nunca Álcool!) e leve à Estante LED.'
    ]
  },
  {
    id: 'agar_clone_slant',
    title: 'Trilha 3 • Ágar PDA, Clonagem T3 & Slant Master',
    level: 'Avançado',
    speciesHint: 'Qualquer espécie / Híbridos F1 Albino ou Dourado',
    summary: 'Domine carimbos de esporos (T0), isolamento rizomórfico até T3 (+35% biomassa), clonagem de tecido fresco e banco genético a 4°C.',
    gameVsReal: 'No jogo: misture 40g/L de PDA no Béquer, verta no Frasco 1L e esterilize (Pour Tek no Fluxo Laminar!), raspe esporos [T0] ou corte tecido fresco de cogumelo e setorize até T3 e Tubo Slant 15ml na Geladeira 4°C. Na vida real: flambar o bisturi até ficar rubro e resfriar no canto limpo do ágar antes de tocar o tecido interno (nunca a casca externa!) evita contaminação bacteriana.',
    steps: [
      'Prepare PDA/BDA na proporção 40g/L no Béquer com Água Destilada e agite na Placa Magnética.',
      'Esterilize o Frasco 1L de PDA a 15 PSI (121°C) e verta 20ml em Petris ou Tubos Falcon 15ml (Pour Tek) dentro do Fluxo Laminar.',
      'Com Bisturi flambado e frio, transfira esporos [T0] ou biópsia do cogumelo fresco para gerar micélio T1 → T2 → T3 ⭐.',
      'Guarde a cultura pura T3 em Tubo Slant 15ml na Geladeira (4°C) por meses ou faça cruzamentos híbridos em Petri.'
    ]
  },
  {
    id: 'gourmet_sawdust_lc',
    title: 'Trilha 4 • Gourmet (Serragem) & Cultura Líquida 4%',
    level: 'Especialista',
    speciesHint: 'Juba de Leão, Shimeji, Shiitake, Reishi, Eryngii',
    summary: 'Cultive cogumelos medicinais e gastronômicos em Serragem de Eucalipto suplementada e multiplique micélio no caldo 4% de Malte/Mel.',
    gameVsReal: 'No jogo: misture Água + 🍯 Extrato de Malte/Mel (4g/100ml) no Frasco LC 800ml, esterilize a 121°C, inocule e misture na placa magnética; use Serragem de Eucalipto + Água na bacia para blocos gourmet. Na vida real: não ultrapasse 4% de açúcar na CL nem cozinhe mais que 25–30 min a 15 PSI para não caramelizar os açúcares; madeiras de eucalipto/carvalho precisam de alta umidade (88–95%) e boa troca de ar (FAE < 750 ppm CO₂).',
    steps: [
      'Encha o Frasco LC 800ml com Água Destilada, adicione 4% de Extrato de Malte/Mel (ex.: 16g p/ 400ml) e esterilize a 15 PSI.',
      'No Fluxo Laminar, inocule um pedaço de Ágar T2/T3 ou 2ml de Ampola no caldo estéril já frio e agite suavemente 1x ao dia.',
      'Hidrate Serragem de Eucalipto + Água no Pote de Mistura com a Colher e porcione na Bag 1,5kg filtrada.',
      'Pasteurize/Esterilize o bloco, inocule com Spawn de Grãos ou CL, aguarde 100% e frutifique na Estufa Inteligente.'
    ]
  }
];

export function calculateRealWorldRecipe(kind, rawAmount) {
  const amt = Math.max(1, Number(rawAmount) || 500);
  if (kind === 'pda') {
    const waterMl = amt;
    const scale = waterMl / 1000;
    const totalPowderG = Math.round(scale * 40 * 10) / 10;
    return {
      title: `Meio Ágar PDA/BDA para ${waterMl} ml de água`,
      items: [
        `💧 Água destilada ou filtrada: ${waterMl} ml`,
        `🧪 Mix PDA pronto (ou separado): ${totalPowderG} g no total (40g/L)`,
        `🥔 Extrato/infusão de batata seca: ${(Math.round(scale * 4 * 10) / 10)} g • 🍬 Dextrose: ${(Math.round(scale * 20 * 10) / 10)} g • 🌿 Ágar-Ágar: ${(Math.round(scale * 16 * 10) / 10)} g`
      ],
      note: `Rende ~${Math.max(1, Math.floor(waterMl / 20))} placas de Petri (20 ml cada). Esterilize 20–30 min a 15 PSI (121°C).`
    };
  }
  if (kind === 'lc') {
    const waterMl = amt;
    const nutrientG = Math.round(waterMl * 0.04 * 10) / 10;
    return {
      title: `Cultura Líquida 4% para ${waterMl} ml de água`,
      items: [
        `💧 Água destilada (sem cloro): ${waterMl} ml`,
        `🍯 Extrato de Malte Claro ou Mel Orgânico (4%): ${nutrientG} g`,
        `🔩 Coloque barra magnética / bolinha de vidro para quebrar o micélio ao agitar`
      ],
      note: 'Acima de 4–5% de açúcar o micélio sofre estresse osmótico; esterilize no máximo 25–30 min a 15 PSI para não caramelizar.'
    };
  }
  if (kind === 'cvg') {
    const cocoDryG = amt;
    const vermG = cocoDryG;
    const gypsumG = Math.round(cocoDryG * 0.08);
    const boilingWaterMl = Math.round(cocoDryG * 4.8);
    return {
      title: `Substrato CVG em Capacidade de Campo (${cocoDryG} g Coco seco)`,
      items: [
        `🥥 Fibra / Pó de Coco seco: ${cocoDryG} g`,
        `✨ Vermiculita expandida: ${vermG} g`,
        `🪨 Gesso agrícola (opcional, evita empastamento): ${gypsumG} g`,
        `🔥 Água fervente p/ pasteurização (Bucket Tek): ${boilingWaterMl} ml (~${(boilingWaterMl / 1000).toFixed(1)} L)`
      ],
      note: 'Capacidade de campo: ao espremer com a mão deve pingar apenas 1–2 gotas, nunca escorrer um fio contínuo de água.'
    };
  }
  const spawnGrams = amt;
  const bulkGrams = spawnGrams * 2;
  const monotubs = Math.max(1, Math.round((spawnGrams + bulkGrams) / 2200 * 10) / 10);
  return {
    title: `Montagem Monotub Proporção 1:2 (${spawnGrams} g de Spawn)`,
    items: [
      `🌾 Spawn 100% colonizado (Grãos): ${spawnGrams} g`,
      `🥥 Substrato Bulk Pasteurizado (1:2): ${bulkGrams} g`,
      `📦 Volume ideal estimado: ~${monotubs} caixa(s) padrão`
    ],
    note: 'Proporção 1:2 equilibra velocidade de colonização (7–12 dias) e alta retenção hídrica para 3–4 flushs.'
  };
}

export function diagnoseItemPedagogy(item) {
  if (!item) return null;
  const sp = item.spawnCtrl;
  const pc = item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  const cc = item.cultureCtrl || (item.mesh && item.mesh.userData && item.mesh.userData.cultureCtrl);
  const mc = item.monotubCtrl;

  const contamKind = (sp && sp.contaminated && sp.contamKind) ||
    (pc && (pc.contaminated || pc.mode === 'contam') && pc.contamKind) ||
    (cc && cc.contaminated && cc.contamKind) ||
    (mc && mc.contaminated && mc.contamKind) || '';

  if (contamKind) {
    const guides = {
      trichoderma: ['Mofo Verde (Trichoderma)', 'Esporos aéreos ou caixa/substrato sem assepsia', 'Higienize a caixa 3x com Álcool 70% + Papel Toalha e trabalhe dentro do Fluxo/SAB fechado.'],
      cobweb: ['Mofo Teia (Cobweb)', 'Ar parado + umidade excessiva na superfície', 'Aplique Água Oxigenada 3% (H₂O₂) para dissolver rápido e melhore a troca gasosa (FAE).'],
      wet_spot: ['Mancha Úmida (Bacillus)', 'Excesso de água livre no grão ou seringa suja', 'Escorra o grão cozido por completo antes de colocar nos vidros/bags e esterilize 90–120 min.'],
      penicillium: ['Penicillium Azul-Esverdeado', 'Falha de vedação no ágar ou tampas mal fechadas', 'Use Parafilm/Micropore na placa fechada e só abra dentro do Fluxo Laminar ligado.'],
      aspergillus: ['Aspergillus Negro/Amarelo', 'Temperatura alta (>28°C) + falta de filtragem', 'Mantenha incubação em 23–26°C e nunca abra placas contaminadas dentro do laboratório.'],
      lipstick: ['Mofo Batom (Sporendonema)', 'Substrato bulk ou casing usado CRU sem pasteurizar', 'Pasteurize Coco + Vermiculita a 75–85°C antes de montar o Monotub!']
    };
    const [status, cause, realWorldTip] = guides[contamKind] || ['Contaminação Microbiana', 'Falha de esterilização ou assepsia na transferência', 'Garanta 15 PSI (121°C) em grãos/ágar e manipule só com luvas e Fluxo/SAB higienizados.'];
    return { level: 'danger', status, cause, realWorldTip };
  }

  if ((sp && sp.burned) || (item.pdaMediumCtrl && item.pdaMediumCtrl.burned)) {
    return {
      level: 'danger',
      status: 'Queimado por Falta de Água',
      cause: 'A água da panela secou ou o timer passou do limite com fogo ativo.',
      realWorldTip: 'Use 3–4L na panela, encaixe a Base Perfurada e desligue o fogo ao zerar o timer.'
    };
  }
  if (sp && sp.pasteurizedOnly && !sp.sterilized) {
    return {
      level: 'warn',
      status: 'Substrato Nutritivo Apenas Pasteurizado (75°C)',
      cause: 'Grãos/PDA possuem endósporos bacterianos que resistem a 75–85°C.',
      realWorldTip: 'Pasteurize APENAS substratos bulk pobres (Coco+Vermiculita/Serragem). Grãos exigem 121°C (15 PSI)!'
    };
  }
  if (sp && sp.filled && sp.hydrated === false && (sp.waterMl || 0) < 30 &&
      (sp.substrateKind === 'corn' || sp.substrateKind === 'grain' || sp.substrateKind === 'wheat' || sp.substrateKind === 'sorghum')) {
    return {
      level: 'warn',
      status: 'Grão Seco Sem Hidratação Prévia',
      cause: 'O micélio não consegue digerir grãos 100% secos (colonização trava em ~15%).',
      realWorldTip: 'Ferva por 20 min ou hidrate com água antes de fechar e ir à panela de pressão.'
    };
  }
  if (cc && item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl && item.mesh.userData.liquidCtrl.volMl > 0 && cc.hasNutrient === false && !cc.inoculated) {
    return {
      level: 'warn',
      status: 'Água Pura Sem Nutriente (0% Carboidrato)',
      cause: 'Cultura líquida sem fonte de açúcar não alimenta o crescimento micelial.',
      realWorldTip: 'Adicione 4% de 🍯 Extrato de Malte/Mel (4g por 100ml) e esterilize a 15 PSI antes de inocular.'
    };
  }
  if (sp && sp.expired || pc && pc.expired || cc && cc.expired) {
    return {
      level: 'warn',
      status: 'Cultura Vencida por Idade',
      cause: 'Substrato/ágar armazenado em temperatura ambiente por muito tempo.',
      realWorldTip: 'Culturas puras (Petri, Slant 15ml, CL, Ampola) duram até 6x mais na Geladeira a 4°C!'
    };
  }
  return {
    level: 'ok',
    status: 'Parâmetros Assépticos Saudáveis',
    cause: 'Condições adequadas de cultivo.',
    realWorldTip: 'Respeite sempre: 15 PSI para grãos/ágar, 75–85°C para bulk e Água Destilada (não álcool) no micélio vivo.'
  };
}
