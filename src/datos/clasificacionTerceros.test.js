import { describe, it, expect } from 'vitest';
import { clasificarTercero, REGLAS_TERCERO } from './clasificacionTerceros.js';

describe('F1 · clasificacion de terceros (razonada por como fabrica VH, validada vs ENTCBCALP)', () => {
  it('COMPRA-VENTA: componente terminado que VH no fabrica', () => {
    expect(clasificarTercero('Cristal templado 6mm', 'cubiertas').clasificacion).toBe('compra_venta');
    expect(clasificarTercero('Vidrio claro 4mm').clasificacion).toBe('compra_venta');
    expect(clasificarTercero('Espejo 3mm').clasificacion).toBe('compra_venta');
    expect(clasificarTercero('LOGOTIPO ALPURA EN ACRILICO').clasificacion).toBe('compra_venta');  // terminado
  });
  it('FABRICADO: materia prima que VH procesa en casa (coincide con ENTCBCALP)', () => {
    expect(clasificarTercero('ACRILICO CRISTAL 4 X 6 ESPESOR 3 mm').clasificacion).toBe('fabricado');
    expect(clasificarTercero('ACRILICO TRASLUCIDO Z2 HOJA 4 X 8').clasificacion).toBe('fabricado');
    expect(clasificarTercero('Lamina policarbonato 6mm').clasificacion).toBe('fabricado');
  });
  it('orden correcto: logo-en-acrilico es terminado (compra_venta), acrilico-cristal es materia (fabricado)', () => {
    expect(clasificarTercero('LOGOTIPO EN ACRILICO').clasificacion).toBe('compra_venta');
    expect(clasificarTercero('ACRILICO CRISTAL 3mm').clasificacion).toBe('fabricado');  // 'cristal' aqui describe acrilico
  });
  it('AMBIGUO -> null -> el llamador bloquea (galvanizado/corte laser/termoformado)', () => {
    expect(clasificarTercero('TUERCA GALVANIZADO')).toBeNull();
    expect(clasificarTercero('Pieza corte laser')).toBeNull();
    expect(clasificarTercero('Capelo termoformado')).toBeNull();
  });
  it('fuente marcada catalogo_vh_draft (borrador que Compras confirma)', () => {
    expect(clasificarTercero('Cristal templado').fuente).toBe('catalogo_vh_draft');
    expect(REGLAS_TERCERO.length).toBeGreaterThan(0);
  });
});
