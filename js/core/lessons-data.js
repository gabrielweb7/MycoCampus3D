/**
 * MycoCampus3D — Dados Pedagógicos dos 5 Módulos de Micologia
 */
export const LESSONS = [
  {
    slug: 'fluxo_laminar',
    title: 'Fluxo Laminar & Técnica Asséptica',
    subtitle: 'Módulo 1 • Trabalho Limpo em Laboratório',
    bullets: [
      '• Filtro HEPA H14 retém 99,995% das partículas (>= 0,3 µm).',
      '• Nunca passe a mão entre o filtro e a placa aberta.',
      '• Higienize bancada com Álcool 70% e flambe o bisturi fora do fluxo.'
    ],
    question: 'Qual a regra de ouro ao trabalhar na cabine de fluxo laminar?',
    options: [
      { text: 'Nunca bloquear a linha reta entre o filtro HEPA e o material estéril', ok: true },
      { text: 'Usar ventilador comum virado para a placa aberta', ok: false },
      { text: 'Flambar o bisturi com álcool dentro da placa de Petri', ok: false }
    ]
  },
  {
    slug: 'esterilizacao',
    title: 'Esterilização vs Pasteurização',
    subtitle: 'Módulo 2 • Autoclave & Panela de Pressão',
    bullets: [
      '• Esterilização (121°C / 15 PSI por 60-90 min): elimina 100% dos esporos em grãos/ágar.',
      '• Pasteurização (65°C - 80°C por 60 min): reduz competidores em palha/coco mantendo microflora benéfica.',
      '• Nunca esterilize substrato bulk rico se for frutificar em ambiente não-estéril.'
    ],
    question: 'Qual temperatura/pressão padrão esteriliza potes de grãos e meios BDA na autoclave?',
    options: [
      { text: '121°C a 15 PSI (1 atm acima da pressão ambiente)', ok: true },
      { text: '50°C por 10 minutos sem pressão', ok: false },
      { text: 'Congelamento a -18°C por 24 horas', ok: false }
    ]
  },
  {
    slug: 'spawn_graos',
    title: 'Grãos, Spawn & Cultura Líquida (CL)',
    subtitle: 'Módulo 3 • Propagação de Micélio',
    bullets: [
      '• Grãos (aveia, milho, sorgo, centeio) dão energia e muitos pontos de inoculação.',
      '• Hidrate e seque superficialmente os grãos antes de autoclavar (evita wet spot).',
      '• Cultura Líquida (4% mel/malte) acelera a colonização, mas exige teste prévio em ágar!'
    ],
    question: 'Por que devemos testar a Cultura Líquida em placa de Petri (ágar) antes de inocular vários potes?',
    options: [
      { text: 'Para confirmar que o micélio está puro e sem contaminação invisível', ok: true },
      { text: 'Para mudar a cor do cogumelo na colheita', ok: false },
      { text: 'Não precisa testar, cultura líquida nunca contamina', ok: false }
    ]
  },
  {
    slug: 'contaminacao',
    title: 'Identificando Contaminações',
    subtitle: 'Módulo 4 • Tricoderma, Cobweb & Bactérias',
    bullets: [
      '• Tricoderma: começa branco denso e fica verde-esmeralda ao esporular. Isole fora do lab!',
      '• Cobweb (teia): cinza algodonoso crescendo muito rápido por cima; sensível a H2O2 3%.',
      '• Bactéria (Wet Spot): grãos melados/úmidos com cheiro ácido/fermentado.'
    ],
    question: 'O que fazer imediatamente ao encontrar uma placa ou pote com esporos verdes de Tricoderma?',
    options: [
      { text: 'Manter fechado e remover do laboratório para não espalhar esporos', ok: true },
      { text: 'Abrir dentro do fluxo laminar e assoprar para limpar', ok: false },
      { text: 'Misturar com os potes saudáveis para o micélio vencer', ok: false }
    ]
  },
  {
    slug: 'frutificacao',
    title: 'Substratos, Bulk & Frutificação',
    subtitle: 'Módulo 5 • Gatilhos de Pinagem (FAE, Umidade & Luz)',
    bullets: [
      '• Misture spawn 100% colonizado com substrato bulk (fibra de coco + vermiculita) na proporção 1:2 a 1:4.',
      '• Gatilhos de pinagem: queda leve de CO2 (troca gasosa/FAE), evaporação superficial e luz indireta.',
      '• Mantenha umidade relativa entre 85% e 95% sem encharcar os pins.'
    ],
    question: 'Quais são os principais gatilhos ambientais para induzir a formação de primórdios (pins)?',
    options: [
      { text: 'Troca gasosa fresca (redução de CO2), evaporação na superfície e luz ambiente', ok: true },
      { text: 'Escuridão total e lacrar a caixa sem entrada de ar', ok: false },
      { text: 'Aquecer a estufa para 40°C constantes', ok: false }
    ]
  }
];
