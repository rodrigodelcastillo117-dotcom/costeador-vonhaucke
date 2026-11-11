import { describe, it, expect } from 'vitest';
import { sanearTermino, orIlike } from './busquedaSegura.js';

describe('sanearTermino · neutraliza la sintaxis de PostgREST .or()', () => {
  it('coma → comodín (el caso que rompía la consulta)', () => {
    expect(sanearTermino('a,b')).toBe('a%b');
  });
  it('paréntesis → comodín, conserva el espacio', () => {
    expect(sanearTermino('mesa (chica)')).toBe('mesa %chica%');
  });
  it('punto y dos-puntos → comodín', () => {
    expect(sanearTermino('ref.123:x')).toBe('ref%123%x');
  });
  it('colapsa comodines repetidos y recorta', () => {
    expect(sanearTermino('  (( ))  ')).toBe('% %');   // degenerado pero seguro (ilike válido)
    expect(sanearTermino('a,,b')).toBe('a%b');
  });
  it('texto normal queda intacto', () => {
    expect(sanearTermino('vitrina torre')).toBe('vitrina torre');
  });
  it('null / undefined / vacío ⇒ cadena vacía', () => {
    expect(sanearTermino(null)).toBe('');
    expect(sanearTermino(undefined)).toBe('');
    expect(sanearTermino('   ')).toBe('');
  });
});

describe('orIlike · arma el filtro multi-columna sin romper .or()', () => {
  it('término normal en 2 columnas', () => {
    expect(orIlike('mesa', ['nombre', 'codigo'])).toBe('nombre.ilike.%mesa%,codigo.ilike.%mesa%');
  });
  it('el término con coma ya NO inyecta una condición extra', () => {
    const f = orIlike('a,b', ['nombre', 'codigo']);
    // La coma del usuario se volvió comodín; queda UNA sola coma: la que separa las 2 columnas.
    expect(f).toBe('nombre.ilike.%a%b%,codigo.ilike.%a%b%');
    expect((f.match(/,/g) || []).length).toBe(1);
  });
  it('sin término o sin columnas ⇒ null (no filtrar)', () => {
    expect(orIlike('', ['nombre'])).toBeNull();
    expect(orIlike('   ', ['nombre'])).toBeNull();
    expect(orIlike('mesa', [])).toBeNull();
  });
});
