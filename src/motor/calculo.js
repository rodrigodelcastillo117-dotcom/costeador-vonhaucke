// ============================================================================
//  MOTOR DE CALCULO - Costeador de Produccion Von Haucke
// ----------------------------------------------------------------------------
//  NORMATIVO. Las formulas son las del master, seccion 6. No se modifican
//  ni se "mejoran". Este archivo NO depende de React y debe estar cubierto
//  por pruebas (calculo.test.js).
// ============================================================================

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
  margenMinimo: 40,            // % (sobre precio) - aviso interno del costeo
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

  const orientaciones = [[largoMM, anchoMM]];
  if (!veta) orientaciones.push([anchoMM, largoMM]); // girar solo si no hay veta

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
export function costoNetoComponente(comp, insumo, n = 1, par = PARAMETROS_DEFAULT) {
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

  for (const c of comps) {
    const netoC = netoComponente(c, n);
    neto += netoC;
    conCorte += netoC * factorMerma;
    if (c.largoMM && c.anchoMM && insumo.formato) {
      const ppt = piezasPorTablero(c.largoMM, c.anchoMM, { ...par, veta: insumo.veta });
      const piezasComp = (c.piezas || 1) * n;
      if (ppt > 0) tablerosRejilla += Math.ceil(piezasComp / ppt - 1e-9);
      else hayPiezaQueNoCabe = true;
    }
  }

  // FRACCION DE HOJA (rendimiento). No se redondea a formato entero: se cobra
  // solo la fraccion de hoja que consume la pieza, ajustada por el
  // APROVECHAMIENTO (el retazo restante se usa en otros productos). El precio
  // del insumo se captura POR HOJA. Vale para tableros (m2) y laminas (kg):
  // 'neto' y 'formato.medida' viven en la misma unidad.
  if (insumo.formato && insumo.fraccion) {
    const aprov = par.aprovechamientoCorte > 0 ? par.aprovechamientoCorte / 100 : 1;
    const areaFmt = insumo.formato.medida;
    const hojas = neto / (areaFmt * aprov);        // fraccion de hoja (rendimiento)
    const comprado = hojas * areaFmt;              // consumo cargado (incluye scrap de aprovechamiento)
    const precioUnidad = precio / areaFmt;         // precio por m2/kg equivalente
    return {
      neto, comprado, unidades: hojas, formato: insumo.formato,
      costo: hojas * precio,
      desperdicio: (comprado - neto) * precioUnidad,
      pct: comprado > 0 ? ((comprado - neto) / comprado) * 100 : 0,
      precio, noCabe: false, fraccion: true,
    };
  }

  // Sin formato, o material de inventario: el sobrante se guarda, no se redondea
  if (!insumo.formato || insumo.inventario) {
    return {
      neto, comprado: conCorte, unidades: null, costo: conCorte * precio,
      desperdicio: (conCorte - neto) * precio,
      pct: conCorte > 0 ? ((conCorte - neto) / conCorte) * 100 : 0,
      precio, noCabe: false,
    };
  }

  const porArea = Math.ceil(conCorte / insumo.formato.medida - 1e-9);
  const unidades = Math.max(tablerosRejilla, porArea);
  const comprado = unidades * insumo.formato.medida;
  return {
    neto, comprado, unidades, formato: insumo.formato, costo: comprado * precio,
    desperdicio: (comprado - neto) * precio,
    pct: comprado > 0 ? ((comprado - neto) / comprado) * 100 : 0,
    precio, noCabe: hayPiezaQueNoCabe,
  };
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

// -----------------------------------------------------------------------------
//  6.5  Cadena completa del costo.
//       calcular(pieza, piezas, insumos, parametros)
//       - insumos: mapa id -> insumo (o el componente trae component.insumo)
// -----------------------------------------------------------------------------
export function calcular(pieza, piezas = 1, insumos = {}, parametros = PARAMETROS_DEFAULT) {
  const par = { ...PARAMETROS_DEFAULT, ...parametros };
  const n = Math.max(1, piezas);
  const componentes = pieza.componentes || [];

  // --- Material: agrupar el despiece POR INSUMO y comprar formatos enteros ---
  // (Juntar el mismo material antes de redondear es lo que hace que el faldon
  //  caiga en el retazo de la cubierta en vez de comprar su propio tablero.)
  const grupos = {};
  const orden = [];
  for (const comp of componentes) {
    const insumo = insumos[comp.insumoId] || comp.insumo;
    if (!insumo) continue; // insumo desconocido: se ignora (la UI lo advierte)
    if (!grupos[comp.insumoId]) {
      grupos[comp.insumoId] = { insumo, comps: [] };
      orden.push(comp.insumoId);
    }
    grupos[comp.insumoId].comps.push(comp);
  }

  let materialDirecto = 0;
  let materialIndirecto = 0;
  let desperdicioTotal = 0;
  const detalleInsumos = [];

  for (const id of orden) {
    const { insumo, comps } = grupos[id];
    const r = comprarInsumo(insumo, comps, n, par);
    if (insumo.clase === 'indirecta') materialIndirecto += r.costo;
    else materialDirecto += r.costo;
    desperdicioTotal += r.desperdicio;
    detalleInsumos.push({
      insumoId: id,
      nombre: insumo.nombre,
      seccion: insumo.seccion || 'otros',
      clase: insumo.clase || 'directa',
      unidad: insumo.unidad,
      formato: insumo.formato,
      nombresComponentes: comps.map((c) => c.nombre).filter(Boolean),
      ...r,
    });
  }

  const materialTotal = materialDirecto + materialIndirecto;

  // --- Mano de obra (por lote) ---
  const modo = pieza.modoManoObra || 'porcentaje';
  const factorDirecta = pieza.factorDirecta != null ? pieza.factorDirecta : par.factorManoObraDirecta;
  const factorIndirecta = pieza.factorIndirecta != null ? pieza.factorIndirecta : par.factorManoObraIndirecta;

  let manoObra;
  if (modo === 'horas') {
    manoObra = manoObraPorHoras(pieza.horas, n, par);
  } else {
    manoObra =
      materialDirecto * (factorDirecta / 100) +
      materialIndirecto * (factorIndirecta / 100);
  }

  // Puente entre los dos modos (6.4): que % equivaldrian las horas medidas
  let factorEquivalente = 0;
  if (materialDirecto > 0) {
    factorEquivalente =
      ((manoObra / n - (materialIndirecto / n) * (factorIndirecta / 100)) /
        (materialDirecto / n)) *
      100;
  }

  // --- Resto de la cadena (6.5) ---
  const preparacion = (pieza.preparacionHoras || 0) * par.costoHora; // una vez por lote
  const empaque = (par.empaquePorPieza || 0) * n;
  const costoDirecto = materialTotal + manoObra + preparacion + empaque;

  const merma = par.mermaProceso > 0 ? par.mermaProceso / 100 : 0;

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
    // Clasico (master 6.5): indirectos = 34% sobre material DIRECTO, sin gastos operacion.
    indirectosFabrica = materialDirecto * (par.factorIndirectosFabrica / 100);
    gastosOperacion = 0;
    costoFabricacion = costoDirecto + indirectosFabrica;
    costoLote = costoFabricacion;
  }

  const costoLoteConMerma = costoLote / (1 - merma);
  const costoUnitario = costoLoteConMerma / n;

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
  };
}

// -----------------------------------------------------------------------------
//  6.7  Precio de venta. El margen es sobre precio, no sobre costo.
// -----------------------------------------------------------------------------
export function precioDe(costoUnitario, margen) {
  const m = margen / 100;
  if (m >= 1) return Infinity; // margen 100% no tiene precio finito
  return costoUnitario / (1 - m);
}

export function utilidadDe(costoUnitario, margen) {
  return precioDe(costoUnitario, margen) - costoUnitario;
}

// Precio segun el modelo activo. En 'intelisis' el costoUnitario YA es el
// "Costo Total" (incluye gastos de operacion): precio = costo x(1+utilidad),
// precio lista = precio x factorPrecioLista. En 'clasico' usa margen sobre precio.
export function precioVenta(costoUnitario, par = PARAMETROS_DEFAULT) {
  const p = { ...PARAMETROS_DEFAULT, ...par };
  if (p.modeloCosteo === 'intelisis') {
    const precio = costoUnitario * (1 + (p.utilidadPct || 0) / 100);
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
