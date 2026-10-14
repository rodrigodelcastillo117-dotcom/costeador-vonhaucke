// ============================================================================
//  Costeo nuevo → cotización · AUTORIDAD AL CENTAVO (comportamiento, 2026-10-14).
//  Antes: buscaba el TEXTO `clienteC !== servidorC` en App.jsx. Ahora ejecuta la lógica real
//  (datos/agregarCosteo.js, la misma que llama onAgregarCotizacion) con un servidor simulado.
//  Mutaciones plantadas que esta prueba detecta (docs/auditoria/STATIC_GUARDS_A_COMPORTAMIENTO_20261014.md):
//  tolerar ±1 centavo, persistir el costo del navegador, saltarse el gate incompleto/bloqueado,
//  aceptar el costo si el servidor no responde.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { partidaAutoritativaDeCosteo } from './agregarCosteo.js';

const COSTEO = {
  nombre: 'Credenza nogal', piezaId: 'pz-1', ruta: null, productoId: null, w: 1800, d: 450, piezas: 3,
  componentes: [{ nombre: 'Cubierta' }, { nombre: 'Cristal', excluida: true }],
};
const servidor = (costoUnitario, extra = {}) => vi.fn(async () => ({
  ok: true, estado: 'certificado', warnings: [], costo: { costoUnitario },
  costeoId: 'cst-77', bomHash: 'bom-abc', versionMotor: 'alba-v1', versionCatalogo: 'cat-9', ...extra,
}));
const correr = (costoCliente, costearServidor, extra = {}) => partidaAutoritativaDeCosteo({
  costeo: COSTEO, resultado: { costoUnitario: costoCliente, componentesIgnorados: [] },
  precio: 9999.99, margen: 35, costearServidor, pendientes: () => [], nuevoId: () => 'p-nueva', ...extra,
});

describe('costeo nuevo → cotización · autoridad al centavo', () => {
  it('cliente y servidor iguales al centavo ⇒ la partida lleva el costo DEL SERVIDOR y su trazabilidad', async () => {
    const costearServidor = servidor(1234.56);
    const r = await correr(1234.56, costearServidor);
    expect(r.ok).toBe(true);
    expect(costearServidor).toHaveBeenCalledTimes(1);
    expect(costearServidor).toHaveBeenCalledWith(COSTEO, 3);             // recalcula con la cantidad real
    expect(r.partida).toMatchObject({
      id: 'p-nueva', nombre: 'Credenza nogal', cantidad: 3,
      costoUnitario: 1234.56, costoPendiente: false, costoEstado: 'certificado',
      costeoId: 'cst-77', bomHash: 'bom-abc', versionMotor: 'alba-v1', versionCatalogo: 'cat-9',
      precioUnitario: 9999.99, margen: 35, nombresExcluidos: ['Cristal'],
    });
    expect(r.costoUnitario).toBe(1234.56);
  });

  it('UN centavo de diferencia ⇒ no se agrega (fail-closed, sin tolerancia)', async () => {
    for (const [cli, srv] of [[1234.56, 1234.57], [1234.57, 1234.56], [0.01, 0.02]]) {
      const r = await correr(cli, servidor(srv));
      expect(r.ok, `${cli} vs ${srv}`).toBe(false);
      expect(r.partida).toBeUndefined();
      expect(r.error).toMatch(/difieren \$0\.01/);
    }
  });

  it('nunca persiste el número crudo del navegador: el costo guardado es dinero(servidor)', async () => {
    // Mismos centavos (123456) pero el cliente trae basura binaria; lo persistido es el costo del servidor a centavos.
    const r = await correr(1234.5600000001, servidor(1234.56));
    expect(r.ok).toBe(true);
    expect(r.partida.costoUnitario).toBe(1234.56);
    expect(Object.is(r.partida.costoUnitario, 1234.5600000001)).toBe(false);
  });

  it('el servidor marca incompleto o bloqueado ⇒ no se agrega y se dicen los motivos', async () => {
    for (const estado of ['incompleto', 'bloqueado']) {
      const r = await correr(500, servidor(500, { estado, warnings: ['Sin material o precio: MDF 18', 'b', 'c', 'd'] }));
      expect(r.ok).toBe(false);
      expect(r.error).toContain(`el servidor marca el costo como ${estado}`);
      expect(r.error).toContain('Sin material o precio: MDF 18');
      expect(r.error).not.toContain('d.');                 // sólo los 3 primeros motivos
    }
  });

  it('servidor caído o que rechaza ⇒ no se agrega (no se confía en el cálculo local)', async () => {
    const caido = await correr(500, vi.fn(async () => { throw new Error('fetch failed'); }));
    expect(caido).toMatchObject({ ok: false, avisoMs: 8000 });
    expect(caido.error).toContain('no pude verificar el costo con el servidor');
    const rechazo = await correr(500, vi.fn(async () => ({ ok: false, error: 'JWT expirado' })));
    expect(rechazo.ok).toBe(false);
    expect(rechazo.error).toBe('No se agregó: JWT expirado');
  });

  it('pendientes: usa los del cálculo del cliente; sólo si no vienen, los pide (perezoso)', async () => {
    const pendientes = vi.fn(() => ['Costado (sin material)']);
    const conLista = await partidaAutoritativaDeCosteo({
      costeo: COSTEO, resultado: { costoUnitario: 10, componentesIgnorados: ['Zoclo'] },
      precio: 20, margen: 30, costearServidor: servidor(10), pendientes, nuevoId: () => 'x',
    });
    expect(pendientes).not.toHaveBeenCalled();
    expect(conLista.partida).toMatchObject({ piezasSinMaterial: 1, nombresSinMaterial: ['Zoclo'] });
    const sinLista = await partidaAutoritativaDeCosteo({
      costeo: COSTEO, resultado: { costoUnitario: 10 },
      precio: 20, margen: 30, costearServidor: servidor(10), pendientes, nuevoId: () => 'x',
    });
    expect(pendientes).toHaveBeenCalledTimes(1);
    expect(sinLista.partida).toMatchObject({ piezasSinMaterial: 1, nombresSinMaterial: ['Costado (sin material)'] });
  });

  // STATIC GUARD: App.jsx no se puede montar en este entorno de pruebas (node, sin jsdom/testing-library).
  // La lógica está cubierta arriba por comportamiento; esto sólo verifica el CABLEADO: que onAgregarCotizacion
  // delega en partidaAutoritativaDeCosteo con el costearServidor real y que no conserva una ruta paralela.
  it('cableado: onAgregarCotizacion delega en la lógica probada', () => {
    const s = fs.readFileSync('src/App.jsx', 'utf8');
    const i = s.indexOf('async function onAgregarCotizacion');
    const b = s.slice(i, s.indexOf('function onGuardarPieza', i));
    expect(b).toContain('await partidaAutoritativaDeCosteo({');
    expect(b).toContain('costearServidor,');
    expect(b).toContain('sumarPartidas([r.partida])');
    expect(b.match(/sumarPartidas\(/g)).toHaveLength(1);  // la partida sólo la arma el módulo probado
  });
});
