/* ==========================================================================
   BO Associados — tema claro / escuro partilhado
   --------------------------------------------------------------------------
   Usado pelo hub e por todas as ferramentas, para que a escolha feita num
   sítio valha em todo o lado (mesma origem → mesmo localStorage).

   Como usar numa página:
     1. No <head>, ANTES das folhas de estilo (evita o "flash" de tema):
          <script src="../../tema.js"></script>      (ferramentas)
          <script src="tema.js"></script>            (hub)
     2. Onde quiser o interruptor:
          <button type="button" data-tema-toggle></button>
     3. Na CSS da página, definir as cores claras em :root[data-theme="light"].

   O interruptor usa as variáveis da página que existirem
   (--accent ou --blue; --line ou --border; --panel-2 ou --panel; --bg).

   Escuro por defeito. A escolha fica em localStorage, chave "bo-tema".
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'bo-tema';
  var root = document.documentElement;

  function lerTema() {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; }
    catch (e) { return 'dark'; }
  }

  function aplicar(tema) {
    // Sempre explícito: "dark" também anula o prefers-color-scheme das ferramentas.
    root.setAttribute('data-theme', tema);
    var bts = document.querySelectorAll('[data-tema-toggle]');
    for (var i = 0; i < bts.length; i++) {
      bts[i].setAttribute('aria-checked', tema === 'light' ? 'true' : 'false');
    }
  }

  function definir(tema) {
    try { localStorage.setItem(KEY, tema); } catch (e) { /* sem armazenamento */ }
    aplicar(tema);
  }

  // 1) Aplicar já, antes de a página ser desenhada.
  aplicar(lerTema());

  // 2) Estilos do interruptor (uma só vez, com especificidade suficiente para
  //    não herdar regras genéricas de "button" das ferramentas).
  var css = [
    'button.bo-theme-toggle{',
    '  --tt-accent: var(--accent, var(--blue, #7ea4a2));',
    '  --tt-line: var(--line, var(--border, #2a2f38));',
    '  --tt-bg: var(--panel-2, var(--panel, #181c22));',
    '  --tt-faint: var(--faint, var(--text-faint, #5c636e));',
    '  position: relative; display: inline-flex; align-items: center; flex: none;',
    '  width: 60px; height: 30px; min-width: 0; margin: 0; padding: 0;',
    '  border: 1px solid var(--tt-line); border-radius: 999px;',
    '  background: var(--tt-bg); color: var(--tt-faint); box-shadow: none;',
    '  cursor: pointer; font: inherit; line-height: 1;',
    '  transition: background .2s ease, border-color .2s ease;',
    '}',
    'button.bo-theme-toggle:hover{ background: var(--tt-bg); border-color: var(--tt-accent); }',
    'button.bo-theme-toggle:focus-visible{ outline: 2px solid var(--tt-accent); outline-offset: 2px; }',
    'button.bo-theme-toggle::before{',
    '  content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px;',
    '  border-radius: 50%; background: var(--tt-accent); transition: transform .2s ease;',
    '}',
    ':root[data-theme="light"] button.bo-theme-toggle::before{ transform: translateX(30px); }',
    'button.bo-theme-toggle svg{ position: absolute; top: 50%; width: 14px; height: 14px; transform: translateY(-50%); z-index: 1; transition: color .2s ease; }',
    'button.bo-theme-toggle .ico-moon{ left: 7px; color: var(--bg, #12151a); }',
    'button.bo-theme-toggle .ico-sun{ right: 7px; }',
    ':root[data-theme="light"] button.bo-theme-toggle .ico-moon{ color: var(--tt-faint); }',
    ':root[data-theme="light"] button.bo-theme-toggle .ico-sun{ color: #ffffff; }',
    '@media print{ button.bo-theme-toggle{ display: none !important; } }',
    '@media (prefers-reduced-motion: reduce){ button.bo-theme-toggle, button.bo-theme-toggle::before{ transition: none; } }'
  ].join('\n');
  var st = document.createElement('style');
  st.id = 'bo-tema-css';
  st.textContent = css;
  (document.head || root).appendChild(st);

  var ICONES =
    '<svg class="ico-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
    '<svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/>' +
    '<path d="M12 1.8v2.4M12 19.8v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>';

  // 3) Transformar cada [data-tema-toggle] num interruptor.
  function montar() {
    var bts = document.querySelectorAll('[data-tema-toggle]');
    for (var i = 0; i < bts.length; i++) {
      var b = bts[i];
      if (b.getAttribute('data-tema-pronto')) continue;
      b.setAttribute('data-tema-pronto', '1');
      b.classList.add('bo-theme-toggle');
      b.setAttribute('type', 'button');
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-label', 'Tema claro');
      b.setAttribute('title', 'Alternar tema claro / escuro');
      b.innerHTML = ICONES;
      b.addEventListener('click', function () {
        definir(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
      });
    }
    aplicar(lerTema());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();

  // 4) Mudança feita noutro separador → acompanhar.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) aplicar(lerTema());
  });

  // Voltar atrás no browser (bfcache) → reaplicar a escolha mais recente.
  window.addEventListener('pageshow', function () { aplicar(lerTema()); });

  window.BOTema = { definir: definir, atual: lerTema };
})();
