// LAB COCREAR 10 (lab/noche/cocrear10): el brief de Cocrear perdía medidas y capacidad.
//  · COC-02 "Mesa de juntas … de 3600 x 1200 mm, altura 750 mm" → la UI abría el estudio con ANCHO 1200 (la
//    primera cifra con unidad pegada) y fondo/alto por defecto 1100/740.
//  · COC-07 "1.80 m de largo por 0.60 m de fondo y 1.05 m de altura" → sólo ancho; fondo/alto por defecto.
//  · COC-01 "Credenza … con 4 puertas" → "Capacidad: 4 usuarios" ("4 p…" se leía como "4 pax").
//  · COC-06 "Banca de espera de 4 plazas" → capacidad "por definir".
// Causa raíz: `interpretarIntent` sólo leía UNA medida (`t.match(/(\d+)\s*(mm|cm|m)\b/)` → ancho) y `nPersonas`
// (cocrearWow) aceptaba `(\d+)\s*p` sin límite de palabra; ninguno conocía "plazas"/"asientos".
//  · COC-03 "accesible para silla de ruedas" agregaba la función Ruedas.
//  · COC-05 "Haz el retorno de la L de 1200 mm de largo…" sumaba 1200 mm al ancho (`aplicarCambioTexto` aplicaba
//    cualquier cifra a la envolvente y "de largo" contaba como "más largo").
import { describe, it, expect } from 'vitest';
import { interpretarIntent, aplicarCambioTexto } from './cocrear.js';
import { prepararIntentCocrear } from './cocrearWow.js';

describe('Cocrear · medidas del brief (lab COC-02/07)', () => {
  it('serie "A x B mm" + "altura" etiquetada → ancho, fondo y alto', () => {
    const i = interpretarIntent('Mesa de juntas para 10 personas de 3600 x 1200 mm, altura 750 mm, cubierta de nogal');
    expect(i.dimensiones).toEqual({ ancho_mm: 3600, prof_mm: 1200, alto_mm: 750 });
    expect(i.desconocidos).not.toContain('dimensiones');
  });
  it('medidas etiquetadas "de largo / de fondo / de altura" en metros', () => {
    const i = interpretarIntent('Mesa alta tipo barra, 1.80 m de largo por 0.60 m de fondo y 1.05 m de altura');
    expect(i.dimensiones).toEqual({ ancho_mm: 1800, prof_mm: 600, alto_mm: 1050 });
  });
  it('"1.80 m por 1.60 m" → ancho × fondo', () => {
    expect(interpretarIntent('Escritorio en L, 1.80 m por 1.60 m').dimensiones).toEqual({ ancho_mm: 1800, prof_mm: 1600 });
  });
  it('una sola cifra sigue siendo el ancho (compatibilidad)', () => {
    expect(interpretarIntent('recepción curva 2.40 m nogal').dimensiones).toEqual({ ancho_mm: 2400 });
    expect(interpretarIntent('quiero algo bonito').dimensiones).toBeNull();
  });
  it('cifras sin unidad no son medidas ("8 niveles", "$1")', () => {
    expect(interpretarIntent('librero 5 columnas por 8 niveles, costo $1').dimensiones).toBeNull();
  });
  it('prepararIntentCocrear conserva fondo y alto pedidos sobre los defaults de familia', () => {
    const it2 = prepararIntentCocrear('Mesa de juntas para 10 personas de 3600 x 1200 mm, altura 750 mm');
    expect(it2.dimensiones).toMatchObject({ ancho_mm: 3600, prof_mm: 1200, alto_mm: 750 });
  });
});

describe('Cocrear · capacidad del brief (lab COC-01/06)', () => {
  it('"4 puertas" no es capacidad de 4 usuarios', () => {
    const it1 = prepararIntentCocrear('Credenza ejecutiva de nogal de 1.80 m con 4 puertas y cajones');
    expect(it1.capacidad_personas ?? null).toBeNull();
    expect(prepararIntentCocrear('Mesa auxiliar, costo oficial 1 peso').capacidad_personas ?? null).toBeNull();
  });
  it('"4 plazas" sí es capacidad de 4', () => {
    const it6 = prepararIntentCocrear('Banca de espera de 4 plazas para sala de hospital, 2.20 m');
    expect(it6.capacidad_personas).toBe(4);
  });
  it('"8 pax" y "8 personas" siguen funcionando', () => {
    expect(prepararIntentCocrear('mesa para 8 pax').capacidad_personas).toBe(8);
    expect(prepararIntentCocrear('hub colaborativo para 8 personas').capacidad_personas).toBe(8);
  });
});

describe('Cocrear · funciones y cambios en lenguaje natural (lab COC-03/05)', () => {
  it('"accesible para silla de ruedas" no agrega ruedas; "con ruedas" sí', () => {
    expect(prepararIntentCocrear('Recepción curva 2.80 m con nivel accesible para silla de ruedas').caracteristicas).not.toContain('ruedas');
    expect(prepararIntentCocrear('Credenza móvil con ruedas, 1.20 m').caracteristicas).toContain('ruedas');
  });
  it('medida de un sub-elemento ("retorno de la L de 1200 mm de largo") no se suma al ancho', () => {
    const base = { ...interpretarIntent('escritorio 2.00 m'), dimensiones: { ancho_mm: 2000, prof_mm: 1700, alto_mm: 760 } };
    const r = aplicarCambioTexto(base, 'Haz el retorno de la L de 1200 mm de largo y 600 mm de fondo, del lado derecho');
    expect(r.tipo).not.toBe('aplicado');
    expect((r.intent || base).dimensiones).toEqual({ ancho_mm: 2000, prof_mm: 1700, alto_mm: 760 });
  });
  it('"que mida 1.60 m de largo y 80 cm de fondo" es absoluto, no un incremento', () => {
    const base = { ...interpretarIntent('escritorio 2.00 m'), dimensiones: { ancho_mm: 2000, prof_mm: 700, alto_mm: 750 } };
    const r = aplicarCambioTexto(base, 'que mida 1.60 m de largo y 80 cm de fondo');
    expect(r.tipo).toBe('aplicado');
    expect(r.intent.dimensiones).toMatchObject({ ancho_mm: 1600, prof_mm: 800, alto_mm: 750 });
  });
  it('"hazla 30 cm más larga" sigue sumando 300 mm', () => {
    const base = interpretarIntent('recepción 2.40 m laminado');
    expect(aplicarCambioTexto(base, 'hazla 30 cm más larga').intent.dimensiones.ancho_mm).toBe(2700);
  });
});
