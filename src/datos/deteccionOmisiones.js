// ============================================================================
//  DETECCIÓN DE OMISIONES / INGENIERÍA INVISIBLE (COSTEAR 100 · FASE 11 + 22)
//  --------------------------------------------------------------------------
//  Antes de dar un costo, una segunda auditoría INDEPENDIENTE se pregunta:
//  "¿CÓMO SE SOSTIENE, ENSAMBLA Y FUNCIONA ESTE MUEBLE — y qué NO está costeado?"
//
//  Detecta componentes/operaciones FÍSICAMENTE IMPLICADOS por lo que ya se ve pero
//  AUSENTES del BOM/routing: puertas sin bisagra, cajones sin corredera, estructura
//  metálica sin unión, LED sin driver, vidrio sin fijación, cubierta de gran claro
//  sin refuerzo (omega/bastidor), tableros sin canto, ensamble sin tornillería,
//  módulo transportable sin embalaje, equipo integrado sin soporte.
//
//  REGLAS DE CASA (misión + directiva):
//   · PROPONE; NUNCA auto-agrega cantidades ni cambia el BOM. La IA propone; el
//     humano/Ingeniería confirma; el motor costea.
//   · Clasifica SEVERIDAD: OMISION (casi seguro que falta) / RIESGO (probable,
//     depende del diseño) / SUGERENCIA (opcional / bajo impacto).
//   · Clasifica CERTEZA (matriz FASE 22): INFERIDO / POR_CONFIRMAR. Nunca marca
//     algo como DOCUMENTADO: esto es inferencia, no evidencia.
//   · Materialidad (FASE 22 §9): sólo una omisión FUNCIONAL crítica bloquea el
//     costo oficial. No se bloquea "por si hay un tornillo oculto".
//   · Respeta DESCARTADO: una exclusión confirmada por un humano apaga su regla.
//   · Determinista y testeable sin red.
//  NO es un motor paralelo: se apoya en los roles de revisionEstructural y en el
//  despiece/estructura ya existentes.
// ============================================================================

import { rolDe } from './revisionEstructural.js';

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SEV_ORDEN = { OMISION: 0, RIESGO: 1, SUGERENCIA: 2 };

// Normaliza la entrada a una vista uniforme: cada pieza con su texto (nombre +
// material solicitado + nombre del insumo resuelto) y su rol semántico.
function normalizar(piezas = [], insumos = null) {
  return (Array.isArray(piezas) ? piezas : [])
    .filter((p) => p && !p.excluida && (p.nombre || p.insumoId || p.semantic_role))
    .map((p) => {
      const nombreInsumo = insumos && p.insumoId && insumos[p.insumoId] ? insumos[p.insumoId].nombre : '';
      const texto = sinAcentos(`${p.nombre || ''} ${p.material_solicitado || ''} ${nombreInsumo}`);
      const rol = p.semantic_role && String(p.semantic_role).trim()
        ? String(p.semantic_role).trim().toLowerCase()
        : rolDe(p.nombre || p.insumoId || '');
      const largo = Number(p.largoMM) || 0;
      const ancho = Number(p.anchoMM) || 0;
      const cuenta = Math.max(1, Math.round(Number(p.piezas ?? p.cantidad) || 1));
      return { rol, texto, largo, ancho, claro: Math.max(largo, ancho), cuenta, _raw: p };
    });
}

// ----------------------------------------------------------------------------
//  CATÁLOGO DE REGLAS. Cada regla: inspecciona la vista normalizada y, si detecta
//  un implícito ausente, devuelve un hallazgo. Si no, null. Nunca muta la entrada.
// ----------------------------------------------------------------------------
const REGLAS = [
  {
    clave: 'puertas_sin_bisagra',
    subsistema: 'herrajes',
    evaluar(ctx) {
      const puertas = ctx.piezas.filter((p) => p.rol === 'puerta');
      if (!puertas.length) return null;
      // ¿ya hay un sistema de abatimiento/deslizamiento en cualquier renglón?
      if (ctx.hayTexto(/bisagra|pivote|piano|herraje.*puerta|abatible|corrediz|riel.*puerta/)) return null;
      const n = puertas.reduce((s, p) => s + p.cuenta, 0);
      return {
        categoria: 'componente', severidad: 'RIESGO', certeza: 'POR_CONFIRMAR', bloquea_certificacion: false,
        mensaje: `Se detectaron ${n} puerta(s) pero no hay bisagras ni sistema de abatimiento/deslizamiento en el despiece.`,
        pregunta: '¿Las puertas llevan bisagra convencional, pivote, piano, o son corredizas? Falta el herraje de abatimiento.',
        evidencia: `${n} pieza(s) con rol "puerta"; ningún renglón menciona bisagra/pivote/corredera.`,
      };
    },
  },
  {
    clave: 'cajones_sin_corredera',
    subsistema: 'herrajes',
    evaluar(ctx) {
      const cajones = ctx.piezas.filter((p) => p.rol === 'gaveta');
      if (!cajones.length) return null;
      if (ctx.hayTexto(/corredera|riel|guia|deslizad|telescopic|extension/)) return null;
      const n = cajones.reduce((s, p) => s + p.cuenta, 0);
      return {
        categoria: 'componente', severidad: 'RIESGO', certeza: 'POR_CONFIRMAR', bloquea_certificacion: false,
        mensaje: `Se detectaron ${n} cajón/gaveta pero no hay correderas ni sistema de deslizamiento en el despiece.`,
        pregunta: '¿Los cajones llevan corredera de extensión, riel o guía de madera? Falta el sistema de deslizamiento.',
        evidencia: `${n} pieza(s) con rol "gaveta"; ningún renglón menciona corredera/riel/guía.`,
      };
    },
  },
  {
    clave: 'metal_sin_union',
    subsistema: 'estructura',
    evaluar(ctx) {
      // estructura metálica: lámina, tubular, PTR, perfil, solera, ángulo, acero
      const metal = ctx.piezas.filter((p) => /\blamina\b|tubular|\bptr\b|perfil|solera|angulo|acero|poste|bastidor metal/.test(p.texto));
      if (metal.length < 1) return null;
      // ¿hay una operación o renglón de unión? (soldadura, remache, tornillo estructural, doblez/punzonado = proceso metal)
      if (ctx.hayTexto(/soldad|remach|punzon|doblad/) || ctx.hayOperacion(/soldad|remach|punzon|doblad|corte.*lamina|corte.*tubo/)) return null;
      return {
        categoria: 'operacion', severidad: 'RIESGO', certeza: 'INFERIDO', bloquea_certificacion: false,
        mensaje: `Hay estructura metálica (lámina/tubular/perfil) pero no aparece una operación de unión (soldadura, remache o atornillado estructural) en el routing.`,
        pregunta: '¿Cómo se unen las piezas metálicas: soldadura, remache o tornillería estructural? Sin esa operación, la MO del metal queda subestimada.',
        evidencia: `${metal.length} renglón(es) de metal; routing sin soldadura/remache/punzonado/doblez.`,
      };
    },
  },
  {
    clave: 'led_sin_driver',
    subsistema: 'electrico',
    evaluar(ctx) {
      if (!ctx.hayTexto(/\bled\b|ilumina|tira de luz|lampara|luminari|spot\b/)) return null;
      if (ctx.hayTexto(/driver|fuente.*(poder|aliment|conmutad)|transformador|balastr|controlador|eliminador/)) return null;
      return {
        categoria: 'componente', severidad: 'OMISION', certeza: 'INFERIDO', bloquea_certificacion: true,
        mensaje: 'Hay iluminación LED pero no hay driver/fuente de poder ni transformador. Un LED no funciona sin su alimentación.',
        pregunta: '¿Qué driver/fuente alimenta el LED (voltaje, watts)? Es un componente obligatorio para que la iluminación funcione.',
        evidencia: 'Renglón de LED/iluminación sin driver/fuente/transformador acompañante.',
      };
    },
  },
  {
    clave: 'vidrio_sin_fijacion',
    subsistema: 'transparentes',
    evaluar(ctx) {
      const vidrio = ctx.piezas.filter((p) => p.rol === 'cristal' || /cristal|vidrio|templado|acrilico|policarbonato|espejo/.test(p.texto));
      if (!vidrio.length) return null;
      if (ctx.hayTexto(/fijaci|soporte.*(vidrio|cristal|acrilico)|perfil|silic[o]n|bumper|pinza|arana|canto pulido|canto de cristal|clip|ceja/)) return null;
      return {
        categoria: 'componente', severidad: 'RIESGO', certeza: 'POR_CONFIRMAR', bloquea_certificacion: false,
        mensaje: 'Hay vidrio/acrílico pero no se ve su sistema de fijación (perfil, silicón estructural, pinzas, bumpers) ni tratamiento de canto.',
        pregunta: '¿Cómo se fija y remata el vidrio/acrílico (perfil, silicón, pinzas; canto pulido)? Falta la fijación.',
        evidencia: `${vidrio.length} renglón(es) transparente(s) sin fijación/soporte/canto.`,
      };
    },
  },
  {
    clave: 'equipo_sin_soporte',
    subsistema: 'equipos',
    evaluar(ctx) {
      if (!ctx.hayTexto(/refrigerador|nevera|pantalla|monitor|display|televis|equipo integrado|dispensador/)) return null;
      const haySoporte = ctx.piezas.some((p) => p.rol === 'pata') || ctx.hayTexto(/soporte|bastidor|estructura|base metal|mensula|anclaje|riel.*equipo/);
      if (haySoporte) return null;
      return {
        categoria: 'componente', severidad: 'RIESGO', certeza: 'POR_CONFIRMAR', bloquea_certificacion: false,
        mensaje: 'Hay un equipo integrado (refrigerador/pantalla/equipo) pero no se ve estructura de soporte/anclaje para sostenerlo.',
        pregunta: '¿El equipo lo suministra el cliente o Von Haucke? ¿Qué estructura/anclaje lo soporta? (Y si pesa o calienta: ¿requiere ventilación?)',
        evidencia: 'Mención de equipo integrado sin soporte/bastidor/anclaje en el despiece.',
      };
    },
  },
  {
    clave: 'cubierta_claro_sin_refuerzo',
    subsistema: 'estructura',
    evaluar(ctx) {
      // Ingeniería invisible: una cubierta/entrepaño de gran claro suele necesitar
      // refuerzo (omega, bastidor, travesaño) para no pandear. Requiere validación.
      const UMBRAL = 1200; // mm de claro
      const grandes = ctx.piezas.filter((p) => (p.rol === 'cubierta' || p.rol === 'entrepano') && p.claro >= UMBRAL);
      if (!grandes.length) return null;
      if (ctx.hayTexto(/refuerzo|omega|bastidor|travesa|larguero|mensula|costilla|nervadura/)) return null;
      const p = grandes.sort((a, b) => b.claro - a.claro)[0];
      return {
        categoria: 'componente', severidad: 'RIESGO', certeza: 'POR_CONFIRMAR', bloquea_certificacion: false,
        mensaje: `Hay una cubierta/entrepaño de ${p.claro} mm de claro sin un refuerzo interno visible (omega, bastidor o travesaño). Un claro grande puede pandear.`,
        pregunta: `¿El claro de ${p.claro} mm lleva refuerzo interno (omega/bastidor/travesaño)? Depende de la carga y del espesor; requiere validación de Ingeniería.`,
        evidencia: `Panel horizontal de claro ${p.claro} mm ≥ ${UMBRAL} mm sin renglón de refuerzo.`,
      };
    },
  },
  {
    clave: 'tablero_sin_canto',
    subsistema: 'acabados',
    evaluar(ctx) {
      const PANEL = new Set(['cubierta', 'lateral', 'entrepano', 'puerta', 'faldon', 'frente_cajon', 'fondo', 'respaldo']);
      const tableros = ctx.piezas.filter((p) => PANEL.has(p.rol) && /melamina|\bmdf\b|\bmdp\b|aglomerad|tablero|triplay|contrachapad/.test(p.texto));
      if (!tableros.length) return null;
      if (ctx.hayTexto(/canto|tapacanto|cubrecanto|\babs\b|pvc|cantead/)) return null;
      return {
        categoria: 'componente', severidad: 'SUGERENCIA', certeza: 'INFERIDO', bloquea_certificacion: false,
        mensaje: `${tableros.length} pieza(s) de tablero (melamina/MDF) sin canto en el despiece. El canto suele ir y se olvida.`,
        pregunta: '¿Los cantos visibles llevan tapacanto (ABS/PVC)? Es de bajo costo pero cambia acabado y durabilidad.',
        evidencia: `${tableros.length} panel(es) de tablero sin renglón de canto/tapacanto.`,
      };
    },
  },
  {
    clave: 'ensamble_sin_tornilleria',
    subsistema: 'herrajes',
    evaluar(ctx) {
      // Un ensamble de varias piezas estructurales casi siempre lleva fijación.
      const ESTRUCT = new Set(['cubierta', 'lateral', 'entrepano', 'puerta', 'faldon', 'fondo', 'respaldo', 'pata', 'gaveta', 'conector']);
      const nEstruct = ctx.piezas.filter((p) => ESTRUCT.has(p.rol)).length;
      if (nEstruct < 3) return null;
      if (ctx.hayTexto(/tornill|fijaci|remach|grapa|clavo|conector|minifix|espiga|tarugo|ensambl/)) return null;
      return {
        categoria: 'componente', severidad: 'SUGERENCIA', certeza: 'INFERIDO', bloquea_certificacion: false,
        mensaje: `El ensamble tiene ${nEstruct} piezas estructurales pero no hay tornillería/fijación en el despiece.`,
        pregunta: '¿Qué sistema de unión usa el armado (tornillería, minifix, espigas)? Bajo costo pero debe estar.',
        evidencia: `${nEstruct} piezas estructurales sin renglón de tornillería/fijación.`,
      };
    },
  },
  {
    clave: 'modulo_sin_embalaje',
    subsistema: 'embalaje',
    evaluar(ctx) {
      // Un módulo transportable (tiene estructura) sin embalaje: aviso de bajo impacto.
      const ESTRUCT = new Set(['cubierta', 'lateral', 'pata', 'puerta', 'gaveta', 'fondo']);
      const nEstruct = ctx.piezas.filter((p) => ESTRUCT.has(p.rol)).length;
      if (nEstruct < 2) return null;
      if (ctx.hayTexto(/embalaj|empaque|emplay|carton|esquiner|proteccion|flejad|burbuja|estiba|tarima/)) return null;
      return {
        categoria: 'componente', severidad: 'SUGERENCIA', certeza: 'INFERIDO', bloquea_certificacion: false,
        mensaje: 'Es un módulo transportable pero no hay embalaje/protección en el despiece.',
        pregunta: '¿El proyecto incluye embalaje y maniobras de envío? (Va en su propia partida, no se mezcla con fábrica.)',
        evidencia: `${nEstruct} piezas estructurales sin renglón de embalaje/empaque.`,
      };
    },
  },
];

/**
 * Detecta componentes/operaciones implícitos pero ausentes. NO cambia el BOM.
 * @param {{piezas?:Array, componentes?:Array, insumos?:object, operaciones?:Array, exclusiones?:Array<string>, meta?:object}} entrada
 * @returns {{hallazgos:Array, resumen:{omisiones:number,riesgos:number,sugerencias:number,bloquea_certificacion:boolean}}}
 */
export function detectarOmisiones(entrada = {}) {
  const piezasIn = Array.isArray(entrada.piezas) ? entrada.piezas
    : Array.isArray(entrada.componentes) ? entrada.componentes : [];
  const piezas = normalizar(piezasIn, entrada.insumos || null);
  const opsTexto = (Array.isArray(entrada.operaciones) ? entrada.operaciones : [])
    .map((o) => sinAcentos(typeof o === 'string' ? o : (o && (o.nombre || o.operacion)) || '')).join(' · ');
  const excluidas = new Set((Array.isArray(entrada.exclusiones) ? entrada.exclusiones : []).map((x) => String(x)));
  const blobTexto = piezas.map((p) => p.texto).join(' · ');

  const ctx = {
    piezas,
    hayTexto: (re) => re.test(blobTexto),
    hayOperacion: (re) => re.test(opsTexto),
  };

  const hallazgos = [];
  for (const regla of REGLAS) {
    if (excluidas.has(regla.clave)) continue; // DESCARTADO por un humano
    let h = null;
    try { h = regla.evaluar(ctx); } catch (_e) { h = null; }
    if (!h) continue;
    hallazgos.push({ regla: regla.clave, subsistema: regla.subsistema, ...h });
  }
  hallazgos.sort((a, b) => (SEV_ORDEN[a.severidad] - SEV_ORDEN[b.severidad]) || a.regla.localeCompare(b.regla));

  const resumen = {
    omisiones: hallazgos.filter((h) => h.severidad === 'OMISION').length,
    riesgos: hallazgos.filter((h) => h.severidad === 'RIESGO').length,
    sugerencias: hallazgos.filter((h) => h.severidad === 'SUGERENCIA').length,
    bloquea_certificacion: hallazgos.some((h) => h.bloquea_certificacion),
  };
  return { hallazgos, resumen };
}

/** Lista las claves de regla disponibles (para UI de exclusiones / documentación). */
export function reglasDeOmision() {
  return REGLAS.map((r) => ({ clave: r.clave, subsistema: r.subsistema }));
}
