/* ==========================================================================
   Conversor PDF/A — worker de conversão (BO Associados)
   Corre fora da página para não a bloquear. Carrega, da mesma pasta:
     pdf-lib.min.js  (pdf-lib, MIT)
     gs.js + gs.wasm.gz  (Ghostscript 10.06 em WebAssembly, AGPL-3.0)
   ========================================================================== */
importScripts('pdf-lib.min.js', 'gs.js');
const __gsFactory = Module;
let wasmMod = null;
const PDFA_DEF = `%!
/ICCProfile (%rom%iccprofiles/srgb.icc) def
[/_objdef {icc_PDFA} /type /stream /OBJ pdfmark
[{icc_PDFA} << /N 3 >> /PUT pdfmark
[{icc_PDFA} ICCProfile (r) file /PUT pdfmark
[/_objdef {OutputIntent_PDFA} /type /dict /OBJ pdfmark
[{OutputIntent_PDFA} <<
  /Type /OutputIntent
  /S /GTS_PDFA1
  /DestOutputProfile {icc_PDFA}
  /OutputConditionIdentifier (sRGB)
  /Info (sRGB IEC61966-2.1)
>> /PUT pdfmark
[{Catalog} << /OutputIntents [ {OutputIntent_PDFA} ] >> /PUT pdfmark
`;
// Compacta os caminhos vetoriais escritos pelo Ghostscript (coordenadas absolutas longas):
// remove pontos repetidos consecutivos e reescreve cada caminho com mais de 3 pontos
// relativamente ao seu primeiro ponto (q 1 0 0 1 x y cm ... Q). Coordenadas com 1 casa decimal
// (0,1 unidade do Ghostscript = 1/7200 pol. ≈ 0,0035 mm).
function compactContent(src) {
  // src: string latin1
  if (/(^|\n)BI\b/.test(src)) return null; // imagens inline (binário): não mexer
  const lines = src.split('\n');
  const out = [];
  const NUM = /^-?(?:\d+\.?\d*|\.\d+)$/;
  const PATHOP = new Set(['m','l','c','v','y','h','re']);
  const PAINT = new Set(['S','s','f','f*','F','B','B*','b','b*','n']);
  const f1 = (v) => { let s = (Math.round(v * 10) / 10).toFixed(1); if (s.endsWith('.0')) s = s.slice(0, -2); if (s === '-0') s = '0'; return s; };
  let path = [];   // arrays de tokens
  const isNum = (t) => NUM.test(t);
  function emitRaw(toks) { out.push(toks.join(' ')); }
  function flush(paintLines) {
    const isClip = paintLines.some(l => /(^|\s)W\*?(\s|$)/.test(l));
    // remover 'l' repetidos (só depois de outro 'l', para manter pontos isolados m+l)
    const cleaned = []; let prev = null, prevOp = null;
    for (const t of path) {
      const op = t[t.length - 1];
      if (op === 'l' && prevOp === 'l' && prev && t[0] === prev[0] && t[1] === prev[1]) continue;
      cleaned.push(t);
      if (op === 'm' || op === 'l') prev = t; else if (op === 'c') prev = [t[4], t[5]]; else if (op === 'v' || op === 'y') prev = [t[2], t[3]]; else prev = null;
      prevOp = op;
    }
    let npts = 0; for (const t of cleaned) { const op = t[t.length - 1]; if (op !== 'h' && op !== 're') npts++; }
    if (!isClip && npts >= 4 && cleaned[0][cleaned[0].length - 1] === 'm') {
      const oxs = cleaned[0][0], oys = cleaned[0][1], ox = +oxs, oy = +oys;
      out.push('q 1 0 0 1 ' + oxs + ' ' + oys + ' cm');
      for (const t of cleaned) {
        const op = t[t.length - 1], n = t.length - 1;
        if (!n) { out.push(op); continue; }
        const v = [];
        if (op === 're') v.push(f1(+t[0] - ox), f1(+t[1] - oy), f1(+t[2]), f1(+t[3]));
        else for (let i = 0; i < n; i++) v.push(f1(+t[i] - (i % 2 ? oy : ox)));
        out.push(v.join(' ') + ' ' + op);
      }
      for (const l of paintLines) out.push(l);
      out.push('Q');
    } else {
      for (const t of cleaned) { const op = t[t.length - 1]; out.push(t.length > 1 ? t.slice(0, -1).map(x => f1(+x)).join(' ') + ' ' + op : op); }
      for (const l of paintLines) out.push(l);
    }
    path = [];
  }
  let pending = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], s = raw.trim();
    if (!s) { out.push(raw); continue; }
    const t = s.split(/\s+/), op = t[t.length - 1];
    if (PATHOP.has(op) && t.slice(0, -1).every(isNum)) {
      if (pending.length) { if (path.length) { for (const p of path) emitRaw(p); path = []; } out.push(...pending); pending = []; }
      path.push(t); continue;
    }
    if (path.length && (op === 'W' || op === 'W*')) { pending.push(s); continue; }
    if (path.length && PAINT.has(op) && t.length <= 2) { flush(pending.concat([s])); pending = []; continue; }
    if (path.length) { for (const p of path) emitRaw(p); path = []; }
    if (pending.length) { out.push(...pending); pending = []; }
    out.push(raw);
  }
  if (path.length) for (const p of path) emitRaw(p);
  if (pending.length) out.push(...pending);
  return out.join('\n');
}

async function compactPdf(bytes, PDFLib) {
  const {PDFDocument, PDFName, PDFArray, PDFRawStream, PDFRef, decodePDFRawStream} = PDFLib;
  const doc = await PDFDocument.load(bytes, {updateMetadata: false});
  const ctx = doc.context;
  const dec = new TextDecoder('latin1');
  const FLATE = PDFName.of('FlateDecode'), FILTER = PDFName.of('Filter');
  const SKIP = new Set(['/Filter', '/DecodeParms', '/Length']);
  const targets = new Map(); // ref string -> ref
  for (const page of doc.getPages()) {
    const c = page.node.get(PDFName.of('Contents'));
    if (!c) continue;
    for (const r of (c instanceof PDFArray ? c.asArray() : [c])) if (r instanceof PDFRef) targets.set(r.toString(), r);
  }
  const SUB = PDFName.of('Subtype'), FORM = PDFName.of('Form');
  for (const [ref, obj] of ctx.enumerateIndirectObjects())
    if (obj instanceof PDFRawStream && obj.dict.get(SUB) === FORM) targets.set(ref.toString(), ref);
  let before = 0, after = 0, changed = 0;
  for (const ref of targets.values()) {
    const st = ctx.lookup(ref);
    if (!(st instanceof PDFRawStream)) continue;
    const filt = st.dict.get(FILTER);
    if (filt && filt !== FLATE) continue;
    const raw = st.contents;
    const s = dec.decode(filt ? decodePDFRawStream(st).decode() : raw);
    const r = compactContent(s);
    if (r === null) continue;
    const u = new Uint8Array(r.length);
    for (let i = 0; i < r.length; i++) u[i] = r.charCodeAt(i);
    const ns = ctx.flateStream(u);
    if (ns.contents.length >= raw.length) continue;
    for (const [k, v] of st.dict.entries()) if (!SKIP.has(k.toString())) ns.dict.set(k, v);
    before += raw.length; after += ns.contents.length; changed++;
    ctx.assign(ref, ns);
  }
  if (!changed) return {changed};
  const out = await doc.save({useObjectStreams: true, updateFieldAppearances: false});
  return {changed, before, after, out};
}

async function markForms(bytes) {
  const {PDFDocument, PDFName, PDFDict} = self.PDFLib;
  const doc = await PDFDocument.load(bytes, {updateMetadata: false, throwOnInvalidObject: false});
  const SUB = PDFName.of('Subtype'), FORM = PDFName.of('Form'), GRP = PDFName.of('Group');
  let n = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const d = obj && obj.dict instanceof PDFDict ? obj.dict : null;
    if (!d) continue;
    if (d.get(SUB) === FORM && !d.has(GRP)) { d.set(GRP, doc.context.obj({S: 'Transparency'})); n++; }
  }
  if (!n) return {n};
  return {n, out: await doc.save({useObjectStreams: false, updateFieldAppearances: false})};
}
self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try {
      // gs.wasm.gz fica em cache no browser: só é descarregado na primeira visita.
      const r = await fetch('gs.wasm.gz');
      if (!r.ok) throw new Error('gs.wasm.gz: HTTP ' + r.status);
      let buf = await r.arrayBuffer();
      const b = new Uint8Array(buf, 0, 2);
      if (b[0] === 0x1f && b[1] === 0x8b) {   // gzip (se o servidor não o descomprimiu já)
        const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
        buf = await new Response(ds).arrayBuffer();
      }
      wasmMod = await WebAssembly.compile(buf);
      self.postMessage({type:'ready'});
    } catch (err) { self.postMessage({type:'initError', error:String(err && err.message || err)}); }
    return;
  }
  if (m.type === 'convert') {
    const {id, data, level, flat} = m;
    const input = new Uint8Array(data);
    const log = [];
    let total = 0;
    const out = (s) => {
      log.push(s);
      let r = /Processing pages \d+ through (\d+)/.exec(s);
      if (r) { total = +r[1]; self.postMessage({type:'progress', id, page:0, total}); }
      r = /^Page (\d+)/.exec(s);
      if (r) self.postMessage({type:'progress', id, page:+r[1], total});
    };
    const runGs = async (bytesIn) => {
      const M = await __gsFactory({
        print: out, printErr: (s) => log.push(s),
        locateFile: (p) => p,
        instantiateWasm: (imports, cb) => { WebAssembly.instantiate(wasmMod, imports).then(inst => cb(inst, wasmMod)); return {}; }
      });
      M.FS.writeFile('/in.pdf', bytesIn);
      M.FS.writeFile('/pdfa_def.ps', PDFA_DEF);
      const mark = log.length;
      let rc;
      try {
        rc = M.callMain(['-dPDFA=' + level, '-dBATCH', '-dNOPAUSE', '-dNOOUTERSAVE',
          '-sColorConversionStrategy=RGB', '-sDEVICE=pdfwrite', '-dPDFACompatibilityPolicy=1',
          '-dAutoRotatePages=/None', ...(flat ? ['-dPreserveAnnots=false', '-dPrinted=false'] : []),
          '-sOutputFile=/out.pdf', '/pdfa_def.ps', '/in.pdf']);
      } catch (ex) { rc = (ex && typeof ex.status === 'number') ? ex.status : -1; log.push(String(ex && ex.message || ex)); }
      let bytes = null;
      try { bytes = M.FS.readFile('/out.pdf'); } catch (_) {}
      const fatal = /requires a password|No pages will be processed|Couldn't initialise file/i.test(log.slice(mark).join('\n'));
      return (rc !== 0 || fatal || !bytes || bytes.length < 200) ? {ok:false, rc} : {ok:true, bytes};
    };
    try {
      // Blocos repetidos (Form XObjects): o Ghostscript copia-os para cada página, o que pode
      // multiplicar o tamanho. Marcados como grupo de transparência neutro, são escritos uma só vez.
      // O PDF/A-1 não admite transparência, por isso só se aplica ao 2b e 3b.
      let pre = null;
      if (level !== '1') {
        try {
          const r = await markForms(input);
          if (r.out) { pre = r.out; log.push('[conversor] ' + r.n + ' bloco(s) reutilizável(eis) preservado(s) como XObject partilhado.'); }
        } catch (e) { log.push('[conversor] Pré-processamento ignorado: ' + (e && e.message || e)); }
      }
      let res = await runGs(pre || input);
      if (!res.ok && pre) {
        log.push('[conversor] Falhou com o pré-processamento; nova tentativa com o ficheiro original.');
        total = 0;
        res = await runGs(input);
      }
      if (!res.ok) { self.postMessage({type:'done', id, ok:false, log: log.join('\n'), rc: res.rc}); return; }
      let b = res.bytes;
      // O Ghostscript reescreve os vetores com coordenadas absolutas longas (num desenho do AutoCAD
      // o ficheiro pode duplicar). Compacta-se o conteúdo das páginas sem alterar o desenho.
      try {
        self.postMessage({type:'progress', id, phase:'compact', page: total, total});
        const c = await compactPdf(b, self.PDFLib);
        if (c.out && c.out.length < b.length) {
          log.push('[conversor] Vetores compactados: ' + (b.length/1048576).toFixed(1) + ' MB → ' + (c.out.length/1048576).toFixed(1) + ' MB.');
          b = c.out;
        }
      } catch (e) { log.push('[conversor] Compactação ignorada: ' + (e && e.message || e)); }
      const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      self.postMessage({type:'done', id, ok:true, out: ab, log: log.join('\n'), total}, [ab]);
    } catch (err) {
      log.push(String(err && err.message || err));
      self.postMessage({type:'done', id, ok:false, log: log.join('\n')});
    }
  }
};
