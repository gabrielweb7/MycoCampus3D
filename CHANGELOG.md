# Changelog — MycoCampus3D

Todas as versões relevantes do projeto são registradas aqui seguindo [Semantic Versioning](https://semver.org/).

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

