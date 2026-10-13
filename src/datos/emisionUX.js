// ============================================================================
//  EMISIÓN · UX del gate (seller-safe)  ·  lógica pura, extraída de Cotizacion.jsx
//  Traduce los códigos del gate server-side a lenguaje humano SIN cifras de
//  costo/margen, y los reparte por línea para los chips por partida. Pura y
//  testeable; la UI (chips/banner) vive en Cotizacion.jsx.
// ============================================================================

// Código del gate → mensaje humano seller-safe. "linea_3_costo_desconocido" → claro.
export function textoRazonEmision(code) {
  const m = /^linea_(\d+)_(.+)$/.exec(String(code || ''));
  const n = m ? m[1] : null;
  const k = m ? m[2] : String(code || '');
  const L = n ? `Línea ${n}: ` : '';
  if (/costo_desconocido/.test(k)) return `${L}falta confirmar el costo con Diseño/Dirección.`;
  // VH-035c: la línea cambió de producto, versión, BOM, material, cantidad (costo por lote) o cualquier otra
  // especificación no comercial (nombre, medidas, nota…) después de costearse.
  // El costo anterior se conserva para auditoría, pero no es válido: Dirección debe recostearla.
  if (/recosteo_pendiente/.test(k)) {
    const motivo = k.replace(/^recosteo_pendiente_?/, '');
    // Códigos de private_api.motivos_recosteo_pendiente (vh035c): RECOSTEO_PRODUCTO/MATERIAL/LOTE_CAMBIADO y
    // RECOSTEO_DEFINICION_CAMBIADA.
    const por = {
      producto_cambiado: 'cambió el producto, su versión o su despiece',
      material_cambiado: 'cambió un material',
      lote_cambiado: 'cambió la cantidad y su costo depende del lote',
      definicion_cambiada: 'cambió su descripción, medidas u otra especificación',
    }[motivo] || 'cambió después de costearse';
    return `${L}${por}; su costo anterior ya no vale y Dirección debe recostearla antes de emitir.`;
  }
  // VH-047: códigos del servidor que antes salían crudos al vendedor, y los locales.
  if (/costo_preliminar_no_certificado/.test(k)) return `${L}su costo es preliminar: todavía falta certificar sus precios/evidencias con Diseño/Dirección.`;
  // VH-103: sin economía oficial de la versión de producto (1,931 partidas de lista así en producción):
  // no es un error del vendedor ni se inventa; Dirección carga el costo industrial (reporte de costos
  // Intelisis / expediente). La cotización se conserva como borrador.
  if (/costo_productversion_desconocido/.test(k)) return `${L}este producto no tiene costo industrial oficial cargado en el catálogo; Dirección debe cargarlo (reporte de costos / expediente). Conserva la cotización como borrador mientras tanto.`;
  if (/costo_no_certificado/.test(k)) return `${L}su costeo está incompleto; complétalo antes de emitir.`;
  if (/costo_preliminar|costo_no_certificado/.test(k)) return `${L}el costo existe, pero todavía falta certificar sus precios/evidencias.`;
  if (/sin_material/.test(k)) return `${L}tiene piezas sin material asignado.`;
  if (/sin_product_id|producto_version_id_invalido/.test(k)) return `${L}vuelve a agregarla desde su ficha (identidad de producto incompleta).`;
  if (/ingenieria_preliminar/.test(k)) return `${L}el especial aún no tiene ingeniería aprobada.`;
  if (/costo_especial_no_certificado/.test(k)) return `${L}el costo del especial es estimado; requiere aprobación de Dirección.`;
  if (/precio_especial_no_autoritativo/.test(k)) return `${L}el precio no coincide con el autorizado para el especial; vuelve a cotizarla.`;
  if (/descuento_invalido/.test(k)) return `${L}el descuento no es válido (0–100 %).`;
  if (/^especial_/.test(k)) return `${L}el especial no está listo para cotizarse (${k.replace(/^especial_/, '').replace(/_/g, ' ').toLowerCase()}).`;
  if (/piezas_excluidas_sin_confirmar/.test(k)) return 'Confirma las piezas excluidas antes de emitir.';
  if (/sin_partidas|snapshot_sin_partidas/.test(k)) return 'La cotización no tiene partidas.';
  if (/no_existe|cotizacion_no_existe/.test(k)) return 'La cotización no existe en la nube; guárdala de nuevo.';
  if (/sin_product_version_id/.test(k)) return `${L}vuelve a agregarla desde su ficha (falta versión de producto).`;
  if (/product_version_no_corresponde/.test(k)) return `${L}la versión de producto no corresponde; re-agrégala.`;
  if (/precio_bajo_costo|margen_bajo/.test(k)) return `${L}requiere aprobación de Dirección.`;
  // SEG-01 (propuesta): el renglón que se quiere emitir no es el que se costeó (nombre, medidas, material, cantidad…).
  if (/no_corresponde_a_lo_costeado/.test(k)) return `${L}no corresponde a lo que se costeó (cambió el mueble, sus medidas, su material o su cantidad). Guarda la cotización y, si cambió el mueble, pide que Dirección lo recostee.`;
  if (/identidad_no_coincide|sin_correspondencia/.test(k)) return `${L}cambió desde lo guardado; guarda de nuevo.`;
  if (/cantidad_invalida/.test(k)) return `${L}falta una cantidad válida.`;
  if (/precio_invalido/.test(k)) return `${L}falta un precio válido.`;
  if (/partidas_no_corresponden/.test(k)) return 'Guarda la cotización antes de emitir.';
  if (/politica_comercial_sin_margen_minimo/.test(k)) return 'Falta configurar la política comercial (margen mínimo) — avisa a Dirección.';
  if (/aprobacion_requerida/.test(k)) return 'Requiere aprobación de Dirección para este contenido.';
  if (/sin_permiso|no_autorizado/.test(k)) return 'No tienes permiso para emitir esta cotización.';
  if (/sin_guardar/.test(k)) return 'Guarda la cotización primero.';
  // Producto no registrado como versión canónica (la línea apunta a un producto que
  // el servidor no reconoce): hay que re-agregarla desde su ficha / Cocrear.
  if (/producto_id_invalido|producto_invalido|producto_no_registrad/.test(k)) return `${L}re-agrégala desde su ficha (el producto no está registrado como versión).`;
  // Especial co-diseñado cuyo costo aún no está confirmado en el servidor.
  if (/costo_especial_desconocido|especial_sin_costo/.test(k)) return `${L}falta confirmar el costo del especial con Diseño/Dirección.`;
  // Fallback: código desconocido. Conservamos el "Línea N:" para no perder a cuál
  // renglón se refiere (antes se tragaba el prefijo y salía el código crudo solo).
  return L + k;
}

export const ESTADO_EMISION = {
  ALLOWED: { tono: 'verde', titulo: 'Lista para emitir' },
  DESCONOCIDO: { tono: 'gris', titulo: 'No se pudo consultar al servidor; se vuelve a verificar al emitir' },
  ECONOMICS_INCOMPLETE: { tono: 'ambar', titulo: 'Faltan datos para cotizar (no es un error): resuélvelos para emitir' },
  APPROVAL_REQUIRED: { tono: 'ambar', titulo: 'Requiere aprobación de Dirección antes de emitir' },
  BLOCKED: { tono: 'rojo', titulo: 'No se puede emitir todavía' },
};

// Reparte las razones del gate por LÍNEA (1-based) para el chip pegado a cada partida:
// el vendedor ve QUÉ renglón detiene la emisión, no sólo un bloque abajo. Un código
// `linea_3_costo_desconocido` cae en la línea 3; los sin número van al banner general.
export function razonesPorLinea(gate) {
  const map = new Map();
  if (!gate) return map;
  const codes = [...new Set([...(gate.motivos || []), ...(gate.economics || [])])];
  for (const code of codes) {
    const m = /^linea_(\d+)_(.+)$/.exec(String(code || ''));
    if (!m) continue;
    const n = Number(m[1]);
    // El texto seller-safe ya trae "Línea N: …"; aquí sobra el prefijo porque el
    // chip ya está pegado a su renglón.
    const texto = textoRazonEmision(code).replace(/^Línea\s*\d+:\s*/, '');
    const aprob = /aprobaci/i.test(texto);
    if (!map.has(n)) map.set(n, { tono: aprob ? 'aprob' : 'falta', textos: [] });
    const e = map.get(n);
    if (aprob) e.tono = 'aprob';
    e.textos.push(texto);
  }
  return map;
}
