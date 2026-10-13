// VH-150 · Al RECALCULAR con respuestas (pre-canónico), la IA devuelve un despiece nuevo y la pantalla
// lo tomaba entero: los materiales que la persona ya había ELEGIDO A MANO (buscador ERP, selector,
// "Usar … (confirmar)") se perdían y la pieza volvía a "sin material". Reproducido en el laboratorio
// P0-C (respaldo MDF 9 mm → ERP MDF8 $240, perdido tras "Aplicar respuestas y recalcular").
// Regla: una confirmación humana manda sobre el supuesto de la IA. Se conserva por NOMBRE de pieza
// (la IA conserva los nombres en una re-corrida) sólo cuando la pieza nueva no trae ya una
// confirmación humana propia. La geometría y cantidades vienen de la propuesta nueva.
import { patchConfirmacionUI } from './materialMatch.js';

const clave = (c) => String(c?.nombre || '').trim().toLowerCase().replace(/\s+/g, ' ');
const confirmadoHumano = (c) => !!(c && c.insumoId && (c.material_confirmado === true || c?._match?.confirmado_por_usuario === true));

export function conservarMaterialesConfirmados(previos = [], nuevos = []) {
  const prev = Array.isArray(previos) ? previos : [];
  const porNombre = new Map();
  for (const c of prev) if (confirmadoHumano(c) && !porNombre.has(clave(c))) porNombre.set(clave(c), c);
  if (!porNombre.size) return Array.isArray(nuevos) ? nuevos : [];
  return (Array.isArray(nuevos) ? nuevos : []).map((n) => {
    if (!n || confirmadoHumano(n)) return n;
    const p = porNombre.get(clave(n));
    if (!p) return n;
    return { ...n, insumoId: p.insumoId, ...patchConfirmacionUI(p.insumoId) };
  });
}
