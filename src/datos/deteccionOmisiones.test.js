// COSTEAR 100 · FASE 11 + 22 — detector de omisiones / ingeniería invisible.
// El detector PROPONE componentes/operaciones implícitos pero ausentes; NUNCA agrega
// cantidades ni cambia el BOM; clasifica severidad+certeza; sólo bloquea ante omisión
// funcional crítica; respeta exclusiones confirmadas.
import { describe, it, expect } from 'vitest';
import { detectarOmisiones, reglasDeOmision } from './deteccionOmisiones.js';

const clave = (r, k) => r.hallazgos.find((h) => h.regla === k);

describe('deteccionOmisiones · reglas de componentes implícitos', () => {
  it('puerta SIN bisagra → RIESGO por_confirmar (no bloquea; podría ser corrediza/pivote)', () => {
    const r = detectarOmisiones({ piezas: [{ nombre: 'Puerta', semantic_role: 'puerta', piezas: 2 }] });
    const h = clave(r, 'puertas_sin_bisagra');
    expect(h).toBeTruthy();
    expect(h.severidad).toBe('RIESGO');
    expect(h.certeza).toBe('POR_CONFIRMAR');
    expect(h.bloquea_certificacion).toBe(false);
    expect(h.mensaje).toMatch(/2 puerta/);
  });

  it('puerta CON bisagra → NO marca omisión de bisagra (evita falso positivo)', () => {
    const r = detectarOmisiones({ piezas: [
      { nombre: 'Puerta', semantic_role: 'puerta' },
      { nombre: 'Bisagra recta 110°', semantic_role: 'herraje' },
    ] });
    expect(clave(r, 'puertas_sin_bisagra')).toBeFalsy();
  });

  it('cajón SIN corredera → RIESGO', () => {
    const r = detectarOmisiones({ piezas: [{ nombre: 'Cajón', semantic_role: 'gaveta' }] });
    expect(clave(r, 'cajones_sin_corredera')).toBeTruthy();
  });

  it('LED SIN driver → OMISIÓN que BLOQUEA certificación (no funciona sin alimentación)', () => {
    const r = detectarOmisiones({ piezas: [{ nombre: 'Tira LED 12V 5m' }] });
    const h = clave(r, 'led_sin_driver');
    expect(h).toBeTruthy();
    expect(h.severidad).toBe('OMISION');
    expect(h.bloquea_certificacion).toBe(true);
    expect(r.resumen.bloquea_certificacion).toBe(true);
  });

  it('LED CON driver → no marca omisión y NO bloquea', () => {
    const r = detectarOmisiones({ piezas: [
      { nombre: 'Tira LED 12V 5m' },
      { nombre: 'Driver / fuente de poder 60W 12V' },
    ] });
    expect(clave(r, 'led_sin_driver')).toBeFalsy();
    expect(r.resumen.bloquea_certificacion).toBe(false);
  });

  it('vidrio SIN fijación → RIESGO', () => {
    const r = detectarOmisiones({ piezas: [{ nombre: 'Cristal templado 6 mm', semantic_role: 'cristal' }] });
    expect(clave(r, 'vidrio_sin_fijacion')).toBeTruthy();
  });

  it('estructura metálica SIN operación de unión → RIESGO (routing incompleto)', () => {
    const r = detectarOmisiones({ piezas: [
      { nombre: 'Lámina negra calibre 18' },
      { nombre: 'Tubular industrial 1"' },
    ] });
    expect(clave(r, 'metal_sin_union')).toBeTruthy();
  });

  it('estructura metálica CON soldadura en el routing → no marca omisión de unión', () => {
    const r = detectarOmisiones({
      piezas: [{ nombre: 'Lámina negra calibre 18' }, { nombre: 'Tubular industrial 1"' }],
      operaciones: ['Corte de lámina', 'Soldadura MIG', 'Esmerilado'],
    });
    expect(clave(r, 'metal_sin_union')).toBeFalsy();
  });
});

describe('deteccionOmisiones · reglas de casa (propone, no impone)', () => {
  it('exclusión confirmada por humano apaga la regla (DESCARTADO)', () => {
    const base = { piezas: [{ nombre: 'Puerta', semantic_role: 'puerta' }] };
    expect(clave(detectarOmisiones(base), 'puertas_sin_bisagra')).toBeTruthy();
    const conExcl = detectarOmisiones({ ...base, exclusiones: ['puertas_sin_bisagra'] });
    expect(clave(conExcl, 'puertas_sin_bisagra')).toBeFalsy();
  });

  it('NUNCA agrega cantidades ni muta el BOM de entrada', () => {
    const piezas = [{ nombre: 'Puerta', semantic_role: 'puerta' }, { nombre: 'Tira LED' }];
    const copia = JSON.parse(JSON.stringify(piezas));
    const r = detectarOmisiones({ piezas });
    // entrada intacta
    expect(piezas).toEqual(copia);
    // ningún hallazgo trae cantidades ni se hace pasar por renglón de BOM
    for (const h of r.hallazgos) {
      expect(h).not.toHaveProperty('cantidad');
      expect(h).not.toHaveProperty('piezas');
      expect(h).not.toHaveProperty('insumoId');
      expect(['OMISION', 'RIESGO', 'SUGERENCIA']).toContain(h.severidad);
      expect(['INFERIDO', 'POR_CONFIRMAR']).toContain(h.certeza); // nunca DOCUMENTADO
    }
  });

  it('ordena por severidad: OMISION antes que SUGERENCIA', () => {
    // LED sin driver (OMISION) + 3 tableros melamina sin canto (SUGERENCIA)
    const r = detectarOmisiones({ piezas: [
      { nombre: 'Tira LED' },
      { nombre: 'Cubierta melamina', semantic_role: 'cubierta' },
      { nombre: 'Lateral melamina', semantic_role: 'lateral' },
      { nombre: 'Entrepaño melamina', semantic_role: 'entrepano' },
    ] });
    expect(r.hallazgos[0].severidad).toBe('OMISION');
    expect(r.hallazgos.at(-1).severidad).toBe('SUGERENCIA');
  });

  it('reglasDeOmision expone las claves disponibles', () => {
    const claves = reglasDeOmision().map((x) => x.clave);
    expect(claves).toContain('led_sin_driver');
    expect(claves).toContain('metal_sin_union');
    expect(claves.length).toBeGreaterThanOrEqual(8);
  });
});

describe('deteccionOmisiones · módulo REAL TELCEL (C-CO-320R · Almacenamiento METAL)', () => {
  // Materiales reales del golden telcelCCO320R (id_04). Tiene lámina negra, pintura en
  // polvo, 4 BISAGRAS y una cubierta MDF. El detector NO debe inventar "puertas sin
  // bisagra" (las bisagras están) ni BLOQUEAR el costo (no hay omisión funcional crítica).
  const piezasTelcel = [
    { nombre: 'LAMINA NEGRA HOJA 3 X 8 CALIBRE 18 ACERO 1008 - LN1838' },
    { nombre: 'LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 - LN18310' },
    { nombre: 'LAMINA NEGRA HOJA 4 X 8 CALIBRE 18 ACERO 1008 - LN1848' },
    { nombre: 'PINTURA EN POLVO - PPH (COLOR METAL BLANCO 9016 TELCEL)' },
    { nombre: 'PINTURA EN POLVO - PPH (COLOR METAL RAL 5002 AZUL TELCEL)' },
    { nombre: 'BISAGRA BIDIMENSIONAL, MONTAJE SOBREPUESTO, ANGULO DE 110° - BIBI', semantic_role: 'herraje', piezas: 4 },
    { nombre: 'Superficie de trabajo, cubierta MDF 12mm una cara laminado blanco', semantic_role: 'cubierta' },
  ];

  it('NO marca puertas_sin_bisagra (las bisagras existen) y NO bloquea certificación', () => {
    const r = detectarOmisiones({ piezas: piezasTelcel });
    expect(clave(r, 'puertas_sin_bisagra')).toBeFalsy();
    expect(r.resumen.bloquea_certificacion).toBe(false);
  });

  it('SÍ observa que la estructura metálica no tiene operación de unión costeada (routing incompleto)', () => {
    const r = detectarOmisiones({ piezas: piezasTelcel });
    const h = clave(r, 'metal_sin_union');
    expect(h).toBeTruthy();
    expect(h.severidad).toBe('RIESGO');
  });
});
