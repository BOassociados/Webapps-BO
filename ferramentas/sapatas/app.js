/* ==========================================================================
   Sapatas — interface
   BO Associados · Webapps-BO · ferramentas/sapatas/app.js
   ========================================================================== */
(function () {
  'use strict';
  const C = window.SapataCalc;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f = C.fmt;
  const parseNum = (v) => { const s = String(v).replace(/\s/g, '').replace(',', '.'); if (s === '' || s === '-' ) return NaN; const n = Number(s); return isFinite(n) ? n : NaN; };
  const showNum = (v) => (v === undefined || v === null || v === '') ? '' : String(v).replace('.', ',');
  const NO_FRAME = (() => { try { return window.self === window.top; } catch (e) { return false; } })();
  const KEY = 'bo-sapatas-v1';

  /* ---------------------------------------------------------------- dados */
  const PSI = { A: [0.7, 0.5, 0.3], B: [0.7, 0.5, 0.3], C: [0.7, 0.7, 0.6], D: [0.7, 0.7, 0.6], E: [1.0, 0.9, 0.8], F: [0.7, 0.7, 0.6], G: [0.7, 0.5, 0.3], H: [0, 0, 0] };
  const CATS = [['A', 'A — habitação'], ['B', 'B — escritórios'], ['C', 'C — reunião de pessoas'], ['D', 'D — comércio'], ['E', 'E — armazenamento'], ['F', 'F — tráfego ≤ 30 kN'], ['G', 'G — tráfego 30–160 kN'], ['H', 'H — coberturas']];
  const TIPOS_ACAO = [['G', 'G — permanente'], ['Q', 'Q — sobrecarga'], ['W', 'W — vento'], ['S', 'S — neve'], ['E', 'E — sismo (AEd)']];
  const TIPOS_COMB = [['A1', 'ELU fundamental (A1)'], ['A2', 'ELU A2 (DA1-C2)'], ['EQU', 'EQU'], ['SIS', 'Sísmica'], ['CAR', 'ELS característica'], ['FREQ', 'ELS frequente'], ['QP', 'ELS quase-permanente']];
  const TIPO_LBL = { A1: 'ELU · A1 (DA1-C1)', A2: 'ELU · A2 (DA1-C2)', EQU: 'EQU', SIS: 'Sísmica', CAR: 'ELS característica', FREQ: 'ELS frequente', QP: 'ELS quase-permanente' };
  const PHIS = [8, 10, 12, 16, 20, 25, 32];

  function hoje() { const d = new Date(); return d.toISOString().slice(0, 10); }
  function exemplo() {
    return {
      app: 'sapatas-bo', versao: 1,
      projeto: { obra: '', cliente: '', local: '', ref: 'S1', autor: '', verificador: '', data: hoje(), notas: 'Valores de exemplo: substituir pelos dados da obra.' },
      geometria: { tipo: 'ret', B: 2.1, L: 2.1, h: 0.5, Df: 1.0, gammaC: 25, gammaAterro: 18, qSup: 0, qSupTipo: 'Q', qSupPsi0: 0.7, qSupPsi1: 0.5, qSupPsi2: 0.3 },
      pilares: [{ id: 'P1', forma: 'ret', cx: 0.4, cy: 0.4, D: 0.4, x: 0, y: 0, phi: 16 }],
      materiais: { betao: 'C30/37', aco: 'A500', cnom: 50, dg: 20, armInf: { x: { phi: 16, s: 0.2 }, y: { phi: 16, s: 0.2 } }, armSup: { ativa: false, x: { phi: 12, s: 0.2 }, y: { phi: 12, s: 0.2 } }, camadaInf: 'x', patilhas: true, seccaoRef: 'face', sMax: 0.3, sMin: 0.1, sigArr: 1 },
      terreno: {
        modo: 'multi',
        camadas: [
          { nome: 'Aterro', esp: 0.8, gamma: 18, gammaSat: 19, phi: 28, c: 0, cu: 0, E: 8, nu: 0.3, sigAdm: 100, spt: 6 },
          { nome: 'Areia siltosa', esp: 4, gamma: 19, gammaSat: 20, phi: 32, c: 0, cu: 0, E: 25, nu: 0.3, sigAdm: 250, spt: 22 },
          { nome: 'Saibro (granito alterado)', esp: 0, gamma: 20, gammaSat: 21, phi: 36, c: 10, cu: 0, E: 80, nu: 0.25, sigAdm: 400, spt: 60 }
        ],
        nf: { considerar: true, prof: 2.0 }
      },
      cargas: {
        modo: 'carac', omega: 1,
        carac: { acoes: [
          { id: 'a1', nome: 'G', tipo: 'G', cat: 'A', psi0: 0, psi1: 0, psi2: 0, val: { P1: { N: 700, Mx: 10, My: 25, Vx: 12, Vy: 8 } } },
          { id: 'a2', nome: 'Q', tipo: 'Q', cat: 'A', psi0: 0.7, psi1: 0.5, psi2: 0.3, val: { P1: { N: 250, Mx: 4, My: 10, Vx: 4, Vy: 3 } } },
          { id: 'a3', nome: 'W', tipo: 'W', cat: 'A', psi0: 0.6, psi1: 0.2, psi2: 0, val: { P1: { N: 30, Mx: 0, My: 40, Vx: 18, Vy: 0 } } },
          { id: 'a4', nome: 'E', tipo: 'E', cat: 'A', psi0: 0, psi1: 0, psi2: 0, val: { P1: { N: 60, Mx: 30, My: 80, Vx: 45, Vy: 25 } } }
        ] },
        comb: { reacoes: false, linhas: [] }
      },
      analise: { usarSigAdm: true, kBordo: 1.25, kSis: 1.5, sigAdmELU: false, usarEC7: true, paramZona: 'base', kDelta: 1, aguaInterface: false, contactoQP: true,
        usarAssent: true, metodoAss: 'E', zInfPct: 20, alivio: true, sLim: 25, rotLim: 500, combAssent: 'QP' }
    };
  }
  function vazio() {
    const e = exemplo();
    e.projeto = { obra: '', cliente: '', local: '', ref: 'S1', autor: '', verificador: '', data: hoje(), notas: '' };
    e.cargas.carac.acoes = [
      { id: 'a1', nome: 'G', tipo: 'G', cat: 'A', psi0: 0, psi1: 0, psi2: 0, val: { P1: { N: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 } } },
      { id: 'a2', nome: 'Q', tipo: 'Q', cat: 'A', psi0: 0.7, psi1: 0.5, psi2: 0.3, val: { P1: { N: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 } } }
    ];
    e.terreno.modo = 'unica';
    e.terreno.camadas = [{ nome: 'Terreno de fundação', esp: 0, gamma: 19, gammaSat: 20, phi: 30, c: 0, cu: 0, E: 20, nu: 0.3, sigAdm: 200, spt: 0 }];
    e.terreno.nf = { considerar: false, prof: 5 };
    return e;
  }
  function merge(base, src) {
    if (Array.isArray(base)) return Array.isArray(src) ? src : base;
    if (base && typeof base === 'object') {
      const out = { ...base };
      if (src && typeof src === 'object') for (const k of Object.keys(src)) out[k] = (k in base) ? merge(base[k], src[k]) : src[k];
      return out;
    }
    return src === undefined ? base : src;
  }
  function normalizar(s) {
    s = merge(exemplo(), s);
    if (!s.pilares.length) s.pilares = [{ id: 'P1', forma: 'ret', cx: 0.4, cy: 0.4, D: 0.4, x: 0, y: 0, phi: 16 }];
    for (const a of s.cargas.carac.acoes) {
      a.val = a.val || {};
      for (const p of s.pilares) a.val[p.id] = Object.assign({ N: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 }, a.val[p.id] || {});
    }
    if (!s.terreno.camadas.length) s.terreno.camadas = vazio().terreno.camadas;
    if (s.projeto.obra === 'Exemplo — edifício de habitação') { s.projeto.obra = ''; if (s.projeto.local === 'Braga') s.projeto.local = ''; }
    return s;
  }
  function carregar() { try { const t = localStorage.getItem(KEY); if (t) return normalizar(JSON.parse(t)); } catch (e) { /* sem armazenamento */ } return null; }
  let saveT = 0;
  function guardarLocal() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignorar */ } }, 300); }

  let S = carregar() || normalizar(exemplo());
  let R = null;
  let calcErro = null;
  const ui = { step: 'geometria', view: 'planta', combId: null, check: null, novoArm: 0, ui_ax: '1', ui_ay: '1', ui_relComb: false };

  const get = (o, p) => p.split('.').reduce((a, k) => (a === undefined || a === null) ? a : a[k], o);
  const set = (o, p, v) => { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] === undefined) a[ks[i]] = {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; };

  /* ---------------------------------------------------------------- menus */
  const STEPS = [
    { id: 'projeto', t: 'Projeto', d: 'Identificação da obra e da sapata para a memória de cálculo.', view: 'planta' },
    { id: 'geometria', t: 'Geometria', d: 'Sapata centrada retangular. Dimensões em planta, altura e profundidade da base.', view: 'planta' },
    { id: 'pilares', t: 'Pilares', d: 'Até 4 pilares retangulares ou circulares, com posição relativa ao centro da sapata.', view: 'planta' },
    { id: 'materiais', t: 'Materiais e armaduras', d: 'Betão, aço, recobrimento e malhas de armadura.', view: 'corte' },
    { id: 'terreno', t: 'Terreno', d: 'Camada única ou perfil multicamada, nível freático e parâmetros geotécnicos.', view: 'corte' },
    { id: 'acoes', t: 'Ações', d: 'Ações características por pilar (gera combinações) ou combinações importadas do Robot/CYPE.', view: 'pressoes' },
    { id: 'analise', t: 'Opções de análise', d: 'Filosofias de verificação do terreno e critérios de serviço.', view: 'pressoes' },
    { id: 'resultados', t: 'Verificações', d: 'Resumo de todas as verificações com a combinação condicionante.', view: 'pressoes' },
    { id: 'relatorio', t: 'Memória de cálculo', d: 'Relatório completo, pronto a imprimir ou guardar em PDF.', view: 'planta' }
  ];
  const VIEWS = [['planta', 'Planta'], ['corte', 'Corte'], ['pressoes', 'Pressões'], ['esforcos', 'Esforços'], ['assent', 'Assentamento']];

  function renderSteps() {
    const el = $('#steps');
    el.innerHTML = STEPS.map((s, i) => {
      let badge = '';
      if (s.id === 'pilares') badge = String(S.pilares.length);
      if (s.id === 'terreno') badge = S.terreno.modo === 'unica' ? '1 cam.' : S.terreno.camadas.length + ' cam.';
      if (s.id === 'acoes' && R) badge = R.combos.length + ' comb.';
      let cls = '';
      if (s.id === 'resultados' && R) { badge = R.ok ? 'verifica' : 'falha'; cls = R.ok ? 'ok' : 'bad'; }
      return (s.id === 'resultados' ? '<div class="sep"></div>' : '') +
        `<button type="button" class="step ${ui.step === s.id ? 'on' : ''}" data-step="${s.id}"><span class="n">${i + 1}</span><span class="t">${s.t}</span><span class="b ${cls}">${esc(badge)}</span></button>`;
    }).join('');
  }

  /* --------------------------------------------------------- campos form */
  function idOf(p) { return 'f_' + p.replace(/[^a-zA-Z0-9]/g, '_'); }
  function fld(label, path, o) {
    o = o || {};
    const id = idOf(path);
    const v = path.startsWith('ui_') ? ui[path] : get(S, path);
    const unit = o.u ? `<span class="u">${o.u}</span>` : '';
    const r = o.r ? ' data-r="1"' : '';
    let inp;
    if (o.opts) {
      inp = `<select class="inp" id="${id}" data-p="${path}" data-k="${o.k || 'str'}"${r}>${o.opts.map(([val, t]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    } else if (o.area) {
      inp = `<textarea class="inp" id="${id}" data-p="${path}" data-k="str" rows="3" style="font-family:var(--f-body);font-size:13px">${esc(v)}</textarea>`;
    } else if (o.k === 'str') {
      inp = `<input class="inp" id="${id}" data-p="${path}" data-k="str" value="${esc(v)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''} autocomplete="off"${r}>`;
    } else {
      inp = `<input class="inp n" id="${id}" data-p="${path}" data-k="num" value="${esc(showNum(v))}" inputmode="decimal" autocomplete="off"${r}>`;
    }
    return `<div class="fld"><label for="${id}"><span>${label}</span>${unit}</label>${inp}${o.hint ? `<p class="hint">${o.hint}</p>` : ''}</div>`;
  }
  function chk(label, path, o) {
    o = o || {};
    const id = idOf(path);
    const v = path.startsWith('ui_') ? ui[path] : get(S, path);
    return `<label class="chk" for="${id}"><input type="checkbox" id="${id}" data-p="${path}" data-k="bool" ${v ? 'checked' : ''}${o.r ? ' data-r="1"' : ''}><span>${label}${o.hint ? `<br><span class="hint">${o.hint}</span>` : ''}</span></label>`;
  }
  function seg(path, opts) {
    const v = get(S, path);
    return `<div class="seg" role="group">${opts.map(([val, t]) => `<button type="button" class="${String(v) === String(val) ? 'on' : ''}" data-seg="${path}" data-val="${esc(val)}">${esc(t)}</button>`).join('')}</div>`;
  }
  const row = (cls, ...xs) => `<div class="row ${cls || ''}">${xs.join('')}</div>`;
  const info = (pairs) => `<dl class="info">${pairs.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`;

  /* --------------------------------------------------------- painéis */
  function renderPanel() {
    const st = STEPS.find(s => s.id === ui.step);
    const i = STEPS.indexOf(st);
    $('#panelHead').innerHTML = `<div class="eyebrow">${i + 1} / ${STEPS.length}</div><h2>${st.t}</h2><p>${st.d}</p>`;
    const fn = PANELS[ui.step];
    const body = $('#panelBody');
    const sc = body.scrollTop;
    body.innerHTML = fn ? fn() : '';
    body.scrollTop = sc;
    const prev = STEPS[i - 1], next = STEPS[i + 1];
    $('#panelFoot').innerHTML = `${prev ? `<button class="btn ghost" type="button" data-step="${prev.id}">← ${prev.t}</button>` : '<span></span>'}${next ? `<button class="btn primary" type="button" data-step="${next.id}">${next.t} →</button>` : ''}`;
  }

  const PANELS = {
    projeto() {
      return `<fieldset>
        ${fld('Projeto / Obra', 'projeto.obra', { k: 'str', ph: '0000-00 - Nome do Projeto' })}
        ${fld('Requerente', 'projeto.cliente', { k: 'str', ph: 'Requerente' })}
        ${fld('Morada', 'projeto.local', { k: 'str', ph: 'Local da Obra' })}
        ${row('', fld('Referência da sapata', 'projeto.ref', { k: 'str' }), fld('Data', 'projeto.data', { k: 'str' }))}
        ${row('', fld('Autor', 'projeto.autor', { k: 'str' }), fld('Verificado por', 'projeto.verificador', { k: 'str' }))}
        ${fld('Notas', 'projeto.notas', { area: true })}
      </fieldset>
      <div class="note">Os dados ficam guardados neste browser. Use <b>Guardar</b> para criar um ficheiro JSON do cálculo e <b>Abrir</b> para o recuperar mais tarde ou partilhar com a equipa.</div>`;
    },
    geometria() {
      const g = R ? R.geo : C.geometria(S);
      return `<fieldset><legend>Tipo de sapata</legend>
        ${fld('Geometria', 'geometria.tipo', { opts: [['ret', 'Retangular centrada']], hint: 'Próximas geometrias: circular, excêntrica (vizinhança), de canto e sapatas associadas.' })}
      </fieldset>
      <fieldset><legend>Dimensões</legend>
        ${row('', fld('B — dimensão segundo X', 'geometria.B', { u: 'm' }), fld('L — dimensão segundo Y', 'geometria.L', { u: 'm' }))}
        ${row('', fld('h — altura', 'geometria.h', { u: 'm' }), fld('Df — profundidade da base', 'geometria.Df', { u: 'm', hint: 'Medida a partir do terreno final.' }))}
      </fieldset>
      <fieldset><legend>Pesos e sobrecarga</legend>
        ${row('', fld('γ betão', 'geometria.gammaC', { u: 'kN/m³' }), fld('γ aterro sobre a sapata', 'geometria.gammaAterro', { u: 'kN/m³' }))}
        ${row('', fld('Sobrecarga à superfície', 'geometria.qSup', { u: 'kPa' }), fld('Tipo de sobrecarga', 'geometria.qSupTipo', { opts: [['Q', 'Variável'], ['G', 'Permanente']], r: true }))}
        ${S.geometria.qSupTipo === 'Q' ? row('r3', fld('ψ0', 'geometria.qSupPsi0'), fld('ψ1', 'geometria.qSupPsi1'), fld('ψ2', 'geometria.qSupPsi2')) : ''}
      </fieldset>
      ${info([
        ['Área da base', f(g.A, 3) + ' m²'],
        ['Peso da sapata', f(g.Wsap, 1) + ' kN'],
        ['Altura de aterro', f(g.hAt, 2) + ' m'],
        ['Peso do aterro', f(g.Wat, 1) + ' kN'],
        ['Balanço máximo', f(g.vMax, 3) + ' m'],
        ['Classificação', g.vMax <= 2 * g.h ? 'rígida (v ≤ 2h)' : 'flexível (v > 2h)']
      ])}`;
    },
    pilares() {
      const cards = S.pilares.map((p, i) => `<div class="card">
        <div class="card-head"><span class="ttl">Pilar ${esc(p.id)}</span>${S.pilares.length > 1 ? `<button class="btn small danger" type="button" data-act="delPilar" data-i="${i}">Remover</button>` : ''}</div>
        ${row('', fld('Designação', `pilares.${i}.id`, { k: 'str' }), fld('Secção', `pilares.${i}.forma`, { opts: [['ret', 'Retangular'], ['circ', 'Circular']], r: true }))}
        ${p.forma === 'circ' ? row('', fld('D — diâmetro', `pilares.${i}.D`, { u: 'm' }), fld('Ø arranques', `pilares.${i}.phi`, { u: 'mm', opts: PHIS.map(x => [x, 'Ø' + x]), k: 'num' }))
          : row('r3', fld('cx', `pilares.${i}.cx`, { u: 'm' }), fld('cy', `pilares.${i}.cy`, { u: 'm' }), fld('Ø arranques', `pilares.${i}.phi`, { u: 'mm', opts: PHIS.map(x => [x, 'Ø' + x]), k: 'num' }))}
        ${row('', fld('x — posição', `pilares.${i}.x`, { u: 'm' }), fld('y — posição', `pilares.${i}.y`, { u: 'm' }))}
      </div>`).join('');
      return `${cards}
      <div class="row">
        <button class="btn" type="button" data-act="addPilar" ${S.pilares.length >= 4 ? 'disabled' : ''}>+ Adicionar pilar</button>
        <button class="btn" type="button" data-act="centrar">Centrar pilar único</button>
      </div>
      <fieldset><legend>Distribuição simétrica (ex.: torre de grua)</legend>
        ${row('', fld('Afastamento entre eixos segundo X', 'ui_ax', { u: 'm' }), fld('Afastamento entre eixos segundo Y', 'ui_ay', { u: 'm' }))}
        <div class="row"><button class="btn" type="button" data-act="grid2">2 pilares segundo X</button><button class="btn" type="button" data-act="grid4">4 pilares (2 × 2)</button></div>
        <p class="hint">Mantém a secção do primeiro pilar e reparte as ações por igual pelos novos pilares.</p>
      </fieldset>
      <div class="note">Origem no centro da sapata; x segundo B, y segundo L. Os esforços introduzem-se por pilar no menu Ações.</div>`;
    },
    materiais() {
      const d = R ? R.d : null;
      const bet = C.betao(S.materiais.betao), ac = C.aco(S.materiais.aco);
      return `<fieldset><legend>Materiais</legend>
        ${row('', fld('Betão', 'materiais.betao', { opts: C.BETOES.map(x => [x, x]) }), fld('Aço', 'materiais.aco', { opts: [['A500', 'A500 NR'], ['A400', 'A400 NR']] }))}
        ${row('', fld('Recobrimento nominal', 'materiais.cnom', { u: 'mm', hint: 'Betonagem sobre betão de limpeza (EC2 4.4.1.3(4)).' }), fld('Máx. agregado dg', 'materiais.dg', { u: 'mm' }))}
        ${info([['fcd', f(bet.fcd, 2) + ' MPa'], ['fctm', f(bet.fctm, 2) + ' MPa'], ['fyd', f(ac.fyd, 1) + ' MPa']])}
      </fieldset>
      <fieldset><legend>Malha inferior</legend>
        ${row('', fld('Ø segundo X', 'materiais.armInf.x.phi', { opts: PHIS.map(x => [x, 'Ø' + x]), k: 'num' }), fld('Espaçamento X', 'materiais.armInf.x.s', { u: 'm' }))}
        ${row('', fld('Ø segundo Y', 'materiais.armInf.y.phi', { opts: PHIS.map(x => [x, 'Ø' + x]), k: 'num' }), fld('Espaçamento Y', 'materiais.armInf.y.s', { u: 'm' }))}
        ${row('', fld('Camada mais baixa', 'materiais.camadaInf', { opts: [['x', 'Varões segundo X'], ['y', 'Varões segundo Y']] }), fld('Secção de referência', 'materiais.seccaoRef', { opts: [['face', 'Face do pilar'], ['015', '0,15·c para o interior']] }))}
        ${chk('Patilhas nas extremidades (amarração com α1 = 0,7)', 'materiais.patilhas')}
        ${d ? info([['dx / dy', f(d.dx, 3) + ' / ' + f(d.dy, 3) + ' m'], ['As,x total', f(d.AsX, 2) + ' cm²'], ['As,y total', f(d.AsY, 2) + ' cm²'], ['ρx / ρy', f(d.rhoX * 100, 3) + ' / ' + f(d.rhoY * 100, 3) + ' %']]) : ''}
      </fieldset>
      <fieldset><legend>Malha superior</legend>
        ${chk('Considerar malha superior', 'materiais.armSup.ativa', { r: true })}
        ${S.materiais.armSup.ativa ? row('', fld('Ø segundo X', 'materiais.armSup.x.phi', { opts: PHIS.map(x => [x, 'Ø' + x]), k: 'num' }), fld('Espaçamento X', 'materiais.armSup.x.s', { u: 'm' })) +
          row('', fld('Ø segundo Y', 'materiais.armSup.y.phi', { opts: PHIS.map(x => [x, 'Ø' + x]), k: 'num' }), fld('Espaçamento Y', 'materiais.armSup.y.s', { u: 'm' })) : ''}
      </fieldset>
      <fieldset><legend>Critérios de pormenorização</legend>
        ${row('', fld('Espaçamento máximo', 'materiais.sMax', { u: 'm' }), fld('Espaçamento mínimo', 'materiais.sMin', { u: 'm' }))}
        ${fld('σsd / fyd nos arranques do pilar', 'materiais.sigArr', { hint: '1,0 = arranques totalmente mobilizados (conservativo). Pode usar As,req/As,prov do pilar.' })}
      </fieldset>`;
    },
    terreno() {
      const unica = S.terreno.modo === 'unica';
      const cams = (unica ? [S.terreno.camadas[0]] : S.terreno.camadas).map((c, i) => `<div class="card">
        <div class="card-head"><span class="ttl">${unica ? 'Terreno de fundação' : 'Camada ' + (i + 1)}</span>${!unica && S.terreno.camadas.length > 1 ? `<button class="btn small danger" type="button" data-act="delCam" data-i="${i}">Remover</button>` : ''}</div>
        ${row('', fld('Designação', `terreno.camadas.${i}.nome`, { k: 'str' }), unica ? fld('NSPT médio', `terreno.camadas.${i}.spt`, { hint: 'Informativo.' }) : fld('Espessura', `terreno.camadas.${i}.esp`, { u: 'm', hint: i === S.terreno.camadas.length - 1 ? 'Última camada: 0 = até ao fim.' : '' }))}
        ${row('', fld('γ', `terreno.camadas.${i}.gamma`, { u: 'kN/m³' }), fld('γsat', `terreno.camadas.${i}.gammaSat`, { u: 'kN/m³' }))}
        ${row('r3', fld("φ'", `terreno.camadas.${i}.phi`, { u: '°' }), fld("c'", `terreno.camadas.${i}.c`, { u: 'kPa' }), fld('cu', `terreno.camadas.${i}.cu`, { u: 'kPa' }))}
        ${row('r3', fld('E', `terreno.camadas.${i}.E`, { u: 'MPa' }), fld('ν', `terreno.camadas.${i}.nu`), fld('σadm', `terreno.camadas.${i}.sigAdm`, { u: 'kPa' }))}
        ${!unica ? fld('NSPT médio', `terreno.camadas.${i}.spt`, { hint: 'Informativo (relatório geotécnico).' }) : ''}
      </div>`).join('');
      return `<fieldset><legend>Perfil</legend>${seg('terreno.modo', [['unica', 'Camada única'], ['multi', 'Multicamada']])}</fieldset>
      ${cams}
      ${!unica ? `<button class="btn" type="button" data-act="addCam">+ Adicionar camada</button>` : ''}
      <p class="hint">cu = 0 dispensa a verificação não drenada; φ' = c' = 0 dispensa a drenada. A σadm usada é a da camada onde assenta a base.</p>
      <fieldset><legend>Nível freático</legend>
        ${chk('Considerar nível freático', 'terreno.nf.considerar', { r: true })}
        ${S.terreno.nf.considerar ? fld('Profundidade abaixo do terreno final', 'terreno.nf.prof', { u: 'm' }) : ''}
      </fieldset>
      <fieldset><legend>Base da sapata</legend>
        ${fld('Parâmetros para a capacidade resistente', 'analise.paramZona', { opts: [['base', 'Camada onde assenta a base'], ['min', 'Mínimos até B abaixo da base']] })}
        ${fld('Atrito na base δ = k·φ\'d', 'analise.kDelta', { opts: [[1, 'k = 1 — betonada in situ'], [0.6667, 'k = 2/3 — pré-fabricada lisa']], k: 'num', hint: 'EC7 6.5.3(10); c\' desprezada.' })}
        ${chk('Possível acesso de água/ar à interface em argila (Rd ≤ 0,4·Vd)', 'analise.aguaInterface', { hint: 'EC7 6.5.3(12).' })}
      </fieldset>`;
    },
    acoes() {
      const modo = S.cargas.modo;
      let h = `<fieldset><legend>Modo de introdução</legend>${seg('cargas.modo', [['carac', 'Ações características'], ['comb', 'Combinações importadas']])}
        <p class="hint">${modo === 'carac' ? 'Gera as combinações da NP EN 1990 (expressão 6.10, AN) e da DA1: A1, A2, EQU, sísmica e ELS.' : 'Cole as combinações já calculadas no Robot, CYPE ou Excel. Unidades: kN e kN·m.'}</p></fieldset>
        <div class="note">Convenção: N &gt; 0 compressão; Vx, Vy, Mx, My segundo a regra da mão direita (z para cima), aplicados no topo da sapata. My &gt; 0 desloca a resultante para +x; Mx &gt; 0 para −y.</div>`;
      if (modo === 'carac') {
        h += S.cargas.carac.acoes.map((a, i) => {
          const variavel = ['Q', 'W', 'S'].includes(a.tipo);
          return `<div class="card">
            <div class="card-head"><span class="ttl">${esc(a.nome || 'Ação')}</span><span class="tag">${esc(a.tipo)}</span><button class="btn small danger" type="button" data-act="delAcao" data-i="${i}">Remover</button></div>
            ${row('', fld('Designação', `cargas.carac.acoes.${i}.nome`, { k: 'str' }), fld('Tipo', `cargas.carac.acoes.${i}.tipo`, { opts: TIPOS_ACAO, r: true }))}
            ${a.tipo === 'Q' ? `<div class="fld"><label for="cat_${i}"><span>Categoria (NP EN 1990, Quadro A1.1)</span></label><select class="inp" id="cat_${i}" data-psicat="${i}">${CATS.map(([v, t]) => `<option value="${v}" ${a.cat === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>` : ''}
            ${variavel ? row('r3', fld('ψ0', `cargas.carac.acoes.${i}.psi0`), fld('ψ1', `cargas.carac.acoes.${i}.psi1`), fld('ψ2', `cargas.carac.acoes.${i}.psi2`)) : ''}
            <div class="tbl-wrap"><table class="t"><thead><tr><th>Pilar</th><th>N kN</th><th>Mx kN·m</th><th>My kN·m</th><th>Vx kN</th><th>Vy kN</th></tr></thead><tbody>
              ${S.pilares.map(p => `<tr><td>${esc(p.id)}</td>${['N', 'Mx', 'My', 'Vx', 'Vy'].map(k => { const pth = `cargas.carac.acoes.${i}.val.${p.id}.${k}`; return `<td><input id="${idOf(pth)}" aria-label="${k} ${esc(p.id)}" data-p="${esc(pth)}" data-k="num" value="${esc(showNum(get(S, pth)))}" inputmode="decimal" autocomplete="off"></td>`; }).join('')}</tr>`).join('')}
            </tbody></table></div>
          </div>`;
        }).join('');
        h += `<div class="row"><button class="btn" type="button" data-act="addAcao">+ Adicionar ação</button></div>
          <fieldset><legend>Sismo</legend>${fld('γRd·Ω aplicado a AEd (cálculo pela capacidade real)', 'cargas.omega', { hint: 'EC8-1 4.4.2.6(4): 1,0 para q ≤ 3 ou estruturas de baixa dissipação. Introduza AEd já combinado (Ex + 0,3·Ey, …); entra com ± .' })}</fieldset>
          <p class="hint">Ventos e neves são mutuamente exclusivos entre si; as sobrecargas Q atuam em conjunto. Cada combinação gera variantes com γG = 1,35 e 1,00.</p>`;
      } else {
        const L = S.cargas.comb.linhas;
        h += `${chk('Os valores são reações de apoio (inverter Vx, Vy, Mx, My)', 'cargas.comb.reacoes', { hint: 'Ex.: reações do Robot. N = Fz é mantido como compressão positiva.' })}
          <div class="tbl-wrap"><table class="t"><thead><tr><th>Nome</th><th>Tipo</th><th>Pilar</th><th>N</th><th>Mx</th><th>My</th><th>Vx</th><th>Vy</th><th></th></tr></thead><tbody>
          ${L.map((r, i) => `<tr>
            <td class="txt"><input id="cl_${i}_nome" aria-label="Nome" data-p="cargas.comb.linhas.${i}.nome" data-k="str" value="${esc(r.nome)}"></td>
            <td><select id="cl_${i}_tipo" aria-label="Tipo" data-p="cargas.comb.linhas.${i}.tipo" data-k="str">${TIPOS_COMB.map(([v, t]) => `<option value="${v}" ${r.tipo === v ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
            <td><select id="cl_${i}_pil" aria-label="Pilar" data-p="cargas.comb.linhas.${i}.pilar" data-k="str">${S.pilares.map(p => `<option ${r.pilar === p.id ? 'selected' : ''}>${esc(p.id)}</option>`).join('')}</select></td>
            ${['N', 'Mx', 'My', 'Vx', 'Vy'].map(k => `<td><input id="cl_${i}_${k}" aria-label="${k}" data-p="cargas.comb.linhas.${i}.${k}" data-k="num" value="${esc(showNum(r[k]))}" inputmode="decimal"></td>`).join('')}
            <td><button class="btn small danger" type="button" data-act="delLinha" data-i="${i}" aria-label="Remover linha">×</button></td></tr>`).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--faint);padding:14px">Sem combinações. Adicione linhas ou cole uma tabela abaixo.</td></tr>'}
          </tbody></table></div>
          <div class="row"><button class="btn" type="button" data-act="addLinha">+ Linha</button><button class="btn danger" type="button" data-act="limparLinhas" ${L.length ? '' : 'disabled'}>Limpar tabela</button></div>
          <fieldset><legend>Colar do Excel / Robot / CYPE</legend>
            <textarea class="inp" id="pasteArea" rows="5" placeholder="Nome	Tipo	Pilar	N	Mx	My	Vx	Vy&#10;ELU1	A1	P1	1250	18	45	22	9&#10;ELS1	CAR	P1	900	12	30	15	6"></textarea>
            <p class="hint">Colunas: Nome, Tipo (A1, A2, EQU, SIS, CAR, FREQ, QP), Pilar, N, Mx, My, Vx, Vy. Com um só pilar, a coluna Pilar pode ser omitida. Separador: tabulação, ponto e vírgula ou espaços; vírgula decimal aceite.</p>
            <div class="row"><button class="btn primary" type="button" data-act="colar">Importar linhas</button><span class="hint" id="pasteMsg"></span></div>
          </fieldset>
          <div class="note">Sem linhas A2, a DA1-C2 usa as cargas A1 com os parâmetros M2 (conservativo). Sem linhas EQU, o derrube é verificado a partir das A1 com verticais × 0,9/1,35 e momentos tal como dados.</div>`;
      }
      if (R && R.combos.length) {
        const by = {};
        for (const c of R.combos) (by[c.tipo] = by[c.tipo] || []).push(c);
        h += `<details><summary class="group-title" style="cursor:pointer">Combinações geradas (${R.combos.length})</summary><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
          ${Object.keys(TIPO_LBL).filter(t => by[t]).map(t => `<div><div class="hint" style="font-weight:600;color:var(--dim)">${TIPO_LBL[t]} · ${by[t].length}</div>${by[t].map(c => `<div class="mono" style="font-size:11.5px;color:var(--dim)">#${c.id} ${esc(c.nome)}${c.fPP !== 1 && c.tipo !== 'EQU' ? ` <span style="color:var(--faint)">(pp × ${f(c.fPP, 2)})</span>` : ''}</div>`).join('')}</div>`).join('')}
        </div></details>`;
      }
      return h;
    },
    analise() {
      return `<fieldset><legend>Terreno — tensões admissíveis</legend>
        ${chk('Verificar com σadm do relatório geotécnico', 'analise.usarSigAdm', { r: true })}
        ${S.analise.usarSigAdm ? row('', fld('Fator para a tensão no bordo', 'analise.kBordo', { hint: 'CYPE 1,25 · Pad Expert 1,30' }), fld('Fator para a situação sísmica', 'analise.kSis', { hint: 'CYPE 1,50' })) +
          chk('Verificar também as combinações ELU com σadm (critério CYPE)', 'analise.sigAdmELU') : ''}
        <p class="hint">Tensão média = V'/A; tensão máxima pela distribuição linear com levantamento. Por defeito com ELS característica.</p>
      </fieldset>
      <fieldset><legend>Terreno — NP EN 1997-1</legend>
        ${chk('Capacidade resistente pelo Anexo D (DA1: Comb. 1 e Comb. 2, drenada e não drenada)', 'analise.usarEC7')}
        ${chk('Exigir contacto total em ELS quase-permanente (resultante no núcleo central)', 'analise.contactoQP')}
        <p class="hint">Deslizamento (6.5.3), excentricidade (6.5.4, elipse B/3) e derrube EQU são sempre verificados.</p>
      </fieldset>
      <fieldset><legend>Assentamentos (ELS)</legend>
        ${chk('Calcular assentamentos', 'analise.usarAssent', { r: true })}
        ${S.analise.usarAssent ? `
          ${row('', fld('Módulo usado', 'analise.metodoAss', { opts: [['E', 'E (conservativo)'], ['oed', 'Eoed a partir de E e ν']] }), fld('Combinação', 'analise.combAssent', { opts: [['QP', 'Quase-permanente'], ['CAR', 'Característica']] }))}
          ${row('', fld('Zona de influência até Δσz =', 'analise.zInfPct', { u: "% σ'v0" }), fld('Assentamento admissível', 'analise.sLim', { u: 'mm' }))}
          ${row('', fld('Rotação admissível 1/', 'analise.rotLim'), '<div></div>')}
          ${chk('Descontar o alívio de tensões da escavação (q − σ\'v0)', 'analise.alivio')}
          <p class="hint">Boussinesq/Newmark sob a distribuição linear de pressões; assentamento do ponto característico (0,37·B; 0,37·L) e rotações pelos pontos médios dos bordos.</p>` : ''}
      </fieldset>`;
    },
    resultados() { return painelResultados(); },
    relatorio() {
      return `<p>A memória de cálculo reúne os dados, as combinações, todas as verificações com as expressões e valores da combinação condicionante, as figuras e os avisos.</p>
        <button class="btn primary" type="button" data-act="relatorio">Abrir memória de cálculo</button>
        ${NO_FRAME ? '<p class="hint">No relatório, use “Imprimir / PDF” e escolha “Guardar como PDF”.</p>' : '<div class="note warn">Nesta pré-visualização a impressão está bloqueada. Na versão publicada no GitHub Pages, o relatório tem o botão “Imprimir / PDF”.</div>'}
        <fieldset><legend>Conteúdo</legend>
          ${chk('Incluir a lista completa de combinações', 'ui_relComb')}
        </fieldset>`;
    }
  };

  /* --------------------------------------------------------- resultados */
  function painelResultados() {
    if (calcErro) return `<div class="note warn">Erro no cálculo: ${esc(calcErro)}</div>`;
    if (!R) return '<p>A calcular…</p>';
    const grupos = ['Geotecnia', 'ELS', 'Estrutural', 'Pormenorização'];
    const falhas = R.checks.filter(c => !c.ok && !c.aviso);
    let h = `<div class="summary ${R.ok ? 'ok' : 'bad'}"><span class="big">${R.ok ? 'Verifica' : 'Não verifica'}</span>
      <span class="sub">${R.checks.length} verificações · ${R.combos.length} combinações · η máx = ${f(R.etaMax, 2)}${falhas.length ? ' · ' + falhas.length + ' falha(s)' : ''}</span></div>`;
    for (const g of grupos) {
      const lst = R.checks.filter(c => c.grupo === g);
      if (!lst.length) continue;
      h += `<div class="chkgroup"><div class="group-title">${g === 'ELS' ? 'Estados limites de utilização' : g}</div>`;
      for (const c of lst) {
        const st = c.ok ? 'ok' : (c.aviso ? 'warn' : 'bad');
        const eta = isFinite(c.eta) ? c.eta : 9.99;
        const sel = ui.check === c.id;
        h += `<button type="button" class="chkrow ${sel ? 'sel' : ''}" data-check="${esc(c.id)}">
          <span class="ic ${st}">${c.ok ? '✓' : (c.aviso ? '!' : '×')}</span>
          <span class="nm">${esc(c.nome)}<small>${esc(c.ref)}</small></span>
          <span class="et" style="color:var(--${st === 'ok' ? 'text' : st})">${isFinite(c.eta) ? f(c.eta, 2) : '∞'}</span>
          <span class="etabar"><i class="${st === 'ok' ? '' : st}" style="width:${Math.min(100, eta * 100 / 1.2)}%"></i></span>
        </button>`;
        if (sel) {
          h += `<div class="detail">
            ${c.val !== undefined ? `<span><b>${c.un === '1/θ' ? 'Valor' : 'Atuante'}:</b> ${fmtVal(c.val, c.un)}${c.lim !== undefined ? ` &nbsp; <b>Limite / resistente:</b> ${fmtVal(c.lim, c.un)}` : ''}</span>` : ''}
            ${c.info ? `<span>${esc(c.info)}</span>` : ''}
            ${c.comb ? `<span><b>Combinação:</b> ${TIPO_LBL[c.comb.tipo] || c.comb.tipo} — ${esc(c.comb.nome)}</span>` : ''}
          </div>`;
        }
      }
      h += '</div>';
    }
    if (R.avisos.length) h += `<div class="avisos"><div class="group-title">Avisos</div>${R.avisos.map(a => `<div class="note warn">${esc(a)}</div>`).join('')}</div>`;
    h += `<p class="hint">Cálculo em ${R.tempo} ms. Clique numa verificação para ver a combinação condicionante no gráfico.</p>`;
    return h;
  }
  function fmtVal(v, un) {
    if (un === '1/θ') return isFinite(v) ? '1/' + f(v, 0) : '0';
    const n = un === 'MPa' ? 3 : (un === 'cm²' ? 2 : (un === 'mm' || un === 'cm' ? 0 : 1));
    return f(v, n) + ' ' + (un || '');
  }

  /* --------------------------------------------------------- eventos */
  function onInput(e) {
    const t = e.target;
    if (t.dataset.psicat !== undefined) return;
    const p = t.dataset.p;
    if (!p) return;
    if (p.startsWith('ui_')) { ui[p] = t.dataset.k === 'bool' ? t.checked : t.value; return; }
    const k = t.dataset.k;
    let v;
    if (k === 'bool') v = t.checked;
    else if (k === 'num') {
      v = parseNum(t.value);
      if (isNaN(v)) { t.classList.add('bad'); return; }
      t.classList.remove('bad');
    } else v = t.value;
    // renomear pilar: migrar chaves
    const m = p.match(/^pilares\.(\d+)\.id$/);
    if (m) {
      const old = S.pilares[+m[1]].id;
      const novo = String(v).trim();
      if (!novo || S.pilares.some((q, j) => j !== +m[1] && q.id === novo)) { t.classList.add('bad'); return; }
      t.classList.remove('bad');
      for (const a of S.cargas.carac.acoes) if (a.val[old]) { a.val[novo] = a.val[old]; delete a.val[old]; }
      for (const l of S.cargas.comb.linhas) if (l.pilar === old) l.pilar = novo;
      v = novo;
    }
    set(S, p, v);
    guardarLocal();
    agendar();
  }
  function onChange(e) {
    const t = e.target;
    if (t.dataset.psicat !== undefined) {
      const a = S.cargas.carac.acoes[+t.dataset.psicat];
      a.cat = t.value; [a.psi0, a.psi1, a.psi2] = PSI[t.value];
      guardarLocal(); renderPanel(); agendar(); return;
    }
    if (t.dataset.p && t.dataset.p.startsWith('ui_')) { ui[t.dataset.p] = t.dataset.k === 'bool' ? t.checked : t.value; return; }
    onInput(e);
    if (t.dataset.r) renderPanel();
    if (t.dataset.p && /\.tipo$/.test(t.dataset.p) && t.dataset.p.startsWith('cargas.carac')) {
      const i = +t.dataset.p.split('.')[3];
      const a = S.cargas.carac.acoes[i];
      if (a.tipo === 'W') [a.psi0, a.psi1, a.psi2] = [0.6, 0.2, 0];
      else if (a.tipo === 'S') [a.psi0, a.psi1, a.psi2] = [0.5, 0.2, 0];
      else if (a.tipo === 'Q') [a.psi0, a.psi1, a.psi2] = PSI[a.cat || 'A'];
      renderPanel();
    }
    if (t.dataset.p === 'materiais.betao' || t.dataset.p === 'materiais.aco') renderPanel();
  }
  const ACTS = {
    addPilar() {
      if (S.pilares.length >= 4) return;
      const p0 = S.pilares[S.pilares.length - 1];
      let n = S.pilares.length + 1; while (S.pilares.some(p => p.id === 'P' + n)) n++;
      const p = { ...p0, id: 'P' + n, x: 0, y: 0 };
      S.pilares.push(p);
      for (const a of S.cargas.carac.acoes) a.val[p.id] = { N: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 };
    },
    delPilar(i) {
      const p = S.pilares.splice(i, 1)[0];
      for (const a of S.cargas.carac.acoes) delete a.val[p.id];
      S.cargas.comb.linhas = S.cargas.comb.linhas.filter(l => l.pilar !== p.id);
    },
    centrar() { if (S.pilares.length === 1) { S.pilares[0].x = 0; S.pilares[0].y = 0; } },
    grid2() { distribuir(2); },
    grid4() { distribuir(4); },
    addCam() { S.terreno.camadas.push({ nome: 'Camada ' + (S.terreno.camadas.length + 1), esp: 0, gamma: 19, gammaSat: 20, phi: 30, c: 0, cu: 0, E: 30, nu: 0.3, sigAdm: 250, spt: 0 }); const n = S.terreno.camadas.length; if (+S.terreno.camadas[n - 2].esp <= 0) S.terreno.camadas[n - 2].esp = 2; },
    delCam(i) { S.terreno.camadas.splice(i, 1); },
    addAcao() { const id = 'a' + Date.now().toString(36); const val = {}; for (const p of S.pilares) val[p.id] = { N: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 }; S.cargas.carac.acoes.push({ id, nome: 'Q' + (S.cargas.carac.acoes.length), tipo: 'Q', cat: 'A', psi0: 0.7, psi1: 0.5, psi2: 0.3, val }); },
    delAcao(i) { S.cargas.carac.acoes.splice(i, 1); },
    addLinha() { const L = S.cargas.comb.linhas; const last = L[L.length - 1]; L.push({ nome: last ? last.nome : 'ELU1', tipo: last ? last.tipo : 'A1', pilar: S.pilares[0].id, N: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 }); },
    delLinha(i) { S.cargas.comb.linhas.splice(i, 1); },
    limparLinhas() { S.cargas.comb.linhas = []; },
    colar() { colarTabela(); return false; },
    relatorio() { abrirRelatorio(); return false; }
  };
  function distribuir(n) {
    const ax = parseNum(ui.ui_ax !== undefined ? ui.ui_ax : '1') || 1;
    const ay = parseNum(ui.ui_ay !== undefined ? ui.ui_ay : '1') || 1;
    const p0 = S.pilares[0];
    const pos = n === 2 ? [[-ax / 2, 0], [ax / 2, 0]] : [[-ax / 2, ay / 2], [ax / 2, ay / 2], [-ax / 2, -ay / 2], [ax / 2, -ay / 2]];
    // somar ações atuais e repartir por igual
    const tot = S.cargas.carac.acoes.map(a => { const s = { N: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 }; for (const k in a.val) for (const q in s) s[q] += +a.val[k][q] || 0; return s; });
    S.pilares = pos.map((c, i) => ({ ...p0, id: 'P' + (i + 1), x: c[0], y: c[1] }));
    S.cargas.carac.acoes.forEach((a, j) => { a.val = {}; for (const p of S.pilares) { const s = tot[j]; a.val[p.id] = { N: s.N / n, Mx: s.Mx / n, My: s.My / n, Vx: s.Vx / n, Vy: s.Vy / n }; } });
    S.cargas.comb.linhas = S.cargas.comb.linhas.filter(l => S.pilares.some(p => p.id === l.pilar));
  }
  function colarTabela() {
    const ta = $('#pasteArea'); const msg = $('#pasteMsg');
    const txt = ta.value.trim();
    if (!txt) { msg.textContent = 'Cole primeiro a tabela na caixa.'; return; }
    const mapT = (s) => {
      const u = String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (/^(A1|ELU|STR|GEO|ULS|FUND)/.test(u)) return 'A1';
      if (/^A2/.test(u)) return 'A2';
      if (/^EQU/.test(u)) return 'EQU';
      if (/^(SIS|SISM|SEIS|E$|ACC)/.test(u)) return 'SIS';
      if (/^(QP|QUASE|QPERM)/.test(u)) return 'QP';
      if (/^FREQ/.test(u)) return 'FREQ';
      if (/^(CAR|ELS|SLS|RARA|CARAC)/.test(u)) return 'CAR';
      return null;
    };
    let n = 0, ign = 0;
    for (const line of txt.split(/\r?\n/)) {
      if (!line.trim()) continue;
      let cells;
      if (line.includes('\t')) cells = line.split('\t');
      else if (line.includes(';')) cells = line.split(';');
      else cells = line.trim().split(/\s+/);
      cells = cells.map(c => c.trim());
      const tipo = mapT(cells[1]);
      if (!tipo) { ign++; continue; }
      let pilar, nums;
      const temPilar = cells.length >= 8 || S.pilares.some(p => p.id === cells[2]);
      if (temPilar) { pilar = cells[2]; nums = cells.slice(3, 8); } else { pilar = S.pilares[0].id; nums = cells.slice(2, 7); }
      if (!S.pilares.some(p => p.id === pilar)) { ign++; continue; }
      const v = nums.map(parseNum);
      if (isNaN(v[0])) { ign++; continue; }
      S.cargas.comb.linhas.push({ nome: cells[0], tipo, pilar, N: v[0] || 0, Mx: v[1] || 0, My: v[2] || 0, Vx: v[3] || 0, Vy: v[4] || 0 });
      n++;
    }
    guardarLocal(); renderPanel(); agendar();
    const m2 = $('#pasteMsg'); if (m2) m2.textContent = `${n} linha(s) importada(s)${ign ? `, ${ign} ignorada(s) (cabeçalho ou tipo/pilar desconhecido)` : ''}.`;
  }

  function onClick(e) {
    const st = e.target.closest('[data-step]');
    if (st) { setStep(st.dataset.step); return; }
    const sg = e.target.closest('[data-seg]');
    if (sg) { set(S, sg.dataset.seg, sg.dataset.val); guardarLocal(); renderPanel(); renderSteps(); agendar(); return; }
    const ac = e.target.closest('[data-act]');
    if (ac && !ac.disabled) {
      const fn = ACTS[ac.dataset.act];
      if (fn) { const r = fn(ac.dataset.i !== undefined ? +ac.dataset.i : undefined); if (r !== false) { guardarLocal(); renderPanel(); renderSteps(); agendar(); } }
      return;
    }
    const ck = e.target.closest('[data-check]');
    if (ck) { selecionarCheck(ck.dataset.check); }
  }
  function selecionarCheck(id) {
    ui.check = ui.check === id ? null : id;
    const c = R && R.checks.find(x => x.id === id);
    if (c && ui.check) {
      if (c.comb) ui.combId = c.comb.id;
      if (/^(flex|corte)/.test(id)) ui.view = 'esforcos';
      else if (/^(assent|rot)/.test(id)) ui.view = 'assent';
      else if (/^(amarr|arr|phimin|smax|smin|asmin)/.test(id)) ui.view = 'corte';
      else ui.view = 'pressoes';
    }
    renderPanel(); renderStage();
  }
  function setStep(id) {
    ui.step = id;
    const st = STEPS.find(s => s.id === id);
    if (st && st.view && (id !== 'resultados' || ui.view === 'planta')) ui.view = st.view;
    renderSteps(); renderPanel(); renderStage();
    if (window.innerWidth <= 760) $('#panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* --------------------------------------------------------- cálculo */
  let calcT = 0;
  function agendar() { clearTimeout(calcT); calcT = setTimeout(recalcular, 220); }
  function recalcular() {
    try { R = C.analisar(S); calcErro = null; }
    catch (err) { R = null; calcErro = err && err.message ? err.message : String(err); console.error(err); }
    if (R && (!ui.combId || !R.combos.some(c => c.id === ui.combId))) {
      const gov = R.checks.find(c => c.id === 'sadm-max') || R.checks.find(c => c.comb);
      ui.combId = gov && gov.comb ? gov.comb.id : (R.combos[0] && R.combos[0].id);
    }
    renderStatus(); renderSteps(); renderStage();
    if (ui.step === 'resultados' || ui.step === 'geometria' || ui.step === 'materiais') {
      const a = document.activeElement;
      if (!(a && a.closest && a.closest('#panelBody') && a.tagName !== 'BUTTON')) renderPanel();
      else if (ui.step === 'resultados') renderPanel();
    }
  }
  function renderStatus() {
    const el = $('#statusPill');
    if (calcErro) { el.className = 'status-pill bad'; el.innerHTML = '<span class="dot"></span><span>Erro de cálculo</span>'; return; }
    if (!R) return;
    el.className = 'status-pill ' + (R.ok ? 'ok' : 'bad');
    el.innerHTML = `<span class="dot"></span><span>${R.ok ? 'Verifica' : 'Não verifica'}</span><span class="eta">η ${f(R.etaMax, 2)}</span>`;
    el.title = 'Ver verificações';
    el.style.cursor = 'pointer';
  }

  /* --------------------------------------------------------- área gráfica */
  function renderStage() {
    $('#viewTabs').innerHTML = VIEWS.map(([id, t]) => `<button type="button" role="tab" class="tab ${ui.view === id ? 'on' : ''}" data-view="${id}" aria-selected="${ui.view === id}">${t}</button>`).join('');
    const sel = $('#combSel');
    const useComb = ['pressoes', 'esforcos', 'corte'].includes(ui.view) && R;
    $('#combWrap').hidden = !useComb;
    if (useComb) {
      const lst = ui.view === 'esforcos' ? R.combos.filter(c => c.tipo === 'A1' || c.tipo === 'SIS') : R.combos;
      if (ui.view === 'esforcos' && !lst.some(c => c.id === ui.combId)) {
        const g = R.checks.find(c => c.id === 'flex-x');
        ui.combId = g && g.comb ? g.comb.id : (lst[0] && lst[0].id);
      }
      const by = {};
      for (const c of lst) (by[c.tipo] = by[c.tipo] || []).push(c);
      sel.innerHTML = Object.keys(TIPO_LBL).filter(t => by[t]).map(t => `<optgroup label="${TIPO_LBL[t]}">${by[t].map(c => `<option value="${c.id}" ${c.id === ui.combId ? 'selected' : ''}>#${c.id} ${esc(c.nome)}${c.fPP !== 1 && c.tipo !== 'EQU' ? ' (pp×' + f(c.fPP, 2) + ')' : ''}</option>`).join('')}</optgroup>`).join('');
    }
    const cv = $('#canvas');
    let svg = '';
    try {
      if (ui.view === 'planta') svg = svgPlanta(false);
      else if (ui.view === 'pressoes') svg = svgPlanta(true);
      else if (ui.view === 'corte') svg = svgCorte();
      else if (ui.view === 'esforcos') svg = svgEsforcos();
      else if (ui.view === 'assent') svg = svgAssent();
    } catch (err) { console.error(err); svg = `<svg viewBox="0 0 800 600"><text x="400" y="300" text-anchor="middle" class="lbl">Não foi possível desenhar: ${esc(err.message)}</text></svg>`; }
    cv.innerHTML = svg;
  }
  const rComb = () => R && R.porComb.find(r => r.comb.id === ui.combId);
  const RAMP = ['#2c5f78', '#3d8b8c', '#79b77e', '#d4c45a', '#e08a48', '#cf4a3e'];
  function ramp(t) {
    t = Math.max(0, Math.min(1, t));
    const k = t * (RAMP.length - 1); const i = Math.min(RAMP.length - 2, Math.floor(k)); const u = k - i;
    const a = RAMP[i], b = RAMP[i + 1];
    const h = (s, o) => parseInt(s.substr(o, 2), 16);
    const c = (o) => Math.round(h(a, o) + u * (h(b, o) - h(a, o))).toString(16).padStart(2, '0');
    return '#' + c(1) + c(3) + c(5);
  }
  function dimH(x1, x2, y, txt, off) {
    off = off || 0;
    return `<g><line class="dim" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line class="dim" x1="${x1}" y1="${y - 5}" x2="${x1}" y2="${y + 5}"/><line class="dim" x1="${x2}" y1="${y - 5}" x2="${x2}" y2="${y + 5}"/><text x="${(x1 + x2) / 2}" y="${y - 6 + off}" text-anchor="middle" class="lbl-s">${txt}</text></g>`;
  }
  function dimV(x, y1, y2, txt, right) {
    return `<g><line class="dim" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><line class="dim" x1="${x - 5}" y1="${y1}" x2="${x + 5}" y2="${y1}"/><line class="dim" x1="${x - 5}" y1="${y2}" x2="${x + 5}" y2="${y2}"/><text x="${right ? x + 8 : x - 8}" y="${(y1 + y2) / 2 + 4}" text-anchor="${right ? 'start' : 'end'}" class="lbl-s">${txt}</text></g>`;
  }

  function svgPlanta(press, opt) {
    opt = opt || {};
    const geo = R ? R.geo : C.geometria(S);
    const { B, L } = geo;
    const W = opt.W || 800, H = opt.H || 600, m = 78;
    const s = Math.min((W - 2 * m) / B, (H - 2 * m) / L);
    const X = (x) => W / 2 + x * s, Y = (y) => H / 2 - y * s;
    const P = [];
    P.push(`<defs><pattern id="hatchUp" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="var(--faint)" stroke-width="1"/></pattern></defs>`);
    P.push(`<rect class="sap" x="${X(-B / 2)}" y="${Y(L / 2)}" width="${B * s}" height="${L * s}"/>`);
    const r = press ? rComb() : null;
    if (press && r && r.pr && r.pr.ok) {
      const pr = r.pr, n = 56;
      const dx = B / n, dy = L / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = -B / 2 + (i + 0.5) * dx, y = -L / 2 + (j + 0.5) * dy;
        const p = pr.a + pr.b * x + pr.c * y;
        const fill = p > 0 ? ramp(p / pr.pmax) : 'url(#hatchUp)';
        P.push(`<rect x="${X(x - dx / 2)}" y="${Y(y + dy / 2)}" width="${dx * s + 0.6}" height="${dy * s + 0.6}" fill="${fill}" ${p > 0 ? 'opacity="0.88"' : ''}/>`);
      }
      // linha neutra
      if (pr.contacto < 0.999) {
        const pts = [];
        const ed = [[-B / 2, -L / 2, B / 2, -L / 2], [B / 2, -L / 2, B / 2, L / 2], [B / 2, L / 2, -B / 2, L / 2], [-B / 2, L / 2, -B / 2, -L / 2]];
        for (const [x1, y1, x2, y2] of ed) {
          const f1 = pr.a + pr.b * x1 + pr.c * y1, f2 = pr.a + pr.b * x2 + pr.c * y2;
          if ((f1 > 0) !== (f2 > 0)) { const t = f1 / (f1 - f2); pts.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]); }
        }
        if (pts.length >= 2) P.push(`<line class="na" x1="${X(pts[0][0])}" y1="${Y(pts[0][1])}" x2="${X(pts[1][0])}" y2="${Y(pts[1][1])}"/>`);
      }
      // área efetiva (ELU)
      if (r.ef) P.push(`<rect class="effa" x="${X(r.cb.ex - r.ef.Bx / 2)}" y="${Y(r.cb.ey + r.ef.Ly / 2)}" width="${r.ef.Bx * s}" height="${r.ef.Ly * s}"/>`);
      // núcleo central e elipse B/3
      P.push(`<polygon class="core" points="${X(B / 6)},${Y(0)} ${X(0)},${Y(L / 6)} ${X(-B / 6)},${Y(0)} ${X(0)},${Y(-L / 6)}"/>`);
      P.push(`<ellipse class="core" cx="${X(0)}" cy="${Y(0)}" rx="${B / 3 * s}" ry="${L / 3 * s}" opacity="0.6"/>`);
      // pressões nos cantos
      const cs = [[-B / 2, -L / 2, 'end', 16], [B / 2, -L / 2, 'start', 16], [B / 2, L / 2, 'start', -8], [-B / 2, L / 2, 'end', -8]];
      for (const [x, y, an, dyy] of cs) {
        const p = Math.max(0, pr.a + pr.b * x + pr.c * y);
        P.push(`<text x="${X(x) + (an === 'end' ? -6 : 6)}" y="${Y(y) + dyy}" text-anchor="${an}" class="lbl">${f(p, 1)}</text>`);
      }
      // legenda
      const lx = W - 34, ly = 70, lh = 200;
      for (let k = 0; k < 40; k++) P.push(`<rect x="${lx}" y="${ly + lh - (k + 1) * lh / 40}" width="12" height="${lh / 40 + 0.5}" fill="${ramp((k + 0.5) / 40)}"/>`);
      P.push(`<text x="${lx + 6}" y="${ly - 22}" text-anchor="middle" class="lbl-s">kPa</text><text x="${lx - 4}" y="${ly + 4}" text-anchor="end" class="lbl-s">${f(pr.pmax, 0)}</text><text x="${lx - 4}" y="${ly + lh}" text-anchor="end" class="lbl-s">0</text>`);
      P.push(`<text x="16" y="${H - 44}" class="lbl-s">σmed = ${f(r.cb.Vef / geo.A, 1)} kPa · σmáx = ${f(pr.pmax, 1)} kPa · área comprimida ${f(pr.contacto * 100, 0)} %</text>`);
      P.push(`<text x="16" y="${H - 28}" class="lbl-s">V' = ${f(r.cb.Vef, 1)} kN · ex = ${f(r.cb.ex, 3)} m · ey = ${f(r.cb.ey, 3)} m${r.ef ? ` · B'×L' = ${f(r.ef.Bx, 2)}×${f(r.ef.Ly, 2)} m` : ''}</text>`);
      P.push(`<text x="16" y="${H - 12}" class="lbl-s">— — núcleo central (B/6) e elipse B/3 · ▭ área efetiva EC7 · ● resultante${pr.contacto < 0.999 ? ' · — — linha neutra' : ''}</text>`);
    } else if (press && r && r.pr && !r.pr.ok) {
      P.push(`<text x="${W / 2}" y="${H - 16}" text-anchor="middle" class="lbl" style="fill:var(--bad)">${esc(r.pr.motivo)}</text>`);
    } else if (!press && !opt.report) {
      // malha inferior (indicativa)
      const m_ = S.materiais, cn = (+m_.cnom || 50) / 1000;
      const sx = +m_.armInf.x.s, sy = +m_.armInf.y.s;
      if (sx > 0.04 && sy > 0.04) {
        for (let y = -L / 2 + cn; y <= L / 2 - cn + 1e-9; y += sx) P.push(`<line class="mesh" x1="${X(-B / 2 + cn)}" y1="${Y(y)}" x2="${X(B / 2 - cn)}" y2="${Y(y)}"/>`);
        for (let x = -B / 2 + cn; x <= B / 2 - cn + 1e-9; x += sy) P.push(`<line class="mesh" x1="${X(x)}" y1="${Y(-L / 2 + cn)}" x2="${X(x)}" y2="${Y(L / 2 - cn)}"/>`);
      }
    }
    // pilares
    geo.pil.forEach((p) => {
      if (p.circ) P.push(`<circle class="pil" cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.D / 2 * s}"/>`);
      else P.push(`<rect class="pil" x="${X(p.x - p.cx / 2)}" y="${Y(p.y + p.cy / 2)}" width="${p.cx * s}" height="${p.cy * s}"/>`);
      P.push(`<text x="${X(p.x)}" y="${Y(p.y) + 4}" text-anchor="middle" class="lbl">${esc(p.id)}</text>`);
    });
    if (press && r && r.pr && r.pr.ok) P.push(`<circle class="res" cx="${X(r.cb.ex)}" cy="${Y(r.cb.ey)}" r="5.5"/>`);
    // punçoamento
    if (R && ui.check && /^punc-/.test(ui.check) && !opt.report) {
      const c = R.checks.find(x => x.id === ui.check);
      const k = c && c.det ? c.det.k : geo.pil.findIndex(p => ui.check.endsWith('-' + p.id));
      const p = geo.pil[k];
      if (p) {
        const a = c && c.det ? c.det.a : 0;
        const d2 = 2 * R.d.dm;
        const rr = (aa, cls) => p.circ ? `<circle class="${cls}" cx="${X(p.x)}" cy="${Y(p.y)}" r="${(p.D / 2 + aa) * s}"/>`
          : `<rect class="${cls}" x="${X(p.x - p.cx / 2 - aa)}" y="${Y(p.y + p.cy / 2 + aa)}" width="${(p.cx + 2 * aa) * s}" height="${(p.cy + 2 * aa) * s}" rx="${aa * s}"/>`;
        P.push(rr(d2, 'perim2'));
        if (a > 0) P.push(rr(a, 'perim'));
        P.push(`<text x="${X(p.x)}" y="${Y(p.y + p.cy / 2 + Math.max(a, 0)) - 6}" text-anchor="middle" class="lbl-s" style="fill:var(--warn)">${a > 0 ? 'a = ' + f(a, 3) + ' m' : 'face'}</text>`);
      }
    }
    // eixos e cotas
    P.push(`<line class="axis" x1="${X(0)}" y1="${Y(0)}" x2="${X(0) + 46}" y2="${Y(0)}"/><line class="axis" x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(0) - 46}"/>`);
    P.push(`<text x="${X(0) + 50}" y="${Y(0) + 4}" class="lbl-s" style="fill:var(--accent)">x</text><text x="${X(0) - 3}" y="${Y(0) - 50}" class="lbl-s" style="fill:var(--accent)">y</text>`);
    P.push(dimH(X(-B / 2), X(B / 2), Y(L / 2) - 26, 'B = ' + f(B, 2) + ' m'));
    P.push(dimV(X(-B / 2) - 26, Y(L / 2), Y(-L / 2), 'L = ' + f(L, 2) + ' m'));
    if (!press && !opt.report) P.push(`<text x="16" y="${H - 12}" class="lbl-s">Planta · malha inferior Ø${S.materiais.armInf.x.phi}//${f(S.materiais.armInf.x.s, 2)} (X) e Ø${S.materiais.armInf.y.phi}//${f(S.materiais.armInf.y.s, 2)} (Y)</text>`);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Planta da sapata">${P.join('')}</svg>`;
  }

  function svgCorte(opt) {
    opt = opt || {};
    const geo = R ? R.geo : C.geometria(S);
    const { B, h, Df } = geo;
    const W = opt.W || 800, H = opt.H || 600, m = 60;
    const lat = Math.max(0.8, 0.5 * B);
    const zTop = 1.0, zBot = Df + Math.max(1.2, 0.9 * B);
    const Wx = B + 2 * lat;
    const s = Math.min((W - 2 * m - 120) / Wx, (H - 2 * m) / (zTop + zBot));
    const X = (x) => (W - 120) / 2 + x * s, Z = (z) => m + (z + zTop) * s;
    const P = [];
    P.push(`<defs><pattern id="hatchFill" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="var(--faint)" stroke-width="0.8" opacity="0.6"/></pattern></defs>`);
    const tones = ['var(--soil-1)', 'var(--soil-2)', 'var(--soil-3)'];
    const lst = C.camadasLista(S);
    lst.forEach((Lc, i) => {
      const z1 = Math.max(0, Lc.topo), z2 = Math.min(zBot, Lc.base);
      if (z2 <= z1) return;
      P.push(`<rect x="${X(-Wx / 2)}" y="${Z(z1)}" width="${Wx * s}" height="${(z2 - z1) * s}" fill="${tones[i % 3]}"/>`);
      P.push(`<line class="dim" x1="${X(-Wx / 2)}" y1="${Z(z1)}" x2="${X(Wx / 2) + 8}" y2="${Z(z1)}"/>`);
      P.push(`<text x="${X(Wx / 2) + 12}" y="${Z(z1) + 16}" class="lbl-s">${esc(Lc.c.nome)}</text>`);
      P.push(`<text x="${X(Wx / 2) + 12}" y="${Z(z1) + 30}" class="lbl-s">φ'=${f(+Lc.c.phi, 0)}° c'=${f(+Lc.c.c, 0)}${+Lc.c.cu > 0 ? ' cu=' + f(+Lc.c.cu, 0) : ''}</text>`);
      if (+Lc.c.sigAdm > 0) P.push(`<text x="${X(Wx / 2) + 12}" y="${Z(z1) + 44}" class="lbl-s">σadm=${f(+Lc.c.sigAdm, 0)} kPa</text>`);
    });
    // aterro sobre a sapata
    if (Df - h > 0) P.push(`<rect x="${X(-B / 2)}" y="${Z(0)}" width="${B * s}" height="${(Df - h) * s}" fill="var(--fill)"/><rect x="${X(-B / 2)}" y="${Z(0)}" width="${B * s}" height="${(Df - h) * s}" fill="url(#hatchFill)"/>`);
    // nível freático
    if (geo.dw < zBot) {
      P.push(`<line class="gwl" x1="${X(-Wx / 2)}" y1="${Z(geo.dw)}" x2="${X(Wx / 2)}" y2="${Z(geo.dw)}"/>`);
      const tx = X(-Wx / 2) + 22;
      P.push(`<polygon points="${tx - 7},${Z(geo.dw) - 11} ${tx + 7},${Z(geo.dw) - 11} ${tx},${Z(geo.dw) - 1}" fill="var(--water)"/><text x="${tx + 12}" y="${Z(geo.dw) - 4}" class="lbl-s" style="fill:var(--water)">NF −${f(geo.dw, 2)} m</text>`);
    }
    // sapata
    P.push(`<rect class="sap" x="${X(-B / 2)}" y="${Z(Df - h)}" width="${B * s}" height="${h * s}"/>`);
    // pilares cortados por y = 0 (ou pelo primeiro pilar)
    const ysec = geo.pil.some(p => Math.abs(p.y) <= p.cy / 2) ? 0 : geo.pil[0].y;
    for (const p of geo.pil) if (Math.abs(p.y - ysec) <= p.cy / 2 + 1e-9) {
      P.push(`<rect class="pil" x="${X(p.x - p.cx / 2)}" y="${Z(-zTop + 0.2)}" width="${p.cx * s}" height="${(Df - h + zTop - 0.2) * s}"/>`);
      P.push(`<text x="${X(p.x)}" y="${Z(-zTop + 0.2) - 6}" text-anchor="middle" class="lbl">${esc(p.id)}</text>`);
    }
    P.push(`<line class="ground" x1="${X(-Wx / 2)}" y1="${Z(0)}" x2="${X(Wx / 2)}" y2="${Z(0)}"/>`);
    // armaduras
    const m_ = S.materiais, cn = (+m_.cnom || 50) / 1000;
    const fx = +m_.armInf.x.phi / 1000, fy = +m_.armInf.y.phi / 1000;
    const xLow = m_.camadaInf !== 'y';
    const zx = xLow ? Df - cn - fx / 2 : Df - cn - fy - fx / 2;
    const zy = xLow ? Df - cn - fx - fy / 2 : Df - cn - fy / 2;
    const zt = Df - h + cn;
    let path = `M${X(-B / 2 + cn)},${Z(zx)} L${X(B / 2 - cn)},${Z(zx)}`;
    if (m_.patilhas) path = `M${X(-B / 2 + cn)},${Z(zt + 0.02)} L${X(-B / 2 + cn)},${Z(zx)} L${X(B / 2 - cn)},${Z(zx)} L${X(B / 2 - cn)},${Z(zt + 0.02)}`;
    P.push(`<path class="bar" d="${path}"/>`);
    const sy = +m_.armInf.y.s;
    if (sy > 0.04) for (let x = -B / 2 + cn + fy / 2; x <= B / 2 - cn + 1e-9; x += sy) P.push(`<circle class="bardot" cx="${X(x)}" cy="${Z(zy)}" r="${Math.max(2, fy / 2 * s)}"/>`);
    if (m_.armSup && m_.armSup.ativa) P.push(`<line class="bar" x1="${X(-B / 2 + cn)}" y1="${Z(zt)}" x2="${X(B / 2 - cn)}" y2="${Z(zt)}" opacity="0.8"/>`);
    // diagrama de pressões
    const r = rComb();
    if (r && r.pr && r.pr.ok && !opt.semPressao) {
      const pr = r.pr, n = 40;
      const ps = (Math.min(zBot - Df, 1.4) * s * 0.75) / pr.pmax;
      let pts = `${X(-B / 2)},${Z(Df)}`;
      for (let i = 0; i <= n; i++) { const x = -B / 2 + i * B / n; const p = Math.max(0, pr.a + pr.b * x + pr.c * ysec); pts += ` ${X(x)},${Z(Df) + p * ps}`; }
      pts += ` ${X(B / 2)},${Z(Df)}`;
      P.push(`<polygon class="press" points="${pts}" opacity="0.92"/>`);
      const p1 = Math.max(0, pr.a - pr.b * B / 2 + pr.c * ysec), p2 = Math.max(0, pr.a + pr.b * B / 2 + pr.c * ysec);
      P.push(`<text x="${X(-B / 2) - 6}" y="${Z(Df) + p1 * ps + 4}" text-anchor="end" class="lbl">${f(p1, 1)}</text><text x="${X(B / 2) + 6}" y="${Z(Df) + p2 * ps + 4}" class="lbl">${f(p2, 1)} kPa</text>`);
    }
    P.push(`<line class="dim" x1="${X(-B / 2)}" y1="${Z(Df)}" x2="${X(-B / 2)}" y2="${Z(zBot) + 22}"/><line class="dim" x1="${X(B / 2)}" y1="${Z(Df)}" x2="${X(B / 2)}" y2="${Z(zBot) + 22}"/>`);
    P.push(dimH(X(-B / 2), X(B / 2), Z(zBot) + 16, 'B = ' + f(B, 2) + ' m', 20));
    P.push(dimV(X(-B / 2) - 18, Z(Df - h), Z(Df), 'h = ' + f(h, 2)));
    P.push(dimV(X(-Wx / 2) + 8, Z(0), Z(Df), 'Df = ' + f(Df, 2), true));
    P.push(`<text x="16" y="${H - 6}" class="lbl-s">Corte segundo X (y = ${f(ysec, 2)} m) · c = ${f(+m_.cnom, 0)} mm · Ø${m_.armInf.x.phi}//${f(+m_.armInf.x.s, 2)} (X) · Ø${m_.armInf.y.phi}//${f(+m_.armInf.y.s, 2)} (Y)${m_.patilhas ? ' com patilhas' : ''}</text>`);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Corte da sapata">${P.join('')}</svg>`;
  }

  function chart(x0, y0, w, h, xs, ys, o) {
    o = o || {};
    const xmin = xs[0], xmax = xs[xs.length - 1];
    let ymin = Math.min(0, ...ys), ymax = Math.max(0, ...ys);
    if (o.lims) for (const v of o.lims) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
    if (ymax - ymin < 1e-9) { ymax = 1; ymin = -1; }
    const pad = (ymax - ymin) * 0.1; ymax += pad; ymin -= pad;
    const X = (x) => x0 + (x - xmin) / (xmax - xmin) * w;
    const Y = (y) => y0 + h - (y - ymin) / (ymax - ymin) * h;
    const P = [];
    P.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" class="chart-grid"/>`);
    if (o.zonas) for (const [a, b] of o.zonas) P.push(`<rect class="colzone" x="${X(Math.max(a, xmin))}" y="${y0}" width="${Math.max(0, X(Math.min(b, xmax)) - X(Math.max(a, xmin)))}" height="${h}"/>`);
    P.push(`<line class="chart-zero" x1="${x0}" y1="${Y(0)}" x2="${x0 + w}" y2="${Y(0)}"/>`);
    let d = `M${X(xs[0])},${Y(0)}`;
    for (let i = 0; i < xs.length; i++) d += ` L${X(xs[i])},${Y(ys[i])}`;
    d += ` L${X(xs[xs.length - 1])},${Y(0)} Z`;
    P.push(`<path class="chart-area" d="${d}" ${o.cls === 'v' ? 'style="fill:var(--warn-soft)"' : ''}/>`);
    let l = ''; for (let i = 0; i < xs.length; i++) l += (i ? ' L' : 'M') + X(xs[i]) + ',' + Y(ys[i]);
    P.push(`<path class="chart-line ${o.cls || ''}" d="${l}"/>`);
    if (o.lims) for (const v of o.lims) P.push(`<line class="chart-lim" x1="${x0}" y1="${Y(v)}" x2="${x0 + w}" y2="${Y(v)}"/><text x="${x0 + w - 4}" y="${Y(v) - 4}" text-anchor="end" class="lbl-s" style="fill:var(--bad)">${f(v, 0)}</text>`);
    if (o.marca !== undefined && o.marca !== null) { const k = o.marcaV; P.push(`<line x1="${X(o.marca)}" y1="${y0}" x2="${X(o.marca)}" y2="${y0 + h}" stroke="var(--warn)" stroke-dasharray="3 3"/><circle class="mark" cx="${X(o.marca)}" cy="${Y(k)}" r="4"/><text x="${X(o.marca) + 6}" y="${Y(k) - 6}" class="lbl" style="fill:var(--warn)">${f(k, 1)}</text>`); }
    // extremos
    let imax = 0, imin = 0; ys.forEach((v, i) => { if (v > ys[imax]) imax = i; if (v < ys[imin]) imin = i; });
    const amp = Math.max(Math.abs(ys[imax]), Math.abs(ys[imin]), 1e-9);
    if (ys[imax] > 0.02 * amp) P.push(`<text x="${X(xs[imax])}" y="${Y(ys[imax]) - 6}" text-anchor="middle" class="lbl-s">${f(ys[imax], 1)}</text>`);
    if (ys[imin] < -0.02 * amp) P.push(`<text x="${X(xs[imin])}" y="${Y(ys[imin]) + 14}" text-anchor="middle" class="lbl-s">${f(ys[imin], 1)}</text>`);
    P.push(`<text x="${x0}" y="${y0 - 8}" class="ttl">${o.titulo || ''}</text>`);
    P.push(`<text x="${x0}" y="${y0 + h + 16}" class="lbl-s">${f(xmin, 2)}</text><text x="${x0 + w}" y="${y0 + h + 16}" text-anchor="end" class="lbl-s">${f(xmax, 2)} m</text>`);
    return P.join('');
  }
  function svgEsforcos() {
    const W = 800, H = 600;
    const r = rComb();
    if (!r || !r.cx) return `<svg viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="lbl">Selecione uma combinação ELU (A1) ou sísmica.</text></svg>`;
    const geo = R.geo;
    const P = [];
    const zon = (dir) => geo.pil.map(p => dir === 'x' ? [p.x - p.ex_ / 2, p.x + p.ex_ / 2] : [p.y - p.ey_ / 2, p.y + p.ey_ / 2]);
    const fl = (id) => R.checks.find(c => c.id === id);
    for (const [k, dir] of [[0, 'x'], [1, 'y']]) {
      const cv = dir === 'x' ? r.cx : r.cy;
      const x0 = 50 + k * 385, w = 330;
      const fc = fl('flex-' + dir), fs = fl('flexs-' + dir), cc = fl('corte-' + dir);
      const lims = []; if (fc && fc.lim) lims.push(fc.lim); if (fs && fs.lim) lims.push(-fs.lim);
      const mk = fc && fc.comb && fc.comb.id === r.comb.id && fc.det ? fc.det.s : null;
      P.push(chart(x0, 60, w, 210, cv.pos, cv.M, { titulo: `M — varões segundo ${dir.toUpperCase()} (kN·m)`, zonas: zon(dir), lims, marca: mk, marcaV: mk !== null ? cv.at(mk).M : 0 }));
      const lv = cc && cc.lim ? [cc.lim, -cc.lim] : [];
      P.push(chart(x0, 340, w, 190, cv.pos, cv.V, { titulo: `V — secções ⟂ ${dir.toUpperCase()} (kN)`, zonas: zon(dir), lims: lv, cls: 'v' }));
    }
    P.push(`<text x="16" y="${H - 12}" class="lbl-s">Esforços totais na largura da sapata · ${esc(TIPO_LBL[r.comb.tipo])}: ${esc(r.comb.nome)} · zonas sombreadas = pilares · tracejado vermelho = resistência</text>`);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Diagramas de esforços">${P.join('')}</svg>`;
  }
  function svgAssent(opt) {
    opt = opt || {};
    const W = opt.W || 800, H = opt.H || 600;
    if (!R || !R.assent) return `<svg viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="lbl">Assentamento não calculado (ative-o em Opções de análise e indique E nas camadas).</text></svg>`;
    const a = R.assent, geo = R.geo;
    const pf = a.perfil.filter(q => q.z - geo.Df <= Math.max(a.zInf * 1.6, 2 * Math.min(geo.B, geo.L)));
    const x0 = 90, y0 = 50, w = 420, h = H - 120;
    const zmax = pf[pf.length - 1].z - geo.Df;
    const smax = Math.max(...pf.map(q => Math.max(q.ds, q.lim)), 1);
    const X = (v) => x0 + v / smax * w, Y = (z) => y0 + z / zmax * h;
    const P = [];
    const tones = ['var(--soil-1)', 'var(--soil-2)', 'var(--soil-3)'];
    C.camadasLista(S).forEach((Lc, i) => {
      const z1 = Math.max(0, Lc.topo - geo.Df), z2 = Math.min(zmax, Lc.base - geo.Df);
      if (z2 <= z1) return;
      P.push(`<rect x="${x0}" y="${Y(z1)}" width="${w}" height="${Y(z2) - Y(z1)}" fill="${tones[i % 3]}" opacity="0.55"/><text x="${x0 + w + 8}" y="${Y(z1) + 14}" class="lbl-s">${esc(Lc.c.nome)} · E=${f(+Lc.c.E, 0)} MPa</text>`);
    });
    P.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" class="chart-grid"/>`);
    let d1 = '', d2 = '';
    pf.forEach((q, i) => { d1 += (i ? ' L' : 'M') + X(q.ds) + ',' + Y(q.z - geo.Df); d2 += (i ? ' L' : 'M') + X(q.lim) + ',' + Y(q.z - geo.Df); });
    P.push(`<path class="chart-line" d="${d1}"/><path class="chart-lim" d="${d2}" fill="none"/>`);
    P.push(`<line x1="${x0}" y1="${Y(a.zInf)}" x2="${x0 + w}" y2="${Y(a.zInf)}" stroke="var(--warn)" stroke-dasharray="4 3"/><text x="${x0 + 6}" y="${Y(a.zInf) - 6}" class="lbl" style="fill:var(--warn)">zona de influência ${f(a.zInf, 2)} m</text>`);
    P.push(`<text x="${x0}" y="${y0 - 14}" class="ttl">Δσz sob o centro (kPa) e ${f(+S.analise.zInfPct || 20, 0)} % de σ'v0</text>`);
    P.push(`<text x="${x0 - 8}" y="${y0 + 4}" text-anchor="end" class="lbl-s">base</text><text x="${x0 - 8}" y="${y0 + h}" text-anchor="end" class="lbl-s">${f(zmax, 1)} m</text>`);
    P.push(`<text x="${x0 + w}" y="${y0 + h + 16}" text-anchor="end" class="lbl-s">${f(smax, 0)} kPa</text>`);
    const tx = x0 + w + 8, ty = H - 170;
    const lines = [
      ['Combinação', TIPO_LBL[a.comb.tipo]],
      ['q média', f(a.qmed, 1) + ' kPa'],
      ['Alívio σ\'v0', f(a.alivio, 1) + ' kPa'],
      ['s (ponto caract.)', f(a.sChar * 1000, 1) + ' mm'],
      ['s (centro)', f(a.sCentro * 1000, 1) + ' mm'],
      ['θx · θy', `1/${f(1 / Math.max(1e-9, Math.abs(a.rotX)), 0)} · 1/${f(1 / Math.max(1e-9, Math.abs(a.rotY)), 0)}`]
    ];
    lines.forEach(([k, v], i) => P.push(`<text x="${tx}" y="${ty + i * 20}" class="lbl-s">${k}</text><text x="${W - 16}" y="${ty + i * 20}" text-anchor="end" class="lbl">${v}</text>`));
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Assentamento">${P.join('')}</svg>`;
  }

  /* --------------------------------------------------------- relatório */
  function abrirRelatorio() {
    if (!R) recalcular();
    const ov = $('#overlay');
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Memória de cálculo">
      <div class="modal-head"><h3>Memória de cálculo</h3>
        ${NO_FRAME ? '<button class="btn primary" type="button" id="btnPrint">Imprimir / PDF</button>' : '<span class="hint">Impressão disponível na versão do GitHub Pages.</span>'}
        <button class="btn" type="button" id="btnFechar">Fechar</button></div>
      <div class="modal-body">${relatorioHTML()}</div></div>`;
    ov.hidden = false;
    $('#btnFechar').onclick = () => { ov.hidden = true; ov.innerHTML = ''; };
    const bp = $('#btnPrint'); if (bp) bp.onclick = () => window.print();
  }
  const okTxt = (c) => c.ok ? '<span class="ok">Verifica</span>' : (c.aviso ? '<span class="warn">Atenção</span>' : '<span class="bad">Não verifica</span>');
  function relatorioHTML() {
    if (!R) return '<p>Sem resultados.</p>';
    const p = S.projeto, g = R.geo, bet = R.bet, ac = R.aco, m = S.materiais;
    const chk = (id) => R.checks.find(c => c.id === id);
    const rOf = (c) => c && c.comb ? R.porComb.find(r => r.comb.id === c.comb.id) : null;
    const H = [];
    H.push(`<div class="report">
      <div class="rhead"><img class="logo-img" src="logo_color.png" alt="BO Engenharia" onerror="this.outerHTML='<div class=&quot;logo&quot;>BO</div>'"><div><h1>Sapata ${esc(p.ref || '')} — memória de cálculo</h1><div>Verificação geotécnica e estrutural de sapata isolada</div></div><div class="mono" style="text-align:right;font-size:11px">${esc(p.data || '')}<br>v0.1</div></div>
      <div class="meta"><div><span>Projeto / Obra:</span> ${esc(p.obra)}</div><div><span>Requerente:</span> ${esc(p.cliente)}</div><div><span>Morada:</span> ${esc(p.local)}</div><div><span>Autor:</span> ${esc(p.autor)}</div><div><span>Referência:</span> ${esc(p.ref)}</div><div><span>Verificado por:</span> ${esc(p.verificador)}</div></div>
      ${p.notas ? `<p style="margin-top:8px"><i>${esc(p.notas)}</i></p>` : ''}`);

    H.push(`<h2>1. Normas e pressupostos</h2>
      <p>NP EN 1990:2009 (AN: só a expressão 6.10 em edifícios) · NP EN 1997-1:2010 + A1:2016 (AN: <b>Abordagem de Cálculo 1</b>) · NP EN 1992-1-1:2010 + AC:2012 + A1:2019 (AN) · NP EN 1998-1:2010 e NP EN 1998-5:2010 (AN).</p>
      <table><tr><th>Conjunto</th><th>γG desf.</th><th>γG fav.</th><th>γQ</th><th>γφ'</th><th>γc'</th><th>γcu</th><th>γR;v</th><th>γR;h</th></tr>
      <tr><td>DA1 — Comb. 1 (A1+M1+R1)</td><td>1,35</td><td>1,00</td><td>1,50</td><td>1,00</td><td>1,00</td><td>1,00</td><td>1,00</td><td>1,00</td></tr>
      <tr><td>DA1 — Comb. 2 (A2+M2+R1)</td><td>1,00</td><td>1,00</td><td>1,30</td><td>1,25</td><td>1,25</td><td>1,40</td><td>1,00</td><td>1,00</td></tr>
      <tr><td>Sísmica (Quadros NA.I–III)</td><td>1,00</td><td>1,00</td><td>ψ2</td><td>1,10</td><td>1,10</td><td>1,15</td><td>1,00</td><td>1,00</td></tr>
      <tr><td>EQU (Quadro A.1)</td><td>1,10</td><td>0,90</td><td>1,50 / 0</td><td colspan="5">—</td></tr></table>
      <p>Betão: γc = 1,5; αcc = 1,0. Aço: γs = 1,15. Distribuição linear de pressões no terreno sem trações (sapata ${R.rigida ? 'rígida' : 'flexível'}). Capacidade resistente pelo Anexo D da NP EN 1997-1 sem fatores de profundidade (conservativo).</p>`);

    H.push(`<h2>2. Geometria</h2>
      <table><tr><th>B (X)</th><th>L (Y)</th><th>h</th><th>Df</th><th>Área</th><th>Peso sapata</th><th>Aterro (h = ${f(g.hAt, 2)} m)</th><th>Sobrecarga</th></tr>
      <tr><td class="mono">${f(g.B, 2)} m</td><td class="mono">${f(g.L, 2)} m</td><td class="mono">${f(g.h, 2)} m</td><td class="mono">${f(g.Df, 2)} m</td><td class="mono">${f(g.A, 3)} m²</td><td class="mono">${f(g.Wsap, 1)} kN</td><td class="mono">${f(g.Wat, 1)} kN</td><td class="mono">${f(+S.geometria.qSup, 1)} kPa (${S.geometria.qSupTipo === 'G' ? 'perm.' : 'var.'})</td></tr></table>
      <table><tr><th>Pilar</th><th>Secção</th><th>x</th><th>y</th><th>Ø arranques</th></tr>
      ${g.pil.map(q => `<tr><td>${esc(q.id)}</td><td>${q.circ ? 'Circular D = ' + f(q.D, 2) + ' m' : f(q.cx, 2) + ' × ' + f(q.cy, 2) + ' m'}</td><td class="mono">${f(q.x, 3)}</td><td class="mono">${f(q.y, 3)}</td><td>Ø${q.phi}</td></tr>`).join('')}</table>
      <div class="figs"><figure class="fig">${svgPlanta(false, { report: true, W: 640, H: 480 })}<figcaption>Planta</figcaption></figure><figure class="fig">${svgCorte({ W: 640, H: 480, semPressao: true })}<figcaption>Corte segundo X</figcaption></figure></div>`);

    H.push(`<h2>3. Materiais e armaduras</h2>
      <table><tr><th>Betão</th><th>fck</th><th>fcd</th><th>fctm</th><th>Aço</th><th>fyd</th><th>c nom</th></tr>
      <tr><td>${bet.classe}</td><td class="mono">${f(bet.fck, 0)} MPa</td><td class="mono">${f(bet.fcd, 2)} MPa</td><td class="mono">${f(bet.fctm, 2)} MPa</td><td>${ac.classe}</td><td class="mono">${f(ac.fyd, 1)} MPa</td><td class="mono">${f(+m.cnom, 0)} mm</td></tr></table>
      <table><tr><th>Malha</th><th>Direção X</th><th>Direção Y</th><th>d</th><th>As total</th></tr>
      <tr><td>Inferior</td><td>Ø${m.armInf.x.phi}//${f(+m.armInf.x.s, 2)}</td><td>Ø${m.armInf.y.phi}//${f(+m.armInf.y.s, 2)}</td><td class="mono">${f(R.d.dx, 3)} / ${f(R.d.dy, 3)} m</td><td class="mono">${f(R.d.AsX, 2)} / ${f(R.d.AsY, 2)} cm²</td></tr>
      ${m.armSup.ativa ? `<tr><td>Superior</td><td>Ø${m.armSup.x.phi}//${f(+m.armSup.x.s, 2)}</td><td>Ø${m.armSup.y.phi}//${f(+m.armSup.y.s, 2)}</td><td class="mono">${f(R.d.dxs, 3)} / ${f(R.d.dys, 3)} m</td><td class="mono">${f(R.d.AsXs, 2)} / ${f(R.d.AsYs, 2)} cm²</td></tr>` : ''}</table>`);

    const cams = C.camadasLista(S);
    H.push(`<h2>4. Terreno</h2>
      <table><tr><th>Camada</th><th>Topo</th><th>Base</th><th>γ / γsat</th><th>φ'</th><th>c'</th><th>cu</th><th>E</th><th>ν</th><th>σadm</th><th>NSPT</th></tr>
      ${cams.map(L => `<tr><td>${esc(L.c.nome)}</td><td class="mono">${f(L.topo, 2)}</td><td class="mono">${isFinite(L.base) ? f(L.base, 2) : '—'}</td><td class="mono">${f(+L.c.gamma, 1)} / ${f(+L.c.gammaSat, 1)}</td><td class="mono">${f(+L.c.phi, 1)}°</td><td class="mono">${f(+L.c.c, 1)}</td><td class="mono">${f(+L.c.cu, 1)}</td><td class="mono">${f(+L.c.E, 1)}</td><td class="mono">${f(+L.c.nu, 2)}</td><td class="mono">${f(+L.c.sigAdm, 0)}</td><td class="mono">${+L.c.spt ? f(+L.c.spt, 0) : '—'}</td></tr>`).join('')}</table>
      <p>Nível freático: ${isFinite(g.dw) ? 'à profundidade de ' + f(g.dw, 2) + ' m' : 'não considerado'}. Unidades: m, kN/m³, °, kPa, MPa.</p>`);

    // ações
    let ac_ = '';
    if (S.cargas.modo === 'carac') {
      ac_ = `<table><tr><th>Ação</th><th>Tipo</th><th>ψ0 / ψ1 / ψ2</th><th>Pilar</th><th>N</th><th>Mx</th><th>My</th><th>Vx</th><th>Vy</th></tr>
        ${S.cargas.carac.acoes.map(a => S.pilares.map((q, i) => { const v = a.val[q.id] || {}; return `<tr><td>${i ? '' : esc(a.nome)}</td><td>${i ? '' : a.tipo}</td><td class="mono">${i ? '' : (['Q', 'W', 'S'].includes(a.tipo) ? `${f(+a.psi0, 2)} / ${f(+a.psi1, 2)} / ${f(+a.psi2, 2)}` : '—')}</td><td>${esc(q.id)}</td>${['N', 'Mx', 'My', 'Vx', 'Vy'].map(k => `<td class="mono">${f(+v[k] || 0, 1)}</td>`).join('')}</tr>`; }).join('')).join('')}</table>
        <p>Combinações geradas pela expressão (6.10) com γG = 1,35 e 1,00. Sismo: G + ψ2·Q ± ${f(+S.cargas.omega, 2)}·AEd.</p>`;
    } else {
      ac_ = `<table><tr><th>Nome</th><th>Tipo</th><th>Pilar</th><th>N</th><th>Mx</th><th>My</th><th>Vx</th><th>Vy</th></tr>
        ${S.cargas.comb.linhas.map(l => `<tr><td>${esc(l.nome)}</td><td>${l.tipo}</td><td>${esc(l.pilar)}</td>${['N', 'Mx', 'My', 'Vx', 'Vy'].map(k => `<td class="mono">${f(+l[k] || 0, 1)}</td>`).join('')}</tr>`).join('')}</table>
        <p>Combinações importadas${S.cargas.comb.reacoes ? ' (reações de apoio com sinais invertidos)' : ''}.</p>`;
    }
    const cnt = {}; for (const c of R.combos) cnt[c.tipo] = (cnt[c.tipo] || 0) + 1;
    H.push(`<h2>5. Ações e combinações</h2>${ac_}<p>Total de ${R.combos.length} combinações: ${Object.keys(cnt).map(t => `${TIPO_LBL[t]} ${cnt[t]}`).join(' · ')}.</p>`);
    if (ui.ui_relComb) H.push(`<table><tr><th>#</th><th>Tipo</th><th>Combinação</th><th>pp</th></tr>${R.combos.map(c => `<tr><td>${c.id}</td><td>${TIPO_LBL[c.tipo]}</td><td>${esc(c.nome)}</td><td class="mono">${f(c.fPP, 2)}</td></tr>`).join('')}</table>`);

    // resumo
    H.push(`<h2>6. Resumo das verificações</h2>
      <p><b>Resultado global: ${R.ok ? '<span class="ok">VERIFICA</span>' : '<span class="bad">NÃO VERIFICA</span>'}</b> — η máx = ${f(R.etaMax, 3)}.</p>
      <table><tr><th>Verificação</th><th>Referência</th><th>Atuante</th><th>Limite</th><th>η</th><th>Estado</th></tr>
      ${R.checks.map(c => `<tr><td>${esc(c.nome)}</td><td>${esc(c.ref)}</td><td class="mono">${c.val !== undefined ? fmtVal(c.val, c.un) : '—'}</td><td class="mono">${c.lim !== undefined ? fmtVal(c.lim, c.un) : '—'}</td><td class="mono">${isFinite(c.eta) ? f(c.eta, 3) : '∞'}</td><td>${okTxt(c)}</td></tr>`).join('')}</table>`);

    // geotecnia detalhada
    H.push(`<h2>7. Verificações geotécnicas</h2>`);
    const csa = chk('sadm-max') || chk('sadm-med');
    const rp = rOf(csa) || R.porComb.find(r => r.comb.tipo === 'CAR');
    if (rp) {
      H.push(`<h3>7.1 Pressões no terreno — ${esc(TIPO_LBL[rp.comb.tipo])}: ${esc(rp.comb.nome)}</h3>
        <div class="eq">ΣN = ${f(rp.cb.N, 1)} kN;  W = ${f(rp.cb.Wd, 1)} kN;  Q sup = ${f(rp.cb.Qd, 1)} kN;  U = ${f(rp.cb.U, 1)} kN
V' = ΣN + W + Qsup − U = ${f(rp.cb.Vef, 1)} kN
My,b = Σ(My + N·x + Vx·h) = ${f(rp.cb.My, 2)} kN·m  →  ex = My,b / V' = ${f(rp.cb.ex, 4)} m
Mx,b = Σ(Mx − N·y − Vy·h) = ${f(rp.cb.Mx, 2)} kN·m  →  ey = −Mx,b / V' = ${f(rp.cb.ey, 4)} m
σmed = V'/A = ${f(rp.cb.Vef / g.A, 1)} kPa;  σmáx = ${f(rp.pr.pmax, 1)} kPa;  área comprimida = ${f(rp.pr.contacto * 100, 1)} %</div>
        <div class="figs"><figure class="fig">${svgPlantaReport(rp)}<figcaption>Pressões (kPa) — ${esc(rp.comb.nome)}</figcaption></figure><div style="font-size:11.5px">${['sadm-med', 'sadm-max', 'sadm-sis-med', 'sadm-sis-max'].map(chk).filter(Boolean).map(c => `<p>${esc(c.nome)}: ${fmtVal(c.val, c.un)} ≤ ${fmtVal(c.lim, c.un)} → η = ${f(c.eta, 3)} ${okTxt(c)}</p>`).join('')}</div></div>`);
    }
    let sec = 2;
    for (const id of ['ec7-d-A1', 'ec7-d-A2', 'ec7-d-SIS', 'ec7-u-A1', 'ec7-u-A2', 'ec7-u-SIS']) {
      const c = chk(id); if (!c) continue;
      const r = c.r, d = id.includes('-d-') ? r.dren : r.nd, pt = r.pt;
      if (!d || d.falha) { H.push(`<h3>7.${sec++} ${esc(c.nome)}</h3><p class="bad">Área efetiva nula: a resultante sai da base.</p>`); continue; }
      const ef = id.includes('-d-') ? r.ef : d.ef;
      H.push(`<h3>7.${sec++} ${esc(c.nome)}</h3><p>Combinação: ${esc(c.comb.nome)} · parâmetros ${esc(r.mset.nome)} · camada "${esc(pt.cam.nome)}"</p>`);
      if (id.includes('-d-')) {
        H.push(`<div class="eq">φ'd = atan(tan ${f(pt.phik, 1)}° / ${f(r.mset.phi, 2)}) = ${f(pt.phid, 2)}°;  c'd = ${f(pt.ck, 1)} / ${f(r.mset.c, 2)} = ${f(pt.cd, 2)} kPa
q' = σ'v0(Df) = ${f(pt.q, 2)} kPa;  γ' = ${f(pt.gEf, 2)} kN/m³
B' = ${f(ef.B_, 3)} m;  L' = ${f(ef.L_, 3)} m;  A' = ${f(ef.A_, 3)} m²;  H = ${f(r.cb.H, 2)} kN;  V'd = ${f(d.Vd, 1)} kN
Nq = e^(π·tanφ')·tan²(45+φ'/2) = ${f(d.Nq, 3)};  Nc = (Nq−1)·cotφ' = ${f(d.Nc, 3)};  Nγ = 2(Nq−1)·tanφ' = ${f(d.Ng, 3)}
sq = ${f(d.sq, 3)};  sγ = ${f(d.sg, 3)};  sc = ${f(d.sc, 3)};  m = ${f(d.m, 3)};  iq = ${f(d.iq, 3)};  iγ = ${f(d.ig, 3)};  ic = ${f(d.ic, 3)}
R/A' = c'·Nc·sc·ic + q'·Nq·sq·iq + 0,5·γ'·B'·Nγ·sγ·iγ = ${f(d.tc, 1)} + ${f(d.tq, 1)} + ${f(d.tg, 1)} = ${f(d.qult, 1)} kPa
Rd = A'·(R/A') / γR;v = ${f(d.Rd, 1)} kN  ≥  Vd = ${f(d.Vd, 1)} kN  →  η = ${f(c.eta, 3)}  ${c.ok ? '✓' : '✗'}</div>`);
      } else {
        H.push(`<div class="eq">cu,d = ${f(pt.cuk, 1)} / ${f(r.mset.cu, 2)} = ${f(pt.cud, 2)} kPa;  q = σv0(Df) = ${f(pt.qTot, 2)} kPa
B' = ${f(ef.B_, 3)} m;  L' = ${f(ef.L_, 3)} m;  A' = ${f(ef.A_, 3)} m²;  H = ${f(r.cb.H, 2)} kN
sc = 1 + 0,2·B'/L' = ${f(d.sc, 3)};  ic = ½·[1 + √(1 − H/(A'·cu))] = ${f(d.ic, 3)}
R/A' = (π+2)·cu·sc·ic + q = ${f(d.qult, 1)} kPa;  Rd = ${f(d.Rd, 1)} kN  ≥  Vd = ${f(d.Vd, 1)} kN  →  η = ${f(c.eta, 3)}  ${c.ok ? '✓' : '✗'}</div>`);
      }
    }
    const cd = chk('desl');
    if (cd && cd.r && cd.r.desl) {
      const dl = cd.r.desl;
      H.push(`<h3>7.${sec++} Deslizamento — ${esc(cd.comb.nome)}</h3><div class="eq">Hd = √(Hx² + Hy²) = ${f(dl.Hd, 2)} kN
${dl.dren ? `Drenado: Rd = V'd·tan δd / γR;h = ${f(cd.r.cb.Vef, 1)}·tan(${f(dl.dren.delta, 2)}°) = ${f(dl.dren.Rd, 1)} kN\n` : ''}${dl.nd ? `Não drenado: Rd = A'·cu,d / γR;h = ${f(dl.nd.A_, 3)}·${f(dl.nd.cud, 2)} = ${f(dl.nd.Rd, 1)} kN${S.analise.aguaInterface ? ' (≤ 0,4·Vd)' : ''}\n` : ''}η = Hd / Rd = ${f(cd.eta, 3)}  ${cd.ok ? '✓' : '✗'}</div>`);
    }
    for (const id of ['exc', 'nucleo', 'equ']) {
      const c = chk(id); if (!c) continue;
      H.push(`<h3>7.${sec++} ${esc(c.nome)}</h3><p>${esc(c.info || '')}${c.comb ? ' — ' + esc(c.comb.nome) : ''}. η = ${f(c.eta, 3)} ${okTxt(c)}</p>`);
      if (id === 'equ' && c.r && c.r.equ) H.push(`<div class="eq">Bordo ${c.r.equ.bordo}:  Mdst = ${f(c.r.equ.Mdst, 1)} kN·m  ≤  Mstb = ${f(c.r.equ.Mstb, 1)} kN·m
Componentes estabilizantes × γG,stb = 0,9 (variáveis × 0); instabilizantes × γG,dst = 1,1 / γQ = 1,5 (EQU) ou × 1,0 (sísmica)</div>`);
      if (id === 'exc') H.push(`<div class="eq">(3·ex/B)² + (3·ey/L)² ≤ 1  (resultante dentro da elipse de semieixos B/3 e L/3 — EC7 6.5.4)</div>`);
    }
    if (R.assent) {
      const a = R.assent, ca = chk('assent'), cr = chk('rot');
      H.push(`<h3>7.${sec++} Assentamentos — ${esc(a.comb.nome)}</h3>
        <div class="eq">Δσz por integração de Boussinesq (Newmark) da distribuição linear de pressões${S.analise.alivio !== false ? `, descontado σ'v0 = ${f(a.alivio, 1)} kPa` : ''}
s = Σ Δσz·Δz / ${S.analise.metodoAss === 'oed' ? 'Eoed' : 'E'}  até Δσz = ${f(+S.analise.zInfPct || 20, 0)} %·σ'v0  (zona de influência ${f(a.zInf, 2)} m)
s (ponto característico 0,37B; 0,37L) = ${f(a.sChar * 1000, 1)} mm ≤ ${f(+S.analise.sLim, 0)} mm  ${ca && ca.ok ? '✓' : '✗'}
θx = 1/${f(1 / Math.max(1e-9, Math.abs(a.rotX)), 0)};  θy = 1/${f(1 / Math.max(1e-9, Math.abs(a.rotY)), 0)};  limite 1/${f(+S.analise.rotLim, 0)}  ${cr && cr.ok ? '✓' : '✗'}</div>
        <figure class="fig" style="max-width:520px">${svgAssent({ W: 800, H: 600 })}</figure>`);
    }

    // estrutural
    H.push(`<h2>8. Verificações estruturais (NP EN 1992-1-1)</h2>
      <p>Esforços obtidos por equilíbrio da sapata sob a pressão do terreno líquida (pressão − peso próprio e aterro) e as cargas dos pilares distribuídas na sua área; secções de referência ${m.seccaoRef === '015' ? 'a 0,15·c para o interior da face' : 'na face'} dos pilares.</p>`);
    let k8 = 1;
    for (const dir of ['x', 'y']) {
      const c = chk('flex-' + dir), cm = chk('asmin-' + dir), cv = chk('corte-' + dir), cs = chk('flexs-' + dir);
      if (!c) continue;
      const D = c.det;
      H.push(`<h3>8.${k8++} Direção ${dir.toUpperCase()} — ${esc(c.comb ? c.comb.nome : '')}</h3>
        <div class="eq">Flexão: MEd = ${f(c.val, 1)} kN·m (secção ${dir} = ${f(D.s || 0, 3)} m);  b = ${f(D.b, 2)} m;  d = ${f(D.d, 3)} m
As,req = ${f(D.AsReq, 2)} cm²;  As,prov = ${f(D.As, 2)} cm²;  MRd = As·fyd·(d − 0,4x) = ${f(D.MRd, 1)} kN·m;  x/d = ${f(D.xd, 3)} ≤ 0,45  →  η = ${f(c.eta, 3)} ${c.ok ? '✓' : '✗'}
${cm ? cm.info + '  →  ' + (cm.ok ? '✓' : '✗') : ''}
${cs ? `${cs.nome}: ${fmtVal(cs.val, cs.un)} ≤ ${fmtVal(cs.lim, cs.un)}  ${cs.ok ? '✓' : '✗'}\n` : ''}${cv ? `Esforço transverso: ${cv.val !== undefined ? `VEd = ${f(cv.val, 1)} kN ≤ VRd,c = ${f(cv.lim, 1)} kN; ${cv.info}  ${cv.ok ? '✓' : '✗'}` : cv.info}` : ''}</div>`);
    }
    for (const q of g.pil) {
      const cf = chk('punc-max-' + q.id), cp = chk('punc-' + q.id);
      if (!cf && !cp) continue;
      const r = rOf(cp && cp.comb ? cp : cf);
      const pc = r && r.punc ? r.punc[g.pil.indexOf(q)] : null;
      H.push(`<h3>8.${k8++} Punçoamento — pilar ${esc(q.id)}</h3><div class="eq">d = (dx + dy)/2 = ${f(R.d.dm, 3)} m;  ρl = √(ρx·ρy) = ${f(Math.sqrt(R.d.rhoX * R.d.rhoY) * 100, 3)} %
${cf ? `Face do pilar: vEd = β·VEd,red/(u0·d) = ${f(cf.val, 3)} MPa ≤ vRd,max = 0,4·ν·fcd = ${f(cf.lim, 3)} MPa  ${cf.ok ? '✓' : '✗'}  (${esc(cf.info)})` : ''}
${cp && cp.val !== undefined && pc ? `Perímetros a ≤ 2d (6.4.4(2)): VEd,red = VEd − ΔVEd (reação do terreno no interior do perímetro)
vRd = CRd,c·k·(100·ρl·fck)^(1/3)·2d/a ≥ vmin·2d/a;  k = ${f(pc.k, 3)};  vRd,c(2d) = ${f(pc.vRdc, 3)} MPa
Perímetro crítico: ${esc(cp.info)}
vEd = ${f(cp.val, 3)} MPa ≤ vRd = ${f(cp.lim, 3)} MPa  →  η = ${f(cp.eta, 3)}  ${cp.ok ? '✓' : '✗'}` : (cp ? esc(cp.info || '') : '')}</div>`);
    }
    for (const dir of ['x', 'y']) {
      const c = chk('amarr-' + dir); if (!c) continue;
      H.push(`<p><b>Amarração ${dir.toUpperCase()} (9.8.2.2):</b> Fs = R·ze/zi; ${esc(c.info)}; lbd = ${f(c.val, 0)} mm ≤ disponível ${f(c.lim, 0)} mm → ${okTxt(c)}</p>`);
    }
    H.push(`<h3>8.${k8++} Disposições construtivas</h3><table><tr><th>Verificação</th><th>Valor</th><th>Limite</th><th>Estado</th></tr>
      ${['phimin', 'smax', 'smin', ...g.pil.map(q => 'arr-' + q.id)].map(chk).filter(Boolean).map(c => `<tr><td>${esc(c.nome)}<br><small>${esc(c.info || c.ref)}</small></td><td class="mono">${fmtVal(c.val, c.un)}</td><td class="mono">${fmtVal(c.lim, c.un)}</td><td>${okTxt(c)}</td></tr>`).join('')}</table>`);

    if (R.avisos.length) H.push(`<h2>9. Avisos</h2><ul>${R.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`);
    H.push(`<div class="disc">Memória gerada pela ferramenta “Sapatas” (Webapps-BO, v0.1) em ${new Date().toLocaleString('pt-PT')}. Este software é uma ferramenta auxiliar de cálculo e não substitui a validação técnica e o julgamento profissional de um engenheiro qualificado. O utilizador assume total responsabilidade pelo uso e verificação independente dos resultados.</div></div>`);
    return H.join('');
  }
  function svgPlantaReport(r) {
    const save = ui.combId; ui.combId = r.comb.id;
    const s = svgPlanta(true, { report: true, W: 640, H: 520 });
    ui.combId = save;
    return s;
  }

  /* --------------------------------------------------------- ficheiros */
  function nomeFicheiro() { return ('sapata-' + (S.projeto.ref || 'S') + '-' + (S.projeto.obra || '')).replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 60) + '.json'; }
  function guardarJSON() {
    const txt = JSON.stringify(S, null, 2);
    if (NO_FRAME) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      a.download = nomeFicheiro();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      return;
    }
    modal('Guardar cálculo', `<p>Nesta pré-visualização não é possível descarregar ficheiros. Copie o texto e guarde-o num ficheiro <span class="mono">${esc(nomeFicheiro())}</span>. Na versão do GitHub Pages o botão descarrega o ficheiro diretamente.</p>
      <textarea class="inp" id="jsonOut" rows="14" readonly>${esc(txt)}</textarea><div class="row" style="margin-top:8px"><button class="btn primary" type="button" id="btnCopy">Copiar</button><span class="hint" id="copyMsg"></span></div>`);
    $('#btnCopy').onclick = () => {
      const ta = $('#jsonOut');
      const done = () => { $('#copyMsg').textContent = 'Copiado.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); $('#copyMsg').textContent = 'Selecionado: use Ctrl+C.'; });
      else { ta.select(); $('#copyMsg').textContent = 'Selecionado: use Ctrl+C.'; }
    };
  }
  function abrirJSON() {
    modal('Abrir cálculo', `<p>Escolha um ficheiro JSON guardado anteriormente, ou cole o seu conteúdo.</p>
      <div class="row"><button class="btn primary" type="button" id="btnFile">Escolher ficheiro…</button><span></span></div>
      <textarea class="inp" id="jsonIn" rows="10" placeholder='{"app":"sapatas-bo", …}' style="margin-top:10px"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn" type="button" id="btnLoadTxt">Carregar texto</button><span class="hint" id="loadMsg"></span></div>`);
    $('#btnFile').onclick = () => $('#fileInput').click();
    $('#btnLoadTxt').onclick = () => { const ok = aplicarJSON($('#jsonIn').value); if (!ok) $('#loadMsg').textContent = 'O texto não é um cálculo de sapatas válido.'; };
  }
  function aplicarJSON(txt) {
    try {
      const o = JSON.parse(txt);
      if (!o || typeof o !== 'object' || !o.geometria || !o.pilares) return false;
      S = normalizar(o);
      guardarLocal(); fecharModal(); ui.check = null; ui.combId = null;
      renderSteps(); renderPanel(); recalcular();
      return true;
    } catch (e) { return false; }
  }
  function modal(t, body) {
    const ov = $('#overlay');
    ov.innerHTML = `<div class="modal small" role="dialog" aria-modal="true" aria-label="${esc(t)}"><div class="modal-head"><h3>${esc(t)}</h3><button class="btn" type="button" id="btnFechar">Fechar</button></div><div class="modal-body">${body}</div></div>`;
    ov.hidden = false;
    $('#btnFechar').onclick = fecharModal;
  }
  function fecharModal() { const ov = $('#overlay'); ov.hidden = true; ov.innerHTML = ''; }

  /* --------------------------------------------------------- arranque */
  function init() {
    const pb = $('#panelBody');
    pb.addEventListener('input', (e) => { if (e.target.tagName !== 'SELECT' && e.target.type !== 'checkbox') onInput(e); });
    pb.addEventListener('change', onChange);
    document.addEventListener('click', (e) => {
      if (e.target.closest('#overlay')) { if (e.target.id === 'overlay') fecharModal(); return; }
      const v = e.target.closest('[data-view]');
      if (v) { ui.view = v.dataset.view; renderStage(); return; }
      if (e.target.closest('#statusPill')) { setStep('resultados'); return; }
      if (e.target.closest('#steps') || e.target.closest('#panel')) onClick(e);
    });
    $('#combSel').addEventListener('change', (e) => { ui.combId = +e.target.value; renderStage(); });
    $('#btnRelatorio').onclick = abrirRelatorio;
    $('#btnGuardar').onclick = guardarJSON;
    $('#btnAbrir').onclick = () => { if (NO_FRAME) $('#fileInput').click(); else abrirJSON(); };
    $('#fileInput').addEventListener('change', (e) => {
      const fl = e.target.files && e.target.files[0]; if (!fl) return;
      const rd = new FileReader();
      rd.onload = () => { if (!aplicarJSON(String(rd.result))) modal('Abrir cálculo', '<p>O ficheiro não é um cálculo de sapatas válido.</p>'); };
      rd.readAsText(fl);
      e.target.value = '';
    });
    $('#btnNovo').onclick = (e) => {
      const b = e.currentTarget;
      if (Date.now() - ui.novoArm < 4000) { S = normalizar(vazio()); ui.novoArm = 0; b.textContent = 'Novo'; guardarLocal(); ui.check = null; ui.combId = null; setStep('projeto'); recalcular(); return; }
      ui.novoArm = Date.now(); b.textContent = 'Confirmar novo?';
      setTimeout(() => { b.textContent = 'Novo'; }, 4000);
    };
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#overlay').hidden) fecharModal(); });
    renderSteps(); renderPanel(); renderStage(); recalcular();
  }
  init();
})();
