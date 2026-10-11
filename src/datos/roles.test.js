import { describe, it, expect } from 'vitest';
import { normalizarRol, veEconomiaCotizacion, veCostosCosteo, editaConfig, esVendedor, ROLES_SERVIDOR } from './roles.js';

describe('roles · espejo del servidor', () => {
  it('normaliza grafías y manda lo desconocido a vendedor (mínimo privilegio)', () => {
    expect(normalizarRol('Dirección')).toBe('direccion');
    expect(normalizarRol(' DISEÑO ')).toBe('diseno');
    expect(normalizarRol('ventas')).toBe('vendedor');
    for (const falso of ['cfo', 'costeador', 'admin', 'root', '', null, undefined, 42]) expect(normalizarRol(falso)).toBe('vendedor');
    expect(ROLES_SERVIDOR).toEqual(['direccion', 'diseno', 'vendedor']);
  });
  it('economía de cotizaciones: sólo direccion (puede_ver_economia)', () => {
    expect(veEconomiaCotizacion('direccion')).toBe(true);
    expect(veEconomiaCotizacion('diseno')).toBe(false);
    expect(veEconomiaCotizacion('cfo')).toBe(false);
  });
  it('costos de insumos/despiece: direccion y diseno (puede_editar_config)', () => {
    expect(veCostosCosteo('direccion')).toBe(true);
    expect(veCostosCosteo('diseno')).toBe(true);
    expect(veCostosCosteo('vendedor')).toBe(false);
    expect(veCostosCosteo('costeador')).toBe(false);   // antes voni/permisos lo dejaba pasar
    expect(editaConfig('admin')).toBe(false);           // antes datos/voni lo aceptaba por regex
    expect(esVendedor('ventas')).toBe(true);
  });
});
