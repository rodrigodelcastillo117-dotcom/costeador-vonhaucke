// ============================================================================
//  ESCALERA DE PRECIO POR LÍNEA — calibración provisional (Rodrigo, 2026-08-15)
//
//  Sólo App LT tiene precios reales suficientes para calibrarse sola. Las demás
//  las cotizaba su modelo por su cuenta, sin relación entre sí, y el resultado
//  no respetaba el orden comercial real: Alba salía a la MITAD de App LT y Vía,
//  que es la línea de bajo costo, salía 32% más cara que App LT.
//
//  Rodrigo fijó el orden de menor a mayor precio en operativos / bench:
//      App LT · Feather · Flex · Vía · App · Río · Alba · Cirque · Luna
//
//  `OBJETIVO` es cuántas veces App LT debe costar cada línea. El factor que se
//  aplica al modelo se despeja con regla de tres contra lo que la línea cotiza
//  HOY (medido con `scratchpad/calibra_lineas.mjs`), de modo que el precio final
//  caiga en el objetivo.
//
//  ⚠️ ESTO ES UN ESTIMADO A PROPÓSITO. Sirve para que el vendedor tenga un
//  número con la proporción correcta mientras llegan los precios reales. En
//  cuanto una línea tenga anclas de papel, se le borra su factor y manda el
//  price-book. El sello de la partida dice "Estimado" justamente por esto.
// ============================================================================

// Múltiplo objetivo contra App LT (= 1.00).
export const OBJETIVO_LINEA = {
  applt: 1.00,   // base: la única calibrada contra presupuestos reales
  feather: 1.04,
  flex: 1.07,
  via: 1.09,
  app: 1.10,     // Rodrigo: "es más caro App que App LT, 10% arriba"
  // 2026-08-16: BAJA de 1.30 a 1.07 y NO es que Río valga menos. Es que la
  // curva ya se paga sola en el despiece (insumo `curvado` + caja envolvente +
  // canto por arco). Antes el 1.30 era el disfraz de una curva que el modelo no
  // veía; dejarlo puesto ahora cobraría la curva DOS VECES —el bench curvo salía
  // 21% arriba de su ancla real de papel—. Con 1.07 el bench curvo de 8 usuarios
  // cae sobre el ancla de 226060050 y la relación contra App LT sale 1.59×, que
  // es exactamente la que miden los presupuestos en geometría idéntica.
  // ⚠️ Esto también movió hacia abajo los productos RECTOS de Río (estación,
  // mesa de juntas), para los que no hay ni un precio de papel que lo confirme.
  rio: 1.07,
  alba: 1.55,
  cirque: 2.30,
  luna: 2.80,
};

// ============================================================================
//  ⚠️ POR FAMILIA, NO POR LÍNEA (2026-08-16)
//
//  Antes había UN factor por línea, despejado con UNA sola medición hecha sobre
//  un ESCRITORIO. Auditado producto por producto, el resultado fue contundente:
//  el escritorio cerraba contra su objetivo en 8 de 8 líneas y el BENCH fallaba
//  en 7 de 7. Los peores:
//        Flex   objetivo 1.07 · escritorio 1.25 ✓ · bench 3.39 ✗  (la línea BARATA)
//        Vía    objetivo 1.09 · escritorio 1.06 ✓ · bench 2.18 ✗
//        Alba   objetivo 1.55 · escritorio 1.64 ✓ · bench 0.62 ✗  (al revés)
//
//  La razón es de oficio, no de código: una banca comparte estructura entre dos
//  hileras y un escritorio no. El mismo múltiplo no puede servir para los dos.
//
//  ESTA TABLA NO SE ESCRIBE A MANO. La regenera `scripts/calibra-jerarquia.mjs`,
//  que mide el modelo CRUDO (sin factores) contra App LT:
//        node scripts/calibra-jerarquia.mjs --escribe
//  Las familias cuyo precio sale de un PRESUPUESTO REAL no entran: el papel ya
//  manda sobre el modelo y meterle factor sería moverle a un dato duro.
// ============================================================================
export const FAMILIAS = ['bench', 'escritorio', 'juntas', 'guarda'];

// A qué familia pertenece un producto. Cada línea los nombra distinto, así que
// se decide por lo que el mueble HACE, no por su id.
export function familiaDe(productoId, nombre = '') {
  const t = `${productoId} ${nombre}`.toLowerCase();
  if (/banca|bench|estacion|teamspace/.test(t)) return 'bench';
  if (/junta|mesa_circ|mesa circular|consejo/.test(t)) return 'juntas';
  if (/credenza|archivero|guarda|librero|pedestal|rodante|gaveta/.test(t)) return 'guarda';
  return 'escritorio';
}

// ⚠️ 2026-08-19: SÓLO la fila "alba" de aquí abajo se remidió a mano (no con
// `--escribe`, que reescribe las 21 líneas de un jalón). `alba.js` fijaba un
// blend de mano de obra plano en TODO producto Alba y nunca dejaba correr su
// fórmula real por tipo de material (formulaAlba.js, commit 5966d59) — el
// "modelo crudo" que esta tabla mide cambió al quitarle ese blend, así que su
// fila quedó desactualizada. Correr `--escribe` sin filtro removidió las
// otras 20 líneas también, movió números que nadie pidió tocar hoy y hasta
// borró filas de productos que no encontró (app.escritorio, eclipse, tetris)
// — esa corrida se descartó. Si otra línea necesita remedirse, hazlo con
// intención y revisa el diff completo antes de guardarlo: no es un botón que
// se aprieta de pasada.
/* CALIBRA:INICIO */
export const MEDIDO_ANTES = {
  "applt": {
    "bench": 1,
    "escritorio": 1,
    "juntas": 1
  },
  "app": {
    "bench": 1,
    "escritorio": 1,
    "juntas": 1
  },
  "via": {
    "bench": 2.637,
    "escritorio": 1.278
  },
  "rio": {
    "bench": 1.068
  },
  "feather": {
    "bench": 0.939,
    "escritorio": 0.893
  },
  "cirque": {
    "bench": 0.385,
    "escritorio": 0.512,
    "juntas": 0.583
  },
  "spine": {
    "escritorio": 0.489
  },
  "ergo4": {
    "bench": 1.632,
    "escritorio": 2.802
  },
  "alba": {
    "bench": 0.296,
    "escritorio": 1.008,
    "juntas": 1.121
  },
  "eclipse": {
    "escritorio": 4.425,
    "juntas": 1.13
  },
  "drift": {
    "escritorio": 1.057
  },
  "luna": {
    "escritorio": 2.454,
    "juntas": 3.309
  },
  "flex": {
    "bench": 1.066,
    "escritorio": 0.394
  },
  "anteo": {
    "escritorio": 10.809,
    "juntas": 1.408
  },
  "modulor": {
    "escritorio": 0.368
  },
  "tetris": {
    "escritorio": 0.713
  },
  "arlequin": {
    "escritorio": 0.226
  },
  "pac": {
    "escritorio": 0.812
  },
  "worklounge": {
    "escritorio": 0.72
  },
  "pebble": {
    "escritorio": 0.331
  },
  "accents": {
    "bench": 0.572,
    "escritorio": 0.111
  },
  "teamspace2": {
    "escritorio": 0.56
  },
  "privacy4": {
    "escritorio": 1.307
  }
};
/* CALIBRA:FIN */

// factor = objetivo ÷ lo que cotiza el modelo crudo EN ESA FAMILIA. Si la
// familia no está medida, cae al promedio de la línea; si la línea no tiene
// objetivo comercial, no se toca nada.
export function factorFamilia(ruta, familia) {
  const obj = OBJETIVO_LINEA[ruta];
  if (!obj) return 1;
  const fila = MEDIDO_ANTES[ruta] || {};
  let antes = fila[familia];
  if (antes == null) {
    const vals = Object.values(fila).filter((v) => v > 0);
    antes = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1;
  }
  return antes > 0 ? Math.round((obj / antes) * 1000) / 1000 : 1;
}

// Se conserva para lo que todavía lo lee y para comparar de un vistazo.
export const FACTOR_LINEA = Object.fromEntries(
  Object.keys(OBJETIVO_LINEA).map((r) => [r, factorFamilia(r, 'escritorio')]),
);

// ---- AJUSTE FINO POR PRODUCTO ---------------------------------------------
// Un factor único por línea sube TODO por igual, y eso puede romper lo que ya
// estaba bien. Caso real: para que el escritorio Cirque llegue a 2.30× App LT
// hace falta ×4.8, pero ese mismo ×4.8 mandaba su credenza de 1.80 a $50,900 —
// cuando la credenza Modulor de 1.80 × 0.75 cuesta $13,040 REALES y el
// archivero suspendido Cirque de 1.05 cuesta $7,450 REALES. Las guardas de
// Cirque ya estaban en nivel creíble; las que estaban bajas eran las cubiertas
// de trabajo. Aquí se corrige sólo lo que hace falta.
//   Multiplica al factor de línea. 0.31 = "a esta pieza aplícale un tercio del
//   ajuste", porque no necesitaba el resto.
export const AJUSTE_PRODUCTO = {
  'cirque.credenza': 0.31,    // contrastado contra la credenza Modulor real
  'cirque.recepcion': 0.31,
  // ⚠️ 'alba.mesa_juntas'/'alba.teamspace' VIVIERON AQUÍ (quitados 2026-08-19).
  // Se calibraron contra el modelo CRUDO roto (ver la nota junto a la fila
  // "alba" de MEDIDO_ANTES, arriba). Con la fórmula real ya puesta y esa fila
  // remedida, el factor POR FAMILIA ya lleva sola la mesa de juntas cerca de
  // su objetivo — el 0.39 que aquí vivía la aplastaba a $6,096 (30% de los
  // $20,510 reales de Tradeco que originalmente motivaron el ajuste). Sin
  // ancla de papel para 'teamspace', se quita también: su único sustento era
  // "misma familia que mesa_juntas". Si vuelve a desviarse con datos reales
  // nuevos, se repone aquí con SU propio número, no adivinado.
  // Luna NO lleva ajuste: su factor es apenas 1.25, no desborda nada. Se probó
  // con 0.55 y dejaba su credenza en $5,972, por debajo de la de Cirque — al
  // revés de la realidad, porque Luna es la más cara de las dos.
};

export const factorDeLinea = (ruta, producto) => {
  // La bandera la pone `scripts/calibra-jerarquia.mjs` para medir el modelo
  // desnudo. Sin ella, calibrar sería medirse a sí mismo.
  if (globalThis.__SIN_FACTOR_LINEA) return 1;
  return factorFamilia(ruta, familiaDe(producto)) * (AJUSTE_PRODUCTO[`${ruta}.${producto}`] ?? 1);
};
