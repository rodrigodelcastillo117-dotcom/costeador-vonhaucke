// ============================================================================
//  DTO ESTRICTO + CONTRATO DE CÁLCULO (arquitectura server-authority).
//  El navegador manda una INTENCIÓN TÉCNICA; jamás dinero. Este validador es la
//  frontera: rechaza cualquier campo económico y normaliza el contrato de salida.
//
//  Contrato:
//    { ok: true,  intent }                          ← intención saneada, lista para el motor
//    { ok: false, code, issues: [{field, msg}] }    ← 400; NUNCA NaN/Infinity/null ambiguo
//
//  Lo usa el frontend ANTES de mandar (UX) y lo espeja `costear-servidor` (seguridad).
//  UX-validation != security: deben existir en ambos niveles.
//
//  AUTORIDAD DE MATERIAL (audit 2026-10-08, P0.5/P0.6): el `material_match` del cliente NO
//  es autoridad. Aquí sólo se valida que, SI viene, sea un estado CONOCIDO (enum estricto:
//  desconocido ⇒ 400, nunca "seguro por omisión"). La CLASE EFECTIVA la recalcula el
//  servidor (costear-servidor) con `reconciliarMaterialServidor` contra el catálogo
//  autoritativo. La confirmación humana viaja en el campo dedicado `material_confirmado`
//  (intención), no en el string de match.
// ============================================================================
import { MATCH_VALIDOS } from './materialMatch.js';
import { promesaDeOrigen } from './promesaComercial.js';

// Campos económicos PROHIBIDOS en la intención del cliente (a cualquier profundidad).
// El cliente no define dinero: precio/costo/margen/factores/proveedor/insumo inline.
const PROHIBIDOS = /^(margen|precio|preciobase|precioreal|preciounitario|costo|costounitario|proveedor|factordirecta|factorindirecta|parmodelo|modelocosteo|insumo|rol|utilidad|markup|descuento)$/i;

// Campos permitidos por componente (allowlist). Cualquier otro se ignora al sanear;
// pero un objeto `insumo` inline o un `precio` se RECHAZAN (no se ignoran en silencio).
// `nombre` es TÉCNICO (etiqueta/trazabilidad: alimenta `componentesIgnorados` y el
// desglose del motor), NO económico; se permite pero se coacciona a string y se acota.
// Se EXCLUYE a propósito `excluida`: marcar una partida como $0 es una decisión
// comercial que vive en la Cotización (con confirmación humana), no en la intención
// cruda de costeo — dejar que el cliente la mande aquí sería una fuga fail-OPEN.
const COMP_PERMITIDOS = ['insumoId', 'nombre', 'cantidad', 'largoMM', 'anchoMM', 'piezas', 'hojas', 'material_solicitado', 'material_match', 'material_confirmado', 'engineering_override', 'override_motivo',
  // A14 (2026-10-12): pintura en polvo por área pintada (m²) y bandera tubular → el motor convierte a kg (8 m²/kg).
  'areaPintadaM2', 'tubular',
  // Auditoría 2026-10-14 (P1-01): procedencia de la pieza (OBSERVADO/INFERIDO/SUPUESTO) y si una persona confirmó que
  // EXISTE. Son técnicos, no económicos: con ellos el servidor no certifica un costo con piezas inferidas sin confirmar.
  'procedencia', 'pieza_confirmada',
  // SRV-01 (cierre ChatGPT v3): EVIDENCIA técnica para que el servidor repita el diagnóstico "la IA declara TOTAL X m y
  // sus renglones suman Y" con la MISMA función que el cliente (revisionEstructural). No mueve dinero: sólo bloquea.
  'ia_totales_declarados_m'];

// MATERIAL_PENDING (P0-05): estados de match en los que la IA NO asignó insumoId
// porque el catálogo no tiene la familia/precio. El componente NO se inventa ni se
// elimina: sobrevive con insumoId='' y el motor lo bloquea (componentesIgnorados →
// costeoEmitible: costoTotal=null, emitible=false). Nunca $0 silencioso.
const MATCH_PENDIENTE = new Set([
  'NOT_AVAILABLE', 'SUBSTITUTE_SUGGESTED', 'SUBSTITUTE_REQUIRES_CONFIRMATION',
  'PENDING_MATERIAL', 'PENDING_PRICE', 'PENDING_PURCHASING',
  // Clases "por confirmar" SIN insumoId (audit 2026-10-08): el candidato se MUESTRA pero no
  // entra al costo hasta confirmación humana. Sobreviven al contrato (insumoId='') y el motor
  // las bloquea vía materialesPorConfirmar. (SAME_FAMILY_COMPATIBLE_PROPOSED NO va aquí: sí
  // trae insumoId y cuesta provisional; su material_match viaja igual y el motor lo bloquea.)
  'SAME_FAMILY_CRITICAL_CONFLICT', 'AMBIGUOUS', 'CANDIDATE_REQUIRES_CONFIRMATION',
]);

// Estados de match que el DTO ACEPTA estructuralmente: el enum canónico (MATCH_VALIDOS) +
// los alias de pendiente legados (MATCH_PENDIENTE). Cualquier otro string ⇒ 400 (P0.6,
// fail-closed). No confiere seguridad: la clase EFECTIVA la recalcula el servidor; esto sólo
// frena basura/spoof estructural (p.ej. 'TODO_BIEN_CONFIA_EN_MI').
const MATCH_ACEPTADOS = new Set([...MATCH_VALIDOS, ...MATCH_PENDIENTE]);

function buscarProhibido(obj, ruta = '') {
  if (obj == null || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const hit = buscarProhibido(obj[i], `${ruta}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (PROHIBIDOS.test(k)) return `${ruta}.${k}`.replace(/^\./, '');
    const hit = buscarProhibido(v, `${ruta}.${k}`);
    if (hit) return hit;
  }
  return null;
}

const finito = (x) => typeof x === 'number' && Number.isFinite(x);
const entero = (x) => finito(x) && Number.isInteger(x);

/**
 * Valida y sanea una intención de costeo del cliente.
 * @param {object} body  { producto?, version?, contexto?, cantidad, pieza:{componentes:[...], horas?} }
 * @returns {{ok:true,intent}|{ok:false,code,issues}}
 */
export function validarIntentCosteo(body) {
  if (body == null || typeof body !== 'object') {
    return { ok: false, code: 'INVALID_INPUT', issues: [{ field: '(body)', msg: 'Falta el cuerpo de la petición.' }] };
  }
  // 1) Campo económico prohibido en CUALQUIER parte → rechazo explícito (no ignorar).
  const prohibido = buscarProhibido(body);
  if (prohibido) {
    return { ok: false, code: 'FORBIDDEN_FINANCIAL_FIELD', issues: [{ field: prohibido, msg: `Campo económico no permitido en la intención del cliente: ${prohibido}` }] };
  }

  const issues = [];
  const cantidad = body.cantidad;
  if (!entero(cantidad) || cantidad <= 0) issues.push({ field: 'cantidad', msg: 'La cantidad debe ser un entero mayor a 0.' });
  if (entero(cantidad) && cantidad > 100000) issues.push({ field: 'cantidad', msg: 'La cantidad excede el máximo razonable (100000).' });

  const pieza = body.pieza;
  if (pieza == null || typeof pieza !== 'object') {
    issues.push({ field: 'pieza', msg: 'Falta la pieza técnica.' });
    return { ok: false, code: 'INVALID_INPUT', issues };
  }
  const comps = Array.isArray(pieza.componentes) ? pieza.componentes : null;
  if (!comps || comps.length === 0) issues.push({ field: 'pieza.componentes', msg: 'Se requiere al menos un componente.' });

  const compsLimpios = [];
  (comps || []).forEach((c, i) => {
    if (c == null || typeof c !== 'object') { issues.push({ field: `componentes[${i}]`, msg: 'Componente inválido.' }); return; }
    const idOk = typeof c.insumoId === 'string' && c.insumoId.trim() !== '';
    const solicitado = typeof c.material_solicitado === 'string' ? c.material_solicitado.trim() : '';
    const matchTxt = typeof c.material_match === 'string' ? c.material_match.trim().toUpperCase() : '';
    // ENUM ESTRICTO (P0.6): si viene un material_match, debe ser un estado CONOCIDO.
    // Un string arbitrario (spoof/basura) ⇒ INVALID_INPUT, nunca "seguro por omisión".
    if (matchTxt !== '' && !MATCH_ACEPTADOS.has(matchTxt)) {
      issues.push({ field: `componentes[${i}].material_match`, msg: `material_match desconocido: '${matchTxt}'. Estados válidos: ${[...MATCH_ACEPTADOS].join(', ')}.` });
    }
    // MATERIAL_PENDING (P0-05): se admite SIN insumoId SÓLO si declara QUÉ material se
    // pidió (material_solicitado) y un match pendiente. Así el componente sobrevive al
    // contrato y el motor lo BLOQUEA (componentesIgnorados), en vez de inventarlo,
    // sustituirlo de otra familia o costearlo en $0. Un insumoId vacío "a secas" (sin
    // material declarado) sigue siendo un error.
    const esPendiente = !idOk && solicitado !== '' && (matchTxt === '' || MATCH_PENDIENTE.has(matchTxt));
    if (!idOk && !esPendiente) {
      issues.push({ field: `componentes[${i}].insumoId`, msg: 'insumoId (string) es obligatorio, salvo material pendiente declarado (material_solicitado + material_match pendiente); el precio lo resuelve el servidor.' });
    }
    for (const campo of ['largoMM', 'anchoMM', 'cantidad', 'piezas', 'hojas', 'areaPintadaM2']) {
      if (c[campo] != null && !(finito(c[campo]) && c[campo] >= 0)) issues.push({ field: `componentes[${i}].${campo}`, msg: `${campo} debe ser un número finito ≥ 0.` });
    }
    if (c.largoMM > 100000 || c.anchoMM > 100000) issues.push({ field: `componentes[${i}]`, msg: 'Dimensión fuera de rango razonable.' });
    const limpio = {};
    for (const campo of COMP_PERMITIDOS) {
      if (c[campo] == null) continue;
      // `nombre`: sólo string, acotado — nunca un objeto que se cuele como etiqueta.
      if (campo === 'nombre') { if (typeof c.nombre === 'string') limpio.nombre = c.nombre.slice(0, 200); continue; }
      if (campo === 'material_solicitado') { if (solicitado) limpio.material_solicitado = solicitado.slice(0, 200); continue; }
      if (campo === 'material_match') { if (matchTxt) limpio.material_match = matchTxt.slice(0, 40); continue; }
      // INTENCIÓN de confirmación humana (P0.6): booleano explícito, DISTINTO del string de
      // match. El servidor lo convierte a estado efectivo (USER_CONFIRMED) sólo si el insumoId
      // existe; jamás se deriva de material_match='USER_CONFIRMED' mandado por el browser.
      if (campo === 'tubular') { if (c.tubular === true) limpio.tubular = true; continue; }
      if (campo === 'material_confirmado') { if (c.material_confirmado === true) limpio.material_confirmado = true; continue; }
      if (campo === 'pieza_confirmada') { if (c.pieza_confirmada === true) limpio.pieza_confirmada = true; continue; }
      if (campo === 'procedencia') { const p = String(c.procedencia || '').toUpperCase(); if (['OBSERVADO', 'INFERIDO', 'SUPUESTO', 'DESCONOCIDO'].includes(p)) limpio.procedencia = p; continue; }
      // ENGINEERING_OVERRIDE (cross-family): intención booleana + motivo auditable. El servidor
      // sólo lo HONRA con capability Diseño/Dirección (índice/reconcile); aquí sólo se sanea.
      if (campo === 'engineering_override') { if (c.engineering_override === true) limpio.engineering_override = true; continue; }
      if (campo === 'override_motivo') { if (typeof c.override_motivo === 'string' && c.override_motivo.trim()) limpio.override_motivo = c.override_motivo.trim().slice(0, 300); continue; }
      if (campo === 'ia_totales_declarados_m') { const v = Array.isArray(c.ia_totales_declarados_m) ? c.ia_totales_declarados_m.filter((x) => finito(x) && x > 0 && x < 100000).slice(0, 10) : []; if (v.length) limpio.ia_totales_declarados_m = v; continue; }
      limpio[campo] = c[campo];
    }
    // Normaliza el pendiente: insumoId='' explícito + bandera para UI/motor.
    if (esPendiente) { limpio.insumoId = ''; limpio.pendiente = true; }
    compsLimpios.push(limpio);
  });

  // DIFICULTAD (técnica, no económica): nivel conocido o multiplicador 0.25–3. Otro valor ⇒ 400.
  let dificultadOk = null;
  if (pieza.dificultad != null) {
    const NIVELES = ['muy_facil', 'facil', 'normal', 'dificil', 'muy_dificil'];
    if (typeof pieza.dificultad === 'string' && NIVELES.includes(pieza.dificultad)) dificultadOk = pieza.dificultad;
    else if (finito(pieza.dificultad) && pieza.dificultad >= 0.25 && pieza.dificultad <= 3) dificultadOk = pieza.dificultad;
    else issues.push({ field: 'pieza.dificultad', msg: 'dificultad: muy_facil|facil|normal|dificil|muy_dificil o un número entre 0.25 y 3.' });
  }
  // horas técnicas (opcional): por centro, finitas ≥ 0.
  let horas;
  if (pieza.horas != null) {
    if (typeof pieza.horas !== 'object') issues.push({ field: 'pieza.horas', msg: 'horas debe ser un objeto por centro.' });
    else {
      // Sin prototipo: un centro llamado `__proto__` (o `toString`, `constructor`…) es un dato, no se pierde ni se hereda.
      horas = Object.create(null);
      for (const [centro, h] of Object.entries(pieza.horas)) {
        if (!(finito(h) && h >= 0)) issues.push({ field: `pieza.horas.${centro}`, msg: 'horas por centro debe ser finito ≥ 0.' });
        else horas[centro] = h;
      }
    }
  }

  // SEG-01c rev3 (reauditoría v3, P0-01): IDENTIDAD del mueble que se costea, en la MISMA solicitud que el despiece.
  // El servidor la guarda con el costeo y el primer vínculo a una partida exige esa misma identidad.
  let identidadOk = null;
  if (body.identidad != null) {
    const idt = body.identidad;
    if (typeof idt !== 'object' || Array.isArray(idt)) issues.push({ field: 'identidad', msg: 'identidad debe ser un objeto { nombre, w, d }.' });
    else {
      if (typeof idt.nombre !== 'string' || !idt.nombre.trim()) issues.push({ field: 'identidad.nombre', msg: 'identidad.nombre (texto) es obligatorio.' });
      for (const k of ['w', 'd']) if (idt[k] != null && !(finito(idt[k]) && idt[k] >= 0 && idt[k] <= 100000)) issues.push({ field: `identidad.${k}`, msg: `identidad.${k} debe ser un número entre 0 y 100000 o null.` });
      identidadOk = { nombre: typeof idt.nombre === 'string' ? idt.nombre.trim().slice(0, 200) : '', w: finito(idt.w) ? idt.w : null, d: finito(idt.d) ? idt.d : null };
    }
  }

  // SEG-01c rev4 (promesa_comercial_v1): lo que el mueble PROMETE (configuración, acabado, accesorios, exclusiones,
  // variante…). Lo declarado se queda sólo en PROMESA_DECLARABLE; materiales y piezas salen del despiece que se costea
  // (compsLimpios), nunca de lo que declare el navegador. El servidor la sella con su huella al registrar el costeo.
  let promesaOk = null;
  if (body.promesa != null) {
    if (typeof body.promesa !== 'object' || Array.isArray(body.promesa)) issues.push({ field: 'promesa', msg: 'promesa debe ser un objeto.' });
    else if (JSON.stringify(body.promesa).length > 50000) issues.push({ field: 'promesa', msg: 'promesa excede el tamaño máximo (50,000 caracteres).' });
    else promesaOk = promesaDeOrigen(body.promesa, compsLimpios);
  }

  // SRV-01: claves de revisiones que una persona marcó como revisadas en pantalla. El servidor sólo las honra con
  // capability (Diseño/Dirección), igual que la confirmación de material.
  let revisionesOk = null;
  if (pieza.revisiones_aceptadas != null) {
    if (!Array.isArray(pieza.revisiones_aceptadas)) issues.push({ field: 'pieza.revisiones_aceptadas', msg: 'revisiones_aceptadas debe ser una lista de claves.' });
    else revisionesOk = pieza.revisiones_aceptadas.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 200)).slice(0, 50);
  }

  if (issues.length) return { ok: false, code: 'INVALID_INPUT', issues };

  const intent = {
    ...(body.producto != null ? { producto: body.producto } : {}),
    ...(body.version != null ? { version: body.version } : {}),
    ...(body.contexto != null ? { contexto: body.contexto } : {}),
    cantidad,
    pieza: { componentes: compsLimpios, ...(horas ? { horas } : {}), ...(dificultadOk != null ? { dificultad: dificultadOk } : {}), ...(revisionesOk?.length ? { revisiones_aceptadas: revisionesOk } : {}) },
    ...(identidadOk ? { identidad: identidadOk } : {}),
    ...(promesaOk ? { promesa: promesaOk } : {}),
  };
  return { ok: true, intent };
}

/**
 * Construye la INTENCIÓN TÉCNICA que se manda a `costear-servidor` a partir de una
 * pieza del cliente (que sí trae margen, factores, modelo…): se queda SÓLO con lo
 * técnico. VH-036 (2026-10-11): el cliente mandaba `{...b}` completo, el servidor
 * respondía FORBIDDEN_FINANCIAL_FIELD y la comparación "sombra" nunca recibió nada.
 */
/**
 * Identidad comercial de un costeo: la que llevará la partida al agregarse a una cotización (agregarCosteo.js usa
 * esta MISMA función) y la que viaja al servidor con el despiece. SEG-01c rev3 exige que coincidan en el primer vínculo.
 */
export function identidadDeCosteo(c = {}) {
  const num = (x) => (x == null || x === '' ? null : (Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : null));
  return { nombre: (typeof c?.nombre === 'string' && c.nombre.trim()) || 'Mueble a la medida', w: num(c?.w), d: num(c?.d) };
}

/**
 * SEG-01c rev4 · lo que Costear DECLARA del mueble especial al costearlo: la misma identidad que llevará la partida
 * (nombre, w, d), la clave de línea si la hay y las piezas excluidas. agregarCosteo.js arma la partida con la promesa
 * que devuelve el validador sobre ESTA declaración (misma función, mismos datos).
 */
export function promesaDeclaradaDeCosteo(c = {}) {
  const idt = identidadDeCosteo(c);
  const excluidas = (Array.isArray(c?.componentes) ? c.componentes : []).filter((x) => x && x.excluida === true)
    .map((x) => (typeof x.nombre === 'string' && x.nombre.trim() ? x.nombre : 'Partida excluida'));
  return { nombre: idt.nombre, w: idt.w, d: idt.d, productoId: c?.productoId || null, nombresExcluidos: excluidas };
}

export function intentDesdePieza(pieza, cantidad = 1) {
  const comps = Array.isArray(pieza?.componentes) ? pieza.componentes : [];
  const limpios = comps.map((c) => {
    const o = {};
    for (const k of COMP_PERMITIDOS) if (c && c[k] != null) o[k] = c[k];
    return o;
  });
  const horas = pieza?.horas && typeof pieza.horas === 'object'
    ? Object.fromEntries(Object.entries(pieza.horas).filter(([, h]) => Number.isFinite(h) && h >= 0))
    : undefined;
  const n = Math.max(1, Math.round(Number(cantidad) || 1));
  const revs = Array.isArray(pieza?.revisionesAceptadas) ? pieza.revisionesAceptadas.filter((x) => typeof x === 'string' && x) : [];
  return { cantidad: n, pieza: { componentes: limpios, ...(horas && Object.keys(horas).length ? { horas } : {}), ...(pieza?.dificultad != null ? { dificultad: pieza.dificultad } : {}), ...(revs.length ? { revisiones_aceptadas: revs } : {}) },
    identidad: identidadDeCosteo(pieza), promesa: promesaDeclaradaDeCosteo(pieza) };
}
