// ============================================================================
//  NÚCLEO del costeo autoritativo del servidor (cierre GO, 14-oct-2026).
//
//  Antes vivía dentro de la Edge `costear-servidor-rc` (index.ts) y las pruebas del pipeline lo RECONSTRUÍAN a mano
//  (estado, aprobación, fila). Ahora la Edge sólo autentica (JWT → email), arma el cliente de servicio y llama a
//  `atenderCosteo`; las pruebas llaman a ESTA MISMA función con un cliente PGlite. No hay lógica paralela.
//
//  Autoridad técnica del costeo (spec_tecnica_v1): la pieza EFECTIVA que entra a `calcular()` — la intención saneada
//  con sus componentes RECONCILIADOS contra el catálogo autoritativo (`piezaEfectiva`). Es lo que sella K y lo que la
//  respuesta devuelve (`especificacionTecnica`) para que la partida lleve exactamente esa especificación; `adjuntar`
//  la re-proyecta en SQL y la compara con la huella que el servidor ya guardó: el navegador la transporta, no decide.
//
//  `svc` es un cliente con la interfaz de supabase-js (service role). Errores de servidor ⇒ { error:{status, body} }.
// ============================================================================
import { calcular, modeloParaPieza, precioDe, costeoEmitible, bomHash, PARAMETROS_DEFAULT, MOTOR_VERSION } from '../motor/calculo.js';
import { dinero } from '../motor/dinero.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { validarIntentCosteo } from './validarIntentCosteo.js';
import { filaCosteoServidor } from './registroCosteo.js';
import { specTecnicaDeCosteo } from './specTecnica.js';
import { reconciliarMaterialServidor, puedeConfirmarMaterial, estadoConTopeLegacy } from './materialMatch.js';
import { revisarEstructura } from './revisionEstructural.js';
import { topeEstadoPorPoliticas } from './topeEstadoCosteo.js';
import { estadoBaseServidor, conMotivos, aprobacionPrecioExacto } from './autoridadCosteoServidor.js';

// Hash corto y estable del contenido de config con el que se costeó, para que una
// cotización vieja siga siendo explicable aunque mañana cambie un precio (djb2).
export function hashConfig(datos) {
  const txt = JSON.stringify(datos ?? {});
  let h = 5381;
  for (let k = 0; k < txt.length; k++) h = ((h << 5) + h + txt.charCodeAt(k)) >>> 0;
  return `cfg${h.toString(36)}`;
}

const falla = (status, body) => ({ error: { status, body } });

// ----------------------------------------------------------------------------
//  NÚCLEO COMPARTIDO (costeo normal y modo cocrear): config/catálogo autoritativos,
//  reconciliación de material, MISMO motor, MISMO juez de emisión, estado y snapshot.
//  Devuelve { error:{status, body} } ante un error de servidor (para responder tal cual).
// ----------------------------------------------------------------------------
export async function costearConMotor(svc, pieza, n, puedeConfirmar) {
  const { data: cfg, error: cfgErr } = await svc.from('config').select('datos').eq('id', 'vonhaucke').single();
  if (cfgErr) return falla(502, { ok: false, error: 'No se pudo leer la configuración.' });
  const datos = cfg?.datos || {};

  // VH-088 (2026-10-12, Dirección): el motor costea con el CATÁLOGO (insumos_catalogo ⨝ catalogo_vigente)
  // vía la RPC catalogo_motor — la MISMA fuente que recibe el cliente en config_para_rol — y no con la
  // foto config.datos.insumos. Se piden el catálogo curado + los ids concretos de la pieza (los ERP
  // que haya elegido a mano el usuario). Si el catálogo no responde, se cae a config/semilla y se
  // AVISA (catalogoFuente='config-fallback'): nunca en silencio.
  const idsPieza = [...new Set((pieza.componentes || []).map((c) => String(c?.insumoId || '')).filter(Boolean))];
  let insumos = null;
  let catalogoFuente = 'catalogo';
  // Cierre ChatGPT (2026-10-20): un fallo PASAJERO del catálogo (base lenta) mandaba el costo a la configuración de
  // respaldo. Se reintenta UNA vez antes de caer al respaldo (que sigue avisando "no cotices en firme").
  for (let intento = 0; intento < 2 && !insumos; intento++) {
    try {
      const { data: cat, error: catErr } = await svc.rpc('catalogo_motor', { p_incluir_erp: false, p_ids: idsPieza.length ? idsPieza : null });
      if (!catErr && cat && typeof cat === 'object' && Object.keys(cat).length) insumos = cat;
    } catch (_e) { /* reintento / fallback abajo */ }
  }
  if (!insumos) {
    catalogoFuente = 'config-fallback';
    insumos = (datos.insumos && typeof datos.insumos === 'object' && Object.keys(datos.insumos).length)
      ? datos.insumos
      : mapaInsumos(INSUMOS_SEMILLA);
  }
  const parametros = { ...PARAMETROS_DEFAULT, ...(datos.parametros || {}) };

  const comps0 = Array.isArray(pieza.componentes) ? pieza.componentes : [];

  // --- RECONCILIACIÓN DE MATERIAL (P0.5, servidor autoritativo) ---
  // El `material_match` que mandó el navegador NO se confía. Para CADA componente se RECALCULA
  // la clase efectiva contra el catálogo AUTORITATIVO (insumos) + material_solicitado + la
  // intención de confirmación humana (material_confirmado, SÓLO si hay capability). Así un
  // browser que spoofee material_match='EXACT' (o material_confirmado sin rol) NO se salta el
  // gate: el motor verá la clase real y `costeoEmitible` bloqueará la emisión.
  const resolver = (id) => insumos[id];
  const catalogoVals = Object.values(insumos);
  // origenLegacyConfiable=false y origenSpecConfiable=false SIEMPRE en este edge interactivo:
  //  · P0.10: un request nuevo NO tiene provenance legacy → ausencia de material_solicitado nunca
  //    produce LEGACY_SELECTED (queda pendiente de confirmación).
  //  · P0.12: la especificación (material_solicitado) la manda el browser → NO tiene provenance
  //    server-side, así que una coincidencia "exacta" NO otorga EXACT emitible: queda provisional.
  // (Un futuro flujo que RE-COSTEE un expediente/análisis verificado server-side podría pasar true.)
  // piezaEfectiva = EXACTAMENTE el objeto que recibe calcular(). Su spec técnica es la autoridad de K.
  const piezaEfectiva = {
    ...pieza,
    componentes: comps0.map((c) => reconciliarMaterialServidor(c, resolver, catalogoVals, { puedeConfirmar, origenLegacyConfiable: false, origenSpecConfiable: false })),
  };

  // --- Mismo motor que el cliente ---
  let r;
  try {
    const { par } = modeloParaPieza(parametros, piezaEfectiva);
    r = calcular(piezaEfectiva, n, insumos, par);
  } catch (e) {
    return falla(500, { ok: false, error: 'No se pudo calcular: ' + String(e) });
  }

  // FAIL-CLOSED: MISMO juez que el cliente. Esto incluye material/precio faltante,
  // costo no finito y piezas que NO CABEN en el formato de compra. No duplicamos
  // la definición de emitibilidad en la Edge.
  const emision = costeoEmitible(r);
  // VONI Ingeniería en el servidor autoritativo: los bloqueos que NO dependen de una decisión humana (material con función
  // equivocada, cantidad imposible) se aplican aquí también; un cliente alterado no se los salta. Los "aceptables"
  // (duplicado, conteo distinto a la descripción) y los que requieren medidas generales los decide la persona en pantalla.
  const bloqueosIng = revisarEstructura({ componentes: piezaEfectiva.componentes, insumos, descripcion: '' })
    .observaciones.filter((o) => o.nivel === 'blocker' && !o.aceptable);
  const faltan = Array.isArray(r.componentesIgnorados) ? r.componentesIgnorados : [];
  const warnings = [];
  if (catalogoFuente === 'config-fallback') warnings.push('Catálogo central no disponible: costo con la configuración de respaldo. No cotices en firme.');

  // --- EVIDENCIA desde catalogo_vigente (el costo sigue saliendo de config-legado;
  //     catalogo_vigente aporta SOLO el estado de evidencia por insumo usado). Aditivo. ---
  const usados = [...new Set((r.detalleInsumos || []).map((d) => d.insumoId).filter(Boolean))];
  const evMap = {};
  let versionCatalogo = 'sin-catalogo';
  try {
    if (usados.length) {
      const { data: evid } = await svc.from('catalogo_vigente')
        .select('insumo_id, estado, certificable, requiere_validacion_compras')
        .in('insumo_id', usados);
      for (const e of evid || []) evMap[e.insumo_id] = e;
    }
    const { count: nAprob } = await svc.from('insumo_precios')
      .select('id', { count: 'exact', head: true }).eq('estado', 'aprobado');
    versionCatalogo = `cat-ap${nAprob ?? ''}-${hashConfig(usados)}`;
  } catch (_e) { /* catalogo_vigente puede no existir aún: no bloquea el costeo legado */ }

  // D3 (Dirección 2026-10-13): el juego genérico de tornillería es un supuesto, nunca precio certificable.
  const noCertificados = usados.filter((id) => !evMap[id] || !evMap[id].certificable || id === 'tornilleria');
  const requierenValidacion = usados.filter((id) => evMap[id]?.requiere_validacion_compras);
  // P1-03 (Operación 9.5): "aprobación humana" sobre el PRECIO EXACTO que usó el motor, con el rol de `permitidos` y la
  // lista explícita `cuentas_no_humanas` (sin la tabla ⇒ nada cuenta como humano). Sustituye la regex por e-mail.
  let aprob = { aprobacionHumana: false, precios: [], motivos: [] };
  try {
    if (usados.length) {
      const { data: filasPrecio } = await svc.from('insumo_precios')
        .select('id, insumo_id, precio, estado, confidence, vigente_desde, vigente_hasta, approved_by, approved_at, source_document')
        .in('insumo_id', usados).is('vigente_hasta', null);
      const emails = [...new Set((filasPrecio || []).map((f) => f.approved_by).filter(Boolean))];
      const { data: perms } = emails.length ? await svc.from('permitidos').select('email, rol').in('email', emails) : { data: [] };
      const nh = await svc.from('cuentas_no_humanas').select('email');
      aprob = aprobacionPrecioExacto({ usados, insumos, filasPrecio: filasPrecio || [], permitidos: perms || [], noHumanas: nh.error ? null : (nh.data || []).map((x) => x.email) });
    }
  } catch (_e) { aprob = { aprobacionHumana: false, precios: [], motivos: ['No se pudo verificar la aprobación de los precios.'] }; }
  const aprobacionHumana = aprob.aprobacionHumana;

  // ESTADO con motivos (OP9.5-04). 'incompleto' sólo si FALTA un dato; 'bloqueado' si el cálculo no es físicamente válido
  // o Ingeniería está en rojo; un material "por confirmar" con precio real es 'preliminar' con su motivo, no 'incompleto'.
  const base = estadoBaseServidor({ emision, bloqueosIng, noCertificados, usados, requierenValidacion, costoUnitario: r.costoUnitario });
  let estado = base.estado;
  for (const w of base.warnings) if (!warnings.includes(w)) warnings.push(w);
  // P0.11: si hay algún material LEGACY_SELECTED, el estado se topa en 'preliminar' aunque TODOS
  // los precios estén certificados. Precio certificado del insumo ≠ selección certificada del
  // material para esa pieza; sólo migración/confirmación válida (USER_CONFIRMED) lo libera.
  const estadoTopado = estadoConTopeLegacy(estado, piezaEfectiva.componentes);
  if (estadoTopado !== estado) {
    warnings.push("Costo con material(es) histórico(s) (LEGACY_SELECTED): estado tope 'preliminar' hasta confirmar el material.");
    estado = estadoTopado;
  }
  // Auditoría 2026-10-14 (P1-01): una pieza que la IA INFIRIÓ o SUPUSO (no la vio) y que ninguna persona con capability
  // confirmó que existe no deja certificar el costo, aunque su material y su precio estén certificados.
  const noObservadas = piezaEfectiva.componentes.filter((c) => c && (c.procedencia === 'INFERIDO' || c.procedencia === 'SUPUESTO') && !(c.pieza_confirmada === true && puedeConfirmar));
  if (noObservadas.length && estado === 'certificado') {
    estado = 'preliminar';
    warnings.push(`${noObservadas.length} pieza(s) inferidas por la IA sin confirmar que existen: estado tope 'preliminar'.`);
  }
  // Auditoría 14-oct (P1 de D2): D2 sin ratificación de Producción nunca deja el costo 'certificado'.
  const topeD2 = topeEstadoPorPoliticas(estado, { componentes: piezaEfectiva.componentes, insumos });
  if (topeD2.estado !== estado) { warnings.push(...topeD2.warnings); estado = topeD2.estado; }
  // P0-04 (2026-10-12): el costo de RESPALDO (config-fallback) NUNCA es 'certificado'. Sólo el
  // catálogo central (catalogo_motor, precios aprobados con documento) certifica; si no estuvo,
  // el estado se topa en 'preliminar' aunque la evidencia por insumo diga certificable.
  if (catalogoFuente === 'config-fallback' && estado === 'certificado') {
    estado = 'preliminar';
    warnings.push("Costo con configuración de respaldo (no catálogo central): estado tope 'preliminar'. No es certificable.");
  }

  // P1-03: 'certificado' exige aprobación HUMANA verificada de cada precio exacto usado. Sin ella, tope 'preliminar'.
  if (estado === 'certificado' && !aprobacionHumana) {
    estado = 'preliminar';
    warnings.push(...(aprob.motivos.length ? aprob.motivos : ['Precios sin aprobación humana verificada.']));
  }
  const motivos = conMotivos(estado, warnings);
  warnings.length = 0; warnings.push(...motivos);

  // --- SNAPSHOT reproducible ---
  const meta = {
    versionMotor: MOTOR_VERSION,
    versionConfig: hashConfig(datos),
    // P0-04: la fuente REAL del costo de este snapshot, nunca una etiqueta fija.
    //  'catalogo'        → insumos/precios de catalogo_motor (catálogo central, aprobados con documento)
    //  'config-fallback' → configuración de respaldo (catálogo no disponible): preliminar, no certificable
    versionCatalogo: catalogoFuente === 'catalogo' ? versionCatalogo : `config-fallback-${versionCatalogo}`,
    fuenteCosto: catalogoFuente,
    calculadoEn: new Date().toISOString(),
  };
  return { r, emision, estado, aprobacionHumana, preciosUsados: aprob.precios, warnings, usados, evMap, noCertificados, faltan, meta, catalogoFuente, parametros, insumos, datos, piezaEfectiva, componentes: piezaEfectiva.componentes };
}

/**
 * Costeo normal (no cocrear) DESPUÉS de autenticar: DTO estricto, rol de `permitidos`, capability de confirmación,
 * motor, registro autoritativo (SEG-01c) y salida por capacidad. Es lo que ejecuta la Edge; las pruebas lo llaman igual.
 * @returns {Promise<{status:number, body:object}>}
 */
export async function atenderCosteo({ svc, body, email }) {
  // --- DTO ESTRICTO (seguridad, misma frontera que el cliente) ---
  // El navegador manda INTENCIÓN TÉCNICA; el DINERO lo decide el servidor. Esto cierra
  // la fuga por la que `pieza.margen` del body movía el precio de venta, y rechaza
  // insumo/precio/costo/factores/modeloCosteo inline en lugar de ignorarlos en silencio.
  const v = validarIntentCosteo(body);
  if (!v.ok) return { status: 400, body: { ok: false, code: v.code, issues: v.issues } };
  const intent = v.intent;
  const pieza = intent.pieza;              // { componentes, horas?, dificultad? } — saneado, sin dinero ni modelo
  const n = Math.max(1, Number(intent.cantidad) || 1);

  // --- Servidor autoritativo: rol + config NUNCA vienen del navegador ---
  const { data: permit } = await svc.from('permitidos').select('rol').eq('email', email).maybeSingle();
  if (!permit) return { status: 403, body: { ok: false, error: 'Usuario no autorizado.' } };
  const rol = String(permit.rol || '').toLowerCase();
  const esDireccion = rol === 'direccion';
  const esDiseno = rol === 'diseno';

  // --- CAPABILITY DE CONFIRMACIÓN TÉCNICA (P0.9, servidor autoritativo) ---
  // La confirmación técnica de material (promover a USER_CONFIRMED) sólo la autorizan diseño/
  // dirección. Si un rol SIN capability (p.ej. vendedor) manda material_confirmado=true, se
  // RECHAZA explícito (no se degrada en silencio): 403 MATERIAL_CONFIRMATION_FORBIDDEN.
  const puedeConfirmar = puedeConfirmarMaterial(rol);
  const comps0 = Array.isArray(pieza.componentes) ? pieza.componentes : [];
  if (!puedeConfirmar && comps0.some((c) => c?.material_confirmado === true)) {
    return { status: 403, body: { ok: false, code: 'MATERIAL_CONFIRMATION_FORBIDDEN', error: 'Tu rol no puede confirmar materiales. La confirmación técnica es de Diseño/Dirección.' } };
  }

  const k = await costearConMotor(svc, pieza, n, puedeConfirmar);
  if (k.error) return k.error;
  const { r, estado, aprobacionHumana, warnings, usados, evMap, noCertificados, faltan, meta, catalogoFuente, parametros } = k;

  // SEG-01c (Operación 9.5): registro AUTORITATIVO del costeo. Sólo service_role escribe aquí; la emisión exige que el
  // renglón especial lleve este `costeoId` y que su costo coincida al centavo. Si la tabla no existe todavía (propuesta
  // sin aplicar) el costeo sigue, sin costeoId, y lo dice: la emisión de producción no cambia hasta aplicar SEG-01c.
  const huellaBom = bomHash(k.componentes || []);
  // Especificación técnica EFECTIVA (la pieza que entró a calcular()). La misma que sella K; viaja en la respuesta para
  // que la partida la lleve tal cual. Sólo Diseño/Dirección (registran K); Ventas no recibe datos técnicos.
  const especificacionTecnica = specTecnicaDeCosteo(k.piezaEfectiva);
  let costeoId = null;
  if (esDireccion || esDiseno) {
    // Reauditoría v2 · P1-01: huella de la BASE de costo (config.parametros + catalogo_motor de los insumos usados),
    // calculada por la MISMA función SQL con la que la emisión la recalcula. Sin huella el costeo no emite (fail-closed).
    let baseHuella = null;
    try {
      const { data: hb, error: hbErr } = await svc.rpc('huella_base_costo', { p_ids: usados });
      if (!hbErr && typeof hb === 'string') baseHuella = hb;
    } catch (_e) { /* SEG-01c sin aplicar: queda null */ }
    // SEG-01c rev3/rev4/rev5: identidad y promesa comercial salen de la intención SANEADA; la ESPECIFICACIÓN TÉCNICA, de
    // la pieza EFECTIVA que costeó el motor. Versión y huella de promesa y spec las sella el trigger de la base.
    const { data: regC, error: regErr } = await svc.from('costeos_servidor').insert(filaCosteoServidor({
      intent, piezaEfectiva: k.piezaEfectiva, n, email, rol, bomHash: huellaBom, costoUnitario: dinero(r.costoUnitario), estado, aprobacionHumana, meta,
      precios: k.preciosUsados || [], warnings, insumosUsados: usados, baseCostoHuella: baseHuella,
    })).select('id').single();
    if (regErr) warnings.push('Costeo sin registro autoritativo (SEG-01c no aplicada): no servirá para emitir cuando se aplique.');
    else costeoId = regC?.id ?? null;
  }

  // Precio: SIEMPRE con el margen OBJETIVO del servidor (config/params), NUNCA del
  // body — el DTO ya rechazó cualquier `margen` del cliente. Modelo 'clásico' (Alba)
  // para producto nuevo, que es el caso de costear-servidor; 'intelisis' (líneas App
  // LT) se costea aún en cliente y queda fuera de esta superficie.
  // Mismo valor por omisión que el cliente (datos/precio.js MARGEN_OBJETIVO_DEFAULT = 50, VH-019).
  const margen = Number(parametros.margenObjetivo ?? 50);
  // FAIL-CLOSED: precioDe devuelve NaN ante margen imposible (≥100/<0) o costo no
  // finito. No se convierte en $0 ni se emite: precioVenta = null → sin precio.
  const precioRaw = precioDe(r.costoUnitario, margen);
  const precioVenta = Number.isFinite(precioRaw) ? dinero(precioRaw) : null;

  // El precio se entrega mientras el cálculo sea posible (certificado o preliminar) Y
  // el precio sea un número válido. El sistema debe OPERAR con preliminares; incompleto,
  // bloqueado o un precio no finito (fail-closed) ocultan el precio.
  const hayPrecio = (estado === 'certificado' || estado === 'preliminar') && precioVenta != null;

  // --- SALIDA POR CAPACIDAD ---
  // Ventas: SOLO información comercial. Precio de venta + estado + warnings comerciales.
  // JAMÁS costo base, precio de compra, proveedor, margen, factores ni config.
  if (!esDireccion && !esDiseno) {
    const warnComercial = estado === 'certificado' ? []
      : estado === 'preliminar' ? ['Precio preliminar: sujeto a confirmación de costos.']
      : [estado === 'bloqueado' ? 'El costeo tiene un error técnico que Diseño debe corregir antes de cotizar.' : 'Al costeo le falta un material o precio; pídele a Diseño que lo complete antes de cotizar.'];
    return { status: 200, body: {
      ok: true, estado, piezas: n,
      precioVenta: hayPrecio ? precioVenta : null,
      versionMotor: meta.versionMotor, versionCatalogo: meta.versionCatalogo, calculadoEn: meta.calculadoEn,
      warnings: warnComercial,
    } };
  }

  // Diseño: BOM + costo técnico, SIN información financiera (sin precioVenta, sin margen).
  const tecnico = {
    costoUnitario: dinero(r.costoUnitario),
    materialTotal: dinero(r.materialTotal),
    manoObra: dinero(r.manoObra),
    indirectosFabrica: dinero(r.indirectosFabrica),
    desperdicio: dinero(r.desperdicio),
    detalleInsumos: (r.detalleInsumos || []).map((d) => ({
      insumoId: d.insumoId, nombre: d.nombre, seccion: d.seccion, costo: dinero(d.costo || 0),
      certificable: !!evMap[d.insumoId]?.certificable, evidencia: evMap[d.insumoId]?.estado || 'sin-catalogo',
    })),
    componentesIgnorados: faltan,
  };
  const evidencia = { usados: usados.length, certificados: usados.length - noCertificados.length, noCertificados: noCertificados.length };
  if (esDiseno) return { status: 200, body: { ok: true, estado, aprobacionHumana, costeoId, bomHash: huellaBom, especificacionTecnica, piezas: n, costo: tecnico, evidencia, precios: k.preciosUsados || [], ...meta, catalogoFuente, warnings } };

  // Dirección: todo (incluye precio, margen, desglose completo y evidencia).
  return { status: 200, body: { ok: true, estado, aprobacionHumana, costeoId, bomHash: huellaBom, especificacionTecnica, piezas: n, precioVenta: hayPrecio ? precioVenta : null, margen, costo: tecnico, evidencia, precios: k.preciosUsados || [], desglose: r, ...meta, catalogoFuente, warnings } };
}
