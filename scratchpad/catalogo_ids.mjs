// Vuelca el catálogo de generadores: ruta, id de producto y qué opciones acepta.
// Es el diccionario contra el que hay que mapear los renglones de los presupuestos.
import { LINEAS_REG } from '../src/datos/lineas.js';
const out = {};
for (const [ruta, L] of Object.entries(LINEAS_REG)) {
  out[ruta] = {
    titulo: L.titulo,
    productos: (L.productos || []).map((p) => ({
      id: p.id, nombre: p.nombre || p.label || p.titulo || null,
      largos: p.largos || null, fondos: p.fondos || null, diametros: p.diametros || null,
      usuarios: p.usuarios || null, largosLateral: p.largosLateral || null,
      selects: (p.selects || []).map((s) => ({ key: s.key, opciones: s.opciones.map((o) => o.id) })),
      checks: (p.checks || []).map((c) => c.key),
      modeloCosteo: p.modeloCosteo || null,
    })),
  };
}
console.log(JSON.stringify(out, null, 1));
