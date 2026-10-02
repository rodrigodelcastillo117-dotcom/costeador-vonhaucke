// N3 — análisis estructural y PROPUESTA_DIFF. Puro.
import { describe, it, expect } from 'vitest';
import { analizarEstructura, diffContraBOM, esperadosDe, COMPONENTES } from './estructura.js';
import { FUENTES } from './evidencia.js';

describe('analizarEstructura', () => {
  it('lo esperado-no-observado queda SUPUESTO y pide confirmación', () => {
    const r = analizarEstructura({ tipo: 'escritorio' });
    expect(r.componentes.length).toBe(esperadosDe('escritorio').length);
    expect(r.requiereConfirmacion).toBe(true);
    expect(r.supuestos).toContain('carcasa');
    expect(r.confianza).toBeCloseTo(0.3, 5); // todos SUPUESTO
  });

  it('observado VISIBLE_EN_PLANO sube la confianza y no es supuesto', () => {
    const r = analizarEstructura({
      tipo: 'escritorio',
      observados: [{ componente: 'tapas', fuente: FUENTES.VISIBLE_EN_PLANO, origen: 'planta' }],
    });
    const tapas = r.componentes.find((c) => c.componente === 'tapas');
    expect(tapas.evidencia.fuente).toBe(FUENTES.VISIBLE_EN_PLANO);
    expect(r.supuestos).not.toContain('tapas');
  });

  it('incorpora componentes observados fuera del checklist esperado', () => {
    const r = analizarEstructura({
      tipo: 'mesa',
      observados: [{ componente: 'cristal', fuente: FUENTES.VISIBLE_EN_PLANO }],
    });
    expect(r.componentes.some((c) => c.componente === 'cristal')).toBe(true);
  });

  it('la de mayor confianza gana si hay observaciones repetidas', () => {
    const r = analizarEstructura({
      tipo: 'mesa',
      observados: [
        { componente: 'tapas', fuente: FUENTES.SUPUESTO },
        { componente: 'tapas', fuente: FUENTES.CONFIRMADO_USUARIO },
      ],
    });
    expect(r.componentes.find((c) => c.componente === 'tapas').evidencia.fuente).toBe(FUENTES.CONFIRMADO_USUARIO);
  });

  it('taxonomía tiene los 25 componentes', () => {
    expect(COMPONENTES).toHaveLength(25);
  });
});

describe('diffContraBOM (PROPUESTA_DIFF, no muta el BOM)', () => {
  it('detecta agregados/eliminados/cambiados', () => {
    const est = analizarEstructura({
      tipo: 'mesa',
      observados: [
        { componente: 'tapas', fuente: FUENTES.VISIBLE_EN_PLANO, cantidad: 1 },
        { componente: 'cristal', fuente: FUENTES.VISIBLE_EN_PLANO, cantidad: 1 },
      ],
    });
    const bom = [{ componente: 'tapas', cantidad: 2 }, { componente: 'patas', cantidad: 4 }];
    const d = diffContraBOM(est, bom);
    expect(d.agregados).toContain('cristal');   // en estructura, no en BOM
    expect(d.eliminados).toContain('patas');     // en BOM, no en estructura
    expect(d.cambiados.find((c) => c.componente === 'tapas')).toMatchObject({ bom: 2, propuesto: 1 });
    expect(d.sinCambios).toBe(false);
  });

  it('BOM idéntico → sin cambios', () => {
    const est = { componentes: [{ componente: 'tapas', cantidad: 1 }] };
    expect(diffContraBOM(est, [{ componente: 'tapas', cantidad: 1 }]).sinCambios).toBe(true);
  });
});
