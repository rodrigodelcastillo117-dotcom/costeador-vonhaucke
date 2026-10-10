import { familiaDeMaterial } from './materialMatch.js';

// Propuesta económica AUTOMÁTICA, jamás confirmación técnica ni precio inventado.
// Única equivalencia de espesor permitida para costeo PRELIMINAR: tablero 18→19.
// Acero/PTR de otro calibre y vidrio estructural quedan fuera (peso/resistencia).
const normal = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const espesor = s => {
  const m = normal(s).match(/\b(\d+(?:[.,]\d+)?)\s*mm\b/);
  return m ? Number(m[1].replace(',', '.')) : null;
};
const precioUtil = i => Number.isFinite(Number(i?.precio ?? i?.precioBase))
  && Number(i?.precio ?? i?.precioBase) > 0;
const colores = /\b(blanco|negro|gris|roble|walnut|nogal|wengue|maple|cedro|haya)\b/;

/**
 * Devuelve un ID del catálogo ACTIVO que ya tiene precio y unidad de tablero.
 * Si no hay una alternativa definida unívocamente, devuelve null.
 * Nunca mezcla blanco con nogal, MDF con melamina ni espesores 9/16/28 con 18.
 */
export function proxyTableroParaEstimar(materialSolicitado, insumos = {}) {
  const solicitado = normal(materialSolicitado);
  if (familiaDeMaterial(solicitado) !== 'melamina' || espesor(solicitado) !== 18) return null;
  const pideColor = /nogal|walnut/.test(solicitado) ? 'nogal'
    : /blanc/.test(solicitado) ? 'blanco'
    : /negr/.test(solicitado) ? 'negro' : '';
  const opciones = Object.entries(insumos).map(([key, i]) => ({
    id: String(i?.id || key), insumo: i,
  })).filter(({ id, insumo }) => {
    const nombre = normal(insumo?.nombre);
    if (!/^melamina-19(?:-|$)/.test(id) || !/^melamina\b/.test(nombre)) return false;
    if (familiaDeMaterial(nombre) !== 'melamina') return false;
    if (!precioUtil(insumo) || espesor(nombre) !== 19) return false;
    if (insumo.seccion && insumo.seccion !== 'cubiertas') return false;
    if (insumo.unidad !== 'hoja' || insumo.formato?.tipo !== 'tablero' || !(Number(insumo.formato?.medida) > 0)) return false;
    // Una alternativa con color EXPLÍCITO distinto del solicitado no es proxy válido.
    const colorTiene = /nogal|walnut/.test(nombre) ? 'nogal'
      : /blanc/.test(nombre) ? 'blanco' : /negr/.test(nombre) ? 'negro'
      : colores.test(nombre) ? 'otro' : '';
    if (pideColor && colorTiene && pideColor !== colorTiene) return false;
    return true;
  }).map(({ id, insumo }) => {
    const n = normal(insumo.nombre);
    const acabadoDirecto = pideColor && (pideColor === 'nogal' ? /nogal|walnut/.test(n) : n.includes(pideColor));
    const maderaGenerica = pideColor && !acabadoDirecto && /color|madera/.test(n);
    // Un acabado genérico no certifica el color exacto; sólo sirve de referencia.
    return { id, nombre: insumo.nombre, precioFuente: insumo.fuente || '',
      prioridad: acabadoDirecto ? 3 : maderaGenerica ? 2 : 1 };
  });
  if (!opciones.length) return null;
  opciones.sort((a,b) => b.prioridad - a.prioridad || a.id.localeCompare(b.id));
  // Igual prioridad de dos productos con distinto acabado => no elegir silenciosamente.
  if (opciones.length > 1 && opciones[0].prioridad === opciones[1].prioridad) return null;
  return { ...opciones[0], modo: 'COSTEO_PROVISIONAL_18_A_19',
    aviso: 'Sustitución 18→19 mm, mismo tipo de tablero. Acabado y precio de compra real por validar. No autoriza fabricación ni emisión.' };
}
