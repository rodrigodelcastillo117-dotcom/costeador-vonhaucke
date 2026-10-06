// Firma visual canónica compartida por modelo 3D, render y snapshot.
// Sólo incluye lo que cambia la identidad VISUAL/TÉCNICA del producto.
import { hashEstable } from './cocrear.js';

export function visualRevisionPayload(spec = {}) {
  return {
    familia: spec.familia || null,
    dimensiones: spec.dimensiones || {},
    materiales: spec.materiales || [],
    acabados: spec.acabados || [],
    caracteristicas: [...(spec.caracteristicas || [])].sort(),
    capacidad: spec.capacidad || null,
    dna: spec.dna ? {
      tono: spec.dna.tono || null,
      nivel: spec.dna.nivel || null,
      forma: spec.dna.forma || null,
      estilo: spec.dna.estilo || null,
    } : null,
    componentes: (spec.componentes || []).map((c) => ({
      id: c.graph_node_id || c.id || null,
      nombre: c.nombre || null,
      insumoId: c.insumoId || null,
      semantic_role: c.semantic_role || null,
      largoMM: c.largoMM ?? null,
      anchoMM: c.anchoMM ?? null,
      espesorMM: c.espesorMM ?? c.thicknessMM ?? null,
      altoMM: c.altoMM ?? null,
      piezas: c.piezas ?? c.cantidad ?? null,
      material: c.material || null,
      acabado: c.acabado || null,
    })),
  };
}

export function visualRevisionHash(spec = {}) {
  return hashEstable(visualRevisionPayload(spec));
}

export function visualesSincronizados({ spec, render = null, model3d = null } = {}) {
  const current = visualRevisionHash(spec || {});
  return {
    current,
    render_ok: !render || render.visualRevisionHash === current,
    model_ok: !model3d || model3d.visualRevisionHash === current,
    synchronized: (!render || render.visualRevisionHash === current)
      && (!model3d || model3d.visualRevisionHash === current),
  };
}
