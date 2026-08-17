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

  it('la sala de juntas trae sus sillas', () => {
    expect(fraseDe({ ...BASE, juntas: 12 })).toMatch(/sala de juntas para 12 personas con sus 12 sillas/);
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
