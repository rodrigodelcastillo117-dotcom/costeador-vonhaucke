// ============================================================================
//  Cotizar · emisión autoritativa fail-closed (comportamiento, 2026-10-14).
//  Antes: buscaba `if (estadoGate !== 'ALLOWED')` y `definitivo: false` en el TEXTO de Cotizacion.jsx.
//  Ahora ejecuta resolverModoDocumento (datos/modoDocumento.js, la que usa Cotizacion) con gates
//  DESCONOCIDO / excepción / null / BLOCKED / APPROVAL_REQUIRED / ALLOWED y registros de revisión fallidos.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { resolverModoDocumento } from '../datos/modoDocumento.js';
import { precioConDescuento, importePorCantidad, cargoPorcentaje, sumarMontos } from '../motor/comercialDinero.js';

const OK_REG = async () => ({ ok: true, revision: 4, nueva: true });
const modo = (extra = {}) => resolverModoDocumento({ probEmision: [], bloqueoExcluidas: false, partidas: [{ id: 'p1' }], ...extra });

describe('Cotizar · emisión autoritativa fail-closed', () => {
  it('DESCONOCIDO (o gate que falla/lanza/no responde) nunca da documento definitivo; degrada a borrador', async () => {
    const gates = [
      async () => ({ ok: false, estado: 'DESCONOCIDO', motivos: [] }),
      async () => { throw new Error('rpc caído'); },
      async () => null,
      async () => ({ ok: true }),                                   // sin estado ⇒ DESCONOCIDO
    ];
    for (const verificarEmision of gates) {
      const onEmitida = vi.fn(OK_REG);
      const ui = { cargando: vi.fn(), gate: vi.fn(), verPorque: vi.fn() };
      const m = await modo({ verificarEmision, onEmitida, ui });
      expect(m.definitivo).toBe(false);
      expect(m.motivo).toBe('No se pudo verificar la emisión');
      expect(onEmitida).not.toHaveBeenCalled();                     // no se registra revisión
      expect(ui.cargando.mock.calls).toEqual([[true], [false]]);
      expect(ui.verPorque).toHaveBeenCalledTimes(1);
    }
  });

  it('BLOCKED / APPROVAL_REQUIRED / ECONOMICS_INCOMPLETE ⇒ borrador con el motivo del gate', async () => {
    for (const [estado, titulo] of [['BLOCKED', 'No se puede emitir todavía'], ['APPROVAL_REQUIRED', 'Requiere aprobación de Dirección antes de emitir'], ['ECONOMICS_INCOMPLETE', 'Faltan datos para cotizar']]) {
      const onEmitida = vi.fn(OK_REG);
      const m = await modo({ verificarEmision: async () => ({ estado }), onEmitida });
      expect(m.definitivo, estado).toBe(false);
      expect(m.motivo).toContain(titulo);
      expect(onEmitida).not.toHaveBeenCalled();
    }
  });

  it('problemas locales (renglón, excluidas, candado de proyecto) ⇒ borrador SIN consultar al servidor', async () => {
    for (const extra of [{ probEmision: ['Línea 2 sin precio'] }, { bloqueoExcluidas: true }, { partidas: [{ id: 'p', candadoUsuarios: true }] }, { partidas: [{ id: 'p', requiereProyectista: true }] }]) {
      const verificarEmision = vi.fn(async () => ({ estado: 'ALLOWED' }));
      const onEmitida = vi.fn(OK_REG);
      const m = await modo({ verificarEmision, onEmitida, ...extra });
      expect(m.definitivo).toBe(false);
      expect(m.gate).toBeNull();
      expect(verificarEmision).not.toHaveBeenCalled();
      expect(onEmitida).not.toHaveBeenCalled();
    }
  });

  it('PDF definitivo exige ALLOWED + revisión inmutable registrada; si no, el borrador sigue disponible', async () => {
    const allowed = async () => ({ estado: 'ALLOWED' });
    const bien = await modo({ verificarEmision: allowed, onEmitida: OK_REG });
    expect(bien).toEqual({ definitivo: true, motivo: '', gate: { estado: 'ALLOWED' } });
    const sinRegistro = await modo({ verificarEmision: allowed, onEmitida: null });
    expect(sinRegistro).toMatchObject({ definitivo: false, motivo: 'No se pudo conservar la revisión inmutable.' });
    const fallo = await modo({ verificarEmision: allowed, onEmitida: async () => ({ ok: false, motivo: 'no-se-guardo-estado-vivo' }) });
    expect(fallo).toMatchObject({ definitivo: false, motivo: 'No se pudo conservar la revisión inmutable.' });
    const aprob = await modo({ verificarEmision: allowed, onEmitida: async () => ({ ok: false, motivo: 'emitir_revision_v2: aprobación de Dirección no vigente' }) });
    expect(aprob).toMatchObject({ definitivo: false, motivo: 'Requiere aprobación de Dirección.' });
    const nulo = await modo({ verificarEmision: allowed, onEmitida: async () => null });
    expect(nulo.definitivo).toBe(false);
  });

  it('dinero comercial canónico a centavos (las funciones que importa la Edge cotizar-servidor)', () => {
    // Al peso entero (lo que la guarda vieja prohibía por texto) daría 1142 / 183 / 1325: aquí se exigen centavos.
    const pf = precioConDescuento(1234.56, 7.5);
    expect(pf).toBe(1141.97);
    expect(Math.round(1234.56 * (1 - 7.5 / 100))).not.toBe(pf);
    const imp = importePorCantidad(pf, 3);
    expect(imp).toBe(3425.91);
    const iva = cargoPorcentaje(imp, 16);
    expect(iva).toBe(548.15);
    expect(sumarMontos([imp, iva])).toBe(3974.06);
    expect(precioConDescuento(NaN, 5)).toBeNull();               // nunca $0
    expect(importePorCantidad(100, 0)).toBeNull();
  });

  // STATIC GUARD: la Edge cotizar-servidor es Deno (imports jsr:, Deno.serve) y no se ejecuta en vitest/node.
  // Su aritmética está probada arriba EJECUTANDO las mismas funciones que importa por ruta relativa; aquí sólo se
  // verifica que siga importándolas de src/motor/comercialDinero.js y no reintroduzca redondeo al peso.
  it('cableado Edge: cotizar-servidor usa el dinero canónico probado', () => {
    const edge = fs.readFileSync('supabase/functions/cotizar-servidor/index.ts', 'utf8');
    expect(edge).toContain('from "../../../src/motor/comercialDinero.js"');
    expect(edge).toContain('precioConDescuento(precio_lista, descuento)');
    expect(edge).toContain('importePorCantidad(precio_final, cantidad)');
    expect(edge).toContain('cargoPorcentaje(baseIva, ivaPct)');
    expect(edge).not.toMatch(/Math\.round\(precio_lista|Math\.round\(baseIva/);
  });

  // STATIC GUARD: Cotizacion.jsx no se monta en node (sin jsdom). Sólo el CABLEADO de la lógica probada al PDF.
  it('cableado UI: el PDF sale como borrador cuando el modo no es definitivo', () => {
    const fuente = fs.readFileSync('src/componentes/Cotizacion.jsx', 'utf8');
    expect(fuente).toContain('return resolverModoDocumentoPuro({');
    expect(fuente).toContain('borrador: !modo.definitivo');
    expect(fuente).toContain('Descargar BORRADOR');
  });
});
