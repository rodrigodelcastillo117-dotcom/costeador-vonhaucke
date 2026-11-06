// GOLDEN · Costeos reales de Compras (laboratorio permanente, Bloque M).
// El MOTOR debe reproducir el costo de MATERIAL de los BOM reales a partir de
// (consumo × precio) con sus reglas de merma/fracción — no copiar el subtotal.
// Fuente: lab/datos_reales_drive/costeos/*/Explo_MP_BOM.csv (datos reales, commiteados).
// Totales esperados PINNED del workbook real (no se recalculan desde el CSV).
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

function leerBOM(rel) {
  const rows = parseCSV(readFileSync(ROOT + rel, 'utf8'));
  const out = [];
  for (const r of rows) {
    const ai = r.findIndex((c) => /^M[A-Z0-9]{6,}/.test((c || '').trim()));
    if (ai < 0) continue;
    const costo = num(r[ai + 6]); const consumo = num(r[ai + 7]); const linea = num(r[ai + 8]);
    if (costo == null || consumo == null) continue;
    out.push({ articulo: r[ai].trim(), desc: (r[ai + 1] || '').slice(0, 50), costo, consumo, linea: linea ?? costo * consumo });
  }
  return out;
}
function materialMotor(bom) {
  const componentes = []; const insumos = {};
  bom.forEach((l, i) => {
    const id = `${l.articulo}#${i}`;
    insumos[id] = { id, nombre: l.desc, seccion: 'otros', clase: 'directa', unidad: 'Hoja', formato: { tipo: 'hoja', medida: 1 }, fraccion: true, precio: l.costo };
    componentes.push({ nombre: l.desc, insumoId: id, hojas: l.consumo, piezas: 1 });
  });
  return calcular({ componentes }, 1, insumos, PARAMETROS_DEFAULT).materialTotal;
}

// [nombre, ruta BOM commiteada, total material real PINNED, nº líneas con costo]
const CASOS = [
  ['C-CO-517R Exhibidor', 'lab/datos_reales_drive/costeos/CCO517R_Exhibidor/Explo_MP_BOM.csv', 12089.66, 28],
  ['Ejercicio repisa',    'lab/datos_reales_drive/costeos/ejercicio_repisa/Explo_MP_BOM.csv',    156.98,   6],
];

describe('GOLDEN costeos reales de Compras · capa material (motor reproduce consumo×precio)', () => {
  for (const [nombre, rel, totalReal, nLineas] of CASOS) {
    it(`${nombre}: material del motor == $${totalReal} del workbook real`, () => {
      const bom = leerBOM(rel);
      expect(bom.length, 'nº de líneas con costo leídas del BOM').toBe(nLineas);
      const mp = materialMotor(bom);
      // Reproducción exacta salvo redondeo sub-peso del workbook (cada costo_linea a 2 decimales).
      expect(Math.abs(mp - totalReal)).toBeLessThan(0.05);
    });
  }
});
