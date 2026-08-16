// Utilidades de formato. Lenguaje de taller, no de contador (master 4.10).

export function pesos(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '$0';
  return '$' + Math.round(n).toLocaleString('es-MX');
}

export function pesos2(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '$0.00';
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '0%';
  return Math.round(n) + '%';
}

export function pct1(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '0%';
  return n.toFixed(1) + '%';
}

// Color de semaforo para un porcentaje de desperdicio (7.2): verde <12, ambar <=25, rojo arriba
export function colorMerma(p) {
  if (p < 12) return 'verde';
  if (p <= 25) return 'ambar';
  return 'rojo';
}

// Color de semaforo para el margen (7.1): verde >=40 (minimo linea), ambar 35-40, rojo <35
export function colorMargen(m) {
  if (m >= 40) return 'verde';
  if (m >= 35) return 'ambar';
  return 'rojo';
}

// Dias desde una fecha ISO
export function diasDesde(iso) {
  if (!iso) return 9999;
  const d = new Date(iso + 'T00:00:00');
  const hoy = new Date('2026-08-11T00:00:00');
  return Math.round((hoy - d) / 86400000);
}

let contador = 0;
export function idNuevo(prefijo = 'id') {
  contador += 1;
  return `${prefijo}-${Date.now()}-${contador}`;
}

// Sello de confianza de una partida (para Voni y la propuesta). TRES niveles,
// y el que manda es de DÓNDE SALIÓ EL PRECIO, no a qué línea pertenece:
//  - FIRME     : precio de un presupuesto cerrado (banco de precios o price-book).
//  - CALIBRADO : lo calculó el modelo, pero esa línea está contrastada contra
//                presupuestos reales (App LT, ±7%). Confiable, no es del papel.
//  - ESTIMADO  : línea sin calibrar. Hoy suelen quedar POR DEBAJO — es donde se
//                pierde dinero, y hay que decirlo con todas sus letras.
//
// Antes esto era una lista escrita a mano (`new Set(['applt'])`), así que TODA
// partida App LT decía "Firme" aunque su precio saliera del modelo, y Modulor y
// Mox decían "Estimado" aunque su precio venga tal cual del papel.
const RUTAS_CALIBRADAS = new Set(['applt']);
const SIN_CALIBRAR = 'Esta línea todavía no tiene precios reales cargados y suele quedar POR DEBAJO. Confírmalo con Diseño antes de cerrar.';
export function selloPartida(pt) {
  if (!pt) return { tipo: 'estimado', texto: 'Estimado', nota: SIN_CALIBRAR };
  if (pt.deBanco) return { tipo: 'firme', texto: 'Firme', nota: 'Precio real del banco de precios (salió de un proyecto cerrado).' };
  if (pt.precioReal) return { tipo: 'firme', texto: 'Firme', nota: 'Precio de lista real, tomado de un presupuesto cerrado de Von Haucke.' };
  if (pt.ruta && RUTAS_CALIBRADAS.has(pt.ruta)) return { tipo: 'calibrado', texto: 'Calibrado', nota: 'Lo calculó el modelo, pero esta línea está contrastada contra presupuestos reales (±7%). No es un precio del papel.' };
  return { tipo: 'estimado', texto: 'Estimado', nota: SIN_CALIBRAR };
}
