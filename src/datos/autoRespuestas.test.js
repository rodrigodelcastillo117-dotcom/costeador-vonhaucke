import { describe, it, expect } from 'vitest';
import { respuestasPorReglaDeCasa, esSupuestoPreliminar, explicitoDe } from './autoRespuestas.js';

const P = [
  { question_key: 'largo_cubierta_mm', pregunta: 'Largo de la cubierta principal (mm)', tipo: 'number', impacto: 'alto', afecta: 'cubierta', supuesto: '2100' },
  { question_key: 'espesor_cubierta', pregunta: 'Espesor de cubierta', tipo: 'radio', opciones: ['16 mm', '19 mm', '25 mm'], impacto: 'medio', afecta: 'cubierta' },
  { question_key: 'tapacanto_tipo', pregunta: '¿Qué tapacanto lleva?', tipo: 'text', impacto: 'medio', afecta: 'cantos' },
  { question_key: 'acabado_estructura', pregunta: 'Acabado de la estructura de acero', tipo: 'radio', opciones: ['Pintura electrostática', 'Cromado', 'Crudo'], impacto: 'medio', afecta: 'estructura' },
  { question_key: 'cantidad_cajones', pregunta: 'Cajones totales (pedestal + credenza)', tipo: 'number', impacto: 'bajo', supuesto: '3', afecta: 'gavetas' },
  { question_key: 'material_banda', pregunta: 'Material de la banda central negra', tipo: 'text', impacto: 'medio', afecta: 'banda' },
];

describe('piloto automático · respuestas por regla de casa', () => {
  const r = respuestasPorReglaDeCasa(P);
  it('contesta lo que una regla sabe: espesor 19, tapacanto estándar, pintura electrostática', () => {
    expect(r.respuestas.espesor_cubierta).toMatch(/^19 mm/);
    expect(r.respuestas.tapacanto_tipo).toMatch(/Tapacanto PVC/);
    expect(r.respuestas.acabado_estructura).toMatch(/^Pintura electrostática/);
    for (const k of ['espesor_cubierta', 'tapacanto_tipo', 'acabado_estructura']) expect(r.respuestas[k]).toMatch(/\(regla de casa\)$/);
  });
  it('acepta el supuesto de la IA sólo con impacto bajo; lo de impacto alto o sin regla queda para la persona', () => {
    expect(r.respuestas.cantidad_cajones).toMatch(/Conserva tu supuesto.*3/);
    expect(r.pendientes).toEqual(['largo_cubierta_mm', 'material_banda']);
  });
  it('se puede apagar la aceptación de supuestos', () => {
    const s = respuestasPorReglaDeCasa(P, { aceptarSupuestosBajo: false });
    expect(s.pendientes).toContain('cantidad_cajones');
  });
  it('entrada vacía o rota no revienta', () => {
    expect(respuestasPorReglaDeCasa()).toEqual({ respuestas: {}, detalle: [], pendientes: [] });
    expect(respuestasPorReglaDeCasa([null, {}]).pendientes).toEqual([]);
  });
});

describe('supuestos preliminares (no son confirmaciones)', () => {
  it('la respuesta que conserva un supuesto de impacto bajo se reconoce como preliminar; las reglas de casa no', () => {
    const r = respuestasPorReglaDeCasa([
      { question_key: 'cajones', pregunta: '¿Cuántos cajones lleva la gaveta?', supuesto: '3 cajones', impacto: 'bajo' },
      { question_key: 'tapacanto', pregunta: '¿Qué tapacanto lleva?', impacto: 'medio' },
    ]);
    expect(esSupuestoPreliminar(r.respuestas.cajones)).toBe(true);
    expect(esSupuestoPreliminar(r.respuestas.tapacanto)).toBe(false);
    expect(esSupuestoPreliminar('')).toBe(false);
  });
});

describe('Q5·4 · lo explícito gana a la regla de casa', () => {
  it('"MDF 18 mm" pedido no se vuelve 19 mm: se respeta y el 19 queda como alternativa por confirmar', () => {
    const r = respuestasPorReglaDeCasa([{ question_key: 'espesor_costados', pregunta: '¿Espesor de los costados de melamina?', supuesto: 'MDF 18 mm según plano', impacto: 'medio', opciones: ['16 mm', '19 mm', '25 mm'] }]);
    expect(r.respuestas.espesor_costados).toMatch(/^Se respeta lo pedido: 18 mm\./);
    expect(r.respuestas.espesor_costados).toMatch(/19 mm .*alternativa por confirmar/);
    expect(r.detalle[0].regla).toBe('espesor_panel:explicito_gana');
    expect(r.detalle[0].explicito).toBe('18 mm');
  });
  it('sin dato explícito la regla contesta como antes (19 mm)', () => {
    const r = respuestasPorReglaDeCasa([{ question_key: 'espesor_cubierta', pregunta: 'Espesor de cubierta', opciones: ['16 mm', '19 mm', '25 mm'], impacto: 'medio' }]);
    expect(r.respuestas.espesor_cubierta).toMatch(/^19 mm/);
  });
  it('un calibre explícito en acero se conserva', () => {
    expect(explicitoDe({ pregunta: '¿Acabado del PTR?', supuesto: 'PTR cal. 14 pintado' }, 'pintura_acero')).toBe('calibre 14');
    expect(explicitoDe({ pregunta: '¿Espesor del respaldo?' }, 'espesor_respaldo')).toBeNull();
  });
});
