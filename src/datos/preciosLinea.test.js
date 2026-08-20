// ============================================================================
//  EL CATÁLOGO DE PRECIOS DE LÍNEA está sano y enchufable.
//  Rodrigo mandó el Excel oficial (15 líneas, 1713 artículos) el 2026-08-18 con
//  Precio 2 (FULL), Precio Lista (cotización) y Precio Mínimo (piso). Esta
//  prueba cuida que el catálogo cargue completo, que las claves no choquen y
//  que cada línea del Excel caiga en una ruta REAL del costeador.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { PRECIOS_LINEA, articuloPorClave, precioListaDe, pisoDe } from './preciosLinea.js';
import { LINEAS_REG } from './lineas.js';

describe('catálogo de precios de línea', () => {
  // 1713 del Excel original + 3 parches a mano que Rodrigo confirmó el
  // 2026-08-19/20 (escritorios Alba que todavía no están en el Excel fuente —
  // ver los comentarios "PARCHE A MANO" en preciosLinea.js). Si este número
  // vuelve a moverse sin querer, esta prueba lo cacha.
  it('trae los 1716 artículos (1713 del Excel + 3 parches a mano confirmados)', () => {
    expect(PRECIOS_LINEA.length).toBe(1716);
  });

  it('cada clave ERP es única (se puede indexar sin choque)', () => {
    const claves = new Set(PRECIOS_LINEA.map((a) => a.c));
    expect(claves.size).toBe(PRECIOS_LINEA.length);
  });

  it('todo Precio Lista es un número mayor que cero', () => {
    const malos = PRECIOS_LINEA.filter((a) => !(typeof a.l === 'number' && a.l > 0));
    expect(malos, 'hay precios lista en 0 o no numéricos').toEqual([]);
  });

  it('cada línea del Excel apunta a una ruta REAL del costeador', () => {
    const rutas = [...new Set(PRECIOS_LINEA.map((a) => a.ruta))];
    for (const r of rutas) {
      expect(LINEAS_REG[r], `la ruta '${r}' no existe en LINEAS_REG`).toBeTruthy();
    }
  });

  it('FULL >= LISTA >= MÍNIMO en TODO el catálogo (el typo de CIRQUE ya se corrigió)', () => {
    // Rodrigo confirmó que CIEPAT06E61508 iba al revés: FULL 350, Lista 240.
    // Corregido en el generador, ya no debe quedar NINGÚN full por debajo de la
    // lista, ni ningún mínimo por encima de ella.
    const fullBajoLista = PRECIOS_LINEA.filter((a) => a.f < a.l).map((a) => a.c);
    expect(fullBajoLista, 'un FULL quedó por debajo de su lista').toEqual([]);
    const minSobreLista = PRECIOS_LINEA.filter((a) => a.m > 0 && a.m > a.l).map((a) => a.c);
    expect(minSobreLista, 'un mínimo quedó por encima de la lista').toEqual([]);
    const cirque = articuloPorClave('CIEPAT06E61508');
    expect([cirque.f, cirque.l]).toEqual([350, 240]);
  });

  it('el piso de descuento usa el mínimo, y cae en la lista cuando el mínimo es 0', () => {
    // Rodrigo: un Precio Mínimo de 0 significa "no se descuenta" -> piso = lista.
    expect(pisoDe('CIECDO02991446')).toBe(399);          // min real
    expect(pisoDe('CIEPAT06E61508')).toBe(240);          // min 0 -> lista
    // ningún piso queda por encima de su lista
    for (const a of PRECIOS_LINEA) {
      expect(pisoDe(a.c)).toBeLessThanOrEqual(a.l);
    }
  });

  it('busca por clave ERP y por clave comercial', () => {
    const porErp = articuloPorClave('CIECDO02991446');
    expect(porErp && porErp.ln).toBe('APP');
    const porCom = articuloPorClave('CIDUBD4');            // clave comercial de la misma
    expect(porCom && porCom.c).toBe('CIECDO02991446');
    expect(precioListaDe('ANCCU105MAB')).toBe(48640);
    expect(articuloPorClave('NO-EXISTE')).toBe(null);
  });
});
