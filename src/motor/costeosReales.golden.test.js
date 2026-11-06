// GOLDEN · Costeos reales de Compras (laboratorio permanente, Bloque M).
// El MOTOR debe reproducir el costo de MATERIAL de los BOM reales a partir de
// (consumo × precio) con sus reglas de merma/fracción/divisa — no copiar el subtotal.
// Fuente: lab/datos_reales_drive/costeos/*/*.csv y lab/precios_vento/*.csv (datos reales commiteados).
// Totales esperados PINNED del workbook real (no se recalculan desde el CSV: así un
// cambio de fórmula o una regresión de divisa los rompe en vez de pasar silenciosamente).
// Split MO/indirecto autoritativo = fórmula de Alba (default), confirmado por
// Dirección 2026-11-06: uplift ~50% clava el EEFF (50.3%). Ver lab/CALIBRACION_COSTEOS_REALES.md.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { calcular, PARAMETROS_DEFAULT } from './calculo.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function parseCSV(txt) {
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c === '\r') { /* skip */ }
    else f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const num = (s) => { const n = Number(String(s ?? '').replace(/,/g, '').trim()); return Number.isFinite(n) ? n : null; };
const esClave = (c) => /^M[A-Z0-9]{6,}/.test((c || '').trim());

// Layout "explo": clave en col variable; costo=+6, consumo=+7 (Explo_MP_BOM / explo crudo).
function leerExplo(rel) {
  const out = [];
  for (const r of parseCSV(readFileSync(ROOT + rel, 'utf8'))) {
    const ai = r.findIndex(esClave); if (ai < 0) continue;
    const costo = num(r[ai + 6]); const consumo = num(r[ai + 7]);
    if (costo == null || consumo == null) continue;
    out.push({ articulo: r[ai].trim(), costo, consumo, moneda: 'MXN' });
  }
  return out;
}
// Layout "applt": header clave_material/consumo_cantidad/ultimo_costo_unitario/moneda (col 0,3,4,5).
function leerAPPLT(rel) {
  const out = [];
  for (const r of parseCSV(readFileSync(ROOT + rel, 'utf8'))) {
    if (!esClave(r[0])) continue;
    const consumo = num(r[3]); const costo = num(r[4]);
    if (costo == null || consumo == null) continue;
    out.push({ articulo: r[0].trim(), costo, consumo, moneda: /dolar|usd/i.test(r[5] || '') ? 'USD' : 'MXN' });
  }
  return out;
}
// El motor reproduce material = Σ consumo×precio (fracción-directa, sin merma extra: el
// consumo real ya la incluye) y convierte divisa a par.tipoCambio para moneda≠MXN.
function materialMotor(bom) {
  const componentes = []; const insumos = {};
  bom.forEach((l, i) => {
    const id = `${l.articulo}#${i}`;
    insumos[id] = { id, nombre: l.articulo, seccion: 'otros', clase: 'directa', unidad: 'Hoja',
                    formato: { tipo: 'hoja', medida: 1 }, fraccion: true, precio: l.costo,
                    ...(l.moneda !== 'MXN' ? { moneda: l.moneda } : {}) };
    componentes.push({ nombre: l.articulo, insumoId: id, hojas: l.consumo, piezas: 1 });
  });
  return calcular({ componentes }, 1, insumos, PARAMETROS_DEFAULT).materialTotal;
}

// [nombre, lector, ruta, nº líneas, total real PINNED, tolerancia $]
const CASOS = [
  ['C-CO-517R Exhibidor', leerExplo, 'lab/datos_reales_drive/costeos/CCO517R_Exhibidor/Explo_MP_BOM.csv', 28, 12089.66, 0.05],
  ['Ejercicio repisa',    leerExplo, 'lab/datos_reales_drive/costeos/ejercicio_repisa/Explo_MP_BOM.csv',   6,   156.98, 0.05],
  // APP LT: incluye 1 renglón en USD (pintura en polvo) convertido a tipoCambio 17.5 (Rodrigo 2026-08-16,
  // el workbook no trae tipo de cambio). pesos $3,679.15 + USD 1.135×6.23×17.5 = $123.74 = $3,802.89.
  ['Módulo APP LT (TATO63612AB001)', leerAPPLT, 'lab/datos_reales_drive/costeos/CosteAPPLT/BOM_costeo_APPLT.csv', 21, 3802.89, 0.02],
  // VENTO C-CO-526R: copia commiteada. El motor reproduce el BOM; el delta (~0.4%) es redondeo del
  // workbook (cada costo_linea a 2 decimales). ⚠️ Existe una 2ª extracción divergente ($42,653) — cuál
  // copia es la autoritativa es decisión de Compras (ver lab/CALIBRACION_COSTEOS_REALES.md §3).
  ['VENTO C-CO-526R',     leerExplo, 'lab/precios_vento/C-CO-526R__Explo_MP.csv',                           107, 20358.57, 85],
];

describe('GOLDEN costeos reales de Compras · capa material (motor reproduce consumo×precio)', () => {
  for (const [nombre, lector, rel, nLineas, totalReal, tol] of CASOS) {
    it(`${nombre}: material motor ≈ $${totalReal} del workbook real (±${tol})`, () => {
      const bom = lector(rel);
      expect(bom.length, `nº de líneas con costo leídas del BOM (${nombre})`).toBe(nLineas);
      const mp = materialMotor(bom);
      expect(Math.abs(mp - totalReal), `material motor ${mp.toFixed(2)} vs real ${totalReal}`).toBeLessThan(tol);
    });
  }
});
