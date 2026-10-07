// Casos INDEPENDIENTES (no reutilizan casos.js, casos-dificiles.js ni el generador).
// Familia A: programa real → partidasSugeridasDeAreas (catálogo real APP LT) → confirmación
//            simulada → construirPayloadAcomodo (mismo builder que usa la app) → payload real.
// Familia B: casos a mano en mm con zone_id, formas irregulares, puertas con barrido, columnas.
import { partidasSugeridasDeAreas } from '../../src/datos/piezasDePrograma.js';
import { construirPayloadAcomodo } from '../../src/datos/acomodoPayload.js';

function desdePrograma(areasM) {
  const sug = partidasSugeridasDeAreas(areasM);
  const confirmadas = sug.map((p, i) => { const q = { ...p, id: `p${i + 1}` }; delete q.sugerido; delete q.sugeridoPlano; delete q.noCobrar; q.source = 'CONFIRMADO'; return q; });
  const pl = construirPayloadAcomodo({ partidas: confirmadas, areasM });
  if (!pl.ok) throw new Error('payload ' + pl.motivo + ' ' + JSON.stringify(pl.detalles));
  return { areas: pl.areas, piezas: pl.piezas };
}

let k = 0; const id = (p) => `${p}${++k}`;
const rep = (n, f) => Array.from({ length: n }, f);
const A = (nombre, ancho, largo, tipo, extra = {}) => ({ nombre, zone_id: nombre, tipo, ancho, largo, ...extra });
const silla = (g, z, rol = 'WORK_SEAT') => ({ id: id('s'), nombre: 'Silla', relation_role: rol, functional_group_id: g, zone_id: z, w: 600, d: 600 });
const banca = (g, z, n) => { const W = { 2: 1500, 4: 3000, 6: 4500, 8: 4800, 10: 6000, 12: 7200 }[n]; return { id: id('b'), nombre: `Banca doble APP LT ${n} usuarios`, relation_role: 'ANCHOR_WORKSTATION', functional_group_id: g, zone_id: z, w: W, d: 1200, user_capacity: n }; };
const kitBanca = (g, z, n) => [banca(g, z, n), ...rep(n, () => silla(g, z))];
const mesaJ = (g, z, n) => { const W = n >= 14 ? 4200 : n >= 12 ? 3800 : n >= 10 ? 3400 : n >= 8 ? 3000 : n >= 6 ? 2600 : 2200; return { id: id('m'), nombre: `Mesa de juntas ${n} personas`, relation_role: 'ANCHOR_MEETING', functional_group_id: g, zone_id: z, w: W, d: 1200, user_capacity: n }; };
const kitJuntas = (g, z, n) => [mesaJ(g, z, n), ...rep(n, () => silla(g, z, 'MEETING_SEAT'))];
const kitPrivado = (g, z) => [
  { id: id('e'), nombre: 'Escritorio directivo', relation_role: 'ANCHOR_DESK', functional_group_id: g, zone_id: z, w: 1800, d: 800 },
  { ...silla(g, z, 'EXECUTIVE_SEAT'), w: 650, d: 650 }, silla(g, z, 'VISITOR_SEAT'), silla(g, z, 'VISITOR_SEAT'),
  { id: id('c'), nombre: 'Credenza dirección', relation_role: 'SUPPORT_STORAGE', functional_group_id: g, zone_id: z, w: 1200, d: 500 },
];
const sweep = (bx, by, ancho, cerrada, sentido = 'horario') => ({ x: bx, y: by, ancho, tieneBarrido: true, bisagraX: bx, bisagraY: by, anguloCerradaDeg: cerrada, barridoDeg: 90, sentido });

export function misCasos() {
  const casos = [];
  // ---------------- Familia A: programa real ----------------
  casos.push({ nombre: 'A1 privado director real (4.0×3.5)', fam: 'A', factible: 'sí (testigo)', ...desdePrograma([{ nombre: 'Privado Director', ancho: 4, largo: 3.5, tipo: 'privado' }]) });
  casos.push({ nombre: 'A2 juntas 10 real (6.0×4.5)', fam: 'A', factible: 'sí (testigo)', ...desdePrograma([{ nombre: 'Sala de Juntas', puestos: 10, ancho: 6, largo: 4.5, tipo: 'juntas' }]) });
  casos.push({ nombre: 'A3 recepción real (5×4)', fam: 'A', factible: 'sí (obvio)', ...desdePrograma([{ nombre: 'Recepción', ancho: 5, largo: 4, tipo: 'recepcion' }]) });
  casos.push({ nombre: 'A4 operativa 8 puestos real (8×6)', fam: 'A', factible: 'sí (obvio)', ...desdePrograma([{ nombre: 'Operativa', puestos: 8, ancho: 8, largo: 6, tipo: 'open' }]) });
  const oficina = [
    { nombre: 'Recepción', ancho: 5, largo: 4, tipo: 'recepcion' },
    { nombre: 'Privado Director', ancho: 4, largo: 3.5, tipo: 'privado' },
    { nombre: 'Privado Gerente', ancho: 3.6, largo: 3.4, tipo: 'privado' },
    { nombre: 'Sala de Juntas', puestos: 8, ancho: 5.5, largo: 4.5, tipo: 'juntas' },
    { nombre: 'Operativa', puestos: 12, ancho: 10, largo: 7, tipo: 'open' },
    { nombre: 'Archivo', ancho: 3, largo: 2 },
    { nombre: 'Coffee', ancho: 3, largo: 2.5 },
  ];
  casos.push({ nombre: 'A5 oficina completa 7 zonas (con tipo)', fam: 'A', factible: 'sí (por zona)', ...desdePrograma(oficina) });
  casos.push({ nombre: 'A6 misma oficina, áreas SIN tipo (como lee un plano)', fam: 'A', factible: 'sí (por zona)', ...desdePrograma(oficina.map(({ tipo, ...r }) => r)) });
  casos.push({ nombre: 'A7 3 privados iguales (zona por nombre)', fam: 'A', factible: 'sí (1 por cuarto)', ...desdePrograma([
    { nombre: 'Privado Director', ancho: 4, largo: 3.5, tipo: 'privado' }, { nombre: 'Privado Finanzas', ancho: 4, largo: 3.5, tipo: 'privado' }, { nombre: 'Privado Ventas', ancho: 4, largo: 3.5, tipo: 'privado' }]) });
  casos.push({ nombre: 'A8 lounge + archivo (piezas sin rol)', fam: 'A', factible: 'sí (obvio)', ...desdePrograma([{ nombre: 'Lounge', ancho: 6, largo: 5, tipo: 'lounge' }, { nombre: 'Archivo', ancho: 3, largo: 2 }]) });

  casos.push({ nombre: 'A9 zona llamada "Operativa 8 puestos" (bug del builder)', fam: 'A', factible: 'sí (obvio)', builderBug: true, ...desdePrograma([{ nombre: 'Operativa 8 puestos', ancho: 8, largo: 6, tipo: 'open' }]) });
  // ---------------- Familia B: a mano ----------------
  // B1 cuarto en L: dos bancas de 6 sólo caben usando ambas patas de la L.
  casos.push({ nombre: 'B1 cuarto en L, 2 bancas de 6', fam: 'B', factible: 'sí (testigo)', areas: [A('OPERATIVA', 9000, 9000, 'open', { poly: [[0, 0], [9000, 0], [9000, 3500], [3500, 3500], [3500, 9000], [0, 9000]] })], piezas: [...kitBanca('g1', 'OPERATIVA', 6), ...kitBanca('g2', 'OPERATIVA', 6)] });
  // B2 cuarto en U: el centro superior es hueco (patio). Un bloque ancho NO puede cruzarlo.
  casos.push({ nombre: 'B2 cuarto en U (hueco al centro)', fam: 'B', factible: 'sí (testigo)', areas: [A('OPERATIVA', 11000, 7000, 'open', { poly: [[0, 0], [3000, 0], [3000, 4500], [8000, 4500], [8000, 0], [11000, 0], [11000, 7000], [0, 7000]] })], piezas: [...kitBanca('g1', 'OPERATIVA', 8)] });
  // B3 muro con pilastra/remetimiento de 600×600 a mitad del muro superior.
  casos.push({ nombre: 'B3 pilastra en muro (recorte del polígono)', fam: 'B', factible: 'sí (testigo)', areas: [A('OPERATIVA', 8000, 4000, 'open', { poly: [[0, 0], [3700, 0], [3700, 600], [4300, 600], [4300, 0], [8000, 0], [8000, 4000], [0, 4000]] })], piezas: [...kitBanca('g1', 'OPERATIVA', 6)] });
  // B4 juntas con 2 puertas con barrido real (bisagra) + columna.
  casos.push({ nombre: 'B4 juntas 8, 2 puertas con barrido + columna', fam: 'B', factible: 'sí (testigo)', areas: [A('JUNTAS', 7000, 5000, 'juntas', { puertas: [sweep(0, 1000, 900, 90), sweep(7000, 3900, 900, 270)], obstaculos: [{ x: 6400, y: 0, w: 600, h: 600 }] })], piezas: [...kitJuntas('gj', 'JUNTAS', 8)] });
  // B5 ocupación ~71%: 4 bancas de 8 (kit 4800×1800) en 10.6×4.6 (cabe exacto con pasillo 1.0).
  casos.push({ nombre: 'B5 ocupación 71%, 4 bancas de 8 (justo)', fam: 'B', factible: 'sí (testigo)', areas: [A('OPERATIVA', 10600, 4600, 'open')], piezas: [1, 2, 3, 4].flatMap((i) => kitBanca(`g${i}`, 'OPERATIVA', 8)) });
  // B6 al límite: mismo caso con 100 mm menos de ancho → no caben las 4.
  casos.push({ nombre: 'B6 al límite: 10.5×4.6 (100 mm menos)', fam: 'B', factible: 'no (sólo 2 de 4)', areas: [A('OPERATIVA', 10500, 4600, 'open')], piezas: [1, 2, 3, 4].flatMap((i) => kitBanca(`g${i}`, 'OPERATIVA', 8)) });
  // B7 imposible disfrazado: 120 m² pero malla de columnas deja franjas <2.2 m.
  const cols = []; for (const x of [2200, 4600, 7000, 9400]) for (const y of [0, 2500, 5000, 7500]) cols.push({ x, y, w: 600, h: 600 });
  casos.push({ nombre: 'B7 imposible disfrazado: 120 m² con malla de columnas', fam: 'B', factible: 'no (la mesa 3.4 m no cabe entre columnas)', areas: [A('JUNTAS', 12000, 10000, 'juntas', { obstaculos: cols })], piezas: [...kitJuntas('gj', 'JUNTAS', 10)] });
  // B8 multi-zona con zone_id: 2 privados + juntas + operativa con columna y puerta.
  casos.push({ nombre: 'B8 multi-zona con credenzas y visitas', fam: 'B', factible: 'sí (testigo)', areas: [
    A('PRIV-1', 4000, 3500, 'privado', { puertas: [{ x: 3500, y: 3500, ancho: 900 }] }), A('PRIV-2', 4000, 3500, 'privado'),
    A('JUNTAS', 6000, 4500, 'juntas'), A('OPERATIVA', 10000, 7000, 'open', { obstaculos: [{ x: 4700, y: 3200, w: 600, h: 600 }] })],
    piezas: [...kitPrivado('gp1', 'PRIV-1'), ...kitPrivado('gp2', 'PRIV-2'), ...kitJuntas('gj', 'JUNTAS', 10), ...kitBanca('go1', 'OPERATIVA', 6), ...kitBanca('go2', 'OPERATIVA', 6)] });
  // B9 piso grande 20×12 con 12 bancas de 6 (+ 1 de más): presión de tiempo / nodos.
  casos.push({ nombre: 'B9 piso grande 20×12, 12 bancas de 6', fam: 'B', factible: 'sí (testigo 3×4)', areas: [A('OPERATIVA', 20000, 12000, 'open')], piezas: rep(12, (_, i) => kitBanca(`g${i}`, 'OPERATIVA', 6)).flat() });
  casos.push({ nombre: 'B10 piso grande 20×12, 13 bancas de 6', fam: 'B', factible: 'no probado', areas: [A('OPERATIVA', 20000, 12000, 'open')], piezas: rep(13, (_, i) => kitBanca(`g${i}`, 'OPERATIVA', 6)).flat() });
  casos.push({ nombre: 'B11 piso 30×20 + juntas imposible al final', fam: 'B', factible: 'no (la mesa 14 no cabe en 4×3)', areas: [A('OPERATIVA', 30000, 20000, 'open'), A('JUNTAS', 4000, 3000, 'juntas')], piezas: [...rep(10, (_, i) => kitBanca(`g${i}`, 'OPERATIVA', 6)).flat(), ...kitJuntas('gj', 'JUNTAS', 14)] });
  // B12 dos bancas en el MISMO grupo funcional (dos partidas en una zona).
  { const g = 'gop'; const b1 = banca(g, 'OPERATIVA', 4), b2 = banca(g, 'OPERATIVA', 4);
    casos.push({ nombre: 'B12 2 bancas de 4 en el mismo grupo', fam: 'B', factible: 'sí (obvio)', areas: [A('OPERATIVA', 9000, 7000, 'open')], piezas: [b1, b2, ...rep(8, () => silla(g, 'OPERATIVA'))] }); }
  // B13 banca SIN user_capacity (cotización vieja / producto suelto del catálogo).
  { const b = banca('gx', 'OPERATIVA', 8); delete b.user_capacity;
    casos.push({ nombre: 'B13 banca de 8 sin user_capacity', fam: 'B', factible: 'sí (obvio)', areas: [A('OPERATIVA', 9000, 7000, 'open')], piezas: [b, ...rep(8, () => silla('gx', 'OPERATIVA'))] }); }
  // B14 puerta con barrido justo donde el solver empezaría (esquina 0,0).
  casos.push({ nombre: 'B14 puerta en esquina de origen', fam: 'B', factible: 'sí (obvio)', areas: [A('OPERATIVA', 7000, 5000, 'open', { puertas: [sweep(0, 0, 1000, 0)] })], piezas: [...kitBanca('g1', 'OPERATIVA', 6)] });
  // B15 imposible obvio: área minúscula.
  casos.push({ nombre: 'B15 imposible: juntas 12 en 3×3', fam: 'B', factible: 'no (obvio)', areas: [A('JUNTAS', 3000, 3000, 'juntas')], piezas: [...kitJuntas('gj', 'JUNTAS', 12)] });
  // B16 piso real grande: 25 bancas de 6 (150 personas) en 30×20 m. Cabe en malla 5×7.
  { const piezas = rep(25, (_, i) => kitBanca(`g${i}`, 'OPERATIVA', 6)).flat();
    const witness = []; let b = 0;
    for (const p of piezas) if (p.relation_role === 'ANCHOR_WORKSTATION') {
      const col = b % 5, row = Math.floor(b / 5); b++;
      const x = col * 5500, y = row * 2800; witness.push({ id: p.id, area: 0, x, y, rot: 0 });
      piezas.filter((s) => s.functional_group_id === p.functional_group_id && s.relation_role === 'WORK_SEAT').forEach((s, i) => witness.push({ id: s.id, area: 0, x: x + 75 + i * 750, y: y + 1200, rot: 0 }));
    }
    casos.push({ nombre: 'B16 piso grande 30×20, 25 bancas de 6', fam: 'B', factible: 'sí (testigo malla 5×7)', witness, areas: [A('OPERATIVA', 30000, 20000, 'open')], piezas }); }
  return casos;
}
