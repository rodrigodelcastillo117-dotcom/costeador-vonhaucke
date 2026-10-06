// ============================================================================
//  MOTOR DE CALCULO - Costeador de Produccion Von Haucke
// ----------------------------------------------------------------------------
//  NORMATIVO. Las formulas son las del master, seccion 6. No se modifican
//  ni se "mejoran". Este archivo NO depende de React y debe estar cubierto
//  por pruebas (calculo.test.js).
// ============================================================================
import { costoAlba, tipoAlba } from './formulaAlba.js';
import { optimizarCorte2D, optimizarCorte1D } from './optimizacionCorte.js';

// VERSIÓN DEL MOTOR — entra en la huella de cada cotización (cotizaciones.js:
// huellaMP) para que, si la FÓRMULA cambia (no solo un precio), una cotización
// vieja se marque "calculada con otro motor" en vez de reusarse a ciegas.
// ⚠️ SÚBELA cuando cambie cómo se calcula el costo (factores, cascada, nesting).
export const MOTOR_VERSION = '2026-10-03';

// FÓRMULA OFICIAL de producto nuevo (cutover 2026-10-01). Von Haucke convierte el
// BOM en costo con la fórmula de ALBA (MO% por tipo de material + GI; ver
// formulaAlba.js), la ÚNICA que reproduce las referencias humanas (Alpura, bench
// de Alba) al centavo y por categoría. Es la MISMA implementación que usan las
// regresiones: `calcular()` la aplica cuando la pieza NO trae factores explícitos.
export const FORMULA_ALBA_V1 = 'ALBA_V1';

// Qué fórmula aplica una pieza, para etiquetar el costo (histórico vs vigente) sin
// recalcular nada. Alba = sin factores a mano y sin horas; si trae factores fijos
// es un costo heredado (legacy). No cambia ningún número: solo lo nombra.
export function formulaDePieza(pieza = {}) {
  if (pieza.modoManoObra === 'horas') return 'HORAS';
  if (pieza.factorDirecta != null || pieza.factorIndirecta != null) {
    if (Number(pieza.factorDirecta) === 55 && Number(pieza.factorIndirecta) === 12) return 'LEGACY_55';
    return `FACTORES_${pieza.factorDirecta ?? '?'}_${pieza.factorIndirecta ?? '?'}`;
  }
  return FORMULA_ALBA_V1;
}

// Secciones cuyo material se COMPRA ya hecho y solo se instala: NO llevan mano
// de obra de fabricacion (decision Rafa/Rodrigo, 2026-09-23 — caso banca
// aeropuerto: los multicontactos Bari no deben cargar MO). Electrico y guardas
// ya armadas y paneles EcoAcustic entran; pintura/tela/tapiceria NO (esas si
// llevan MO real). Ajustable aqui si cambia el criterio.
export const SIN_MO_SECCIONES = new Set(['electrico', 'guardas', 'ecoacustic', 'graficos']);

// -----------------------------------------------------------------------------
//  Parametros de planta por defecto (master 5.6). Una sola configuracion global.
//  Los "valores supuestos" (eficiencia, aprovechamiento) se marcan aparte en la
//  interfaz; aqui viven solo los numeros.
// -----------------------------------------------------------------------------
export const PARAMETROS_DEFAULT = {
  // ⚠️ LA NÓMINA REAL NO VIVE AQUÍ, Y NO PUEDE.
  //
  // Auditoría del 2026-08-16: estos cuatro números estaban escritos como
  // literales ($423,660 de nómina semanal, 183 personas, 138 operativos) y Vite
  // los cocina dentro de `dist/index.html`, que es EL ÚNICO archivo que sirve la
  // URL pública. Comprobado con un `curl` a la app en vivo: ahí estaban, sin
  // necesidad de entrar. Toda la bóveda de Dirección protegía ese dato en la
  // base y el compilador lo publicaba por la puerta de atrás.
  //
  // Quedan en CERO. Los de verdad los carga Dirección desde la tabla `direccion`
  // (ver almacen.js y PARAMS_SENSIBLES), que sí pide sesión y rol. Con estos en
  // cero el costo por hora sale de `costoHoraArea`, que es el camino que usa el
  // modelo Intelisis —el bueno— y no cambia ningún precio de los que se cotizan
  // hoy. Si alguien vuelve a escribir un número real aquí, lo publica.
  nominaSemanalTotal: 0,
  nominaSemanalDirecta: 0,
  personasTotal: 0,
  operativos: 0,
  jornadaSemanal: 48,
  eficienciaReal: 80,          // % - dato supuesto, confirmar con Produccion
  costoHora: 40.60,            // calculado, editable

  // COSTO HORA POR AREA
  costoHoraArea: { pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0, otros: 0 },
  usarCostoPorArea: false,

  // FACTORES
  factorIndirectosFabrica: 34, // % sobre materia prima DIRECTA (master 1.1) - NO 27
  factorManoObraDirecta: 17,   // % cuando no hay horas medidas
  factorManoObraIndirecta: 12,

  // ---- MODELO INTELISIS (cascada real Von Haucke, calibrada 2026-08-13) ----
  //  'clasico'   = modelo original (indirectos % sobre MP directa + margen sobre precio).
  //  'intelisis' = reproduce el cotizador Intelisis: MP + MO(horas x $/h) + GIF(horas x $/h)
  //                = Fabricacion -> x(1+gastosOperacion) -> x(1+utilidad) -> x factorPrecioLista.
  modeloCosteo: 'clasico',
  costoHoraGIF: { pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0, otros: 0 }, // GIF por hora por centro
  gastosOperacionPct: 30,  // % sobre costo de fabricacion (Intelisis: "Factor Gastos Operacion")
  // Tipo de cambio para los insumos que Compras cotiza en dolares.
  // Rodrigo, 2026-08-16: el dolar esta en 17.50.
  tipoCambio: 17.5,
  utilidadPct: 20,         // % markup sobre costo total (Intelisis: "Factor Utilidad")
  factorPrecioLista: 3,    // precio lista = precio x factor (Intelisis "Factor 200" = +200% = x3)

  // CORTE
  tableroLargoMM: 2440,
  tableroAnchoMM: 1220,
  kerfMM: 6,                   // corte de sierra ~6mm (Rogelio/Producción, levantamiento)
  recorteOrillaMM: 10,         // ~1 cm perimetral al escuadrar (Rogelio)
  aprovechamientoCorte: 80,    // % - dato supuesto

  // OTROS
  mermaProceso: 0,             // % de piezas que se rehacen
  empaquePorPieza: 0,
  margenMinimo: 25,            // % (sobre precio) - aviso interno del costeo (Rodrigo 2026-09-24: el mínimo real es 25, no 40)
  margenObjetivo: 50,          // % (sobre precio) -> PRECIO DE LISTA. Se descuenta desde aqui (Rodrigo 2026-08-12)
  minMarkupLinea: 45,          // % utilidad MINIMA sobre COSTO (markup) en LINEA. Piso al descontar (Miguel/Rodrigo)
  ivaPorcentaje: 16,
  anticipoPorcentaje: 50,      // condicion comercial default (Rafa 12.2: 50/50)
  contingenciaPorcentaje: 0,   // colchon obra a la medida (Rafa 11.5: sugerido 10-15%)
  descuentoPorcentaje: 0,      // descuento de proyecto por volumen (Ventas)
  // MANIOBRAS — instalación y acarreo. Es un renglón REAL de los presupuestos de
  // Von Haucke y la app no lo cobraba: sólo lo mencionaba en letra chica al pie,
  // que es la discusión más cara que existe con un cliente al final de la obra.
  // El 3% sale del papel, no de una suposición: NDT 226020037 lo imprime con
  // todas sus letras — "Maniobras 3% $75,795.27" sobre $2,526,509, exacto — y
  // Fuerza Especial da 3.4%. Se dispara con condiciones difíciles: Unión de
  // Crédito llegó a 22% con instalación en horario inhábil, por elevador y
  // acarreo de más de 100 m. Por eso es editable por proyecto.
  maniobrasPorcentaje: 3,
  // FLETE en el área metropolitana. ⚠️ AQUÍ HAY UN DESACUERDO SIN CERRAR:
  // Rodrigo (2026-08-16) dice 10%; el levantamiento con Miguel y Rogelio dejó
  // 3%; y NINGÚN presupuesto de los 9 imprime un porcentaje de flete (el 3% que
  // aparecía en las condiciones de la app estaba escrito como flete, pero el 3%
  // del papel es de MANIOBRAS, que es otra cosa). Queda el número de Rodrigo,
  // en un solo lugar y editable, hasta que él lo confirme contra Logística.
  fletePorcentaje: 10,
};

const AREAS = ['pm', 'carpinteria', 'pintura', 'acabados', 'tapiceria', 'otros'];

// -----------------------------------------------------------------------------
//  1.2  Costo hora del taller
//       hora nominal   = nomina directa / (operativos * jornada)
//       hora de taller = hora nominal / eficiencia
// -----------------------------------------------------------------------------
export function calcularCostoHora(p = PARAMETROS_DEFAULT) {
  const horasHombre = p.operativos * p.jornadaSemanal;
  const horaNominal = horasHombre > 0 ? p.nominaSemanalDirecta / horasHombre : 0;
  const eficiencia = p.eficienciaReal > 0 ? p.eficienciaReal / 100 : 1;
  const horaTaller = horaNominal / eficiencia;
  return { horasHombre, horaNominal, horaTaller };
}

// -----------------------------------------------------------------------------
//  6.2  Compra por formato completo.
//       Las cantidades entran NETAS (sin merma). El motor agrega la merma de
//       corte y redondea a formato entero (no hay medio tablero ni medio tramo).
//       Materiales de inventario: el sobrante se guarda, no se tira -> no redondea.
// -----------------------------------------------------------------------------
export function comprar(insumo, cantidadNetaUnitaria, piezas) {
  const neto = cantidadNetaUnitaria * piezas;
  const conCorte = neto * (1 + (insumo.mermaCorte || 0) / 100);

  // Fraccion de hoja (rendimiento): cobra la fraccion ajustada por aprovechamiento
  if (insumo.formato && insumo.fraccion) {
    const aprov = PARAMETROS_DEFAULT.aprovechamientoCorte > 0 ? PARAMETROS_DEFAULT.aprovechamientoCorte / 100 : 1;
    const hojas = neto / (insumo.formato.medida * aprov);
    return {
      neto,
      comprado: hojas * insumo.formato.medida,
      unidades: hojas,
      merma: hojas * insumo.formato.medida - neto,
      pct: hojas > 0 ? ((hojas * insumo.formato.medida - neto) / (hojas * insumo.formato.medida)) * 100 : 0,
      fraccion: true,
    };
  }

  // Sin formato definido, o material de inventario: el sobrante no se desperdicia
  if (!insumo.formato || insumo.inventario) {
    return {
      neto,
      comprado: conCorte,
      unidades: null,
      merma: conCorte - neto,
      pct: conCorte > 0 ? ((conCorte - neto) / conCorte) * 100 : 0,
    };
  }

  // No se venden fracciones de tablero ni de tramo
  const unidades = Math.ceil(conCorte / insumo.formato.medida - 1e-9);
  const comprado = unidades * insumo.formato.medida;
  return {
    neto,
    comprado,
    unidades,
    formato: insumo.formato,
    merma: comprado - neto,
    pct: comprado > 0 ? ((comprado - neto) / comprado) * 100 : 0,
  };
}

// -----------------------------------------------------------------------------
//  6.9  Acomodo en tablero (rejilla). Cuantas piezas de largoMM x anchoMM caben
//       en un tablero. La veta impide girar la pieza al cortar.
//       p puede traer parametros de planta y la bandera veta.
// -----------------------------------------------------------------------------
export function piezasPorTablero(largoMM, anchoMM, p = {}) {
  const par = { ...PARAMETROS_DEFAULT, ...p };
  const veta = p.veta || false;
  const L = par.tableroLargoMM - 2 * par.recorteOrillaMM;
  const A = par.tableroAnchoMM - 2 * par.recorteOrillaMM;
  const k = par.kerfMM;

  // (a, b) = (dimensión a lo largo de A=ancho del tablero, dimensión a lo largo de
  // L=largo del tablero). La VETA del tablero corre a lo largo de su lado largo (L,
  // 2440); una pieza "con veta" debe llevar su LARGO alineado con esa veta → largoMM
  // va sobre L, anchoMM sobre A → orientación [anchoMM, largoMM].
  // ⚠️ 2026-10-03: estaba invertido ([largoMM, anchoMM]), que ponía el largo de la
  // pieza sobre el lado CORTO del tablero. Una pieza larga (p. ej. 1.60 m) "no cabía"
  // así, caía al aprovechamiento genérico y se SUBCOSTEABA. Sin veta se prueban las
  // dos orientaciones (el orden no cambia el máximo).
  const orientaciones = veta
    ? [[anchoMM, largoMM]]
    : [[largoMM, anchoMM], [anchoMM, largoMM]];

  let mejor = 0;
  for (const [a, b] of orientaciones) {
    const nx = Math.floor((A + k) / (a + k));
    const ny = Math.floor((L + k) / (b + k));
    if (nx > 0 && ny > 0) mejor = Math.max(mejor, nx * ny);
  }
  return mejor; // 0 = no cabe, hay que avisar
}

// -----------------------------------------------------------------------------
//  Precio en uso de un insumo (el del usuario, o el base estimado).
// -----------------------------------------------------------------------------
// El precio de un insumo, SIEMPRE en pesos. Los materiales de importación
// (pintura en polvo, cajas Byrne) los cotiza Compras en dólares; guardarlos tal
// cual y sumarlos como si fueran pesos los volvía ~20 veces más baratos, y en
// un costeo nadie lo nota: sólo se ve al final, en el margen.
export function precioDeInsumo(insumo, par = PARAMETROS_DEFAULT) {
  const base = insumo.precio != null ? insumo.precio : (insumo.precioBase || 0);
  if (insumo.moneda && insumo.moneda !== 'MXN') {
    return base * (par.tipoCambio || PARAMETROS_DEFAULT.tipoCambio || 1);
  }
  return base;
}

// VH-017 · ¿El insumo tiene un precio USABLE? Distingue ZERO de UNKNOWN.
// - precio DECLARADO (numérico, incluido 0 explícito) → conocido (§7: un 0 real
//   es válido; el "$0 por decisión" se modela con comp.excluida, no aquí).
// - precio ausente pero con precioBase > 0 → conocido (estimado).
// - sin ninguno de los dos → DESCONOCIDO: la pieza NO se costea en $0, se marca
//   pendiente (el total deja de ser emitible). "NO convertir missing a zero" (§24).
export function precioUsable(insumo) {
  if (!insumo) return false;
  const p = insumo.precio;
  if (p != null && p !== '' && Number.isFinite(Number(p))) return true;
  return Number(insumo.precioBase) > 0;
}

// -----------------------------------------------------------------------------
//  Neto de un componente EN LA UNIDAD DEL INSUMO.
//  Si trae medidas (largoMM/anchoMM) es area en m2; si no, es su cantidad neta.
//  Siempre multiplicado por las piezas del componente y por el lote.
// -----------------------------------------------------------------------------
// ⚠️ NADA NEGATIVO LLEGA A SER DINERO (2026-08-18). Un agente cazó que en el
// Asistente especial, teclear `-500` en el largo de una cubierta daba
// **"Precio de lista $-636"**, sin un solo aviso y con el botón de cotizar
// encendido. La causa NO estaba en esa pantalla: el `min="0"` de un
// <input type=number> **no impide teclear** —la misma lección que ya está
// escrita arriba en `leePct`— y hay ~30 campos así repartidos en 5 pantallas.
// Parchar los 30 deja el hueco abierto en el 31.
//
// Por eso se tapa AQUÍ, que es el embudo por donde pasa TODO el dinero
// (`costoNetoComponente`, `calcular`, Costeador.jsx:144, AsistenteEspecial.jsx:102):
// una medida o una cantidad negativa vale CERO, nunca menos. Un mueble puede
// costar cero —todavía no lo capturas—; jamás puede costar menos que nada.
const noNegativo = (x) => (Number.isFinite(x) && x > 0 ? x : 0);

export function netoComponente(comp, n = 1) {
  const piezasComp = noNegativo((comp.piezas || 1) * n);
  if (comp.largoMM && comp.anchoMM) {
    return (noNegativo(comp.largoMM) / 1000) * (noNegativo(comp.anchoMM) / 1000) * piezasComp; // m2
  }
  return noNegativo((comp.cantidad || 0) * n);
}

// Costo NETO de material de un componente (area x precio, antes de redondear a
// tablero). Sirve para mostrar el subtotal por renglon en la interfaz.
// FRACCION DE HOJA DIRECTA (Rafa §1, 2026-09-23): si el componente trae
// `comp.hojas`, el estimador ya dio la fraccion de hoja que rinde (como el
// T.D.C. real) — el costo es fraccion x precio_hoja, sin merma inventada.
export function costoNetoComponente(comp, insumo, n = 1, par = PARAMETROS_DEFAULT) {
  // ⚠️ P0-03 (bug hojas:0): la PRESENCIA de `hojas` NO decide el modo de consumo.
  // Antes esto era `comp.hojas != null`, y `hojas:0` (que el esquema de la IA permite
  // como "no aplica") daba `0 != null → true` → costo `0 × precio = $0`, ignorando
  // la medida/cantidad real. Un PTR de 6 m salía GRATIS. La fracción de hoja real
  // SIEMPRE es > 0; con `> 0`, un `hojas:0` cae al cálculo por área/cantidad de abajo.
  if (comp.hojas > 0 && insumo?.formato) {
    return noNegativo(comp.hojas * n) * precioDeInsumo(insumo, par);
  }
  return netoComponente(comp, n) * precioDeInsumo(insumo, par);
}

// -----------------------------------------------------------------------------
//  6.2 + 6.9  Compra AGREGADA por insumo.
//  Junta todos los componentes que usan el mismo material y compra los formatos
//  enteros que hacen falta. Respeta dos verdades de taller a la vez:
//    - una pieza grande NO se puede cortar cruzando dos tableros (rejilla), y
//    - una pieza chica del mismo material CAE en el retazo que ya pagaste.
//  Por eso el numero de tableros es el MAYOR entre "los que pide la rejilla" y
//  "los que pide el area total". Asi el faldon no compra su propio tablero.
// -----------------------------------------------------------------------------
function comprarInsumo(insumo, comps, n, par) {
  const precio = precioDeInsumo(insumo, par);
  const factorMerma = 1 + (insumo.mermaCorte || 0) / 100;

  let neto = 0;
  let conCorte = 0;
  let tablerosRejilla = 0;
  let hayPiezaQueNoCabe = false;
  // Para el costeo por FRACCION de hoja (abajo): la fraccion REAL de las
  // piezas con medida conocida es la del acomodo en rejilla (piezasPorTablero,
  // 6.9), no un % de aprovechamiento generico. Lo sin medida (canto suelto,
  // retazos) no tiene de donde sacar su rejilla, y sigue con el generico.
  let hojasExactas = 0;
  let netoSinMedida = 0;

  // FRACCION DE HOJA DIRECTA (Rafa §1, 2026-09-23): un componente con
  // `comp.hojas` ya trae la fraccion de hoja que rinde (juicio del estimador,
  // como el T.D.C. real). No pasa por el nesteo ni por el % de aprovechamiento:
  // su costo es fraccion x precio_hoja, SIN merma inventada. Es la unica forma
  // de acertar piezas de metal irregulares (asiento perforado, tubular curvo)
  // que un nesteo de rectangulos infla muchisimo (banca aeropuerto: 73.7% de
  // merma falsa). Se acumula aparte y se suma al final.
  let hojasDirectas = 0;
  const medidaFmt = insumo.formato ? insumo.formato.medida : 0;

  for (const c of comps) {
    // P0-03: `> 0`, no `!= null` — un `hojas:0` NO debe tomar la vía de fracción
    // (que lo costearía en $0 y haría `continue`, perdiendo su cantidad/medida).
    if (c.hojas > 0 && insumo.formato) { hojasDirectas += noNegativo(c.hojas) * n; continue; }
    const netoC = netoComponente(c, n);
    neto += netoC;
    conCorte += netoC * factorMerma;
    if (c.largoMM && c.anchoMM && insumo.formato) {
      const ppt = piezasPorTablero(c.largoMM, c.anchoMM, { ...par, veta: insumo.veta });
      const piezasComp = (c.piezas || 1) * n;
      // ⚠️ 2026-08-19: una pieza que NO cabe en ningun tablero (ppt=0 — más
      // grande que el formato completo, p.ej. una cubierta cuadrada de 1.50 m
      // en tablero de 1.22 x 2.44) se marcaba "no cabe" pero SU AREA SE
      // PERDIA: no sumaba a `hojasExactas` (solo lo hacen las que sí caben) ni
      // a `netoSinMedida` (solo lo hacen las que no traen medida), así que el
      // costeo por FRACCION de hoja (abajo) la cobraba a **CERO** — material
      // real, gratis. Cazado en Cirque "Mesa de juntas cuadrada 1.50 m" y en
      // Eclipse Qvadrat/mesa_juntas (1.50/1.80 m): costo $0, desperdicio
      // NEGATIVO. Aquí no se resuelve el problema de fondo (esa pieza de
      // verdad no sale de un tablero solo; en taller se une o se pide un
      // formato especial) — eso es un dato de producción, no algo que el
      // motor pueda inventar — pero cobrarla en CERO es peor que aproximarla:
      // cae al mismo % de aprovechamiento generico que una pieza sin medida,
      // que es lo más parecido a "no se de la rejilla real" que ya existe.
      if (ppt > 0) { tablerosRejilla += Math.ceil(piezasComp / ppt - 1e-9); hojasExactas += piezasComp / ppt; }
      else { hayPiezaQueNoCabe = true; netoSinMedida += netoC; }
    } else {
      netoSinMedida += netoC;
    }
  }

  // FRACCION DE HOJA (rendimiento). No se redondea a formato entero: se cobra
  // solo la fraccion de hoja que consume la pieza. El precio del insumo se
  // captura POR HOJA. Vale para tableros (m2) y laminas (kg): 'neto' y
  // 'formato.medida' viven en la misma unidad.
  // ⚠️ 2026-08-18: las piezas con MEDIDA conocida cobran la fraccion REAL del
  // acomodo en rejilla (hojasExactas, arriba), no un % de aprovechamiento
  // generico. Antes una cubierta de 1.20x0.60 (4 por tablero, prueba 4) se
  // cobraba a 0.30 de hoja (80% de aprovechamiento supuesto) en vez de 0.25
  // (lo que de verdad rinde) — 20% de material de mas. Se cazó comparando
  // contra el T.D.C. real de Alba (formulaAlba.js): su explosivo trae 0.25
  // hoja para esa misma cubierta, exacto. Lo SIN medida (canto suelto,
  // retazos) no tiene rejilla que calcular, y sigue con el % de
  // aprovechamiento — es lo unico que se puede hacer sin conocer la pieza.
  // Suma la parte de FRACCION DE HOJA DIRECTA (sin merma) a un resultado base.
  const conHojas = (R) => {
    if (hojasDirectas <= 0) return R;
    const netoT = R.neto + hojasDirectas * medidaFmt;
    const compradoT = (R.comprado || 0) + hojasDirectas * medidaFmt;
    return {
      ...R,
      neto: netoT,
      comprado: compradoT,
      unidades: (R.unidades || 0) + hojasDirectas,
      costo: R.costo + hojasDirectas * precio,
      pct: compradoT > 0 ? ((compradoT - netoT) / compradoT) * 100 : 0,
      fraccion: true,
    };
  };

  if (insumo.formato && insumo.fraccion) {
    const aprov = par.aprovechamientoCorte > 0 ? par.aprovechamientoCorte / 100 : 1;
    const areaFmt = insumo.formato.medida;
    const hojas = hojasExactas + netoSinMedida / (areaFmt * aprov); // fraccion real de hoja
    const comprado = hojas * areaFmt;              // consumo cargado (incluye scrap de aprovechamiento)
    const precioUnidad = precio / areaFmt;         // precio por m2/kg equivalente
    return conHojas({
      neto, comprado, unidades: hojas, formato: insumo.formato,
      costo: hojas * precio,
      desperdicio: (comprado - neto) * precioUnidad,
      pct: comprado > 0 ? ((comprado - neto) / comprado) * 100 : 0,
      precio, noCabe: hayPiezaQueNoCabe, fraccion: true,
    });
  }

  // Solo componentes de fraccion de hoja (sin piezas de area/cantidad): p.ej.
  // una lamina capturada 100% por fraccion en el Costeador manual.
  if (hojasDirectas > 0 && neto === 0 && conCorte === 0) {
    return conHojas({ neto: 0, comprado: 0, unidades: 0, formato: insumo.formato, costo: 0, desperdicio: 0, pct: 0, precio, noCabe: false });
  }

  // Sin formato, o material de inventario: el sobrante se guarda, no se redondea
  if (!insumo.formato || insumo.inventario) {
    return conHojas({
      neto, comprado: conCorte, unidades: null, costo: conCorte * precio,
      desperdicio: (conCorte - neto) * precio,
      pct: conCorte > 0 ? ((conCorte - neto) / conCorte) * 100 : 0,
      precio, noCabe: false,
    });
  }

  const porArea = Math.ceil(conCorte / insumo.formato.medida - 1e-9);
  const unidades = Math.max(tablerosRejilla, porArea);
  const comprado = unidades * insumo.formato.medida;
  return conHojas({
    neto, comprado, unidades, formato: insumo.formato, costo: comprado * precio,
    desperdicio: (comprado - neto) * precio,
    pct: comprado > 0 ? ((comprado - neto) / comprado) * 100 : 0,
    precio, noCabe: hayPiezaQueNoCabe,
  });
}

// -----------------------------------------------------------------------------
//  6.4  Mano de obra - dos modos. El de horas manda cuando hay UE medidas.
// -----------------------------------------------------------------------------
function manoObraPorHoras(horas, piezas, par) {
  let total = 0;
  for (const area of AREAS) {
    const h = (horas && horas[area]) || 0;
    const costoArea = par.usarCostoPorArea
      ? (par.costoHoraArea[area] || par.costoHora)
      : par.costoHora;
    total += h * costoArea;
  }
  return total * piezas;
}

// Gastos indirectos de fabricacion por HORA por centro (modelo Intelisis).
// GIF = Σ horas_centro × costoHoraGIF_centro. Es la alternativa real al 34% de MP.
function gifPorHoras(horas, piezas, par) {
  let total = 0;
  for (const area of AREAS) {
    const h = (horas && horas[area]) || 0;
    total += h * ((par.costoHoraGIF && par.costoHoraGIF[area]) || 0);
  }
  return total * piezas;
}

// Gate de DATOS, no cambio de fórmula: Intelisis sólo es autorizable cuando
// cada centro realmente usado trae sus dos tarifas explícitas (MO + GIF).
// Evita que un 0/faltante caiga al costoHora global o a GIF=0 y subcostee.
function tarifasFaltantesIntelisis(horas, par) {
  const faltan = [];
  for (const area of AREAS) {
    const h = Number(horas?.[area] || 0);
    if (!(h > 0)) continue;
    const mo = Number(par?.costoHoraArea?.[area]);
    const gif = Number(par?.costoHoraGIF?.[area]);
    if (!(Number.isFinite(mo) && mo > 0)) faltan.push(`MO:${area}`);
    if (!(Number.isFinite(gif) && gif > 0)) faltan.push(`GIF:${area}`);
  }
  return faltan;
}

// -----------------------------------------------------------------------------
//  FORMULA DE ALBA (estimaciones, 2026-08-18) — MO% y GI por tipo de material
//  (ver motor/formulaAlba.js). Se aplica por GRUPO DE INSUMO, el mismo
//  agrupado que ya usa el despiece para comprar (detalleInsumos): cada grupo
//  ya trae su seccion/nombre, que es lo que tipoAlba() necesita para
//  clasificar cubierta/metal/cristal/general.
// -----------------------------------------------------------------------------
function manoObraGiAlba(detalleInsumos) {
  let mo = 0;
  let gi = 0;
  for (const d of detalleInsumos) {
    // Lo COMPRADO ya hecho (eléctrico, guardas, ecoacústic, gráficos: kit LED,
    // logos, impresiones) es compra-venta: MO 1% / GI 5%, igual que el id_02 de
    // la T.D.C. real. Lo demás se clasifica por su material (fabricado).
    const tipo = SIN_MO_SECCIONES.has(d.seccion)
      ? 'compraventa'
      : tipoAlba({ seccion: d.seccion, nombre: d.nombre });
    const r = costoAlba(d.costo, tipo);
    mo += r.mo;
    gi += r.gi;
  }
  return { mo, gi };
}

// -----------------------------------------------------------------------------
//  6.5  Cadena completa del costo.
//       calcular(pieza, piezas, insumos, parametros)
//       - insumos: mapa id -> insumo (o el componente trae component.insumo)
// -----------------------------------------------------------------------------
export function calcular(pieza, piezas = 1, insumos = {}, parametros = PARAMETROS_DEFAULT) {
  const par = { ...PARAMETROS_DEFAULT, ...parametros };
  // n = tamaño de lote. Robusto ante basura: un lote NaN/negativo/vacío (p. ej.
  // un <input> number que no impide teclear "abc" o "-3") valía NaN y envenenaba
  // TODO el costo (cada cifra salía NaN, con el botón de cotizar encendido). Nunca
  // menos de 1 pieza. `Number(piezas) || 1` neutraliza NaN/0/''; Math.max tapa negativos.
  const n = Math.max(1, Number(piezas) || 1);
  const componentes = pieza.componentes || [];

  // --- Material: agrupar el despiece POR INSUMO y comprar formatos enteros ---
  // (Juntar el mismo material antes de redondear es lo que hace que el faldon
  //  caiga en el retazo de la cubierta en vez de comprar su propio tablero.)
  const grupos = {};
  const orden = [];
  // Piezas cuyo material no existe en el catálogo: el motor las ignora (antes en
  // silencio) y se costean en $0. Las juntamos para que la UI marque el costeo
  // como incompleto y bloquee la EMISIÓN (no el guardado del borrador).
  const componentesIgnorados = [];
  // EXCLUIDA_CONFIRMADA (audit 2026-10-01): una partida que alguien DECIDIÓ no costear
  // —"el equipo lo pone el cliente", "lo surte otra área"— vale $0 POR DECISIÓN, no por
  // un hueco de datos. No cuenta como PENDIENTE_COSTO: no vuelve el costeo INCOMPLETO.
  // Se registra aparte para dejar rastro de qué se excluyó y por qué.
  const componentesExcluidos = [];
  for (const comp of componentes) {
    if (comp.excluida) { componentesExcluidos.push(comp.nombre || 'Partida excluida'); continue; }
    const insumo = insumos[comp.insumoId] || comp.insumo;
    if (!insumo) { componentesIgnorados.push(comp.nombre || 'Pieza sin material'); continue; }
    // VH-017: insumo PRESENTE pero sin precio usable = PENDIENTE DE PRECIO, no $0.
    // Entra a la misma lista que un material faltante → el costeo queda INCOMPLETO
    // y la emisión se bloquea. (Un precio 0 declarado SÍ es conocido, §7; un $0
    // por decisión se marca con comp.excluida, atendido arriba.)
    if (!precioUsable(insumo)) { componentesIgnorados.push(comp.nombre || insumo.nombre || 'Material sin precio'); continue; }
    if (!grupos[comp.insumoId]) {
      grupos[comp.insumoId] = { insumo, comps: [] };
      orden.push(comp.insumoId);
    }
    grupos[comp.insumoId].comps.push(comp);
  }

  let materialDirecto = 0;
  let materialIndirecto = 0;
  let materialSinMO = 0;   // comprado ya hecho, solo se instala: NO lleva mano de obra
  let desperdicioTotal = 0;
  const detalleInsumos = [];

  for (const id of orden) {
    const { insumo, comps } = grupos[id];
    const r = comprarInsumo(insumo, comps, n, par);
    if (insumo.clase === 'indirecta') materialIndirecto += r.costo;
    else materialDirecto += r.costo;
    // MO NO sobre lo comprado (Rafa/Rodrigo, 2026-09-23): los componentes que
    // Von Haucke compra YA HECHOS y solo instala —electrico, guardas armadas,
    // paneles EcoAcustic— no llevan mano de obra de fabricacion. Se restan de
    // la base de MO abajo. Pintura/tela/tapiceria NO entran aqui: esas SI
    // llevan mano de obra real (pintar, tapizar).
    if (SIN_MO_SECCIONES.has(insumo.seccion)) materialSinMO += r.costo;
    desperdicioTotal += r.desperdicio;
    const optimizacionCorte = insumo.formato?.largoMM && insumo.formato?.anchoMM
      ? optimizarCorte2D({
          componentes: comps,
          formato: insumo.formato,
          veta: !!insumo.veta,
          kerfMM: par.kerfMM,
          recorteOrillaMM: par.recorteOrillaMM,
          lote: n,
        })
      : null;

    // Advisory 1D para PTR/perfiles. El COSTO oficial sigue exactamente igual:
    // sólo analizamos la lista de cortes cuando el BOM trae largos + número de
    // piezas explícitos. Si el legacy sólo trae metros agregados, el optimizador
    // devuelve SIN_PIEZAS_LINEALES y VONI lo marca como dato pendiente.
    const optimizacionCorte1D = insumo.formato?.tipo === 'tramo'
      && Number(insumo.formato?.medida) > 0
      ? optimizarCorte1D({
          componentes: comps.map((x) => ({ ...x, forma: 'lineal' })),
          largoTramoMM: Number(insumo.formato.medida) * 1000,
          kerfMM: par.kerfMM,
          recortePuntaMM: Number(insumo.formato.recortePuntaMM) || 0,
          lote: n,
        })
      : null;
    detalleInsumos.push({
      insumoId: id,
      nombre: insumo.nombre,
      seccion: insumo.seccion || 'otros',
      clase: insumo.clase || 'directa',
      unidad: insumo.unidad,
      formato: insumo.formato,
      nombresComponentes: comps.map((c) => c.nombre).filter(Boolean),
      optimizacionCorte,
      optimizacionCorte1D,
      ...r,
    });
  }

  const materialTotal = materialDirecto + materialIndirecto;

  // --- Mano de obra (por lote) ---
  const modo = pieza.modoManoObra || 'porcentaje';
  // ⚠️ FORMULA DE ALBA (2026-08-18, motor/formulaAlba.js): sin horas medidas
  // y sin factores fijados a mano (el caso de ESTIMACION, que es el de Alba
  // -area de estimaciones-, antes de que exista una orden con horas reales),
  // MO y GI ya NO son 17%/12%/34% planos: son MO% por TIPO de material
  // (cubierta 15%, cristal 1%, lo demas 20%) y GI = 3xMO (5% del material en
  // cristal). Verificado al centavo contra su T.D.C. real. Si hay horas
  // medidas, o si la pieza fija sus propios factorDirecta/factorIndirecta (el
  // puente 6.4), esos mandan: son datos mas finos que la formula de
  // estimacion, y no hay motivo para pisarlos.
  const usaFactoresExplicitos = pieza.factorDirecta != null || pieza.factorIndirecta != null;
  const factorDirecta = pieza.factorDirecta != null ? pieza.factorDirecta : par.factorManoObraDirecta;
  const factorIndirecta = pieza.factorIndirecta != null ? pieza.factorIndirecta : par.factorManoObraIndirecta;
  const usaFormulaAlba = modo !== 'horas' && !usaFactoresExplicitos;

  let manoObra;
  let giAlba = 0; // solo tiene sentido si usaFormulaAlba (ver "Clasico" abajo)
  if (modo === 'horas') {
    manoObra = manoObraPorHoras(pieza.horas, n, par);
  } else if (usaFormulaAlba) {
    const alba = manoObraGiAlba(detalleInsumos);
    manoObra = alba.mo;
    giAlba = alba.gi;
  } else {
    // MO NO sobre lo comprado: los componentes de SIN_MO_SECCIONES (comprados
    // ya hechos, solo se instalan) salen de la base de mano de obra. Son clase
    // 'indirecta', asi que se restan de esa base.
    const baseIndirectaMO = Math.max(0, materialIndirecto - materialSinMO);
    manoObra =
      materialDirecto * (factorDirecta / 100) +
      baseIndirectaMO * (factorIndirecta / 100);
  }

  // Puente entre los dos modos (6.4): que % equivaldrian las horas medidas
  let factorEquivalente = 0;
  if (materialDirecto > 0) {
    factorEquivalente = usaFormulaAlba
      ? (manoObra / materialDirecto) * 100
      : ((manoObra / n - (materialIndirecto / n) * (factorIndirecta / 100)) /
          (materialDirecto / n)) *
        100;
  }

  // --- Resto de la cadena (6.5) ---
  const preparacion = (pieza.preparacionHoras || 0) * par.costoHora; // una vez por lote
  const empaque = (par.empaquePorPieza || 0) * n;
  const costoDirecto = materialTotal + manoObra + preparacion + empaque;

  // Merma de proceso (% de piezas que se rehacen). Se usa como divisor
  // costoLote/(1-merma): una merma ≥100% dejaba (1-merma)≤0 y el costo salía
  // Infinity/negativo (precio roto, sin aviso). Se acota a [0, 0.95): una merma
  // así de alta es un dato inválido; preferimos un costo finito y CARO (fail-closed
  // hacia arriba, nunca sub-precio) a una cifra rota propagándose por toda la app.
  const merma = Math.min(0.95, par.mermaProceso > 0 ? par.mermaProceso / 100 : 0);

  // El modelo puede venir por PIEZA (p. ej. App LT) o global por parametros.
  const modeloCosteo = pieza.modeloCosteo || par.modeloCosteo;
  let indirectosFabrica, gastosOperacion, costoFabricacion, costoLote;
  if (modeloCosteo === 'intelisis') {
    // Cascada Intelisis: GIF por hora + capa de gastos de operacion sobre fabricacion.
    indirectosFabrica = gifPorHoras(pieza.horas, n, par);        // GIF = Σ horas x $/h
    costoFabricacion = materialTotal + manoObra + preparacion + empaque + indirectosFabrica;
    gastosOperacion = costoFabricacion * (par.gastosOperacionPct / 100);
    costoLote = costoFabricacion + gastosOperacion;              // = "Costo Total" Intelisis
  } else {
    // Clasico (master 6.5), sin gastos operacion. Con horas medidas o con
    // factores fijados a mano: indirectos = 34% sobre material DIRECTO
    // (formula historica). En estimacion pura (usaFormulaAlba): los
    // indirectos son los de Alba, 3xMO por tipo de material (giAlba, arriba).
    indirectosFabrica = usaFormulaAlba ? giAlba : materialDirecto * (par.factorIndirectosFabrica / 100);
    gastosOperacion = 0;
    costoFabricacion = costoDirecto + indirectosFabrica;
    costoLote = costoFabricacion;
  }

  const costoLoteConMerma = costoLote / (1 - merma);
  const costoUnitario = costoLoteConMerma / n;
  const tarifasFaltantes = modeloCosteo === 'intelisis'
    ? tarifasFaltantesIntelisis(pieza.horas, par)
    : [];

  return {
    piezas: n,
    materialDirecto,
    materialIndirecto,
    materialTotal,
    desperdicio: desperdicioTotal,
    manoObra,
    modoManoObra: modo,
    factorEquivalente,
    preparacion,
    empaque,
    costoDirecto,
    indirectosFabrica,
    gastosOperacion,
    costoFabricacion,
    modeloCosteo,
    costoLote,
    costoLoteConMerma,
    costoUnitario,
    detalleInsumos,
    componentesIgnorados,
    componentesExcluidos,
    tarifasFaltantes,
  };
}

// -----------------------------------------------------------------------------
//  FAIL-CLOSED (audit 2026-10-01). Un costo con partidas SIN material (huecos de
//  datos, no decisiones) NO es emitible: su `costoUnitario` es apenas un SUBTOTAL
//  CONOCIDO, nunca el costo total. Sobre él no se saca precio de lista, utilidad,
//  precio mínimo ni precios por volumen. Esta función es el único juez de "¿se
//  puede poner precio?" y la usan la UI y el guardado para no emitir en falso.
//  Las EXCLUIDAS_CONFIRMADAS (comp.excluida) NO cuentan: son $0 por decisión.
// -----------------------------------------------------------------------------
export function costeoEmitible(resultado) {
  const faltantes = [...((resultado && resultado.componentesIgnorados) || [])];
  const formatosInvalidos = (resultado?.detalleInsumos || [])
    .filter((d) => d?.noCabe)
    .map((d) => `${d.nombre || d.insumoId || 'Material'}: una o más piezas no caben en el formato de compra`);
  const tarifasFaltantes = [...((resultado && resultado.tarifasFaltantes) || [])];
  const costoRaw = resultado?.costoUnitario;
  const costo = costoRaw == null || costoRaw === '' ? NaN : Number(costoRaw);
  const costoCorrupto = !Number.isFinite(costo) || costo < 0;

  const pendientes = [...faltantes, ...formatosInvalidos, ...tarifasFaltantes.map((x) => `Tarifa Intelisis faltante: ${x}`)];
  if (costoCorrupto) pendientes.push('Costo unitario inválido/no finito');

  const emitible = pendientes.length === 0;
  return {
    emitible,
    pendientes,
    bloqueos: {
      datos_faltantes: faltantes,
      formato_incompatible: formatosInvalidos,
      tarifas_faltantes: tarifasFaltantes,
      costo_invalido: costoCorrupto,
    },
    subtotalConocido: Number.isFinite(costo) && costo >= 0 ? costo : 0,
    // Nunca existe costoTotal autorizado mientras haya una incompatibilidad física
    // o numérica, aunque el motor haya podido calcular un subtotal aproximado.
    costoTotal: emitible ? costo : null,
    estadoCosto: emitible ? 'completo' : 'incompleto',
  };
}

// -----------------------------------------------------------------------------
//  BOM CANÓNICO (audit 2026-10-01). Firma estable y determinista de un despiece,
//  para CONGELARLO por revisión y detectar si cambió. Dos despieces iguales dan
//  la misma firma; cualquier cambio de pieza/material/medida/cantidad la cambia.
//  No depende del orden en que vengan las piezas.
// -----------------------------------------------------------------------------
function firmaComponente(c = {}) {
  // La identidad de una partida: su nombre + material + medidas/cantidad efectivas.
  return [
    String(c.nombre || '').trim().toLowerCase(),
    String(c.insumoId || ''),
    Number(c.largoMM || 0), Number(c.anchoMM || 0),
    c.hojas != null ? Number(c.hojas) : '',
    Number(c.cantidad || 0), Number(c.piezas || 1),
    c.excluida ? 'X' : '',
  ].join('|');
}

export function bomHash(componentes = []) {
  const firmas = (componentes || []).map(firmaComponente).sort();
  const s = firmas.join('§');
  // FNV-1a de 32 bits en hex: barato, estable, suficiente para detectar cambios.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

// -----------------------------------------------------------------------------
//  PROPUESTA_DIFF (audit 2026-10-01). Diferencia entre el BOM canónico vigente y
//  uno nuevo propuesto (por la IA al recalcular, p. ej.). Devuelve qué habría que
//  agregar / modificar / eliminar. El BOM NO se reemplaza en silencio: un humano
//  decide. La clave de identidad es el nombre de la partida (normalizado).
// -----------------------------------------------------------------------------
const claveBOM = (c = {}) => String(c.nombre || '').trim().toLowerCase();

export function diffBOM(viejo = [], nuevo = []) {
  const mapV = new Map((viejo || []).map((c) => [claveBOM(c), c]));
  const mapN = new Map((nuevo || []).map((c) => [claveBOM(c), c]));
  const agregar = [];
  const modificar = [];
  const eliminar = [];
  for (const [k, c] of mapN) {
    if (!mapV.has(k)) agregar.push(c);
    else if (firmaComponente(mapV.get(k)) !== firmaComponente(c)) modificar.push({ antes: mapV.get(k), despues: c });
  }
  for (const [k, c] of mapV) {
    if (!mapN.has(k)) eliminar.push(c);
  }
  return { agregar, modificar, eliminar, sinCambios: !agregar.length && !modificar.length && !eliminar.length };
}

// Aplica un PROPUESTA_DIFF ya ACEPTADO por un humano al BOM canónico. Nunca se
// llama en automático: solo cuando el usuario acepta los cambios. Las partidas
// eliminadas salen, las modificadas se reemplazan por su versión 'despues' y las
// agregadas se añaden. Devuelve el nuevo BOM (no muta el de entrada).
export function aplicarDiffBOM(componentes = [], diff = {}) {
  const elim = new Set((diff.eliminar || []).map(claveBOM));
  const mod = new Map((diff.modificar || []).map((m) => {
    const d = m && m.despues ? m.despues : m;
    return [claveBOM(d), d];
  }));
  const base = (componentes || [])
    .filter((c) => !elim.has(claveBOM(c)))
    .map((c) => (mod.has(claveBOM(c)) ? { ...c, ...mod.get(claveBOM(c)) } : c));
  return [...base, ...(diff.agregar || [])];
}

// Piezas cuyo material no existe en el catálogo (insumoId vacío, o un id que ya
// no está): el motor las salta y se costean en $0. La UI usa esto para marcar el
// costeo como INCOMPLETO y bloquear la emisión al cliente — nunca el guardado
// del borrador (mandato audit 2026-10-01: "permitir guardar el borrador, marcar
// exactamente qué falta y bloquear su emisión definitiva").
export function componentesSinMaterial(componentes = [], insumos = {}) {
  return componentes
    .filter((c) => !(insumos[c?.insumoId] || c?.insumo))
    .map((c) => c?.nombre || 'Pieza sin material');
}

// -----------------------------------------------------------------------------
//  6.7  Precio de venta. El margen es sobre precio, no sobre costo.
// -----------------------------------------------------------------------------
export function precioDe(costoUnitario, margen) {
  // FAIL-CLOSED DE DINERO (revisión 2026-10-04). Un margen sobre precio ≥100% (o <0,
  // o NaN) es financieramente IMPOSIBLE: no existe un precio válido. Un costo no
  // finito también invalida. En esos casos se devuelve **NaN como señal explícita de
  // "cálculo inválido"** para que la UI y la emisión BLOQUEEN — el motor NO acota ni
  // reinterpreta en silencio una configuración imposible (antes capaba a 99% o daba
  // Infinity→$0, que es fail-OPEN: convertía un error en un número plausible/barato).
  const m = Number(margen);
  if (!Number.isFinite(costoUnitario) || !Number.isFinite(m) || m >= 100 || m < 0) return NaN;
  return costoUnitario / (1 - m / 100);
}

export function utilidadDe(costoUnitario, margen) {
  return precioDe(costoUnitario, margen) - costoUnitario;
}

// ⚠️ ESTA FUSIÓN VIVÍA DUPLICADA (2026-08-20): `lineas.js:precioDePieza()` y
// `CosteadorLinea.jsx` la reimplementaban cada quien por su lado, y otros 6
// sitios que llaman `calcular()`/`precioVenta()` directo (Costeador.jsx,
// Tablero.jsx, Asistente.jsx, AsistenteEspecial.jsx, Catalogo.jsx, el
// respaldo de App.jsx) no la aplicaban en absoluto — si una pieza fuera de
// App LT algún día declarara `modeloCosteo:'intelisis'` con tarifas reales
// calibradas, solo 2 de 8 pantallas la habrían tratado bien. Sin esto,
// `calcular()` YA lee `pieza.modeloCosteo` sola, pero `precioVenta()` sólo
// lee `par.modeloCosteo` — por eso hace falta empujar el modelo Y las
// tarifas de la pieza hacia los PARÁMETROS antes de llamar a cualquiera de
// las dos. Hoy es un no-op fuera de App LT/App: ninguna otra pieza declara
// `modeloCosteo` todavía.
export function modeloParaPieza(parametrosBase, pieza) {
  const esIntelisis = pieza?.modeloCosteo === 'intelisis';
  const par = esIntelisis
    ? { ...parametrosBase, modeloCosteo: 'intelisis', usarCostoPorArea: true, ...(pieza.parModelo || {}) }
    : parametrosBase;
  return { par, esIntelisis };
}

// Precio segun el modelo activo. En 'intelisis' el costoUnitario YA es el
// "Costo Total" (incluye gastos de operacion): precio = costo x(1+utilidad),
// precio lista = precio x factorPrecioLista. En 'clasico' usa margen sobre precio.
export function precioVenta(costoUnitario, par = PARAMETROS_DEFAULT) {
  const p = { ...PARAMETROS_DEFAULT, ...par };
  // Fail-closed: un costo no finito NO se convierte en $0 (eso sería un precio
  // barato falso); se propaga como inválido (NaN) para que la UI/emisión bloqueen.
  if (!Number.isFinite(costoUnitario)) return { precio: NaN, lista: NaN, precioLista: NaN };
  const costo = costoUnitario;
  if (p.modeloCosteo === 'intelisis') {
    const precio = costo * (1 + (p.utilidadPct || 0) / 100);
    const lista = precio * (p.factorPrecioLista || 1);
    return { precio, lista, precioLista: lista };
  }
  const margen = p.margenObjetivo ?? 50;
  const lista = precioDe(costoUnitario, margen);
  return { precio: lista, lista, precioLista: lista };
}

// -----------------------------------------------------------------------------
//  6.8  Sugerencia de lote optimo.
//       Prueba de piezas+1 a piezas+8; si alguno baja el costo unitario mas de
//       1.5%, lo propone. Existe porque a veces la pieza extra abre tablero nuevo
//       y conviene, o al reves.
// -----------------------------------------------------------------------------
export function sugerenciaLote(pieza, piezas, insumos, parametros) {
  const base = calcular(pieza, piezas, insumos, parametros).costoUnitario;
  let mejor = null;
  for (let k = piezas + 1; k <= piezas + 8; k++) {
    const cu = calcular(pieza, k, insumos, parametros).costoUnitario;
    const ahorro = base > 0 ? ((base - cu) / base) * 100 : 0;
    if (ahorro > 1.5 && (!mejor || cu < mejor.costoUnitario)) {
      mejor = { piezas: k, costoUnitario: cu, ahorroPct: ahorro, ahorroPorPieza: base - cu };
    }
  }
  return mejor; // null = no hay mejora que valga la pena
}

// -----------------------------------------------------------------------------
//  6.9  Sugerencia de medida que rinde mejor (mobiliario a la medida).
//       Barre de -80mm a +0mm en pasos de 5mm en ambas dimensiones. Nunca
//       propone medidas mayores a la pedida.
// -----------------------------------------------------------------------------
export function sugerenciaMedida(largoMM, anchoMM, insumo, parametros) {
  const par = { ...PARAMETROS_DEFAULT, ...parametros };
  const actual = piezasPorTablero(largoMM, anchoMM, { ...par, veta: insumo.veta });
  let mejor = null;
  for (let dl = -80; dl <= 0; dl += 5) {
    for (let da = -80; da <= 0; da += 5) {
      const L = largoMM + dl;
      const A = anchoMM + da;
      if (L <= 0 || A <= 0) continue;
      const ppt = piezasPorTablero(L, A, { ...par, veta: insumo.veta });
      if (ppt > actual && (!mejor || ppt > mejor.piezasPorTablero)) {
        mejor = { largoMM: L, anchoMM: A, piezasPorTablero: ppt };
      }
    }
  }
  return { actual, mejor }; // mejor null = la medida pedida ya rinde bien
}
