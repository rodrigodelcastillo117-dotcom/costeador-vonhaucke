// VH-036 (2026-10-11): la llamada a costear-servidor ya no manda campos financieros.
import { describe, it, expect, vi, beforeEach } from 'vitest';
const invoke = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ functions: { invoke: (...a) => invoke(...a) }, auth: {}, from: () => ({}), rpc: () => ({}) }) }));
const { costearServidor } = await import('../nube.js');
const { intentDesdePieza, validarIntentCosteo } = await import('./validarIntentCosteo.js');

const b = { nombre: 'Especial', piezas: 2, margen: 50, modeloCosteo: 'clasico', factorDirecta: 55, factorIndirecta: 12,
  horas: { pm: 1, carpinteria: 2 },
  componentes: [{ nombre: 'Cubierta', insumoId: 'mdf-16', largoMM: 1200, anchoMM: 600, piezas: 1, precio: 999, insumo: { precio: 1 } }] };

describe('costearServidor · intención técnica saneada', () => {
  beforeEach(() => invoke.mockReset());
  it('intentDesdePieza quita margen/factores/modelo/precio/insumo y conserva lo técnico', () => {
    const i = intentDesdePieza(b, 2);
    expect(i).toEqual({ cantidad: 2, pieza: { componentes: [{ nombre: 'Cubierta', insumoId: 'mdf-16', largoMM: 1200, anchoMM: 600, piezas: 1 }], horas: { pm: 1, carpinteria: 2 } } });
    expect(validarIntentCosteo(i).ok).toBe(true);   // antes: FORBIDDEN_FINANCIAL_FIELD
  });
  it('la llamada al servidor lleva SÓLO la intención validada', async () => {
    invoke.mockResolvedValue({ data: { ok: true, estado: 'certificado', precioVenta: 100 }, error: null });
    const r = await costearServidor(b, 2);
    expect(r.estado).toBe('certificado');
    const body = invoke.mock.calls[0][1].body;
    expect(JSON.stringify(body)).not.toMatch(/margen|factorDirecta|modeloCosteo|"precio"|"insumo"/);
    expect(body.cantidad).toBe(2);
  });
  it('una pieza sin componentes no sale al servidor: falla en el cliente con código', async () => {
    const r = await costearServidor({ componentes: [] }, 1);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('INVALID_INPUT');
    expect(invoke).not.toHaveBeenCalled();
  });
});
