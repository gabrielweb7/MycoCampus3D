# Changelog — MycoCampus3D

Todas as versões relevantes do projeto são registradas aqui seguindo [Semantic Versioning](https://semver.org/).

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

