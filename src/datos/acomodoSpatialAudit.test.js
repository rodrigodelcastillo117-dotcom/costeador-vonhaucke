import { describe, it, expect } from 'vitest';
import { auditarColocacion } from './acomodoAudit.js';

const area = [{ nombre: 'Oficina', ancho: 4000, largo: 3000 }];

describe('auditoría espacial post-layout', () => {
  it('un drag manual que rompe el espacio funcional bloquea el gate legacy', () => {
    const byId = {
      desk: {
        id: 'desk', nombre: 'Escritorio', w: 1000, d: 600,
        spatial_spec: { clearance_mm: { top: 0, right: 0, bottom: 900, left: 0 } },
      },
      chair: { id: 'chair', nombre: 'Silla visita', w: 500, d: 500 },
    };
    const colocacion = [
      { id: 'desk', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'chair', area: 0, x: 100, y: 700, rot: 0 },
    ];
    const a = auditarColocacion({ areas: area, colocacion, byId }, { tol: 20 });
    expect(a.ok).toBe(false);
    expect(a.funcionales).toHaveLength(1);
    expect(a.virtuales.some((v) => v.tipo === 'funcional')).toBe(true);
    expect(a.fuera.some((v) => /Espacio funcional insuficiente/.test(v.id))).toBe(true);
  });

  it('una puerta rica sin barrido verificable bloquea el gate aunque nada se encime', () => {
    const areas = [{
      nombre: 'Oficina', ancho: 4000, largo: 3000,
      puertas: [{ x: 0, y: 1500, ancho: 900, tieneBarrido: false, confianza: 'baja' }],
    }];
    const byId = { m: { id: 'm', nombre: 'Credenza', w: 900, d: 450 } };
    const colocacion = [{ id: 'm', area: 0, x: 2800, y: 2200, rot: 0 }];
    const a = auditarColocacion({ areas, colocacion, byId });
    expect(a.overlaps).toHaveLength(0);
    expect(a.fueraFisico).toHaveLength(0);
    expect(a.puertasPendientes).toHaveLength(1);
    expect(a.ok).toBe(false);
    expect(a.fuera.some((v) => /Puerta sin barrido verificable/.test(v.id))).toBe(true);
  });

  it('layout válido y puertas verificadas mantiene el gate verde', () => {
    const areas = [{
      nombre: 'Oficina', ancho: 4000, largo: 3000,
      puertas: [{ x: 0, y: 0, w: 900, d: 900 }],
    }];
    const byId = { m: { id: 'm', nombre: 'Credenza', w: 900, d: 450 } };
    const colocacion = [{ id: 'm', area: 0, x: 2500, y: 2200, rot: 0 }];
    const a = auditarColocacion({ areas, colocacion, byId });
    expect(a.ok).toBe(true);
    expect(a.virtuales).toHaveLength(0);
  });
});
