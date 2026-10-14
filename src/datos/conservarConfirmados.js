// VH-150 · Al RECALCULAR con respuestas (pre-canónico), la IA devuelve un despiece nuevo y la pantalla
// lo tomaba entero: los materiales que la persona ya había ELEGIDO A MANO (buscador ERP, selector,
// "Usar … (confirmar)") se perdían y la pieza volvía a "sin material". Reproducido en el laboratorio
// P0-C (respaldo MDF 9 mm → ERP MDF8 $240, perdido tras "Aplicar respuestas y recalcular").
// Regla: una confirmación humana manda sobre el supuesto de la IA. Se conserva por NOMBRE de pieza
// (la IA conserva los nombres en una re-corrida) sólo cuando la pieza nueva no trae ya una
// confirmación humana propia. La geometría y cantidades vienen de la propuesta nueva.
import { patchConfirmacionUI, patchPropuestaHermana } from './materialMatch.js';

const clave = (c) => String(c?.nombre || '').trim().toLowerCase().replace(/\s+/g, ' ');
const confirmadoHumano = (c) => !!(c && c.insumoId && (c.material_confirmado === true || c?._match?.confirmado_por_usuario === true));
// Smoke post-vh146c (14-oct): desde P2-01 el artículo elegido para una pieza se PROPONE a sus hermanas (propagado_desde),
// sin confirmarlas. Al aplicar respuestas y recalcular, esas propuestas se perdían y las hermanas volvían al supuesto de
// la IA (librero: piso, techo y entrepaños regresaban a la melamina curada 4×8). Sobreviven, pero siguen POR CONFIRMAR.
const propuestaDeHermana = (c) => !!(c && c.insumoId && c.propagado_desde && !confirmadoHumano(c));

export function conservarMaterialesConfirmados(previos = [], nuevos = []) {
  const prev = Array.isArray(previos) ? previos : [];
  const porNombre = new Map();
  for (const c of prev) if ((confirmadoHumano(c) || propuestaDeHermana(c)) && !porNombre.has(clave(c))) porNombre.set(clave(c), c);
  if (!porNombre.size) return Array.isArray(nuevos) ? nuevos : [];
  return (Array.isArray(nuevos) ? nuevos : []).map((n) => {
    if (!n || confirmadoHumano(n)) return n;
    const p = porNombre.get(clave(n));
    if (!p) return n;
    if (confirmadoHumano(p)) return { ...n, insumoId: p.insumoId, ...patchConfirmacionUI(p.insumoId) };
    return { ...n, insumoId: p.insumoId, ...patchPropuestaHermana(p.insumoId, p.propagado_desde) };
  });
}
