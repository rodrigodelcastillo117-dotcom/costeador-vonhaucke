// VH-A05 (auditoría adversarial 2026-11-06): el gate compartido costeoEmitible NO debe
// declarar emitible un costo total CERO (nada costeado). Alinea cliente y servidor.
import { describe, it, expect } from 'vitest';
import { costeoEmitible } from './calculo.js';

describe('costeoEmitible · fail-closed en costo cero (VH-A05)', () => {
  const base = { componentesIgnorados: [], detalleInsumos: [], tarifasFaltantes: [], materialesPorConfirmar: [] };

  it('costo 0 NO es emitible', () => {
    const r = costeoEmitible({ ...base, costoUnitario: 0 });
    expect(r.emitible).toBe(false);
    expect(r.estadoCosto).toBe('incompleto');
    expect(r.costoTotal).toBeNull();
    expect(r.bloqueos.costo_invalido).toBe(true);
  });

  it('costo negativo NO es emitible', () => {
    expect(costeoEmitible({ ...base, costoUnitario: -1 }).emitible).toBe(false);
  });

  it('costo no finito NO es emitible', () => {
    expect(costeoEmitible({ ...base, costoUnitario: NaN }).emitible).toBe(false);
    expect(costeoEmitible({ ...base, costoUnitario: null }).emitible).toBe(false);
  });

  it('costo positivo sin pendientes SÍ es emitible', () => {
    const r = costeoEmitible({ ...base, costoUnitario: 1234.5 });
    expect(r.emitible).toBe(true);
    expect(r.costoTotal).toBe(1234.5);
    expect(r.estadoCosto).toBe('completo');
  });
});
