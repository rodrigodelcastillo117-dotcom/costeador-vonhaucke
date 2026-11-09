// ============================================================================
//  LABORATORIO DE CERTIFICACIÓN · TELCEL (4) + Alpura (ENTCBCALP) + COPETE.
//  Corre el MOTOR REAL (costearBOM + semáforo) sobre un snapshot de SÓLO LECTURA
//  de producción (producto_maestro + catalogo_vigente, 2026-11-09). Fija, como
//  test permanente anti-regresión, el estado HONESTO de certificación de cada
//  mueble y QUÉ lo bloquea — sin inventar precios ni ajustar factores.
//
//  Verdad medida hoy: los 6 son EMITIBLES pero NINGUNO certifica. Dos causas,
//  separadas y nombradas:
//    · PRECIO VIEJO (>24 m, el servidor lo marca PRELIMINAR): 4 insumos
//      (erp-pph-a529, erp-pph-a10, erp-ln1848, erp-me258ex) → Compras refresca.
//    · IDENTIDAD PENDIENTE (línea sin insumoId): Ingeniería/Compras da de alta.
//  HORIZONTAL y TORRE están 100% mapeados: su ÚNICO bloqueo es precio viejo —
//  en cuanto Compras refresca esos precios, CERTIFICAN (se prueba abajo).
// ============================================================================
import { describe, it, expect } from 'vitest';
import FIX from './fixtures/telcel_alpura_prod_20261109.json';
import { costearBOM } from './productoMaestro.js';
import { semaforoCertificacion } from './semaforoCertificacion.js';

const bomDe = (clave) => FIX.boms.find((b) => b.clave === clave);
// Este lab mide FRESCURA e IDENTIDAD, no compatibilidad de unidad: la unidad de CONSUMO que
// expone el motor (RPC buscar_insumos_motor) puede diferir de `unidad_compra` del catálogo, y la
// compatibilidad de unidad ya la cubren P0-02 / calculo.test. Por eso el catálogo del lab no fija
// `unidad` (sólo precio + evidencia de frescura); así no se afirma un bloqueo de unidad incierto.
const catalogo = Object.fromEntries(Object.entries(FIX.catalogo).map(([id, i]) => [id, { precio: i.precio, evidencia: i.evidencia }]));
// Catálogo "refrescado": los 4 insumos vencidos vuelven certificables (simula la carga de Compras del lunes).
const catalogoFresco = Object.fromEntries(Object.entries(catalogo).map(
  ([id, ins]) => [id, { ...ins, evidencia: { certificable: true } }]
));
const pesos = (x) => Number(x).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Imprime el expediente (evidencia reproducible de "cómo llegó al número").
function expediente(clave, insumos = catalogo) {
  const r = costearBOM(bomDe(clave), insumos);
  const pend = r.lineas.filter((l) => l.fuente === 'confirmado' || l.bloquea).length;
  return { r, pend };
}

describe('Laboratorio TELCEL/Alpura · estado de certificación con datos reales', () => {
  it('ninguno de los 6 certifica HOY, y el motor dice exactamente por qué', () => {
    for (const b of FIX.boms) {
      const r = costearBOM(b, catalogo);
      expect(r.certificable, `${b.clave} no debe certificar con datos de hoy`).toBe(false);
      // documenta el costo real reproducible y el desglose de bloqueo
      // eslint-disable-next-line no-console
      console.log(`${b.clave.padEnd(20)} emitible=${r.emitible} cert=${r.certificable} ` +
        `MP=$${pesos(r.material)} fab=$${pesos(r.costoFabricacion)} ` +
        `| precios viejos=${r.cobertura.catalogoViejo} histórico/pend=${r.cobertura.conConfirmado} bloqueos=${r.cobertura.bloqueos}`);
    }
  });

  it('HORIZONTAL: 100% mapeado; único bloqueo = 2 pinturas vencidas; con precio fresco CERTIFICA', () => {
    const { r } = expediente('TELCEL-VH-HORIZONTAL');
    expect(r.emitible).toBe(true);
    expect(r.orientativo).toBe(false);                 // nada histórico: todo mapea al catálogo
    expect(r.cobertura.conConfirmado).toBe(0);
    expect(r.cobertura.catalogoViejo).toBe(2);         // erp-pph-a529 + erp-pph-a10
    expect(r.certificable).toBe(false);                // bloqueado SÓLO por precio viejo
    // Compras refresca esos 2 precios → certifica, sin tocar el BOM.
    const fresco = costearBOM(bomDe('TELCEL-VH-HORIZONTAL'), catalogoFresco);
    expect(fresco.certificable).toBe(true);
  });

  it('TORRE: 100% mapeado; único bloqueo = 3 insumos vencidos; con precio fresco CERTIFICA', () => {
    const { r } = expediente('TELCEL-VH-TORRE');
    expect(r.emitible).toBe(true);
    expect(r.orientativo).toBe(false);
    expect(r.cobertura.catalogoViejo).toBe(3);         // me258ex + pph-a10 + pph-a529
    expect(r.certificable).toBe(false);
    expect(costearBOM(bomDe('TELCEL-VH-TORRE'), catalogoFresco).certificable).toBe(true);
  });

  it('ISLA y ALMACEN: precio fresco NO basta — tienen identidades pendientes (Ingeniería)', () => {
    for (const clave of ['TELCEL-VH-ISLA', 'TELCEL-MOD-ALMACEN']) {
      const r = costearBOM(bomDe(clave), catalogo);
      expect(r.cobertura.conConfirmado, `${clave} tiene líneas sin insumoId`).toBeGreaterThan(0);
      // aun refrescando TODOS los precios, siguen sin certificar por las identidades pendientes
      expect(costearBOM(bomDe(clave), catalogoFresco).certificable, `${clave} aún con pendientes`).toBe(false);
    }
  });

  it('ENTCBCALP (Alpura): 10 líneas sin insumoId → orientativo; no certifica ni con precios frescos', () => {
    const r = costearBOM(bomDe('ENTCBCALP'), catalogo);
    expect(r.cobertura.conConfirmado).toBeGreaterThanOrEqual(10);
    expect(r.certificable).toBe(false);
    expect(costearBOM(bomDe('ENTCBCALP'), catalogoFresco).certificable).toBe(false);
  });

  it('los 4 insumos vencidos del snapshot son exactamente los que el catálogo marca no-certificables', () => {
    const vencidos = Object.entries(catalogo).filter(([, ins]) => ins.evidencia.certificable === false).map(([id]) => id).sort();
    expect(vencidos).toEqual([...FIX.stale].sort());
  });

  it('el semáforo nombra la acción y al responsable por cada hueco', () => {
    const sem = semaforoCertificacion(costearBOM(bomDe('TELCEL-VH-HORIZONTAL'), catalogo));
    expect(sem.resumen.ambar).toBe(2);                 // 2 pinturas vencidas
    expect(sem.acciones.some((a) => /compras/i.test(a.accion))).toBe(true);
  });
});
