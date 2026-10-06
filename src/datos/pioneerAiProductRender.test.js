import { describe, it, expect } from 'vitest';
import { catalogoVonHauckeCompacto, acabadosVonHaucke, conocimientoDe } from '../voni/conocimiento.js';
import fs from 'node:fs';

describe('VONI · conocimiento real Von Haucke', () => {
  it('deriva líneas y variantes desde el registro costable', () => {
    const c=catalogoVonHauckeCompacto();
    expect(c.length).toBeGreaterThanOrEqual(20);
    for (const ruta of ['applt','cirque','alba','privacy4','eclipse','rio','via']) {
      expect(c.some(x=>x.ruta===ruta)).toBe(true);
    }
    expect(c.every(x=>Array.isArray(x.productos))).toBe(true);
  });

  it('conoce acabados reales sin afirmar compatibilidad universal', () => {
    const a=acabadosVonHaucke();
    expect(a.melamina.length).toBeGreaterThan(10);
    expect(a.pintura.length).toBeGreaterThan(1);
    const k=conocimientoDe('mampara de cristal para oficina');
    expect(k.a_la_medida_disponible).toBe(true);
    expect(k.regla_custom).toMatch(/NEW_SPECIAL/);
    expect(k.acabados.nota).toMatch(/compatibilidad/i);
  });

  it('Cocrear consulta el portafolio antes de inventar un especial', () => {
    const s=fs.readFileSync('src/componentes/CocrearV3.jsx','utf8');
    expect(s).toContain('contextoCatalogoParaIA(brief)');
    expect(s).toContain('context.von_haucke');
    expect(s).toContain('NEW_SPECIAL sólo cuando ninguna línea/producto real sea padre razonable');
  });

  it('Costeador advierte candidatos de línea existentes', () => {
    const s=fs.readFileSync('src/componentes/Costeador.jsx','utf8');
    expect(s).toContain('candidatosLinea');
    expect(s).toContain('Antes de hacerlo a la medida');
  });
});

describe('Render premium · fidelidad antes que belleza', () => {
  it('usa modelo profesional, 2K y auditor visual fail-closed', () => {
    const s=fs.readFileSync('supabase/functions/generar-render/index.ts','utf8');
    expect(s).toContain('"gemini-3-pro-image"');
    expect(s).toContain('imageSize');
    expect(s).toContain('"2K"');
    expect(s).toContain('auditarVisual');
    expect(s).toContain('RENDER_QA_FAILED');
    expect(s).not.toContain('const MODEL = "gemini-2.5-flash-image"');
  });

  it('Cocrear muestra el producto en un ambiente real con referencia geométrica', () => {
    const s=fs.readFileSync('src/componentes/CocrearV3.jsx','utf8');
    expect(s).toContain("modo:'ambiente'");
    expect(s).toContain('entorno:entornoNatural');
    expect(s).toContain("calidad:'2K'");
    expect(s).toContain('imagen:modelo');
  });

  it('Cotización no inventa una oficina sin referencia de layout', () => {
    const s=fs.readFileSync('src/componentes/Cotizacion.jsx','utf8');
    expect(s).toContain('desde Cotización no voy a inventar una oficina genérica');
    const i=s.indexOf('async function renderOficina()');
    const j=s.indexOf('// DESCARGAR de verdad:',i);
    const b=s.slice(i,j);
    expect(b).not.toContain("modo: 'oficina'");
  });
});

describe('VONI Council · 20 segundos', () => {
  it('usa 20s como presupuesto global máximo', () => {
    const s=fs.readFileSync('supabase/functions/voni-council/index.ts','utf8');
    expect(s).toContain('const councilBudget=20000');
    expect(s).not.toContain("VONI_COUNCIL_BUDGET_MS')||14500");
  });
});

describe('VONI 2.0 · Producto Maestro real', () => {
  it('search_products consulta productos activos y no selecciona economía', () => {
    const s=fs.readFileSync('src/voni/proveedorReal.js','utf8');
    const i=s.indexOf('search_products:');
    const b=s.slice(i, s.indexOf('\n};', i));
    expect(b).toContain("from('productos')");
    expect(b).toContain("eq('activo',true)");
    expect(b).toContain("ilike('nombre'");
    expect(b).toContain("ilike('codigo'");
    expect(b).toContain('version_tecnica_vigente_id');
    expect(b).not.toContain('costo');
    expect(b).not.toContain('margen');
  });
});
