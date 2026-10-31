// Testes de validação do motor de cálculo — executar com: node ferramentas/sapatas/testes/validacao.js
const C = require('../calc.js');
let nOk = 0, nFail = 0;
function near(nome, v, ref, tol) {
  const err = Math.abs(v - ref) / Math.max(1e-12, Math.abs(ref));
  const ok = err <= tol;
  ok ? nOk++ : nFail++;
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${nome}: ${v.toFixed(4)} (ref ${ref}) erro ${(err * 100).toFixed(2)} %`);
}

// 1) Pressões — uniaxial com levantamento: pmax = 2V/(3L(B/2-e))
{
  const P = C.rectPoly(2, 1);
  const r = C.solvePressure(P, 100, 0.5, 0);
  near('uniaxial levantamento pmax', r.pmax, 2 * 100 / (3 * 1 * (1 - 0.5)), 1e-6);
  near('uniaxial levantamento área comprimida', r.contacto, 3 * (1 - 0.5) / 2, 1e-6);
}
// 2) Pressões — biaxial contacto total
{
  const B = 2, L = 3, V = 600, ex = 0.1, ey = 0.2;
  const r = C.solvePressure(C.rectPoly(B, L), V, ex, ey);
  const ref = V / (B * L) * (1 + 6 * ex / B + 6 * ey / L);
  near('biaxial contacto total pmax', r.pmax, ref, 1e-9);
}
// 3) Pressões — biaxial com levantamento: equilíbrio verificado por integração numérica
{
  const B = 2, L = 2, V = 500, ex = 0.4, ey = 0.3;
  const r = C.solvePressure(C.rectPoly(B, L), V, ex, ey);
  let S = 0, Sx = 0, Sy = 0; const n = 400, d = B / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -B / 2 + (i + 0.5) * d, y = -L / 2 + (j + 0.5) * d;
    const p = Math.max(0, r.a + r.b * x + r.c * y);
    S += p * d * d; Sx += p * x * d * d; Sy += p * y * d * d;
  }
  near('biaxial levantamento ΣV', S, V, 2e-3);
  near('biaxial levantamento ex', Sx / S, ex, 5e-3);
  near('biaxial levantamento ey', Sy / S, ey, 5e-3);
}

// 4) GEO5 — relatório "sapata contínua" 1,5×1,5: Load No. 1 → Rd = 871,56 kPa (R/A', sem fatores)
{
  const V = 910 + 20.70 + 33.44; // N + G + Z do relatório
  const ex = (70 - 14 * 0.4) / V; // GEO5: My − Hx·t
  const ef = C.areaEfetiva(1.5, 1.5, ex, 0);
  const r = C.capDrenada({ phi: 31.5, c: 0, gEf: 17.5, q: 17.5 * 1.2 }, ef, V, 14, 5, 0);
  near('GEO5 R/A\' drenado (871,56 kPa)', r.qult, 871.56, 0.01);
  near('GEO5 tensão de contacto V/A\' (470,40 kPa)', V / ef.A_, 470.40, 0.002);
}

// 5) GEO5 — punçoamento C20/25: vRd,max = 2,94 MPa; vRd(a=0,27 m) = 1,31 MPa
{
  const bet = C.betao('C20/25');
  const vmax = 0.4 * 0.6 * (1 - 20 / 250) * bet.fcd;
  near('GEO5 vRd,max (2,94 MPa)', vmax, 2.94, 0.002);
  const rho = Math.sqrt(0.00716 * 0.00573);
  const vr = C.vRdc(bet, 0.354, rho);
  near('GEO5 vRd,c a = 0,27 m (1,31 MPa)', vr.v * 2 * 0.354 / 0.27, 1.31, 0.02);
}

// 6) CYPE P25 — ρmin = 0,26·fctm/fyk (C30/37, A500) = 0,00151
{
  const bet = C.betao('C30/37');
  near('CYPE ρmin C30/37 (0,00151)', 0.26 * bet.fctm / 500, 0.00151, 0.005);
}

// 7) Pad Expert — 4 pilares, L2-S (4×50 kN) → 152,0 kPa; L3-E (4×80 kN) → 228,8 kPa
function estadoPad() {
  const pil = [[-0.25, 0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25]].map((c, i) => ({ id: 'K' + (i + 1), forma: 'ret', cx: 0.2, cy: 0.2, D: 0.3, x: c[0], y: c[1], phi: 12 }));
  const val = (N) => Object.fromEntries(pil.map(p => [p.id, { N, Mx: 0, My: 0, Vx: 0, Vy: 0 }]));
  return {
    geometria: { B: 1.25, L: 1.25, h: 0.5, Df: 1.0, gammaC: 25, gammaAterro: 18, qSup: 2.5, qSupTipo: 'G' },
    pilares: pil,
    materiais: { betao: 'C30/37', aco: 'A500', cnom: 50, armInf: { x: { phi: 6, s: 0.2 }, y: { phi: 6, s: 0.2 } }, armSup: { ativa: false, x: { phi: 6, s: 0.2 }, y: { phi: 6, s: 0.2 } }, camadaInf: 'x', patilhas: false, seccaoRef: 'face', sMax: 0.3, sMin: 0.1, dg: 20, sigArr: 1 },
    terreno: { modo: 'unica', camadas: [{ nome: 'Solo', esp: 0, gamma: 18, gammaSat: 20, phi: 30, c: 0, cu: 0, E: 1, nu: 0.3, sigAdm: 200 }], nf: { considerar: false, prof: 10 } },
    cargas: { modo: 'comb', carac: { acoes: [] }, comb: { reacoes: false, linhas: [
      ...pil.map(p => ({ nome: 'L2', tipo: 'CAR', pilar: p.id, N: 50 })),
      ...pil.map(p => ({ nome: 'L3', tipo: 'SIS', pilar: p.id, N: 80 }))
    ] }, omega: 1 },
    analise: { usarSigAdm: true, kBordo: 1.3, kSis: 1.5, usarEC7: true, usarAssent: false }
  };
}
{
  const st = estadoPad();
  const geo = C.geometria(st);
  const combs = C.gerarCombinacoes(st);
  const L2 = combs.find(c => c.nome === 'L2');
  const L3 = combs.find(c => c.nome === 'L3');
  const b2 = C.cargasBase(st, geo, L2), b3 = C.cargasBase(st, geo, L3);
  // Pad Expert conta o aterro em toda a área (inclui a área dos pilares) → corrigir para comparar
  const corr = 18 * 0.5 * geo.Acol;
  near('Pad Expert L2-S σ (152,0 kPa)', (b2.Vef + corr) / geo.A, 152.0, 0.001);
  near('Pad Expert L3-E σ (228,8 kPa)', (b3.Vef + corr) / geo.A, 228.8, 0.001);
  const R = C.analisar(st);
  console.log('     análise Pad: ' + R.checks.length + ' verificações em ' + R.tempo + ' ms');
}

// 8) Caso completo com combinações geradas
function estadoExemplo() {
  return {
    geometria: { B: 2.1, L: 2.1, h: 0.5, Df: 1.0, gammaC: 25, gammaAterro: 18, qSup: 0, qSupTipo: 'Q' },
    pilares: [{ id: 'P1', forma: 'ret', cx: 0.4, cy: 0.4, D: 0.4, x: 0, y: 0, phi: 16 }],
    materiais: { betao: 'C30/37', aco: 'A500', cnom: 50, armInf: { x: { phi: 16, s: 0.2 }, y: { phi: 16, s: 0.2 } }, armSup: { ativa: false, x: { phi: 12, s: 0.2 }, y: { phi: 12, s: 0.2 } }, camadaInf: 'x', patilhas: true, seccaoRef: 'face', sMax: 0.3, sMin: 0.1, dg: 20, sigArr: 1 },
    terreno: { modo: 'multi', camadas: [
      { nome: 'Aterro', esp: 0.8, gamma: 18, gammaSat: 19, phi: 28, c: 0, cu: 0, E: 8, nu: 0.3, sigAdm: 100 },
      { nome: 'Areia siltosa', esp: 4, gamma: 19, gammaSat: 20, phi: 32, c: 0, cu: 0, E: 25, nu: 0.3, sigAdm: 250 },
      { nome: 'Saibro (granito alterado)', esp: 0, gamma: 20, gammaSat: 21, phi: 36, c: 10, cu: 0, E: 80, nu: 0.25, sigAdm: 400 }],
      nf: { considerar: true, prof: 2.0 } },
    cargas: { modo: 'carac', omega: 1, comb: { linhas: [] }, carac: { acoes: [
      { id: 'G', nome: 'G', tipo: 'G', val: { P1: { N: 700, Mx: 10, My: 25, Vx: 12, Vy: 8 } } },
      { id: 'Q', nome: 'Q', tipo: 'Q', psi0: 0.7, psi1: 0.5, psi2: 0.3, val: { P1: { N: 250, Mx: 4, My: 10, Vx: 4, Vy: 3 } } },
      { id: 'W', nome: 'W', tipo: 'W', psi0: 0.6, psi1: 0.2, psi2: 0, val: { P1: { N: 30, Mx: 0, My: 40, Vx: 18, Vy: 0 } } },
      { id: 'E', nome: 'E', tipo: 'E', val: { P1: { N: 60, Mx: 30, My: 80, Vx: 45, Vy: 25 } } }
    ] } },
    analise: { usarSigAdm: true, kBordo: 1.25, kSis: 1.5, usarEC7: true, usarAssent: true, zInfPct: 20, sLim: 25, rotLim: 500, kDelta: 1, contactoQP: true, metodoAss: 'E', alivio: true }
  };
}
{
  const st = estadoExemplo();
  const R = C.analisar(st);
  console.log(`     exemplo: ${R.combos.length} combinações, ${R.checks.length} verificações em ${R.tempo} ms; ok = ${R.ok}; ηmax = ${R.etaMax.toFixed(3)}`);
  for (const c of R.checks) console.log(`       ${c.ok ? '✓' : (c.aviso ? '!' : '✗')} ${(isFinite(c.eta) ? c.eta.toFixed(3) : '∞').padStart(6)}  ${c.nome}  [${c.comb ? c.comb.tipo + ' ' + c.comb.nome : ''}] ${c.info || ''}`);
  for (const a of R.avisos) console.log('       aviso: ' + a);
  // verificação manual da flexão: MEd na face para carga centrada aproximada
  const A1 = R.porComb.filter(r => r.comb.tipo === 'A1');
  const r = A1.find(r => r.comb.nome === '1,35·G + 1,5·Q');
  const N = r.cb.cols[0].N;
  const Mfaceapprox = N / 2.1 * ((2.1 - 0.4) / 2) ** 2 / 2; // pressão uniforme líquida = N/A por metro, × L
  const k = 0;
  console.log(`     MEd face (num.) = ${r.cx.at(0.2).M.toFixed(2)} kN·m; aproximação uniforme = ${(Mfaceapprox * 2.1 / 2.1).toFixed(2)} (excentricidade aumenta o valor numérico)`);
}

console.log(`\n${nOk} OK, ${nFail} falhas`);
if (nFail) process.exit(1);
