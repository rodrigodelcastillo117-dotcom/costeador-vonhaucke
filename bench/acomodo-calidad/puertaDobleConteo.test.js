import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { construirRespuestaAcomodo } from '../../supabase/functions/acomodar-espacio-recovery/recoveryPipeline.js';
import { cuadroDuplicaPuertaVerificada, areaSinCuadrosDuplicados } from '../../supabase/functions/acomodar-espacio-recovery/spatial-core.js';
import { evaluarInvariantesAcomodo } from '../../src/datos/acomodoInvariantes.js';

// ============================================================================
//  2026-10-17 · PUERTA CONTADA DOS VECES. Lab C3 "sin cotas" (OPERACIÓN 10/10): una puerta con
//  barrido VERIFICADO viajaba como puerta real y además como obstáculo cuadrado de 1.83 m centrado en
//  el vano. Con ese doble conteo el escritorio directivo del PRIVADO B "no cabía" (19/21, PARTIAL); y
//  el validador del cliente medía las puertas con una caja distinta a la del solver.
// ============================================================================
const FIX = JSON.parse(readFileSync('bench/acomodo-calidad/fixtures/lab-c3-sin-cotas-request.json', 'utf8'));
const verificada = { x: 2000, y: 0, ancho: 900, tieneBarrido: true, bisagraX: 1550, bisagraY: 0, anguloCerradaDeg: 0, sentido: 'horario', barridoDeg: 90, confianza: 'alta' };
const sinBarrido = { x: 2000, y: 0, ancho: 900, tieneBarrido: false, bisagraX: 0, bisagraY: 0, anguloCerradaDeg: 0, sentido: 'desconocido', barridoDeg: 0 };
const cuadro = { x: 2000 - 915, y: -915, w: 1830, h: 1830, tipo: 'puerta' };

describe('puerta con barrido verificado: se mide con su forma real, sin cuadro duplicado', () => {
  it('RED→GREEN (lab C3): 21/21, PASS, y el validador del cliente lo acepta sin fallas', () => {
    const r = construirRespuestaAcomodo(FIX.areas, FIX.piezas);
    expect(r.seleccion.ganador_eval.placed).toBe(21);           // antes 19/21: el escritorio directivo no "cabía"
    expect(r.no_cupieron).toEqual([]);
    expect(r.status).toBe('PASS');
    expect((r.layoutSpec.validation.issues || []).filter((i) => i.severity === 'fail')).toEqual([]);
    const ev = evaluarInvariantesAcomodo({ payload: { areas: FIX.areas, piezas: FIX.piezas }, plan: { ...r.plan, layoutSpec: r.layoutSpec } });
    expect((ev.issues || []).filter((i) => i.severity === 'fail')).toEqual([]);
  });

  it('sólo se ignora el cuadro que coincide con una puerta de barrido VERIFICADO', () => {
    expect(cuadroDuplicaPuertaVerificada(cuadro, [verificada])).toBe(true);
    expect(cuadroDuplicaPuertaVerificada(cuadro, [sinBarrido])).toBe(false);          // sin barrido: se conserva la reserva
    expect(cuadroDuplicaPuertaVerificada({ ...cuadro, x: cuadro.x + 500 }, [verificada])).toBe(false);   // no coincide
    expect(cuadroDuplicaPuertaVerificada({ ...cuadro, tipo: 'columna' }, [verificada])).toBe(false);    // columnas nunca
    const area = { ancho: 5000, largo: 4000, puertas: [verificada], obstaculos: [cuadro, { x: 0, y: 0, w: 400, h: 400, tipo: 'columna' }] };
    expect(areaSinCuadrosDuplicados(area).obstaculos).toEqual([{ x: 0, y: 0, w: 400, h: 400, tipo: 'columna' }]);
  });

  it('la puerta verificada se sigue respetando: nada se coloca dentro de su barrido real', () => {
    const areas = [{ nombre: 'P', zone_id: 'P', tipo: 'privado', ancho: 3000, largo: 2600, puertas: [verificada], obstaculos: [cuadro] }];
    const piezas = [{ id: 'arch', relation_role: 'SUPPORT_STORAGE', w: 900, d: 450, functional_group_id: 'g', zone_id: 'P' }];
    const r = construirRespuestaAcomodo(areas, piezas);
    expect((r.layoutSpec.validation.issues || []).filter((i) => i.severity === 'fail')).toEqual([]);
    const ev = evaluarInvariantesAcomodo({ payload: { areas, piezas }, plan: { ...r.plan, layoutSpec: r.layoutSpec } });
    expect((ev.issues || []).filter((i) => i.code === 'BLOCKS_DOOR')).toEqual([]);
  });
});
