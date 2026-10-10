// COSTEAR §3 (2026-10-10): una partida de LÍNEA con despiece incompleto y precio de
// MODELO no recibe precio inventado; la partida sale PENDIENTE y la emisión se bloquea.
import { describe, it, expect } from 'vitest';
import { precioDePieza } from './lineas.js';
import { bloqueosDeEmision } from './senales.js';
import { PARAMETROS_DEFAULT } from '../motor/calculo.js';

const insumos = {
  tablero: { id: 'tablero', nombre: 'Tablero', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true, mermaCorte: 0 },
};
const estado = { insumos, parametros: { ...PARAMETROS_DEFAULT, margenObjetivo: 50 } };
const g = { nombre: 'Mueble de prueba', componentes: [
  { nombre: 'Cubierta', insumoId: 'tablero', largoMM: 1200, anchoMM: 600, piezas: 1 },
  { nombre: 'Canalización', insumoId: 'no-existe', cantidad: 1 },
] };
const pieza = { nombre: g.nombre, componentes: g.componentes, modoManoObra: 'porcentaje' };

describe('precioDePieza · fail-closed con despiece incompleto', () => {
  it('sin precio real y costeo incompleto ⇒ precio null, costo null, pendientes con nombre', () => {
    const pr = precioDePieza(estado, 'zzz-sin-catalogo', g, pieza, 1, {});
    expect(pr.estadoCosto).toBe('incompleto');
    expect(pr.precio).toBeNull();
    expect(pr.costo).toBeNull();
    expect(pr.precioPendiente).toBe(true);
    expect(pr.pendientes).toContain('Canalización');
  });

  it('con despiece completo ⇒ precio numérico > 0', () => {
    const g2 = { ...g, componentes: [g.componentes[0]] };
    const pr = precioDePieza(estado, 'zzz-sin-catalogo', g2, { ...pieza, componentes: g2.componentes }, 1, {});
    expect(pr.estadoCosto).toBe('completo');
    expect(pr.precio).toBeGreaterThan(0);
    expect(pr.precioPendiente).toBe(false);
  });

  it('la partida resultante bloquea la emisión (SIN_MATERIAL y PRECIO_INVALIDO), no se cuela en $0', () => {
    const pr = precioDePieza(estado, 'zzz-sin-catalogo', g, pieza, 1, {});
    const partida = { nombre: g.nombre, cantidad: 2, precioUnitario: pr.precio, piezasSinMaterial: pr.pendientes.length, nombresSinMaterial: pr.pendientes };
    const codes = bloqueosDeEmision([partida]).map((b) => b.code);
    expect(codes).toContain('PRECIO_INVALIDO');
    expect(codes).toContain('SIN_MATERIAL');
  });
});
