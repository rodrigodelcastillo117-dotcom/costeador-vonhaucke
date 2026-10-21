// ============================================================================
//  COCREAR 10 · D-01 · puente Cocrear → Costeo (docs/auditoria/COCREAR_10.md).
//  Todo corre sobre el código REAL: generadores de línea (LINEAS_REG), insumos semilla y el
//  motor (calcular). Nada de mocks: el padre es el despiece que la app ya cotiza.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  lineasEscalables, padreDeLinea, escalarDespiece, bajarLineaABom, reescalarSiAplica,
  semillaCostearDesdeCocrear, aplicarRetornoCosteo, despieceVigente, sincronizarFuncionesPendientes,
  ejeDePiezaVertical,
} from './cocrearPuente.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { calcular, costeoEmitible } from '../motor/calculo.js';
import { cocrearDesdeIntent, specDeCocreacion, CLASIFICACION, COST_STATUS } from './cocrear.js';
import { prepararIntentCocrear, conceptosCocrear, aplicarConceptoCocrear } from './cocrearWow.js';
import { DIFICULTAD } from '../motor/dificultad.js';

const insumos = mapaInsumos(INSUMOS_SEMILLA);
const costo = (componentes, extra = {}) => calcular({ componentes, modoManoObra: 'porcentaje', ...extra }, 1, insumos, {});
const intentMesa = (dims, caracteristicas = []) => ({ familia: 'MESA', dimensiones: dims, caracteristicas, materiales: [] });

describe('Catálogo escalable: sólo productos con medida base declarada y de un cuerpo', () => {
  it('APP LT escritorio y mesa de juntas sí; bancas por usuario y escritorio en L no', () => {
    const applt = lineasEscalables().find((l) => l.ruta === 'applt');
    const ids = applt.productos.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['escritorio', 'mesa_juntas', 'mesa_circular']));
    expect(ids).not.toContain('banca_doble');
    expect(ids).not.toContain('banca_sencilla');
    expect(ids).not.toContain('escritorio_l');
  });

  it('un producto que crece por módulos no se escala: lo dice y no inventa', () => {
    const r = padreDeLinea({ ruta: 'applt', productoId: 'banca_doble', dims: { ancho_mm: 3000, prof_mm: 1200 } });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/módulos|usuarios/);
  });

  it('el padre es el despiece REAL del generador en la medida de catálogo más cercana', () => {
    const r = padreDeLinea({ ruta: 'applt', productoId: 'mesa_juntas', dims: { ancho_mm: 1320, prof_mm: 1200 } });
    expect(r.ok).toBe(true);
    expect(r.base).toEqual({ ancho_mm: 1200, prof_mm: 1200, alto_mm: null });
    expect(r.componentes.some((c) => c.largoMM === 1200 && c.anchoMM === 1200)).toBe(true);
  });
});

describe('Escalado geométrico: el tablero se cobra por ACOMODO EN HOJA, no por regla de tres', () => {
  it('cubierta 1200×1200 → 1350×1200: deja de caber 2 por hoja y cobra la hoja completa', () => {
    const r = bajarLineaABom(intentMesa({ ancho_mm: 1350, prof_mm: 1200, alto_mm: 740 }), { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    expect(r.ok).toBe(true);
    const cub = r.intent._componentes.find((c) => /Cubierta/.test(c.nombre) && c.largoMM);
    expect([cub.largoMM, cub.anchoMM]).toEqual([1350, 1200]);

    const padre = costo(r.padre.componentes).detalleInsumos.find((d) => d.insumoId === cub.insumoId);
    const hijo = costo(r.intent._componentes).detalleInsumos.find((d) => d.insumoId === cub.insumoId);
    const precioHoja = insumos[cub.insumoId].precio;
    // Padre: 2 cubiertas por hoja (½ hoja). Hijo: 1 por hoja (hoja entera), como carga el ERP.
    expect(padre.costo).toBeCloseTo(precioHoja * 0.5, 2);
    expect(hijo.costo).toBeCloseTo(precioHoja * 1, 2);
    // La regla de tres (½ × 1350/1200 = 0.5625 hoja) habría cobrado ~44 % menos de tablero.
    const reglaDeTres = padre.costo * (1350 / 1200);
    expect(hijo.costo / reglaDeTres).toBeGreaterThan(1.7);
  });

  it('el canto se recalcula con el perímetro nuevo de SU cubierta', () => {
    const r = bajarLineaABom(intentMesa({ ancho_mm: 1350, prof_mm: 1200 }), { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    const canto = r.intent._componentes.find((c) => c.insumoId === 'perfil-canto-applt');
    expect(canto.cantidad).toBeCloseTo((2 * (1350 + 1200)) / 1000, 6);
    expect(r.escalado.trazas.some((t) => /perímetro/.test(t.regla))).toBe(true);
  });

  it('lo que no tiene geometría en el padre se conserva y se AVISA (ESTIMADO), no se estira en silencio', () => {
    const r = bajarLineaABom({ familia: 'ESCRITORIO', dimensiones: { ancho_mm: 1650, prof_mm: 700 }, caracteristicas: [] }, { ruta: 'applt', productoId: 'escritorio' }, { insumos });
    expect(r.ok).toBe(true);
    expect(r.escalado.conservados.map((x) => x.pieza).join(' ')).toMatch(/Pata U/);
    expect(r.escalado.avisos.join(' ')).toMatch(/ESTIMADO/);
    expect(r.escalado.confianza).toBe('baja');
  });

  it('pieza vertical: su altura no "coincide" con el fondo (costado 600×590 con fondo 600)', () => {
    expect(ejeDePiezaVertical('Credenza · lateral')).toBe('prof_mm');
    expect(ejeDePiezaVertical('Credenza · puerta abatible')).toBe('ancho_mm');
    const esc = escalarDespiece(
      [{ nombre: 'Credenza · lateral', insumoId: 'melamina-19', largoMM: 600, anchoMM: 590, piezas: 2 },
       { nombre: 'Credenza · respaldo', insumoId: 'melamina-19', largoMM: 2100, anchoMM: 590, piezas: 1 }],
      { ancho_mm: 2100, prof_mm: 600, alto_mm: null }, { ancho_mm: 2000, prof_mm: 500, alto_mm: 750 }, { insumos });
    expect([esc.componentes[0].largoMM, esc.componentes[0].anchoMM]).toEqual([500, 590]);
    expect([esc.componentes[1].largoMM, esc.componentes[1].anchoMM]).toEqual([2000, 590]);
    expect(esc.avisos.join(' ')).toMatch(/no declara su alto/);
  });

  it('determinista: misma entrada ⇒ mismo BOM ⇒ mismo spec hash', () => {
    const a = bajarLineaABom(intentMesa({ ancho_mm: 1350, prof_mm: 1200 }), { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    const b = bajarLineaABom(intentMesa({ ancho_mm: 1350, prof_mm: 1200 }), { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    expect(specDeCocreacion(a.intent, [{}]).hash).toBe(specDeCocreacion(b.intent, [{}]).hash);
  });

  it('en la medida de catálogo exacta NO se co-crea: se manda a la línea (precio de lista intacto)', () => {
    const r = bajarLineaABom(intentMesa({ ancho_mm: 1500, prof_mm: 1200 }), { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    expect(r.ok).toBe(false);
    expect(r.mismaMedida).toBe(true);
    expect(r.motivo).toMatch(/precio de lista/);
  });
});

describe('Concepto → BOM → costo: especial derivado, Alba V1 × dificultad, nunca inventado', () => {
  it('el cambio de medida queda como DERIVED_SPECIAL con linaje y costo emitible por el motor', () => {
    const r = bajarLineaABom(intentMesa({ ancho_mm: 1350, prof_mm: 1200 }), { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    const p = cocrearDesdeIntent(r.intent, { insumos, par: {}, rev: 2, componentes: r.intent._componentes });
    expect(p.spec.clasificacion).toBe(CLASIFICACION.DERIVED_SPECIAL);
    expect(p.spec.parent_product_id).toBe('applt:mesa_juntas');
    expect(p.spec.change_set.some((c) => c.tipo === 'dimensional')).toBe(true);
    expect(p.costo.cost_status).toBe(COST_STATUS.KNOWN);
    expect(p.costo.official_cost).toBeGreaterThan(0);
    // Costo conocido ≠ producto liberado: el especial requiere validación de ingeniería.
    expect(p.lineaCotizacion.listaParaCotizar).toBe(false);
  });

  it('la dificultad multiplica la MO de Alba y viaja en el spec (normal = fórmula de siempre)', () => {
    const base = bajarLineaABom(intentMesa({ ancho_mm: 1350, prof_mm: 1200 }), { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    const dificil = bajarLineaABom(intentMesa({ ancho_mm: 1350, prof_mm: 1200 }), { ruta: 'applt', productoId: 'mesa_juntas', dificultad: 'dificil' }, { insumos });
    const pN = cocrearDesdeIntent(base.intent, { insumos, componentes: base.intent._componentes });
    const pD = cocrearDesdeIntent(dificil.intent, { insumos, componentes: dificil.intent._componentes });
    expect(pN.spec.dificultad).toBeUndefined();
    expect(pD.spec.dificultad).toBe('dificil');
    expect(pD.costo.costeo.manoObra).toBeCloseTo(pN.costo.costeo.manoObra * DIFICULTAD.dificil, 6);
    expect(pD.costo.official_cost).toBeGreaterThan(pN.costo.official_cost);
    // Paridad con el motor directo: misma pieza técnica.
    const directo = calcular({ componentes: dificil.intent._componentes, modoManoObra: 'porcentaje', dificultad: 'dificil' }, 1, insumos, {});
    expect(pD.costo.official_cost).toBeCloseTo(directo.costoOficial, 6);
  });

  it('una función del concepto sin despiece (electrificación) entra PENDIENTE: costo incompleto, no $0', () => {
    const r = bajarLineaABom(intentMesa({ ancho_mm: 1350, prof_mm: 1200 }, ['electrificacion_integrada', 'layout_isla_continua']), { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    const pend = r.intent._componentes.filter((c) => c._funcion);
    expect(pend.map((c) => c._funcion)).toEqual(['electrificacion_integrada']);   // el layout no pide despiece
    const p = cocrearDesdeIntent(r.intent, { insumos, componentes: r.intent._componentes });
    expect(p.costo.official_cost).toBeNull();
    expect(costeoEmitible(p.costo.costeo).emitible).toBe(false);
    // Al quitar la función, la pieza pendiente se va y el costo vuelve a ser emitible.
    const sin = sincronizarFuncionesPendientes({ ...r.intent, caracteristicas: ['layout_isla_continua'] });
    expect(sin._componentes.some((c) => c._funcion)).toBe(false);
    expect(cocrearDesdeIntent(sin, { insumos, componentes: sin._componentes }).costo.official_cost).toBeGreaterThan(0);
  });

  it('cambiar la medida después re-escala desde el padre; volver a la de catálogo suelta el BOM', () => {
    const r = bajarLineaABom(intentMesa({ ancho_mm: 1350, prof_mm: 1200 }), { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    const mas = reescalarSiAplica({ ...r.intent, dimensiones: { ancho_mm: 1700, prof_mm: 1200 } }, { insumos });
    expect(mas.cambio).toBe(true);
    expect(mas.intent._componentes.find((c) => c.largoMM && /Cubierta/.test(c.nombre)).largoMM).toBe(1700);
    const catalogo = reescalarSiAplica({ ...r.intent, dimensiones: { ancho_mm: 1800, prof_mm: 1200 } }, { insumos });
    expect(catalogo.intent._componentes).toBeUndefined();
    expect(catalogo.motivo).toMatch(/precio de lista/);
  });

  it('D-01 con los conceptos de la UI: brief → concepto → bajar a BOM → costo emitible', () => {
    const base = prepararIntentCocrear('Mesa de juntas de 1.35 m por 1.20 m de fondo, melamina');
    const intent = aplicarConceptoCocrear(base, conceptosCocrear(base)[0]);   // A · Esencial (sin funciones extra)
    const r = bajarLineaABom(intent, { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    expect(r.ok).toBe(true);
    const p = cocrearDesdeIntent(r.intent, { insumos, componentes: r.intent._componentes, rev: 2 });
    expect(p.spec.componentes.length).toBeGreaterThan(0);
    expect(p.costo.official_cost).toBeGreaterThan(0);
  });
});

describe('Mueble nuevo: Pasar a Costear y regresar con el BOM', () => {
  it('la semilla lleva nombre, medidas, materiales, funciones y descripción (nada de dinero)', () => {
    const intent = { ...prepararIntentCocrear('Recepción curva de 2.4 m en nogal con iluminación'), _concepto_nombre: 'Signature' };
    const s = semillaCostearDesdeCocrear(intent, { brief: 'Recepción curva de 2.4 m en nogal con iluminación', expedienteId: 7, imagen: { base64: 'AAA', mediaType: 'image/jpeg' } });
    expect(s.origen).toBe('cocrear');
    expect(s.nombre).toBe('Signature');
    expect(s.medidas.ancho_mm).toBe(2400);
    expect(s.descripcion).toMatch(/2400 mm de ancho/);
    expect(s.descripcion).toMatch(/nogal/);
    expect(s.descripcion).toMatch(/Iluminación integrada/);
    expect(s.imagen).toEqual({ base64: 'AAA', mediaType: 'image/jpeg', url: null });
    expect(JSON.stringify(s)).not.toMatch(/precio|costo|margen/i);
  });

  it('el regreso aplica sólo campos técnicos, marca procedencia y deja de valer si cambian las medidas', () => {
    const intent = prepararIntentCocrear('Recepción curva de 2.4 m');
    const r = aplicarRetornoCosteo(intent, {
      componentes: [{ nombre: 'Cubierta', insumoId: 'melamina-28', largoMM: 2400, anchoMM: 700, piezas: 1, precio: 1, costoUnitario: 99, insumo: { precio: 1 } }],
      dificultad: 'dificil', analysisId: 3,
    });
    expect(r.ok).toBe(true);
    expect(r.intent._componentes[0]).toEqual({ nombre: 'Cubierta', insumoId: 'melamina-28', largoMM: 2400, anchoMM: 700, piezas: 1 });
    expect(r.intent._puente.tipo).toBe('costear');
    expect(r.intent._dificultad).toBe('dificil');
    expect(despieceVigente(r.intent)).toBe(true);
    expect(despieceVigente({ ...r.intent, dimensiones: { ...r.intent.dimensiones, ancho_mm: 2600 } })).toBe(false);
  });

  it('Costear sin despiece no aplica nada', () => {
    expect(aplicarRetornoCosteo({}, { componentes: [] }).ok).toBe(false);
  });
});

// E2E 2026-10-20: "escritorio 1.60 en melamina nogal claro" → el despiece escalado salía en Ivory.
describe('Cocrear · el despiece escalado respeta el material pedido', () => {
  it('nogal ⇒ color nogal/walnut de la línea; sin material ⇒ el del padre', async () => {
    const { bajarLineaABom } = await import('./cocrearPuente.js');
    const intent = { dimensiones: { ancho_mm: 1600, prof_mm: 700 }, materiales: [{ material: 'nogal', tono: 'claro' }], caracteristicas: [] };
    const r = bajarLineaABom(intent, { ruta: 'applt', productoId: 'escritorio' });
    expect(r.ok).toBe(true);
    expect(String(r.padre.config.color || '')).toMatch(/walnut|nogal/);
    const sin = bajarLineaABom({ ...intent, materiales: [] }, { ruta: 'applt', productoId: 'escritorio' });
    expect(sin.ok).toBe(true);
    expect(String(sin.padre.config.color || '')).not.toMatch(/walnut|nogal/);
  });
});
