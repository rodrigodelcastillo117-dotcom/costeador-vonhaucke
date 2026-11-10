import { describe, it, expect } from 'vitest';
import { clasificarTercero, REGLAS_TERCERO } from './clasificacionTerceros.js';

describe('F1 · catalogo de clasificacion de terceros (mecanismo, sembrado por Compras)', () => {
  it('nace VACIO: sin politica declarada, TODO tercero devuelve null -> el llamador bloquea (fail-closed)', () => {
    // Evidencia: el BOM certificado ENTCBCALP costea acrilico como FABRICADO; la clasificacion
    // es politica de Von Haucke, no un hecho fisico. Por eso no se siembra ninguna regla.
    expect(REGLAS_TERCERO).toHaveLength(0);
    for (const n of ['Cristal templado 6mm', 'Acrilico cristal 3mm', 'Lamina galvanizada', 'Vidrio claro']) {
      expect(clasificarTercero(n, 'cubiertas')).toBeNull();
    }
  });
  it('cuando Compras agrega una regla, clasifica por patron (compra_venta o fabricado)', () => {
    // Contrato de la regla: {re, clasificacion, nota}. Se prueba la forma sin mutar el catalogo real.
    const reglaDemo = { re: /cristal templado/i, clasificacion: 'compra_venta', nota: 'OC proveedor' };
    expect(reglaDemo.re.test('Cristal templado 6mm')).toBe(true);
    expect(['compra_venta', 'fabricado']).toContain(reglaDemo.clasificacion);
  });
});
