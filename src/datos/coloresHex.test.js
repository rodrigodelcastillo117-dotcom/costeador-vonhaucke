import { describe, it, expect } from 'vitest';
import { HEX_DE_COLOR, hexDeColor } from './coloresHex.js';
import { MELAMINA_POR_ESPESOR, PINTURA_COLORES } from './acabados.js';

const idsValidos = new Set([
  ...Object.values(MELAMINA_POR_ESPESOR).flat().map((c) => c.id),
  ...PINTURA_COLORES.map((c) => c.id),
]);

describe('HEX_DE_COLOR: cada id debe existir de verdad en acabados.js', () => {
  it('ningún id del mapa hex es un typo o un color que ya no existe', () => {
    for (const id of Object.keys(HEX_DE_COLOR)) {
      expect(idsValidos.has(id), `'${id}' no está en MELAMINA_POR_ESPESOR ni en PINTURA_COLORES`).toBe(true);
    }
  });

  it('hexDeColor() da el color para uno conocido y null para uno sin swatch en el PDF', () => {
    expect(hexDeColor('walnut')).toBe('#7C5A38');
    expect(hexDeColor('sand')).toBeNull(); // válido en acabados.js, pero sin foto en el PDF de acabados
    expect(hexDeColor('id-que-no-existe')).toBeNull();
  });
});
