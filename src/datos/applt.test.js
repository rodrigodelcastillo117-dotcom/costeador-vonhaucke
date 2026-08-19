import { describe, it, expect } from 'vitest';
import { generarAppLT } from './applt.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { calcular } from '../motor/calculo.js';

// ===========================================================================
//  LA CUBIERTA DE APP LT CONTRA EL T.D.C. REAL DE ALBA (2026-08-18)
//  "ejemplo bench sencillo con guardas.xlsx", hoja (Explo_MP), id_02:
//  CUBIERTA RECTANGULAR DE 1200 X 600 (ATCUBS44ABS) -> material real $381.84.
//  Antes de esto, la app cobraba la cubierta con melamina genérica (última
//  compra, cualquier color) + canto PVC genérico + un % de aprovechamiento
//  supuesto -> salía +9% arriba. Verificado contra el explosivo real (color
//  IVORY, perfil de canto de aluminio, tapa registrable metálica), ahora
//  cuadra a menos de 1%. Ver costeador-formula-alba (memoria) para el detalle.
// ===========================================================================
describe('Cubierta App LT vs T.D.C. real de Alba', () => {
  const INS = mapaInsumos(INSUMOS_SEMILLA);

  it('banca sencilla 1200x600, 1 usuario: la cubierta cuadra a <1% del material real de Alba', () => {
    const banca = generarAppLT({ producto: 'banca_sencilla', largoMM: 1200, usuarios: 1, biombo: 'cristal' });
    const soloCubierta = { componentes: banca.componentes.filter((c) => /Cubierta|Herraje de registro/.test(c.nombre)), modoManoObra: 'porcentaje' };
    const r = calcular(soloCubierta, 1, INS);
    const ALBA = 381.84;
    const diffPct = ((r.materialTotal - ALBA) / ALBA) * 100;
    expect(Math.abs(diffPct)).toBeLessThan(2); // antes: +9%. ahora: -0.95%
  });
});
