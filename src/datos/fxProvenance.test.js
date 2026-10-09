import { describe, it, expect } from 'vitest';
import { normalizarFx, resolverFx, ESTADO_FX, FUENTE_FX } from './fxProvenance.js';

const HOY = '2026-10-09';

describe('FX PROVENANCE · tipo de cambio con procedencia (ChatGPT §9)', () => {
  it('SIN observaciones → PENDING y BLOQUEA costo oficial (no FX mágico)', () => {
    const r = resolverFx('USD/MXN', [], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_FX.PENDING);
    expect(r.valor).toBeNull();
    expect(r.bloqueaCostoOficial).toBe(true);
  });

  it('valor AUSENTE → no utilizable (nunca 0)', () => {
    const o = normalizarFx({ par: 'USD/MXN', fuente: FUENTE_FX.BANXICO, fecha: HOY });
    expect(o.utilizable).toBe(false);
    expect(o.valor).toBeNull();
    expect(o.issues).toContain('SIN_VALOR');
  });

  it('Banxico con vigencia que cubre hoy → VERIFIED_CURRENT, no bloquea', () => {
    const r = resolverFx('USD/MXN', [
      { par: 'USD/MXN', valor: 18.2, fuente: FUENTE_FX.BANXICO, fecha: '2026-10-08', vigencia_hasta: '2026-10-31', evidencia: 'fix' },
    ], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_FX.VERIFIED_CURRENT);
    expect(r.valor).toBe(18.2);
    expect(r.bloqueaCostoOficial).toBe(false);
  });

  it('factura real fechada y FRESCA (≤7 días) → REAL_DATED, no bloquea', () => {
    const r = resolverFx('USD/MXN', [
      { par: 'USD/MXN', valor: 18.0, fuente: FUENTE_FX.FACTURA, fecha: '2026-10-05', evidencia: 'factura' },
    ], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_FX.REAL_DATED);
    expect(r.bloqueaCostoOficial).toBe(false);
  });

  it('FX real pero VIEJO (>7 días, sin vigencia) → HISTORICAL, BLOQUEA (no viejo-como-vigente)', () => {
    const r = resolverFx('USD/MXN', [
      { par: 'USD/MXN', valor: 17.0, fuente: FUENTE_FX.FACTURA, fecha: '2026-08-01', evidencia: 'factura vieja' },
    ], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_FX.HISTORICAL);
    expect(r.bloqueaCostoOficial).toBe(true);
  });

  it('política/estimado → PROVISIONAL, BLOQUEA', () => {
    const r = resolverFx('USD/MXN', [
      { par: 'USD/MXN', valor: 17.5, fuente: FUENTE_FX.PROVISIONAL, fecha: HOY },
    ], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_FX.PROVISIONAL);
    expect(r.bloqueaCostoOficial).toBe(true);
  });

  it('elige el más autoritativo/vigente entre varios', () => {
    const r = resolverFx('USD/MXN', [
      { par: 'USD/MXN', valor: 17.0, fuente: FUENTE_FX.PROVISIONAL, fecha: HOY },
      { par: 'USD/MXN', valor: 18.2, fuente: FUENTE_FX.BANXICO, fecha: '2026-10-08', vigencia_hasta: '2026-10-31', evidencia: 'fix' },
    ], { hoy: HOY });
    expect(r.valor).toBe(18.2);
    expect(r.fuente).toBe(FUENTE_FX.BANXICO);
  });

  it('DETERMINISTA: mismas entradas → mismo resultado', () => {
    const obs = [{ par: 'USD/MXN', valor: 18.2, fuente: FUENTE_FX.BANXICO, fecha: '2026-10-08', vigencia_hasta: '2026-10-31' }];
    expect(resolverFx('USD/MXN', obs, { hoy: HOY })).toEqual(resolverFx('USD/MXN', obs, { hoy: HOY }));
  });

  it('RED-TEAM H1: POLÍTICA/estimado con vigencia FUTURA NO es VERIFIED_CURRENT (sigue bloqueando)', () => {
    const r = resolverFx('USD/MXN', [{ par: 'USD/MXN', valor: 18, fuente: FUENTE_FX.POLITICA, fecha: HOY, vigencia_hasta: '2099-01-01' }], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_FX.PROVISIONAL);
    expect(r.bloqueaCostoOficial).toBe(true);
  });

  it('RED-TEAM H1: FACTURA (no oficial) con vigencia que cubre hoy → REAL_DATED, no VERIFIED_CURRENT', () => {
    const r = resolverFx('USD/MXN', [{ par: 'USD/MXN', valor: 18, fuente: FUENTE_FX.FACTURA, fecha: HOY, vigencia_hasta: '2026-12-31' }], { hoy: HOY });
    expect(r.estado).toBe(ESTADO_FX.REAL_DATED);   // real, pero sólo Banxico es "vigente verificado"
  });

  it('RED-TEAM M1: empate real (dos Banxico mismo día, evidencia igual) → selección determinista', () => {
    const obs = [
      { par: 'USD/MXN', valor: 18.2, fuente: FUENTE_FX.BANXICO, fecha: '2026-10-08', vigencia_hasta: '2026-10-31' },
      { par: 'USD/MXN', valor: 18.1, fuente: FUENTE_FX.BANXICO, fecha: '2026-10-08', vigencia_hasta: '2026-10-31' },
    ];
    const a = resolverFx('USD/MXN', obs, { hoy: HOY });
    const b = resolverFx('USD/MXN', [...obs].reverse(), { hoy: HOY });
    expect(a.valor).toBe(b.valor);   // mismo resultado sin importar el orden de entrada
  });

  it('RED-TEAM L1: FX válido "hasta hoy" NO se marca HISTORICAL por la hora (fin de día)', () => {
    const r = resolverFx('USD/MXN', [{ par: 'USD/MXN', valor: 18.2, fuente: FUENTE_FX.BANXICO, fecha: '2026-10-09', vigencia_hasta: '2026-10-09' }], { hoy: Date.parse('2026-10-09T15:00:00Z') });
    expect(r.estado).toBe(ESTADO_FX.VERIFIED_CURRENT);
    expect(r.bloqueaCostoOficial).toBe(false);
  });

  it('RED-TEAM M2/L2: valor bool → no utilizable; `hoy` inválido → no degrada un vigente', () => {
    expect(normalizarFx({ par: 'USD/MXN', valor: false, fuente: FUENTE_FX.BANXICO, fecha: HOY }).utilizable).toBe(false);
    const r = resolverFx('USD/MXN', [{ par: 'USD/MXN', valor: 18, fuente: FUENTE_FX.BANXICO, fecha: '2026-01-01', vigencia_hasta: '2099-01-01' }], { hoy: 'no-es-fecha' });
    expect(r.estado).toBe(ESTADO_FX.VERIFIED_CURRENT);
  });
});
