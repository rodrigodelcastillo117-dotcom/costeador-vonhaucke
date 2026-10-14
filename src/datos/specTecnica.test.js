// SEG-01c rev5 · spec_tecnica_v1 (JS). Las MISMAS fixtures doradas las corre la gemela SQL
// (supabase/tests/specTecnicaGolden.test.js): si una de las dos se mueve, la otra prueba lo delata.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { specTecnicaDeCosteo, SPEC_VERSION, SPEC_CAMPOS, enDominio } from './specTecnica.js';
import { validarIntentCosteo, intentDesdePieza } from './validarIntentCosteo.js';

const GOLDEN = JSON.parse(readFileSync(new URL('../../supabase/tests/fixtures/specTecnicaGolden.json', import.meta.url), 'utf8'));

describe('spec_tecnica_v1 · fixtures doradas (JS)', () => {
  it('hay fixtures y la versión es v1', () => {
    expect(GOLDEN.casos.length).toBeGreaterThanOrEqual(15);
    expect(SPEC_VERSION).toBe('v1');
  });
  for (const c of GOLDEN.casos) {
    it(c.nombre, () => {
      expect(specTecnicaDeCosteo(c.entrada)).toEqual(c.esperado);
      if (c.esperado) expect(specTecnicaDeCosteo(c.esperado)).toEqual(c.esperado);   // idempotente
    });
  }
  it('no es un objeto ⇒ null', () => {
    expect(specTecnicaDeCosteo(null)).toBeNull();
    expect(specTecnicaDeCosteo(['x'])).toBeNull();
    expect(specTecnicaDeCosteo({ componentes: 'x' })).toBeNull();
  });
});

describe('la spec cubre EXACTAMENTE lo que cruza la frontera del DTO', () => {
  const costeo = (extra = {}) => ({ nombre: 'Credenza', w: 1800, d: 450, piezas: 1,
    componentes: [{ nombre: 'Cubierta', insumoId: 'mdf18', cantidad: 1, largoMM: 1800, anchoMM: 450 }, { nombre: 'Entrepaño', insumoId: 'mdf18', cantidad: 1 }], ...extra });
  const spec = (c) => { const v = validarIntentCosteo(intentDesdePieza(c, 1)); expect(v.ok).toBe(true); return specTecnicaDeCosteo(v.intent.pieza); };

  it('cada campo que el validador deja pasar está en SPEC_CAMPOS (y viceversa, más `pendiente`)', () => {
    // Un componente con TODOS los campos permitidos: lo que sobrevive al validador es lo que entra a la spec.
    const todo = { insumoId: 'mdf18', nombre: 'X', cantidad: 1, largoMM: 1, anchoMM: 1, piezas: 1, hojas: 1, material_solicitado: 'm',
      material_match: 'EXACT', material_confirmado: true, engineering_override: true, override_motivo: 'm', areaPintadaM2: 1, tubular: true,
      procedencia: 'OBSERVADO', pieza_confirmada: true };
    const v = validarIntentCosteo({ cantidad: 1, pieza: { componentes: [todo] } });
    expect(v.ok).toBe(true);
    const saneado = Object.keys(v.intent.pieza.componentes[0]).sort();
    expect(saneado.every((k) => SPEC_CAMPOS.includes(k))).toBe(true);
    expect([...SPEC_CAMPOS].filter((k) => k !== 'pendiente').sort()).toEqual(saneado);
    expect(Object.keys(specTecnicaDeCosteo(v.intent.pieza).componentes[0]).sort()).toEqual(saneado);
  });
  it('multiplicidad, dimensión interna, horas, dificultad y pintura cambian la spec; el orden no', () => {
    const a = spec(costeo());
    expect(spec(costeo({ componentes: [...costeo().componentes].reverse() }))).toEqual(a);
    expect(spec(costeo({ componentes: [costeo().componentes[0], { ...costeo().componentes[1], cantidad: 3 }] }))).not.toEqual(a);
    expect(spec(costeo({ componentes: [{ ...costeo().componentes[0], largoMM: 1900 }, costeo().componentes[1]] }))).not.toEqual(a);
    expect(spec(costeo({ horas: { ensamble: 1 } }))).not.toEqual(spec(costeo({ horas: { ensamble: 4 } })));
    expect(spec(costeo({ dificultad: 'dificil' }))).not.toEqual(a);
    expect(spec(costeo({ componentes: [...costeo().componentes, { nombre: 'Pintura', insumoId: 'p', areaPintadaM2: 1.5 }] })))
      .not.toEqual(spec(costeo({ componentes: [...costeo().componentes, { nombre: 'Pintura', insumoId: 'p', areaPintadaM2: 2.25 }] })));
  });
  it('lo que el validador descarta (economía, excluida, factores, modelo) NO cambia la spec: el motor del servidor no lo ve', () => {
    const a = spec(costeo());
    expect(spec(costeo({ margen: 40, factorDirecta: 55, modoManoObra: 'horas', render: 'r',
      componentes: costeo().componentes.map((c) => ({ ...c, excluida: false, _match: { clase: 'EXACT' } })) }))).toEqual(a);
  });
  it('dominio numérico del contrato', () => {
    for (const n of [0, 1e-6, 1, 1.5, 0.30000000000000004, Number.MAX_SAFE_INTEGER]) expect(enDominio(n)).toBe(true);
    for (const n of [-1, 1e-7, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, '1']) expect(enDominio(n)).toBe(false);
  });
  it('cierre GO · el validador (frontera del DTO) conserva los centros toString, constructor y __proto__: la spec de la intención los trae', () => {
    const body = JSON.parse('{"cantidad":1,"pieza":{"componentes":[{"nombre":"Cubierta","insumoId":"mdf18","cantidad":1}],"horas":{"__proto__":2,"toString":1,"constructor":3}}}');
    const v = validarIntentCosteo(body);
    expect(v.ok).toBe(true);
    expect(Object.keys(v.intent.pieza.horas).sort()).toEqual(['__proto__', 'constructor', 'toString']);
    expect(JSON.parse(JSON.stringify(specTecnicaDeCosteo(v.intent.pieza)))).toEqual(JSON.parse('{"v":"v1","componentes":[{"insumoId":"mdf18","nombre":"Cubierta","cantidad":1}],"horas":{"__proto__":2,"toString":1,"constructor":3}}'));
  });
});
