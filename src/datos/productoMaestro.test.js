import { describe, it, expect } from 'vitest';
import fixture from './fuentes/producto_maestro.json';
import { PRECIOS_LINEA } from './preciosLinea.js';
import { BANCO } from './banco.js';

// ---------------------------------------------------------------------------
//  PRODUCTO MAESTRO — cobertura de identidad (#19) y regresión de centavos (#12).
//  `producto_maestro.json` es un snapshot (identidad + precio AUTORIZADO, SIN costo)
//  generado desde Supabase. Estas pruebas demuestran, OFFLINE y determinista, que:
//   (1) cada identificador comercial del frontend (clave de línea `c`, id de banco)
//       resuelve a un producto del Maestro con precio — sin fuzzy matching;
//   (2) el precio que resuelve es EXACTAMENTE el precio comercial legacy (delta 0).
//  Si algo no calza, la prueba IMPRIME el residual exacto (no lo esconde).
// ---------------------------------------------------------------------------
const precioPorRef = fixture.precio_por_ref;
const lineaConPrecio = PRECIOS_LINEA.filter((a) => Number(a.l) > 0);   // los comercializables

describe('Producto Maestro — cobertura de identidad (frontend → source_ref)', () => {
  it('TOTAL del snapshot = 1931 (1716 línea + 215 banco)', () => {
    expect(fixture.total).toBe(1931);
    expect(Object.keys(precioPorRef).length).toBe(1931);
  });

  it('LÍNEA: toda clave `c` con precio>0 resuelve a Producto Maestro (match único, con precio)', () => {
    const sinMatch = [];
    for (const a of lineaConPrecio) if (!(a.c in precioPorRef)) sinMatch.push(a.c);
    if (sinMatch.length) console.warn(`LINEA sin match (${sinMatch.length}):`, sinMatch.slice(0, 25));
    expect(sinMatch).toEqual([]);
  });

  it('BANCO: todo id resuelve a Producto Maestro (match único, con precio)', () => {
    const sinMatch = [];
    for (const b of BANCO) if (!(b.id in precioPorRef)) sinMatch.push(b.id);
    if (sinMatch.length) console.warn(`BANCO sin match (${sinMatch.length}):`, sinMatch.slice(0, 25));
    expect(sinMatch).toEqual([]);
  });
});

describe('Producto Maestro — regresión de centavos (precio legacy == precio autorizado, delta 0)', () => {
  it('LÍNEA: preciosLinea.l === precio autorizado del Maestro, al peso, para TODAS', () => {
    const difs = [];
    for (const a of lineaConPrecio) {
      const pm = precioPorRef[a.c];
      if (pm == null) continue;                 // falta de identidad la cubre el test de cobertura
      if (Math.round(Number(a.l)) !== pm) difs.push(`${a.c}: legacy=${a.l} maestro=${pm}`);
    }
    if (difs.length) console.warn(`LINEA delta!=0 (${difs.length}):`, difs.slice(0, 25));
    expect(difs).toEqual([]);
  });

  it('BANCO: banco.precio === precio autorizado del Maestro, al peso, para TODAS', () => {
    const difs = [];
    for (const b of BANCO) {
      const pm = precioPorRef[b.id];
      if (pm == null) continue;
      if (Math.round(Number(b.precio)) !== pm) difs.push(`${b.id}: legacy=${b.precio} maestro=${pm}`);
    }
    if (difs.length) console.warn(`BANCO delta!=0 (${difs.length}):`, difs.slice(0, 25));
    expect(difs).toEqual([]);
  });
});
