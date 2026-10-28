// ============================================================================
//  ALTERNATIVAS DE CATÁLOGO — el reclamo de Rodrigo (2026-10-28):
//  "si dice cristal 3 mm, la app no dice no tenemos de 3 mm, proponemos de 4 o 2".
//
//  El fixture imita el catálogo REAL de producción: el espesor vive en el NOMBRE
//  (la columna espesor_mm está 100% vacía), la familia viene SUCIA (una bisagra
//  "para cristal" marcada familia:'cristal'), y el 3 mm NO existe.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { proponerAlternativas, fraseAlternativas, alternativasParaPiezas } from './alternativasCatalogo.js';
import { MATCH } from './materialMatch.js';

// Catálogo-fixture realista (espesor en el nombre; sin espesor_mm estructurado).
const CATALOGO = [
  { id: 'cris-2', nombre: 'Cristal templado 2 mm', precio: 98 },
  { id: 'cris-4', nombre: 'Cristal templado 4 mm', precio: 123 },
  { id: 'cris-6', nombre: 'Cristal templado 6 mm', precio: 180 },
  { id: 'cris-9', nombre: 'Cristal templado 9 mm', precio: 260 },
  // CONTAMINACIÓN real del catálogo: una bisagra "para cristal" NO es cristal.
  { id: 'erp-bisagra', nombre: 'BISAGRA PARA PUERTA DE CRISTAL A MURO ACERO SATINADO', precio: 45 },
  // Otra familia, no debe aparecer en una propuesta de cristal.
  { id: 'mel-19', nombre: 'Melamina blanca 19 mm', precio: 410 },
];

describe('proponerAlternativas · el caso exacto de Rodrigo (cristal 3 mm)', () => {
  it('no hay 3 mm → propone 2 mm y 4 mm, ordenados por CERCANÍA (4 y 2 antes que 6 y 9)', () => {
    const r = proponerAlternativas('cristal templado 3 mm', CATALOGO, { veCostos: true, max: 4 });
    expect(r.familiaSolicitada).toBe('cristal');
    expect(r.espesorSolicitadoMM).toBe(3);
    expect(r.hayExacto).toBe(false);
    // Los dos primeros son los más cercanos a 3: 2 mm (|−1|) y 4 mm (|+1|).
    const esp = r.alternativas.map((a) => a.espesorMM);
    expect(esp.slice(0, 2).sort((x, y) => x - y)).toEqual([2, 4]);
    // 6 y 9 quedan después.
    expect(esp.slice(2)).toEqual([6, 9]);
  });

  it('cristal es familia CRÍTICA: la propuesta es por confirmar, NO autocosteable', () => {
    const r = proponerAlternativas('cristal templado 3 mm', CATALOGO, { veCostos: true });
    for (const a of r.alternativas) {
      expect(a.clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
      expect(a.autocosteable).toBe(false);          // no entra al costo solo
      expect(a.cambio).toMatch(/3 mm → candidato \d/); // "Solicitado 3 mm → candidato 4 mm"
    }
  });

  it('trae el PRECIO REAL del catálogo, nunca inventa un precio de 3 mm', () => {
    const r = proponerAlternativas('cristal templado 3 mm', CATALOGO, { veCostos: true });
    const porId = Object.fromEntries(r.alternativas.map((a) => [a.id, a]));
    expect(porId['cris-2'].precio).toBe(98);
    expect(porId['cris-4'].precio).toBe(123);
    // No existe ninguna alternativa que afirme ser "3 mm".
    expect(r.alternativas.some((a) => a.espesorMM === 3)).toBe(false);
  });

  it('NO cruza familia ni cuela el herraje contaminado', () => {
    const r = proponerAlternativas('cristal templado 3 mm', CATALOGO, { veCostos: true, max: 10 });
    const ids = r.alternativas.map((a) => a.id);
    expect(ids).not.toContain('erp-bisagra'); // la bisagra "para cristal" es herraje, no cristal
    expect(ids).not.toContain('mel-19');      // melamina es otra familia
    expect(r.totalMismaFamilia).toBe(4);      // sólo las 4 hojas de cristal
  });
});

describe('proponerAlternativas · seller-safe', () => {
  it('sin costos: ofrece el material pero OCULTA el precio', () => {
    const r = proponerAlternativas('cristal templado 3 mm', CATALOGO, { veCostos: false });
    expect(r.alternativas.length).toBeGreaterThan(0);
    for (const a of r.alternativas) {
      expect(a.precio).toBeNull();
      expect(a.precioOculto).toBe(true);
    }
  });
});

describe('proponerAlternativas · panel (misma familia, variante compatible)', () => {
  it('melamina 18 mm (no existe) → propone 19 mm como COMPATIBLE autocosteable por confirmar', () => {
    const cat = [{ id: 'mel-19', nombre: 'Melamina blanca 19 mm', precio: 410 }];
    const r = proponerAlternativas('melamina blanca 18 mm', cat, { veCostos: true });
    expect(r.alternativas).toHaveLength(1);
    expect(r.alternativas[0].clase).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(r.alternativas[0].autocosteable).toBe(true);
  });
});

describe('proponerAlternativas · casos límite (honestidad)', () => {
  it('familia sin NINGÚN insumo → no inventa, lo dice', () => {
    const r = proponerAlternativas('superficie sólida azul 12 mm', CATALOGO);
    expect(r.alternativas).toHaveLength(0);
    expect(r.motivo).toMatch(/no tiene NING[UÚ]N insumo/i);
  });

  it('material no reconocido → no propone nada', () => {
    const r = proponerAlternativas('cosa rara xyz', CATALOGO);
    expect(r.familiaSolicitada).toBe('');
    expect(r.alternativas).toHaveLength(0);
  });
});

describe('alternativasParaPiezas · cableado a la UI de Costear', () => {
  const INSUMOS = {
    'cris-2': { id: 'cris-2', nombre: 'Cristal templado 2 mm', precio: 98, unidad: 'm2', seccion: 'cristal' },
    'cris-4': { id: 'cris-4', nombre: 'Cristal templado 4 mm', precio: 123, unidad: 'm2', seccion: 'cristal' },
    'mel-19': { id: 'mel-19', nombre: 'Melamina blanca 19 mm', precio: 410, unidad: 'hoja', seccion: 'tableros' },
  };

  it('sólo propone para piezas PENDIENTES; la pieza con material resuelto no', () => {
    const comps = [
      { nombre: 'Capelo', material_solicitado: 'cristal templado 3 mm' },             // sin insumoId → pendiente
      { nombre: 'Costado', insumoId: 'mel-19', material_solicitado: 'melamina 19 mm' }, // resuelto → NO pendiente
    ];
    const mapa = alternativasParaPiezas(comps, INSUMOS, { veCostos: true });
    expect(Object.keys(mapa)).toEqual(['0']);                 // sólo la pieza 0
    expect(mapa[0].alternativas.map((a) => a.id).sort()).toEqual(['cris-2', 'cris-4']);
    expect(mapa[0].alternativas.find((a) => a.id === 'cris-4').unidad).toBe('m2'); // la unidad viaja para la UI
  });

  it('no propone para piezas excluidas ni "sin precio certificado" (tienen su propio aviso)', () => {
    const comps = [
      { nombre: 'Equipo cliente', material_solicitado: 'cristal 3 mm', excluida: true },
      { nombre: 'Vidrio real', material_solicitado: 'cristal 3 mm', _match: { sinPrecioCertificado: true } },
    ];
    expect(alternativasParaPiezas(comps, INSUMOS, { veCostos: true })).toEqual({});
  });

  it('seller-safe: sin costos, las alternativas de pantalla ocultan el precio', () => {
    const comps = [{ nombre: 'Capelo', material_solicitado: 'cristal templado 3 mm' }];
    const mapa = alternativasParaPiezas(comps, INSUMOS, { veCostos: false });
    expect(mapa[0].alternativas.every((a) => a.precio === null && a.precioOculto === true)).toBe(true);
  });
});

describe('fraseAlternativas · texto para la UI', () => {
  it('arma "No hay cristal de 3 mm. Lo más cercano: … — elige (por confirmar)."', () => {
    const r = proponerAlternativas('cristal templado 3 mm', CATALOGO, { veCostos: true });
    const f = fraseAlternativas(r, { pesos: (n) => `$${n}` });
    expect(f).toMatch(/^No hay cristal de 3 mm\./);
    expect(f).toMatch(/Lo más cercano:/);
    expect(f).toMatch(/elige \(por confirmar\)\.$/);
    expect(f).toContain('mm');
  });

  it('sin costos: la frase NO muestra precios', () => {
    const r = proponerAlternativas('cristal templado 3 mm', CATALOGO, { veCostos: false });
    const f = fraseAlternativas(r);
    expect(f).not.toMatch(/\$/);
  });
});
