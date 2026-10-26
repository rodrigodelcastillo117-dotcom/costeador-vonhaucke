import { describe, it, expect } from 'vitest';
import { revisarEstructura, huellaDelMueble } from './revisionEstructural.js';

const niveles = (r) => r.observaciones.map((o) => o.nivel);
const textos = (r) => r.observaciones.map((o) => o.mensaje).join(' || ');

describe('revisarEstructura — razona el conjunto, no piezas sueltas', () => {
  it('banca de aeropuerto SIN estructura → warning de soporte', () => {
    const r = revisarEstructura({
      descripcion: 'Banca de espera de aeropuerto de 4 plazas, aluminio, hule espuma negra, conector cada 2 asientos.',
      componentes: [
        { nombre: 'Asiento', insumoId: 'espuma', piezas: 4 },
        { nombre: 'Respaldo', insumoId: 'espuma', piezas: 4 },
      ],
    });
    expect(niveles(r)).toContain('warning');
    expect(textos(r)).toMatch(/estructura de soporte|patas|travesa/i);
  });

  it('gaveta suelta sin cuerpo → warning', () => {
    const r = revisarEstructura({ componentes: [{ nombre: 'gaveta', insumoId: 'lamina-18' }] });
    expect(textos(r)).toMatch(/cuerpo que la contenga/i);
  });

  it('gaveta CON lateral → no se queja del cuerpo', () => {
    const r = revisarEstructura({ componentes: [
      { nombre: 'Lateral', insumoId: 'mdf-16', largoMM: 240, anchoMM: 900 },
      { nombre: 'gaveta', insumoId: 'lamina-18' },
    ] });
    expect(textos(r)).not.toMatch(/cuerpo que la contenga/i);
  });

  it('faldón con ancho 600 → info de altura vertical', () => {
    const r = revisarEstructura({ componentes: [{ nombre: 'Faldon', insumoId: 'mdf-16', largoMM: 1500, anchoMM: 600 }] });
    expect(textos(r)).toMatch(/ALTURA|altura/);
  });

  it('descripción dice asientos pero el despiece es una cubierta → warning de coherencia', () => {
    const r = revisarEstructura({
      descripcion: 'Banca de espera 4 plazas',
      componentes: [{ nombre: 'Cubierta', insumoId: 'marmol', largoMM: 1500, anchoMM: 600 }],
    });
    expect(niveles(r)).toContain('warning');
    expect(textos(r)).toMatch(/asientos|superficie/i);
  });

  it('conector mencionado pero no capturado → info', () => {
    const r = revisarEstructura({
      descripcion: 'banca con conector cada 2 asientos',
      componentes: [{ nombre: 'Asiento', insumoId: 'espuma', piezas: 4 }, { nombre: 'Pata', insumoId: 'ptr' }],
    });
    expect(textos(r)).toMatch(/conector/i);
  });

  it('despiece coherente → sin warning', () => {
    const r = revisarEstructura({
      descripcion: 'Escritorio recto',
      componentes: [
        { nombre: 'Cubierta', insumoId: 'melamina-28', largoMM: 1500, anchoMM: 600 },
        { nombre: 'Pata U', insumoId: 'ptr' },
      ],
    });
    expect(niveles(r)).not.toContain('warning');
  });

  it('sin piezas → info, sin romper', () => {
    const r = revisarEstructura({ componentes: [] });
    expect(r.observaciones.length).toBeGreaterThan(0);
  });
});

describe('VH-163 · mueble de piso sin soporte', () => {
  it('mesa de centro con sólo la cubierta de cristal → bloqueo; con base tubular → sin bloqueo; cubierta de reposición sola → sin bloqueo', async () => {
    const { revisarEstructura } = await import('./revisionEstructural.js');
    const bloq = (r) => r.observaciones.filter((o) => o.nivel === 'blocker').map((o) => o.regla);
    expect(bloq(revisarEstructura({ componentes: [{ nombre: 'Cubierta cristal templado 9 mm', insumoId: 'cristal-templado' }], descripcion: 'mesa de centro · Mesa de centro con cubierta de cristal y base tubular cromada' }))).toEqual(['sin_soporte']);
    expect(bloq(revisarEstructura({ componentes: [{ nombre: 'Cubierta cristal templado 9 mm' }, { nombre: 'Base tubular redondo 3/4"' }], descripcion: 'mesa de centro' }))).toEqual([]);
    expect(bloq(revisarEstructura({ componentes: [{ nombre: 'Cubierta melamina 1500×700' }], descripcion: 'cubierta de reposición' }))).toEqual(['sin_soporte'].filter(() => false));
    expect(bloq(revisarEstructura({ componentes: [{ nombre: 'Cubierta superior' }, { nombre: 'Laterales' }], descripcion: 'credenza' }))).toEqual([]);
  });
});

describe('VH-163b · soportes en plural (falso bloqueo en mesa de trabajo V5)', () => {
  it('el BOM real de la mesa de trabajo (Patas/Largueros/Travesaños PTR) NO se bloquea', async () => {
    const { revisarEstructura, rolDe } = await import('./revisionEstructural.js');
    for (const n of ['Patas PTR 1x2 cal.16', 'Largueros PTR 1x2 cal.16', 'Travesaños PTR 1x2 cal.16', 'Postes verticales tubular redondo', 'Bases metálicas', 'Pedestales']) expect(rolDe(n)).toBe('pata');
    const comps = ['Cubierta melamina blanca 19 mm', 'Tapacanto PVC 2 mm perimetral', 'Patas PTR 1x2 cal.16', 'Largueros PTR 1x2 cal.16', 'Travesaños PTR 1x2 cal.16', 'Faldón lámina cal.18', 'Pintura en polvo blanco RAL 9016', 'Niveladores', 'Soldadura'].map((nombre) => ({ nombre }));
    const r = revisarEstructura({ componentes: comps, descripcion: 'mesa · mesa de trabajo recta con estructura PTR y faldón' });
    expect(r.observaciones.filter((o) => o.nivel === 'blocker')).toEqual([]);
  });
  it('sin ningún soporte (ni en plural) sigue bloqueando', async () => {
    const { revisarEstructura } = await import('./revisionEstructural.js');
    const r = revisarEstructura({ componentes: [{ nombre: 'Cubierta melamina' }, { nombre: 'Faldón lámina' }, { nombre: 'Tapacanto' }], descripcion: 'mesa de trabajo' });
    expect(r.observaciones.filter((o) => o.nivel === 'blocker').map((o) => o.regla)).toEqual(['sin_soporte']);
  });
});

// Certificación 18-oct (escritorio en L, plano real): "CAJONERA MÓVIL 3 GAVETAS (COMPRADA, 1 PIEZA)" con la descripción
// "cajonera de 3 cajones" bloqueaba el costo: "La descripción pide 3 cajón(es) y el despiece trae 1". Una cajonera
// declara sus gavetas en el nombre: cuenta como esas gavetas, no como una.
describe('cajonera con N gavetas cuenta como N cajones', () => {
  const comps = (nombreCajonera) => [
    { nombre: 'Cubierta principal', insumoId: 'melamina-19', largoMM: 1600, anchoMM: 700 },
    { nombre: nombreCajonera, piezas: 1, cantidad: 1 },
  ];
  const bloqueoCajones = (r) => r.observaciones.find((o) => o.regla === 'cantidad_incompatible' && /caj/.test(o.clave));
  it('"Cajonera móvil 3 gavetas" con la descripción "cajonera de 3 cajones": sin bloqueo', () => {
    const r = revisarEstructura({ componentes: comps('Cajonera móvil 3 gavetas'), descripcion: 'Escritorio en L con cajonera móvil de 3 cajones' });
    expect(bloqueoCajones(r)).toBeUndefined();
  });
  it('si la cajonera trae 2 gavetas y se pidieron 3, sí bloquea', () => {
    const r = revisarEstructura({ componentes: comps('Cajonera móvil 2 gavetas'), descripcion: 'Escritorio con 3 cajones' });
    expect(bloqueoCajones(r)?.mensaje).toMatch(/pide 3 .* trae 2/);
  });
  it('una gaveta suelta sigue contando como 1', () => {
    const r = revisarEstructura({ componentes: comps('Gaveta lápicera'), descripcion: 'Escritorio con 3 cajones' });
    expect(bloqueoCajones(r)?.mensaje).toMatch(/pide 3 .* trae 1/);
  });
});

// Auditoría 2026-10-19 (certificación total, mesa de centro): "Separadores/bumpers de apoyo del cristal" con silicón se
// clasificaba como pieza de CRISTAL por la palabra "cristal" → bloqueo "es una pieza (cristal) pero está costeada con
// Silicon, que es adhesivo". Los accesorios que se pegan/apoyan (bumpers, topes, separadores…) son herraje.
describe('accesorios de apoyo no se confunden con la pieza que apoyan', () => {
  it('rolDe: bumpers, separadores, topes, tacones, pads, regatones, antiderrapantes, protectores → herraje', async () => {
    const { rolDe } = await import('./revisionEstructural.js');
    for (const n of ['Separadores/bumpers de apoyo del cristal', 'Topes de hule para cristal', 'Tacones antiderrapantes', 'Pads de silicón para cubierta de vidrio', 'Regatones de patas', 'Protectores de esquina'])
      expect([n, rolDe(n)]).toEqual([n, 'herraje']);
    expect(rolDe('Cubierta cristal templado 9 mm')).toBe('cubierta');
    expect(rolDe('Cristal templado 9 mm')).toBe('cristal');
  });
  it('bumpers del cristal costeados con silicón: SIN bloqueo de material/función; un cristal con silicón SÍ se bloquea', async () => {
    const { INSUMOS_SEMILLA } = await import('./insumos.js');
    const insumos = Object.fromEntries(INSUMOS_SEMILLA.map((i) => [i.id, i]));
    const r1 = revisarEstructura({ insumos, componentes: [{ nombre: 'Separadores/bumpers de apoyo del cristal', insumoId: 'silicon', cantidad: 4 }] });
    expect(r1.observaciones.some((o) => o.regla === 'material_funcion')).toBe(false);
    const r2 = revisarEstructura({ insumos, componentes: [{ nombre: 'Cristal templado 9 mm', insumoId: 'silicon', cantidad: 1 }] });
    expect(r2.observaciones.some((o) => o.regla === 'material_funcion')).toBe(true);
  });
});

// Lab en vivo 2026-10-22 (cuenta QA, mesa de consejo redonda Ø1.80): el validador tomaba la
// ALTURA (750) como el "ancho" del mueble y marcaba la cubierta en media luna (1800×900) como
// "pieza más grande que el mueble". La huella de un mueble REDONDO es diámetro×diámetro, y una
// dimensión rotulada como alto es vertical: no cuenta en la planta.
describe('huella del mueble: redondos y altura rotulada no disparan un falso "pieza imposible"', () => {
  it('huellaDelMueble: redondo → diámetro×diámetro; altura rotulada fuera; rectangular sin cambios', async () => {
    const { huellaDelMueble } = await import('./revisionEstructural.js');
    expect(huellaDelMueble('1800 Ø x 750 alto mm')).toEqual([1800, 1800]);          // el caso real que falló
    expect(huellaDelMueble('mesa redonda Ø1.50 m, 740 alto mm')).toEqual([1500, 1500]); // generaliza (metros, otro Ø)
    expect(huellaDelMueble('1500 x 600 x 740 alto mm')).toEqual([1500, 600]);        // rect: la altura no es la planta
    expect(huellaDelMueble('2400 x 1100 x 740')).toEqual([2400, 1100]);             // altura SIN rotular: igual que antes
  });

  it('mesa de consejo redonda Ø1800: cubierta en 2 medias lunas 1800×900 NO es "medida imposible"', () => {
    const r = revisarEstructura({
      descripcion: 'Mesa de juntas redonda para 12, base central tipo araña, electrificación.',
      medidasGenerales: '1800 Ø x 750 alto mm',
      componentes: [
        { nombre: 'Cubierta circular Ø1800 (2 tramos pegados)', insumoId: 'melamina', largoMM: 1800, anchoMM: 900 },
        { nombre: 'Columna central PTR', insumoId: 'ptr', largoMM: 750, anchoMM: 100 },
      ],
    });
    expect(r.observaciones.some((o) => o.regla === 'medida_imposible')).toBe(false);
  });

  it('control: una pieza REALMENTE mayor que el diámetro SÍ se marca (no sobre-corrige)', () => {
    const r = revisarEstructura({
      descripcion: 'Mesa redonda Ø1200.',
      medidasGenerales: '1200 Ø x 740 alto mm',
      componentes: [{ nombre: 'Cubierta', insumoId: 'melamina', largoMM: 1600, anchoMM: 800 }], // 1600 > Ø1200
    });
    expect(r.observaciones.some((o) => o.regla === 'medida_imposible')).toBe(true);
  });
});

// COST-01 · SEMÁNTICA COMPARTIDA del validador estructural.
// `revisarEstructura` es un único módulo: dada la MISMA entrada su veredicto es el mismo lo llame
// quien lo llame, y los bloqueos se derivan de las observaciones con nivel 'blocker'. Esto comprueba
// esa semántica cuando medidasGenerales ESTÁ presente: la mesa redonda no marca medida_imposible y
// un panel realmente mayor sí.
// ⚠ Esto NO prueba paridad del flujo de costeo autoritativo normal. Hoy src/datos/costeoServidor.js
// llama revisarEstructura SIN medidasGenerales, así que la regla medida_imposible (huellaDelMueble)
// no se ejecuta en el costeo normal; sólo el camino COCREAR de la Edge pasa medidasGenerales.
//
// TODO COST-01-SRV (ABIERTO): costearConMotor debe recibir/preservar medidasGenerales y ejecutar la
// misma validación de huella en el camino autoritativo normal. Mientras no lo haga, este bloque
// prueba la semántica del módulo, no la paridad del servidor normal.
describe('COST-01 · semántica compartida del validador estructural (misma entrada → mismo veredicto)', () => {
  // Bloqueos derivados como lo hace cualquier consumidor del módulo: observaciones con nivel 'blocker'.
  const bloqueos = (r) => (r.observaciones || []).filter((o) => o.nivel === 'blocker').map((o) => o.regla || o.mensaje);
  const mesaRedonda = {
    descripcion: 'Mesa de juntas redonda para 12, base central tipo araña, electrificación.',
    medidasGenerales: '1800 Ø x 750 alto mm',
    componentes: [
      { nombre: 'Cubierta circular Ø1800 (2 tramos pegados)', insumoId: 'melamina', largoMM: 1800, anchoMM: 900 },
      { nombre: 'Columna central PTR', insumoId: 'ptr', largoMM: 750, anchoMM: 100 },
    ],
  };
  const oversizeReal = {
    descripcion: 'Mesa redonda Ø1200.',
    medidasGenerales: '1200 Ø x 740 alto mm',
    componentes: [{ nombre: 'Cubierta', insumoId: 'melamina', largoMM: 1600, anchoMM: 800 }],
  };
  it('con medidasGenerales presentes, la mesa redonda NO marca medida_imposible (costeable)', () => {
    const r = revisarEstructura(mesaRedonda);
    expect(r.observaciones.some((o) => o.regla === 'medida_imposible')).toBe(false); // vía observaciones.some
    expect(bloqueos(r)).not.toContain('medida_imposible');                            // vía nivel 'blocker' (misma función)
  });
  it('con medidasGenerales presentes, un panel realmente mayor SÍ bloquea (rechazo)', () => {
    const r = revisarEstructura(oversizeReal);
    expect(r.observaciones.some((o) => o.regla === 'medida_imposible')).toBe(true);    // vía observaciones.some
    expect(bloqueos(r)).toContain('medida_imposible');                                 // vía nivel 'blocker' (misma función)
  });
});

// ── COST-01 · matriz obligatoria de huella en planta (Dirección 2026-10-24) ──────────
// Garantiza que el fix de la mesa redonda (Ø×alto daba falso "pieza > mueble") no debilitó
// el validador: los casos buenos pasan y el oversize verdadero SIGUE bloqueando.
const tieneImposible = (r) => r.observaciones.some((o) => o.regla === 'medida_imposible');

describe('COST-01 · huellaDelMueble (planta: redondo=Ø×Ø, ignora alto rotulado)', () => {
  it('redonda Ø1200/1500/1800/2400 × 750 alto → diámetro×diámetro (el alto no es planta)', () => {
    expect(huellaDelMueble('Mesa redonda Ø1200 × 750 alto')).toEqual([1200, 1200]);
    expect(huellaDelMueble('Mesa redonda Ø1500 × 750 alto')).toEqual([1500, 1500]);
    expect(huellaDelMueble('Mesa de consejo Ø1800 × 750 alto')).toEqual([1800, 1800]);
    expect(huellaDelMueble('Mesa redonda Ø2400 × 750 alto')).toEqual([2400, 2400]);
  });
  it('el alto se descarta vaya la unidad antes o después del rótulo', () => {
    expect(huellaDelMueble('Ø1800 x 750 mm alto')).toEqual([1800, 1800]);
    expect(huellaDelMueble('Ø1800 x 750 alto mm')).toEqual([1800, 1800]);
  });
  it('rectangular 1500×600×740 (alto SIN rotular) NO cambia: las dos mayores', () => {
    expect(huellaDelMueble('Credenza 1500 × 600 × 740')).toEqual([1500, 740]);
  });
});

describe('COST-01 · validador (1) con huella — redonda no da falso bloqueo, oversize sí bloquea', () => {
  const redonda = 'Mesa de consejo redonda Ø1800 × 750 alto';
  it('cubierta en dos medias lunas 1800×900 cabe en Ø1800 → sin medida_imposible', () => {
    const r = revisarEstructura({ medidasGenerales: redonda, componentes: [
      { nombre: 'Cubierta media luna A', insumoId: 'mdf-18', largoMM: 1800, anchoMM: 900 },
      { nombre: 'Cubierta media luna B', insumoId: 'mdf-18', largoMM: 1800, anchoMM: 900 },
    ] });
    expect(tieneImposible(r)).toBe(false);
  });
  it('cubierta completa 1800×1800 en Ø1800 → sin medida_imposible', () => {
    const r = revisarEstructura({ medidasGenerales: redonda, componentes: [
      { nombre: 'Cubierta', insumoId: 'mdf-18', largoMM: 1800, anchoMM: 1800 },
    ] });
    expect(tieneImposible(r)).toBe(false);
  });
  it('rectangular 1500×600×740 con cubierta 1500×600 → sin medida_imposible (no cambia)', () => {
    const r = revisarEstructura({ medidasGenerales: 'Credenza 1500 × 600 × 740', componentes: [
      { nombre: 'Cubierta', insumoId: 'mdf-18', largoMM: 1500, anchoMM: 600 },
    ] });
    expect(tieneImposible(r)).toBe(false);
  });
  it('oversize VERDADERO sigue bloqueando — panel 2000×900 en mueble 1500×600×740', () => {
    const r = revisarEstructura({ medidasGenerales: 'Credenza 1500 × 600 × 740', componentes: [
      { nombre: 'Cubierta', insumoId: 'mdf-18', largoMM: 2000, anchoMM: 900 },
    ] });
    expect(tieneImposible(r)).toBe(true);
  });
  it('oversize VERDADERO en redonda — panel 2600×2600 en Ø1800 sigue bloqueando', () => {
    const r = revisarEstructura({ medidasGenerales: redonda, componentes: [
      { nombre: 'Cubierta', insumoId: 'mdf-18', largoMM: 2600, anchoMM: 2600 },
    ] });
    expect(tieneImposible(r)).toBe(true);
  });
});
