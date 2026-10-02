import { describe, it, expect } from 'vitest';
import { fusionarPreguntas } from './AsistenteEspecial.jsx';

const norm = (p) => ({ ...p, question_key: p.question_key || ('k_' + String(p.pregunta || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')) });

// El bug de "4 páginas": tras contestar, una pregunta ya conocida reaparece. Con question_key
// como autoridad eso no debe pasar NUNCA, aunque la IA reformule el texto.
describe('fusionarPreguntas — centro acumulativo por question_key', () => {
  it('agrega preguntas nuevas y conserva las pendientes', () => {
    const prev = [{ question_key: 'a', pregunta: 'A' }];
    const inc = [{ question_key: 'b', pregunta: 'B' }];
    const r = fusionarPreguntas(prev, inc, new Set(), norm);
    expect(r.map((q) => q.question_key).sort()).toEqual(['a', 'b']);
  });
  it('NUNCA incluye una key ya confirmada', () => {
    const prev = [{ question_key: 'a', pregunta: 'A' }];
    const inc = [{ question_key: 'a', pregunta: 'A reformulada' }, { question_key: 'c', pregunta: 'C' }];
    const r = fusionarPreguntas(prev, inc, new Set(['a']), norm);
    expect(r.map((q) => q.question_key)).toEqual(['c']); // 'a' confirmada → fuera, aunque venga reformulada
  });
  it('no duplica si la misma key llega otra vez', () => {
    const prev = [{ question_key: 'cantidad_cajones', pregunta: '¿cuántos cajones?' }];
    const inc = [{ question_key: 'cantidad_cajones', pregunta: 'cajones que lleva' }];
    const r = fusionarPreguntas(prev, inc, new Set(), norm);
    expect(r).toHaveLength(1);
  });
  it('recálculo silencioso (incoming=[]) no reabre nada; answered desaparece', () => {
    const prev = [{ question_key: 'a', pregunta: 'A' }, { question_key: 'b', pregunta: 'B' }];
    const r = fusionarPreguntas(prev, [], new Set(['a', 'b']), norm);
    expect(r).toHaveLength(0); // ambas contestadas → 0 pendientes, sin repetir
  });
  it('fallback a key por texto cuando no hay question_key', () => {
    const r = fusionarPreguntas([], [{ pregunta: '¿Cuántas puertas?' }], new Set(), norm);
    expect(r[0].question_key).toContain('puertas');
  });

  // --- Casos exigidos por ChatGPT ---
  it('A) key confirmada reformulada NO aparece (estructura_ptr_calibre=cal14)', () => {
    const confirmadas = new Set(['estructura_ptr_calibre']);
    const incoming = [{ question_key: 'estructura_ptr_calibre', pregunta: '¿Qué calibre de PTR usamos realmente?' }];
    const r = fusionarPreguntas([], incoming, confirmadas, norm);
    expect(r).toHaveLength(0);
  });
  it('B) pasada post-confirmación silenciosa (incoming=[]) no abre nada aunque la IA quisiera una key equivalente', () => {
    // El edge, con QUESTION_KEYS YA RESUELTAS + preguntas=[], devuelve [] en recálculo. El front, ante [], no abre nada.
    const confirmadas = new Set(['equipo_refrigerador_responsable']);
    const r = fusionarPreguntas([], [], confirmadas, norm);
    expect(r).toHaveLength(0);
  });
  it('C) 8 iniciales → responder 8 → recalcular → 0 pendientes', () => {
    const iniciales = Array.from({ length: 8 }, (_, i) => ({ question_key: 'q' + i, pregunta: 'P' + i }));
    const base = fusionarPreguntas([], iniciales, new Set(), norm);
    expect(base).toHaveLength(8);
    const todas = new Set(iniciales.map((q) => q.question_key)); // todas contestadas
    const trasRecalculo = fusionarPreguntas(base, [], todas, norm); // recálculo silencioso
    expect(trasRecalculo).toHaveLength(0);
  });
});
