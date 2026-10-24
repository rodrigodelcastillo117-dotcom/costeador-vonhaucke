// VH-067: la respuesta de acomodar-espacio se lee por su veredicto, no por `ok: true`.
import { describe, it, expect } from 'vitest';
import { interpretarAcomodoServidor, estadoAcomodo } from './acomodoServidor.js';

const PIEZAS = [{ id: 'a', nombre: 'Escritorio 1' }, { id: 'b', nombre: 'Silla 1' }, { id: 'c', nombre: 'Archivero' }];
const base = (extra) => ({ ok: true, plan: { colocacion: [{ id: 'a', area: 0, x: 0, y: 0, rot: 0 }, { id: 'b', area: 0, x: 1500, y: 0, rot: 0 }, { id: 'c', area: 0, x: 3000, y: 0, rot: 0 }], caben: true, notas: [] },
  total: 3, colocadas: 3, noColocadas: [], metodo: 'deterministic_semantic_spatial_v10', request_id: 'req-a',
  puertas: { total: 1, verificadas: true, verificadasCount: 1, noVerificadas: [], status: 'VERIFIED' },
  layoutSpec: { status: 'PASS', validation: { issues: [], reviews: [] } }, ...extra });

describe('interpretarAcomodoServidor', () => {
  it('PASS: plan completo, auditoría en verde y sello del servidor', () => {
    const i = interpretarAcomodoServidor(base(), PIEZAS);
    expect(i.ok).toBe(true); expect(i.estado).toBe('PASS'); expect(i.avisos).toEqual([]);
    expect(i.plan.colocacion).toHaveLength(3); expect(i.plan.caben).toBe(true);
    expect(i.plan.auditoria.every((a) => a.ok)).toBe(true);
    expect(i.plan.servidor).toMatchObject({ estado: 'PASS', requestId: 'req-a' });
  });
  it('FAIL con ok:true del servidor ⇒ NO es éxito: error con los problemas traducidos', () => {
    const r = base({ plan: { colocacion: [] }, colocadas: 0, noColocadas: [{ id: 'a', codigos: ['OUTSIDE_ZONE'], motivo: 'fuera del cuarto' }],
      layoutSpec: { status: 'FAIL', validation: { issues: [{ code: 'OVERLAP', a: 'b', b: 'c' }], reviews: [] } } });
    const i = interpretarAcomodoServidor(r, PIEZAS);
    expect(i.ok).toBe(false); expect(i.estado).toBe('FAIL');
    expect(i.error).toMatch(/no pudo colocar ningún mueble/);
    expect(i.error).toMatch(/Encimado entre «Silla 1» y «Archivero»/);   // lab 19-oct: nombres, nunca ids
    expect(i.error).toMatch(/Escritorio 1: fuera del cuarto/);
    expect(i.plan).toBeUndefined();
  });
  it('PARTIAL: el plan se usa pero dice qué faltó, con nombre, y la auditoría lo marca', () => {
    const r = base({ plan: { colocacion: [{ id: 'a', area: 0, x: 0, y: 0, rot: 0 }] }, colocadas: 1,
      noColocadas: [{ id: 'b', codigos: ['NO_SPACE'], motivo: 'sin espacio' }, { id: 'c', codigos: [], motivo: '' }],
      layoutSpec: { status: 'PARTIAL', validation: { issues: [], reviews: [] } } });
    const i = interpretarAcomodoServidor(r, PIEZAS);
    expect(i.ok).toBe(true); expect(i.estado).toBe('PARTIAL');
    expect(i.plan.caben).toBe(false); expect(i.plan.sinColocar).toEqual(['b', 'c']);
    expect(i.avisos[0]).toMatch(/2 mueble\(s\) sin colocar: Silla 1, Archivero/);
    expect(i.plan.auditoria.find((a) => a.check === 'Todas las piezas colocadas')).toMatchObject({ ok: false, detalle: '1 de 3' });
    expect(i.plan.auditoria.find((a) => a.check === 'Validación del servidor').ok).toBe(false);
  });
  it('REVIEW_REQUIRED: avisos semánticos y de puertas, plan usable', () => {
    const r = base({ puertas: { total: 2, verificadas: false, verificadasCount: 1, noVerificadas: [{}], status: 'UNVERIFIED' },
      layoutSpec: { status: 'REVIEW_REQUIRED', validation: { issues: [], reviews: [{ code: 'SEMANTIC_ROLE_REVIEW', id: 'c' }, { code: 'CODIGO_NUEVO', id: 'a' }] } } });
    const i = interpretarAcomodoServidor(r, PIEZAS);
    expect(i.ok).toBe(true);
    expect(i.avisos.some((a) => /«Archivero»/.test(a))).toBe(true);
    // Desconocido: se enseña, en palabras (lab 19-oct: nunca el código crudo en pantalla).
    expect(i.avisos.some((a) => /codigo nuevo/.test(a) && /«Escritorio 1»/.test(a))).toBe(true);
    expect(i.avisos.some((a) => /barrido/.test(a))).toBe(true);
    expect(i.plan.auditoria.find((a) => a.check === 'Puertas verificadas')).toMatchObject({ ok: false, detalle: '1 de 2' });
  });
  it('sin puertas en el plano: PASS del servidor, pero se avisa que nadie verificó accesos', () => {
    const i = interpretarAcomodoServidor(base({ puertas: { total: 0, verificadas: true, verificadasCount: 0, noVerificadas: [], status: 'VERIFIED' } }), PIEZAS);
    expect(i.ok).toBe(true);
    expect(i.avisos.some((a) => /sin puertas/.test(a))).toBe(true);
    expect(i.plan.auditoria.find((a) => a.check === 'Puertas verificadas').ok).toBe(false);
  });
  it('respuesta vieja sin layoutSpec: se usa con aviso; vacía ⇒ error', () => {
    const viejo = { ok: true, plan: { colocacion: [{ id: 'a', area: 0, x: 0, y: 0, rot: 0 }], caben: false } };
    const i = interpretarAcomodoServidor(viejo, PIEZAS);
    expect(i.ok).toBe(true); expect(i.estado).toBe('SIN_VALIDACION');
    expect(i.avisos[0]).toMatch(/no devolvió validación/);
    expect(interpretarAcomodoServidor({ ok: true, plan: { colocacion: [] } }, PIEZAS).ok).toBe(false);
  });
  it('ok:false del transporte se propaga tal cual', () => {
    expect(interpretarAcomodoServidor({ ok: false, error: 'Límite' })).toMatchObject({ ok: false, error: 'Límite' });
    expect(interpretarAcomodoServidor(null).ok).toBe(false);
    expect(estadoAcomodo({ layoutSpec: { status: 'partial' } })).toBe('PARTIAL');
  });
  it('un WRONG_ZONE compuesto se traduce sin tabla explícita', () => {
    const r = base({ layoutSpec: { status: 'REVIEW_REQUIRED', validation: { issues: [], reviews: [{ code: 'MEETING_TABLE_WRONG_ZONE', id: 'a' }] } } });
    expect(interpretarAcomodoServidor(r, PIEZAS).avisos[0]).toMatch(/meeting table.*no le corresponde/);
  });
});

describe('VH-111 · estados del edge que antes se leían como "sin validación"', () => {
  it('NEEDS_SEMANTIC_REVIEW: plan usable, estado reconocido, auditoría con la revisión semántica', () => {
    const r = base({ layoutSpec: { status: 'NEEDS_SEMANTIC_REVIEW', validation: { issues: [], reviews: [], semantic_gate: { sem_status: 'REVIEW_REQUIRED', semFail: 0, semReview: 2 } },
      seleccion: { ganador_eval: { sem_status: 'REVIEW_REQUIRED', semFail: 0, semReview: 2, sem_issues: [{ code: 'SEMANTIC_PROFILE_UNKNOWN', anchor: 'a', severity: 'review' }, { code: 'SEMANTIC_PROFILE_UNKNOWN', anchor: 'c', severity: 'review' }] } } } });
    const i = interpretarAcomodoServidor(r, PIEZAS);
    expect(i.ok).toBe(true); expect(i.estado).toBe('NEEDS_SEMANTIC_REVIEW');
    const v = i.plan.auditoria.find((a) => a.check === 'Validación del servidor');
    expect(v.ok).toBe(false);
    expect(v.detalle).toMatch(/falta la revisión semántica/);
    expect(v.detalle).toMatch(/topología de «a»/);
    expect(v.detalle).not.toMatch(/no devolvió/);
    expect(i.plan.servidor.estado).toBe('NEEDS_SEMANTIC_REVIEW');
  });
  it('QUALITY_REVIEW_REQUIRED y NEEDS_REVIEW_METADATA también se reconocen', () => {
    expect(estadoAcomodo({ layoutSpec: { status: 'QUALITY_REVIEW_REQUIRED' } })).toBe('QUALITY_REVIEW_REQUIRED');
    expect(estadoAcomodo({ layoutSpec: { status: 'NEEDS_REVIEW_METADATA' } })).toBe('NEEDS_REVIEW_METADATA');
    expect(estadoAcomodo({ layoutSpec: { status: 'LO_QUE_SEA' } })).toBe('SIN_VALIDACION');
  });
});

// E2E 2026-10-20 (cotización 4048, edge recovery v19): el edge recovery no manda `noColocadas`, sólo
// `no_cupieron`/`layoutSpec.unplaced`. `sinColocar` salía vacío y la revisión se daba por VENCIDA.
describe('edge recovery sin `noColocadas`', () => {
  const sinLista = (extra) => { const r = base(extra); delete r.noColocadas; delete r.total; return r; };
  it('las no colocadas se derivan de lo enviado que no volvió colocado', () => {
    const r = sinLista({ plan: { colocacion: [{ id: 'a', area: 0, x: 0, y: 0, rot: 0 }] },
      layoutSpec: { status: 'QUALITY_REVIEW_REQUIRED', validation: { issues: [], reviews: [] } } });
    const i = interpretarAcomodoServidor(r, PIEZAS);
    expect(i.ok).toBe(true);
    expect(i.plan.sinColocar).toEqual(['b', 'c']);
    expect(i.plan.colocacion.length + i.plan.sinColocar.length).toBe(PIEZAS.length);   // ⇒ la revisión NO está vencida
    expect(i.plan.auditoria.find((a) => a.check === 'Todas las piezas colocadas')).toMatchObject({ ok: false, detalle: '1 de 3' });
  });
  it('todo colocado: nada sin colocar', () => {
    const i = interpretarAcomodoServidor(sinLista(), PIEZAS);
    expect(i.plan.sinColocar).toEqual([]);
  });
  it('avisos agrupados en plural: "3 piezas quedaron separadas"', () => {
    const issues = ['a', 'b', 'c'].map((id) => ({ code: 'FUNCTIONAL_GROUP_SPLIT', id }));
    const i = interpretarAcomodoServidor(sinLista({ layoutSpec: { status: 'QUALITY_REVIEW_REQUIRED', validation: { issues, reviews: [] } } }), PIEZAS);
    const geo = i.plan.auditoria.find((a) => a.check === 'Sin problemas geométricos').detalle;
    expect(geo).toMatch(/^3 piezas quedaron separadas de su grupo/);
    expect(geo).not.toMatch(/quedó/);
  });
});
