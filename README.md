# MycoCampus3D 🎓🍄

Universidade e simulador 3D multiplayer interativo para ensino de cultivo de cogumelos (`game.alquimistasmagicos.com.br`).

## Estrutura
- `index.html` — Entrada 100% fullscreen + HUD do campus
- `js/campus3d.js` — Engine Three.js (Campus, Lab de Micologia, Auditório, Floresta, Física/Encaixe, Avatares Chibi)
- `js/campus-app.js` — Autenticação MySQL, Multiplayer, Chat, Aulas Interativas & Controles PC/Mobile
- `api/db.php` — Conexão PDO MySQL + criação automática das tabelas
- `api/auth.php` — Cadastro/Login de Alunos e Professores + Progresso (XP, módulos, colheitas)
- `api/multiplayer.php` — Sincronização em tempo real de avatares, itens, chat e telão do Auditório
- `database/schema.sql` — Schema MySQL completo

## Configuração no Servidor (HostGator)
1. Crie um banco MySQL no cPanel (ex: `usuario_mycocampus`) e um usuário com todas as permissões.
2. Copie `api/config.example.php` para `api/config.php` no servidor e preencha `DB_NAME`, `DB_USER`, `DB_PASS` e `PROFESSOR_KEY`.
   > `api/config.php` está no `.gitignore` e nunca sobe para o GitHub.
3. Importe `database/schema.sql` no phpMyAdmin (ou deixe o `api/db.php` criar as tabelas automaticamente no primeiro acesso).

