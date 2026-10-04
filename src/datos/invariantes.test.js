// ============================================================================
//  INVARIANTES CRÍTICOS = 100% (quality-bar §45 / 99% TRUST CONTRACT).
//  Un solo lugar que BLOQUEA regresiones en las garantías que no admiten fallo:
//   - UNKNOWN != 0 (nunca costo "gratis" por un precio ausente);
//   - el vendedor nunca recibe economía;
//   - ninguna acción se declara exitosa sin que la tool/verify lo confirme;
//   - un render nunca se marca "validado" si no se verificó;
//   - ningún mueble desaparece en silencio (requested = placed+unplaced+excluded);
//   - cambiar el producto deja obsoleto (stale) lo de aguas abajo.
//  Si cualquiera se rompe, este archivo falla: es la red de seguridad del contrato.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { interpretarIntent, construirProductSpec, extraerDNA, clasificarProducto, costearSpec, COST_STATUS } from './cocrear.js';
import { voniContext, voniTurno } from './voni.js';
import { compileRenderPrompt, renderStale } from './renderPrompt.js';
import { estadoLayout } from './floorSpec.js';

const specDe = (texto, rev = 1) => { const i = interpretarIntent(texto); i.dimensiones = i.dimensiones || {}; return construirProductSpec(i, extraerDNA(i), clasificarProducto(i, {}), { rev }); };

describe('INVARIANTE · UNKNOWN != 0 (precio ausente nunca es $0)', () => {
  it('insumo presente sin precio ⇒ cost_status PENDING_PRICE, official_cost null', () => {
    const insumos = {
      tab: { id: 'tab', nombre: 'Tablero', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true },
      sinp: { id: 'sinp', nombre: 'Pieza sin precio', seccion: 'herrajes', clase: 'indirecta', unidad: 'pza', precio: null },
    };
    const spec = specDe('credenza 1.6 m laminado');
    spec.componentes = [{ nombre: 'Cuerpo', insumoId: 'tab', hojas: 1, piezas: 1, cantidad: 1 }, { nombre: 'Pieza sin precio', insumoId: 'sinp', cantidad: 1, piezas: 1 }];
    const snap = costearSpec(spec, insumos, { aprovechamientoCorte: 80, margenObjetivo: 40, modeloCosteo: 'clasico' });
    expect(snap.official_cost).toBeNull();
    expect(snap.cost_status).toBe(COST_STATUS.PENDING_PRICE);
  });
});

describe('INVARIANTE · seller nunca recibe economía', () => {
  it('voniContext(vendedor) no trae costState', () => {
    expect(voniContext({ spec: { hash: 'h' }, costState: { costo: 999 } }, 'vendedor').costState).toBeUndefined();
  });
});

describe('INVARIANTE · ninguna acción se declara exitosa sin verificación', () => {
  it('tool falla ⇒ voniTurno ok=false y nunca "listo"', async () => {
    const intent = interpretarIntent('recepción 2.4 m nogal'); intent.dimensiones = { ancho_mm: 2400 };
    const r = await voniTurno('hazla 20 cm más corta', {
      intentActual: intent, estudio: { spec: construirProductSpec(intent, extraerDNA(intent), clasificarProducto(intent, {}), { rev: 1 }) },
      tools: { CREATE_REVISION: async () => ({ ok: false, error: 'fallo' }) },
    });
    expect(r.ok).toBe(false);
    expect(r.newRev).toBeFalsy();
    expect(r.response.humano.toLowerCase()).not.toMatch(/\bapliqué\b|\blisto\b/);
  });
});

describe('INVARIANTE · render nunca "validado" sin verificación', () => {
  it('el compilado NO trae flag de validado; sólo manifiesto esperado', () => {
    const c = compileRenderPrompt(specDe('recepción 2.4 m nogal iluminación'));
    expect(c.validated).toBeUndefined();
    expect(c.expected).toBeTruthy();
  });
  it('cambiar el spec ⇒ render stale (no aparenta vigente)', () => {
    const c = compileRenderPrompt(specDe('recepción 2.4 m nogal', 1));
    expect(renderStale(c, specDe('recepción 2.8 m nogal', 2))).toBe(true);
  });
});

describe('INVARIANTE · ningún mueble desaparece (requested = placed+unplaced+excluded)', () => {
  it('48 pedidos, 23 colocados ⇒ 25 sin colocar, estado INCOMPLETE', () => {
    const st = estadoLayout({ requested: 48, placed: 23, unplaced: 25, excluded: 0 });
    expect(st.status).toBe('LAYOUT_INCOMPLETE');
  });
  it('inconsistencia (23 placed sin unplaced de 48) ⇒ NO se declara válido', () => {
    const st = estadoLayout({ requested: 48, placed: 23, unplaced: 0, excluded: 0 });
    expect(st.status).not.toBe('LAYOUT_VALID');
  });
});
