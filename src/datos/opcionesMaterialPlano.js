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
// Referencias de compras sin seleccionar automáticamente un artículo de ingeniería.
// El plano puede decir "PTR negro" pero no definir la sección ni calibre: ofrecemos
// alternativas reales (por identidad) con el costo pendiente, nunca un sustituto
// arbitrario con precio oficial. Esta lista tampoco expone el costo de compras.
function opcionesNoTablero(solicitado, insumos, limite) {
  const t = normalizar(solicitado);
  const fam = familiaDeMaterial(solicitado);
  const tipoMetal = fam === 'metal_lamina'
    ? (/\bptr\b|\btubo\b|tubular|perfil/.test(t) ? 'ptr'
      : /\blamina\b|\bplaca\b/.test(t) ? 'lamina' : '')
    : '';
  const hardware = !fam && (t.match(/bisagra|jaladera|nivelador|tornilleria|soldadura/) || [])[0];
  if (!tipoMetal && !hardware) return [];
  const mCal = t.match(/\bcal(?:ibre)?\.?\s*(\d{1,2})\b/);
  const calibreSolicitado = mCal ? Number(mCal[1]) : null;
  const candidatos = Object.entries(insumos || {}).map(([key, x]) => {
    if (!x || x.activo === false) return null;
    const id = String(x.id || key), nombre = String(x.nombre || '');
    const n = normalizar(nombre);
    if (tipoMetal === 'ptr') {
      if (!/\bptr\b|\btubo\b|tubular/.test(n) || /redondo|circular/.test(n) && !/redondo|circular/.test(t)) return null;
    } else if (tipoMetal === 'lamina') {
      if (!/\blamina\b|\bplaca\b/.test(n) || /laminado|melamina|pintura/.test(n)) return null;
    } else if (hardware && !n.includes(hardware)) return null;
    if (tipoMetal && x.seccion && x.seccion !== 'metal') return null;
    if (hardware && x.seccion && !['herrajes', 'metal'].includes(x.seccion)) return null;
    const mCalNom = n.match(/\bcal(?:ibre)?\.?\s*(\d{1,2})\b/);
    const calReal = mCalNom ? Number(mCalNom[1]) : null;
    // Si el plano da calibre, jamás presentar otro como opción viable.
    if (calibreSolicitado != null && calReal !== calibreSolicitado) return null;
    const desdeCompras = x.disponibleCosteo === false;
    const prioridad = (calibreSolicitado != null && calReal === calibreSolicitado ? 100 : 0)
      + (n.includes('negra') && t.includes('negra') ? 15 : 0)
      + (n.includes('ptr') && tipoMetal === 'ptr' ? 8 : 0)
      + (desdeCompras ? 0 : 4);
    const advertencia = desdeCompras
      ? 'Existe en catálogo técnico/Compras, pero falta integrarlo y validar su unidad/precio en el motor de costeo.'
      : tipoMetal
        ? 'Artículo disponible para comparar. Confirmar calibre, perfil, formato y acabado; negro puede requerir pintura aparte.'
        : 'Artículo del catálogo activo. Falta confirmar modelo/especificación y cantidad antes del costo oficial.';
    return { id, nombre, confirmable: false, advertencia, prioridad, fuenteCatalogo: desdeCompras ? 'compras' : 'activo' };
  }).filter(Boolean);
  candidatos.sort((a,b) => b.prioridad - a.prioridad || a.nombre.localeCompare(b.nombre,'es'));
  return candidatos.slice(0,limite);
}

export function opcionesMaterialPlano(solicitado, insumos = {}, limite = 4) {
  const familia = familiaDeMaterial(solicitado);
  if (familia !== 'melamina') return opcionesNoTablero(solicitado, insumos, limite);
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
    const confirmable = coincide && x.disponibleCosteo !== false;
    const diferencia = sustitucion18a19 ? 'Espesor solicitado 18 mm → artículo 19 mm. ' : '';
    const advertencia = x.disponibleCosteo === false
      ? 'Registrado en Compras, todavía no vinculado con precio utilizable en el motor de costeo.'
      : !coincide
      ? `El artículo no identifica el acabado ${solicitado}. No se puede confirmar ni costear como equivalente.`
      : `${diferencia}${tonoEspecifico && color(nombre) !== 'nogal_claro' ? 'Confirmar físicamente el tono nogal claro. ' : ''}Requiere confirmación humana antes de cerrar el costo.`;
    const prioridad = (confirmable ? 100 : 0) + (exacto ? 20 : 0);
    return { id, nombre, confirmable, advertencia, prioridad, fuenteCatalogo: x.disponibleCosteo === false ? 'compras' : 'activo' };
  }).filter(Boolean);
  candidatos.sort((a, b) => b.prioridad - a.prioridad || a.nombre.localeCompare(b.nombre, 'es'));
  // No saturar el celular: primero las coincidencias legítimas; si no hay,
  // mostrar máximo UNA referencia pertinente e inhabilitada.
  const confirmables = candidatos.filter(x => x.confirmable);
  return (confirmables.length ? confirmables : candidatos.slice(0, 1)).slice(0, limite);
}
