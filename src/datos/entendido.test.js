import { describe, it, expect } from 'vitest';
import { loQueEntendi } from './entendido.js';

// ============================================================================
//  "ESTO ENTENDÍ" — lo que hace que valga la pena un paso más antes de acomodar
//  no es repetir la lista: es CACHAR lo que no cuadra (gente sin silla,
//  privados vacíos) cuando todavía se puede corregir de un toque.
// ============================================================================
const PARTIDAS = [
  { id: 'p1', nombre: 'Banca doble APP LT 1.50 · 10 usuarios', cantidad: 2 },
  { id: 'p2', nombre: 'Eclipse · Escritorio directivo 2.40', cantidad: 1 },
  { id: 'p3', nombre: 'Alba · Mesa de juntas 3.60 m', cantidad: 1 },
  { id: 'p4', nombre: 'Modulor · Archivero horizontal 0.75', cantidad: 4 },
  { id: 'p5', nombre: 'Gaveta rodante Mox', cantidad: 6 },
  { id: 'p6', nombre: 'Silla operativa WIN', cantidad: 12 },
  { id: 'p7', nombre: 'Silla de visita CONCERTO', cantidad: 2 },
];
const AREAS = [
  { nombre: 'Open space', ancho: 20, largo: 15 },
  { nombre: 'Privado 1', tipo: 'privado', ancho: 4, largo: 3 },
  { nombre: 'Privado 2', tipo: 'privado', ancho: 4, largo: 3 },
];

describe('lo que Voni entendió', () => {
  const r = loQueEntendi(PARTIDAS, AREAS);

  it('cuenta PERSONAS, no muebles: 2 bancas de 10 + 1 directivo = 21 puestos', () => {
    expect(r.puestos).toBe(21);
  });

  it('separa la silla de trabajo de la de visita y de la gaveta', () => {
    expect(r.sillas).toBe(12);
    expect(r.visitas).toBe(2);
    expect(r.gavetas).toBe(6);
  });

  it('cada renglón apunta a SU partida: el ± cambia la de verdad, no una copia', () => {
    const puestos = r.grupos.find((g) => g.clave === 'puestos');
    expect(puestos.renglones.map((x) => x.id)).toEqual(['p1', 'p2']);
  });

  it('CACHA que faltan sillas antes de acomodar', () => {
    expect(r.avisos.some((a) => /faltan 7/.test(a.texto))).toBe(true);
  });

  it('CACHA los privados que se quedarían vacíos', () => {
    // 2 privados y un solo escritorio individual (la banca es de open space).
    expect(r.avisos.some((a) => /privado\(s\) y hay 1 escritorio/.test(a.texto))).toBe(true);
  });

  it('y avisa si todavía no hay espacio', () => {
    const sinEspacio = loQueEntendi(PARTIDAS, []);
    expect(sinEspacio.espacio.hay).toBe(false);
    expect(sinEspacio.avisos.some((a) => /dónde va el proyecto/.test(a.texto))).toBe(true);
  });

  it('el titular se lee de un vistazo', () => {
    expect(r.titular).toMatch(/324 m²/);
    expect(r.titular).toMatch(/2 privados/);
    expect(r.titular).toMatch(/21 puestos de trabajo/);
    expect(r.titular).toMatch(/14 sillas/);
  });

  it('un proyecto que sí cuadra no inventa avisos', () => {
    const ok = loQueEntendi([
      { id: 'a', nombre: 'Eclipse · Escritorio directivo 2.40', cantidad: 2 },
      { id: 'b', nombre: 'Silla operativa WIN', cantidad: 2 },
    ], [{ nombre: 'Privado 1', tipo: 'privado', ancho: 4, largo: 3 }]);
    expect(ok.avisos).toEqual([]);
  });

  it('sin muebles no truena ni inventa nada', () => {
    const vacio = loQueEntendi([], []);
    expect(vacio.grupos).toEqual([]);
    expect(vacio.puestos).toBe(0);
  });
});
