// ============================================================================
//  E2E (lógico, por claim-simulation / fixtures) — FASE 5/6/7 del Perfect Pass.
//  No hay login humano ni DOM testing lib disponibles, así que el recorrido se
//  demuestra a nivel de DATOS/MOTORES/VONI con un proyecto QA determinista.
//  Proyecto: "Corporativo Reforma" — 80 estaciones, 6 privados, 1 recepción,
//  2 salas (12 c/u), presupuesto $2,000,000.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { construirScope, reconciliarScope } from './datos/scopeModel.js';
import { planValueEngineering } from './datos/valueEngineering.js';
import { transicion, aprobacionVigente, requiereNuevaAprobacion } from './datos/aprobaciones.js';
import { diffRevisiones } from './datos/diffRevisiones.js';
import { validarCierre } from './datos/cierre.js';
import { responder } from './voni/nucleo.js';
import { esClientSafe } from './datos/economia.js';

const PRESUPUESTO = 2000000;
const ZONAS = [
  { nombre: 'Open office', tipo: 'open', required_items: [{ tipo: 'estacion', cantidad: 80 }], confidence: 0.95 },
  { nombre: 'Privados', tipo: 'privado', required_items: [{ tipo: 'privado', cantidad: 6 }], confidence: 0.9 },
  { nombre: 'Recepción', tipo: 'recepcion', required_items: [{ tipo: 'recepcion', cantidad: 1 }], confidence: 0.9 },
  { nombre: 'Salas de junta', tipo: 'juntas', required_items: [{ tipo: 'silla', cantidad: 24 }], confidence: 0.9 },
];

describe('E2E Corporativo Reforma — ciclo comercial', () => {
  it('SCOPE: alcance total = 111 posiciones, todo con evidencia', () => {
    const s = construirScope(ZONAS);
    expect(s.totalRequerido).toBe(80 + 6 + 1 + 24);
    expect(s.totalZonas).toBe(4);
    expect(s.porEstado.REVISAR).toBe(0); // todo confirmado/inferido
  });

  it('RECONCILIACIÓN: Rev1 cotiza y acomoda todo salvo 2 sillas de sala → falta', () => {
    const s = construirScope(ZONAS);
    const r = reconciliarScope(s, {
      cotizadoPorZona: { 'Open office': 80, Privados: 6, 'Recepción': 1, 'Salas de junta': 24 },
      acomodadoPorZona: { 'Open office': 80, Privados: 6, 'Recepción': 1, 'Salas de junta': 22 },
    });
    expect(r.hayDiscrepancia).toBe(true);
    const sala = r.zonas.find((z) => z.nombre === 'Salas de junta');
    expect(sala.estado).toBe('falta');
    expect(sala.faltaAcomodar).toBe(2);
  });

  it('VALUE ENGINEERING: $2,184,500 → plan prioriza ingeniería antes que descuento y alcanza', () => {
    const total = 2184500;
    const plan = planValueEngineering(PRESUPUESTO, total, [
      { id: 'o1', tipo: 'descuento', descripcion: 'Descuento 2%', delta: -43690 },
      { id: 'o2', tipo: 'sustitucion', descripcion: 'Cambio de línea', delta: -120000 },
      { id: 'o3', tipo: 'acabado', descripcion: 'Acabado alterno', delta: -80000 },
    ]);
    expect(plan.faltaBajar).toBe(184500);
    // la primera seleccionada debe ser ingeniería (sustitución), NO el descuento
    expect(plan.seleccionadas[0].tipo).toBe('sustitucion');
    expect(plan.alcanza).toBe(true);
    expect(plan.nuevoTotal).toBeLessThanOrEqual(PRESUPUESTO);
  });

  it('DEAL DESK: descuento pide aprobación; cambio de dinero invalida la aprobación', () => {
    expect(transicion('PENDIENTE', 'aprobar')).toBe('APROBADA');
    const aprob = { estado: 'APROBADA', revision_hash: 'hash_rev1' };
    expect(aprobacionVigente(aprob, 'hash_rev1')).toBe(true);
    // Rev2 cambia el dinero (nuevo hash) → la aprobación anterior queda invalidada
    expect(requiereNuevaAprobacion(aprob, 'hash_rev2')).toBe(true);
    expect(aprobacionVigente(aprob, 'hash_rev2')).toBe(false);
  });

  it('REV1 → REV2 → DIFF: refleja el ajuste de VE con delta correcto', () => {
    const rev1 = {
      total: 2184500,
      totales: { precioLista: 2184500, descuento: 0, maniobras: 0, flete: 0, iva: 0 },
      partidas: [{ nombre: 'Estación de trabajo', cantidad: 80, precioUnitario: 20000 }],
    };
    const rev2 = {
      total: 2064500,
      totales: { precioLista: 2064500, descuento: 0, maniobras: 0, flete: 0, iva: 0 },
      partidas: [{ nombre: 'Estación de trabajo', cantidad: 80, precioUnitario: 18500 }],
    };
    const d = diffRevisiones(rev1, rev2);
    expect(d.deltas.total).toBe(-120000);
    expect(d.resumen.lineasCambiadas).toBe(1);
  });

  it('CIERRE: ganada exige revisión/total/escenario/fecha; perdida exige motivo válido', () => {
    expect(validarCierre({ resultado: 'ganada', revision_aceptada: 2, total_final: 2064500, escenario: 'recomendada', fecha: '2026-10-02' }).ok).toBe(true);
    expect(validarCierre({ resultado: 'ganada' }).ok).toBe(false);
    expect(validarCierre({ resultado: 'perdida', motivo: 'PRECIO' }).ok).toBe(true);
    expect(validarCierre({ resultado: 'perdida' }).ok).toBe(false);
  });
});

describe('E2E Voni multilente sobre el proyecto (vendedor)', () => {
  const USER = { id: 'qa', email: 'qa@vh.mx' };
  const prov = {
    get_project_context: async () => ({ id: 1, nombre: 'Corporativo Reforma', cliente: 'ACME', presupuesto: PRESUPUESTO, total_actual: 2184500, proxima_accion: 'Enviar propuesta' }),
    get_reconciliation: async () => reconciliarScope(construirScope(ZONAS), {
      cotizadoPorZona: { 'Salas de junta': 24 }, acomodadoPorZona: { 'Salas de junta': 22 },
    }),
    get_quote: async () => ({ partidas: [{ nombre: 'Estación', precioUnitario: 20000 }], sinPrecio: [] }),
    get_approvals: async () => ([]),
    get_render_status: async () => ([]),
    get_costing: async () => ({ costo: 1, margen: 1 }), // intruso: debe quedar bloqueado para vendedor
    get_bom: async () => ({ componentes: [] }),
  };

  it('"¿podemos enviar esto?" → NO lista, bloqueo de sala, SIN economía', async () => {
    const { respuesta } = await responder({ query: '¿podemos enviar esto al cliente?', ctx: { user: USER, role: 'ventas', project_id: 1, quote_id: 1 }, prov });
    expect(respuesta.que_paso).toContain('NO LISTA');
    expect(respuesta.bloqueos.length).toBeGreaterThan(0);
    expect(esClientSafe(respuesta)).toBe(true); // el intruso de get_costing nunca llega al vendedor
  });
});
