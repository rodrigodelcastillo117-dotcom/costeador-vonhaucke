#!/usr/bin/env node
// ============================================================================
//  ÍNDICE BUSCABLE DEL CATÁLOGO COMPLETO
//
//  Las 23 líneas están reconstruidas contra sus guías oficiales: 114 productos
//  y 5,824 variantes configurables, con claves y medidas reales. Pero a todo eso
//  sólo se llegaba navegando Cotizar de línea → línea → producto → configurar.
//  Un vendedor que busca "archivero Modulor 1.20" no lo encontraba nunca.
//
//  Esto recorre los generadores y escribe `src/datos/catalogoIndex.js` con un
//  renglón por producto: línea, qué es, medidas disponibles, claves reales y el
//  RANGO de precio (mínimo y máximo entre sus variantes). El precio sale del
//  modelo, no del papel: por eso se marca `estimado` y el sello lo dirá.
//
//      node scripts/genera-catalogo.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };
const TOPE = 60;   // variantes por producto que se cuestan para sacar el rango

// Combinaciones de un producto, acotadas: con 3,120 variantes no hace falta
// costearlas todas para saber entre cuánto y cuánto anda.
function variantes(p) {
  const ejes = [];
  if (p.largos) ejes.push(['largoMM', p.largos]);
  if (p.fondos) ejes.push(['fondoMM', p.fondos]);
  if (p.diametros) ejes.push(['diametroMM', p.diametros]);
  if (p.usuarios) ejes.push(['usuarios', p.usuarios]);
  for (const s of p.selects || []) ejes.push([s.key, s.opciones.map((o) => o.id)]);
  let out = [{}];
  for (const [k, vals] of ejes) {
    const next = [];
    for (const base of out) for (const v of vals) { if (next.length < TOPE) next.push({ ...base, [k]: v }); }
    out = next.length ? next : out;
  }
  return out.slice(0, TOPE);
}

const filas = [];
for (const [ruta, L] of Object.entries(LINEAS_REG)) {
  for (const p of L.productos || []) {
    let min = Infinity, max = -Infinity, nombre = p.nombre || p.id, claves = new Set(), real = false;
    for (const sel of variantes(p)) {
      let r; try { r = costearConfig(estado, ruta, p.id, configDesde(p, sel), 1); } catch { continue; }
      if (!r || !isFinite(r.precioUnitario)) continue;
      if (r.precioUnitario < min) { min = r.precioUnitario; }
      if (r.precioUnitario > max) { max = r.precioUnitario; nombre = r.nombre || nombre; }
      if (r.precioReal) real = true;
      for (const k of r.pieza?.claves || []) claves.add(k);
    }
    if (!isFinite(min)) continue;
    const medidas = [];
    if (p.largos) medidas.push(`largos ${p.largos.map((x) => (x / 1000).toFixed(2)).join(' / ')} m`);
    if (p.fondos) medidas.push(`fondos ${p.fondos.map((x) => (x / 1000).toFixed(2)).join(' / ')} m`);
    if (p.diametros) medidas.push(`Ø ${p.diametros.map((x) => (x / 1000).toFixed(2)).join(' / ')} m`);
    if (p.usuarios) medidas.push(`${p.usuarios.join(' / ')} usuarios`);
    const opciones = (p.selects || []).map((s) => `${s.key}: ${s.opciones.map((o) => o.label || o.id).join(' / ')}`);
    filas.push({
      ruta, producto: p.id, linea: L.titulo,
      nombre: String(nombre).split(' · ')[1] || p.nombre || p.id,
      medidas: medidas.join(' · '), opciones: opciones.join(' · '),
      claves: [...claves].slice(0, 6).join(' '), min: Math.round(min), max: Math.round(max), real,
    });
  }
}

filas.sort((a, b) => a.linea.localeCompare(b.linea) || a.nombre.localeCompare(b.nombre));
const js = `// ============================================================================
//  ÍNDICE DEL CATÁLOGO — generado por scripts/genera-catalogo.mjs. NO editar a
//  mano: se regenera cuando cambian los generadores de línea.
//  Un renglón por producto de cada una de las 23 líneas, con sus medidas, sus
//  opciones, sus claves reales y el rango de precio entre variantes.
//  El precio viene del MODELO (no del papel): por eso el sello dirá Estimado
//  salvo en las configuraciones que sí tienen precio real cargado.
// ============================================================================
export const CATALOGO_INDEX = [
${filas.map((f) => `  ${JSON.stringify(f)},`).join('\n')}
];

export const CATALOGO_LINEAS = [...new Set(CATALOGO_INDEX.map((p) => p.linea))].sort();
`;
fs.writeFileSync(path.join(process.cwd(), 'src/datos/catalogoIndex.js'), js);
console.log(`✓ ${filas.length} productos indexados de ${new Set(filas.map((f) => f.linea)).size} líneas`);
for (const l of [...new Set(filas.map((f) => f.linea))]) {
  const n = filas.filter((f) => f.linea === l).length;
  console.log(`   ${String(n).padStart(3)}  ${l}`);
}
