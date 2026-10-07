import { describe, it, expect } from 'vitest';
import { resolverPrograma } from './resolverPrograma.js';
import { aplicarPrograma, partidaComercialDesdeConfirmado } from './programaRealDelPlano.js';

const brief10 = { operativos: 10, brief: { operativosStorage: true, operativoSeatModel: 'win' } };

describe('adapter comercial (#5): la semántica estructural sobrevive a cotizacion.partidas', () => {
  const prop = resolverPrograma(brief10, { linea: 'App LT' });
  const conf = aplicarPrograma(prop, { existentes: [] }).confirmacion;
  const bench = conf.confirmadas.find((i) => i.relation_role === 'ANCHOR_WORKSTATION');
  const p = partidaComercialDesdeConfirmado(bench);

  it('conserva TOP-LEVEL (no escondido en config): identidad + roles + compuertas', () => {
    expect(p.bancoId).toBe('op-10u-6000x1200-cristal');
    expect(p.source_ref).toBe('op-10u-6000x1200-cristal');
    expect(p.productoId).toBeTruthy();
    expect(p.producto_version_id).toBeTruthy();
    expect(p.relation_role).toBe('ANCHOR_WORKSTATION');
    expect(p.instance_id).toBeTruthy();
    expect(p.functional_group_id).toBeTruthy();
    expect(p.requirement_id).toBeTruthy();
    expect(p.product_status).toBe('RESOLVED');
    expect(p.identity_status).toBe('RESOLVED');
    expect(p.price_status).toBe('SNAPSHOT_DISPLAY');
    expect(p.w).toBe(6000); expect(p.d).toBe(1200); expect(p.usuarios).toBe(10);
  });

  it('un dependiente conserva anchor_instance_id top-level ligado a su ancla', () => {
    const seat = conf.confirmadas.find((i) => i.relation_role === 'WORK_SEAT');
    const ps = partidaComercialDesdeConfirmado(seat);
    expect(ps.relation_role).toBe('WORK_SEAT');
    expect(ps.anchor_role).toBe('ANCHOR_WORKSTATION');
    expect(ps.anchor_instance_id).toBe(bench.instance_id);
  });
});

describe('adapter comercial (#6): price authority nunca se contamina', () => {
  const prop = resolverPrograma(brief10, { linea: 'App LT' });
  const conf = aplicarPrograma(prop, { existentes: [] }).confirmacion;
  const p = partidaComercialDesdeConfirmado(conf.confirmadas.find((i) => i.relation_role === 'ANCHOR_WORKSTATION'));

  it('snapshot de DISPLAY, nunca firme, nunca $0, costo pendiente', () => {
    expect(p.precioUnitario).toBe(28540);            // display
    expect(p.precio_lista_snapshot).toBe(28540);
    expect(p.precioReal).toBe(false);                // NO firme
    expect(p.precioAutorizado).toBe(false);
    expect(p.sinPrecioAutorizado).toBe(true);
    expect(p.costoUnitario).toBeNull();              // sin costo inventado
    expect(p.costoPendiente).toBe(true);
    expect(p.margen).toBeNull();
  });

  it('precio desconocido → null, JAMÁS 0', () => {
    const sinPrecio = partidaComercialDesdeConfirmado({ bancoId: 'x', nombre: 'X', cantidad: 1, price_status: 'SIN_PRECIO', precio_lista_snapshot: null });
    expect(sinPrecio.precioUnitario).toBeNull();
    expect(sinPrecio.precioUnitario).not.toBe(0);
  });
});

describe('REGRESIÓN caso roto de Rodrigo (#11): cotización parcial, falta APP LT + privado', () => {
  const existentes = [
    { id: 'e1', piezaId: 'silla-win', nombre: 'Silla operativa WIN', cantidad: 10 },
    { id: 'e2', piezaId: 'gaveta-mox', nombre: 'Mox · Gaveta pedestal', cantidad: 10 },
    { id: 'e3', piezaId: 'silla-alpha', nombre: 'Silla directiva ALPHA', cantidad: 1 },
    { id: 'e4', piezaId: 'silla-concerto', nombre: 'Silla de visita CONCERTO', cantidad: 2 },
    { id: 'e5', piezaId: 'mj-1200x1200-melamina', nombre: 'Mesa de juntas', cantidad: 1 },
    { id: 'e6', piezaId: 'silla-sonata', nombre: 'Silla de juntas SONATA', cantidad: 4 },
    { id: 'e7', piezaId: 'rec-2420x830', nombre: 'Módulo recepción', cantidad: 1 },
    { id: 'e8', piezaId: 'arch-modulor-2p-900', nombre: 'Archivero Modulor', cantidad: 1 },
  ];

  const programa = {
    operativos: 10, privados: 1, salas: [4], recepcion: true,
    brief: {
      operativosStorage: true, operativoSeatModel: 'win',
      privados: [{ requested_models: { anchor: 'Eclipse Drift 2.10' } }],
      juntas: [{ requested_dimensions: { w: 1200, d: 1200 }, requested_models: { seat: 'sonata' } }],
    },
  };
  const prop = resolverPrograma(programa, { linea: 'App LT' });
  const { confirmacion } = aplicarPrograma(prop, { existentes });

  it('DELTA: añade SÓLO el APP LT faltante (6000×1200), no re-propone lo que ya existe', () => {
    const nuevas = confirmacion.confirmadas;
    const benches = nuevas.filter((i) => i.relation_role === 'ANCHOR_WORKSTATION');
    expect(benches).toHaveLength(1);
    expect(benches[0].bancoId).toBe('op-10u-6000x1200-cristal');
    expect(nuevas.some((i) => i.bancoId === 'silla-win')).toBe(false);
    expect(nuevas.some((i) => i.bancoId === 'gaveta-mox')).toBe(false);
  });

  it('NO duplica: WIN sigue en 10, gavetas en 10, archivero conservado', () => {
    const win = confirmacion.items.filter((i) => i.bancoId === 'silla-win').reduce((s, i) => s + i.cantidad, 0);
    const gav = confirmacion.items.filter((i) => i.bancoId === 'gaveta-mox').reduce((s, i) => s + i.cantidad, 0);
    expect(win).toBe(10);
    expect(gav).toBe(10);
    expect(confirmacion.items.some((i) => i.bancoId === 'arch-modulor-2p-900')).toBe(true);
  });

  it('privado Eclipse Drift → pendiente, NUNCA sustituido por dir-*', () => {
    expect(prop.pendientes.some((p) => p.rol === 'privado' && p.product_status === 'NEEDS_CONFIRMATION')).toBe(true);
    expect(confirmacion.items.some((i) => String(i.bancoId).startsWith('dir-'))).toBe(false);
    expect(confirmacion.confirmadas.some((i) => String(i.bancoId).startsWith('dir-'))).toBe(false);
  });

  it('juntas y recepción ya cubiertas se reutilizan (no se agregan de nuevo)', () => {
    expect(confirmacion.confirmadas.some((i) => i.bancoId === 'mj-1200x1200-melamina')).toBe(false);
    expect(confirmacion.confirmadas.some((i) => i.bancoId === 'rec-2420x830')).toBe(false);
    expect(confirmacion.items.filter((i) => i.bancoId === 'mj-1200x1200-melamina')).toHaveLength(1);
  });
});
