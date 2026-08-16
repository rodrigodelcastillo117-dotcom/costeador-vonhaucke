// AUDITORÍA VONI — dispara pedidos reales contra cotizar-texto y los cuesta con el motor.
// SOLO LECTURA. No despliega nada.
import { costearItem, catalogoIA } from '../src/datos/lineas.js';
import { BANCO } from '../src/datos/banco.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import fs from 'node:fs';

const FN_URL = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/functions/v1/cotizar-texto';
const KEY = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, piezas: {} };
const catalogo = catalogoIA();

const mx = (n) => (n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX'));

async function voni(texto) {
  const r = await fetch(FN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ texto, catalogo }),
  });
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t.slice(0, 400) }; }
}

async function corre(nombre, texto) {
  const t0 = Date.now();
  const res = await voni(texto);
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  const out = { nombre, texto, seg, ok: res.ok, error: res.error, status: res.status, raw: res.raw };
  if (!res.ok) return out;
  const p = res.propuesta || {};
  out.resumen = p.resumen; out.preguntas = p.preguntas || []; out.noEncontrado = p.noEncontrado || [];
  out.renglones = [];
  let total = 0;
  for (const it of p.items || []) {
    const cant = Math.max(1, Math.round(Number(it.cantidad) || 1));
    const c = costearItem(estado, { ...it, cantidad: cant });
    const row = {
      tipo: 'linea', ruta: it.ruta, producto: it.producto, cantidad: cant,
      seleccion: (it.seleccion || []).map((s) => `${s.clave}=${s.valor}`).join(' '),
      etiqueta: it.etiqueta, confianza: it.confianza, nota: it.nota,
    };
    if (!c) { row.error = 'NO COSTEABLE'; }
    else {
      row.nombre = c.nombre; row.pu = Math.round(c.precioUnitario);
      row.importe = Math.round(c.precioUnitario * cant);
      row.precioReal = c.precioReal; row.avisos = c.avisos; row.config = c.config;
      total += row.importe;
    }
    out.renglones.push(row);
  }
  for (const b of p.banco || []) {
    const pieza = BANCO.find((x) => x.id === b.id);
    const cant = Math.max(1, Math.round(Number(b.cantidad) || 1));
    const row = { tipo: 'banco', id: b.id, cantidad: cant, etiqueta: b.etiqueta, nota: b.nota };
    if (!pieza) row.error = 'ID INEXISTENTE EN BANCO';
    else { row.nombre = pieza.nombre; row.pu = pieza.precio; row.importe = Math.round(pieza.precio * cant); total += row.importe; }
    out.renglones.push(row);
  }
  out.total = total;
  out.uso = res.uso;
  return out;
}

function imprime(o) {
  console.log('\n' + '='.repeat(100));
  console.log(`### ${o.nombre}   (${o.seg}s)`);
  console.log('PEDIDO: ' + o.texto);
  if (!o.ok) { console.log('!! FALLÓ: ' + (o.error || o.raw) + ' [http ' + o.status + ']'); return; }
  console.log('RESUMEN VONI: ' + o.resumen);
  console.log('-'.repeat(100));
  for (const r of o.renglones) {
    if (r.error) { console.log(`  [X] ${r.tipo} ${r.ruta || r.id}/${r.producto || ''} x${r.cantidad} — ${r.error} — "${r.etiqueta}"`); continue; }
    const sello = r.precioReal ? 'FIRME' : (r.tipo === 'banco' ? 'BANCO' : 'modelo');
    console.log(`  ${String(r.cantidad).padStart(3)} x ${mx(r.pu).padStart(10)} = ${mx(r.importe).padStart(11)}  [${sello}] ${r.tipo === 'banco' ? r.id : r.ruta + '/' + r.producto}`);
    console.log(`        etiqueta: ${r.etiqueta}`);
    if (r.nombre) console.log(`        motor   : ${r.nombre}`);
    if (r.seleccion) console.log(`        sel     : ${r.seleccion}`);
    if (r.nota) console.log(`        nota    : ${r.nota}`);
    if (r.avisos?.length) console.log(`        AVISOS  : ${r.avisos.join(' | ')}`);
  }
  console.log('-'.repeat(100));
  console.log('TOTAL LISTA: ' + mx(o.total));
  if (o.preguntas.length) console.log('PREGUNTAS: ' + o.preguntas.join(' || ')); else console.log('PREGUNTAS: (ninguna)');
  if (o.noEncontrado.length) console.log('NO ENCONTRADO: ' + o.noEncontrado.join(' || '));
}

const PEDIDOS = JSON.parse(fs.readFileSync(new URL('./aud_repite.json', import.meta.url), 'utf8'));
const filtro = process.argv[2];
const lista = filtro ? PEDIDOS.filter((p) => p.n.includes(filtro)) : PEDIDOS;

const resultados = [];
for (const p of lista) {
  const o = await corre(p.n, p.t);
  resultados.push(o);
  imprime(o);
}
fs.writeFileSync(new URL('./aud_resultados' + (filtro ? '_' + filtro : '') + '.json', import.meta.url), JSON.stringify(resultados, null, 2));
console.log('\n\n== guardado ==');
