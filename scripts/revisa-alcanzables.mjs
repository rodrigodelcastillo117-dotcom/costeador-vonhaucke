// ============================================================================
//  ¿Cada precio real sembrado se puede ALCANZAR desde la pantalla?
//
//  La lección que lo hizo necesario: había filas del price-book (banca doble de
//  1.05, banca sencilla de 1 usuario, el bench de Río de 8 usuarios) cuya
//  configuración el generador NO ofrecía. Sembrar un precio que nadie puede
//  armar es sembrar nada, y no se nota: la app cae al modelo en silencio.
//
//    node scripts/revisa-alcanzables.mjs
// ============================================================================
import { PRECIOS_VENTA, buscarPrecioVenta } from '../src/datos/preciosVenta.js';
import { LINEAS_REG } from '../src/datos/lineas.js';

let ok = 0, mal = 0;
for (const f of PRECIOS_VENTA) {
  const L = LINEAS_REG[f.linea];
  const prod = L && L.productos.find((p) => p.id === f.producto);
  const problemas = [];
  if (!L) problemas.push(`la línea "${f.linea}" no está registrada`);
  else if (!prod) problemas.push(`el producto "${f.producto}" no existe en ${f.linea}`);
  else {
    if (f.largoMM != null && prod.largos && !prod.largos.includes(f.largoMM)) problemas.push(`largo ${f.largoMM} no está en las opciones`);
    if (f.fondoMM != null && prod.fondos && !prod.fondos.includes(f.fondoMM)) problemas.push(`fondo ${f.fondoMM} no está en las opciones`);
    if (f.usuarios != null && prod.usuarios && !prod.usuarios.includes(f.usuarios)) problemas.push(`${f.usuarios} usuarios no está en las opciones`);
    for (const [k, v] of Object.entries(f.sel || {})) {
      const sel = (prod.selects || []).find((x) => x.key === k);
      const chk = (prod.checks || []).find((x) => x.key === k);
      if (sel && !sel.opciones.some((o) => String(o.id) === String(v))) problemas.push(`"${k}=${v}" no está entre las opciones de ${k}`);
      else if (!sel && !chk) problemas.push(`la opción "${k}" no existe en el producto`);
    }
  }
  const cfg = { producto: f.producto, largoMM: f.largoMM, fondoMM: f.fondoMM, usuarios: f.usuarios, biombo: f.biombo, ...(f.sel || {}) };
  const hit = buscarPrecioVenta(f.linea, cfg);
  if (!hit) problemas.push('buscarPrecioVenta no la encuentra');
  else if (hit.lista !== f.lista) problemas.push(`la tapa otra fila ($${hit.lista} en vez de $${f.lista}) — revisa el ORDEN de las filas`);

  const et = `${f.linea}/${f.producto} ${f.largoMM ?? '-'}×${f.fondoMM ?? '-'} ${f.usuarios ?? '-'}u ${f.biombo ?? 'sin biombo'}${f.sel ? ' +' + Object.entries(f.sel).map(([k, v]) => `${k}=${v}`).join('+') : ''}`;
  if (problemas.length) { mal++; console.log(`✗ ${et}\n     ${problemas.join(' · ')}`); }
  else { ok++; console.log(`✓ ${et.padEnd(64)} $${f.lista}`); }
}
console.log(`\n${ok} alcanzables · ${mal} con problema`);
process.exit(mal ? 1 : 0);
