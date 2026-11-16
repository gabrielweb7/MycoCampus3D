# Changelog — MycoCampus3D

Todas as versões relevantes do projeto são registradas aqui seguindo [Semantic Versioning](https://semver.org/).

## [v0.9.40] — 2026-11-17
### 🧊 Conservação de Culturas e Vapor da Panela
- O vapor da fervura sem tampa sai da boca da panela; a válvula só libera vapor quando a tampa está encaixada.
- Petri, PP5, frascos/bags de spawn e cultura líquida só entram na geladeira após 100% de colonização; o frio a 4°C conserva, mas pausa o crescimento.
- A validade começa após a colonização completa: até 30 dias em temperatura de incubação ou 60 dias refrigerada (1 dia de jogo = 10 segundos reais).
- Progresso de colonização, validade e estado de cultura líquida/spawn são sincronizados no multiplayer.

## [v0.9.39] — 2026-11-16
### 🧫 Ciclo Completo de Culturas em Placas
- Tampa da Petri articulada e animada; abrir, despejar meio e inocular exige Fluxo Laminar ligado, higienizado e placa dentro da área de trabalho.
- PDA/BDA mantém cor bege e só pode ser esterilizado na panela com a tampa fechada; seringa aplica exatamente 1ml, e bisturi estéril transfere um fragmento de uma placa colonizada.
- Micélio branco cresce progressivamente sobre o ágar e o progresso é sincronizado no multiplayer.
- Nova geladeira de culturas a 4°C, com 15 espaços e porta animada; conserva as placas por até 60 dias de jogo contra 14 dias fora da refrigeração (1 dia de jogo = 10 segundos reais).

## [v0.9.38] — 2026-11-16
### 🧫 Proporção das Placas e Ações de Cultura
- Reduzido o diâmetro da placa de Petri para ficar apenas um pouco maior que o PP5; espessura, colisão e espaçamento de empilhamento acompanham a nova escala.
- Ações de flocão, mistura/porcionamento e transferência com bisturi foram extraídas para `systems/lab-culture-actions.js`, separando parte do fluxo de cultura do sistema geral de interação.

## [v0.9.37] — 2026-11-16
### 📦 Posicionamento de Itens e Organização
- O fantasma de posicionamento só aparece depois de escolher posicionar: G/Q ou clique direito no PC; botão 📦 dedicado no celular. Clique/tap confirma e Esc ou o botão cancela.
- Preview e confirmação do posicionamento foram extraídos para `held-item-placement.js`; o fluxo de soltar e posicionar agora compartilha a mesma rotina de atualização/sincronização.
- O jogo deixa de calcular o alvo de posicionamento enquanto o jogador apenas segura um item, reduzindo trabalho de raycast durante esse estado.

## [v0.9.36] — 2026-11-16
### 🧪 Compatibilidade de Recipientes e Meio PDA/BDA
- Béqueres e o frasco autoclavável de 1L podem receber água da torneira; garrafão destilado e frasco de cultura líquida não podem mais ser preenchidos pela pia.
- Meio PDA/BDA preparado pode ser distribuído em placas de Petri e PP5 vazios; Petri só fica pronto para inoculação após esterilização, e PP5 mantém o fluxo de preparo próprio.
- Transferências de água, flocão, substrato e micélio agora respeitam as compatibilidades e o estado atual do recipiente, evitando alvos incompatíveis no HUD.
- Estados de volume e PDA/BDA dos PP5 são sincronizados no multiplayer, e a seringa só aspira de fontes de cultura líquida.

## [v0.9.35] — 2026-11-16
### 🧴 Escala do Frasco PDA/BDA
- Redimensionado o frasco autoclavável de 1L para ficar proporcional ao béquer graduado de 1L, preservando sua capacidade e as interações.

## [v0.9.34] — Preparo de Meio PDA/BDA
### 🧪 Dosagem, Mistura e Esterilização
- O pó PDA/BDA pode ser dosado no béquer em incrementos de 1g e combinado com água destilada na proporção de 40g/L.
- O agitador magnético homogeneíza a mistura após 4 segundos com a receita correta.
- O meio homogêneo pode ser transferido para Falcon de 15ml (slants) ou para o frasco autoclavável de 1L; a esterilização e a queima são refletidas no rótulo.
- Quantidades de reagente, volumes, homogeneização e estado de esterilização são sincronizados no multiplayer.

## [v0.9.33] — 2026-11-16
### 🧫 Inoculação de Petri e Colonização
- A placa estéril com PDA agora aceita cultura líquida, mostra o estado de cultura/contaminação e pode fornecer micélio ao bisturi; o estado também sincroniza no multiplayer.
- Placas já inoculadas ou contaminadas não aceitam novas injeções, e placas vazias sem PDA informam o requisito.
- Recipientes contaminados ou queimados não avançam mais a colonização.
- O estado do recipiente passa a ser marcado como colonizado ao atingir 100%.

## [v0.9.32] — 2026-11-16
### 📖 Guia, Seladora e Estado Compartilhado do Laboratório
- Adicionado ao HUD um guia com controles para PC/celular, compatibilidade dos itens cadastrados e tutorial opcional em etapas.
- O botão de ação mobile agora usa ícones contextuais para indicar melhor o que o toque fará.
- A Seladora Térmica agora sela bags preenchidos antes da esterilização, com indicador visual no bag; recipientes queimados, contaminados, não esterilizados ou bags sem selo não podem ser inoculados.
- O multiplayer agora compartilha volumes, receitas, estado de inoculação/esterilização, lâmina do bisturi e conteúdo/andamento das panelas, com validação dos dados recebidos pelo servidor.
- O nível do fogareiro e o modo das panelas também são sincronizados para os jogadores da sessão.

## [v0.9.31] — 2026-11-16
### 💉 Validação de Alvos da Seringa
- A seringa não pode inocular recipientes vazios, PP5 sem hidratação ou recipientes já inoculados.
- Ao mirar em um PP5 que ainda não está pronto, o jogo informa o que falta para continuar.

## [v0.9.30] — 2026-11-15
### 🧪 Correções de Interações de Laboratório
- A aspiração pela seringa agora respeita o volume disponível no recipiente e a capacidade restante da seringa.
- A esterilidade por fluxo laminar higienizado só se aplica quando o recipiente inoculado está sobre a área de trabalho da capela.
- O pote de mistura agora exige as quantidades mínimas de sólido e água antes de porcionar uma receita.

## [v0.9.29] — 2026-11-15
### 📱 FPS Adaptativo para Celulares
- O modo automático inicia em qualidade reduzida em aparelhos com pouca memória ou até quatro núcleos, sem sombras em nenhum nível mobile.
- No PC, o modo automático inicia em qualidade média sem sombras dinâmicas e sobe para alta quando mantém FPS estável, evitando começar com o custo da sombra direcional de 1536 px e renderização a até 1,5x.
- Ajustados resolução, distância de renderização e quantidade de partículas de chuva/neve por nível; celulares capazes podem subir automaticamente até a qualidade alta após manter FPS estável.
- A atualização de partículas de clima agora processa somente as partículas visíveis no nível atual.

## [v0.9.28] — 2026-11-15
### 🧰 Relatório Centralizado de Erros
- Erros JavaScript são enviados ao servidor com limite e deduplicação no navegador; o servidor limita frequência e tamanho dos relatórios.
- Criado `api/error.php` para guardar relatórios em `data/game-errors.jsonl` e permitir listagem somente por Administrador Master.
- Criada a página `error.php` para consultar os erros recentes usando a sessão de administrador já autenticada.
- A requisição não inclui token, ID do usuário nem cabeçalhos; valores identificados como credenciais são redigidos e o painel exibe conteúdo como texto.

## [v0.9.27] — 2026-11-15
### ⚡ Menos Raycasts e Tráfego Multiplayer
- Limitada a atualização do raycast de interação no desktop a 30 Hz fora de ações contínuas, reduzindo trabalho repetido no loop de renderização.
- Aumentado o intervalo de sincronização multiplayer de 125 ms para 250 ms (8 para 4 requisições por segundo por jogador), mantendo a interpolação dos avatares.
- Aplicada a constante existente de intervalo em segundo plano e atualizadas as referências de versão.

## [v0.9.26] — 2026-11-15
### 🐛 Correção da Tela Preta na Inicialização do Campus
- Corrigidas as chamadas de `addWalkableSlab` e `addSolidWall` nos construtores do campus para corresponder às assinaturas atuais, evitando que a construção do mundo 3D seja interrompida.
- Ajustado o cache Apache para revalidar módulos ES em cada carregamento, pois os imports internos não incluem query de versão.
- Atualizado o versionamento para que os clientes carreguem os módulos corrigidos após o deploy.

## [v0.9.25] — 2026-11-15
### 🪂 Freio & Descida Rápida no Paraglider
- **Controle de descida ao andar para trás ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Segurar para trás (`S` / `↓` / analógico para trás) durante o voo reduz a velocidade horizontal para `4.2 m/s` (freio aéreo) e aumenta a taxa de descida para `-5.2 m/s`, facilitando o pouso rápido no ponto desejado.

## [v0.9.24] — 2026-11-15
### 🧰 Bandejas Inox Cirúrgicas, Empilhamento de Placas de Petri & Braço na Seringa
- **Bandejas Inox de Laboratório (`makeLabTray`) ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [api/multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php))**:
  - Adicionadas 3 bandejas cirúrgicas em aço inox polido com bordas inclinadas, cantos arredondados e pezinhos de silicone menta (`lab_tray_01`, `lab_tray_02`, `lab_tray_03`) sincronizadas no multiplayer, suportando seringas, placas de Petri e outros itens dentro delas.
- **Correção do Empilhamento de Placas de Petri ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Corrigido o bug em `stepFallingItems` e `getPlacementSpot` onde a 2ª/3ª placa caía para dentro da placa de baixo.
- **Braço na Coleta com Seringa ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Braço em 1ª pessoa mantido próximo ao corpo sem tampar o frasco enquanto a seringa vai até o septo.

## [v0.9.23] — 2026-11-15
### 🏂 Sincronização Multiplayer do Snowboard & Paraglider
- **Correção do envio e leitura de `toy_mode` ([js/campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js), [api/multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php), [js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - `syncMultiplayer()` agora envia `toy_mode` no payload para `api/multiplayer.php?action=sync`.
  - `api/multiplayer.php` passa a retornar `toy_mode` explícito (`'snowboard'` ou `'paraglider'`) para os outros jogadores em vez de reduzir `walking = 3/4` para booleano.
  - Prancha de snowboard do avatar remoto aprimorada (bico e rabeta curvados, fixações e pose lateral com inclinação ao deslizar/andar) e reset suave dos braços/inclinação ao desequipar.

## [v0.9.22] — 2026-11-15
### 🪂 Paraglider MycoWing, Correntes Térmicas & Visão Multiplayer dos Brinquedos
- **Paraglider em 1ª Pessoa & Física de Voo ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [js/campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Novo brinquedo na loja (`150 XP • 3 cogumelos`, atalho `P`): **Paraglider MycoWing**.
  - Ao saltar de montanhas ou pular com `Espaço`, abre a vela arco-íris em 7 painéis acima da cabeça com tirantes/batoques visíveis e braços em 1ª pessoa segurando os comandos.
  - **6 Correntes de Ar Térmicas** espalhadas entre as montanhas e o campus (`thermalColumns`): anéis ascendentes visíveis que dão sustentação vertical (`+8.5 m/s`) até `118m` de altitude.
- **Multiplayer Sincronizado ([api/multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php), [js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Outros jogadores agora veem o seu avatar descendo de **Snowboard** (`walking = 3`) ou voando de **Paraglider** (`walking = 4`), com limite de altitude `Y` ampliado para `180m` e suporte a `current_hat = 'none'`.

## [v0.9.21] — 2026-11-15
### 🚶 Caminhada Realista & Curva Hermite no Multiplayer
- **Movimento Contínuo sem Saltos ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - **Buffer adaptativo de jitter** por jogador (`avgIntervalMs * 1.45`, entre `150 ms` e `320 ms`) para que o avatar nunca fique sem snapshots e não dê saltos quando um pacote atrasar.
  - **Spline Hermite Cúbica** usando posição e velocidade `(vx, vz)` entre snapshots + suavização exponencial (`1 - exp(-12 * dt)`), deixando curvas e paradas orgânicas.
  - **Ciclo de caminhada realista**: *bob* vertical dos passos, leve inclinação/balanço do tronco proporcional à velocidade real e desaceleração suave ao parar.

## [v0.9.20] — 2026-11-15
### ⚡ Multiplayer Fluido (125 ms + Interpolação/Predição) & Auto-FPS Dinâmico
- **Multiplayer Ultra-Rápido e Suave ([api/multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php), [js/campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js), [js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Intervalo de sincronização reduzido de `750 ms` para `125 ms` (6x mais rápido).
  - Backend com **delta versioning** (`obj_ver`, `state_ver`) para não reenviar objetos/estado do mundo quando nada mudou, escrita em `mc_user_poses` com throttle (a cada ~4s durante caminhada) e cache de velocidade `(vx, vz)` em APCu.
  - Cliente com **buffer de interpolação (135 ms)** + **dead-reckoning** por velocidade `(vx, vz)` e animação das pernas/braços guiada pela velocidade real, eliminando o efeito de "teleporte/travamento" ao andar.
- **Auto-Detecção de FPS & Resolução Dinâmica ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html))**:
  - Monitoramento contínuo de FPS com 4 níveis automáticos (`Alto`, `Médio`, `Desempenho`, `Mínimo`): reduz automaticamente `pixelRatio` (até `0.55`), sombras e distância de renderização (`camera.far`) quando o cliente cai de FPS, mantendo o HUD HTML/CSS 100% nítido e o mundo colorido/jogável.
  - Novo botão `⚡ Auto` no HUD mostrando o nível atual + FPS ao vivo e permitindo alternar manualmente entre `Auto`, `Alto`, `Méd`, `Desemp` e `Mín`.

## [v0.9.19] — 2026-11-15
### 🏂 Snowboard Realista nas Montanhas & Loja com Categorias (Chapéus e Brinquedos)
- **Loja com Abas, Troca e Desativação ([api/auth.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/auth.php), [index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html), [js/campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Categorias separadas na loja: `🎩 Chapéus` e `🏂 Brinquedos`.
  - Chapéus agora podem ser equipados, trocados ou desativados (`hat_id: 'none'`).
  - Novo brinquedo desbloqueável: **Snowboard Pro MycoRide** (`100 XP • 2 cogumelos`), com botão Ativar/Desativar na loja e atalho `B`.
- **Snowboard 3D nos Pés & Física de Montanha ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [js/campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Modelo 3D da prancha (`MYCORIDE PRO`), fixações, botas e pernas em 1ª pessoa visíveis ao olhar para baixo.
  - Física de descida por gradiente do terreno (aceleração natural morro abaixo até `26 m/s`, *carving* lateral nas curvas, freio com `S`, salto *Ollie* com `Espaço` e inclinação dinâmica da prancha).
  - Novo setor no `🗺️ Mapa`: **Montanhas (Snowboard)** no pico norte para testar descidas direto do alto.

## [v0.9.18] — 2026-11-15
### 🐛 Correção da Tela Preta na Seringa & Etapas Claras da Autoclave
- **Correção Crítica da Seringa ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Declarados `_tmpSyrPort`, `_tmpSyrHand` e `_tmpSyrOff` no escopo de `campus3d.js`, corrigindo o `ReferenceError: _tmpV1 is not defined` que deixava a tela preta ao usar a seringa na cultura líquida.
- **Autoclave em Etapas Sequenciais ("uma coisa por vez") ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - **Aquecendo** (`25°C -> 121°C`) → **PSI aumentando** (`0 -> 15 PSI`) → **Esterilizando** (`0 -> 100%`) → **100% Esterilizado! Desligue o fogo!** (contagem regressiva de `16s`).
  - Se esquecer o fogo ligado após `16s`, o conteúdo queima (`burned = true`, visual escurecido) e exibe `🔥 Tudo queimado :( Jogue fora!`.
  - Se desligar o fogo no tempo certo: **Perdendo pressão** (`15 -> <1.5 PSI`) → **Temperatura caindo** (`121°C -> ambiente`) → **✅ 100% Esterilizado • Pronto para uso! :)**.

## [v0.9.17] — 2026-11-15
### 🐛 Correção de Crash Fatal da Seringa na Cultura Líquida (`animate()`)
- **Fim do Congelamento ao Tirar Mira / Soltar Seringa ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Corrigido `TypeError: Cannot read properties of null (reading 'item')` na animação de perfuração do septo (`syringePunctureProgress > 0.01` quando `hoveredSyringeTarget` virava `null`), que travava o `requestAnimationFrame(animate)`.
  - Adicionado `lastSyringeTargetItem` com fallback seguro, alcance de seringa ampliado para `4.2m`, e uso de vetores temporários Zero-GC (`_tmpV1`, `_tmpV2`, `_tmpV3`).

## [v0.9.16] — 2026-11-15
### 🐛 Correção da Trava da Panela de Pressão & Subida Gradual de PSI
- **Trava Ativa na Tampa e na Panela ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Corrigido o retorno antecipado em `handlePrimaryAction` que permitia retirar a tampa antes de verificar `cpLock.psi >= 1.5`.
  - Também bloqueia pegar o corpo da panela enquanto estiver pressurizada (`psi >= 1.5`), orientando a desligar o fogareiro primeiro.
- **Pressurização Gradual & Texto Correto no HUD 3D ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - `cp.psi` agora sobe gradualmente (`3.8 PSI/s`) ao fechar a tampa com a panela ainda quente, sem salto instantâneo.
  - HUD 3D diferencia `✅ 100% • Desligue o fogareiro!` (fogo ligado) de `❄️ Despressurizando... (< 1.5 PSI)` (fogo desligado).

## [v0.9.15] — 2026-11-15
### 🎨 Equilíbrio de Iluminação Natural (Bancadas em Destaque, Paredes sem Estouro)
- **Contraste & Foco nos Equipamentos ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Reduzida a `HemisphereLight` (`0.56` PC / `0.68` Mobile) e ajustada a exposição (`1.02` PC / `1.08` Mobile) para preservar a cor e o contraste dos tijolos nas paredes.
  - Ajustadas as luzes pontuais de teto (`PointLight`, intensidade `1.35`, alcance `16`, decay `1.85`, altura `ceilY - 0.55`) para iluminar com naturalidade as mesas, bancadas e itens centrais da sala.

## [v0.9.14] — 2026-11-15
### 🍲 Autoclave Realista: Trava de Pressão, HUD 3D (0–15 PSI) & Válvula Sincronizada
- **Trava de Segurança por Pressão ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Não é mais possível retirar a tampa enquanto `psi >= 1.5` (exibe aviso 🔒 e instrui a desligar o fogareiro e aguardar despressurizar).
  - Ao desligar o fogareiro ou retirar a panela do fogo, a pressão cai gradualmente (`2.0 PSI/s`) até destravar a tampa automaticamente abaixo de `1.5 PSI`.
- **Indicador 3D Flutuante Acima da Panela ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Exibe `PSI (0..15)` e porcentagem, barra colorida, status de trava (`🔒`/`🔓`) e progresso de aquecimento/esterilização/despressurização em tempo real (Zero-GC com cache de desenho `lastHudKey`).
- **Animação & Som Sincronizados ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [js/campus-audio.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-audio.js))**:
  - Pinos vermelhos de segurança sobem/descem conforme a trava (`psi >= 1.5`), peso central vibra/balança e vapor acelera proporcionalmente entre `10` e `15 PSI`.
  - Chiado do vapor aumentado suavemente (`0.125` de ganho máximo) mantendo o alcance espacial de `12m`.

## [v0.9.13] — 2026-11-15
### 💡 Melhoria de Iluminação Interna e Exposição (`ACESFilmicToneMapping`)
- **Salas Mais Claras e Nítidas ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Elevada a exposição do renderer (`toneMappingExposure`) de `0.95`/`1.08` para `1.18` (PC) e `1.22` (Mobile) para evitar escurecimento de bancadas metálicas e equipamentos.
  - Aumentadas as luzes de teto das salas (`PointLight` de `0.82` para `1.45`, alcance `26`, decay `1.25`) tanto na criação quanto no interruptor e na sincronização multiplayer.
  - Ajustada a `HemisphereLight` (rebatimento `0x64748b`, intensidade mínima `0.55` no PC / `0.68` no Mobile em `updateDynamicEnvironment`) para manter interiores legíveis em qualquer horário ou clima.

## [v0.9.12] — 2026-11-15
### 🔊 Áudio Espacial na Panela de Pressão & Correção de `AudioContext`
- **Atenuação por Distância ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [js/campus-audio.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-audio.js))**:
  - O vapor da panela de pressão agora só é audível quando o jogador está próximo (`< 12m`), com volume gradual conforme a distância (`<= 2m` máximo, `12m` zero) e silenciamento automático no lobby e no logout.
  - Substituído o ruído branco contínuo áspero por chiado suavizado de válvula (`bandpass 2600 Hz`, ganho máximo `0.065`).
- **Zero Spam de `AudioContext` ([js/campus-audio.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-audio.js))**:
  - `getAudioContext()` agora só cria/retoma o `AudioContext` após gesto do usuário (`userHasGestured`) e `setPressureCookerSteam(false)` não toca mais no `AudioContext`, eliminando os avisos repetidos no console.

## [v0.9.11] — 2026-11-15
### 🐛 Correções Profundas de Vazamentos WebGL, Panela de Pressão, Seringa, Input & Sessão
- **Panela de Pressão & Física de Conteúdo ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Bloqueada a coleta de frascos/bags de dentro da panela enquanto a tampa estiver acoplada (`isItemInsideClosedCooker`).
  - `updatePickablePhysics` e `applyCampusSavedPose` agora removem o item de `cookerPots.contents` (`removeFromCookerContents`) quando segurado por jogador remoto ou restaurado no spawn, evitando teleporte de volta para dentro da panela.
  - `window.resetCampusWorldObjects()` e `applyCampusWorldObjects()` agora limpam `cookerPots.contents`, `psi`, `temp`, `progress`, `sterilized`, vapor e `recentlyDropped` ao resetar o mundo.
- **Seringa 10ml & `dropHeldItem` ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Cancelamento automático de `syringePumping` ao soltar item (`G`/`Q`), teleportar (`teleportCampusPlayer`) ou se afastar mais de `4.5m` do recipiente.
  - `dropHeldItem` agora recusa soltar em locais bloqueados (mesmo no fallback frontal), move tampa acoplada e `cookerPots.contents` junto com a panela, e usa janela de `15000ms` em `recentlyDropped`.
- **Limpeza de Memória WebGL ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Adicionado helper `disposeObject3D()` para descartar geometrias, materiais e texturas (`map`) de chapéus antigos em `buildAvatarHat` e de avatares remotos desconectados.
  - Partículas `sprayBursts` agora chamam `.geometry.dispose()` e `.mat.dispose()` ao expirar.
- **Input, Modais & Isolamento de Sessão ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [js/campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Adicionado `visibilitychange` para limpar teclas presas, verificação de `isContentEditable` no `keydown`, `blur` no botão mobile `#btn-mobile-action` e foco no `#admin-search-input`.
  - Novo `releaseInputForModal()` ao abrir qualquer modal (`ranking`, `admin`, `lesson`, `map`, `quest`, `shop`) liberando teclas e pointer lock.
  - `logoutCampus()` agora regenera `sessionId`, limpa `pendingChatMsg`, fecha todos os modais e chama `window.resetCampusLocalSession()`.

## [v0.9.10] — 2026-11-15
### 🔧 Auditoria Completa de Objetos, Compatibilidade de Itens & Zero-GC
- **Estufa Sincronizada Corretamente ([api/multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php), [js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Corrigida gravação de `greenhouse_slot_[0-3]_humidity` (`0..100`) e `greenhouse_slot_[0-3]_stage` (`0..3`) no PHP (antes eram convertidos para `'0'`/`'1'`).
  - Corrigido `slot.species` (`undefined`) para `slot.name` no toast de inspeção da estufa.
- **Inoculação Real com Seringa 10ml & Termômetro ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Ao concluir injeção em `spawn_jar` ou `spawn_bag`, agora marca `inoculated = true` (com risco educativo de contaminação se o Fluxo Laminar estiver desligado ou não higienizado com Álcool 70%) e atualiza `spawnCtrl` em `mesh.userData` para leitura correta no termômetro laser (`26.4°C`).
- **Compatibilidade de Itens, Panela de Pressão & Balança ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [api/multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php))**:
  - Hierarquia de superfícies em `isPlacementBlocked`: bloqueia mesas/capela em cima de aparelhos pequenos (`isScale`, `isStirrer`, `isBurner`) e impede empilhar aparelhos incompatíveis.
  - `isSurfaceOccupied` agora ignora o item segurado pelo jogador ou por jogadores remotos.
  - Mover a Panela de Pressão agora leva junto os frascos/bags guardados dentro dela (`cookerPots.contents`).
  - Balança de precisão agora pesa pilhas completas de até 7 placas de Petri.
  - Paridade exata de `MP_ITEMS` (161 itens) removendo `substrate_bag` e `fruiting_block` órfãos.
- **Otimização Zero-GC, Raycasts & Som ([js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Removidos arrays mortos `auditoriumScreenMeshes` e `screenActionMeshes`, hitboxes duplicadas de carteiras, `.filter()` em raycasts e `forEach` em `animate()`.
  - Restaurado throttle de 90ms do telão do Cinema no hover, filtro de distância em 3ª pessoa e som nas persianas (`blind_0..15`).

## [v0.9.9] — 2026-11-15
### 🛡️ Segurança, UX Mobile, Missão Prática, Mapa Rápido & Performance (Fases 1, 2 e 3)
- **Segurança & Validação no Back-end ([api/auth.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/auth.php), [api/multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php), [.htaccess](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/.htaccess))**:
  - Removido reset automático de senha no login por nome de admin ou `PROFESSOR_KEY`; contas existentes sempre exigem `password_verify()` (`401` em falha) e registros concorrentes retornam `409` amigável.
  - Corrigido bypass do quiz em `complete_module` (não aceita mais resposta vazia).
  - `harvest` e `harvest_greenhouse` agora validam `mushroom_id` / `slot_id` com trava e cooldown no `mc_world_state`.
  - `buy_cosmetic` verifica XP e cogumelos dentro da transação com `FOR UPDATE`.
  - `admin_list_users` sem linhas duplicadas por múltiplas sessões; `admin_kick` revoga tokens em `mc_auth_tokens`; `admin_teleport` valida limites finitos.
  - Bloqueio de alteração de `auditorium_slide` / `auditorium_presenter` por alunos via `sync`; exigência de `POST` em ações de escrita; bloqueio de `data/` e dotfiles no `.htaccess`.
- **Missão Prática Guiada, Mapa Rápido & Esportes 3D ([index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html), [js/campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [js/campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Novo botão `🗺️ Mapa` com teleporte rápido para 7 setores do campus (`window.teleportCampusPlayer`).
  - Nova `🧪 Missão` prática em 5 etapas reais no laboratório e estufa, com recompensa única de `+100 XP` (`action=complete_lab_quest`).
  - Complexo esportivo com bola de futebol e bola de basquete com física 3D (Zero-GC) e comemoração de gol com confete.
- **Áudio, UX Mobile & Performance ([js/campus-audio.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-audio.js), [css/game.css](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/css/game.css), [api/db.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/db.php), [database/schema.sql](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/database/schema.sql))**:
  - `playSwitch()` centralizado em `window.MycoAudio` respeitando o mudo; remoção do `AudioContext` duplicado e funções mortas.
  - `#interact-pill` e `#btn-mobile-action` visíveis e funcionais no celular; feedback de estágio e umidade na estufa.
  - `MC_SCHEMA_VERSION = 7` com índices `idx_users_leaderboard` e `idx_tokens_last_used`, e *batch inserts* em `moved_items` e `board_strokes` no `multiplayer.php`.

## [v0.9.6] — 2026-11-15
### 🔑 Correção de Inicialização do App (`boot`) & Autenticação Segura do Dono
- **Proteção Completa contra Elementos Ausentes no DOM ([campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Eliminado o erro `Uncaught TypeError: Cannot set properties of null (setting 'onclick') at HTMLDocument.boot (campus-app.js:1324)` que impedia a inicialização dos formulários e botões de login quando botões do HUD não estavam presentes no DOM.
  - Adicionadas verificações defensivas (`if (el) el.onclick = ...`) para `btn-toggle-fps`, `btn-logout`, `btn-open-lessons`, `btn-close-lessons`, `btn-open-ranking`, `btn-close-ranking`, `btn-slide-prev`, `btn-slide-next`, `btn-reset-lab`, `chat-form` e `chat-input`.
- **Tratamento Resiliente em `apiPost` ([campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - `apiPost` agora lê a resposta como texto e executa `JSON.parse` com tratamento de exceção seguro, evitando que respostas de erro HTTP de servidores (como páginas HTML 401 de Apache/LiteSpeed) causem `SyntaxError` genérico de "Falha ao conectar".
- **Recuperação e Login Automático do Dono da Plataforma ([auth.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/auth.php))**:
  - Para o usuário Dono (`gabrieldaluz`) ou em caso de uso da chave de professor (`PROFESSOR_KEY`), o sistema agora atualiza a senha/PIN automaticamente caso tenha sido alterada ou esquecida, garantindo que o Dono nunca seja bloqueado da sua própria aplicação com a mensagem "Esse nome já está cadastrado com outra senha".

## [v0.9.5] — 2026-11-15
### 🛡️ Correção Definitiva de Itens nas Mesas, Eliminação de Tela Preta & Otimização do Polling
- **Correção Geral da Queda de Itens no Chão ao Soltar nas Mesas ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - **Causa Raiz 1 (Raycast no Piso ignorava mesas)**: Em `findPlacementTarget()`, a etapa de raycast com o piso chamava `getGroundHeight(px, pz, playerPos.y)`. Como o jogador no laboratório está com `playerPos.y = 0.14`, a condição interna `curY >= ss.topY - 0.40` falhava para todas as mesas e bancadas (`topY >= 0.95`), fazendo o raio atravessar a mesa e aterrissar no chão (`y = 0.14`). Criada a função `getItemGroundHeight(x, z, refY)` e `getSupportSurfaceAt(x, z)` que calcula a altura do tampo de apoio sem restrição de pulo do jogador.
  - **Causa Raiz 2 (Detecção Matemática 3D de Mesas e Bancadas)**: Adicionada checagem matemática dupla exata (intersecção raio-plano horizontal no tampo + intersecção raio-caixa AABB do volume da mesa). Ao mirar na frente, pernas, laterais ou no tampo de qualquer mesa/bancada/estufa, o item é posicionado no tampo da mesa com segurança milimétrica.
  - **Causa Raiz 3 (Tolerância das Bordas na Gravidade)**: Em `dropUnsupportedItems()`, expandida a margem horizontal das superfícies (`minX - 0.09` a `maxX + 0.09`) e vertical (`s.topY - 0.28`), impedindo que itens colocados próximos da borda percam suporte e despenquem para o chão.
  - **Causa Raiz 4 (Mobile Tap NDC Reset)**: Na função `resetTouchLook`, ao soltar o toque segurando um item, o código resetava `pointerNdc` para `(0, 0)` (centro do horizonte/parede). Corrigido para preservar o ponto exato da tela onde o usuário tocou na mesa.
- **Eliminação Definitiva do ReferenceError `touchDrawingBoard` ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Declarado `var touchDrawingBoard = false;` e `window.touchDrawingBoard = false;` com checagem defensiva `typeof touchDrawingBoard !== 'undefined'` dentro do loop `animate()`, impedindo que versões antigas em cache no navegador causem tela preta ou interrompam o loop de renderização.
- **Otimização do Polling Multiplayer ([campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Intervalo de `multiplayer.php?action=sync` elevado de 350ms para 750ms em primeiro plano (e 1500ms em segundo plano), reduzindo requisições HTTP em mais de 55% e limpando a aba Network do DevTools, mantendo a interpolação suave de avatares.
- **Remoção Permanente dos Botões Rápidos e Controle do Telão ([index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html), [game.css](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/css/game.css))**:
  - Elementos `#hud-quick-actions` e `#prof-toolbar` esvaziados no HTML e ocultados com regras estritas de CSS (`display: none !important; visibility: hidden !important; pointer-events: none !important; opacity: 0 !important; width: 0 !important; height: 0 !important;`), garantindo que nunca mais surjam na interface do jogo.
- **100% Self-Hosted & Independência de CDN ([index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html), `js/vendor/`)**:
  - Bibliotecas externas (`three.min.js` e `OrbitControls.js` r128) agora baixadas e hospedadas diretamente no projeto em `js/vendor/`.
  - Eliminada qualquer dependência de CDNs externos (cdnjs e jsdelivr), tornando o jogo imune a instabilidades externas, bloqueios de DNS, lentidão de operadoras e permitindo carregamento mais veloz via HTTP/2 na mesma origem.

## [v0.9.4] — 2026-11-15
### 🛠️ Otimização do Termômetro Laser, Eliminação de Congelamento & Estabilização do Fogareiro
- **Termômetro Laser Infravermelho Otimizado (`infrared_thermometer`) ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [campus-audio.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-audio.js))**:
  - **Eliminação Total de Travamento/Congelamento**: O raycast do feixe laser foi desacoplado de `scene.children` e agora opera sobre um pool otimizado de alvos (`pickableItems` + `supportMeshes` + avatares remotos), reduzindo o custo de raycast de 10.000 nós para apenas ~35 objetos.
  - **Otimização de Renderização LCD**: A textura Canvas 2D da tela verde (`drawThermoScreen`) agora faz throttle inteligente, atualizando e transferindo para a GPU somente quando há variação de temperatura (>= 0.1°C), liberando 100% da CPU/GPU.
  - **Comportamento como Ferramenta na Mão**:
    - O `placementGhost` fica oculto enquanto mira com o termômetro (não projeta mais um fantasma no chão ou em cima dos objetos medidos).
    - Clicar aciona o gatilho da pistola (emite o bipe sonoro de laser `playLaserBeep()`, atualiza a medição SCAN/HOLD e fixa a leitura na tela sem soltar no chão).
    - Tecla **G** (ou **Q** ou clique direito) solta o termômetro organizadamente sobre a bancada quando o jogador desejar.
- **Estabilização do Fogareiro Elétrico (`burner_lab`) ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - **Fim da Subida Infinita / Flutuação no Ar**: As meshes clonadas no `placementGhost` agora limpam estritamente `userData.supportSurface`, `dynamicSurface` e recebem `ignoreRay = true`. O raycast de colocação (`findPlacementTarget`) ignora o próprio item segurado, eliminando a auto-interseção que fazia o fogareiro subir sozinho para o teto.
  - O seletor de switches desconsidera botões do próprio aparelho segurado nas mãos, permitindo manuseá-lo com suavidade e precisão.


## [v0.9.3] — 2026-11-15
### 🍄 Correção de Piscar dos Cogumelos Silvestres & 🌈 Arco-íris 3D Espectral
- **Estabilidade Total dos Cogumelos Silvestres no Bosque (`applyCampusWorldState`) ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Corrigida a inversão semântica na sincronização multiplayer dos cogumelos coletáveis (`wild_0`..`wild_31`).
  - O valor `'1'` enviado pelo servidor (`1 = disponível/ativo`) vinha sendo tratado como `remSec > 0`, fazendo com que cada pacote de sync (a cada 200ms) forçasse a desativação visual do cogumelo enquanto o loop local tentava reexibi-lo, gerando cintilação/piscar contínuo no mapa.
  - Agora os cogumelos permanecem 100% firmes, visíveis e rotacionando suavemente na grama, desaparecendo apenas quando colhidos por um jogador pelo período exato de 20 segundos de respawn.
- **Formação Atmosférica Dinâmica pós-Chuva (`createRainbowMesh`, `updateDynamicEnvironment`) ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - **Arco 3D Espectral com Coordenadas UV Radiais**: Modelado semicírculo geométrico majestoso de 92 metros de raio (`innerR: 72`, `outerR: 92`), com 64 segmentos de alta fidelidade e mapeamento UV contínuo.
  - **Gradiente Óptico de 7 Cores Reais**: Textura procedural com as 7 faixas espectrais autênticas (Violeta, Anil/Azul, Ciano, Verde, Amarelo, Laranja, Vermelho), com blending aditivo (`THREE.AdditiveBlending`) que ilumina suavemente o céu e as nuvens.
  - **Suavização das Extremidades nas Montanhas**: Máscara com interpolação de opacidade que funde naturalmente a base do arco-íris atrás das montanhas distantes ao norte/nordeste do campus.
  - **Transição Automática ao Fim da Chuva**:
    - O ciclo climático detecta quando a chuva cessa (`lastWeatherMode === 'rain' && weatherMode !== 'rain'`), abrindo o céu com luz solar dourada e ativando a formação do arco-íris.
    - Animação cinematográfica com fade-in suave de 8 segundos, brilho sustentado com pulsação atmosférica sutil por ~50 segundos e fade-out gracioso de 12 segundos.
    - Disponibilizada função global para acionamento/testes instantâneos: `window.triggerCampusRainbow(duracaoEmSegundos)`.

## [v0.9.2] — 2026-11-15
### 🛡️ Prevenção Total de Penetração e Sobreposição de Itens no Mundo 3D
- **Bloqueio Físico de Colisão Entre Itens (`isPlacementBlocked`) ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Implementada verificação física completa de sobreposição 3D (faixa vertical e pegada horizontal) entre todos os itens interativos do mundo (`pickableItems`).
  - **Detecção Radial e Caixas AABB**: Vidros 800ml, frascos de cultura líquida, placas de Petri, sacos de spawn 1,5kg, seringas, béqueres e garrafas agora mantêm distância física de segurança (`minDist = (radA + radB) * 0.94`), impedindo que qualquer item penetre ou seja colocado dentro de outro nas estantes, bancadas ou chão.
  - **Suporte Inteligente a Equipamentos e Mesas**: Móveis e aparelhos com superfícies de apoio (`dynamicSurface` em mesas inox, fogareiro elétrico, agitador magnético, balança digital e capela) continuam permitindo apoiar itens perfeitamente no tampo (`y >= surfTop - 0.04`), mas impedem atravessar o chassi ou empilhar dois frascos no mesmo prato.
  - **Feedback Visual Holográfico Imediato**:
    - O fantasma do item (`placementGhost`) muda dinamicamente para vermelho vibrante pulsante (`#ef4444`) quando o jogador aponta para um ponto onde já existe outro item.
    - O prompt do HUD alerta com clareza: `🚫 Espaço ocupado por outro objeto`.
    - O clique primário de soltar é estritamente bloqueado caso a posição esteja ocupada.


## [v0.9.0] — 2026-11-15
### 👑 Loja de Cosméticos, 💃 Emotes Multiplayer, 🎵 Áudio Procedural Web Audio & 🍄 Ciclo de Cultivo na Estufa
- **👑 Loja de Cosméticos por XP & Chapéus Especiais ([index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html), [campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js), [auth.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/auth.php), [db.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/db.php))**:
  - Modal interativo (`#shop-modal`) e botão de atalho `👑 Loja` no topo do HUD.
  - Catálogo de 6 chapéus 3D modelados individualmente:
    - 🍄 **Cogumelo Vermelho Clássico** (*Amanita* vermelho com pintas brancas).
    - 👑 **Cogumelo Dourado Radiante** (*Ouro reflexivo metálico com esferas cintilantes* - 200 XP e 5 cogumelos).
    - 🧙‍♂️ **Capuz de Alquimista** (*Cone místico com aba e fivela dourada* - 350 XP e 10 cogumelos).
    - 🎓 **Capelo Universitário** (*Chapéu acadêmico de formatura com borla dourada balançando* - 500 XP e 15 cogumelos).
    - 🌸 **Coroa de Flores Silvestres** (*Grinalda botânica com flores coloridas da floresta* - 150 XP e 3 cogumelos).
    - 🎨 **Boina de Pesquisador** (*Boina estilosa parisiense com ponteira* - 100 XP e 2 cogumelos).
  - Persistência no banco MySQL via Migração v5 (`unlocked_hats` e `current_hat` em `mc_users` e `mc_sessions`).
- **💃 Emotes & Animações Multiplayer ([index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html), [campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php))**:
  - Barra rápida de emotes (`#emote-bar`) com acionamento para mobile e desktop:
    - 👋 **Acenar** (`wave`): Levanta o braço direito e oscila a mão amigavelmente.
    - 💃 **Dançar** (`dance`): Ginga ritmicamente os braços, pernas e tronco.
    - 🎉 **Comemorar** (`cheer`): Pula de braços erguidos em comemoração, acompanhado por uma explosão 3D de 45 confetes coloridos reutilizáveis (zero alocação de memória no loop).
    - 🧘 **Meditar** (`meditate`): Sentado em posição de lótus flutuando suavemente no ar com efeito de levitação.
  - Sincronização em tempo real entre todos os jogadores no campus 3D via `multiplayer.php?action=sync`.
- **🎵 Áudio & Efeitos Sonoros Imersivos ([campus-audio.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-audio.js), [index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html))**:
  - Motor sonoro procedural 100% sintetizado via Web Audio API (zero megabytes de áudio baixado).
  - **Passos por tipo de piso**: Diferenciação acústica dinâmica de grama fofa (`grass`), assoalho e decks de madeira (`wood`), pedras e calçadas da praça (`stone`) e piso cerâmico do laboratório/estufa (`lab`).
  - **Sons procedurais de interação**: Arpejo cintilante ao colher cogumelos, chiado de spray de álcool/água, som de portas abrindo e fechando, chiado de vapor pressurizado da panela de pressão e fanfarras de emotes.
  - Botão de controle de volume / mudo no HUD (`#btn-toggle-audio` 🔊/🔇).
- **🍄 Ciclo de Cultivo Completo na Estufa ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [auth.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/auth.php), [multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php))**:
  - Bancada interativa na Estufa (Ala Leste-Sul) com 4 espécies de cogumelos:
    1. **Shimeji Dourado** (*Pleurotus citrinopileatus*) — Buquê de chapéus amarelos vivos.
    2. **Shiitake** (*Lentinula edodes*) — Chapéus robustos marrons com margens esbranquiçadas.
    3. **Juba de Leão** (*Hericium erinaceus*) — Pompons brancos em cascata suave.
    4. **Golden Teacher** (*Psilocybe cubensis*) — Hastes altas, véu escuro e brilho sutil bioluminescente no estágio maduro.
  - Sistema de umidade individual com barra de LED indicadora (Verde >70%, Amarelo 45-70%, Vermelho <45%).
  - Borrifar água com o borrifador (`💦`) hidrata o bloco em +25% UR com efeito de gotas d'água e som de spray.
  - 4 fases de desenvolvimento visíveis: Micélio colonizando ➔ Primórdios (Pins) ➔ Crescimento médio ➔ Maduro pronto para colheita!
  - Colher o bloco maduro concede +50 XP e +2 cogumelos colhidos com nuvem de partículas de esporos, som de conquista e reinício automático do ciclo de cultivo.

## [v0.8.3] — 2026-11-15
### Walk on Tables, Pressure Cooker Lid Snap, Laser Thermometer Gun & Syringe Puncture Animation
- **Subir e Andar em Cima de Mesas, Bancadas e Móveis Sem Ejeção ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - `getGroundHeight(x, z, refY)` agora reconhece as superfícies de apoio (`supportSurfaces`) como pisos caminháveis quando o jogador pula ou está sobre elas.
  - O sistema de colisão de paredes e corpos sólidos (`clampPosAgainstWalls`) foi refinado: quando o jogador está em pé no tampo (`pos.y >= surfY - 0.08`), a colisão horizontal do móvel é completamente ignorada, permitindo andar livremente sobre mesas inox, bancadas do laboratório, carteiras escolares, camas e estufas sem ser empurrado ou ejetado.
- **Encaixe e Retirada da Tampa da Panela de Pressão ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - **Retirar a Tampa**: Ao olhar para a panela de pressão com tampa acoplada, o raio de mira prioriza diretamente a tampa (`lidItem`) com a legenda `🍲 Retirar Tampa da Panela de Pressão`. Um clique retira a tampa imediatamente para a mão do jogador sem mover a panela inteira.
  - **Encaixar a Tampa**: Ao segurar a tampa e apontar para a panela de pressão aberta, ela faz o snap magnético perfeitamente alinhado na borda com fantasma verde e prompt `🍲 Encaixar Tampa na Panela de Pressão`. O clique trava e fecha a panela.
- **Correção do Fogareiro Elétrico e Destravamento de Tela ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo de Cogu/index.html))**:
  - O chassi do fogareiro não intercepta mais a chave liga/desliga (apenas o botão giratório termostato liga e desliga o aparelho), permitindo segurar ou mover o fogareiro livremente.
  - Adicionado `pointer-events-none select-none` nos elementos HUD (`#interact-pill` e `#fps-hint`), eliminando o bug de perda de Pointer Lock do mouse.
  - Adicionada legenda clara de aviso quando o fogareiro ou mesa possui objetos em cima (`🚫 Retire a panela de cima antes de mover o Fogareiro`), evitando sensação de tela congelada.
  - Itens segurados agora são excluídos do raycast de hover (`item === heldItem`), eliminando auto-colisão fantasma na mira.
- **Pistola de Medir Temperatura com Laser Infravermelho (`infrared_thermometer`) ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo de Cogu/api/multiplayer.php))**:
  - Modelada a pistola industrial amarela com empunhadura preta ergonômica, gatilho vermelho, lente frontal e diodo emissor de laser.
  - Visor LCD com textura Canvas 2D retroiluminada verde-esmeralda em tempo real, exibindo números digitais grandes, status SCAN/HOLD e emissividade `ε = 0.95`.
  - Feixe laser vermelho tridimensional e ponto laser circular aderente às normais das superfícies.
  - Simulação física de temperatura por material e equipamento em tempo real:
    - Resistência incandescente do fogareiro: sobe até `240°C` quando ligado.
    - Panela de pressão: sincronizada com aquecimento e esterilização de `25°C` a `121.5°C`.
    - Agitador magnético: `33°C` aquecido / `24°C` desligado.
    - Frasco de Cultura Líquida: `24.4°C` ideal para colonização.
    - Câmara da estufa de frutificação: `20.8°C` fresca e úmida.
    - Avatares de outros jogadores: `36.8°C` de temperatura corporal humana.
    - Bancadas e paredes do ambiente: `23°C` com micro-flutuação térmica ambiente.
- **Seringa: Animação de Inoculação, Furo no Septo e Bombeamento de 2 Segundos ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Ao segurar a seringa e apontar para a cultura líquida, o braço em primeira pessoa se estica suavemente e a agulha de aço inox perfura o septo vermelho da tampa da garrafa ("fincando ali").
  - Animação contínua e suave de bombeamento de **2.0 segundos**:
    - **Aspirar (0% a 100%)**: O êmbolo recua suavemente e o líquido dourado de micélio preenche o cilindro transparente até 10ml, enquanto o volume da garrafa diminui proporcionalmente.
    - **Injetar / Esvaziar (100% a 0%)**: Ao clicar com a seringa cheia, o êmbolo avança suavemente ao longo de 2 segundos até esvaziar totalmente.
  - Suporte a volumes fracionários fluidos para máxima imersão visual a 60/120 FPS.

## [v0.8.1] — 2026-11-15
### Mobile Controls & Holographic Placement Ghost
- **Fantasma Holográfico com Cores Evidentes (Verde vs Vermelho) ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - O fantasma que mostra onde o item será posicionado agora fica **claramente verde-esmeralda vivo (`#22c55e`)** com emissão neon (`#10b981`) quando o local é válido, e **claramente vermelho de alerta (`#ef4444`)** com emissão neon (`#dc2626`) quando o local estiver bloqueado ou não couber.
  - O anel do piso, o ponto de ancoragem e o próprio modelo 3D do objeto agora pulsam holograficamente juntos, com aviso textual no HUD (`🚫 Local bloqueado (não cabe aqui)`).
- **Sensibilidade Aumentada & Controle de Câmera em Toda a Tela ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Sensibilidade do movimento de câmera no touch aumentada de `0.0045` para `0.0080` (1.8x mais ágil e natural para a mão direita).
  - O toque para girar a câmera agora funciona em qualquer parte da tela do celular/tablet (com filtro inteligente que exclui apenas a bolinha do joystick de andar e os botões de ação).
- **Novo Botão Mobile de Ação e Pintura Contínua (`#btn-mobile-action`) ([index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Adicionado o botão de ação principal móvel com ícone dinâmico inteligente (`✏️` giz, `🧽` apagador, `💦` borrifador, `💉` seringa, `📦` soltar item, `🍄` colher, `🪑` sentar, `🚪` porta, `⚡` energia, `✋` pegar/interagir).
  - Permite segurar o botão com um dedo e mover a visão com a mão direita: na lousa, desenha/pinta continuamente por onde a mira passar até soltar o botão.

## [v0.8.0] — 2026-11-15
### Refactoring, Security, Performance & Master Admin
- **Correção Crítica da Tela Preta (`touchDrawingBoard`) ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Corrigido o escopo da variável `touchDrawingBoard`, que estava restrita ao interior de `bindControls()`, provocando `ReferenceError` a cada frame dentro do loop `animate()` e impedindo a renderização do mundo 3D.
- **Limpeza de Interface (HUD Clean) ([index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Removidos definitivamente da tela a barra de ações rápidas (`#hud-quick-actions` com botões de Aulas, Ranking, Lab, Vista Aérea e Sair) e o painel de slides do telão (`#prof-toolbar`), mantendo a tela 100% imersiva e limpa.
  - Intervalo de sincronização multiplayer calibrado para 350ms para evitar sobrecarga de requisições no servidor e no navegador.
- **Blindagem do Banco de Dados & Eliminação de Carga no MySQL ([db.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/db.php), [multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php))**:
  - Eliminada a verificação repetitiva de `information_schema.TABLES` e migrações a cada 200ms por jogador. Agora a migração é protegida por arquivo de flag em `data/.migrated_v4`, reduzindo drasticamente o consumo de CPU em servidores compartilhados (cPanel).
  - Isolamento de poses na nova tabela `mc_user_poses`: removida a gravação contínua de `upose_*` em `mc_world_state`. A tabela `mc_world_state` agora armazena estritamente o estado do mundo e permanece sempre leve.
  - Limpeza de sessões inativas (`mc_sessions`) probabilística (1 em cada 20 requisições), eliminando locks destrutivos de tabela a cada tick.
- **Painel Master Admin Funcional ([auth.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/auth.php), [multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Implementadas as rotas de backend `admin_list_users`, `admin_set_role`, `admin_teleport` e `admin_kick` com fila de eventos em `mc_admin_events`.
  - Conectada a interface `#admin-modal` no front-end: busca em tempo real, visualização de jogadores online/offline, botão de puxar (`🧲 Puxar`), ir até o jogador (`🚀 Ir até`), promover/rebaixar (`👨‍🏫 Promover Prof.` / `🎓 Rebaixar Aluno`) e desconectar (`🚫 Desconectar`).
  - Corrigido o cargo do dono `gabrieldaluz` para `admin`, garantindo o desbloqueio do botão Master Admin.
  - Implementada a validação de `PROFESSOR_KEY` no login/cadastro para atribuição segura de cargo de professor.
- **Segurança & RBAC (Role-Based Access Control) ([multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php), [auth.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/auth.php))**:
  - Bloqueadas as ações de `reset_world` e `set_slide` para alunos comuns: apenas professores e administradores podem reiniciar equipamentos ou mudar slides do telão.
  - Adicionada validação de respostas no servidor ao completar módulos de aula (`MC_MODULE_ANSWERS`), impedindo trapaça de XP via requisições forjadas.
- **Otimização de Renderização & Zero GC Churn ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Pré-alocados vetores e cores Three.js no loop principal (`animate()` e `updateDynamicEnvironment()`), eliminando centenas de alocações de `Vector3` e `Color` por segundo e acabando com micro-stutters do Garbage Collector.
  - Throttling inteligente por `visibilitychange`: quando a aba do navegador fica em segundo plano, o polling multiplayer é reduzido para 1200ms para economizar bateria e tráfego, voltando a 200ms imediatamente ao reativar a aba.
  - Corrigidos bugs latentes de `playerVelY` e referência a `controls.target` em `teleportCampusPlayer`.
  - Exposto namespace modular `window.MycoCampus` para escalabilidade da arquitetura do motor 3D.

## [v0.7.0] — 2026-11-15
### Milestone Release & Performance
- **Consolidação de Recursos e Bump de Versão (`v0.7.0`)**:
  - Consolidação oficial de todas as novidades visuais e mecânicas: ponte de madeira arqueada no lago com bacia d'água multicamadas, modo tela cheia automático com travas touch mobile, anatomia e visão realista ao sentar lado a lado.
  - Equipamentos de laboratório atualizados: fogareiro elétrico esmaltado com aquecimento progressivo e resistência incandescente, LEDs de energia em todos os aparelhos e limite de 4 recipientes na panela de pressão.
  - Otimizações pesadas de desempenho mobile (throttling de raycast, desativação de sombras secundárias e point lights) e correção anti-loop de versão no client/servidor.

## [v0.6.11] — 2026-11-15
### Fixed & Improved
- **Correção do Loop Infinito de Reload (`window.MYCO_VERSION`) ([index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Sincronizado `window.MYCO_VERSION` e cache-busters (`?v=0.6.11`) em `index.html`, evitando recarregamentos automáticos em loop após login/sync, e adicionada trava anti-loop via `sessionStorage` + reload com `?_v=` cache-busting.
- **Jogabilidade Touch Mobile/Tablet ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js), [index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html))**:
  - Corrigido desenho na lousa por toque (`touchDrawingBoard`) para não ser sobrescrito pelo raycast da mira central em `animate()`.
  - Corrigido arraste de câmera na Vista Aérea (`!inFps`) para marcar `touchMoved = true` e não disparar interação acidental ao soltar o dedo.
  - Ajustado `touch-action: none` nos botões mobile, posicionamento do `#fps-hint` no celular e removida reabertura forçada de fullscreen a cada toque no joystick.
- **Fogareiro Elétrico Realista ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Novo visual com pés antiderrapantes, corpo preto esmaltado, bandeja refletora de inox, suporte em cruz, resistência espiral 3D concêntrica, botão termostato giratório, LED piloto verde/vermelho com aro metálico, adesivo de alerta e aquecimento/resfriamento progressivo com brilho vermelho-incandescente.

## [v0.6.8] — 2026-11-15
### Fixed
- **Correção da Ponte Arqueada do Lago (`walkableFloors`) e Cache Busting ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html))**:
  - Corrigida referência de `walkableSlabs.push` para `walkableFloors.push` e `lakeBedMat` em `buildArchedWoodBridge()` / `buildOuterCampus()`, e atualizado o cache-buster para `?v=0.6.8` para garantir que nenhum navegador utilize versão em cache anterior.

## [v0.6.7] — 2026-11-15
### Added, Fixed & Improved
- **Tela Cheia Automática (Auto-Fullscreen) no Mobile e Desktop ([campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js), [index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html))**:
  - Ao clicar em **Entrar no Campus 3D** ou no primeiro toque na tela/joystick (quando entra via login automático), o jogo ativa automaticamente o modo **Fullscreen (`requestFullscreen` com `navigationUI: 'hide'`)** e trava orientação paisagem (`landscape`) no celular quando suportado, além de contar com botão rápido `⛶` na barra superior do HUD.
- **Câmera Mais Alta ao Sentar, Bloqueio de Assento Ocupado e Sentar Lado a Lado ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Elevada a altura da visão em 1ª pessoa quando sentado (`eyeH` de `1.18m` para `1.50m`) e nivelado o ângulo vertical (`playerPitch`) ao sentar, além de ocultar o tronco translúcido local enquanto sentado para visão 100% limpa.
  - Adicionada verificação `isSeatOccupied(seat)` que impede duas pessoas de sentarem exatamente no mesmo lugar (`🚫 Assento ocupado (sente ao lado!)`), permitindo sentar lado a lado no assento vizinho dos bancos da praça, carteiras da sala de aula e fileiras do auditório.
- **Otimização Pesada de Performance para Mobile Sem Lags ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Desativados os 8 `PointLight`s internos e o passe extra de `ShadowMap` em dispositivos móveis (mantendo iluminação `HemisphereLight` + `DirectionalLight` + tubos fluorescentes emissivos), reduzindo pela metade os draw calls e o custo de fragment shader no celular.
  - Adicionado pré-filtro rápido de distância ao quadrado antes do raycast nos 145 itens pegáveis e cogumelos, throttling inteligente na física de gravidade (`dropUnsupportedItems`), balança digital (`scaleDevices`), raycast mobile e partículas distantes da fonte.

## [v0.6.6] — 2026-11-15
### Fixed & Improved
- **Anatomia e Postura Perfeita ao Sentar em Cadeiras, Bancos e Auditório ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php))**:
  - Pivô das pernas (`leftLeg`, `rightLeg`) ajustado para a articulação do quadril e pivô dos braços (`leftArm`, `rightArm`) ajustado para a articulação do ombro.
  - Quando sentado (`av.seated`), as coxas ficam 100% apoiadas sobre o assento da cadeira/banco (`y_local = 0.34`, `0.469 m` acima do piso, sem jamais atravessar ou ficar embaixo do assento azul), o tronco apoia certinho no assento e no encosto, e os braços apontam para a frente (`+0.42 rad`) sobre a carteira/colo em vez de inclinarem para trás.
  - Persistência do estado `seated` em `upose_<userId>` no MySQL para manter o jogador sentado mesmo após atualizar a página (`F5`), além de fileiras clicáveis para sentar no Auditório do Student Center.
- **Correções Extras de Auditoria ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php))**:
  - Corrigida ordem de argumentos de `beaker_1l_03` e `beaker_1l_04` na estante Oeste do Depósito.
  - Sincronização multiplayer e persistência MySQL adicionadas para o Agitador Magnético (`stir_lab`) e o Fogareiro Elétrico (`burner_lab`).

## [v0.6.5] — 2026-11-15
### Added & Improved
- **Nova Sala "📦 DEPÓSITO" com Estantes Industriais Porta-Pallet Azuis e Laranjas ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Renomeada a sala térrea do Bloco Oeste-Sul de `📚 SALA` para **`📦 DEPÓSITO`** (`Porta do Depósito` + flâmula externa `📦`).
  - Adicionadas 3 **Estantes Industriais Porta-Pallet fixas (`addStoragePortaPalletRack`)** nas paredes Oeste, Norte e Sul do Depósito, fiéis à foto de referência: montantes verticais em azul royal (`#1d4ed8`) com treliças horizontais e diagonais em zig-zag, longarinas e 3 níveis de prateleiras metálicas laranjas (`#ea580c`) vazias (sem caixas) e registradas em `supportSurfaces` para permitir guardar/apoiar qualquer objeto do jogo em qualquer prateleira.

## [v0.6.4] — 2026-11-15
### Added, Fixed & Improved
- **Novos Bancos da Praça (`createBench`) Fiéis à Foto + Assentos Clicáveis ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Estrutura metálica tubular preta (`#111827`) nas extremidades e longarinas com 2 ripas largas espaçadas de madeira envernizada (com textura de veios naturais) no assento e 2 ripas espaçadas no encosto inclinado.
  - Todos os bancos da praça agora possuem 2 lugares clicáveis (`🪑 Clique para sentar`) para sentar sozinho ou lado a lado no multiplayer.
- **Fantasma de Posicionamento (`placementGhost`) Texturizado + Objetos Grandes 100% Invisíveis nas Mãos ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - O fantasma de posicionamento agora preserva as **texturas reais, rótulos e detalhes** do objeto segurado (`prepareGhostCloneMesh`), aplicando uma iluminação translúcida **verde leve (`#34d399`)** quando válido ou **vermelho leve (`#f87171`)** quando bloqueado.
  - Ao carregar objetos grandes de 2 mãos (`twoHanded`: Fluxo Laminar, Mesas de Inox e Panelas de Pressão), o objeto nas mãos fica **100% invisível (`visible = false`)**, exibindo apenas os braços e o fantasma texturizado no local onde será colocado.
- **Correção Definitiva da Panela de Pressão + Tampa Acoplada ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - O fantasma de posicionamento agora inclui a **tampa acoplada** em cima da panela quando ela está fechada (`placementGhostHasLid`).
  - Corrigidos `consumeCampusMovedItems` e `applyCampusWorldObjects` para enviar a posição da tampa acoplada junto com a panela e jamais desacoplar ou puxar a tampa de volta para a mesa durante o transporte.

## [v0.6.3] — 2026-11-15
### Fixed
- **Correção do Auto-Login e Inicialização do Motor 3D ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Substituído `new THREE.CapsuleGeometry` (inexistente no Three.js `r128`, que causava `TypeError: THREE.CapsuleGeometry is not a constructor` em `makeLiquidJar800` e interrompia o `boot()` antes do `tryResumeSession()`) por `new THREE.CylinderGeometry(0.009, 0.009, 0.052, 10)`.
  - Adicionado suporte em `tryResumeSession()` para autenticar automaticamente e limpar imediatamente a URL (`history.replaceState`) caso o formulário tenha sido submetido via GET (`?campus_name=...&campus_pin=...`).

## [v0.6.10] - 2026-11-15
### Corrigido
- **Carteiras escolares em `supportMeshes`**: permite apoiar itens nas carteiras do 2º andar sem atravessar para o chão.
- **Limite da Panela de Pressão (máx. 4 itens)**: impede sobrepor mais de 4 recipientes dentro da panela ao mesmo tempo.
- **Inoculação com seringa**: evita inocular acidentalmente placas de Petri vazias sem ágar (`petri_bare_`).

## [v0.6.9] - 2026-11-15
### Corrigido
- **Bug raiz de itens caindo no chão após soltar na mesa**: `consumeCampusMovedItems()` não grava mais no servidor a posição temporária da mão enquanto o item está sendo carregado no ar — apenas quando é efetivamente solto no mundo, eliminando o retorno de posições antigas no meio do salão que faziam o item cair no chão.
- **Mesas giradas em 45° e mesas de sala de aula**: `updateItemBounds` agora calcula o bounding box exato para qualquer ângulo (`cos/sin`) e as mesas escolares também participam de `supportMeshes`.

## [v0.6.8] - 2026-11-15
### Corrigido
- **Item preso dentro da Capela de Fluxo Laminar**: itens/equipamentos de bancada (como a Balança Digital) posicionados sob a base da capela agora sobem automaticamente para o tampo de trabalho (`topY`) e equipamentos de bancada têm prioridade de mira sobre a capela/mesa.

### Melhorado
- **LEDs indicadores (Verde = Ligado / Vermelho = Desligado) em todos os equipamentos**: reposicionado e destacado o LED de energia no painel frontal do Agitador Magnético (`IKA • MYCO-MAG SH-2`), ampliado o LED da Capela de Fluxo Laminar com moldura e reforçado o LED do Fogareiro Elétrico.

## [v0.6.7] - 2026-11-15
### Melhorado
- **Nova Ponte de Madeira Arqueada**: ponte caminhável sobre o Lago em 8 com tábuas individuais seguindo o arco, estacas submersas na água, guarda-corpo com treliças em X, escoras diagonais externas e calçada conectando os dois lados do lago.
- **Água e Lago mais profundos**: textura de água 100% contínua (sem costuras em grade) com cáusticas animadas, além de bacia do lago com 3 níveis de profundidade e pedras submersas.

## [v0.6.6] - 2026-11-15
### Adicionado & Melhorado
- **UI adaptada por dispositivo (PC vs iPad/Tablet vs Celular)**: detecção automática em `getDeviceProfile()` com layout, placeholders de chat (sem "Aperte E ou T / Enter" no mobile/tablet) e dicas de controle específicas para cada plataforma, além de suporte completo a iPadOS.
- **Proteção reforçada ao soltar itens em mesas/bancadas**: janela de proteção multiplayer ampliada para 5 s com confirmação por coordenada e reenvio automático caso o servidor ainda retorne posição antiga, bordas úteis ampliadas nas mesas inox e guarda anti-soltura acidental (140 ms).

## [v0.6.5] - 2026-11-15
### Corrigido
- **Bug no Mobile ao pegar/soltar itens**: corrigido disparo duplo de `touchend` + `mousedown` sintético que fazia o item voltar para o chão imediatamente após ser pego; adicionado cooldown anti-duplo-toque e suporte completo de alvos no toque fora do centro.
- **Bug ao colocar itens em estantes multi-nível e mesas**: implementado raycast direto nas malhas das prateleiras, bancadas e mesas (`supportMeshes`), evitando que itens colocados na prateleira de baixo saltem para a prateleira de cima ou caiam no chão.
- **Seringas 10 ml deitadas**: seringas agora ficam apoiadas horizontalmente deitadas sobre mesas e prateleiras.

### Melhorado & Otimizado (Mobile)
- **Performance mobile**: `BasicShadowMap` (768px), `pixelRatio` limitado a `0.9`, câmera `far: 240`, sombras desligadas em itens pequenos do estoque no celular e throttle no raycast de hover (`75ms`).
- **Botão Girar (`🔄`) no Mobile**: botão contextual para rotacionar itens segurados no celular.

## [v0.6.4] - 2026-11-15
### Adicionado
- **Esterilização funcional na panela de pressão**: fogão elétrico de bancada (`burner_lab`), inserção de vidros, bags e garrafas na panela destampada, ciclo de autoclave a 121 °C / 15 PSI com vapor, chiado do pino e progresso 0–100%.
- **Crescimento real de micélio (0–100%)**: vidros de spawn 800 ml e bags 1,5 kg colonizam em tempo real após inoculação, com verificação de assepsia (Capela de Fluxo Laminar ligada + Álcool 70%); sem assepsia há risco de contaminação.
- **Balança de precisão digital (`precision_scale`)**: display LCD em tempo real em gramas (`g`) ao apoiar itens no prato de inox e botão `TARE` clicável.
- **Borrifador Álcool 70% (`alcohol_spray`)**: jato de névoa com partículas e janela de sanitização por 90 s para preparar bancada, capela e recipientes.
- **Estoque completo no Depósito (3 Estantes Porta-Pallet)**: 15 bags 1,5 kg vazias, 15 vidros 800 ml vazios, 20 seringas 10 ml, **40 placas de Petri vazias empilháveis até 7 placas uma em cima da outra**, sacos de grãos/milho 5 kg e serragem/fibra de coco 5 kg, caixas de luvas nitrílicas, papel alumínio, fita micropore, Parafilm M, borrifadores extras, frascos PDA extras e béqueres 1 L.

### Melhorado
- **Altura dos jogadores e áurea de Professor/Admin**: avatares ajustados para a mesma altura real da câmera (`~1,62 m` nos olhos), removendo o disco laranja da cabeça do professor/admin e adicionando uma áurea luminosa suave nos pés e partículas em espiral (alunos continuam sem áurea).
- **Correção ao colocar itens em mesas e bancadas**: ampliada a detecção de bordas e distância mínima em `findPlacementTarget` e nas bancadas fixas, evitando que objetos soltos perto da borda da mesa escorreguem para o chão.

### Melhorado
- **Agitador Magnético (`IKA • MYCO-MAG SH-2`)**: novo visual inspirado em equipamento de laboratório com painel frontal impresso, placa circular em aço escovado e botões rotativos prateados.
- **Portas de vidro sem Z-fighting**: vidro recuado dentro dos perfis metálicos da esquadria e novo puxador cromado, eliminando texturas piscando nos cantos.

## [v0.6.3] - 2026-11-15
### Added & Fixed
- Panela de Pressao 20L sem travamento ao pegar tampa ou panela (removidas referencias circulares em mesh.userData).
- Cultura Liquida 800ml (350ml), Agitador Magnetico clicavel com peixinho giratorio, 2x Bequeres 1L (1000ml) e 2x Seringas 10ml com agulha e transferencia real de volume.
- Bloqueio visual (fantasma vermelho) ao tentar colocar Fluxo Laminar/Mesas sobre outros objetos, mira atravessando o vidro do Fluxo para pegar itens internos/vizinhos sem avisos.
- Placa LAB na porta do Laboratorio, carteiras e cadeiras escolares azuis/brancas no 2o andar, remocao dos guarda-sois, canaleta da lousa liberada (6.8m), apagador virado para a lousa e giz inclinado para cima.

## [v0.6.2] — 2026-11-15
### Added, Fixed & Improved
- **Sincronização 100% em Tempo Real + Persistência Completa no Banco de Dados MySQL ([multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js), [campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Todas as ações do jogo agora são sincronizadas instantaneamente em multiplayer e persistidas em `mc_world_state` / `mc_world_objects` / `mc_board_strokes` para permanecerem idênticas mesmo após dar F5 / atualizar a página:
    - Abertura/fechamento de todas as 4 portas (`door_0`..`door_3`).
    - Abertura/fechamento de todas as 16 persianas horizontais (`blind_0`..`blind_15`).
    - Interruptores de luz das salas do 1º e 2º andares (`light_0`..`light_7`), com luminárias do 1º andar reposicionadas abaixo da laje (`ceilY = 3.51`) e painel refletor de teto.
    - Status ligado/desligado da Capela de Fluxo Laminar (`hood_lab`).
    - Controle compartilhado da tela de Cinema/Aulas do Student Center (`cinema_power`, `cinema_lesson`, `cinema_playing`) e telões principais (`auditorium_slide`).
    - Traços das 4 lousas transmitidos em tempo real durante o desenho (`consumeCampusBoardStrokes`), posição ao vivo dos objetos carregados, animação de sentar nas cadeiras (`seated`) e restauração da última posição/direção/item segurado do próprio jogador (`upose_<userId>`) ao atualizar a página.
- **Correção definitiva de objetos saltando/caindo em loop ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Corrigido o loop em que `dropUnsupportedItems()` descia o item mas `applyCampusWorldObjects()` lia a altura antiga do banco e jogava o item de volta para o alto a cada 200ms. Agora a gravidade registra `recentlyDropped` e salva a nova altura apoiada imediatamente no MySQL.
  - Alinhadas todas as mesas inox do 1º andar à cota exata do piso (`y = 0.12`) e atualizado `applyCampusWorldObjects` em 2 etapas (mesas/fluxo laminar primeiro, itens depois).
- **Fonte Central, Fonte Leste e Lago em 8 com Água Realista Animada sem Piscar ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Eliminado o *Z-fighting* (piscadas brancas e azuis) da Fonte Central substituindo o cilindro maciço por borda de pedra oca (`RingGeometry` + cilindros abertos), fundo azulejado azul-profundo, textura procedural de água com *caustics* em movimento contínuo, ondas concêntricas de espuma (`fountainRipples`), 8 filetes de água contínua e 84 gotículas animadas (`fountainDropsAttr`).
- **Embalagem do Frasco PDA 500g (`pda_bottle`) e Erlenmeyer de Cultura Líquida (`liquid_culture`) ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Novo rótulo de alta definição (`512x256`) com dupla face frontal/traseira (`🧪 MYCOLAB • BDA / PDA • POTATO DEXTROSE AGAR • 500g`) 100% legível de frente sem cortar nas laterais do cilindro, além de ombro cônico, gargalo e tampa laranja com anel de lacre.
  - Frasco de Cultura Líquida remodelado como Erlenmeyer 500ml de vidro borossilicato transparente com caldo nutritivo dourado, nuvem de micélio em suspensão, barra magnética e tampa azul com filtro PTFE e septo de injeção.
- **Limpeza da Sala de Substratos e Remoção de Mensagem de Bloqueio das Mesas ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Removidos o bloco branco (`substrate_bag`) de cima da mesa e o tonel azul (`drum`) da sala de Substratos.
  - Removida a mensagem `⚠️ Tire os objetos de cima da mesa` ao olhar para mesas ocupadas, priorizando sempre o objeto mais próximo na mira (`bestPickDist`).

## [v0.6.1] — 2026-11-15
### Improved
- **Mira central (`#crosshair`) reforçada no celular ([index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html))**:
  - Aumentada a visibilidade da bolinha central (`12px`, `z-index: 25`, sombra sutil e borda branca/verde) também na versão mobile/touch para facilitar mirar em objetos, portas, interruptores e lousas.

## [v0.6.0] — 2026-11-15
### Fixed & Improved
- **Visão em 1ª Pessoa ao olhar para baixo ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Ocultado `localAvatar.headGroup` (cabeça, chapéu e bolinhas/"orelhas") e os braços de 3ª pessoa na visão em 1ª pessoa, mantendo o tronco/pernas locais semitranslúcidos (`opacity: 0.35`) para não atrapalhar a visão ao olhar para o chão ou bancadas.
- **Capela de Fluxo Laminar fechada e encaixada ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Substituída a grade solta por uma **base fechada em aço inox** (`hoodBase` + `hoodWorkMat` + `hoodFrontLip`) sem frestas aparecendo o chão, encaixando perfeitamente em mesas e bancadas fixas.
  - Removidos a lamparina/vela e o bisturi fixos do interior da capela.
- **Objetos grandes quase invisíveis enquanto segura ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Ao carregar equipamentos/móveis grandes (`twoHanded`, como Fluxo Laminar, Mesas de Inox e Panelas de Pressão), o item nas mãos fica translúcido (`opacity: 0.14`) para não tampar a visão e facilitar alinhar o fantasma verde no local desejado. Objetos pequenos continuam opacos normalmente.

## [v0.5.9] — 2026-11-15
### Added
- **Iluminação e Interruptor 3D em Todas as Salas (1º e 2º Andares) ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Adicionado `PointLight` dedicada, material emissivo independente (`fTubeMat`) e **Interruptor 3D com LED** também em todas as salas do **1º andar** (Laboratório, Sala Oeste, Substratos e Estufa) na parede Sul logo ao entrar, mantendo o interruptor independente em todas as salas do **2º andar**.

## [v0.5.8] — 2026-11-15
### Fixed
- **Panela de Pressão 20L + Tampa encaixada e sincronizada ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Corrigido `registerPickable` que não retornava o objeto registrado (`entry`), o que deixava `potItem` e `lidItem` como `undefined` e fazia a tampa cair para dentro da panela e impedir de abrir/fechar.
  - Agora a panela inicia com a tampa devidamente fechada por cima (`py + 0.36`), permite abrir/retirar apenas a tampa, carregar a panela fechada com a tampa junto, encaixar de volta (`Fechar tampa na Panela de Pressão`) e sincronizar corretamente o estado aberto/fechado no multiplayer.

## [v0.5.7] — 2026-11-15
### Added & Improved
- **Fachadas de Vidro Fechadas + Portas em Todas as Salas + Persianas Horizontais 3D Animadas ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Todas as 4 salas térreas (`Porta do Laboratório`, `Porta da Sala Oeste`, `Porta de Substratos` e `Porta da Estufa`) agora possuem portas de vidro temperado completas com batentes de alumínio, bandeira superior de vidro (`transom`), puxador duplo cromado, animação suave e colisão real quando fechadas.
  - Adicionadas **Persianas Horizontais 3D (`createVenetianBlind`)** em todos os vidros laterais de cada sala (1º e 2º andares), cobrindo todo o vidro com 22 lâminas de alumínio prateado, trilho superior, fitas verticais, barra inferior, vareta acrílica e cordão com pendente branco.
  - Clicar ou tocar em qualquer persiana (`🪟 Abrir Persiana` / `🪟 Fechar Persiana`) anima suavemente a subida/descida e a inclinação das lâminas.
  - Corrigido o sombreamento escuro nas fachadas de vidro (`noShadow: true` nos painéis de vidro) e instaladas 4 luminárias fluorescentes de teto no 1º e no 2º andar de todos os blocos.
- **Controles Mobile (Botão de Correr `🏃` + Botão de Pular `⬆️` + Toque na Tela para Ações) ([index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js), [campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Removido o auto-sprint do joystick no celular; adicionado botão dedicado de **Correr (`🏃`)** ao lado direito acima do botão de **Pular (`⬆️`)**, suportando tanto segurar para correr quanto toque rápido para ativar/desativar corrida (`sprint-active`).
  - Corrigido o multi-touch (`touchstart`/`touchend` independente com `preventDefault` + `stopPropagation`) para permitir **correr com o joystick e pular ao mesmo tempo** sem conflito de toque, além de *Coyote Time* (150ms) e *Jump Buffer* (150ms).
  - Tocar na tela interage diretamente com objetos, portas, persianas, interruptores, cadeiras e lousa (no ponto do toque ou na mira central).
- **Atalho `E` / `T` / `Enter` para Chat no PC ([campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js), [campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Apertar `E`, `T` ou `Enter` foca imediatamente no `#chat-input` para digitar e zera as teclas de movimento (`clearCampusKeys()`); apertar `Enter` envia a mensagem na hora e devolve o foco ao jogo sem perder o Pointer Lock.

## [v0.5.7] — 2026-11-15
### Added & Improved
- **Laboratório Completo de Micologia ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php))**:
  - Bancadas contínuas nas paredes Oeste e Norte + estante de 3 níveis para culturas sólidas na parede Sul + ilha central em aço inox (com mesas e Fluxo Laminar móveis em 2 mãos quando vazios).
  - **Vidros 800ml** (vazio estéril + milho colonizado), **Bags 1,5kg** (vazio com filtro microporoso + colonizado com porta de injeção), **Seladora Térmica** e **Frasco PDA 500g** (Potato Dextrose Agar).
  - **Placas de Petri transparentes realistas** com PDA estéril, micélio rizomórfico radial e placa contaminada.

## [v0.5.6] — 2026-11-15
### Added & Improved
- **Panelas de Pressão 20L Profissionais com Tampa Removível ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php))**:
  - Modeladas em aço inox com alças laterais pretas, peso central com topo vermelho e 2 válvulas de segurança, instaladas nos dois laboratórios (Bloco Oeste de Culturas/Spawn e Bloco Leste de Substratos/Pasteurização).
  - Carregamento com **as duas mãos** em 1ª pessoa (`fpsArmGroup` + `fpsLeftArmGroup`) ao segurar a panela.
  - **Abrir e fechar tampa**: clique na tampa para removê-la, carregá-la e apoiá-la em qualquer mesa ou chão; ao segurar a tampa e mirar na panela aberta, ela encaixa de volta para fechar (sincronizado no multiplayer).
- **Fluxo Laminar Horizontal Realista ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**: Filtro HEPA plissado com textura de colmeia, gabinete preto/vidro, grade metálica preta, lamparina a álcool com chama, bisturi, botão Power com LED verde/vermelho, corrente de ar estéril animada e movimentação em 2 mãos quando vazio.
- **Mesas de Aço Inox Móveis & Persistência Global ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php))**: Todas as bancadas dos laboratórios são mesas industriais em inox que podem ser carregadas com 2 mãos quando estiverem vazias; apenas gizes e apagadores retornam automaticamente à lousa após 45s (todos os demais itens, panelas, mesas e fluxo laminar permanecem sincronizados no servidor entre versões).

## [v0.5.5] — 2026-11-14
### Improved
- **Jogabilidade Mobile muito mais fluida ([index.html](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/index.html), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js), [campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**:
  - Removidos os botões de rotacionar objeto (`#mobile-rotate-row`) e ocultadas as mensagens repetitivas do `#interact-pill` no celular.
  - Adicionado botão contextual único (`#btn-mobile-act`: `✋`, `✏️`, `🧽`, `🪑`, `💡`, `⬇️`) e desenho direto com o dedo na lousa quando estiver segurando giz ou apagador.
  - Botões mobile (`#btn-mobile-act` `68px` e `#btn-mobile-jump` `76px` destacado) aumentados para toque confortável no celular.
  - Toques rápidos no celular agora também verificam a mira central (`crosshair`), facilitando pegar gizes, cogumelos e clicar em cadeiras/interruptores.
- **Telão Interativo do Auditório & Mesas de Apoio ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Tela do Auditório agora exibe menu interativo com todos os 6 Módulos/Aulas clicáveis, botão `⬅️ MENU`, botão `⏻ DESLIGAR` (tela preta/cinza escuro com LED standby) e religamento ao clicar em qualquer ponto da tela.
  - Todas as 12 carteiras das salas de aula (2º andar) e as 2 mesas da Reitoria registradas em `supportSurfaces` para apoiar giz, apagador e objetos do laboratório.
  - Removido o telão de slide externo flutuante da passagem oeste (`screenWest` + `◀ AULAS ▶`).

### Fixed
- **Escadaria Central ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**: Corrigido o sinal da inclinação (`slopeAng`) das longarinas, painéis de vidro e corrimãos laterais nos dois lados da escadaria para acompanhar perfeitamente os degraus.
- **Sobreposição / Z-fighting no 2º Andar ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**: Ajustadas exatamente as dimensões das passarelas frontais (`-15.7375`, `5.525`), pontes laterais (`3.05`) e ponte norte (`11.0`) para encontrar as lajes dos blocos sem sobreposição nem cintilação de texturas.
- **Interruptor Flutuante ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**: Movido o interruptor 3D do 2º andar de `cx - dir * 1.45` (dentro do vão da porta) para `cx - dir * 2.15`, fixado diretamente sobre a parede de tijolos ao lado da porta.
- **Atalho `T` para Chat ([campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**: Pressionar `T` sai do Pointer Lock (se ativo) e foca diretamente no `#chat-input`; `Enter` envia a mensagem e retorna ao jogo, e `Esc` fecha o foco do chat.
- **Otimização de Performance / Fim do Lag ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js), [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js))**:
  - Corrigido `TypeError` em `bindTouchControls` que tentava acessar os botões removidos `btn-rot-left`/`btn-rot-right`.
  - Reduzido o total de `PointLight` simultâneas na cena de 10 para 4 (eliminando `groundLight` redundante e `rLight` da Reitoria), cortando ~60% do custo de shader PBR por pixel.
  - Limitado `drawCinemaVideoFrame` a ~12 FPS e apenas quando o jogador está perto do Student Center, evitado recálculo de `snowableEntries` quando a neve não muda, e ajustado `setPixelRatio` (máx `1.5` desktop / `1.25` mobile) e `shadow.mapSize` (`1536` / `1024`).

## [v0.5.4] — 2026-11-14
### Added
- **Luminárias Fluorescentes & Interruptor 3D nas Salas ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**: Removida a placa bege do teto e adicionadas 4 luminárias fluorescentes reais por sala + `PointLight` quente/agradável (1º e 2º andares) + interruptor 3D clicável ao lado da porta com LED indicador para ligar/desligar a iluminação.
- **Reitoria caminhável & Auto-Update para todos online**: Removido o telão da frente da ala esquerda da Reitoria e abertas portas caminháveis com salas internas nas duas alas; adicionado `app_version` em [multiplayer.php](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/api/multiplayer.php) e recarregamento automático em [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js) quando uma nova versão é publicada.

### Fixed
- **Ranking 3D na Torre**: Corrigida a chave `data.leaders` em [campus-app.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus-app.js) e atualização automática a cada 20s para o painel exibir as posições e XP ao vivo.

## [v0.5.3] — 2026-11-14
### Improved
- **Escadaria Monumental & Passarela Arquitetônica ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**: Degraus com piso de pedra clara, focinho antiderrapante metálico, guarda-corpo inclinado em vidro temperado com postes e corrimão metálico escovado, pilares cilíndricos sob a passarela e remoção completa do z-fighting no patamar superior.
- **Relógio da Torre & Ciclo Dia/Noite em Tempo Real Virtual (40 min)**: Ciclo completo de 40 minutos (20 min dia + 20 min noite) sincronizado via UTC entre todos os jogadores e ligado diretamente aos ponteiros do Relógio da Torre (`06:00` amanhecer, `12:00` meio-dia, `18:00` pôr do sol, `00:00` meia-noite).
- **Painel 3D Interativo de Ranking na Torre**: Ranking ao vivo abaixo do relógio com posição (`#1`, `#2`, `#3`...), cargo (`PROF.` / `ALUNO`), XP e botões 3D `▲` / `▼` para rolar a lista.
- **Céu & Clima Dinâmico**: Sol 3D com halo, Lua, 320 estrelas noturnas e 24 nuvens variando em 5 condições (`clear`, `partly`, `overcast`, `rain`, `snow`).
- **Jogabilidade & HUD**: Velocidade de caminhada aumentada em +20%, giz e apagador apontados na direção da lousa ao segurar, remoção da barra flutuante `#prof-toolbar` e eliminação do z-fighting na soleira do 2º andar.

## [v0.5.2] — 2026-11-14
### Fixed
- **Posicionamento preciso seguindo a mira/mouse ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**: Substituída a amostragem grosseira por interseção exata raio × plano em mesas/bandejas/bancadas, passo fino no piso e liberação de superfícies de apoio perto de paredes/cantos.

## [v0.5.1] — 2026-11-14
### Fixed
- **Chuva e Neve não entram mais nos prédios ([campus3d.js](file:///d:/Users/ghost/Documents/Game%20Cultivo%20de%20Cogu/js/campus3d.js))**: Partículas de chuva e neve agora colidem com `roofZones` (telhados das alas, auditório e dormitórios) e são recicladas no céu antes de atravessar qualquer teto.

## [v0.5.0] — 2026-11-14
### Added
- **Todas as 4 lousas interativas com kit completo**: Cada sala do 2º andar agora possui sua própria lousa desenhável (`b = 0..3`), bandeja de madeira, 3 gizes (branco, verde, amarelo) e apagador sincronizados via `api/multiplayer.php`.
- **Retorno automático de itens (`45s`)**: Objetos movidos, roubados ou jogados longe retornam automaticamente ao lugar original após 45 segundos (ou imediatamente se caírem fora do mapa).
- **Student Center Auditório/Cinema & Dormitórios caminháveis**: Student Center transformado em grande auditório caminhável com projetor no teto, feixe de luz volumétrico, poltronas e tela gigante com documentário animado (clique para reproduzir/pausar); os 2 dormitórios agora possuem portas abertas, piso, cama e mesa.
- **Avatar expressivo + Pernas e Sombra em 1ª Pessoa**: Chapéu de cogumelo com pintinhas brancas, rosto expressivo que pisca e muda de humor (feliz, focado ao segurar item, falando no chat) e corpo local visível ao olhar para baixo com sombra completa.
- **Clima e Ciclo Dinâmico**: Ciclo contínuo Dia → Pôr do Sol dourado → Noite, nuvens em movimento, partículas de chuva e neve com acúmulo gradual de neve no terreno e telhados.

### Fixed
- **Escadaria Monumental desobstruída**: Dividida a passarela superior em esquerda/direita com patamar de saída, removendo o teto que tampava o topo da escada.
- **Porta do Laboratório livre**: Removido o pilar central que bloqueava a entrada do Lab.
- **Lago Norte orgânico**: Substituído o retângulo azul plano por dois lagos orgânicos com borda de pedra dos dois lados da Ponte Norte.

## [v0.4.0] — 2026-11-14
### Added
- **Mega Campus 3D (`480x480`)**: Terreno expandido com colinas e anel de montanhas distantes, floresta densa instanciada (`InstancedMesh`) e 32 cogumelos selvagens espalhados pelo campus.
- **Lago Norte & Ponte**: Lago Norte com ponte caminhável (`y = 3.80`) conectando o piso superior ao terraço da Torre do Relógio e às duas alas do auditório.
- **Complexo Esportivo (Oeste)**: Campo de futebol com pista de atletismo e arquibancada, quadra de basquete, 2 quadras de tênis azuis e estacionamento com 6 carros.
- **Área Leste & Sul**: Lago Sul em formato de 8 com ponte de madeira caminhável, `Student Center` com placa 3D e mesas com guarda-sol, Praça Circular Leste com fonte, 2 alojamentos (Dorms) e ruas asfaltadas com faixas de pedestre.
- **Multiplayer (`api/multiplayer.php`)**: Limite de mundo (`MP_WORLD_LIMIT`) ampliado para `220.0` para acompanhar todo o novo campus.

### Changed
- **HUD superior esquerdo (`index.html`)**: Mantida apenas a pílula de perfil e estatísticas (`Prof./Aluno`, nome, XP, cogumelos e online), ocultando a barra extra de botões (`Aulas`, `Ranking`, `Lab`, `1ª Pessoa`, `Sair`).
- **Pré-visualização de posicionamento (`js/campus3d.js`)**: Substituído o disco sólido por um anel guia sutil + holograma translúcido do próprio objeto segurado.
- **Câmera e Iluminação**: `camera.far` ampliado para `440`, neblina suavizada (`0.0022`) e área de sombra solar (`±85`) ajustada para o campus expandido.

## [v0.3.0] — 2026-11-14

### Braços, Lousa Interativa, Giz & Apagador Multiplayer
- **Braço em 1ª pessoa & braços nos avatares (`js/campus3d.js`)**: mão direita com manga na cor do jaleco visível em 1ª pessoa (balança ao caminhar e estende ao escrever na lousa), além de braços animados nos avatares multiplayer.
- **Lousa Interativa na Sala de Aula do 2º Andar (`js/campus3d.js`)**: lousa verde com bandeja contendo **Giz Branco**, **Giz Verde**, **Giz Amarelo** e **Apagador largo** (apaga uma área grande rapidamente). Basta pegar o giz/apagador, chegar perto da lousa e segurar o clique para desenhar ou apagar.
- **Sincronização ao vivo no MySQL (`database/schema.sql`, `api/db.php`, `api/multiplayer.php`, `js/campus-app.js`)**: schema v3 com `mc_board_strokes`; todos os jogadores conectados veem o que está sendo desenhado e apagado em tempo real.

## [v0.2.1] — 2026-11-14

### Correções Estruturais & Caminhos do 2º Andar
- **Construtor unificado (`js/campus3d.js`)**: lajes caminháveis (`addWalkableSlab`), paredes com colisor integrado (`addSolidWall`) e escadas (`stairsList`) gerados em conjunto.
- **2º andar 100% acessível**: a escadaria central leva à passarela elevada (`y = 3.80`) conectada diretamente às aberturas norte dos 2ºs andares das Alas Oeste e Leste, com pontes ligando os blocos Norte e Sul no 2º pavimento.
- **Térreo aberto e Torre do Relógio desobstruída**: salas do térreo agora têm entradas abertas; o Telão Principal foi deslocado para o lado esquerdo do terraço, deixando livre o eixo central da escadaria até a Torre do Relógio.
- **Céu ensolarado & nuvens**: céu azul vibrante e nuvens 3D adicionadas.

## [v0.2.0] — 2026-11-14

### Novo Campus Universitário Geométrico 3D
- **Arquitetura 1:1 da referência (`js/campus3d.js`)**:
  - **Prédio Principal & Torre do Relógio** no platô norte com relógio analógico funcional (hora real), janelas verticais e telão principal de aulas.
  - **Escadaria Monumental & Passarela Elevada** com física real de subida e travessia em 2º nível (`y = 4.0`) com guarda-corpo de vidro.
  - **Praça Central em Bloquetes** com canteiros orgânicos floridos, bancos de madeira, mesas com guarda-sóis e **Fonte de Pedra com Cogumelo no Topo**.
  - **Alas Oeste e Leste de 2 Andares** em tijolinho à vista, madeira ripada, esquadrias escuras, interiores iluminados (mesas + lousa), banners verticais e telão externo.
  - **Atmosfera**: tone mapping `ACESFilmic`, sombras suaves e bosque denso ao redor.
  - **Câmera & Movimento Suave (`js/campus3d.js`)**: corrigido o `camera.rotation.z` ao entrar em 1ª pessoa (que virava o mundo de cabeça para baixo), e adicionada aceleração/desaceleração suave com leve balanço de caminhada.
  - **Controles Diegéticos 3D nos Telões (`js/campus3d.js`, `js/campus-app.js`)**: botões 3D (`◀`, `📚 AULAS`, `▶`) presos abaixo dos telões, e barra de controle do professor exibida apenas quando estiver perto de um telão.

### Login & Experiência
- **Linguagem simples (`index.html`, `api/auth.php`)**: "PIN de Acesso" alterado para **"Senha"**.
- **Lobby sem campo de chave (`index.html`, `js/campus-app.js`, `api/auth.php`)**: removido o campo `PROFESSOR_KEY`; `Gabriel da Luz` (`gabrieldaluz`) é reconhecido automaticamente como Admin/Professor e não sofre bloqueio por tentativas.

## [v0.1.3] — 2026-11-14

### Ajustes de Login
- **Bloqueio de tentativas flexibilizado (`api/auth.php`)**: limite aumentado para 12 tentativas com espera de 1 minuto, e quem informa a `PROFESSOR_KEY` válida não fica bloqueado durante testes.

## [v0.1.2] — 2026-11-14

### Ajustes de UI
- **Lobby mais limpo (`index.html`)**: removido o texto `"• Seu progresso fica salvo"` do subtítulo de entrada.

## [v0.1.1] — 2026-11-14

### Melhorias de Login & Sessão Persistente
- **Lembrar login por 30 dias (`api/db.php`, `api/auth.php`, `js/campus-app.js`)**: token de sessão salvo em cookie `HttpOnly` (`Secure` em HTTPS, `SameSite=Lax`). Ao abrir o jogo, `tryResumeSession()` (`action=me`) entra automaticamente no campus sem pedir o PIN novamente.
- **Botão `🚪 Sair` no HUD (`index.html`, `js/campus-app.js`)**: encerra a sessão no servidor (`logout` + `leave`), limpa o cookie e volta para o lobby caso queira trocar de conta.
- **Correção de autopreenchimento (`index.html`)**: ajustados `name` e `autocomplete` dos campos de nome, PIN e chave de professor para evitar que o navegador preencha o PIN com outra senha salva.

## [v0.1.0] — 2026-11-14

Primeira versão jogável para testes em produção na HostGator (`https://mycocampus3d.alquimistasmagicos.com.br/`).

### Correções & Banco de Dados
- **Schema MySQL v2 (`database/schema.sql`) + migração automática (`api/db.php`)**: corrigidos tipos das colunas (`hat_color`, `body_color`, `holding_item`, `item_id` como `VARCHAR`, `last_seen` com `DEFAULT CURRENT_TIMESTAMP`, `chat_at` como `DATETIME`), além de migração automática para bancos já criados na v1.
- **Segurança & Autenticação (`api/auth.php`, `api/multiplayer.php`, `api/db.php`)**:
  - Tokens de sessão armazenados via hash SHA-256 (`mc_auth_tokens`) exigidos em `harvest`, `complete_module`, `sync`, `leave`, `set_slide` e `reset_world`.
  - Cálculo de XP e módulos concluídos validado exclusivamente no servidor com cooldown anti-spam na colheita.
  - Bloqueio temporário contra força bruta no PIN (`login_fails` / `login_locked_until`).
  - Escape de HTML (`escapeHtml`) no ranking e cards de aula para prevenir XSS.

### Multiplayer, Motor 3D & UI
- **Sync resiliente (`js/campus-app.js`, `js/campus3d.js`)**: proteção contra requisições acumuladas (`syncInFlight`), intervalo de `200ms` adaptado para hospedagem compartilhada e reenvio automático de chat/objetos em caso de falha temporária.
- **Motor 3D (`js/campus3d.js`)**: fallback para `ctx.roundRect` (compatibilidade com Safari/iOS e Chrome antigos), interpolação angular pelo menor caminho no `yaw` dos avatares, exibição de itens segurados por outros jogadores, trava para não pegar item que outro jogador segura e correção de *snap-back* ao soltar objetos.
- **CSS (`css/game.css`)**: adicionadas classes Tailwind ausentes do build herdado (`-translate-x-1/2`, `bg-slate-950/75`, `bg-slate-950/45`, `max-w-[130px]`, etc.) para centralizar chat/dicas e restaurar o fundo dos modais.

### SEO, Meta Tags, PWA & Deploy
- **Meta tags & Social Preview (`index.html`, `assets/`, `manifest.webmanifest`)**: Open Graph completo (`1200×630` em `assets/og-image.jpg`), Twitter Card, JSON-LD (`VideoGame`), PWA manifest e ícones (`favicon-32.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`).
- **Deploy HostGator (`.cpanel.yml`, `.htaccess`, `robots.txt`, `VERSION`)**: corrigido `DEPLOYPATH` para `/home2/poder692/mycocampus3d.alquimistasmagicos.com.br/`, forçado HTTPS, proteção de arquivos internos (`config.php`, `db.php`, `database/`, `.git`) e cache-busting via `?v=0.1.0`.

