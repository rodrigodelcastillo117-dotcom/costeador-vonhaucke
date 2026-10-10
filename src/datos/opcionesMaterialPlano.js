import { familiaDeMaterial } from './materialMatch.js';

// No convertir un artículo "parecido" en el material del plano.
// Sólo devolver tableros de la familia correcta, espesor exacto o 18→19 mm,
// y distinguir un acabado identificable de una referencia SIN acabado.
// El catálogo activo puede tener sólo 92 insumos mientras el técnico tiene más.
// Ninguna opción se selecciona automáticamente ni incorpora precios inventados.
function normalizar(x) {
  return String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function espesor(texto) {
  const m = normalizar(texto).match(/\b(\d+(?:[.,]\d+)?)\s*mm\b/);
  return m ? Number(m[1].replace(',', '.')) : null;
}
function color(texto) {
  const t = normalizar(texto);
  if (/nogal\s+claro/.test(t)) return 'nogal_claro';
  if (/nogal|walnut/.test(t)) return 'nogal';
  if (/\bblanc[oa]\b/.test(t)) return 'blanco';
  if (/\bnegr[oa]\b/.test(t)) return 'negro';
  return '';
}
function colorCoincide(solicitado, nombre) {
  const pide = color(solicitado);
  if (!pide) return true;
  const tiene = color(nombre);
  // Nogal claro es un tono específico: Walnut/Nogal Neo sólo son candidatos
  // que necesitan aprobación visual/técnica, no equivalencias certificadas.
  if (pide === 'nogal_claro') return tiene === 'nogal_claro' || tiene === 'nogal';
  return pide === tiene;
}
export function opcionesMaterialPlano(solicitado, insumos = {}, limite = 4) {
  const familia = familiaDeMaterial(solicitado);
  if (familia !== 'melamina') return [];
  const espPedido = espesor(solicitado);
  // Sin espesor de plano no existe un tablero verificable: no elegir 9/16/19/28 al azar.
  if (espPedido == null) return [];
  const candidatos = Object.entries(insumos || {}).map(([key, x]) => {
    const id = String(x?.id || key);
    const nombre = String(x?.nombre || '');
    // NO son tableros: excluye divisor, faldón, perfil, canto y MDF revestido.
    if (!/^melamina-\d+(?:-|$)/i.test(id) || !/^melamina\b/i.test(nombre)) return null;
    if (x?.seccion && x.seccion !== 'cubiertas') return null;
    const espReal = espesor(nombre);
    // Tablero SIN espesor conocido no es material costeable verificable.
    if (espReal == null) return null;
    const exacto = espPedido == null || espReal === espPedido;
    const sustitucion18a19 = espPedido === 18 && espReal === 19;
    if (!exacto && !sustitucion18a19) return null;
    const coincide = colorCoincide(solicitado, nombre);
    const tonoEspecifico = color(solicitado) === 'nogal_claro';
    const confirmable = coincide;
    const diferencia = sustitucion18a19 ? 'Espesor solicitado 18 mm → artículo 19 mm. ' : '';
    const advertencia = !coincide
      ? `El artículo no identifica el acabado ${solicitado}. No se puede confirmar ni costear como equivalente.`
      : `${diferencia}${tonoEspecifico && color(nombre) !== 'nogal_claro' ? 'Confirmar físicamente el tono nogal claro. ' : ''}Requiere confirmación humana antes de cerrar el costo.`;
    const prioridad = (confirmable ? 100 : 0) + (exacto ? 20 : 0);
    return { id, nombre, confirmable, advertencia, prioridad };
  }).filter(Boolean);
  candidatos.sort((a, b) => b.prioridad - a.prioridad || a.nombre.localeCompare(b.nombre, 'es'));
  // No saturar el celular: primero las coincidencias legítimas; si no hay,
  // mostrar máximo UNA referencia pertinente e inhabilitada.
  const confirmables = candidatos.filter(x => x.confirmable);
  return (confirmables.length ? confirmables : candidatos.slice(0, 1)).slice(0, limite);
}
