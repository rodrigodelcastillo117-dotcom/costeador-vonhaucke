// Traslada materiales EXPLÍCITOS de la leyenda del plano a piezas inequívocas.
// Sólo propone: materialMatch decide el catálogo y mantiene los gates económicos.
import { familiaDeMaterial } from './materialMatch.js';

const texto = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const piezasTablero = /\b(cubierta|cubiertas|lateral|laterales|costado|costados|division|divisiones|puerta|puertas|frente|frentes|panel|paneles|modulo bajo)\b/;
const bloqueos = /\b(vidrio|cristal|acrilico|transparente|metal|metalica|estructura|ptr|lamina|refrigerador|pantalla|equipo|pos|herraje)\b/;

/**
 * Nunca deduce un insumo comprado: sólo hereda una especificación inequívoca
 * del plano para que la política de material la concilie con el catálogo.
 */
export function materialDesdeLeyenda(pieza = {}, materiales = []) {
  if (String(pieza.material_solicitado || '').trim()) return pieza.material_solicitado;
  const nombre = texto(pieza.nombre);
  if (!piezasTablero.test(nombre) || bloqueos.test(nombre)) return '';
  const lista = (Array.isArray(materiales) ? materiales : [])
    .filter((m) => typeof m === 'string').map((m) => m.trim()).filter(Boolean)
    .filter((m) => familiaDeMaterial(m) === 'melamina');
  // Si hay 2 variantes, no elegimos una escondida.
  const distintos = [...new Set(lista.map((m) => texto(m)))];
  return distintos.length === 1 ? lista[0] : '';
}
