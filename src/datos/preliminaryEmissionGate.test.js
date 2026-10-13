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

describe('VH-035c · bloqueo por recosteo pendiente con texto para la persona', () => {
  it('los tres motivos y el genérico; nunca el código crudo', async () => {
    const { textoRazonEmision } = await import('./emisionUX.js');
    expect(textoRazonEmision('linea_1_recosteo_pendiente_producto_cambiado')).toBe('Línea 1: cambió el producto, su versión o su despiece; su costo anterior ya no vale y Dirección debe recostearla antes de emitir.');
    expect(textoRazonEmision('linea_2_recosteo_pendiente_material_cambiado')).toMatch(/^Línea 2: cambió un material/);
    expect(textoRazonEmision('linea_3_recosteo_pendiente_lote_cambiado')).toMatch(/cantidad y su costo depende del lote/);
    expect(textoRazonEmision('linea_4_recosteo_pendiente_recosteo')).toMatch(/^Línea 4: cambió después de costearse/);
    for (const c of ['linea_1_recosteo_pendiente_producto_cambiado', 'linea_4_recosteo_pendiente_recosteo']) expect(textoRazonEmision(c)).not.toMatch(/recosteo_pendiente|_/);
  });
});

describe('SEG-01 · renglón que no corresponde a lo costeado, dicho para la persona', () => {
  it('no muestra el código crudo y dice qué hacer', () => {
    const t = textoRazonEmision('linea_1_no_corresponde_a_lo_costeado');
    expect(t).toMatch(/^Línea 1: no corresponde a lo que se costeó/);
    expect(t).toMatch(/Dirección lo recostee/);
    expect(t).not.toMatch(/no_corresponde/);
  });
});
