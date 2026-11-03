// COSTEAR 100 · FASE 4/B — contrato de subsistemas.
// Clasifica cualquier despiece en subsistemas de fabricación y fija la UBICACIÓN
// ECONÓMICA de cada uno (fábrica / compra-venta / proyecto / confirmar) para impedir
// omisiones y dobles cargos. Consistente con el motor (herrajes = compra-venta).
import { describe, it, expect } from 'vitest';
import { subsistemaDePieza, clasificarPorSubsistema, catalogoSubsistemas, UBICACION } from './subsistemas.js';

describe('subsistemas · clasificación por pieza', () => {
  const casos = [
    ['Lámina negra calibre 18', 'estructura'],
    ['Tubular industrial 1"', 'estructura'],
    ['Cubierta melamina', 'paneleria'],
    ['Bisagra recta 110°', 'herrajes'],
    ['Corredera de extensión', 'herrajes'],
    ['Tira LED 12V', 'electrico'],
    ['Driver 60W', 'electrico'],
    ['Cristal templado 6 mm', 'transparentes'],
    ['Pintura en polvo PPH blanco', 'acabados'],
    ['Tapacanto ABS', 'acabados'],
    ['Refrigerador comercial', 'equipos'],
    ['Embalaje y maniobras de envío', 'embalaje_logistica'],
  ];
  for (const [nombre, clave] of casos) {
    it(`"${nombre}" → ${clave}`, () => {
      expect(subsistemaDePieza({ nombre })).toBe(clave);
    });
  }
});

describe('subsistemas · ubicación económica inequívoca (sin mezclar fábrica/proyecto)', () => {
  it('herrajes = compra-venta (consistente con el motor, decisión Dirección)', () => {
    const r = clasificarPorSubsistema({ piezas: [{ nombre: 'Bisagra', semantic_role: 'herraje' }] });
    expect(r.grupos.herrajes.ubicacion).toBe(UBICACION.COMPRA_VENTA);
  });

  it('embalaje = PROYECTO, no costo de fábrica', () => {
    const r = clasificarPorSubsistema({ piezas: [{ nombre: 'Embalaje de envío' }] });
    expect(r.grupos.embalaje_logistica.ubicacion).toBe(UBICACION.PROYECTO);
    expect(r.resumen.proyecto).toContain('embalaje_logistica');
    expect(r.resumen.fabrica).not.toContain('embalaje_logistica');
  });

  it('estructura y panelería = fábrica', () => {
    const r = clasificarPorSubsistema({ piezas: [
      { nombre: 'Lámina negra' }, { nombre: 'Cubierta melamina', semantic_role: 'cubierta' },
    ] });
    expect(r.resumen.fabrica).toEqual(expect.arrayContaining(['estructura', 'paneleria']));
  });

  it('equipos → requiere decisión económica (confirmar)', () => {
    const r = clasificarPorSubsistema({ piezas: [{ nombre: 'Pantalla / monitor 55"' }] });
    expect(r.grupos.equipos.ubicacion).toBe(UBICACION.CONFIRMAR);
    expect(r.resumen.requiere_decision_economica).toBe(true);
  });

  it('catalogoSubsistemas expone los 8 subsistemas con su ubicación', () => {
    const cat = catalogoSubsistemas();
    expect(cat.length).toBe(8);
    expect(cat.map((c) => c.clave)).toEqual(expect.arrayContaining(['estructura', 'paneleria', 'herrajes', 'electrico', 'transparentes', 'acabados', 'equipos', 'embalaje_logistica']));
  });
});

describe('subsistemas · módulo REAL TELCEL (C-CO-320R · Almacenamiento METAL)', () => {
  const piezasTelcel = [
    { nombre: 'LAMINA NEGRA HOJA 3 X 8 CALIBRE 18 ACERO 1008 - LN1838' },
    { nombre: 'PINTURA EN POLVO - PPH (COLOR METAL BLANCO 9016 TELCEL)' },
    { nombre: 'BISAGRA BIDIMENSIONAL 110° - BIBI', semantic_role: 'herraje' },
    { nombre: 'Superficie de trabajo, cubierta MDF 12mm laminado blanco', semantic_role: 'cubierta' },
  ];
  it('separa estructura+acabados+panelería (fábrica) de herrajes (compra-venta)', () => {
    const r = clasificarPorSubsistema({ piezas: piezasTelcel });
    expect(r.presentes).toEqual(expect.arrayContaining(['estructura', 'acabados', 'herrajes', 'paneleria']));
    expect(r.resumen.fabrica).toEqual(expect.arrayContaining(['estructura', 'acabados', 'paneleria']));
    expect(r.resumen.compra_venta).toContain('herrajes');
    expect(r.sinClasificar).toBe(0);
  });
});
