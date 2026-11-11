// FAIL-CLOSED: una tool económica sin datos devuelve el centinela {disponible:false} (un objeto),
// NO null. Antes el gate de evidencia (datos[nombre] == null) lo dejaba pasar como "dato presente",
// así que VONI respondía "Todo en orden / OK" a una pregunta de COSTO sin costeo ni BOM (falso VERDE).
// Debe ser DESCONOCIDO. (Bug confirmado por auditoría de la capa VONI.)
import { describe, it, expect } from 'vitest';
import { responder } from './nucleo.js';

const USER = { id: 'u1', email: 'v@vh.mx' };
// Proveedor SIN costeo/BOM en contexto: las tools económicas devuelven el centinela honesto.
const PROV_SIN_COSTEO = {
  get_costing: async () => ({ disponible: false, nota: 'sin costeo en contexto' }),
  get_bom: async () => ({ disponible: false, nota: 'sin BOM en contexto' }),
  get_costing_precedents: async () => ({ disponible: false }),
  get_render_status: async () => ([]),
  get_approvals: async () => ([]),
  get_direction_facts: async () => ({ disponible: false }),
};

describe('VONI fail-closed · centinela {disponible:false} cuenta como FALTANTE', () => {
  it('COSTING_ANALYSIS (rol con economía) sin costeo/BOM ⇒ DESCONOCIDO, nunca OK', async () => {
    const { respuesta } = await responder({ query: 'costéame este mueble y dime el bom', ctx: { user: USER, role: 'diseno' }, prov: PROV_SIN_COSTEO });
    expect(respuesta.estado).toBe('DESCONOCIDO');
    expect(respuesta.estado).not.toBe('OK');
  });

  it('RISK (rol con economía) sin costeo ⇒ DESCONOCIDO', async () => {
    const { respuesta } = await responder({ query: '¿hay riesgo de margen bajo en este proyecto?', ctx: { user: USER, role: 'direccion' }, prov: PROV_SIN_COSTEO });
    expect(respuesta.estado).toBe('DESCONOCIDO');
    expect(respuesta.estado).not.toBe('OK');
  });
});
