import { describe, it, expect } from 'vitest';
import { bancoUnico } from './banco.js';
import { coincide, ordenarPorRelevancia } from '../util.js';

// Operación 10/10 · M1 (Cotizar manual, banco de precios): "archivero" agregaba un escritorio y "credenza"
// una recepción, porque su descripción menciona la palabra y la lista no tenía orden de relevancia.
const buscar = (q) => ordenarPorRelevancia(bancoUnico().filter((p) => coincide(q, p.nombre, p.descripcion, p.clave, p.medidas, p.material, p.linea, p.categoria)), q);

describe('Banco de precios · relevancia de la búsqueda', () => {
  it('"archivero": el primer resultado es un archivero', () => {
    expect(buscar('archivero')[0].nombre).toMatch(/archivero/i);
  });
  it('"credenza": primero lo que se llama credenza; no se quita ningún resultado', () => {
    const r = buscar('credenza');
    const sinOrden = bancoUnico().filter((p) => coincide('credenza', p.nombre, p.descripcion, p.clave, p.medidas, p.material, p.linea, p.categoria));
    expect(r).toHaveLength(sinOrden.length);
    expect(coincide('credenza', r[0].nombre)).toBe(true);
  });
  it('orden estable dentro del mismo rango', () => {
    const L = [{ nombre: 'b x' }, { nombre: 'a' }, { nombre: 'c x' }];
    expect(ordenarPorRelevancia(L, 'x').map((p) => p.nombre)).toEqual(['b x', 'c x', 'a']);
  });
});
