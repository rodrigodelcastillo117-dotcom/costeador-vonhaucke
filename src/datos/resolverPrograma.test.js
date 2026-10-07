import { describe, it, expect } from 'vitest';
import {
  resolverOperativos, resolverPrivado, resolverJuntas, resolverRecepcion,
  resolverPrograma, medidasAwd, componerOperativos,
} from './resolverPrograma.js';

const seats = (prog, rol) => prog.dependientes
  .filter((d) => d.relation_role === rol)
  .reduce((s, d) => s + (d.cantidad || 0), 0);

describe('resolverPrograma · Product Resolver real (P0.1)', () => {
  it('#102 GOLDEN: 10 operativos → módulo REAL 6000×1200, NUNCA 7500', () => {
    const { resoluciones, faltante } = resolverOperativos(10, { linea: 'App LT' });
    expect(faltante).toBe(0);
    expect(resoluciones).toHaveLength(1);
    const r = resoluciones[0];
    expect(r.bancoId).toBe('op-10u-6000x1200-cristal');
    expect(r.w).toBe(6000);
    expect(r.d).toBe(1200);
    expect(r.w).not.toBe(7500);          // <-- la regresión que NO puede volver
    expect(r.precio).toBe(28540);        // precio real, no $0
    expect(r.source).toBe('RESUELTO');   // nunca 'SUGERIDO'/sug-*
  });

  it('capacidades exactas del catálogo resuelven a un solo módulo real', () => {
    for (const n of [1, 2, 4, 6, 8, 12]) {
      const r = resolverOperativos(n).resoluciones;
      expect(r).toHaveLength(1);
      expect(r[0].usuarios).toBe(n);
      expect(Number(r[0].w)).toBeGreaterThan(0);
      expect(r[0].bancoId).toBeTruthy();
      expect(Number(r[0].precio)).toBeGreaterThan(0);
    }
  });

  it('composición determinista de capacidad NO exacta (5 = 4 + 1), sin inventar', () => {
    const { resoluciones, faltante } = resolverOperativos(5);
    expect(faltante).toBe(0);
    const total = resoluciones.reduce((s, r) => s + r.usuarios * r.cantidad, 0);
    expect(total).toBe(5);
    expect(resoluciones.every((r) => r.bancoId && r.precio > 0)).toBe(true);
  });

  it('7 usuarios se compone con módulos reales sumando exactamente 7', () => {
    const { resoluciones, faltante } = resolverOperativos(7);
    expect(faltante).toBe(0);
    expect(resoluciones.reduce((s, r) => s + r.usuarios * r.cantidad, 0)).toBe(7);
  });

  it('privado → escritorio directivo REAL (ancla ANCHOR_DESK)', () => {
    const r = resolverPrivado();
    expect(r).toBeTruthy();
    expect(r.anchor_role).toBe('ANCHOR_DESK');
    expect(r.w).toBeGreaterThan(0);
    expect(r.precio).toBeGreaterThan(0);
  });

  it('juntas: capacidad → mesa REAL que la cubre (producto real, no inventado)', () => {
    const m4 = resolverJuntas(4);
    expect(m4.usuarios).toBeGreaterThanOrEqual(4);
    expect(m4.bancoId).toBeTruthy();
    expect(m4.w).toBeGreaterThan(0);
    const m10 = resolverJuntas(10);
    expect(m10.usuarios).toBeGreaterThanOrEqual(10);   // cubre la capacidad pedida
    expect(m10.w).toBeGreaterThan(0);
    expect(m10.precio).toBeGreaterThan(0);
    expect(m10.source).toBe('RESUELTO');
  });

  it('recepción → módulo recepción REAL', () => {
    const r = resolverRecepcion();
    expect(r).toBeTruthy();
    expect(/recep/i.test(r.nombre)).toBe(true);
    expect(r.anchor_role).toBe('ANCHOR_RECEPTION');
    expect(r.precio).toBeGreaterThan(0);
  });

  it('orquestador: programa completo → todas las resoluciones REALES (todasReales)', () => {
    const prog = { operativos: 10, privados: 1, salas: [4], recepcion: true };
    const r = resolverPrograma(prog, { linea: 'App LT' });
    expect(r.ok).toBe(true);
    expect(r.todasReales).toBe(true);               // ningún sug-*/$0
    expect(r.resoluciones.some((x) => x.w === 6000)).toBe(true);  // el 10u real
    expect(r.resoluciones.every((x) => x.source === 'RESUELTO')).toBe(true);
    expect(r.resoluciones.every((x) => x.bancoId && Number(x.precio) > 0)).toBe(true);
  });

  it('medidasAwd parsea strings del banco', () => {
    expect(medidasAwd('6000 × 1200 mm')).toEqual({ w: 6000, d: 1200 });
    expect(medidasAwd('2420 × 830 mm')).toEqual({ w: 2420, d: 830 });
    expect(medidasAwd('Ø 600 × 398 mm')).toEqual({ w: 600, d: 398 });
    expect(medidasAwd('sin medida')).toBeNull();
  });

  it('nunca produce un id sug-* ni precio 0', () => {
    const r = resolverPrograma({ operativos: 7, privados: 2, salas: [6, 10], recepcion: true });
    expect(r.partidas.every((x) => !String(x.bancoId).startsWith('sug-'))).toBe(true);
    expect(r.partidas.every((x) => Number(x.precio) > 0)).toBe(true);
  });
});

describe('resolverPrograma · composición DETERMINISTA (P0.1 · #7)', () => {
  it('es DP óptima, NO greedy: {4,3,1} para 6 → 3+3 (2 módulos), no 4+1+1 (3)', () => {
    const mods = [{ id: 'a', usuarios: 4 }, { id: 'b', usuarios: 3 }, { id: 'c', usuarios: 1 }];
    const { combo, total, faltante } = componerOperativos(6, mods);
    expect(faltante).toBe(0);
    expect(total).toBe(6);                                   // sin desperdicio
    const modulos = combo.reduce((s, c) => s + c.cantidad, 0);
    expect(modulos).toBe(2);                                 // greedy daría 3
    expect(combo.find((c) => c.modulo.id === 'b').cantidad).toBe(2);
  });

  it('capacidad ≥ pedida y menor excedente cuando no hay suma exacta ({2,6}, n=5 → 6)', () => {
    const { total, faltante } = componerOperativos(5, [{ id: 'x', usuarios: 2 }, { id: 'y', usuarios: 6 }]);
    expect(faltante).toBe(0);
    expect(total).toBe(6);                                   // 6 (excedente 1) vence a 2+2+2=6? mismo waste, menos módulos
  });

  it('App LT 1..14: cubre la capacidad con módulos reales y sin excedente absurdo', () => {
    for (let n = 1; n <= 14; n++) {
      const { resoluciones, faltante } = resolverOperativos(n, { linea: 'App LT' });
      expect(faltante).toBe(0);
      const cubierto = resoluciones.reduce((s, r) => s + r.usuarios * r.cantidad, 0);
      expect(cubierto).toBeGreaterThanOrEqual(n);
      expect(cubierto - n).toBeLessThanOrEqual(1);           // desperdicio mínimo (0 en App LT)
      expect(resoluciones.every((r) => medidasAwd(`${r.w} × ${r.d} mm`).w === r.w)).toBe(true);
    }
  });
});

describe('resolverPrograma · preferred_line (P0.1 · #12)', () => {
  it('no hardcodea App LT: una línea sin módulo canónico → PROGRAM_INCOMPLETE, no inventa', () => {
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

  it('exactamente 1 ancla real APP LT 10U · 6000×1200, capacidad 10', () => {
    expect(prog.resoluciones).toHaveLength(1);
    const a = prog.resoluciones[0];
    expect(a.bancoId).toBe('op-10u-6000x1200-cristal');
    expect(a.anchor_role).toBe('ANCHOR_WORKSTATION');
    expect(a.usuarios).toBe(10);
    expect(a.w).toBe(6000);
    expect(a.w).not.toBe(7500);                              // mutación #102 prohibida
  });

  it('exactamente 10 asientos y 10 guardas, todos en el mismo grupo funcional', () => {
    expect(seats(prog, 'WORK_SEAT')).toBe(10);
    expect(seats(prog, 'UNDERDESK_STORAGE')).toBe(10);
    const grupos = new Set(prog.partidas.map((p) => p.functional_group_id));
    expect(grupos.size).toBe(1);                             // un solo bench → un grupo
    const g = prog.resoluciones[0].functional_group_id;
    expect(prog.dependientes.every((d) => d.functional_group_id === g)).toBe(true);
    expect(prog.dependientes.every((d) => d.anchor_ref === 'op-10u-6000x1200-cristal')).toBe(true);
  });

  it('cero sug-*; toda partida real; todasReales', () => {
    expect(prog.partidas.every((p) => !String(p.bancoId).startsWith('sug-'))).toBe(true);
    expect(prog.partidas.every((p) => Number(p.precio) > 0 && p.source === 'RESUELTO')).toBe(true);
    expect(prog.todasReales).toBe(true);
  });

  it('sin guardas cuando no se requieren (conGuardas:false) → 10 asientos, 0 guardas', () => {
    const p = resolverPrograma({ operativos: 10 }, { linea: 'App LT', operativosConGuardas: false });
    expect(seats(p, 'WORK_SEAT')).toBe(10);
    expect(seats(p, 'UNDERDESK_STORAGE')).toBe(0);
  });
});

describe('resolverPrograma · compuertas 2 y 3 por partida (P0.1)', () => {
  const a = resolverOperativos(10, { linea: 'App LT' }).resoluciones[0];

  it('IDENTIDAD: la partida trae producto_id + producto_version_id (no sólo source_ref)', () => {
    expect(a.gate_product_identity).toBe(true);
    expect(a.identidad.producto_id).toBeTruthy();
    expect(a.identidad.producto_version_id).toBeTruthy();
    expect(a.source_ref).toBe('op-10u-6000x1200-cristal');
  });

  it('PRECIO: el snapshot es display, nunca autoridad del cliente (gate separado)', () => {
    expect(a.precio).toBe(28540);                            // display
    expect(a.precio_autoridad.autoridad).toBe('SERVIDOR');
    expect(a.precio_autoridad.gate_price_authority).toBe(false);
  });
});
