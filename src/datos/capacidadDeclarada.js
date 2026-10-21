// VH-112 · CAPACIDAD DECLARADA POR LA PERSONA. "Banca doble APP LT 1.50 · 8 usuarios" dice cuántos
// trabajan ahí; sin `user_capacity` el solver asumía round(6000/1500) = 4 y dejaba 4 WIN sin lugar
// (proyecto real de Dirección, 12-oct). Se lee del nombre: N usuarios/puestos/personas/plazas/lugares;
// si no hay número y es banca "doble", el doble de los módulos de 1.50. No se inventa: sin evidencia → null.
// Módulo sin dependencias: lo usan espacio.js, reconciliarPartidas.js y confirmarPrograma.js.
export function capacidadDeNombre(nombre = '', { w = null, rol = null } = {}) {
  const t = String(nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // "OPEN SPACE 01 (8 PAX)" (plano real, 21-oct): PAX = personas en planos de arquitectura.
  const m = t.match(/(\d+)\s*(usuarios?|puestos?|personas?|plazas?|lugares?|users?|seats?|pax)\b/);
  if (m && Number(m[1]) > 0) return Number(m[1]);
  if (rol === 'ANCHOR_WORKSTATION' && /\b(doble|double)\b/.test(t) && Number(w) > 0) return 2 * Math.max(1, Math.round(Number(w) / 1500));
  return null;
}

// VH-120 · FUENTE de la capacidad (Fase 3 del cierre). Cuatro verdades distintas que antes viajaban mezcladas
// como un solo número:
//   CATALOGO  · la ficha del producto/módulo del programa o del banco (`usuarios`/`user_capacity` de una fila
//               CONFIRMADO_PROGRAMA o `deBanco`).
//   USUARIO   · lo que la persona declaró (campo `usuarios`/`user_capacity` de una fila que ella describió).
//   INFERIDA  · leída del NOMBRE ("8 usuarios", "banca doble"): evidencia más débil, se marca.
//   GEOMETRICA· la calcula el solver con la geometría (una silla cada 600 mm por cara): PRELIMINAR, no es
//               capacidad industrial; nunca se presenta como validación oficial.
// Aquí sólo se resuelven las tres primeras (lo que viaja al solver); la cuarta la declara el solver.
export const FUENTES_CAPACIDAD = ['CATALOGO', 'USUARIO', 'INFERIDA', 'GEOMETRICA'];
export function fuenteCapacidad(p = {}, { w = null, rol = null } = {}) {
  const uc = Number(p.user_capacity), us = Number(p.usuarios);
  if (uc > 0 && FUENTES_CAPACIDAD.includes(p.capacity_source)) return { capacidad: Math.round(uc), fuente: p.capacity_source, evidencia: 'capacity_source' };
  const deCatalogo = p.source === 'CONFIRMADO_PROGRAMA' || p.deBanco === true || p.origen === 'banco';
  if (uc > 0 && !p.user_capacity_inferida) return { capacidad: Math.round(uc), fuente: deCatalogo ? 'CATALOGO' : 'USUARIO', evidencia: 'user_capacity' };
  if (us > 0) return { capacidad: Math.round(us), fuente: deCatalogo ? 'CATALOGO' : 'USUARIO', evidencia: 'usuarios' };
  if (uc > 0) return { capacidad: Math.round(uc), fuente: 'INFERIDA', evidencia: 'user_capacity_inferida' };
  const n = capacidadDeNombre(p.nombre, { w: w ?? p.w, rol });
  if (n) return { capacidad: n, fuente: 'INFERIDA', evidencia: `nombre:${String(p.nombre || '').slice(0, 60)}` };
  return { capacidad: null, fuente: null, evidencia: null };
}
