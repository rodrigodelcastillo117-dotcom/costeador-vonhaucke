// ============================================================================
//  Construye el CATÁLOGO CANÓNICO para el batch de renders.
//  Para cada producto con foto de catálogo: corre su generador con una config
//  representativa (misma ruta que usa CosteadorLinea) y saca nombre real,
//  huella (w×d en mm), alto por tipo y materiales del despiece.
//  Salida: scratchpad/catalogo_render.json
// ============================================================================
import { writeFileSync } from 'node:fs';
import { LINEAS_REG, configDesde, footprintDe } from '../src/datos/lineas.js';
import { IMAGENES, imagenProducto } from '../src/datos/imagenes.js';
import { tipoDe, altoTipo, huellaReal, HUELLA, enderezarAlto } from '../src/datos/espacio.js';
import { INSUMOS_SEMILLA } from '../src/datos/insumos.js';

const INS = Object.fromEntries(INSUMOS_SEMILLA.map((i) => [i.id, i]));

// Config representativa: medida de en medio (la que más se vende), primer
// acabado/variante de cada select. Es la misma que abre CosteadorLinea.
function configRepresentativa(prod) {
  const medio = (arr) => arr[Math.min(1, arr.length - 1)];
  const sel = {};
  if (prod.largos) sel.largoMM = medio(prod.largos);
  if (prod.fondos) sel.fondoMM = prod.fondos[0];
  if (prod.diametros) sel.diametroMM = medio(prod.diametros);
  if (prod.usuarios) sel.usuarios = prod.usuarios[0];
  if (prod.largosLateral) sel.largoLateralMM = prod.largosLateral[0];
  for (const s of prod.selects || []) sel[s.key] = s.opciones[0].id;
  return configDesde(prod, sel);
}

// Materiales legibles a partir del despiece (para el prompt y para la ficha).
function materialesDe(componentes) {
  const vistos = new Map();
  for (const c of componentes || []) {
    const ins = INS[c.insumoId];
    if (!ins) continue;
    vistos.set(ins.id, (vistos.get(ins.id) || 0) + (c.cantidad || 0));
  }
  return [...vistos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => INS[id].nombre);
}

const mm = (v) => (v / 1000).toFixed(2).replace(/\.00$/, '.0') + ' m';

const items = [];
const fallas = [];
for (const [ruta, L] of Object.entries(LINEAS_REG)) {
  const conFoto = IMAGENES[ruta] || {};
  for (const prodId of Object.keys(conFoto)) {
    const prod = L.productos.find((p) => p.id === prodId);
    if (!prod) { fallas.push(`${ruta}/${prodId}: no está en el generador`); continue; }
    let g;
    try { g = L.generar(configRepresentativa(prod)); }
    catch (e) { fallas.push(`${ruta}/${prodId}: ${e.message}`); continue; }
    const fp = footprintDe(g.componentes);
    const tipo = tipoDe({ ruta, nombre: g.nombre });
    const alto = altoTipo(tipo);
    const materiales = materialesDe(g.componentes);

    // Medida final, en el mismo orden de prioridad que usa el acomodo:
    // 1) huella del despiece; 2) medida escrita en el nombre "(0.60×0.60 m)";
    // 3) huella estándar del tipo. Luego el bloque real (bench de N puestos).
    let w = fp.w, d = fp.d, origen = 'despiece';
    if (!w || !d) {
      const m = /\((\d+[.,]?\d*)\s*[×x]\s*(\d+[.,]?\d*)\s*m\)/i.exec(g.nombre);
      if (m) { w = Math.round(parseFloat(m[1].replace(',', '.')) * 1000); d = Math.round(parseFloat(m[2].replace(',', '.')) * 1000); origen = 'nombre'; }
      else { [w, d] = HUELLA[tipo] || HUELLA.mueble; origen = 'estandar'; }
    }
    // Guarda/mampara alta: el panel de pie da ancho × ALTURA. Se endereza y la
    // altura real del mueble gana a la altura estándar del tipo.
    let altoReal = alto;
    if (tipo === 'guarda' || tipo === 'mampara') {
      const e = enderezarAlto(w, d, tipo);
      w = e.w; d = e.d;
      if (e.alto) altoReal = e.alto;
    }
    const [bw, bd] = huellaReal(g.nombre, w, d, tipo);
    const bloque = bw !== w || bd !== d;

    items.push({
      ruta, prodId, linea: L.titulo,
      nombre: g.nombre,
      producto: prod.nombre,
      w: bw, d: bd, alto: altoReal, tipo, origenMedida: origen, esBloque: bloque,
      medidas: `${mm(bw)} de largo × ${mm(bd)} de fondo × ${mm(altoReal)} de alto`,
      materiales,
      foto: imagenProducto(ruta, prodId),
    });
  }
}

items.sort((a, b) => (a.ruta + a.prodId).localeCompare(b.ruta + b.prodId));
writeFileSync('scratchpad/catalogo_render.json', JSON.stringify({ total: items.length, fallas, items }, null, 1));
console.log("productos:", items.length, "| origen:", JSON.stringify(items.reduce((a,i)=>(a[i.origenMedida]=(a[i.origenMedida]||0)+1,a),{})), "| bloques:", items.filter(i=>i.esBloque).length, "| fallas:", fallas.length);
for (const f of fallas) console.log('  ⚠', f);
