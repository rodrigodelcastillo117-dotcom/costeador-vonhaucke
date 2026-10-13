// Validadores mínimos de Ingeniería (Entrega A). BOMs REALES del laboratorio; los casos negativos son esos mismos BOMs con
// UN defecto inyectado (el que se quiere atrapar). Sin defecto no debe haber hallazgos (medido: 0 falsos positivos en los
// 23 despieces reales de las rondas del 13-oct).
import { describe, it, expect } from 'vitest';
import { revisarEstructura, medidasDe } from './revisionEstructural.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import fx from './fixtures/boms_reales_lab.json';

const ins = mapaInsumos(INSUMOS_SEMILLA);
const bom = (k) => fx.boms[k].map((c) => ({ ...c }));
const reglas = (r) => r.observaciones.filter((o) => o.nivel === 'blocker').map((o) => o.regla);
const GAB = { descripcion: 'Gabinete alto 2 puertas 800x450x2000 mm', medidasGenerales: '800 x 450 x 2000 mm', insumos: ins };

describe('validadores mínimos de Ingeniería', () => {
  it('medidas generales: mm, con símbolo ×, y en metros', () => {
    expect(medidasDe('800 x 450 x 2000 mm')).toEqual([800, 450, 2000]);
    expect(medidasDe('1400 × 32 × 400 mm (largo × espesor × alto)')).toEqual([1400, 400]);
    expect(medidasDe('1.8 x 0.45 m')).toEqual([1800, 450]);
  });
  it('gabinete real sin defecto: ningún bloqueo nuevo', () => {
    expect(reglas(revisarEstructura({ componentes: bom('gabinete_alto'), ...GAB }))).toEqual([]);
  });
  it('MEDIDA IMPOSIBLE: un lateral de 2400 en un gabinete de 2000 de alto', () => {
    const b = bom('gabinete_alto'); b[0].largoMM = 2400;
    expect(reglas(revisarEstructura({ componentes: b, ...GAB }))).toContain('medida_imposible');
  });
  it('MATERIAL/FUNCIÓN: el soporte del biombo ATBIOCRT5 costeado con pintura (caso real) se bloquea', () => {
    const r = revisarEstructura({ componentes: bom('biombo_ATBIOCRT5'), descripcion: 'Biombo divisor 1400 x 400', insumos: ins });
    expect(reglas(r)).toEqual(['material_funcion']);
  });
  it('MATERIAL/FUNCIÓN: el renglón de la propia pintura ("Pintura electrostática… base") NO se bloquea', () => {
    const r = revisarEstructura({ componentes: bom('credenza'), descripcion: 'Credenza 3 puertas', insumos: ins });
    expect(reglas(r)).not.toContain('material_funcion');
  });
  it('DUPLICADO: la misma pieza dos veces bloquea; la persona puede declararla revisada', () => {
    const b = bom('gabinete_alto'); b.push({ ...b[0] });
    const r = revisarEstructura({ componentes: b, ...GAB });
    expect(reglas(r)).toContain('duplicado');
    const clave = r.observaciones.find((o) => o.regla === 'duplicado').clave;
    expect(reglas(revisarEstructura({ componentes: b, ...GAB, aceptadas: [clave] }))).not.toContain('duplicado');
  });
  it('CANTIDAD INCOMPATIBLE: pide 3 puertas y el despiece trae 2', () => {
    const r = revisarEstructura({ componentes: bom('gabinete_alto'), ...GAB, descripcion: 'Gabinete alto 3 puertas' });
    expect(reglas(r)).toContain('cantidad_incompatible');
  });
  it('CANTIDAD IMPOSIBLE: 0 piezas', () => {
    const b = bom('gabinete_alto'); b[1].piezas = 0;
    expect(reglas(revisarEstructura({ componentes: b, ...GAB }))).toContain('cantidad_imposible');
  });
  it('medida imposible y material/función NO se pueden "dar por revisados": se corrigen', () => {
    const b = bom('gabinete_alto'); b[0].largoMM = 2400;
    const r = revisarEstructura({ componentes: b, ...GAB, aceptadas: [`medida_imposible:${b[0].nombre}`] });
    expect(reglas(r)).toContain('medida_imposible');
  });
});
