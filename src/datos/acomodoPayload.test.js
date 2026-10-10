import { describe, it, expect } from 'vitest';
import { programHash, programHashCanonico, floorHash, planEstaStale, serializarEstable, firmaLayout } from './acomodoHash.js';
import { construirPayloadAcomodo, validarFloorSpecGeom } from './acomodoPayload.js';

const PARTIDAS = [
  { id: 'e-win', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 10, precioUnitario: 5210, relation_role: 'WORK_SEAT' },
  { id: 'e-mesa', piezaId: 'mj-1200x1200-melamina', nombre: 'Mesa de juntas (1200 x 1200)', cantidad: 1, precioUnitario: 5510, relation_role: 'ANCHOR_MEETING' },
];
const AREAS_M = [
  { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8, largo: 3.2, puestos: 10 },
  { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7, largo: 3.2 },
];

describe('acomodoHash · program_hash (P0.2 obj 10)', () => {
  it('es estable ante reordenamiento de la lista', () => {
    const a = programHash(PARTIDAS);
    const b = programHash([...PARTIDAS].reverse());
    expect(a).toBe(b);
  });
  it('IGNORA precio/costo (no afectan el layout)', () => {
    const base = programHash(PARTIDAS);
    const otroPrecio = programHash(PARTIDAS.map((p) => ({ ...p, precioUnitario: 99999, costoUnitario: 123 })));
    expect(otroPrecio).toBe(base);
  });
  it('CAMBIA cuando cambia la cantidad', () => {
    const base = programHash(PARTIDAS);
    const masSillas = programHash(PARTIDAS.map((p) => (p.id === 'e-win' ? { ...p, cantidad: 11 } : p)));
    expect(masSillas).not.toBe(base);
  });
  it('CAMBIA cuando cambia la geometría (w/d) aunque el conteo sea igual', () => {
    const base = programHash(PARTIDAS);
    const otraGeo = programHash(PARTIDAS.map((p) => (p.id === 'e-mesa' ? { ...p, w: 3000, d: 1200 } : p)));
    expect(otraGeo).not.toBe(base);
  });
  it('CAMBIA cuando cambia el rol estructural', () => {
    const base = programHash(PARTIDAS);
    const otroRol = programHash(PARTIDAS.map((p) => (p.id === 'e-win' ? { ...p, relation_role: 'VISITOR_SEAT' } : p)));
    expect(otroRol).not.toBe(base);
  });
});

describe('acomodoHash · floor_hash (P0.2 obj 10)', () => {
  it('CAMBIA al redimensionar un área (el bug que el conteo no veía)', () => {
    const base = floorHash(AREAS_M);
    const masGrande = floorHash(AREAS_M.map((a, i) => (i === 0 ? { ...a, ancho: 9 } : a)));
    expect(masGrande).not.toBe(base);
  });
  it('es sensible al ORDEN de áreas (índice de área = identidad)', () => {
    const base = floorHash(AREAS_M);
    const reordenado = floorHash([...AREAS_M].reverse());
    expect(reordenado).not.toBe(base);
  });
  it('CAMBIA al agregar una puerta u obstáculo', () => {
    const base = floorHash(AREAS_M);
    const conPuerta = floorHash(AREAS_M.map((a, i) => (i === 0 ? { ...a, puertas: [{ x: 1, y: 0, ancho: 0.9 }] } : a)));
    const conObst = floorHash(AREAS_M.map((a, i) => (i === 0 ? { ...a, obstaculos: [{ x: 1, y: 1, w: 0.5, h: 0.5, tipo: 'columna' }] } : a)));
    expect(conPuerta).not.toBe(base);
    expect(conObst).not.toBe(base);
  });
});

describe('acomodoHash · program_hash CANÓNICO (audit E)', () => {
  const piezas = [
    { id: 'a-1', w: 6000, d: 1200, tipo: 'escritorio', relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'g1' },
    { id: 's-1', w: 600, d: 600, tipo: 'asiento', relation_role: 'WORK_SEAT', functional_group_id: 'g1' },
  ];
  it('CAMBIA si cambia una dimensión canónica aunque el id/cantidad no cambien', () => {
    const base = programHashCanonico(piezas);
    const otro = programHashCanonico(piezas.map((p) => (p.id === 'a-1' ? { ...p, w: 4500 } : p)));
    expect(base).toMatch(/^pc_/);
    expect(otro).not.toBe(base);
  });
  it('estable ante reordenamiento', () => {
    expect(programHashCanonico(piezas)).toBe(programHashCanonico([...piezas].reverse()));
  });
});

describe('acomodoHash · floor_hash cubre muros y min_pasillo (audit E)', () => {
  it('CAMBIA al agregar un muro', () => {
    const base = floorHash(AREAS_M);
    const conMuro = floorHash(AREAS_M.map((a, i) => (i === 0 ? { ...a, muros: [{ x1: 1, y1: 0, x2: 1, y2: 3 }] } : a)));
    expect(conMuro).not.toBe(base);
  });
  it('CAMBIA si cambia el pasillo mínimo (circulación)', () => {
    expect(floorHash(AREAS_M, { minPasillo: 1000 })).not.toBe(floorHash(AREAS_M, { minPasillo: 1200 }));
  });
});

describe('acomodoHash · planEstaStale (fail-safe audit E)', () => {
  const ph = programHash(PARTIDAS); const fh = floorHash(AREAS_M);
  it('plan vacío (sin colocación) no se marca stale', () => {
    expect(planEstaStale({ colocacion: [] }, ph, fh)).toBe(false);
  });
  it('FAIL-SAFE: plan legacy CON colocación y SIN hashes → STALE', () => {
    expect(planEstaStale({ colocacion: [{ id: 'x', area: 0, x: 0, y: 0 }] }, ph, fh)).toBe(true);
    expect(planEstaStale({ colocacion: [{ id: 'x' }], program_hash: ph }, ph, fh)).toBe(true); // falta floor_hash
  });
  it('stale si cambió program_hash o floor_hash', () => {
    const plan = { colocacion: [{ id: 'x' }], program_hash: ph, floor_hash: fh };
    expect(planEstaStale(plan, ph, fh)).toBe(false);
    expect(planEstaStale({ ...plan, program_hash: 'pc_viejo' }, ph, fh)).toBe(true);
    expect(planEstaStale({ ...plan, floor_hash: 'f_viejo' }, ph, fh)).toBe(true);
  });
  it('serializarEstable ordena claves de forma determinista', () => {
    expect(serializarEstable({ b: 1, a: 2 })).toBe(serializarEstable({ a: 2, b: 1 }));
  });
});

describe('acomodoPayload · construirPayloadAcomodo (P0.2 obj 1/2/3)', () => {
  it('happy path: payload canónico con áreas mm, piezas, hashes y requested', () => {
    const r = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M });
    expect(r.ok).toBe(true);
    expect(r.areas).toHaveLength(2);
    expect(r.areas[0].ancho).toBe(8000);            // metros → mm
    expect(r.piezas.length).toBeGreaterThan(0);
    expect(r.program_hash).toMatch(/^pc_/);   // canónico sobre piezas expandidas
    expect(r.floor_hash).toMatch(/^f_/);
    expect(r.requested).toBe(r.piezas.length);
    expect(r.descartadosSugeridos).toBe(0);
  });

  it('obj 2: descarta sug-* SIEMPRE y deja rastro (descartadosSugeridos)', () => {
    const conSug = [
      ...PARTIDAS,
      { id: 'sug-1', piezaId: 'silla-win', nombre: 'Silla sugerida', cantidad: 3 },
      { id: 'x', sugeridoPlano: true, piezaId: 'mesa-x', nombre: 'Mesa sugerida', cantidad: 1 },
    ];
    const r = construirPayloadAcomodo({ partidas: conSug, areasM: AREAS_M });
    expect(r.ok).toBe(true);
    expect(r.descartadosSugeridos).toBe(2);
    expect(r.piezas.every((p) => !String(p.id).startsWith('sug-'))).toBe(true);
  });

  it('obj 1: sin partidas confirmadas → rechazo explícito, NO payload', () => {
    const soloSug = [{ id: 'sug-1', nombre: 'x', cantidad: 2 }];
    const r = construirPayloadAcomodo({ partidas: soloSug, areasM: AREAS_M });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('SIN_PARTIDAS_CONFIRMADAS');
    expect(r.descartadosSugeridos).toBe(1);
  });

  it('obj 3: sin FloorSpec → rechazo SIN_FLOORSPEC (no se acomoda)', () => {
    const r = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: [] });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('SIN_FLOORSPEC');
  });

  it('obj 3: FloorSpec con área degenerada → FLOORSPEC_INVALIDO con detalle', () => {
    const malas = [{ nombre: 'MALA', ancho: 0, largo: 3 }];
    const r = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: malas });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('FLOORSPEC_INVALIDO');
    expect(r.detalles.some((d) => d.includes('AREA_ANCHO_INVALIDO'))).toBe(true);
  });

  it('validarFloorSpecGeom detecta vacío y dimensiones no finitas', () => {
    expect(validarFloorSpecGeom([]).ok).toBe(false);
    expect(validarFloorSpecGeom([{ nombre: 'a', ancho: 4, largo: 3 }]).ok).toBe(true);
    expect(validarFloorSpecGeom([{ nombre: 'a', ancho: NaN, largo: 3 }]).ok).toBe(false);
  });

  it('GAP3: geometría válida pero FloorSpec en FALLO (FAIL/REJECTED) → no payload (FLOORSPEC_RECHAZADO)', () => {
    for (const estado of ['FAIL', 'REJECTED', 'INVALID']) {
      const r = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, floorSpecEstado: estado });
      expect(r.ok, estado).toBe(false);
      expect(r.motivo).toBe('FLOORSPEC_RECHAZADO');
      expect(r.detalles).toContain(estado);
    }
  });
  it('COT-P0-022: FloorSpec REVIEW_REQUIRED (warnings: puertas sin barrido) → payload de BORRADOR marcado, nunca publicable', () => {
    const r = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, floorSpecEstado: 'REVIEW_REQUIRED' });
    expect(r.ok).toBe(true);                       // antes: FLOORSPEC_RECHAZADO → "No voy a acomodar" sin salida
    expect(r.borrador).toBe(true);
    expect(r.floorSpecEstado).toBe('REVIEW_REQUIRED');
    expect(r.motivoBorrador).toMatch(/revisión/);
    expect(r.piezas.length).toBeGreaterThan(0);
  });
  it('GAP3: FloorSpec PASS o ausente (espacio manual) → payload ok y NO borrador', () => {
    const pass = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, floorSpecEstado: 'PASS' });
    const manual = construirPayloadAcomodo({ partidas: PARTIDAS, areasM: AREAS_M, floorSpecEstado: null });
    expect(pass.ok).toBe(true); expect(pass.borrador).toBe(false);
    expect(manual.ok).toBe(true); expect(manual.borrador).toBe(false);
  });
});

// ============================================================================
// React P0-A (ChatGPT audit) · firmaLayout: el render se ata a la POSICIÓN de
// cada pieza, no al conteo. program_hash|floor_hash|nº-colocaciones no cambiaba
// al mover un mueble → un render viejo parecía vigente y viajaba al PDF.
// ============================================================================
describe('acomodoHash · firmaLayout (render stale por posición, no por conteo)', () => {
  const PH = 'pc_x';
  const FH = 'f_x';
  const plan = (coloc) => ({ colocacion: coloc });
  const L = [
    { id: 'p1-1', area: 0, x: 500, y: 500, rot: 0 },
    { id: 'p1-2', area: 0, x: 500, y: 2000, rot: 0 },
    { id: 'p2-1', area: 1, x: 1000, y: 1000, rot: 90 },
  ];

  it('mismo layout → firma estable (idéntica entre corridas)', () => {
    expect(firmaLayout(plan(L), PH, FH)).toBe(firmaLayout(plan(L), PH, FH));
  });

  it('REGRESIÓN NÚCLEO: mismo nº de muebles, muevo UNO → la firma CAMBIA', () => {
    const movido = L.map((c) => (c.id === 'p1-1' ? { ...c, x: 7000 } : c));
    expect(movido).toHaveLength(L.length);                 // mismo conteo
    expect(firmaLayout(plan(movido), PH, FH)).not.toBe(firmaLayout(plan(L), PH, FH));
  });

  it('rotar una pieza (misma posición) → la firma CAMBIA', () => {
    const rotado = L.map((c) => (c.id === 'p2-1' ? { ...c, rot: 180 } : c));
    expect(firmaLayout(plan(rotado), PH, FH)).not.toBe(firmaLayout(plan(L), PH, FH));
  });

  it('un cambio sub-milimétrico (≥0.5 mm) en x → la firma CAMBIA', () => {
    const casi = L.map((c) => (c.id === 'p1-2' ? { ...c, x: c.x + 0.6 } : c));
    expect(firmaLayout(plan(casi), PH, FH)).not.toBe(firmaLayout(plan(L), PH, FH));
  });

  it('reordenar la lista de colocaciones NO cambia la firma (orden canónico)', () => {
    const revuelto = [L[2], L[0], L[1]];
    expect(firmaLayout(plan(revuelto), PH, FH)).toBe(firmaLayout(plan(L), PH, FH));
  });

  it('cambiar program_hash o floor_hash → la firma CAMBIA (QUÉ/DÓNDE siguen contando)', () => {
    expect(firmaLayout(plan(L), 'pc_otro', FH)).not.toBe(firmaLayout(plan(L), PH, FH));
    expect(firmaLayout(plan(L), PH, 'f_otro')).not.toBe(firmaLayout(plan(L), PH, FH));
  });
});
