import { INSUMOS_SEMILLA } from './insumos.js';

// Lectura económica canónica de Compras/ERP, sólo en memoria de Dirección/Diseño.
// NO persiste ni reemplaza la config legacy; evita inflar/eliminar datos históricos.
// Los nombres, IDs, claves ERP y la fuente provienen EXCLUSIVAMENTE de Supabase.
const valido = (n) => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n)) && Number(n) > 0;
const num = (n) => valido(n) ? Number(n) : null;
const normalUnidad = (x) => String(x || '').trim().toLowerCase().replace('pieza', 'pza').replace('m²','m2');
const ESTADOS = { aprobado: 30, propuesto_validado: 20, propuesto: 10 };
const EVIDENCIA = { documentada: 3, concordante: 2, referenciada: 1, sin_evidencia: 0 };
const CREDIBILIDAD = { alta: 3, media: 2, baja: 1 };

export function ordenarPrecios(a, b) {
  // Aprobación explícita > documento identificado ERP > fuente referenciada > semilla.
  const puntaje = (p) => {
    if (p.estado === 'aprobado' && p.approved_at) return 100;
    if (p.contract_status === 'DATA_TRUTH_V1' && p.source_system && p.source_document && p.source_record_id && p.evidence_status === 'documentada') return 90;
    return (ESTADOS[p.estado] || 0) + (EVIDENCIA[p.evidence_status] || 0) + (CREDIBILIDAD[p.confidence] || 0);
  };
  return puntaje(b) - puntaje(a)
    || String(b.vigente_desde || '').localeCompare(String(a.vigente_desde || ''))
    || Number(b.id || 0) - Number(a.id || 0);
}

export function evaluarPrecioCompra(precio, ref, baseline = null) {
  if (!precio) return { precio: null, estado: 'SIN_PRECIO', aptoEstimacion: false, cert: false, error: 'Sin precio registrado' };
  const unidad = normalUnidad(ref?.unidad_costeo || baseline?.unidad);
  const uOrigen = normalUnidad(precio.unidad_compra);
  const costoMXN = num(precio.cost_unit_price_mxn);
  const valorCosteable = costoMXN ?? num(precio.precio);
  const pCompra = num(precio.precio_compra);
  const factor = num(precio.factor_conversion);
  const moneda = String(precio.source_currency || '').toUpperCase();
  const monedaOriginal = String(baseline?.moneda || '').toUpperCase();
  const monedaIncierta = costoMXN == null && (moneda && moneda !== 'MXN' || monedaOriginal && monedaOriginal !== 'MXN');
  if (!valorCosteable) return { precio:null,estado:'PRECIO_INVALIDO',aptoEstimacion:false,cert:false,error:'Precio ausente o inválido' };
  if (monedaIncierta) return { precio:null,estado:'DIVISA_PENDIENTE',aptoEstimacion:false,cert:false,error:'Moneda sin conversión MXN documentada' };
  if (!unidad || !uOrigen || !factor) return {precio:null,estado:'UNIDAD_PENDIENTE',aptoEstimacion:false,cert:false,error:'Falta unidad o conversión' };
  if (precio.cost_unit && normalUnidad(precio.cost_unit) !== unidad) return {precio:null,estado:'UNIDAD_CONFLICTO',aptoEstimacion:false,cert:false,error:'La unidad de costo ERP difiere del catálogo' };
  if (unidad !== uOrigen && !(unidad === 'hoja' && uOrigen === 'kg' && factor > 1))
    return {precio:null,estado:'UNIDAD_CONFLICTO',aptoEstimacion:false,cert:false,error:'Conversión de unidad no autorizada' };
  const esperado = pCompra != null ? pCompra * factor : null;
  if (esperado != null && costoMXN == null && Math.abs(valorCosteable - esperado) > Math.max(0.02, 0.00005 * valorCosteable))
    return {precio:null,estado:'PRECIO_CONVERSION_CONFLICTO',aptoEstimacion:false,cert:false,error:'Precio no cuadra con precio compra × factor' };
  if (precio.estado === 'aprobado' && precio.approved_at && !precio.requiere_validacion_compras) {
    return {precio:valorCosteable,estado:'APROBADO',aptoEstimacion:true,cert:true,error:''};
  }
  if (precio.evidence_status === 'documentada' && precio.source_document && precio.source_record_id)
    return {precio:valorCosteable,estado:'ERP_DOCUMENTADO',aptoEstimacion:true,cert:false,error:''};
  if (precio.evidence_status === 'referenciada' || precio.evidence_status === 'concordante')
    return {precio:valorCosteable,estado:'REFERENCIA_COMPRAS',aptoEstimacion:true,cert:false,error:''};
  return {precio:valorCosteable,estado:'SIN_EVIDENCIA',aptoEstimacion:true,cert:false,error:'Importe registrado, fuente de compra no acreditada'};
}

function identidadExterna(id, mapeos = [], precio) {
  const relacionado = mapeos.filter((x) => x.insumo_id === id
    && x.estado !== 'rechazado'
    && String(x.source_record_id || x.external_key || '') === String(precio?.source_record_id || x.source_record_id || x.external_key || ''));
  return {
    clavesERP: [...new Set([
      ...(precio?.source_record_id ? [String(precio.source_record_id)] : []),
      ...relacionado.map((m) => String(m.external_key || '')).filter(Boolean),
    ])],
    mapeosERP: relacionado.map((m) => ({ clave:m.external_key, documento:m.source_document, estado:m.estado, identidad:m.identity_status })),
  };
}

// "Catalogo efectivo" nunca actualiza la BD ni infiere un formato físico.
// Artículos sin formato se pueden costear SOLO por unidad de consumo explícita
// (kg, metro, pieza, juego, hoja), no por un nesting inventado.
export function construirCatalogoCompras(base = {}, referencias = [], precios = [], mapeos = []) {
  const result = { ...(base || {}) };
  const porId = new Map();
  for (const p of Array.isArray(precios) ? precios : []) {
    if (!p || !p.insumo_id || p.vigente_hasta) continue;
    const a = porId.get(p.insumo_id) || [];
    a.push(p); porId.set(p.insumo_id, a);
  }
  const stats = { catalogo:0, conPrecio:0, sinPrecio:0, preliminares:0, aprobados:0, bloqueados:0 };
  const referenciasCompletas = [];
  // SOLO REFERENCIA identificada, nunca precio de compra ni emisión.
  // En particular el solid surface ASUR sí existe en semillas de ingeniería,
  // pero aún no tiene entrada verificada de compras.
  const referenciasSemilla = new Map(INSUMOS_SEMILLA.map((x) => [x.id, x]));
  for (const ref of Array.isArray(referencias) ? referencias : []) {
    if (!ref || ref.activo === false || !ref.id || !ref.nombre) continue;
    stats.catalogo++;
    const anterior = (base || {})[ref.id] || null;
    const candidatos = (porId.get(ref.id) || []).slice().sort(ordenarPrecios);
    const elegido = candidatos[0] || null;
    const economia = evaluarPrecioCompra(elegido, ref, anterior);
    const semilla = referenciasSemilla.get(ref.id);
    const estimacionMercado = !elegido && semilla?.fuente && /mercado|estimado|afina/i.test(String(semilla.fuente) + ' ' + String(semilla.nota || ''))
      && Number.isFinite(Number(semilla.precio)) && Number(semilla.precio) > 0
      ? { precio: Number(semilla.precio), unidad: semilla.unidad, fuente: semilla.fuente, nota: semilla.nota || '' }
      : null;
    // Autorización explícita del usuario (10/oct): estas tres tarifas sirven
    // para ESTIMAR módulos ASUR aun sin factura registrada. No son compras ERP,
    // ni se heredan a otros insumos. Cuando llega factura REAL, gana Compras.
    const tarifaASUR = !elegido && ['solid-surface','solid-surface-azul','adhesivo-solid-surface'].includes(ref.id)
      ? estimacionMercado : null;
    const precioEstimadoAutorizado = tarifaASUR?.precio ?? null;
    const economiaFinal = tarifaASUR
      ? { precio:precioEstimadoAutorizado, estado:'ESTIMADO_AUTORIZADO_ASUR', aptoEstimacion:true, cert:false,
          error:'Tarifa ASUR autorizada para ESTIMACIÓN por el usuario; no representa factura ni costo confirmado de Compras.' }
      : economia;
    const externo = identidadExterna(ref.id, mapeos, elegido);
    const metadata = {
      codigoCompras:ref.id, clavesERP:externo.clavesERP, mapeosERP:externo.mapeosERP,
      descripcionCompras:ref.nombre, familiaCompras:ref.familia || '', clasificacionCompras:ref.clasificacion || '', materialCompras:ref.material || '', atributosCompras:ref.atributos || null, calibreCompras:ref.calibre ?? null,
      espesorMMCompras:ref.espesor_mm ?? null, formatoCompras:ref.formato || null,
      unidadCompra:elegido?.unidad_compra || '', unidadCosteo:ref.unidad_costeo || '',
      precioCompraOriginal:num(elegido?.precio_compra), factorConversion:num(elegido?.factor_conversion),
      monedaOrigen:elegido?.source_currency || '', precioOrigen:num(elegido?.source_price),unidadOrigen:elegido?.source_unit || '', tasaCambio:num(elegido?.fx_rate),fechaCambio:elegido?.fx_date || null,
      proveedorCompra:elegido?.proveedor || '', propiedadesPrecio:elegido?.propiedades || null, evidenciaDescripcion:elegido?.evidencia || '',
      fuenteCompra:elegido?.source_document || elegido?.fuente || '',
      sistemaFuente:elegido?.source_system || '', registroFuente:elegido?.source_record_id || '',
      fechaFuente:elegido?.vigente_desde || '', precioEstado:elegido?.estado || 'sin_precio',
      contratoPrecio:elegido?.contract_status || '', confianzaPrecio:elegido?.confidence || '',
      evidenciaPrecio:elegido?.evidence_status || '', precioId:elegido?.id ?? null,
      versionesPrecio:candidatos.map((x) => ({id:x.id,precio:num(x.cost_unit_price_mxn) ?? num(x.precio),estado:x.estado,fuente:x.source_document || x.fuente || '',claveERP:x.source_record_id || '',fecha:x.vigente_desde || ''})),
      estadoEconomia:economiaFinal.estado, aptoEstimacion:economiaFinal.aptoEstimacion, precioCertificable:economiaFinal.cert,
      observacionPrecio:economiaFinal.error,
      // Referencia técnica provisional y bien diferenciada de factura/OC.
      // Solo las tarifas ASUR autorizadas se convierten en COSTO PRELIMINAR; nunca oficial.
      estimacionMercado,
      fuenteCatalogo:'compras', disponibleCosteo:economiaFinal.aptoEstimacion,
    };
    const unidad = ref.unidad_costeo || anterior?.unidad || '';
    // Solo se hereda geometría/merma del mismo ID ya conocido por el motor.
    const insumo = {...(anterior || {}),id:ref.id,nombre:ref.nombre,seccion:ref.seccion||anterior?.seccion||'',unidad,...metadata,precioReferencia:economiaFinal.precio};
    if (economiaFinal.aptoEstimacion) {
      insumo.precio = economiaFinal.precio;
      insumo.precioBase = economiaFinal.precio;
      insumo.moneda = 'MXN';
    } else {
      delete insumo.precio;
      delete insumo.precioBase;
      insumo.disponibleCosteo = false;
    }
    // Si el artículo es nuevo y se compra por hoja, no inferimos medidas.
    // Una fracción explícita de hojas sólo se costea cuando se conozca formato real.
    if (!anterior && unidad === 'hoja') {
      insumo.formatoPendiente = !ref.formato;
      if (ref.formato && typeof ref.formato === 'object' && Number(ref.formato.medida) > 0) {
        insumo.formato = ref.formato;
        insumo.fraccion = true;
      } else {
        delete insumo.formato;
        insumo.fraccion = false;
        // COSTO POR HOJA ≠ COSTO POR m²: sin formato conocido, una pieza con
        // 2 m² no puede convertirse a 2 hojas (error de dinero material).
        // Preservamos el importe/clave/fuente sólo para consulta.
        // El precio por hoja SÍ es real y costea si se informa CUÁNTAS HOJAS
        // consume. El motor bloquea automáticamente área m² sin conversión.
        // No convertir m² × $/hoja ni asumir medidas inexistentes.
        insumo.estadoEconomia = 'FORMATO_PENDIENTE';
        insumo.precioCertificable = false;
        insumo.observacionPrecio = 'Precio por hoja disponible: introduce fracción de hoja consumida. Sin formato real no se calcula nesting/área automáticamente.';
      }
    }
    if (!anterior && ['herrajes','electrico','graficos'].includes(insumo.seccion)) insumo.clase = 'indirecta';
    if (!anterior && !insumo.clase) insumo.clase = 'directa';
    result[ref.id] = insumo;
    referenciasCompletas.push(insumo);
    if (economiaFinal.aptoEstimacion) {stats.conPrecio++; economiaFinal.cert ? stats.aprobados++ : stats.preliminares++;}
    else {stats.bloqueados++; if(!elegido)stats.sinPrecio++;}
  }
  return { insumos:result, referencias:referenciasCompletas, stats };
}
