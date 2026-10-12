import { describe, it, expect } from 'vitest';
import {
  resolverOperativos, resolverPrivado, resolverJuntas, resolverRecepcion,
  resolverPrograma, medidasAwd, componerOperativos,
} from './resolverPrograma.js';

const esReal = (p) => p && p.bancoId && !String(p.bancoId).startsWith('sug-')
  && p.product_status === 'RESOLVED' && p.source === 'RESUELTO';
const sumBy = (arr, rol) => arr.filter((d) => d.relation_role === rol).reduce((s, d) => s + (d.cantidad || 0), 0);

describe('resolverPrograma · Product Resolver real (P0.1)', () => {
  it('#102 GOLDEN: 10 operativos → módulo REAL 6000×1200, NUNCA 7500', () => {
    const { resoluciones, faltante } = resolverOperativos(10, { linea: 'App LT' });
    expect(faltante).toBe(0);
    expect(resoluciones).toHaveLength(1);
    const r = resoluciones[0];
    expect(r.bancoId).toBe('op-10u-6000x1200-cristal');
    expect(r.w).toBe(6000);
    expect(r.d).toBe(1200);
    expect(r.w).not.toBe(7500);
    expect(r.precio_lista_snapshot).toBe(28540);       // precio display (compuerta 3)
    expect(r.relation_role).toBe('ANCHOR_WORKSTATION'); // el ancla lleva el rol estructural
    expect(r.instance_id).toBeTruthy();                 // instancia única y estable
    expect(r.source).toBe('RESUELTO');
  });

  it('capacidades exactas del catálogo resuelven a un solo módulo real', () => {
    for (const n of [1, 2, 4, 6, 8, 12]) {
      const r = resolverOperativos(n).resoluciones;
      expect(r).toHaveLength(1);
      expect(r[0].usuarios).toBe(n);
      expect(Number(r[0].w)).toBeGreaterThan(0);
      expect(r[0].bancoId).toBeTruthy();
      expect(Number(r[0].precio_lista_snapshot)).toBeGreaterThan(0);
    }
  });

  it('composición determinista de capacidad NO exacta (5 = 4 + 1), sin inventar', () => {
    const { resoluciones, faltante } = resolverOperativos(5);
    expect(faltante).toBe(0);
    const total = resoluciones.reduce((s, r) => s + r.usuarios * r.cantidad, 0);
    expect(total).toBe(5);
    expect(resoluciones.every((r) => esReal(r) && r.precio_lista_snapshot > 0)).toBe(true);
  });

  it('7 usuarios se compone con módulos reales sumando exactamente 7', () => {
    const { resoluciones, faltante } = resolverOperativos(7);
    expect(faltante).toBe(0);
    expect(resoluciones.reduce((s, r) => s + r.usuarios * r.cantidad, 0)).toBe(7);
  });

  it('privado → escritorio directivo REAL (ancla ANCHOR_DESK)', () => {
    const r = resolverPrivado();
    expect(esReal(r)).toBe(true);
    expect(r.relation_role).toBe('ANCHOR_DESK');
    expect(r.w).toBeGreaterThan(0);
    expect(r.precio_lista_snapshot).toBeGreaterThan(0);
  });

  it('juntas: capacidad → mesa REAL que la cubre (producto real, no inventado)', () => {
    const m4 = resolverJuntas(4);
    expect(m4.usuarios).toBeGreaterThanOrEqual(4);
    expect(m4.bancoId).toBeTruthy();
    expect(m4.w).toBeGreaterThan(0);
    const m10 = resolverJuntas(10);
    expect(m10.usuarios).toBeGreaterThanOrEqual(10);
    expect(m10.w).toBeGreaterThan(0);
    expect(m10.precio_lista_snapshot).toBeGreaterThan(0);
    expect(m10.relation_role).toBe('ANCHOR_MEETING');
  });

  it('recepción → módulo recepción REAL', () => {
    const r = resolverRecepcion();
    expect(esReal(r)).toBe(true);
    expect(/recep/i.test(r.nombre)).toBe(true);
    expect(r.relation_role).toBe('ANCHOR_RECEPTION');
    expect(r.precio_lista_snapshot).toBeGreaterThan(0);
  });

  it('orquestador: programa completo → partidas comerciales REALES', () => {
    const prog = { operativos: 10, privados: 1, salas: [4], recepcion: true };
    const r = resolverPrograma(prog, { linea: 'App LT' });
    expect(r.ok).toBe(true);
    expect(r.productosReales).toBe(true);
    expect(r.identidadesValidas).toBe(true);
    expect(r.sinSugFantasma).toBe(true);
    expect(r.partidas.some((x) => x.w === 6000)).toBe(true);
    expect(r.partidas.every((x) => x.source === 'RESUELTO')).toBe(true);
    expect(r.partidas.every((x) => x.bancoId && Number(x.precio_lista_snapshot) > 0)).toBe(true);
  });

  it('medidasAwd parsea strings del banco', () => {
    expect(medidasAwd('6000 × 1200 mm')).toEqual({ w: 6000, d: 1200 });
    expect(medidasAwd('2420 × 830 mm')).toEqual({ w: 2420, d: 830 });
    expect(medidasAwd('Ø 600 × 398 mm')).toEqual({ w: 600, d: 398 });
    expect(medidasAwd('sin medida')).toBeNull();
  });

  it('nunca produce un id sug-* ni precio 0 en las partidas comerciales', () => {
    const r = resolverPrograma({ operativos: 7, privados: 2, salas: [6, 10], recepcion: true });
    expect(r.partidas.every((x) => !String(x.bancoId).startsWith('sug-'))).toBe(true);
    expect(r.partidas.every((x) => Number(x.precio_lista_snapshot) > 0)).toBe(true);
  });
});

describe('resolverPrograma · composición DETERMINISTA (P0.1 · #7)', () => {
  it('es DP óptima, NO greedy: {4,3,1} para 6 → 3+3 (2 módulos), no 4+1+1 (3)', () => {
    const mods = [{ id: 'a', usuarios: 4 }, { id: 'b', usuarios: 3 }, { id: 'c', usuarios: 1 }];
    const { combo, total, faltante } = componerOperativos(6, mods);
    expect(faltante).toBe(0);
    expect(total).toBe(6);
    const modulos = combo.reduce((s, c) => s + c.cantidad, 0);
    expect(modulos).toBe(2);
    expect(combo.find((c) => c.modulo.id === 'b').cantidad).toBe(2);
  });

  it('capacidad ≥ pedida y menor excedente ({2,6}, n=5 → 6)', () => {
    const { total, faltante } = componerOperativos(5, [{ id: 'x', usuarios: 2 }, { id: 'y', usuarios: 6 }]);
    expect(faltante).toBe(0);
    expect(total).toBe(6);
  });

  it('App LT 1..14: cubre la capacidad sin excedente absurdo', () => {
    for (let n = 1; n <= 14; n++) {
      const { resoluciones, faltante } = resolverOperativos(n, { linea: 'App LT' });
      expect(faltante).toBe(0);
      const cubierto = resoluciones.reduce((s, r) => s + r.usuarios * r.cantidad, 0);
      expect(cubierto).toBeGreaterThanOrEqual(n);
      expect(cubierto - n).toBeLessThanOrEqual(1);
    }
  });
});

describe('resolverPrograma · preferred_line (P0.1 · #12)', () => {
  it('no hardcodea App LT: línea sin módulo canónico → PROGRAM_INCOMPLETE, no inventa', () => {
    const r = resolverPrograma({ operativos: 10 }, { linea: 'Río' });
    expect(r.ok).toBe(false);
    expect(r.resoluciones).toHaveLength(0);
    const inc = r.incompletos.find((i) => i.code === 'LINEA_SIN_MODULO_CANONICO');
    expect(inc).toBeTruthy();
    expect(inc.linea).toBe('Río');
    expect(inc.disponibles).toContain('App LT');
  });

  it('requerimientos arrastran preferred_line', () => {
    const r = resolverPrograma({ operativos: 4 }, { linea: 'App LT' });
    expect(r.requerimientos[0].preferred_line).toBe('App LT');
  });
});

describe('resolverPrograma · GOLDEN APP LT 10 personas (P0.1 · #5)', () => {
  const prog = resolverPrograma({ operativos: 10 }, { linea: 'App LT' });

  it('exactamente 1 ancla real APP LT 10U · 6000×1200, relation_role ANCHOR_WORKSTATION', () => {
    expect(prog.resoluciones).toHaveLength(1);
    const a = prog.resoluciones[0];
    expect(a.bancoId).toBe('op-10u-6000x1200-cristal');
    expect(a.relation_role).toBe('ANCHOR_WORKSTATION');
    expect(a.usuarios).toBe(10);
    expect(a.w).toBe(6000);
    expect(a.w).not.toBe(7500);
  });

  it('10 asientos WORK_SEAT (mandatory) ligados a la instancia del ancla, mismo grupo', () => {
    expect(sumBy(prog.dependientes, 'WORK_SEAT')).toBe(10);
    const ancla = prog.resoluciones[0];
    const seats = prog.dependientes.filter((d) => d.relation_role === 'WORK_SEAT');
    expect(seats.every((s) => s.anchor_instance_id === ancla.instance_id)).toBe(true);
    expect(seats.every((s) => s.functional_group_id === ancla.functional_group_id)).toBe(true);
    expect(seats.every((s) => s.anchor_role === 'ANCHOR_WORKSTATION')).toBe(true);
    expect(seats.every((s) => s.inclusion === 'mandatory_by_rule')).toBe(true);
  });

  it('gavetas son RECOMENDACIÓN opcional por defecto (no extras silenciosos, #11)', () => {
    expect(sumBy(prog.partidas, 'UNDERDESK_STORAGE')).toBe(0);   // no entran a comercial
    expect(sumBy(prog.recomendaciones, 'UNDERDESK_STORAGE')).toBe(10);
  });

  it('con brief.operativosStorage → gavetas pasan a partida comercial (requested)', () => {
    const p = resolverPrograma({ operativos: 10, brief: { operativosStorage: true } }, { linea: 'App LT' });
    expect(sumBy(p.partidas, 'UNDERDESK_STORAGE')).toBe(10);
    expect(p.dependientes.filter((d) => d.relation_role === 'UNDERDESK_STORAGE').every((d) => d.inclusion === 'requested')).toBe(true);
  });

  it('cero sug-*; productos reales; compuertas separadas', () => {
    expect(prog.partidas.every((p) => !String(p.bancoId).startsWith('sug-'))).toBe(true);
    expect(prog.productosReales).toBe(true);
    expect(prog.identidadesValidas).toBe(true);
    expect(prog.cotizable).toBe(true);
    expect(prog.sinSugFantasma).toBe(true);
  });
});

describe('resolverPrograma · compuertas 2 y 3 por partida (P0.1 · #12)', () => {
  const a = resolverOperativos(10, { linea: 'App LT' }).resoluciones[0];

  it('IDENTIDAD separada: producto_id + producto_version_id', () => {
    expect(a.identity_status).toBe('RESOLVED');
    expect(a.identidad.producto_id).toBeTruthy();
    expect(a.identidad.producto_version_id).toBeTruthy();
    expect(a.source_ref).toBe('op-10u-6000x1200-cristal');
  });

  it('PRECIO separado: snapshot display, autoridad SERVIDOR; no mezcla con realidad', () => {
    expect(a.product_status).toBe('RESOLVED');
    expect(a.price_status).toBe('SNAPSHOT_DISPLAY');
    expect(a.precio_lista_snapshot).toBe(28540);
    expect(a.autoridad).toBe('SERVIDOR');
  });
});
