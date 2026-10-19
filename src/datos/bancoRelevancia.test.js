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

// Certificación 18-oct: la prueba de arriba ordenaba la LISTA, pero la pantalla pintaba los grupos en orden fijo y
// "Agregar" tomaba el primer renglón visible (un escritorio gerencial). Esto prueba lo que el vendedor VE primero.
import { categoriasEnOrden, BANCO_CATEGORIAS } from './banco.js';
const primeroEnPantalla = (q) => {
  const lista = buscar(q);
  const c = categoriasEnOrden(lista, q)[0];
  return lista.find((p) => p.categoria === c);
};
describe('Banco de precios · lo primero que se ve en pantalla', () => {
  it('"archivero": el primer renglón visible es un archivero (antes: App · Escritorio gerencial)', () => {
    expect(primeroEnPantalla('archivero').nombre).toMatch(/archivero/i);
  });
  it('"bench 6" y "mesa de juntas" siguen igual', () => {
    expect(primeroEnPantalla('bench 6').nombre).toMatch(/operativo|bench/i);
    expect(primeroEnPantalla('mesa de juntas').nombre).toMatch(/mesa de juntas/i);
  });
  it('sin búsqueda: el orden fijo de siempre; con búsqueda no se pierde ningún grupo', () => {
    const todo = bancoUnico();
    expect(categoriasEnOrden(todo, '')).toEqual(BANCO_CATEGORIAS.filter((c) => todo.some((p) => p.categoria === c)));
    const r = buscar('archivero');
    expect(new Set(categoriasEnOrden(r, 'archivero'))).toEqual(new Set(r.map((p) => p.categoria)));
  });
});
