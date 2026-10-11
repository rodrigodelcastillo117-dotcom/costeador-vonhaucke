import { describe, it, expect } from 'vitest';
import { costearItem, catalogoIA } from './lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { PARAMETROS_DEFAULT } from '../motor/calculo.js';
import { casarComponente, tipoComponente } from './resolverComponentes.js';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, piezas: {} };

describe('resolverComponentes — tipos y casado de componentes (B3: cotizarPorComponentes retirado)', () => {
  it('clasifica los tipos del despiece y descarta lo que no es pieza suelta', () => {
    expect(tipoComponente('Cubierta recta izquierda (RICUBRECI25ABS)')).toBe('CUBIERTA');
    expect(tipoComponente('Pata doble 66° (RIPIBD)')).toBe('PATA');
    expect(tipoComponente('Biombo recto Acrílico')).toBe('BIOMBO');
    expect(tipoComponente('Canto — Cubierta recta')).toBeNull();      // va dentro de la cubierta
    expect(tipoComponente('Faldón/soportes metálicos biombo')).toBeNull();
  });

  it('casa una cubierta de Rio por tipo+medida aunque el modelo la nombre distinto', () => {
    const art = casarComponente('rio', { nombre: 'Cubierta recta (x)', largoMM: 1500, insumoId: 'melamina-28' });
    expect(art).toBeTruthy();
    expect(art.lista).toBeGreaterThan(0);
  });
});
