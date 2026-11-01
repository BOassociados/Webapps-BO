/* ==========================================================================
   Sapatas — motor de cálculo
   BO Associados · Webapps-BO · ferramentas/sapatas/calc.js

   Normas: NP EN 1990 (AN), NP EN 1997-1 (AN: Abordagem de Cálculo 1),
           NP EN 1992-1-1 (+AC:2012, +A1:2019, AN), NP EN 1998-1/-5 (AN).
   Unidades internas: kN, m, kPa (kN/m²). Betão/aço em MPa.

   Convenção de sinais (regra da mão direita, eixo z para cima), esforços
   transmitidos pelo pilar à sapata, aplicados no topo da sapata:
     N  > 0  compressão (força para baixo)
     Vx, Vy  forças horizontais segundo +x / +y
     Mx, My  momentos em torno de x / y
   Na base:  My,b = Σ(My + N·x + Vx·h) → ex =  My,b / V
             Mx,b = Σ(Mx − N·y − Vy·h) → ey = −Mx,b / V
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SapataCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEG = Math.PI / 180;
  const GW = 10; // peso volúmico da água (kN/m³)

  /* ---------------------------------------------------------------------
     Materiais (NP EN 1992-1-1, Quadro 3.1; AN: γc = 1,5, γs = 1,15, αcc = 1,0)
     --------------------------------------------------------------------- */
  const BETOES = ['C16/20', 'C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60'];
  const ACOS = { A400: 400, A500: 500 };

  function betao(classe) {
    const fck = parseFloat(String(classe).replace('C', '').split('/')[0]);
    const fctm = 0.30 * Math.pow(fck, 2 / 3);
    const fctk005 = 0.7 * fctm;
    const gc = 1.5;
    return {
      classe, fck, fctm, fctk005, gc,
      fcd: 1.0 * fck / gc,
      fctd: 1.0 * fctk005 / gc,
      Ecm: 22 * Math.pow((fck + 8) / 10, 0.3) * 1000
    };
  }
  function aco(classe) {
    const fyk = ACOS[classe] || 500;
    return { classe, fyk, gs: 1.15, fyd: fyk / 1.15 };
  }

  /* ---------------------------------------------------------------------
     Coeficientes parciais (Anexo A + AN da NP EN 1997-1; AN da NP EN 1990)
     --------------------------------------------------------------------- */
  const SETS = {
    A1: { G: 1.35, Ginf: 1.0, Q: 1.5 },
    A2: { G: 1.0, Ginf: 1.0, Q: 1.3 },
    EQU: { Gdst: 1.1, Gstb: 0.9, Qdst: 1.5, Qstb: 0 }
  };
  // conjuntos de parâmetros do terreno: M1, M2, sísmico (Quadro NA.II — situações acidentais/sísmicas)
  const MSETS = {
    M1: { phi: 1.0, c: 1.0, cu: 1.0, nome: 'M1' },
    M2: { phi: 1.25, c: 1.25, cu: 1.4, nome: 'M2' },
    SIS: { phi: 1.1, c: 1.1, cu: 1.15, nome: 'Sísmico (Quadro NA.II)' },
    K: { phi: 1.0, c: 1.0, cu: 1.0, nome: 'Característico' }
  };
  const R1 = { Rv: 1.0, Rh: 1.0 }; // DA1 usa sempre R1; sísmico: Quadro NA.III → 1,0

  /* ---------------------------------------------------------------------
     Álgebra auxiliar
     --------------------------------------------------------------------- */
  function solve3(A, b) {
    // eliminação de Gauss com pivotagem parcial
    const M = [A[0].slice(), A[1].slice(), A[2].slice()];
    const v = b.slice();
    for (let i = 0; i < 3; i++) {
      let p = i;
      for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
      if (Math.abs(M[p][i]) < 1e-14) return null;
      [M[i], M[p]] = [M[p], M[i]];
      [v[i], v[p]] = [v[p], v[i]];
      for (let r = i + 1; r < 3; r++) {
        const f = M[r][i] / M[i][i];
        for (let c = i; c < 3; c++) M[r][c] -= f * M[i][c];
        v[r] -= f * v[i];
      }
    }
    const x = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      let s = v[i];
      for (let c = i + 1; c < 3; c++) s -= M[i][c] * x[c];
      x[i] = s / M[i][i];
    }
    return x;
  }

  /* ---------------------------------------------------------------------
     Polígonos: momentos exatos e recorte por semiplano
     --------------------------------------------------------------------- */
  function rectPoly(B, L) {
    return [[-B / 2, -L / 2], [B / 2, -L / 2], [B / 2, L / 2], [-B / 2, L / 2]];
  }
  function polyMoments(P) {
    let A = 0, Sx = 0, Sy = 0, Ixx = 0, Iyy = 0, Ixy = 0;
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = P[i];
      const [x1, y1] = P[(i + 1) % n];
      const cr = x0 * y1 - x1 * y0;
      A += cr;
      Sx += (x0 + x1) * cr;
      Sy += (y0 + y1) * cr;
      Ixx += (x0 * x0 + x0 * x1 + x1 * x1) * cr;
      Iyy += (y0 * y0 + y0 * y1 + y1 * y1) * cr;
      Ixy += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * cr;
    }
    return { A: A / 2, Sx: Sx / 6, Sy: Sy / 6, Ixx: Ixx / 12, Iyy: Iyy / 12, Ixy: Ixy / 24 };
  }
  // mantém a parte do polígono onde a + b·x + c·y ≥ 0
  function clipPoly(P, a, b, c) {
    const out = [];
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const p0 = P[i], p1 = P[(i + 1) % n];
      const f0 = a + b * p0[0] + c * p0[1];
      const f1 = a + b * p1[0] + c * p1[1];
      if (f0 >= 0) out.push(p0);
      if ((f0 >= 0) !== (f1 >= 0)) {
        const t = f0 / (f0 - f1);
        out.push([p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1])]);
      }
    }
    return out;
  }
  function pointInPoly(x, y, P) {
    let ins = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }

  /* ---------------------------------------------------------------------
     Distribuição linear de pressões com levantamento (sem tração)
     Resolve p(x,y) = max(0, a + b·x + c·y) tal que
       ∫p dA = V,  ∫p·x dA = V·ex,  ∫p·y dA = V·ey
     Newton com integrais exatas sobre o polígono comprimido.
     --------------------------------------------------------------------- */
  function solvePressure(P, V, ex, ey) {
    const full = polyMoments(P);
    const res = { ok: false, V, ex, ey, a: 0, b: 0, c: 0, pmax: 0, pmin: 0, contacto: 0, ativo: [], motivo: '' };
    if (!(V > 1e-9)) { res.motivo = 'Resultante vertical nula ou de tração (levantamento da sapata).'; return res; }
    if (!pointInPoly(ex, ey, P)) { res.motivo = 'Resultante fora da base: derrube.'; return res; }
    const rhs = [V, V * ex, V * ey];
    const J0 = [[full.A, full.Sx, full.Sy], [full.Sx, full.Ixx, full.Ixy], [full.Sy, full.Ixy, full.Iyy]];
    let x = solve3(J0, rhs);
    const pv = (q, X) => X[0] + X[1] * q[0] + X[2] * q[1];
    let minp = Math.min(...P.map(q => pv(q, x)));
    let maxp = Math.max(...P.map(q => pv(q, x)));
    if (minp >= -1e-9 * Math.max(1, maxp)) {
      Object.assign(res, { ok: true, a: x[0], b: x[1], c: x[2], pmax: maxp, pmin: Math.max(0, minp), contacto: 1, ativo: P.slice() });
      return res;
    }
    const resid = (X) => {
      const act = clipPoly(P, X[0], X[1], X[2]);
      if (act.length < 3) return { F: [-V, -V * ex, -V * ey], n: Infinity, act, m: null };
      const m = polyMoments(act);
      const F = [
        X[0] * m.A + X[1] * m.Sx + X[2] * m.Sy - rhs[0],
        X[0] * m.Sx + X[1] * m.Ixx + X[2] * m.Ixy - rhs[1],
        X[0] * m.Sy + X[1] * m.Ixy + X[2] * m.Iyy - rhs[2]
      ];
      const sc = Math.sqrt(full.A) || 1;
      const n = Math.hypot(F[0], F[1] / sc, F[2] / sc);
      return { F, n, act, m };
    };
    let r = resid(x);
    for (let it = 0; it < 200 && r.n > 1e-10 * V; it++) {
      const m = r.m;
      if (!m) break;
      const J = [[m.A, m.Sx, m.Sy], [m.Sx, m.Ixx, m.Ixy], [m.Sy, m.Ixy, m.Iyy]];
      const d = solve3(J, r.F.map(v => -v));
      if (!d) break;
      let t = 1, xn, rn;
      do {
        xn = [x[0] + t * d[0], x[1] + t * d[1], x[2] + t * d[2]];
        rn = resid(xn);
        if (rn.n < r.n * (1 - 1e-4 * t)) break;
        t *= 0.5;
      } while (t > 1e-6);
      x = xn; r = rn;
    }
    if (!(r.n < 1e-6 * V) || !r.m) { res.motivo = 'Não foi possível obter uma distribuição de pressões em equilíbrio (excentricidade excessiva).'; return res; }
    const act = r.act;
    maxp = Math.max(...act.map(q => pv(q, x)));
    Object.assign(res, { ok: true, a: x[0], b: x[1], c: x[2], pmax: maxp, pmin: 0, contacto: r.m.A / full.A, ativo: act });
    return res;
  }

  /* ---------------------------------------------------------------------
     NP EN 1997-1, Anexo D — capacidade resistente ao carregamento
     --------------------------------------------------------------------- */
  // dims efetivas e direção de H
  function areaEfetiva(B, L, ex, ey) {
    const Bx = B - 2 * Math.abs(ex);
    const Ly = L - 2 * Math.abs(ey);
    if (Bx <= 0 || Ly <= 0) return null;
    const xMenor = Bx <= Ly;
    return { Bx, Ly, B_: Math.min(Bx, Ly), L_: Math.max(Bx, Ly), A_: Bx * Ly, xMenor };
  }
  function expoenteM(B_, L_, Hb, Hl) {
    const r = B_ / L_;
    const mB = (2 + r) / (1 + r);
    const mL = (2 + 1 / r) / (1 + 1 / r);
    const H = Math.hypot(Hb, Hl);
    if (H < 1e-12) return { m: mB, mB, mL, theta: 0 };
    const theta = Math.atan2(Math.abs(Hb), Math.abs(Hl)); // ângulo com a direção de L'
    return { m: mL * Math.cos(theta) ** 2 + mB * Math.sin(theta) ** 2, mB, mL, theta };
  }
  /**
   * drenado: {phi (graus, valor de cálculo), c (kPa, cálculo), gEf (γ' abaixo da base), q (σ'v na base)}
   * ef: resultado de areaEfetiva; V: carga vertical efetiva de cálculo; Hb/Hl componentes de H segundo B'/L'
   */
  function capDrenada(p, ef, V, Hb, Hl, alfa) {
    alfa = alfa || 0;
    const phi = Math.max(p.phi, 0.05) * DEG;
    const tf = Math.tan(phi);
    const Nq = Math.exp(Math.PI * tf) * Math.tan(Math.PI / 4 + phi / 2) ** 2;
    const Nc = (Nq - 1) / tf;
    const Ng = 2 * (Nq - 1) * tf;
    const bq = (1 - alfa * tf) ** 2, bg = bq;
    const bc = bq - (1 - bq) / (Nc * tf);
    const r = ef.B_ / ef.L_;
    const sq = 1 + r * Math.sin(phi);
    const sg = 1 - 0.3 * r;
    const sc = (sq * Nq - 1) / (Nq - 1);
    const H = Math.hypot(Hb, Hl);
    const M = expoenteM(ef.B_, ef.L_, Hb, Hl);
    const base = 1 - H / (V + ef.A_ * p.c / tf);
    let iq, ig, ic;
    if (base <= 0) { iq = 0; ig = 0; ic = 0; }
    else {
      iq = Math.pow(base, M.m);
      ig = Math.pow(base, M.m + 1);
      ic = iq - (1 - iq) / (Nc * tf);
      if (ic < 0) ic = 0;
    }
    const tc = p.c * Nc * bc * sc * ic;
    const tq = p.q * Nq * bq * sq * iq;
    const tg = 0.5 * p.gEf * ef.B_ * Ng * bg * sg * ig;
    const qult = tc + tq + tg;
    return { tipo: 'drenada', Nq, Nc, Ng, bq, bg, bc, sq, sg, sc, iq, ig, ic, m: M.m, mB: M.mB, mL: M.mL, theta: M.theta,
      tc, tq, tg, qult, R: qult * ef.A_, phi: p.phi, c: p.c, gEf: p.gEf, q: p.q };
  }
  function capNaoDrenada(p, ef, H, alfa) {
    alfa = alfa || 0;
    const bc = 1 - 2 * alfa / (Math.PI + 2);
    const sc = 1 + 0.2 * ef.B_ / ef.L_;
    const lim = ef.A_ * p.cu;
    let ic = 0;
    if (H <= lim && lim > 0) ic = 0.5 * (1 + Math.sqrt(Math.max(0, 1 - H / lim)));
    const qult = (Math.PI + 2) * p.cu * bc * sc * ic + p.q;
    return { tipo: 'nao-drenada', bc, sc, ic, qult, R: qult * ef.A_, cu: p.cu, q: p.q, Hlim: lim };
  }

  /* ---------------------------------------------------------------------
     Perfil do terreno
     --------------------------------------------------------------------- */
  // camadas: [{nome, esp (m; 0 = até ao fim), gamma, gammaSat, phi, c, cu, E (MPa), nu, sigAdm}]
  function camadaEm(st, z) {
    const cs = st.terreno.modo === 'unica' ? [st.terreno.camadas[0]] : st.terreno.camadas;
    let topo = 0;
    for (let i = 0; i < cs.length; i++) {
      const e = +cs[i].esp || 0;
      if (i === cs.length - 1 || e <= 0 || z < topo + e - 1e-9) return { c: cs[i], i, topo, base: (e > 0 && i < cs.length - 1) ? topo + e : Infinity };
      topo += e;
    }
    return { c: cs[cs.length - 1], i: cs.length - 1, topo, base: Infinity };
  }
  function camadasLista(st) {
    const cs = st.terreno.modo === 'unica' ? [st.terreno.camadas[0]] : st.terreno.camadas;
    let topo = 0;
    return cs.map((c, i) => {
      const e = +c.esp || 0;
      const fim = (i === cs.length - 1 || e <= 0) ? Infinity : topo + e;
      const o = { c, i, topo, base: fim };
      topo = fim;
      return o;
    });
  }
  function nivelFreatico(st) {
    return st.terreno.nf && st.terreno.nf.considerar ? Math.max(0, +st.terreno.nf.prof || 0) : Infinity;
  }
  // tensões verticais à profundidade z (a partir da superfície final)
  function tensoesIn(st, z) {
    const dw = nivelFreatico(st);
    let sv = 0, z0 = 0;
    const lst = camadasLista(st);
    for (const L of lst) {
      if (z0 >= z) break;
      const z1 = Math.min(z, L.base);
      // dividir no nível freático
      const a = z0, b = z1;
      const g = +L.c.gamma, gs = +L.c.gammaSat || +L.c.gamma;
      if (b <= dw) sv += g * (b - a);
      else if (a >= dw) sv += gs * (b - a);
      else sv += g * (dw - a) + gs * (b - dw);
      z0 = z1;
    }
    const u = z > dw ? GW * (z - dw) : 0;
    return { sv, u, sve: sv - u };
  }

  /* ---------------------------------------------------------------------
     Geometria derivada
     --------------------------------------------------------------------- */
  function geometria(st) {
    const g = st.geometria;
    const B = +g.B, L = +g.L, h = +g.h, Df = +g.Df;
    const pil = st.pilares.map(p => {
      const circ = p.forma === 'circ';
      const cx = circ ? +p.D : +p.cx;
      const cy = circ ? +p.D : +p.cy;
      const area = circ ? Math.PI * p.D * p.D / 4 : cx * cy;
      return { id: p.id, circ, x: +p.x, y: +p.y, cx, cy, D: +p.D, area, phi: +p.phi || 16,
        // lado equivalente para secções de referência (área igual)
        ex_: circ ? Math.sqrt(area) : cx, ey_: circ ? Math.sqrt(area) : cy };
    });
    const A = B * L;
    const Acol = pil.reduce((s, p) => s + p.area, 0);
    const hAt = Math.max(0, Df - h);
    const Wsap = (+g.gammaC || 25) * A * h;
    const Wat = (+g.gammaAterro || 18) * Math.max(0, A - Acol) * hAt;
    const dw = nivelFreatico(st);
    const U = dw < Df ? GW * (Df - dw) * A : 0;
    const Qs = (+g.qSup || 0) * A;
    // balanços
    let vMax = 0;
    if (pil.length) {
      vMax = Math.max(
        B / 2 - Math.max(...pil.map(p => p.x + p.cx / 2)),
        B / 2 + Math.min(...pil.map(p => p.x - p.cx / 2)),
        L / 2 - Math.max(...pil.map(p => p.y + p.cy / 2)),
        L / 2 + Math.min(...pil.map(p => p.y - p.cy / 2)));
    }
    return { B, L, h, Df, A, pil, Acol, hAt, Wsap, Wat, W: Wsap + Wat, U, Qs, dw, poly: rectPoly(B, L), vMax };
  }

  /* ---------------------------------------------------------------------
     Combinações de ações
     --------------------------------------------------------------------- */
  const z5 = () => ({ N: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 });
  const KEYS = ['N', 'Mx', 'My', 'Vx', 'Vy'];

  function acoesInternas(st) {
    // devolve a lista de ações características {id,nome,tipo,psi0,psi1,psi2,val:{pid:{...}}}
    return (st.cargas.carac.acoes || []).map(a => ({ ...a }));
  }

  function nomeTermo(f, a) {
    const ff = Math.round(Math.abs(f) * 1000) / 1000;
    return (f < 0 ? '−' : '+') + ' ' + (ff === 1 ? '' : String(ff).replace('.', ',') + '·') + a.nome;
  }

  function gerarCombinacoes(st) {
    const out = [];
    const geo = geometria(st);
    const qsupTipo = st.geometria.qSupTipo || 'Q';
    if (st.cargas.modo === 'comb') return combinacoesImportadas(st, geo);

    const A = acoesInternas(st);
    const G = A.filter(a => a.tipo === 'G');
    const Q = A.filter(a => a.tipo === 'Q');
    const W = A.filter(a => a.tipo === 'W');
    const S = A.filter(a => a.tipo === 'S');
    const E = A.filter(a => a.tipo === 'E');
    // sobrecarga à superfície como ação variável interna
    const qsup = geo.Qs > 0 && qsupTipo === 'Q' ? { id: '__qsup', nome: 'Sobrecarga à superfície', tipo: 'Q', psi0: +st.geometria.qSupPsi0 || 0.7, psi1: +st.geometria.qSupPsi1 || 0.5, psi2: +st.geometria.qSupPsi2 || 0.3, qsup: true, val: {} } : null;
    const Qall = qsup ? [...Q, qsup] : Q;
    const qsupPerm = geo.Qs > 0 && qsupTipo === 'G';

    // conjuntos de variáveis: Q (todas ou nenhuma) × vento (um ou nenhum) × neve (uma ou nenhuma)
    const qSets = Qall.length ? [Qall, []] : [[]];
    const sets = [];
    for (const qs of qSets) for (const w of [null, ...W]) for (const s of [null, ...S]) sets.push([...qs, w, s].filter(Boolean));
    const seen = new Set();
    const push = (c) => {
      const key = c.tipo + '|' + c.fPP + '|' + c.termos.map(t => t.a.id + ':' + t.f.toFixed(4)).sort().join(',');
      if (seen.has(key)) return;
      seen.add(key);
      c.id = out.length + 1;
      out.push(c);
    };
    const fq = (a, f) => ({ a, f });

    const fundamentais = (tipo, gG, gQ) => {
      for (const gg of gG) {
        for (const vs of sets) {
          if (!vs.length) {
            push({ tipo, fPP: gg, fQs: qsupPerm ? gg : 0, termos: G.map(a => fq(a, gg)), lider: null });
            continue;
          }
          for (const lead of vs) {
            const termos = G.map(a => fq(a, gg));
            for (const v of vs) termos.push(fq(v, v === lead ? gQ : gQ * (+v.psi0)));
            push({ tipo, fPP: gg, fQs: qsupPerm ? gg : 0, termos, lider: lead.id });
          }
        }
      }
    };
    fundamentais('A1', [SETS.A1.G, SETS.A1.Ginf], SETS.A1.Q);
    fundamentais('A2', [SETS.A2.G], SETS.A2.Q);

    // EQU (Conjunto A): fatores por componente (estabilizante / instabilizante)
    for (const vs of sets) {
      const leads = vs.length ? vs : [null];
      for (const lead of leads) {
        const partes = G.map(a => ({ a, fNs: SETS.EQU.Gstb, fNd: SETS.EQU.Gdst, fMs: SETS.EQU.Gstb, fMd: SETS.EQU.Gdst }));
        for (const v of vs) {
          const f = v === lead ? SETS.EQU.Qdst : SETS.EQU.Qdst * (+v.psi0);
          partes.push({ a: v, fNs: 0, fNd: f, fMs: 0, fMd: f });
        }
        push({ tipo: 'EQU', fPP: SETS.EQU.Gstb, fPPd: SETS.EQU.Gdst, fQs: qsupPerm ? SETS.EQU.Gstb : 0, fU: SETS.EQU.Gdst, partes,
          termos: partes.map(p => ({ a: p.a, f: p.fMd })), lider: lead ? lead.id : null });
      }
    }

    // sísmica: G + ψ2·Q + γRd·Ω·(±E)
    const omega = +st.cargas.omega || 1;
    for (const e of E) {
      for (const s of [1, -1]) {
        const termos = G.map(a => fq(a, 1));
        for (const v of [...Qall, ...W, ...S]) if (+v.psi2 > 0) termos.push(fq(v, +v.psi2));
        termos.push({ a: e, f: s * omega });
        const partes = termos.map(t => ({ a: t.a, fNs: t.f, fNd: t.f, fMs: t.f, fMd: t.f }));
        push({ tipo: 'SIS', fPP: 1, fQs: qsupPerm ? 1 : 0, termos, partes, fU: 1, sinal: s, lider: e.id });
      }
    }

    // ELS característica, frequente, quase-permanente
    for (const vs of sets) {
      if (!vs.length) { push({ tipo: 'CAR', fPP: 1, fQs: qsupPerm ? 1 : 0, termos: G.map(a => fq(a, 1)), lider: null }); continue; }
      for (const lead of vs) {
        const t1 = G.map(a => fq(a, 1)); const t2 = G.map(a => fq(a, 1));
        for (const v of vs) {
          t1.push(fq(v, v === lead ? 1 : +v.psi0));
          const f2 = v === lead ? +v.psi1 : +v.psi2;
          if (f2 > 0) t2.push(fq(v, f2));
        }
        push({ tipo: 'CAR', fPP: 1, fQs: qsupPerm ? 1 : 0, termos: t1, lider: lead.id });
        push({ tipo: 'FREQ', fPP: 1, fQs: qsupPerm ? 1 : 0, termos: t2, lider: lead.id });
      }
    }
    {
      const termos = G.map(a => fq(a, 1));
      for (const v of [...Qall, ...W, ...S]) if (+v.psi2 > 0) termos.push(fq(v, +v.psi2));
      push({ tipo: 'QP', fPP: 1, fQs: qsupPerm ? 1 : 0, termos, lider: null });
    }

    // nomes legíveis
    for (const c of out) c.nome = c.termos.filter(t => Math.abs(t.f) > 1e-9).map(t => nomeTermo(t.f, t.a)).join(' ').replace(/^\+ /, '') || 'Peso próprio';
    return out;
  }

  // modo de combinações importadas (Robot, CYPE, Excel)
  function combinacoesImportadas(st, geo) {
    const out = [];
    const linhas = st.cargas.comb.linhas || [];
    const inv = !!st.cargas.comb.reacoes;
    const grupos = new Map();
    for (const r of linhas) {
      const nome = String(r.nome || '').trim() || 'Comb';
      const key = nome + '§' + r.tipo;
      if (!grupos.has(key)) grupos.set(key, { nome, tipo: r.tipo, val: {} });
      const g = grupos.get(key);
      const pid = r.pilar || (st.pilares[0] && st.pilares[0].id);
      const v = { N: +r.N || 0, Mx: +r.Mx || 0, My: +r.My || 0, Vx: +r.Vx || 0, Vy: +r.Vy || 0 };
      if (inv) { v.Mx = -v.Mx; v.My = -v.My; v.Vx = -v.Vx; v.Vy = -v.Vy; }
      g.val[pid] = v;
    }
    const temA2 = [...grupos.values()].some(g => g.tipo === 'A2');
    const temQP = [...grupos.values()].some(g => g.tipo === 'QP');
    const qsupQ = (st.geometria.qSupTipo || 'Q') === 'Q';
    let id = 1;
    const add = (c) => { c.id = id++; out.push(c); };
    for (const g of grupos.values()) {
      const a = { id: 'imp' + id, nome: g.nome, tipo: g.tipo, val: g.val };
      const termos = [{ a, f: 1 }];
      if (g.tipo === 'A1') {
        add({ tipo: 'A1', nome: g.nome + ' (pp×1,35)', termos, fPP: 1.35, fQs: qsupQ ? 1.5 : 1.35, origem: g.nome });
        add({ tipo: 'A1', nome: g.nome + ' (pp×1,00)', termos, fPP: 1.0, fQs: qsupQ ? 0 : 1.0, origem: g.nome });
        if (!temA2) add({ tipo: 'A2', nome: g.nome + ' (cargas A1 com M2)', termos, fPP: 1.0, fQs: qsupQ ? 1.3 : 1.0, origem: g.nome, aproxA2: true });
        // EQU derivada: verticais × 0,9/1,35 (estabilizantes), momentos e horizontais tal como dados
        add({ tipo: 'EQU', nome: g.nome + ' (EQU derivada)', termos, fPP: 0.9, fPPd: 1.1, fQs: 0, fU: 1.1, origem: g.nome,
          partes: [{ a, fNs: 0.9 / 1.35, fNd: 1.0, fMs: 0, fMd: 1.0 }] });
      } else if (g.tipo === 'A2') {
        add({ tipo: 'A2', nome: g.nome, termos, fPP: 1.0, fQs: qsupQ ? 1.3 : 1.0, origem: g.nome });
      } else if (g.tipo === 'EQU') {
        add({ tipo: 'EQU', nome: g.nome, termos, fPP: 0.9, fPPd: 1.1, fQs: 0, fU: 1.1, origem: g.nome, partes: [{ a, fNs: 1, fNd: 1, fMs: 1, fMd: 1 }] });
      } else if (g.tipo === 'SIS') {
        add({ tipo: 'SIS', nome: g.nome, termos, fPP: 1.0, fQs: qsupQ ? (+st.geometria.qSupPsi2 || 0.3) : 1.0, fU: 1, origem: g.nome, partes: [{ a, fNs: 1, fNd: 1, fMs: 1, fMd: 1 }] });
      } else if (g.tipo === 'CAR' || g.tipo === 'FREQ' || g.tipo === 'QP') {
        add({ tipo: g.tipo, nome: g.nome, termos, fPP: 1.0, fQs: 1.0, origem: g.nome });
        if (g.tipo === 'CAR' && !temQP) {/* assentamento usa CAR se não houver QP */}
      }
    }
    return out;
  }

  /* ---------------------------------------------------------------------
     Esforços na base da sapata para uma combinação
     --------------------------------------------------------------------- */
  function esforcosPilares(st, geo, comb, fator) {
    // fator(termo) → multiplicador; por defeito t.f
    const cols = geo.pil.map(p => ({ ...p, ...z5() }));
    for (const t of comb.termos) {
      const f = fator ? fator(t) : t.f;
      if (!f) continue;
      for (const c of cols) {
        const v = t.a.val && t.a.val[c.id];
        if (!v) continue;
        for (const k of KEYS) c[k] += f * (+v[k] || 0);
      }
    }
    return cols;
  }
  function cargasBase(st, geo, comb) {
    const cols = esforcosPilares(st, geo, comb);
    let N = 0, Hx = 0, Hy = 0, My = 0, Mx = 0;
    for (const c of cols) {
      N += c.N; Hx += c.Vx; Hy += c.Vy;
      My += c.My + c.N * c.x + c.Vx * geo.h;
      Mx += c.Mx - c.N * c.y - c.Vy * geo.h;
    }
    // sobrecarga variável à superfície (ação interna)
    let fQs = comb.fQs || 0;
    for (const t of comb.termos) if (t.a.qsup) fQs += t.f;
    const Wd = comb.fPP * geo.W;
    const Qd = fQs * geo.Qs;
    const Vt = N + Wd + Qd;     // total
    const U = geo.U * (comb.fU && comb.tipo !== 'EQU' ? comb.fU : 1);
    const Vef = Vt - U;         // efetiva
    const H = Math.hypot(Hx, Hy);
    const ex = Vef > 0 ? My / Vef : 0;
    const ey = Vef > 0 ? -Mx / Vef : 0;
    return { cols, N, Hx, Hy, H, Mx, My, Wd, Qd, Vt, U, Vef, ex, ey, Wef: Wd + Qd - U };
  }

  /* ---------------------------------------------------------------------
     Parâmetros de cálculo do terreno na base
     --------------------------------------------------------------------- */
  function paramsTerreno(st, geo, mset, ef) {
    const cam = camadaEm(st, geo.Df + 1e-6).c;
    // opção: parâmetros mínimos até B abaixo da base
    let phik = +cam.phi || 0, ck = +cam.c || 0, cuk = +cam.cu || 0, g = +cam.gamma, gs = +cam.gammaSat || g;
    if (st.analise.paramZona === 'min' && st.terreno.modo !== 'unica') {
      const zmax = geo.Df + Math.min(geo.B, geo.L);
      for (const L of camadasLista(st)) {
        if (L.base <= geo.Df || L.topo >= zmax) continue;
        if ((+L.c.phi || 0) < phik) phik = +L.c.phi || 0;
        if ((+L.c.c || 0) < ck) ck = +L.c.c || 0;
        if ((+L.c.cu || 0) > 0 && (+L.c.cu < cuk || cuk === 0)) cuk = +L.c.cu;
      }
    }
    const phid = Math.atan(Math.tan(phik * DEG) / mset.phi) / DEG;
    const cd = ck / mset.c;
    const cud = cuk / mset.cu;
    const t = tensoesIn(st, geo.Df);
    // γ' abaixo da base (influência do NF até B' abaixo da base)
    const dw = geo.dw;
    const Bref = ef ? ef.B_ : Math.min(geo.B, geo.L);
    const gSub = gs - GW;
    let gEf;
    if (dw <= geo.Df) gEf = gSub;
    else if (dw >= geo.Df + Bref) gEf = g;
    else gEf = gSub + (dw - geo.Df) / Bref * (g - gSub);
    return { cam, phik, ck, cuk, phid, cd, cud, gEf, q: t.sve, qTot: t.sv, u: t.u, g, gs, sigAdm: +cam.sigAdm || 0 };
  }

  /* ---------------------------------------------------------------------
     Malha para esforços estruturais e assentamentos
     --------------------------------------------------------------------- */
  function criarMalha(geo) {
    const minCol = Math.min(...geo.pil.map(p => Math.min(p.cx, p.cy)), 1e9);
    let cell = Math.min(Math.min(geo.B, geo.L) / 60, minCol / 6);
    let nx = Math.ceil(geo.B / cell), ny = Math.ceil(geo.L / cell);
    const NMAX = 140;
    if (nx > NMAX) nx = NMAX;
    if (ny > NMAX) ny = NMAX;
    const dx = geo.B / nx, dy = geo.L / ny, dA = dx * dy;
    const xs = new Float64Array(nx), ys = new Float64Array(ny);
    for (let i = 0; i < nx; i++) xs[i] = -geo.B / 2 + (i + 0.5) * dx;
    for (let j = 0; j < ny; j++) ys[j] = -geo.L / 2 + (j + 0.5) * dy;
    // células de cada pilar (carga distribuída equivalente)
    const pilCells = geo.pil.map(p => {
      const cells = [];
      let Ad = 0, sx = 0, sy = 0;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const xl = xs[i] - dx / 2, xr = xs[i] + dx / 2, yb = ys[j] - dy / 2, yt = ys[j] + dy / 2;
        let ov = 0;
        if (p.circ) {
          const R = p.D / 2;
          if (Math.hypot(Math.max(0, Math.abs(xs[i] - p.x) - dx / 2), Math.max(0, Math.abs(ys[j] - p.y) - dy / 2)) < R) {
            const ns = 6; let k = 0;
            for (let a = 0; a < ns; a++) for (let b = 0; b < ns; b++) {
              const px = xl + (a + 0.5) * dx / ns, py = yb + (b + 0.5) * dy / ns;
              if ((px - p.x) ** 2 + (py - p.y) ** 2 <= R * R) k++;
            }
            ov = k / (ns * ns) * dA;
          }
        } else {
          const ox = Math.max(0, Math.min(xr, p.x + p.cx / 2) - Math.max(xl, p.x - p.cx / 2));
          const oy = Math.max(0, Math.min(yt, p.y + p.cy / 2) - Math.max(yb, p.y - p.cy / 2));
          ov = ox * oy;
        }
        if (ov > 1e-14) { cells.push([i, j, ov]); Ad += ov; sx += xs[i] * ov; sy += ys[j] * ov; }
      }
      if (!cells.length) {
        const i = Math.min(nx - 1, Math.max(0, Math.floor((p.x + geo.B / 2) / dx)));
        const j = Math.min(ny - 1, Math.max(0, Math.floor((p.y + geo.L / 2) / dy)));
        cells.push([i, j, dA]); Ad = dA; sx = xs[i] * dA; sy = ys[j] * dA;
      }
      const xc = sx / Ad, yc = sy / Ad;
      let Ix = 0, Iy = 0;
      for (const [i, j, ov] of cells) { Ix += (xs[i] - xc) ** 2 * ov; Iy += (ys[j] - yc) ** 2 * ov; }
      // distâncias de cada célula à periferia do pilar (punçoamento)
      const dist = [];
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const lx = xs[i] - p.x, ly = ys[j] - p.y;
        let d;
        if (p.circ) d = Math.max(0, Math.hypot(lx, ly) - p.D / 2);
        else d = Math.hypot(Math.max(0, Math.abs(lx) - p.cx / 2), Math.max(0, Math.abs(ly) - p.cy / 2));
        dist.push([d, i * ny + j]);
      }
      dist.sort((a, b) => a[0] - b[0]);
      return { cells, Ad, xc, yc, Ix: Ix || 1e-12, Iy: Iy || 1e-12, distOrd: dist };
    });
    return { nx, ny, dx, dy, dA, xs, ys, pilCells };
  }

  // campo de cargas líquidas na sapata: w = p_solo − W'/A − q_pilares  (positivo para cima)
  function campoCargas(geo, malha, pr, cb) {
    const { nx, ny, xs, ys, dA } = malha;
    const wSolo = new Float64Array(nx * ny);
    const w = new Float64Array(nx * ny);
    const unif = cb.Wef / geo.A;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const p = pr.ok ? Math.max(0, pr.a + pr.b * xs[i] + pr.c * ys[j]) : 0;
      wSolo[i * ny + j] = p - unif;
      w[i * ny + j] = p - unif;
    }
    cb.cols.forEach((c, k) => {
      const pc = malha.pilCells[k];
      const My = c.My + c.Vx * geo.h;
      const Mxr = -c.Mx + c.Vy * geo.h; // momento que desloca a carga segundo +y
      for (const [i, j, ov] of pc.cells) {
        const F = ov * (c.N / pc.Ad + My * (xs[i] - pc.xc) / pc.Ix + Mxr * (ys[j] - pc.yc) / pc.Iy);
        w[i * ny + j] -= F / dA;
      }
    });
    return { wSolo, w };
  }

  // curvas de momento e esforço transverso para secções x = const (dir 'x') ou y = const (dir 'y')
  function curvas(malha, w, dir) {
    const { nx, ny, dx, dy, dA, xs, ys } = malha;
    const n = dir === 'x' ? nx : ny;
    const strip = new Float64Array(n);
    const coord = dir === 'x' ? xs : ys;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const k = dir === 'x' ? i : j;
      strip[k] += w[i * ny + j] * dA;
    }
    const h = dir === 'x' ? dx : dy;
    const s0 = coord[0] - h / 2;
    const pos = [], M = [], V = [];
    // secções nas fronteiras das células, integração a partir da direita
    let S0 = 0, S1 = 0;
    for (let k = n; k >= 0; k--) {
      const xsct = s0 + k * h;
      if (k < n) { S0 += strip[k]; S1 += strip[k] * coord[k]; }
      pos.unshift(xsct); V.unshift(S0); M.unshift(S1 - xsct * S0);
    }
    // M e V numa secção arbitrária s (célula parcialmente cortada tratada como uniforme)
    const at = (sct) => {
      let S0r = 0, M_ = 0;
      for (let k = 0; k < n; k++) {
        const l = s0 + k * h, r = l + h;
        if (r <= sct) continue;
        if (l >= sct) { S0r += strip[k]; M_ += strip[k] * (coord[k] - sct); }
        else { const f = (r - sct) / h; S0r += strip[k] * f; M_ += strip[k] * f * (r - sct) / 2; }
      }
      return { M: M_, V: S0r };
    };
    return { pos, M, V, at };
  }

  /* ---------------------------------------------------------------------
     Flexão (EC2 6.1) — secção retangular, diagrama retangular simplificado
     --------------------------------------------------------------------- */
  function flexaoReq(M, b, d, fcd, fyd) {
    // M em kN·m, b e d em m → As em cm²
    if (M <= 0) return { As: 0, xd: 0, ok: true };
    const mu = M / (b * d * d * fcd * 1000);
    if (2 * mu >= 1) return { As: Infinity, xd: Infinity, ok: false, mu };
    const lx = d * (1 - Math.sqrt(1 - 2 * mu));
    const As = fcd * b * lx / fyd * 1e4;
    return { As, xd: lx / 0.8 / d, ok: lx / 0.8 / d <= 0.45, mu };
  }
  function flexaoRes(As, b, d, fcd, fyd) {
    const lx = As * 1e-4 * fyd / (fcd * b);
    return { MRd: As * 1e-4 * fyd * 1000 * (d - lx / 2), xd: lx / 0.8 / d };
  }
  const areaVaroes = (phi, s) => Math.PI * phi * phi / 4 / 100 / s; // cm²/m (phi em mm, s em m)

  function kTab61(r) {
    const T = [[0.5, 0.45], [1, 0.6], [2, 0.7], [3, 0.8]];
    if (r <= 0.5) return 0.45;
    if (r >= 3) return 0.8;
    for (let i = 0; i < 3; i++) if (r <= T[i + 1][0]) return T[i][1] + (r - T[i][0]) / (T[i + 1][0] - T[i][0]) * (T[i + 1][1] - T[i][1]);
    return 0.8;
  }

  function vRdc(bet, d, rho) {
    // MPa; d em m
    const k = Math.min(2, 1 + Math.sqrt(200 / (d * 1000)));
    const v1 = 0.18 / bet.gc * k * Math.pow(100 * Math.min(rho, 0.02) * bet.fck, 1 / 3);
    const vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(bet.fck);
    return { k, v1, vmin, v: Math.max(v1, vmin) };
  }

  function amarracao(bet, phi, sigma, alfa, compressao) {
    // EC2 8.4 — comprimentos em mm
    const fbd = 2.25 * 1 * (phi <= 32 ? 1 : (132 - phi) / 100) * bet.fctd;
    const lbrqd = phi / 4 * Math.max(0, sigma) / fbd;
    const lbmin = compressao ? Math.max(0.6 * lbrqd, 10 * phi, 100) : Math.max(0.3 * lbrqd, 10 * phi, 100);
    const lbd = Math.max((alfa || 1) * lbrqd, lbmin);
    return { fbd, lbrqd, lbmin, lbd };
  }

  /* ---------------------------------------------------------------------
     Assentamentos — integração de Δσz (Newmark/Boussinesq) por camadas
     --------------------------------------------------------------------- */
  function Icanto(a, b, z) {
    // fator de influência sob o canto de um retângulo a×b à profundidade z
    if (a <= 0 || b <= 0) return 0;
    const m = a / z, n = b / z;
    const m2 = m * m, n2 = n * n, r = Math.sqrt(m2 + n2 + 1);
    return (1 / (2 * Math.PI)) * ((m * n / r) * ((m2 + n2 + 2) / ((m2 + 1) * (n2 + 1))) + Math.atan(m * n / r));
  }
  function Iret(x1, x2, y1, y2, px, py, z) {
    const f = (dx, dy) => Math.sign(dx) * Math.sign(dy) * Icanto(Math.abs(dx), Math.abs(dy), z);
    return f(x2 - px, y2 - py) - f(x1 - px, y2 - py) - f(x2 - px, y1 - py) + f(x1 - px, y1 - py);
  }
  function assentamento(st, geo, pr, cb) {
    const an = st.analise;
    const n = 24;
    const dx = geo.B / n, dy = geo.L / n;
    const t0 = tensoesIn(st, geo.Df);
    const alivio = an.alivio !== false ? t0.sve : 0;
    const cells = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = -geo.B / 2 + (i + 0.5) * dx, y = -geo.L / 2 + (j + 0.5) * dy;
      const p = pr.ok ? Math.max(0, pr.a + pr.b * x + pr.c * y) : 0;
      const q = p - alivio; // efeito do alívio por escavação
      cells.push([x - dx / 2, x + dx / 2, y - dy / 2, y + dy / 2, q]);
    }
    const lst = camadasLista(st);
    const zFim = Math.min(geo.Df + 6 * Math.max(geo.B, geo.L), lst[lst.length - 1].base);
    const dz = Math.max(0.05, Math.min(0.25, Math.min(geo.B, geo.L) / 20));
    const pts = {
      centro: [0, 0],
      c1: [0.37 * geo.B, 0.37 * geo.L], c2: [-0.37 * geo.B, 0.37 * geo.L], c3: [-0.37 * geo.B, -0.37 * geo.L], c4: [0.37 * geo.B, -0.37 * geo.L],
      xp: [geo.B / 2, 0], xn: [-geo.B / 2, 0], yp: [0, geo.L / 2], yn: [0, -geo.L / 2]
    };
    const s = {}; for (const k in pts) s[k] = 0;
    const perfil = [];
    let zInf = null;
    const ratio = (+an.zInfPct || 20) / 100;
    for (let z = geo.Df + dz / 2; z < zFim; z += dz) {
      const zr = z - geo.Df;
      const cam = camadaEm(st, z).c;
      const E = (+cam.E || 0) * 1000;
      const nu = +cam.nu || 0.3;
      const Ec = an.metodoAss === 'oed' ? E * (1 - nu) / ((1 + nu) * (1 - 2 * nu)) : E;
      const sv0 = tensoesIn(st, z).sve;
      let dsC = 0;
      for (const k in pts) {
        const [px, py] = pts[k];
        let ds = 0;
        for (const c of cells) ds += c[4] * Iret(c[0], c[1], c[2], c[3], px, py, zr);
        if (k === 'centro') dsC = ds;
        if (zInf === null && Ec > 0) s[k] += Math.max(0, ds) * dz / Ec;
      }
      perfil.push({ z, ds: dsC, sv0, lim: ratio * sv0 });
      if (zInf === null && dsC <= ratio * sv0) zInf = zr;
    }
    if (zInf === null) zInf = zFim - geo.Df;
    const sChar = (s.c1 + s.c2 + s.c3 + s.c4) / 4;
    const rotX = (s.xp - s.xn) / geo.B, rotY = (s.yp - s.yn) / geo.L;
    return { s, sChar, sCentro: s.centro, rotX, rotY, zInf, perfil, alivio, qmed: pr.V / geo.A };
  }

  /* ---------------------------------------------------------------------
     Análise completa
     --------------------------------------------------------------------- */
  function analisar(st) {
    const t0 = Date.now();
    const geo = geometria(st);
    const bet = betao(st.materiais.betao);
    const ac = aco(st.materiais.aco);
    const an = st.analise;
    const combos = gerarCombinacoes(st);
    const avisos = [];
    const malha = criarMalha(geo);
    const m = st.materiais;

    // alturas úteis
    const cn = (+m.cnom || 50) / 1000;
    const fx = +m.armInf.x.phi, fy = +m.armInf.y.phi;
    const sxB = +m.armInf.x.s, syB = +m.armInf.y.s;
    const xBaixo = m.camadaInf !== 'y';
    const dx = xBaixo ? geo.h - cn - fx / 2000 : geo.h - cn - fy / 1000 - fx / 2000;
    const dy = xBaixo ? geo.h - cn - fx / 1000 - fy / 2000 : geo.h - cn - fy / 2000;
    const dm = (dx + dy) / 2;
    const AsX = areaVaroes(fx, sxB) * geo.L; // cm² totais (varões segundo x, distribuídos na largura L)
    const AsY = areaVaroes(fy, syB) * geo.B;
    const rhoX = AsX * 1e-4 / (geo.L * dx), rhoY = AsY * 1e-4 / (geo.B * dy);
    const sup = m.armSup && m.armSup.ativa;
    const AsXs = sup ? areaVaroes(+m.armSup.x.phi, +m.armSup.x.s) * geo.L : 0;
    const AsYs = sup ? areaVaroes(+m.armSup.y.phi, +m.armSup.y.s) * geo.B : 0;
    const dxs = sup ? geo.h - cn - (+m.armSup.x.phi) / 2000 : 0;
    const dys = sup ? geo.h - cn - (+m.armSup.x.phi) / 1000 - (+m.armSup.y.phi) / 2000 : 0;

    const R = { geo, bet, aco: ac, combos, malha, d: { dx, dy, dm, AsX, AsY, rhoX, rhoY, AsXs, AsYs, dxs, dys }, porComb: [], checks: [], avisos };

    // validações básicas
    for (const p of geo.pil) {
      if (Math.abs(p.x) + p.cx / 2 > geo.B / 2 + 1e-9 || Math.abs(p.y) + p.cy / 2 > geo.L / 2 + 1e-9) avisos.push(`O pilar ${p.id} sai fora da planta da sapata.`);
    }
    if (!combos.length) avisos.push('Não há combinações de ações: introduza ações no menu Ações.');
    // coerência dos dados do terreno: γsat ≥ γ
    {
      const bad = camadasLista(st).filter(L => (+L.c.gammaSat || 0) < (+L.c.gamma || 0));
      if (bad.length) R.checks.push({ id: 'dados-gama', grupo: 'Dados', nome: 'Peso volúmico saturado ≥ peso volúmico (γsat ≥ γ)', ref: 'Dados do terreno', eta: Infinity, ok: false, comb: null,
        info: 'Corrigir no menu Terreno: ' + bad.map(L => `"${L.c.nome}" (γ = ${fmt(+L.c.gamma, 1)}; γsat = ${fmt(+L.c.gammaSat, 1)} kN/m³)`).join('; ') + '.' });
    }
    if (geo.dw < geo.Df) avisos.push('Nível freático acima da base da sapata: considerada a impulsão (subpressão) na base.');

    const usaDren = (geo => { const c = camadaEm(st, geo.Df + 1e-6).c; return (+c.phi || 0) > 0 || (+c.c || 0) > 0; })(geo);
    const usaNDren = (geo => { const c = camadaEm(st, geo.Df + 1e-6).c; return (+c.cu || 0) > 0; })(geo);
    const camBase = camadaEm(st, geo.Df + 1e-6).c;

    // camada mais fraca abaixo (EC7 6.5.2.2(5))
    if (st.terreno.modo !== 'unica') {
      for (const L of camadasLista(st)) {
        if (L.topo > geo.Df && L.topo < geo.Df + 2 * Math.min(geo.B, geo.L)) {
          if ((+L.c.phi || 0) < (+camBase.phi || 0) - 1e-9 || ((+camBase.cu || 0) > 0 && (+L.c.cu || 0) < +camBase.cu)) {
            avisos.push(`A camada "${L.c.nome}" (topo a ${L.topo.toFixed(2)} m) é mais fraca e está a menos de 2B da base: verificar o punçoamento no terreno (EC7 6.5.2.2(5)) ou usar parâmetros mínimos da zona.`);
          }
        }
      }
    }

    const tiposELU = ['A1', 'A2', 'SIS'];
    for (const c of combos) {
      const cb = cargasBase(st, geo, c);
      const pr = solvePressure(geo.poly, cb.Vef, cb.ex, cb.ey);
      const r = { comb: c, cb, pr };
      // excentricidade (elipse B/3, núcleo central B/6)
      r.eElipse = Math.hypot(3 * cb.ex / geo.B, 3 * cb.ey / geo.L);
      r.eNucleo = 6 * (Math.abs(cb.ex) / geo.B + Math.abs(cb.ey) / geo.L);

      if (tiposELU.includes(c.tipo)) {
        const mset = c.tipo === 'A1' ? MSETS.M1 : c.tipo === 'A2' ? MSETS.M2 : MSETS.SIS;
        r.mset = mset;
        const ef = cb.Vef > 0 ? areaEfetiva(geo.B, geo.L, cb.ex, cb.ey) : null;
        r.ef = ef;
        const pt = paramsTerreno(st, geo, mset, ef);
        r.pt = pt;
        // componentes de H segundo B' e L'
        const Hb = ef ? (ef.xMenor ? cb.Hx : cb.Hy) : 0;
        const Hl = ef ? (ef.xMenor ? cb.Hy : cb.Hx) : 0;
        if (usaDren) {
          if (ef && cb.Vef > 0) {
            r.dren = capDrenada({ phi: pt.phid, c: pt.cd, gEf: pt.gEf, q: pt.q }, ef, cb.Vef, Hb, Hl, 0);
            r.dren.Rd = r.dren.R / R1.Rv;
            r.dren.Vd = cb.Vef;
            r.dren.eta = r.dren.Rd > 0 ? cb.Vef / r.dren.Rd : Infinity;
          } else r.dren = { eta: Infinity, Rd: 0, Vd: cb.Vef, falha: true };
        }
        if (usaNDren) {
          const efT = cb.Vt > 0 ? areaEfetiva(geo.B, geo.L, cb.Vt > 0 ? (cb.ex * cb.Vef / cb.Vt) : 0, cb.Vt > 0 ? (cb.ey * cb.Vef / cb.Vt) : 0) : null;
          if (efT) {
            r.nd = capNaoDrenada({ cu: pt.cud, q: pt.qTot }, efT, cb.H, 0);
            r.nd.ef = efT;
            r.nd.Rd = r.nd.R / R1.Rv;
            r.nd.Vd = cb.Vt;
            r.nd.eta = r.nd.Rd > 0 ? cb.Vt / r.nd.Rd : Infinity;
          } else r.nd = { eta: Infinity, Rd: 0, Vd: cb.Vt, falha: true };
        }
        // deslizamento (6.5.3; EC8-5 5.4.1.1)
        if (cb.H > 1e-9) {
          const desl = { Hd: cb.H };
          if (usaDren) {
            const dd = Math.atan((+an.kDelta || 1) * Math.tan(pt.phid * DEG));
            desl.dren = { delta: dd / DEG, Rd: Math.max(0, cb.Vef) * Math.tan(dd) / R1.Rh };
          }
          if (usaNDren && ef) {
            let Rdu = ef.A_ * pt.cud / R1.Rh;
            if (an.aguaInterface) Rdu = Math.min(Rdu, 0.4 * Math.max(0, cb.Vt));
            desl.nd = { Rd: Rdu, A_: ef.A_, cud: pt.cud };
          }
          const Rds = [desl.dren && desl.dren.Rd, desl.nd && desl.nd.Rd].filter(v => v !== undefined);
          desl.Rd = Rds.length ? Math.min(...Rds) : 0;
          desl.eta = desl.Rd > 0 ? cb.H / desl.Rd : Infinity;
          r.desl = desl;
        }
      }

      // estrutural (A1 e sísmica)
      if (c.tipo === 'A1' || c.tipo === 'SIS') {
        if (pr.ok) {
          const cmp = campoCargas(geo, malha, pr, cb);
          r.cx = curvas(malha, cmp.w, 'x');
          r.cy = curvas(malha, cmp.w, 'y');
          r.campo = cmp;
          r.punc = puncoamento(st, geo, malha, cmp, cb, bet, dm, Math.sqrt(rhoX * rhoY));
          r.amarr = amarracaoVaroes(st, geo, malha, cmp, cb, bet, ac, { dx, dy, AsX, AsY, fx, fy, cn });
        }
      }
      R.porComb.push(r);
    }

    // ---------------- agregação das verificações ----------------
    const add = (o) => { R.checks.push(o); return o; };
    const pior = (lst, fn) => { let best = null, v = -Infinity; for (const r of lst) { const e = fn(r); if (e !== undefined && e !== null && !isNaN(e) && e > v) { v = e; best = r; } } return best ? { r: best, eta: v } : null; };
    const PC = R.porComb;
    const of = t => PC.filter(r => r.comb.tipo === t);
    const elu = PC.filter(r => tiposELU.includes(r.comb.tipo));

    // distribuição de pressões válida (equilíbrio sem tração)
    {
      const falhas = PC.filter(r => !r.pr.ok && r.comb.tipo !== 'EQU');
      add({ id: 'equilibrio', grupo: 'Geotecnia', nome: 'Equilíbrio da base (resultante dentro da sapata)', ref: 'EC7 6.5.4',
        eta: falhas.length ? Infinity : 0, ok: !falhas.length, comb: falhas[0] ? falhas[0].comb : null,
        info: falhas.length ? falhas[0].pr.motivo : 'Todas as combinações têm a resultante no interior da base.' });
    }

    // tensões admissíveis
    if (an.usarSigAdm !== false) {
      const sa = +camBase.sigAdm || 0;
      if (sa > 0) {
        const kB = +an.kBordo || 1.25, kS = +an.kSis || 1.5;
        const tiposSA = ['CAR'].concat(an.sigAdmELU ? ['A1', 'A2'] : []);
        const lst = PC.filter(r => tiposSA.includes(r.comb.tipo) && r.pr.ok);
        const lsS = PC.filter(r => r.comb.tipo === 'SIS' && r.pr.ok);
        const m1 = pior(lst, r => (r.cb.Vef / geo.A) / sa);
        const m2 = pior(lst, r => r.pr.pmax / (kB * sa));
        if (m1) add({ id: 'sadm-med', grupo: 'Geotecnia', nome: 'Tensão média ≤ σadm', ref: 'Tensão admissível', eta: m1.eta, ok: m1.eta <= 1, comb: m1.r.comb,
          val: m1.r.cb.Vef / geo.A, lim: sa, un: 'kPa' });
        if (m2) add({ id: 'sadm-max', grupo: 'Geotecnia', nome: `Tensão máxima ≤ ${fmtN(kB)}·σadm`, ref: 'Tensão admissível', eta: m2.eta, ok: m2.eta <= 1, comb: m2.r.comb,
          val: m2.r.pr.pmax, lim: kB * sa, un: 'kPa' });
        if (lsS.length) {
          const s1 = pior(lsS, r => (r.cb.Vef / geo.A) / (kS * sa));
          const s2 = pior(lsS, r => r.pr.pmax / (kB * kS * sa));
          add({ id: 'sadm-sis-med', grupo: 'Geotecnia', nome: `Tensão média sísmica ≤ ${fmtN(kS)}·σadm`, ref: 'Tensão admissível', eta: s1.eta, ok: s1.eta <= 1, comb: s1.r.comb, val: s1.r.cb.Vef / geo.A, lim: kS * sa, un: 'kPa' });
          add({ id: 'sadm-sis-max', grupo: 'Geotecnia', nome: `Tensão máxima sísmica ≤ ${fmtN(kB * kS)}·σadm`, ref: 'Tensão admissível', eta: s2.eta, ok: s2.eta <= 1, comb: s2.r.comb, val: s2.r.pr.pmax, lim: kB * kS * sa, un: 'kPa' });
        }
      } else avisos.push('σadm não definida na camada de fundação: verificação por tensões admissíveis não efetuada.');
    }

    // EC7 Anexo D
    if (an.usarEC7 !== false) {
      for (const [t, lbl] of [['A1', 'DA1 – Comb. 1 (A1+M1+R1)'], ['A2', 'DA1 – Comb. 2 (A2+M2+R1)'], ['SIS', 'Sísmica (EC8-5, AN)']]) {
        const lst = of(t);
        if (!lst.length) continue;
        if (usaDren) {
          const w = pior(lst, r => r.dren ? r.dren.eta : undefined);
          if (w) add({ id: 'ec7-d-' + t, grupo: 'Geotecnia', nome: `Capacidade resistente drenada — ${lbl}`, ref: 'EC7 6.5.2, Anexo D (D.2)', eta: w.eta, ok: w.eta <= 1, comb: w.r.comb,
            val: w.r.dren.Vd, lim: w.r.dren.Rd, un: 'kN', r: w.r });
        }
        if (usaNDren) {
          const w = pior(lst, r => r.nd ? r.nd.eta : undefined);
          if (w) add({ id: 'ec7-u-' + t, grupo: 'Geotecnia', nome: `Capacidade resistente não drenada — ${lbl}`, ref: 'EC7 6.5.2, Anexo D (D.1)', eta: w.eta, ok: w.eta <= 1, comb: w.r.comb,
            val: w.r.nd.Vd, lim: w.r.nd.Rd, un: 'kN', r: w.r });
        }
      }
      if (!usaDren && !usaNDren) avisos.push('A camada de fundação não tem φ\', c\' nem cu: verificação EC7 (Anexo D) não efetuada.');
    }

    // deslizamento
    {
      const w = pior(elu, r => r.desl ? r.desl.eta : undefined);
      if (w) add({ id: 'desl', grupo: 'Geotecnia', nome: 'Deslizamento pela base', ref: 'EC7 6.5.3 / EC8-5 5.4.1.1', eta: w.eta, ok: w.eta <= 1, comb: w.r.comb, val: w.r.desl.Hd, lim: w.r.desl.Rd, un: 'kN', r: w.r });
      else add({ id: 'desl', grupo: 'Geotecnia', nome: 'Deslizamento pela base', ref: 'EC7 6.5.3', eta: 0, ok: true, comb: null, info: 'Sem forças horizontais.' });
    }

    // excentricidade
    {
      const w = pior(elu.filter(r => r.cb.Vef > 0), r => r.eElipse);
      if (w) add({ id: 'exc', grupo: 'Geotecnia', nome: 'Excentricidade em ELU (elipse B/3 × L/3)', ref: 'EC7 6.5.4', eta: w.eta, ok: w.eta <= 1, comb: w.r.comb,
        val: Math.hypot(w.r.cb.ex, w.r.cb.ey), info: `ex = ${fmt(w.r.cb.ex, 3)} m; ey = ${fmt(w.r.cb.ey, 3)} m; área comprimida ${fmt(100 * w.r.pr.contacto, 0)} %`, r: w.r });
      if (an.contactoQP !== false) {
        const lq = of('QP').length ? of('QP') : of('CAR');
        const w2 = pior(lq.filter(r => r.cb.Vef > 0), r => r.eNucleo);
        if (w2) add({ id: 'nucleo', grupo: 'Geotecnia', nome: `Contacto total em ELS ${of('QP').length ? 'quase-permanente' : 'característica'} (núcleo central)`, ref: 'Boa prática', eta: w2.eta, ok: w2.eta <= 1 + 1e-9, comb: w2.r.comb,
          info: `ex = ${fmt(w2.r.cb.ex, 3)} m; ey = ${fmt(w2.r.cb.ey, 3)} m; área comprimida ${fmt(100 * w2.r.pr.contacto, 0)} %`, r: w2.r });
      }
    }

    // EQU — derrube
    {
      const lst = of('EQU').concat(of('SIS'));
      let best = null;
      for (const r of lst) {
        const eq = derrube(st, geo, r.comb);
        r.equ = eq;
        if (!best || eq.eta > best.eta) best = { r, eta: eq.eta };
      }
      if (best) add({ id: 'equ', grupo: 'Geotecnia', nome: 'Equilíbrio global — derrube (EQU)', ref: 'EC7 2.4.7.2, Quadro A.1', eta: best.eta, ok: best.eta <= 1, comb: best.r.comb,
        val: best.r.equ.Mdst, lim: best.r.equ.Mstb, un: 'kN·m', info: `Bordo ${best.r.equ.bordo}; reserva de segurança ${fmt(best.eta > 0 ? (1 / best.eta - 1) * 100 : Infinity, 0)} %`, r: best.r });
    }

    // assentamento
    if (an.usarAssent !== false) {
      const lq = of('QP').length && an.combAssent !== 'CAR' ? of('QP') : of('CAR');
      const cand = pior(lq.filter(r => r.pr.ok), r => r.cb.Vef);
      const temE = camadasLista(st).some(L => (+L.c.E || 0) > 0);
      if (cand && temE) {
        const as = assentamento(st, geo, cand.r.pr, cand.r.cb);
        R.assent = { ...as, comb: cand.r.comb, r: cand.r };
        const slim = (+an.sLim || 25) / 1000;
        add({ id: 'assent', grupo: 'ELS', nome: 'Assentamento (ponto característico)', ref: 'EC7 6.6.2, Anexo F', eta: as.sChar / slim, ok: as.sChar <= slim, comb: cand.r.comb,
          val: as.sChar * 1000, lim: slim * 1000, un: 'mm', info: `Profundidade de influência ${fmt(as.zInf, 2)} m abaixo da base` });
        const rl = 1 / (+an.rotLim || 500);
        const rot = Math.max(Math.abs(as.rotX), Math.abs(as.rotY));
        add({ id: 'rot', grupo: 'ELS', nome: 'Rotação da sapata', ref: 'EC7 2.4.9, Anexo H', eta: rot / rl, ok: rot <= rl, comb: cand.r.comb,
          val: rot > 0 ? 1 / rot : Infinity, info: `θx = 1/${rot > 0 ? fmt(1 / Math.max(1e-12, Math.abs(as.rotX)), 0) : '∞'}; θy = 1/${fmt(1 / Math.max(1e-12, Math.abs(as.rotY)), 0)}; limite 1/${fmt(1 / rl, 0)}`, un: '1/θ' });
      } else if (!temE) avisos.push('Sem módulo de deformabilidade E nas camadas: assentamento não calculado.');
      // EC7 6.6.2(16)
      if (usaNDren) {
        const lc = of('CAR');
        const w = pior(lc.filter(r => r.cb.Vt > 0), r => r.cb.Vt);
        if (w) {
          const ef = areaEfetiva(geo.B, geo.L, w.r.cb.ex, w.r.cb.ey);
          if (ef) {
            const pt = paramsTerreno(st, geo, MSETS.K, ef);
            const Ru = capNaoDrenada({ cu: pt.cuk, q: pt.qTot }, ef, w.r.cb.H, 0).R;
            const rat = Ru / w.r.cb.Vt;
            R.razaoArgila = rat;
            if (rat < 3) avisos.push(`EC7 6.6.2(16): razão entre a capacidade não drenada e a carga de serviço = ${fmt(rat, 2)} < 3 — os assentamentos devem ser calculados${rat < 2 ? ' considerando a não linearidade da rigidez do terreno' : ''}.`);
          }
        }
      }
    }

    // ---------------- estruturais ----------------
    const est = PC.filter(r => (r.comb.tipo === 'A1' || r.comb.tipo === 'SIS') && r.pr.ok && r.cx);
    if (est.length) {
      // núcleos (secções de referência) por direção
      const t015 = m.seccaoRef === '015' ? 0.15 : 0;
      const nucleo = (dir) => geo.pil.map(p => {
        const c = dir === 'x' ? p.ex_ : p.ey_;
        const z = dir === 'x' ? p.x : p.y;
        return [z - c / 2 + t015 * c, z + c / 2 - t015 * c, z - c / 2, z + c / 2];
      });
      const nucX = nucleo('x'), nucY = nucleo('y');
      const valido = (nuc, s) => nuc.every(([a, b]) => s <= a + 1e-9 || s >= b - 1e-9);
      const validoV = (nuc, s, d) => nuc.every(([, , a, b]) => s <= a - d + 1e-9 || s >= b + d - 1e-9);

      for (const dir of ['x', 'y']) {
        const nuc = dir === 'x' ? nucX : nucY;
        const d = dir === 'x' ? dx : dy;
        const b = dir === 'x' ? geo.L : geo.B;
        const As = dir === 'x' ? AsX : AsY;
        const AsS = dir === 'x' ? AsXs : AsYs;
        const ds = dir === 'x' ? dxs : dys;
        let Mp = { v: 0 }, Mn = { v: 0 }, Vm = { v: 0 };
        const half = dir === 'x' ? geo.B / 2 : geo.L / 2;
        const extraM = [], extraV = [];
        for (const [a, b, fa, fb] of nuc) { extraM.push(a, b); extraV.push(fa - d, fb + d); }
        for (const r of est) {
          const cv = dir === 'x' ? r.cx : r.cy;
          for (let k = 0; k < cv.pos.length; k++) {
            const s = cv.pos[k];
            if (valido(nuc, s)) {
              if (cv.M[k] > Mp.v) Mp = { v: cv.M[k], r, s };
              if (cv.M[k] < Mn.v) Mn = { v: cv.M[k], r, s };
            }
            if (validoV(nuc, s, d) && Math.abs(cv.V[k]) > Math.abs(Vm.v)) Vm = { v: cv.V[k], r, s };
          }
          for (const s of extraM) {
            if (s <= -half || s >= half || !valido(nuc, s)) continue;
            const q = cv.at(s);
            if (q.M > Mp.v) Mp = { v: q.M, r, s };
            if (q.M < Mn.v) Mn = { v: q.M, r, s };
          }
          for (const s of extraV) {
            if (s <= -half || s >= half || !validoV(nuc, s, d)) continue;
            const q = cv.at(s);
            if (Math.abs(q.V) > Math.abs(Vm.v)) Vm = { v: q.V, r, s };
          }
        }
        const lbl = dir === 'x' ? 'X' : 'Y';
        const req = flexaoReq(Mp.v, b, d, bet.fcd, ac.fyd);
        const res = flexaoRes(As, b, d, bet.fcd, ac.fyd);
        const Asmin = Math.max(0.26 * bet.fctm / ac.fyk, 0.0013) * b * d * 1e4;
        add({ id: 'flex-' + dir, grupo: 'Estrutural', nome: `Flexão — armadura inferior segundo ${lbl}`, ref: 'EC2 6.1', eta: res.MRd > 0 ? Mp.v / res.MRd : Infinity,
          ok: Mp.v <= res.MRd && res.xd <= 0.45, comb: Mp.r ? Mp.r.comb : null, val: Mp.v, lim: res.MRd, un: 'kN·m',
          info: `MEd na secção ${dir} = ${fmt(Mp.s || 0, 3)} m; As,req = ${fmt(req.As, 2)} cm²; As,prov = ${fmt(As, 2)} cm²; x/d = ${fmt(res.xd, 3)}`,
          det: { dir, d, b, As, AsReq: req.As, MRd: res.MRd, xd: res.xd, s: Mp.s } });
        add({ id: 'asmin-' + dir, grupo: 'Estrutural', nome: `Armadura mínima segundo ${lbl}`, ref: 'EC2 9.2.1.1 (9.1N)', eta: Asmin / As, ok: As >= Asmin, comb: null, val: As, lim: Asmin, un: 'cm²',
          info: `As,min = máx(0,26·fctm/fyk; 0,0013)·b·d = ${fmt(Asmin, 2)} cm²` });
        // armadura superior / momentos negativos
        if (Mn.v < -Math.max(0.5, 0.02 * Mp.v)) {
          if (sup && AsS > 0) {
            const rs = flexaoRes(AsS, b, ds, bet.fcd, ac.fyd);
            add({ id: 'flexs-' + dir, grupo: 'Estrutural', nome: `Flexão — armadura superior segundo ${lbl}`, ref: 'EC2 6.1', eta: -Mn.v / rs.MRd, ok: -Mn.v <= rs.MRd, comb: Mn.r.comb, val: -Mn.v, lim: rs.MRd, un: 'kN·m' });
          } else {
            const fctdpl = 0.8 * bet.fctk005 / bet.gc;
            const Mcr = fctdpl * 1000 * b * geo.h * geo.h / 6;
            add({ id: 'flexs-' + dir, grupo: 'Estrutural', nome: `Momento negativo segundo ${lbl} sem armadura superior`, ref: 'EC2 12.6.1 (betão simples)', eta: -Mn.v / Mcr, ok: -Mn.v <= Mcr, comb: Mn.r.comb, val: -Mn.v, lim: Mcr, un: 'kN·m',
              info: 'Tração na face superior: se não verificar, ative a malha superior (EC2 9.8.2.1(3)).' });
          }
        }
        // esforço transverso
        if (Vm.r) {
          const rho = Math.min(0.02, As * 1e-4 / (b * d));
          const vr = vRdc(bet, d, rho);
          const VRd = vr.v * 1000 * b * d;
          add({ id: 'corte-' + dir, grupo: 'Estrutural', nome: `Esforço transverso segundo ${lbl} (a d da face)`, ref: 'EC2 6.2.2 (6.2)', eta: Math.abs(Vm.v) / VRd, ok: Math.abs(Vm.v) <= VRd, comb: Vm.r.comb,
            val: Math.abs(Vm.v), lim: VRd, un: 'kN', info: `k = ${fmt(vr.k, 3)}; ρl = ${fmt(rho * 100, 3)} %; vRd,c = ${fmt(vr.v, 3)} MPa (vmin = ${fmt(vr.vmin, 3)})` });
        } else add({ id: 'corte-' + dir, grupo: 'Estrutural', nome: `Esforço transverso segundo ${lbl}`, ref: 'EC2 6.2.2', eta: 0, ok: true, comb: null, info: 'A secção a d da face do pilar fica fora da sapata: verificação dispensada.' });
      }

      // punçoamento
      for (let k = 0; k < geo.pil.length; k++) {
        let wMax = null, wFace = null;
        for (const r of est) {
          const pc = r.punc && r.punc[k];
          if (!pc) continue;
          if (pc.crit && (!wMax || pc.crit.eta > wMax.p.crit.eta)) wMax = { r, p: pc };
          if (!wFace || pc.face.eta > wFace.p.face.eta) wFace = { r, p: pc };
        }
        const pid = geo.pil[k].id;
        if (wFace) add({ id: 'punc-max-' + pid, grupo: 'Estrutural', nome: `Punçoamento — compressão na face do pilar ${pid}`, ref: 'EC2 6.4.3(2)a, 6.4.5(3) (AC:2012)', eta: wFace.p.face.eta, ok: wFace.p.face.eta <= 1, comb: wFace.r.comb,
          val: wFace.p.face.vEd, lim: wFace.p.face.vRdmax, un: 'MPa', info: `u0 = ${fmt(wFace.p.face.u0, 3)} m; β = ${fmt(wFace.p.face.beta, 3)}; vRd,max = 0,4·ν·fcd` });
        if (wMax) add({ id: 'punc-' + pid, grupo: 'Estrutural', nome: `Punçoamento — pilar ${pid}`, ref: 'EC2 6.4.4(2) (6.48 a 6.51)', eta: wMax.p.crit.eta, ok: wMax.p.crit.eta <= 1, comb: wMax.r.comb,
          val: wMax.p.crit.vEd, lim: wMax.p.crit.vRd, un: 'MPa', info: `Perímetro crítico a = ${fmt(wMax.p.crit.a, 3)} m (${fmt(wMax.p.crit.a / dm, 2)}·d); u = ${fmt(wMax.p.crit.u, 3)} m; VEd,red = ${fmt(wMax.p.crit.Vred, 1)} kN; β = ${fmt(wMax.p.crit.beta, 3)}`, det: { k, a: wMax.p.crit.a } });
        else if (wFace) add({ id: 'punc-' + pid, grupo: 'Estrutural', nome: `Punçoamento — pilar ${pid}`, ref: 'EC2 6.4.4(2)', eta: 0, ok: true, comb: null, info: wFace.p.nota || 'Perímetros de controlo fora da sapata: a carga é transmitida diretamente ao terreno.' });
        const notas = new Set(est.map(r => r.punc && r.punc[k] && r.punc[k].sobrepos).filter(Boolean));
        if (notas.size) avisos.push(`Pilar ${pid}: os perímetros de punçoamento intersetam outro pilar a partir de a = ${fmt(Math.min(...notas), 3)} m. Verificação individual por pilar; para pilares próximos, verificar também o perímetro envolvente do grupo.`);
      }

      // amarração das armaduras inferiores (9.8.2.2)
      for (const dir of ['x', 'y']) {
        let w = null;
        for (const r of est) { const a = r.amarr && r.amarr[dir]; if (a && (!w || a.eta > w.a.eta)) w = { r, a }; }
        const lbl = dir === 'x' ? 'X' : 'Y';
        if (w) add({ id: 'amarr-' + dir, grupo: 'Estrutural', nome: `Amarração da armadura inferior segundo ${lbl}`, ref: 'EC2 9.8.2.2, 8.4', eta: w.a.eta, ok: w.a.eta <= 1, comb: w.r.comb,
          val: w.a.lbd, lim: w.a.lav, un: 'mm', info: `Secção a x = ${fmt(w.a.x, 3)} m do bordo; Fs = ${fmt(w.a.Fs, 1)} kN; σsd = ${fmt(w.a.sig, 0)} MPa; ${m.patilhas ? `com patilhas (α1 = ${w.a.alfa1 === 0.7 ? '0,7' : '1,0'}: cd = ${fmt(w.a.cd, 0)} mm ${w.a.alfa1 === 0.7 ? '>' : '≤'} 3φ)` : 'varões retos (α1 = 1,0)'}` });
      }
    }

    // disposições construtivas
    {
      const phiMin = 10; // AN – NA–9.8.2.1(1)
      const fmin = Math.min(fx, fy);
      add({ id: 'phimin', grupo: 'Pormenorização', nome: 'Diâmetro mínimo dos varões da malha inferior', ref: 'EC2 9.8.2.1 (AN: φmin = 10 mm)', eta: phiMin / fmin, ok: fmin >= phiMin, val: fmin, lim: phiMin, un: 'mm' });
      // espaçamentos pelo EC2 (malhas inferior e, se existir, superior)
      const sMaxGeral = Math.min(3 * geo.h, 0.40);          // 9.3.1.1(3): 3h ≤ 400 mm
      const sMaxEC2 = Math.min(2 * geo.h, 0.25);            // zona de momento máximo: 2h ≤ 250 mm
      const livreMin = (phi) => Math.max(phi, (+m.dg || 20) + 5, 20) / 1000;   // 8.2(2): k1·φ; dg + k2; 20 mm
      R.espac = { sMaxGeral, sMaxEC2, livreMin: livreMin(Math.max(fx, fy)), sMinX: livreMin(fx) + fx / 1000, sMinY: livreMin(fy) + fy / 1000 };
      const malhas = [['inferior X', fx, sxB], ['inferior Y', fy, syB]];
      if (sup) malhas.push(['superior X', +m.armSup.x.phi, +m.armSup.x.s], ['superior Y', +m.armSup.y.phi, +m.armSup.y.s]);
      let wM = null, wm = null;
      for (const [nm, ph, s] of malhas) {
        const smin = livreMin(ph) + ph / 1000;
        if (!wM || s / sMaxEC2 > wM.eta) wM = { nm, s, eta: s / sMaxEC2 };
        if (!wm || smin / s > wm.eta) wm = { nm, s, smin, ph, eta: s > 0 ? smin / s : Infinity };
      }
      add({ id: 'smax', grupo: 'Pormenorização', nome: 'Espaçamento máximo entre varões', ref: 'EC2 9.3.1.1(3): 2h ≤ 250 mm na zona de momento máximo', eta: wM.eta, ok: wM.eta <= 1 + 1e-9, val: wM.s * 100, lim: sMaxEC2 * 100, un: 'cm',
        info: `Malha ${wM.nm}. Fora da zona de momento máximo o limite seria min(3h; 400 mm) = ${fmt(sMaxGeral * 1000, 0)} mm.` });
      add({ id: 'smin', grupo: 'Pormenorização', nome: 'Espaçamento mínimo entre varões', ref: 'EC2 8.2(2): livre ≥ máx(φ; dg + 5 mm; 20 mm)', eta: wm.eta, ok: wm.eta <= 1 + 1e-9, val: wm.s * 100, lim: wm.smin * 100, un: 'cm',
        info: `Malha ${wm.nm}: espaçamento livre mínimo ${fmt((wm.smin - wm.ph / 1000) * 1000, 0)} mm + φ${wm.ph}.` });
      // arranques dos pilares (EC2 8.4): compressão só com troço reto; tração com dobra (lb,eq)
      for (const p of geo.pil) {
        const sig = (+m.sigArr || 1) * ac.fyd;
        const ac_ = amarracao(bet, p.phi, sig, 1, true);
        const disp = (geo.h - cn - (fx + fy) / 1000) * 1000;   // troço vertical disponível
        add({ id: 'arr-' + p.id, grupo: 'Pormenorização', nome: `Arranques do pilar ${p.id} (Ø${p.phi}) — compressão`, ref: 'EC2 8.4.1(2), 8.4.4 (só troço reto)', eta: ac_.lbd / disp, ok: ac_.lbd <= disp, val: ac_.lbd, lim: disp, un: 'mm', aviso: true,
          info: `lbd = ${fmt(ac_.lbd, 0)} mm (lb,rqd = ${fmt(ac_.lbrqd, 0)} mm, σsd = ${fmt(sig, 0)} MPa; lb,min = ${fmt(ac_.lbmin, 0)} mm). Troço vertical disponível = h − c − Øx − Øy = ${fmt(disp, 0)} mm. As dobras não contam em compressão: se não chegar, aumentar h ou reduzir o diâmetro.` });
        // tração: varão dobrado (α1 = 0,7 se cd > 3φ; nos arranques cd = recobrimento lateral na sapata, em geral > 3φ)
        const cdA = Math.min(cn * 1000, 1e9);
        const a1 = cdA > 3 * p.phi ? 0.7 : 1.0;
        const at = amarracao(bet, p.phi, sig, a1, false);
        const pat = Math.max(0, at.lbd - disp);
        const patR = pat > 0 ? Math.ceil(Math.max(pat, 5 * p.phi) / 50) * 50 : 0;
        add({ id: 'arrT-' + p.id, grupo: 'Pormenorização', nome: `Arranques do pilar ${p.id} (Ø${p.phi}) — tração, patilha`, ref: 'EC2 8.4.4(2), Quadro 8.2 (lb,eq = α1·lb,rqd)', eta: disp > 0 ? Math.min(1, at.lbd / (disp + patR || 1)) : Infinity, ok: true,
          info: pat > 0 ? `lb,eq = ${fmt(at.lbd, 0)} mm (α1 = ${a1 === 0.7 ? '0,7' : '1,0'}) > troço vertical ${fmt(disp, 0)} mm → dobrar ${fmt(patR, 0)} mm para os lados sobre a malha inferior (${fmt(pat, 0)} mm calculados, arredondado a 50 mm).`
            : `lb,eq = ${fmt(at.lbd, 0)} mm ≤ troço vertical ${fmt(disp, 0)} mm: basta o troço reto (patilha construtiva para apoio na malha).` });
      }
      const rig = geo.vMax <= 2 * geo.h;
      R.rigida = rig;
      if (!rig) avisos.push(`Sapata flexível (balanço máximo ${fmt(geo.vMax, 2)} m > 2h = ${fmt(2 * geo.h, 2)} m): a hipótese de distribuição linear de pressões é menos rigorosa (EC7 6.8(2)).`);
    }

    // estado global
    R.ok = R.checks.every(c => c.ok || c.aviso);
    R.etaMax = Math.max(0, ...R.checks.filter(c => !c.aviso && isFinite(c.eta)).map(c => c.eta));
    if (R.checks.some(c => !isFinite(c.eta) && !c.ok)) R.etaMax = Infinity;
    R.tempo = Date.now() - t0;
    return R;
  }

  /* ---------------------------------------------------------------------
     Punçoamento por pilar (EC2 6.4.4(2))
     --------------------------------------------------------------------- */
  function puncoamento(st, geo, malha, cmp, cb, bet, d, rho) {
    const out = [];
    const vr = vRdc(bet, d, rho);
    const nu = 0.6 * (1 - bet.fck / 250);
    const vRdmax = 0.4 * nu * bet.fcd; // AC:2012
    geo.pil.forEach((p, k) => {
      const c = cb.cols[k];
      const pc = malha.pilCells[k];
      const N = c.N;
      // distância livre até ao bordo da sapata e aos outros pilares
      const aBordo = Math.min(geo.B / 2 - (Math.abs(p.x) + p.cx / 2), geo.L / 2 - (Math.abs(p.y) + p.cy / 2));
      let aOutro = Infinity;
      geo.pil.forEach((q, j) => {
        if (j === k) return;
        const gx = Math.max(0, Math.abs(q.x - p.x) - (p.cx + q.cx) / 2);
        const gy = Math.max(0, Math.abs(q.y - p.y) - (p.cy + q.cy) / 2);
        aOutro = Math.min(aOutro, Math.hypot(gx, gy));
      });
      const r = { pid: p.id, N, crit: null, face: null, perfil: [], sobrepos: isFinite(aOutro) && aOutro < 2 * d ? aOutro : null };
      // somas acumuladas da reação líquida por distância
      const ord = pc.distOrd;
      const cum = new Float64Array(ord.length + 1);
      for (let i = 0; i < ord.length; i++) cum[i + 1] = cum[i] + cmp.wSolo[ord[i][1]] * malha.dA;
      const dV = (a) => {
        let lo = 0, hi = ord.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (ord[mid][0] <= a + 1e-12) lo = mid + 1; else hi = mid; }
        return cum[lo];
      };
      const My = Math.abs(c.My), Mx = Math.abs(c.Mx);
      const geomU = (a) => {
        if (p.circ) {
          const Dp = p.D + 2 * a;
          return { u: Math.PI * Dp, Wx: Dp * Dp, Wy: Dp * Dp, kx: 0.6, ky: 0.6 };
        }
        const c1x = p.cx, c2x = p.cy; // momento My → excentricidade segundo x
        const Wx = c1x * c1x / 2 + c1x * c2x + 2 * c2x * a + 4 * a * a + Math.PI * a * c1x;
        const Wy = c2x * c2x / 2 + c2x * c1x + 2 * c1x * a + 4 * a * a + Math.PI * a * c2x;
        return { u: 2 * (p.cx + p.cy) + 2 * Math.PI * a, Wx, Wy, kx: kTab61(c1x / c2x), ky: kTab61(c2x / c1x) };
      };
      const betaF = (a, Vred, g) => {
        if (Vred <= 0) return 1;
        if (p.circ) return 1 + g.kx * Math.hypot(Mx, My) * g.u / (Vred * g.Wx);
        return 1 + Math.hypot(g.kx * My * g.u / (Vred * g.Wx), g.ky * Mx * g.u / (Vred * g.Wy));
      };
      // face do pilar
      {
        const g = geomU(0);
        const Vred = N - dV(0);
        const beta = betaF(0, Vred, g);
        const vEd = Math.max(0, beta * Vred / (g.u * d)) / 1000;
        r.face = { u0: g.u, Vred, beta, vEd, vRdmax, nu, eta: vEd / vRdmax };
      }
      const aMax = Math.min(2 * d, aBordo, isFinite(aOutro) ? aOutro : Infinity);
      if (N <= 0) { r.nota = 'Pilar sem compressão nesta combinação.'; out.push(r); return; }
      if (aMax <= 0.05 * d) { r.nota = 'Perímetros de controlo fora da sapata: a carga é transmitida diretamente ao terreno.'; out.push(r); return; }
      const nS = 40;
      for (let i = 1; i <= nS; i++) {
        const a = Math.max(0.05 * d, aMax * i / nS);
        const g = geomU(a);
        const Vred = N - dV(a);
        const beta = betaF(a, Vred, g);
        const vEd = Math.max(0, beta * Vred / (g.u * d)) / 1000;
        const vRd = vr.v * 2 * d / a;
        const pt = { a, u: g.u, Vred, beta, vEd, vRd, eta: vEd / vRd };
        r.perfil.push(pt);
        if (!r.crit || pt.eta > r.crit.eta) r.crit = pt;
      }
      r.aMax = aMax; r.k = vr.k; r.vRdc = vr.v; r.rho = rho; r.d = d;
      if (aMax < 2 * d - 1e-9) r.nota = aBordo < 2 * d ? `Perímetro limitado pelo bordo da sapata (a ≤ ${fmt(aMax, 3)} m).` : `Perímetro limitado pela proximidade de outro pilar (a ≤ ${fmt(aMax, 3)} m).`;
      out.push(r);
    });
    return out;
  }

  /* ---------------------------------------------------------------------
     Amarração da armadura inferior (EC2 9.8.2.2, Figura 9.13)
     --------------------------------------------------------------------- */
  function amarracaoVaroes(st, geo, malha, cmp, cb, bet, ac, dd) {
    const m = st.materiais;
    const res = {};
    const hook = !!m.patilhas;
    for (const dir of ['x', 'y']) {
      const n = dir === 'x' ? malha.nx : malha.ny;
      const coord = dir === 'x' ? malha.xs : malha.ys;
      const h = dir === 'x' ? malha.dx : malha.dy;
      const strip = new Float64Array(n), mom = new Float64Array(n);
      for (let i = 0; i < malha.nx; i++) for (let j = 0; j < malha.ny; j++) {
        const k = dir === 'x' ? i : j;
        const v = cmp.wSolo[i * malha.ny + j] * malha.dA;
        strip[k] += v; mom[k] += v * coord[k];
      }
      const phi = dir === 'x' ? dd.fx : dd.fy;
      const As = dir === 'x' ? dd.AsX : dd.AsY;
      const d = dir === 'x' ? dd.dx : dd.dy;
      const half = dir === 'x' ? geo.B / 2 : geo.L / 2;
      // EC2 Quadro 8.2: α1 = 0,7 para varões dobrados só se cd > 3φ; cd = min(a/2; c) (Figura 8.3)
      const sBar = (+(dir === 'x' ? m.armInf.x.s : m.armInf.y.s) || 0.2) * 1000;
      const cd = Math.min((sBar - phi) / 2, +m.cnom || 50);
      const alfa1 = hook && cd > 3 * phi ? 0.7 : 1.0;
      let pior = null;
      for (const lado of [1, -1]) {
        // face do pilar mais próxima deste bordo
        let face = -Infinity, cLarg = 0;
        for (const p of geo.pil) {
          const z = (dir === 'x' ? p.x : p.y) * lado;
          const c = dir === 'x' ? p.ex_ : p.ey_;
          if (z + c / 2 > face) { face = z + c / 2; cLarg = c; }
        }
        const Lv = half - face;
        if (Lv <= 0) continue;
        const xN = face - 0.15 * cLarg; // posição de NEd (e = 0,15·b)
        const xmin = Math.max(geo.h / 2, h);
        for (let xd = xmin; xd <= Lv + 1e-9; xd += Math.max(h, (Lv - xmin) / 30 || h)) {
          // resultante R na faixa entre o bordo e a secção (coordenada local z = coord·lado)
          let Rr = 0, Mr = 0;
          for (let k = 0; k < n; k++) {
            const z = coord[k] * lado;
            if (z >= half - xd) { Rr += strip[k]; Mr += mom[k] * lado; }
          }
          if (Rr <= 0) continue;
          const zR = Mr / Rr;
          const ze = Math.max(0, zR - xN);
          const zi = 0.9 * d;
          const Fs = Rr * ze / zi;
          const sig = Math.min(ac.fyd, Fs / (As * 1e-4) / 1000);
          const am = amarracao(bet, phi, sig, alfa1, false);
          const lav = (xd - (+m.cnom || 50) / 1000) * 1000 + (hook ? Math.max(0, (geo.h - 2 * (+m.cnom || 50) / 1000) * 1000 - phi) : 0);
          const eta = lav > 0 ? am.lbd / lav : Infinity;
          if (!pior || eta > pior.eta) pior = { eta, x: xd, Fs, sig, lbd: am.lbd, lav, R: Rr, ze, zi, lado, alfa1, cd };
        }
      }
      if (pior) res[dir] = pior;
    }
    return res;
  }

  /* ---------------------------------------------------------------------
     Derrube (EQU): momentos estabilizantes e instabilizantes nos 4 bordos
     --------------------------------------------------------------------- */
  function derrube(st, geo, comb) {
    const partes = comb.partes || comb.termos.map(t => ({ a: t.a, fNs: t.f, fNd: t.f, fMs: t.f, fMd: t.f }));
    const bordos = [
      { nome: '+x', arm: (x, y) => geo.B / 2 - x, mM: (c) => -(c.My + c.Vx * geo.h) },
      { nome: '−x', arm: (x, y) => geo.B / 2 + x, mM: (c) => (c.My + c.Vx * geo.h) },
      { nome: '+y', arm: (x, y) => geo.L / 2 - y, mM: (c) => (c.Mx - c.Vy * geo.h) },
      { nome: '−y', arm: (x, y) => geo.L / 2 + y, mM: (c) => -(c.Mx - c.Vy * geo.h) }
    ];
    let best = null;
    for (const bd of bordos) {
      let Ms = 0, Md = 0;
      for (const pt of partes) {
        for (const p of geo.pil) {
          const v = pt.a.val && pt.a.val[p.id];
          if (!v) continue;
          const c = { N: +v.N || 0, Mx: +v.Mx || 0, My: +v.My || 0, Vx: +v.Vx || 0, Vy: +v.Vy || 0 };
          // fator de sinal (sísmica ±) já incluído em fNs/fMs quando negativo
          const sgn = pt.fMs < 0 || pt.fNs < 0 ? -1 : 1;
          const mN = sgn * c.N * bd.arm(p.x, p.y);
          const mM = sgn * bd.mM(c);
          const fN = Math.abs(mN >= 0 ? pt.fNs : pt.fNd), fM = Math.abs(mM >= 0 ? pt.fMs : pt.fMd);
          if (mN >= 0) Ms += fN * mN; else Md += -fN * mN;
          if (mM >= 0) Ms += fM * mM; else Md += -fM * mM;
        }
        if (pt.a.qsup) { /* sobrecarga variável: estabilizante → fator 0 */ }
      }
      const armC = bd.nome.includes('x') ? geo.B / 2 : geo.L / 2;
      Ms += comb.fPP * geo.W * armC;
      if (comb.fQs) Ms += comb.fQs * geo.Qs * armC;
      Md += (comb.fU || 1) * geo.U * armC;
      const eta = Ms > 0 ? Md / Ms : (Md > 0 ? Infinity : 0);
      if (!best || eta > best.eta) best = { bordo: bd.nome, Mstb: Ms, Mdst: Md, eta };
    }
    return best;
  }

  /* ---------------------------------------------------------------------
     Formatação
     --------------------------------------------------------------------- */
  function fmt(v, n) {
    if (v === undefined || v === null || isNaN(v)) return '—';
    if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
    return Number(v).toLocaleString('pt-PT', { minimumFractionDigits: n, maximumFractionDigits: n });
  }
  function fmtN(v) { return fmt(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 2); }

  return {
    BETOES, ACOS, SETS, MSETS, betao, aco, rectPoly, polyMoments, clipPoly, solvePressure,
    areaEfetiva, capDrenada, capNaoDrenada, tensoesIn, camadaEm, camadasLista, geometria, gerarCombinacoes,
    cargasBase, paramsTerreno, vRdc, flexaoReq, flexaoRes, amarracao, kTab61, Iret, assentamento, analisar, derrube, fmt, fmtN, areaVaroes
  };
});
