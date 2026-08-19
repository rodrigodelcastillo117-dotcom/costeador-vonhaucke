// ============================================================================
//  CATALOGO DE ACABADOS — colores reales de melamina y pintura en polvo, del
//  ERP Von Haucke ('Costos de Materia Prima Ultima Compra al 10082026.xlsx',
//  confirmado por Luis Daniel, 2026-08-18). Filtro: compra en los ULTIMOS 2
//  AÑOS y NO descontinuado — son los colores que de verdad se pueden pedir hoy.
//  El mismo archivo trae MDF y laminado plastico, pero ahi cada combinacion de
//  acabado es su PROPIO articulo unico (no "articulo base + color" como la
//  melamina), y la mayoria sin ninguna compra registrada. Meterlos aqui hubiera
//  sido fabricar datos — quedan pendientes para una pasada aparte.
//  Ver memoria costeador-formula-alba / costeador-precios-erp.
// ============================================================================
// Sin import de insumos.js A PROPOSITO: Vitest no resuelve bien el ciclo
// insumos.js <-> acabados.js en cuanto hay mas de un punto de entrada al
// grafo (ej. un test que importa applt.js, que importa este archivo). Se
// arman los insumos aqui mismo, con la MISMA forma exacta que ins()/tablero()
// producen en insumos.js — visible mas abajo, junto a donde se usa.
const TABLERO = { tipo: 'tablero', nombre: 'tablero 1.22 x 2.44', corto: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
const HOY = '2026-08-18';

// Melamina dos caras (aglomerado), por espesor en mm. Mismo patron
// articulo-base + color del ERP: MVLMAG01280400(12mm)/0500(16)/0600(19)/0800(28).
export const MELAMINA_POR_ESPESOR = {
  12: [
    { id: 'antracita-light-tx', label: 'Antracita Light TX', precio: 739.8, fecha: '2025-06-17', codigo: 'B761' },
    { id: 'fresno-bruma-tx', label: 'Fresno Bruma TX', precio: 575.0, fecha: '2026-02-09', codigo: 'B807' },
  ],
  16: [
    { id: 'antracita-light', label: 'Antracita Light', precio: 608.76, fecha: '2025-07-30', codigo: 'B799' },
    { id: 'antracita-light-tx', label: 'Antracita Light TX', precio: 694.8, fecha: '2026-07-07', codigo: 'B761' },
    { id: 'antracite-oak', label: 'Antracite Oak', precio: 822.6, fecha: '2026-06-25', codigo: 'B713' },
    { id: 'antracite-oak-tx', label: 'Antracite Oak TX', precio: 694.8, fecha: '2026-06-25', codigo: 'B747' },
    { id: 'black', label: 'Black', precio: 576.72, fecha: '2025-09-17', codigo: 'B721' },
    { id: 'blanco-absoluto', label: 'Blanco Absoluto', precio: 449.0, fecha: '2026-07-06', codigo: 'B809' },
    { id: 'durango-tx', label: 'Durango TX', precio: 646.0, fecha: '2026-02-06', codigo: 'B835' },
    { id: 'ebano-indi', label: 'Ebano Indi', precio: 646.0, fecha: '2025-09-22', codigo: 'B1096' },
    { id: 'encino-polar-tx', label: 'Encino Polar TX', precio: 685.0, fecha: '2026-07-28', codigo: 'B1054' },
    { id: 'fresno-bruma-tx', label: 'Fresno Bruma TX', precio: 646.0, fecha: '2026-02-09', codigo: 'B807' },
    { id: 'frosty-white', label: 'Frosty White', precio: 413.0, fecha: '2026-03-24', codigo: 'B744' },
    { id: 'ivory', label: 'Ivory', precio: 695.7, fecha: '2026-02-20', codigo: 'B717' },
    { id: 'ivory-new', label: 'Ivory New', precio: 788.4, fecha: '2025-04-07', codigo: 'B751' },
    { id: 'ivory-vanyla', label: 'Ivory Vanyla', precio: 774.9, fecha: '2026-04-29', codigo: 'B838' },
    { id: 'latte-tx', label: 'Latte TX', precio: 685.0, fecha: '2026-07-22', codigo: 'B837' },
    { id: 'light-ash-lp', label: 'Light Ash LP', precio: 645.0, fecha: '2025-09-09', codigo: 'B770' },
    { id: 'maple-fire', label: 'Maple Fire', precio: 740.7, fecha: '2025-10-08', codigo: 'B1094' },
    { id: 'monarca-tx', label: 'Monarca TX', precio: 685.0, fecha: '2026-06-16', codigo: 'B836' },
    { id: 'nogal-neo-tx', label: 'Nogal Neo TX', precio: 665.0, fecha: '2026-06-04', codigo: 'B805' },
    { id: 'roble-merida-tx', label: 'Roble Merida TX', precio: 685.0, fecha: '2026-08-04', codigo: 'B806' },
    { id: 'sand', label: 'Sand', precio: 690.3, fecha: '2024-09-12', codigo: 'B743' },
    { id: 'soft-grey', label: 'Soft Grey', precio: 774.9, fecha: '2026-06-25', codigo: 'B718' },
    { id: 'terracota', label: 'Terracota', precio: 788.4, fecha: '2025-09-24', codigo: 'B839' },
    { id: 'verde-esmeralda', label: 'Verde Esmeralda', precio: 788.4, fecha: '2025-09-24', codigo: 'B840' },
    { id: 'walnut', label: 'Walnut', precio: 608.76, fecha: '2025-07-30', codigo: 'B709' },
    { id: 'white-ash', label: 'White Ash', precio: 681.13, fecha: '2026-07-21', codigo: 'B716' },
    { id: 'white-ash-tx', label: 'White Ash TX', precio: 827.82, fecha: '2025-07-07', codigo: 'B746' },
  ],
  19: [
    { id: 'antracita-light', label: 'Antracita Light', precio: 904.5, fecha: '2025-08-28', codigo: 'B799' },
    { id: 'antracita-light-tx', label: 'Antracita Light TX', precio: 793.8, fecha: '2026-07-07', codigo: 'B761' },
    { id: 'antracite-oak', label: 'Antracite Oak', precio: 936.0, fecha: '2026-06-30', codigo: 'B713' },
    { id: 'antracite-oak-tx', label: 'Antracite Oak TX', precio: 793.8, fecha: '2026-06-25', codigo: 'B747' },
    { id: 'black', label: 'Black', precio: 639.91, fecha: '2026-07-02', codigo: 'B721' },
    { id: 'blanco-absoluto', label: 'Blanco Absoluto', precio: 483.0, fecha: '2026-04-15', codigo: 'B809' },
    { id: 'cerezo-au', label: 'Cerezo AU', precio: 677.0, fecha: '2025-12-18', codigo: 'B1093' },
    { id: 'fresno-bruma-tx', label: 'Fresno Bruma TX', precio: 718.0, fecha: '2026-06-16', codigo: 'B807' },
    { id: 'frosty-white', label: 'Frosty White', precio: 544.0, fecha: '2026-07-06', codigo: 'B744' },
    { id: 'gris-humo-lm', label: 'Gris Humo LM', precio: 904.5, fecha: '2025-02-11', codigo: 'B1095' },
    { id: 'ivory', label: 'Ivory', precio: 904.5, fecha: '2025-09-23', codigo: 'B717' },
    { id: 'ivory-new', label: 'Ivory New', precio: 904.5, fecha: '2025-01-07', codigo: 'B751' },
    { id: 'ivory-vanyla', label: 'Ivory Vanyla', precio: 904.5, fecha: '2026-02-24', codigo: 'B838' },
    { id: 'latte-tx', label: 'Latte TX', precio: 718.0, fecha: '2026-07-28', codigo: 'B837' },
    { id: 'light-ash-lp', label: 'Light Ash LP', precio: 644.0, fecha: '2025-06-24', codigo: 'B770' },
    { id: 'monarca-tx', label: 'Monarca TX', precio: 665.0, fecha: '2026-08-10', codigo: 'B836' },
    { id: 'roble-merida-tx', label: 'Roble Merida TX', precio: 718.0, fecha: '2026-08-04', codigo: 'B806' },
    { id: 'sand', label: 'Sand', precio: 792.0, fecha: '2024-09-12', codigo: 'B743' },
    { id: 'soft-grey', label: 'Soft Grey', precio: 778.5, fecha: '2026-07-13', codigo: 'B718' },
    { id: 'verde-esmeralda', label: 'Verde Esmeralda', precio: 904.5, fecha: '2025-12-09', codigo: 'B840' },
    { id: 'walnut', label: 'Walnut', precio: 671.95, fecha: '2025-07-30', codigo: 'B709' },
    { id: 'wengue', label: 'Wengue', precio: 660.0, fecha: '2025-07-23', codigo: 'B712' },
    { id: 'white-ash', label: 'White Ash', precio: 778.5, fecha: '2026-07-02', codigo: 'B716' },
    { id: 'white-ash-tx', label: 'White Ash TX', precio: 949.72, fecha: '2026-01-28', codigo: 'B746' },
  ],
  28: [
    { id: 'antracita-light', label: 'Antracita Light', precio: 995.91, fecha: '2025-08-04', codigo: 'B799' },
    { id: 'antracita-light-tx', label: 'Antracita Light TX', precio: 1295.1, fecha: '2026-07-07', codigo: 'B761' },
    { id: 'antracite-oak', label: 'Antracite Oak', precio: 1269.9, fecha: '2026-06-25', codigo: 'B713' },
    { id: 'antracite-oak-tx', label: 'Antracite Oak TX', precio: 1295.1, fecha: '2026-06-26', codigo: 'B747' },
    { id: 'black', label: 'Black', precio: 1026.9, fecha: '2026-07-09', codigo: 'B721' },
    { id: 'blanco-absoluto', label: 'Blanco Absoluto', precio: 826.0, fecha: '2026-08-04', codigo: 'B809' },
    { id: 'cerezo-au', label: 'Cerezo AU', precio: 1075.0, fecha: '2026-01-23', codigo: 'B1093' },
    { id: 'durango-tx', label: 'Durango TX', precio: 1107.0, fecha: '2026-05-07', codigo: 'B835' },
    { id: 'ebano-indi', label: 'Ebano Indi', precio: 1075.0, fecha: '2025-09-22', codigo: 'B1096' },
    { id: 'encino-polar-tx', label: 'Encino Polar TX', precio: 1140.0, fecha: '2026-08-04', codigo: 'B1054' },
    { id: 'fresno-bruma-tx', label: 'Fresno Bruma TX', precio: 1075.0, fecha: '2026-01-22', codigo: 'B807' },
    { id: 'frosty-white', label: 'Frosty White', precio: 842.0, fecha: '2026-08-04', codigo: 'B744' },
    { id: 'gris-humo-lm', label: 'Gris Humo LM', precio: 1544.05, fecha: '2024-09-10', codigo: 'B1095' },
    { id: 'ivory', label: 'Ivory', precio: 1122.3, fecha: '2026-04-28', codigo: 'B717' },
    { id: 'ivory-new', label: 'Ivory New', precio: 1332.9, fecha: '2025-04-11', codigo: 'B751' },
    { id: 'ivory-vanyla', label: 'Ivory Vanyla', precio: 1269.9, fecha: '2026-07-15', codigo: 'B838' },
    { id: 'latte-tx', label: 'Latte TX', precio: 1140.0, fecha: '2026-07-28', codigo: 'B837' },
    { id: 'light-ash-lp', label: 'Light Ash LP', precio: 1075.0, fecha: '2026-01-21', codigo: 'B770' },
    { id: 'maple-fire', label: 'Maple Fire', precio: 1253.7, fecha: '2026-01-30', codigo: 'B1094' },
    { id: 'monarca-tx', label: 'Monarca TX', precio: 1056.0, fecha: '2026-08-04', codigo: 'B836' },
    { id: 'nogal-neo-tx', label: 'Nogal Neo TX', precio: 1107.0, fecha: '2026-06-04', codigo: 'B805' },
    { id: 'roble-merida-tx', label: 'Roble Merida TX', precio: 1140.0, fecha: '2026-08-04', codigo: 'B806' },
    { id: 'sand', label: 'Sand', precio: 1170.9, fecha: '2024-09-23', codigo: 'B743' },
    { id: 'soft-grey', label: 'Soft Grey', precio: 1269.9, fecha: '2026-07-13', codigo: 'B718' },
    { id: 'verde-esmeralda', label: 'Verde Esmeralda', precio: 1332.9, fecha: '2025-12-04', codigo: 'B840' },
    { id: 'walnut', label: 'Walnut', precio: 1335.6, fecha: '2026-08-07', codigo: 'B709' },
    { id: 'white-ash', label: 'White Ash', precio: 1269.9, fecha: '2026-08-07', codigo: 'B716' },
    { id: 'white-ash-tx', label: 'White Ash TX', precio: 1399.5, fecha: '2026-01-28', codigo: 'B746' },
  ],
};

// Pintura en polvo (metal), articulo MVLQPP00000000 + Opcion de color. No
// varia por espesor: una sola lista.
export const PINTURA_COLORES = [
  { id: 'aluminio-anodizado', label: 'Aluminio Anodizado', precio: 261.21, fecha: '2026-02-10', codigo: 'A108' },
  { id: 'antracita-tx', label: 'Antracita TX', precio: 231.9, fecha: '2026-08-04', codigo: 'A105' },
  { id: 'azul-ral-5010-089-41060', label: 'Azul RAL 5010-089/41060', precio: 301.3, fecha: '2026-07-31', codigo: 'A506' },
  { id: 'basic-white', label: 'Basic White', precio: 115.95, fecha: '2026-08-04', codigo: 'A101' },
  { id: 'black-tx', label: 'Black TX', precio: 107.98, fecha: '2026-08-04', codigo: 'A112' },
  { id: 'blanco-ral-9016-009-13120', label: 'Blanco RAL 9016 009/13120', precio: 239.37, fecha: '2026-07-08', codigo: 'A519' },
  { id: 'charcoal', label: 'Charcoal', precio: 170.47, fecha: '2026-08-07', codigo: 'A118' },
  { id: 'gris-light-gray', label: 'Gris Light Gray', precio: 276.29, fecha: '2025-04-25', codigo: 'A55' },
  { id: 'gris-ral-7036', label: 'Gris RAL 7036', precio: 242.96, fecha: '2024-10-17', codigo: 'A511' },
  { id: 'gris-unido-axalta', label: 'Gris Unido Axalta', precio: 171.1, fecha: '2024-10-09', codigo: 'A547' },
  { id: 'ivory', label: 'Ivory', precio: 168.56, fecha: '2026-02-13', codigo: 'A102' },
  { id: 'negro-mate-45-hnl40205', label: 'Negro Mate 45 HNL40205', precio: 59.37, fecha: '2025-06-16', codigo: 'A542' },
  { id: 'negro-mate-8-vitracoat', label: 'Negro Mate 8 Vitracoat', precio: 120.68, fecha: '2025-12-10', codigo: 'A550' },
  { id: 'pintura-hibrida-pantone-228-c-60-de-brillo', label: 'Hibrida Pantone 228-C 60% brillo', precio: 260.28, fecha: '2025-04-25', codigo: 'A56' },
  { id: 'silver', label: 'Silver', precio: 345.61, fecha: '2026-07-14', codigo: 'A106' },
  { id: 'silver-tx', label: 'Silver TX', precio: 227.37, fecha: '2026-07-27', codigo: 'A107' },
  { id: 'solar-black-44-80060-de-tiger', label: 'Solar Black 44/80060 Tiger', precio: 214.15, fecha: '2025-07-11', codigo: 'A523' },
  { id: 'warm-grey-tx', label: 'Warm Grey TX', precio: 167.84, fecha: '2026-03-18', codigo: 'A104' },
];

// Fuente comun de estos precios: para trazabilidad, no una recalibracion. El
// color IVORY 28mm es el mismo dato que se verifico renglon a renglon contra
// el T.D.C. real de Alba (ver costeador-formula-alba, memoria) — el resto son
// ultima compra del ERP sin ese cruce adicional.
const FUENTE_ACABADOS_ERP = 'ERP, Costos de Materia Prima Ultima Compra al 10082026.xlsx (Luis Daniel) — ultima compra por color, filtro 2 anios';

// Genera un insumo tablero por cada color de melamina, listo para sumarse a
// INSUMOS_SEMILLA. id = `melamina-${espesor}-${colorId}` (mismo id que ya usa
// el manual 'melamina-28-ivory' agregado antes de este catalogo — lo repone).
export function insumosDeAcabadosMelamina() {
  const out = [];
  for (const [espesor, colores] of Object.entries(MELAMINA_POR_ESPESOR)) {
    for (const c of colores) {
      out.push({
        // Misma forma que produce tablero() en insumos.js.
        unidad: 'hoja', clase: 'directa', mermaCorte: 6, inventario: false, veta: false,
        fraccion: true, actualizado: HOY, proveedor: '', seccion: 'cubiertas', formato: TABLERO,
        id: `melamina-${espesor}-${c.id}`,
        nombre: `Melamina ${espesor} mm, ${c.label}`,
        precio: c.precio, precioBase: c.precio,
        articulo: `Codigo ${c.codigo} (${c.label}), ultima compra ${c.fecha}`,
        fuente: FUENTE_ACABADOS_ERP,
      });
    }
  }
  return out;
}

// Igual, para pintura en polvo (por kg, indirecta — se instala, no se corta).
export function insumosDeAcabadosPintura() {
  return PINTURA_COLORES.map((c) => ({
    // Misma forma que produce ins() en insumos.js.
    clase: 'indirecta', mermaCorte: 0, inventario: false, veta: false, fraccion: false,
    actualizado: HOY, proveedor: '', seccion: 'acabados',
    id: `pintura-polvo-${c.id}`,
    nombre: `Pintura en polvo, ${c.label}`,
    unidad: 'kg',
    precio: c.precio, precioBase: c.precio,
    articulo: `Codigo ${c.codigo} (${c.label}), ultima compra ${c.fecha}`,
    fuente: FUENTE_ACABADOS_ERP,
  }));
}

// Mapa id BASE (el que ya usan las 9 lineas: 'melamina-28', 'melamina-19',
// 'melamina-16', 'pintura-polvo') -> {colorId: idConColor}. Lo usa
// aplicarColor() (colorMelamina.js) para reescribir el insumoId de un
// componente sin que la linea tenga que saber que el catalogo de color existe.
export const MAPA_COLOR_POR_BASE = {
  'melamina-16': Object.fromEntries(MELAMINA_POR_ESPESOR[16].map((c) => [c.id, `melamina-16-${c.id}`])),
  'melamina-19': Object.fromEntries(MELAMINA_POR_ESPESOR[19].map((c) => [c.id, `melamina-19-${c.id}`])),
  'melamina-28': Object.fromEntries(MELAMINA_POR_ESPESOR[28].map((c) => [c.id, `melamina-28-${c.id}`])),
  'pintura-polvo': Object.fromEntries(PINTURA_COLORES.map((c) => [c.id, `pintura-polvo-${c.id}`])),
};

// Espesor (mm) de un id base de melamina, o null si no aplica.
function espesorDe(baseId) {
  const m = /^melamina-(\d+)$/.exec(baseId);
  return m ? m[1] : null;
}

// Lista de colores {id, label} para poblar los chips de un producto, dado el
// id BASE que usa su despiece (ej. 'melamina-28'). null si no hay catalogo
// para ese id (p. ej. insumos que no son de color, o pintura sin variante).
export function coloresDe(baseId) {
  if (baseId === 'pintura-polvo') return PINTURA_COLORES.map((c) => ({ id: c.id, label: c.label }));
  const espesor = espesorDe(baseId);
  if (!espesor || !MELAMINA_POR_ESPESOR[espesor]) return null;
  return MELAMINA_POR_ESPESOR[espesor].map((c) => ({ id: c.id, label: c.label }));
}
