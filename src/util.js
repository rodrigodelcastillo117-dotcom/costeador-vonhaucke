// Utilidades de formato. Lenguaje de taller, no de contador (master 4.10).

// ⚠️ DINERO DESCONOCIDO NO ES "$0" (COSTEAR §3, 2026-10-10). Antes null/NaN/Infinity se
// pintaban como "$0" en TODAS las pantallas y PDF: un costo pendiente parecía gratis.
// Ahora se pinta "—". Un 0 real (número) sigue siendo "$0".
export const SIN_DATO = '—';
export function pesos(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return SIN_DATO;
  return '$' + Math.round(n).toLocaleString('es-MX');
}

export function pesos2(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return SIN_DATO;
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '0%';
  return Math.round(n) + '%';
}

// Lee un porcentaje TECLEADO por una persona y lo devuelve seguro.
// Nace de tres cosas reales que se cachan auditando la pantalla de cotización:
//   · el `max` de un <input type=number> NO impide teclear: con 999 salía una
//     propuesta con TOTAL NEGATIVO y se descargaba sin chistar;
//   · un número negativo se convertía en un RECARGO invisible, porque el renglón
//     que lo explica sólo se pinta cuando el descuento es mayor que cero;
//   · "12,5" con coma —como escribe cualquiera en México— se volvía 0% callado.
export function leePct(valor, maximo = 100) {
  const n = parseFloat(String(valor).replace(',', '.'));
  if (!isFinite(n)) return 0;
  return Math.min(maximo, Math.max(0, n));
}

// Hermano de `leePct` para enteros con piso Y techo (metros cuadrados, piezas,
// plazos). Es la MISMA lección, aprendida dos veces y cara las dos:
//
//   · 2026-08-17, los porcentajes: "12.5" de descuento terminaba en el TOPE.
//   · 2026-08-18, los metros: en el Acomodo, teclear "350" NO daba 350.
//     `limpiaM2` acotaba en CADA tecla contra un piso de 20:
//         3 → Math.max(20, 3) = 20   (el campo se rellena solo)
//         5 → "205"                   (la tecla se pega detrás del 20 que salió)
//         0 → "2050"
//     y borrar todo para reescribir era imposible: `Number('') || 0` = 0, y el
//     piso lo devolvía a 20. Cualquier medida fuera de los 8 botones típicos
//     quedaba fuera del alcance del proyectista.
//
// LA REGLA, y por eso vive aquí y no dentro de una pantalla: **acotar es algo
// que se hace cuando la persona TERMINÓ de escribir, nunca por tecla.** Mientras
// escribe, el campo guarda su texto tal cual — es lo que hacen `CampoPct`
// (Cotizacion.jsx) y `CampoM2` (EmpezarEspacio.jsx).
//
// `siVacio` existe porque un campo vacío no siempre vale el piso.
export function leeNumero(txt, min, max, siVacio = min) {
  const limpio = String(txt ?? '').trim().replace(/,/g, '');
  if (limpio === '') return siVacio;
  const n = Number(limpio);
  if (!isFinite(n)) return siVacio;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// ---------------------------------------------------------------------------
//  BUSCADOR — pensado para cómo teclea un vendedor, no para cómo guarda la base.
//
//  Lo que estaba roto y se midió sobre el banco real:
//    "bench 6 lugares" → 0 · "mesa juntas" → 0 · "archivero 2 cajones" → 0
//    "arlequin" → 0 y "arlequín" → 0 · "1200 x 600" → 0 (sólo con el signo ×)
//    "rio" → 82 resultados basura, porque "rio" vive dentro de "escrito-rio-",
//            y la línea Río ni aparecía.
//  Causa: se buscaba la frase PEGADA contra el texto crudo. Dos palabras y ya
//  no encontraba nada.
//
//  Ahora: sin acentos, cada palabra por separado y TODAS tienen que aparecer.
//  Las palabras cortas (≤3 letras, como "rio" o "app") sólo valen si son
//  palabra completa; así "rio" deja de traer los 82 escritorios.
// ---------------------------------------------------------------------------
export function sinAcentos(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Un vendedor no escribe como está guardada la base. Dice "6 lugares" y en el
// papel dice "6 usuarios"; dice "1.20" y la base guarda "1200 mm"; dice "juntas"
// y el renglón dice "junta". Cada palabra de la consulta se abre a sus sinónimos
// y basta con que pegue UNO. Esta tabla se alimenta de lo que él teclea, no de
// lo que el sistema guarda: si vuelve a fallar una búsqueda, se agrega aquí.
const SINONIMOS = {
  lugar: ['usuario', 'puesto'], lugares: ['usuarios', 'puestos'],
  puesto: ['usuario', 'lugar'], puestos: ['usuarios', 'lugares'],
  persona: ['usuario'], personas: ['usuarios'],
  junta: ['juntas', 'reunion', 'sala'], juntas: ['junta', 'reunion', 'sala'],
  cajonera: ['gaveta', 'pedestal'], gaveta: ['cajonera', 'pedestal'],
  archivero: ['archivo'], credenza: ['guarda'],
  banca: ['bench'], bench: ['banca'],
  mampara: ['biombo'], biombo: ['mampara', 'semimampara'],
  escritorio: ['modulo'], silla: ['silleria'], sillon: ['silleria', 'sofa'],
  recepcion: ['recepciones'], privado: ['gerente', 'gerencial', 'direccion'],
};

// "1.20" y "1.5" son la misma medida que "1200" y "1500" en la base.
function enMilimetros(w) {
  const m = /^(\d)\.(\d{1,2})$/.exec(w);
  if (!m) return null;
  return String(Math.round(parseFloat(w) * 1000));
}

export function palabrasBusqueda(consulta) {
  // La "×" del papel y la "x" del teclado son la misma cosa para quien busca.
  return sinAcentos(consulta).replace(/×/g, 'x').split(/[^a-z0-9.]+/).filter(Boolean);
}

export function coincide(consulta, ...campos) {
  const ws = palabrasBusqueda(consulta);
  if (!ws.length) return true;
  const heno = sinAcentos(campos.filter(Boolean).join(' ')).replace(/×/g, 'x');
  const pega = (w) => (w.length <= 3
    ? new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(heno)
    : heno.includes(w));
  return ws.every((w) => {
    const mm = enMilimetros(w);
    const opciones = [w, ...(SINONIMOS[w] || []), ...(mm ? [mm] : [])];
    return opciones.some(pega);
  });
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
// ⚠️ "HOY" ESTABA CONGELADO EN 2026-08-11. Con la fecha de "hoy" escrita a mano
// en vez de `new Date()`, la alerta de "N precios llevan más de 90 días sin
// actualizar" (Tablero.jsx) y el semáforo "viejo" de Precios.jsx quedaron
// calculando la antigüedad contra un día fijo del pasado: cada día real que
// pasa, TODOS los precios se ven varios días "más frescos" de lo que en
// realidad son, y el error sólo crece. Nunca se nota de golpe —no truena, no
// avisa— así que es justo el tipo de bug que erosiona la confianza sin que
// nadie sepa por qué el semáforo de precios viejos ya no prende.
export function diasDesde(iso) {
  if (!iso) return 9999;
  const d = new Date(iso + 'T00:00:00');
  const hoy = new Date();
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
  if (pt.precioReal) return { tipo: 'firme', texto: 'Firme', nota: 'Precio de lista real, tomado de un presupuesto cerrado de Vonhaucke.' };
  if (pt.ruta && RUTAS_CALIBRADAS.has(pt.ruta)) return { tipo: 'calibrado', texto: 'Calibrado', nota: 'Lo calculó el modelo, pero esta línea está contrastada contra presupuestos reales (±7%). No es un precio del papel.' };
  return { tipo: 'estimado', texto: 'Estimado', nota: SIN_CALIBRAR };
}

// CLASE DE COSTO de una partida — una sola verdad para "¿de dónde salió este
// costo?" (mandato Fase 1: separar costo real, derivado y desconocido). Antes
// esta lógica vivía repetida como `sinCosto`/`costoDerivado` en varios lugares
// de Cotizacion. NUNCA se presenta margen sobre un costo 0/proxy como si fuera
// medido (auditoría externa 2026-09-24).
//   'desconocido' → no hay costo medido: pieza de banco (precio real, costo que
//                   no se conoce), o costoUnitario ausente/0. Se muestra "—".
//   'derivado'    → hay un número pero es proxy del precio (precio/3.6), no del
//                   despiece real. Se muestra con "≈".
//   'real'        → costo calculado del despiece/insumos. Se muestra tal cual.
export function claseCosto(pt) {
  if (!pt || pt.deBanco || pt.margen == null || !(pt.costoUnitario > 0)) {
    return { clase: 'desconocido', sinCosto: true, aprox: false };
  }
  if (pt.costoDerivado) return { clase: 'derivado', sinCosto: false, aprox: true };
  return { clase: 'real', sinCosto: false, aprox: false };
}

// Clave de creación de una cotización (idempotencia del alta en la nube). Nace con la
// cotización (almacen.estadoInicial / cargar) y viaja con ella: dos pestañas o dos
// intentos del mismo borrador usan la MISMA clave → el servidor devuelve la misma fila.
// El servidor exige [a-zA-Z0-9_-]{10,100}.
export function claveCreacionNueva() {
  const azar = Math.random().toString(36).slice(2, 10);
  return `cot-${Date.now().toString(36)}-${azar}`;
}
export const CLAVE_CREACION_RE = /^[a-zA-Z0-9_-]{10,100}$/;
