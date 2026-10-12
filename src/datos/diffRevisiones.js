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
const numKnown = (x) => x != null && x !== '' && Number.isFinite(Number(x)) ? Number(x) : null;
function importeDe(p) {
  const pu = numKnown(p?.precioUnitario);
  const c = numKnown(p?.cantidad);
  return pu == null || c == null ? null : Math.round((pu * c + Number.EPSILON) * 100) / 100;
}
const n = (x) => {
  const v = numKnown(x);
  return v == null ? null : v;
};
const deltaKnown = (b,a) => {
  const B=n(b), A=n(a);
  return B == null || A == null ? null : Math.round(((B-A)+Number.EPSILON)*100)/100;
};

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
      const impA=importeDe(pa), cantA=n(pa.cantidad);
      lineas.push({
        tipo:'quitada', nombre:pa.nombre||k, cantidadA:cantA, cantidadB:0,
        deltaCantidad:cantA==null?null:-cantA,
        deltaImporte:impA==null?null:-impA,
      });
    } else {
      const dCant = deltaKnown(pb.cantidad, pa.cantidad);
      const impA=importeDe(pa), impB=importeDe(pb);
      const dImp = impA==null || impB==null ? null : Math.round(((impB-impA)+Number.EPSILON)*100)/100;
      if (dCant !== 0 || dImp !== 0 || dCant == null || dImp == null) {
        lineas.push({ tipo: 'cambiada', nombre: pb.nombre || k, cantidadA: n(pa.cantidad), cantidadB: n(pb.cantidad), deltaCantidad: dCant, deltaImporte: dImp });
      }
    }
  }
  // Agregadas (sólo en B)
  for (const [k, pb] of mapB) {
    if (!mapA.has(k)) {
      lineas.push({
        tipo:'agregada', nombre:pb.nombre||k, cantidadA:0, cantidadB:n(pb.cantidad),
        deltaCantidad:n(pb.cantidad), deltaImporte:importeDe(pb),
      });
    }
  }

  const tA = snapA?.totales || {}, tB = snapB?.totales || {};
  const campo = (k) => deltaKnown(tB[k],tA[k]);
  return {
    lineas,
    deltas: {
      precioLista: campo('precioLista'),
      descuento: campo('descuento'),
      maniobras: campo('maniobras'),
      flete: campo('flete'),
      iva: campo('iva'),
      total: deltaKnown(snapB?.total,snapA?.total),
    },
    incompleto: lineas.some((l)=>l.deltaCantidad==null||l.deltaImporte==null)
      || Object.values({
        precioLista:campo('precioLista'),descuento:campo('descuento'),
        maniobras:campo('maniobras'),flete:campo('flete'),iva:campo('iva'),
        total:deltaKnown(snapB?.total,snapA?.total),
      }).some((v)=>v==null),
    resumen: {
      lineasAgregadas: lineas.filter((l) => l.tipo === 'agregada').length,
      lineasQuitadas: lineas.filter((l) => l.tipo === 'quitada').length,
      lineasCambiadas: lineas.filter((l) => l.tipo === 'cambiada').length,
    },
  };
}
