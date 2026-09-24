import { describe, it, expect } from 'vitest';
import { generarEcoAcustic, coloresDeEcoAcustic, COLORES_16 } from './ecoacustic.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { calcular } from '../motor/calculo.js';
import { LINEAS_REG } from './lineas.js';

// Precios reales de "Lista_de_precios_Sonara_2025" (Rafa Carranza, 2026-08-24).
// Von Haucke compra el panel YA TERMINADO — el costo indirecto debe caer
// EXACTO en el precio de lista de Sonara para cada SKU, sin inventar nada.
describe('EcoAcustic: precios reales de Sonara, uno por uno', () => {
  const INS = mapaInsumos(INSUMOS_SEMILLA);
  const costoDe = (config) => {
    const g = generarEcoAcustic(config);
    const r = calcular(g, 1, INS);
    return r.detalleInsumos.find((d) => d.insumoId === g.componentes[0].insumoId).costo;
  };

  it('Panel liso 9mm = $1,880 y 12mm = $2,570', () => {
    expect(costoDe({ producto: 'panel_liso', espesor: '9' })).toBeCloseTo(1880, 2);
    expect(costoDe({ producto: 'panel_liso', espesor: '12' })).toBeCloseTo(2570, 2);
  });

  it('Corte de línea 9mm = $2,935 y 12mm = $3,725', () => {
    expect(costoDe({ producto: 'corte_linea', espesor: '9' })).toBeCloseTo(2935, 2);
    expect(costoDe({ producto: 'corte_linea', espesor: '12' })).toBeCloseTo(3725, 2);
  });

  it('Shapes: 30cm=$370, 60cm=$1,465, rect 1.20x0.30=$1,465, rect 1.20x0.60=$2,935', () => {
    expect(costoDe({ producto: 'shapes_30' })).toBeCloseTo(370, 2);
    expect(costoDe({ producto: 'shapes_60' })).toBeCloseTo(1465, 2);
    expect(costoDe({ producto: 'shapes_rect_30' })).toBeCloseTo(1465, 2);
    expect(costoDe({ producto: 'shapes_rect_60' })).toBeCloseTo(2935, 2);
  });

  it('Custom: A9=$3,355 A12=$4,145 B9=$3,920 B12=$4,670 C9=$4,700 D9=$5,875', () => {
    expect(costoDe({ producto: 'custom', grado: 'A', espesor: '9' })).toBeCloseTo(3355, 2);
    expect(costoDe({ producto: 'custom', grado: 'A', espesor: '12' })).toBeCloseTo(4145, 2);
    expect(costoDe({ producto: 'custom', grado: 'B', espesor: '9' })).toBeCloseTo(3920, 2);
    expect(costoDe({ producto: 'custom', grado: 'B', espesor: '12' })).toBeCloseTo(4670, 2);
    expect(costoDe({ producto: 'custom', grado: 'C', espesor: '9' })).toBeCloseTo(4700, 2);
    expect(costoDe({ producto: 'custom', grado: 'D', espesor: '9' })).toBeCloseTo(5875, 2);
  });

  it('Custom grado C/D no tiene 12mm real: cae a 9mm en vez de inventar un precio', () => {
    expect(costoDe({ producto: 'custom', grado: 'C', espesor: '12' })).toBeCloseTo(4700, 2);
    expect(costoDe({ producto: 'custom', grado: 'D', espesor: '12' })).toBeCloseTo(5875, 2);
  });

  it('Flex $450/m² y con corte $780/m²', () => {
    expect(costoDe({ producto: 'flex' })).toBeCloseTo(450, 2);
    expect(costoDe({ producto: 'flex', corte: true })).toBeCloseTo(780, 2);
  });

  it('Lambrín $4,685 y Ranurado en V $4,815', () => {
    expect(costoDe({ producto: 'lambrin' })).toBeCloseTo(4685, 2);
    expect(costoDe({ producto: 'ranurado_v' })).toBeCloseTo(4815, 2);
  });

  it('Panel impreso $3,500 y con corte $3,825', () => {
    expect(costoDe({ producto: 'impreso' })).toBeCloseTo(3500, 2);
    expect(costoDe({ producto: 'impreso', corte: true })).toBeCloseTo(3825, 2);
  });

  it('Suspendidos: SACC003 1.20=$2,935/2.40=$5,870; SACC004 y SACC005 1.20=$2,935/2.40=$8,805; SACC006=$2,935', () => {
    expect(costoDe({ producto: 'suspendido', modelo: 'sacc003', tamano: '120' })).toBeCloseTo(2935, 2);
    expect(costoDe({ producto: 'suspendido', modelo: 'sacc003', tamano: '240' })).toBeCloseTo(5870, 2);
    expect(costoDe({ producto: 'suspendido', modelo: 'sacc004', tamano: '120' })).toBeCloseTo(2935, 2);
    expect(costoDe({ producto: 'suspendido', modelo: 'sacc004', tamano: '240' })).toBeCloseTo(8805, 2);
    expect(costoDe({ producto: 'suspendido', modelo: 'sacc005', tamano: '120' })).toBeCloseTo(2935, 2);
    expect(costoDe({ producto: 'suspendido', modelo: 'sacc005', tamano: '240' })).toBeCloseTo(8805, 2);
    expect(costoDe({ producto: 'suspendido', modelo: 'sacc006', tamano: '120' })).toBeCloseTo(2935, 2);
    expect(costoDe({ producto: 'suspendido', modelo: 'sacc006', tamano: '240' })).toBeCloseTo(2935, 2); // tamaño único
  });

  it('Suspendido + herraje agrega $245 de herraje aparte', () => {
    const g = generarEcoAcustic({ producto: 'suspendido', modelo: 'sacc003', tamano: '120', herraje: true });
    expect(g.componentes).toHaveLength(2);
    const r = calcular(g, 1, INS);
    const herraje = r.detalleInsumos.find((d) => d.insumoId === 'eco-herraje-colgante');
    expect(herraje.costo).toBeCloseTo(245, 2);
  });
});

describe('EcoAcustic: restricción de colores por espesor/tipo', () => {
  it('9mm acepta los 16 colores; 12mm solo 3 grises', () => {
    expect(coloresDeEcoAcustic('panel_liso', { espesor: '9' })).toHaveLength(16);
    expect(coloresDeEcoAcustic('panel_liso', { espesor: '12' }).map((c) => c.id).sort())
      .toEqual(['gris', 'gris-espacial', 'gris-plateado'].sort());
  });

  it('corte de línea 12mm acepta Negro + 3 grises (distinto a panel liso 12mm)', () => {
    expect(coloresDeEcoAcustic('corte_linea', { espesor: '12' }).map((c) => c.id).sort())
      .toEqual(['negro', 'gris', 'gris-espacial', 'gris-plateado'].sort());
  });

  it('Flex solo acepta 5 colores fijos, sin importar espesor', () => {
    expect(coloresDeEcoAcustic('flex').map((c) => c.id).sort())
      .toEqual(['negro', 'camello', 'gris', 'gris-espacial', 'gris-plateado'].sort());
  });

  it('COLORES_16 no tiene ids repetidos', () => {
    const ids = COLORES_16.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('EcoAcustic: registrada en LINEAS_REG como cualquier otra línea', () => {
  it('aparece en el registro con su generador', () => {
    expect(LINEAS_REG.ecoacustic).toBeDefined();
    expect(LINEAS_REG.ecoacustic.titulo).toBe('EcoAcustic');
    expect(typeof LINEAS_REG.ecoacustic.generar).toBe('function');
    expect(LINEAS_REG.ecoacustic.productos.length).toBeGreaterThan(5);
  });
});
