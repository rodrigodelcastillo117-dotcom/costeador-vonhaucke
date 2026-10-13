// ============================================================================
//  PROPUESTA DE LA IA → COMPONENTES DEL BOM (una sola fuente para Costear y Costeador).
//  Antes vivía duplicado en AsistenteEspecial.jsx y Costeador.jsx.
//  · Política de material (aplicarPoliticaMaterial): nunca sustituye en silencio.
//  · Piezas de ÁREA: largo × ancho × piezas. La fracción de hoja que estima la IA (`hojas`) se
//    conserva como `iaHojas` para enseñarla, pero en TABLERO la hoja la decide el MOTOR
//    (rejilla + regla A14 de Producción): la IA sólo calculaba área/hoja sin nesteo y
//    quedaba corta. En LÁMINA irregular la fracción directa de la IA sigue mandando (Rafa §1).
//  · Piezas LINEALES: `cantidad` son metros; `forma` viaja para las reglas de casa.
// ============================================================================
import { aplicarPoliticaMaterial, MATCH } from './materialMatch.js';

// ESPEJO DE P0.12 (VH-157): el servidor (costear-servidor, origenSpecConfiable=false) degrada todo
// EXACT que viene de una spec del cliente sin confirmación humana a "por confirmar" y NO emite.
// El navegador debe decir lo MISMO: si aquí quedara EXACT/emitible, el precio en pantalla y el del
// servidor divergen (el cliente mostraba $4,410.57 emitible y el servidor 'incompleto'). Un EXACT
// que la IA eligió del catálogo curado es una propuesta hasta que una persona lo confirme.
export function espejoP012(comp) {
  if (!comp || comp.material_match !== MATCH.EXACT || comp.material_confirmado === true) return comp;
  const motivo = 'Coincidencia exacta PROPUESTA por la IA (sin confirmación humana). Requiere confirmación antes de emitir; el servidor aplica la misma regla.';
  return { ...comp, material_match: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED,
    _match: { ...(comp._match || {}), clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, autollenado: true, autocosteable: true, candidate_insumo_id: comp.insumoId, motivo } };
}

export function mapIaComps(p, insumos = {}) {
  const resolver = (id) => insumos[id];
  const catalogo = Object.values(insumos || {});
  return (p?.piezas || []).map((z) => {
    const base = espejoP012(aplicarPoliticaMaterial({ ...z, material_solicitado: z.material_solicitado || z.nombre }, resolver, catalogo));
    base.forma = z.forma || (z.largoMM && z.anchoMM ? 'area' : 'pieza');
    if (base.forma === 'area') {
      base.largoMM = z.largoMM || 0; base.anchoMM = z.anchoMM || 0; base.piezas = z.cantidad || 1; base.cantidad = 1;
      if (z.hojas > 0) {
        base.iaHojas = z.hojas;
        const ins = base.insumoId ? resolver(base.insumoId) : null;
        const esTablero = !!ins && ins.formato && ins.formato.tipo === 'tablero' && base.largoMM > 0 && base.anchoMM > 0;
        if (!esTablero) base.hojas = z.hojas;   // lámina irregular / sin geometría: fracción directa
      }
    }
    return base;
  });
}
