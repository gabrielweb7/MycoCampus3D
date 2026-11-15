# Changelog — MycoCampus3D

Todas as versões relevantes do projeto são registradas aqui seguindo [Semantic Versioning](https://semver.org/).

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

