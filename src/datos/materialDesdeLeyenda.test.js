import { describe, expect, it } from 'vitest';
import { materialDesdeLeyenda } from './materialDesdeLeyenda.js';
import { aplicarPoliticaMaterial, MATCH } from './materialMatch.js';

const leyenda = ['Melamina 18 mm color nogal claro', 'Estructura metálica negra (pintura electrostática)', 'Vidrio o acrílico (opcional en repisas)'];
const catalogo = [
  { id: 'mel-19', nombre: 'Melamina 19 mm color madera', seccion: 'cubiertas' },
  { id: 'acero', nombre: 'Lámina acero cal.14', seccion: 'metal' },
];
const resolver = (id) => catalogo.find((i) => i.id === id);

describe('material explicitado en plano de exhibidor aeropuerto P-01', () => {
  it.each(['Cubierta mostrador', 'Laterales y divisiones módulo bajo (4 pzas 950x600)', 'Puertas módulo izquierdo (2 pzas 400x900)'])(
    'hereda melamina de la leyenda para %s', (nombre) => {
      expect(materialDesdeLeyenda({ nombre }, leyenda)).toBe('Melamina 18 mm color nogal claro');
    },
  );

  it.each(['Estructura metálica superior', 'Repisas de vidrio o acrílico', 'Nicho refrigerador', 'POS y contactos', 'Repisa transparente'])(
    'no impone melamina a %s', (nombre) => {
      expect(materialDesdeLeyenda({ nombre }, leyenda)).toBe('');
    },
  );

  it('respeta la especificación explícita de la pieza antes que la leyenda', () => {
    expect(materialDesdeLeyenda({ nombre: 'Cubierta', material_solicitado: 'Mármol blanco' }, leyenda)).toBe('Mármol blanco');
  });

  it('no escoge a escondidas entre acabados de melamina diferentes', () => {
    expect(materialDesdeLeyenda({ nombre: 'Puertas' }, ['Melamina 18 mm nogal', 'Melamina 18 mm blanco'])).toBe('');
  });

  it('no convierte la melamina 18→19 mm en confirmación técnica', () => {
    const solicitado = materialDesdeLeyenda({ nombre: 'Cubierta mostrador' }, leyenda);
    const salida = aplicarPoliticaMaterial(
      { nombre: 'Cubierta mostrador', material_solicitado: solicitado, insumoId: 'mel-19' },
      resolver, catalogo,
    );
    expect(salida.material_confirmado).not.toBe(true);
    expect(salida.material_match).not.toBe(MATCH.USER_CONFIRMED);
  });
});
