import { describe, it, expect } from 'vitest';
import { clasificarMueble, CLASE, ANCHOR_ROLE, DEPENDENT_ROLE, esAncla, esDependiente } from './mobiliarioOntologia.js';

describe('mobiliarioOntologia · ANCLA vs DEPENDIENTE vs AMENIDAD (ChatGPT P0-R9-6)', () => {
  it('ANCLAS: bench/escritorio operativo → WORKSTATION; mesa de juntas → MEETING; recepción → RECEPTION', () => {
    expect(clasificarMueble({ type: 'bench operativo', role: 'operational' })).toEqual({ clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.WORKSTATION });
    expect(clasificarMueble({ type: 'mesa de juntas', role: 'meeting' })).toEqual({ clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.MEETING });
    expect(clasificarMueble({ type: 'recepcion', role: 'reception' })).toEqual({ clase: CLASE.ANCHOR, anchor_role: ANCHOR_ROLE.RECEPTION });
  });

  it('ANCLA privada: escritorio de dirección → DESK_PRIVATE (no operativo)', () => {
    expect(clasificarMueble({ type: 'escritorio', role: 'private_office' }).anchor_role).toBe(ANCHOR_ROLE.DESK_PRIVATE);
    expect(clasificarMueble({ type: 'escritorio dirección', role: '' }).anchor_role).toBe(ANCHOR_ROLE.DESK_PRIVATE);
  });

  it('CRÍTICO P0-R9-6: una SILLA NUNCA es ancla — "silla operativa" → DEPENDENT WORK_SEAT (no operativo)', () => {
    const c = clasificarMueble({ type: 'silla operativa', role: 'work_seat' });
    expect(c.clase).toBe(CLASE.DEPENDENT);
    expect(c.dependent_role).toBe(DEPENDENT_ROLE.WORK_SEAT);
    expect(esAncla({ type: 'silla operativa' })).toBe(false);
  });

  it('CRÍTICO P0-R9-6: "silla de juntas" → DEPENDENT MEETING_SEAT (NO una sala, aunque diga "junta")', () => {
    const c = clasificarMueble({ type: 'silla de juntas', role: 'meeting_seat' });
    expect(c.clase).toBe(CLASE.DEPENDENT);
    expect(c.dependent_role).toBe(DEPENDENT_ROLE.MEETING_SEAT);
  });

  it('DEPENDIENTES de guarda: credenza/gaveta/pedestal/archivero → STORAGE', () => {
    for (const t of ['credenza', 'gaveta', 'pedestal', 'archivero']) {
      const c = clasificarMueble({ type: t, role: '' });
      expect(c.clase, t).toBe(CLASE.DEPENDENT);
      expect(c.dependent_role, t).toBe(DEPENDENT_ROLE.STORAGE);
    }
    expect(esDependiente({ type: 'credenza' })).toBe(true);
  });

  it('AMENIDADES: coffee/locker/mampara → AMENITY (no ancla)', () => {
    expect(clasificarMueble({ type: 'coffee point', role: 'amenity_coffee' }).clase).toBe(CLASE.AMENITY);
    expect(clasificarMueble({ type: 'lockers', role: '' }).clase).toBe(CLASE.AMENITY);
  });

  it('desconocido → UNKNOWN (nunca se fuerza a un rol)', () => {
    expect(clasificarMueble({ type: 'artefacto raro', role: 'xyz' }).clase).toBe(CLASE.UNKNOWN);
    expect(clasificarMueble({}).clase).toBe(CLASE.UNKNOWN);
  });

  it('P1-R10-13 ADVERSARIAL: NO falsos positivos de substring', () => {
    // 'indirecto' no debe matar como "direct"/privado
    expect(clasificarMueble({ type: 'costo indirecto', role: '' }).clase).toBe(CLASE.UNKNOWN);
    // 'repuesto' no debe matar como "puesto"/workstation
    expect(clasificarMueble({ type: 'repuesto mecanico', role: '' }).clase).toBe(CLASE.UNKNOWN);
    // 'blueprint' no debe matar como "print"/amenity
    expect(clasificarMueble({ type: 'blueprint', role: '' }).clase).toBe(CLASE.UNKNOWN);
  });

  it('P1-R10-13 ROLE canónico MANDA sobre el texto libre', () => {
    // aunque el type diga "mesa de juntas", si role canónico es work_seat → dependiente
    expect(clasificarMueble({ type: 'mesa de juntas', role: 'work_seat' })).toEqual({ clase: CLASE.DEPENDENT, dependent_role: DEPENDENT_ROLE.WORK_SEAT });
    expect(clasificarMueble({ type: 'cualquier cosa', role: 'reception' }).anchor_role).toBe(ANCHOR_ROLE.RECEPTION);
  });
});
