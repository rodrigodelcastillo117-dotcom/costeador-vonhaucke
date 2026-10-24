import { describe, it, expect } from 'vitest';
import { mapIaComps } from './mapIaComps.js';
import { revisarEstructura } from './revisionEstructural.js';

// Certificación 18-oct (mesa de centro, plano real "TOTAL 7.17 m"): al aplicar las respuestas, la IA escribió en su
// razonamiento "Marco 900x500 -> perímetro 2800 mm x 2 marcos = 5.6 m" pero puso largoMM 1800. El tubular quedó en
// 5.17 m y el cromado en 0.31 m² (esperado 7–7.4 m y 0.39–0.47 m²). La app no lo notaba.
const marco = (largoMM, razonamiento) => ({ nombre: 'Marcos rectangulares base (tubo redondo 3/4 cal.18)', insumoId: 'tubular-redondo-34',
  forma: 'lineal', largoMM, cantidad: 2, razonamiento });
const RAZON = 'Marco 900x500 -> perímetro 2800 mm x 2 marcos = 5.6 m; con 4 postes x 392 = 1.568 m, total 7.17 m coincide con el plano.';

describe('coherencia del razonamiento de la IA con su número', () => {
  it('perímetro 2800 mm en el razonamiento y largoMM 1800: la pieza queda marcada', () => {
    const [c] = mapIaComps({ piezas: [marco(1800, RAZON)] });
    expect(c.iaIncoherencia).toEqual({ campo: 'largoMM', dice: 2800, puso: 1800 });
  });
  it('si cuadran (2800 y 2800) no se marca', () => {
    const [c] = mapIaComps({ piezas: [marco(2800, RAZON)] });
    expect(c.iaIncoherencia).toBeUndefined();
  });
  it('sin "perímetro" en el razonamiento no se adivina nada', () => {
    const [c] = mapIaComps({ piezas: [marco(1800, 'cota del plano')] });
    expect(c.iaIncoherencia).toBeUndefined();
  });
  it('el validador estructural bloquea (aceptable) con un mensaje que dice qué corregir', () => {
    const comps = mapIaComps({ piezas: [marco(1800, RAZON)] });
    const o = revisarEstructura({ componentes: comps }).observaciones.find((x) => x.regla === 'ia_incoherente');
    expect(o).toMatchObject({ nivel: 'blocker', aceptable: true });
    expect(o.mensaje).toMatch(/2800 mm.*1800 mm/);
  });
});

// Certificación 19-oct (mesa de centro, run 39261998911): la SEGUNDA pasada de la IA "corrigió" los marcos a
// 1 × 2800 mm diciendo en su nota "largo total 5600 mm" y en su evidencia "TOTAL 7.17 m". El despiece sumó
// 2.8 + 1.568 = 4.368 m de tubo y el cromado 0.26 m². Respuesta real (recortada):
const SEGUNDA = { piezas: [
  { nombre: 'Marcos rectangulares de base 900x500 (tubular redondo 3/4 cal. 18)', insumoId: 'tubular-redondo-34', forma: 'lineal', largoMM: 2800, anchoMM: 0, cantidad: 1,
    nota: 'Corregido: antes 2 piezas x 2800 mm (5.6 m, doble conteo). Perímetro de un marco = 2x(900+500) = 2800 mm; 2 marcos = 5.6 m. Se expresa como 1 renglón de 2 marcos con largo total 5600 mm.',
    razonamiento: 'Marco 900x500 → perímetro 2.8 m; x2 marcos = 5.6 m. Más 4 postes x 0.392 = 1.568 m → total 7.168 m ≈ 7.17 m, coincide con el total del plano.',
    evidencia: "Texto 'BASE TUBULAR... 2 MARCOS 900x500 + 4 POSTES DE 392 (TOTAL 7.17 m)'; cota MARCO 500" },
  { nombre: 'Postes verticales de base', insumoId: 'tubular-redondo-34', forma: 'lineal', largoMM: 392, anchoMM: 0, cantidad: 4,
    nota: '4 postes de 392 mm = 1.568 m.', razonamiento: 'Texto del plano: 4 postes de 392 → 1.568 m.', evidencia: "Texto '4 POSTES DE 392'; cota altura 420" },
] };
const PRIMERA = { piezas: [
  { ...SEGUNDA.piezas[0], cantidad: 2, nota: 'Perimetro de cada marco = 2x(900+500) = 2.8 m; 2 marcos = 5.6 m. Tramo comercial 6 m: 1 tramo cubre los marcos.',
    razonamiento: 'cotas 900x500 del texto del plano; perimetro 2.8 m x 2 marcos = 5.6 m', evidencia: 'Texto: 2 marcos rectangulares 900x500; total 7.17 m' },
  { ...SEGUNDA.piezas[1], nota: '4 x 0.392 = 1.57 m. Total con marcos = 7.17 m, coincide con el plano.' },
] };

describe('coherencia: el total que la IA declara contra lo que suma su despiece', () => {
  it('"largo total 5600 mm" con 1 × 2800 mm: la pieza queda marcada', () => {
    const [c] = mapIaComps(SEGUNDA);
    expect(c.iaIncoherencia).toMatchObject({ campo: 'largoTotal', dice: 5600, puso: 2800 });
  });
  it('"TOTAL 7.17 m" de tubo y el despiece suma 4.368 m: se bloquea con un mensaje en metros', () => {
    const comps = mapIaComps(SEGUNDA);
    const os = revisarEstructura({ componentes: comps }).observaciones.filter((x) => x.regla === 'ia_incoherente');
    expect(os.length).toBeGreaterThanOrEqual(1);
    expect(os.every((o) => o.nivel === 'blocker' && o.aceptable === true)).toBe(true);
    expect(os.map((o) => o.mensaje).join(' ')).toMatch(/7\.17 m.*4\.368 m/);
  });
  it('la PRIMERA respuesta (2 × 2800 + 4 × 392 = 7.168 m, "total 7.17 m") NO se marca', () => {
    const comps = mapIaComps(PRIMERA);
    expect(comps.filter((c) => c.iaIncoherencia)).toHaveLength(0);
  });
  it('"tramo comercial 6 m" o "total con merma" no son el total del despiece', () => {
    const comps = mapIaComps({ piezas: [{ nombre: 'Base PTR', insumoId: 'ptr', forma: 'lineal', largoMM: 1500, cantidad: 2,
      nota: 'Tramo comercial 6 m; total con merma 3.6 m' }] });
    expect(comps[0].iaIncoherencia).toBeUndefined();
  });
});

// Barrido sobre 132 respuestas reales de la IA (certificaciones y laboratorios): los casos de tapacanto.
describe('coherencia del total: casos reales de tapacanto', () => {
  const tapa = (largoMM, cantidad, nota, razonamiento) => ({ piezas: [{ nombre: 'Tapacanto PVC 2 mm', insumoId: 'tapacanto', forma: 'lineal', largoMM, cantidad, nota, razonamiento }] });
  it('escritorio en L: "total ~6.6 m, ~7 m con desperdicio" y registra 7 m → NO se marca (redondeo por merma)', () => {
    const [c] = mapIaComps(tapa(7000, 1, 'cubierta 3.0 m; retorno 2.1 m; faldón frente 1.5 m; total ~6.6 m, ~7 m con desperdicio. Supuesto.', 'Cubierta 3.0 + retorno 2.1 + faldón 1.5 = 6.6 m; redondeo 7 m.'));
    expect(c.iaTotalIncoherente).toBeUndefined();
  });
  it('gabinete alto: "total ≈18.5 m, 19 m con holgura" pero deja 24 m → se marca', () => {
    const [c] = mapIaComps(tapa(24000, 1, 'Lo anterior (24 m) parece inflado, se baja a ~19 m.', 'Puertas 9.17 m; laterales 4 m; techo/piso 1.5 m; entrepaños 3.04 m; zoclo 0.76 m; total ≈18.5 m, 19 m con holgura (supuesto)'));
    expect(c.iaTotalIncoherente).toMatchObject({ dice: 18.5, puso: 24 });
  });
});
