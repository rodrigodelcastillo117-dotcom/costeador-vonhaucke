import { describe, it, expect } from 'vitest';
import { especialidadActiva, resultadoIngenieria, resultadoCostos, procedenciaCanonica, RESULTADO } from './especialidades.js';
import { mapIaComps } from '../datos/mapIaComps.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../datos/insumos.js';

describe('VONI especialidades: banderas, contrato de resultados y procedencia', () => {
  it('banderas: Ingeniería y Costos encendidas por defecto; Arquitecto/Comercial/Creador/Council apagadas; env manda', () => {
    expect(especialidadActiva('ingenieria', {})).toBe(true);
    expect(especialidadActiva('costos', {})).toBe(true);
    for (const n of ['arquitecto', 'comercial', 'creador', 'council']) expect(especialidadActiva(n, {})).toBe(false);
    expect(especialidadActiva('ingenieria', { VITE_VONI_INGENIERIA: 'off' })).toBe(false);   // rollback
    expect(especialidadActiva('council', { VITE_VONI_COUNCIL: 'on' })).toBe(true);
  });
  it('procedencia de la IA → canónica; CONFIRMADO nunca sale de la IA', () => {
    expect(['MEASURED', 'DERIVED', 'INFERRED', 'ASSUMED', '', 'CONFIRMED'].map(procedenciaCanonica)).toEqual(['OBSERVADO', 'OBSERVADO', 'INFERIDO', 'SUPUESTO', 'DESCONOCIDO', 'DESCONOCIDO']);
  });
  it('mapIaComps conserva procedencia y evidencia de la pieza (lab escritorio L, respuesta real)', () => {
    const p = { piezas: [
      { nombre: 'Cubierta principal', insumoId: 'melamina-19', material_solicitado: 'Melamina 19 mm', forma: 'area', largoMM: 1600, anchoMM: 700, cantidad: 1, procedencia: 'MEASURED', evidencia: 'Nota: cubierta principal 1600x700', pagina: 1 },
      { nombre: 'Tornillería / minifix', insumoId: 'tornilleria', material_solicitado: 'Tornillería', forma: 'pieza', cantidad: 1, procedencia: 'ASSUMED' },
    ] };
    const r = mapIaComps(p, mapaInsumos(INSUMOS_SEMILLA));
    expect(r.map((c) => c.procedencia)).toEqual(['OBSERVADO', 'SUPUESTO']);
    expect(r[0].evidencia).toMatch(/1600x700/); expect(r[0].pagina).toBe(1);
  });
  it('Ingeniería: BLOCKED con un bloqueo estructural o lectura incompleta; NEEDS_CONFIRMATION con piezas inferidas; PASS limpio', () => {
    expect(resultadoIngenieria({ revision: { observaciones: [{ nivel: 'blocker', regla: 'material_funcion', mensaje: 'x' }] } }).estado).toBe(RESULTADO.BLOCKED);
    expect(resultadoIngenieria({ lecturaIA: { motivos: ['una pieza'] } }).estado).toBe(RESULTADO.BLOCKED);
    expect(resultadoIngenieria({ lecturaIA: { motivos: ['una pieza'], revisada: true } }).estado).toBe(RESULTADO.PASS);
    expect(resultadoIngenieria({ componentes: [{ nombre: 'Divisiones', procedencia: 'INFERIDO' }] }).estado).toBe(RESULTADO.NEEDS_CONFIRMATION);
    // Auditoría 2026-10-14 (P1-01): confirmar el MATERIAL no confirma que la pieza exista; sólo `pieza_confirmada` lo hace.
    expect(resultadoIngenieria({ componentes: [{ nombre: 'Divisiones', procedencia: 'INFERIDO', material_confirmado: true }] }).estado).toBe(RESULTADO.NEEDS_CONFIRMATION);
    expect(resultadoIngenieria({ componentes: [{ nombre: 'Divisiones', procedencia: 'INFERIDO', pieza_confirmada: true }] }).estado).toBe(RESULTADO.PASS);
    expect(resultadoIngenieria({ error: 'timeout' }).estado).toBe(RESULTADO.ERROR);
  });
  it('Costos: mapea los tres niveles sin exponer importes', () => {
    expect(resultadoCostos({ estado: 'validado', motivos: [] }).estado).toBe('PASS');
    expect(resultadoCostos({ estado: 'preliminar', motivos: ['x'] }).estado).toBe('NEEDS_CONFIRMATION');
    expect(resultadoCostos({ estado: 'bloqueado', motivos: ['x'] }).estado).toBe('BLOCKED');
    expect(resultadoCostos(null).estado).toBe('ERROR');
    expect(JSON.stringify(resultadoCostos({ estado: 'preliminar', motivos: ['El servidor aún no validó este despiece.'] }))).not.toMatch(/\$|costo(Unitario|Total)|precio/i);
  });
});
