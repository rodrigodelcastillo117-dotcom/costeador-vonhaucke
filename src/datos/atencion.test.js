import { describe, it, expect } from 'vitest';
import { proyectosSinProximaAccion, hoyNecesitaAtencion, hechosDireccion, esProyectoActivo } from './atencion.js';

describe('N17 — proyectos sin próxima acción', () => {
  it('detecta activos sin próxima acción; ignora cerrados', () => {
    const ps = [
      { id: 1, nombre: 'A', etapa: 'NEGOCIACION', proxima_accion: '' },
      { id: 2, nombre: 'B', etapa: 'NEGOCIACION', proxima_accion: 'Llamar' },
      { id: 3, nombre: 'C', etapa: 'GANADA', proxima_accion: '' },
    ];
    const r = proyectosSinProximaAccion(ps);
    expect(r.map((p) => p.id)).toEqual([1]);
    expect(esProyectoActivo({ etapa: 'PERDIDA' })).toBe(false);
  });
});

describe('N19 — HOY necesita tu atención', () => {
  it('genera tarjetas accionables ordenadas por severidad', () => {
    const cards = hoyNecesitaAtencion({
      proyectos: [
        { id: 1, nombre: 'A', etapa: 'NEGOCIACION', proxima_accion: '' },
        { id: 2, nombre: 'B', etapa: 'NEGOCIACION', proxima_accion: 'Seguir', fecha_proxima_accion: '2020-01-01' },
      ],
      cotizaciones: [
        { id: 10, folio: 'F10', estado_autorizacion: 'bloqueada' },
        { id: 11, folio: 'F11', partidas: [{ sinPrecioAutorizado: true }] },
      ],
      aprobaciones: [{ cotizacion_id: 10, estado: 'PENDIENTE' }],
      hoy: '2026-10-02',
    });
    const tipos = cards.map((c) => c.tipo);
    expect(tipos).toContain('APROBACION_PENDIENTE');
    expect(tipos).toContain('COTIZACION_BLOQUEADA');
    expect(tipos).toContain('PRODUCTO_SIN_PRECIO');
    expect(tipos).toContain('SIN_PROXIMA_ACCION');
    expect(tipos).toContain('ACCION_VENCE_HOY');
    expect(cards[0].severidad).toBe('alta');  // ordenado
  });
});

describe('N20 — hechos de Dirección', () => {
  it('cuenta por etapa, ganadas/perdidas y NO cuenta borradores como ventas', () => {
    const h = hechosDireccion({
      proyectos: [
        { etapa: 'NEGOCIACION' }, { etapa: 'GANADA', total_final: 500000 },
        { etapa: 'PERDIDA', motivo_perdida: 'PRECIO' }, { etapa: 'PERDIDA', motivo_perdida: 'PRECIO' },
      ],
      cotizaciones: [{ folio_oficial: 'VH-2026-00001' }, { folio_oficial: null }, {}],
    });
    expect(h.ganadas).toBe(1);
    expect(h.perdidas).toBe(2);
    expect(h.montoGanado).toBe(500000);
    expect(h.motivosPerdida.PRECIO).toBe(2);
    expect(h.cotizacionesOficiales).toBe(1);   // sólo 1 con folio_oficial (no los 33 borradores)
    expect(h.proyectosActivos).toBe(1);
  });
});


describe('Dirección · montos desconocidos no son cero', () => {
  it('una ganada sin total deja montoGanado desconocido', () => {
    const h=hechosDireccion({
      proyectos:[
        {etapa:'GANADA',total_final:500000},
        {etapa:'GANADA',total_final:null},
      ],
    });
    expect(h.ganadas).toBe(2);
    expect(h.montoGanado).toBeNull();
    expect(h.montoGanadoConocido).toBe(500000);
    expect(h.ganadasSinTotal).toBe(1);
  });
});
