import { describe, it, expect } from 'vitest';
import { schemaSinInforme, planPass, normalizarPropuesta, NOTA_TEXTO_INICIAL } from './requestPlan.js';

// ============================================================================
//  P0.COSTEO · analizar-mueble · contrato del PLAN de petición (informe diferido
//  en 1ª pasada de texto + right-size). Offline: NO toca Anthropic ni Deno.
//  Mide effort/max_tokens por pasada y la validez del BOM tras normalizar.
// ============================================================================
const SCHEMA_STUB = {
  type: 'object',
  required: ['producto', 'tipo', 'piezas', 'descripcionCliente', 'materiales', 'volumenAsumido', 'confianzaGeneral', 'informe', 'preguntas', 'design_intent'],
  properties: { informe: { type: 'string' }, piezas: { type: 'array' } },
};
const bomPieza = (over = {}) => ({ nombre: 'Cubierta', insumoId: 'melamina-19-nogal', material_solicitado: 'melamina 19mm nogal', material_match: 'EXACT', forma: 'area', largoMM: 1200, anchoMM: 600, cantidad: 1, hojas: 0.3, confianza: 'media', nota: '', razonamiento: 'cota frontal', semantic_role: 'cubierta', ...over });

describe('P0.COSTEO · planPass: right-size por tipo de pasada', () => {
  it('1) escritorio simple (sólo texto, 1ª pasada) → difiere informe, effort low, maxTok 8000', () => {
    const p = planPass({ soloTexto: true, esRevision: false, respCount: 0 });
    expect(p.primeraPasadaTexto).toBe(true);
    expect(p.deferInforme).toBe(true);
    expect(p.effort).toBe('low');
    expect(p.maxTok).toBe(8000);
  });

  it('PDF/imagen → NO difiere (effort medium, maxTok 10000): el recorte NO aplica', () => {
    const p = planPass({ soloTexto: false, esRevision: false, respCount: 0 });
    expect(p.deferInforme).toBe(false);
    expect(p.effort).toBe('medium');
    expect(p.maxTok).toBe(10000);
  });

  it('revisión → NO difiere (effort low, maxTok 6000): intacta', () => {
    const p = planPass({ soloTexto: true, esRevision: true, respCount: 0 });
    expect(p.deferInforme).toBe(false);
    expect(p.maxTok).toBe(6000);
  });

  it('texto con respuestas previas (pasada posterior) → NO difiere (sólo la 1ª pasada)', () => {
    const p = planPass({ soloTexto: true, esRevision: false, respCount: 3 });
    expect(p.primeraPasadaTexto).toBe(false);
    expect(p.deferInforme).toBe(false);
    expect(p.maxTok).toBe(10000);
  });
});

describe('P0.COSTEO · schemaSinInforme: quita SÓLO informe del required', () => {
  it('informe ya NO es required, pero el BOM y todo lo de costeo sí', () => {
    const s = schemaSinInforme(SCHEMA_STUB);
    expect(s.required).not.toContain('informe');
    for (const k of ['producto', 'tipo', 'piezas', 'design_intent', 'preguntas', 'descripcionCliente', 'materiales']) {
      expect(s.required, `debe seguir exigiendo ${k}`).toContain(k);
    }
    expect(SCHEMA_STUB.required).toContain('informe');  // no muta el original
  });
});

describe('P0.COSTEO · normalizarPropuesta: contrato público + fail-closed', () => {
  it('2) BOM de 10-20 componentes → se preservan TODOS los datos de costeo', () => {
    const piezas = Array.from({ length: 15 }, (_, i) => bomPieza({ nombre: 'Pieza' + i }));
    const prop = { producto: 'estación', tipo: 'estacion', piezas, preguntas: [], design_intent: { product_type: 'estación', module_count: 1, seat_count: 0, user_capacity: 0 }, descripcionCliente: 'x', materiales: ['melamina'], volumenAsumido: 'prototipo', confianzaGeneral: 'media' };
    const out = normalizarPropuesta(prop, { deferInforme: true });
    expect(out.piezas.length).toBe(15);
    for (const pz of out.piezas) {
      for (const f of ['largoMM', 'anchoMM', 'cantidad', 'material_match', 'insumoId', 'confianza', 'razonamiento', 'semantic_role']) {
        expect(pz, `falta ${f}`).toHaveProperty(f);
      }
      expect(pz).not.toHaveProperty('precio');   // la IA NUNCA pone precio (lo costea el motor)
      expect(pz).not.toHaveProperty('costo');
    }
    expect(out.informe).toBe('');               // diferido → string vacío (contrato público intacto)
    expect(out.informe_pendiente).toBe(true);
  });

  it('1b) informe ausente (diferido) → informe:"" + informe_pendiente=true (backwards-compat)', () => {
    const out = normalizarPropuesta({ piezas: [bomPieza()] }, { deferInforme: true });
    expect(typeof out.informe).toBe('string');
    expect(out.informe).toBe('');
    expect(out.informe_pendiente).toBe(true);
  });

  it('3) ambiguo con 1 bloqueador → se conserva la pregunta y el material sin inventar (fail-closed)', () => {
    const prop = {
      piezas: [bomPieza({ insumoId: '', material_solicitado: 'superficie sólida azul', material_match: 'NOT_AVAILABLE', nota: 'familia ausente en catálogo' })],
      preguntas: [{ question_key: 'superficie_material', pregunta: '¿Confirmas superficie sólida?', tipo: 'radio', opciones: ['Sí', 'No'], impacto: 'alto', afecta: 'bom', supuesto: 'superficie sólida' }],
      informe: '',
    };
    const out = normalizarPropuesta(prop, { deferInforme: true });
    expect(out.preguntas.length).toBe(1);                 // el bloqueador sobrevive
    expect(out.piezas[0].insumoId).toBe('');              // material no disponible → NO se inventa id
    expect(out.piezas[0].material_match).toBe('NOT_AVAILABLE');
  });

  it('4) respuesta truncada (sin informe, BOM parcial) → sigue normalizando informe a string', () => {
    const out = normalizarPropuesta({ piezas: [bomPieza()] /* informe ausente por truncado */ }, { deferInforme: true });
    expect(out.informe).toBe('');
    expect(Array.isArray(out.piezas)).toBe(true);
  });

  it('si el modelo SÍ devolvió informe en la 1ª pasada, se respeta (informe_pendiente=false)', () => {
    const out = normalizarPropuesta({ piezas: [bomPieza()], informe: '## Resumen\n...' }, { deferInforme: true });
    expect(out.informe.length).toBeGreaterThan(0);
    expect(out.informe_pendiente).toBe(false);
  });

  it('NOTA_TEXTO_INICIAL prioriza BOM y prohíbe omitir datos de costeo / inventar', () => {
    expect(NOTA_TEXTO_INICIAL).toMatch(/PRIORIZA el BOM/);
    expect(NOTA_TEXTO_INICIAL).toMatch(/material_match|insumoId/);
    expect(NOTA_TEXTO_INICIAL).toMatch(/NO lo inventes|fail-closed/i);
  });
});
