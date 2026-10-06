// ============================================================================
//  GOLDEN ARQ-01 — "Plano Ejecutivo Complejo.pdf" (OFICINAS CORPORATIVAS TORRE SUR).
//  Ground truth leído del PDF real:
//    · Cotas horizontales A-E: 4.00 + 4.00 + 4.00 + 3.00 = 15.00 m
//    · Cotas verticales 1-4:   3.20 + 3.20 + 2.40        =  8.80 m
//    · Envolvente = 15.00 × 8.80 = 132.0 m²  (NO 178)
//    · Zonas: OFICINA CEO, SALA DE CONSEJO, ÁREA OPERATIVA, RECEPCIÓN, SITE (IT),
//      SANITARIOS H, SANITARIOS M
//    · ÁREA OPERATIVA dibuja 2 islas de ~4 = ~8 puestos (NO 17)
//    · SALA DE CONSEJO: mesa oval + ~8 sillas (meeting seats, NO puestos)
//    · Sanitarios = fixtures (NUNCA sillas). X azules = ductos HVAC (no muebles).
//    · El plano NO nombra ningún modelo (Eclipse/WIN/…): no hay SKU confirmado.
//  Estas aserciones son el contrato permanente contra el bug observado
//  (178 m², 17 puestos, 17 archiveros inventados, SKUs falsamente confirmados).
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  ROL, ZONA, zonaSemantica, rolDeSimboloEnZona, contarRoles,
  PROCEDENCIA, esConfirmado, modeloConfirmado,
  validarEnvolvente, validarFloorSpec, estadoLayout, puedePresentarPropuesta, renderFiel,
} from './floorSpec.js';

const GRID = { horizontal: [4000, 4000, 4000, 3000], vertical: [3200, 3200, 2400] };
const ENV_OK = { width_mm: 15000, height_mm: 8800 };

describe('ARQ-01 · envolvente por cotas (cota > escala > IA)', () => {
  it('15.00 × 8.80 = 132.0 m² y el grid cuadra', () => {
    const r = validarEnvolvente(ENV_OK, GRID);
    expect(r.ok).toBe(true);
    expect(r.area_m2).toBeCloseTo(132.0, 1);
  });
  it('178 m² (envolvente inflada) con grid de 132 → INVÁLIDO', () => {
    const r = validarEnvolvente({ width_mm: 15000, height_mm: 11600 }, GRID);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'GRID_LARGO_NO_CUADRA')).toBe(true);
  });
  it('la suma del grid ES la verdad: 15000 y 8800', () => {
    expect(GRID.horizontal.reduce((a, b) => a + b, 0)).toBe(15000);
    expect(GRID.vertical.reduce((a, b) => a + b, 0)).toBe(8800);
  });
});

describe('ARQ-01 · semántica por zona (CAPACIDAD != PUESTOS != SILLAS)', () => {
  it('una silla (círculo) se interpreta según su zona', () => {
    expect(rolDeSimboloEnZona('circulo', ZONA.CONSEJO)).toBe(ROL.MEETING_SEAT);
    expect(rolDeSimboloEnZona('circulo', ZONA.OPERATIVA)).toBe(ROL.WORK_SEAT);
    expect(rolDeSimboloEnZona('silla', ZONA.CEO)).toBe(ROL.EXECUTIVE_SEAT);
  });
  it('un sanitario NUNCA es una silla, ni dentro de SANITARIOS', () => {
    expect(rolDeSimboloEnZona('sanitario', ZONA.SANITARIOS)).toBe(ROL.FIXTURE);
    expect(rolDeSimboloEnZona('inodoro', ZONA.OPERATIVA)).toBe(ROL.FIXTURE);
  });
  it('zonaSemantica reconoce las zonas del plano sin inventar otras', () => {
    expect(zonaSemantica('OFICINA CEO')).toBe(ZONA.CEO);
    expect(zonaSemantica('SALA DE CONSEJO')).toBe(ZONA.CONSEJO);
    expect(zonaSemantica('ÁREA OPERATIVA')).toBe(ZONA.OPERATIVA);
    expect(zonaSemantica('SANITARIOS H')).toBe(ZONA.SANITARIOS);
    expect(zonaSemantica('SITE (IT)')).toBe(ZONA.SITE);
  });
});

describe('ARQ-01 · conteos correctos (el bug de los 17 puestos)', () => {
  const obs = [
    ...Array.from({ length: 8 }, (_, i) => ({ id: `op${i}`, semantic_role: ROL.WORKSTATION, zone_id: 'operativa' })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: `cs${i}`, semantic_role: ROL.MEETING_SEAT, zone_id: 'consejo' })),
    { id: 'ceo-desk', semantic_role: ROL.DESK, zone_id: 'ceo' },
    { id: 'ceo-chair', semantic_role: ROL.EXECUTIVE_SEAT, zone_id: 'ceo' },
    { id: 'san-h', semantic_role: ROL.FIXTURE, zone_id: 'san_h' },
    { id: 'san-m', semantic_role: ROL.FIXTURE, zone_id: 'san_m' },
  ];
  const c = contarRoles(obs);
  it('WORKSTATIONS = 8, NO 17 (no mezcla sillas de junta ni sanitarios)', () => {
    expect(c[ROL.WORKSTATION]).toBe(8);
    expect(c[ROL.WORKSTATION]).not.toBe(17);
  });
  it('las sillas de consejo son MEETING_SEAT, separadas de los puestos', () => {
    expect(c[ROL.MEETING_SEAT]).toBe(8);
  });
  it('los fixtures se cuentan como fixtures, nunca como sillas', () => {
    expect(c[ROL.FIXTURE]).toBe(2);
    expect(c[ROL.WORK_SEAT]).toBe(0);
  });
});

describe('ARQ-01 · procedencia (una sugerencia no se auto-confirma)', () => {
  it('17 archiveros por REGLA (17 puestos→17 guardas) NO están confirmados', () => {
    const archiveros = { semantic_role: ROL.STORAGE, source: PROCEDENCIA.RULE_SUGGESTION, quantity_group: 17 };
    expect(esConfirmado(archiveros)).toBe(false);
  });
  it('un SKU por match de catálogo (Eclipse/WIN) NO está confirmado', () => {
    const desk = { exact_model: 'Eclipse', exact_model_source: PROCEDENCIA.CATALOG_MATCH };
    expect(modeloConfirmado(desk)).toBe(false);
  });
  it('lo dibujado en el plano o confirmado por el usuario SÍ cuenta', () => {
    expect(esConfirmado({ source: PROCEDENCIA.DETECTED_FROM_PLAN })).toBe(true);
    expect(esConfirmado({ source: PROCEDENCIA.USER_CONFIRMED })).toBe(true);
    expect(esConfirmado({ source: PROCEDENCIA.AI_SUGGESTION })).toBe(false);
  });
});

describe('ARQ-01 · validarFloorSpec (determinista, no prompt)', () => {
  it('FloorSpec coherente → VALID', () => {
    const spec = {
      envelope: ENV_OK, grid: GRID,
      zones: [{ id: 'z1', name: 'ÁREA OPERATIVA', polygon: [[0, 0], [8000, 0], [8000, 6400], [0, 6400]] }],
      furniture_observations: [{ id: 'op0', semantic_role: ROL.WORKSTATION, zone_id: 'z1', center: [1000, 1000], quantity_group: 1 }],
    };
    expect(validarFloorSpec(spec).status).toBe('VALID');
  });
  it('mueble fuera de su zona → INVALID', () => {
    const spec = {
      envelope: ENV_OK, grid: GRID,
      zones: [{ id: 'z1', name: 'ÁREA OPERATIVA', polygon: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] }],
      furniture_observations: [{ id: 'op0', semantic_role: ROL.WORKSTATION, zone_id: 'z1', center: [9000, 9000], quantity_group: 1 }],
    };
    const r = validarFloorSpec(spec);
    expect(r.status).toBe('INVALID');
    expect(r.issues.some((i) => i.code === 'MUEBLE_FUERA_DE_ZONA')).toBe(true);
  });
});

describe('ARQ-01 · layout (nada desaparece; no verde parcial)', () => {
  it('48 pedidas, 23 colocadas, 25 sin colocar → INCOMPLETE (no verde)', () => {
    const r = estadoLayout({ requested: 48, placed: 23, unplaced: 25, excluded: 0 });
    expect(r.status).toBe('LAYOUT_INCOMPLETE');
    expect(r.invariante_ok).toBe(true);
  });
  it('la invariante requested = placed + unplaced + excluded se exige', () => {
    const r = estadoLayout({ requested: 48, placed: 23, unplaced: 0, excluded: 0 });
    expect(r.invariante_ok).toBe(false);
    expect(r.status).toBe('LAYOUT_INCOMPLETE');
  });
  it('todo colocado, sin colisiones → LAYOUT_VALID', () => {
    expect(estadoLayout({ requested: 10, placed: 10, unplaced: 0, excluded: 0 }).status).toBe('LAYOUT_VALID');
  });
  it('no se presenta Propuesta/3D oficial con datos o layout rotos', () => {
    expect(puedePresentarPropuesta('INVALID', 'LAYOUT_VALID')).toBe(false);
    expect(puedePresentarPropuesta('VALID', 'LAYOUT_INCOMPLETE')).toBe(false);
    expect(puedePresentarPropuesta('VALID', 'LAYOUT_VALID')).toBe(true);
  });
  it('render oficial solo si lo renderizado == lo colocado', () => {
    expect(renderFiel({ rendered: 48, placed: 23 })).toBe(false);
    expect(renderFiel({ rendered: 23, placed: 23 })).toBe(true);
  });
});

// ============================================================================
//  PLACEMENT SEMÁNTICO (VH-015 / LAYOUT-002). "Cabe aquí" != "pertenece aquí".
//  El motor dejaba la mesa de juntas en CEO y la recepción en operativa.
// ============================================================================
import { violacionesSemanticas, rolDePiezaAcomodo, zonaPermite, ROL as ROL2, ZONA as ZONA2 } from './floorSpec.js';

describe('placement semántico · un mueble no va en cualquier zona', () => {
  const areas = [
    { nombre: 'OFICINA CEO' },          // 0
    { nombre: 'SALA DE CONSEJO' },      // 1
    { nombre: 'ÁREA OPERATIVA' },       // 2
    { nombre: 'RECEPCIÓN' },            // 3
    { nombre: 'SANITARIOS H' },         // 4
  ];
  const byId = {
    mesa: { id: 'mesa', tipo: 'mesa', nombre: 'Mesa de juntas APP LT' },
    recep: { id: 'recep', tipo: 'recepcion', nombre: 'Módulo recepción' },
    esc: { id: 'esc', tipo: 'escritorio', nombre: 'Escritorio operativo' },
    silla: { id: 'silla', tipo: 'silla', nombre: 'Silla operativa', ruta: 'vh-dest-opn' },
    sillaJuntas: { id: 'sillaJuntas', tipo: 'asiento', nombre: 'Silla SONATA', ruta: 'vh-dest-mtg' },
  };

  it('mesa de juntas en CEO = violación; en Consejo = OK', () => {
    expect(violacionesSemanticas([{ id: 'mesa', area: 0 }], areas, byId)).toHaveLength(1);
    expect(violacionesSemanticas([{ id: 'mesa', area: 1 }], areas, byId)).toHaveLength(0);
  });

  it('recepción en operativa = violación; en recepción = OK', () => {
    expect(violacionesSemanticas([{ id: 'recep', area: 2 }], areas, byId)).toHaveLength(1);
    expect(violacionesSemanticas([{ id: 'recep', area: 3 }], areas, byId)).toHaveLength(0);
  });

  it('escritorio operativo en Área Operativa = OK; en Consejo = violación', () => {
    expect(violacionesSemanticas([{ id: 'esc', area: 2 }], areas, byId)).toHaveLength(0);
    expect(violacionesSemanticas([{ id: 'esc', area: 1 }], areas, byId)).toHaveLength(1);
  });

  it('CUALQUIER mueble dentro de un sanitario = violación (no amueblamos baños)', () => {
    expect(violacionesSemanticas([{ id: 'silla', area: 4 }], areas, byId)).toHaveLength(1);
    expect(violacionesSemanticas([{ id: 'mesa', area: 4 }], areas, byId)).toHaveLength(1);
  });

  it('una silla operativa explícita sólo pasa en Área Operativa', () => {
    expect(violacionesSemanticas([{ id: 'silla', area: 2 }], areas, byId)).toHaveLength(0);
    expect(violacionesSemanticas([{ id: 'silla', area: 0 }], areas, byId)).toHaveLength(1);
  });

  it('una SONATA marcada para juntas no puede escapar al open', () => {
    expect(violacionesSemanticas([{ id: 'sillaJuntas', area: 1 }], areas, byId)).toHaveLength(0);
    expect(violacionesSemanticas([{ id: 'sillaJuntas', area: 2 }], areas, byId)).toHaveLength(1);
    expect(rolDePiezaAcomodo(byId.sillaJuntas)).toBe(ROL2.MEETING_SEAT);
  });

  it('helpers directos', () => {
    expect(rolDePiezaAcomodo(byId.mesa)).toBe(ROL2.TABLE);
    expect(zonaPermite(ROL2.TABLE, ZONA2.CEO)).toBe(false);
    expect(zonaPermite(ROL2.TABLE, ZONA2.CONSEJO)).toBe(true);
  });
});


describe('FloorSpec hardening · referencias y semántica', () => {
  it('observación que refiere zona inexistente ⇒ INVALID', () => {
    const spec = {
      envelope: { width_mm: 5000, height_mm: 4000 },
      zones: [{ id:'z1', name:'Área Operativa', polygon:[[0,0],[5000,0],[5000,4000],[0,4000]] }],
      furniture_observations: [{ id:'m1', semantic_role: ROL.WORKSTATION, zone_id:'z404', center:[1000,1000] }],
    };
    const r = validarFloorSpec(spec);
    expect(r.status).toBe('INVALID');
    expect(r.issues.some((i) => i.code === 'ZONA_REFERENCIADA_INEXISTENTE')).toBe(true);
  });

  it('ids de observación duplicados ⇒ INVALID', () => {
    const spec = {
      envelope: { width_mm: 5000, height_mm: 4000 },
      zones: [{ id:'z1', name:'Área Operativa', polygon:[[0,0],[5000,0],[5000,4000],[0,4000]] }],
      furniture_observations: [
        { id:'dup', semantic_role: ROL.WORKSTATION, zone_id:'z1', center:[1000,1000] },
        { id:'dup', semantic_role: ROL.WORK_SEAT, zone_id:'z1', center:[2000,1000] },
      ],
    };
    const r = validarFloorSpec(spec);
    expect(r.status).toBe('INVALID');
    expect(r.issues.some((i) => i.code === 'MUEBLE_ID_DUPLICADO')).toBe(true);
  });

  it('rol semántico incompatible con la zona ⇒ INVALID', () => {
    const spec = {
      envelope: { width_mm: 5000, height_mm: 4000 },
      zones: [{ id:'z1', name:'SANITARIOS H', polygon:[[0,0],[5000,0],[5000,4000],[0,4000]] }],
      furniture_observations: [{ id:'mesa', semantic_role: ROL.TABLE, zone_id:'z1', center:[1000,1000] }],
    };
    const r = validarFloorSpec(spec);
    expect(r.status).toBe('INVALID');
    expect(r.issues.some((i) => i.code === 'ROL_NO_PERTENECE_A_ZONA')).toBe(true);
  });
});
