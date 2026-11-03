// ============================================================================
//  BLN-09 (Ronda 3, FASE 1) · foto→costo del PERFIL METÁLICO LINEAL por el CAMINO REAL de la UI.
//
//  Verdad establecida con sondeo en vivo (2026-10-30): el "9/12, 3 metal PENDIENTE" de la credenza NO
//  era un bug del motor. Por el camino real analizar-mueble → mapIaComps → validarIntentCosteo → calcular,
//  un PTR lineal se normaliza a `cantidad`=metros (como metalLineal/App LT) y se costea con su merma D2.
//  El "pendiente" venía de que el material aún no estaba CONFIRMADO por un humano (fail-closed correcto),
//  y/o de reproducir el despiece CRUDO (largoMM×anchoMM) SIN pasar por mapIaComps.
//
//  Esta regresión fija el contrato completo y FALLARÍA si se reintroduce:
//   · un perfil lineal convertido incorrectamente (área en vez de metros),
//   · un costo artificialmente bajo / $0 por bypass,
//   · una cantidad inválida (negativa) costeada en silencio.
//  Cubre las 10 pruebas obligatorias del directivo a través de la MISMA normalización que usa la UI.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { mapIaComps } from './mapIaComps.js';
import { intentDesdePieza, validarIntentCosteo } from './validarIntentCosteo.js';
import { revisarEstructura } from './revisionEstructural.js';
import { calcular, PARAMETROS_DEFAULT, costeoEmitible } from '../motor/calculo.js';
import { INSUMOS_SEMILLA as INS } from './insumos.js';

const insumos = Object.fromEntries((INS || []).map((i) => [i.id, i]));
const PTR = insumos['ptr']; // $38.19/m, formato tramo 6 m, mermaCorte 5 (consumo real ≈ $40.84/m con D2 6.94%)
const RATE_BASE = 38.19;

// Construye el despiece CRUDO como lo emite analizar-mueble y lo pasa por el MISMO normalizador que la UI.
const mapear = (piezas) => mapIaComps({ piezas }, insumos);
const costear = (piezas) => calcular({ nombre: 'Mueble', componentes: mapear(piezas) }, 1, insumos, PARAMETROS_DEFAULT);
const ptr = (o) => ({ nombre: o.nombre || 'Base PTR', insumoId: 'ptr', material_solicitado: 'PTR', material_match: 'EXACT', confianza: 'alta', forma: 'lineal', material_confirmado: true, ...o });

describe('BLN-09 · perfil lineal por el camino real: metros, costo y merma correctos', () => {
  it('1) PTR 1 × 1700 mm → 1.7 m, costeado, con merma (>$/m base) y emitible al confirmar', () => {
    const r = costear([ptr({ largoMM: 1700, cantidad: 1, metrosTotales: 1.7 })]);
    expect(mapear([ptr({ largoMM: 1700, cantidad: 1, metrosTotales: 1.7 })])[0].cantidad).toBeCloseTo(1.7, 6);
    expect(r.componentesIgnorados).toEqual([]);
    expect(r.materialDirecto).toBeCloseTo(69.4287, 3);
    expect(r.materialDirecto / 1.7).toBeGreaterThan(RATE_BASE); // la merma D2 se aplica (no se cobra el crudo)
    expect(r.estadoCosto).toBe('completo');
    expect(r.costoOficial).toBeGreaterThan(0);
  });

  it('2) PTR 4 × 1700 mm → 6.8 m y costo = 4× el de una pieza (sin doble conversión)', () => {
    const uno = costear([ptr({ largoMM: 1700, cantidad: 1, metrosTotales: 1.7 })]).materialDirecto;
    const cuatro = costear([ptr({ largoMM: 1700, cantidad: 4, metrosTotales: 6.8 })]);
    expect(mapear([ptr({ largoMM: 1700, cantidad: 4, metrosTotales: 6.8 })])[0].cantidad).toBeCloseTo(6.8, 6);
    expect(cuatro.componentesIgnorados).toEqual([]);
    expect(cuatro.materialDirecto).toBeCloseTo(uno * 4, 4);
  });

  it('3) Tubular de 6 m (1 × 6000) → 6 m, costeado', () => {
    const r = costear([ptr({ largoMM: 6000, cantidad: 1, metrosTotales: 6 })]);
    expect(mapear([ptr({ largoMM: 6000, cantidad: 1, metrosTotales: 6 })])[0].cantidad).toBeCloseTo(6, 6);
    expect(r.componentesIgnorados).toEqual([]);
    expect(r.materialDirecto).toBeGreaterThan(6 * RATE_BASE);
  });

  it('4) Perfil con recortes (3 tramos de 800 mm) → 2.4 m, costeado con merma', () => {
    const r = costear([ptr({ largoMM: 800, cantidad: 3, metrosTotales: 2.4 })]);
    const c = mapear([ptr({ largoMM: 800, cantidad: 3, metrosTotales: 2.4 })])[0];
    expect(c.cantidad).toBeCloseTo(2.4, 6);
    expect(c.piezasLineales).toBe(3);
    expect(r.componentesIgnorados).toEqual([]);
    expect(r.materialDirecto / 2.4).toBeGreaterThan(RATE_BASE); // merma de corte aplicada
  });

  it('6) BLN-09 repro: PTR lineal CON anchoMM (perfil 1700×50) sigue siendo lineal, NO área', () => {
    const c = mapear([ptr({ largoMM: 1700, anchoMM: 50, cantidad: 3, metrosTotales: 5.1 })])[0];
    expect(c.forma).toBe('lineal');
    expect(c.cantidad).toBeCloseTo(5.1, 6);     // metros, NO área (1.7×0.05×3 = 0.255 m²)
    expect(c.largoMM).toBeUndefined();          // el anchoMM NO llega al motor como medida de área
    const r = costear([ptr({ largoMM: 1700, anchoMM: 50, cantidad: 3, metrosTotales: 5.1 })]);
    expect(r.componentesIgnorados).toEqual([]);
    expect(r.materialDirecto).toBeGreaterThan(5.1 * RATE_BASE);
  });

  it('9) Mueble con varios perfiles → todos costeados, metros sumados', () => {
    const r = costear([
      ptr({ nombre: 'Marco', largoMM: 1700, cantidad: 2, metrosTotales: 3.4 }),
      ptr({ nombre: 'Travesaños', largoMM: 800, cantidad: 4, metrosTotales: 3.2 }),
    ]);
    expect(r.componentesIgnorados).toEqual([]);
    const soloMarco = costear([ptr({ nombre: 'Marco', largoMM: 1700, cantidad: 2, metrosTotales: 3.4 })]).materialDirecto;
    const soloTrav = costear([ptr({ nombre: 'Travesaños', largoMM: 800, cantidad: 4, metrosTotales: 3.2 })]).materialDirecto;
    expect(r.materialDirecto).toBeCloseTo(soloMarco + soloTrav, 4);
  });

  it('10) Mueble mixto metal + melamina → ambos costeados, sin doble merma del metal', () => {
    const piezas = [
      ptr({ nombre: 'Base PTR', largoMM: 1700, cantidad: 4, metrosTotales: 6.8 }),
      { nombre: 'Cubierta', insumoId: 'melamina-16', material_solicitado: 'Melamina 16', material_match: 'EXACT', confianza: 'alta', forma: 'area', largoMM: 1800, anchoMM: 600, cantidad: 1, hojas: 0.44, material_confirmado: true },
    ];
    const r = calcular({ nombre: 'Credenza', componentes: mapIaComps({ piezas }, insumos) }, 1, insumos, PARAMETROS_DEFAULT);
    expect(r.componentesIgnorados).toEqual([]);
    const soloPtr = costear([ptr({ nombre: 'Base PTR', largoMM: 1700, cantidad: 4, metrosTotales: 6.8 })]).materialDirecto;
    expect(r.materialDirecto).toBeGreaterThan(soloPtr); // la melamina suma; el metal no se re-mermó
    expect(r.estadoCosto).toBe('completo');
  });

  it('paridad cliente = servidor: el intent validado cuesta igual que el cliente', () => {
    const piezas = [ptr({ largoMM: 1700, cantidad: 4, metrosTotales: 6.8 })];
    const pieza = { nombre: 'Mueble', componentes: mapIaComps({ piezas }, insumos) };
    const v = validarIntentCosteo(intentDesdePieza(pieza, 1));
    expect(v.ok).toBe(true);
    const cliente = calcular(pieza, 1, insumos, PARAMETROS_DEFAULT);
    const servidor = calcular(v.intent.pieza, 1, insumos, PARAMETROS_DEFAULT);
    expect(servidor.materialDirecto).toBeCloseTo(cliente.materialDirecto, 6);
  });
});

describe('BLN-09 · datos inválidos o incompletos quedan FAIL-CLOSED (nunca $0 ni costo inventado)', () => {
  it('1b) material SIN confirmar: se calcula pero NO es emitible (queda por confirmar)', () => {
    const piezas = [{ nombre: 'Base PTR', insumoId: 'ptr', material_solicitado: 'PTR', material_match: 'EXACT', confianza: 'alta', forma: 'lineal', largoMM: 1700, cantidad: 1, metrosTotales: 1.7 }];
    const r = calcular({ nombre: 'Mueble', componentes: mapIaComps({ piezas }, insumos) }, 1, insumos, PARAMETROS_DEFAULT);
    expect(r.materialesPorConfirmar).toContain('Base PTR');
    expect(r.estadoCosto).toBe('incompleto');
    expect(r.costoOficial).toBeNull();
    expect(costeoEmitible(r).emitible).toBe(false);
  });

  it('6b) perfil dado como ÁREA (largo×ancho) sobre material por tramo → RECHAZADO con motivo, materialDirecto 0', () => {
    const r = costear([ptr({ forma: 'area', largoMM: 1700, anchoMM: 50, cantidad: 3 })]);
    expect(r.componentesIgnorados.join(' ')).toMatch(/largo de cada corte/);
    expect(r.materialDirecto).toBe(0);       // no se inventa costo por área
    expect(r.costoOficial).toBeNull();
  });

  it('7) cantidad NEGATIVA (sin metrosTotales que la delate) no se costea en silencio: queda marcada y la bloquea revisarEstructura', () => {
    // Caso PURO: antes del fix, cantidad:-2 se coaccionaba a 1 pieza (1.7 m) SIN bandera (invención de material).
    const c = mapear([ptr({ largoMM: 1700, cantidad: -2 })])[0];
    expect(c.iaIncoherencia).toBeTruthy();         // <-- RED antes del fix
    expect(c.cantidad).toBeGreaterThanOrEqual(0);  // nunca cantidad negativa
    const rev = revisarEstructura({ componentes: mapear([ptr({ largoMM: 1700, cantidad: -2 })]), insumos, descripcion: '' });
    const obs = [...(rev.observaciones || []), ...(rev.bloqueos || []), ...(rev.obs || [])].find((o) => (o.clave || '').startsWith('ia_incoherente'));
    expect(obs && obs.nivel).toBe('blocker');
  });

  it('7b) cantidad CERO explícita en un lineal → marcada para revisión (no se inventa 1 pieza)', () => {
    const c = mapear([ptr({ largoMM: 1700, cantidad: 0 })])[0];
    expect(c.iaIncoherencia).toBeTruthy();
  });

  it('8) dimensiones ambiguas (2 × 2000 sin metrosTotales) → 4 m pero marcada para revisión', () => {
    const c = mapear([ptr({ largoMM: 2000, cantidad: 2, material_confirmado: true })])[0];
    delete c._; // no-op, mantiene forma
    expect(c.cantidad).toBe(4);
    expect(c.iaIncoherencia).toMatchObject({ campo: 'cantidadLineal' });
  });
});
