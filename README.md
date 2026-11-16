# 🍄 MycoCampus3D — Universidade Virtual 3D do Cultivo de Cogumelos

O **MycoCampus3D** é um ambiente virtual e educacional 3D multiplayer em tempo real executado 100% no navegador (PC, tablets e smartphones). O objetivo do projeto é ensinar e simular micologia aplicada e cultivo prático de cogumelos (técnicas assépticas em fluxo laminar, esterilização na autoclave/panela de pressão, inoculação de grãos e cultura líquida, identificação e combate de contaminações e frutificação em estufa).

---

## 🏗️ 1. Arquitetura Técnica & Stack

- **Motor 3D (Front-end):** [Three.js r128](https://threejs.org/) puro, sem dependências de frameworks pesados (React/Vue/Angular), garantindo inicialização rápida e compatibilidade universal WebGL.
- **Renderização & Shaders:** Gráficos procedurais, materiais PBR (`MeshStandardMaterial`), sombras dinâmicas, `InstancedMesh` para centenas de árvores e vegetação, ciclo de dia/noite em tempo real (40 minutos virtuais sincronizados com o Relógio da Torre) e 5 variações climáticas sincronizadas (Ensolarado, Parcialmente Nublado, Nublado, Chuva e Neve).
- **Física & Interações Realistas:** Sistema de colisão com suporte a superfícies caminháveis (mesas inox, bancadas, carteiras e estufas), acoplamento magnético de tampa de panela de pressão, inoculação com agulha perfurando septos de borracha e simulação de temperatura física por material.
- **Interface & HUD:** Glassmorphism responsivo com Tailwind CSS (v2 pré-compilado), suporte a Safe Area Inset (`env(safe-area-inset-*)`), joystick analógico virtual para mobile e modo Fullscreen automático.
- **Back-end:** PHP 8.x nativo com PDO MySQL, arquitetura orientada a APIs RESTful leves com JSON, headers anti-cache e segurança nos cookies (`HttpOnly`, `SameSite=Lax`).
- **Banco de Dados:** MySQL 8 / MariaDB com migrações automáticas versionadas (`MC_SCHEMA_VERSION = 7`) e cache de flag local em `data/` para evitar sobrecarga no servidor.
- **Sincronização Multiplayer:** Polling HTTP POST assíncrono a cada **250ms** por cliente ativo (reduzido para **1500ms** quando a aba fica em segundo plano para economizar bateria e CPU), com *batch inserts* para objetos e traços de lousa.

---

## 📁 2. Estrutura Real do Repositório (Importante para IAs!)

> ✅ **Arquitetura Modular (ES Modules nativos):** A partir da `v0.9.25`, o `index.html` carrega o ponto de entrada único `<script type="module" src="js/main.js?v=0.9.31"></script>` (além de `js/vendor/`), organizado por domínio em `core/`, `services/`, `engine/`, `world/`, `entities/`, `systems/` e `ui/`. Zero bundler, 100% compatível com Apache/PHP/cPanel.

```text
├── index.html                 # Ponto de entrada, Lobby, Canvas WebGL, HUD e Modais (?v=0.9.31)
├── VERSION                    # Versão semântica atual do projeto (0.9.31)
├── error.php                  # Painel online privado para consultar erros recentes
├── CHANGELOG.md               # Histórico detalhado de mudanças por versão
├── README.md                  # Documentação mestra de arquitetura e contexto para IAs e devs
├── .cpanel.yml                # Script de deploy automatizado no cPanel / HostGator
├── .htaccess                  # Regras Apache (HTTPS, bloqueio de data/ e dotfiles, gzip, cache)
│
├── api/                       # Back-end em PHP
│   ├── config.php             # Credenciais do MySQL e PROFESSOR_KEY (ignorado pelo git)
│   ├── config.example.php     # Template seguro para criação do config.php
│   ├── db.php                 # Conexão PDO, migrações cacheadas (v7) e autenticação por token
│   ├── auth.php               # Login/registro, XP, módulos, missão prática, cosméticos, ranking e Admin
│   ├── error.php              # Recebe erros do navegador e lista relatórios para o Admin
│   └── multiplayer.php        # Sincronização em tempo real (avatares, objetos em lote, lousas, chat)
│
├── database/
│   └── schema.sql             # Definição DDL completa das tabelas MySQL (schema_version 7)
│
├── js/                        # Arquitetura ES Modules nativa + dependências self-hosted
│   ├── main.js                # Ponto de entrada único (registra API pública e inicializa app)
│   ├── vendor/                # Three.js r128 e OrbitControls.js (100% self-hosted, zero CDN)
│   ├── core/                  # Config (config.js), logger/erros (logger.js), constantes, lições, eventos, estado, math-pool, qualidade
│   ├── services/              # AudioEngine (Web Audio), api-client, multiplayer-sync
│   ├── engine/                # Texturas procedurais, física/colisão, cinema, clima/arco-íris
│   ├── world/                 # Natureza/praça, prédios, escadaria/relógio, estufa, layout de alas, campus externo
│   ├── items/                 # Um módulo por item/equipamento (panela/fogareiro, fluxo laminar, balança, agitador, seringa, petri, spawn, spray, termômetro, etc.)
│   ├── entities/              # Avatares MP, braço 1ª pessoa, termômetro laser, ghost, confete, veículos
│   ├── systems/               # Campus init, API pública, world-sync, game loop, movimento, input, interações, lousa, lobby tour
│   └── ui/                    # Boot UI, HUD/lobby, mapa/missão, controles mobile e modais
│
├── css/
│   ├── game.css               # Estilos principais, HUD, glassmorphism e regras mobile/tablet
│   └── tailwind.min.css       # Tailwind CSS pré-compilado
│
├── assets/                    # Favicons, ícones PWA e imagem OpenGraph
└── data/                      # Flags de cache de migração (ex.: .migrated_v7) - bloqueado no .htaccess
```

---

## 🗄️ 3. Esquema do Banco de Dados (MySQL)

| Tabela | Finalidade |
| :--- | :--- |
| `mc_meta` | Armazena configurações globais e o `schema_version` atual. |
| `mc_users` | Cadastro persistente: nome, hash da senha (PIN), cargo, cores do avatar, XP, cogumelos colhidos e módulos concluídos. |
| `mc_auth_tokens` | Tokens de sessão SHA-256 com validade de 30 dias para login persistente. |
| `mc_sessions` | Estado volátil dos jogadores online (posição $X,Y,Z$, rotação, item segurado, caminhada, chat em balão). |
| `mc_user_poses` | Posição e rotação salvas da última sessão do jogador para retorno contínuo. |
| `mc_world_objects` | Posições em tempo real de equipamentos e itens móveis do laboratório. |
| `mc_world_state` | Estados globais do mundo (portas, persianas, interruptores, fluxo laminar, cinema e slide do auditório). |
| `mc_admin_events` | Fila de ações pendentes disparadas pelo Master Admin (teletransporte forçado e desconexão de usuários). |
| `mc_board_strokes` | Histórico compartilhado de traços vetoriais das 4 lousas interativas. |

---

## 👥 4. Cargos e Controle de Acesso (RBAC)

1. **Aluno (`student`):**
   - Papel padrão ao cadastrar sem chave especial.
   - Pode explorar todo o campus, colher cogumelos na floresta (+25 XP), interagir com itens do laboratório, desenhar na lousa, sentar em carteiras/bancos e concluir os 5 módulos de aula (+50 XP cada).
2. **Professor (`professor`):**
   - Atribuído ao fornecer a `PROFESSOR_KEY` correta no login/cadastro ou ao ser promovido por um Admin.
   - Recursos exclusivos:
     - Projetar slides no Telão Principal do Auditório.
     - Resetar o Laboratório (`♻️ Lab`) voltando todos os frascos e ferramentas ao ponto inicial.
     - Tag dourada no HUD (`👨‍🏫 Professor`).
3. **Master Admin (`admin`):**
   - Exclusivo do proprietário do projeto (`gabrieldaluz`) ou promovido diretamente.
   - Recursos exclusivos:
     - Acesso ao **Painel Master Admin (`👑 Admin`)** no HUD.
     - Visualização de todos os jogadores cadastrados e status online em tempo real.
     - Puxar qualquer jogador até a posição do Admin (`🧲 Puxar`).
     - Teletransportar o Admin até o jogador (`🚀 Ir até`).
     - Promover alunos a professores ou rebaixar professores (`👨‍🏫 Promover` / `🎓 Rebaixar`).
     - Desconectar imediatamente qualquer jogador infrator (`🚫 Desconectar`).

---

## 🌐 5. Endpoints da API

### `api/auth.php`
- `action=login` *(POST)*: Autentica (exigindo sempre `password_verify`) ou cria novo usuário via `display_name`, `pin`, `hat_color`, `body_color` e opcional `professor_key`.
- `action=logout` *(POST)*: Revoga o token atual e limpa os cookies.
- `action=me`: Valida a sessão atual e retorna os dados do usuário conectado.
- `action=harvest` *(POST)*: Valida colheita de cogumelo silvestre (`wild_0..wild_31`) com trava em `mc_world_state` e cooldown anti-spam (+25 XP).
- `action=harvest_greenhouse` *(POST)*: Valida colheita na estufa (`slot_id` 0..3) com cooldown por slot (+50 XP e +2 cogumelos).
- `action=complete_module` *(POST)*: Conclui módulo prático com validação obrigatória da resposta no servidor (+50 XP).
- `action=complete_lab_quest` *(POST)*: Conclui a Missão Prática de 5 passos do laboratório (`lab_practica_v1`, +100 XP uma única vez).
- `action=buy_cosmetic` / `equip_cosmetic` *(POST)*: Desbloqueia e equipa chapéus 3D verificando XP e cogumelos dentro de transação `FOR UPDATE`.
- `action=leaderboard`: Retorna os 15 melhores jogadores e estatísticas gerais da universidade.
- `action=admin_list_users`, `admin_set_role`, `admin_teleport`, `admin_kick` *(Admin)*: Gestão completa em tempo real; `admin_kick` também revoga tokens em `mc_auth_tokens`.

### `api/multiplayer.php` *(apenas POST)*
- `action=sync`: Ponto central de sincronização em tempo real (envia pose local, itens movidos em lote, traços da lousa em lote e recebe os outros jogadores, objetos e estado do mundo; bloqueia troca de slide do auditório para não-professores).
- `action=leave`: Notifica a saída do jogador via `navigator.sendBeacon`.
- `action=reset_world`: *(Professor/Admin)* Limpa `mc_world_objects`, restaurando posições originais.
- `action=set_slide`: *(Professor/Admin)* Altera o slide do telão do auditório para todos.

### `api/error.php`
- `action=report` *(POST)*: Recebe mensagens e stacks de erros do navegador, com limite de tamanho e frequência; não recebe token nem ID do usuário.
- `action=list` *(GET, Admin)*: Lista até 200 relatórios recentes. O painel fica em `/error.php` e requer uma sessão de Administrador Master.
- Os relatórios ficam em `data/game-errors.jsonl`, área bloqueada para acesso HTTP direto, com tamanho máximo controlado.

---

## ⚡ 6. Boas Práticas & Diretrizes para IAs e Desenvolvedores

Ao adicionar novas funcionalidades ou dar manutenção no MycoCampus3D, respeite os seguintes princípios:

1. **Zero Garbage Collection nos Loops de Renderização:**
   - Nunca use `new THREE.Vector3()`, `new THREE.Color()` ou `new THREE.Matrix4()` dentro de `animate()` ou funções chamadas a cada quadro (como `updateDynamicEnvironment`). Use sempre variáveis pré-alocadas (`_tmpHandPos`, etc.).
2. **Proteção do Banco de Dados:**
   - O jogo faz polling a cada 250ms por jogador. **Nunca** coloque queries pesadas de `information_schema`, `ALTER TABLE` ou varreduras sem índice no fluxo de `sync`. Use *batch inserts* e cache de flag em `data/`.
3. **Segurança & Persistência Exclusiva no MySQL:**
   - Nunca confie em XP, cargo ou respostas vindas do cliente; o estado canônico reside no MySQL e alterações no estado do jogo exigem `POST` + token válido.
   - Relatórios enviados por `api/error.php` têm limite de frequência; a listagem exige sessão de Administrador Master. Não inclua credenciais ou dados pessoais nos erros.
4. **Respeito aos Dispositivos Móveis:**
   - Todas as novidades devem ser testadas em telas de toque (joystick, `#interact-pill`, `#btn-mobile-action`, área útil com `safe-area-inset` e eventos passivos).
5. **Áudio Centralizado & Versionamento:**
   - Todo novo efeito sonoro deve ser implementado em `js/campus-audio.js` (`window.MycoAudio`) conectado ao `masterGain` (para respeitar o botão 🔇 Mudo).
   - Ao finalizar uma entrega, atualize `VERSION`, os parâmetros `?v=` em `index.html` e o `CHANGELOG.md`. Os módulos ES importados são revalidados pelo Apache (`.htaccess`), pois seus imports internos não carregam o parâmetro de versão.

---

## 🔬 7. Simulações Científicas e Mecânicas Laboratoriais

- **Termômetro Infravermelho Laser (`infrared_thermometer`):** Ferramenta industrial com mira laser vermelha e display LCD funcional. Calcula temperatura física em tempo real via raycast considerando fontes de calor (fogareiro até 240°C, panela esterilizando a 121°C e 15 PSI, cultura líquida a 24.4°C, estufa a 20.8°C e calor metabólico de jogadores a 36.8°C).
- **Inoculação & Bombeamento com Seringa (`syringe_10ml`):** Alinhamento procedural em primeira pessoa que projeta a agulha perfurando o septo de borracha vermelha do frasco de cultura líquida. Transição contínua de 2 segundos para aspiração (0 a 10ml) ou injeção/esvaziamento (10 a 0ml) com movimentação realista de êmbolo e nível de líquido.
- **Autoclave / Panela de Pressão (`pressure_cooker` + `pressure_lid`):** Suporte a esterilização de grãos e substratos sob 15 PSI a 121°C. Encaixe magnético com fantasma verde e remoção direta da tampa pelo topo sem deslocar a panela base.
- **Locomoção Tridimensional sobre Superfícies:** Suporte para pular e caminhar sobre mesas de inox, bancadas e carteiras escolares com zero ejeção horizontal.
- **Prevenção Física de Sobreposição / Anti-Clipping (`isPlacementBlocked`):** Verificação física contínua no espaço 3D (radial e caixas AABB) que impede colocar itens atravessando ou por dentro de outros itens em estantes, bancadas ou pisos. O fantasma holográfico pulsa em vermelho (`#ef4444`) com o aviso `🚫 Espaço ocupado por outro objeto`, bloqueando a soltura até que o jogador aponte para um local desobstruído.
- **Missão Prática Guiada (`🧪 Missão`), Mapa Rápido (`🗺️ Mapa`) & Esportes 3D:** Checklist de 5 passos reais de cultivo asséptico (+100 XP), teleporte rápido entre 7 setores do campus (`window.teleportCampusPlayer`) e bolas de futebol/basquete com física 3D (Zero-GC) e comemoração de gol.
- **Arco-íris Espectral sobre as Montanhas:** Formação atmosférica procedural em 3D de 92m com as 7 cores do espectro óptico visível que surge majestosa sobre a cordilheira ao cessar da chuva, acompanhando a abertura de sol e dissipação da nebulosidade.
