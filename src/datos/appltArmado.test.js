import { describe, it, expect } from 'vitest';
import { armadoBancaDobleAppLT, topologiaBancaAppLT, islasAppLT } from './appltArmado.js';
import { APPLT_DATOS } from './appltDatos.js';

// ACOMODO 10 · VH-A10-07: la topología de cada banca que acomoda Cotizar, según la guía (c = usuarios / 2 en doble,
// cubiertas de 1200/1500/1800, 1 acometida ATACM por isla). Antes el acomodo sentaba lo que viniera (7 usuarios =
// 4 + 3) sin decir que esa banca no existe en la guía.
describe('VH-A10-07 · topología de banca APP LT en el acomodo', () => {
  it('módulos del catálogo: 8u 4800 = 4 cubiertas de 1200; 6u 4500 = 3 de 1500; 1u 1500×600 sencilla', () => {
    expect(topologiaBancaAppLT({ w: 4800, d: 1200, usuarios: 8 })).toMatchObject({ tipo: 'doble', cubiertas: 4, largoCubiertaMM: 1200, acometidas: 1, dentroDeGuia: true });
    expect(topologiaBancaAppLT({ w: 4500, d: 1200, usuarios: 6 })).toMatchObject({ tipo: 'doble', cubiertas: 3, largoCubiertaMM: 1500, dentroDeGuia: true });
    expect(topologiaBancaAppLT({ w: 1500, d: 600, usuarios: 1 })).toMatchObject({ tipo: 'sencilla', cubiertas: 1, largoCubiertaMM: 1500, dentroDeGuia: true });
  });
  it('fuera de guía, con el motivo: usuarios impares en doble, cubierta de 1050, fondo raro', () => {
    const impar = topologiaBancaAppLT({ w: 6000, d: 1200, usuarios: 7 });
    expect(impar.dentroDeGuia).toBe(false); expect(impar.pendientes.join(' ')).toMatch(/par|2 usuarios por cubierta/);
    const l1050 = topologiaBancaAppLT({ w: 4200, d: 1200, usuarios: 8 });
    expect(l1050.dentroDeGuia).toBe(false); expect(l1050.pendientes.join(' ')).toMatch(/1200, 1500 y 1800/);
    expect(topologiaBancaAppLT({ w: 4800, d: 900, usuarios: 8 }).dentroDeGuia).toBe(false);
    expect(topologiaBancaAppLT({ w: 4800, d: 1200, usuarios: null }).dentroDeGuia).toBe(false);
  });
  it('islas del acomodo: cada banca APP LT es una isla con su acometida; las de otra línea no se juzgan', () => {
    const piezas = [
      { id: 'a', nombre: 'Módulo operativo App LT 8 usuarios (biombo cristal)', relation_role: 'ANCHOR_WORKSTATION', w: 4800, d: 1200, user_capacity: 8 },
      { id: 'b', nombre: 'Módulo operativo App LT 8 usuarios (biombo cristal)', relation_role: 'ANCHOR_WORKSTATION', w: 4800, d: 1200, user_capacity: 8 },
      { id: 'c', nombre: 'Estación Cirque 4 puestos', relation_role: 'ANCHOR_WORKSTATION', w: 3000, d: 1400, user_capacity: 4 },
      { id: 's', nombre: 'Silla operativa WIN', relation_role: 'WORK_SEAT' },
    ];
    const r = islasAppLT(piezas, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(r.islas.map((i) => i.id)).toEqual(['a', 'b']);
    expect(r.acometidas).toBe(2);
    expect(r.fueraDeGuia).toEqual([]);
    // "Sólo 2 acometidas si los 8 usuarios están en dos islas separadas de 4" (Dirección): dos bancas de 4 → 2.
    const dos = islasAppLT([
      { id: 'x', nombre: 'Módulo operativo App LT 4 usuarios', relation_role: 'ANCHOR_WORKSTATION', w: 3000, d: 1200, user_capacity: 4 },
      { id: 'y', nombre: 'Módulo operativo App LT 4 usuarios', relation_role: 'ANCHOR_WORKSTATION', w: 3000, d: 1200, user_capacity: 4 },
    ], []);
    expect(dos.acometidas).toBe(2);
  });
});

describe('APP LT · banca doble según la guía ESP-DCC-IDP-003', () => {
  it('6U de 1200 = EXACTAMENTE el pedido real 38247 (TATO63612AB001) y su lista $12,380', () => {
    const r = armadoBancaDobleAppLT({ usuarios: 6, largoMM: 1200 });
    const bom = Object.fromEntries(r.componentes.map((x) => [x.clave, x.cantidad]));
    const real = Object.fromEntries(APPLT_DATOS.modulo.bom.map((b) => [b.clave, b.cantidad]));
    expect(bom).toEqual(real);
    expect(r.lista).toBe(12380);
    expect(r.ok).toBe(true);
  });
  it('2U (una cubierta): sin pata intermedia ni placas de unión', () => {
    const r = armadoBancaDobleAppLT({ usuarios: 2, largoMM: 1200 });
    const bom = Object.fromEntries(r.componentes.map((x) => [x.clave, x.cantidad]));
    expect(bom).toEqual({ ATCUBD44ABS: 1, ATPU4M: 2, ATOM3: 2, ATRICDB4: 1, ATACM: 1 });
  });
  it('4U de 1500 usa ATCUBD45ABS / ATOM4 / ATRICDB5', () => {
    const bom = Object.fromEntries(armadoBancaDobleAppLT({ usuarios: 4, largoMM: 1500 }).componentes.map((x) => [x.clave, x.cantidad]));
    expect(bom).toMatchObject({ ATCUBD45ABS: 2, ATPU4M: 2, ATPU75M: 1, ATOM4: 4, ATRICDB5: 2, CIEPLA01300778: 2, ATACM: 1 });
  });
  it('1800 usa la omega ATOM5 (no ATOM4)', () => {
    expect(armadoBancaDobleAppLT({ usuarios: 2, largoMM: 1800 }).componentes.find((x) => x.rol.startsWith('omega')).clave).toBe('ATOM5');
  });
  it('lo que la guía no define no se inventa: 1050 mm, usuarios impares', () => {
    expect(armadoBancaDobleAppLT({ usuarios: 6, largoMM: 1050 })).toMatchObject({ ok: false, lista: null });
    expect(armadoBancaDobleAppLT({ usuarios: 5, largoMM: 1200 }).ok).toBe(false);
  });
  it('8U en UNA isla: 1 acometida (Dirección); 2 islas de 4 = dos bancas de 4, cada una con la suya', () => {
    const ocho = armadoBancaDobleAppLT({ usuarios: 8, largoMM: 1200 });
    expect(ocho.ok).toBe(true);
    expect(Object.fromEntries(ocho.componentes.map((x) => [x.clave, x.cantidad]))).toEqual({ ATCUBD44ABS: 4, ATPU4M: 2, ATPU75M: 3, ATOM3: 8, ATRICDB4: 4, CIEPLA01300778: 6, ATACM: 1 });
    const cuatro = armadoBancaDobleAppLT({ usuarios: 4, largoMM: 1200 });
    expect(2 * cuatro.componentes.find((x) => x.clave === 'ATACM').cantidad).toBe(2);
  });
  it('biombo satinado del pedido: 3 ATBIOCRS4 por módulo de 6U, a la lista vigente del catálogo', () => {
    const r = armadoBancaDobleAppLT({ usuarios: 6, largoMM: 1200, biombo: 'cristal_satinado' });
    expect(r.componentes.find((x) => x.clave === 'ATBIOCRS4')).toMatchObject({ cantidad: 3, lista: 1640 });
  });
});
