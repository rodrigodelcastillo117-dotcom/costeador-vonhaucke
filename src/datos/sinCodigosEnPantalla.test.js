// ============================================================================
//  Laboratorio de recorridos (run 39361744435, C1): el veredicto del acomodo mostraba ids internos —
//  "muebles encimados («p-1792465371362-5-1|p-1792465371362-5-10»)", "Encimado entre «?» y «?»",
//  "Aviso del servidor: FUNCTIONAL_GROUP_SPLIT «p-…»" ×13. Una persona no puede hacer nada con eso.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { explicarAcomodo } from './acomodoVeredicto.js';
import { interpretarAcomodoServidor } from './acomodoServidor.js';

const RE_ID = /p-\d{6,}|\b[A-Z]{3,}_[A-Z_]{3,}\b|«\?»/;
const piezas = [{ id: 'p-1792465371362-5-1', nombre: 'Silla operativa · GAMMA-E' }, { id: 'p-1792465371362-5-10', nombre: 'Banca doble APP LT' }];

describe('ningún código interno en el veredicto del acomodo', () => {
  it('encimados: nombres de los dos muebles', () => {
    const v = explicarAcomodo({ plan: { piezas, invariantes: { status: 'NEEDS_REVIEW', issues: [{ code: 'OVERLAP', severity: 'fail', id: 'p-1792465371362-5-1|p-1792465371362-5-10' }] } } });
    const t = JSON.stringify(v);
    expect(t).toMatch(/Silla operativa · GAMMA-E.*Banca doble APP LT/);
    expect(t).not.toMatch(/p-1792465371362/);
  });
  it('avisos del servidor: en palabras, con nombres, agrupados', () => {
    const r = { ok: true, layoutSpec: { status: 'NEEDS_REVIEW', validation: {
      issues: [{ code: 'OVERLAP', a: 'p-1792465371362-5-1', b: 'p-1792465371362-5-10' }],
      reviews: [...Array(13)].map((_, i) => ({ code: 'FUNCTIONAL_GROUP_SPLIT', id: i ? `x-${i}` : 'p-1792465371362-5-1' })).concat([{ code: 'WRONG_GROUP_ANCHOR', id: 'p-1792465371362-5-10' }]) } },
      plan: { colocacion: [{ id: 'p-1792465371362-5-1' }] }, total: 2 };
    const out = interpretarAcomodoServidor(r, piezas);
    const t = JSON.stringify(out.avisos || out);
    expect(t).not.toMatch(RE_ID);
    expect(t).toMatch(/GAMMA-E/);
  });
});
