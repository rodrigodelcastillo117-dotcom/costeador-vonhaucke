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
const COMP_PERMITIDOS = ['insumoId', 'nombre', 'cantidad', 'largoMM', 'anchoMM', 'piezas', 'hojas', 'material_solicitado', 'material_match', 'material_confirmado'];

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
    for (const campo of ['largoMM', 'anchoMM', 'cantidad', 'piezas', 'hojas']) {
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
      if (campo === 'material_confirmado') { if (c.material_confirmado === true) limpio.material_confirmado = true; continue; }
      limpio[campo] = c[campo];
    }
    // Normaliza el pendiente: insumoId='' explícito + bandera para UI/motor.
    if (esPendiente) { limpio.insumoId = ''; limpio.pendiente = true; }
    compsLimpios.push(limpio);
  });

  // horas técnicas (opcional): por centro, finitas ≥ 0.
  let horas;
  if (pieza.horas != null) {
    if (typeof pieza.horas !== 'object') issues.push({ field: 'pieza.horas', msg: 'horas debe ser un objeto por centro.' });
    else {
      horas = {};
      for (const [centro, h] of Object.entries(pieza.horas)) {
        if (!(finito(h) && h >= 0)) issues.push({ field: `pieza.horas.${centro}`, msg: 'horas por centro debe ser finito ≥ 0.' });
        else horas[centro] = h;
      }
    }
  }

  if (issues.length) return { ok: false, code: 'INVALID_INPUT', issues };

  const intent = {
    ...(body.producto != null ? { producto: body.producto } : {}),
    ...(body.version != null ? { version: body.version } : {}),
    ...(body.contexto != null ? { contexto: body.contexto } : {}),
    cantidad,
    pieza: { componentes: compsLimpios, ...(horas ? { horas } : {}) },
  };
  return { ok: true, intent };
}
