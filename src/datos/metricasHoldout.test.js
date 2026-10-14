import { describe, it, expect } from 'vitest';
import { metricasDe, reporteHoldout } from './metricasHoldout.js';

describe('Holdout Intelisis · métricas fijadas antes de ver datos', () => {
  it('MAE, MAPE, sesgo y bandas con números calculados a mano', () => {
    // errores: +10 %, −5 %, +30 %, 0 %
    const m = metricasDe([{ erp: 100, app: 110 }, { erp: 200, app: 190 }, { erp: 50, app: 65 }, { erp: 80, app: 80 }]);
    expect(m).toEqual({ n: 4, sinDato: 0, mae: (10 + 10 + 15 + 0) / 4, mape: 11.25, sesgo: 8.75, dentro5: 50, dentro10: 75, dentro20: 75 });
  });
  it('sin dato ERP o app NO cuenta como 0: se reporta aparte', () => {
    const m = metricasDe([{ erp: null, app: 10 }, { erp: 100, app: null }, { erp: 0, app: 5 }, { erp: 100, app: 120 }]);
    expect(m.n).toBe(1);
    expect(m.sinDato).toBe(3);
    expect(m.mape).toBe(20);
  });
  it('reporte por familia y por componente; los no costeados se cuentan, no se esconden', () => {
    const r = reporteHoldout([
      { clave: 'A', familia: 'cubierta', erp: { mp: 100, total: 200 }, app: { mp: 120, total: 210 } },
      { clave: 'B', familia: 'pata', erp: { mp: 50, total: 100 }, app: { mp: 40, total: 90 } },
      { clave: 'C', familia: 'pata', costeado: false, erp: { total: 300 }, app: {} },
    ]);
    expect(r.muebles).toBe(3);
    expect(r.noCosteados).toBe(1);
    expect(r.global.total).toMatchObject({ n: 2, mape: 7.5, sesgo: -2.5 });
    expect(r.porFamilia.pata.mp).toMatchObject({ n: 1, mape: 20, sesgo: -20 });
    expect(r.global.mo.n).toBe(0);
  });
});
