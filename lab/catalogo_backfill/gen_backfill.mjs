#!/usr/bin/env node
// ============================================================================
//  GENERADOR DETERMINISTA del backfill de atributos del catálogo (espesor_mm, familia).
//
//  Por qué: en producción, de 11,294 insumos, `espesor_mm`/`calibre`/`material` están
//  100% VACÍOS y la familia 'cristal' está CONTAMINADA con herrajes ("BISAGRA PARA
//  CRISTAL…"). El espesor vive sólo en el texto del nombre. Esto deja medio ciego al
//  motor y al proponedor de alternativas.
//
//  Qué hace: reusa la MISMA taxonomía del motor (familiaDeMaterial, espesoresDe) —cero
//  drift— y emite UPDATEs SÓLO donde el nombre lo dice con confianza. NO inventa y NO
//  toca producción por sí mismo: escribe un .sql que una persona REVISA y aplica con
//  respaldo (ver RUNBOOK.md, §100: no se aplica a prod sin OK de Dirección).
//
//  Candados anti-dato-falso:
//   · espesor_mm SÓLO para familias donde el espesor es del PROPIO material (tablero,
//     cristal, acrílico, metal…), nunca para herrajes/acabados.
//   · si el nombre dice "PARA CRISTAL/VIDRIO", el mm es del vidrio que sujeta, no suyo → NO.
//   · un RANGO ("de 6 a 10 mm") o VARIOS espesores ≤60 → ambiguo → NO (no se adivina).
//   · familia: se LLENA si está vacía; sólo se RECLASIFICA cuando la correcta es
//     herraje/acabado y la guardada era de material (arregla la contaminación). No se
//     voltea entre familias de material (eso sería ruido, no un arreglo seguro).
// ============================================================================
import { familiaDeMaterial, espesoresDe, FAMILIAS_HERRAJE, FAMILIAS_ACABADO } from '../../src/datos/materialMatch.js';

// Familias donde `espesor_mm` ES el espesor del PROPIO material.
export const MATERIAL_CON_ESPESOR = new Set([
  'melamina', 'mdf', 'laminado_hpl', 'chapa_madera', 'madera_solida',
  'cristal', 'acrilico', 'policarbonato', 'pet_acustico', 'termoformado',
  'metal_lamina', 'acero_inoxidable', 'aluminio',
]);
const RANGO = /\d+(?:[.,]\d+)?\s*(?:a|-|–|~)\s*\d+(?:[.,]\d+)?\s*mm/i; // "6 a 10 mm"
const PARA_VIDRIO = /\bpara\s+(?:cristal|vidrio)\b/i;

/** Cambios confiables para una fila {id, nombre, espesor_mm, familia}. */
export function calcularBackfill(fila = {}) {
  const nombre = String(fila.nombre || '');
  const famCalc = familiaDeMaterial(nombre);
  const cambios = {};

  const famAct = String(fila.familia || '').trim();
  if (famCalc) {
    const correctaEsHerrajeAcabado = FAMILIAS_HERRAJE.has(famCalc) || FAMILIAS_ACABADO.has(famCalc);
    const actualEsMaterial = !!famAct && !FAMILIAS_HERRAJE.has(famAct) && !FAMILIAS_ACABADO.has(famAct);
    if (!famAct) cambios.familia = famCalc;                                   // llenar vacío
    else if (famCalc !== famAct && correctaEsHerrajeAcabado && actualEsMaterial) cambios.familia = famCalc; // des-contaminar
  }

  if (fila.espesor_mm == null && MATERIAL_CON_ESPESOR.has(famCalc) && !RANGO.test(nombre) && !PARA_VIDRIO.test(nombre)) {
    const esp = espesoresDe(nombre).filter((x) => x > 0 && x <= 60);
    if (esp.length === 1) cambios.espesor_mm = esp[0];
  }

  return { id: fila.id, cambios };
}

const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Genera el .sql y un resumen a partir de un arreglo de filas. */
export function generarSql(filas = []) {
  const ups = [];
  let nFam = 0, nEsp = 0;
  for (const f of filas) {
    const { id, cambios } = calcularBackfill(f);
    const sets = [];
    if ('familia' in cambios) { sets.push(`familia = ${sqlStr(cambios.familia)}`); nFam++; }
    if ('espesor_mm' in cambios) { sets.push(`espesor_mm = ${cambios.espesor_mm}`); nEsp++; }
    if (sets.length) ups.push(`UPDATE insumos_catalogo SET ${sets.join(', ')} WHERE id = ${sqlStr(id)};`);
  }
  return { sql: ups.join('\n'), nFilas: ups.length, nFam, nEsp };
}

// CLI:  node gen_backfill.mjs catalogo.json > backfill.sql   (catalogo.json: [{id,nombre,espesor_mm,familia}])
if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const ruta = process.argv[2];
  if (!ruta) { console.error('uso: node gen_backfill.mjs catalogo.json > backfill.sql'); process.exit(1); }
  const filas = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const { sql, nFilas, nFam, nEsp } = generarSql(filas);
  process.stderr.write(`-- backfill: ${nFilas} UPDATE(s) · ${nFam} familia · ${nEsp} espesor_mm · de ${filas.length} filas\n`);
  process.stdout.write(sql + (sql ? '\n' : ''));
}
