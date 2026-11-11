// ACEPTACION INDUSTRIAL · CASO B · identidad fisica y cantidades (modulos REALES).
// Exige: ninguna pieza desaparece, ninguna se duplica economicamente, ninguna obtiene
// cantidad por defecto. Corre el puente real -> motor industrial real.
import { describe, it, expect } from 'vitest';
import { expedienteIndustrialDesdeDespiece } from './expedienteIndustrialDesdeDespiece.js';

const insumosERP = { corredera: { nombre: 'Corredera telescopica', precio: 120, unidad: 'par', seccion: 'herrajes' } }; // 'perfilx' ausente a proposito
const catalogoLamina = [{ id: 'lam18', calibre: 18, acero: 'negra', formato: { largoMM: 3050, anchoMM: 1220 }, precio: 571.54, certificable: true }];

const DESPIECE = [
  { clave: 'LAT-A', desc: 'Lateral lamina cal.18', cantidad: 1, seccion: 'metal', largoMM: 700, anchoMM: 400 }, // 1
  { clave: 'LAT-B', desc: 'Lateral lamina cal.18', cantidad: 1, seccion: 'metal', largoMM: 700, anchoMM: 400 }, // 1 (identico fisico, identidad distinta)
  { clave: 'ENT',   desc: 'Entrepano melamina', cantidad: 3, seccion: 'madera', largoMM: 900, anchoMM: 400 },   // 2 (repetida 3x)
  { clave: 'SINQ',  desc: 'Refuerzo metalico', seccion: 'metal', largoMM: 500, anchoMM: 100 },                   // 3 (SIN cantidad)
  { clave: 'CAJA',  desc: 'Caja metalica 3D', cantidad: 1, seccion: 'metal', fabricada: true },                 // 4/5 (fabricada sin geometria)
  { clave: 'COR',   desc: 'Corredera telescopica', cantidad: 2, insumoId: 'corredera', seccion: 'herrajes' },   // 6 (comprado terminado)
  { clave: 'SINP',  desc: 'Material no mapeado al ERP', cantidad: 1, seccion: 'herrajes' },                      // 7 (sin precio/ERP)
];

describe('ACEPTACION INDUSTRIAL · CASO B (modulos reales)', () => {
  const exp = expedienteIndustrialDesdeDespiece(DESPIECE, { clave: 'CASO-B', insumosERP, catalogoLamina });
  const pend = exp.costo_industrial.material.pendiente;
  const piezas = exp.inputs.piezasBOM;
  const porClave = (c) => piezas.find((p) => p.clave === c);

  it('1 · dos laterales identicos con IDENTIDAD distinta -> 2 piezas (no se fusionan)', () => {
    expect(piezas.filter((p) => /^LAT-/.test(p.clave)).length).toBe(2);
  });
  it('2 · pieza repetida 3x -> cantidad 3 preservada (sin colapso ni doble conteo)', () => {
    expect(porClave('ENT').cantidad).toBe(3);
  });
  it('3 · pieza SIN cantidad -> bloqueada, NO se vuelve 1', () => {
    expect(pend.bloqueadas).toContain('SINQ');
    expect(porClave('SINQ').cantidad).not.toBe(1);
  });
  it('4/5 · fabricada sin geometria / caja metalica 3D -> pendiente de CAD', () => {
    expect(pend.desarrollos_3d).toContain('CAJA');
    expect(porClave('CAJA').fabricada).toBe(true);
  });
  it('6 · componente comprado terminado -> comprado (no fabricado, no pendiente de CAD)', () => {
    expect(porClave('COR').fabricada).toBe(false);
    expect(pend.desarrollos_3d).not.toContain('COR');
  });
  it('7 · material sin precio/ERP -> conservado pendiente (no $0 silencioso)', () => {
    expect(pend.compradas_sin_precio).toContain('SINP');
  });
  it('NINGUNA pieza desaparece: las 7 claves estan en el BOM', () => {
    for (const c of ['LAT-A', 'LAT-B', 'ENT', 'SINQ', 'CAJA', 'COR', 'SINP']) expect(porClave(c)).toBeTruthy();
    expect(piezas.length).toBe(7);
  });
});
