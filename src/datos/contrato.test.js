// ============================================================================
//  CONTRACT TEST DB ↔ FRONTEND (punto 6 del Perfect Pass).
//  Verifica que las columnas que el frontend PIDE existan de verdad en el esquema
//  (snapshot real de Supabase). Habría atrapado H2 (proyecto.cliente) y H3
//  (scope_zonas/renders en proyectos) ANTES del smoke. Falla si:
//   - un .select() de crm.js referencia una columna inexistente, o
//   - un contrato explícito (lo que leen los componentes) deja de cumplirse.
//  Si el esquema cambia a propósito, regenerar src/datos/fuentes/esquema_supabase.json.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import esquema from './fuentes/esquema_supabase.json';

const crmSrc = readFileSync(new URL('./crm.js', import.meta.url), 'utf8');

function cols(tabla) { return esquema[tabla] || null; }

describe('contrato: .select() de crm.js usa columnas reales', () => {
  const re = /\.from\('([a-z_]+)'\)\s*\.select\('([^']*)'\)/g;
  const usos = [];
  let m;
  while ((m = re.exec(crmSrc)) !== null) usos.push({ tabla: m[1], sel: m[2] });

  it('hay selects que auditar', () => { expect(usos.length).toBeGreaterThan(0); });

  for (const { tabla, sel } of usos) {
    it(`${tabla}: columnas del select existen`, () => {
      const esquemaTabla = cols(tabla);
      expect(esquemaTabla, `tabla ${tabla} no está en el snapshot`).toBeTruthy();
      for (let token of sel.split(',')) {
        token = token.trim();
        if (!token || token === '*') continue;
        const embed = token.match(/^([a-z_]+)\(([^)]*)\)$/);
        if (embed) {
          const [, sub, campos] = embed;
          expect(cols(sub), `embed ${sub} no existe`).toBeTruthy();
          for (const c of campos.split(',').map((s) => s.trim()).filter(Boolean)) {
            expect(cols(sub)).toContain(c);
          }
        } else {
          expect(esquemaTabla, `columna ${tabla}.${token} no existe`).toContain(token);
        }
      }
    });
  }
});

describe('contrato explícito: lo que leen los componentes', () => {
  it('proyectos: tiene cliente_id, NO tiene columna cliente (H2)', () => {
    expect(cols('proyectos')).toContain('cliente_id');
    expect(cols('proyectos')).not.toContain('cliente');
  });
  it('proyectos: NO tiene columnas de scope/reconciliación inventadas (H3)', () => {
    for (const c of ['scope_zonas', 'reconciliacion_zonas', 'cotizado_por_zona', 'acomodado_por_zona', 'renders', 'bom_hash', 'acomodo']) {
      expect(cols('proyectos')).not.toContain(c);
    }
  });
  it('cotizaciones: el acomodo (layout) vive aquí (H3 fuente real)', () => {
    expect(cols('cotizaciones')).toContain('acomodo');
    expect(cols('cotizaciones')).toContain('cliente_id');
  });
  it('renders/BOM: fuentes de verdad', () => {
    expect(cols('productos')).toContain('render_principal_url');
    expect(cols('expedientes')).toEqual(expect.arrayContaining(['render_aislado_url', 'render_ambiente_url']));
    expect(cols('producto_versiones')).toContain('bom_hash');
  });
  it('Workspace/proveedorReal: campos de proyecto que lee el frontend existen', () => {
    for (const c of ['nombre', 'etapa', 'vendedor_responsable', 'presupuesto', 'proxima_accion', 'fecha_proxima_accion', 'brief', 'fecha_objetivo', 'revision_ganadora_id']) {
      expect(cols('proyectos')).toContain(c);
    }
  });
  it('aprobaciones: campos que lee el Deal Desk existen', () => {
    for (const c of ['estado', 'revision_hash', 'creado', 'resuelto_por', 'resuelto_en']) {
      expect(cols('aprobaciones')).toContain(c);
    }
  });
});

describe('contrato: mutaciones usan enums/columnas válidos (regresión B1/B2)', () => {
  const wsSrc = readFileSync(new URL('../componentes/comercial/ProyectoWorkspace.jsx', import.meta.url), 'utf8');
  it('actividad usa tipo en MAYÚSCULAS (no "nota") — B1', () => {
    expect(wsSrc).not.toMatch(/tipo:\s*'nota'/);
    expect(wsSrc).toMatch(/tipo:\s*'NOTA'/);
  });
  it('cierre NO escribe total_final en el UPDATE (columna inexistente) — B2', () => {
    // El objeto de validación JS SÍ puede tener total_final; lo prohibido es en el
    // UPDATE a proyectos (junto a etapa: 'GANADA'). El fix usa revision_ganadora_id.
    expect(wsSrc).toMatch(/etapa:\s*'GANADA'[^}]*revision_ganadora_id/);
    expect(wsSrc).not.toMatch(/etapa:\s*'GANADA'[^}]*total_final/);
  });
  it('cierre usa etapas válidas GANADA/PERDIDA (mayúsculas)', () => {
    expect(wsSrc).toMatch(/etapa:\s*'GANADA'/);
    expect(wsSrc).toMatch(/etapa:\s*'PERDIDA'/);
    expect(wsSrc).not.toMatch(/etapa:\s*'(ganada|perdida)'/);
  });
});
