import { describe, expect, it } from 'vitest';
import { prepararIntentCocrear, conceptosCocrear } from './cocrearWow.js';
import { FAMILIA } from './cocrear.js';

describe('Cocrear WOW · preserva intención compleja', () => {
  it('interpreta operativo de 6 lugares con jardinera de acero como sistema, no escritorio 1.50 m', () => {
    const itn = prepararIntentCocrear('operativo 6 lugares, con una maceta intermedia de acero para poner plantas');
    expect(itn.familia).toBe(FAMILIA.ESCRITORIO);
    expect(itn.tipologia_cocrear).toBe('operativo_colaborativo');
    expect(itn.capacidad_personas).toBe(6);
    expect(itn.capacidad?.personas).toBe(6);
    expect(itn.dimensiones.ancho_mm).toBeGreaterThanOrEqual(3600);
    expect(itn.dimensiones.prof_mm).toBeGreaterThanOrEqual(1400);
    expect(itn.caracteristicas).toContain('jardinera_integrada');
    expect(itn.materiales.some((m) => m.material === 'metal')).toBe(true);
    expect(conceptosCocrear(itn)).toHaveLength(3);
  });

  it('no inventa costo ni BOM en la capa de concepto', () => {
    const itn = prepararIntentCocrear('módulo especial con iluminación');
    expect(itn._componentes).toBeUndefined();
    expect(itn.costo).toBeUndefined();
  });
});
