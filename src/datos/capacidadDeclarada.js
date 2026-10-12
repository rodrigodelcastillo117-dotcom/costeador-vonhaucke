// VH-112 · CAPACIDAD DECLARADA POR LA PERSONA. "Banca doble APP LT 1.50 · 8 usuarios" dice cuántos
// trabajan ahí; sin `user_capacity` el solver asumía round(6000/1500) = 4 y dejaba 4 WIN sin lugar
// (proyecto real de Dirección, 12-oct). Se lee del nombre: N usuarios/puestos/personas/plazas/lugares;
// si no hay número y es banca "doble", el doble de los módulos de 1.50. No se inventa: sin evidencia → null.
// Módulo sin dependencias: lo usan espacio.js, reconciliarPartidas.js y confirmarPrograma.js.
export function capacidadDeNombre(nombre = '', { w = null, rol = null } = {}) {
  const t = String(nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const m = t.match(/(\d+)\s*(usuarios?|puestos?|personas?|plazas?|lugares?|users?|seats?)\b/);
  if (m && Number(m[1]) > 0) return Number(m[1]);
  if (rol === 'ANCHOR_WORKSTATION' && /\b(doble|double)\b/.test(t) && Number(w) > 0) return 2 * Math.max(1, Math.round(Number(w) / 1500));
  return null;
}
