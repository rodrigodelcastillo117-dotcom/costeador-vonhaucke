// ============================================================================
//  PRECIOS DE VENTA REALES (price-book) — la fuente MÁS exacta que existe.
//  Cada entrada es un precio de LISTA BRUTA (P.Unitario) sacado de un presupuesto
//  real de Von Haucke. Cuando el vendedor arma exactamente esa config, la app
//  cotiza con ESTE número (al centavo), no con el modelo. El modelo solo entra
//  cuando NO hay precio real (medida/spec nunca cotizado, o un especial).
//
//  CRECE con cada presupuesto: agregar una fila aquí = esa cotización queda clavada.
//
//  Clave = linea + producto + largoMM + fondoMM + usuarios + biombo (spec completo,
//  porque el mismo módulo varía según biombo/eléctrico). null = "no aplica / cualquiera".
// ============================================================================

// --- EL "PRECIO 2" NO SE COTIZA NUNCA ----------------------------------------
// Regla de Von Haucke (Rodrigo, 2026-08-15): el número grande que imprime el
// presupuesto en la columna P.Unitario se llama internamente "precio 2", y
// NUNCA se usa tal cual. Sobre él se aplica SIEMPRE un 40% para llegar al
// PRECIO DE LISTA, que es el que se muestra al cliente y el que se cobra.
//
// Por eso los presupuestos que no imprimen columna de descuento ya publican
// directo el precio de lista: el 40% ya viene aplicado.
//
// El campo `lista` de cada fila guarda el PRECIO 2 (así se lee tal cual del
// presupuesto y así se compara contra el papel). Lo que la app cotiza es
// `precioDeLista(fila.lista)`. Cambiar esta constante mueve TODOS los precios.
export const DESCUENTO_PRECIO2 = 0.40;
export function precioDeLista(precio2) { return precio2 * (1 - DESCUENTO_PRECIO2); }

// Precio 2 = costoUnitario(Intelisis) × 1.20 (utilidad) × 3 (factor lista) = ×3.6.
// Para el margen/semáforo despejamos el costo implícito a partir del PRECIO 2.
export const FACTOR_LISTA_SOBRE_COSTO = 3.6;
export function costoImplicito(precio2) { return precio2 / FACTOR_LISTA_SOBRE_COSTO; }

// Cada fila: { linea, producto, largoMM, fondoMM, usuarios, biombo, lista, fuente, nota? }
export const PRECIOS_VENTA = [
  // --- APP LT · Operativo (bench) · MODULO base (sin eléctrico ni gaveta; ésos son add-ons) ---
  { linea: 'applt', producto: 'banca_sencilla', largoMM: 1200, fondoMM: 600, usuarios: 1, biombo: 'pet', lista: 10040, fuente: '226030018 (12 may 2026)' },
  { linea: 'applt', producto: 'banca_sencilla', largoMM: 1200, fondoMM: 600, usuarios: 2, biombo: 'pet', lista: 26800, fuente: '226030018 (12 may 2026)' },
  // ✅ YA ALCANZABLES (2026-08-16): 1050 se agregó a los largos del generador. Lo
  // único que de verdad faltaba era la LONGITUD del riel a esa medida (el patrón
  // es módulo − 300); cubierta y omega ya resolvían solas por su fallback. Las
  // claves de fábrica a 1050 siguen sin venir en ningún presupuesto y van en null.
  { linea: 'applt', producto: 'banca_doble', largoMM: 1050, fondoMM: 1200, usuarios: 4, biombo: 'pet', lista: 20920, fuente: '226030018 (12 may 2026)' },
  { linea: 'applt', producto: 'banca_doble', largoMM: 1050, fondoMM: 1200, usuarios: 8, biombo: 'pet', lista: 39880, fuente: '226030018 (12 may 2026)' },
  // Anclas ALCANZABLES de banca doble (presupuesto Mixue 226030134, 26-jun-2026).
  // Ahí el módulo mide 1200 por columna: 6u = 3600×1200 y 8u = 4800×1200, que sí
  // se pueden armar con los largos del generador. Los P.Unitario de ese documento
  // ya son precio de lista → el precio 2 se reconstruye ÷0.60.
  { linea: 'applt', producto: 'banca_doble', largoMM: 1200, fondoMM: 1200, usuarios: 6, biombo: 'pet', lista: 29333, base: 'derivada', fecha: '2026-06-26', fuente: '226030134 (Mixue)', nota: 'Clave TATO63612ABCRT01. Precio de lista $17,600.' },
  { linea: 'applt', producto: 'banca_doble', largoMM: 1200, fondoMM: 1200, usuarios: 8, biombo: 'pet', lista: 38900, base: 'derivada', fecha: '2026-06-26', fuente: '226030134 (Mixue)', nota: 'Clave TATO84812ABCT01. Precio de lista $23,340. Contra el precio 2 impreso en 226030018 ($39,880) queda a 97.5%.' },
  // ==========================================================================
  //  MÓDULO DE 1.50 — la familia que faltaba entera (sembrada 2026-08-16)
  //
  //  El "choque de 2.5×" que bloqueaba todo era esto: el price-book sólo tenía
  //  anclas de módulo 1.05 y 1.20, y se estaba comparando contra presupuestos de
  //  módulo 1.50 CON biombos laterales. Nunca fueron el mismo producto. Puestos
  //  en la misma base, los papeles cierran dentro del 11%.
  //
  //  ⚠️ ORDEN IMPORTANTE: las filas con `sel: { laterales: true }` van ANTES que
  //  sus gemelas sin laterales, porque `buscarFila` devuelve la PRIMERA que calza
  //  y una fila sin `sel` calza con laterales puestos o no.
  // --------------------------------------------------------------------------
  // Con laterales (BMU 225080025 / proy. 2508040, 06-mar-2026). Ese documento
  // publica precio de lista → el precio 2 se reconstruye ÷0.60. Comprobado
  // contra un artículo compartido con 226030018: la gaveta Mox sale $5,350
  // bruta −40% = $3,210 allá y $3,220 aquí (0.3%).
  { linea: 'applt', producto: 'banca_doble', largoMM: 1500, fondoMM: 1200, usuarios: 2, biombo: 'melamina', sel: { laterales: true }, lista: 26167, base: 'derivada', fuente: '225080025 / 2508040 (BMU)', nota: 'Precio de lista $15,700. Biombo frontal Y laterales en melamina ABS, bases metal, conducto metálico.' },
  { linea: 'applt', producto: 'banca_doble', largoMM: 1500, fondoMM: 1200, usuarios: 4, biombo: 'melamina', sel: { laterales: true }, lista: 43300, base: 'derivada', fuente: '225080025 / 2508040 (BMU)', nota: 'Precio de lista $25,980.' },
  { linea: 'applt', producto: 'banca_doble', largoMM: 1500, fondoMM: 1200, usuarios: 6, biombo: 'melamina', sel: { laterales: true }, lista: 60433, base: 'derivada', fuente: '225080025 / 2508040 (BMU)', nota: 'Precio de lista $36,260.' },
  // Sin laterales — el MISMO módulo de 3000×1200 4u en el mismo presupuesto, que
  // es de donde sale cuánto cuestan los laterales: $22,590 sin ellos, $25,980 con.
  { linea: 'applt', producto: 'banca_doble', largoMM: 1500, fondoMM: 1200, usuarios: 4, biombo: 'melamina', lista: 37650, base: 'derivada', fuente: '225080025 (BMU, partida 1)', nota: 'Precio de lista $22,590. Semimamparas frontales y centrales, sin laterales.' },
  { linea: 'applt', producto: 'banca_doble', largoMM: 1500, fondoMM: 1200, usuarios: 4, biombo: 'cristal', lista: 38333, base: 'derivada', fuente: '225080025 (BMU, partida 1)', nota: 'Precio de lista $23,000. Semimamparas en cristal templado.' },
  // Ancla independiente y con la columna de descuento IMPRESA (no hay que derivar
  // nada): mismo 1500×1200 de 2 usuarios, con biombo divisor en cristal.
  { linea: 'applt', producto: 'banca_doble', largoMM: 1500, fondoMM: 1200, usuarios: 2, biombo: 'cristal', lista: 17660, fuente: '226010047 (Fuerza Especial, ene 2026)', nota: 'Clave TATO21512ABCT01. P.Unitario impreso con Desc. 40% → neto $10,596.' },
  { linea: 'applt', producto: 'banca_sencilla', largoMM: 1500, fondoMM: 600, usuarios: 1, biombo: null, lista: 14583, base: 'derivada', fuente: '225080025 / 2508040 (BMU)', nota: 'Precio de lista $8,750. Cubierta, estructura y faldón metálico; sin biombo.' },
  // Corridas largas a módulo 1.20 (Tradeco 226030004). Cierran el hueco de 10 y 12
  // usuarios, que hasta hoy caían al modelo.
  { linea: 'applt', producto: 'banca_doble', largoMM: 1200, fondoMM: 1200, usuarios: 10, biombo: 'cristal', lista: 47567, base: 'derivada', fuente: '226030004 (Tradeco)', nota: 'Precio de lista $28,540 (6000×1200).' },
  { linea: 'applt', producto: 'banca_doble', largoMM: 1200, fondoMM: 1200, usuarios: 12, biombo: 'cristal', lista: 56683, base: 'derivada', fuente: '226030004 (Tradeco)', nota: 'Precio de lista $34,010 (7200×1200).' },
  // --- RÍO · la primera ancla de papel de la línea -------------------------
  // Va sobre el bench CURVO, no el recto: Río es una línea de serpentina — las
  // cubiertas alternan convexa/cóncava y el biombo sigue la misma onda (foto de
  // línea, Rodrigo 2026-08-16). Un "bench Río" de un presupuesto es el curvo.
  // 226060050 (Grupo Ginez): bench doble 4800×1200 de 8 usuarios = $37,230 de
  // lista → $4,654/puesto. Es la ÚNICA comparación de geometría idéntica que
  // existe entre dos líneas: App LT cuesta $2,933/puesto en ese mismo
  // 4800×1200 8u, o sea que Río es 1.59× App LT medido, no dictado.
  { linea: 'rio', producto: 'bench_curvo_doble', sel: { usuarios: '8', largo: '1200' }, lista: 62050, base: 'derivada', fuente: '226060050 (Grupo Ginez, jun 2026)', nota: 'Precio de lista $37,230. Biombo PET, estructura metálica.' },
  // --- APP LT · Mesa de juntas (este módulo YA incluye 2 cajas eléctricas en el precio) ---
  { linea: 'applt', producto: 'mesa_juntas', largoMM: 2400, fondoMM: 1200, usuarios: null, biombo: null, lista: 27346, fuente: '226030018 (12 may 2026)', incluyeElectrico: true, nota: 'Incluye 2 cajas eléctricas' },
  // El operativo 3600×600 3u aparece a $26,760 y $37,960 en el MISMO presupuesto,
  // con descripción idéntica palabra por palabra. Ya se puede sembrar: se comparó
  // el render de las dos áreas y la de $37,960 lleva divisores perpendiculares
  // entre puesto y puesto; la de $26,760 sólo el biombo de espalda. El generador
  // ya distingue las dos con la opción `divisores`.
  { linea: 'applt', producto: 'banca_sencilla', largoMM: 1200, fondoMM: 600, usuarios: 3, biombo: 'pet', sel: { divisores: true }, lista: 37960, fuente: '226030018 (área OPERATIVO 3U B)', nota: 'Con divisores entre puestos. Neto $22,776.' },
  { linea: 'applt', producto: 'banca_sencilla', largoMM: 1200, fondoMM: 600, usuarios: 3, biombo: 'pet', lista: 26760, fuente: '226030018 (área OPERATIVO 3U A)', nota: 'Sólo biombo de espalda. Neto $16,056.' },

  // ==========================================================================
  //  MODULOR y MOX — primeras anclas reales (lote de 9 presupuestos, ago-2026).
  //  El modelo clásico cotizaba estas guardas ~5× por debajo: el archivero de
  //  1.20 salía en $3,395 y su lista real es $17,120.
  //  Se eligen por MODELO, no por medida → van con `sel`.
  // ==========================================================================
  { linea: 'modulor', producto: 'archivero_h', sel: { modelo: 'puertas90' }, largoMM: null, fondoMM: null, usuarios: null, biombo: null,
    lista: 12050, base: 'derivada', fecha: '2026-06-26', fuente: '226030134 (Mixue) y 225120019 (PrestigeMotors)',
    nota: 'Los dos presupuestos imprimen el MISMO neto $7,230 con 6 meses de diferencia; bruta = /0.60.' },
  // Se toma el MÁS RECIENTE (Rodrigo): en enero valía $17,120 de precio 2 y en
  // junio $15,767 — un 8% de diferencia que es movimiento de lista, no otro
  // producto: las dos descripciones son idénticas palabra por palabra.
  { linea: 'modulor', producto: 'archivero_h', sel: { modelo: 'cajones120izq' }, largoMM: null, fondoMM: null, usuarios: null, biombo: null,
    lista: 15767, base: 'derivada', fecha: '2026-06-16', fuente: '226060050',
    nota: 'Clave real MOAHCL4IABSJ, 1200×582×448. En 226010047 (ene-2026) el precio 2 impreso era $17,120.' },
  { linea: 'modulor', producto: 'archivero_h', sel: { modelo: 'cajones120der' }, largoMM: null, fondoMM: null, usuarios: null, biombo: null,
    lista: 15767, base: 'derivada', fecha: '2026-06-16', fuente: '226060050',
    nota: 'Clave real MOAHCL4DABSJ. Mano derecha e izquierda cuestan igual; el cojín tampoco mueve el precio.' },
  // Archiveros Modulor de 2 puertas: el modelo los cotizaba en ~$3,000 cuando
  // el papel dice $6,440–$8,670 de lista. Salió al costear un proyecto real
  // completo con Voni, no revisando el generador.
  { linea: 'modulor', producto: 'archivero_h', sel: { modelo: 'puertas75' }, largoMM: null, fondoMM: null, usuarios: null, biombo: null,
    lista: 12870, base: 'impresa', fecha: '2026-05-12', fuente: '226030018',
    nota: '0.75 × 0.75 × 0.42, 2 puertas verticales y 1 entrepaño, cerradura. Precio de lista $7,722.' },
  { linea: 'mox', producto: 'rodante', sel: { frentes: 'melamina', tapa: 'melamina' }, largoMM: null, fondoMM: null, usuarios: null, biombo: null,
    lista: 5350, base: 'impresa', fecha: '2026-05-12', fuente: '226030018',
    nota: 'Gaveta rodante 380×580×460, 1 cajón archivero + 1 papelero, cerradura. Repetida 15 veces en ese presupuesto.' },
];

// Busca el precio de venta real para una config. Devuelve la fila o null.
// `sel` cubre las líneas que NO se eligen por medida sino por MODELO (Modulor
// se pide como "0.90 · 2 puertas", Mox por frentes y tapa): sin esto, esas
// líneas no se podían clavar a un precio real.
// App no tiene ni un precio real propio, pero es la MISMA construcción que App
// LT con acabados premium: Rodrigo la fija 10% arriba. Sin esta herencia, en las
// configs donde App LT sí tiene precio del papel, App salía MÁS BARATA que App
// LT — al revés de la realidad. Se marca `heredada` para que el sello NO la
// llame "Firme": el precio es derivado, no viene del papel.
const HEREDA = { app: { de: 'applt', factor: 1.10 } };

export function buscarPrecioVenta(linea, cfg) {
  const propia = buscarFila(linea, cfg);
  if (propia) return propia;
  const h = HEREDA[linea];
  if (!h) return null;
  const base = buscarFila(h.de, cfg);
  return base ? { ...base, lista: base.lista * h.factor, heredada: h.de, factorHerencia: h.factor } : null;
}

function buscarFila(linea, cfg) {
  if (!cfg) return null;
  const bio = cfg.biombo || null;
  const selCoincide = (e) => !e.sel || Object.entries(e.sel).every(([k, v]) => String(cfg[k]) === String(v));
  return PRECIOS_VENTA.find((e) =>
    e.linea === linea &&
    e.producto === cfg.producto &&
    (e.largoMM == null || e.largoMM === cfg.largoMM) &&
    (e.fondoMM == null || e.fondoMM === cfg.fondoMM) &&
    (e.usuarios == null || e.usuarios === (cfg.usuarios ?? null) || e.usuarios === cfg.usuarios) &&
    (e.biombo == null || e.biombo === bio) &&
    selCoincide(e)
  ) || null;
}

// ============================================================================
//  BANCAS APP LT: EL PRECIO SE ARMA POR USUARIO
//
//  Rodrigo (2026-08-16): "tú puedes sacar el precio por usuario y ponerlo, y en
//  el caso de 10, lo multiplicas por 10."
//
//  Tenía razón, y los presupuestos cerrados lo confirman: el precio de lista
//  por usuario de una banca doble App LT casi no se mueve, sólo baja un poco
//  con el volumen.
//
//      4 usuarios  $3,138        (226030018)
//      6 usuarios  $2,933        (226030134 Mixue)
//      8 usuarios  $2,918/$2,991 (226030134 / 226030018)
//     10 usuarios  $2,854        (Tradeco, verificado a mano)
//
//  El modelo, en cambio, venía cobrando ~$3,500 por usuario: 20% arriba. De ahí
//  salía el error que estaba abierto —banca doble 1.50 de 10 usuarios cotizada
//  45% arriba del precio real— porque el price-book sólo tiene anclas a módulo
//  de 1.20 y todo lo demás caía al modelo.
//
//  QUÉ MANDA, EN ORDEN: (1) el precio REAL de esa configuración exacta, si está
//  en el price-book; (2) esta escalera por usuario; (3) el modelo.
//  Las medidas SIN ancla real (módulo 1.50 y 1.80) se derivan de la relación de
//  largo que da el propio modelo, y quedan marcadas como derivadas — no se
//  presentan como si vinieran de un papel firmado.
// ============================================================================
export const APPLT_POR_USUARIO = {
  // Precio de LISTA por usuario, con módulo de 1.20 m (el de los presupuestos).
  banca_doble: { 4: 3138, 6: 2933, 8: 2918, 10: 2854, 12: 2820 },
};

// Cuánto más caro es el módulo largo que el de 1.20, según el propio modelo.
const FACTOR_LARGO = { 1200: 1, 1500: 1.12, 1800: 1.18 };

// Precio de lista de una banca App LT armado por usuario, o null si esta
// configuración no entra en la escalera (entonces manda el modelo de siempre).
export function precioPorUsuarioAppLT(cfg) {
  if (!cfg || cfg.producto !== 'banca_doble') return null;
  const n = cfg.usuarios;
  const tabla = APPLT_POR_USUARIO.banca_doble;
  if (!n || !tabla) return null;
  // Entre dos escalones se interpola; fuera de la tabla se toma el extremo.
  const claves = Object.keys(tabla).map(Number).sort((a, b) => a - b);
  let porU;
  if (tabla[n] != null) porU = tabla[n];
  else if (n <= claves[0]) porU = tabla[claves[0]];
  else if (n >= claves[claves.length - 1]) porU = tabla[claves[claves.length - 1]];
  else {
    const i = claves.findIndex((k) => k > n);
    const a = claves[i - 1], b = claves[i];
    porU = tabla[a] + ((tabla[b] - tabla[a]) * (n - a)) / (b - a);
  }
  const fl = FACTOR_LARGO[cfg.largoMM] ?? 1;
  const base = porU * fl * n;
  return { lista: Math.round(base + extrasAppLT(cfg, n)), porUsuario: Math.round(porU * fl), derivado: fl !== 1 };
}

// ---------------------------------------------------------------------------
//  LO QUE LA ESCALERA POR USUARIO NO SABE, Y SE ESTABA REGALANDO
//
//  La escalera cobra (módulo × usuarios) y nada más. Como manda sobre el modelo,
//  todo lo que el vendedor le active a una banca App LT sin ancla exacta —biombos
//  laterales, divisores entre puestos, el material del biombo— salía en CERO: el
//  despiece los sumaba al costo y el precio ni se enteraba. Auditado el
//  2026-08-16: 104 de 562 opciones del catálogo no movían un peso.
//
//  Los dos recargos NO son inventados: salen de restar dos renglones del MISMO
//  presupuesto, que es la única forma limpia de saber cuánto vale una opción.
//    · LATERALES  — BMU 225080025, módulo 3000×1200 de 4 usuarios:
//                   $25,980 con laterales − $22,590 sin ellos = $3,390 de lista
//                   por los DOS. En precio 2: 3,390 ÷ 0.60 = $5,650.
//    · DIVISORES  — 226030018, banca de 3 usuarios 3600×600, áreas "3U A" y
//                   "3U B": $37,960 − $26,760 = $11,200 de precio 2 por los dos
//                   divisores de esa corrida, o sea $5,600 cada uno (n−1 por
//                   corrida). Confirmado mirando los renders de las dos áreas.
//  Los laterales son SIEMPRE dos (cierran los extremos), no crecen con la corrida.
// ---------------------------------------------------------------------------
const EXTRA_LATERALES = 5650;        // precio 2, por el par
const EXTRA_DIVISOR = 5600;          // precio 2, por divisor
function extrasAppLT(cfg, usuarios) {
  let extra = 0;
  if (cfg.laterales) extra += EXTRA_LATERALES;
  if (cfg.divisores && usuarios > 1) {
    const pares = cfg.producto === 'banca_doble' ? Math.max(1, Math.round(usuarios / 2)) : usuarios;
    extra += EXTRA_DIVISOR * Math.max(0, pares - 1) * (cfg.producto === 'banca_doble' ? 2 : 1);
  }
  return extra;
}
