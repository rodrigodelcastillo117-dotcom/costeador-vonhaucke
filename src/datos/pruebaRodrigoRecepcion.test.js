// ============================================================================
//  Prueba de Rodrigo 2026-10-19 (cotización 3354). Plano: RECEPCIÓN con 1 puesto, OPERATIVA 16, privado, 2 salas.
//  Pedido por texto: 16 WIN para los puestos, 1 GAMMA-E para la recepción.
//   · El programa proponía 2 GAMMA-E (lugares del módulo) en vez de 1 (lo que dice el plano) → "18 sillas para 17 puestos".
//   · Para cubrir la 2ª, la conciliación quería PARTIR la fila de 16 WIN de los operativos → SPLIT_REQUIRED, que la pantalla
//     dibujaba como un conflicto de mostrador vacío ("—") con un "Sustituir" que no hacía nada.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { proponerProgramaDelPlano } from './programaRealDelPlano.js';
import { confirmarPrograma } from './confirmarPrograma.js';

const areas = [
  { nombre: 'OFICINA DIRECCIÓN', tipo: 'privado', x: 0, y: 0, ancho: 5, largo: 5, puestos: 1 },
  { nombre: 'OPERATIVA', tipo: 'open', x: 0, y: 7, ancho: 12, largo: 7, puestos: 16 },
  { nombre: 'RECEPCIÓN', tipo: 'recepcion', x: 12, y: 7, ancho: 6, largo: 7, puestos: 1 },
];
const existentes = [
  { id: 'win', nombre: 'Silla operativa · WIN', piezaId: 'p9-silla-operativa-win-5210', cantidad: 16, precioUnitario: 5210, nota: 'Modelo indicado por el cliente.' },
  { id: 'gam', nombre: 'Silla operativa · GAMMA-E', piezaId: 'p9-silla-operativa-gamma-e-3990', cantidad: 1, precioUnitario: 3990,
    nota: '1 silla para quien atiende la recepción.', relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_RECEPTION', zone_id: 'RECEPCIÓN' },
];

describe('recepción del plano: sillas = puestos del plano; no se toman las de los operativos', () => {
  it('el programa propone tantas sillas de recepción como puestos tiene la recepción en el plano (1)', () => {
    const r = proponerProgramaDelPlano(areas, { linea: 'App LT' });
    const sillasRec = r.propuesta.partidas.filter((p) => p.relation_role === 'WORK_SEAT' && p.anchor_role === 'ANCHOR_RECEPTION');
    expect(sillasRec.reduce((s, p) => s + p.cantidad, 0)).toBe(1);
  });
  it('con la GAMMA-E de recepción ya cotizada: la recepción no pide repartir nada ni agrega sillas', () => {
    const r = proponerProgramaDelPlano(areas, { linea: 'App LT' });
    expect(r.propuesta.partidas.length).toBeGreaterThan(0);
    const c = confirmarPrograma(r.propuesta, { existentes });
    expect(c.conflictos.filter((x) => x.code === 'SPLIT_REQUIRED' && x.anchor_role === 'ANCHOR_RECEPTION')).toEqual([]);
    expect(c.confirmadas.filter((p) => p.relation_role === 'WORK_SEAT' && p.anchor_role === 'ANCHOR_RECEPTION')).toEqual([]);
    // Las 16 WIN de un solo renglón para los bancos operativos: se pide la decisión (nunca se parte sola)…
    const split = c.conflictos.filter((x) => x.code === 'SPLIT_REQUIRED');
    expect(split.every((x) => x.fila_id === 'win')).toBe(true);
    // …y con "Repartir" queda todo cubierto: sin conflictos y sin ninguna silla operativa nueva (16 + 1 = 17 puestos).
    const d = confirmarPrograma(r.propuesta, { existentes, repartir: ['win'] });
    expect(d.conflictos.filter((x) => x.code === 'SPLIT_REQUIRED')).toEqual([]);
    expect(d.confirmadas.filter((p) => p.relation_role === 'WORK_SEAT')).toEqual([]);
    // La decisión se guarda en el renglón: con el patch aplicado, releer el plano ya no vuelve a preguntar.
    const patch = d.enriquecidos.find((e) => e.id === 'win').patch;
    const guardados = existentes.map((e) => (e.id === 'win' ? { ...e, ...patch } : e));
    const otra = confirmarPrograma(r.propuesta, { existentes: guardados });
    expect(otra.conflictos.filter((x) => x.code === 'SPLIT_REQUIRED')).toEqual([]);
    expect(otra.confirmadas.filter((p) => p.relation_role === 'WORK_SEAT')).toEqual([]);
  });
});

describe('recepción que eligió la persona: conserva SU huella al vincularse al plano', () => {
  it('Ergonova 4 (1815 × 834 del catálogo) no hereda los 2420 mm del mostrador propuesto', () => {
    const r = proponerProgramaDelPlano(areas, { linea: 'App LT' });
    const ergo = { id: 'ergo', piezaId: 'p9-ergonova-4-recepcion-16585', nombre: 'Ergonova 4 · Recepción', cantidad: 1, precioUnitario: 16585 };
    const c = confirmarPrograma(r.propuesta, { existentes: [ergo] });
    const patch = c.enriquecidos.find((e) => e.id === 'ergo')?.patch;
    expect(patch).toBeTruthy();
    expect(patch.relation_role).toBe('ANCHOR_RECEPTION');
    expect(patch.w).toBeUndefined();
    expect(patch.d).toBeUndefined();
  });
  it('un mostrador sin ninguna medida propia sí toma la del programa (para no quedar con huella supuesta)', () => {
    const r = proponerProgramaDelPlano(areas, { linea: 'App LT' });
    const sinMedida = { id: 'm', nombre: 'Mostrador de recepción a la medida', cantidad: 1 };
    const c = confirmarPrograma(r.propuesta, { existentes: [sinMedida] });
    const patch = c.enriquecidos.find((e) => e.id === 'm')?.patch;
    expect(patch?.w).toBeGreaterThan(0);
  });
});

// Lab de recorridos (C1, run 39365994346): la Ergonova 4 (ficha: 1 usuario) heredaba "2 usuarios" del módulo de
// recepción propuesto → el acomodo le sentaba 2 sillas en una recepción de 1 puesto.
describe('la recepción que eligió la persona conserva la capacidad de SU ficha', () => {
  it('Ergonova 4 (usuarios 1 en el banco) no hereda los 2 usuarios del módulo propuesto', () => {
    const r = proponerProgramaDelPlano(areas, { linea: 'App LT' });
    const ergo = { id: 'ergo', piezaId: 'p9-ergonova-4-recepcion-16585', nombre: 'Ergonova 4 · Recepción', cantidad: 1 };
    const patch = confirmarPrograma(r.propuesta, { existentes: [ergo] }).enriquecidos.find((e) => e.id === 'ergo').patch;
    expect(patch.user_capacity).toBe(1);
  });
});
