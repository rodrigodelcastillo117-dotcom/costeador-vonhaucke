import { describe, it, expect } from 'vitest';
import { costearBOM, advertenciasTerceros } from './costeoDesdeBOM.js';

describe('costeoDesdeBOM · costea por el MOTOR real (POLITICA_VH)', () => {
  it('BOM fabricado: fab x(1+0.20) y GIF 0.50 sobre (mat+MO) — igual que el motor', () => {
    const r = costearBOM([
      { nombre: 'Lamina c18', costo: 1000, seccion: 'metal' },
      { nombre: 'Pintura polvo', costo: 200, seccion: 'pintura' },
    ]);
    expect(r.material).toBe(1200);
    expect(r.material_fabricado).toBe(1200);
    expect(r.material_compra_venta).toBe(0);
    expect(r.mano_obra).toBe(240);      // 1200 * 0.20
    expect(r.gif).toBe(720);            // (1200+240) * 0.50
    expect(r.costo_total).toBe(2160);
    expect(r.estado).toBe('COSTEADO');
    expect(r.oficial).toBe(true);
  });

  it('graficos/iluminacion = compra-venta (x1.06), lo demas fabricado', () => {
    const r = costearBOM([
      { nombre: 'Lamina', costo: 1000, seccion: 'metal' },
      { nombre: 'Sticker logo', costo: 100, seccion: 'graficos' },
      { nombre: 'Kit LED', costo: 500, seccion: 'iluminacion' },
    ]);
    expect(r.material_fabricado).toBe(1000);
    expect(r.material_compra_venta).toBe(600);   // graficos + iluminacion
    expect(r.mano_obra).toBe(206);
    expect(r.gif).toBe(630);
    expect(r.costo_total).toBe(1000 + 600 + 206 + 630);
    expect(r.oficial).toBe(true);
  });

  it('FAIL-CLOSED precio: linea sin precio NO se pone en $0; se reporta y el costeo se BLOQUEA', () => {
    const r = costearBOM([
      { nombre: 'Lamina', costo: 1000, seccion: 'metal' },
      { nombre: 'Corredera sin precio', cantidad: 2, seccion: 'herrajes' },
    ]);
    expect(r.completo).toBe(false);
    expect(r.estado).toBe('BLOQUEADO');
    expect(r.oficial).toBe(false);
    expect(r.faltantes).toHaveLength(1);
    expect(r.faltantes[0].nombre).toMatch(/Corredera/);
    expect(r.material_fabricado).toBe(1000);   // solo lo que si tenia precio
  });

  it('formaliza cada linea: cantidad, costo_unitario y costo_extendido explicitos', () => {
    const r = costearBOM([{ nombre: 'Nivelador', precio: 40.70, cantidad: 4, seccion: 'herrajes' }]);
    const l = r.detalle[0];
    expect(l.cantidad).toBe(4);
    expect(l.costo_unitario).toBeCloseTo(40.70, 2);
    expect(l.costo_extendido).toBeCloseTo(162.8, 2);   // 40.70 * 4
    expect(r.material).toBeCloseTo(162.8, 2);
  });

  it('marca ESTIMADO si alguna linea trae consumo supuesto', () => {
    const r = costearBOM([{ nombre: 'Lamina por area', costo: 766, seccion: 'metal', estimado: true }]);
    expect(r.estado).toBe('ESTIMADO');
  });

  it('DUPLICADO: la misma linea dos veces se marca como bloqueo (anti doble-conteo)', () => {
    const r = costearBOM([
      { nombre: 'Lamina c18', costo: 500, seccion: 'metal', largoMM: 1000, anchoMM: 500 },
      { nombre: 'Lamina c18', costo: 500, seccion: 'metal', largoMM: 1000, anchoMM: 500 },
    ]);
    expect(r.estado).toBe('BLOQUEADO');
    expect(r.oficial).toBe(false);
    expect(r.bloqueos.some((b) => /duplicada/i.test(b.motivo))).toBe(true);
  });
});

describe('costeoDesdeBOM · TERCEROS fail-closed (bloqueo 1: no basta advertencia)', () => {
  it('cristal templado / termoformado SIN clasificar BLOQUEAN el costo oficial (no x1.80 en silencio)', () => {
    const r = costearBOM([
      { nombre: 'Lamina', costo: 1000, seccion: 'metal' },
      { nombre: 'Cristal templado 6mm', costo: 900, seccion: 'cristal' },
      { nombre: 'Capelo termoformado acrilico', costo: 2840, seccion: 'acrilico' },
    ]);
    expect(r.estado).toBe('BLOQUEADO');
    expect(r.oficial).toBe(false);                 // el costo NO es oficial
    expect(r.bloqueos.length).toBeGreaterThanOrEqual(2);
    expect(r.bloqueos.map((b) => b.nombre).join(' ')).toMatch(/Cristal|termoformado/i);
    expect(r.detalle.filter((d) => d.tercero_ambiguo).length).toBe(2);
  });

  it('con clasificacion declarada "compra_venta" (Ingenieria/Compras), el tercero fluye a x1.06 y desbloquea', () => {
    const r = costearBOM([
      { nombre: 'Lamina', costo: 1000, seccion: 'metal' },
      { nombre: 'Cristal templado 6mm', costo: 900, seccion: 'cristal', clasificacion: 'compra_venta' },
    ]);
    expect(r.estado).toBe('COSTEADO');
    expect(r.oficial).toBe(true);
    expect(r.material_compra_venta).toBe(900);     // el cristal entro como compra-venta
    expect(r.material_fabricado).toBe(1000);
    // cristal x1.06: MO 900*0.01=9, GIF 900*0.05=45 ; lamina fab: MO 200, GIF (1200)*0.5=600
    expect(r.mano_obra).toBe(209);
    expect(r.gif).toBe(645);
  });

  it('con clasificacion declarada "fabricado" (se hace en casa), se cobra x1.80 explicitamente y desbloquea', () => {
    const r = costearBOM([
      { nombre: 'Cristal cortado en taller', costo: 1000, seccion: 'cristal', clasificacion: 'fabricado' },
    ]);
    expect(r.estado).toBe('COSTEADO');
    expect(r.oficial).toBe(true);
    expect(r.material_fabricado).toBe(1000);
    expect(r.costo_total).toBe(1800);              // x1.80 declarado, sin ambiguedad
  });

  it('sin terceros sospechosos -> sin advertencias', () => {
    expect(advertenciasTerceros([{ nombre: 'Lamina c18', tipo: 'fabricado' }])).toHaveLength(0);
  });
});
