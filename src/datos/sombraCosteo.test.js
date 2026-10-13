// VH-073: el registro sombra guarda el MOTIVO del fallo del servidor, no sólo "error".
import { describe, it, expect } from 'vitest';
import { filaSombra } from './sombraCosteo.js';

const local = { inputHash: 'h1', precioCliente: 12345.6, costoCliente: 7000.4, nombre: 'Credenza ejecutiva' };

describe('filaSombra', () => {
  it('éxito: precio/costo del servidor y diff', () => {
    const f = filaSombra({ ok: true, estado: 'preliminar', precioVenta: 12300, costo: { costoUnitario: 6990 }, versionMotor: '2026-10-01', versionCatalogo: 'cat-x' }, local);
    expect(f).toMatchObject({ input_hash: 'h1', estado_servidor: 'preliminar', http_status: 200, precio_cliente: 12346, precio_servidor: 12300, costo_cliente: 7000, costo_servidor: 6990, diff: 46, motor_version: '2026-10-01', nota: 'Credenza ejecutiva' });
  });
  it('400 del servidor: código y motivo quedan en la fila (antes sólo "error")', () => {
    const f = filaSombra({ ok: false, error: 'Campo económico no permitido en la intención del cliente: pieza.componentes.0.insumo', status: 400 }, local);
    expect(f.estado_servidor).toBe('error:HTTP_400');
    expect(f.http_status).toBe(400);
    expect(f.precio_servidor).toBeNull(); expect(f.diff).toBeNull();
    expect(f.nota).toMatch(/^Credenza ejecutiva · ERR Campo económico no permitido/);
    expect(f.campos_recibidos).toEqual(['ok', 'error', 'status']);
  });
  it('rechazo del validador local: usa su code y el primer issue', () => {
    const f = filaSombra({ ok: false, code: 'FORBIDDEN_FINANCIAL_FIELD', issues: [{ field: 'pieza.margen', msg: 'Campo económico no permitido' }], status: 400 }, local);
    expect(f.estado_servidor).toBe('error:FORBIDDEN_FINANCIAL_FIELD');
    expect(f.nota).toMatch(/ERR Campo económico no permitido/);
  });
  it('sin respuesta: no inventa 200 ni precio', () => {
    const f = filaSombra(null, local);
    expect(f.estado_servidor).toBe('error:SIN_RESPUESTA'); expect(f.http_status).toBeNull(); expect(f.precio_servidor).toBeNull();
  });
  it('motivo largo se recorta a 160 y nombre a 120', () => {
    const f = filaSombra({ ok: false, error: 'x'.repeat(500), status: 500 }, { ...local, nombre: 'n'.repeat(300) });
    expect(f.nota.length).toBeLessThanOrEqual(120 + 3 + 4 + 160);
  });
});

describe('VH-170 · sombra con precio pendiente', () => {
  it('precio del cliente null → precio_cliente null y sin diff; el costo sí se compara', () => {
    const f = filaSombra({ ok: true, estado: 'incompleto', precioVenta: 8555.92, costo: { costoUnitario: 5133.55 } }, { inputHash: 'h', precioCliente: null, costoCliente: 5072.85, nombre: 'mesa' });
    expect(f.precio_cliente).toBeNull();
    expect(f.diff).toBeNull();
    expect(f.costo_cliente).toBe(5073);
    expect(f.costo_servidor).toBe(5133.55);
  });
});
