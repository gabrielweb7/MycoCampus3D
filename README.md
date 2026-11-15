# 🍄 MycoCampus3D

**Universidade Virtual 3D Multiplayer do Cultivo de Cogumelos** — aprenda e ensine micologia aplicada na prática (Fluxo Laminar, Esterilização vs Pasteurização, Grãos/Spawn/CL, Contaminações e Frutificação) dentro de um campus 3D interativo no navegador.

---

## ✨ Principais Recursos

- **100% Fullscreen (`100vw × 100dvh`) com Tour Cinemático no Lobby**: câmera sobrevoando a Praça Central, o Laboratório, o Auditório, as Estufas, o Galpão de Substratos e o Lago Alpino antes mesmo de entrar.
- **Campus Amplo (`220m × 220m`) com 4 Alas Universitárias + Trilhas**:
  - **Praça Central**: monumento de cogumelo gigante, luminárias e plaquinhas direcionais 3D.
  - **Ala Oeste — Laboratório de Fluxo Laminar & Autoclave**: porta articulada, cabine HEPA, autoclave, estante e itens pegáveis/empilháveis com fantasma verde/vermelho (placas de Petri saudável e com Tricoderma, pote de spawn, cultura líquida).
  - **Ala Leste — Auditório Principal**: telão 3D interativo sincronizado ao vivo pelo Professor (`👨‍🏫`) para todos os alunos conectados.
  - **Ala Norte — Galpão de Substratos & Pasteurização**: tambor de pasteurização, bancada bulk e saco de substrato pegável.
  - **Ala Sul — Estufas de Frutificação & Secagem**: estufa iluminada por LED grow com bloco em frutificação.
  - **Trilha da Floresta & Lago Alpino**: píer de madeira e **20 cogumelos silvestres colhíveis** (`+25 XP` com respawn a cada 20s).
- **Controles Separados por Dispositivo**:
  - **PC**: `WASD` + `Espaço` (pular) + trava de mouse + clique esquerdo (pegar/soltar/colher/abrir porta/abrir aulas) + scroll do mouse (girar item).
  - **Celulares & Tablets (Android, iPhone, iPad)**: joystick analógico estilo Minecraft, botões de **Pular (`⬆️`)** e **Girar (`⟲` / `⟳`)**, arrastar para olhar e toque para interagir, respeitando `env(safe-area-inset-*)`.
- **Persistência Total em MySQL (zero `localStorage` para perfil/progresso)**:
  - Login/cadastro por Nome + PIN (`password_hash`) e chave opcional `PROFESSOR_KEY` para professores/admins.
  - XP, cogumelos colhidos, módulos concluídos, ranking da universidade, objetos movidos e slide ao vivo do auditório salvos no MySQL.
  - Chat rápido com balões de fala 3D sobre os avatares chibi.

---

## 📁 Estrutura do Projeto

- `index.html` — Lobby glassmorphism responsivo, HUD, controles mobile e modais de aulas/ranking.
- `js/campus3d.js` — Motor 3D (Three.js r128), mundo `220×220`, colisões, física de itens, avatares multiplayer e tour do lobby.
- `js/campus-app.js` — Autenticação MySQL, sincronização multiplayer (`150ms`), 5 módulos práticos de micologia e joystick mobile.
- `api/db.php` — Conexão PDO MySQL com criação automática das tabelas de `database/schema.sql`.
- `api/auth.php` — Cadastro/login, registro de XP/módulos e ranking da universidade.
- `api/multiplayer.php` — Sincronização de jogadores, chat, objetos do lab e slide ao vivo do auditório.
- `api/config.example.php` — Modelo de configuração (copie para `api/config.php` no servidor).
- `database/schema.sql` — Estrutura das tabelas `mc_users`, `mc_sessions`, `mc_world_objects` e `mc_world_state`.
- `.cpanel.yml` — Configuração de deploy no cPanel / HostGator.

---

## 🚀 Deploy na HostGator (cPanel)

1. No **cPanel -> Git™ Version Control**, clone este repositório (`https://github.com/gabrielweb7/MycoCampus3D.git`) na pasta do seu subdomínio (ex.: `/home2/SEU_USUARIO/mycocampus3d.alquimistasmagicos.com.br`).
2. No **cPanel -> Bancos de dados MySQL**, crie o banco de dados, o usuário e conceda **Todos os privilégios**.
3. No **Gerenciador de Arquivos**, dentro da pasta `api/`, crie o arquivo **`config.php`** (copiando de `api/config.example.php`) com suas credenciais:
   ```php
   <?php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'seu_banco');
   define('DB_USER', 'seu_usuario');
   define('DB_PASS', 'sua_senha');
   define('PROFESSOR_KEY', 'sua-chave-secreta-de-professor');
   ```
   > **Dica:** use aspas simples `'...'` se a senha contiver `$`. O arquivo `api/config.php` é ignorado pelo `.gitignore` para nunca expor senhas no Git.
4. Acesse o site no navegador — na primeira requisição as tabelas MySQL são criadas automaticamente e o campus já fica pronto para jogar!
