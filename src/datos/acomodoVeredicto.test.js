import { describe, it, expect } from 'vitest';
import { explicarAcomodo, describirValidacionServidor, observacionesSemanticas, textoSemantico } from './acomodoVeredicto.js';

const specSem = (extra = {}) => ({
  status: 'NEEDS_SEMANTIC_REVIEW', placed: 2, requested: 2, unplaced: [],
  validation: { issues: [], render_ready: false, doors: { status: 'VERIFIED', total: 0 }, semantic_gate: { sem_status: 'REVIEW_REQUIRED', semFail: 0, semReview: 2, semantic_pass: false } },
  seleccion: { ganador_eval: { sem_status: 'REVIEW_REQUIRED', semFail: 0, semReview: 2 } },
  ...extra,
});

describe('VH-110 · explicarAcomodo separa qué está validado de qué falta', () => {
  it('geometría válida + revisión semántica pendiente ⇒ REVISION, no "invariantes"', () => {
    const r = explicarAcomodo({ plan: { layoutSpec: specSem(), render_ready: false, colocacion: [{ id: 'a' }, { id: 'b' }] }, evaluacion: { status: 'REVIEW_REQUIRED', issues: [], unplaced: [] } });
    expect(r.estado).toBe('REVISION');
    expect(r.resumen).toMatch(/revisión semántica/);
    expect(r.resumen).not.toMatch(/invariantes/);
    const b = Object.fromEntries(r.bloques.map((x) => [x.clave, x]));
    expect(b.geometria.ok).toBe(true);
    expect(b.colisiones.ok).toBe(true);
    expect(b.anclas.ok).toBe(true);
    expect(b.semantica.ok).toBe(false);
    expect(b.semantica.texto).toMatch(/2 observación\(es\)/);
    expect(b.publicable.ok).toBe(false);
  });
  it('con la lista del juez (sem_issues) dice exactamente qué revisar', () => {
    const spec = specSem({ seleccion: { ganador_eval: { sem_status: 'FAIL', semFail: 2, semReview: 1, sem_issues: [
      { code: 'DEPENDENT_WRONG_ORIENTATION', id: 's1', severity: 'fail' },
      { code: 'ACTIVE_SIDE_BLOCKED_BY_WALL', id: 's2', severity: 'fail' },
      { code: 'SEMANTIC_PROFILE_UNKNOWN', anchor: 'mesa', severity: 'review' },
    ] } } });
    const r = explicarAcomodo({ plan: { layoutSpec: spec } });
    const sem = r.bloques.find((x) => x.clave === 'semantica');
    expect(sem.texto).toMatch(/«s1» no mira a su mesa/);
    expect(sem.texto).toMatch(/«s2» pegada al muro/);
    expect(sem.texto).toMatch(/topología de «mesa»/);
    expect(r.semantica.detalleDisponible).toBe(true);
  });
  it('PARTIAL con dependientes sin ancla ⇒ PARCIAL y nombra las piezas', () => {
    const plan = { layoutSpec: { status: 'PARTIAL', unplaced: ['s1', 's2'], validation: { issues: [] } }, unassigned: [{ id: 's1', nombre: 'Silla · SONATA' }, { id: 's2', nombre: 'Silla · SONATA' }] };
    const r = explicarAcomodo({ plan, evaluacion: { status: 'PARTIAL', issues: [], unplaced: ['s1', 's2'] } });
    expect(r.estado).toBe('PARCIAL');
    expect(r.resumen).toMatch(/faltan 2 por colocar/);
    expect(r.bloques.find((x) => x.clave === 'anclas').texto).toMatch(/Silla · SONATA/);
  });
  it('falla geométrica real ⇒ FALLA con el código en palabras, y la semántica no la tapa', () => {
    const r = explicarAcomodo({ plan: { layoutSpec: { status: 'FAIL', validation: { issues: [] } } }, evaluacion: { status: 'FAIL', issues: [{ code: 'OVERLAP', severity: 'fail', ids: ['a', 'b'] }, { code: 'OUT_OF_BOUNDS', severity: 'fail', id: 'c' }], unplaced: [] } });
    expect(r.estado).toBe('FALLA');
    expect(r.bloques.find((x) => x.clave === 'colisiones').texto).toMatch(/encimados \(a, b\)/);
    expect(r.bloques.find((x) => x.clave === 'geometria').texto).toMatch(/se sale de su cuarto/);
  });
  it('PASS con render_ready ⇒ publicable y sin pendientes', () => {
    const r = explicarAcomodo({ plan: { layoutSpec: { status: 'PASS', validation: { issues: [], render_ready: true, semantic_gate: { sem_status: 'PASS', semantic_pass: true } } }, render_ready: true }, evaluacion: { status: 'PASS', issues: [], unplaced: [] } });
    expect(r.estado).toBe('PASS'); expect(r.resumen).toBe('');
    expect(r.bloques.every((b) => b.ok === true)).toBe(true);
  });
  it('REVIEW_REQUIRED nunca se convierte en PASS: una puerta sin verificar queda como pendiente', () => {
    const r = explicarAcomodo({ plan: { layoutSpec: { status: 'REVIEW_REQUIRED', validation: { issues: [], semantic_gate: { sem_status: 'PASS' } } } }, evaluacion: { status: 'REVIEW_REQUIRED', issues: [{ code: 'DOOR_SWING_UNKNOWN', severity: 'review' }], unplaced: [] } });
    expect(r.estado).toBe('REVISION');
    expect(r.bloques.find((x) => x.clave === 'publicable').ok).toBe(false);
    expect(r.bloques.find((x) => x.clave === 'colisiones').texto).toMatch(/barrido de puerta sin verificar/);
  });
  it('referencias sin identidad y programa incompleto se reportan en su bloque', () => {
    const r = explicarAcomodo({ plan: { layoutSpec: { status: 'PASS', validation: { issues: [], render_ready: true } }, render_ready: true }, evaluacion: { status: 'PASS', issues: [], unplaced: [] }, programaListo: false, motivoPrograma: 'falta la mesa de juntas', referencias: [{ id: 'x' }] });
    expect(r.estado).toBe('REVISION');
    expect(r.bloques.find((x) => x.clave === 'programa').texto).toBe('falta la mesa de juntas');
    expect(r.bloques.find((x) => x.clave === 'evidencia').texto).toMatch(/1 mueble\(s\) sin identidad/);
  });
});

describe('VH-111 · describirValidacionServidor reconoce todos los estados del edge', () => {
  it('NEEDS_SEMANTIC_REVIEW no es "sin validación"', () => {
    const d = describirValidacionServidor(specSem(), 'kit-solver-multi-v1');
    expect(d.estado).toBe('NEEDS_SEMANTIC_REVIEW'); expect(d.ok).toBe(false);
    expect(d.detalle).toMatch(/geometría válida; falta la revisión semántica/);
    expect(d.detalle).toMatch(/0 falla\(s\), 2 observación\(es\)/);
    expect(d.detalle).not.toMatch(/no devolvió/);
  });
  it('PASS / PARTIAL / QUALITY / METADATA con su texto; sin status ⇒ SIN_VALIDACION', () => {
    expect(describirValidacionServidor({ status: 'PASS' }).ok).toBe(true);
    expect(describirValidacionServidor({ status: 'PARTIAL' }).detalle).toMatch(/parcial/);
    expect(describirValidacionServidor({ status: 'QUALITY_REVIEW_REQUIRED' }).detalle).toMatch(/calidad/);
    expect(describirValidacionServidor({ status: 'NEEDS_REVIEW_METADATA' }).detalle).toMatch(/perfiles de colocación/);
    expect(describirValidacionServidor(null).estado).toBe('SIN_VALIDACION');
  });
  it('observacionesSemanticas: sin lista usa conteos; textoSemantico cubre códigos desconocidos', () => {
    const o = observacionesSemanticas(specSem());
    expect(o.detalleDisponible).toBe(false); expect(o.conteo).toEqual({ fail: 0, review: 2 });
    expect(textoSemantico({ code: 'RARO', id: 'z' })).toMatch(/RARO «z»/);
  });
});
