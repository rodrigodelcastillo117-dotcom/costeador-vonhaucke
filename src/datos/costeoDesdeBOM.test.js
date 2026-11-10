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
  });

  it('graficos/iluminacion = compra-venta (x1.06), lo demas fabricado', () => {
    const r = costearBOM([
      { nombre: 'Lamina', costo: 1000, seccion: 'metal' },
      { nombre: 'Sticker logo', costo: 100, seccion: 'graficos' },
      { nombre: 'Kit LED', costo: 500, seccion: 'iluminacion' },
    ]);
    expect(r.material_fabricado).toBe(1000);
    expect(r.material_compra_venta).toBe(600);   // graficos + iluminacion
    // fab: 1000*0.20=200 MO, (1200)*0.5=600 GIF ; cv: 600*0.01=6 MO, 600*0.05=30 GIF
    expect(r.mano_obra).toBe(206);
    expect(r.gif).toBe(630);
    expect(r.costo_total).toBe(1000 + 600 + 206 + 630);
  });

  it('FAIL-CLOSED: linea sin precio NO se pone en $0; se reporta y el costeo se BLOQUEA', () => {
    const r = costearBOM([
      { nombre: 'Lamina', costo: 1000, seccion: 'metal' },
      { nombre: 'Corredera sin precio', cantidad: 2, seccion: 'herrajes' },  // sin precio
    ]);
    expect(r.completo).toBe(false);
    expect(r.estado).toBe('BLOQUEADO');
    expect(r.faltantes).toHaveLength(1);
    expect(r.faltantes[0].nombre).toMatch(/Corredera/);
    expect(r.material_fabricado).toBe(1000);   // sólo lo que sí tenía precio
  });

  it('precio*cantidad cuando no hay costo directo', () => {
    const r = costearBOM([{ nombre: 'Nivelador', precio: 40.70, cantidad: 4, seccion: 'herrajes' }]);
    expect(r.material).toBeCloseTo(162.8, 2);
  });

  it('marca ESTIMADO si alguna linea trae consumo supuesto', () => {
    const r = costearBOM([{ nombre: 'Lamina por area', costo: 766, seccion: 'metal', estimado: true }]);
    expect(r.estado).toBe('ESTIMADO');
  });
});

describe('costeoDesdeBOM · advertencia del hueco de terceros (no cambia la verdad, la expone)', () => {
  it('cristal templado / termoformado clasificados FABRICADO disparan aviso', () => {
    const r = costearBOM([
      { nombre: 'Lamina', costo: 1000, seccion: 'metal' },
      { nombre: 'Cristal templado 6mm', costo: 900, seccion: 'cristal' },
      { nombre: 'Capelo termoformado acrilico', costo: 2840, seccion: 'acrilico' },
    ]);
    // cristal y acrilico NO estan en CV_SECCIONES -> el motor los cobra como fabricado
    expect(r.material_compra_venta).toBe(0);
    expect(r.advertencias.length).toBe(2);
    expect(r.advertencias.map((a) => a.nombre).join(' ')).toMatch(/Cristal.*termoformado|termoformado.*Cristal|Cristal/);
    expect(r.advertencias[0].aviso).toMatch(/compra-venta|Direccion/);
  });

  it('sin terceros sospechosos -> sin advertencias', () => {
    expect(advertenciasTerceros([{ nombre: 'Lamina c18', tipo: 'fabricado' }])).toHaveLength(0);
  });
});
