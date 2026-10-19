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
