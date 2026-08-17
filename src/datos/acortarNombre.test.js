// ============================================================================
//  EL NOMBRE DEL MUEBLE EN EL DOCUMENTO DEL CLIENTE.
//
//  Salió MIRANDO el PDF: la leyenda del plano decía
//     «Banca doble APP LT 1.50 · 6 usuarios, bio...»
//     «Eclipse · Escritorio directivo 2.10 m mano...»
//  Cortar a media palabra en la hoja que recibe el cliente se lee como un error
//  del sistema. Y el primer intento de arreglarlo salió PEOR (dejaba "Eclipse"
//  a secas, sin el mueble), así que eso también se cuida aquí.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { acortarNombre } from './pdfPropuesta.js';

// `cabe` simula la columna: en el PDF es el ancho en mm, aquí caracteres.
const hasta = (n) => (t) => t.length <= n;

describe('acortarNombre', () => {
  it('si cabe, no lo toca', () => {
    const n = 'Silla operativa WIN';
    expect(acortarNombre(n, hasta(40))).toBe(n);
  });

  it('quita la lista de accesorios que va tras la coma', () => {
    const n = 'Banca doble APP LT 1.50 · 6 usuarios, biombos laterales';
    expect(acortarNombre(n, hasta(38))).toBe('Banca doble APP LT 1.50 · 6 usuarios');
  });

  it('nunca parte una palabra a la mitad', () => {
    const n = 'Banca doble APP LT 1.50 · 6 usuarios, biombos laterales';
    for (let ancho = 12; ancho <= 60; ancho++) {
      const r = acortarNombre(n, hasta(ancho));
      const limpio = r.replace(/…$/, '').trim();
      // Cada palabra que queda tiene que ser una palabra COMPLETA del original.
      // Se compara sin la puntuación pegada: el original trae "usuarios," con
      // su coma y la salida ya la quitó — eso es correcto, no un corte.
      const pelar = (p) => p.replace(/^[·,]+|[·,]+$/g, '');
      const original = new Set(n.split(/\s+/).map(pelar));
      for (const p of limpio.split(/\s+/).map(pelar)) {
        if (!p) continue;
        expect(original.has(p), `"${p}" no es palabra entera de "${n}" (ancho ${ancho})`).toBe(true);
      }
    }
  });

  it('NO deja el nombre en la pura línea: "Eclipse" sin el mueble', () => {
    // El "·" separa la línea del producto. Cortar por ahí deja un nombre
    // corto y vacío, que es peor que uno largo con puntos suspensivos.
    const n = 'Eclipse · Escritorio directivo 2.10 m mano derecha';
    const r = acortarNombre(n, hasta(40));
    expect(r).not.toBe('Eclipse');
    expect(r).toContain('Escritorio');
    expect(r.length).toBeLessThanOrEqual(40);
  });

  it('aguanta un nombre vacío o nulo sin tronar', () => {
    expect(acortarNombre('', hasta(10))).toBe('');
    expect(acortarNombre(null, hasta(10))).toBe('');
    expect(acortarNombre(undefined, hasta(10))).toBe('');
  });
});
