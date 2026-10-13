import { describe, it, expect } from 'vitest';
import { armadoBancaDobleAppLT } from './appltArmado.js';
import { APPLT_DATOS } from './appltDatos.js';

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
  it('lo que la guía no define no se inventa: 1050 mm, usuarios impares, 8U', () => {
    expect(armadoBancaDobleAppLT({ usuarios: 6, largoMM: 1050 })).toMatchObject({ ok: false, lista: null });
    expect(armadoBancaDobleAppLT({ usuarios: 5, largoMM: 1200 }).ok).toBe(false);
    const ocho = armadoBancaDobleAppLT({ usuarios: 8, largoMM: 1200 });
    expect(ocho.ok).toBe(false);
    expect(ocho.pendientes.join(' ')).toMatch(/8U/);
  });
  it('biombo satinado del pedido: 3 ATBIOCRS4 por módulo de 6U, a la lista vigente del catálogo', () => {
    const r = armadoBancaDobleAppLT({ usuarios: 6, largoMM: 1200, biombo: 'cristal_satinado' });
    expect(r.componentes.find((x) => x.clave === 'ATBIOCRS4')).toMatchObject({ cantidad: 3, lista: 1640 });
  });
});
