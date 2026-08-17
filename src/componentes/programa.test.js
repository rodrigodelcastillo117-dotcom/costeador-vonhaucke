import { describe, it, expect } from 'vitest';
import { fraseDe } from './ProgramaProyecto.jsx';

// La frase es el CONTRATO con Voni: es lo que ella tiene que poder traducir a
// muebles. Si cambia de forma sin querer, Voni deja de entender el proyecto.
const BASE = {
  operativos: 0, largoPuesto: 1500, lineaOperativos: 'applt', sillaOperativa: 'WIN',
  privados: 0, largoPrivado: 2100, credenza: true, lineaPrivados: 'eclipse', sillaVisita: 'CONCERTO',
  juntas: 0, recepcion: false, guardas: 0,
};

describe('la frase que se le entrega a Voni', () => {
  it('dice los puestos, su largo, su línea y su silla', () => {
    const f = fraseDe({ ...BASE, operativos: 20 });
    expect(f).toMatch(/20 lugares de trabajo en bench/);
    expect(f).toMatch(/applt/);
    expect(f).toMatch(/1\.50 m por puesto/);
    expect(f).toMatch(/20 sillas operativas WIN/);
  });

  it('un privado trae escritorio, credenza y DOS sillas de visita', () => {
    const f = fraseDe({ ...BASE, privados: 5 });
    expect(f).toMatch(/5 oficinas privadas/);
    expect(f).toMatch(/y su credenza/);
    expect(f).toMatch(/10 sillas de visita CONCERTO/);   // 2 por privado, la regla de Rodrigo
  });

  it('sin credenza no la menciona', () => {
    expect(fraseDe({ ...BASE, privados: 2, credenza: false })).not.toMatch(/credenza/);
  });

  it('la sala de juntas PIDE SU MESA y sus sillas', () => {
    // ⚠️ CAMBIÓ A PROPÓSITO (2026-08-17). Decía "para 12 personas con sus 12
    // sillas" y Voni armaba las sillas pero NINGUNA MESA: en el plano real las
    // dos salas salían vacías y Rodrigo: *"tampoco veo las salas de juntas"*.
    // No es que no se dibujaran — es que la mesa no existía en la lista.
    const f = fraseDe({ ...BASE, juntas: 12 });
    expect(f).toMatch(/sala de juntas para 12 personas/);
    expect(f).toMatch(/mesa de juntas/);
    expect(f).toMatch(/12 sillas/);
  });

  it('con varias salas del plano, pide una mesa POR SALA', () => {
    const f = fraseDe({ ...BASE, juntas: 10, salas: [10, 8] });
    expect(f).toMatch(/2 salas de juntas \(para 10 y 8 personas\)/);
    expect(f).toMatch(/cada una con su mesa de juntas/);
  });

  it('con islas del plano, dice CÓMO partir los puestos', () => {
    // Sin esto Voni armó 4 bancas de 12 usuarios (10.80 m) para islas de 4.50 m.
    const f = fraseDe({ ...BASE, operativos: 48, islas: 8, porIsla: 6 });
    expect(f).toMatch(/48 lugares de trabajo repartidos en 8 bancas de 6 usuarios/);
  });

  it('lo que vale cero no se dice', () => {
    const f = fraseDe({ ...BASE, operativos: 4 });
    expect(f).not.toMatch(/privada|juntas|recepci|archivero/);
  });

  it('un proyecto completo cabe en una sola frase', () => {
    const f = fraseDe({ ...BASE, operativos: 90, privados: 5, juntas: 12, recepcion: true, guardas: 6 });
    for (const t of [/90 lugares/, /5 oficinas privadas/, /juntas para 12/, /recepción/, /6 archiveros/]) {
      expect(f).toMatch(t);
    }
  });
});
