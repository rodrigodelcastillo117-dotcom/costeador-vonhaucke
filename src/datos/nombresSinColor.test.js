// VH-052: configDesde manda `color: undefined` cuando nadie eligió color; el nombre
// del componente no debe decir "undefined" en el despiece ni en la cotización.
import { describe, it, expect } from 'vitest';
import { LINEAS_REG, configDesde } from './lineas.js';

describe('nombres de componentes sin color elegido', () => {
  it('ningún generador produce "undefined" en nombres con la config por omisión', () => {
    const malos = [];
    for (const [ruta, L] of Object.entries(LINEAS_REG)) for (const prod of L.productos) {
      const g = L.generar(configDesde(prod, {}));
      for (const c of (g?.componentes || [])) if (/undefined|null/.test(String(c.nombre))) malos.push(`${ruta}/${prod.id}: ${c.nombre}`);
      if (/undefined|null/.test(String(g?.nombre))) malos.push(`${ruta}/${prod.id}: (producto) ${g.nombre}`);
    }
    expect(malos).toEqual([]);
  });
  it('EcoAcustic Flex y TeamSpace II con color: el nombre lo lleva; sin color: lo omite', () => {
    const eco = LINEAS_REG.ecoacustic, ts = LINEAS_REG.teamspace2;
    const flex = eco.productos.find((p) => p.id === 'flex');
    expect(eco.generar(configDesde(flex, { color: 'camello' })).componentes[0].nombre).toMatch(/· camello$/);
    expect(eco.generar(configDesde(flex, {})).componentes[0].nombre).not.toMatch(/undefined/);
    const sop = ts.productos.find((p) => p.id === 'soporte');
    const comps = ts.generar(configDesde(sop, {})).componentes;
    expect(comps.map((c) => c.nombre).join('|')).not.toMatch(/undefined/);
  });
});
