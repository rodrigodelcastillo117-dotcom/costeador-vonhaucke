// SEMÁFORO DE CERTIFICACIÓN — clasifica el reporte de costearBOM por línea y acción.
import { describe, it, expect } from 'vitest';
import { costearBOM } from './productoMaestro.js';
import { semaforoLinea, semaforoCertificacion } from './semaforoCertificacion.js';

describe('semáforo · por línea', () => {
  it('catálogo fresco = verde', () => {
    expect(semaforoLinea({ fuente: 'catalogo', fresco: true }).nivel).toBe('verde');
  });
  it('catálogo vencido = ambar, acción = Compras refresca', () => {
    const s = semaforoLinea({ fuente: 'catalogo', fresco: false });
    expect(s.nivel).toBe('ambar');
    expect(s.accion).toMatch(/compras/i);
  });
  it('precio de estimaciones (confirmado) = gris, acción = alta en catálogo', () => {
    const s = semaforoLinea({ fuente: 'confirmado' });
    expect(s.nivel).toBe('gris');
    expect(s.accion).toMatch(/alta/i);
  });
  it('bloqueada = rojo, con motivo', () => {
    const s = semaforoLinea({ bloquea: true, estado: 'unidad_incompatible' });
    expect(s.nivel).toBe('rojo');
    expect(s.motivo).toBe('unidad_incompatible');
  });
  it('excluido/cliente = verde (cuesta 0 legítimo)', () => {
    expect(semaforoLinea({ fuente: 'cero' }).nivel).toBe('verde');
  });
});

describe('semáforo · costeo completo (sobre costearBOM real)', () => {
  it('resume por nivel y agrupa acciones por severidad', () => {
    const insumos = {
      fresco:  { precio: 10, unidad: 'pza', evidencia: { certificable: true } },
      viejo:   { precio: 20, unidad: 'pza', evidencia: { certificable: false } },
    };
    const bom = { clave: 'T', tipo_bom: 'BOM_DETALLADO_VERIFICADO', lineas: [
      { desc: 'fresco', insumoId: 'fresco', cantidad: 1 },        // verde
      { desc: 'viejo',  insumoId: 'viejo',  cantidad: 1 },        // ambar
      { desc: 'historico', cantidad: 1, precioConfirmado: 5 },    // gris
      { desc: 'sin precio', insumoId: 'noexiste', cantidad: 1 },  // rojo (precio_faltante)
    ] };
    const r = costearBOM(bom, insumos);
    const s = semaforoCertificacion(r);
    expect(s.filas.length).toBe(4);
    expect(s.resumen).toEqual({ verde: 1, ambar: 1, gris: 1, rojo: 1 });
    expect(s.emitible).toBe(false);          // la línea roja bloquea
    expect(s.certificable).toBe(false);
    // acciones ordenadas por severidad: rojo primero
    expect(s.acciones[0].nivel).toBe('rojo');
    expect(s.acciones.map((a) => a.nivel)).toEqual(['rojo', 'gris', 'ambar']);
  });

  it('todo fresco → verde, sin acciones, certificable', () => {
    const insumos = { a: { precio: 10, unidad: 'pza', evidencia: { certificable: true } } };
    const bom = { clave: 'T', tipo_bom: 'BOM_DETALLADO_VERIFICADO', lineas: [{ desc: 'x', insumoId: 'a', cantidad: 1 }] };
    const s = semaforoCertificacion(costearBOM(bom, insumos));
    expect(s.resumen.verde).toBe(1);
    expect(s.acciones).toEqual([]);
    expect(s.certificable).toBe(true);
  });
});
