import { describe, it, expect } from 'vitest';
import { costearBOM, advertenciasTerceros } from './costeoDesdeBOM.js';

// Linea TRAZABLE completa (insumoId+precio+cantidad+unidad+procedencia) — base para costo oficial.
const T = (o) => ({ insumoId: o.insumoId || 'ins', cantidad: o.cantidad ?? 1, precio: o.precio ?? 100,
  unidad: o.unidad || 'pza', procedencia: o.procedencia || 'DERIVED', seccion: o.seccion || 'metal', ...o });

// Simula el veredicto del SERVIDOR: ligado a la huella del candidato + firmado (origen Edge).
// En produccion lo emite costear-servidor (autoridadCosteoServidor), nunca el cliente.
const certificar = (cand, over = {}) => ({ veredictoServidor: {
  estado: 'certificado', aprobacionHumana: true, huella: cand.huella, firma: 'edge:costear-servidor:#f1rma', ...over } });

describe('costeoDesdeBOM · math del MOTOR (POLITICA_VH) — el cliente emite CANDIDATO', () => {
  it('BOM fabricado: fab x1.20 y GIF 0.50; el candidato NO es oficial por si mismo', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 1000, seccion: 'metal' }), T({ insumoId: 'pin', precio: 200, seccion: 'pintura' })]);
    expect(r.material).toBe(1200); expect(r.mano_obra).toBe(240); expect(r.gif).toBe(720);
    expect(r.costo_total).toBe(2160); expect(r.estado).toBe('COSTEADO');
    expect(r.candidato).toBe(true);
    expect(r.oficial).toBe(false);            // candidato puro, sin veredicto del servidor
    expect(typeof r.huella).toBe('string');   // huella de ligadura presente
  });
  it('graficos/iluminacion = compra-venta x1.06', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 1000, seccion: 'metal' }),
      T({ insumoId: 'sti', precio: 100, seccion: 'graficos' }), T({ insumoId: 'led', precio: 500, seccion: 'iluminacion' })]);
    expect(r.material_fabricado).toBe(1000); expect(r.material_compra_venta).toBe(600);
    expect(r.mano_obra).toBe(206); expect(r.gif).toBe(630);
  });
});

describe('P1-A · oficialidad NO falsificable (auditoria e48c0c2)', () => {
  const linea = [T({ insumoId: 'lam', precio: 800, seccion: 'metal' })];

  it('ADVERSARIAL: un veredicto FABRICADO por el cliente ({estado,aprobacionHumana}) NO certifica', () => {
    const r = costearBOM(linea, { veredictoServidor: { estado: 'certificado', aprobacionHumana: true } });
    expect(r.veredicto_ligado).toBe(false);   // sin huella -> no ligado a este costeo
    expect(r.veredicto_firmado).toBe(false);  // sin firma -> sin prueba de origen del servidor
    expect(r.servidorCertifico).toBe(false);
    expect(r.oficial).toBe(false);
  });
  it('veredicto LIGADO (huella correcta) pero SIN firma -> no certifica', () => {
    const cand = costearBOM(linea);
    const r = costearBOM(linea, { veredictoServidor: { estado: 'certificado', aprobacionHumana: true, huella: cand.huella } });
    expect(r.veredicto_ligado).toBe(true);
    expect(r.veredicto_firmado).toBe(false);
    expect(r.oficial).toBe(false);
  });
  it('veredicto FIRMADO pero con huella de OTRO costeo -> no certifica (no ligado)', () => {
    const otro = costearBOM([T({ insumoId: 'x', precio: 999, seccion: 'metal' })]);
    const r = costearBOM(linea, { veredictoServidor: { estado: 'certificado', aprobacionHumana: true, huella: otro.huella, firma: 'edge:abc' } });
    expect(r.veredicto_ligado).toBe(false);
    expect(r.oficial).toBe(false);
  });
  it('veredicto del servidor en PRELIMINAR (ligado+firmado) tampoco certifica', () => {
    const cand = costearBOM(linea);
    const r = costearBOM(linea, certificar(cand, { estado: 'preliminar', aprobacionHumana: false }));
    expect(r.oficial).toBe(false);
  });
  it('veredicto LIGADO + FIRMADO + certificado + aprobacion humana -> OFICIAL', () => {
    const cand = costearBOM(linea);
    const r = costearBOM(linea, certificar(cand));
    expect(r.servidorCertifico).toBe(true);
    expect(r.oficial).toBe(true);
  });
  it('cambiar el BOM invalida un veredicto viejo (la huella ya no liga)', () => {
    const cand = costearBOM(linea);
    const v = certificar(cand);                                   // veredicto para el BOM original
    const r = costearBOM([T({ insumoId: 'lam', precio: 900, seccion: 'metal' })], v);  // precio cambiado
    expect(r.veredicto_ligado).toBe(false);
    expect(r.oficial).toBe(false);
  });
});

describe('P1-A/C · ESTIMADO, vacio y trazabilidad nunca son oficiales', () => {
  it('una linea estimada -> ESTIMADO y oficial=false aun con veredicto valido', () => {
    const lines = [T({ insumoId: 'lam', precio: 766, seccion: 'metal', estimado: true })];
    const cand = costearBOM(lines);
    const r = costearBOM(lines, certificar(cand));
    expect(r.estado).toBe('ESTIMADO'); expect(r.oficial).toBe(false);
  });
  it('BOM vacio -> BLOQUEADO, oficial=false', () => {
    const r = costearBOM([]);
    expect(r.estado).toBe('BLOQUEADO'); expect(r.oficial).toBe(false);
  });
  it('importe suelto del cliente ({costo}) -> ESTIMADO, no trazable, oficial=false', () => {
    const lines = [{ nombre: 'Pieza', costo: 5000, seccion: 'metal' }];
    const cand = costearBOM(lines);
    const r = costearBOM(lines, certificar(cand));
    expect(r.estado).toBe('ESTIMADO'); expect(r.oficial).toBe(false);
    expect(r.detalle[0].trazable).toBe(false);
  });
});

describe('P2-D · identidad estable y cantidad', () => {
  it('mismo nombre+dims distinta identidad -> NO duplicado', () => {
    const r = costearBOM([T({ id: 'A', insumoId: 'lam', precio: 300 }), T({ id: 'B', insumoId: 'lam', precio: 300 })]);
    expect(r.bloqueos).toHaveLength(0);
  });
  it('misma identidad repetida -> duplicado (bloquea)', () => {
    const r = costearBOM([T({ id: 'A', precio: 300 }), T({ id: 'A', precio: 300 })]);
    expect(r.bloqueos.some((b) => /duplicad/i.test(b.motivo))).toBe(true); expect(r.oficial).toBe(false);
  });
  it('cantidad AUSENTE no se vuelve 1: sin cantidad ni costo -> faltante', () => {
    const r = costearBOM([{ insumoId: 'lam', precio: 100, unidad: 'hoja', procedencia: 'DERIVED', seccion: 'metal' }]);
    expect(r.faltantes).toHaveLength(1); expect(r.material).toBe(0);
  });
});

describe('TERCEROS fail-closed (bloqueo 1)', () => {
  it('cristal sin clasificar BLOQUEA', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 1000, seccion: 'metal' }),
      T({ insumoId: 'cri', nombre: 'Cristal templado 6mm', precio: 900, seccion: 'cristal' })]);
    expect(r.estado).toBe('BLOQUEADO'); expect(r.oficial).toBe(false);
  });
  it('cristal declarado compra_venta fluye a x1.06', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 1000, seccion: 'metal' }),
      T({ insumoId: 'cri', nombre: 'Cristal templado', precio: 900, seccion: 'cristal', clasificacion: 'compra_venta' })]);
    expect(r.material_compra_venta).toBe(900);
  });
  it('sin terceros sospechosos -> sin advertencias', () => {
    expect(advertenciasTerceros([{ nombre: 'Lamina c18', tipo: 'fabricado' }])).toHaveLength(0);
  });
});
