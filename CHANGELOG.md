# Changelog — MycoCampus3D

Todas as versões relevantes do projeto são registradas aqui seguindo [Semantic Versioning](https://semver.org/).

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

