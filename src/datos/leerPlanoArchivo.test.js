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
