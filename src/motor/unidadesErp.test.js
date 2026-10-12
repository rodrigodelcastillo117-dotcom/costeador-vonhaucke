// ============================================================================
//  P0-02 (2026-10-12) · Unidades ERP sin formato: el motor NO multiplica un precio
//  por hoja/pza/kg/m directo por m². Bloquea con motivo; conserva goldens.
//  Casos del mandato: ACCR348 hoja 4×8 $1,018.50 · melamina 16 B809/B835 ·
//  tableros 16/19/28 · lámina kg/hoja · herrajes pza/par · piezas 1200×600,
//  1800×900 y mayores al formato.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { calcular, incompatibilidadUnidad, costoNetoComponente, netoComponente } from './calculo.js';

const TABLERO = { tipo: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
const base = (o) => ({ clase: 'directa', mermaCorte: 0, inventario: false, veta: false, fraccion: false, ...o });

// Como salen HOY del catálogo (catalogo_motor): unidad 'hoja', formato null.
const ERP = {
  'erp-accr348': base({ id: 'erp-accr348', nombre: 'Tablero ACCR348 4×8 (ERP)', unidad: 'hoja', precio: 1018.5, formato: null }),
  'erp-b809': base({ id: 'erp-b809', nombre: 'Melamina 16 B809 (ERP)', unidad: 'hoja', precio: 449, formato: null }),
  'erp-b835': base({ id: 'erp-b835', nombre: 'Melamina 16 B835 (ERP)', unidad: 'hoja', precio: 646, formato: null }),
  'erp-lamina-kg': base({ id: 'erp-lamina-kg', nombre: 'Lámina cal 14 (ERP)', unidad: 'kg', precio: 32.5, formato: null }),
  'erp-corredera-par': base({ id: 'erp-corredera-par', nombre: 'Corredera 45 cm (ERP)', unidad: 'par', precio: 85, formato: null }),
  'erp-bisagra-pza': base({ id: 'erp-bisagra-pza', nombre: 'Bisagra 35 mm (ERP)', unidad: 'pza', precio: 12.4, formato: null }),
  'erp-canto-m': base({ id: 'erp-canto-m', nombre: 'Canto PVC 22 mm (ERP)', unidad: 'm', precio: 3.1, formato: null }),
  'erp-vinil-m2': base({ id: 'erp-vinil-m2', nombre: 'Vinil (ERP)', unidad: 'm2', precio: 180, formato: null }),
};
// Con la conversión técnica documentada (formato de hoja): sí se puede costear por geometría.
const CURADO = {
  'melamina-16': base({ id: 'melamina-16', nombre: 'Melamina 16 mm', unidad: 'hoja', precio: 449, formato: TABLERO, fraccion: true, mermaCorte: 6 }),
  'melamina-19': base({ id: 'melamina-19', nombre: 'Melamina 19 mm', unidad: 'hoja', precio: 646, formato: TABLERO, fraccion: true, mermaCorte: 6 }),
  'melamina-28': base({ id: 'melamina-28', nombre: 'Melamina 28 mm', unidad: 'hoja', precio: 1018.5, formato: TABLERO, fraccion: true, mermaCorte: 6 }),
  'lam14': base({ id: 'lam14', nombre: 'Lámina cal 14 3×10', unidad: 'hoja', precio: 2016.8, fraccion: true, formato: { tipo: 'lamina', corto: 'cal14', medida: 79.9 } }),
};
const pieza = (comps) => ({ componentes: comps, modoManoObra: 'porcentaje' });

describe('P0-02 · incompatibilidadUnidad (puro)', () => {
  it('hoja sin formato + largo×ancho → bloqueado con motivo explícito', () => {
    const m = incompatibilidadUnidad({ largoMM: 1200, anchoMM: 600 }, ERP['erp-accr348']);
    expect(m).toMatch(/precio por hoja sin formato/);
    expect(m).toMatch(/conversión técnica/);
  });
  it('hojas (fracción) sin formato → bloqueado: falta la hoja de referencia', () => {
    expect(incompatibilidadUnidad({ hojas: 0.25, largoMM: 1200, anchoMM: 600 }, ERP['erp-b809'])).toMatch(/fracción de hoja.*sin formato/);
  });
  it('kg / pza / par / m sin formato + largo×ancho → bloqueado', () => {
    for (const id of ['erp-lamina-kg', 'erp-bisagra-pza', 'erp-corredera-par', 'erp-canto-m']) {
      expect(incompatibilidadUnidad({ largoMM: 1800, anchoMM: 900 }, ERP[id]), id).toMatch(/sin formato/);
    }
  });
  it('m² sin formato + largo×ancho → compatible (m² × $/m²)', () => {
    expect(incompatibilidadUnidad({ largoMM: 1200, anchoMM: 600 }, ERP['erp-vinil-m2'])).toBeNull();
  });
  it('con formato (hoja de referencia) → compatible, cualquier unidad', () => {
    expect(incompatibilidadUnidad({ largoMM: 1200, anchoMM: 600 }, CURADO['melamina-16'])).toBeNull();
    expect(incompatibilidadUnidad({ hojas: 0.5 }, CURADO.lam14)).toBeNull();
  });
  it('consumo por cantidad (pza/par/m/kg) sin geometría → compatible', () => {
    expect(incompatibilidadUnidad({ cantidad: 4 }, ERP['erp-bisagra-pza'])).toBeNull();
    expect(incompatibilidadUnidad({ cantidad: 2 }, ERP['erp-corredera-par'])).toBeNull();
    expect(incompatibilidadUnidad({ cantidad: 3.6 }, ERP['erp-canto-m'])).toBeNull();
    expect(incompatibilidadUnidad({ cantidad: 1 }, ERP['erp-accr348'])).toBeNull(); // 1 hoja entera: sí es $/hoja × hojas
  });
  it('formato sin medida no cuenta como formato', () => {
    const roto = base({ id: 'x', unidad: 'hoja', precio: 100, formato: { tipo: 'tablero' } });
    expect(incompatibilidadUnidad({ largoMM: 1200, anchoMM: 600 }, roto)).toMatch(/sin formato/);
  });
});

describe('P0-02 · motor: ACCR348 hoja 4×8 $1,018.50 sin formato', () => {
  it('cubierta 1200×600 NO se cobra m² × $/hoja ($733.32): queda PENDIENTE y el costo es incompleto', () => {
    const r = calcular(pieza([{ insumoId: 'erp-accr348', nombre: 'Cubierta 1200×600', largoMM: 1200, anchoMM: 600, piezas: 1 }]), 1, ERP);
    expect(netoComponente({ largoMM: 1200, anchoMM: 600 }, 1, ERP['erp-accr348'])).toBeCloseTo(0.72, 6); // m², lo que ANTES se multiplicaba
    expect(r.materialTotal).toBe(0);
    expect(r.estadoCosto).toBe('incompleto');
    expect(r.costoOficial).toBeNull();
    expect(r.pendientes).toHaveLength(1);
    expect(r.pendientes[0]).toMatch(/^Cubierta 1200×600 \(precio por hoja sin formato/);
  });
  it('la misma cubierta con hojas:0.25 (IA) y sin formato también se bloquea (no 0.72 × precio)', () => {
    const r = calcular(pieza([{ insumoId: 'erp-accr348', nombre: 'Cubierta', hojas: 0.25, largoMM: 1200, anchoMM: 600, cantidad: 1 }]), 1, ERP);
    expect(r.materialTotal).toBe(0);
    expect(r.pendientes[0]).toMatch(/fracción de hoja/);
  });
  it('1 hoja entera por cantidad sí se cobra: 2 hojas = $2,037.00', () => {
    const r = calcular(pieza([{ insumoId: 'erp-accr348', nombre: 'Hojas completas', cantidad: 2 }]), 1, ERP);
    expect(r.materialTotal).toBeCloseTo(2037, 2);
    expect(r.estadoCosto).toBe('completo');
  });
  it('costoNetoComponente del renglón: $0 cuando la unidad es incompatible (nunca $733.32)', () => {
    expect(costoNetoComponente({ largoMM: 1200, anchoMM: 600 }, ERP['erp-accr348'])).toBe(0);
    expect(costoNetoComponente({ largoMM: 1200, anchoMM: 600 }, CURADO['melamina-28'])).toBeCloseTo(0.72 * 1018.5, 2);
  });
});

describe('P0-02 · melamina 16 B809/B835 y tableros 16/19/28', () => {
  it('ERP B809/B835 sin formato + 1200×600 → bloqueados, con el nombre de cada pieza', () => {
    const r = calcular(pieza([
      { insumoId: 'erp-b809', nombre: 'Costado B809', largoMM: 1200, anchoMM: 600 },
      { insumoId: 'erp-b835', nombre: 'Cubierta B835', largoMM: 1800, anchoMM: 900 },
    ]), 1, ERP);
    expect(r.materialTotal).toBe(0);
    expect(r.pendientes.map((p) => p.split(' (')[0])).toEqual(['Costado B809', 'Cubierta B835']);
  });
  it('curado con formato: 1200×600 en tablero 2440×1220 = ¼ hoja exacto (16: $112.25 · 19: $161.50 · 28: $254.63)', () => {
    for (const [id, esperado] of [['melamina-16', 449 / 4], ['melamina-19', 646 / 4], ['melamina-28', 1018.5 / 4]]) {
      const r = calcular(pieza([{ insumoId: id, nombre: 'Cubierta', largoMM: 1200, anchoMM: 600, piezas: 1 }]), 1, CURADO);
      expect(r.detalleInsumos[0].unidades, id).toBeCloseTo(0.25, 9);
      expect(r.detalleInsumos[0].costo, id).toBeCloseTo(esperado, 2);
      expect(r.estadoCosto).toBe('completo');
    }
  });
  it('1800×900 (A14: lado mayor > 1.50, menor > 0.60) = 1 hoja completa', () => {
    const r = calcular(pieza([{ insumoId: 'melamina-19', nombre: 'Cubierta 1800×900', largoMM: 1800, anchoMM: 900, piezas: 1 }]), 1, CURADO);
    expect(r.detalleInsumos[0].unidades).toBeCloseTo(1, 9);
    expect(r.detalleInsumos[0].costo).toBeCloseTo(646, 2);
    expect(r.detalleInsumos[0].piezasRegla?.[0]?.hojasPorPieza).toBe(1);
  });
  it('mayor al formato (3000×1300): se cobra la hoja y se AVISA noCabe (nunca $0, nunca silencio)', () => {
    const r = calcular(pieza([{ insumoId: 'melamina-19', nombre: 'Cubierta 3000×1300', largoMM: 3000, anchoMM: 1300, piezas: 1 }]), 1, CURADO);
    expect(r.detalleInsumos[0].noCabe).toBe(true);
    expect(r.detalleInsumos[0].costo).toBeGreaterThanOrEqual(646);
  });
});

describe('P0-02 · lámina kg/hoja y herrajes pza/par', () => {
  it('lámina ERP por kg sin formato + largo×ancho → bloqueada (no m² × $/kg)', () => {
    const r = calcular(pieza([{ insumoId: 'erp-lamina-kg', nombre: 'Tapa lámina', largoMM: 900, anchoMM: 600 }]), 1, ERP);
    expect(r.materialTotal).toBe(0);
    expect(r.pendientes[0]).toMatch(/precio por kg sin formato/);
  });
  it('lámina ERP por kg con cantidad en kg → se cobra kg × $/kg', () => {
    const r = calcular(pieza([{ insumoId: 'erp-lamina-kg', nombre: 'Lámina', cantidad: 12.5 }]), 1, ERP);
    expect(r.materialTotal).toBeCloseTo(12.5 * 32.5, 2);
  });
  it('lámina curada (hoja con medida en kg) por fracción: 0.5 hoja = $1,008.40 sin merma (golden Rafa §1 intacto)', () => {
    const r = calcular(pieza([{ insumoId: 'lam14', nombre: 'Asiento', hojas: 0.5 }]), 1, CURADO);
    expect(r.detalleInsumos[0].costo).toBeCloseTo(1008.4, 2);
    expect(r.detalleInsumos[0].desperdicio).toBe(0);
  });
  it('herrajes pza/par por cantidad: 4 bisagras + 2 pares de corredera = $219.60', () => {
    const r = calcular(pieza([
      { insumoId: 'erp-bisagra-pza', nombre: 'Bisagras', cantidad: 4 },
      { insumoId: 'erp-corredera-par', nombre: 'Correderas', cantidad: 2 },
    ]), 1, ERP);
    expect(r.materialTotal).toBeCloseTo(4 * 12.4 + 2 * 85, 2);
    expect(r.estadoCosto).toBe('completo');
  });
  it('herraje pza con largo×ancho (error de captura) → bloqueado, no m² × $/pza', () => {
    const r = calcular(pieza([{ insumoId: 'erp-bisagra-pza', nombre: 'Bisagra', largoMM: 1200, anchoMM: 600 }]), 1, ERP);
    expect(r.materialTotal).toBe(0);
    expect(r.pendientes[0]).toMatch(/precio por pza sin formato/);
  });
  it('m² sin formato con largo×ancho sí se cobra: vinil 1200×600 = 0.72 × $180 = $129.60', () => {
    const r = calcular(pieza([{ insumoId: 'erp-vinil-m2', nombre: 'Vinil', largoMM: 1200, anchoMM: 600 }]), 1, ERP);
    expect(r.materialTotal).toBeCloseTo(129.6, 2);
  });
  it('lote: el bloqueo no depende de la cantidad de piezas', () => {
    const r = calcular(pieza([{ insumoId: 'erp-accr348', nombre: 'Cubierta', largoMM: 1200, anchoMM: 600 }]), 25, ERP);
    expect(r.materialTotal).toBe(0);
    expect(r.estadoCosto).toBe('incompleto');
  });
});
