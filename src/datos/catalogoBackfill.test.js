// ============================================================================
//  BACKFILL DE ATRIBUTOS DEL CATÁLOGO — verificación en CI del generador (lab/).
//  Prueba la lógica determinista sobre una MUESTRA REAL de producción (2026-10-28),
//  incluyendo las trampas: una bisagra "PARA CRISTAL DE 6 mm" NO debe recibir
//  espesor_mm=6 (el 6 es del vidrio que sujeta, no suyo).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { calcularBackfill, generarSql } from '../../lab/catalogo_backfill/gen_backfill.mjs';

const muestra = JSON.parse(readFileSync(fileURLToPath(new URL('../../lab/catalogo_backfill/muestra_real.json', import.meta.url)), 'utf8'));
const porId = (id) => calcularBackfill(muestra.find((f) => f.id === id)).cambios;

describe('backfill · familia (des-contaminación)', () => {
  it('"BISAGRA PARA CRISTAL…" se reclasifica cristal → herraje_bisagra', () => {
    expect(porId('erp-bicnm').familia).toBe('herraje_bisagra');
  });
  it('rellena familia vacía de tableros/materiales reales', () => {
    expect(porId('melamina-19').familia).toBe('melamina');
    expect(porId('acrilico-6').familia).toBe('acrilico');
    expect(porId('cristal-templado').familia).toBe('cristal');
  });
});

describe('backfill · espesor_mm (sin inventar)', () => {
  it('tablero/cristal/acrílico con UN espesor en el nombre → lo toma', () => {
    expect(porId('melamina-19').espesor_mm).toBe(19);
    expect(porId('acrilico-6').espesor_mm).toBe(6);
    expect(porId('acrilico-cristal-3').espesor_mm).toBe(3);
    expect(porId('cristal-templado-12').espesor_mm).toBe(12);
  });
  it('TRAMPA: una bisagra "PARA CRISTAL DE 6 mm" NO recibe espesor_mm (el 6 es del vidrio)', () => {
    expect(porId('erp-biv515')).not.toHaveProperty('espesor_mm');
    // y su familia sí se arregla a herraje
    expect(porId('erp-biv515').familia).toBe('herraje_bisagra');
  });
  it('TRAMPA: un RANGO "6 A 10 mm" es ambiguo → no se adivina espesor', () => {
    expect(porId('erp-bisbirec610sa')).not.toHaveProperty('espesor_mm');
  });
});

describe('backfill · generarSql', () => {
  it('produce UPDATEs sólo para filas con cambios y escapa comillas', () => {
    const { sql, nFilas, nFam, nEsp } = generarSql(muestra);
    expect(nFilas).toBeGreaterThan(0);
    expect(nEsp).toBeGreaterThanOrEqual(5);   // melaminas, acrílicos, cristales con espesor
    expect(nFam).toBeGreaterThanOrEqual(5);
    expect(sql).toMatch(/UPDATE insumos_catalogo SET .* WHERE id = 'melamina-19';/);
    // La bisagra se actualiza SÓLO en familia, nunca en espesor_mm.
    const lineaBiv = sql.split('\n').find((l) => l.includes("'erp-biv515'"));
    expect(lineaBiv).toBeTruthy();
    expect(lineaBiv).not.toMatch(/espesor_mm/);
    expect(lineaBiv).toMatch(/familia = 'herraje_bisagra'/);
  });
});
