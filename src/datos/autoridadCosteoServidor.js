// ============================================================================
//  AUTORIDAD DEL COSTEO EN EL SERVIDOR (Operación 9.5 · OP9.5-04 y P1-03). Lógica PURA que usa la Edge
//  costear-servidor(-rc); vive aquí para probarla con datos reales sin levantar Deno.
//
//  1. estadoBaseServidor — el estado que declara el servidor, SIEMPRE con motivos:
//     · 'incompleto' SÓLO si falta un dato para calcular (material/precio, tarifa, costo no finito).
//     · 'bloqueado'  si hay datos pero el cálculo no es físicamente válido (pieza que no cabe en el formato de compra)
//                    o un validador de Ingeniería está en rojo.
//     · 'preliminar' si se puede calcular con supuestos identificados (materiales propuestos sin confirmar, precios
//                    sin certificar). ANTES un material "por confirmar" dejaba el costo en 'incompleto' SIN motivo, y la
//                    pantalla decía "El servidor marca el costo como incompleto." aunque el precio de compra era real.
//     · 'certificado' sólo sin nada de lo anterior (los topes posteriores —legacy, piezas inferidas, D2, respaldo— lo
//                    pueden bajar a 'preliminar').
//     Invariante: estado ≠ 'certificado' ⇒ al menos un motivo.
//
//  2. aprobacionPrecioExacto — P1-03: "aprobación humana" se verifica sobre el PRECIO EXACTO que usó el motor:
//     · se elige la fila de insumo_precios con el MISMO orden que la vista catalogo_vigente (estado, confidence,
//       vigente_desde desc, id desc) y se exige que su precio sea, al centavo, el que usó el motor;
//     · un empate en esa clave con precios distintos es ambiguo (la vista decide por id) ⇒ no cuenta;
//     · el aprobador debe estar en `permitidos` con un rol aprobador (hoy sólo 'direccion') y NO estar en
//       `cuentas_no_humanas`. Sin esa lista (tabla no aplicada) ⇒ fail-closed: nada cuenta como humano.
//     Sustituye la regex por e-mail (`/@/ && !/^qa-|^test|^prueba/`), que aceptaba cualquier dirección con '@'.
//     Devuelve la TRAZA por insumo (precio_id, precio, unidad, aprobador, rol, fecha, documento) para el snapshot.
// ============================================================================

/** Roles cuya aprobación de un precio cuenta como humana. Ampliarlo (p. ej. Compras) es decisión de Dirección (D1). */
export const ROLES_APROBADORES_PRECIO = Object.freeze(['direccion']);

const lista = (x) => (Array.isArray(x) ? x : []);

export function estadoBaseServidor({ emision = {}, bloqueosIng = [], noCertificados = [], usados = [], requierenValidacion = [], costoUnitario = undefined, nombreDe = null } = {}) {
  const b = emision.bloqueos || {};
  const faltantes = [
    ...lista(b.datos_faltantes).map((x) => `Sin material o precio: ${x}`),
    ...lista(b.tarifas_faltantes).map((x) => `Tarifa faltante: ${x}`),
    ...(b.costo_invalido ? ['Costo calculado inválido o no finito.'] : []),
  ];
  // Reauditoría 14-oct (P1-04): un costo de $0 sin dato faltante explícito no es "gratis": falta algo. Nunca certificado.
  if (!faltantes.length && costoUnitario !== undefined && !(Number(costoUnitario) > 0)) faltantes.push('Costo calculado en $0: falta material, precio o mano de obra.');
  if (faltantes.length) return { estado: 'incompleto', warnings: faltantes };

  const invalidos = [
    ...lista(b.formato_incompatible),
    ...lista(bloqueosIng).map((o) => `Ingeniería: ${o?.mensaje || o}`),
  ];
  if (invalidos.length) return { estado: 'bloqueado', warnings: invalidos };

  const warnings = [];
  const porConfirmar = lista(b.materiales_por_confirmar);
  for (const m of porConfirmar) warnings.push(`Material propuesto sin confirmar: ${m}`);
  // Cierre ChatGPT (2026-10-20): se dice CUÁL insumo no tiene precio certificado (antes sólo "1 de 8").
  const nombres = typeof nombreDe === 'function' ? [...new Set(noCertificados.map((id) => nombreDe(id) || id))].slice(0, 4) : [];
  if (noCertificados.length) warnings.push(`Costo preliminar — ${noCertificados.length} de ${usados.length} insumo(s) sin precio certificado${nombres.length ? `: ${nombres.join(', ')}` : ''}.`);
  if (requierenValidacion.length) warnings.push(`${requierenValidacion.length} insumo(s) requieren validación de Compras.`);
  if (warnings.length) return { estado: 'preliminar', warnings };
  return { estado: 'certificado', warnings: [] };
}

/** Garantiza la invariante "no certificado ⇒ con motivo" sin inventar el motivo: dice que falta. */
export function conMotivos(estado, warnings = []) {
  const w = lista(warnings).filter(Boolean);
  if (estado !== 'certificado' && w.length === 0) w.push(`Estado '${estado}' sin motivo registrado por el servidor: repórtalo a Dirección (defecto, no dato).`);
  return w;
}

const ORDEN_ESTADO = { aprobado: 0, propuesto_validado: 1, propuesto: 2 };
const ORDEN_CONF = { alta: 0, media: 1 };
const fechaNum = (f) => (f ? Date.parse(f) : -Infinity);
const clave = (p) => [ORDEN_ESTADO[p.estado] ?? 3, ORDEN_CONF[p.confidence] ?? 2, -fechaNum(p.vigente_desde)];
const cmpClave = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
const centavos = (x) => { const n = Number(x); return Number.isFinite(n) ? Math.round(n * 100) : null; };

/** Misma elección que la vista catalogo_vigente (fila rn = 1) + detección de empate con precio distinto. */
export function precioVigenteElegido(filas = []) {
  const vig = lista(filas).filter((p) => p && p.vigente_hasta == null);
  if (!vig.length) return { fila: null, empate: false };
  const orden = [...vig].sort((a, b) => cmpClave(clave(a), clave(b)) || (Number(b.id) - Number(a.id)));
  const fila = orden[0];
  const k = clave(fila);
  const empate = orden.some((p) => p !== fila && cmpClave(clave(p), k) === 0 && centavos(p.precio) !== centavos(fila.precio));
  return { fila, empate };
}

/**
 * @param {{ usados: string[], insumos: Record<string, {precio?: number, unidad?: string}>, filasPrecio: object[],
 *           permitidos: {email: string, rol: string}[], noHumanas: string[] | null, roles?: string[] }} e
 * @returns {{ aprobacionHumana: boolean, precios: object[], motivos: string[] }}
 */
export function aprobacionPrecioExacto({ usados = [], insumos = {}, filasPrecio = [], permitidos = [], noHumanas = null, roles = ROLES_APROBADORES_PRECIO } = {}) {
  const motivos = [];
  if (!Array.isArray(noHumanas)) motivos.push('Lista de cuentas no humanas no disponible: ninguna aprobación se verifica como humana.');
  const rolDe = new Map(lista(permitidos).map((p) => [String(p.email || '').toLowerCase(), String(p.rol || '').toLowerCase()]));
  const excluidas = new Set(lista(noHumanas).map((e) => String(e).toLowerCase()));
  const porInsumo = new Map();
  for (const f of lista(filasPrecio)) { if (!porInsumo.has(f.insumo_id)) porInsumo.set(f.insumo_id, []); porInsumo.get(f.insumo_id).push(f); }

  const precios = [];
  for (const id of usados) {
    // P1-03b: si el catálogo entregó el precio_id que eligió (PROPUESTA_p103b), se usa ESE; la re-elección en JS
    // (misma regla que la vista) queda sólo como respaldo y se marca en la traza.
    const pid = insumos?.[id]?.precioId;
    const filas = porInsumo.get(id) || [];
    const { fila, empate } = pid != null
      ? { fila: filas.find((f) => Number(f.id) === Number(pid) && f.vigente_hasta == null) || null, empate: false }
      : precioVigenteElegido(filas);
    const usado = insumos?.[id]?.precio;
    const t = { insumo_id: id, eleccion: pid != null ? 'catalogo' : 'recalculada', precio_usado: usado ?? null, unidad: insumos?.[id]?.unidad ?? null, precio_id: fila?.id ?? null, precio: fila?.precio ?? null, estado: fila?.estado ?? null, approved_by: fila?.approved_by ?? null, approved_at: fila?.approved_at ?? null, source_document: fila?.source_document ?? null, rol_aprobador: null, humana: false, motivo: null };
    const email = String(fila?.approved_by || '').toLowerCase();
    t.rol_aprobador = rolDe.get(email) || null;
    if (!fila) t.motivo = 'sin precio vigente';
    else if (empate) t.motivo = 'empate entre precios vigentes distintos';
    else if (fila.estado !== 'aprobado') t.motivo = `precio en estado '${fila.estado}'`;
    else if (centavos(usado) == null || centavos(usado) !== centavos(fila.precio)) t.motivo = 'el precio usado no coincide con el precio aprobado';
    else if (!email) t.motivo = 'sin aprobador';
    else if (!Array.isArray(noHumanas)) t.motivo = 'no verificable';
    else if (excluidas.has(email)) t.motivo = 'aprobado por una cuenta no humana';
    else if (!t.rol_aprobador || !roles.includes(t.rol_aprobador)) t.motivo = `aprobador sin rol aprobador (${t.rol_aprobador || 'no registrado'})`;
    else t.humana = true;
    precios.push(t);
  }
  const sinHumano = precios.filter((p) => !p.humana);
  if (sinHumano.length) motivos.push(`${sinHumano.length} de ${precios.length} precio(s) sin aprobación humana verificada (${[...new Set(sinHumano.map((p) => p.motivo))].slice(0, 3).join('; ')}).`);
  return { aprobacionHumana: precios.length > 0 && sinHumano.length === 0 && Array.isArray(noHumanas), precios, motivos };
}

// ---------------------------------------------------------------------------------------------------------------------
//  P1-03 · qué precios puede aprobar Dirección desde Costear (RPC de producción `aprobar_precio(p_precio_id)`, que exige
//  rol direccion y registra quién y cuándo). Sólo se ofrece aprobar EL precio exacto que usó el motor. No se ofrece
//  cuando el precio usado no coincide con el vigente, cuando hay empate entre precios vigentes o cuando no hay precio:
//  eso no se arregla firmando, se arregla con Compras.
// ---------------------------------------------------------------------------------------------------------------------
const NO_APROBABLE = /no coincide|empate|sin precio vigente|no verificable/;
export function preciosAprobables(precios = []) {
  return lista(precios).filter((p) => p && !p.humana && p.precio_id != null && !NO_APROBABLE.test(String(p.motivo || '')));
}
export function preciosNoAprobables(precios = []) {
  return lista(precios).filter((p) => p && !p.humana && (p.precio_id == null || NO_APROBABLE.test(String(p.motivo || ''))));
}
