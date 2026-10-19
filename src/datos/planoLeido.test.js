import { describe, it, expect } from 'vitest';
import { areasDeLectura, revisarAreas, contornoMM, areaM2, resumenLectura, nivelesDeLectura, areasDelNivelUsado } from './planoLeido.js';

// ---------------------------------------------------------------------------
//  El plano REAL de Rodrigo (Plano_Organico_Con_Medidas.pdf, 2026-08-16):
//  30 × 20 m, sala de juntas CIRCULAR de Ø7 m dentro del open space, recepción
//  TRIANGULAR, break room TRAPEZOIDAL y cinco oficinas detrás de un muro CURVO.
//  Es el caso que la versión anterior dibujaba como nueve cajas rectas
//  encimadas, así que es el que tienen que cubrir las pruebas.
// ---------------------------------------------------------------------------
const PLANO = {
  envolvente: { ancho: 30000, largo: 20000 },
  tieneCotas: true,
  areas: [
    {
      nombre: 'ÁREA OPERATIVA', tipo: 'open', forma: 'poligono', dentroDe: '', confianza: 'media',
      circulo: { cx: 0, cy: 0, r: 0 },
      puntos: [
        { x: 0, y: 0 }, { x: 21700, y: 0 }, { x: 20500, y: 4000 }, { x: 20000, y: 8000 },
        { x: 20300, y: 12200 }, { x: 21400, y: 16000 }, { x: 23800, y: 20000 }, { x: 0, y: 20000 },
      ],
    },
    {
      nombre: 'Sala de Juntas Circular', tipo: 'juntas', forma: 'circulo', dentroDe: 'ÁREA OPERATIVA',
      confianza: 'alta', puntos: [], circulo: { cx: 9000, cy: 6000, r: 3500 },
    },
    {
      nombre: 'Recepción', tipo: 'recepcion', forma: 'poligono', dentroDe: '', confianza: 'media',
      circulo: { cx: 0, cy: 0, r: 0 },
      puntos: [{ x: 0, y: 12000 }, { x: 7000, y: 20000 }, { x: 0, y: 20000 }],
    },
  ],
};

describe('contorno de la lectura', () => {
  it('convierte un círculo en un polígono del diámetro que dice la cota', () => {
    const pts = contornoMM(PLANO.areas[1]);
    expect(pts.length).toBeGreaterThanOrEqual(12);
    const xs = pts.map((p) => p[0]);
    // Ø 7 m: el ancho del contorno no puede alejarse de 7000 mm.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(6800);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(7000);
    // Y su superficie es la del círculo (π r²  ≈ 38.5 m²), no la del cuadrado
    // de 7×7 = 49 m² que devolvía el esquema viejo.
    expect(areaM2(pts)).toBeGreaterThan(36);
    expect(areaM2(pts)).toBeLessThan(39);
  });

  it('acepta el formato viejo (sólo x/y/ancho/largo) sin tronar', () => {
    const pts = contornoMM({ x: 1000, y: 2000, ancho: 3000, largo: 4000 });
    expect(pts).toEqual([[1000, 2000], [4000, 2000], [4000, 6000], [1000, 6000]]);
  });

  it('descarta un área sin forma reconocible', () => {
    expect(contornoMM({ nombre: 'x', puntos: [{ x: 0, y: 0 }] })).toBe(null);
  });
});

describe('lectura -> áreas de la app', () => {
  const { areas } = areasDeLectura(PLANO);

  it('conserva la forma real: el open space NO es un rectángulo', () => {
    const open = areas.find((a) => a.tipo === 'open');
    expect(open.poly.length).toBe(8);
    // El bbox mide 23.8 × 20 = 476 m², pero la planta real es bastante menor:
    // si salieran iguales, la forma se habría perdido.
    const real = areaM2(open.poly.map(([x, y]) => [x * 1000, y * 1000]));
    expect(real).toBeLessThan(open.ancho * open.largo * 0.95);
  });

  it('pone el contorno RELATIVO a la esquina del cuarto', () => {
    const rec = areas.find((a) => a.tipo === 'recepcion');
    expect(rec.x).toBe(0);
    expect(rec.y).toBe(12);
    // El primer punto del triángulo está en el origen local, no en y=12 m.
    expect(rec.poly[0]).toEqual([0, 0]);
    expect(rec.poly.length).toBe(3);
  });

  it('convierte cada cuarto anidado en un hueco que su padre no amuebla', () => {
    const open = areas.find((a) => a.tipo === 'open');
    // La sala circular Y la recepción caen dentro del contorno del open space:
    // los dos son huecos. El anidamiento se DEDUCE por geometría, así que la
    // recepción cuenta aunque la lectura no lo haya declarado.
    expect(open.obstaculos).toHaveLength(2);
    const circ = open.obstaculos.find((o) => Math.abs(o.w - 7) < 0.2);
    expect(circ).toBeTruthy();
    expect(circ.h).toBeCloseTo(7, 1);
    // Y los cuartos siguen existiendo por su cuenta, para amueblarlos ellos.
    expect(areas.some((a) => a.tipo === 'juntas')).toBe(true);
    expect(areas.some((a) => a.tipo === 'recepcion')).toBe(true);
  });
});

describe('revisión de la lectura', () => {
  it('no inventa problemas en un plano bien leído', () => {
    expect(revisarAreas(PLANO)).toEqual([]);
  });

  it('un cuarto DENTRO de otro no se reporta como traslape', () => {
    const problemas = revisarAreas(PLANO);
    expect(problemas.join(' ')).not.toMatch(/enciman/);
  });

  it('reporta dos cuartos encimados de verdad', () => {
    const malo = {
      envolvente: { ancho: 20000, largo: 20000 },
      areas: [
        { nombre: 'A', tipo: 'open', forma: 'poligono', dentroDe: '', circulo: { cx: 0, cy: 0, r: 0 },
          puntos: [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 }] },
        { nombre: 'B', tipo: 'privado', forma: 'poligono', dentroDe: '', circulo: { cx: 0, cy: 0, r: 0 },
          puntos: [{ x: 5000, y: 5000 }, { x: 15000, y: 5000 }, { x: 15000, y: 15000 }, { x: 5000, y: 15000 }] },
      ],
    };
    expect(revisarAreas(malo).join(' ')).toMatch(/"A" y "B" se enciman/);
  });

  it('reporta un cuarto fuera del contorno del plano', () => {
    const fuera = {
      envolvente: { ancho: 10000, largo: 10000 },
      areas: [
        { nombre: 'Fuera', tipo: 'privado', forma: 'poligono', dentroDe: '', circulo: { cx: 0, cy: 0, r: 0 },
          puntos: [{ x: 9000, y: 0 }, { x: 18000, y: 0 }, { x: 18000, y: 4000 }, { x: 9000, y: 4000 }] },
      ],
    };
    expect(revisarAreas(fuera).join(' ')).toMatch(/se salen del contorno/);
  });

  it('avisa cuando no se reconoció ningún cuarto', () => {
    expect(revisarAreas({ envolvente: { ancho: 1, largo: 1 }, areas: [] })[0]).toMatch(/ningún cuarto/);
  });

  // ---- plan-reading 10X: más modos de falla de una lectura de IA ----
  const cuarto = (nombre, x, y, w, h, extra = {}) => ({
    nombre, tipo: 'privado', forma: 'poligono', dentroDe: '', circulo: { cx: 0, cy: 0, r: 0 },
    puntos: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], ...extra,
  });

  it('atrapa un cuarto diminuto (muro/cota leído como cuarto)', () => {
    const l = { envolvente: { ancho: 20000, largo: 20000 }, areas: [cuarto('Muro?', 0, 0, 300, 300)] };
    expect(revisarAreas(l).join(' ')).toMatch(/diminuto/);
  });

  it('atrapa un cuarto enorme (mala escala)', () => {
    const l = { envolvente: { ancho: 90000, largo: 90000 }, areas: [cuarto('Todo', 0, 0, 60000, 10000)] };
    expect(revisarAreas(l).join(' ')).toMatch(/enorme/);
  });

  it('atrapa una astilla (muro largo y angosto)', () => {
    const l = { envolvente: { ancho: 30000, largo: 30000 }, areas: [cuarto('Astilla', 0, 0, 15000, 800)] };
    expect(revisarAreas(l).join(' ')).toMatch(/astilla/);
  });

  it('atrapa cuartos duplicados (doble lectura)', () => {
    const l = { envolvente: { ancho: 30000, largo: 30000 }, areas: [cuarto('Sala', 0, 0, 4000, 4000), cuarto('Sala', 10000, 10000, 4000, 4000)] };
    expect(revisarAreas(l).join(' ')).toMatch(/aparece más de una vez/);
  });

  it('atrapa puertas huérfanas (no caen sobre ningún cuarto)', () => {
    const l = { envolvente: { ancho: 30000, largo: 30000 }, areas: [cuarto('A', 0, 0, 4000, 4000)], puertas: [{ x: 25000, y: 25000, ancho: 900 }] };
    expect(revisarAreas(l).join(' ')).toMatch(/no caen sobre ningún cuarto/);
  });
});

describe('resumenLectura · confianza del levantamiento', () => {
  it('plano bien leído ⇒ nivel alta y confiable', () => {
    const r = resumenLectura(PLANO);
    expect(r.cuartos).toBe(3);
    expect(r.nivel).toBe('alta');
    expect(r.confiable).toBe(true);
    expect(r.m2).toBeGreaterThan(0);
  });

  it('plano con varios problemas ⇒ nivel baja, no confiable', () => {
    const malo = {
      envolvente: { ancho: 20000, largo: 20000 },
      areas: [
        { nombre: 'X', tipo: 'open', forma: 'poligono', dentroDe: '', circulo: { cx: 0, cy: 0, r: 0 },
          puntos: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }] },
        { nombre: 'X', tipo: 'privado', forma: 'poligono', dentroDe: '', circulo: { cx: 0, cy: 0, r: 0 },
          puntos: [{ x: 0, y: 0 }, { x: 15000, y: 0 }, { x: 15000, y: 800 }, { x: 0, y: 800 }] },
      ],
    };
    const r = resumenLectura(malo);
    expect(r.confiable).toBe(false);
    expect(r.nProblemas).toBeGreaterThan(1);
  });

  it('sin cuartos ⇒ nivel nula', () => {
    expect(resumenLectura({ areas: [] }).nivel).toBe('nula');
  });
});


describe('puertas · UNKNOWN no se convierte en geometría inventada', () => {
  const baseArea = {
    nombre:'Privado', tipo:'privado', forma:'poligono',
    puntos:[{x:0,y:0},{x:5000,y:0},{x:5000,y:4000},{x:0,y:4000}],
  };

  it('puerta sin ancho conserva ancho=null y queda pendiente', () => {
    const lectura = {
      envolvente:{ancho:5000,largo:4000},
      areas:[baseArea],
      puertas:[{ x:2500, y:0, tieneBarrido:false, procedencia:'INFERRED' }],
    };
    const {areas}=areasDeLectura(lectura);
    expect(areas[0].puertas[0].ancho).toBeNull();
    expect(areas[0].puertasPendientes[0].motivo).toBe('ANCHO_PUERTA_DESCONOCIDO');
    expect(revisarAreas(lectura).join(' ')).toMatch(/no tienen ancho verificable/);
  });

  it('puerta con ancho pero sin bisagra no genera obstáculo geométrico certificado', () => {
    const lectura = {
      envolvente:{ancho:5000,largo:4000},
      areas:[baseArea],
      puertas:[{ x:2500, y:0, ancho:900, tieneBarrido:true }],
    };
    const {areas}=areasDeLectura(lectura);
    expect((areas[0].obstaculos||[]).filter(o=>o.tipo==='puerta')).toHaveLength(0);
    expect(areas[0].puertasPendientes[0].motivo).toBe('BARRIDO_PUERTA_NO_VERIFICADO');
  });

  it('sólo puerta con ancho+barrido+bisagra verificables crea obstáculo', () => {
    const lectura = {
      envolvente:{ancho:5000,largo:4000},
      areas:[baseArea],
      puertas:[{
        x:2500,y:0,ancho:900,tieneBarrido:true,
        bisagraX:2050,bisagraY:0,barridoDeg:90,anguloCerradaDeg:0,
      }],
    };
    const {areas}=areasDeLectura(lectura);
    expect((areas[0].obstaculos||[]).some(o=>o.tipo==='puerta')).toBe(true);
    expect(areas[0].puertasPendientes).toBeUndefined();
  });
});

// ============================================================================
//  VH-043 (2026-10-11) · ESCALA: la cota general debe cuadrar con los ejes.
// ============================================================================
describe('validarEscala · cota general vs. suma de ejes', () => {
  const base = { envolvente: { ancho: 15000, largo: 12000 }, areas: [{ nombre: 'A', tipo: 'open', forma: 'poligono', dentroDe: '', circulo: { cx: 0, cy: 0, r: 0 }, puntos: [{ x: 0, y: 0 }, { x: 15000, y: 0 }, { x: 15000, y: 12000 }, { x: 0, y: 12000 }] }] };
  it('sin ejes no inventa problemas', async () => {
    const { validarEscala } = await import('./planoLeido.js');
    expect(validarEscala({ ...base, grid: { horizontal: [], vertical: [] } })).toEqual([]);
    expect(validarEscala(base)).toEqual([]);
  });
  it('ejes que suman la cota general (±3 %) ⇒ sin problema', async () => {
    const { validarEscala } = await import('./planoLeido.js');
    expect(validarEscala({ ...base, grid: { horizontal: [4000, 4000, 4000, 3000], vertical: [6000, 6000] } })).toEqual([]);
    expect(validarEscala({ ...base, grid: { horizontal: [5000, 5000, 5300], vertical: [6000, 6000] } })).toEqual([]);
  });
  it('ejes que NO cuadran ⇒ problema de escala, y baja el nivel de confianza', async () => {
    const { validarEscala, revisarAreas, resumenLectura } = await import('./planoLeido.js');
    const malo = { ...base, grid: { horizontal: [4000, 4000, 4000, 4000, 4000], vertical: [6000, 6000] } };   // 20 m vs 15 m
    const p = validarEscala(malo);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/cota general de ancho \(15\.00 m\) no cuadra con la suma de los ejes \(20\.00 m\)/);
    expect(revisarAreas(malo).join(' ')).toMatch(/revisa la escala/);
    expect(resumenLectura(malo).nivel).not.toBe('alta');
  });
});

describe('L1 · columnas y niveles de la lectura', () => {
  const rect = (nombre, x, y, w, h, extra = {}) => ({ nombre, tipo: 'open', forma: 'poligono', dentroDe: '', confianza: 'alta', circulo: { cx: 0, cy: 0, r: 0 },
    puntos: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], ...extra });
  it('una columna cae como obstáculo "columna" del cuarto más chico que la contiene, en coordenadas locales', () => {
    const L = { envolvente: { ancho: 20000, largo: 12000 }, tieneCotas: true,
      areas: [rect('OPERATIVA', 0, 0, 11000, 7000), rect('ISLA', 1000, 1000, 4000, 3000, { dentroDe: 'OPERATIVA' })],
      puertas: [], columnas: [{ x: 7000, y: 8000, lado: 400, clave: 'P1' }, { x: 2000, y: 2000, lado: 400, clave: 'P2' }, { x: 15000, y: 11000, lado: 400, clave: 'P9' }] };
    const r = areasDeLectura(L);
    const op = r.areas.find((a) => a.nombre === 'OPERATIVA'); const isla = r.areas.find((a) => a.nombre === 'ISLA');
    // P1 (7,8) está fuera de OPERATIVA (7 m de alto) → sin cuarto; P2 cae en la ISLA (más chica), no en OPERATIVA.
    expect((op.obstaculos || []).filter((o) => o.tipo === 'columna')).toHaveLength(0);
    const col = (isla.obstaculos || []).find((o) => o.tipo === 'columna');
    expect(col).toBeTruthy();
    expect([col.x, col.y, col.w, col.h, col.clave]).toEqual([0.8, 0.8, 0.4, 0.4, 'P2']);
    expect(r.columnas).toBe(3); expect(r.columnasSinCuarto).toBe(2);
    expect(resumenLectura(L).columnas).toBe(3);
  });
  it('las áreas conservan su nivel y el resumen enumera los niveles del documento', () => {
    const L = { envolvente: { ancho: 16000, largo: 10000 }, tieneCotas: true, puertas: [], columnas: [],
      areas: [rect('RECEPCIÓN', 0, 0, 8000, 5000, { nivel: 'NIVEL 1', pagina: 1 }), rect('OPERATIVA 2', 0, 0, 10000, 10000, { nivel: 'NIVEL 2', pagina: 2 })] };
    expect(nivelesDeLectura(L)).toEqual(['NIVEL 1', 'NIVEL 2']);
    const r = areasDeLectura(L);
    expect(r.areas.map((a) => a.nivel)).toEqual(['NIVEL 1', 'NIVEL 2']);
    expect(resumenLectura(L).niveles).toEqual(['NIVEL 1', 'NIVEL 2']);
  });
  // 2026-10-19 (certificación C4): el segundo nivel no se podía acomodar nunca (siempre el primero).
  it('areasDelNivelUsado: un nivel a la vez, el que eligió la persona; sin elección o inválido, el primero', () => {
    const areas = [{ nombre: 'RECEPCIÓN', nivel: 'NIVEL 1' }, { nombre: 'OPERATIVA 2', nivel: 'NIVEL 2' }, { nombre: 'DIRECCIÓN', nivel: 'NIVEL 2' }, { nombre: 'SIN NIVEL' }];
    const niveles = ['NIVEL 1', 'NIVEL 2'];
    const nombres = (xs) => xs.map((a) => a.nombre);
    expect(nombres(areasDelNivelUsado(areas, niveles))).toEqual(['RECEPCIÓN', 'SIN NIVEL']);
    expect(nombres(areasDelNivelUsado(areas, niveles, 'NIVEL 2'))).toEqual(['OPERATIVA 2', 'DIRECCIÓN', 'SIN NIVEL']);
    expect(nombres(areasDelNivelUsado(areas, niveles, 'NIVEL 9'))).toEqual(['RECEPCIÓN', 'SIN NIVEL']);
    expect(areasDelNivelUsado(areas, ['NIVEL 1'], 'NIVEL 2')).toHaveLength(4);     // un solo nivel declarado: todas
  });
  // ACOMODO 10 · VH-A10-01 (lab C4 "dos niveles"): las dos plantas vienen dibujadas en el MISMO sistema de
  // coordenadas (una por hoja). El anidamiento, las columnas y las puertas se calculaban contra TODOS los cuartos
  // del documento: la DIRECCIÓN del nivel 2 quedaba como "cuarto" (obstáculo de 6 × 5 m) dentro de la SALA DE
  // JUNTAS del nivel 1, la columna del nivel 2 caía en la RECEPCIÓN y las puertas de la hoja 2 en cuartos de la 1.
  it('VH-A10-01: cuartos de niveles distintos no se anidan ni se reparten columnas o puertas', () => {
    const L = { envolvente: { ancho: 16000, largo: 10000 }, tieneCotas: true,
      areas: [
        rect('SALA DE JUNTAS', 8000, 0, 8000, 5000, { nivel: 'NIVEL 1', pagina: 1 }),
        rect('OPERATIVA 2', 0, 0, 10000, 10000, { nivel: 'NIVEL 2', pagina: 2 }),
        rect('DIRECCIÓN', 10000, 0, 6000, 5000, { nivel: 'NIVEL 2', pagina: 2 }),
      ],
      columnas: [{ x: 12000, y: 2000, lado: 500, clave: 'P1', nivel: 'NIVEL 2', pagina: 2 }],
      puertas: [{ x: 10000, y: 2600, ancho: 1150, tieneBarrido: true, bisagraX: 10000, bisagraY: 2030, anguloCerradaDeg: 90, sentido: 'antihorario', barridoDeg: 90, pagina: 2 }] };
    const r = areasDeLectura(L);
    const junta = r.areas.find((a) => a.nombre === 'SALA DE JUNTAS');
    const dir = r.areas.find((a) => a.nombre === 'DIRECCIÓN');
    expect(junta.obstaculos).toBeUndefined();          // ni "cuarto" del nivel 2, ni su columna, ni su puerta
    expect(junta.contiene).toBeUndefined();
    expect(junta.puertas).toBeUndefined();
    expect(dir.dentroDe).toBeUndefined();
    // Dentro de su propio nivel todo sigue igual: la columna y la puerta son de DIRECCIÓN.
    expect((dir.obstaculos || []).some((o) => o.tipo === 'columna' && o.clave === 'P1')).toBe(true);
    expect(dir.puertas).toHaveLength(1);
    // Encimarse con un cuarto de OTRO nivel no es un problema de lectura.
    expect(revisarAreas(L).some((t) => /se enciman/.test(t))).toBe(false);
  });
  it('VH-A10-01: en un mismo nivel el anidamiento y las columnas no cambian', () => {
    const L = { envolvente: { ancho: 20000, largo: 12000 }, tieneCotas: true, puertas: [],
      areas: [rect('OPERATIVA', 0, 0, 11000, 7000, { nivel: 'NIVEL 1' }), rect('ISLA', 1000, 1000, 4000, 3000, { dentroDe: 'OPERATIVA', nivel: 'NIVEL 1' })],
      columnas: [{ x: 2000, y: 2000, lado: 400, clave: 'P2', nivel: 'NIVEL 1' }] };
    const r = areasDeLectura(L);
    expect(r.areas.find((a) => a.nombre === 'ISLA').dentroDe).toBe('OPERATIVA');
    expect(r.areas.find((a) => a.nombre === 'OPERATIVA').obstaculos.some((o) => o.tipo === 'cuarto')).toBe(true);
    expect(r.areas.find((a) => a.nombre === 'ISLA').obstaculos.some((o) => o.clave === 'P2')).toBe(true);
  });
  it('VH-A10-01: la suma de m² contra el contorno se mide por nivel', () => {
    const L = { envolvente: { ancho: 16000, largo: 10000 }, tieneCotas: true, puertas: [], columnas: [],
      areas: [rect('N1', 0, 0, 16000, 10000, { nivel: 'NIVEL 1' }), rect('N2', 0, 0, 16000, 10000, { nivel: 'NIVEL 2' })] };
    expect(revisarAreas(L).some((t) => /suman/.test(t))).toBe(false);
  });
  it('sin columnas ni niveles nada cambia (lectura vieja)', () => {
    const L = { envolvente: { ancho: 20000, largo: 12000 }, tieneCotas: true, areas: [rect('OPERATIVA', 0, 0, 11000, 7000)], puertas: [] };
    const r = areasDeLectura(L);
    expect(r.columnas).toBe(0); expect(r.niveles).toEqual([]); expect(r.areas[0].nivel).toBeUndefined(); expect(r.areas[0].obstaculos).toBeUndefined();
  });
});
