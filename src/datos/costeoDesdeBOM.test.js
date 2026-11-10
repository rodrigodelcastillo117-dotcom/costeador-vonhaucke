import { describe, it, expect } from 'vitest';
import { costearBOM, advertenciasTerceros } from './costeoDesdeBOM.js';

// Linea TRAZABLE completa (insumoId+precio+cantidad+unidad+procedencia) — base para costo oficial.
const T = (o) => ({ insumoId: o.insumoId || 'ins', cantidad: o.cantidad ?? 1, precio: o.precio ?? 100,
  unidad: o.unidad || 'pza', procedencia: o.procedencia || 'DERIVED', seccion: o.seccion || 'metal', ...o });
// Veredicto VERIFICABLE del servidor (estadoBaseServidor + aprobacionPrecioExacto). Un booleano NO basta.
const VS = { veredictoServidor: { estado: 'certificado', aprobacionHumana: true } };

describe('costeoDesdeBOM · math del MOTOR (POLITICA_VH)', () => {
  it('BOM fabricado: fab x1.20 y GIF 0.50 sobre (mat+MO)', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 1000, seccion: 'metal' }), T({ insumoId: 'pin', precio: 200, seccion: 'pintura' })], VS);
    expect(r.material).toBe(1200); expect(r.mano_obra).toBe(240); expect(r.gif).toBe(720);
    expect(r.costo_total).toBe(2160); expect(r.estado).toBe('COSTEADO'); expect(r.oficial).toBe(true);
  });
  it('graficos/iluminacion = compra-venta x1.06', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 1000, seccion: 'metal' }),
      T({ insumoId: 'sti', precio: 100, seccion: 'graficos' }), T({ insumoId: 'led', precio: 500, seccion: 'iluminacion' })], VS);
    expect(r.material_fabricado).toBe(1000); expect(r.material_compra_venta).toBe(600);
    expect(r.mano_obra).toBe(206); expect(r.gif).toBe(630); expect(r.oficial).toBe(true);
  });
});

describe('P1-A · ESTIMADO nunca es OFICIAL', () => {
  it('una linea estimada -> estado ESTIMADO y oficial=false aunque nada este bloqueado y el servidor apruebe', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 766, seccion: 'metal', estimado: true })], VS);
    expect(r.estado).toBe('ESTIMADO');
    expect(r.oficial).toBe(false);            // RED antes: oficial seguia true
    expect(r.bloqueos).toHaveLength(0);       // no esta bloqueado; simplemente no es oficial
  });
});

describe('P1-B · BOM vacio o sin lineas costeables nunca es oficial', () => {
  it('BOM vacio -> BLOQUEADO, oficial=false, costo 0 no oficial', () => {
    const r = costearBOM([]);
    expect(r.estado).toBe('BLOQUEADO'); expect(r.oficial).toBe(false);
    expect(r.bloqueos.some((b) => /vac|costear/i.test(b.motivo))).toBe(true);
  });
  it('solo lineas sin precio -> sin lineas costeables -> no oficial', () => {
    const r = costearBOM([{ nombre: 'pieza', seccion: 'metal' }], VS);
    expect(r.completo).toBe(false); expect(r.oficial).toBe(false); expect(r.estado).toBe('BLOQUEADO');
  });
});

describe('P1-C · trazabilidad: un importe suelto o texto no certifican', () => {
  it('importe suelto del cliente ({costo}) -> ESTIMADO, oficial=false aun con aprobacion de servidor', () => {
    const r = costearBOM([{ nombre: 'Pieza', costo: 5000, seccion: 'metal' }], VS);
    expect(r.estado).toBe('ESTIMADO');        // costo suelto = soloImporte -> estimado
    expect(r.oficial).toBe(false);
    expect(r.detalle[0].trazable).toBe(false);
    expect(r.detalle[0].falta_trazabilidad).toEqual(expect.arrayContaining(['insumoId', 'precio_unitario', 'unidad', 'procedencia']));
  });
  it('linea TRAZABLE pero SIN veredicto del servidor -> no oficial', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 800, seccion: 'metal' })]);  // sin veredicto
    expect(r.todasTrazables).toBe(true);
    expect(r.oficial).toBe(false);            // falta la certificacion del servidor
  });
  it('P2: un BOOLEANO aprobacionServidor:true NO certifica (se ignora; no es autorizacion valida)', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 800, seccion: 'metal' })], { aprobacionServidor: true });
    expect(r.servidorCertifico).toBe(false);
    expect(r.oficial).toBe(false);            // un flag de JS no es autoridad
  });
  it('P2: un veredicto PRELIMINAR del servidor tampoco certifica', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 800, seccion: 'metal' })],
      { veredictoServidor: { estado: 'preliminar', aprobacionHumana: false } });
    expect(r.oficial).toBe(false);
  });
  it('linea TRAZABLE + veredicto CERTIFICADO del servidor + aprobacion humana -> OFICIAL', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 800, seccion: 'metal' })], VS);
    expect(r.servidorCertifico).toBe(true);
    expect(r.oficial).toBe(true);
  });
});

describe('P2-D · identidad estable y cantidad', () => {
  it('dos piezas legitimas con mismo nombre+dims pero distinta identidad NO son duplicadas', () => {
    const r = costearBOM([
      T({ id: 'A', insumoId: 'lam', nombre: 'Lateral', largoMM: 700, anchoMM: 400, precio: 300 }),
      T({ id: 'B', insumoId: 'lam', nombre: 'Lateral', largoMM: 700, anchoMM: 400, precio: 300 }),
    ], VS);
    expect(r.bloqueos).toHaveLength(0);       // identidad estable distinta -> no duplicado
    expect(r.oficial).toBe(true);
  });
  it('misma identidad estable repetida SI es duplicado (bloquea)', () => {
    const r = costearBOM([T({ id: 'A', precio: 300 }), T({ id: 'A', precio: 300 })], VS);
    expect(r.bloqueos.some((b) => /duplicad/i.test(b.motivo))).toBe(true);
    expect(r.oficial).toBe(false);
  });
  it('cantidad AUSENTE no se vuelve 1: sin cantidad ni costo -> faltante, no se cuesta a 1x', () => {
    const r = costearBOM([{ insumoId: 'lam', precio: 100, unidad: 'hoja', procedencia: 'DERIVED', seccion: 'metal' }], VS);
    expect(r.faltantes).toHaveLength(1);      // precio sin cantidad no alcanza
    expect(r.oficial).toBe(false);
    expect(r.material).toBe(0);               // NO se costeo como 100 (1x implicito)
  });
});

describe('TERCEROS fail-closed (bloqueo 1)', () => {
  it('cristal sin clasificar BLOQUEA el costo oficial', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 1000, seccion: 'metal' }),
      T({ insumoId: 'cri', nombre: 'Cristal templado 6mm', precio: 900, seccion: 'cristal' })], VS);
    expect(r.estado).toBe('BLOQUEADO'); expect(r.oficial).toBe(false);
    expect(r.detalle.filter((d) => d.tercero_ambiguo).length).toBe(1);
  });
  it('cristal declarado compra_venta fluye a x1.06 y desbloquea (trazable + aprobado => oficial)', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 1000, seccion: 'metal' }),
      T({ insumoId: 'cri', nombre: 'Cristal templado', precio: 900, seccion: 'cristal', clasificacion: 'compra_venta' })], VS);
    expect(r.material_compra_venta).toBe(900); expect(r.oficial).toBe(true);
  });
  it('sin terceros sospechosos -> sin advertencias', () => {
    expect(advertenciasTerceros([{ nombre: 'Lamina c18', tipo: 'fabricado' }])).toHaveLength(0);
  });
});
