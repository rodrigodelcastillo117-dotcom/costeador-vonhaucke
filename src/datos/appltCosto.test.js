import { describe, it, expect } from 'vitest';
import { costoOficialModuloAppLT, costoErpModuloAppLT, listaModuloAppLT, decodificarOpcion, precioMaterial, TARIFA_REAL_APPLT, pisoPorMargen, tarifaIndirectoPlanta } from './appltCosto.js';
import { APPLT_DATOS } from './appltDatos.js';
import { articuloPorClave } from './preciosLinea.js';

// Golden del pedido REAL 38247 (TATO63612AB001, 3 módulos, ENVIA FONDOS) y del libro "Coste APP LT 20261002".
// Regla de Dirección (2026-10-13): costo = MP a costo de COMPRA + horas ESTÁNDAR × tarifa REAL (MO + IND).

describe('APP LT · TATO63612AB001 · datos del pedido real', () => {
  it('BOM del módulo = el del pedido (21 piezas)', () => {
    const bom = Object.fromEntries(APPLT_DATOS.modulo.bom.map((b) => [b.clave, b.cantidad]));
    expect(bom).toEqual({ ATPU4M: 2, ATPU75M: 2, ATACM: 1, ATCUBD44ABS: 3, ATOM3: 6, ATRICDB4: 3, CIEPLA01300778: 4 });
  });
  it('costo ERP estándar (entrada de PT) por módulo = $9,664.92 al centavo (3 módulos = $28,994.75)', () => {
    expect(costoErpModuloAppLT()).toBe(9664.92);
    expect(Math.round(costoErpModuloAppLT() * 3 * 100) / 100).toBeCloseTo(28994.75, 1);
  });
  it('cotización del módulo a precio de lista = $12,380; la placa de unión va INCLUIDA sin cargo', () => {
    const l = listaModuloAppLT();
    expect(l.total).toBe(12380);
    expect(l.renglones.find((r) => r.clave === 'CIEPLA01300778')).toMatchObject({ unitario: 0, incluidaSinCargo: true });
    expect(l.total * 3).toBe(37140);   // 3 módulos del pedido (sin los 9 biombos, partida aparte)
  });
  it('los precios de lista del pedido coinciden con el catálogo vigente (preciosLinea)', () => {
    for (const [clave, unit] of Object.entries(APPLT_DATOS.listaPedido)) {
      if (clave === 'ATBIOCRS4' || clave === 'CIEPLA01300778') continue;
      expect(articuloPorClave(clave)?.l, clave).toBe(unit);
    }
  });
  it('DOCUMENTADO, sin cambiar precio: el biombo ATBIOCRS4 está a $1,640 en la app y a $1,760 en el pedido (decisión pendiente de Dirección)', () => {
    expect(articuloPorClave('ATBIOCRS4').l).toBe(1640);
    expect(APPLT_DATOS.listaPedido.ATBIOCRS4).toBe(1760);
  });
});

describe('APP LT · costo oficial (regla de Dirección)', () => {
  const r = costoOficialModuloAppLT('A118B770C770', undefined, { indirectos: 'por_area' });
  it('acabado del pedido (metal charcoal A118, madera light ash B770, plástico C770): $11,572.25', () => {
    expect(r.completo).toBe(true);
    expect(r.materiaPrima).toBe(4197.59);
    expect(r.manoObra).toBe(1728.44);
    expect(r.indirectos).toBe(5646.22);
    expect(r.total).toBe(11572.25);
  });
  it('horas ESTÁNDAR × tarifa REAL por área', () => {
    expect(r.porArea.pm).toMatchObject({ horas: expect.closeTo(12.776, 6), total: 4781.42 });
    expect(r.porArea.carpinteria).toMatchObject({ horas: 4.2204, total: 1412.44 });
    expect(r.porArea.acabados.total).toBe(608.23);
    expect(r.porArea.pintura.total).toBe(572.58);
    expect(TARIFA_REAL_APPLT.pintura).toEqual({ mo: 371.30, ind: 3930.56 });
  });
  it('cada material tiene precio con FUENTE; ninguno en $0 silencioso', () => {
    for (const m of r.materiales) {
      expect(m.precio, m.descripcion).toBeGreaterThan(0);
      expect(['compra', 'erp_consumo_pedido']).toContain(m.fuente);
    }
    // El canto y la chapacinta C770 no se compraron en el periodo: se usa el costo con que el ERP los consumió.
    expect(r.materiales.filter((m) => m.fuente === 'erp_consumo_pedido').map((m) => m.articulo).sort()).toEqual(['MVLMCC06060000', 'MVLPPC00501505']);
  });
  it('las horas de ENTREGAS (sin tarifa en ningún libro) quedan como pendiente visible, no se cobran a escondidas', () => {
    expect(r.pendientes.join(' ')).toMatch(/Entregas: 1\.15 h/);
  });
  it('otro acabado se costea con SUS compras (Frosty White B744/C744, pintura A112)', () => {
    const f = costoOficialModuloAppLT('A112B744C744', undefined, { indirectos: 'por_area' });
    expect(f.total).toBe(11174.11);
    expect(f.materiales.every((m) => m.fuente === 'compra')).toBe(true);
  });
  it('un acabado sin compra ni consumo queda PENDIENTE (costo null), no inventado', () => {
    const p = costoOficialModuloAppLT('A118B999C999');
    expect(p.completo).toBe(false);
    expect(p.total).toBeNull();
    expect(p.pendientes.join(' ')).toMatch(/B999/);
  });
  it('decodifica la opción de acabado', () => {
    expect(decodificarOpcion('A118B770C770')).toEqual({ A: 'A118', B: 'B770', C: 'C770' });
    expect(precioMaterial({ articulo: 'MVLQPP00000000', opcionLetra: 'A' }, 'A118').precio).toBeCloseTo(168.44553, 4);
  });
});

describe('APP LT · margen contra el piso de 25 %', () => {
  it('con indirectos UNA vez: a lista ($12,380) deja 39.4 %; con 25 % el precio mínimo sería $10,002.63', () => {
    const costo = costoOficialModuloAppLT('A118B770C770').total;
    expect(pisoPorMargen(costo, 25)).toBe(10002.63);
  });
  it('el MÍNIMO autorizado del catálogo ($9,170) queda DEBAJO del piso de 25 % (deja 18.2 %)', () => {
    const costo = costoOficialModuloAppLT('A118B770C770').total;
    expect((9170 - costo) / 9170).toBeCloseTo(0.1819, 3);
  });
});

describe('APP LT · indirectos contados UNA vez (regla de Dirección, oficial)', () => {
  it('tarifa de planta = 1 / Σ(1/ind_i) = $82.37/h (se despeja de las tarifas del ERP)', () => {
    expect(tarifaIndirectoPlanta()).toBeCloseTo(82.3743, 3);
  });
  it('módulo 6U en el acabado del pedido: $7,501.97 (MP 4,197.59 + MO 1,728.44 + IND 1,575.94) → 39.4 % a lista', () => {
    const r = costoOficialModuloAppLT('A118B770C770');
    expect(r.modoIndirectos).toBe('una_vez');
    expect(r.indirectos).toBe(1575.94);
    expect(r.total).toBe(7501.97);
    expect((12380 - r.total) / 12380).toBeCloseTo(0.394, 3);
    expect(r.porArea.pintura.ind).toBe(10.96);   // antes $523.16: la pintura cargaba el gasto de toda la planta
  });
  it('la tarifa del archivo por área (infla el gasto) sólo queda para comparar: $11,572.25', () => {
    expect(costoOficialModuloAppLT('A118B770C770', undefined, { indirectos: 'por_area' }).total).toBe(11572.25);
  });
  it('la mano de obra y el material no cambian; un modo desconocido se rechaza', () => {
    const a = costoOficialModuloAppLT(), b = costoOficialModuloAppLT('A118B770C770', undefined, { indirectos: 'por_area' });
    expect(b.manoObra).toBe(a.manoObra); expect(b.materiaPrima).toBe(a.materiaPrima);
    expect(() => costoOficialModuloAppLT('A118B770C770', undefined, { indirectos: 'x' })).toThrow();
  });
});
