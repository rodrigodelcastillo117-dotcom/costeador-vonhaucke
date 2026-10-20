// ============================================================================
//  Cierre ChatGPT (PDF): una silla cuyo modelo de catálogo se llama "de visita" (CONCERTO) pero que se usa en la
//  sala de juntas se presenta al cliente con su USO: "Silla CONCERTO · Sala de Consejo". El modelo oficial se
//  conserva; sólo se quita la palabra "visita" que contradice su función confirmada. Nada más cambia de nombre.
// ============================================================================
import { inferRole } from './confirmarPrograma.js';

const MENORES = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y']);
const titulo = (s) => String(s || '').toLowerCase().split(/\s+/).map((w, i) => (i > 0 && MENORES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

export function nombreConUso(pt = {}) {
  const nombre = String(pt?.nombre || '');
  if (!/visita/i.test(nombre)) return nombre;
  if (inferRole(pt) !== 'MEETING_SEAT') return nombre;
  const limpio = nombre
    .replace(/\s*\((?:visita|de visita)[^)]*\)/i, '')
    .replace(/\bde visita\b\s*·?\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/·\s*$/, '')
    .trim();
  const zona = pt.zone_id ? titulo(pt.zone_id) : 'Sala de juntas';
  return `${limpio} · ${zona}`;
}
