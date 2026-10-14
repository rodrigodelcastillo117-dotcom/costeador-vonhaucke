// ============================================================================
//  Fronteras económicas · centavos end-to-end (comportamiento, 2026-10-14).
//  Antes: buscaba `aCentavosEnteros(a.precioUnitario)` / `dinero(costoImplicito(precio2))` / `dinero(precio)`
//  en el TEXTO de App.jsx y AsistenteEspecial.jsx. Ahora ejecuta las funciones que esos componentes usan
//  (datos/renglonesComerciales.js, datos/sombraCosteo.js) con montos que difieren en UN centavo.
// ============================================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { mismoRenglon, juntarIguales, costoDeBanco, margenDeBanco, difierenAlCentavo } from './renglonesComerciales.js';
import { entradaSombraCliente, filaSombra } from './sombraCosteo.js';

const silla = (precioUnitario, cantidad = 1, extra = {}) => ({ nombre: 'Silla ALPHA', precioUnitario, cantidad, piezaId: null, ruta: null, productoId: 'alpha', config: { color: 'negro' }, ...extra });

describe('fronteras económicas · centavos end-to-end', () => {
  it('App junta renglones sólo si el precio es igual AL CENTAVO (no al peso entero)', () => {
    expect(mismoRenglon(silla(1000.00), silla(1000.01))).toBe(false);
    expect(mismoRenglon(silla(1000.49), silla(1000.01))).toBe(false);          // mismo peso redondeado, distinto centavo
    expect(mismoRenglon(silla(1000.004), silla(1000.00))).toBe(true);          // mismo centavo
    const juntas = juntarIguales([silla(2500.5, 6), silla(2500.5, 12), silla(2500.51, 1)]);
    expect(juntas.map((p) => [p.precioUnitario, p.cantidad])).toEqual([[2500.5, 18], [2500.51, 1]]);
  });

  it('App no funde muebles homónimos con distinta configuración ni muta la lista de entrada', () => {
    const a = silla(900, 2), b = silla(900, 3, { config: { color: 'gris' } });
    const r = juntarIguales([a, b]);
    expect(r).toHaveLength(2);
    expect(a.cantidad).toBe(2);
  });

  it('Banco deriva costo con dinero() a centavos, no Math.round al peso', () => {
    // Mueble: precio 2 = 1000/0.60 = 1666.67; costo = /3.6 = 462.962… → 462.96 (al peso daría 463).
    expect(costoDeBanco({ precio: 1000 })).toBe(462.96);
    // Sillería sin el 40%: 1000/3.6 = 277.777… → 277.78 (al peso daría 278).
    expect(costoDeBanco({ precio: 1000, categoria: 'Sillería' })).toBe(277.78);
    expect(costoDeBanco({ precio: 0 })).toBe(0);
    expect(costoDeBanco({})).toBe(0);
    expect(margenDeBanco({ precio: 1000 })).toBe(54);
    expect(margenDeBanco({ precio: 0 })).toBeNull();
  });

  it('shadow cliente-servidor: el lado cliente sale de AsistenteEspecial a centavos', () => {
    const e = entradaSombraCliente({ inputHash: 'h', precio: 12345.674, costoUnitario: 7000.456, nombre: 'Credenza' });
    expect(e).toEqual({ inputHash: 'h', precioCliente: 12345.67, costoCliente: 7000.46, nombre: 'Credenza' });
    expect(Number.isNaN(entradaSombraCliente({ precio: null }).precioCliente)).toBe(true);   // desconocido ≠ $0
  });

  // HALLAZGO 2026-10-14 (al convertir esta guarda a comportamiento): la guarda estática afirmaba que la sombra
  // "conserva centavos de precio y costo", pero filaSombra (VH-073) redondea precio_cliente/costo_cliente AL PESO
  // (Math.round) mientras precio_servidor/costo_servidor van crudos: con paridad EXACTA al centavo la fila
  // registra diff ≠ 0. Es diagnóstico (no dinero de registro). it.fails = exige lo correcto y hoy falla:
  // el defecto queda VISIBLE. Al corregirlo, vitest avisa: quitar `.fails` y ajustar sombraCosteo.test.js (VH-073).
  it.fails('shadow: la FILA registrada conserva centavos y paridad exacta da diff 0', () => {
    const local = entradaSombraCliente({ inputHash: 'h', precio: 12345.6, costoUnitario: 7000.4, nombre: 'x' });
    const f = filaSombra({ ok: true, estado: 'certificado', precioVenta: 12345.6, costo: { costoUnitario: 7000.4 } }, local);
    expect(f.precio_cliente).toBe(12345.6);
    expect(f.costo_cliente).toBe(7000.4);
    expect(f.diff).toBe(0);
  });

  it('comparación costo guardado vs hoy detecta diferencias de UN centavo y no inventa cambios con desconocidos', () => {
    expect(difierenAlCentavo(5072.85, 5072.86)).toBe(true);
    expect(difierenAlCentavo(5072.85, 5072.849999)).toBe(false);
    expect(difierenAlCentavo(5072.4, 5072.0)).toBe(true);                     // al peso serían iguales
    for (const x of [null, undefined, '', NaN]) {
      expect(difierenAlCentavo(x, 100)).toBe(false);
      expect(difierenAlCentavo(100, x)).toBe(false);
    }
  });

  // STATIC GUARD: App.jsx / AsistenteEspecial.jsx no se montan en node (sin jsdom). Sólo el CABLEADO.
  it('cableado: App y AsistenteEspecial usan las funciones probadas (sin copias locales)', () => {
    const app = fs.readFileSync('src/App.jsx', 'utf8');
    expect(app).toContain("import { juntarIguales, costoDeBanco, margenDeBanco } from './datos/renglonesComerciales.js'");
    expect(app).not.toMatch(/const (mismoRenglon|costoDeBanco|margenDeBanco) =|function juntarIguales/);
    const ae = fs.readFileSync('src/componentes/AsistenteEspecial.jsx', 'utf8');
    expect(ae).toContain('filaSombra(srv, entradaSombraCliente({');
    expect(ae).toContain('difierenAlCentavo(costoGuardado.costoUnitario, resultado.costoUnitario)');
  });
});
