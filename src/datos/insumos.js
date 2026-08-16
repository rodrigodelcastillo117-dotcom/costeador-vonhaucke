// ============================================================================
//  DATOS SEMILLA - Insumos (master 8.6, 5.1, 5.2, 6.3)
// ----------------------------------------------------------------------------
//  Precios CALIBRADOS 2026-08-13 a ULTIMA COMPRA real del ERP Von Haucke (archivo
//  'Costos de Materia Prima Ultima Compra al 10082026'). Cristales +15%.
//  NO son precios reales de proveedor Von Haucke: se sustituyen con los reales
//  en la pantalla Precios sin tocar codigo. Marcados los inciertos con nota.
//  clase directa/indirecta segun 6.3. Von Haucke NO usa cromo: usa EcoCrom.
// ============================================================================

const HOY = '2026-08-12';

// De dónde salió el precio. Sin esto, un número en la app no se puede volver a
// comprobar: la calibración se hace a mano una vez y nadie sabe contra qué.
// `articulo` es el nombre EXACTO con el que Compras o el ERP lo llaman, que es
// lo que permite recalibrar solo la próxima vez.
export const FUENTE_COMPRAS = 'Compras, lista del 2026-08-14';
export const FUENTE_ERP = 'ERP, ultima compra';

// Atajo para no repetir campos
function ins(o) {
  return {
    unidad: 'm2',
    clase: 'directa',
    mermaCorte: 0,
    inventario: false,
    veta: false,
    fraccion: false,
    actualizado: HOY,
    proveedor: '',
    precioBase: o.precio,
    ...o,
  };
}

// TABLERO: se compra POR HOJA (1.22x2.44) y se costea por FRACCION de hoja
// (rendimiento), ajustada por el aprovechamiento. El 'precio' es POR HOJA.
function tablero(o) {
  return ins({ seccion: 'cubiertas', unidad: 'hoja', formato: TABLERO, fraccion: true, mermaCorte: 6, ...o });
}

// Formatos de compra (8.6)
const TABLERO = { tipo: 'tablero', nombre: 'tablero 1.22 x 2.44', corto: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
const LAMINA18 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 28.4 };
const LAMINA20 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 21.3 };
const LAMINA22 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 17.7 };
// Calibres mas gruesos (kg por hoja 1.22x2.44) — pedidos en levantamiento Rafa
const LAMINA14 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 44.4 };
const LAMINA12 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 62.2 };
const LAMINA10 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 79.9 };
const TRAMO6 = { tipo: 'tramo', nombre: 'tramo de 6 m', corto: 'tramo', medida: 6 };
const ROLLO50 = { tipo: 'rollo', nombre: 'rollo de 50 m', corto: 'rollo', medida: 50 };
// Los cubre cantos gruesos vienen en rollos más largos (así los surte Compras).
const ROLLO100 = { tipo: 'rollo', nombre: 'rollo de 100 m', corto: 'rollo', medida: 100 };
const ROLLO150 = { tipo: 'rollo', nombre: 'rollo de 150 m', corto: 'rollo', medida: 150 };

export const INSUMOS_SEMILLA = [
  // ---- CUBIERTAS Y FRENTES (tableros: precio POR HOJA, costeo por fraccion) ----
  // MELAMINA: BLANCA y DE COLOR son materiales distintos, no el mismo con otro
  // precio. Rodrigo (2026-08-16): "muchas sí compramos BLANCA, y es la más
  // barata". Por eso Compras la lista a $450/$544 y el ERP —que promedia los
  // colores y las maderas— la trae a $685/$665. La blanca es la de volumen y
  // queda como la de por omisión; el color va aparte para poder cotizarlo.
  tablero({ id: 'melamina-16', nombre: 'Melamina BLANCA 16 mm', precio: 450, articulo: 'Aglomerado con melamina blanca 4x8 16 mm', fuente: FUENTE_COMPRAS }),
  tablero({ id: 'melamina-16-color', nombre: 'Melamina de COLOR / madera 16 mm', precio: 685, articulo: 'MVLMAG01280500 AGLOMERADO MELAMINA DOS CARAS 4x8 16 mm', fuente: FUENTE_ERP }),
    tablero({ id: 'melamina-19', nombre: 'Melamina BLANCA / EcoLegno 19 mm', precio: 544, articulo: 'Aglomerado con melamina blanca 4x8 19 mm', fuente: FUENTE_COMPRAS }),
  tablero({ id: 'melamina-19-color', nombre: 'Melamina de COLOR / madera 19 mm', precio: 665, articulo: 'MVLMAG01280600 AGLOMERADO MELAMINA DOS CARAS 4x8 19 mm', fuente: FUENTE_ERP }),
  tablero({ id: 'melamina-28', nombre: 'Melamina ABS 28 mm (cubierta APP LT)', precio: 1335.6 }),   // INCIERTO: tablero grueso nicho
  tablero({ id: 'melamina-9', nombre: 'Melamina 9 mm (biombo)', precio: 648.9 }),
  tablero({ id: 'aglomerado', nombre: 'Aglomerado', precio: 344 }),
  tablero({ id: 'mdf-16', nombre: 'MDF 16 mm', precio: 372 }),
  tablero({ id: 'mdf', nombre: 'MDF 19 mm', precio: 437, articulo: 'MDF natural 4x8 19 mm', fuente: FUENTE_COMPRAS }),
  tablero({ id: 'mdf-25', nombre: 'MDF 25 mm', precio: 785, articulo: 'MDF natural 4x8 25 mm', fuente: FUENTE_COMPRAS }),
  // CHAPA DE MADERA. La que Von Haucke compra es `MVLMCH00010010`, hoja de
  // 4' × 8' de sábana natural, a $540 (17-jun-2026) = $181 el m². La lista de
  // Compras trae otra: "ANTRACITE LEGACY" a $270 el m², que es una chapa
  // decorativa distinta —no la genérica— y va aparte, abajo.
  tablero({ id: 'chapa-madera', nombre: 'Chapa de madera (sabana natural)', precio: 540, veta: true,
    articulo: 'MVLMCH00010010 CHAPA DE MADERA HOJA 4x8 (SABANA NATURAL)', fuente: FUENTE_ERP }),
  // La ANTRACITE LEGACY de la lista de Compras: $270 el m² × 2.9768 m² la hoja.
  tablero({ id: 'chapa-antracite', nombre: 'Chapa de madera ANTRACITE LEGACY', precio: 803.74, veta: true,
    articulo: 'Chapa de madera ANTRACITE LEGACY ($270 el m2)', fuente: FUENTE_COMPRAS }),
  tablero({ id: 'chapa-walnut', nombre: 'Chapa Walnut Burl (poro sellado)', precio: 716, veta: true }),
  tablero({ id: 'laminado', nombre: 'Laminado plastico / Ecolegno (HPL)', precio: 405.6 }),          // INCIERTO: casi todo "por cotizar"
  tablero({ id: 'membrana-pvc', nombre: 'Membrana PVC (termoformado)', precio: 700 }),              // INCIERTO: se vende por ml/m2/rollo
  tablero({ id: 'faldon-melamina', nombre: 'Faldon melamina', precio: 665 }),
  ins({ id: 'faldon-abs', nombre: 'Conducto faldon ABS (App LT)', seccion: 'cubiertas', precio: 180, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'marmol', nombre: 'Marmol (losa 20 mm)', seccion: 'cubiertas', precio: 2000, clase: 'indirecta' }),          // por m2
  ins({ id: 'marmol-premium', nombre: 'Marmol premium (Calacatta/Arabescato/Nero)', seccion: 'cubiertas', precio: 2800, clase: 'indirecta' }), // por m2
  ins({ id: 'cristal-satinado', nombre: 'Cristal satinado 9 mm', seccion: 'cubiertas', precio: 2130, clase: 'indirecta' }), // por m2
  ins({ id: 'tapacanto', nombre: 'Tapacanto PVC', seccion: 'cubiertas', precio: 3.04, unidad: 'm', formato: ROLLO50, mermaCorte: 4, inventario: true }),
  ins({ id: 'tapacanto-3mm', nombre: 'Tapacanto ABS 3 mm', seccion: 'cubiertas', precio: 15.99, unidad: 'm', formato: ROLLO50, mermaCorte: 4, inventario: true }),
  // ⚠️ NO ES UN MATERIAL: es una OPERACIÓN, cobrada por metro de canto curvo.
  // Por qué existe (Rodrigo, 2026-08-16: "Río es curvo, por eso es más caro"):
  // una cubierta curva no se corta en la sierra ni se cantea en la canteadora
  // recta. Va a router CNC y el canto se pega en curva, que es mucho más lento.
  // Hasta hoy el despiece cobraba una cubierta curva EXACTAMENTE igual que una
  // recta, y por eso la banca curva de Río salía MÁS BARATA que la recta.
  // El precio es el equivalente en $/m de ese tiempo extra de máquina y mano de
  // obra; se calibró contra el ancla real de Río (226060050, bench doble
  // 4800×1200 8 usuarios). Se sustituye por horas medidas en cuanto llegue una
  // orden de producción de Río con sus tiempos por centro.
  ins({ id: 'curvado', nombre: 'Ruteado CNC + canteado en curva (por metro de arco)', seccion: 'cubiertas', precio: 80, unidad: 'm', clase: 'directa', nota: 'Operación, no material. Calibrado, no medido: falta orden de producción de Río.' }),

  // ---- ESTRUCTURA METALICA ----
  // Laminas: precio POR HOJA (1.22x2.44), costeo por FRACCION de hoja. El consumo
  // entra en kg y el formato guarda los kg por hoja -> fraccion = kg / (kg_hoja * aprov).
  ins({ id: 'lamina-18', nombre: 'Lamina de acero cal. 18', seccion: 'metal', precio: 571.54, unidad: 'hoja', formato: LAMINA18, fraccion: true, mermaCorte: 8 }),
  // ⚠️ UNIDAD: Compras cotiza la lámina por PIEZA de 3' × 10' ($436.82), pero la
  // app compra hojas de 1.22 × 2.44 y el despiece la pide en KILOS. Lo que se
  // conserva del papel es el $/kg —$21.40, que Compras anota al margen— y se
  // multiplica por lo que pesa la hoja de la app. Tomar los $436.82 tal cual
  // dejaba el acero 4% barato, porque la pieza de Compras es más chica.
  ins({ id: 'lamina-20', nombre: 'Lamina de acero cal. 20', seccion: 'metal', precio: 455.82, unidad: 'hoja', formato: LAMINA20, fraccion: true, mermaCorte: 8, articulo: 'Lamina negra cal. 20 ($21.40 el kg)', fuente: FUENTE_COMPRAS }),
    ins({ id: 'lamina-22', nombre: 'Lamina de acero cal. 22', seccion: 'metal', precio: 378.78, unidad: 'hoja', formato: LAMINA22, fraccion: true, mermaCorte: 8, articulo: 'Lamina negra cal. 22 ($21.40 el kg)', fuente: FUENTE_COMPRAS }),
  // Calibres gruesos pedidos en levantamiento Rafa §1.
  ins({ id: 'lamina-14', nombre: 'Lamina de acero cal. 14', seccion: 'metal', precio: 816.48, unidad: 'hoja', formato: LAMINA14, fraccion: true, mermaCorte: 8 }),
  ins({ id: 'lamina-12', nombre: 'Lamina de acero cal. 12', seccion: 'metal', precio: 1336.56, unidad: 'hoja', formato: LAMINA12, fraccion: true, mermaCorte: 8 }),
  ins({ id: 'lamina-10', nombre: 'Lamina de acero cal. 10', seccion: 'metal', precio: 2270.17, unidad: 'hoja', formato: LAMINA10, fraccion: true, mermaCorte: 8 }),
  ins({ id: 'inoxidable', nombre: 'Acero inoxidable 304 cal. 20', seccion: 'metal', precio: 1930, unidad: 'hoja', formato: LAMINA20, fraccion: true, mermaCorte: 8 }), // VOLATIL: niquel
  ins({ id: 'ptr', nombre: 'Tubo / PTR 1"x2" cal. 16', seccion: 'metal', precio: 38.19, unidad: 'm', formato: TRAMO6, mermaCorte: 5 }),
  // PTR por metro lineal, calibres pedidos en levantamiento Rafa §1 (INCIERTO: mejor por kg)
  ins({ id: 'ptr-14', nombre: 'Tubo / PTR cal. 14', seccion: 'metal', precio: 45.13, unidad: 'm', formato: TRAMO6, mermaCorte: 5 }),
  ins({ id: 'ptr-12', nombre: 'Tubo / PTR cal. 12', seccion: 'metal', precio: 175, unidad: 'm', formato: TRAMO6, mermaCorte: 5 }),
  ins({ id: 'ptr-10', nombre: 'Tubo / PTR cal. 10', seccion: 'metal', precio: 225, unidad: 'm', formato: TRAMO6, mermaCorte: 5 }),
  ins({ id: 'pata-metalica', nombre: 'Pata metalica comprada', seccion: 'metal', precio: 380, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'perfil-aluminio', nombre: 'Perfil de aluminio', seccion: 'metal', precio: 122.71, unidad: 'm', formato: TRAMO6, mermaCorte: 5 }),  // INCIERTO sin perfil exacto
  ins({ id: 'soldadura', nombre: 'Soldadura', seccion: 'metal', precio: 65, unidad: 'kg', inventario: true }),

  // ---- CABLEADO Y ENERGIA (se compra hecho, se instala -> indirecta) ----
  ins({ id: 'acometida', nombre: 'Acometida', seccion: 'electrico', precio: 570, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'ducto', nombre: 'Ducto', seccion: 'electrico', precio: 17.68, unidad: 'm', clase: 'indirecta' }),
  ins({ id: 'charola', nombre: 'Charola', seccion: 'electrico', precio: 145, unidad: 'm', clase: 'indirecta' }),
  ins({ id: 'tapa-abatible', nombre: 'Tapa abatible', seccion: 'electrico', precio: 320, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'caja-electrica', nombre: 'Caja electrica generica (contactos+USB)', seccion: 'electrico', precio: 649, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'byrne-interlink', nombre: 'Byrne Interlink iQ (modulo)', seccion: 'electrico', precio: 3012, unidad: 'pza', clase: 'indirecta' }), // SENSIBLE USD/importacion
  ins({ id: 'byrne-phase2', nombre: 'Byrne Phase 2 (caja+contactos)', seccion: 'electrico', precio: 700, unidad: 'pza', clase: 'indirecta' }), // Rogelio 2026-08-14: NO es caja cargada; es caja de contactos Phase 2 (~$700). Confirmar precio exacto con Compras.
  ins({ id: 'byrne-node', nombre: 'Byrne Node (caja USB+luz)', seccion: 'electrico', precio: 1607, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'base-motorizada', nombre: 'Base motorizada altura ajustable (sit-stand)', seccion: 'electrico', precio: 5885, unidad: 'pza', clase: 'indirecta' }), // 3500-12000 segun marca/importacion
  ins({ id: 'contacto', nombre: 'Contacto', seccion: 'electrico', precio: 40.9, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'usb-hdmi', nombre: 'Puerto USB / HDMI', seccion: 'electrico', precio: 350, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'arnes', nombre: 'Arnes', seccion: 'electrico', precio: 440, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'chicote', nombre: 'Chicote', seccion: 'electrico', precio: 34.61, unidad: 'm', clase: 'indirecta' }),
  ins({ id: 'pasacables', nombre: 'Pasacables / grommet', seccion: 'electrico', precio: 6.3, unidad: 'pza', clase: 'indirecta' }),

  // ---- GUARDAS YA ARMADAS (indirecta) ----
  ins({ id: 'pedestal', nombre: 'Pedestal', seccion: 'guardas', precio: 1850, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'archivo-lateral', nombre: 'Archivo lateral', seccion: 'guardas', precio: 4200, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'torre', nombre: 'Torre', seccion: 'guardas', precio: 5600, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'cajonera-movil', nombre: 'Cajonera movil', seccion: 'guardas', precio: 2100, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'credenza', nombre: 'Credenza', seccion: 'guardas', precio: 6500, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'wally', nombre: 'Wally', seccion: 'guardas', precio: 1900, unidad: 'pza', clase: 'indirecta' }),

  // ---- DIVISORES, MAMPARAS Y MUROS ----
  // PET acústico. OJO: Von Haucke NO compra la hoja entera, compra CORTES A
  // MEDIDA ("CORTE DE PANEL ACUSTICO DE PET ... mm"), y el corte se paga. Las 7
  // compras del ERP dan una mediana de $1,051 el m² (rango $1,021 a $1,663), que
  // es justo lo que la app ya tenía. Lo bajé a $546 comparándolo contra el precio
  // de la HOJA y me equivoqué: no es lo que compran.
  ins({ id: 'pet-acustico', nombre: 'PET acustico 9 mm (corte a medida)', seccion: 'mamparas', precio: 1051, clase: 'indirecta',
    articulo: 'CORTE DE PANEL ACUSTICO DE PET (mediana de 7 compras)', fuente: FUENTE_ERP }),
  ins({ id: 'acrilico', nombre: 'Acrilico', seccion: 'mamparas', precio: 949.7, clase: 'indirecta' }),
  ins({ id: 'policarbonato', nombre: 'Policarbonato solido', seccion: 'mamparas', precio: 1012.6, clase: 'indirecta' }), // celular ~186; definir cual
  ins({ id: 'divisor-melamina', nombre: 'Divisor de melamina', seccion: 'mamparas', precio: 665, unidad: 'hoja', formato: TABLERO, fraccion: true, mermaCorte: 6 }),
  ins({ id: 'bastidor-mampara', nombre: 'Bastidor de mampara', seccion: 'mamparas', precio: 680 }),
  ins({ id: 'frente-tela', nombre: 'Frente de tela', seccion: 'mamparas', precio: 420 }),
  ins({ id: 'frente-metal', nombre: 'Frente de metal', seccion: 'mamparas', precio: 153.6 }),
  ins({ id: 'foil-pvc', nombre: 'Foil PVC', seccion: 'mamparas', precio: 290 }),
  ins({ id: 'cristal-templado', nombre: 'Cristal templado 9 mm', seccion: 'mamparas', precio: 1368.5, clase: 'indirecta' }),
  // Cristal templado claro 6 mm. Estaba en $750 el m² — la MITAD de lo que
  // cuesta— y por eso la app lo mostraba más barato que el PET acústico.
  // Rodrigo (2026-08-16): entre $1,350 y $1,800 el m². Se toma el punto medio.
  ins({ id: 'cristal-templado-6', nombre: 'Cristal templado claro 6 mm', seccion: 'mamparas', precio: 1575, clase: 'indirecta',
    articulo: 'Vidrio templado claro 6 mm', fuente: 'Rodrigo, 2026-08-16 (rango $1,350-$1,800 el m2)' }),
  ins({ id: 'cristal-templado-12', nombre: 'Cristal templado 12 mm', seccion: 'mamparas', precio: 2900, clase: 'indirecta' }),
  ins({ id: 'acrilico-6', nombre: 'Acrilico 6 mm', seccion: 'mamparas', precio: 949.7, clase: 'indirecta' }),
  ins({ id: 'acrilico-12', nombre: 'Acrilico 12 mm', seccion: 'mamparas', precio: 1200, clase: 'indirecta' }),
  ins({ id: 'cristal-flotado', nombre: 'Cristal flotado', seccion: 'mamparas', precio: 492.2, clase: 'indirecta' }),
  ins({ id: 'remate-aluminio', nombre: 'Remate de aluminio', seccion: 'mamparas', precio: 24.6, unidad: 'm', formato: TRAMO6, mermaCorte: 5 }),
  ins({ id: 'silicon', nombre: 'Silicon', seccion: 'mamparas', precio: 180, unidad: 'pza', clase: 'indirecta' }),

  // ---- HERRAJES (indirecta) ----
  ins({ id: 'corredera', nombre: 'Corredera 16"', seccion: 'herrajes', precio: 70, unidad: 'juego', clase: 'indirecta', articulo: 'Corredera para mueble metalico de 16"', fuente: FUENTE_COMPRAS }),
  ins({ id: 'bisagra', nombre: 'Bisagra', seccion: 'herrajes', precio: 19, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'jaladera', nombre: 'Jaladera', seccion: 'herrajes', precio: 37.9, unidad: 'pza', clase: 'indirecta' }),
  // --- De la lista de Compras del 2026-08-14 que la app no tenía ------------
  // Dos vienen en DÓLARES. Se guardan en su moneda y el motor los convierte con
  // el tipo de cambio de los parámetros: capturarlos como pesos los volvía
  // ~20 veces más baratos y nadie lo habría notado.
  ins({ id: 'pintura-polvo', nombre: 'Pintura en polvo A101 basic white', seccion: 'acabados', precio: 6.69, moneda: 'USD', unidad: 'kg', clase: 'indirecta', articulo: 'Pintura en polvo A101 basic white', fuente: FUENTE_COMPRAS }),
  ins({ id: 'caja-byrne', nombre: 'Caja electrica Byrne 4 puertos', seccion: 'electrico', precio: 167, moneda: 'USD', unidad: 'pza', clase: 'indirecta', articulo: 'Caja electrica byrne CON 4 PUERTOS', fuente: FUENTE_COMPRAS }),
  ins({ id: 'caja-lisboa', nombre: 'Caja electrica LISBOA lumbro', seccion: 'electrico', precio: 1290, unidad: 'pza', clase: 'indirecta', articulo: 'Caja electrica modelo LISBOA lumbro', fuente: FUENTE_COMPRAS }),
  // El papel lo cotiza por PIEZA ($440), y la pieza de PTR es un tramo de 6 m.
  // Aquí va POR METRO como los demás tubos: dos convenciones distintas para el
  // mismo material es justo como se cuela un error de unidad.
  ins({ id: 'ptr-3-14', nombre: 'PTR 3" x 1 1/2" cal. 14', seccion: 'metal', precio: 73.33, unidad: 'm', formato: TRAMO6, mermaCorte: 6, articulo: 'PTR 3 x 1 1/2 cal. 14 ($440 el tramo de 6 m)', fuente: FUENTE_COMPRAS }),
  // Cubre cantos GRUESOS (2 mm) de la lista de Compras. Se agregan aparte del
  // tapacanto delgado que ya existía: son materiales distintos, no el mismo
  // con otro precio. Cuál usa cada línea lo tiene que decir Rodrigo.
  ins({ id: 'cubrecanto-22', nombre: 'Cubre canto blanco 22 x 2 mm', seccion: 'cubiertas', precio: 13.24, unidad: 'm', formato: ROLLO150, mermaCorte: 4, inventario: true, articulo: 'Cubre canto blanco de 22 x 2', fuente: FUENTE_COMPRAS }),
  ins({ id: 'cubrecanto-32', nombre: 'Cubre canto blanco 32 x 2 mm', seccion: 'cubiertas', precio: 19.68, unidad: 'm', formato: ROLLO100, mermaCorte: 4, inventario: true, articulo: 'Cubre canto blanco de 32 x 2', fuente: FUENTE_COMPRAS }),
  ins({ id: 'nivelador', nombre: 'Nivelador conico cromado 3/8', seccion: 'herrajes', precio: 17.73, unidad: 'pza', clase: 'indirecta', articulo: 'Nivelador 3/8 x 1 1/2 plataforma conica 2 x 5/8 cromado', fuente: FUENTE_COMPRAS }),
  ins({ id: 'rodaja', nombre: 'Rodaja', seccion: 'herrajes', precio: 78, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'cerradura', nombre: 'Cerradura', seccion: 'herrajes', precio: 120, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'cerradura-electronica', nombre: 'Cerradura electronica (StealthLock)', seccion: 'herrajes', precio: 2835, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'riel', nombre: 'Riel', seccion: 'herrajes', precio: 1250, unidad: 'juego', clase: 'indirecta' }),
  ins({ id: 'escuadra', nombre: 'Escuadra', seccion: 'herrajes', precio: 28, unidad: 'pza', clase: 'indirecta' }),
  ins({ id: 'tornilleria', nombre: 'Tornilleria', seccion: 'herrajes', precio: 45, unidad: 'juego', clase: 'indirecta' }),

  // ---- TAPICERIA (directa) ----
  ins({ id: 'bastidor-madera', nombre: 'Bastidor de madera', seccion: 'tapiceria', precio: 900, unidad: 'pza' }),
  ins({ id: 'espuma-termoformada', nombre: 'Espuma termoformada', seccion: 'tapiceria', precio: 329, unidad: 'pza' }),
  ins({ id: 'espuma', nombre: 'Espuma (5cm D30)', seccion: 'tapiceria', precio: 396.8 }),                 // depende densidad
  ins({ id: 'tela', nombre: 'Tela', seccion: 'tapiceria', precio: 95, unidad: 'm' }),
  ins({ id: 'ecopiel', nombre: 'Ecopiel / vinipiel', seccion: 'tapiceria', precio: 90, unidad: 'm' }),
  ins({ id: 'piel-napa', nombre: 'Piel napa', seccion: 'tapiceria', precio: 550 }),                     // por m2, INCIERTO
  ins({ id: 'nogal', nombre: 'Nogal', seccion: 'tapiceria', precio: 345.05, unidad: 'pie_tab' }),

  // ---- ACABADOS Y PINTURA (directa - horno propio) ----
  ins({ id: 'pintura-electrostatica', nombre: 'Pintura electrostatica', seccion: 'acabados', precio: 100 }),  // confirmar maquila
  ins({ id: 'ecocrom', nombre: 'EcoCrom', seccion: 'acabados', precio: 180 }),
  ins({ id: 'barniz', nombre: 'Barniz', seccion: 'acabados', precio: 70 }),
  ins({ id: 'granallado', nombre: 'Granallado', seccion: 'acabados', precio: 55 }),
  ins({ id: 'anodizado', nombre: 'Anodizado', seccion: 'acabados', precio: 45, unidad: 'm' }),
  ins({ id: 'acab-satinado', nombre: 'Acabado satinado (cristal)', seccion: 'acabados', precio: 120 }),
  ins({ id: 'serigrafia', nombre: 'Serigrafia (cristal)', seccion: 'acabados', precio: 150 }),
];

// Etiquetas legibles de cada seccion (5.2)
export const SECCIONES = [
  { id: 'cubiertas', nombre: 'Cubiertas y frentes' },
  { id: 'metal', nombre: 'Estructura metalica' },
  { id: 'electrico', nombre: 'Cableado y energia' },
  { id: 'guardas', nombre: 'Guardas ya armadas' },
  { id: 'mamparas', nombre: 'Divisores, mamparas y muros' },
  { id: 'herrajes', nombre: 'Herrajes' },
  { id: 'tapiceria', nombre: 'Tapiceria' },
  { id: 'acabados', nombre: 'Acabados y pintura' },
];

// Mapa id -> insumo, util para el motor
export function mapaInsumos(lista) {
  const m = {};
  for (const i of lista) m[i.id] = i;
  return m;
}
