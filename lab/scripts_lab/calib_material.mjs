// Arnés de calibración (solo lectura del motor; no modifica nada).
// Reproduce el COSTO DE MATERIAL de cada BOM real con calcular() y muestra el
// desglose de fabricación (MP / MO / indirecto) que produce la fórmula de Alba.
// Objetivo: ver si el motor reproduce los totales reales al centavo y qué
// estructura (MP%) arroja, para compararla con VENTO MASTER (68.7%) y EEFF (~64%).
import { calcular, PARAMETROS_DEFAULT } from '../../src/motor/calculo.js';
import { readFileSync } from 'node:fs';

// --- mini parser CSV (maneja comillas dobles escapadas "") ---
function parseCSV(txt) {
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i+1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c === '\r') { /* skip */ }
      else f += c;
    }
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const num = (s) => { const n = Number(String(s ?? '').replace(/,/g, '').trim()); return Number.isFinite(n) ? n : null; };

// Lee un BOM (articulo,descripcion,opcion,...,unidad,fecha,costo,consumo,costo_linea)
// y devuelve líneas con costo+consumo numéricos (ignora cabeceras repetidas y vacíos).
function leerBOM(path) {
  const rows = parseCSV(readFileSync(path, 'utf8'));
  const out = [];
  for (const r of rows) {
    // la clave ERP puede estar en col 0 (BOM limpio) o en una col interior (dump crudo)
    const ai = r.findIndex((c) => /^M[A-Z0-9]{6,}/.test((c || '').trim()));
    if (ai < 0) continue;
    const art = r[ai].trim();
    const costo = num(r[ai+6]); const consumo = num(r[ai+7]); const linea = num(r[ai+8]);
    if (costo == null || consumo == null) continue;
    out.push({ articulo: art, desc: (r[ai+1]||'').slice(0,50), unidad: (r[ai+4]||'').trim(), costo, consumo, linea: linea ?? costo*consumo });
  }
  return out;
}

// clasificación de sección para la fórmula de Alba (MO% por tipo de material)
function seccionDe(desc) {
  const d = desc.toUpperCase();
  if (/LOGO|IMPRES|KIT DE ILUMIN|LED|VINIL|GRAFIC/.test(d)) return 'graficos';
  if (/ACRILICO|CRISTAL|VIDRIO/.test(d)) return 'cristal';
  if (/LAMINA|TUBULAR|ACERO|PTR|SOLERA|PERFIL DE ALUM|NIVELADOR|TORNILLO|TUERCA|PIJA|TAQUETE|PERNO|MINIFIX|PULIDO/.test(d)) return 'metal';
  if (/MDF|MELAMINA|LAMINADO|CHAPA|TABLERO|TRIPLAY|PERFIL DE CANTO|CANTO/.test(d)) return 'cubierta';
  if (/PINTURA/.test(d)) return 'pintura';
  return 'otros';
}

// Construye la pieza para el motor: cada línea = fracción-directa (hojas=consumo)
// sobre un insumo con formato (medida 1) y precio = costo última compra. Esto
// reproduce precio×consumo SIN merma extra (la merma ya está en el consumo real).
function piezaDeBOM(bom) {
  const componentes = []; const insumos = {};
  bom.forEach((l, i) => {
    const id = `${l.articulo}#${i}`;
    insumos[id] = { id, nombre: l.desc, seccion: seccionDe(l.desc), clase: 'directa',
                    unidad: 'Hoja', formato: { tipo: 'hoja', medida: 1 }, fraccion: true, precio: l.costo };
    componentes.push({ nombre: l.desc, insumoId: id, hojas: l.consumo, piezas: 1 });
  });
  return { pieza: { componentes }, insumos };
}

const COSTEOS = [
  ['C-CO-517R Exhibidor', 'lab/datos_reales_drive/costeos/CCO517R_Exhibidor/Explo_MP_BOM.csv', 12089.66],
  ['Ejercicio repisa',    'lab/datos_reales_drive/costeos/ejercicio_repisa/Explo_MP_BOM.csv',    156.98],
  ['VENTO C-CO-526R',     'lab/precios_vento/C-CO-526R__Explo_MP.csv',                           42653.27],
  ['TELCEL explo_x_id',   'lab/datos_reales_drive/costeos/CCO320R_DATS_TELCEL/explo_x_id_BOM.csv', 47432.84],
];

const base = '/home/user/costeador-vonhaucke/';
for (const [nombre, rel, real] of COSTEOS) {
  let bom;
  try { bom = leerBOM(base + rel); } catch (e) { console.log(`\n### ${nombre}\n  ERROR leyendo ${rel}: ${e.message}`); continue; }
  const sumLinea = bom.reduce((a, l) => a + l.linea, 0);
  const { pieza, insumos } = piezaDeBOM(bom);
  const r = calcular(pieza, 1, insumos, PARAMETROS_DEFAULT);
  const mp = r.materialTotal, mo = r.manoObra, gi = r.indirectosFabrica ?? r.indirectos ?? 0;
  const fab = r.costoFabricacion ?? (mp + mo + gi);
  console.log(`\n### ${nombre}`);
  console.log(`  líneas con costo      : ${bom.length}`);
  console.log(`  Σ costo_linea (real)  : ${sumLinea.toFixed(2)}${real != null ? `   [target doc: ${real}]` : ''}`);
  console.log(`  material motor (repro) : ${mp.toFixed(2)}   delta vs Σ: ${(mp - sumLinea).toFixed(2)}`);
  console.log(`  MO (Alba)             : ${mo.toFixed(2)}`);
  console.log(`  indirecto fábrica     : ${Number(gi).toFixed(2)}`);
  console.log(`  costo fabricación     : ${Number(fab).toFixed(2)}`);
  console.log(`  MP % de fabricación   : ${fab > 0 ? (mp / fab * 100).toFixed(1) : '—'} %   (VENTO real 68.7%, EEFF ~64%)`);
  console.log(`  campos devueltos      : ${Object.keys(r).join(', ')}`);
}
