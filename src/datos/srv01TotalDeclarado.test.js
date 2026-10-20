// SRV-01 (cierre ChatGPT v3, 2026-10-20): "la IA declara TOTAL X m y sus renglones suman Y". Antes el CLIENTE bloqueaba
// (revisión humana) y el SERVIDOR respondía 'preliminar' sin decir por qué: dos autoridades para la misma incoherencia.
// Ahora el total declarado viaja como evidencia y AMBOS usan la misma función, con la misma clave y el mismo texto.
import { describe, it, expect } from 'vitest';
import { validarIntentCosteo } from './validarIntentCosteo.js';
import { revisarEstructura, totalesLinealesIncoherentes } from './revisionEstructural.js';
import { costearConMotor } from './costeoServidor.js';

const insumos = {
  'tapacanto-pvc-2': { id: 'tapacanto-pvc-2', nombre: 'Tapacanto PVC 2 mm Walnut', seccion: 'tapacantos', unidad: 'm', precio: 12 },
  'melamina-16': { id: 'melamina-16', nombre: 'Melamina 16 mm', seccion: 'tableros', unidad: 'hoja', precio: 900, formato: { medida: 2.9768 }, fraccion: true },
};
// Caso real: mesa_juntas_texto (run 39417119157): la IA declaró 10.3 m y sus 2 renglones suman 17.52 m.
const compsCliente = [
  { nombre: 'Tapacanto PVC 2 mm perímetro cubierta', insumoId: 'tapacanto-pvc-2', forma: 'lineal', cantidad: 12.0, material_solicitado: 'tapacanto PVC 2 mm nogal', material_confirmado: true, ia_totales_declarados_m: [10.3] },
  { nombre: 'Tapacanto PVC 2 mm faldón', insumoId: 'tapacanto-pvc-2', forma: 'lineal', cantidad: 5.52, material_solicitado: 'tapacanto PVC 2 mm nogal', material_confirmado: true },
];

describe('SRV-01 · total declarado por la IA ≠ suma de renglones', () => {
  it('el DTO conserva la evidencia (no económica) y las revisiones aceptadas', () => {
    const v = validarIntentCosteo({ cantidad: 1, pieza: { componentes: compsCliente, revisiones_aceptadas: ['ia_total_incoherente:tapacanto-pvc-2'] } });
    expect(v.ok).toBe(true);
    expect(v.intent.pieza.componentes[0].ia_totales_declarados_m).toEqual([10.3]);
    expect(v.intent.pieza.revisiones_aceptadas).toEqual(['ia_total_incoherente:tapacanto-pvc-2']);
    expect(validarIntentCosteo({ cantidad: 1, pieza: { componentes: [{ ...compsCliente[0], ia_totales_declarados_m: ['x', -1] }] } }).intent.pieza.componentes[0].ia_totales_declarados_m).toBeUndefined();
  });
  it('cliente (con forma) y servidor (DTO sin forma, por unidad del insumo) dan la MISMA clave y el MISMO texto', () => {
    const cli = revisarEstructura({ componentes: compsCliente, insumos }).observaciones.filter((o) => o.regla === 'ia_incoherente');
    const srvComps = validarIntentCosteo({ cantidad: 1, pieza: { componentes: compsCliente } }).intent.pieza.componentes;
    expect(srvComps[0].forma).toBeUndefined();
    const srv = revisarEstructura({ componentes: srvComps, insumos }).observaciones.filter((o) => o.regla === 'ia_incoherente');
    expect(cli).toHaveLength(1);
    expect(srv.map((o) => [o.clave, o.mensaje])).toEqual(cli.map((o) => [o.clave, o.mensaje]));
    expect(cli[0].mensaje).toMatch(/10\.3 m.*suman 17\.52 m/);
  });
  it('si cuadra (−5 %…+15 %) no hay diagnóstico', () => {
    expect(totalesLinealesIncoherentes([{ ...compsCliente[0], ia_totales_declarados_m: [16.5] }, compsCliente[1]], insumos)).toEqual([]);
  });
});

// Servidor de verdad (costearConMotor) con una base falsa mínima: el diagnóstico sale como revisión pendiente y el
// estado nunca es 'certificado' hasta que alguien CON capability la marque como revisada.
function svcFalso() {
  const res = (data) => ({ data, error: null, count: 0 });
  const cadena = (data) => { const q = { select: () => q, eq: () => q, in: () => q, is: () => q, neq: () => q, single: async () => res(data), maybeSingle: async () => res(data), then: (f) => Promise.resolve(res(Array.isArray(data) ? data : [])).then(f) }; return q; };
  return {
    from: (t) => cadena(t === 'config' ? { datos: { insumos } } : []),
    rpc: async () => res(insumos),
  };
}
describe('SRV-01 · servidor autoritativo', () => {
  const pieza = validarIntentCosteo({ cantidad: 1, pieza: { componentes: compsCliente } }).intent.pieza;
  it('repite la revisión pendiente y topa el estado', async () => {
    const k = await costearConMotor(svcFalso(), pieza, 1, true);
    expect(k.revisionesPendientes.map((x) => x.clave)).toEqual(['ia_total_incoherente:tapacanto-pvc-2']);
    expect(k.estado).not.toBe('certificado');
    expect(k.warnings.some((w) => /Revisión pendiente: La IA declara un total de 10\.3 m/.test(w))).toBe(true);
  });
  it('revisada por Diseño/Dirección: deja de estar pendiente; un vendedor no puede marcarla', async () => {
    const revisada = { ...pieza, revisiones_aceptadas: ['ia_total_incoherente:tapacanto-pvc-2'] };
    expect((await costearConMotor(svcFalso(), revisada, 1, true)).revisionesPendientes).toEqual([]);
    expect((await costearConMotor(svcFalso(), revisada, 1, false)).revisionesPendientes).toHaveLength(1);
  });
});
