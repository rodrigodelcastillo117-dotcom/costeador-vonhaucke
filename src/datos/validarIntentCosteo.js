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
// ============================================================================

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
const COMP_PERMITIDOS = ['insumoId', 'nombre', 'cantidad', 'largoMM', 'anchoMM', 'piezas', 'hojas'];

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
    if (!c.insumoId || typeof c.insumoId !== 'string') issues.push({ field: `componentes[${i}].insumoId`, msg: 'insumoId (string) es obligatorio; el precio lo resuelve el servidor.' });
    for (const campo of ['largoMM', 'anchoMM', 'cantidad', 'piezas', 'hojas']) {
      if (c[campo] != null && !(finito(c[campo]) && c[campo] >= 0)) issues.push({ field: `componentes[${i}].${campo}`, msg: `${campo} debe ser un número finito ≥ 0.` });
    }
    if (c.largoMM > 100000 || c.anchoMM > 100000) issues.push({ field: `componentes[${i}]`, msg: 'Dimensión fuera de rango razonable.' });
    const limpio = {};
    for (const campo of COMP_PERMITIDOS) {
      if (c[campo] == null) continue;
      // `nombre`: sólo string, acotado — nunca un objeto que se cuele como etiqueta.
      if (campo === 'nombre') { if (typeof c.nombre === 'string') limpio.nombre = c.nombre.slice(0, 200); continue; }
      limpio[campo] = c[campo];
    }
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
