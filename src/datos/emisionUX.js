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
  if (/costo_preliminar|costo_no_certificado/.test(k)) return `${L}el costo existe, pero todavía falta certificar sus precios/evidencias.`;
  if (/sin_product_version_id/.test(k)) return `${L}vuelve a agregarla desde su ficha (falta versión de producto).`;
  if (/product_version_no_corresponde/.test(k)) return `${L}la versión de producto no corresponde; re-agrégala.`;
  if (/precio_bajo_costo|margen_bajo/.test(k)) return `${L}requiere aprobación de Dirección.`;
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
