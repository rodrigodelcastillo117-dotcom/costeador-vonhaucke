import { describe, it, expect } from 'vitest';
import { snapshotEmitido, hashContenido, guardarRevision, esDefinitiva } from './revisiones.js';

const estado = (over = {}) => ({
  insumos: {},
  cotizacion: {
    folio: '2610-001', cliente: 'Tradeco',
    partidas: [{ id: 'p1', nombre: 'Banca doble', cantidad: 2, precioUnitario: 17600, costoUnitario: 9000 }],
    ...over,
  },
});

describe('snapshotEmitido', () => {
  it('captura las partidas y el total emitido', () => {
    const s = snapshotEmitido(estado());
    expect(s.partidas.length).toBe(1);
    expect(s.folio).toBe('2610-001');
    expect(s.total).toBeGreaterThan(0);
  });
});

describe('hashContenido — detecta cambios reales, ignora re-emisiones idénticas', () => {
  it('mismo contenido → mismo hash (re-emitir no duplica)', () => {
    expect(hashContenido(snapshotEmitido(estado()))).toBe(hashContenido(snapshotEmitido(estado())));
  });

  it('cambiar una CANTIDAD cambia el hash', () => {
    const a = snapshotEmitido(estado());
    const b = snapshotEmitido(estado({ partidas: [{ id: 'p1', nombre: 'Banca doble', cantidad: 3, precioUnitario: 17600, costoUnitario: 9000 }] }));
    expect(hashContenido(a)).not.toBe(hashContenido(b));
  });

  it('cambiar un PRECIO cambia el hash', () => {
    const a = snapshotEmitido(estado());
    const b = snapshotEmitido(estado({ partidas: [{ id: 'p1', nombre: 'Banca doble', cantidad: 2, precioUnitario: 18000, costoUnitario: 9000 }] }));
    expect(hashContenido(a)).not.toBe(hashContenido(b));
  });

  it('cambiar el DESCUENTO cambia el hash (cambia el total emitido)', () => {
    const a = snapshotEmitido(estado());
    const b = snapshotEmitido(estado({ descuentoPct: 15 }));
    expect(hashContenido(a)).not.toBe(hashContenido(b));
  });
});

describe('guardarRevision exige vínculo estable (cotizacion_id)', () => {
  it('sin cotizacionId no registra emisión definitiva (folio no basta)', async () => {
    const r = await guardarRevision(estado(), null);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('sin-cotizacion');
  });
});

describe('esDefinitiva — un documento sin registro NO es definitivo', () => {
  it('registro ok → definitiva', () => {
    expect(esDefinitiva({ ok: true, revision: 1 })).toBe(true);
  });
  it('registro fallido o ausente → NO definitiva (sale como borrador)', () => {
    expect(esDefinitiva({ ok: false, motivo: 'rpc' })).toBe(false);
    expect(esDefinitiva(null)).toBe(false);
    expect(esDefinitiva(undefined)).toBe(false);
  });
});
