import { describe, it, expect } from 'vitest';
import { aplicarMemoriaMaterial, clavesParaMemoria } from './memoriaMaterial.js';
import { MATCH } from './materialMatch.js';
import { normalizarClaveMaterial } from './claveMaterial.js';

// `buscar` inyectado: devuelve el insumo recordado cuando se pide por su id (como buscar_insumos_motor).
const mkBuscar = (byId) => async (q) => { const f = byId[String(q)]; return f ? [f] : []; };

describe('aplicarMemoriaMaterial · reusar puentes aprobados por Dirección', () => {
  it('aplica un puente aprobado a una pieza pendiente como propuesta compatible, con procedencia memoria', async () => {
    const clave = normalizarClaveMaterial('remache pop aluminio');
    const remache = { id: 'REM-POP-42', nombre: 'REMACHE POP ALUMINIO 4.2', precio: 0.26, unidad: 'pza' };
    const comps = [{ nombre: 'Remaches', material_solicitado: 'remache pop aluminio', material_match: MATCH.NOT_AVAILABLE }];
    const insumos = {};
    const { comps: out, aplicados } = await aplicarMemoriaMaterial(comps, {
      memoria: { [clave]: { insumoId: 'REM-POP-42', mapeoId: 7, aprobadoPor: 'dir@vh.mx' } },
      buscar: mkBuscar({ 'REM-POP-42': remache }), agregarInsumo: (f) => { insumos[f.id] = f; }, insumos,
    });
    expect(out[0].insumoId).toBe('REM-POP-42');
    expect(out[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(out[0]._match.memoria).toBe(true);
    expect(out[0]._match.mapeo_id).toBe(7);
    expect(out[0]._match.autocosteable).toBe(true);
    expect(out[0]._match.motivo).toMatch(/Memoria/i);
    expect(aplicados).toHaveLength(1);
    expect(insumos['REM-POP-42']).toBeTruthy();   // el insumo recordado se agregó al mapa para costear
  });

  it('NUNCA $0: si el insumo recordado no tiene precio, la pieza queda pendiente', async () => {
    const clave = normalizarClaveMaterial('remache pop aluminio');
    const comps = [{ nombre: 'Remaches', material_solicitado: 'remache pop aluminio', material_match: MATCH.NOT_AVAILABLE }];
    const { comps: out, aplicados } = await aplicarMemoriaMaterial(comps, {
      memoria: { [clave]: { insumoId: 'REM-POP-42' } },
      buscar: mkBuscar({ 'REM-POP-42': { id: 'REM-POP-42', nombre: 'REMACHE', precio: null, unidad: 'pza' } }),
      agregarInsumo: () => {}, insumos: {},
    });
    expect(out[0].insumoId).toBeFalsy();
    expect(out[0].material_match).toBe(MATCH.NOT_AVAILABLE);
    expect(aplicados).toHaveLength(0);
  });

  it('no pisa una pieza confirmada por un humano', async () => {
    const clave = normalizarClaveMaterial('remache pop aluminio');
    const comps = [{ nombre: 'Remaches', material_solicitado: 'remache pop aluminio', insumoId: 'OTRO', material_confirmado: true }];
    const { comps: out, aplicados } = await aplicarMemoriaMaterial(comps, {
      memoria: { [clave]: { insumoId: 'REM-POP-42' } },
      buscar: mkBuscar({ 'REM-POP-42': { id: 'REM-POP-42', nombre: 'x', precio: 1 } }),
      agregarInsumo: () => {}, insumos: { OTRO: { precio: 5 } },
    });
    expect(out[0].insumoId).toBe('OTRO');
    expect(aplicados).toHaveLength(0);
  });

  it('no toca una pieza que ya cuesta (insumo con precio)', async () => {
    const clave = normalizarClaveMaterial('remache pop aluminio');
    const comps = [{ nombre: 'Remaches', material_solicitado: 'remache pop aluminio', insumoId: 'YA', material_match: MATCH.EXACT }];
    const { comps: out, aplicados } = await aplicarMemoriaMaterial(comps, {
      memoria: { [clave]: { insumoId: 'REM-POP-42' } },
      buscar: mkBuscar({ 'REM-POP-42': { id: 'REM-POP-42', nombre: 'x', precio: 1 } }),
      agregarInsumo: () => {}, insumos: { YA: { id: 'YA', precio: 9 } },
    });
    expect(out[0].insumoId).toBe('YA');
    expect(aplicados).toHaveLength(0);
  });

  it('sin puente para la clave, no cambia nada', async () => {
    const comps = [{ nombre: 'Remaches', material_solicitado: 'remache pop aluminio', material_match: MATCH.NOT_AVAILABLE }];
    const { comps: out, aplicados } = await aplicarMemoriaMaterial(comps, {
      memoria: {}, buscar: mkBuscar({}), agregarInsumo: () => {}, insumos: {},
    });
    expect(out[0].insumoId).toBeFalsy();
    expect(aplicados).toHaveLength(0);
  });

  it('unidad incompatible (pieza por área, insumo sin formato) → CRÍTICO, no autocosteable', async () => {
    const clave = normalizarClaveMaterial('mdf');
    const comps = [{ nombre: 'Cubierta', material_solicitado: 'mdf', largoMM: 1000, anchoMM: 500, material_match: MATCH.NOT_AVAILABLE }];
    const insumos = {};
    const { comps: out, aplicados } = await aplicarMemoriaMaterial(comps, {
      memoria: { [clave]: { insumoId: 'MDF-X' } },
      buscar: mkBuscar({ 'MDF-X': { id: 'MDF-X', nombre: 'MDF 15mm', precio: 100, unidad: 'pza' } }), // sin formato → no da m²
      agregarInsumo: (f) => { insumos[f.id] = f; }, insumos,
    });
    expect(out[0].material_match).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    expect(out[0]._match.autocosteable).toBe(false);
    expect(out[0]._match.memoria).toBe(true);
    expect(out[0].insumoId).toBeFalsy();          // un crítico no fija insumoId para costear
    expect(aplicados[0].critico).toBe(true);
  });
});

describe('clavesParaMemoria', () => {
  it('junta sólo las claves de piezas elegibles (sin material útil, no excluidas, no confirmadas)', () => {
    const comps = [
      { nombre: 'A', material_solicitado: 'remache pop aluminio', material_match: MATCH.NOT_AVAILABLE },
      { nombre: 'B', material_solicitado: 'bisagra', insumoId: 'OK', material_match: MATCH.EXACT },   // ya cuesta → fuera
      { nombre: 'C', material_solicitado: 'silicon estructural', excluida: true },                     // excluida → fuera
    ];
    const claves = clavesParaMemoria(comps, { OK: { precio: 3 } });
    expect(claves).toContain(normalizarClaveMaterial('remache pop aluminio'));
    expect(claves).not.toContain(normalizarClaveMaterial('bisagra'));
    expect(claves).not.toContain(normalizarClaveMaterial('silicon estructural'));
  });
});
