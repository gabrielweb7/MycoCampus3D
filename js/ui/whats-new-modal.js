/**
 * MycoCampus3D — Modal de Novidades da Atualização (fecha apenas pelos botões)
 * Funciona tanto no PC quanto no Mobile (layout responsivo, touch-action: manipulation).
 */

import { releaseInputForModal } from './dom-helpers.js';

const STORAGE_SEEN_KEY = 'myco_seen_whats_new_v';
const JUST_UPDATED_KEY = 'myco_just_updated_v';

export const RELEASE_NOTES_CATALOG = {
  '2.3.5': {
    title: '✨ Novidades da Atualização v2.3.5',
    subtitle: 'Praça e laboratório renovados',
    items: [
      { icon: '⛲', text: 'A fonte tem um novo modelo e a colisão acompanha a borda redonda.' },
      { icon: '🔬', text: 'Bancadas com mais contraste e novos detalhes na balança e no agitador.' },
      { icon: '🌿', text: 'Tufos de grama agrupados e mãos mais discretas em primeira pessoa.' }
    ]
  },
  '2.3.2': {
    title: '✨ Novidades da Atualização v2.3.2',
    subtitle: 'Progresso, missão e multiplayer',
    items: [
      { icon: '🪙', text: 'Ganhos de MycoCoins aguardam confirmação e podem ser reenviados sem duplicar o crédito.' },
      { icon: '🎯', text: 'A missão indica a próxima etapa, leva ao setor certo e permite tentar receber o prêmio novamente.' },
      { icon: '👥', text: 'A sincronização envia itens e traços em lotes e avisa quando a conexão volta.' }
    ]
  },
  '2.3.1': {
    title: '✨ Novidades da Atualização v2.3.1',
    subtitle: 'Iluminação e cores do campus',
    items: [
      { icon: '☀️', text: 'Luz solar mais quente, reflexos mais suaves e melhor contraste na praça.' },
      { icon: '🎨', text: 'Cores corrigidas nas texturas de piso, tijolo, madeira e água.' }
    ]
  },
  '2.3.0': {
    title: '✨ Novidades da Atualização v2.3.0',
    subtitle: 'Todas as Etapas 100% Funcionais, Trilhas de Autonomia, Borrifador de Água, Slants & Reflexos PBR:',
    items: [
      { icon: '💉', text: 'Seringa 10ml, Pour Tek PDA & Desidratadora Corrigidos: injeção de Cultura Líquida agora preserva espécie/geração e dosa por recipiente (1ml Petri/PP5, 2.5ml Vidro, 4ml Bag); Desidratadora exige cogumelo real e mantém gramas extras T3/Casing até a venda VIP; Pour Tek estéril liberado no Fluxo Laminar!' },
      { icon: '💧', text: 'Borrifador de Água Destilada, Nutriente 4% CL & Combinações Completas: água pura separada do Álcool 70%, Garrafão 5L funcionando no Dunk, Caldo Nutritivo 4% (Malte/Mel) para CL, Serragem de Eucalipto separada, hidratação de grãos secos, Papel Alumínio, Fita Micropore, G2G e Tubos Falcon Slant vivos!' },
      { icon: '📘', text: 'Aprenda a Cultivar Sozinho + Calculadora Real: 4 Trilhas guiadas (PF-Tek Caseiro, Grãos + Monotub, Ágar T3 & Gourmet) no botão Missão, Calculadora PDA/CL 4%/CVG/1:2 e Diagnóstico Pedagógico ao inspecionar qualquer item!' },
      { icon: '✨', text: 'Visual & FPS Otimizados: EnvMap procedural em cache para reflexos reais em vidros e aço inox nas autoclaves (zero custo por frame) + animação de inclinação ao despejar líquidos e sincronização completa em multiplayer/MySQL!' }
    ]
  },
  '2.2.0': {
    title: '✨ Novidades da Atualização v2.2.0',
    subtitle: '6 Patógenos Reais + H₂O₂ 3%, Microscópio 2.0, Pedidos VIP, Etiquetas, Clones T3 & Otimização:',
    items: [
      { icon: '🦠', text: '6 Contaminações Reais + Água Oxigenada 3% (H₂O₂): Trichoderma, Cobweb (Teia), Mancha Úmida, Penicillium, Aspergillus e Mofo Batom com visuais próprios; borrife H₂O₂ 3% (Loja: 45 Coins ou na bancada) para dissolver Cobweb com efervescência!' },
      { icon: '🔬', text: 'Microscópio Óptico 2.0 (40x–1000x): torreta de lentes interativa, corantes (Natural, Azul Lactofenol e Vermelho Congo), ajuste de foco e diagnóstico específico para cada fungo e conexões de grampo!' },
      { icon: '⭐', text: 'Pedidos VIP no Drive-Thru, Etiquetas 🏷️ & Genética F1/T3: placa da Estrada exibe 2 espécies VIP (+50% bônus MycoCoins), coloque etiquetas personalizadas nos recipientes, clones T3 rendem +35% biomassa e espécies bioluminescentes brilham à noite!' },
      { icon: '⚡', text: 'Otimização de FPS & Persistência Offline: shadowMap sob demanda no Desktop, pré-filtro direcional no raycaster, progressão offline na Autoclave/Estufa e sincronização automática do brinquedo equipado (Snowboard/Paraglider) e envio ao fechar a aba!' }
    ]
  },
  '2.1.1': {
    title: '✨ Novidades da Atualização v2.1.1',
    subtitle: 'Persistência Completa de Progresso na Conta (MycoCoins, Micoteca, Missões & Loja):',
    items: [
      { icon: '🪙', text: 'MycoCoins 100% Persistentes no Banco: corrigido bug que impedia sincronizar moedas após recarregar a página por sessão salva; saldo agora sincroniza na hora e ao sair/fechar o jogo!' },
      { icon: '🛒', text: 'Compras na Loja Validadas no Servidor: insumos (inclusive Maleta Porta-Ampolas 3ML) agora debitam moedas de forma atômica no MySQL e salvam os novos itens imediatamente.' },
      { icon: '🏆', text: 'Progresso Completo por Conta: descobertas da Micoteca, marcos de recompensa, passos individuais (1/8 a 8/8) da Missão Prática e tutorial agora ficam salvos na sua conta em qualquer dispositivo!' }
    ]
  },
  '2.1.0': {
    title: '✨ Novidades da Atualização v2.1.0',
    subtitle: 'Maleta Porta-Ampolas 3ML (50 Vagas), Formas Reais de Cogumelos & Correções Críticas:',
    items: [
      { icon: '💼', text: 'Maleta Porta-Ampolas 3ML (50 Vagas) na Loja: compre por 1000 MycoCoins (req. 1000 XP e 100 cogumelos) com 24 espécies colonizadas (Cubensis, Comestíveis & Raras) em ampolas 3ML transparentes + 26 vagas livres!' },
      { icon: '🍄', text: 'Cogumelos com Formas Reais no Monotub & Colheita: Juba de Leão, Reishi, Cordyceps, Morel, Chanterelle, Enoki, Shimeji, Jack Frost, Penis Envy e mais agora frutificam no seu formato real fofinho!' },
      { icon: '🧊', text: 'Geladeira & Receitas na Bacia Corrigidas: itens na geladeira permanecem firmes nas prateleiras ao recarregar, Vermiculita/Pó de Coco/Trigo/Sorgo não somem mais ao pôr Água na bacia e erro 500 do Ranking corrigido.' },
      { icon: '🏷️', text: 'Leitura, Gavetas & Carimbo de Esporos: balão 3D cresce suavemente quando visto de longe, fundo das gavetas ficou escuro para destacar placas de vidro e Carimbo de Esporos agora tem validade de 2 anos (730 dias)!' }
    ]
  },
  '2.0.0': {
    title: '✨ Novidades da Atualização v2.0.0',
    subtitle: 'Rótulos Rápidos [1]–[4] Completos em Todo o Lab + Inspeção Sempre Sincronizada:',
    items: [
      { icon: '🎮', text: 'Rótulos Rápidos [1]–[4] em Todos os Equipamentos (PC & Mobile): Fogareiro (ligar/potência/desligar + Timer), Balança (Tara), Agitador, Fluxo Laminar, Luz, Desidratadora, Microscópio, Monotub 24L, Estufa, Horta e Vaquinha!' },
      { icon: '📦', text: 'Panela & Geladeira Melhoradas: a Panela ganhou o chip [2] Conteúdo para ver tudo que está dentro sem tirar a tampa, e a Geladeira removeu o botão repetido e ganhou [4] Inspecionar.' },
      { icon: '🔍', text: 'Títulos & Card Inspecionar Sempre Coerentes: corrigida qualquer defasagem entre o título e os chips (Petri esterilizada na panela, Falcon/Slant/PDA, Seringa, Pote de Mistura, Monotub, Cogumelos Frescos/Secos, Saco Mylar e Bandeja).' }
    ]
  },
  '1.9.9': {
    title: '✨ Novidades da Atualização v1.9.9',
    subtitle: 'Texturas reais em todos os substratos + controles mais seguros e visual limpo:',
    items: [
      { icon: '⌨️', text: 'Alt Segurar para Cursor: ao segurar Alt no PC o mouse aparece na hora para mover/fechar modais, e ao soltar o Alt a mira normal do jogo volta automaticamente!' },
      { icon: '🍄', text: 'Comer Cogumelo no Botão [1] + Ações em Chips: clicar com o mouse/toque não come mais o cogumelo sem querer — use [1] Comer Cogumelo (PC e Mobile) e ações rápidas em chips para Termômetro, Monotub, Luvas, Petri e PP5!' },
      { icon: '🍲', text: 'Panela Mais Limpa & Sem Ligar Sem Querer: removemos o balão gigante duplicado atrás do status da panela e clicar no fundo da panela ou na base perfurada não acende mais o fogareiro por engano.' },
      { icon: '🌽', text: 'Pacote de Texturas Reais & Micélio Rizomórfico: milho, trigo em grão, flocão de milho, fibra de coco + vermiculita, placas Petri e colonização gradual do micélio (de 5% a 100%) ganharam texturas detalhadas e fofas!' },
      { icon: '✨', text: 'Vagalumes Só na Natureza: os vagalumes agora ficam exclusivamente nas áreas naturais externas, sem aparecer dentro dos laboratórios.' },
      { icon: '🥥', text: 'Vermiculita + Pó de Coco + Água: substituímos a Serragem pronta por sacos separados de Vermiculita e Pó de Coco para misturar com Água no Pote, mexer com a Colher, colocar na Bag e Pasteurizar!' },
      { icon: '🫙', text: 'Títulos Claros, Petri Vazia Real & Retirar 10g na Sílica: spawns agora informam exatamente se são de Milho de Pipoca, Trigo ou Sorgo, placas vazias não exibem mofo/contam falso e Potes c/ Sílica ganham o chip [1] Retirar 10g.' }
    ]
  },
  '1.9.8': {
    title: '✨ Novidades da Atualização v1.9.8',
    subtitle: 'Slants & Tubos Falcon na Panela + Status Estéril em Todos os Recipientes:',
    items: [
      { icon: '🧪', text: 'Tubos Falcon & Slants na Autoclave: agora Tubos Falcon (15ml/50ml), Slants e Culturas Líquidas entram direto na Panela de Pressão para esterilizar em vez de despejar água na panela!' },
      { icon: '♨️', text: 'Qualquer Item Autoclavável Consta como Estéril: ao esterilizar Slants, Tubos Falcon, Frascos PDA, Culturas Líquidas, Vidros com Água, Placas de Petri, Potinhos PP5 ou Bags na panela, todos constam ✅ Estéril no rótulo e no card!' },
      { icon: '🔍', text: 'Inspeção Completa de Esterilização: ao clicar em Inspecionar [I], todos os frascos, tubos, placas, bags e potinhos (cheios ou vazios) agora mostram se estão ✅ Estéril ou ⚠️ Não Esterilizado.' }
    ]
  },
  '1.9.7': {
    title: '✨ Novidades da Atualização v1.9.7',
    subtitle: 'Controles mais práticos no PC, visuais corrigidos e físicas sem bugs:',
    items: [
      { icon: '🖱️', text: 'Alt Mostra o Cursor + Janelas Livres no PC: aperte Alt para mostrar/esconder o mouse, arrastar modais pela barra, redimensionar no canto ↘ e salvar sua posição para cada jogador!' },
      { icon: '⬇️', text: 'Largar [X] no Chão + Sem Empilhar Itens: o botão Largar agora solta sempre no chão perto de você (sem ocupar o mesmo espaço de outro item) e o círculo do ghost ficou menor e mais fino.' },
      { icon: '🔥', text: 'Fogareiro / Panela de Pressão Corrigido: resolvido o bug que fazia a água parar de subir por volta de 75°C depois de desligar e ligar o fogo novamente.' },
      { icon: '🍽️', text: 'Bandeja Firme Sem Piscar: os itens carregados em cima da bandeja agora ficam estáveis enquanto você anda pelo laboratório.' },
      { icon: '🌾', text: 'Sorgo com Textura Real + Potinho PP5 Moderno: bag/vidro de sorgo agora mostra grãos vermelho-bordô reais e o potinho PP5 tem parede dupla e tampa anatômica.' },
      { icon: '🧼', text: 'Barra "Em Mãos" Mais Limpa + Temperatura Externa: removemos o botão repetido Status e o relógio no topo mostra a temperatura do lado de fora ao vivo!' }
    ]
  },
  '1.9.6': {
    title: '✨ Novidades da Atualização v1.9.6',
    subtitle: 'Correção imediata de inicialização + novidades completas para todos:',
    items: [
      { icon: '⚡', text: 'Correção de Carregamento Imediato: corrigimos o erro que travava a tela de entrada após atualizar para a 1.9.5.' },
      { icon: '🎉', text: 'Modal de Novidades Sempre Visível: agora esta janela aparece sempre por cima do lobby e ao entrar no campus.' },
      { icon: '🌡️', text: 'Temperatura Externa ao Vivo no Relógio: o botão do horário no topo mostra a temperatura real do lado de fora em tempo real.' },
      { icon: '🍲', text: 'Base da Panela de Pressão Livre: agora você consegue mirar e retirar a Base Perfurada de dentro da panela facilmente.' },
      { icon: '🙌', text: 'Mãos, Panelas, Bandejas e Ações Sincronizadas: itens dentro de panelas/bandejas e ações (borrifar, secar, flambar, selar, misturar, colher) aparecem para todos os jogadores.' },
      { icon: '🌱', text: 'Horta, Fogareiro e Tempo Offline: plantas da horta, timer do fogareiro e avanço de cultivos ao reabrir a sala funcionando juntos!' }
    ]
  },
  '1.9.5': {
    title: '✨ Novidades da Atualização v1.9.5',
    subtitle: 'Mais sincronização entre jogadores, termômetro ao vivo e correções:',
    items: [
      { icon: '🎉', text: 'Modal de Novidades Sempre Visível: corrigimos o bug que escondia esta janela atrás do lobby — agora todos recebem o aviso sempre que o jogo atualizar!' },
      { icon: '🌡️', text: 'Temperatura Externa ao Vivo no Relógio: agora o botão do horário no topo também mostra a temperatura real do lado de fora do laboratório em tempo real!' },
      { icon: '🍲', text: 'Base da Panela de Pressão Livre: agora você consegue mirar e retirar a Base Perfurada de dentro da panela facilmente.' },
      { icon: '🙌', text: 'Mãos, Panelas e Bandejas Visíveis para Todos: se um amigo carregar a panela com vidros/base ou uma bandeja cheia, todo mundo vê os itens dentro na mão dele!' },
      { icon: '✨', text: 'Animações e Ações Sincronizadas: borrifar álcool, secar com papel, usar seringa, flambar bisturi, selar pacotes, colher e mexer no monotub aparecem para todos os jogadores.' },
      { icon: '🌱', text: 'Horta, Fogareiro e Tempo Offline: plantas da horta e timer do fogareiro agora ficam sincronizados para todos, e o servidor avança desidratadora, spawn, petri, CL e monotubs quando a sala reabrir!' }
    ]
  },
  '1.9.4': {
    title: '✨ Novidades da Atualização v1.9.4',
    subtitle: 'Atualização automática para todos + melhorias visuais e mecânicas:',
    items: [
      { icon: '🔄', text: 'Atualização Automática para Todos: agora o jogo limpa o cache sozinho quando sai novidade no servidor — não precisa mais abrir aba anônima para receber as correções!' },
      { icon: '📦', text: 'Colocar Coisas em Cima de Mesas, Cômodas e Caixas: itens agora ficam firmes em cima de mesas, balcões, estantes, geladeira e uns sobre os outros sem cair no chão.' },
      { icon: '🌌', text: 'Céu Noturno Mais Realista: tiramos a linha pontilhada em curva do céu — agora ficam só as constelações bonitas e estrelinhas menores naturais.' },
      { icon: '🌦️', text: 'Chuva e Neve Mais Suaves + Visual Nostálgico: o tempo muda aos poucos de verdade (sem trancos) e o céu/luzes ficaram ainda mais aconchegantes sem pesar no FPS.' },
      { icon: '🌈', text: 'Brisa do Cogumelo Fofa: comer cubensis mágicos deixa sua visão colorida só para você, e os amigos veem uma aura arco-íris e carinha super feliz meme em você!' },
      { icon: '⚡', text: 'Desidratadora Sem Lag & Multiplayer Persistente: corrigido o lag geral ao secar cogumelos e melhorada a sincronização de cultivos, caixas, estufa, horta e loja ao vivo e ao reconectar.' }
    ]
  },
  '1.9.3': {
    title: '✨ Novidades da Atualização v1.9.3',
    subtitle: 'Empilhamento em qualquer móvel/item + Fim do lag da Desidratadora + Sync 100% Completo:',
    items: [
      { icon: '📦', text: 'Colocar em Cima de Qualquer Coisa (Mesas, Cômodas, Caixas & Itens): agora caixas, vidros, placas e equipamentos ficam firmes em cima de balcões (até na borda!), geladeira, prateleiras da estufa e uns sobre os outros — sem cair na frente!' },
      { icon: '⚡', text: 'Desidratadora Sem Lag no Multiplayer: corrigido o gargalo que fazia a desidratadora e timers dispararem ressincronizações e gravações em massa para todos os jogadores a cada segundo!' },
      { icon: '🌐', text: 'Multiplayer 100% Persistente ao Sair e Voltar: compras com MycoCoins (loja/chapéus/suprimentos), Monotub 24L, Caixa de Entrega, Sacos Mylar, Lamparina, Pote c/ Sílica, Lotes Secos, Horta Orgânica, Empório e Placar agora sincronizam ao vivo e ao reconectar!' }
    ]
  },
  '1.9.2': {
    title: '✨ Novidades da Atualização v1.9.2',
    subtitle: 'Correção definitiva para colocar itens em mesas, bancadas e aparelhos:',
    items: [
      { icon: '📦', text: 'Colocar em Mesas e Bancadas Corrigido: itens nunca mais caem no chão ao largar ([X] / Soltar) em bancadas com outros objetos — agora o sistema encontra automaticamente o espaço livre na própria bancada!' },
      { icon: '🖱️', text: 'Clique Direto na Bancada: ao segurar potes, béqueres, ferramentas ou equipamentos e clicar sobre uma mesa/bancada, já posiciona direto em cima dela (no PC e Celular), além do modo [G]!' },
      { icon: '🎯', text: 'Precisão no PC e Superfícies: corrigido ghost desatualizado no clique rápido, prateleiras de geladeira fechada e posições iniciais de 13 itens do laboratório.' },
      { icon: '🌲', text: 'Vagalumes & Esporos Exclusivos da Floresta + Céu em Gradiente + Modo Foto ([F9])!' }
    ]
  },
  '1.9.1': {
    title: '✨ Novidades da Atualização v1.9.1',
    subtitle: 'Vagalumes e esporos apenas na floresta + melhorias visuais da v1.9:',
    items: [
      { icon: '🌲', text: 'Vagalumes & Esporos Exclusivos da Floresta: agora ficam em quantidade suave apenas nas matas externas à noite — sem vagalumes ou brilhos dentro das salas ou no meio da cidade!' },
      { icon: '🌅', text: 'Céu em Gradiente Atmosférico + Luz Rica: amanhecer dourado/rosado, horizonte em degrade, luar azulado e sombras de contato suaves no Celular!' },
      { icon: '🦋', text: 'Campus Mais Fofinho: borboletas coloridas na Horta e Praça de dia, varais de luzinhas (Fairy Lights) acendendo à noite e corações ao acariciar vaquinhas!' },
      { icon: '📷', text: 'Modo Foto / Cartão Postal ([F9] ou botão Foto no topo): esconda o HUD num clique para tirar prints perfeitas das constelações e do seu lab!' },
      { icon: '⚡', text: 'Mais FPS no PC e Mobile: Shadow Map sob demanda no Desktop e InstancedMesh leve em todos os efeitos.' }
    ]
  },
  '1.9.0': {
    title: '✨ Novidades da Atualização v1.9.0',
    subtitle: 'Visual fofinho, iluminação atmosférica e mais FPS no PC e Celular!',
    items: [
      { icon: '🌅', text: 'Céu em Gradiente Atmosférico + Luz Rica: amanhecer dourado/rosado, horizonte em degrade, luar azulado e sombras de contato suaves no Celular!' },
      { icon: '🦋', text: 'Campus Mais Fofinho: borboletas coloridas na Horta e Praça de dia, varais de luzinhas (Fairy Lights) acendendo à noite e esporos luminosos!' },
      { icon: '💖', text: 'Reações Fofas: corações e estrelinhas subindo ao fazer carinho nas vaquinhas, colher na horta ou marcar gols e cestas!' },
      { icon: '📷', text: 'Modo Foto / Cartão Postal ([F9] ou botão Foto no topo): esconda o HUD num clique para tirar prints perfeitas das constelações e do seu lab!' },
      { icon: '⚡', text: 'Otimização de FPS no PC e Mobile: Shadow Map sob demanda no Desktop (cortando pela metade o custo de sombra) e InstancedMesh leve em todos os novos efeitos!' }
    ]
  },
  '1.8.2': {
    title: '✨ Novidades da Atualização v1.8.2',
    subtitle: 'Polimento geral, luneta no celular e placas F1 com cor visual real:',
    items: [
      { icon: '🧬', text: 'Cruzamento Genético visual real: placas cruzadas no Fluxo Laminar agora exibem micélio Dourado F1 ou Albino F1 na placa e salvam no multiplayer!' },
      { icon: '🔭', text: 'Luneta no Celular e PC: adicionado botão "Sair do Zoom" na tela e saída automática ao alternar câmera/lobby!' },
      { icon: '🪟', text: 'Janela de novidades fecha exclusivamente pelos botões (✕ e "Entendi, fechar") no PC e no Celular.' },
      { icon: '💧', text: 'Poças reflexivas na Praça (InstancedMesh leve), Placar 3D das Quadras e Cestas Orgânicas da Horta (+🪙 240 no Empório)!' }
    ]
  },
  '1.8.1': {
    title: '✨ Novidades da Atualização v1.8.1',
    subtitle: 'Correção de carregamento + tudo que chegou na v1.8:',
    items: [
      { icon: '🛠️', text: 'Correção crítica: corrigido travamento na tela ao iniciar o Campus 3D (poças de chuva) e janela de novidades agora fecha só pelos botões (PC e Celular)!' },
      { icon: '🔭', text: 'Luneta Astronômica na Praça: clique nela para dar zoom de 2.8x nas constelações e estrelas cadentes da noite!' },
      { icon: '🧬', text: 'Cruzamento Genético (Albino & Dourado): use o bisturi com micélio sobre outra Placa colonizada no Fluxo Laminar para criar cepas F1 raras!' },
      { icon: '🧺', text: 'Cestas Orgânicas da Horta: cada 3 tomates/alfaces colhidos rendem uma Cesta vendável no Empório Drive-Thru (+🪙 240)!' },
      { icon: '🏆', text: 'Placar 3D na Quadra + Combo de Basquete/Futebol pagando +🪙 15 a +🪙 25 por gol ou cesta!' },
      { icon: '💧', text: 'Poças reflexivas na Praça quando chove (1 único instanced draw call que some ao secar) + luz nas janelas à noite!' }
    ]
  },
  '1.8.0': {
    title: '✨ Novidades da Atualização v1.8.0',
    subtitle: 'Novas mecânicas incríveis mantendo o FPS leve! Veja o que chegou:',
    items: [
      { icon: '🔭', text: 'Luneta Astronômica na Praça: clique nela para dar zoom de 2.8x nas constelações e estrelas cadentes da noite!' },
      { icon: '🧬', text: 'Cruzamento Genético (Albino & Dourado): use o bisturi com micélio sobre outra Placa colonizada no Fluxo Laminar para criar cepas F1 raras!' },
      { icon: '🧺', text: 'Cestas Orgânicas da Horta: cada 3 tomates/alfaces colhidos rendem uma Cesta vendável no Empório Drive-Thru (+🪙 240)!' },
      { icon: '🏆', text: 'Placar 3D na Quadra + Combo de Basquete/Futebol pagando +🪙 15 a +🪙 25 por gol ou cesta!' },
      { icon: '💧', text: 'Poças reflexivas na Praça quando chove (1 único instanced draw call que some ao secar) + luz nas janelas à noite!' }
    ]
  }
};

function getCurrentNotes(ver) {
  if (ver && RELEASE_NOTES_CATALOG[ver]) return RELEASE_NOTES_CATALOG[ver];
  if (!ver) return null;
  return {
    title: '✨ MycoCampus3D v' + ver,
    subtitle: 'Jogo atualizado',
    items: []
  };
}

export function markPendingAutoUpdateNotice(newVer) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_SEEN_KEY);
      if (newVer) localStorage.setItem(JUST_UPDATED_KEY, String(newVer));
    }
  } catch (e) {}
}

let lastOpenedNotesVersion = '';

export function closeWhatsNewModal() {
  const el = typeof document !== 'undefined' ? document.getElementById('whats-new-modal') : null;
  if (el) el.classList.add('hidden');
  try {
    if (typeof localStorage !== 'undefined' && lastOpenedNotesVersion) {
      localStorage.setItem(STORAGE_SEEN_KEY, String(lastOpenedNotesVersion));
      localStorage.removeItem(JUST_UPDATED_KEY);
    }
  } catch (e) {}
}

function bindCloseButton(btn) {
  if (!btn) return;
  const stopOnly = (e) => e.stopPropagation();
  btn.addEventListener('pointerdown', stopOnly);
  btn.addEventListener('touchstart', stopOnly, { passive: true });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== 'undefined' && window.MycoAudio && window.MycoAudio.playClick) {
      window.MycoAudio.playClick();
    }
    closeWhatsNewModal();
  });
}

function ensureWhatsNewModalDom() {
  if (typeof document === 'undefined') return null;
  let modal = document.getElementById('whats-new-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'whats-new-modal';
  modal.className = 'hidden fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm pointer-events-auto overflow-y-auto';
  if (modal.style) {
    modal.style.zIndex = '9999';
    modal.style.backgroundColor = 'rgba(2, 6, 23, 0.72)';
  }
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div id="whats-new-card" class="glass-panel max-w-md w-full max-h-[90dvh] flex flex-col rounded-2xl border border-emerald-400/50 bg-slate-900/95 shadow-2xl overflow-hidden text-slate-100 my-auto">
      <div class="px-4 py-3 border-b border-slate-700/70 flex items-center justify-between gap-2 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-slate-900/90 shrink-0">
        <div class="min-w-0">
          <h2 id="whats-new-title" class="text-sm sm:text-base font-extrabold text-emerald-300 truncate">✨ Novidades da Atualização</h2>
          <p id="whats-new-subtitle" class="text-[11px] sm:text-xs text-slate-300 truncate">Veja o que foi melhorado no jogo:</p>
        </div>
        <button id="btn-close-whats-new" type="button" aria-label="Fechar novidades"
          style="touch-action: manipulation;"
          class="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-rose-600 active:scale-95 text-slate-200 hover:text-white text-sm font-extrabold flex items-center justify-center shrink-0 transition cursor-pointer select-none">✕</button>
      </div>
      <div class="p-3.5 sm:p-4 overflow-y-auto flex-1 overscroll-contain">
        <ul id="whats-new-list" class="space-y-2 text-xs sm:text-[13px] text-slate-200 leading-snug"></ul>
      </div>
      <div class="px-4 pb-3.5 pt-2 border-t border-slate-800/80 flex items-center justify-end gap-3 shrink-0 bg-slate-900/95">
        <button id="btn-confirm-whats-new" type="button"
          style="touch-action: manipulation;"
          class="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-900/40 transition cursor-pointer select-none">
          ✅ Entendi, fechar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  bindCloseButton(modal.querySelector('#btn-close-whats-new'));
  bindCloseButton(modal.querySelector('#btn-confirm-whats-new'));

  const card = modal.querySelector('#whats-new-card');
  if (card) {
    card.addEventListener('pointerdown', (e) => e.stopPropagation());
    card.addEventListener('mousedown', (e) => e.stopPropagation());
  }
  return modal;
}

export function showWhatsNewModal(ver) {
  if (typeof window !== 'undefined' && window._reloadingVersion) return;
  const resolvedVer = String(ver || (typeof window !== 'undefined' && window.MYCO_VERSION) || Object.keys(RELEASE_NOTES_CATALOG)[0] || '').trim();
  const notes = getCurrentNotes(resolvedVer);
  const modal = ensureWhatsNewModalDom();
  if (!notes || !modal) return;

  lastOpenedNotesVersion = resolvedVer;
  const titleEl = modal.querySelector('#whats-new-title');
  const subEl = modal.querySelector('#whats-new-subtitle');
  const listEl = modal.querySelector('#whats-new-list');

  if (titleEl) titleEl.textContent = notes.title;
  if (subEl) subEl.textContent = notes.subtitle;
  if (listEl) {
    listEl.innerHTML = notes.items
      .map((it) => `<li class="flex items-start gap-2 rounded-xl bg-slate-800/70 border border-slate-700/60 px-2.5 py-2"><span class="text-base leading-none shrink-0 mt-0.5">${it.icon}</span><span>${it.text}</span></li>`)
      .join('');
  }

  releaseInputForModal();
  modal.classList.remove('hidden');
}

export function checkAndShowWhatsNewModal(fallbackVer) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  if (window._reloadingVersion) return;
  const curVer = String(window.MYCO_VERSION || fallbackVer || '').trim();
  if (!curVer) return;
  let seen = '';
  let justUpdated = '';
  try {
    seen = localStorage.getItem(STORAGE_SEEN_KEY) || '';
    justUpdated = localStorage.getItem(JUST_UPDATED_KEY) || '';
  } catch (e) {}
  if (justUpdated === curVer || seen !== curVer) {
    showWhatsNewModal(curVer);
  }
}
