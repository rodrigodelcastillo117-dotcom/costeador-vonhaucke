// ============================================================================
//  REVISIÓN ESTRUCTURAL (determinista) — el "cerebro que RAZONA" del Costeador
//  avanzado. No inventa costo ni dimensiones: analiza el despiece como un CONJUNTO
//  y señala relaciones físicas que no cuadran, para que el usuario confirme/corrija.
//  Es la parte fiable del modelo estructural (IA propone/detecta; el motor costea).
//
//  Clasifica cada observación en: 'info' | 'warning' | 'blocker'.
//  Fuente de verdad: los componentes capturados (+ descripción libre opcional).
// ============================================================================

// Rol semántico de una pieza a partir de su nombre (heurística de taller, es-MX).
const ROLES = [
  // Auditoría 2026-10-19: accesorios que se pegan/apoyan a otra pieza ("bumpers de apoyo del cristal") son herraje, no la
  // pieza que apoyan (antes la palabra "cristal" los volvía pieza de cristal y el silicón salía como material equivocado).
  ['herraje', /\b(herraje|tornill\w*|bisagras?|correderas?|niveladores?|jaladeras?|cerraduras?|separador(es)?|bumpers?|topes?|tacones?|pads?|regatones?|antiderrapantes?|protectores?)\b/i],
  ['frente_cajon', /\bfrentes?\b/i],
  ['cubierta', /\b(cubierta|tapa|top|sobre|superficie)\b/i],
  ['faldon', /\bfald[oó]n\b/i],
  ['lateral', /\b(lateral|laterales|costados?|panel lateral)\b/i],
  ['gaveta', /\b(gaveta|caj[oó]n|cajonera)\b/i],
  // VH-163b (2026-10-13, mesa de trabajo V5): sólo reconocía singulares; "Patas PTR", "Travesaños", "Postes"
  // caían en 'otro' → falso bloqueo "cubierta sin soporte" y la regla de niveladores no se disparaba.
  ['pata', /\b(patas?|bases?|estructuras?|bastidor(es)?|travesa[ñn]os?|postes?|soportes?|largueros?|pedestal(es)?|zoclos?|z[oó]calos?)\b/i],
  ['respaldo', /\brespaldo\b/i],
  ['asiento', /\b(asiento|banca|silla|plaza|butaca)\b/i],
  ['entrepano', /\b(entrepa[ñn]os?|repisas?|estantes?|anaquel)\b/i],
  ['fondo', /\b(fondo|trasero|panel trasero)\b/i],
  ['puerta', /\bpuertas?\b/i],
  ['conector', /\b(conector|uni[oó]n|ensamble|acoplador)\b/i],
  ['espuma', /\b(espuma|hule espuma|poliuretano|acolchad)\b/i],
  ['tapiz', /\b(tapiz|tela|piel|vinil|ecopiel|tapizado)\b/i],
  ['cristal', /\b(cristal|vidrio|templado)\b/i],
];

import { familiaDeMaterial, espesoresDe, FAMILIAS_ACABADO } from './materialMatch.js';
import { REGLAS_TALLER } from './reglasTaller.js';

// STRUCTURAL_LINT: etiqueta interna. Esto es un guardrail determinista (regex/heurística),
// NO el motor de comprensión del mueble (ese es analizar-mueble → structuralGraph).
export const TIPO = 'STRUCTURAL_LINT';

// Rol semántico de una pieza por su nombre. Exportado para que `structuralGraph.js`
// reuse la MISMA detección (una sola fuente de roles, sin duplicar).
export function rolDe(nombre = '') {
  for (const [rol, re] of ROLES) if (re.test(nombre)) return rol;
  return 'otro';
}

// ¿La descripción sugiere un tipo de mueble? (para validar coherencia del conjunto)
function tipoIntencion(desc = '') {
  const t = String(desc).toLowerCase();
  if (/\b(banca|sillas?|butaca|espera|plazas?|asientos?|seating|lounge)\b/.test(t)) return 'asientos';
  if (/\b(credenza|gabinete|archivero|caj[oó]n|librero|alacena)\b/.test(t)) return 'gabinete';
  if (/\b(escritorio|mesa|mostrador|recepci[oó]n|cubierta|table|desk)\b/.test(t)) return 'superficie';
  return null;
}

/**
 * Analiza el despiece como conjunto y devuelve observaciones accionables.
 * @param {{componentes?:Array, descripcion?:string, piezas?:number}} entrada
 * @returns {{roles: object, observaciones: Array<{nivel:string, mensaje:string, pieza?:string}>, resumen: object}}
 */
/**
 * SRV-01: "la IA declara TOTAL X m de un material lineal y sus renglones suman Y". Por material (insumoId) lineal, si algún
 * renglón trae el total declarado por la IA (ia_totales_declarados_m) y NINGUNO cuadra (−5 %…+15 %) con la suma de sus
 * renglones, se reporta en el primero del grupo. Misma tolerancia que mapIaComps. La usan el cliente y el servidor.
 */
export function totalesLinealesIncoherentes(componentes = [], insumos = null) {
  const lineal = (c) => c.forma === 'lineal' || /^(m|ml|metro)s?$/i.test(String(insumos?.[c.insumoId]?.unidad || ''));
  const grupos = new Map();
  // Mismo material = el insumo del renglón o, si la política lo dejó pendiente de confirmar, su candidato (como el cliente,
  // que agrupa por el insumo que pidió la IA).
  const clave = (c) => c?.insumoId || c?._match?.candidate_insumo_id || '';
  for (const c of componentes) {
    const k = clave(c);
    if (!c || c.excluida || !k || !lineal({ ...c, insumoId: k }) || !(Number(c.cantidad) > 0)) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(c);
  }
  const out = [];
  for (const [material, cs] of grupos) {
    const declarados = cs.flatMap((c) => (Array.isArray(c.ia_totales_declarados_m) ? c.ia_totales_declarados_m : [])).filter((v) => Number(v) > 0);
    if (!declarados.length) continue;
    const suma = Math.round(cs.reduce((s, c) => s + Number(c.cantidad), 0) * 1000) / 1000;   // igual que mapIaComps
    if (declarados.some((v) => suma >= v * 0.95 && suma <= v * 1.15)) continue;
    out.push({ comp: cs[0], material, dice: Math.max(...declarados), puso: suma, renglones: cs.length });
  }
  return out;
}

export function revisarEstructura({ componentes = [], descripcion = '', insumos = null, medidasGenerales = '', aceptadas = [], ingenieria = true } = {}) {
  const comps = Array.isArray(componentes) ? componentes.filter((c) => c && (c.nombre || c.insumoId)) : [];
  const conRol = comps.map((c) => ({ ...c, _rol: rolDe(c.nombre || c.insumoId || '') }));
  const roles = {};
  for (const c of conRol) roles[c._rol] = (roles[c._rol] || 0) + 1;
  const hay = (r) => (roles[r] || 0) > 0;
  const obs = [];
  const intencion = tipoIntencion(descripcion);

  if (comps.length === 0) {
    obs.push({ nivel: 'info', mensaje: 'Aún no hay piezas. Describe el mueble o agrega su primera pieza.' });
    return { roles, observaciones: obs, resumen: { piezas: 0, intencion } };
  }

  // 1) Gaveta/cajón sin cuerpo que la contenga.
  if (hay('gaveta') && !hay('lateral') && !hay('puerta') && !hay('entrepano')) {
    obs.push({ nivel: 'warning', pieza: conRol.find((c) => c._rol === 'gaveta')?.nombre,
      mensaje: 'Tienes una gaveta/cajón pero no veo un cuerpo que la contenga (costados, puertas o entrepaños). ¿Falta el gabinete, o la gaveta pertenece a otra sección?' });
  }

  // 2) Faldón vertical: su "ancho" suele ser la ALTURA. Confirmar.
  const faldon = conRol.find((c) => c._rol === 'faldon' && c.anchoMM);
  if (faldon) {
    obs.push({ nivel: 'info', pieza: faldon.nombre,
      mensaje: `Capturaste un faldón de ${faldon.largoMM}×${faldon.anchoMM} mm. Si es vertical, ${faldon.anchoMM} mm sería su ALTURA. ¿Correcto?` });
  }

  // 3) Asientos/respaldos sin estructura de soporte.
  const nAsiento = roles['asiento'] || 0;
  const nRespaldo = roles['respaldo'] || 0;
  if ((intencion === 'asientos' || nAsiento > 0 || nRespaldo > 0) && !hay('pata')) {
    obs.push({ nivel: 'warning',
      mensaje: 'Parece mobiliario de asiento, pero no veo estructura de soporte (patas, travesaño o base). Para uso público (aeropuerto) necesitas la estructura que los sostiene.' });
  }

  // 4) Espuma/tapizado sin asiento ni respaldo al que pertenezcan.
  if ((hay('espuma') || hay('tapiz')) && nAsiento === 0 && nRespaldo === 0) {
    obs.push({ nivel: 'info',
      mensaje: 'Hay espuma/tapizado pero no una pieza de asiento o respaldo a la que pertenezcan. ¿Falta nombrarlos?' });
  }

  // 5) Conector mencionado en la descripción pero no capturado.
  if (/\bconector(es)?\b/i.test(descripcion) && !hay('conector')) {
    obs.push({ nivel: 'info',
      mensaje: 'Mencionas conectores entre módulos, pero no hay una pieza "conector" en el despiece. ¿La agregamos?' });
  }

  // 6) Mueble de superficie sin cubierta.
  if (intencion === 'superficie' && !hay('cubierta')) {
    obs.push({ nivel: 'info', mensaje: 'Describes una superficie (mesa/escritorio/mostrador) pero no hay una cubierta en el despiece.' });
  }

  // 7) Coherencia de intención: la descripción dice asientos pero el despiece parece superficie.
  if (intencion === 'asientos' && hay('cubierta') && nAsiento === 0 && nRespaldo === 0) {
    obs.push({ nivel: 'warning',
      mensaje: 'La descripción habla de asientos, pero el despiece parece una superficie (cubierta) sin asientos/respaldos. Revisa si es el mueble correcto.' });
  }

  // 9) VH-163 · MUEBLE DE PISO SIN SOPORTE (bloqueo). Corrida V3 de la mesa de centro: la IA devolvió sólo la
  //    cubierta de cristal (confianza "alta", sin verificación) y el costo de $870 se transfirió a Cotizar sin la base
  //    tubular ni el cromado. Una cubierta no se sostiene sola: si el mueble es una mesa/escritorio/credenza/gabinete y
  //    no hay patas, base, estructura ni laterales, el despiece está INCOMPLETO y no se da el costo por bueno.
  //    (Una cubierta de reposición sola es legítima: por eso sólo aplica cuando la intención es el mueble completo.)
  const muebleCompleto = /\b(mesa|escritorio|mostrador|recepci[oó]n|credenza|gabinete|archivero|librero|alacena|table|desk)\b/i.test(descripcion)
    && !/reposici[oó]n|refacci[oó]n|repuesto|s[oó]lo (la )?cubierta|cubierta suelta/i.test(descripcion)
    // Auditoría 2026-10-14 (P1-07): si la descripción de la PERSONA empieza nombrando la cubierta ("Cubierta rectangular
    // 1500×600 App LT…"), el producto ES la cubierta (componente de catálogo), aunque la IA lo clasifique como "mesa".
    && !/^\s*(cubiertas?|tapas?|tops?|superficies?)\b/i.test(descripcion);
  if (muebleCompleto && hay('cubierta') && !hay('pata') && !hay('lateral')) {
    obs.push({ nivel: 'blocker', regla: 'sin_soporte',
      mensaje: 'El despiece tiene la cubierta pero ningún soporte (patas, base, estructura o laterales). Una cubierta no se sostiene sola: falta la base del mueble. Agrégala o vuelve a analizar antes de dar el costo por bueno.' });
  }

  // ---- REGLAS DE CASA (2026-10-12) · consistencia de materiales. Deterministas; avisan, no cambian solas.
  const nombreMat = (c) => (insumos && c.insumoId && insumos[c.insumoId] && insumos[c.insumoId].nombre) || c.material_solicitado || '';
  const fam = (c) => familiaDeMaterial(nombreMat(c));
  const PANEL_VISIBLE = new Set(['cubierta', 'lateral', 'entrepano', 'puerta', 'faldon', 'frente_cajon']);
  const PANELES = new Set(['melamina', 'laminado_hpl', 'chapa_madera', 'madera_solida']);
  const hayAcabadoTablero = conRol.some((c) => PANEL_VISIBLE.has(c._rol) && PANELES.has(fam(c)));
  // Laca/pintura PARA TABLERO (la electrostática del acero no cuenta: va en el metal).
  const hayLaca = conRol.some((c) => /\blaca|lacad|barniz|pintura.*(mdf|madera|tablero|repisa|panel)/i.test(`${c.nombre || ''} ${c.material_solicitado || ''}`));
  // 8) Pieza VISIBLE en MDF crudo mientras el resto va en melamina/laminado y no hay laca.
  if (hayAcabadoTablero && !hayLaca) {
    for (const c of conRol) {
      if (PANEL_VISIBLE.has(c._rol) && fam(c) === 'mdf') {
        obs.push({ nivel: 'warning', pieza: c.nombre, regla: 'acabado_consistente',
          mensaje: `«${c.nombre}» va en MDF crudo mientras el resto lleva melamina/laminado. O lleva laca (línea aparte) o cámbiala a melamina del mismo acabado; si no, se ve distinta.` });
      }
    }
  }
  // 9) Respaldo/fondo con sobre-espesor (> 12 mm): normalmente 9–12 mm; se avisa, no se cambia.
  for (const c of conRol) {
    if (c._rol !== 'respaldo' && c._rol !== 'fondo') continue;
    const esp = espesoresDe(nombreMat(c)).filter((x) => x <= 60);
    if (esp.length && Math.min(...esp) > REGLAS_TALLER.respaldo.espesorMaxMM) {
      obs.push({ nivel: 'info', pieza: c.nombre, regla: 'respaldo_espesor',
        mensaje: `«${c.nombre}» en ${Math.min(...esp)} mm: un respaldo/fondo suele ir en 9–12 mm (más barato y ligero). Déjalo si es portante o visible por detrás.` });
    }
  }
  // 10) Entrepaño/repisa con claro ≥ 800 mm: recomendar travesaño según la carga (no se agrega solo).
  for (const c of conRol) {
    if (c._rol !== 'entrepano') continue;
    const claro = Math.max(Number(c.largoMM) || 0, Number(c.anchoMM) || 0);
    if (claro >= REGLAS_TALLER.refuerzo.claroMM) {
      obs.push({ nivel: 'info', pieza: c.nombre, regla: 'refuerzo_claro',
        mensaje: `«${c.nombre}» tiene ${claro} mm de claro: si cargará productos pesados (≥ 15 kg), agrega un travesaño trasero o un canto grueso para que no pandee.` });
    }
  }

  if (obs.length === 0) obs.push({ nivel: 'info', mensaje: 'La estructura se ve coherente con las piezas capturadas.' });
  // ---- VALIDADORES MÍNIMOS DE INGENIERÍA (Entrega A, 2026-10-13). Deterministas: no corrigen solos; un BLOCKER impide
  //      emitir hasta que la persona corrija la pieza (o, en los que pueden ser legítimos, declare que lo revisó).
  if (ingenieria) validadoresIngenieria({ conRol, comps, descripcion, insumos, medidasGenerales, fam, obs });
  const ok = new Set(Array.isArray(aceptadas) ? aceptadas : []);
  for (const o of obs) if (o.clave && o.aceptable && ok.has(o.clave)) { o.nivel = 'info'; o.aceptada = true; o.mensaje = `Revisado por una persona: ${o.mensaje}`; }
  return { roles, observaciones: obs, resumen: { piezas: comps.length, intencion, nAsiento, nRespaldo } };
}


// ============================================================================
//  VALIDADORES MÍNIMOS DE INGENIERÍA (Entrega A de Costear, Dirección 2026-10-13: "que impidan aceptar despieces
//  absurdos"). Casos reales que los motivaron: biombo ATBIOCRT5 (soporte costeado como pintura), cubierta duplicada,
//  piezas más grandes que el mueble, puertas/cajones que no cuadran con lo pedido, cantidades imposibles.
//  `aceptable`: el validador puede equivocarse con algo legítimo (dos piezas iguales, conteo distinto a la descripción)
//  y la persona puede declarar que lo revisó. Medidas imposibles y material con función equivocada NO son aceptables:
//  se corrigen.
// ============================================================================
const MM = (x) => Math.round(Number(x) || 0);
/** "800 x 450 x 2000 mm" → [800, 450, 2000]; ignora números < 50 (no son medidas de mueble). */
export function medidasDe(texto = '') {
  const t = String(texto || '').toLowerCase().replace(/(\d),(\d{3})\b/g, '$1$2');
  // Auditoría 2026-10-14 (P2-03): primero un patrón dimensional explícito (A x B [x C]); sólo si no hay, los primeros
  // números razonables. Así un modelo, un RAL o un calibre escritos antes no desplazan largo/ancho/alto.
  const dim = t.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm|m)?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(?:mm|cm|m)?(?:\s*[x×*]\s*(\d+(?:\.\d+)?))?\s*(mm|cm|m)?\b/);
  if (dim) {
    const unidad = dim[4] || (/\d\s*cm\b/.test(dim[0]) ? 'cm' : '');
    const f = unidad === 'cm' ? 10 : unidad === 'm' ? 1000 : 1;
    const v = [dim[1], dim[2], dim[3]].filter((x) => x != null).map((x) => Number(x) * f);
    const enM = !unidad && v.every((n) => n < 50);
    const out = v.map((n) => (enM ? n * 1000 : n)).filter((n) => n >= 50 && n <= 20000);
    if (out.length >= 2) return out.slice(0, 3);
  }
  const crudos = (t.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  const enM = /\d\s*m\b/.test(t) && !/mm/.test(t) && crudos.every((n) => n < 50);
  return crudos.map((n) => (enM ? n * 1000 : n)).filter((n) => n >= 50 && n <= 20000).slice(0, 3);
}
const ROL_PANEL = new Set(['cubierta', 'lateral', 'entrepano', 'puerta', 'faldon', 'frente_cajon', 'respaldo', 'fondo']);
const FAM_NO_ES_PIEZA = new Set(['pintura_polvo', 'acabado_liquido', 'acabado_metal', 'tornilleria', 'adhesivo', 'tapacanto', 'soldadura', 'herraje_bisagra', 'herraje_corredera', 'herraje_jaladera', 'herraje_nivelador', 'herraje_cerradura', 'iluminacion', 'electrico']);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const NUMS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };
function cuantosPide(texto, rx) {
  const m = String(texto || '').toLowerCase().match(new RegExp(`\\b(\\d+|${Object.keys(NUMS).join('|')})\\s+${rx}`));
  return m ? (NUMS[m[1]] ?? Number(m[1])) : 0;
}

function validadoresIngenieria({ conRol, comps, descripcion, insumos, medidasGenerales, fam, obs }) {
  // (1) MEDIDAS IMPOSIBLES: una pieza de tablero más grande que el mueble completo.
  const gen = medidasDe(medidasGenerales).sort((a, b) => b - a);
  if (gen.length >= 2) {
    const tol = 60;   // cantos, sobrepuestos y vuelos razonables
    for (const c of conRol) {
      const l = MM(c.largoMM), a = MM(c.anchoMM);
      if (!(l > 0 && a > 0) || !ROL_PANEL.has(c._rol)) continue;
      const [p1, p2] = [Math.max(l, a), Math.min(l, a)];
      if (p1 > gen[0] + tol || p2 > gen[1] + tol) {
        obs.push({ nivel: 'blocker', regla: 'medida_imposible', clave: `medida_imposible:${c.nombre}`, pieza: c.nombre,
          mensaje: `«${c.nombre}» mide ${l}×${a} mm y el mueble completo mide ${gen.join('×')} mm: una pieza no puede ser más grande que el mueble. Corrige la medida.` });
      }
    }
  }
  // (2) MATERIAL CON FUNCIÓN EQUIVOCADA: un panel o un soporte costeado con pintura, tornillería, canto, adhesivo…
  //     Se omite el renglón cuyo NOMBRE es el propio material ("Pintura electrostática base", "Tapacanto…").
  for (const c of conRol) {
    if (!c.insumoId) continue;
    const f = fam(c); if (!FAM_NO_ES_PIEZA.has(f)) continue;
    if (familiaDeMaterial(c.nombre || '') === f || c._rol === 'herraje') continue;
    if (ROL_PANEL.has(c._rol) || c._rol === 'pata' || c._rol === 'cristal') {
      obs.push({ nivel: 'blocker', regla: 'material_funcion', clave: `material_funcion:${c.nombre}`, pieza: c.nombre,
        mensaje: `«${c.nombre}» es una pieza (${c._rol === 'pata' ? 'estructura/soporte' : c._rol}) pero está costeada con ${(insumos && insumos[c.insumoId]?.nombre) || c.insumoId}, que es ${f.replace('_', ' ')}. Asígnale el material de la pieza; el acabado va en su propio renglón.` });
    }
  }
  // (2b) ACABADO COSTEADO COMO MATERIAL (lab credenza ronda 3, 2026-10-13): "Barniz chapa nogal" quedó amarrado a
  //      chapa-madera y se cobraron 3.5 m² de chapa. Un renglón que EMPIEZA por un acabado (barniz, laca, sellador,
  //      tinta, pintura) no puede costearse con un tablero/chapa/metal.
  // P1-MAT-02: la MISMA taxonomía que el motor (materialMatch): un renglón es acabado si su familia lo es.
  const FAM_MATERIAL_BASE = new Set(['melamina', 'mdf', 'laminado_hpl', 'chapa_madera', 'madera_solida', 'triplay', 'metal_lamina', 'acero_inoxidable', 'aluminio', 'cristal']);
  for (const c of comps) {
    if (!c.insumoId || c.excluida || !FAMILIAS_ACABADO.has(familiaDeMaterial(c.nombre || ''))) continue;
    const f = familiaDeMaterial((insumos && insumos[c.insumoId]?.nombre) || c.insumoId);
    if (FAM_MATERIAL_BASE.has(f)) obs.push({ nivel: 'blocker', regla: 'material_funcion', clave: `material_funcion:${c.nombre}`, pieza: c.nombre,
      mensaje: `«${c.nombre}» es un acabado pero está costeado con ${(insumos && insumos[c.insumoId]?.nombre) || c.insumoId} (${f.replace('_', ' ')}): se cobraría como material. Asígnale el insumo del acabado o quítalo si ya va incluido.` });
  }
  // (3) DUPLICADOS: mismo nombre, mismas medidas y mismo material en dos renglones.
  const vistos = new Map();
  for (const c of comps) {
    if (!c.nombre || c.excluida) continue;
    const k = `${norm(c.nombre)}|${MM(c.largoMM)}|${MM(c.anchoMM)}|${c.insumoId || ''}`;
    if (vistos.has(k)) obs.push({ nivel: 'blocker', aceptable: true, regla: 'duplicado', clave: `duplicado:${norm(c.nombre)}`, pieza: c.nombre,
      mensaje: `«${c.nombre}» aparece dos veces con las mismas medidas y material: probablemente es la misma pieza contada dos veces. Quita una o, si de verdad son dos renglones distintos, márcalo como revisado.` });
    else vistos.set(k, c);
  }
  // (4) CANTIDADES INCOMPATIBLES con lo que dice la descripción (puertas, cajones).
  // Una CAJONERA declara sus gavetas en el nombre ("Cajonera móvil 3 gavetas"): cuenta como esas gavetas, no como una
  // (certificación 18-oct, escritorio en L: bloqueaba "pide 3 cajón(es) y el despiece trae 1").
  const RX_CAJONES = '(?:cajon(?:es)?|cajón|gavetas?)';
  const unidades = (c) => (c._rol === 'gaveta' && /\bcajonera\b/i.test(c.nombre || '') ? (cuantosPide(c.nombre, RX_CAJONES) || 1) : 1);
  const contar = (rol) => conRol.filter((c) => c._rol === rol && !c.excluida).reduce((s, c) => s + (Number(c.piezas) > 0 ? Number(c.piezas) : 1) * (c.largoMM ? 1 : Math.max(1, Number(c.cantidad) || 1)) * unidades(c), 0);
  for (const [rol, rx, nombre] of [['puerta', 'puertas?', 'puerta(s)'], ['frente_cajon', RX_CAJONES, 'cajón(es)']]) {
    const pide = cuantosPide(descripcion, rx); const hay = rol === 'frente_cajon' ? contar('frente_cajon') + contar('gaveta') : contar(rol);
    if (pide > 0 && hay > 0 && hay !== pide) obs.push({ nivel: 'blocker', aceptable: true, regla: 'cantidad_incompatible', clave: `cantidad_incompatible:${rol}`,
      mensaje: `La descripción pide ${pide} ${nombre} y el despiece trae ${hay}. Corrige las cantidades o márcalo como revisado si la descripción estaba mal.` });
  }
  // (4b) LA IA SE CONTRADICE: su razonamiento declara una medida y el renglón trae otra (mapIaComps → iaIncoherencia).
  for (const c of comps) {
    if (c.excluida || !c.iaIncoherencia) continue;
    const x = c.iaIncoherencia;
    obs.push({ nivel: 'blocker', aceptable: true, regla: 'ia_incoherente', clave: `ia_incoherente:${c.nombre}`, pieza: c.nombre,
      mensaje: x.campo === 'cantidadLineal'
        ? `«${c.nombre}»: no queda claro si ${x.dice} son piezas o metros. Se costea como ${x.piezas} pieza(s) de ${x.largoMM} mm = ${x.puso} m. Confirma cuántas piezas lleva y de qué largo, o márcalo como revisado si ${x.puso} m es lo correcto.`
        : x.campo === 'metrosTotales'
        ? `«${c.nombre}»: la IA declara ${x.dice} m en total, pero ${x.piezas} pieza(s) de ${x.largoMM} mm suman ${x.puso} m. Corrige piezas o largo, o márcalo como revisado si ${x.puso} m es lo correcto.`
        : x.campo === 'cantidadPiezas'
        ? `«${c.nombre}»: la IA puso ${x.dice} como cantidad de una pieza de lámina/tablero (no es un número de piezas). Se costea 1 pieza de ${c.largoMM} × ${c.anchoMM} mm: confirma cuántas piezas lleva, o márcalo como revisado si es 1.`
        : x.campo === 'largoTotal'
        ? `«${c.nombre}»: la IA dice "largo total ${x.dice} mm" pero el renglón suma ${x.puso} mm (revisa largo × cantidad). Corrígelo, o márcalo como revisado si ${x.puso} mm es lo correcto.`
        : `«${c.nombre}»: la IA dice ${x.dice} mm en su razonamiento pero puso ${x.puso} mm. Revisa la medida en el plano y corrígela, o márcalo como revisado si ${x.puso} mm es la correcta.` });
  }
  // (4c) EL TOTAL DECLARADO NO CUADRA: la IA escribe "TOTAL 7.17 m" de un material lineal y sus renglones suman otra cosa.
  //      SRV-01: se calcula AQUÍ desde la evidencia del renglón (ia_totales_declarados_m) — misma función en cliente y
  //      servidor —; el marcador precalculado de mapIaComps sólo cuenta si un material no trae evidencia.
  const porEvidencia = totalesLinealesIncoherentes(comps, insumos);
  const conEvidencia = new Set(porEvidencia.map((x) => x.material));
  for (const c of comps) {
    if (c.excluida) continue;
    const x = porEvidencia.find((p) => p.comp === c) || (c.iaTotalIncoherente && !conEvidencia.has(c.iaTotalIncoherente.material) ? c.iaTotalIncoherente : null);
    if (!x) continue;
    obs.push({ nivel: 'blocker', aceptable: true, regla: 'ia_incoherente', clave: `ia_total_incoherente:${x.material}`, pieza: c.nombre,
      mensaje: `La IA declara un total de ${x.dice} m de ${c.material_solicitado || x.material}, pero sus ${x.renglones} renglón(es) suman ${x.puso} m. Revisa cantidades y largos (p. ej. «${c.nombre}»), o márcalo como revisado si ${x.puso} m es lo correcto.` });
  }
  // (5) CANTIDADES IMPOSIBLES: piezas o cantidades ≤ 0 o absurdas.
  for (const c of comps) {
    if (c.excluida) continue;
    const pz = Number(c.piezas ?? 1), cant = Number(c.cantidad ?? 1);
    if (!(pz > 0) || !(cant > 0) || pz > 500 || (c.largoMM && cant > 500)) obs.push({ nivel: 'blocker', regla: 'cantidad_imposible', clave: `cantidad_imposible:${c.nombre}`, pieza: c.nombre,
      mensaje: `«${c.nombre}» tiene ${pz} pieza(s) × ${cant}: no es una cantidad fabricable. Corrígela.` });
  }
  // (6) GEOMETRÍA NO VERIFICABLE: un panel de tablero sin largo×ancho ni fracción de hoja (su consumo no se puede revisar).
  for (const c of conRol) {
    if (!ROL_PANEL.has(c._rol) || c.excluida || !c.insumoId) continue;
    if (!['melamina', 'mdf', 'laminado_hpl', 'chapa_madera', 'madera_solida', 'triplay'].includes(fam(c))) continue;
    if (!(MM(c.largoMM) > 0 && MM(c.anchoMM) > 0) && !(Number(c.hojas) > 0)) obs.push({ nivel: 'warning', regla: 'geometria_no_verificable', pieza: c.nombre,
      mensaje: `«${c.nombre}» es de tablero pero no tiene largo×ancho: su consumo no se puede verificar. Captura sus medidas.` });
  }
}
