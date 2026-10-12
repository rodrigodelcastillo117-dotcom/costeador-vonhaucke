import { describe, it, expect } from 'vitest';
import { resolverPrograma } from './resolverPrograma.js';
import { confirmarPrograma } from './confirmarPrograma.js';

// Propuesta comercial APP LT 10 CON gavetas pedidas (brief) → 3 slots:
// bench + 10 WORK_SEAT + 10 UNDERDESK_STORAGE.
const prop10 = () => resolverPrograma({ operativos: 10, brief: { operativosStorage: true } }, { linea: 'App LT' });

describe('confirmarPrograma · Propuesta → Confirmación (P0.1 · #3/#4)', () => {
  it('confirma una propuesta nueva: todas nuevas, reales, sin sug-*', () => {
    const r = confirmarPrograma(prop10(), { existentes: [] });
    expect(r.confirmadas.length).toBe(3);         // bench + sillas + gavetas
    expect(r.sinCambio).toHaveLength(0);
    expect(r.conflictos).toHaveLength(0);
    expect(r.resumen.productosReales).toBe(true);
    expect(r.resumen.identidadesValidas).toBe(true);
    expect(r.items.every((it) => it.source === 'CONFIRMADO_PROGRAMA')).toBe(true);
    expect(r.items.every((it) => !String(it.bancoId).startsWith('sug-'))).toBe(true);
  });

  it('cada confirmada trae identidad aplanada (producto_id + version) y precio display', () => {
    const r = confirmarPrograma(prop10(), { existentes: [] });
    const ancla = r.items.find((i) => i.relation_role === 'ANCHOR_WORKSTATION');
    expect(ancla.bancoId).toBe('op-10u-6000x1200-cristal');
    expect(ancla.productoId).toBeTruthy();
    expect(ancla.producto_version_id).toBeTruthy();
    expect(ancla.precio_lista_snapshot).toBe(28540);
    expect(ancla.autoridad).toBe('SERVIDOR');
  });

  it('MUTACIÓN #3: aplicar el MISMO programa dos veces NO duplica', () => {
    const primera = confirmarPrograma(prop10(), { existentes: [] });
    const segunda = confirmarPrograma(prop10(), { existentes: primera.items });
    expect(segunda.confirmadas).toHaveLength(0);
    expect(segunda.resumen.reutilizadas).toBe(primera.items.length);
    expect(segunda.items.length).toBe(primera.items.length);
    const tercera = confirmarPrograma(prop10(), { existentes: segunda.items });
    expect(tercera.items.length).toBe(primera.items.length);
  });

  it('RECONCILIA (#4): si el 10U ya existe, se reutiliza en vez de duplicar', () => {
    const base = confirmarPrograma(prop10(), { existentes: [] });
    const soloAncla = base.items.filter((i) => i.relation_role === 'ANCHOR_WORKSTATION');
    const r = confirmarPrograma(prop10(), { existentes: soloAncla });
    const anclas = r.items.filter((i) => i.relation_role === 'ANCHOR_WORKSTATION'
      && i.bancoId === 'op-10u-6000x1200-cristal');
    expect(anclas).toHaveLength(1);
    expect(r.sinCambio.some((i) => i.relation_role === 'ANCHOR_WORKSTATION')).toBe(true);
  });

  it('CONFLICTO (#4): slot ocupado por otro producto → marca conflicto, NO sustituye', () => {
    // Existente con el MISMO slot estructural del ancla operativa (relation_role),
    // pero otro producto (12U).
    // VH-090: el conflicto es PROGRAMA-vs-PROGRAMA (source CONFIRMADO_PROGRAMA). Una fila que
    // eligió una persona en el mismo slot se REUTILIZA (ver pruebas VH-090 abajo).
    const existente12 = [{
      rol: 'operativo', relation_role: 'ANCHOR_WORKSTATION', anchor_instance_id: null,
      bancoId: 'op-12u-7200x1200-cristal', nombre: 'APP LT 12U', cantidad: 1, source: 'CONFIRMADO_PROGRAMA',
    }];
    const r = confirmarPrograma(prop10(), { existentes: existente12 });
    const conf = r.conflictos.find((c) => c.code === 'SLOT_OCUPADO_PRODUCTO_DISTINTO');
    expect(conf).toBeTruthy();
    expect(conf.existente.bancoId).toBe('op-12u-7200x1200-cristal');
    expect(conf.propuesto.bancoId).toBe('op-10u-6000x1200-cristal');
    expect(r.items.some((i) => i.bancoId === 'op-12u-7200x1200-cristal')).toBe(true);
    expect(r.items.some((i) => i.bancoId === 'op-10u-6000x1200-cristal')).toBe(false);
  });

  it('#8/#18 MULTI-GRUPO: dos anclas (A 10, B 8) enriquecen cada WIN a SU ancla, sin cross-link', () => {
    const bench = (iid, banco) => ({ rol: 'operativo', relation_role: 'ANCHOR_WORKSTATION', bancoId: banco, instance_id: iid, functional_group_id: `fg-${iid}`, requirement_id: `req-${iid}`, cantidad: 1, nombre: banco, w: 6000, d: 1200, precio_lista_snapshot: 28540, product_status: 'RESOLVED', identity_status: 'RESOLVED', price_status: 'SNAPSHOT_DISPLAY' });
    const seat = (iid, n) => ({ rol: 'operativo', relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_WORKSTATION', bancoId: 'silla-win', anchor_instance_id: iid, functional_group_id: `fg-${iid}`, cantidad: n, nombre: 'WIN', precio_lista_snapshot: 5210, product_status: 'RESOLVED', identity_status: 'RESOLVED', price_status: 'SNAPSHOT_DISPLAY' });
    const propuesta = { partidas: [bench('A', 'op-10u-6000x1200-cristal'), bench('B', 'op-8u-4800x1200-cristal'), seat('A', 10), seat('B', 8)] };
    const existentes = [
      { id: 'w1', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 10 },
      { id: 'w2', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 8 },
    ];
    const r = confirmarPrograma(propuesta, { existentes });
    expect(r.conflictos).toHaveLength(0);
    expect(r.enriquecidos.find((e) => e.id === 'w1').patch.anchor_instance_id).toBe('A');
    expect(r.enriquecidos.find((e) => e.id === 'w2').patch.anchor_instance_id).toBe('B');
    expect(r.confirmadas.filter((i) => i.relation_role === 'WORK_SEAT')).toHaveLength(0);
    expect(r.confirmadas.filter((i) => i.relation_role === 'ANCHOR_WORKSTATION')).toHaveLength(2);
  });

  it('#8/#18 ORDEN INDEPENDIENTE: deps B,A casan por tamaño exacto (10→A, 8→B)', () => {
    const bench = (iid, banco) => ({ rol: 'operativo', relation_role: 'ANCHOR_WORKSTATION', bancoId: banco, instance_id: iid, cantidad: 1, nombre: banco, w: 6000, d: 1200, precio_lista_snapshot: 1, product_status: 'RESOLVED', identity_status: 'RESOLVED', price_status: 'SNAPSHOT_DISPLAY' });
    const seat = (iid, n) => ({ rol: 'operativo', relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_WORKSTATION', bancoId: 'silla-win', anchor_instance_id: iid, cantidad: n, nombre: 'WIN', precio_lista_snapshot: 1, product_status: 'RESOLVED', identity_status: 'RESOLVED', price_status: 'SNAPSHOT_DISPLAY' });
    const propuesta = { partidas: [bench('B', 'op-8u-4800x1200-cristal'), bench('A', 'op-10u-6000x1200-cristal'), seat('B', 8), seat('A', 10)] };
    const existentes = [
      { id: 'w1', piezaId: 'silla-win', nombre: 'WIN', cantidad: 10 },
      { id: 'w2', piezaId: 'silla-win', nombre: 'WIN', cantidad: 8 },
    ];
    const r = confirmarPrograma(propuesta, { existentes });
    expect(r.conflictos).toHaveLength(0);
    expect(r.enriquecidos.find((e) => e.id === 'w1').patch.anchor_instance_id).toBe('A');
    expect(r.enriquecidos.find((e) => e.id === 'w2').patch.anchor_instance_id).toBe('B');
  });

  it('#8 SPLIT: una fila de 18 WIN para dos anclas → SPLIT_REQUIRED, sin cross-link silencioso', () => {
    const bench = (iid, banco) => ({ rol: 'operativo', relation_role: 'ANCHOR_WORKSTATION', bancoId: banco, instance_id: iid, cantidad: 1, nombre: banco, w: 6000, d: 1200, precio_lista_snapshot: 1, product_status: 'RESOLVED', identity_status: 'RESOLVED', price_status: 'SNAPSHOT_DISPLAY' });
    const seat = (iid, n) => ({ rol: 'operativo', relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_WORKSTATION', bancoId: 'silla-win', anchor_instance_id: iid, cantidad: n, nombre: 'WIN', precio_lista_snapshot: 1, product_status: 'RESOLVED', identity_status: 'RESOLVED', price_status: 'SNAPSHOT_DISPLAY' });
    const propuesta = { partidas: [bench('A', 'op-10u-6000x1200-cristal'), bench('B', 'op-8u-4800x1200-cristal'), seat('A', 10), seat('B', 8)] };
    const existentes = [{ id: 'w18', piezaId: 'silla-win', nombre: 'WIN', cantidad: 18 }];
    const r = confirmarPrograma(propuesta, { existentes });
    expect(r.conflictos.some((c) => c.code === 'SPLIT_REQUIRED')).toBe(true);
    expect(r.enriquecidos.some((e) => e.id === 'w18')).toBe(false);
  });

  it('conserva intactas las partidas existentes que el programa no toca', () => {
    const ajeno = [{ rol: 'otro', bancoId: 'gabinete-x', nombre: 'mueble ajeno', cantidad: 1 }];
    const r = confirmarPrograma(prop10(), { existentes: ajeno });
    expect(r.items.some((i) => i.bancoId === 'gabinete-x')).toBe(true);
    expect(r.confirmadas.length).toBe(3);
  });

  it('#15 CASO RODRIGO (schema real): ya hay 10 WIN + 10 gavetas sin bench → reutiliza y añade SÓLO el ancla', () => {
    // Schema real de cotizacion.partidas: piezaId + nombre, SIN relation_role.
    const existentes = [
      { id: 'p-win', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 10, precioUnitario: 5210 },
      { id: 'p-gav', piezaId: 'gaveta-mox', nombre: 'Mox · Gaveta pedestal', cantidad: 10, precioUnitario: 3470 },
    ];
    const r = confirmarPrograma(prop10(), { existentes });
    // reutiliza las 10 WIN y 10 gavetas (no duplica)
    const win = r.items.filter((i) => i.bancoId === 'silla-win').reduce((s, i) => s + i.cantidad, 0);
    const gav = r.items.filter((i) => i.bancoId === 'gaveta-mox').reduce((s, i) => s + i.cantidad, 0);
    expect(win).toBe(10);
    expect(gav).toBe(10);
    // añade exactamente el ANCLA faltante (bench 10U)
    const bench = r.items.filter((i) => i.bancoId === 'op-10u-6000x1200-cristal');
    expect(bench).toHaveLength(1);
    expect(r.confirmadas.filter((i) => i.relation_role === 'ANCHOR_WORKSTATION')).toHaveLength(1);
    // las sillas/gavetas NO se agregan de nuevo (reutilizadas, no confirmadas)
    expect(r.confirmadas.some((i) => i.bancoId === 'silla-win')).toBe(false);
    expect(r.confirmadas.some((i) => i.bancoId === 'gaveta-mox')).toBe(false);
  });

  it('#15 idempotente sobre schema real: re-aplicar no vuelve a duplicar', () => {
    const existentes = [
      { id: 'p-win', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 10 },
      { id: 'p-gav', piezaId: 'gaveta-mox', nombre: 'Mox · Gaveta pedestal', cantidad: 10 },
    ];
    const a1 = confirmarPrograma(prop10(), { existentes });
    const a2 = confirmarPrograma(prop10(), { existentes: a1.items });
    const win = a2.items.filter((i) => i.bancoId === 'silla-win').reduce((s, i) => s + i.cantidad, 0);
    const bench = a2.items.filter((i) => i.bancoId === 'op-10u-6000x1200-cristal');
    expect(win).toBe(10);
    expect(bench).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
//  VH-090 (2026-10-12, cotización 757 real): VONI-texto y el programa del plano
//  describían el MISMO mobiliario con ids distintos y la app los duplicaba (18
//  sillas para 10 puestos; dos mesas de juntas; botón "Aplicar" muerto).
// ---------------------------------------------------------------------------
describe('VH-090 · lo que describió una persona manda sobre el producto genérico del programa', () => {
  const texto = () => ([
    { id: 'p-1', nombre: 'Banca doble APP LT 1.50 · 10 usuarios · ocupa 7.50 × 1.50 m', piezaId: 'linea-banca_doble', productoId: 'banca_doble', cantidad: 1, precioUnitario: 26145, origen: 'ia', w: 7500, d: 1500 },
    { id: 'p-2', nombre: 'Silla operativa · WIN', piezaId: 'p9-silla-operativa-win-5210', cantidad: 10, precioUnitario: 5210, origen: 'banco' },
    { id: 'p-3', nombre: 'Mox · Gaveta pedestal 3 cajones · frentes melamina', piezaId: 'linea-pedestal', productoId: 'pedestal', cantidad: 10, precioUnitario: 2189, origen: 'ia' },
  ]);

  it('ancla del usuario en el slot del programa: se REUTILIZA y se enriquece; cero conflictos, cero duplicados', () => {
    const r = confirmarPrograma(prop10(), { existentes: texto() });
    expect(r.conflictos).toHaveLength(0);
    const anclas = r.items.filter((i) => i.relation_role === 'ANCHOR_WORKSTATION');
    expect(anclas).toHaveLength(1);
    expect(anclas[0].bancoId).toBe('linea-banca_doble');        // el producto que eligió la persona
    const patch = r.enriquecidos.find((e) => e.id === 'p-1');
    expect(patch).toBeTruthy();
    expect(patch.patch.relation_role).toBe('ANCHOR_WORKSTATION');
    expect(patch.patch.instance_id).toBeTruthy();
    expect(patch.patch.functional_group_id).toBeTruthy();
    expect(r.sinCambio.some((i) => i.estado === 'EXISTENTE_EQUIVALENTE')).toBe(true);
  });

  it('dependientes del usuario (WIN ×10, gavetas ×10): se consumen por ROL, no se agregan de nuevo', () => {
    const r = confirmarPrograma(prop10(), { existentes: texto() });
    expect(r.confirmadas).toHaveLength(0);                        // nada nuevo que agregar
    expect(r.items.filter((i) => i.relation_role === 'WORK_SEAT')).toHaveLength(1);
    expect(r.items.filter((i) => i.relation_role === 'UNDERDESK_STORAGE')).toHaveLength(1);
    const sillas = r.enriquecidos.find((e) => e.id === 'p-2');
    expect(sillas.patch.anchor_instance_id).toBeTruthy();         // ya apuntan al ancla
  });

  it('otro MODELO de silla con el mismo rol (SONATA por CONCERTO de juntas) también cubre el requerimiento', () => {
    const prop = resolverPrograma({ salas: [4] }, { linea: 'App LT' });
    const existentes = [
      { id: 'm-1', nombre: 'Mesa de juntas APP LT 1.20 × 1.20', piezaId: 'linea-mesa_juntas', productoId: 'mesa_juntas', cantidad: 1, precioUnitario: 8214, origen: 'ia', w: 1200, d: 1200 },
      { id: 's-1', nombre: 'Silla · SONATA', piezaId: 'p9-silla-sonata-2420-144', cantidad: 4, precioUnitario: 2420, origen: 'banco' },
    ];
    const r = confirmarPrograma(prop, { existentes });
    expect(r.conflictos).toHaveLength(0);
    expect(r.confirmadas).toHaveLength(0);
    expect(r.items.filter((i) => i.relation_role === 'ANCHOR_MEETING')).toHaveLength(1);
    expect(r.items.filter((i) => i.relation_role === 'MEETING_SEAT')).toHaveLength(1);
  });

  it('VH-091: programa-vs-programa sigue siendo conflicto, pero `sustituir` lo resuelve por decisión explícita', () => {
    const base = confirmarPrograma(resolverPrograma({ salas: [4] }, { linea: 'App LT' }), { existentes: [] });
    const conId = base.items.map((it, i) => ({ ...it, id: `prog-${i}` }));
    const prop10p = resolverPrograma({ salas: [10] }, { linea: 'App LT' });
    const r1 = confirmarPrograma(prop10p, { existentes: conId });
    const conf = r1.conflictos.find((c) => c.code === 'SLOT_OCUPADO_PRODUCTO_DISTINTO');
    expect(conf).toBeTruthy();
    expect(conf.existente.id).toBeTruthy();
    const r2 = confirmarPrograma(prop10p, { existentes: conId, sustituir: [conf.slot] });
    expect(r2.conflictos).toHaveLength(0);
    expect(r2.reemplazados).toContain(conf.existente.id);
    const mesas = r2.items.filter((i) => i.relation_role === 'ANCHOR_MEETING');
    expect(mesas).toHaveLength(1);
    expect(mesas[0].bancoId).not.toBe(conf.existente.bancoId);
  });
});
