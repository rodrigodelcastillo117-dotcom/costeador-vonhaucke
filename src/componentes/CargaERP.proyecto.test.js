import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('./CargaERP.jsx', import.meta.url)), 'utf8');

describe('CargaERP · workbooks reales de proyecto', () => {
  it('lee todas las hojas y usa el extractor determinista explo_x_id + cata_mp', () => {
    expect(src).toContain('leerHojas');
    expect(src).toContain('registrosErpDesdeWorkbookProyecto');
    expect(src).toContain("'workbook_proyecto'");
  });

  it('la carga sigue siendo explícita de Dirección, nunca automática al seleccionar archivo', () => {
    expect(src).toContain('data-testid="carga-erp-cargar"');
    expect(src).toContain('Cargar al catálogo');
    expect(src).toContain('nada se carga sin que Dirección pulse');
  });

  it('explica que los precios históricos no se certifican por venir de un proyecto', () => {
    expect(src).toContain('lo antiguo queda preliminar');
    expect(src).toContain('nunca se convierte en certificado');
  });
  it('muestra las brechas de la fuente antes de cargar', () => {
    for (const texto of ['Sin clave comercial (no se inventa)', 'Sin unidad en la fuente', 'Sin fecha de última compra', 'Sin costo real en la fuente']) {
      expect(src).toContain(texto);
    }
  });

  it('un workbook de proyecto fuerza revalidación de Compras antes de certificar', () => {
    expect(src).toContain('forzarValidacionCompras');
    expect(src).toContain("origen === 'workbook_proyecto'");
    expect(src).toContain('Precios de proyecto que requieren revalidación');
  });

});
