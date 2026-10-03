// ============================================================================
//  CARACTERIZACIÓN: el modelo Intelisis (App LT) no debe moverse ni un peso.
//
//  2026-08-20: se de-duplicó la fusión modeloCosteo/parModelo que hoy vive
//  repetida en `lineas.js:precioDePieza()` y `CosteadorLinea.jsx`, hacia una
//  función compartida (`modeloParaPieza()` en motor/calculo.js), y se aplicó
//  esa misma fusión en 6 pantallas más que hoy la ignoran. Ninguna pieza
//  fuera de App LT/App declara el modelo real todavía, así que el cambio
//  completo debe ser matemáticamente un no-op — esta prueba es la fotografía
//  de "antes" que lo prueba, no solo lo asume.
// ============================================================================
import { describe, it, expect, beforeAll } from 'vitest';

describe('App LT (modelo Intelisis) — mismos números después del refactor', () => {
  let costearItem, estado;
  beforeAll(async () => {
    const ln = await import('./lineas.js');
    const ins = await import('./insumos.js');
    const mc = await import('../motor/calculo.js');
    costearItem = ln.costearItem;
    estado = { insumos: ins.mapaInsumos(ins.INSUMOS_SEMILLA), parametros: mc.PARAMETROS_DEFAULT, piezas: {} };
  });

  it('banca doble APP LT 1.50 · 6 usuarios', () => {
    const r = costearItem(estado, {
      ruta: 'applt', producto: 'banca_doble', cantidad: 1,
      seleccion: [{ clave: 'usuarios', valor: '6' }, { clave: 'largoMM', valor: '1500' }],
    });
    expect(r.precioUnitario).toBeCloseTo(19710, 2);
    expect(r.costoUnitario).toBeCloseTo(9125, 2);
  });

  it('banca sencilla APP LT 1.20 · 4 usuarios', () => {
    const r = costearItem(estado, {
      ruta: 'applt', producto: 'banca_sencilla', cantidad: 1,
      seleccion: [{ clave: 'usuarios', valor: '4' }, { clave: 'largoMM', valor: '1200' }],
    });
    // 2026-10-03: antes 18090.33/8375.15. Esos números NO eran un no-op: salían de
    // un bug — la UI/costearItem mandaba color:undefined y ANULABA el default 'ivory'
    // de App LT, así que esta banca se costeaba en la melamina base genérica ($1,335.6,
    // precio "arbitrario" según insumos.js) en vez del IVORY verificado al centavo
    // contra el T.D.C. de Alba ($1,122.3). Corregido el default (applt.js), ahora
    // coincide con el golden (applt.test.js) y con generarAppLT directo: todo IVORY.
    expect(r.precioUnitario).toBeCloseTo(17491.39, 1);
    expect(r.costoUnitario).toBeCloseTo(8097.86, 1);
  });
});
