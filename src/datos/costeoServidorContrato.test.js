// ============================================================================
//  CONTRATO DE COSTEO-SERVIDOR (shadow) — adversarial.
//  Replica EXACTAMENTE la cadena de dinero de supabase/functions/costear-servidor:
//    body → validarIntentCosteo (DTO estricto) → calcular (motor) → precioDe (margen
//    del SERVIDOR). No necesita Deno: prueba la MISMA lógica y los MISMOS módulos que
//    importa la edge, para que el comportamiento de dinero quede fijado por pruebas.
//
//  Qué garantiza:
//   · el cliente NO puede mover el precio (margen/insumo/precio inline → 400),
//   · el margen SIEMPRE sale del servidor (config/params), nunca del body,
//   · fail-closed: sin material → sin precio; `nombre` sobrevive para trazabilidad.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { validarIntentCosteo } from './validarIntentCosteo.js';
import { calcular, modeloParaPieza, precioDe, costeoEmitible, PARAMETROS_DEFAULT } from '../motor/calculo.js';
import { dinero } from '../motor/dinero.js';

// Config que "carga el servidor" (análogo a config.datos del edge). El cliente NUNCA
// la manda: es la autoridad de costo. Insumo con formato → costo finito y determinista.
const INSUMOS_SERVIDOR = {
  'tablero-x': { nombre: 'Tablero melamina', seccion: 'cubierta', clase: 'directa', unidad: 'm2', precio: 1000, formato: { medida: 2.98 }, fraccion: true },
};
const PARAMETROS_SERVIDOR = { ...PARAMETROS_DEFAULT, margenObjetivo: 50 };

// Espejo fiel de la cadena de dinero de la edge (index.ts).
function costearComoServidor(body, { insumos = INSUMOS_SERVIDOR, parametros = PARAMETROS_SERVIDOR } = {}) {
  const v = validarIntentCosteo(body);
  if (!v.ok) return { status: 400, code: v.code, issues: v.issues };
  const n = Math.max(1, Number(v.intent.cantidad) || 1);
  const { par } = modeloParaPieza(parametros, v.intent.pieza);
  const r = calcular(v.intent.pieza, n, insumos, par);
  const margen = Number(parametros.margenObjetivo ?? 50);         // SERVIDOR, jamás el body
  const precioRaw = precioDe(r.costoUnitario, margen);
  const precioFinito = Number.isFinite(precioRaw) ? dinero(precioRaw) : null;
  const incompleto = !costeoEmitible(r).emitible;
  return {
    status: 200,
    margenUsado: margen,
    precioVenta: incompleto ? null : precioFinito,
    costoUnitario: r.costoUnitario,
    componentesIgnorados: r.componentesIgnorados || [],
  };
}

const bodyValido = () => ({ cantidad: 1, pieza: { componentes: [{ insumoId: 'tablero-x', nombre: 'Cubierta', largoMM: 1000, anchoMM: 500, piezas: 1 }] } });

describe('costear-servidor (contrato shadow) — el dinero es del servidor', () => {
  it('ataque vendedor: pieza.margen=0 para abaratar → 400, el precio NO se produce', () => {
    const r = costearComoServidor({ ...bodyValido(), pieza: { ...bodyValido().pieza, margen: 0 } });
    expect(r.status).toBe(400);
    expect(r.code).toBe('FORBIDDEN_FINANCIAL_FIELD');
    expect(r.precioVenta).toBeUndefined();
  });

  it('cost-injection: componente con `insumo` inline barato → 400', () => {
    const r = costearComoServidor({ cantidad: 1, pieza: { componentes: [{ insumoId: 'tablero-x', insumo: { precio: 0.01, formato: { medida: 2.98 } } }] } });
    expect(r.status).toBe(400);
    expect(r.code).toBe('FORBIDDEN_FINANCIAL_FIELD');
  });

  it('el margen usado es SIEMPRE el del servidor, no el del body', () => {
    const r = costearComoServidor(bodyValido());
    expect(r.status).toBe(200);
    expect(r.margenUsado).toBe(PARAMETROS_SERVIDOR.margenObjetivo);
    // precio = precioDe(costo, margenServidor), al centavo.
    expect(r.precioVenta).toBe(dinero(precioDe(r.costoUnitario, PARAMETROS_SERVIDOR.margenObjetivo)));
  });

  it('independencia: un body con margen y otro sin él — el válido no cambia su precio por lo que mande el cliente', () => {
    const limpio = costearComoServidor(bodyValido());
    const sucio = costearComoServidor({ ...bodyValido(), pieza: { ...bodyValido().pieza, margen: 5 } });
    expect(sucio.status).toBe(400);           // el "sucio" ni siquiera se costea
    expect(limpio.status).toBe(200);
    expect(limpio.margenUsado).toBe(PARAMETROS_SERVIDOR.margenObjetivo);
  });

  it('fail-closed: material inexistente → sin precio, y `nombre` sobrevive en componentesIgnorados', () => {
    const r = costearComoServidor({ cantidad: 1, pieza: { componentes: [{ insumoId: 'no-existe', nombre: 'Pieza fantasma', largoMM: 100, anchoMM: 100 }] } });
    expect(r.status).toBe(200);
    expect(r.precioVenta).toBeNull();                       // no se inventa $0 con precio
    expect(r.componentesIgnorados).toContain('Pieza fantasma');
  });

  it('margen de servidor imposible (≥100) → precio null (fail-closed), no un número barato', () => {
    const r = costearComoServidor(bodyValido(), { parametros: { ...PARAMETROS_SERVIDOR, margenObjetivo: 100 } });
    expect(r.status).toBe(200);
    expect(r.precioVenta).toBeNull();
  });
});


  it('pieza que no cabe en el formato queda incompleta también en servidor', () => {
    const r = costearComoServidor({
      cantidad:1,
      pieza:{ componentes:[{ insumoId:'tablero-x', nombre:'Cubierta imposible', largoMM:3000, anchoMM:1500, piezas:1 }] },
    }, {
      insumos:{
        'tablero-x': {
          nombre:'Tablero', seccion:'cubierta', clase:'directa', unidad:'hoja', precio:1000,
          formato:{ medida:2.9768, largoMM:2440, anchoMM:1220 }, fraccion:true,
        },
      },
      parametros:{...PARAMETROS_SERVIDOR, tableroLargoMM:2440, tableroAnchoMM:1220},
    });
    expect(r.status).toBe(200);
    expect(r.precioVenta).toBeNull();
  });

  it('precio de servidor conserva centavos', () => {
    const r = costearComoServidor(bodyValido(), {
      parametros:{ ...PARAMETROS_SERVIDOR, margenObjetivo:37.5 },
    });
    expect(r.precioVenta).toBe(dinero(precioDe(r.costoUnitario, 37.5)));
    expect(Number.isInteger(r.precioVenta * 100)).toBe(true);
  });
