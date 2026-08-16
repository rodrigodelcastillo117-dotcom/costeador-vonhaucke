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

// Lo que cotizaba cada línea ANTES de esta calibración, medido sobre un
// escritorio/bench comparable y expresado en múltiplos de App LT. Queda escrito
// para poder rehacer la cuenta y para ver de dónde salió cada factor.
const MEDIDO_ANTES = {
  applt: 1.00, feather: 0.85, flex: 0.336, via: 1.32,
  app: 1.00, rio: 0.95, alba: 0.54, cirque: 0.51, luna: 2.24,
};

// factor = objetivo ÷ lo que cotizaba. Se calcula aquí para que no haya números
// mágicos sueltos: cambiar el objetivo recalcula el factor solo.
export const FACTOR_LINEA = Object.fromEntries(
  Object.entries(OBJETIVO_LINEA).map(([ruta, obj]) => {
    const antes = MEDIDO_ANTES[ruta] || 1;
    return [ruta, Math.round((obj / antes) * 1000) / 1000];
  }),
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
  // Alba: el ×2.87 que necesita su escritorio mandaba su mesa de juntas de 3.60
  // a $52,389, cuando una mesa REAL de 3.60 × 1.20 con caja eléctrica cuesta
  // $20,510 (Tradeco). Encontrado corriendo Voni de punta a punta, no leyendo
  // código: el modelo cotizaba 2.5× arriba y nadie lo veía.
  'alba.mesa_juntas': 0.39,
  'alba.teamspace': 0.55,     // misma familia de cubiertas grandes
  // Luna NO lleva ajuste: su factor es apenas 1.25, no desborda nada. Se probó
  // con 0.55 y dejaba su credenza en $5,972, por debajo de la de Cirque — al
  // revés de la realidad, porque Luna es la más cara de las dos.
};

export const factorDeLinea = (ruta, producto) =>
  (FACTOR_LINEA[ruta] || 1) * (AJUSTE_PRODUCTO[`${ruta}.${producto}`] ?? 1);
