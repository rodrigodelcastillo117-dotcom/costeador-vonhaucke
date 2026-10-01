// ============================================================================
//  DATOS SEMILLA - Insumos (master 8.6, 5.1, 5.2, 6.3)
// ----------------------------------------------------------------------------
//  Precios CALIBRADOS 2026-08-13 a ULTIMA COMPRA real del ERP Von Haucke (archivo
//  'Costos de Materia Prima Ultima Compra al 10082026'). Cristales +15%.
//  NO son precios reales de proveedor Von Haucke: se sustituyen con los reales
//  en la pantalla Precios sin tocar codigo. Marcados los inciertos con nota.
//  clase directa/indirecta segun 6.3. Von Haucke NO usa cromo: usa EcoCrom.
// ============================================================================

// acabados.js NO importa de aquí (evita un ciclo que Vitest no resuelve bien
// en cuanto hay más de un punto de entrada al grafo) — arma sus insumos con
// la misma forma que producen tablero()/ins(), documentado ahí mismo.
import { insumosDeAcabadosMelamina, insumosDeAcabadosPintura } from './acabados.js';

const HOY = '2026-08-12';

// De dónde salió el precio. Sin esto, un número en la app no se puede volver a
// comprobar: la calibración se hace a mano una vez y nadie sabe contra qué.
// `articulo` es el nombre EXACTO con el que Compras o el ERP lo llaman, que es
// lo que permite recalibrar solo la próxima vez.
export const FUENTE_COMPRAS = 'Compras, lista del 2026-08-14';
export const FUENTE_ERP = 'ERP, ultima compra';
export const FUENTE_SONARA = 'Lista_de_precios_Sonara_2025 (Rafa Carranza, 2026-08-24) — precio de lista, mas IVA, sin empaque/envio';
// T.D.C. real de la banca doble Aeropuerto CDMX (C-CO-510R), Rafa 2026-09-24.
// Fuente de items de metal/electrico que el catalogo no tenia. La UNIDAD de los
// tubos de 4" se tomo como en el T.D.C. (consumo x precio); confirmar con Rafa
// el formato de compra real (tramo/metro) antes de usarlos en volumen.
export const FUENTE_TDC_BANCA = 'T.D.C. banca C-CO-510R (Aeropuerto CDMX), Rafa 2026-09-24';
// Explosivo real de Alba (area de estimaciones): T.D.C. "ejemplo bench sencillo
// con guardas", hoja (Explo_MP). Es un solo color/lote (IVORY b717/c717,
// compras entre 2025-12 y 2026-04) — NO el promedio anual por color que pide
// su propia regla de sourcing (falta esa serie completa, la tiene Compras).
export const FUENTE_ALBA_TDC = 'T.D.C. de Alba (Explo_MP), verificado 2026-08-18 — un lote, no promedio anual';
// Materiales reales del Exhibidor Alpura (retail), de la T.D.C. C-CO-517R que
// mandó Rafa (Explo_MP, costo_última_compra del ERP). Precios de REFERENCIA de
// esa T.D.C. para reproducir su costeo al centavo; cuando Compras dé precios más
// frescos se actualizan marcándolo como corrida de actualización.
export const FUENTE_TDC_ALPURA = 'T.D.C. Exhibidor Alpura C-CO-517R (Rafa/Alba, 2026-09-22) — costo última compra ERP';

// Atajo para no repetir campos. Exportado: lo reusa acabados.js para generar
// insumos de color con la misma forma exacta que estos, sin duplicar la logica.
export function ins(o) {
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
export function tablero(o) {
  return ins({ seccion: 'cubiertas', unidad: 'hoja', formato: TABLERO, fraccion: true, mermaCorte: 6, ...o });
}

// Formatos de compra (8.6)
const TABLERO = { tipo: 'tablero', nombre: 'tablero 1.22 x 2.44', corto: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
// LAMINA: 'medida' EN KG por hoja. Las líneas (Río, Cirque, Drift, Ergo4,
// Accents, Feather, Flex) la consumen con cantidad en kg. En el Costeador
// manual, Rafa la captura por FRACCION DE HOJA directa (comp.hojas), no en kg
// ni por Largo x Ancho — ver netoComponente()/comprarInsumo() y la decisión
// Rafa §1 (2026-09-23).
const LAMINA18 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 28.4 };
const LAMINA20 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 21.3 };
const LAMINA22 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 17.7 };
// Calibres mas gruesos, pedidos en levantamiento Rafa §1.
const LAMINA14 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 44.4 };
const LAMINA12 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 62.2 };
const LAMINA10 = { tipo: 'lamina', nombre: 'lamina 1.22 x 2.44', corto: 'lamina', medida: 79.9 };
// Lámina formato 3' x 10' (retail/exhibidores, T.D.C. Alpura): se compra y costea
// por HOJA, con fracción de hoja directa. `medida` = KG por hoja (igual que las
// láminas 4x8), por calibre: el área 3x10 (2.787 m²) × el peso/m² de cada calibre
// (de las láminas existentes: cal20 7.16, cal14 14.9, cal12 20.9 kg/m²).
const LAMINA3X10_20 = { tipo: 'lamina', nombre: 'lamina 3 x 10 ft', corto: '3x10', medida: 19.95, largoMM: 3048, anchoMM: 914 };
const LAMINA3X10_14 = { tipo: 'lamina', nombre: 'lamina 3 x 10 ft', corto: '3x10', medida: 41.5, largoMM: 3048, anchoMM: 914 };
const LAMINA3X10_12 = { tipo: 'lamina', nombre: 'lamina 3 x 10 ft', corto: '3x10', medida: 58.3, largoMM: 3048, anchoMM: 914 };
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
  // ⚠️ Este precio es el de WALNUT (opción B709), NO un "generico cualquier
  // color": confirmado 2026-08-18 contra 'Costos de Materia Prima Ultima
  // Compra al 10082026.xlsx' (Luis Daniel) — ese archivo trae Opción/Opción
  // Descripción por color, y B709 WALNUT es la que dio $1335.6 el 2026-08-07.
  // El archivo tiene 80+ colores de esta MISMA hoja (MVLMAG01280800); usar uno
  // solo como "el" precio de melamina-28 es arbitrario mientras la app no
  // pida color. Queda así porque cambiarlo afecta a Alba/Cirque/Ergo4/Pebble/
  // Privacy4/Rio/Spine/Via a la vez — no se toca sin decidirlo aparte.
  tablero({ id: 'melamina-28', nombre: 'Melamina ABS 28 mm (cubierta APP LT)', precio: 1335.6,
    articulo: 'MVLMAG01280800 AGLOMERADO MELAMINA DOS CARAS, opcion B709 WALNUT', fuente: FUENTE_ERP }),
  // ⚠️ 2026-08-18: el insumo manual 'melamina-28-ivory' que vivía aquí (mismo
  // precio, $1122.30) ahora lo genera `acabados.js` (catálogo completo de
  // colores, 81 en melamina + 18 en pintura, del mismo archivo de Luis
  // Daniel) — ver `insumosDeAcabadosMelamina()` más abajo. No se repite aquí.
  // Perfil de canto de aluminio (App LT: cubierta "CON TAPA REGISTRABLE
  // METALICA" trae este perfil, no el tapacanto PVC generico). $/m real del
  // explosivo de Alba.
  ins({ id: 'perfil-canto-applt', nombre: 'Perfil de canto aluminio (App LT)', seccion: 'cubiertas',
    precio: 15.12, unidad: 'm', formato: ROLLO100, mermaCorte: 4, inventario: true,
    articulo: 'MVLPPC00501505 PERFIL DE CANTO ANCHO 32mm', fuente: FUENTE_ALBA_TDC }),
  // Bundle fijo por cubierta App LT: la tapa registrable metalica (2 piezas
  // de lamina negra + pintura) + chapacinta del borde de la tapa + su
  // tornilleria. No escala con el tamaño de la cubierta (es un herraje de
  // acceso a cableado, no material de superficie) — del explosivo de Alba:
  // 9.43+3.09+1.2 (lamina+pintura) + 5.46 (chapacinta) + 1.16+0.68+1.78
  // (pija+rondana+tornillo) = 22.80.
  ins({ id: 'tapa-registrable-applt', nombre: 'Tapa registrable metalica + herraje (App LT)', seccion: 'cubiertas',
    precio: 22.80, unidad: 'pza', clase: 'directa',
    articulo: 'Bundle: 2x LAMINA NEGRA + PINTURA + CHAPACINTA + PIJA/RONDANA/TORNILLO', fuente: FUENTE_ALBA_TDC }),
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
  tablero({ id: 'laminado', nombre: 'Laminado plastico / Ecolegno (HPL)', precio: 405.6,
    articulo: 'LAMINADO PLASTICO MARKET GRADE ACABADO BLANCO 4x8', fuente: FUENTE_ERP }),   // = base blanco 2026-07-03 ($405.6); colores premium (Navy, etc.) $680-$920

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
  ins({ id: 'curvado', nombre: 'Trabajo extra por ser curvo (por metro)', seccion: 'cubiertas', precio: 80, unidad: 'm', clase: 'directa', nota: 'Operación, no material. Calibrado, no medido: falta orden de producción de Río.' }),

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
  // Tubos estructurales de 4" (T.D.C. banca aeropuerto): el catalogo no los
  // tenia y las piezas de metal custom los usan. Se capturan por CONSUMO como
  // en el T.D.C. (0.333 x $1,020). unidad 'tramo' sin formato = costo directo
  // consumo x precio; confirmar formato de compra real con Rafa.
  ins({ id: 'ptr-redondo-4', nombre: 'Tubo redondo 4" cal. 14', seccion: 'metal', precio: 1020, unidad: 'tramo', articulo: 'Tubular redondo acero al carbon 4" cal 14', fuente: FUENTE_TDC_BANCA }),
  ins({ id: 'ptr-cuadrado-4', nombre: 'Perfil cuadrado 4" cal. 14', seccion: 'metal', precio: 1400, unidad: 'tramo', articulo: 'Perfil cuadrado acero al carbon 4" cal 14', fuente: FUENTE_TDC_BANCA }),
  ins({ id: 'multicontactos-bari', nombre: 'Multicontactos modelo Bari', seccion: 'electrico', precio: 887, unidad: 'pza', clase: 'indirecta', articulo: 'Multicontactos Bari (2 pzas en la banca doble)', fuente: FUENTE_TDC_BANCA }),
  ins({ id: 'pegado-chapa', nombre: 'Pegado de chapa (operación)', seccion: 'cubiertas', precio: 300, unidad: 'op', clase: 'directa', articulo: 'Pegado de chapa por pieza', fuente: FUENTE_TDC_BANCA }),
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

  // ---- ACABADOS POR COLOR (melamina + pintura, catalogo real) ----
  // 2026-08-18: 81 colores de melamina + 18 de pintura, del mismo archivo del
  // ERP que calibro los precios de arriba, filtrados a compra en los ultimos
  // 2 anios. Ver src/datos/acabados.js — ahi vive el dato, aqui solo se suma.
  ...insumosDeAcabadosMelamina(),
  ...insumosDeAcabadosPintura(),

  // ---- ECOACUSTIC (paneles de fieltro PET, Sonara) ----
  // Von Haucke NO fabrica este panel: lo COMPRA ya terminado por SKU/tamaño a
  // Sonara y solo agrega instalación/herrajes. El precio es el de lista de
  // Sonara (más IVA, sin empaque/envío — se cotiza aparte por proyecto).
  // Fuente: "Lista_de_precios_Sonara_2025" (Rafa Carranza, 2026-08-24).
  ins({ id: 'eco-panel-liso-9', nombre: 'EcoAcustic Panel liso sin corte 9 mm (1.22×2.44 m)', seccion: 'ecoacustic', precio: 1880, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-panel-liso-12', nombre: 'EcoAcustic Panel liso sin corte 12 mm (solo Gris/Gris Espacial/Gris Plateado)', seccion: 'ecoacustic', precio: 2570, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-corte-linea-9', nombre: 'EcoAcustic Panel con corte de línea 9 mm (Mamparas/Celosía/U/V)', seccion: 'ecoacustic', precio: 2935, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-corte-linea-12', nombre: 'EcoAcustic Panel con corte de línea 12 mm (solo Negro/Gris/Gris Espacial/Gris Plateado)', seccion: 'ecoacustic', precio: 3725, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-shapes-30', nombre: 'EcoAcustic Shapes 30 cm (paquete 4: hexágono/triángulo/cuadrado/círculo)', seccion: 'ecoacustic', precio: 370, unidad: 'paquete', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-shapes-60', nombre: 'EcoAcustic Shapes 60 cm (paquete 4: hexágono/triángulo/cuadrado/círculo)', seccion: 'ecoacustic', precio: 1465, unidad: 'paquete', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-shapes-rect-30', nombre: 'EcoAcustic Shapes rectángulo 1.20×0.30 m (paquete de 4)', seccion: 'ecoacustic', precio: 1465, unidad: 'paquete', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-shapes-rect-60', nombre: 'EcoAcustic Shapes rectángulo 1.20×0.60 m (paquete de 4)', seccion: 'ecoacustic', precio: 2935, unidad: 'paquete', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-custom-a-9', nombre: 'EcoAcustic Custom grado A, 9 mm', seccion: 'ecoacustic', precio: 3355, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-custom-a-12', nombre: 'EcoAcustic Custom grado A, 12 mm (solo Gris/Gris Espacial/Gris Plateado)', seccion: 'ecoacustic', precio: 4145, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-custom-b-9', nombre: 'EcoAcustic Custom grado B, 9 mm', seccion: 'ecoacustic', precio: 3920, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-custom-b-12', nombre: 'EcoAcustic Custom grado B, 12 mm (solo Gris/Gris Espacial/Gris Plateado)', seccion: 'ecoacustic', precio: 4670, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-custom-c-9', nombre: 'EcoAcustic Custom grado C, 9 mm', seccion: 'ecoacustic', precio: 4700, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-custom-d-9', nombre: 'EcoAcustic Custom grado D, 9 mm', seccion: 'ecoacustic', precio: 5875, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-flex', nombre: 'EcoAcustic Flex (por m², solo Negro/Camello/Gris/Gris Espacial/Gris Plateado)', seccion: 'ecoacustic', precio: 450, unidad: 'm2', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-flex-corte', nombre: 'EcoAcustic Flex con corte (por m², mismos colores)', seccion: 'ecoacustic', precio: 780, unidad: 'm2', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-lambrin', nombre: 'EcoAcustic Lambrín 1.20×2.40 m (tiras MDF + chapa fórmica)', seccion: 'ecoacustic', precio: 4685, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-ranurado-v', nombre: 'EcoAcustic Panel doble ranurado en V, cortes de línea', seccion: 'ecoacustic', precio: 4815, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-impreso', nombre: 'EcoAcustic Panel impreso 1.20×2.40 m, 9 mm', seccion: 'ecoacustic', precio: 3500, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-impreso-corte', nombre: 'EcoAcustic Panel impreso con corte recto', seccion: 'ecoacustic', precio: 3825, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-susp-sacc003-120', nombre: 'EcoAcustic Panel suspendido SACC003, Ø1.20 m (sin herrajes)', seccion: 'ecoacustic', precio: 2935, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-susp-sacc003-240', nombre: 'EcoAcustic Panel suspendido SACC003, Ø2.40 m (sin herrajes)', seccion: 'ecoacustic', precio: 5870, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-susp-sacc004-120', nombre: 'EcoAcustic Panel suspendido SACC004, 1.20×1.20 m (sin herrajes)', seccion: 'ecoacustic', precio: 2935, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-susp-sacc004-240', nombre: 'EcoAcustic Panel suspendido SACC004, 2.40×2.40 m (sin herrajes)', seccion: 'ecoacustic', precio: 8805, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-susp-sacc005-120', nombre: 'EcoAcustic Panel suspendido SACC005, 1.20×1.20 m (sin herrajes)', seccion: 'ecoacustic', precio: 2935, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-susp-sacc005-240', nombre: 'EcoAcustic Panel suspendido SACC005, 2.40×2.40 m (sin herrajes)', seccion: 'ecoacustic', precio: 8805, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-susp-sacc006', nombre: 'EcoAcustic Panel suspendido SACC006, 8 tiras 1.20×0.30 m (sin herrajes)', seccion: 'ecoacustic', precio: 2935, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),
  ins({ id: 'eco-herraje-colgante', nombre: 'EcoAcustic Herraje de sujeción a techo (horizontal o vertical)', seccion: 'ecoacustic', precio: 245, unidad: 'pza', clase: 'indirecta', fuente: FUENTE_SONARA }),

  // ---- RETAIL / EXHIBIDORES (T.D.C. Alpura C-CO-517R, Rafa/Alba) ---------------
  // Materiales reales de exhibidores de piso, con su precio de última compra del
  // ERP. Se agregan APARTE de los de oficina/línea (no los tocan) para que la IA
  // tenga a qué mapear un plano retail y el costo cuadre con la T.D.C. real.
  // MDF melamina DOS caras con laminado nogal (Walnut) — distinto del MDF natural.
  tablero({ id: 'mdf-16-walnut', nombre: 'MDF melamina 2 caras 16 mm Walnut (nogal)', precio: 693.9,
    articulo: 'MVLMMD01280500 MDF MELAMINA DOS CARAS 4x8 16 mm, opcion B709 WALNUT', fuente: FUENTE_TDC_ALPURA }),
  tablero({ id: 'mdf-25-walnut', nombre: 'MDF melamina 2 caras 25 mm Walnut (nogal)', precio: 1250,
    articulo: 'MVLMMD01280700 MDF MELAMINA DOS CARAS 4x8 25 mm, opcion B709 WALNUT', fuente: FUENTE_TDC_ALPURA }),
  tablero({ id: 'laminado-walnut', nombre: 'Laminado plastico 4x8 Walnut (nogal)', precio: 641.59,
    articulo: 'MVLMLP00280000 LAMINADO PLASTICO 4x8, opcion B709 WALNUT', fuente: FUENTE_TDC_ALPURA }),
  // Acrilico FABRICADO (se corta y trabaja): material al 20%, no el 1% del vidrio.
  ins({ id: 'acrilico-cristal-3', nombre: 'Acrilico cristal 3 mm (hoja 4x6)', seccion: 'mamparas', unidad: 'hoja', fraccion: true, mermaCorte: 6, precio: 900,
    articulo: 'MLEPAC00711600 ACRILICO CRISTAL 4x6 3 mm', fuente: FUENTE_TDC_ALPURA }),
  ins({ id: 'acrilico-traslucido-3', nombre: 'Acrilico traslucido 3 mm (hoja 4x8)', seccion: 'mamparas', unidad: 'hoja', fraccion: true, mermaCorte: 6, precio: 964,
    articulo: 'MLEPAT00641600 ACRILICO TRASLUCIDO Z2 4x8 3 mm', fuente: FUENTE_TDC_ALPURA }),
  // Perfil de canto ABS (distinto del tapacanto delgado y del perfil de aluminio).
  ins({ id: 'canto-abs-22', nombre: 'Perfil de canto ABS 22 mm Walnut', seccion: 'cubiertas', unidad: 'm', formato: ROLLO100, mermaCorte: 4, inventario: true, precio: 20.64,
    articulo: 'MVLPPC00491505 PERFIL DE CANTO ABS 22 x 2 mm', fuente: FUENTE_TDC_ALPURA }),
  ins({ id: 'canto-abs-32', nombre: 'Perfil de canto ABS 32 mm Walnut', seccion: 'cubiertas', unidad: 'm', formato: ROLLO100, mermaCorte: 4, inventario: true, precio: 22.58,
    articulo: 'MVLPPC00501505 PERFIL DE CANTO ABS 32 x 2 mm', fuente: FUENTE_TDC_ALPURA }),
  // Tubos estructurales por fraccion de tramo de 6 m (como ptr-redondo-4).
  ins({ id: 'tubular-redondo-34', nombre: 'Tubular redondo 3/4" cal. 18 (tramo 6 m)', seccion: 'metal', unidad: 'tramo', precio: 138.4,
    articulo: 'MVLSTU02060401 TUBULAR REDONDO 3/4 cal 18, 6000 mm', fuente: FUENTE_TDC_ALPURA }),
  ins({ id: 'pulido-redondo-14', nombre: 'Pulido redondo 1/4" (tramo 6 m)', seccion: 'metal', unidad: 'tramo', precio: 30.25,
    articulo: 'MVLSPU02030001 PULIDO REDONDO 1/4, 6000 mm', fuente: FUENTE_TDC_ALPURA }),
  // Láminas formato 3x10 (retail): precio POR HOJA, costeo por fracción de hoja.
  ins({ id: 'lamina-3x10-20', nombre: 'Lamina negra 3x10 cal. 20', seccion: 'metal', unidad: 'hoja', formato: LAMINA3X10_20, fraccion: true, mermaCorte: 8, precio: 449.06,
    articulo: 'MVLSLA05260502 LAMINA NEGRA 3x10 cal 20 acero 1008', fuente: FUENTE_TDC_ALPURA }),
  ins({ id: 'lamina-3x10-14', nombre: 'Lamina negra 3x10 cal. 14', seccion: 'metal', unidad: 'hoja', formato: LAMINA3X10_14, fraccion: true, mermaCorte: 8, precio: 849.5,
    articulo: 'MVLSLA05260202 LAMINA NEGRA 3x10 cal 14 acero 1008', fuente: FUENTE_TDC_ALPURA }),
  ins({ id: 'lamina-3x10-12', nombre: 'Lamina negra 3x10 cal. 12', seccion: 'metal', unidad: 'hoja', formato: LAMINA3X10_12, fraccion: true, mermaCorte: 8, precio: 1116.28,
    articulo: 'MVLSLA05261002 LAMINA NEGRA 3x10 cal 12 acero 1008', fuente: FUENTE_TDC_ALPURA }),
  // Pintura en polvo NEGRO mate (la que ya existe es blanca, en USD).
  ins({ id: 'pintura-polvo-negro', nombre: 'Pintura en polvo negro mate 8 (Vitracoat)', seccion: 'acabados', unidad: 'kg', clase: 'indirecta', precio: 120.68,
    articulo: 'MVLQPP00000000 PINTURA EN POLVO negro mate 8 Vitracoat', fuente: FUENTE_TDC_ALPURA }),
  // Nivelador grande del exhibidor (distinto del conico 3/8 chico que ya existe).
  ins({ id: 'nivelador-plataforma', nombre: 'Tornillo nivelador 3/8 plataforma 1 1/2" cromado', seccion: 'herrajes', unidad: 'pza', clase: 'indirecta', precio: 41.63,
    articulo: 'MVLUTO15181009 TORNILLO NIVELADOR 3/8 x 1 1/2 plataforma cromado', fuente: FUENTE_TDC_ALPURA }),

  // ---- GRAFICOS E ILUMINACION (comprado ya hecho = compra-venta, MO 1% / GI 5%) -
  // Son el "id_02 compra-venta" de la T.D.C.: no llevan mano de obra de fabricacion.
  ins({ id: 'kit-led-5000k', nombre: 'Kit iluminacion LED 5000 K (tiras + fuente + arnes)', seccion: 'graficos', unidad: 'pza', clase: 'indirecta', precio: 3200,
    articulo: 'MDMEKT01000032 KIT DE ILUMINACION LED 5000 K con arnes, fuente y clavija', fuente: FUENTE_TDC_ALPURA }),
  ins({ id: 'logo-acrilico-iluminado', nombre: 'Logotipo acrilico iluminado con perfil de aluminio', seccion: 'graficos', unidad: 'pza', clase: 'indirecta', precio: 900,
    articulo: 'MDMPLO03030003 LOGOTIPO acrilico blanco con perfil aluminio', fuente: FUENTE_TDC_ALPURA }),
  ins({ id: 'impresion-estireno-g', nombre: 'Impresion en estireno cal 20 con arte (grande)', seccion: 'graficos', unidad: 'pza', clase: 'indirecta', precio: 348,
    articulo: 'MDMPIM01020101 IMPRESION EN ESTIRENO 1640 x 375 cal 20', fuente: FUENTE_TDC_ALPURA }),
  ins({ id: 'impresion-estireno-ch', nombre: 'Impresion en estireno cal 20 con arte (chica)', seccion: 'graficos', unidad: 'pza', clase: 'indirecta', precio: 172,
    articulo: 'MDMPIM01010101 IMPRESION EN ESTIRENO 1100 x 230 cal 20', fuente: FUENTE_TDC_ALPURA }),
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
  { id: 'ecoacustic', nombre: 'EcoAcustic (paneles Sonara)' },
  { id: 'graficos', nombre: 'Graficos e iluminacion (retail)' },
];

// Mapa id -> insumo, util para el motor
export function mapaInsumos(lista) {
  const m = {};
  for (const i of lista) m[i.id] = i;
  return m;
}
