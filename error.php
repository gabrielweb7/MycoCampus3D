<?php
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Erros do MycoCampus3D</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #0b1220; color: #e2e8f0; }
    body { max-width: 1000px; margin: 0 auto; padding: 24px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    h1 { font-size: 1.4rem; }
    button { border: 1px solid #475569; border-radius: 8px; padding: 8px 12px; color: inherit; background: #1e293b; cursor: pointer; }
    #status { color: #94a3b8; min-height: 1.5em; }
    article { border: 1px solid #334155; border-radius: 10px; padding: 14px; margin: 12px 0; background: #111827; overflow-wrap: anywhere; }
    article h2 { font-size: 0.95rem; margin: 0 0 8px; color: #fbbf24; }
    article p { white-space: pre-wrap; margin: 6px 0; }
    details { margin-top: 8px; }
    pre { white-space: pre-wrap; font: 0.8rem/1.5 ui-monospace, monospace; color: #cbd5e1; }
    .empty { color: #94a3b8; }
  </style>
</head>
<body>
  <header>
    <h1>Erros recentes do MycoCampus3D</h1>
    <button id="refresh" type="button">Atualizar</button>
  </header>
  <p>Relatórios enviados pelo navegador. A listagem exige uma sessão de Administrador Master.</p>
  <p id="status" role="status">Carregando…</p>
  <main id="errors"></main>
  <script>
    const statusEl = document.getElementById('status');
    const errorsEl = document.getElementById('errors');
    const refreshBtn = document.getElementById('refresh');

    function renderErrors(errors) {
      errorsEl.replaceChildren();
      if (!errors.length) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = 'Nenhum erro registrado.';
        errorsEl.appendChild(empty);
        return;
      }

      errors.forEach((error) => {
        const article = document.createElement('article');
        const heading = document.createElement('h2');
        heading.textContent = `${error.server_time || ''} · ${error.scope || 'app'} · v${error.app_version || '?'}`;
        const message = document.createElement('p');
        message.textContent = error.message || 'Erro sem mensagem';
        article.append(heading, message);
        if (error.detail) {
          const details = document.createElement('details');
          const summary = document.createElement('summary');
          const stack = document.createElement('pre');
          summary.textContent = 'Detalhes / stack';
          stack.textContent = error.detail;
          details.append(summary, stack);
          article.appendChild(details);
        }
        errorsEl.appendChild(article);
      });
    }

    async function loadErrors() {
      refreshBtn.disabled = true;
      statusEl.textContent = 'Carregando…';
      try {
        const response = await fetch('api/error.php?action=list', {
          credentials: 'same-origin',
          cache: 'no-store'
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(response.status === 401 || response.status === 403
            ? 'Entre no jogo com a conta Administrador Master e atualize esta página.'
            : (data.error || 'Não foi possível carregar os erros.'));
        }
        renderErrors(data.errors || []);
        statusEl.textContent = `${data.errors.length} erro(s) recente(s).`;
      } catch (error) {
        errorsEl.replaceChildren();
        statusEl.textContent = error.message || 'Falha ao carregar os erros.';
      } finally {
        refreshBtn.disabled = false;
      }
    }

    refreshBtn.addEventListener('click', loadErrors);
    loadErrors();
  </script>
</body>
</html>
