// AUDITORÍA DE UNIDADES: recorre TODOS los generadores × TODOS los productos ×
// varias medidas, y para cada insumo anota CÓMO lo consume el despiece:
//   - 'area'  -> el componente trae largoMM y anchoMM  => netoComponente da m2
//   - 'cant'  -> el componente trae cantidad           => netoComponente da "lo que sea"
// Luego compara contra la UNIDAD declarada del insumo y su FORMATO.
// La regla de oro: si el formato está en kg (lámina) y el despiece manda m2,
// el error es de 10x y no se ve.
import { LINEAS_REG, configDesde } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';

const INS = mapaInsumos(INSUMOS_SEMILLA);
const uso = {};   // insumoId -> { area:Set(ejemplos), cant:Set(ejemplos) }

function variantes(p) {
  const out = [{}];
  if (p.largos?.length) for (const L of p.largos) out.push({ largoMM: L });
  if (p.fondos?.length > 1) for (const F of p.fondos) out.push({ fondoMM: F });
  if (p.diametros?.length) for (const D of p.diametros) out.push({ diametroMM: D });
  if (p.usuarios?.length) for (const U of p.usuarios) out.push({ usuarios: U });
  if (p.biombo) for (const b of ['cristal', 'melamina', 'pet']) out.push({ biombo: b });
  for (const s of p.selects || []) for (const o of s.opciones) out.push({ [s.key]: o.id });
  for (const c of p.checks || []) out.push({ [c.key]: true });
  return out;
}

let combos = 0;
for (const [ruta, L] of Object.entries(LINEAS_REG)) {
  for (const p of L.productos || []) {
    for (const v of variantes(p)) {
      let g; try { g = L.generar(configDesde(p, v)); } catch { continue; }
      combos++;
      for (const c of g.componentes || []) {
        const id = c.insumoId;
        if (!id) continue;
        if (!uso[id]) uso[id] = { area: new Map(), cant: new Map() };
        const modo = (c.largoMM && c.anchoMM) ? 'area' : 'cant';
        const k = `${ruta}.${p.id}`;
        if (!uso[id][modo].has(k)) uso[id][modo].set(k, `${c.nombre} [${modo === 'area' ? `${c.largoMM}x${c.anchoMM}` : `cant=${c.cantidad}`}]`);
      }
    }
  }
}

console.log(`Combinaciones costeadas: ${combos}\n`);

// --- 1. insumos usados que NO EXISTEN en el catálogo -------------------------
const fantasmas = Object.keys(uso).filter((id) => !INS[id]);
if (fantasmas.length) {
  console.log('### ✗ INSUMOS FANTASMA (el despiece los pide, el catálogo no los tiene → material = $0)');
  for (const id of fantasmas) {
    const ej = [...uso[id].area.values(), ...uso[id].cant.values()][0];
    const dnd = [...uso[id].area.keys(), ...uso[id].cant.keys()];
    console.log(`   · ${id.padEnd(24)} ${dnd.length} producto(s): ${dnd.slice(0, 5).join(', ')}${dnd.length > 5 ? ' …' : ''}`);
    console.log(`     ej: ${ej}`);
  }
  console.log();
}

// --- 2. choque de unidad -----------------------------------------------------
console.log('### CHOQUE DE UNIDAD (cómo lo declara el insumo vs cómo lo consume el despiece)');
const AREA_OK = new Set(['m2', 'hoja']);       // hoja SOLO si el formato mide m2
for (const [id, u] of Object.entries(uso)) {
  const i = INS[id]; if (!i) continue;
  const usaArea = u.area.size > 0, usaCant = u.cant.size > 0;
  const fmt = i.formato;
  const fmtEnM2 = fmt && fmt.tipo === 'tablero';
  const fmtEnKg = fmt && fmt.tipo === 'lamina';
  const fmtLineal = fmt && (fmt.tipo === 'tramo' || fmt.tipo === 'rollo');
  const problemas = [];
  if (usaArea && fmtEnKg) problemas.push('formato en KG pero el despiece manda m2');
  if (usaArea && fmtLineal) problemas.push('formato LINEAL (m) pero el despiece manda m2');
  if (usaArea && i.unidad === 'pza') problemas.push("unidad 'pza' pero el despiece manda m2");
  if (usaArea && i.unidad === 'm' && !fmt) problemas.push("unidad 'm' pero el despiece manda m2");
  if (usaArea && i.unidad === 'kg') problemas.push("unidad 'kg' pero el despiece manda m2");
  if (usaCant && fmtEnM2 && !usaArea) problemas.push("tablero (m2) alimentado por 'cantidad' — verificar que la cantidad esté en m2");
  if (usaCant && fmtEnKg) problemas.push("lámina (kg) alimentada por 'cantidad' — verificar que la cantidad esté en KG");
  if (problemas.length) {
    console.log(`\n  ✗ ${id}  (${i.nombre})`);
    console.log(`     unidad='${i.unidad}' formato=${fmt ? `${fmt.tipo}/${fmt.medida}` : 'ninguno'} fraccion=${!!i.fraccion} precio=${i.precio}`);
    for (const p of problemas) console.log(`     → ${p}`);
    if (usaArea) console.log(`     usado como ÁREA en: ${[...u.area.keys()].slice(0, 6).join(', ')}`);
    if (usaCant) console.log(`     usado como CANT  en: ${[...u.cant.keys()].slice(0, 6).join(', ')}`);
    const ej = [...u.area.values(), ...u.cant.values()].slice(0, 3);
    for (const e of ej) console.log(`        ej: ${e}`);
  }
}

// --- 3. insumos del catálogo que NADIE usa ----------------------------------
const huerfanos = INSUMOS_SEMILLA.filter((i) => !uso[i.id]).map((i) => i.id);
console.log(`\n### insumos del catálogo que ningún generador usa: ${huerfanos.length}/${INSUMOS_SEMILLA.length}`);
console.log('   ' + huerfanos.join(', '));

// --- 4. tabla mixta: mismo insumo consumido de las DOS formas ---------------
console.log('\n### MISMO INSUMO CONSUMIDO DE LAS DOS FORMAS (área y cantidad)');
for (const [id, u] of Object.entries(uso)) {
  if (u.area.size && u.cant.size) {
    const i = INS[id];
    console.log(`   · ${id.padEnd(22)} unidad='${i?.unidad}' fmt=${i?.formato?.tipo || '-'}  área:${u.area.size} prod · cant:${u.cant.size} prod`);
    console.log(`       área ej: ${[...u.area.values()][0]}`);
    console.log(`       cant ej: ${[...u.cant.values()][0]}`);
  }
}
