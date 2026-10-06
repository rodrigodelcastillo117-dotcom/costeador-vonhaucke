import { describe, it, expect } from 'vitest';
import { renderSpecFromGraph, visualProfileFromContext, RENDER_SPEC_VERSION } from './renderSpec.js';
import { compileRenderPrompt, renderStale } from './renderPrompt.js';

const graph = (design_intent, nodes, relations = []) => ({
  schema_version: 'structural_graph_v1', design_intent, nodes, relations,
});

describe('visualProfileFromContext — no todo es "oficina"', () => {
  it('check-in de aeropuerto', () => {
    expect(visualProfileFromContext('counter de check-in para aeropuerto')).toBe('airport_checkin');
  });
  it('farmacia, militar, retail, hotel, corporativo', () => {
    expect(visualProfileFromContext('mostrador de farmacia')).toBe('pharmacy');
    expect(visualProfileFromContext('armero para gobierno')).toBe('military');
    expect(visualProfileFromContext('exhibidor de retail')).toBe('retail');
    expect(visualProfileFromContext('recepción de hotel')).toBe('hotel');
    expect(visualProfileFromContext('escritorio de oficina')).toBe('corporate');
  });
  it('sin contexto reconocible → product_studio', () => {
    expect(visualProfileFromContext('cosa')).toBe('product_studio');
  });
});

describe('renderSpecFromGraph — contrato tipado', () => {
  it('EL CASO QUE FALLÓ: barra comunal 6 personas, monolítica → module_count 1, user_capacity 6', () => {
    const g = graph(
      { product_type: 'barra alta comunal', module_count: 1, seat_count: 0, user_capacity: 6, overall_dimensions: { raw: '3600x750x1050' } },
      [
        { id: 'n1_cubierta', semantic_role: 'cubierta', quantity: 1, insumo_id: 'solid-surface-azul' },
        { id: 'n2_estructura', semantic_role: 'estructura', quantity: 1, insumo_id: 'lamina-14' },
        { id: 'n3_elec', semantic_role: 'herraje', quantity: 4, insumo_id: 'modulo-usb-byrne' },
      ],
    );
    const spec = renderSpecFromGraph(g, { materiales: ['Superficie sólida azul', 'Lámina de acero'], descripcion: 'barra comunal para 6 personas' });
    expect(spec.schema_version).toBe(RENDER_SPEC_VERSION);
    expect(spec.counts.module_count).toBe(1);          // NO 6
    expect(spec.counts.user_capacity).toBe(6);
    expect(spec.counts.seat_count).toBe(0);            // barra sin bancos
    expect(spec.counts.electrical_module_count).toBe(4);
    expect(spec.locked_geometry).toBe(true);
  });

  it('cuenta cajones, puertas, patas, pantallas por rol/insumo', () => {
    const g = graph(
      { product_type: 'counter de check-in', module_count: 2, seat_count: 0, user_capacity: 0 },
      [
        { id: 'n1', semantic_role: 'gaveta', quantity: 3 },
        { id: 'n2', semantic_role: 'puerta', quantity: 2 },
        { id: 'n3', semantic_role: 'pata', quantity: 4 },
        { id: 'n4', semantic_role: 'herraje', quantity: 2, insumo_id: 'portamonitor-loktec-d7a' },
      ],
    );
    const spec = renderSpecFromGraph(g, { descripcion: 'check-in aeropuerto' });
    expect(spec.counts.drawer_count).toBe(3);
    expect(spec.counts.door_count).toBe(2);
    expect(spec.counts.support_count).toBe(4);
    expect(spec.counts.screen_count).toBe(2);
    expect(spec.visual_profile).toBe('airport_checkin');
  });

  it('solid surface azul → finish mineral + color azul, sin veta de madera', () => {
    const g = graph(
      { product_type: 'counter', module_count: 1 },
      [{ id: 'n1', semantic_role: 'cubierta', quantity: 1, insumo_id: 'solid-surface-azul' }],
    );
    const spec = renderSpecFromGraph(g, { materiales: ['Superficie sólida 12 mm AZUL mineral'] });
    expect(spec.material_families).toContain('superficie_solida');
    expect(spec.finishes.join(' ')).toMatch(/mineral matte seamless/);
    expect(spec.finishes.join(' ')).toMatch(/no wood grain/);
    expect(spec.finishes.join(' ')).toMatch(/color: azul/);
  });

  it('grafo vacío → null (no revienta)', () => {
    expect(renderSpecFromGraph(null)).toBe(null);
    expect(renderSpecFromGraph({ nodes: [] })).toBe(null);
  });
});


describe('Cocrear render fidelity · fail-closed', () => {
  it('render legado sin specHash se considera stale', async () => {
    const { renderStale } = await import('./renderPrompt.js');
    expect(renderStale({ dataUrl: 'https://example.test/r.png' }, { hash: 'spec-actual' })).toBe(true);
  });
  it('misma firma sigue vigente', async () => {
    const { renderStale } = await import('./renderPrompt.js');
    expect(renderStale({ specHash: 'abc' }, { hash: 'abc' })).toBe(false);
  });
  it('firma distinta queda stale', async () => {
    const { renderStale } = await import('./renderPrompt.js');
    expect(renderStale({ specHash: 'abc' }, { hash: 'def' })).toBe(true);
  });
});


describe('render visual revision contract', () => {
  it('compileRenderPrompt carries the canonical visual signature', () => {
    const spec = { hash:'spec-x', familia:'mesa', dimensiones:{ancho_mm:1200,prof_mm:600,alto_mm:750}, materiales:[{material:'nogal'}], acabados:[], caracteristicas:[], capacidad:{personas:4}, componentes:[] };
    const r = compileRenderPrompt(spec, {});
    expect(r.visualRevisionHash).toBeTruthy();
  });

  it('render without visual signature is stale against a current spec', () => {
    const spec = { hash:'spec-x', familia:'mesa', dimensiones:{ancho_mm:1200,prof_mm:600,alto_mm:750}, materiales:[{material:'nogal'}], acabados:[], caracteristicas:[], capacidad:{personas:4}, componentes:[] };
    expect(renderStale({specHash:'spec-x'}, spec)).toBe(true);
  });

  it('changing a material invalidates an otherwise matching render', () => {
    const a = { hash:'spec-a', familia:'mesa', dimensiones:{ancho_mm:1200}, materiales:[{material:'nogal'}], acabados:[], caracteristicas:[], capacidad:null, componentes:[] };
    const compiled = compileRenderPrompt(a, {});
    const render = { specHash:'spec-a', visualRevisionHash:compiled.visualRevisionHash };
    expect(renderStale(render, a)).toBe(false);
    const b = { ...a, materiales:[{material:'roble'}] };
    // specHash deliberately kept same to prove visual signature catches it too.
    expect(renderStale(render, b)).toBe(true);
  });
});
