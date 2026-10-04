// ============================================================================
//  RENDER PROMPT COMPILER · tests. El render se compila desde el ProductSpec
//  EXACTO (geometría obligatoria), no de un prompt libre; y queda stale si el
//  spec cambia. (contrato §4,§13-17)
// ============================================================================
import { describe, it, expect } from 'vitest';
import { interpretarIntent, construirProductSpec, extraerDNA, clasificarProducto } from './cocrear.js';
import { compileRenderPrompt, renderSpecDeProducto, renderStale, RENDER_PROMPT_VERSION, diffFidelidad, verificarFidelidad } from './renderPrompt.js';

const specDe = (texto, rev = 1) => { const i = interpretarIntent(texto); i.dimensiones = i.dimensiones || {}; return construirProductSpec(i, extraerDNA(i), clasificarProducto(i, {}), { rev }); };

describe('RENDER PROMPT · deriva geometría del ProductSpec (no prompt libre)', () => {
  it('recepción con iluminación ⇒ MANDATORY incluye LED; geometría bloqueada', () => {
    const c = compileRenderPrompt(specDe('recepción curva 2.40 m nogal oscuro iluminación integrada'));
    expect(c.version).toBe(RENDER_PROMPT_VERSION);
    expect(c.render_spec.locked_geometry).toBe(true);
    expect(c.render_spec.mandatory.join(' ')).toMatch(/LED/i);
    expect(c.descripcion).toMatch(/MANDATORY FEATURES/);
    expect(c.descripcion).toMatch(/curved/);
    expect(c.materiales).toContain('nogal oscuro');
  });

  it('locker ⇒ door_count bloqueado derivado de medidas', () => {
    const rs = renderSpecDeProducto(specDe('smart locker 1.80 m con cerraduras y pantalla'));
    expect(rs.counts.door_count).toBeGreaterThan(0);
    expect(rs.mandatory.join(' ')).toMatch(/locks/i);
    expect(rs.counts.screen_count).toBe(1);
    expect(rs.product_type).toMatch(/locker/);
  });

  it('el manifiesto `expected` lista geometría/acabado/features para validar fidelidad', () => {
    const c = compileRenderPrompt(specDe('escritorio 1.80 m roble con cajones'));
    expect(c.expected.features.join(' ')).toMatch(/drawers/i);
    expect(c.expected.geometry).toHaveProperty('product_type');
    expect(c.expected.finish.length).toBeGreaterThan(0);
  });

  it('cambiar el spec ⇒ el render anterior queda STALE (por hash)', () => {
    const s1 = specDe('recepción 2.40 m nogal', 1);
    const c1 = compileRenderPrompt(s1);
    const s2 = specDe('recepción 2.80 m nogal', 2);
    expect(renderStale(c1, s2)).toBe(true);
    expect(renderStale(c1, s1)).toBe(false);
  });
});

describe('RENDER FIDELITY 10X · qué dejó de coincidir, no sólo sí/no', () => {
  it('mismo spec ⇒ fidelidad vigente, sin cambios', () => {
    const s = specDe('recepción 2.40 m nogal iluminación integrada', 1);
    const r = compileRenderPrompt(s);
    const v = verificarFidelidad(r, s);
    expect(v.vigente).toBe(true);
    expect(v.cambios).toHaveLength(0);
  });

  it('cambia el MATERIAL ⇒ reporta el cambio de acabado', () => {
    const s1 = specDe('recepción 2.40 m nogal', 1);
    const r1 = compileRenderPrompt(s1);
    const s2 = specDe('recepción 2.40 m roble', 1);           // mismo tamaño, otro material
    const v = verificarFidelidad(r1, s2);
    expect(v.vigente).toBe(false);
    expect(v.cambios.some((c) => c.campo === 'acabado')).toBe(true);
  });

  it('cambia una FEATURE ⇒ reporta el cambio de features', () => {
    const base = compileRenderPrompt(specDe('escritorio 1.80 m roble', 1));
    const conCajones = specDe('escritorio 1.80 m roble con cajones', 1);
    const v = verificarFidelidad(base, conCajones);
    expect(v.cambios.some((c) => c.campo === 'features')).toBe(true);
  });

  it('render sin manifiesto (legacy) pero del mismo spec ⇒ vigente null, no truena', () => {
    const s = specDe('mesa 1.2 m', 1);
    const v = verificarFidelidad({ specHash: s.hash }, s);   // sin expected, hash igual
    expect(v.vigente).toBeNull();
  });

  it('diffFidelidad detecta cambio de tipo y de conteo', () => {
    const a = { geometry: { product_type: 'reception desk', forma: 'curved', door_count: 4 }, finish: [], features: [] };
    const b = { geometry: { product_type: 'executive desk', forma: 'curved', door_count: 6 }, finish: [], features: [] };
    const d = diffFidelidad(a, b);
    expect(d.some((c) => c.campo === 'tipo')).toBe(true);
    expect(d.some((c) => c.campo === 'door_count')).toBe(true);
  });
});
