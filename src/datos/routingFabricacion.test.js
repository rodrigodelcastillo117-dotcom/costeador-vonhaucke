// COSTEAR 100 · FASE 5/C — routing de fabricación.
// Propone las operaciones implícitas en el despiece, en secuencia de fábrica, con su
// centro de trabajo. NUNCA inventa tiempos certificados: todo queda PENDIENTE_TIEMPO
// y la MO del routing no es certificable hasta tener tiempos/tarifas reales.
import { describe, it, expect } from 'vitest';
import { proponerRouting, catalogoOperaciones } from './routingFabricacion.js';

const tiene = (r, op) => r.operaciones.find((o) => o.op === op);

describe('routingFabricacion · operaciones implícitas por material/rol', () => {
  it('módulo metálico (lámina + tubular) → corte + doblez + soldadura + esmerilado + armado', () => {
    const r = proponerRouting({ piezas: [
      { nombre: 'Lámina negra calibre 18' },
      { nombre: 'Tubular industrial cuadrado 1"' },
      { nombre: 'Lateral metálico', semantic_role: 'lateral' },
    ] });
    expect(tiene(r, 'corte_lamina')).toBeTruthy();
    expect(tiene(r, 'corte_tubo')).toBeTruthy();
    expect(tiene(r, 'soldadura')).toBeTruthy();
    expect(tiene(r, 'soldadura').centro).toBe('metalmecánica');
    expect(tiene(r, 'armado')).toBeTruthy();
  });

  it('REGRESIÓN: "cantos pulidos" del CRISTAL no es canteado de carpintería (falso positivo)', () => {
    const r = proponerRouting({ piezas: [
      { nombre: 'Lámina negra cuerpo metálico', semantic_role: 'lateral' },
      { nombre: 'CAPELO DE CRISTAL 6mm CLARO TEMPLADO CON CANTOS PULIDOS' },
    ] });
    expect(tiene(r, 'canteado')).toBeFalsy();               // vidrio con cantos pulidos ≠ tapacanto
    expect(tiene(r, 'corte_vidrio')).toBeTruthy();          // sí es corte de vidrio
    // y un tablero con tapacanto SÍ debe disparar canteado:
    const r2 = proponerRouting({ piezas: [
      { nombre: 'Cubierta melamina con tapacanto ABS' },
    ] });
    expect(tiene(r2, 'canteado')).toBeTruthy();
  });

  it('tablero + herrajes → corte de tablero + instalación de herrajes', () => {
    const r = proponerRouting({ piezas: [
      { nombre: 'Cubierta melamina', semantic_role: 'cubierta' },
      { nombre: 'Lateral melamina', semantic_role: 'lateral' },
      { nombre: 'Bisagra recta 110°', semantic_role: 'herraje' },
      { nombre: 'Corredera de extensión' },
    ] });
    expect(tiene(r, 'corte_tablero')).toBeTruthy();
    expect(tiene(r, 'instalacion_herrajes')).toBeTruthy();
    expect(tiene(r, 'instalacion_herrajes').centro).toBe('ensamble');
  });

  it('mueble SÓLO de melamina (sin metal) → NO propone soldadura ni corte de lámina (melamina ≠ lámina)', () => {
    const r = proponerRouting({ piezas: [
      { nombre: 'Cubierta melamina', semantic_role: 'cubierta' },
      { nombre: 'Lateral melamina', semantic_role: 'lateral' },
    ] });
    expect(tiene(r, 'soldadura')).toBeFalsy();
    expect(tiene(r, 'corte_lamina')).toBeFalsy();
    expect(tiene(r, 'corte_tablero')).toBeTruthy();
  });

  it('iluminación → cableado + pruebas eléctricas', () => {
    const r = proponerRouting({ piezas: [{ nombre: 'Tira LED 12V' }, { nombre: 'Driver 60W' }] });
    expect(tiene(r, 'cableado')).toBeTruthy();
    expect(tiene(r, 'pruebas_electricas')).toBeTruthy();
    expect(tiene(r, 'cableado').centro).toBe('eléctrico');
  });

  it('vidrio → corte de vidrio (posible tercero) + colocación', () => {
    const r = proponerRouting({ piezas: [{ nombre: 'Cristal templado 6 mm', semantic_role: 'cristal' }] });
    expect(tiene(r, 'corte_vidrio')).toBeTruthy();
    expect(tiene(r, 'corte_vidrio').tercero_probable).toBe(true);
    expect(tiene(r, 'colocacion_vidrio')).toBeTruthy();
  });

  it('pintura en polvo → preparación + electrostática + secado', () => {
    const r = proponerRouting({ piezas: [
      { nombre: 'Lámina negra' },
      { nombre: 'Pintura en polvo PPH blanco' },
    ] });
    expect(tiene(r, 'preparacion_superficie')).toBeTruthy();
    expect(tiene(r, 'pintura_electrostatica')).toBeTruthy();
    expect(tiene(r, 'secado_curado')).toBeTruthy();
  });
});

describe('routingFabricacion · honestidad (no inventa tiempos)', () => {
  it('ninguna operación trae tiempo/tarifa; todas PENDIENTE_TIEMPO y requieren validación', () => {
    const r = proponerRouting({ piezas: [{ nombre: 'Lámina negra' }, { nombre: 'Tubular 1"' }] });
    expect(r.operaciones.length).toBeGreaterThan(0);
    for (const o of r.operaciones) {
      expect(o.tiempo).toBeNull();
      expect(o.tarifa).toBeNull();
      expect(o.estado).toBe('PENDIENTE_TIEMPO');
      expect(o.requiere_validacion).toBe(true);
      expect(o.certeza).toBe('INFERIDO');
    }
    // La MO del routing NO es certificable hasta tener tiempos/tarifas reales.
    expect(r.resumen.mano_obra_certificable).toBe(false);
  });

  it('secuencia de fábrica: corte antes de soldadura antes de armado antes de embalaje', () => {
    const r = proponerRouting({ piezas: [
      { nombre: 'Lámina negra' }, { nombre: 'Tubular 1"' },
      { nombre: 'Lateral', semantic_role: 'lateral' }, { nombre: 'Cubierta', semantic_role: 'cubierta' },
    ] });
    const ord = (op) => r.operaciones.findIndex((o) => o.op === op);
    expect(ord('corte_lamina')).toBeLessThan(ord('soldadura'));
    expect(ord('soldadura')).toBeLessThan(ord('armado'));
    expect(ord('armado')).toBeLessThan(ord('embalaje'));
  });

  it('BOM vacío → sin operaciones; mano_obra_certificable null', () => {
    const r = proponerRouting({ piezas: [] });
    expect(r.operaciones).toHaveLength(0);
    expect(r.resumen.mano_obra_certificable).toBeNull();
  });

  it('catalogoOperaciones expone el catálogo', () => {
    const cat = catalogoOperaciones().map((o) => o.op);
    expect(cat).toContain('soldadura');
    expect(cat).toContain('corte_tablero');
    expect(cat.length).toBeGreaterThanOrEqual(15);
  });
});

describe('routingFabricacion · módulo REAL TELCEL (C-CO-320R · Almacenamiento METAL)', () => {
  const piezasTelcel = [
    { nombre: 'LAMINA NEGRA HOJA 3 X 8 CALIBRE 18 ACERO 1008 - LN1838' },
    { nombre: 'LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 - LN18310' },
    { nombre: 'PINTURA EN POLVO - PPH (COLOR METAL BLANCO 9016 TELCEL)' },
    { nombre: 'BISAGRA BIDIMENSIONAL, MONTAJE SOBREPUESTO, ANGULO DE 110° - BIBI', semantic_role: 'herraje' },
    { nombre: 'Superficie de trabajo, cubierta MDF 12mm laminado blanco', semantic_role: 'cubierta' },
  ];
  it('propone soldadura, pintura electrostática, instalación de herrajes; MO no certificable', () => {
    const r = proponerRouting({ piezas: piezasTelcel });
    expect(tiene(r, 'soldadura')).toBeTruthy();            // lámina (≥2) → unión
    expect(tiene(r, 'pintura_electrostatica')).toBeTruthy(); // pintura en polvo
    expect(tiene(r, 'instalacion_herrajes')).toBeTruthy();   // bisagra
    expect(r.resumen.mano_obra_certificable).toBe(false);
    expect(r.resumen.por_centro['metalmecánica']).toBeGreaterThanOrEqual(1);
  });
});
