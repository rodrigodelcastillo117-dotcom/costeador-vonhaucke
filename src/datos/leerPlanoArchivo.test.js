// VH-043: el orquestador único de lectura devuelve lo que la compuerta de confirmación necesita.
import { describe, it, expect, vi } from 'vitest';
const leerPlano = vi.fn();
vi.mock('../nube.js', () => ({ leerPlano: (...a) => leerPlano(...a) }));
const { leerPlanoDeArchivo } = await import('./leerPlanoArchivo.js');

const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const LECTURA = {
  envolvente: { ancho: 16000, largo: 8800 }, tieneCotas: true, grid: { horizontal: [8000, 8000], vertical: [8800] },
  areas: [
    { nombre: 'ÁREA OPERATIVA', tipo: 'open', forma: 'poligono', dentroDe: '', confianza: 'alta', circulo: { cx: 0, cy: 0, r: 0 }, puntos: rect(0, 0, 12000, 8800) },
    { nombre: 'Isla 1', tipo: 'open', forma: 'poligono', dentroDe: 'ÁREA OPERATIVA', confianza: 'alta', circulo: { cx: 0, cy: 0, r: 0 }, puntos: rect(1000, 1000, 2180, 2110), puestos: 4 },
    { nombre: 'OFICINA CEO', tipo: 'privado', forma: 'poligono', dentroDe: '', confianza: 'alta', circulo: { cx: 0, cy: 0, r: 0 }, puntos: rect(12000, 0, 4000, 3200) },
  ],
  puertas: [], escala: 'cota general', notas: [],
};
// FileReader/Image no existen en node: un "archivo" PDF mínimo basta para el camino base64.
globalThis.FileReader = class { readAsDataURL() { this.onload?.({}); } get result() { return 'data:application/pdf;base64,AAAA'; } };

describe('leerPlanoDeArchivo', () => {
  it('devuelve áreas en metros con puestos, lectura cruda, resumen con cotas y nota', async () => {
    leerPlano.mockResolvedValue({ ok: true, lectura: LECTURA });
    const r = await leerPlanoDeArchivo({ name: 'plano.pdf', type: 'application/pdf' });
    expect(r.ok).toBe(true);
    expect(r.areas.map((a) => a.nombre)).toEqual(['ÁREA OPERATIVA', 'Isla 1', 'OFICINA CEO']);
    expect(r.areas[1].puestos).toBe(4);
    expect(r.lectura).toBe(LECTURA);
    expect(r.resumen.cuartos).toBe(3);
    expect(r.resumen.cotas).toBe(true);
    expect(['alta', 'media', 'baja']).toContain(r.resumen.nivel);
  });
  it('rechaza AutoCAD con explicación y no llama al servidor', async () => {
    leerPlano.mockClear();
    const r = await leerPlanoDeArchivo({ name: 'plano.dwg', type: '' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/AutoCAD/);
    expect(leerPlano).not.toHaveBeenCalled();
  });
  it('propaga el error del servidor sin inventar áreas', async () => {
    leerPlano.mockResolvedValue({ ok: false, error: 'Reintenta' });
    const r = await leerPlanoDeArchivo({ name: 'p.pdf', type: 'application/pdf' });
    expect(r).toMatchObject({ ok: false, error: 'Reintenta' });
  });
});

// VH-064: la validación determinista del servidor (floorSpec.validation) llega al resumen.
describe('leerPlanoDeArchivo · validación del servidor (VH-064)', () => {
  const PDF = { name: 'plano.pdf', type: 'application/pdf' };
  it('PASS: respeta el nivel local y reporta el estado del servidor con su referencia', async () => {
    leerPlano.mockResolvedValue({ ok: true, lectura: LECTURA, request_id: 'req-1', floorSpec: { validation: { state: 'PASS', issues: [], warnings: [] } } });
    const r = await leerPlanoDeArchivo(PDF);
    expect(r.resumen.servidor).toEqual({ estado: 'PASS', texto: expect.stringMatching(/aprobada/), requestId: 'req-1' });
    expect(r.floorSpec).toBeTruthy();
  });
  it('REVIEW_REQUIRED: los avisos entran a problemas y una lectura "alta" baja a "media"', async () => {
    leerPlano.mockResolvedValue({ ok: true, lectura: LECTURA, floorSpec: { validation: { state: 'REVIEW_REQUIRED', issues: [],
      warnings: [{ field: 'envolvente', code: 'ASSUMED_CRITICAL_GEOMETRY' }, { field: 'areas[1]', code: 'LOW_CONFIDENCE_ZONE', zone: 'Isla 1' }] } } });
    const r = await leerPlanoDeArchivo(PDF);
    expect(r.resumen.servidor.estado).toBe('REVIEW_REQUIRED');
    expect(r.resumen.nivel).not.toBe('alta');
    expect(r.resumen.confiable).toBe(false);
    expect(r.resumen.problemas.some((p) => /SUPUSO/.test(p))).toBe(true);
    expect(r.resumen.problemas.some((p) => /Isla 1/.test(p))).toBe(true);
    expect(r.nota).toMatch(/Revisa esto/);
  });
  it('sin floorSpec (respuesta vieja o recortada): no se declara confiable', async () => {
    leerPlano.mockResolvedValue({ ok: true, lectura: LECTURA });
    const r = await leerPlanoDeArchivo(PDF);
    expect(r.resumen.servidor.estado).toBe('SIN_VALIDACION');
    expect(r.resumen.nivel).not.toBe('alta');
    expect(r.resumen.confiable).toBe(false);
  });
  it('FAIL (422): el error trae los problemas concretos y la referencia, sin inventar áreas', async () => {
    leerPlano.mockResolvedValue({ ok: false, code: 'FLOOR_SPEC_INVALID', error: 'No pasó la validación.', request_id: 'req-9',
      floorSpec: { validation: { state: 'FAIL', warnings: [], issues: [{ field: 'grid.horizontal', code: 'GRID_ENVELOPE_MISMATCH', sum_mm: 15400, envelope_mm: 16000, tolerance_mm: 160 }] } } });
    const r = await leerPlanoDeArchivo(PDF);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('FLOOR_SPEC_INVALID');
    expect(r.requestId).toBe('req-9');
    expect(r.error).toMatch(/No pasó la validación/);
    expect(r.error).toMatch(/15400 mm/);
    expect(r.error).toMatch(/req-9/);
    expect(r.areas).toBeUndefined();
  });
});
