import { describe, it, expect } from 'vitest';
import { expedienteIndustrialDesdeDespiece } from './expedienteIndustrialDesdeDespiece.js';
import { vistaIngenieria, recostearExpediente } from './pantallaIngenieria.js';

// Despiece de un mueble NUEVO (como lo entregaria VONI/ERP), con los 4 casos:
const despiece = [
  { clave: 'LAT', desc: 'Lateral lamina cal.18', cantidad: 2, seccion: 'metal', largoMM: 700, anchoMM: 400 }, // fabricada CON dims
  { clave: 'CAJA', desc: 'Cuerpo 3D', cantidad: 1, seccion: 'metal', fabricada: true },                         // fabricada SIN dims -> pendiente CAD
  { clave: 'COR', desc: 'Corredera telescopica', cantidad: 2, insumoId: 'corredera', seccion: 'herrajes' },     // comprada ERP
  { clave: 'CRI', desc: 'Cristal templado 6mm', cantidad: 1, insumoId: 'cristal', seccion: 'cubiertas' },       // tercero -> F1
];
const insumosERP = {
  corredera: { nombre: 'Corredera telescopica', precio: 120, unidad: 'par', seccion: 'herrajes' },
  cristal: { nombre: 'Cristal templado', precio: 700, unidad: 'pza', seccion: 'cubiertas' },
};
// Lamina autoritativa (como catalogo_vigente): cal.18 negra, hoja estandar 3.05 x 1.22 m.
const catalogoLamina = [
  { id: 'lam18', calibre: 18, acero: 'negra', formato: { largoMM: 3050, anchoMM: 1220 }, precio: 571.54, certificable: true },
];
const ctx = { insumosERP, catalogoLamina };

describe('PUENTE despiece -> expediente industrial (P1 integracion)', () => {
  it('arma el expediente para CUALQUIER clave (no depende de TELSVH120) y vistaIngenieria lo renderiza', () => {
    const exp = expedienteIndustrialDesdeDespiece(despiece, { clave: 'NUEVO-001', nombre: 'Mueble nuevo', ...ctx });
    expect(exp.clave).toBe('NUEVO-001');
    expect(exp.inputs.piezasBOM.length).toBe(4);
    // F1: el cristal templado entra como compra_venta por catalogo
    expect(exp.inputs.piezasBOM.find((p) => /Cristal/.test(p.desc)).esCompraVenta).toBe(true);
    const v = vistaIngenieria(exp);
    expect(v.clave).toBe('NUEVO-001');
    expect(v.esto_entendi).toBeTruthy();
    expect(v.este_es_el_costo).toBeTruthy();
    // La caja 3D sin desarrollo pide confirmacion de Ingenieria (no inventa geometria).
    expect(v.esto_necesito_confirmar.length).toBeGreaterThan(0);
  });

  it('P3: confirmar el desarrollo (CAD) de la pieza pendiente RECALCULA, versiona y baja un pendiente', () => {
    const exp = expedienteIndustrialDesdeDespiece(despiece, { clave: 'NUEVO-001', ...ctx });
    const pend0 = (exp.costo_industrial.cobertura?.desarrollos_pendientes || []).length;
    expect(pend0).toBeGreaterThan(0);                 // la CAJA 3D esta pendiente de CAD
    const exp2 = recostearExpediente(exp, { tipo: 'desarrollo', clave: 'CAJA', desarrollo_mm: [600, 400], fuente: 'CAD' });
    expect(exp2.version).toBe(2);                      // el cambio queda versionado
    expect(exp2.confirmaciones.length).toBe(1);
    const pend1 = (exp2.costo_industrial.cobertura?.desarrollos_pendientes || []).length;
    expect(pend1).toBeLessThan(pend0);                // al dar la geometria, deja de estar pendiente
  });

  it('conserva el proyecto: el expediente lleva inputs para recostear despues de cualquier confirmacion', () => {
    const exp = expedienteIndustrialDesdeDespiece(despiece, { clave: 'X-99', ...ctx });
    expect(exp.inputs.piezasBOM).toBeTruthy();
    expect(exp.inputs.insumosERP).toBeTruthy();
    // una confirmacion de precio tambien recalcula sin reiniciar
    const exp2 = recostearExpediente(exp, { tipo: 'precio', clave: 'COR', insumoId: 'corredera', insumo: insumosERP.corredera });
    expect(exp2.version).toBe(2);
  });
});

describe('P1-B · material fabricado SIN geometria se conserva fabricado pendiente de CAD (no comprado)', () => {
  const clasif = (despiece) => {
    const exp = expedienteIndustrialDesdeDespiece(despiece, { clave: 'P1B', ...ctx });
    const p = exp.inputs.piezasBOM[0];
    const pend = (exp.costo_industrial.cobertura?.desarrollos_pendientes || []).map((x) => x.clave);
    return { p, pend };
  };
  it('pieza METALICA sin dims -> fabricada + pendiente de CAD', () => {
    const { p, pend } = clasif([{ clave: 'LAT', desc: 'Lateral de lamina cal.18', cantidad: 2, seccion: 'metal' }]);
    expect(p.fabricada).toBe(true);
    expect(pend).toContain('LAT');
  });
  it('pieza de MDF sin dims -> fabricada + pendiente', () => {
    const { p, pend } = clasif([{ clave: 'CUB', desc: 'Cubierta MDF 19mm', cantidad: 1, seccion: 'mdf' }]);
    expect(p.fabricada).toBe(true);
    expect(pend).toContain('CUB');
  });
  it('pieza de MADERA/melamina sin dims -> fabricada + pendiente', () => {
    const { p, pend } = clasif([{ clave: 'ENT', desc: 'Entrepano melamina', cantidad: 3, seccion: 'madera' }]);
    expect(p.fabricada).toBe(true);
    expect(pend).toContain('ENT');
  });
  it('geometria INCOMPLETA (solo un lado) -> fabricada + pendiente (no se cuesta a medias)', () => {
    const { p, pend } = clasif([{ clave: 'FAL', desc: 'Faldon metalico', cantidad: 1, seccion: 'metal', largoMM: 1500 }]);
    expect(p.fabricada).toBe(true);
    expect(pend).toContain('FAL');
  });
  it('componente COMPRADO (herraje, no procesable) con insumoId -> comprado, no fabricado', () => {
    const exp = expedienteIndustrialDesdeDespiece(
      [{ clave: 'COR', desc: 'Corredera telescopica', cantidad: 2, insumoId: 'corredera', seccion: 'herrajes' }],
      { clave: 'P1B2', ...ctx });
    expect(exp.inputs.piezasBOM[0].fabricada).toBe(false);
  });
  it('comprada:true explicito gana aunque la seccion sea procesable', () => {
    const exp = expedienteIndustrialDesdeDespiece(
      [{ clave: 'X', desc: 'Panel MDF cortado comprado', cantidad: 1, seccion: 'mdf', comprada: true, insumoId: 'panel' }],
      { clave: 'P1B3', ...ctx });
    expect(exp.inputs.piezasBOM[0].fabricada).toBe(false);
  });
});
