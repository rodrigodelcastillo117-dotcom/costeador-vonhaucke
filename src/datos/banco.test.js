import { describe, it, expect } from 'vitest';
import { BANCO, bancoUnico, llaveArticulo, conCabecera } from './banco.js';

// ============================================================================
//  LA REGLA DE LA CABECERA — la dictó Rodrigo el 2026-08-17:
//  "la diferencia de WIN y WIN-CAB es que la que dice CAB TIENE CABECERA, por
//   eso diferente precio, supongo que también hay más modelos que cambian por
//   tener CAB en la clave".
//  Se prueba porque las dos formas de romperlo son invisibles en pantalla:
//  fusionar dos sillas distintas (desaparece una), o dejar triplicada la misma.
// ============================================================================
describe('sillería · el sufijo CAB es la cabecera', () => {
  it('WIN y WIN-CAB NO se fusionan: son dos sillas y dos precios', () => {
    const u = bancoUnico();
    const win = u.filter((p) => /· WIN\b/.test(p.nombre) && !/cabecera/i.test(p.nombre));
    const cab = u.filter((p) => /WIN-CAB/.test(p.nombre));
    expect(win).toHaveLength(1);
    expect(cab).toHaveLength(1);
    expect(win[0].precio).toBe(5210);
    expect(cab[0].precio).toBe(5900);
    expect(llaveArticulo(win[0])).not.toBe(llaveArticulo(cab[0]));
  });

  it('el mismo modelo con cabecera cargado de varios presupuestos sale UNA vez', () => {
    // C4-EL-BNF venía tres veces: clave `-CABF`, clave `-CAB` y a secas.
    const u = bancoUnico().filter((p) => /C4-EL-BNF\b/.test(p.nombre));
    expect(u).toHaveLength(1);
    expect(u[0].nombre).toMatch(/cabecera/i);
  });

  it('el nombre que ve la gente dice “con cabecera”, y la clave NO se toca', () => {
    const conCab = BANCO.filter(conCabecera);
    expect(conCab.length).toBeGreaterThan(0);
    for (const p of conCab) {
      expect(p.nombre).toMatch(/cabecera/i);
      expect(p.clave).toMatch(/-CABF?$/);   // la clave es lo que se le pide a Compras
    }
  });

  it('CAB dentro de un código que no es silla no se confunde con cabecera', () => {
    // `LEGCAB08060099` es un GABINETE: lleva CAB a media clave, no al final.
    const gab = BANCO.find((p) => p.clave === 'LEGCAB08060099');
    expect(gab).toBeTruthy();
    expect(conCabecera(gab)).toBe(false);
    expect(gab.nombre).not.toMatch(/cabecera/i);
  });
});
