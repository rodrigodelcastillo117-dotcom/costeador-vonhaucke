import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { costoAlba as costoAlbaBase, tipoAlba } from './formulaAlba.js';
import { costoAlbaDificultad as costoAlba, DIFICULTAD, factorDificultad, dificultadEquivalente, costoPorHoras, nivelDificultad, TARIFAS_PLANTA } from './dificultad.js';
import { calcular } from './calculo.js';
import { validarIntentCosteo, intentDesdePieza } from '../datos/validarIntentCosteo.js';
import { dtoCosteoServidor } from '../nube.js';
import { TARIFA_REAL_APPLT, tarifaIndirectoPlanta, costoOficialModuloAppLT } from '../datos/appltCosto.js';
import { APPLT_DATOS } from '../datos/appltDatos.js';

// Dirección (2026-10-13): "con % cada uno, pero si es un mueble más difícil que suba, más fácil baja…
// que se pueda por horas y por %, que den lo mismo en ambos valores, que vayan de la mano".
const DIR = path.resolve(__dirname, '../../lab/applt/componentes');
const piezas = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  return { clave: d.clave, mat: d.materiales.reduce((s, m) => s + m.importe_derivado, 0), tipo: tipoAlba({ nombre: d.descripcion }), horas: d.horas };
});
const porClave = Object.fromEntries(piezas.map((p) => [p.clave, p]));
const c2 = (x) => Math.round(x * 100);

describe('Alba × dificultad · NORMAL no cambia nada', () => {
  it('dificultad 1 / "normal" / ausente / basura = la fórmula de siempre, al centavo', () => {
    for (const tipo of ['cubierta', 'metal', 'madera', 'cristal', 'compraventa', 'general']) {
      const base = costoAlbaBase(1000, tipo);
      for (const d of [1, 'normal', undefined, null, 'xyz', NaN, -2, 0]) expect(costoAlba(1000, tipo, d).fab).toBe(base.fab);
    }
    expect(costoAlba(1000, 'metal')).toMatchObject({ mo: 200, gi: 600, fab: 1800 });
  });
  it('más difícil SUBE, más fácil BAJA (MO e indirectos 3×MO); cristal sólo mueve su MO', () => {
    expect(costoAlba(1000, 'metal', 'dificil')).toMatchObject({ mo: 260, gi: 780, fab: 2040 });
    expect(costoAlba(1000, 'metal', 'facil')).toMatchObject({ mo: 150, gi: 450, fab: 1600 });
    expect(costoAlba(1000, 'cristal', 'muy_dificil')).toMatchObject({ mo: 16, gi: 50 });
    const f = Object.values(DIFICULTAD);
    expect([...f].sort((a, b) => a - b)).toEqual(f);
  });
  it('acotada: nunca NaN ni negativa; 0.25–3', () => {
    expect(factorDificultad(10)).toBe(3);
    expect(factorDificultad(0.01)).toBe(0.25);
    expect(factorDificultad('muy_dificil')).toBe(1.6);
  });
});

describe('Alba × dificultad · % y horas VAN DE LA MANO (15 piezas reales APP LT)', () => {
  it('las tarifas de planta del motor = las del pedido real 38247 (MO por área, indirecto UNA vez)', () => {
    for (const a of Object.keys(TARIFAS_PLANTA.mo)) expect(TARIFAS_PLANTA.mo[a]).toBe(TARIFA_REAL_APPLT[a].mo);
    expect(TARIFAS_PLANTA.indirectoHora).toBeCloseTo(tarifaIndirectoPlanta(), 5);
  });
  it('con su dificultad equivalente, el % de Alba da EXACTAMENTE el costo por horas (al centavo)', () => {
    for (const p of piezas) {
      if (p.clave === 'ATCUBS46ABS') continue;   // ver prueba siguiente: le falta la carpintería
      const eq = dificultadEquivalente(p.mat, p.tipo, p.horas);
      expect(c2(costoAlba(p.mat, p.tipo, eq).fab), p.clave).toBe(c2(costoPorHoras(p.mat, p.horas).fab));
    }
  });
  it('dato incompleto NO se maquilla: ATCUBS46ABS no trae horas de carpintería → su equivalente (0.15) cae fuera de rango', () => {
    const p = porClave.ATCUBS46ABS;
    expect(p.horas.carpinteria).toBeNull();
    expect(dificultadEquivalente(p.mat, p.tipo, p.horas)).toBeLessThan(0.25);
  });
  it('los niveles salen de las piezas reales: acometida muy difícil, patas difíciles, ATOM3/cubierta 1200 normal, cubiertas grandes y faldones muy fáciles', () => {
    const nivel = (k) => nivelDificultad(dificultadEquivalente(porClave[k].mat, porClave[k].tipo, porClave[k].horas));
    expect(nivel('ATACM')).toBe('muy_dificil');
    for (const k of ['ATPU2M', 'ATPU3M', 'ATPU75M']) expect(nivel(k), k).toBe('dificil');
    for (const k of ['ATOM3', 'ATCUBD44ABS', 'ATCUBS44ABS']) expect(nivel(k), k).toBe('normal');
    expect(nivel('ATOM4')).toBe('facil');
    for (const k of ['ATCUBD45ABS', 'ATCUBD46ABS', 'ATCUBS45ABS', 'ATFAL12ABS', 'ATFAL150ABS']) expect(nivel(k), k).toBe('muy_facil');
  });
  it('módulo APP LT 6U completo (BOM mixto): horas = costo oficial $7,501.97 y UNA dificultad lo iguala con el %', () => {
    const r = costoOficialModuloAppLT();
    expect(costoPorHoras(r.materiaPrima, APPLT_DATOS.horasEstandarPorModulo).fab).toBeCloseTo(7501.97, 1);   // oficial redondea MO e IND aparte
    // Cada material con su tipo Alba; costo(d) es lineal en d ⇒ se despeja la dificultad que iguala a horas.
    const alba = (d) => r.materiales.reduce((s, m) => s + costoAlba(m.importe, tipoAlba({ nombre: m.descripcion }), d).fab, 0);
    const eq = 1 + (7501.97 - alba(1)) / (alba(2) - alba(1));
    expect(alba(eq)).toBeCloseTo(7501.97, 2);
    console.info(`[6U] Alba normal ${alba(1).toFixed(2)} · dificultad equivalente ${eq.toFixed(3)} (${nivelDificultad(eq)})`);
    expect(eq).toBeGreaterThan(0.5);
    expect(eq).toBeLessThan(1.6);
  });
});

describe('Alba × dificultad · motor y paridad cliente/servidor', () => {
  const insumos = { t: { id: 't', nombre: 'Tablero', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true } };
  const pieza = (d) => ({ componentes: [{ nombre: 'Panel', insumoId: 't', hojas: 1, piezas: 1, cantidad: 1 }], modoManoObra: 'porcentaje', ...(d != null ? { dificultad: d } : {}) });
  it('calcular() aplica la dificultad a la MO de Alba; normal = sin cambio', () => {
    const n = calcular(pieza(), 1, insumos, {});
    const d = calcular(pieza('dificil'), 1, insumos, {});
    const f = calcular(pieza('facil'), 1, insumos, {});
    expect(calcular(pieza('normal'), 1, insumos, {}).costoUnitario).toBe(n.costoUnitario);
    expect(n.manoObra).toBeGreaterThan(0);
    expect(d.manoObra).toBeCloseTo(n.manoObra * 1.3, 6);
    expect(f.manoObra).toBeCloseTo(n.manoObra * 0.75, 6);
    expect(d.costoUnitario).toBeGreaterThan(n.costoUnitario);
    expect(f.costoUnitario).toBeLessThan(n.costoUnitario);
  });
  it('la dificultad viaja al servidor (DTO + intent) y el validador la acepta acotada', () => {
    expect(dtoCosteoServidor(pieza('dificil'), 1).pieza.dificultad).toBe('dificil');
    expect(dtoCosteoServidor(pieza(1.25), 1).pieza.dificultad).toBe(1.25);
    expect(dtoCosteoServidor(pieza(), 1).pieza).not.toHaveProperty('dificultad');
    const it1 = intentDesdePieza(pieza('muy_facil'), 1);
    expect(validarIntentCosteo(it1)).toMatchObject({ ok: true });
    expect(validarIntentCosteo(it1).intent.pieza.dificultad).toBe('muy_facil');
  });
  it('dificultad inválida → 400 con campo (no se ignora en silencio)', () => {
    for (const d of ['imposible', 9, 0, -1, { x: 1 }]) {
      const v = validarIntentCosteo({ cantidad: 1, pieza: { componentes: [{ insumoId: 't', cantidad: 1 }], dificultad: d } });
      expect(v.ok, String(d)).toBe(false);
      expect(v.issues.some((i) => i.field === 'pieza.dificultad')).toBe(true);
    }
  });
});

describe('VH-177 · el laminado plástico (HPL) es cubierta, no lámina de acero', () => {
  it('HPL de cubiertas → cubierta (15 %); la lámina de acero sigue siendo metal', () => {
    expect(tipoAlba({ seccion: 'cubiertas', nombre: 'Laminado plastico / Ecolegno (HPL)' })).toBe('cubierta');
    expect(tipoAlba({ seccion: 'cubiertas', nombre: 'Laminado plastico 4x8 Walnut (nogal)' })).toBe('cubierta');
    for (const n of ['LAMINA ROLADA EN FRIO CAL 18', 'Lámina cal 16', 'LAMINA GALVANIZADA', 'acero laminado en frío', 'CONDUCTO EN LAMINA PINTADA']) expect(tipoAlba({ nombre: n }), n).toBe('metal');
    expect(tipoAlba({ seccion: 'cubiertas', nombre: 'Melamina 16 mm' })).toBe('cubierta');
  });
});

describe('costoPorHoras · horas faltantes no se vuelven cero en silencio (auditoría externa 2026-10-13)', () => {
  it('área ausente o null → completo:false y la lista de áreas faltantes; el 0 explícito sí es dato', () => {
    const r = costoPorHoras(100, { pm: 1, pintura: 0, acabados: 0 });
    expect(r.completo).toBe(false);
    expect(r.faltan).toEqual(['carpinteria']);
    const ok = costoPorHoras(100, { pm: 1, carpinteria: 0, pintura: 0, acabados: 0 });
    expect(ok.completo).toBe(true);
    expect(ok.faltan).toEqual([]);
    expect(costoPorHoras(100, { pm: 'x', carpinteria: null, pintura: -1, acabados: '' }).faltan).toEqual(['pm', 'carpinteria', 'acabados', 'pintura']);
  });
});
