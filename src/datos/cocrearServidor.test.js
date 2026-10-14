// ============================================================================
//  COCREAR 10 · D-02 / D-03 · contrato del modo cocrear de costear-servidor (lado puro) y de la
//  Edge RC que lo usa. La integración con SQL real vive en supabase/tests/cocrearCostoServidor.test.js.
// ============================================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { transformWithEsbuild } from 'vite';
import {
  validarSolicitudCocrear, esSolicitudCocrear, accesoACocreacion, decidirValidacionIngenieria,
  filaCostoCocreacion, respuestaCocreacionPorRol,
} from './cocrearServidor.js';
import { validarIntentCosteo } from './validarIntentCosteo.js';

const EDGE = 'supabase/functions/costear-servidor-rc/index.ts';

describe('decidirValidacionIngenieria', () => {
  const ok = { solicitada: true, rol: 'diseno', emitible: true, estado: 'preliminar', visualHashCliente: 'v', visualHashServidor: 'v', bloqueosEstructura: [] };
  it('valida sólo Diseño/Dirección con costo emitible, misma revisión y sin bloqueos estructurales', () => {
    expect(decidirValidacionIngenieria(ok).validada).toBe(true);
    expect(decidirValidacionIngenieria({ ...ok, rol: 'direccion' }).validada).toBe(true);
    expect(decidirValidacionIngenieria({ ...ok, rol: 'vendedor' }).code).toBe('ENGINEERING_VALIDATION_FORBIDDEN');
    expect(decidirValidacionIngenieria({ ...ok, visualHashCliente: 'otra' }).code).toBe('REVISION_DISTINTA');
    expect(decidirValidacionIngenieria({ ...ok, bloqueosEstructura: ['cubierta sin soporte'] }).code).toBe('BLOQUEO_ESTRUCTURAL');
    expect(decidirValidacionIngenieria({ ...ok, emitible: false }).code).toBe('COSTO_NO_EMITIBLE');
    expect(decidirValidacionIngenieria({ ...ok, estado: 'incompleto' }).code).toBe('COSTO_NO_EMITIBLE');
    expect(decidirValidacionIngenieria({ ...ok, solicitada: false })).toEqual({ validada: false, code: null, motivo: null });
  });
});

describe('acceso y solicitud', () => {
  it('dueño o Diseño/Dirección', () => {
    expect(accesoACocreacion({ rol: 'vendedor', email: 'a@vh.mx', creadoPor: 'A@vh.mx' })).toBe(true);
    expect(accesoACocreacion({ rol: 'vendedor', email: 'b@vh.mx', creadoPor: 'a@vh.mx' })).toBe(false);
    expect(accesoACocreacion({ rol: 'diseno', email: 'b@vh.mx', creadoPor: 'a@vh.mx' })).toBe(true);
  });
  it('la solicitud de cocreación no pasa por el DTO de costeo normal (y al revés)', () => {
    const body = { accion: 'cocrear', expediente_id: 3 };
    expect(esSolicitudCocrear(body)).toBe(true);
    expect(validarIntentCosteo(body).ok).toBe(false);      // una Edge vieja responde 400 (la UI lo explica)
    expect(validarSolicitudCocrear({ ...body, expediente_id: '3' }).ok).toBe(false);
    expect(validarSolicitudCocrear({ ...body, expediente_id: 0 }).ok).toBe(false);
  });
});

describe('fila y respuesta por rol', () => {
  const pz = { specHash: 's', visualHash: 'v', bomHash: 'b', pieza: { componentes: [], dificultad: 'dificil' } };
  const exp = { id: 9, revision: 3, analysis_hash: 'a' };
  it('un costeo incompleto no lleva costo ni precio (Por confirmar)', () => {
    const f = filaCostoCocreacion({ expediente: exp, email: 'x', rol: 'diseno', pz, costeo: { emitible: false, estado: 'incompleto', costoUnitario: 123 }, decision: { validada: false }, precio: { precio: 456, margen: 50 } });
    expect(f.costo_unitario).toBeNull();
    expect(f.precio_sugerido).toBeNull();
    expect(f.margen_politica).toBeNull();
    expect(f.dificultad).toBe('dificil');
    expect(f.formula_version).toBe('ALBA_V1');
  });
  it('vendedor: jamás costo ni margen; Diseño: costo sin margen; Dirección: todo', () => {
    const f = filaCostoCocreacion({ expediente: exp, email: 'x', rol: 'direccion', pz, costeo: { emitible: true, estado: 'preliminar', costoUnitario: 1000 }, decision: { validada: true }, precio: { precio: 2000, margen: 50 } });
    const v = respuestaCocreacionPorRol('vendedor', f);
    expect(v.precioSugerido).toBe(2000);
    // Ninguna LLAVE económica (el texto comercial "sujeto a confirmación de costos" sí es para el vendedor).
    const llaves = (o) => (o && typeof o === 'object' ? Object.entries(o).flatMap(([k, x]) => [k, ...llaves(x)]) : []);
    expect(llaves(v).filter((k) => /costo|cost|margen|margin/i.test(k))).toEqual([]);
    const d = respuestaCocreacionPorRol('diseno', f);
    expect(d.costo.costoUnitario).toBe(1000);
    expect(d.margen).toBeUndefined();
    const dir = respuestaCocreacionPorRol('direccion', f);
    expect(dir.margen).toBe(50);
  });
});

describe('Edge costear-servidor-rc · modo cocrear', () => {
  const src = fs.readFileSync(EDGE, 'utf8');
  it('parsea como TypeScript', async () => {
    const r = await transformWithEsbuild(src, EDGE, { loader: 'ts', target: 'esnext', format: 'esm' });
    expect(r.code.length).toBeGreaterThan(100);
  });
  it('lee el BOM del expediente guardado (service role), no del body, y usa el mismo DTO y motor', () => {
    const i = src.indexOf('if (esSolicitudCocrear(body))');
    const b = src.slice(i, src.indexOf('// --- Costeo normal', i));
    expect(b.length).toBeGreaterThan(200);
    expect(b).toContain('from("expedientes")');
    expect(b).toContain('piezaDeCocreacion(exp.cocrear)');
    expect(b).toContain('validarIntentCosteo({ cantidad: 1, pieza: pz.pieza })');
    expect(b).toContain('costearConMotor(');
    expect(b).toContain('revisarEstructura(');
    expect(b).toContain('from("cocrear_costeo_servidor").insert(fila)');
    expect(b).toContain('respuestaCocreacionPorRol(rolC');
    expect(b).not.toMatch(/body\.(componentes|pieza|costo|precio|margen|rol)/);
  });
  it('sin registro del resultado no presume validación ni costo oficial', () => {
    expect(src).toContain('REGISTRO_NO_DISPONIBLE');
  });
  it('el costeo normal conserva su DTO y su 403 de confirmación de material (ahora en el núcleo compartido que la Edge llama)', () => {
    // Cierre GO: la Edge delega TODO el costeo normal en src/datos/costeoServidor.js (las pruebas del pipeline llaman a la
    // misma función). El comportamiento (400 del DTO, 403 de confirmación) se prueba ejecutándolo en seg01cVinculoCosteo.
    expect(src).toContain('atenderCosteo({ svc: createClient(URL, SERVICE), body, email })');
    const nucleo = fs.readFileSync('src/datos/costeoServidor.js', 'utf8');
    expect(nucleo).toContain('const v = validarIntentCosteo(body);');
    expect(nucleo).toContain('MATERIAL_CONFIRMATION_FORBIDDEN');
    expect(src).not.toContain('calcular(');   // el motor no se llama desde la Edge: sólo desde el núcleo
  });
});
