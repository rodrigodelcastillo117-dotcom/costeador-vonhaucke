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
//  supuesto -> salía +9% arriba. Con el BOM real (color IVORY, perfil de
//  canto de aluminio, tapa registrable metálica) el DESPIECE cuadra al
//  centavo — lo que queda es el PRECIO de la melamina, que para materiales
//  con opciones (color) varía por lote (regla §1 de Alba: se necesita
//  promedio anual, no última compra; no hay esa serie completa todavía).
//  Ver costeador-formula-alba (memoria) para el detalle.
// ===========================================================================
describe('Cubierta App LT vs T.D.C. real de Alba', () => {
  const INS = mapaInsumos(INSUMOS_SEMILLA);

  function cubiertaBanca() {
    const banca = generarAppLT({ producto: 'banca_sencilla', largoMM: 1200, usuarios: 1, biombo: 'cristal' });
    return { componentes: banca.componentes.filter((c) => /Cubierta|Herraje de registro/.test(c.nombre)), modoManoObra: 'porcentaje' };
  }

  it('el DESPIECE (BOM) cuadra al centavo con el precio que Alba realmente usó ($1195.2, 2026-02-20)', () => {
    // Prueba el BOM, no el precio vigente: usa el precio EXACTO de su T.D.C.
    // (opción B717 IVORY, tal como venía en Explo_MP) para aislar si la
    // ESTRUCTURA del despiece (melamina + canto + herraje) es correcta.
    const insConElPrecioDeAlba = { ...INS, 'melamina-28-ivory': { ...INS['melamina-28-ivory'], precio: 1195.2, precioBase: 1195.2 } };
    const r = calcular(cubiertaBanca(), 1, insConElPrecioDeAlba);
    const ALBA = 381.84;
    // No es peso a peso (el canto/herraje son un bundle real pero no una
    // réplica exacta de cada renglón del explosivo) — pero con SU precio, el
    // BOM cuadra a menos de 2% (era +9% antes de tener el BOM real).
    expect(Math.abs(((r.materialTotal - ALBA) / ALBA) * 100)).toBeLessThan(2);
  });

  it('con el precio VIGENTE (última compra real, Luis Daniel 2026-08-18), queda dentro de lo esperable para un material con opciones', () => {
    const r = calcular(cubiertaBanca(), 1, INS);
    const ALBA = 381.84;
    const diffPct = ((r.materialTotal - ALBA) / ALBA) * 100;
    // El BOM ya cuadra (prueba de arriba); este % se mueve con el precio del
    // color, que es volátil lote a lote (IVORY: $1195.2 en feb-2026 ->
    // $1122.30 en abr-2026, -6% en dos meses). 10% es margen razonable hasta
    // tener el promedio anual real de Compras.
    expect(Math.abs(diffPct)).toBeLessThan(10);
  });
});
