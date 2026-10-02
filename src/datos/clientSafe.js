// ============================================================================
//  WOW — PAYLOAD "PRESENTAR AL CLIENTE" (client-safe por diseño, no por CSS).
//  Construye las 5 etapas (NECESIDAD → DISTRIBUCIÓN → SOLUCIÓN → VISUAL → INVERSIÓN)
//  a partir del estado del proyecto, y pasa TODO por `sinEconomia` para GARANTIZAR
//  0 claves económicas internas aunque la entrada traiga costo/margen/etc.
//  No decide dinero: usa precios de venta ya resueltos por el servidor.
// ============================================================================
import { sinEconomia } from './economia.js';

export function construirPresentacionCliente(datos) {
  const d = datos || {};
  const inv = d.inversion || {};
  const recon = d.reconciliacion || {};
  const payload = {
    necesidad: {
      resumen: d.brief?.resumen ?? null,
      zonas: (d.zonas || []).map((z) => ({ nombre: z.nombre, cantidad: z.cantidad ?? null })),
      preguntasPendientes: d.brief?.preguntasPendientes || [],
    },
    distribucion: {
      plano: d.plano?.url ?? null,
      zonas: (recon.zonas || []).map((z) => ({
        nombre: z.nombre, requerido: z.requerido ?? null, cotizado: z.cotizado ?? null,
        acomodado: z.acomodado ?? null, estado: z.estado ?? null,
      })),
      discrepancias: (recon.zonas || []).filter((z) => z.estado && z.estado !== 'ok')
        .map((z) => ({ nombre: z.nombre, falta: (z.requerido ?? 0) - (z.acomodado ?? 0) })),
    },
    solucion: {
      productos: (d.partidas || []).map((p) => ({
        nombre: p.nombre, cantidad: p.cantidad ?? null,
        acabado: p.acabado ?? p.config?.finish ?? null,
        imagen: p.render ?? p.imagen ?? null,
        precioUnitario: p.precioUnitario ?? null,
        porque: p.porque ?? p.nota ?? null,
      })),
    },
    visual: {
      renders: (d.renders || []).map((r) => ({ tipo: r.tipo ?? null, url: r.url ?? null, estado: r.estado ?? null })),
    },
    inversion: {
      presupuesto: inv.presupuesto ?? null,
      propuesta: inv.total ?? null,
      delta: (inv.presupuesto != null && inv.total != null) ? (inv.total - inv.presupuesto) : null,
      escenarios: (d.escenarios || []).map((e) => ({ nombre: e.nombre, tipo: e.tipo, total: e.total ?? null, seleccionado: !!e.seleccionado })),
    },
  };
  // GARANTÍA DURA: 0 claves económicas internas, venga lo que venga en la entrada.
  return sinEconomia(payload);
}
