import { describe, it, expect } from 'vitest';
import { rolDe, programaDelPlano } from './programaDelPlano.js';

// El fix de RAÍZ: un pasillo se reconoce por su FORMA (largo y angosto), no por
// memorizar su nombre. Esta batería prueba que GENERALIZA: nombres que NO están
// en ninguna lista, sin rótulo, y —lo más importante— que NO se come zonas
// largas que SÍ llevan muebles (eso sería overfit al revés).

describe('pasillo por forma · GENERALIZA a cualquier plano', () => {
  // POSITIVOS: franjas largas y angostas = circulación (servicio, sin muebles),
  // con nombres que el clasificador por nombre NO conoce, o sin nombre.
  it.each([
    ['ANDADOR',        20,   1.8],
    ['GALERÍA',        18,   2.0],
    ['PASO 3',         14,   1.5],
    ['circulacion b2', 16,   1.6],
    ['Zona 7',         10,   2.0],  // 5:1 exacto, 2.00 m: el borde
    ['',               22,   2.0],  // SIN rótulo: sólo la forma lo delata
  ])('«%s» %s×%s m (largo y angosto) → servicio (sin muebles)', (nombre, ancho, largo) => {
    expect(rolDe({ nombre, ancho, largo }, [{ nombre, ancho, largo }])).toBe('servicio');
  });

  it('un corredor que es el área MÁS GRANDE del plano sigue siendo circulación (la forma manda sobre el tamaño)', () => {
    const corredor = { nombre: 'eje central', ancho: 30, largo: 2 };          // 60 m², el mayor
    const privado = { nombre: '', ancho: 5, largo: 5 };
    expect(rolDe(corredor, [corredor, privado])).toBe('servicio');
  });

  // NEGATIVOS: zonas largas que SÍ son muebles — NO se deben comer.
  it.each([
    ['Área operativa', 12,  7,   'open'],     // ancha: no es pasillo
    ['',               12,  2.5, undefined],  // 2.5 m de ancho: NO es pasillo (umbral 2.0)
    ['',               7,   5,   undefined],  // cuadrada: no es pasillo
    ['Sala de juntas', 7,   5,   'juntas'],   // el NOMBRE manda sobre la forma
  ])('«%s» %s×%s m NO se clasifica como circulación', (nombre, ancho, largo, esperado) => {
    const rol = rolDe({ nombre, ancho, largo }, [{ nombre, ancho, largo }]);
    expect(rol).not.toBe('servicio');
    if (esperado) expect(rol).toBe(esperado);
  });

  it('plano con pasillo SIN rótulo: no mete una sala de juntas fantasma (sólo las 2 salas reales)', () => {
    const areas = [
      { nombre: 'OPERATIVA',       ancho: 12, largo: 7 },
      { nombre: '',                ancho: 22, largo: 2 },  // el pasillo, sin nombre
      { nombre: 'SALA DE CONSEJO', ancho: 7,  largo: 5 },
      { nombre: 'SALA CREATIVA',   ancho: 6,  largo: 5 },
    ];
    const prog = programaDelPlano(areas);
    expect(prog.salas).toEqual([8, 6]);
    expect(prog.salas).not.toContain(11); // 22×2=44 m² → ~11 personas si lo tomara como sala
  });
});
