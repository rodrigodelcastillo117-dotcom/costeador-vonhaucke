// ============================================================================
//  TECLEAR UN PORCENTAJE  ·  es dinero, y se teclea enfrente del cliente.
//
//  El campo era controlado y pasaba por `leePct` en CADA pulsación, así que un
//  número con punto decimal era IMPOSIBLE de escribir: el punto se lo tragaba y
//  lo que quedaba se topaba en el máximo. Medido tecla por tecla, "12.5" en un
//  campo de máximo 30 terminaba en 30. Un 12.5% de descuento se volvía el tope.
//
//  Ahora el campo guarda el TEXTO mientras escribes y sólo lee al salir. Esta
//  prueba fija las dos mitades: que `leePct` acote bien al CERRAR, y que la
//  secuencia tecla-por-tecla ya no destruya el número.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { leePct } from '../util.js';

// Lo que hacía ANTES: leer y reescribir el campo en cada tecla.
const tecleoViejo = (texto, max) => {
  let campo = '';
  for (const t of texto) campo = String(leePct(campo + t, max));
  return Number(campo);
};
// Lo que hace AHORA: el texto se conserva y se lee UNA vez, al cerrar.
const tecleoNuevo = (texto, max) => leePct(texto, max);

describe('teclear un porcentaje', () => {
  it('🐛 el modo viejo convertía 12.5 en el TOPE', () => {
    expect(tecleoViejo('12.5', 30)).toBe(30);
    expect(tecleoViejo('0.5', 30)).toBe(5);
  });

  it('el modo nuevo respeta el decimal', () => {
    expect(tecleoNuevo('12.5', 30)).toBe(12.5);
    expect(tecleoNuevo('0.5', 30)).toBe(0.5);
    expect(tecleoNuevo('7,5', 30)).toBe(7.5);      // coma, como se teclea en México
  });

  it('al cerrar sigue acotando: nada arriba del máximo ni bajo cero', () => {
    expect(leePct('99', 30)).toBe(30);
    expect(leePct('-4', 30)).toBe(0);
    expect(leePct('', 30)).toBe(0);
    expect(leePct('abc', 30)).toBe(0);
  });

  it('un porcentaje entero normal no cambia de comportamiento', () => {
    for (const n of [0, 3, 10, 15, 30]) expect(leePct(String(n), 60)).toBe(n);
  });
});
