import { describe, it, expect } from 'vitest';
import { inferRole } from './confirmarPrograma.js';
import { mejorCandidato } from '../../supabase/functions/acomodar-espacio-recovery/kit-solver.js';
import { mejorCandidato as mejorCandidatoRc } from '../../supabase/functions/acomodar-espacio-recovery-rc/kit-solver.js';
import { evaluarRecovery } from '../../supabase/functions/acomodar-espacio-recovery/recovery-core.js';
import { formatearMensajeVendedor } from './mensajeAcomodo.js';
import { interpretarAcomodoServidor } from './acomodoServidor.js';

// Cotización 4048 de Rodrigo (prueba E2E 2026-10-20): bancas encimadas en un cuarto, 52 sillas
// "sin escritorio", y etiquetas que se contradecían.
describe('4048 · qué mueble es lo dice el NOMBRE, no la nota', () => {
  const banca12 = { nombre: 'Banca doble APP LT 1.50 · 12 usuarios · ocupa 9.00 × 1.20 m', nota: '54 puestos en 4 bancas de 12 y una de 6, confirmado por 54 sillas y 54 gavetas' };
  it('una banca cuya nota menciona sillas y gavetas sigue siendo banca (ancla)', () => {
    expect(inferRole(banca12)).toBe('ANCHOR_WORKSTATION');
    expect(inferRole({ ...banca12, nota: '' })).toBe('ANCHOR_WORKSTATION');
  });
  it('manda el primer sustantivo del nombre', () => {
    expect(inferRole({ nombre: 'Escritorio con cajonera integrada' })).toBe('ANCHOR_WORKSTATION');
    expect(inferRole({ nombre: 'Silla operativa para banca' })).toBe('WORK_SEAT');
    expect(inferRole({ nombre: 'Mox · Gaveta pedestal 3 cajones' })).toBe('UNDERDESK_STORAGE');
    expect(inferRole({ nombre: 'Credenza baja para escritorio' })).toBe('SUPPORT_STORAGE');
    expect(inferRole({ nombre: 'Mesa de juntas App LT' })).toBe('ANCHOR_MEETING');
    expect(inferRole({ nombre: 'Silla operativa · WIN' })).toBe('WORK_SEAT');
  });
});

describe('4048 · el servidor no escoge el acomodo que coloca menos', () => {
  const cand = (idx, ev) => ({ idx, eval: { hardOk: false, sem_status: 'REVIEW_REQUIRED', semFail: 0, semRank: 1, semReview: 0, quality: 0, ...ev } });
  for (const [nombre, elegir] of [['recovery', mejorCandidato], ['recovery-rc', mejorCandidatoRc]]) {
    it(`${nombre}: con las mismas fallas geométricas gana el más completo aunque tenga más fallas de grupo`, () => {
      const centro = cand(0, { placed: 49, hard_issues: 44, geo_issues: 8 });
      const fila = cand(1, { placed: 54, hard_issues: 48, geo_issues: 8 });
      expect(elegir(centro, fila).idx).toBe(1);
    });
    it(`${nombre}: un encimado pesa más que colocar más piezas`, () => {
      const encimado = cand(0, { placed: 60, hard_issues: 10, geo_issues: 2 });
      const limpio = cand(1, { placed: 50, hard_issues: 30, geo_issues: 0 });
      expect(elegir(encimado, limpio).idx).toBe(1);
    });
  }
  it('las fallas geométricas vienen marcadas (geo) para poder separarlas de las de grupo', () => {
    const areas = [{ nombre: 'A', ancho: 4000, largo: 4000, x: 0, y: 0 }];
    const piezas = [{ id: 'm1', nombre: 'Mesa', w: 2000, d: 1000 }, { id: 'm2', nombre: 'Mesa', w: 2000, d: 1000 }];
    const colocacion = [{ id: 'm1', area: 0, x: 500, y: 500, rot: 0 }, { id: 'm2', area: 0, x: 600, y: 600, rot: 0 }];
    const ov = evaluarRecovery(areas, piezas, colocacion).issues.find((i) => i.code === 'OVERLAP');
    expect(ov).toBeTruthy();
    expect(ov.geo).toBe(true);
  });
});

describe('4048 · mensajes del acomodo', () => {
  it('el encimado nombra los dos muebles (antes «?» y «?»)', () => {
    const r = { ok: true, plan: { colocacion: [{ id: 'a', area: 0, x: 0, y: 0 }, { id: 'b', area: 0, x: 0, y: 0 }] }, layoutSpec: { status: 'FAIL', requested: 2, placed: 2, placements: [{ id: 'a', area: 0, x: 0, y: 0 }, { id: 'b', area: 0, x: 0, y: 0 }], validation: { issues: [{ code: 'OVERLAP', severity: 'fail', id: 'a|b' }] } } };
    const i = interpretarAcomodoServidor(r, [{ id: 'a', nombre: 'Banca de 12' }, { id: 'b', nombre: 'Banca de 6' }]);
    // Encimado = FAIL: no se publica el acomodo, se explica (con los nombres).
    expect(i.ok).toBe(false);
    const texto = JSON.stringify(i);
    expect(texto).toContain('Encimado entre «Banca de 12» y «Banca de 6»');
    expect(texto).not.toContain('«?»');
  });
  it('cada motivo de "no cupo" sale una sola vez', () => {
    const m = { texto: 'El módulo cabe solo en "PRIVADO 2", pero no junto a los demás bloques.' };
    const f = formatearMensajeVendedor({ hay_pendientes: true, pendientes: [{ texto: '4 escritorios' }], motivos: [m, m, { texto: 'Otro motivo' }] });
    expect(f.porque).toEqual([m.texto, 'Otro motivo']);
  });
});
