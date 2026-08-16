// ============================================================================
//  Construye un "costeo" a partir de una linea + mueble del catalogo.
//  Compartido por el Catalogo (modo avanzado) y el Asistente (modo facil),
//  para que los dos armen la pieza igual.
// ============================================================================
import { PIEZAS_SEMILLA } from './datos/piezas.js';
import { recetaBench } from './datos/bench.js';
import { REGLAS_LINEA, MUEBLES } from './datos/catalogo.js';
import { idNuevo } from './util.js';

export function recetaDe(lineaId, muebleId) {
  return PIEZAS_SEMILLA.find((p) => p.linea === lineaId && p.mueble === muebleId);
}

function aplicarReglas(componentes, lineaId, insumos) {
  const regla = REGLAS_LINEA[lineaId];
  if (!regla) return componentes.map((c) => ({ ...c }));
  let comps = componentes.map((c) => ({ ...c }));
  if (regla.quita) comps = comps.filter((c) => !regla.quita.includes(c.insumoId));
  if (regla.sustituye) {
    comps = comps.map((c) => (regla.sustituye[c.insumoId] ? { ...c, insumoId: regla.sustituye[c.insumoId] } : c));
  }
  if (regla.agrega) {
    for (const id of regla.agrega) {
      if (!comps.some((c) => c.insumoId === id)) {
        comps.push({ insumoId: id, nombre: insumos[id]?.nombre || id, cantidad: 1 });
      }
    }
  }
  return comps;
}

const BASE = {
  piezaId: null, nombre: '', linea: null, piezas: 1, componentes: [],
  modoManoObra: 'porcentaje', horas: { pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0 },
  factorDirecta: 55, factorIndirecta: 12, preparacionHoras: 0, margen: 50,
};

// Devuelve un objeto costeo listo para el Costeador o el Asistente.
export function construirCosteo(linea, muebleId, estado) {
  if (muebleId === 'bench') {
    const bench = { personas: 4, lineaId: linea.id, divisor: 'divisor-melamina', faldon: false };
    const b = recetaBench(bench);
    return {
      ...BASE, piezaId: idNuevo('bench'), nombre: `${linea.nombre} — Bench ${b.personas} usuarios`,
      linea: linea.nombre, bench, benchDescripcion: b.descripcion,
      componentes: b.componentes, modoManoObra: 'horas', horas: b.horas,
    };
  }
  const receta = recetaDe(linea.id, muebleId);
  if (receta) {
    return {
      ...BASE, piezaId: receta.id, nombre: receta.nombre, linea: linea.nombre,
      componentes: aplicarReglas(receta.componentes, linea.id, estado.insumos),
      modoManoObra: receta.modoManoObra || 'horas', horas: { ...(receta.horas || {}) },
      factorDirecta: receta.factorDirecta ?? 55, factorIndirecta: receta.factorIndirecta ?? 12,
      preparacionHoras: receta.preparacionHoras || 0,
    };
  }
  // Sin receta: arranca en blanco con nombre y linea puestos
  return { ...BASE, piezaId: idNuevo('pieza'), nombre: `${linea.nombre} — ${MUEBLES[muebleId]}`, linea: linea.nombre };
}
