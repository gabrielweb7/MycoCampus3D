# MycoCampus3D

Simulador 3D web em módulos ES, com Three.js empacotado localmente, backend PHP/MySQL e APK via Capacitor.

## Por onde começar

- Entrada do jogo: `index.html`, `js/main.js`, `js/ui/app-boot.js`.
- Mecânicas e objetos: `js/items/`, `js/world/`, `js/systems/`.
- Mira, ações e posicionamento: `js/systems/hover-raycaster.js`, `hover-held-handlers.js`, `interaction-system.js` e `held-item-placement.js` na mesma pasta.
- Renderização, qualidade e FPS: `js/engine/`, `js/core/quality.js`, `js/core/perf-overlay.js`.
- Multiplayer: `js/services/multiplayer-sync.js`, `js/systems/world-objects-sync.js`, `api/multiplayer.php` e `api/multiplayer_schema.php`. Contas e progresso: `api/auth.php` e `database/schema.sql`.
- HUD e idiomas: `js/ui/`, `css/game.css` e `js/core/i18n.js`.

## Como trabalhar

- Localize a função ou teste com `rg` e leia os trechos relevantes. Abra o README ou o CHANGELOG por seção quando precisar de histórico.
- Edite as fontes. Evite editar diretamente `js/vendor/`, `node_modules/`, `www-apk/`, `dist/` ou o APK.
- Aproveite os módulos e convenções existentes. Preserve a ordem de prioridade das interações, evite novas alocações por frame e confira mouse/toque ao mudar controles.
- Ao mudar estado sincronizado, confira cliente, validação PHP e restauração de dados já salvos. Ao adicionar uma chave de tradução, atualize PT-BR, EN e ES.
- Use `VERSION` e `npm run sync-version` ao preparar uma nova versão web. O APK tem preparação própria com `npm run apk:sync`.

## Validação

- Teste focado: `node --test tests/NOME.test.mjs`.
- Mudanças em JavaScript: `npm run check` e `npm test`.
- Mudanças em PHP: `php -l caminho/do/arquivo.php` e os testes pertinentes.
- Para mudanças visuais ou de interação, verifique o fluxo no navegador ou indique o que precisa de teste manual.
