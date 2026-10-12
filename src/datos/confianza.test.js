import { describe, it, expect } from 'vitest';
import { confianzaDe, esFirme, textoConfianza } from './confianza.js';

// La exactitud se PESA POR DINERO, no por número de renglones: una banca de
// $40,000 con precio del modelo pesa más que seis archiveros firmes de $3,000.
describe('qué tan firme es la propuesta', () => {
  const P = (id, precio, cant, real, linea) => ({ id, precioUnitario: precio, cantidad: cant, precioReal: real, linea });

  it('pesa por importe, no por renglones', () => {
    const c = confianzaDe([P('a', 40000, 1, false, 'Alba'), P('b', 3000, 6, true, 'Modulor')]);
    expect(c.total).toBe(58000);
    expect(c.montoFirme).toBe(18000);
    expect(c.pct).toBe(31);          // 6 de 7 piezas son firmes, pero sólo el 31% del dinero
  });

  it('ordena las líneas flojas por cuánto dinero sostienen', () => {
    const c = confianzaDe([
      P('a', 10000, 1, false, 'Eclipse'), P('b', 50000, 1, false, 'Alba'), P('c', 5000, 1, true, 'App LT'),
    ]);
    expect(c.lineasFlojas.map((l) => l.linea)).toEqual(['Alba', 'Eclipse']);
    expect(c.lineasFlojas[0].monto).toBe(50000);
  });

  it('lo del banco cuenta como firme: es un precio ya vendido', () => {
    expect(esFirme({ deBanco: true })).toBe(true);
    expect(esFirme({ precioReal: true })).toBe(true);
    expect(esFirme({})).toBe(false);
  });

  it('no truena con la propuesta vacía', () => {
    const c = confianzaDe([]);
    expect(c.pct).toBe(0);
    expect(textoConfianza(c)).toBe(null);
  });

  it('el aviso cambia de tono según cuánto sostiene el modelo', () => {
    expect(textoConfianza(confianzaDe([P('a', 100, 1, true, 'X')]))).toMatch(/defender/);
    expect(textoConfianza(confianzaDe([P('a', 100, 1, false, 'X')]))).toMatch(/modelo/);
  });
});


  it('una partida sin precio vuelve la confianza NO evaluable, no mejora el porcentaje', () => {
    const c=confianzaDe([
      {id:'a',precioUnitario:10000,cantidad:1,precioReal:true,linea:'Firme'},
      {id:'b',precioUnitario:null,cantidad:1,precioReal:false,linea:'Desconocida'},
    ]);
    expect(c.pct).toBeNull();
    expect(c.completa).toBe(false);
    expect(c.nDesconocidas).toBe(1);
    expect(textoConfianza(c)).toMatch(/no tienen precio\/cantidad verificable/i);
  });

  it('cero real sigue siendo un número conocido, distinto de null', () => {
    const c=confianzaDe([{id:'a',precioUnitario:0,cantidad:1,precioReal:true,linea:'Cero real'}]);
    expect(c.completa).toBe(true);
    expect(c.pct).toBe(0);
  });
