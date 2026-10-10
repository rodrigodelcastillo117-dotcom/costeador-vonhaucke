// Traslada materiales EXPLÍCITOS de la leyenda del plano a piezas inequívocas.
// Sólo propone: materialMatch decide el catálogo y mantiene los gates económicos.
import { familiaDeMaterial } from './materialMatch.js';

const texto = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const piezasTablero = /\b(cubierta|cubiertas|lateral|laterales|costado|costados|division|divisiones|puerta|puertas|frente|frentes|panel|paneles|repisa|repisas|fondo|fondos|modulo bajo)\b/;
const bloqueos = /\b(vidrio|cristal|acrilico|transparente|metal|metalica|estructura|ptr|lamina|refrigerador|pantalla|equipo|pos|herraje)\b/;

/**
 * Nunca deduce un insumo comprado: sólo hereda una especificación inequívoca
 * del plano para que la política de material la concilie con el catálogo.
 */
export function materialDesdeLeyenda(pieza = {}, materiales = []) {
  const explicito = String(pieza.material_solicitado || '').trim();
  const nombre = texto(pieza.nombre);
  if (!piezasTablero.test(nombre) || bloqueos.test(nombre)) return explicito;
  const lista = (Array.isArray(materiales) ? materiales : [])
    .filter((m) => typeof m === 'string').map((m) => m.trim()).filter(Boolean)
    .filter((m) => familiaDeMaterial(m) === 'melamina');
  // Si hay 2 variantes, no elegimos una escondida.
  const distintos = [...new Set(lista.map((m) => texto(m)))];
  if (distintos.length !== 1) return explicito;
  const leyenda = lista[0];
  if (!explicito) return leyenda;
  // La IA puede escribir sólo "melamina nogal claro" aunque la leyenda
  // indique 18 mm. Enriquecemos el ESPESOR faltante únicamente si las familias
  // y los colores explícitos son compatibles. No sustituye una petición distinta.
  if (familiaDeMaterial(explicito) !== 'melamina' || /\b\d+(?:[.,]\d+)?\s*mm\b/i.test(explicito)) return explicito;
  const req = texto(explicito), ref = texto(leyenda);
  const colores = ['nogal', 'walnut', 'blanc', 'negr', 'roble', 'gris', 'maple'];
  if (colores.some((c) => req.includes(c) && !ref.includes(c))) return explicito;
  return /\b\d+(?:[.,]\d+)?\s*mm\b/i.test(leyenda) ? leyenda : explicito;
}
