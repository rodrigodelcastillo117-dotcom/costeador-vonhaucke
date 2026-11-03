// FASE 17 · emparejarLinea: el despiece de la IA (de la FOTO real Eclipse Drift) debe
// SUGERIR el SKU de línea correcto, por encima de distractores, y SIEMPRE pedir confirmación humana.
import { describe, it, expect } from 'vitest';
import { emparejarLinea, atributosDeIA, parsearNombreProducto, sugerirLineaParaCosteo, segmentarPorProducto, muebleDePieza } from './emparejarLinea.js';

// Salida REAL de analizar-mueble (opus-5 visión) sobre la foto del escritorio Eclipse Drift (2026-11-03).
const PROPUESTA_FOTO = {
  producto: 'Escritorio directivo en L con credenza lateral (cubierta nogal, cuerpo gris con puerta y 2 cajones, nicho abierto, patas metálicas en V)',
  descripcionCliente: 'Escritorio directivo en L con credenza integrada. Cubierta de acabado nogal oscuro, cuerpo en gris grafito con una puerta y dos cajones, un nicho abierto con panel de veta y patas metálicas en V.',
  tipo: 'escritorio',
  materiales: ['Cubierta nogal oscuro', 'Cuerpo gris grafito', 'Estructura de acero pintado', 'Herrajes metálicos'],
  piezas: [
    { nombre: 'Cubierta escritorio', semantic_role: 'cubierta', largoMM: 1800, anchoMM: 800, cantidad: 1 },
    { nombre: 'Cubierta credenza', semantic_role: 'cubierta', largoMM: 1800, anchoMM: 450, cantidad: 1 },
    { nombre: 'Frentes puerta y cajones (gris)', semantic_role: 'puerta', cantidad: 3 },
    { nombre: 'Cajas de cajón (cuerpo)', semantic_role: 'gaveta', cantidad: 10 },
    { nombre: 'Patas escritorio en V (par)', semantic_role: 'pata', cantidad: 4 },
    { nombre: 'Jaladeras', semantic_role: 'herraje', cantidad: 3 },
  ],
};

// Candidatos REALES del catálogo (nombres verbatim de productos ECLIPSE DRIFT), con distractores.
const CANDIDATOS = [
  { id: 1043, codigo: 'EDCZAE61P2CCH', familia: 'ECLIPSE DRIFT', nombre: 'CREDENZA DOBLE DE 1800  X 400 X 600 mm MODELO ECLIPSE DRIFT, CON 2 CAJONES, 1 PUERTA, CUERPO EN MELAMINA CANTO ABS COLOR NEGRO Y CUBIERTAS; EN CHAPA DE MADERA  --  EDCZAE61P2CCH' },
  { id: 1042, codigo: 'EDCZAE61P2CABS', familia: 'ECLIPSE DRIFT', nombre: 'CREDENZA DOBLE DE 1800  X 400 X 600 mm MODELO ECLIPSE DRIFT, CON 2 CAJONES, 1 PUERTA, CUERPO EN MELAMINA CANTO ABS COLOR NEGRO Y CUBIERTAS; EN MELAMINA CANTO ABS  --  EDCZAE61P2CABS' },
  { id: 1033, codigo: 'EDCZAD63P2CABS', familia: 'ECLIPSE DRIFT', nombre: 'CREDENZA DOBLE DE 1800 X 400 mm MODELO ECLIPSE DRIFT, CON 2 CAJONES, 3 PUERTAS EN MELAMINA CANTO ABS Y CUERPO; EN MELAMINA CANTO ABS COLOR NEGRO  --  EDCZAD63P2CABS' },
  { id: 500, codigo: 'ECCR675CH', familia: 'ECLIPSE', nombre: 'CREDENZA CON 4 PUERTAS VERTICALES Y 2 ENTREPAÑOS DE 1800 X 450 X 750 mm MODELO ECLIPSE, EN CHAPA DE MADERA  --  ECCR675CH' },
  { id: 1086, codigo: 'EDCZALIB42ABS', familia: 'ECLIPSE DRIFT', nombre: 'CREDENZA DE 1200 X 399 mm MODELO ECLIPSE DRIFT, EN MELAMINA CANTO ABS -- EDCZALIB42ABS' },
];

describe('emparejarLinea · FASE 17', () => {
  it('extrae config de la FOTO desde el texto (una puerta, dos cajones), no de los roles crudos', () => {
    const ia = atributosDeIA(PROPUESTA_FOTO);
    expect(ia.puertas).toBe(1);     // "una puerta" — no 3 (los "frentes")
    expect(ia.cajones).toBe(2);     // "dos cajones" — no 10 (las cajas)
    expect(ia.largoMM).toBe(1800);
    expect(ia.material).toBe('madera'); // "nogal"
  });

  it('parsea el nombre estructurado del SKU real', () => {
    const p = parsearNombreProducto(CANDIDATOS[0]);
    expect(p).toMatchObject({ puertas: 1, cajones: 2, largoMM: 1800, fondoMM: 400, material: 'madera' });
  });

  it('SUGIERE el SKU correcto (EDCZAE61P2CCH, chapa de madera) por encima de los distractores', () => {
    const r = emparejarLinea(PROPUESTA_FOTO, CANDIDATOS);
    expect(r.mejor).toBeTruthy();
    expect(r.mejor.producto.codigo).toBe('EDCZAE61P2CCH');     // el de madera gana al de melamina (mismo config)
    expect(['ALTA', 'MEDIA']).toContain(r.confianza);
    // El 3-puertas y el 4-puertas quedan por debajo (config distinta): o ausentes, o después del match.
    const cods = r.sugerencias.map((s) => s.producto.codigo);
    expect(cods[0]).toBe('EDCZAE61P2CCH');
    const i3 = cods.indexOf('EDCZAD63P2CABS');
    expect(i3 === -1 || i3 > 0).toBe(true);     // 3 puertas: ausente o por debajo
    const i4 = cods.indexOf('ECCR675CH');
    expect(i4 === -1 || i4 > 0).toBe(true);     // 4 puertas: ausente o por debajo
  });

  it('NUNCA auto-selecciona: siempre pide confirmación humana (regla de casa)', () => {
    const r = emparejarLinea(PROPUESTA_FOTO, CANDIDATOS);
    expect(r.requiereConfirmacionHumana).toBe(true);
    expect(r.autoseleccionado).toBeNull();
  });

  it('sin candidatos fuertes no fuerza ninguno (no inventa un SKU)', () => {
    const r = emparejarLinea({ puertas: 9, cajones: 9, largoMM: 50, material: 'cristal' }, CANDIDATOS);
    // Config imposible contra estos candidatos → o ninguno, o confianza BAJA; nunca ALTA.
    expect(r.confianza).not.toBe('ALTA');
  });
});

describe('segmentarPorProducto · FASE 17 #2 (multi-producto en una foto)', () => {
  it('parte la foto (escritorio EN L CON credenza) en 2 sub-productos', () => {
    const seg = segmentarPorProducto(PROPUESTA_FOTO);
    expect(seg.multiProducto).toBe(true);
    const muebles = seg.segmentos.map((s) => s.mueble);
    expect(muebles).toContain('escritorio');
    expect(muebles).toContain('credenza');
    // La cubierta y las patas del escritorio caen en el segmento 'escritorio'.
    const esc = seg.segmentos.find((s) => s.mueble === 'escritorio');
    expect(esc.piezas.some((p) => /cubierta escritorio/i.test(p.nombre))).toBe(true);
    expect(esc.piezas.some((p) => /patas escritorio/i.test(p.nombre))).toBe(true);
  });

  it('un mueble simple NO se marca multi-producto (un solo segmento con todo)', () => {
    const simple = { tipo: 'mesa', piezas: [{ nombre: 'Cubierta mesa', semantic_role: 'cubierta' }, { nombre: 'Patas mesa', semantic_role: 'pata' }] };
    const seg = segmentarPorProducto(simple);
    expect(seg.multiProducto).toBe(false);
    expect(seg.segmentos).toHaveLength(1);
  });

  it('muebleDePieza clasifica por el nombre', () => {
    expect(muebleDePieza({ nombre: 'Cubierta credenza 1600' })).toBe('credenza');
    expect(muebleDePieza({ nombre: 'Tornillería' })).toBeNull();
  });
});

describe('sugerirLineaParaCosteo · foto → SKU → PRECIO DE LÍNEA real (COSTEAR)', () => {
  // Variantes REALES de PRECIOS_LINEA (mismo config, distinto material → distinto precio de lista).
  const PRECIOS = [
    { c: 'EDCZAE61P2CCH', ln: 'ECLIPSE DRIFT', ruta: 'drift', l: 33270, m: 22190, d: 'CREDENZA DOBLE DE 1800  X 400 X 600 mm MODELO ECLIPSE DRIFT, CON 2 CAJONES, 1 PUERTA, CUERPO EN MELAMINA CANTO ABS COLOR NEGRO Y CUBIERTAS; EN CHAPA DE MADERA  --  EDCZAE61P2CCH' },
    { c: 'EDCZAE61P2CABS', ln: 'ECLIPSE DRIFT', ruta: 'drift', l: 19240, m: 12830, d: 'CREDENZA DOBLE DE 1800  X 400 X 600 mm MODELO ECLIPSE DRIFT, CON 2 CAJONES, 1 PUERTA, CUERPO EN MELAMINA CANTO ABS COLOR NEGRO Y CUBIERTAS; EN MELAMINA CANTO ABS  --  EDCZAE61P2CABS' },
    { c: 'EDCZAE61P2CHPELABS', ln: 'ECLIPSE DRIFT', ruta: 'drift', l: 22820, m: 15220, d: 'CREDENZA DOBLE DE 1800  X 400 X 600 mm MODELO ECLIPSE DRIFT, CON 2 CAJONES, 1 PUERTA, CUERPO EN MELAMINA CANTO ABS COLOR NEGRO Y CUBIERTAS; EN MELAMINA Y PERFIL CON CANTO CLEAF  --  EDCZAE61P2CHPELABS' },
  ];
  const candidatos = PRECIOS.map((a) => ({ id: a.c, codigo: a.c, familia: a.ln, nombre: a.d, ruta: a.ruta, precioLista: a.l, piso: a.m }));

  it('la foto (nogal/chapa) resuelve a EDCZAE61P2CCH y su PRECIO DE LISTA real $33,270', () => {
    const r = sugerirLineaParaCosteo(PROPUESTA_FOTO, candidatos);
    expect(r.esProbableLinea).toBe(true);
    expect(r.sku).toBe('EDCZAE61P2CCH');
    expect(r.precioLista).toBe(33270);
    expect(r.requiereConfirmacionHumana).toBe(true); // sigue pidiendo confirmación
  });

  it('distinguir el MATERIAL evita un error de $14k (madera $33,270 vs melamina $19,240)', () => {
    const r = sugerirLineaParaCosteo(PROPUESTA_FOTO, candidatos);
    const cods = r.alternativas.map((a) => a.codigo);
    expect(cods).toContain('EDCZAE61P2CABS'); // la melamina aparece como alternativa...
    const madera = r.alternativas.find((a) => a.codigo === 'EDCZAE61P2CCH');
    const melamina = r.alternativas.find((a) => a.codigo === 'EDCZAE61P2CABS');
    expect(madera.precioLista - melamina.precioLista).toBe(14030); // ...con su precio, para que el humano vea la diferencia
    // y la de madera (que coincide con la foto) va primero.
    expect(r.alternativas[0].codigo).toBe('EDCZAE61P2CCH');
  });
});
