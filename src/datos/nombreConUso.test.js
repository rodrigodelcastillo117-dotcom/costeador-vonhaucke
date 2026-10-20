import { describe, it, expect } from 'vitest';
import { nombreConUso } from './nombreConUso.js';

describe('nombreConUso · el PDF dice el USO de una CONCERTO de juntas (cierre ChatGPT)', () => {
  it('"Silla de visita · CONCERTO" en SALA DE CONSEJO → "Silla CONCERTO · Sala de Consejo"', () => {
    expect(nombreConUso({ nombre: 'Silla de visita · CONCERTO', relation_role: 'MEETING_SEAT', zone_id: 'SALA DE CONSEJO' })).toBe('Silla CONCERTO · Sala de Consejo');
  });
  it('"Silla CONCERTO (visita 4 pts)" de juntas sin zona → "Silla CONCERTO · Sala de juntas"', () => {
    expect(nombreConUso({ nombre: 'Silla CONCERTO (visita 4 pts)', relation_role: 'MEETING_SEAT' })).toBe('Silla CONCERTO · Sala de juntas');
  });
  it('la nota de juntas también cuenta (sin relation_role)', () => {
    expect(nombreConUso({ nombre: 'Silla de visita · CONCERTO', piezaId: 'p9-silla-de-visita-concerto-5470', nota: 'Modelo de casa para salas de juntas/consejo.' })).toMatch(/^Silla CONCERTO · /);
  });
  it('una CONCERTO de VISITA sigue diciendo visita; otros muebles no cambian', () => {
    expect(nombreConUso({ nombre: 'Silla de visita · CONCERTO', relation_role: 'VISITOR_SEAT' })).toBe('Silla de visita · CONCERTO');
    expect(nombreConUso({ nombre: 'Silla operativa · WIN', relation_role: 'WORK_SEAT' })).toBe('Silla operativa · WIN');
  });
});
