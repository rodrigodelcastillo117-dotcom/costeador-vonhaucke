// ============================================================================
//  EL GUARDIÁN DEL PLANO DE RODRIGO  ·  el camino COMPLETO, de un golpe.
//
//  Rodrigo, 2026-08-17, después de reportar cinco cosas seguidas:
//    "¿cómo le podemos hacer para que ya quede esto? Ya me cansé, de verdad."
//
//  Tenía razón, y la causa es de método: cada arreglo se verificó POR SEPARADO,
//  así que al probar el camino entero aparecía la siguiente pieza rota. Esto
//  camina el camino COMPLETO con su plano real y exige el resultado que un
//  proyectista aceptaría. Corre en `deploy.sh`: si algo de esto se rompe, la
//  app NO SE PUBLICA.
//
//  Su plano: 8 islas de 4.5 × 3.5 m (48 personas), 5 privados, 2 salas
//  (42 y 35 m²), recepción y un pasillo que las contiene.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { programaDelPlano } from './programaDelPlano.js';
import { expandirPiezas, dimsPieza } from './espacio.js';
import { acomodarLocal } from './planner.js';

// --- Su plano, en METROS (como lo entrega `areasDeLectura`) -----------------
const PASILLO = 'Pasillo de circulación / Área abierta';
const AREAS_M = [
  { nombre: 'Privado 1', tipo: 'privado', ancho: 4.5, largo: 5 },
  { nombre: 'Privado 2', tipo: 'privado', ancho: 3.5, largo: 6 },
  { nombre: 'Privado 3', tipo: 'privado', ancho: 5, largo: 5 },
  { nombre: 'Privado 4', tipo: 'privado', ancho: 4, largo: 5.5 },
  { nombre: 'Privado 5', tipo: 'privado', ancho: 5, largo: 5.5 },
  { nombre: 'Sala Juntas 1', tipo: 'juntas', ancho: 7, largo: 6 },
  { nombre: 'Sala Juntas 2', tipo: 'juntas', ancho: 7, largo: 5 },
  { nombre: 'Recepción', tipo: 'recepcion', ancho: 7, largo: 8 },
  { nombre: PASILLO, tipo: 'open', ancho: 23, largo: 14, contiene: 8 },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    nombre: `Área Op. ${n}`, tipo: 'open', ancho: 4.5, largo: 3.5, dentroDe: PASILLO,
  })),
];
const aMM = (as) => as.map((a) => ({ ...a, ancho: Math.round(a.ancho * 1000), largo: Math.round(a.largo * 1000) }));

// --- Lo que el programa del plano pide, hecho muebles -----------------------
// Es el CONTRATO: la frase que se le entrega a Voni dice exactamente esto, y
// esto es lo que el acomodo tiene que saber colocar.
function muebles(pr) {
  const largoBanca = 1.5 * (pr.porIsla / 2) * 1000;   // 3 puestos por hilera → 4.50 m
  return [
    { id: 'b', nombre: `Banca doble APP LT 1.50 · ${pr.porIsla} usuarios`, cantidad: pr.islas, precioUnitario: 1, w: largoBanca, d: 1200, ruta: 'applt' },
    { id: 'so', nombre: 'Silla operativa · GAMMA-E', cantidad: pr.operativos, precioUnitario: 1, w: 600, d: 600 },
    { id: 'e', nombre: 'Eclipse Escritorio Directivo 2.10 m', cantidad: pr.privados, precioUnitario: 1, w: 2100, d: 900, ruta: 'eclipse' },
    { id: 'sd', nombre: 'Silla directiva ALPHA', cantidad: pr.privados, precioUnitario: 1, w: 650, d: 650 },
    { id: 'sv', nombre: 'Silla de visita · CONCERTO', cantidad: pr.privados * 2, precioUnitario: 1, w: 550, d: 550 },
    ...pr.salas.map((n, i) => ({ id: `mj${i}`, nombre: `Mesa de juntas APP LT ${n} personas`, cantidad: 1, precioUnitario: 1, w: 1000 + n * 200, d: 1200, ruta: 'applt' })),
    { id: 'mos', nombre: 'Recepción · mostrador', cantidad: 1, precioUnitario: 1, w: 2420, d: 830 },
  ];
}

const pr = programaDelPlano(AREAS_M, { largoPuesto: 1500 });
const partidas = muebles(pr);
const piezas = expandirPiezas(partidas);
const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
const plan = acomodarLocal(aMM(AREAS_M), piezas, {});
const iDe = (nombre) => AREAS_M.findIndex((a) => a.nombre === nombre);
const enCuarto = (nombre) => plan.colocacion.filter((c) => c.area === iDe(nombre)).map((c) => byId[c.id].nombre);
const caja = (c) => { const { pw, ph } = dimsPieza(byId[c.id], c.rot || 0); return { x: c.x, y: c.y, w: pw, d: ph, area: c.area }; };

describe('el plano de Rodrigo, de punta a punta', () => {
  it('el programa sale del plano: 48 en 8 islas de 6, 5 privados, 2 salas', () => {
    expect(pr.operativos).toBe(48);
    expect(pr.islas).toBe(8);
    expect(pr.porIsla).toBe(6);
    expect(pr.privados).toBe(5);
    expect(pr.salas).toEqual([10, 8]);
    expect(pr.recepcion).toBe(true);
  });

  it('LAS 8 ISLAS quedan con su banca y sus 6 sillas', () => {
    // Esto es lo que Rodrigo vio vacío tres veces seguidas.
    for (let n = 1; n <= 8; n++) {
      const dentro = enCuarto(`Área Op. ${n}`);
      expect(dentro.filter((x) => /Banca/.test(x)).length, `Área Op. ${n} sin banca`).toBe(1);
      expect(dentro.filter((x) => /Silla operativa/.test(x)).length, `Área Op. ${n} sin sus sillas`).toBe(6);
    }
  });

  it('CADA SALA con su mesa; ningún archivero adentro', () => {
    // Rodrigo: "tampoco veo las salas de juntas". Y antes caían 21 archiveros
    // en la Sala 1 y 14 en la Sala 2.
    for (const s of ['Sala Juntas 1', 'Sala Juntas 2']) {
      const dentro = enCuarto(s);
      expect(dentro.filter((x) => /Mesa de juntas/.test(x)).length, `${s} sin mesa`).toBe(1);
      expect(dentro.filter((x) => /Archivero|Credenza/.test(x)).length, `${s} con guardas`).toBe(0);
    }
  });

  it('LA RECEPCIÓN tiene su mostrador, y no está en un privado', () => {
    // Medido antes: el mostrador acabó en el Privado 5.
    expect(enCuarto('Recepción').filter((x) => /mostrador/.test(x)).length).toBe(1);
    for (let n = 1; n <= 5; n++) {
      expect(enCuarto(`Privado ${n}`).some((x) => /mostrador/.test(x)), `mostrador en Privado ${n}`).toBe(false);
    }
  });

  it('CADA PRIVADO con su escritorio, su silla directiva y sus 2 de visita', () => {
    for (let n = 1; n <= 5; n++) {
      const dentro = enCuarto(`Privado ${n}`);
      expect(dentro.filter((x) => /Escritorio Directivo/.test(x)).length, `Privado ${n} sin escritorio`).toBe(1);
      expect(dentro.filter((x) => /Silla directiva/.test(x)).length, `Privado ${n} sin silla directiva`).toBe(1);
      expect(dentro.filter((x) => /Silla de visita/.test(x)).length, `Privado ${n} sin visitas`).toBe(2);
    }
  });

  it('EL PASILLO se queda vacío: es circulación, no bodega', () => {
    expect(enCuarto(PASILLO)).toEqual([]);
  });

  it('no sobra nada, nada se encima y nada se sale de su cuarto', () => {
    expect(plan.colocacion.length, 'quedaron piezas sin colocar').toBe(piezas.length);
    const cajas = plan.colocacion.map(caja);
    for (const c of cajas) {
      const A = aMM(AREAS_M)[c.area];
      expect(c.x >= -1 && c.y >= -1 && c.x + c.w <= A.ancho + 1 && c.y + c.d <= A.largo + 1,
        `${byId[plan.colocacion[cajas.indexOf(c)].id].nombre} se sale de ${A.nombre}`).toBe(true);
    }
    for (let i = 0; i < cajas.length; i++) {
      for (let k = i + 1; k < cajas.length; k++) {
        const a = cajas[i], b = cajas[k];
        if (a.area !== b.area) continue;
        expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y).toBe(false);
      }
    }
  });

  it('y el cartel de la auditoría dice la VERDAD', () => {
    // Llegó a decir "✓ Todas las piezas colocadas: 58 de 60" con palomita.
    const check = plan.auditoria.find((a) => a.check === 'Todas las piezas colocadas');
    expect(check.ok).toBe(true);
    expect(check.detalle).toBe(`${piezas.length} de ${piezas.length}`);
    expect((plan.notas || []).join(' ')).not.toMatch(/no caben/);
  });
});

// ============================================================================
//  Y EL ESCENARIO MALO: la lista que Voni armó de verdad ese día.
//  Bancas de 10.80 m que no caben en islas de 4.50, 53 archiveros sueltos y un
//  mostrador. Aunque el programa venga mal, hay cosas que NO se valen: meter
//  archiveros en la sala de juntas o el mostrador en la oficina del director.
//  Esto ejercita la SEGUNDA PASADA, que es donde se colaban.
// ============================================================================
describe('aunque la lista venga mal, no se vale cualquier cosa', () => {
  const malas = [
    { id: 'b', nombre: 'Banca doble APP LT 1.80 · 12 usuarios · ocupa 10.80 × 1.20 m', cantidad: 4, precioUnitario: 1, w: 10800, d: 1200, ruta: 'applt' },
    { id: 'mos', nombre: 'Recepción', cantidad: 1, precioUnitario: 1, w: 2420, d: 830 },
    { id: 'a', nombre: 'Modulor · Archivero horizontal 0.75', cantidad: 53, precioUnitario: 1, w: 750, d: 476, ruta: 'modulor' },
    { id: 'so', nombre: 'Silla operativa · GAMMA-E', cantidad: 48, precioUnitario: 1, w: 600, d: 600 },
    { id: 'e', nombre: 'Eclipse Escritorio Directivo 2.10 m', cantidad: 5, precioUnitario: 1, w: 2100, d: 900, ruta: 'eclipse' },
  ];
  const pz = expandirPiezas(malas);
  const ids = Object.fromEntries(pz.map((p) => [p.id, p]));
  const pl = acomodarLocal(aMM(AREAS_M), pz, {});
  const dentroDe = (nombre) => pl.colocacion.filter((c) => c.area === iDe(nombre)).map((c) => ids[c.id].nombre);

  it('NINGÚN archivero en las salas de juntas', () => {
    // Medido antes del arreglo: 21 en la Sala 1 y 14 en la Sala 2.
    for (const s of ['Sala Juntas 1', 'Sala Juntas 2']) {
      expect(dentroDe(s).filter((x) => /Archivero/.test(x)).length, `${s} con archiveros`).toBe(0);
    }
  });

  it('el mostrador NO acaba en un privado', () => {
    // Medido antes: la "Recepción" se clasificaba como escritorio y un
    // escritorio suelto prefiere el privado → acabó en el Privado 5.
    for (let n = 1; n <= 5; n++) {
      expect(dentroDe(`Privado ${n}`).some((x) => /Recepci/.test(x)), `mostrador en Privado ${n}`).toBe(false);
    }
  });

  it('y el pasillo sigue siendo pasillo', () => {
    expect(dentroDe(PASILLO)).toEqual([]);
  });
});
