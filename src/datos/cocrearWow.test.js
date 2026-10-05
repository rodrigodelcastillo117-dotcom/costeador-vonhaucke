import { describe, expect, it } from 'vitest';
import { prepararIntentCocrear, conceptosCocrear, aplicarConceptoCocrear, LAYOUT_COCREAR, detectarAlcanceCocrear } from './cocrearWow.js';
import { FAMILIA, construirProductSpec, extraerDNA, clasificarProducto } from './cocrear.js';
import { compileRenderPrompt } from './renderPrompt.js';

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

  it('A/B/C producen geometrías canónicas distintas y el render usa exactamente la elegida', () => {
    const base = prepararIntentCocrear('Quiero un hub colaborativo para 8 personas con vegetación viva, electrificación oculta y divisores acústicos desmontables, escalable a 12 puestos.');
    const concepts = conceptosCocrear(base);
    const expectedLayouts = [LAYOUT_COCREAR.A, LAYOUT_COCREAR.B, LAYOUT_COCREAR.C];
    const hashes = [];

    concepts.forEach((concept, i) => {
      const intent = aplicarConceptoCocrear(base, concept);
      expect(intent._concepto).toBe(concept.id);
      expect(intent._concepto_nombre).toBe(concept.nombre);
      expect(intent._concepto_layout).toBe(expectedLayouts[i]);
      expect(intent.caracteristicas).toContain(expectedLayouts[i]);

      const spec = construirProductSpec(intent, extraerDNA(intent), clasificarProducto(intent, {}), { rev: 1, componentes: [] });
      hashes.push(spec.hash);
      const render = compileRenderPrompt(spec, spec.dna);
      expect(render.render_spec.layout).toBe(expectedLayouts[i]);
      expect(render.expected.geometry.layout).toBe(expectedLayouts[i]);
      expect(render.descripcion).toContain('SELECTED CONCEPT GEOMETRY — MUST MATCH');
    });

    expect(new Set(hashes).size).toBe(3);
  });
});

describe('detectarAlcanceCocrear · producto vs zona vs proyecto (#6)', () => {
  it('oficinas completas / N personas grande ⇒ project', () => {
    expect(detectarAlcanceCocrear('Quiero cocrear las oficinas nuevas completas para 40 personas').scope).toBe('project');
    expect(detectarAlcanceCocrear('Proyecto de oficina para una empresa, varias áreas y salas').scope).toBe('project');
  });
  it('un mueble concreto ⇒ product (aunque mencione personas)', () => {
    expect(detectarAlcanceCocrear('Un escritorio operativo para 8 personas con jardinera').scope).toBe('product');
    expect(detectarAlcanceCocrear('Recepción escultórica curva con luz').scope).toBe('product');
  });
  it('mejorar una zona existente ⇒ zone', () => {
    expect(detectarAlcanceCocrear('Quiero mejorar esta zona de trabajo').scope).toBe('zone');
  });
  it('captura personas SIN topar en 24 (un proyecto puede ser mayor)', () => {
    expect(detectarAlcanceCocrear('oficinas completas para 24 personas').personas).toBe(24);
    expect(detectarAlcanceCocrear('Quiero cocrear las oficinas nuevas completas para 40 personas').personas).toBe(40);
  });
  it('no explota con vacío', () => {
    expect(detectarAlcanceCocrear('').scope).toBe('product');
    expect(detectarAlcanceCocrear(undefined).scope).toBe('product');
  });
});
