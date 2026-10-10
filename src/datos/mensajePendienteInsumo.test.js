import { describe, it, expect } from 'vitest';
import { mensajePendienteInsumo } from './mensajePendienteInsumo.js';
describe('avisos útiles del costeo por categoría', () => {
  it('no exige espesor de tablero para bisagras/jaladeras/LED', () => {
    for (const material of ['bisagra', 'jaladera', 'nivelador', 'kit LED']) {
      const mensaje = mensajePendienteInsumo(material);
      expect(mensaje).toContain('modelo, tamaño o capacidad');
      expect(mensaje).toContain('no aplica');
    }
  });
  it('PTR/lámina de otro calibre necesita verificación estructural', () => {
    expect(mensajePendienteInsumo('PTR cal.16')).toMatch(/peso, resistencia/);
    expect(mensajePendienteInsumo('lámina cal.14')).toMatch(/no emitir/);
  });
  it('melamina sin insumo menciona articulo y costo sin inventar', () => {
    expect(mensajePendienteInsumo('Melamina 18 mm nogal claro')).toMatch(/no se inventará/i);
  });
});
