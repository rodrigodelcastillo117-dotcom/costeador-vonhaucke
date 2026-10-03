import { describe, it, expect } from 'vitest';
import { revisarEstructura } from './revisionEstructural.js';

const niveles = (r) => r.observaciones.map((o) => o.nivel);
const textos = (r) => r.observaciones.map((o) => o.mensaje).join(' || ');

describe('revisarEstructura — razona el conjunto, no piezas sueltas', () => {
  it('banca de aeropuerto SIN estructura → warning de soporte', () => {
    const r = revisarEstructura({
      descripcion: 'Banca de espera de aeropuerto de 4 plazas, aluminio, hule espuma negra, conector cada 2 asientos.',
      componentes: [
        { nombre: 'Asiento', insumoId: 'espuma', piezas: 4 },
        { nombre: 'Respaldo', insumoId: 'espuma', piezas: 4 },
      ],
    });
    expect(niveles(r)).toContain('warning');
    expect(textos(r)).toMatch(/estructura de soporte|patas|travesa/i);
  });

  it('gaveta suelta sin cuerpo → warning', () => {
    const r = revisarEstructura({ componentes: [{ nombre: 'gaveta', insumoId: 'lamina-18' }] });
    expect(textos(r)).toMatch(/cuerpo que la contenga/i);
  });

  it('gaveta CON lateral → no se queja del cuerpo', () => {
    const r = revisarEstructura({ componentes: [
      { nombre: 'Lateral', insumoId: 'mdf-16', largoMM: 240, anchoMM: 900 },
      { nombre: 'gaveta', insumoId: 'lamina-18' },
    ] });
    expect(textos(r)).not.toMatch(/cuerpo que la contenga/i);
  });

  it('faldón con ancho 600 → info de altura vertical', () => {
    const r = revisarEstructura({ componentes: [{ nombre: 'Faldon', insumoId: 'mdf-16', largoMM: 1500, anchoMM: 600 }] });
    expect(textos(r)).toMatch(/ALTURA|altura/);
  });

  it('descripción dice asientos pero el despiece es una cubierta → warning de coherencia', () => {
    const r = revisarEstructura({
      descripcion: 'Banca de espera 4 plazas',
      componentes: [{ nombre: 'Cubierta', insumoId: 'marmol', largoMM: 1500, anchoMM: 600 }],
    });
    expect(niveles(r)).toContain('warning');
    expect(textos(r)).toMatch(/asientos|superficie/i);
  });

  it('conector mencionado pero no capturado → info', () => {
    const r = revisarEstructura({
      descripcion: 'banca con conector cada 2 asientos',
      componentes: [{ nombre: 'Asiento', insumoId: 'espuma', piezas: 4 }, { nombre: 'Pata', insumoId: 'ptr' }],
    });
    expect(textos(r)).toMatch(/conector/i);
  });

  it('despiece coherente → sin warning', () => {
    const r = revisarEstructura({
      descripcion: 'Escritorio recto',
      componentes: [
        { nombre: 'Cubierta', insumoId: 'melamina-28', largoMM: 1500, anchoMM: 600 },
        { nombre: 'Pata U', insumoId: 'ptr' },
      ],
    });
    expect(niveles(r)).not.toContain('warning');
  });

  it('sin piezas → info, sin romper', () => {
    const r = revisarEstructura({ componentes: [] });
    expect(r.observaciones.length).toBeGreaterThan(0);
  });
});
