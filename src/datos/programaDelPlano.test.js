// ============================================================================
//  EL PROGRAMA SALE DEL PLANO.
//  Rodrigo: "yo tuve que poner TODAS LAS CANTIDADES, no tuvo criterio".
//  El plano de prueba: 8 islas de 4.5 × 3.5 m, 5 privados, 2 salas, recepción.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { programaDelPlano, puestosPorIsla, resumenDelPlano, avisosDeSala } from './programaDelPlano.js';

const isla = (n) => ({ nombre: `Área Op. ${n}`, tipo: 'open', ancho: 4.5, largo: 3.5, dentroDe: 'Pasillo' });
const PLANO = [
  { nombre: 'Privado 1', tipo: 'privado', ancho: 4.5, largo: 5 },
  { nombre: 'Privado 2', tipo: 'privado', ancho: 3.5, largo: 6 },
  { nombre: 'Privado 3', tipo: 'privado', ancho: 5, largo: 5 },
  { nombre: 'Privado 4', tipo: 'privado', ancho: 4, largo: 5.5 },
  { nombre: 'Privado 5', tipo: 'privado', ancho: 5, largo: 5.5 },
  { nombre: 'Sala Juntas 1', tipo: 'juntas', ancho: 7, largo: 6 },
  { nombre: 'Sala Juntas 2', tipo: 'juntas', ancho: 7, largo: 5 },
  { nombre: 'Recepción', tipo: 'recepcion', ancho: 7, largo: 8 },
  { nombre: 'Pasillo de circulación / Área abierta', tipo: 'open', ancho: 23, largo: 14, contiene: 8 },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(isla),
];

describe('programaDelPlano', () => {
  it('saca del plano de Rodrigo sus 48 operativos, 5 privados y 53 archiveros', () => {
    const p = programaDelPlano(PLANO, { largoPuesto: 1500 });
    expect(p.islas).toBe(8);
    expect(p.porIsla).toBe(6);          // 4.5 m / 1.50 = 3 por hilera, doble
    expect(p.operativos).toBe(48);
    expect(p.privados).toBe(5);
    expect(p.recepcion).toBe(true);
    expect(p.salas.length).toBe(2);
    // Un archivero por persona sentada: es EXACTAMENTE lo que él tecleó a mano.
    expect(p.guardas).toBe(53);
  });

  it('avisa cuando el largo de puesto NO alcanza para la isla', () => {
    // Éste es el error que dejó todo "sin ubicar": con 1.80 m Voni armó bancas
    // de 12 usuarios (10.80 m) para islas de 4.5 m.
    const p = programaDelPlano(PLANO, { largoPuesto: 1800 });
    expect(p.porIsla).toBe(4);
    expect(p.operativos).toBe(32);
    expect(p.avisos.join(' ')).toMatch(/1\.50/);
    expect(p.avisos.join(' ')).toMatch(/48/);
  });

  it('el PASILLO no cuenta como zona de trabajo', () => {
    const p = programaDelPlano(PLANO, { largoPuesto: 1500 });
    // Si el pasillo (23 × 14 m) contara, saldrían cientos de puestos.
    expect(p.operativos).toBe(48);
  });

  it('sin zonas declaradas usa el espacio abierto como una sola', () => {
    const p = programaDelPlano([{ nombre: 'Open space', tipo: 'open', ancho: 12, largo: 8 }], { largoPuesto: 1500 });
    expect(p.islas).toBe(1);
    expect(p.operativos).toBe(16);      // 12 / 1.5 = 8 por hilera, doble
  });

  it('una isla angosta no da bench doble', () => {
    // 4.5 × 2.0 m: cabe UNA hilera con su silla, no dos enfrentadas.
    expect(puestosPorIsla({ ancho: 4.5, largo: 2.0 }, 1500)).toBe(3);
    // 4.5 × 3.5 m sí: 3 por hilera × 2.
    expect(puestosPorIsla({ ancho: 4.5, largo: 3.5 }, 1500)).toBe(6);
  });

  it('sin plano no inventa nada', () => {
    const p = programaDelPlano([], {});
    expect(p.hayPlano).toBe(false);
    expect(p.operativos).toBe(0);
    expect(resumenDelPlano(p)).toBe('');
  });

  it('el resumen se lee en español', () => {
    const t = resumenDelPlano(programaDelPlano(PLANO, { largoPuesto: 1500 }));
    // Procedencia honesta: los puestos se ESTIMAN (confírmame), no se afirman "del plano".
    expect(t).toMatch(/~?48 puestos operativos/);
    expect(t).toMatch(/estim|confírmame/i);
    expect(t).toMatch(/5 privados/);
    expect(t).toMatch(/recepción/);
    // Sillas/gavetas van como SUGERENCIA, no como detectado.
    expect(t).toMatch(/sugiero|sugerido/i);
  });
});

describe('la sala de juntas: se propone, no se impone', () => {
  const SALAS = [
    { nombre: 'Sala Juntas 1', tipo: 'juntas', ancho: 7, largo: 6 },   // 42 m²
    { nombre: 'Sala Juntas 2', tipo: 'juntas', ancho: 7, largo: 5 },   // 35 m²
  ];
  const pr = programaDelPlano(SALAS, {});

  it('siempre en PAR: 8, no 9', () => {
    // Rodrigo lo dictó: la gente se sienta enfrentada, un impar deja un lugar
    // suelto. 35 m² / 4 = 8.75 -> 8, nunca 9.
    expect(pr.salas).toEqual([10, 8]);
    expect(pr.salas.every((n) => n % 2 === 0)).toBe(true);
  });

  it('si pide MENOS de lo que cabe, lo avisa sin cambiárselo', () => {
    const av = avisosDeSala(pr, 4).join(' | ');
    expect(av).toMatch(/podríamos meter una sala para 8/);
    expect(av).toMatch(/pediste 4/);
  });

  it('y ofrece la credenza con el lugar que sobra', () => {
    expect(avisosDeSala(pr, 4).join(' | ')).toMatch(/credenza/);
    // Con la sala llena ya no sobra: no se ofrece por ofrecer.
    expect(avisosDeSala(pr, 10).join(' | ')).not.toMatch(/Sala Juntas 1 sobra/);
  });

  it('si pide MÁS de lo que cabe, se lo dice', () => {
    expect(avisosDeSala(pr, 14).join(' | ')).toMatch(/da para 10 personas, y pediste 14/);
  });

  it('sin plano no dice nada de salas', () => {
    expect(avisosDeSala(programaDelPlano([], {}), 8)).toEqual([]);
  });
});

// ============================================================================
//  UN CUARTO SIN `tipo` Y DE NOMBRE GENÉRICO SE CLASIFICA POR TAMAÑO
//  Igual que el acomodo real (`rolCuartoBase`, planner.js): cuando el lector no
//  está seguro del tipo y el nombre no trae ninguna palabra clave ("Sala 12"),
//  el cuarto no debe desaparecer del programa — se clasifica por su tamaño,
//  relativo al más grande del plano.
// ============================================================================
describe('rolDe: respaldo por tamaño cuando no hay tipo ni nombre reconocible', () => {
  const AREAS = [
    { nombre: 'Sala 12', ancho: 20, largo: 15 },   // 300 m² · la más grande -> open
    { nombre: 'Sala 7', ancho: 3, largo: 2.5 },     // 7.5 m² -> privado
    { nombre: 'Sala 3', ancho: 2, largo: 2 },       // 4 m² -> servicio (no amuebla)
  ];

  it('el open space genérico sí cuenta como zona de trabajo', () => {
    const pr = programaDelPlano(AREAS, { largoPuesto: 1500 });
    expect(pr.islas).toBe(1);
    expect(pr.operativos).toBeGreaterThan(0);
  });

  it('el cuarto chico genérico sí cuenta como privado', () => {
    const pr = programaDelPlano(AREAS, { largoPuesto: 1500 });
    expect(pr.privados).toBe(1);
  });
});


describe('capacidad de juntas fail-closed', () => {
  it('0 m² no inventa cuatro personas', () => {
    expect(personasEnSala(0)).toBe(0);
  });
  it('área insuficiente para cuatro según la regla no certifica capacidad', () => {
    expect(personasEnSala(12)).toBe(0);
  });
  it('16 m² sí soporta cuatro según 4 m²/persona', () => {
    expect(personasEnSala(16)).toBe(4);
  });
});
