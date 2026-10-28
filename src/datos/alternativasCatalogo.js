// ============================================================================
//  ALTERNATIVAS DE CATÁLOGO — "no tenemos de 3 mm, proponemos de 4 o de 2".
//
//  El reclamo de Dirección (Rodrigo, 2026-10-28): «si dice cristal 3 mm, la app
//  no dice "no tenemos de 3 mm, proponemos de 4 o 2"… la IA aporta nada». Tenía
//  razón en la EXPERIENCIA: el motor (materialMatch) ya sabe clasificar un
//  candidato, pero NADIE escaneaba el catálogo para OFRECER las opciones reales
//  más cercanas cuando el exacto no existe. `candidatosDeFamilia` puntúa por
//  COINCIDENCIA (premia el espesor que empata); cuando el espesor pedido NO está,
//  todo empata a cero y no distingue 2 de 4 de 9 mm. Aquí ordenamos por DISTANCIA
//  de espesor para poder decir "lo más cercano es 4 mm; luego 2 mm".
//
//  Reglas que NO se rompen (misión §5/§6):
//    · NO inventa precios: el precio es el REAL del catálogo o null ("sin precio").
//    · NO inventa un 3 mm que no existe: propone lo que SÍ hay, etiquetado como
//      sustitución POR CONFIRMAR. No sustituye solo.
//    · NO cruza familia: sólo propone de la MISMA familia (cristal con cristal).
//      Reusa familiaDeMaterial, que además LIMPIA la contaminación del catálogo
//      (una "BISAGRA PARA CRISTAL" es herraje, no cristal, aunque su columna
//      `familia` diga 'cristal').
//    · Seller-safe: a quien NO ve costos se le ofrece el MATERIAL disponible, pero
//      con el precio oculto (precio=null, precioOculto=true).
//
//  Es PURO y determinista (sin LLM): entra texto + catálogo, sale una propuesta.
// ============================================================================
import { familiaDeMaterial, clasificarMaterial, espesoresDe, estadoMaterialUI, MATCH } from './materialMatch.js';

// Orden de preferencia de la clase de correspondencia: primero lo que ya calza,
// al final lo que es sólo "misma familia pero cambia algo crítico".
const PRIO_CLASE = {
  [MATCH.EXACT]: 0,
  [MATCH.EQUIVALENT_APPROVED]: 0,
  [MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED]: 1,
  [MATCH.SAME_FAMILY_CRITICAL_CONFLICT]: 2,
};
const prioDe = (clase) => (clase in PRIO_CLASE ? PRIO_CLASE[clase] : 3);

const precioNum = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * Propone las alternativas REALES del catálogo más cercanas a un material pedido
 * que el catálogo no tiene exacto.
 *
 * @param {string} solicitado  texto del material pedido, p.ej. "cristal templado 3 mm".
 * @param {Array<{id:string,nombre?:string,precio?:number|null,unidad?:string}>} catalogo
 *        normalmente Object.values(insumos).
 * @param {object} [opts]
 * @param {boolean} [opts.veCostos=false]  si el rol ve costos (seller-safe).
 * @param {number}  [opts.max=4]  cuántas alternativas devolver.
 * @returns {{
 *   familiaSolicitada:string, espesorSolicitadoMM:(number|null),
 *   hayExacto:boolean, totalMismaFamilia:number,
 *   alternativas:Array<{id:string,nombre:string,clase:string,autocosteable:boolean,
 *     cambio:string,motivo:string,espesorMM:(number|null),deltaEspesorMM:(number|null),
 *     precio:(number|null),precioOculto:boolean}>,
 *   motivo:string
 * }}
 */
export function proponerAlternativas(solicitado, catalogo = [], { veCostos = false, max = 4 } = {}) {
  const famPide = familiaDeMaterial(solicitado);
  const pedidoEsp = espesoresDe(solicitado)[0] ?? null;
  const vacio = {
    familiaSolicitada: famPide, espesorSolicitadoMM: pedidoEsp,
    hayExacto: false, totalMismaFamilia: 0, alternativas: [], motivo: '',
  };
  if (!famPide) {
    return { ...vacio, motivo: 'No se reconoció el material pedido: no hay con qué proponer una alternativa.' };
  }
  if (!Array.isArray(catalogo) || catalogo.length === 0) {
    return { ...vacio, motivo: 'Catálogo vacío.' };
  }

  const mismos = [];
  for (const ins of catalogo) {
    if (!ins || !ins.id) continue;
    // familiaDeMaterial(nombre) LIMPIA: descarta herrajes "para cristal" de la familia cristal.
    if (familiaDeMaterial(ins.nombre || ins.id) !== famPide) continue;
    const cls = clasificarMaterial({ solicitado, insumoId: ins.id, insumoNombre: ins.nombre || ins.id });
    const espI = espesoresDe(ins.nombre || ins.id)[0] ?? null;
    const delta = (pedidoEsp != null && espI != null) ? Math.abs(espI - pedidoEsp) : null;
    mismos.push({
      id: ins.id,
      nombre: ins.nombre || ins.id,
      clase: cls.clase,
      autocosteable: cls.autocosteable === true,
      cambio: cls.cambio || '',
      motivo: cls.motivo || '',
      espesorMM: espI,
      deltaEspesorMM: delta,
      unidad: ins.unidad || null,
      _precio: precioNum(ins.precio),
    });
  }

  if (mismos.length === 0) {
    return {
      ...vacio,
      motivo: `Se pidió ${famPide.replace(/_/g, ' ')} y el catálogo no tiene NINGÚN insumo de esa familia: no hay alternativa que proponer (dato pendiente de cargar, no se inventa).`,
    };
  }

  // Orden: primero la clase que mejor calza; luego el espesor MÁS CERCANO al pedido
  // (el corazón del reclamo: "lo más cercano es 4 mm, luego 2 mm"); un candidato sin
  // espesor legible va después de los que sí lo tienen; luego el más barato (con precio
  // real), y el nombre para que el orden sea estable.
  mismos.sort((a, b) => {
    const pc = prioDe(a.clase) - prioDe(b.clase);
    if (pc) return pc;
    const da = a.deltaEspesorMM == null ? Infinity : a.deltaEspesorMM;
    const db = b.deltaEspesorMM == null ? Infinity : b.deltaEspesorMM;
    if (da !== db) return da - db;
    const pa = a._precio == null ? Infinity : a._precio;
    const pb = b._precio == null ? Infinity : b._precio;
    if (pa !== pb) return pa - pb;
    return a.nombre.localeCompare(b.nombre);
  });

  const alternativas = mismos.slice(0, Math.max(1, max)).map(({ _precio, ...pub }) => ({
    ...pub,
    precio: veCostos ? _precio : null,
    precioOculto: !veCostos,
  }));

  return {
    familiaSolicitada: famPide,
    espesorSolicitadoMM: pedidoEsp,
    hayExacto: alternativas.some((a) => a.clase === MATCH.EXACT),
    totalMismaFamilia: mismos.length,
    alternativas,
    motivo: '',
  };
}

/**
 * Frase lista para la UI, p.ej.:
 *   "No hay cristal de 3 mm. Lo más cercano: 4 mm ($123.00), 2 mm ($98.00) — elige (por confirmar)."
 * Respeta seller-safe: sin costos, omite los precios pero sí ofrece el material.
 * Devuelve '' si no hay nada que proponer (el llamador muestra NOT_AVAILABLE).
 */
export function fraseAlternativas(propuesta, { pesos } = {}) {
  if (!propuesta || !Array.isArray(propuesta.alternativas) || propuesta.alternativas.length === 0) return '';
  if (propuesta.hayExacto) return '';
  const fam = (propuesta.familiaSolicitada || 'material').replace(/_/g, ' ');
  const esp = propuesta.espesorSolicitadoMM;
  const money = typeof pesos === 'function' ? pesos : (n) => `$${Number(n).toFixed(2)}`;
  const partes = propuesta.alternativas.map((a) => {
    const etiqueta = a.espesorMM != null ? `${a.espesorMM} mm` : a.nombre;
    if (a.precioOculto || a.precio == null) return etiqueta;
    return `${etiqueta} (${money(a.precio)})`;
  });
  const pedido = esp != null ? `${fam} de ${esp} mm` : fam;
  return `No hay ${pedido}. Lo más cercano: ${partes.join(', ')} — elige (por confirmar).`;
}

/**
 * CABLEADO A LA UI: para una lista de componentes del despiece, devuelve un mapa
 * { índice → propuesta } SÓLO de las piezas que están PENDIENTES (sin material
 * costeable) y para las que SÍ hay alternativas reales que ofrecer y NINGUNA es
 * exacta. Reusa `estadoMaterialUI` para decidir "pendiente" con la misma regla que
 * pinta cada selector (no inventa un criterio nuevo). Las piezas con material
 * resuelto, confirmado o sin precio certificado (que tiene su propio aviso) no
 * entran. Puro y determinista: lo prueba una unidad, no hace falta renderizar la UI.
 *
 * @param {Array<object>} componentes  el despiece (b.componentes).
 * @param {object} insumos  catálogo como mapa { id → insumo }.
 * @param {object} [opts] { veCostos, max }
 * @returns {Record<number, object>}  índice de pieza → propuesta de proponerAlternativas.
 */
export function alternativasParaPiezas(componentes = [], insumos = {}, { veCostos = false, max = 3 } = {}) {
  const catalogoArr = Object.values(insumos || {});
  const out = {};
  const lista = Array.isArray(componentes) ? componentes : [];
  lista.forEach((c, i) => {
    if (!c || c.excluida) return;
    const est = estadoMaterialUI(c, insumos);
    if (!est.pendiente || c?._match?.sinPrecioCertificado) return;   // ya costeable, o tiene su propio aviso
    const prop = proponerAlternativas(c.material_solicitado || c.nombre, catalogoArr, { veCostos, max });
    if (prop.alternativas.length && !prop.hayExacto) out[i] = prop;
  });
  return out;
}
