// Mide el lector de planos contra el corpus: POST leer-plano (prod o RC) con JWT real de la cuenta QA.
import fs from 'node:fs'; import path from 'node:path';
const BASE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co';
const KEY = 'sb-publishable-lDPhCTatyJ2cap3FNEGs7A_uPapgg6y'.replace(/-/g, (m, i) => (i === 2 || i === 14) ? '_' : m);
const FN = process.env.LEER_FN || 'leer-plano';
const DIR = process.env.CORPUS_DIR || '.';
const SOLO = process.env.SOLO ? process.env.SOLO.split(',') : null;
const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
async function token() {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }) });
  const j = await r.json(); if (!j.access_token) throw new Error('login: ' + JSON.stringify(j).slice(0, 200)); return j.access_token;
}
const areaM2 = (a) => a.forma === 'circulo' ? Math.PI * (a.circulo.r / 1000) ** 2 : Math.abs((a.puntos || []).reduce((s, p, i, A) => { const q = A[(i + 1) % A.length]; return s + (p.x * q.y - q.x * p.y); }, 0) / 2) / 1e6;
const centroid = (a) => a.forma === 'circulo' ? [a.circulo.cx / 1000, a.circulo.cy / 1000] : [a.puntos.reduce((s, p) => s + p.x, 0) / a.puntos.length / 1000, a.puntos.reduce((s, p) => s + p.y, 0) / a.puntos.length / 1000];
function comparar(ctl, L) {
  const rows = []; const pagina = ctl.paginas;
  const todasCtl = pagina.flatMap((pg, i) => pg.areas.map((a) => ({ ...a, pagina: i + 1, env: pg.envolvente_m })));
  const leidas = L.areas || [];
  let okArea = 0, okM2 = 0, okPuestos = 0, okAsientos = 0, okTipo = 0;
  for (const c of todasCtl) {
    const m = leidas.find((x) => norm(x.nombre) === norm(c.nombre)) || leidas.find((x) => norm(x.nombre).includes(norm(c.nombre).split(' ')[0]) && norm(c.nombre).split(' ')[0].length > 3);
    if (!m) { rows.push(`  ✗ ${c.nombre}: NO leída`); continue; }
    okArea++;
    const m2 = areaM2(m); const dM2 = Math.abs(m2 - c.m2) / Math.max(c.m2, 1);
    const m2ok = dM2 <= 0.08; okM2 += m2ok;
    // privado/recepción: el programa los cuenta por TIPO (1 escritorio por cuarto); el lector puede traer 0 o 1.
    const pOk = (m.puestos || 0) === (c.puestos || 0) || (['privado', 'recepcion'].includes(c.tipo) && (m.puestos || 0) <= (c.puestos || 0)); okPuestos += pOk;
    const sOk = (m.asientos || 0) === (c.asientos || 0); okAsientos += sOk;
    const tOk = m.tipo === c.tipo; okTipo += tOk;
    const pg = Number.isInteger(m.pagina) ? m.pagina : null;
    rows.push(`  ${m2ok && pOk && sOk ? '✓' : '△'} ${c.nombre}: m² ${m2.toFixed(1)} vs ${c.m2} ${m2ok ? '✓' : '✗'} · puestos ${m.puestos ?? '-'}/${c.puestos} ${pOk ? '✓' : '✗'} · asientos ${m.asientos ?? '-'}/${c.asientos} ${sOk ? '✓' : '✗'} · tipo ${m.tipo}${tOk ? '' : ' (control ' + c.tipo + ')'} · forma ${m.forma}${m.puntos ? ' ' + m.puntos.length + 'pts' : ''}${pg != null ? ' · pág ' + pg : ''}${pg != null && c.pagina !== pg ? ' ✗(control pág ' + c.pagina + ')' : ''}`);
  }
  const extra = leidas.filter((x) => !todasCtl.some((c) => norm(x.nombre) === norm(c.nombre))).map((x) => x.nombre);
  // puertas: por página se comparan sólo en coordenadas globales de la página 1 (el control de C4 trae dos niveles)
  const ctlDoors = pagina.flatMap((pg, i) => pg.puertas.map((d) => ({ ...d, pagina: i + 1 })));
  const doors = L.puertas || [];
  let dOk = 0, swingOk = 0;
  for (const c of ctlDoors) {
    const m = doors.find((d) => Math.hypot(d.x / 1000 - c.x, d.y / 1000 - c.y) <= 0.6 && (!Number.isInteger(d.pagina) || d.pagina === c.pagina));
    if (m) { dOk++; if (m.tieneBarrido) swingOk++; }
  }
  const envCtl = pagina[0].envolvente_m; const env = L.envolvente || {};
  const envOk = Math.abs(env.ancho / 1000 - envCtl[0]) <= 0.3 && Math.abs(env.largo / 1000 - envCtl[1]) <= 0.3;
  const cols = (L.columnas || []).length; const colsCtl = pagina.reduce((s, pg) => s + pg.columnas.length, 0);
  const n = todasCtl.length;
  const resumen = { nombre: ctl.nombre, areas: `${okArea}/${n}`, m2: `${okM2}/${n}`, puestos: `${okPuestos}/${n}`, asientos: `${okAsientos}/${n}`, tipo: `${okTipo}/${n}`, puertas: `${dOk}/${ctlDoors.length}`, barridos: `${swingOk}/${ctlDoors.length}`, columnas: `${cols}/${colsCtl}`, envolvente: envOk ? '✓' : `✗ ${(env.ancho / 1000).toFixed(1)}×${(env.largo / 1000).toFixed(1)} vs ${envCtl.join('×')}`, cotas: L.tieneCotas, escala: String(L.escala || '').slice(0, 60), extra: extra.length ? extra.join(', ') : '-', notas: (L.notas || []).slice(0, 3) };
  return { resumen, rows };
}
const tok = await token();
const carpetas = fs.readdirSync(DIR).filter((d) => fs.existsSync(path.join(DIR, d, 'control.json'))).filter((d) => !SOLO || SOLO.includes(d)).sort();
const tabla = [];
for (const d of carpetas) {
  const ctl = JSON.parse(fs.readFileSync(path.join(DIR, d, 'control.json'), 'utf8'));
  const b64 = fs.readFileSync(path.join(DIR, d, 'plano.pdf')).toString('base64');
  const t0 = Date.now();
  const r = await fetch(`${BASE}/functions/v1/${FN}`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: KEY, Authorization: `Bearer ${tok}` }, body: JSON.stringify({ image: b64, mediaType: 'application/pdf' }) });
  const txt = await r.text(); const seg = ((Date.now() - t0) / 1000).toFixed(0);
  fs.writeFileSync(path.join(DIR, d, `lectura.${FN}.json`), txt);
  let j; try { j = JSON.parse(txt); } catch { console.log(d, 'HTTP', r.status, 'no-JSON'); continue; }
  if (!j.ok) { console.log(`\n== ${d} · HTTP ${r.status} · ${seg}s · ERROR ${j.code || ''} ${j.error || ''}`); tabla.push({ nombre: ctl.nombre, error: j.code || j.error }); continue; }
  const { resumen, rows } = comparar(ctl, j.lectura);
  console.log(`\n== ${d} · HTTP ${r.status} · ${seg}s · servidor ${j.floorSpec?.validation?.state} · issues ${(j.floorSpec?.validation?.issues || []).map((i) => i.code).join(',') || '-'}`);
  console.log(rows.join('\n'));
  console.log('  resumen:', JSON.stringify(resumen));
  tabla.push({ ...resumen, seg });
}
fs.writeFileSync(path.join(DIR, `tabla.${FN}.json`), JSON.stringify(tabla, null, 1));
console.log('\n| plano | áreas | m² | puestos | asientos | tipo | puertas | barridos | columnas | envolvente | s |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const t of tabla) console.log(`| ${t.nombre} | ${t.areas || t.error} | ${t.m2 || ''} | ${t.puestos || ''} | ${t.asientos || ''} | ${t.tipo || ''} | ${t.puertas || ''} | ${t.barridos || ''} | ${t.columnas || ''} | ${t.envolvente || ''} | ${t.seg || ''} |`);
