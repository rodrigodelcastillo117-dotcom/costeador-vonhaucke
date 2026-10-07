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
    const existente12 = [{
      rol: 'operativo', relation_role: 'ANCHOR_WORKSTATION', anchor_instance_id: null,
      bancoId: 'op-12u-7200x1200-cristal', nombre: 'APP LT 12U', cantidad: 1,
    }];
    const r = confirmarPrograma(prop10(), { existentes: existente12 });
    const conf = r.conflictos.find((c) => c.code === 'SLOT_OCUPADO_PRODUCTO_DISTINTO');
    expect(conf).toBeTruthy();
    expect(conf.existente.bancoId).toBe('op-12u-7200x1200-cristal');
    expect(conf.propuesto.bancoId).toBe('op-10u-6000x1200-cristal');
    expect(r.items.some((i) => i.bancoId === 'op-12u-7200x1200-cristal')).toBe(true);
    expect(r.items.some((i) => i.bancoId === 'op-10u-6000x1200-cristal')).toBe(false);
  });

  it('conserva intactas las partidas existentes que el programa no toca', () => {
    const ajeno = [{ rol: 'otro', bancoId: 'gabinete-x', nombre: 'mueble ajeno', cantidad: 1 }];
    const r = confirmarPrograma(prop10(), { existentes: ajeno });
    expect(r.items.some((i) => i.bancoId === 'gabinete-x')).toBe(true);
    expect(r.confirmadas.length).toBe(3);
  });
});
