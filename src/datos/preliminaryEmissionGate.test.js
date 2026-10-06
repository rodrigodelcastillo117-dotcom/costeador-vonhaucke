import { describe, it, expect } from 'vitest';
import { bloqueosDeEmision } from './senales.js';
import { textoRazonEmision } from './emisionUX.js';
import fs from 'node:fs';

describe('costo preliminar · borrador sí, emisión definitiva no', () => {
  it('la UI lo trata como blocker determinista', () => {
    const b = bloqueosDeEmision([{ nombre:'Especial', cantidad:1, precioUnitario:1000, costoUnitario:600, costoEstado:'preliminar' }]);
    expect(b.some(x => x.code === 'COSTO_PRELIMINAR')).toBe(true);
  });

  it('el mensaje del gate no expone economía interna', () => {
    expect(textoRazonEmision('linea_2_costo_preliminar_no_certificado')).toMatch(/falta certificar/i);
  });

  it('la migración final usa el estado persistido, no el snapshot del navegador', () => {
    const s = fs.readFileSync('docs/sql/emission_exact_cents_v3.sql','utf8');
    expect(s).toContain("lower(coalesce(v_dbpt->>'costoEstado','')) = 'preliminar'");
    expect(s).toContain('costo_preliminar_no_certificado');
  });
});
