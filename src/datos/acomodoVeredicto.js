// ============================================================================
//  VEREDICTO DEL ACOMODO, EXPLICADO POR BLOQUES (VH-110 / VH-111)
//
//  El edge devuelve `layoutSpec.status` ∈ PASS | REVIEW_REQUIRED | PARTIAL | FAIL |
//  NEEDS_SEMANTIC_REVIEW | QUALITY_REVIEW_REQUIRED | NEEDS_REVIEW_METADATA, y el
//  agregador del cliente (acomodoInvariantes) lo combina con sus propias invariantes.
//  Antes el cliente resumía todo lo que no fuera PASS como "requiere revisión:
//  invariantes" aunque ninguna invariante hubiera fallado, y los estados que no
//  conocía los pintaba como "el servidor no devolvió validación". Aquí se separa, con
//  texto para una persona, QUÉ ya está validado y QUÉ falta revisar:
//    geometria · colisiones · programa · anclas · semantica · evidencia · publicable
//  Puro: sin red ni React. Nunca convierte una revisión legítima en PASS.
// ============================================================================

export const ESTADOS_SERVIDOR = ['PASS', 'REVIEW_REQUIRED', 'PARTIAL', 'FAIL', 'NEEDS_SEMANTIC_REVIEW', 'QUALITY_REVIEW_REQUIRED', 'NEEDS_REVIEW_METADATA', 'NEEDS_REVIEW'];

export const TEXTO_ESTADO_SERVIDOR = {
  PASS: 'acomodo validado por el servidor',
  REVIEW_REQUIRED: 'acomodo válido, con puntos a revisar',
  PARTIAL: 'acomodo parcial: hay muebles sin colocar',
  FAIL: 'el servidor no pudo colocar ningún mueble',
  NEEDS_SEMANTIC_REVIEW: 'geometría válida; falta la revisión semántica (orientación y asientos de los kits)',
  QUALITY_REVIEW_REQUIRED: 'geometría y semántica válidas; la calidad del acomodo (accesos, agrupación) requiere revisión',
  NEEDS_REVIEW_METADATA: 'geometría válida; faltan perfiles de colocación del catálogo para juzgar la semántica',
  NEEDS_REVIEW: 'acomodo con observaciones que requieren revisión',
  SIN_VALIDACION: 'el servidor no devolvió validación del acomodo',
};

// UX (12-oct): en pantalla va el NOMBRE del mueble, nunca el id interno («d-1»). `nombreDe` lo resuelve
// quien tiene la lista de piezas (AcomodoBase); sin resolutor se conserva el id entre comillas.
const etiqueta = (id, nombreDe) => { const n = typeof nombreDe === 'function' ? nombreDe(id) : null; return n ? `«${n}»` : `«${id}»`; };
const idDe = (i, nd) => (i?.id != null ? ` ${etiqueta(i.id, nd)}` : '');
const anclaDe = (i, nd) => (i?.anchor != null ? ` de ${etiqueta(i.anchor, nd)}` : '');

// Códigos del juez semántico del edge (semanticPlacementJudge.js) en palabras.
const TEXTO_SEMANTICO = {
  SEMANTIC_PROFILE_UNKNOWN: (i, nd) => `el catálogo no dice de qué lados se sienta la gente en ${i?.anchor != null ? etiqueta(i.anchor, nd) : 'un mueble'}: revísalo a mano`,
  SLOT_UNFILLED_REQUIRED: (i, nd) => `falta una silla en ${i?.slot ? `el lugar «${i.slot}» ` : 'un lugar '}${anclaDe(i, nd).trim()}`,
  DEPENDENT_WRONG_SLOT: (i, nd) => `silla${idDe(i, nd)} en un lugar que no corresponde a su mueble`,
  KIT_FUNCTIONAL_RELATION_BROKEN: (i, nd) => `pieza${idDe(i, nd)} no es del tipo que su mueble espera (${i?.rol || '?'} vs ${i?.esperado || '?'})`,
  ANCHOR_TOPOLOGY_BROKEN: (i, nd) => `${etiqueta(i?.anchor ?? '?', nd)} tiene sillas sólo de un lado y es de dos caras`,
  SLOT_DOUBLE_OCCUPIED: (i, nd) => `dos sillas en el mismo lugar${anclaDe(i, nd)}`,
  INVALID_FACING: (i, nd) => `silla${idDe(i, nd)} sin orientación conocida`,
  DEPENDENT_WRONG_ORIENTATION: (i, nd) => `silla${idDe(i, nd)} no mira a su mesa/escritorio`,
  ACTIVE_SIDE_BLOCKED_BY_WALL: (i, nd) => `silla${idDe(i, nd)} pegada al muro: no hay espacio para sentarse`,
  ACTIVE_SIDE_BLOCKED_BY_OBSTACLE: (i, nd) => `silla${idDe(i, nd)} bloqueada por una columna u obstáculo`,
  ACTIVE_SIDE_ACCESS_TIGHT: (i, nd) => `silla${idDe(i, nd)} con acceso justo (${i?.clear ?? '?'} mm; se buscan ${i?.target ?? '?'} mm)`,
};

export function textoSemantico(issue, nombreDe = null) {
  const code = String(issue?.code || '').trim();
  if (TEXTO_SEMANTICO[code]) return TEXTO_SEMANTICO[code](issue, nombreDe);
  return `observación semántica del servidor: ${code || 'SIN_CÓDIGO'}${idDe(issue, nombreDe)}`;
}

// Observaciones semánticas disponibles en el plan: la lista completa si el edge la manda
// (`seleccion.ganador_eval.sem_issues`), si no, los conteos de `semantic_gate`.
export function observacionesSemanticas(layoutSpec, nombreDe = null) {
  const gate = layoutSpec?.validation?.semantic_gate || null;
  const lista = layoutSpec?.seleccion?.ganador_eval?.sem_issues;
  const estadoSem = gate?.sem_status || layoutSpec?.seleccion?.ganador_eval?.sem_status || null;
  if (Array.isArray(lista)) {
    return {
      estado: estadoSem,
      fallas: lista.filter((i) => i.severity === 'fail').map((i) => textoSemantico(i, nombreDe)),
      revisiones: lista.filter((i) => i.severity !== 'fail').map((i) => textoSemantico(i, nombreDe)),
      conteo: { fail: lista.filter((i) => i.severity === 'fail').length, review: lista.filter((i) => i.severity !== 'fail').length },
      detalleDisponible: true,
    };
  }
  const fail = Number(gate?.semFail ?? layoutSpec?.seleccion?.ganador_eval?.semFail ?? 0) || 0;
  const review = Number(gate?.semReview ?? layoutSpec?.seleccion?.ganador_eval?.semReview ?? 0) || 0;
  return { estado: estadoSem, fallas: [], revisiones: [], conteo: { fail, review }, detalleDisponible: false };
}

const CLASE_DE_CODIGO = [
  [/OVERLAP|DOOR|CLEARANCE|CIRCUL|PASILLO|BLOCK|OBSTACLE|HITS_/, 'colisiones'],
  [/OUT_OF_BOUNDS|OUTSIDE|BOUND|AREA_INEXISTENTE|INVALID_AREA|INVALID_COORD|GHOST|DUPLICATE_PLACEMENT|PLACEMENT_INVARIANT|MISSING_PLACEMENT|WRONG_ZONE|RESTROOM|TECHNICAL/, 'geometria'],
  [/ANCHOR|DEPENDENT|SLOT|KIT|UNASSIGNED/, 'anclas'],
];
const claseDe = (code) => (CLASE_DE_CODIGO.find(([re]) => re.test(String(code || '')))?.[1]) || 'otros';
const TEXTO_INVARIANTE = {
  OVERLAP: 'muebles encimados',
  BLOCKS_DOOR: 'un mueble tapa una puerta',
  HITS_OBSTACLE: 'un mueble choca con una columna u obstáculo',
  DOOR_SWING_UNKNOWN: 'barrido de puerta sin verificar',
  OUT_OF_BOUNDS: 'un mueble se sale de su cuarto',
  AREA_INEXISTENTE: 'un mueble apunta a un cuarto que no existe',
  GHOST_PLACEMENT: 'colocación de un mueble que no está en la lista',
  DUPLICATE_PLACEMENT: 'un mueble colocado dos veces',
  PLACEMENT_INVARIANT_BROKEN: 'inconsistencia interna en la colocación',
  ANCHOR_WRONG_ZONE: 'un ancla en una zona que no le corresponde',
  DEPENDENT_WRONG_ZONE: 'una silla/guarda en otro cuarto que su mueble',
  DEPENDENT_DETACHED: 'una silla/guarda lejos de su mueble',
  DEPENDENT_UNASSIGNED: 'silla/guarda sin mueble que la reciba',
};
const textoInvariante = (i, nombreDe = null) => {
  const code = String(i?.code || '');
  const base = TEXTO_INVARIANTE[code] || code.toLowerCase().replace(/_/g, ' ');
  const nom = (id) => (typeof nombreDe === 'function' && nombreDe(id)) || String(id);
  const n = Array.isArray(i?.ids) && i.ids.length ? ` (${i.ids.slice(0, 3).map(nom).join(', ')}${i.ids.length > 3 ? '…' : ''})` : (i?.id != null ? ` (${etiqueta(i.id, nombreDe)})` : '');
  return `${base}${n}`;
};

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

/**
 * @param {object} o
 * @param {object|null} o.plan           plan vivo o guardado (con layoutSpec, invariantes, unassigned, no_cupieron)
 * @param {object|null} o.evaluacion     evaluación del agregador (status, issues, unplaced) si está en memoria
 * @param {boolean}     o.programaListo
 * @param {string}      o.motivoPrograma
 * @param {Array}       o.referencias    piezas sin identidad de catálogo ni precio (VH-092)
 * @param {boolean}     o.preliminar     medidas supuestas / productos sin precio autorizado
 * @param {Array}       o.nombresSinColocar  nombres de las piezas sin colocar (para el texto)
 */
// VH-120 · capacidad por ancla con su FUENTE (del edge: layoutSpec.validation.capacidad). Lo estimado por
// geometría se dice como preliminar; lo declarado que no cabe se dice con números; nada se oculta.
const TEXTO_FUENTE = { CATALOGO: 'ficha del catálogo', USUARIO: 'declarada por ti', INFERIDA: 'leída del nombre', DECLARADA: 'declarada', GEOMETRICA: 'estimada por geometría (preliminar)' };
export function notasCapacidad(layoutSpec) {
  const lista = Array.isArray(layoutSpec?.validation?.capacidad) ? layoutSpec.validation.capacidad : [];
  const out = [];
  for (const c of lista) {
    const nombre = String(c.nombre || c.id || 'ancla').slice(0, 40);
    if (c.conflicto === 'CAPACIDAD_SUPERA_GEOMETRIA') out.push(`${nombre}: capacidad ${TEXTO_FUENTE[c.fuente] || c.fuente} ${c.declarada}, pero geométricamente caben ${c.tope_geometrico} (una silla cada 600 mm por cara): se sientan ${c.usada}, el resto queda sin lugar`);
    else if (c.conflicto === 'CAPACIDAD_ESTIMADA') out.push(`${nombre}: capacidad ${c.usada} ${TEXTO_FUENTE.GEOMETRICA}, no es capacidad industrial`);
  }
  return uniq(out);
}

export function explicarAcomodo({ plan = null, evaluacion = null, programaListo = true, motivoPrograma = '', referencias = [], preliminar = false, nombresSinColocar = [], nombreDe = null } = {}) {
  const textoInv = (i) => textoInvariante(i, nombreDe);
  const spec = plan?.layoutSpec || null;
  const statusSrv = String(spec?.status || '').toUpperCase() || null;
  const issues = (evaluacion?.issues || plan?.invariantes?.issues || spec?.validation?.issues || []).filter(Boolean);
  const fallas = issues.filter((i) => i.severity === 'fail');
  const revisiones = issues.filter((i) => i.severity !== 'fail');
  const porClase = (lista, clase) => lista.filter((i) => claseDe(i.code) === clase);
  const sinColocar = (evaluacion?.unplaced || plan?.invariantes?.unplaced || spec?.unplaced || []);
  const nSin = Array.isArray(sinColocar) ? sinColocar.length : Number(sinColocar) || 0;
  const unassigned = Array.isArray(plan?.unassigned) ? plan.unassigned : [];
  const noCupieron = Array.isArray(plan?.no_cupieron) ? plan.no_cupieron : [];
  const sem = observacionesSemanticas(spec, nombreDe);
  const renderReady = plan?.render_ready === true || spec?.validation?.render_ready === true;
  const statusAgg = String(evaluacion?.status || plan?.invariantes?.status || '').toUpperCase() || null;

  const bloques = [];
  // 1 · Geometría (dentro del cuarto, cuartos válidos, sin fantasmas).
  const geoF = porClase(fallas, 'geometria');
  bloques.push({ clave: 'geometria', titulo: 'Geometría', ok: !plan ? null : geoF.length === 0,
    texto: !plan ? 'sin acomodo todavía' : geoF.length ? uniq(geoF.map(textoInv)).join(' · ') : 'todos los muebles dentro de su cuarto' });
  // 2 · Colisiones y circulación.
  const colF = porClase(fallas, 'colisiones'); const colR = porClase(revisiones, 'colisiones');
  // ok sólo cuando no hay fallas NI revisiones pendientes (una puerta sin verificar no está validada).
  bloques.push({ clave: 'colisiones', titulo: 'Colisiones y circulación', ok: !plan ? null : (colF.length === 0 && colR.length === 0),
    texto: !plan ? '—' : colF.length ? uniq(colF.map(textoInv)).join(' · ') : (colR.length ? `sin colisiones; por revisar: ${uniq(colR.map(textoInv)).join(' · ')}` : 'sin encimados ni puertas tapadas') });
  // 3 · Programa comercial.
  bloques.push({ clave: 'programa', titulo: 'Programa comercial', ok: !!programaListo,
    texto: programaListo ? 'anclas del programa confirmadas' : (motivoPrograma || 'programa incompleto') });
  // 4 · Anclas y dependientes.
  const ancF = porClase(fallas, 'anclas');
  const nombres = uniq([...nombresSinColocar, ...unassigned.map((u) => u?.nombre), ...noCupieron.map((u) => u?.nombre)]);
  const anclasOk = ancF.length === 0 && nSin === 0 && unassigned.length === 0;
  const capNotas = notasCapacidad(spec);
  const textoAnclas = !plan ? '—' : anclasOk ? 'cada silla y guarda tiene su mueble y su lugar'
    : uniq([
      nSin ? `${nSin} sin colocar${nombres.length ? `: ${nombres.slice(0, 4).join(', ')}${nombres.length > 4 ? '…' : ''}` : ''}` : '',
      ...ancF.map(textoInv),
    ]).join(' · ');
  bloques.push({ clave: 'anclas', titulo: 'Anclas y dependientes', ok: !plan ? null : anclasOk,
    texto: capNotas.length ? `${textoAnclas} · ${capNotas.join(' · ')}` : textoAnclas, capacidad: capNotas });
  // 5 · Revisión semántica (orientación, asientos, topología de kits).
  const semOk = !plan ? null : (statusSrv === 'PASS' || sem.estado === 'PASS' || (!sem.estado && statusSrv !== 'NEEDS_SEMANTIC_REVIEW' && statusSrv !== 'NEEDS_REVIEW_METADATA'));
  let semTexto;
  if (!plan) semTexto = '—';
  else if (semOk) semTexto = 'orientación y asientos de los kits aprobados por el servidor';
  else if (statusSrv === 'NEEDS_REVIEW_METADATA') semTexto = 'faltan perfiles de colocación del catálogo (topología de las anclas) para juzgarla';
  else if (sem.detalleDisponible) semTexto = uniq([...sem.fallas, ...sem.revisiones]).join(' · ') || 'sin detalle';
  else semTexto = `${sem.conteo.fail ? `${sem.conteo.fail} falla(s)` : ''}${sem.conteo.fail && sem.conteo.review ? ' y ' : ''}${sem.conteo.review ? `${sem.conteo.review} observación(es)` : ''}${(sem.conteo.fail || sem.conteo.review) ? ' de orientación/asientos de los kits' : 'pendiente'} (el servidor no detalló cuáles en esta versión)`;
  bloques.push({ clave: 'semantica', titulo: 'Revisión semántica', ok: semOk, texto: semTexto });
  // 6 · Evidencia de medidas y productos.
  const nRef = Array.isArray(referencias) ? referencias.length : 0;
  const evOk = nRef === 0 && !preliminar;
  bloques.push({ clave: 'evidencia', titulo: 'Evidencia de medidas', ok: evOk,
    texto: evOk ? 'medidas y productos con identidad de catálogo' : uniq([
      nRef ? `${nRef} mueble(s) sin identidad de catálogo ni precio` : '',
      preliminar ? 'medidas supuestas por tipo o productos sin precio autorizado' : '',
    ]).join(' · ') });
  // 7 · Resultado publicable.
  const todoOk = bloques.every((b) => b.ok === true);
  const publicable = !!plan && todoOk && renderReady && (statusSrv === 'PASS' || statusAgg === 'PASS' || (!statusSrv && !statusAgg));
  const quality = statusSrv === 'QUALITY_REVIEW_REQUIRED' ? 'la calidad del acomodo (accesos, agrupación) requiere revisión' : '';
  bloques.push({ clave: 'publicable', titulo: 'Resultado publicable', ok: !plan ? null : publicable,
    texto: !plan ? '—' : publicable ? 'listo para render y PDF' : (quality || 'borrador: no se publica como VALIDADO hasta cerrar lo pendiente') });

  const pendientes = bloques.filter((b) => b.ok === false && b.clave !== 'publicable').map((b) => `${b.titulo.toLowerCase()}: ${b.texto}`);
  if (quality && !pendientes.length) pendientes.push(quality);
  // Otras revisiones (no clasificadas) del agregador o del edge: se dicen, nunca se pierden.
  const otrasR = revisiones.filter((i) => claseDe(i.code) === 'otros');
  if (otrasR.length) pendientes.push(`por revisar: ${uniq(otrasR.map(textoInv)).join(' · ')}`);
  if (!pendientes.length && plan && (statusSrv === 'REVIEW_REQUIRED' || statusSrv === 'NEEDS_REVIEW')) pendientes.push('observaciones del servidor por revisar');
  const estado = !plan ? 'SIN_PLAN'
    : (fallas.length || statusSrv === 'FAIL') ? 'FALLA'
      : (nSin > 0 || statusSrv === 'PARTIAL') ? 'PARCIAL'
        : (pendientes.length ? 'REVISION' : 'PASS');
  const resumen = estado === 'PASS' ? '' : (estado === 'PARCIAL' ? `parcial: faltan ${nSin} por colocar${pendientes.length ? ' · ' + pendientes.filter((p) => !p.startsWith('anclas')).join(' · ') : ''}` : pendientes.join(' · '));
  return { estado, statusServidor: statusSrv, resumen, pendientes, bloques, semantica: sem };
}

// Texto corto para la auditoría "Validación del servidor" (VH-111): con el estado real del
// edge, incluidas las revisiones semánticas; nunca "no devolvió validación" si sí la devolvió.
export function describirValidacionServidor(layoutSpec, metodo = null) {
  const s = String(layoutSpec?.status || '').toUpperCase();
  const estado = ESTADOS_SERVIDOR.includes(s) ? s : 'SIN_VALIDACION';
  let detalle = TEXTO_ESTADO_SERVIDOR[estado];
  if (estado === 'NEEDS_SEMANTIC_REVIEW') {
    const sem = observacionesSemanticas(layoutSpec);
    const lista = uniq([...sem.fallas, ...sem.revisiones]);
    if (lista.length) detalle += `: ${lista.slice(0, 3).join(' · ')}${lista.length > 3 ? ` (+${lista.length - 3})` : ''}`;
    else if (sem.conteo.fail || sem.conteo.review) detalle += ` (${sem.conteo.fail} falla(s), ${sem.conteo.review} observación(es))`;
  }
  return { estado, ok: estado === 'PASS', detalle: `${detalle}${metodo ? ` · ${metodo}` : ''}` };
}
