import { describe, it, expect } from 'vitest';
import { sinEconomia, escaneaEconomia, esClientSafe, esClaveEconomia } from './economia.js';
import { construirPresentacionCliente } from './clientSafe.js';
import { transicion, accionesValidas, aprobacionVigente, requiereNuevaAprobacion } from './aprobaciones.js';
import { reconciliar, resumenReconciliacion } from './reconciliacion.js';
import { validarCierre, MOTIVOS_PERDIDA } from './cierre.js';
import { planValueEngineering } from './valueEngineering.js';

describe('economia (guarda de economía interna)', () => {
  it('sinEconomia elimina costo/margen/insumos/factores recursivamente, conserva precio', () => {
    const o = { nombre: 'x', precioUnitario: 500, costoUnitario: 200, margen: 40,
      pieza: { horas: {}, factorDirecta: 17, componentes: [{ insumoId: 'mdf', costo: 10 }] },
      insumos: { mdf: { precio: 210 } } };
    const s = sinEconomia(o);
    expect(s.precioUnitario).toBe(500);
    expect(escaneaEconomia(s)).toEqual([]);
    expect(s.costoUnitario).toBeUndefined();
    expect(s.insumos).toBeUndefined();
    expect(s.pieza.factorDirecta).toBeUndefined();
  });
  it('precio NO es economía; costo SÍ', () => {
    expect(esClaveEconomia('precio')).toBe(false);
    expect(esClaveEconomia('precioUnitario')).toBe(false);
    expect(esClaveEconomia('costoUnitario')).toBe(true);
    expect(esClaveEconomia('margen')).toBe(true);
    expect(esClaveEconomia('precioProveedor')).toBe(true);
  });
});

describe('WOW clientSafe (0 claves económicas)', () => {
  const datos = {
    brief: { resumen: '80 estaciones, 6 privados', preguntasPendientes: ['¿acabado?'] },
    zonas: [{ nombre: 'Open', cantidad: 80 }],
    reconciliacion: { zonas: [{ nombre: 'Open', requerido: 80, cotizado: 80, acomodado: 80, estado: 'ok' },
                              { nombre: 'Sala', requerido: 12, cotizado: 12, acomodado: 10, estado: 'falta' }] },
    partidas: [{ nombre: 'Bench', cantidad: 20, precioUnitario: 26800, costoUnitario: 9000, margen: 40, pieza: { factorDirecta: 17, horas: {} } }],
    renders: [{ tipo: 'ambiente', url: 'x.png', estado: 'alta' }],
    inversion: { presupuesto: 2000000, total: 2084300 },
    escenarios: [{ nombre: 'Recomendada', tipo: 'recomendada', total: 2084300, seleccionado: true }],
  };
  it('el payload no contiene NINGUNA clave económica interna', () => {
    const p = construirPresentacionCliente(datos);
    expect(esClientSafe(p)).toBe(true);
    expect(escaneaEconomia(p)).toEqual([]);
  });
  it('calcula delta e identifica discrepancias de alcance', () => {
    const p = construirPresentacionCliente(datos);
    expect(p.inversion.delta).toBe(84300);
    expect(p.distribucion.discrepancias).toEqual([{ nombre: 'Sala', falta: 2 }]);
    expect(p.solucion.productos[0].precioUnitario).toBe(26800);
  });
});

describe('N14 aprobaciones (máquina de estados + hash)', () => {
  it('transiciones válidas e inválidas', () => {
    expect(transicion('PENDIENTE', 'aprobar')).toBe('APROBADA');
    expect(transicion('CONTRAOFERTA', 'reenviar')).toBe('PENDIENTE');
    expect(() => transicion('APROBADA', 'aprobar')).toThrow();
    expect(() => transicion('PENDIENTE', 'xxx')).toThrow();
    expect(accionesValidas('PENDIENTE')).toContain('rechazar');
  });
  it('aprobación vigente sólo si el hash coincide; cambio de dinero la invalida', () => {
    const apr = { estado: 'APROBADA', revision_hash: 'abc' };
    expect(aprobacionVigente(apr, 'abc')).toBe(true);
    expect(aprobacionVigente(apr, 'DIF')).toBe(false);
    expect(requiereNuevaAprobacion(apr, 'DIF')).toBe(true);
    expect(requiereNuevaAprobacion(apr, 'abc')).toBe(false);
  });
});

describe('N5/WOW reconciliación', () => {
  it('marca ok/falta/sobra/revisar y faltantes', () => {
    const r = reconciliar([
      { nombre: 'Open', requerido: 80, cotizado: 80, acomodado: 80 },
      { nombre: 'Sala', requerido: 12, cotizado: 12, acomodado: 10 },
      { nombre: 'Extra', requerido: 5, cotizado: 7, acomodado: 7 },
      { nombre: '?', requerido: null, cotizado: 3, acomodado: 3 },
    ]);
    expect(r[0].estado).toBe('ok');
    expect(r[1].estado).toBe('falta'); expect(r[1].faltaAcomodar).toBe(2);
    expect(r[2].estado).toBe('sobra');
    expect(r[3].estado).toBe('revisar');
    expect(resumenReconciliacion([{ nombre: 'Open', requerido: 80, cotizado: 80, acomodado: 80 }]).hayDiscrepancia).toBe(false);
  });
});

describe('N18 cierre won/lost', () => {
  it('ganada exige revisión/total/escenario/fecha', () => {
    expect(validarCierre({ resultado: 'ganada', revision_aceptada: 2, total_final: 100, escenario: 'rec', fecha: '2026-10-02' }).ok).toBe(true);
    expect(validarCierre({ resultado: 'ganada' }).ok).toBe(false);
  });
  it('perdida exige motivo estructurado válido', () => {
    expect(validarCierre({ resultado: 'perdida', motivo: 'PRECIO' }).ok).toBe(true);
    expect(validarCierre({ resultado: 'perdida' }).ok).toBe(false);
    expect(validarCierre({ resultado: 'perdida', motivo: 'XX' }).ok).toBe(false);
    expect(validarCierre({ resultado: 'perdida', motivo: 'OTRO' }).ok).toBe(false); // OTRO sin detalle
    expect(MOTIVOS_PERDIDA).toContain('COMPETENCIA');
  });
});

describe('N13 value engineering', () => {
  const opciones = [
    { id: 'd', tipo: 'descuento', descripcion: 'Descuento', delta: -25000 },
    { id: 's', tipo: 'sustitucion', descripcion: 'Cirque→Rio', delta: -126400 },
    { id: 'a', tipo: 'acabado', descripcion: 'Melamina', delta: -43200 },
  ];
  it('prioriza ingeniería antes que descuento y alcanza el presupuesto', () => {
    const plan = planValueEngineering(2000000, 2084300, opciones);
    expect(plan.faltaBajar).toBe(84300);
    expect(plan.seleccionadas[0].tipo).toBe('sustitucion'); // la sustitución primero
    expect(plan.alcanza).toBe(true);
    expect(plan.usaDescuento).toBe(false); // la sustitución sola ya alcanza
  });
  it('si ya está en presupuesto, no selecciona nada', () => {
    const plan = planValueEngineering(2000000, 1900000, opciones);
    expect(plan.yaEnPresupuesto).toBe(true);
    expect(plan.seleccionadas).toEqual([]);
  });
});


describe('value engineering · UNKNOWN nunca es ZERO', () => {
  it('sin presupuesto queda NO_EVALUABLE', () => {
    const r = planValueEngineering(null, 100000, []);
    expect(r.estado).toBe('NO_EVALUABLE');
    expect(r.faltaBajar).toBeNull();
    expect(r.yaEnPresupuesto).toBeNull();
    expect(r.alcanza).toBeNull();
  });

  it('sin total autoritativo queda NO_EVALUABLE', () => {
    const r = planValueEngineering(100000, null, []);
    expect(r.estado).toBe('NO_EVALUABLE');
    expect(r.motivo).toBe('TOTAL_DESCONOCIDO');
  });

  it('opera a centavos y no redondea al peso', () => {
    const r = planValueEngineering(1000.10, 1050.55, [
      { id:'a', tipo:'sustitucion', descripcion:'A', delta:-50.45 },
    ]);
    expect(r.estado).toBe('EVALUADO');
    expect(r.faltaBajar).toBe(50.45);
    expect(r.ahorroTotal).toBe(50.45);
    expect(r.nuevoTotal).toBe(1000.10);
    expect(r.alcanza).toBe(true);
  });
});
