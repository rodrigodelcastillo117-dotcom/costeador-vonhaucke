// SEG-01c rev4 · promesa_comercial_v1 (JS). Las MISMAS fixtures doradas las corre la gemela SQL
// (supabase/tests/promesaComercialGolden.test.js): si una de las dos se mueve, la otra prueba lo delata.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { promesaComercialDeCosteo, promesaDeOrigen, PROMESA_VERSION } from './promesaComercial.js';
import { validarIntentCosteo, intentDesdePieza, promesaDeclaradaDeCosteo } from './validarIntentCosteo.js';

const GOLDEN = JSON.parse(readFileSync(new URL('../../supabase/tests/fixtures/promesaComercialGolden.json', import.meta.url), 'utf8'));

describe('promesa_comercial_v1 · fixtures doradas (JS)', () => {
  it('hay fixtures y la versión es v1', () => {
    expect(GOLDEN.casos.length).toBeGreaterThanOrEqual(10);
    expect(PROMESA_VERSION).toBe('v1');
  });
  for (const c of GOLDEN.casos) {
    it(c.nombre, () => {
      expect(promesaComercialDeCosteo(c.entrada)).toEqual(c.esperado);
      // Idempotente: la promesa de la promesa es la misma.
      if (c.esperado) expect(promesaComercialDeCosteo(c.esperado)).toEqual(c.esperado);
    });
  }
});

describe('promesa de origen (lo que el servidor sella con el costeo)', () => {
  const costeo = {
    nombre: 'Escritorio operativo', w: 1200, d: 600, piezas: 2,
    componentes: [
      { nombre: 'Cubierta', insumoId: 'm16', largoMM: 1200, anchoMM: 600 },
      { nombre: 'Cristal templado', insumoId: 'cr6', excluida: true },
    ],
  };

  it('materiales y piezas salen del despiece COSTEADO, nunca de lo declarado', () => {
    const declarada = { ...promesaDeclaradaDeCosteo(costeo), materiales: ['nogal-macizo'], piezas: ['Cajonera'], componentes: [{ insumoId: 'oro' }],
      pieza: { componentes: [{ insumoId: 'plata', nombre: 'Lingote' }] } };
    const p = promesaDeOrigen(declarada, [{ nombre: 'Cubierta', insumoId: 'm16' }, { nombre: 'Cristal templado', insumoId: 'cr6' }]);
    expect(p).toEqual({ v: 'v1', nombre: 'Escritorio operativo', w: 1200, d: 600, materiales: ['cr6', 'm16'], piezas: ['Cubierta'], nombresExcluidos: ['Cristal templado'] });
  });

  it('el validador (cliente y Edge) arma la promesa con el despiece saneado; la partida especial usa EXACTAMENTE esa', () => {
    const v = validarIntentCosteo(intentDesdePieza(costeo, 2));
    expect(v.ok).toBe(true);
    expect(v.intent.promesa).toEqual({ v: 'v1', nombre: 'Escritorio operativo', w: 1200, d: 600, materiales: ['cr6', 'm16'], piezas: ['Cubierta'], nombresExcluidos: ['Cristal templado'] });
  });

  it('sin promesa declarada no hay promesa (el servidor no la inventa: el costeo no podrá vincularse)', () => {
    const intent = intentDesdePieza(costeo, 1);
    delete intent.promesa;
    expect(validarIntentCosteo(intent).intent.promesa).toBeUndefined();
  });

  it('promesa con dinero ⇒ rechazo (misma frontera que el resto de la intención); demasiado grande ⇒ rechazo', () => {
    const intent = intentDesdePieza(costeo, 1);
    expect(validarIntentCosteo({ ...intent, promesa: { ...intent.promesa, config: { precio: 1 } } }).code).toBe('FORBIDDEN_FINANCIAL_FIELD');
    expect(validarIntentCosteo({ ...intent, promesa: { nombre: 'x'.repeat(60000) } }).ok).toBe(false);
    expect(validarIntentCosteo({ ...intent, promesa: ['x'] }).ok).toBe(false);
  });

  it('material, acabado, accesorio, electrificación, exclusiones y configuración cambian la promesa; render/acomodo/economía no', () => {
    const base = { nombre: 'Escritorio', w: 1200, d: 600, config: { finish: 'blanco', electrico: false }, materiales: ['m16'], piezas: ['Cubierta'] };
    const p0 = JSON.stringify(promesaComercialDeCosteo(base));
    for (const cambio of [
      { materiales: ['m18'] }, { config: { finish: 'nogal', electrico: false } }, { config: { finish: 'blanco', electrico: true } },
      { config: { finish: 'blanco', electrico: false, cajonera: true } }, { nombresExcluidos: ['Cubierta'] }, { acabado: 'nogal' },
      { catalogo: { clave: 'ESC-NOG' } }, { piezas: ['Cubierta', 'Faldón'] }, { h: 750 },
    ]) expect(JSON.stringify(promesaComercialDeCosteo({ ...base, ...cambio })), JSON.stringify(cambio)).not.toBe(p0);
    for (const visual of [
      { render: 'https://otro.png' }, { imagen: 'x' }, { zone_id: 'z9', instance_id: 'i9', anchor_instance_id: 'a9' }, { nota: 'otra' },
      { precioUnitario: 1, costoUnitario: 2, margen: 3, cantidad: 9 }, { confianza: 0.1, avisos: ['x'], loteIA: 'L', sellerSafe: false },
      { ruta: 'otra', piezaId: 'otra', id: 'otra', origen: 'banco' },
    ]) expect(JSON.stringify(promesaComercialDeCosteo({ ...base, ...visual })), JSON.stringify(visual)).toBe(p0);
  });
});
