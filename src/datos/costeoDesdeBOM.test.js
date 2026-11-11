import { describe, it, expect } from 'vitest';
import { costearBOM, advertenciasTerceros } from './costeoDesdeBOM.js';
import { aprobacionPrecioExacto } from './autoridadCosteoServidor.js';

// Linea TRAZABLE completa (insumoId+precio+cantidad+unidad+procedencia).
const T = (o) => ({ insumoId: o.insumoId || 'ins', cantidad: o.cantidad ?? 1, precio: o.precio ?? 100,
  unidad: o.unidad || 'pza', procedencia: o.procedencia || 'DERIVED', seccion: o.seccion || 'metal', ...o });

describe('costeoDesdeBOM · math del MOTOR (POLITICA_VH)', () => {
  it('BOM fabricado: fab x1.20 y GIF 0.50', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 1000, seccion: 'metal' }), T({ insumoId: 'pin', precio: 200, seccion: 'pintura' })]);
    expect(r.material).toBe(1200); expect(r.mano_obra).toBe(240); expect(r.gif).toBe(720); expect(r.costo_total).toBe(2160);
  });
  it('graficos/iluminacion = compra-venta x1.06', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 1000, seccion: 'metal' }),
      T({ insumoId: 'sti', precio: 100, seccion: 'graficos' }), T({ insumoId: 'led', precio: 500, seccion: 'iluminacion' })]);
    expect(r.material_fabricado).toBe(1000); expect(r.material_compra_venta).toBe(600);
    expect(r.mano_obra).toBe(206); expect(r.gif).toBe(630);
  });
});

describe('P1 · el CLIENTE nunca certifica (auditoria 212caeb)', () => {
  const lines = [T({ insumoId: 'lam', precio: 800, seccion: 'metal' })];
  it('oficial es SIEMPRE false; es un CANDIDATO; autoridad server-only', () => {
    const r = costearBOM(lines);
    expect(r.oficial).toBe(false); expect(r.candidato).toBe(true); expect(r.autoridad).toBe('server-only');
    expect(typeof r.huella).toBe('string');
  });
  it('ADVERSARIAL: NINGUN objeto del cliente vuelve oficial el costo (firma inventada, huella+firma, etc.)', () => {
    const h = costearBOM(lines).huella;
    const intentos = [
      { veredictoServidor: { estado: 'certificado', aprobacionHumana: true, firma: 'inventada' } },
      { veredictoServidor: { estado: 'certificado', aprobacionHumana: true, firma: 'edge:inventada', huella: h } },
      { veredictoServidor: { estado: 'certificado', aprobacionHumana: true, firma: 'f', huella: 'otra' } },
      { oficial: true }, { servidorCertifico: true }, { candidato: false },
    ];
    for (const intento of intentos) expect(costearBOM(lines, intento).oficial).toBe(false);
  });
});

describe('P1 · la OFICIALIDAD vive en el servidor (autoridadCosteoServidor) — verificada vs BD', () => {
  const base = {
    usados: ['lam'], insumos: { lam: { precio: 800, precioId: 1 } },
    filasPrecio: [{ id: 1, insumo_id: 'lam', precio: 800, estado: 'aprobado', approved_by: 'alba@vh.mx', vigente_hasta: null }],
    permitidos: [{ email: 'alba@vh.mx', rol: 'direccion' }], noHumanas: ['qa@vh.mx'],
  };
  it('LEGITIMA: precio exacto aprobado + rol direccion + cuenta humana -> aprobacionHumana', () => {
    expect(aprobacionPrecioExacto(base).aprobacionHumana).toBe(true);
  });
  it('ADVERSARIAL · aprobador inventado (no en permitidos) -> NO', () => {
    expect(aprobacionPrecioExacto({ ...base, filasPrecio: [{ ...base.filasPrecio[0], approved_by: 'inventado@x' }] }).aprobacionHumana).toBe(false);
  });
  it('ADVERSARIAL · precio cambiado (no coincide con el aprobado) -> NO', () => {
    expect(aprobacionPrecioExacto({ ...base, insumos: { lam: { precio: 900, precioId: 1 } } }).aprobacionHumana).toBe(false);
  });
  it('ADVERSARIAL · aprobado por CUENTA NO HUMANA -> NO', () => {
    expect(aprobacionPrecioExacto({ ...base, filasPrecio: [{ ...base.filasPrecio[0], approved_by: 'qa@vh.mx' }] }).aprobacionHumana).toBe(false);
  });
  it('ADVERSARIAL · precio NO aprobado (estado propuesto) -> NO', () => {
    expect(aprobacionPrecioExacto({ ...base, filasPrecio: [{ ...base.filasPrecio[0], estado: 'propuesto' }] }).aprobacionHumana).toBe(false);
  });
  it('FAIL-CLOSED · sin lista de cuentas no-humanas (tabla no aplicada) -> NO', () => {
    expect(aprobacionPrecioExacto({ ...base, noHumanas: null }).aprobacionHumana).toBe(false);
  });
});

describe('P1-C · ESTIMADO, vacio y trazabilidad', () => {
  it('linea estimada -> ESTIMADO (candidato, no oficial)', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 766, seccion: 'metal', estimado: true })]);
    expect(r.estado).toBe('ESTIMADO'); expect(r.oficial).toBe(false);
  });
  it('BOM vacio -> BLOQUEADO', () => {
    expect(costearBOM([]).estado).toBe('BLOQUEADO');
  });
  it('importe suelto ({costo}) -> ESTIMADO, no trazable', () => {
    const r = costearBOM([{ nombre: 'Pieza', costo: 5000, seccion: 'metal' }]);
    expect(r.estado).toBe('ESTIMADO'); expect(r.detalle[0].trazable).toBe(false);
  });
});

describe('P2-D · identidad estable y cantidad', () => {
  it('mismo nombre+dims distinta identidad -> NO duplicado', () => {
    expect(costearBOM([T({ id: 'A', insumoId: 'lam', precio: 300 }), T({ id: 'B', insumoId: 'lam', precio: 300 })]).bloqueos).toHaveLength(0);
  });
  it('misma identidad repetida -> duplicado', () => {
    expect(costearBOM([T({ id: 'A', precio: 300 }), T({ id: 'A', precio: 300 })]).bloqueos.some((b) => /duplicad/i.test(b.motivo))).toBe(true);
  });
  it('cantidad ausente no se vuelve 1', () => {
    const r = costearBOM([{ insumoId: 'lam', precio: 100, unidad: 'hoja', procedencia: 'DERIVED', seccion: 'metal' }]);
    expect(r.faltantes).toHaveLength(1); expect(r.material).toBe(0);
  });
});

describe('TERCEROS fail-closed', () => {
  it('cristal sin clasificar BLOQUEA', () => {
    const r = costearBOM([T({ insumoId: 'lam', precio: 1000, seccion: 'metal' }),
      T({ insumoId: 'cri', nombre: 'Cristal templado 6mm', precio: 900, seccion: 'cristal' })]);
    expect(r.estado).toBe('BLOQUEADO');
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
