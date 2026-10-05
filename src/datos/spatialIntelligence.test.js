import { describe, it, expect } from 'vitest';
import {
  CODIGO,
  acomodarConReparacion,
  planearDeterminista,
  validarColocacion,
} from '../../supabase/functions/acomodar-espacio/acomodo-core.js';
import { poligonoBarridoPuerta, puertaTieneBarridoVerificable } from '../../supabase/functions/acomodar-espacio/spatial-core.js';

const AREA = [{ nombre: 'Privado', ancho: 4000, largo: 3000 }];

describe('Voni spatial intelligence · espacio funcional', () => {
  it('rechaza un layout que no traslapa huellas pero invade el espacio de uso', () => {
    const piezas = [
      {
        id: 'desk', nombre: 'Escritorio', w: 1000, d: 600,
        spatial_spec: { clearance_mm: { top: 0, right: 0, bottom: 900, left: 0 } },
      },
      { id: 'guest', nombre: 'Silla visita', w: 500, d: 500 },
    ];
    const col = [
      { id: 'desk', area: 0, x: 0, y: 0, rot: 0 },
      { id: 'guest', area: 0, x: 100, y: 700, rot: 0 },
    ];
    const v = validarColocacion(AREA, piezas, col);
    expect(v.noColocadas.find((p) => p.id === 'desk')?.codigos).toContain(CODIGO.FUNCTIONAL_CLEARANCE);
    expect(v.ok).toBe(false);
  });

  it('el solver coloca respetando el clearance y su propia salida valida', () => {
    const piezas = [
      {
        id: 'desk', nombre: 'Escritorio', w: 1200, d: 700,
        spatial_spec: { clearance_mm: { top: 0, right: 100, bottom: 900, left: 100 } },
      },
      { id: 'storage', nombre: 'Credenza', w: 1200, d: 450 },
    ];
    const r = planearDeterminista(AREA, piezas, { stepMM: 100, gapMM: 100 });
    expect(r.noColocadas).toHaveLength(0);
    const v = validarColocacion(AREA, piezas, r.colocacion);
    expect(v.ok).toBe(true);
    expect(v.aprobable).toBe(true);
  });
});

describe('Voni spatial intelligence · puertas', () => {
  const door = {
    x: 0, y: 0, ancho: 900,
    tieneBarrido: true,
    bisagraX: 0, bisagraY: 0,
    anguloCerradaDeg: 0,
    sentido: 'horario', barridoDeg: 90,
    confianza: 'alta',
  };

  it('construye un sector de barrido verificable y bloquea muebles dentro', () => {
    expect(puertaTieneBarridoVerificable(door)).toBe(true);
    expect(poligonoBarridoPuerta(door)?.length).toBeGreaterThan(8);
    const areas = [{ nombre: 'Acceso', ancho: 3000, largo: 3000, puertas: [door] }];
    const piezas = [{ id: 'm', nombre: 'Mueble', w: 400, d: 400 }];
    const v = validarColocacion(areas, piezas, [{ id: 'm', area: 0, x: 250, y: 250, rot: 0 }]);
    expect(v.noColocadas[0].codigos).toContain(CODIGO.BLOCKS_DOOR);
    expect(v.puertas.status).toBe('VERIFIED');
  });

  it('fail-closed: una puerta detectada sin barrido deja el layout UNVERIFIED', () => {
    const areas = [{
      nombre: 'Acceso', ancho: 4000, largo: 3000,
      puertas: [{ x: 0, y: 1500, ancho: 900, tieneBarrido: false, confianza: 'media' }],
    }];
    const piezas = [{ id: 'm', nombre: 'Mueble', w: 500, d: 500 }];
    const v = validarColocacion(areas, piezas, [{ id: 'm', area: 0, x: 3000, y: 2200, rot: 0 }]);
    expect(v.ok).toBe(true);
    expect(v.aprobable).toBe(false);
    expect(v.puertas.status).toBe('UNVERIFIED');
    expect(v.advertencias[0].codigo).toBe(CODIGO.DOOR_SWING_UNKNOWN);
  });

  it('el repair-loop no finge reparar metadatos de puerta que no existen', async () => {
    const areas = [{
      nombre: 'Acceso', ancho: 4000, largo: 3000,
      puertas: [{ x: 0, y: 1500, ancho: 900, tieneBarrido: false }],
    }];
    const piezas = [{ id: 'm', nombre: 'Mueble', w: 500, d: 500 }];
    const r = await acomodarConReparacion({
      areas, piezas, maxIntentos: 3,
      proponer: async () => ({ colocacion: [{ id: 'm', area: 0, x: 3000, y: 2200, rot: 0 }] }),
    });
    expect(r.completo).toBe(false);
    expect(r.aprobable).toBe(false);
    expect(r.colocadas).toBe(1);
    expect(r.intentos).toHaveLength(1);
    expect(r.recomendaciones.join(' ')).toMatch(/bisagra|barrido/i);
  });
});

describe('Voni spatial intelligence · calidad', () => {
  it('entre dos layouts válidos, premia el que respeta preferencia de centro', () => {
    const piezas = [{
      id: 'table', nombre: 'Mesa de consejo', w: 1000, d: 1000,
      spatial_spec: { prefer_center: true },
    }];
    const esquina = validarColocacion(AREA, piezas, [{ id: 'table', area: 0, x: 0, y: 0, rot: 0 }]);
    const centro = validarColocacion(AREA, piezas, [{ id: 'table', area: 0, x: 1500, y: 1000, rot: 0 }]);
    expect(esquina.ok).toBe(true);
    expect(centro.ok).toBe(true);
    expect(centro.calidad.score).toBeGreaterThan(esquina.calidad.score);
  });
});
