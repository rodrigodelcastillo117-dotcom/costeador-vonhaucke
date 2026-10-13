// ============================================================================
//  COSTEO DE UNA CO-CREACIÓN EN EL SERVIDOR (COCREAR 10 · D-02 / D-03)
//
//  El dinero de Cocrear es del SERVIDOR. Lo que el navegador manda a `costear-servidor` (modo
//  cocrear) es sólo { accion:'cocrear', expediente_id, validar_ingenieria?, visual_hash? }: ni
//  BOM, ni costo, ni rol. El servidor:
//    1. lee el expediente GUARDADO (service role) y verifica acceso (dueño o Diseño/Dirección);
//    2. reconstruye el ProductSpec desde la intención guardada (specDeCocreacion) y comprueba que
//       el `specHash` del payload sea el de su contenido (un payload alterado no se costea);
//    3. arma la intención técnica (BOM + dificultad) y la pasa por el MISMO DTO estricto
//       (validarIntentCosteo) y el MISMO motor (calcular, Alba V1 × dificultad);
//    4. "Validar ingeniería": sólo Diseño/Dirección, sólo con costo emitible, sin bloqueos del
//       validador estructural determinista (revisarEstructura) y con el visual_hash de ESTA revisión;
//    5. guarda una fila en `cocrear_costeo_servidor` ligada al analysis_hash de la revisión (la lee
//       `registrar_producto_desde_expediente`, ver PROPUESTA_cocrear_costo_servidor.sql);
//    6. responde FILTRADO POR ROL (vendedor: precio y estado; Diseño: + costo técnico; Dirección: todo).
//
//  Puro (sin red): lo importa la Edge `costear-servidor-rc` y lo prueban vitest + PGlite.
// ============================================================================
import { specDeCocreacion } from './cocrear.js';
import { visualRevisionHash } from './visualRevision.js';
import { bomHash, MOTOR_VERSION, FORMULA_ALBA_V1 } from '../motor/calculo.js';
import { precioSugeridoCocreado } from './precio.js';

export const ACCION_COCREAR = 'cocrear';
const ROLES_TECNICOS = new Set(['direccion', 'diseno']);
const CLAVES_SOLICITUD = new Set(['accion', 'expediente_id', 'validar_ingenieria', 'visual_hash']);

export const esSolicitudCocrear = (body) => !!body && typeof body === 'object' && !Array.isArray(body) && body.accion === ACCION_COCREAR;

/**
 * Valida la solicitud del navegador. Cualquier llave fuera del contrato (BOM, costo, rol, margen…)
 * se RECHAZA: el servidor no recibe datos de la co-creación por el body, sólo su identidad.
 * @returns {{ok:true, solicitud:{expedienteId:number, validarIngenieria:boolean, visualHash:string|null}}|{ok:false, code, issues}}
 */
export function validarSolicitudCocrear(body) {
  if (!esSolicitudCocrear(body)) return { ok: false, code: 'INVALID_INPUT', issues: [{ field: 'accion', msg: "accion debe ser 'cocrear'." }] };
  const extra = Object.keys(body).filter((k) => !CLAVES_SOLICITUD.has(k));
  if (extra.length) {
    return { ok: false, code: 'FORBIDDEN_FIELD', issues: extra.map((k) => ({ field: k, msg: `Campo no permitido en el costeo de cocreación: ${k}. El servidor lee el expediente guardado; no recibe BOM, costo ni rol.` })) };
  }
  const issues = [];
  const id = body.expediente_id;
  if (!(Number.isInteger(id) && id > 0)) issues.push({ field: 'expediente_id', msg: 'expediente_id debe ser un entero > 0 (guarda la cocreación primero).' });
  if (body.validar_ingenieria != null && typeof body.validar_ingenieria !== 'boolean') issues.push({ field: 'validar_ingenieria', msg: 'validar_ingenieria debe ser booleano.' });
  const vh = body.visual_hash;
  if (vh != null && !(typeof vh === 'string' && vh.length > 0 && vh.length <= 128)) issues.push({ field: 'visual_hash', msg: 'visual_hash inválido.' });
  if (body.validar_ingenieria === true && !vh) issues.push({ field: 'visual_hash', msg: 'Para validar ingeniería se requiere el visual_hash de la revisión revisada.' });
  if (issues.length) return { ok: false, code: 'INVALID_INPUT', issues };
  return { ok: true, solicitud: { expedienteId: id, validarIngenieria: body.validar_ingenieria === true, visualHash: vh || null } };
}

/** ¿Puede este correo/rol costear esta cocreación? (mismo criterio que guardar/cargar_cocrear_seguro) */
export function accesoACocreacion({ rol, email, creadoPor }) {
  if (ROLES_TECNICOS.has(String(rol || '').toLowerCase())) return true;
  return !!email && !!creadoPor && String(email).toLowerCase() === String(creadoPor).toLowerCase();
}

/**
 * La pieza técnica de una cocreación GUARDADA, reconstruida en el servidor.
 * @returns {{ok:true, spec, specHash, visualHash, bomHash, pieza:{componentes, dificultad?}}|{ok:false, code, motivo}}
 */
export function piezaDeCocreacion(payload) {
  if (!payload || typeof payload !== 'object' || !payload.intent || typeof payload.intent !== 'object') {
    return { ok: false, code: 'SIN_COCREACION', motivo: 'El expediente no tiene una co-creación guardada.' };
  }
  const spec = specDeCocreacion(payload.intent, Array.isArray(payload.historia) ? payload.historia : []);
  if (payload.specHash != null && payload.specHash !== spec.hash) {
    return { ok: false, code: 'PAYLOAD_INCONSISTENTE', motivo: 'El specHash guardado no corresponde a la intención guardada: no se costea un payload alterado.' };
  }
  const componentes = spec.componentes || [];
  if (!componentes.length) return { ok: false, code: 'SIN_BOM', motivo: 'La co-creación no tiene despiece (BOM): bájala a BOM antes de costear.' };
  return {
    ok: true, spec, specHash: spec.hash, visualHash: visualRevisionHash(spec), bomHash: bomHash(componentes),
    pieza: { componentes, ...(spec.dificultad != null ? { dificultad: spec.dificultad } : {}) },
  };
}

/**
 * Decisión de "Validar ingeniería" (D-03). Determinista y explicada.
 * @returns {{validada:boolean, code:string|null, motivo:string|null}}
 */
export function decidirValidacionIngenieria({ solicitada, rol, emitible, estado, visualHashCliente, visualHashServidor, bloqueosEstructura = [] }) {
  if (!solicitada) return { validada: false, code: null, motivo: null };
  if (!ROLES_TECNICOS.has(String(rol || '').toLowerCase())) return { validada: false, code: 'ENGINEERING_VALIDATION_FORBIDDEN', motivo: 'Sólo Diseño o Dirección pueden validar ingeniería.' };
  if (!visualHashCliente || visualHashCliente !== visualHashServidor) return { validada: false, code: 'REVISION_DISTINTA', motivo: 'La revisión que revisaste no es la guardada: guarda y vuelve a validar.' };
  if (bloqueosEstructura.length) return { validada: false, code: 'BLOQUEO_ESTRUCTURAL', motivo: `El validador estructural bloquea: ${bloqueosEstructura.slice(0, 3).join(' · ')}` };
  if (!emitible || estado === 'incompleto' || estado === 'bloqueado') return { validada: false, code: 'COSTO_NO_EMITIBLE', motivo: 'El costo del servidor está incompleto: completa materiales/precios antes de validar.' };
  return { validada: true, code: null, motivo: null };
}

const din = (x) => (Number.isFinite(Number(x)) ? Math.round(Number(x) * 100) / 100 : null);

/**
 * La fila que se guarda en `public.cocrear_costeo_servidor` (sólo service role escribe).
 */
export function filaCostoCocreacion({ expediente, email, rol, pz, costeo, decision, precio, ahora = new Date().toISOString() }) {
  const emitible = costeo.emitible === true && costeo.estado !== 'incompleto' && costeo.estado !== 'bloqueado';
  return {
    expediente_id: expediente.id,
    expediente_rev: expediente.revision ?? 1,
    analysis_hash: expediente.analysis_hash ?? null,
    spec_hash: pz.specHash,
    visual_hash: pz.visualHash,
    bom_hash: pz.bomHash,
    estado: costeo.estado,
    costo_unitario: emitible ? din(costeo.costoUnitario) : null,
    precio_sugerido: emitible && precio?.precio != null ? din(precio.precio) : null,
    margen_politica: emitible ? (precio?.margen ?? null) : null,
    dificultad: pz.pieza.dificultad != null ? String(pz.pieza.dificultad) : null,
    formula_version: FORMULA_ALBA_V1,
    version_motor: costeo.versionMotor || MOTOR_VERSION,
    version_catalogo: costeo.versionCatalogo || null,
    fuente_costo: costeo.fuenteCosto || null,
    calculado_por: email,
    rol,
    ingenieria_validada: decision.validada === true,
    validada_por: decision.validada ? email : null,
    validada_en: decision.validada ? ahora : null,
    warnings: Array.isArray(costeo.warnings) ? costeo.warnings.slice(0, 20) : [],
    evidencia: {
      pendientes: (costeo.pendientes || []).slice(0, 30),
      bloqueos_estructura: (decision.bloqueos || []).slice(0, 10),
      validacion_motivo: decision.motivo || null,
    },
  };
}

/**
 * Respuesta por CAPACIDAD (misma regla que el costeo normal):
 *  vendedor  → estado, precio sugerido (o "Por confirmar"), validación, hashes. Jamás costo/margen.
 *  diseño    → + costo técnico (sin margen).
 *  dirección → + margen de política y desglose.
 */
export function respuestaCocreacionPorRol(rol, fila, { costeo = {}, decision = {} } = {}) {
  const r = String(rol || '').toLowerCase();
  const base = {
    ok: true, accion: ACCION_COCREAR, estado: fila.estado,
    expediente_id: fila.expediente_id, expediente_rev: fila.expediente_rev, analysis_hash: fila.analysis_hash,
    spec_hash: fila.spec_hash, visual_hash: fila.visual_hash, bom_hash: fila.bom_hash,
    precioSugerido: fila.precio_sugerido,
    precioPorConfirmar: fila.precio_sugerido == null,
    ingenieria_validada: fila.ingenieria_validada, validada_por: fila.validada_por, validada_en: fila.validada_en,
    validacion: decision.code ? { code: decision.code, motivo: decision.motivo } : null,
    versionMotor: fila.version_motor, versionCatalogo: fila.version_catalogo, formula: fila.formula_version, dificultad: fila.dificultad,
  };
  if (!ROLES_TECNICOS.has(r)) {
    const warnComercial = fila.estado === 'certificado' ? [] : fila.estado === 'preliminar'
      ? ['Precio preliminar: sujeto a confirmación de costos.']
      : ['El costeo está incompleto; pídele a Diseño que lo complete antes de cotizar.'];
    return { ...base, warnings: warnComercial };
  }
  const tecnico = {
    costoUnitario: fila.costo_unitario,
    materialTotal: din(costeo.materialTotal), manoObra: din(costeo.manoObra), indirectosFabrica: din(costeo.indirectosFabrica),
    pendientes: fila.evidencia?.pendientes || [],
  };
  if (r === 'diseno') return { ...base, costo: tecnico, warnings: fila.warnings };
  return { ...base, costo: tecnico, margen: fila.margen_politica, warnings: fila.warnings };
}

export { precioSugeridoCocreado };
