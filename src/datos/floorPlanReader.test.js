import { describe, it, expect } from 'vitest';
import { programaDelPlano } from './programaDelPlano.js';
import { observedProgramDeLectura } from './floorPlanReader.js';
import { ORIGEN, KIND, validarObservedProgram, resumenObservado } from './observedProgram.js';

// Este test EJERCITA el lector real (programaDelPlano) y lo cablea al contrato
// observed_program — NO construye a mano el array esperado (ChatGPT). Verifica
// que la PROCEDENCIA honesta del lector (detectado/estimado/sugerido) se conserva.
describe('FloorPlanReader → observed_program (cable real, sin arrays sintéticos)', () => {
  // Oficina simple: un open space + una sala de juntas (medidas en metros).
  const AREAS = [
    { nombre: 'OPERATIVO', ancho: 8, largo: 6 },
    { nombre: 'SALA DE JUNTAS', ancho: 5, largo: 4 },
  ];
  const pr = programaDelPlano(AREAS);
  const items = observedProgramDeLectura(pr);

  it('produce un observed_program válido a partir de la salida REAL del lector', () => {
    expect(pr.hayPlano).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    expect(validarObservedProgram(items).ok).toBe(true);
    // El cable NO es vacío: hay al menos puestos operativos y sillas sugeridas.
    expect(items.some((i) => i.type === 'puesto_operativo')).toBe(true);
    expect(items.some((i) => i.type === 'silla_operativa' && i.origin === ORIGEN.SUGGESTED)).toBe(true);
  });

  it('respeta la procedencia del lector: sugeridos NUNCA cuentan como observados', () => {
    const sillas = items.find((i) => i.type === 'silla_operativa');
    if (sillas) expect(sillas.origin).toBe(ORIGEN.SUGGESTED);
    const gavetas = items.find((i) => i.type === 'gaveta');
    if (gavetas) expect(gavetas.origin).toBe(ORIGEN.SUGGESTED);
  });

  it('los puestos estimados por área son INFERRED (hay que confirmarlos), no OBSERVED', () => {
    const puestos = items.find((i) => i.type === 'puesto_operativo');
    // El lector marca operativos como "estimado" cuando no los contó del dibujo.
    if (puestos && pr.fuente?.operativos === 'estimado') {
      expect(puestos.origin).toBe(ORIGEN.INFERRED);
    }
  });

  it('la mesa de juntas lleva su CAPACIDAD (personas), con quantity=1 (mueble)', () => {
    const mesa = items.find((i) => i.type === 'mesa_juntas');
    if (mesa) {
      expect(mesa.quantity).toBe(1);
      expect(mesa.capacity_per_unit).toBeGreaterThan(0);  // capacidad = personas que caben
    }
  });

  it('el resumen separa real (observed) de lo que falta confirmar (inferred/suggested)', () => {
    const res = resumenObservado(items);
    // Hay sugeridos (sillas/gavetas) → siempre hay pendientes de confirmar.
    expect(res.hayPendientesDeConfirmar).toBe(true);
  });

  it('ChatGPT #3: CUARTO observado ≠ MUEBLE observado — se emiten y cuentan por separado', () => {
    const rooms = items.filter((i) => i.kind === KIND.ROOM);
    const muebles = items.filter((i) => i.kind !== KIND.ROOM);
    expect(rooms.length).toBeGreaterThan(0);        // al menos open space + sala
    expect(muebles.length).toBeGreaterThan(0);      // puestos + sugeridos
    const res = resumenObservado(items);
    // Los cuartos NO inflan el conteo de muebles ni de puestos.
    expect(res.cuartos).toBe(rooms.length);
    expect(res.muebles).toBe(muebles.length);
    expect(res.cuartosObservados).toBeGreaterThan(0);
    // porTipo (muebles) no incluye tipos de cuarto (open_space/sala_juntas/privado).
    expect(res.porTipo.open_space).toBeUndefined();
  });

  it('DETERMINISTA: misma lectura → mismo observed_program', () => {
    expect(observedProgramDeLectura(pr)).toEqual(observedProgramDeLectura(programaDelPlano(AREAS)));
  });

  it('ChatGPT P0-C: aunque el CUARTO esté DETECTADO, el MUEBLE que implica es INFERRED, no OBSERVED', () => {
    // Cuartos detectados + mobiliario derivado de ellos.
    const prDetectado = {
      hayPlano: true,
      operativos: 8, privados: 2, salas: [8], recepcion: true,
      sugeridos: { sillasOperativas: 8, gavetas: 8, archiveros: 2 },
      zonas: {
        operativo: { nombre: 'OPEN SPACE' },
        privados: [{ nombre: 'DIRECCIÓN A' }, { nombre: 'DIRECCIÓN B' }],
        juntas: [{ nombre: 'JUNTAS' }],
        recepcion: { nombre: 'RECEPCIÓN' },
      },
      // TODO detectado (el peor caso para el bug): el cuarto se ve, el mueble no.
      fuente: { operativos: 'detectado', privados: 'detectado', salas: 'detectado', recepcion: 'detectado' },
    };
    const out = observedProgramDeLectura(prDetectado);
    const escritorio = out.find((i) => i.type === 'escritorio_direccion');
    const mesa = out.find((i) => i.type === 'mesa_juntas');
    const mostrador = out.find((i) => i.kind !== KIND.ROOM && i.type === 'recepcion');
    // El MUEBLE derivado del cuarto NUNCA es OBSERVED (a lo sumo INFERRED).
    expect(escritorio.origin).toBe(ORIGEN.INFERRED);
    expect(mesa.origin).toBe(ORIGEN.INFERRED);
    expect(mostrador.origin).toBe(ORIGEN.INFERRED);
    // Pero el CUARTO sí es OBSERVED (su geometría se detectó).
    const cuartoDir = out.find((i) => i.kind === KIND.ROOM && i.type === 'privado');
    expect(cuartoDir.origin).toBe(ORIGEN.OBSERVED);
    // Y los puestos contados del dibujo sí pueden ser OBSERVED.
    const puestos = out.find((i) => i.type === 'puesto_operativo');
    expect(puestos.origin).toBe(ORIGEN.OBSERVED);
  });
});
