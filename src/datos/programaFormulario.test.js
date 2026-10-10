import { describe, it, expect } from 'vitest';
import { conOperativos, programaCoherente } from './programaFormulario.js';
import { fraseDe } from '../componentes/ProgramaProyecto.jsx';

// Estado real sembrado por el dibujo Torre Sur (8 × 3.2 m → estimación 10) y por m² (14).
const BASE = { operativos: 10, islas: 1, porIsla: 10, gavetas: 10, archiveros: 1, largoPuesto: 1500, lineaOperativos: 'applt', sillaOperativa: 'WIN', privados: 1, largoPrivado: 2100, credenza: true, lineaPrivados: 'eclipse', sillaDirectiva: 'ALPHA', sillaVisita: 'CONCERTO', juntas: 4, sillaJuntas: 'SONATA', recepcion: true, salas: [4] };

describe('formulario · corregir Operativos arrastra reparto y gavetas (E2E Dibujo/m²)', () => {
  it('RED→GREEN: 10→8 ⇒ "8 lugares… bancas de 8… 8 gavetas" (antes: bancas de 10, 10 gavetas)', () => {
    const p = conOperativos(BASE, 8);
    expect(p.operativos).toBe(8);
    expect(p.porIsla).toBe(8);
    expect(p.gavetas).toBe(8);
    const f = fraseDe(p);
    expect(f).toMatch(/^8 lugares de trabajo repartidos en 1 bancas de 8 usuarios/);
    expect(f).toMatch(/8 sillas operativas WIN/);
    expect(f).toMatch(/8 gavetas rodantes/);
    expect(f).not.toMatch(/\b10 (lugares|usuarios|sillas|gavetas)/);   // ("2.10 m" del escritorio sí puede aparecer)
    expect(programaCoherente(p)).toBe(true);
    expect(programaCoherente(BASE)).toBe(true);
    expect(programaCoherente({ ...BASE, operativos: 8 })).toBe(false);   // el estado viejo era incoherente
  });
  it('m²: 14→8 con 2 islas reparte por banca (ceil)', () => {
    const p = conOperativos({ ...BASE, operativos: 14, islas: 2, porIsla: 7, gavetas: 14 }, 8);
    expect(p.porIsla).toBe(4);
    expect(p.gavetas).toBe(8);
  });
  it('si la persona ya tocó gavetas a mano, se respetan', () => {
    const p = conOperativos({ ...BASE, gavetas: 6, gavetasManual: true }, 8);
    expect(p.gavetas).toBe(6);
    expect(p.operativos).toBe(8);
  });
  it('sin islas (sin plano) no inventa reparto', () => {
    const p = conOperativos({ ...BASE, islas: 0, porIsla: 0 }, 8);
    expect(p.porIsla).toBe(0);
    expect(fraseDe(p)).toMatch(/^8 lugares de trabajo en bench/);
  });
});
