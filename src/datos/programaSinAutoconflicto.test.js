import { describe, it, expect } from 'vitest';
import { resolverPrograma } from './resolverPrograma.js';
import { aplicarPrograma, partidaComercialDesdeConfirmado } from './programaRealDelPlano.js';

// E2E 2026-10-20 (Cotizar con metros: 28 puestos → bancas de 12 + 12 + 4): al aplicar el programa, la vista
// mostraba "Estación operativa 1/2: ya tienes 4 usuarios y el plano propone 12" — chocaba consigo mismo.
describe('aplicar el programa dos veces no genera conflictos contra sí mismo', () => {
  it('28 operativos (12 + 12 + 4): la segunda pasada reconoce sus propias bancas', () => {
    const prop = resolverPrograma({ operativos: 28, brief: { operativosStorage: false } }, { linea: 'App LT' });
    const primera = aplicarPrograma(prop, { existentes: [] }).confirmacion;
    const partidas = primera.confirmadas.map(partidaComercialDesdeConfirmado);
    const anclas = partidas.filter((p) => p.relation_role === 'ANCHOR_WORKSTATION');
    expect(anclas.length).toBeGreaterThanOrEqual(2);
    const segunda = aplicarPrograma(prop, { existentes: partidas });
    expect(segunda.conflictos.filter((c) => c.code === 'SLOT_OCUPADO_PRODUCTO_DISTINTO')).toEqual([]);
    expect(segunda.confirmacion.confirmadas).toEqual([]);   // nada nuevo que agregar
  });
});
