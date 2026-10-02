// ============================================================================
//  N16 — DIFF DE REVISIONES (puro, sin UI). Compara dos snapshots EMITIDOS de una
//  cotización (Rev1 vs Rev2) y devuelve los cambios de alcance y de dinero, al peso.
//  Rev1 es INMUTABLE: esto no muta nada, sólo describe la diferencia.
//
//  Partida: se identifica por `source_ref` (Línea V2) o, si no hay, por `nombre`.
//  No decide dinero: usa los importes que ya trae el snapshot (que la emisión V2
//  dejó validados contra el precio autorizado). Sólo resta.
// ============================================================================

function claveDe(p) {
  return p.source_ref || p.producto_id || p.nombre || p.piezaId || JSON.stringify(p).slice(0, 40);
}
function importeDe(p) {
  const pu = Number(p.precioUnitario) || 0;
  const c = Number(p.cantidad) || 0;
  return Math.round(pu * c);
}
const n = (x) => Math.round(Number(x) || 0);

/**
 * diffRevisiones(snapA, snapB) → cambios de A (antigua) a B (nueva).
 * Cada snapshot: { partidas:[{nombre,cantidad,precioUnitario,source_ref?}], totales:{...}, total }.
 */
export function diffRevisiones(snapA, snapB) {
  const A = (snapA?.partidas) || [];
  const B = (snapB?.partidas) || [];
  const mapA = new Map(); for (const p of A) mapA.set(claveDe(p), p);
  const mapB = new Map(); for (const p of B) mapB.set(claveDe(p), p);

  const lineas = [];
  // Quitadas o cambiadas (estaban en A)
  for (const [k, pa] of mapA) {
    const pb = mapB.get(k);
    if (!pb) {
      lineas.push({ tipo: 'quitada', nombre: pa.nombre || k, cantidadA: n(pa.cantidad), cantidadB: 0, deltaCantidad: -n(pa.cantidad), deltaImporte: -importeDe(pa) });
    } else {
      const dCant = n(pb.cantidad) - n(pa.cantidad);
      const dImp = importeDe(pb) - importeDe(pa);
      if (dCant !== 0 || dImp !== 0) {
        lineas.push({ tipo: 'cambiada', nombre: pb.nombre || k, cantidadA: n(pa.cantidad), cantidadB: n(pb.cantidad), deltaCantidad: dCant, deltaImporte: dImp });
      }
    }
  }
  // Agregadas (sólo en B)
  for (const [k, pb] of mapB) {
    if (!mapA.has(k)) {
      lineas.push({ tipo: 'agregada', nombre: pb.nombre || k, cantidadA: 0, cantidadB: n(pb.cantidad), deltaCantidad: n(pb.cantidad), deltaImporte: importeDe(pb) });
    }
  }

  const tA = snapA?.totales || {}, tB = snapB?.totales || {};
  const campo = (k) => n(tB[k]) - n(tA[k]);
  return {
    lineas,
    deltas: {
      precioLista: campo('precioLista'),
      descuento: campo('descuento'),
      maniobras: campo('maniobras'),
      flete: campo('flete'),
      iva: campo('iva'),
      total: n(snapB?.total) - n(snapA?.total),
    },
    resumen: {
      lineasAgregadas: lineas.filter((l) => l.tipo === 'agregada').length,
      lineasQuitadas: lineas.filter((l) => l.tipo === 'quitada').length,
      lineasCambiadas: lineas.filter((l) => l.tipo === 'cambiada').length,
    },
  };
}
