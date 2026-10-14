import { describe, it, expect } from 'vitest';
import { esExpedientePrueba, filtrarBiblioteca } from './expedientesPrueba.js';

describe('Biblioteca · expedientes de prueba ocultos por omisión (sin borrar)', () => {
  const items = [
    { id: 159, nombre: 'PRUEBA RC · PRUEBA RC librero 5x8 post SEG-01b', etiquetas: ['prueba-rc'] },
    { id: 120, nombre: 'Credenza lab r3', etiquetas: ['qa-archivado'] },
    { id: 60, nombre: 'PRUEBA RC · sin etiqueta', etiquetas: [] },
    { id: 2, nombre: 'Cabecera Soriana', etiquetas: ['soriana'] },
    { id: 3, nombre: 'Mesa prueba de color', etiquetas: [] }, // la palabra "prueba" en el nombre NO la oculta
  ];
  it('oculta etiquetas prueba-rc/qa-archivado y el prefijo RC; deja los reales', () => {
    const r = filtrarBiblioteca(items);
    expect(r.visibles.map((e) => e.id)).toEqual([2, 3]);
    expect(r.ocultas).toBe(3);
  });
  it('el interruptor las muestra todas', () => {
    expect(filtrarBiblioteca(items, { mostrarPruebas: true }).visibles).toHaveLength(5);
  });
  it('mayúsculas en la etiqueta no la burlan; null no truena', () => {
    expect(esExpedientePrueba({ nombre: 'x', etiquetas: ['QA-Archivado'] })).toBe(true);
    expect(esExpedientePrueba(null)).toBe(false);
  });
});
