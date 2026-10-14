// ============================================================================
//  App · partida de línea fail-closed (comportamiento, 2026-10-14).
//  Antes: buscaba 'FAIL-CLOSED' y `costoPendiente: veCostos && costo == null` en el TEXTO de App.jsx.
//  Ahora ejecuta partidaDeCosteo (datos/agregarCosteo.js, la que usa App) con un motor que falla,
//  que da costo incompleto, o que da costo; y con rol vendedor.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { partidaDeCosteo } from '../datos/agregarCosteo.js';

const COSTEO = { nombre: 'Escritorio 160', ruta: 'linea/app', componentes: [{ nombre: 'Cubierta' }] };
const deps = (calcular) => ({
  calcular: vi.fn(calcular),
  modeloParaPieza: () => ({ par: { margen: 30 } }),
  pendientesDeCosteo: vi.fn(() => []),
});
const partida = (extra, d) => partidaDeCosteo({
  costeo: COSTEO, cantidad: 2, precioUnitario: 10000, margen: 35, costoUnitario: undefined,
  veCostos: true, insumos: {}, parametros: {}, ...extra,
}, d);

describe('App · line-item costing fail-closed', () => {
  it('nunca deriva costo desde precio/margen ni pone $0 si calcular falla', () => {
    const d = deps(() => { throw new Error('insumo sin precio'); });
    const p = partida({}, d);
    expect(d.calcular).toHaveBeenCalledTimes(1);
    expect(p.costoUnitario).toBeNull();                       // no 6500 (=10000×(1−35%)), no 0
    expect(p.costoPendiente).toBe(true);
    expect(p.costoDerivado).toBe(false);
    expect(p.precioUnitario).toBe(10000);                     // el precio no se toca
  });

  it('motor con costo oficial incompleto (null) o no finito ⇒ costo desconocido y pendiente', () => {
    for (const costoOficial of [null, undefined, NaN, Infinity]) {
      const p = partida({}, deps(() => ({ costoOficial, costoUnitario: 4321 })));
      expect(p.costoUnitario, String(costoOficial)).toBeNull();   // no se usa costoUnitario "operativo"
      expect(p.costoPendiente).toBe(true);
    }
  });

  it('margen no se conserva como si fuera real cuando el costo es desconocido', () => {
    const p = partida({}, deps(() => { throw new Error('x'); }));
    expect(p.margen).toBeNull();
    const conCosto = partida({}, deps(() => ({ costoOficial: 6200 })));
    expect(conCosto.margen).toBe(35);
    expect(conCosto.costoUnitario).toBe(6200);
    expect(conCosto.costoPendiente).toBe(false);
  });

  it('costo explícito (módulo con add-ons) manda y no corre el motor', () => {
    const d = deps(() => ({ costoOficial: 1 }));
    const p = partida({ costoUnitario: '4800.5' }, d);
    expect(d.calcular).not.toHaveBeenCalled();
    expect(p.costoUnitario).toBe(4800.5);
    expect(p.costoPendiente).toBe(false);
  });

  it('marca costoPendiente sólo para el rol que ve costos; el vendedor no corre el motor ni recibe economía', () => {
    const d = deps(() => ({ costoOficial: 6200 }));
    // Sin costo explícito: es justo el caso en que quien ve costos SÍ correría el motor.
    const v = partida({ veCostos: false }, d);
    expect(d.calcular).not.toHaveBeenCalled();
    const conCosto = partida({ veCostos: false, costoUnitario: 6200 }, d);
    expect('costoUnitario' in conCosto).toBe(false);          // ni el costo explícito se siembra al vendedor
    expect(d.pendientesDeCosteo).not.toHaveBeenCalled();
    expect(v.costoPendiente ?? false).toBe(false);          // seller-safe: la clave ni siquiera viaja
    expect('costoUnitario' in v).toBe(false);
    expect('margen' in v).toBe(false);
    expect(v.sellerSafe).toBe(true);
  });

  it('pendientes del despiece (motor) viajan a la partida de quien ve costos', () => {
    const d = deps(() => ({ costoOficial: 6200 }));
    d.pendientesDeCosteo.mockReturnValue(['Costado sin material']);
    const p = partida({}, d);
    expect(p).toMatchObject({ piezasSinMaterial: 1, nombresSinMaterial: ['Costado sin material'] });
  });

  // STATIC GUARD: App.jsx no se monta en node (sin jsdom). Sólo verifica el CABLEADO hacia la lógica probada.
  it('cableado: App.partidaDeCosteo delega con el veCostos y los insumos del estado', () => {
    const s = fs.readFileSync('src/App.jsx', 'utf8');
    const i = s.indexOf('function partidaDeCosteo');
    const b = s.slice(i, s.indexOf('const sumarPartidas', i));
    expect(b).toContain('return partidaDeCosteoPura({');
    expect(b).toContain('veCostos, insumos: estado.insumos, parametros: estado.parametros');
  });
});
