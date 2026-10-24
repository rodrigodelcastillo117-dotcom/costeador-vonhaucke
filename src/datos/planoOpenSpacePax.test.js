import { describe, it, expect } from 'vitest';
import { capacidadDeNombre } from './capacidadDeclarada.js';
import { programaDelPlano } from './programaDelPlano.js';
import { proponerProgramaDelPlano, aplicarPrograma } from './programaRealDelPlano.js';

// Plano real de Rodrigo (21-oct, "Propuesta de Inversión… 500 m²"): 4 privados, 3 open space "(8 PAX)" SIN
// escritorios dibujados, 2 salas, recepción. El programa daba 0 bancas (o 2 de 12 que no caben en 6.6 m).
const A = (nombre, x, y, ancho, largo, tipo) => ({ nombre, x, y, ancho, largo, tipo });
const PLANO500 = [
  A('PRIVADO 4', 0, 0, 4.0, 3.3, 'privado'), A('PRIVADO 3', 0, 3.3, 4.0, 3.3, 'privado'),
  A('PRIVADO 2', 0, 6.6, 4.0, 3.3, 'privado'), A('PRIVADO 1', 0, 9.9, 4.0, 3.3, 'privado'),
  A('PASILLO', 4.0, 0, 2.0, 13.2, 'servicio'),
  A('OPEN SPACE 01 (8 PAX)', 6.0, 0, 6.6, 4.9, 'open'), A('OPEN SPACE 02 (8 PAX)', 12.6, 0, 7.8, 4.9, 'open'),
  A('OPEN SPACE 03 (8 PAX)', 6.0, 4.9, 14.4, 4.1, 'open'),
  A('RECEPCIÓN', 6.0, 9.0, 3.2, 4.2, 'recepcion'),
  A('SALA JUNTAS 2', 9.2, 9.0, 5.6, 4.2, 'juntas'), A('SALA JUNTAS 1', 14.8, 9.0, 5.6, 4.2, 'juntas'),
];

describe('open space con capacidad escrita en el nombre ("8 PAX")', () => {
  it('PAX cuenta como personas', () => {
    expect(capacidadDeNombre('OPEN SPACE 01 (8 PAX)')).toBe(8);
    expect(capacidadDeNombre('Sala de juntas 10 pax')).toBe(10);
    expect(capacidadDeNombre('PAXTON')).toBe(null);
  });
  it('24 puestos del plano (no 36 estimados por área), uno por cuarto', () => {
    const p = programaDelPlano(PLANO500);
    expect(p.operativos).toBe(24);
    expect(p.fuente.operativos).toBe('detectado');
    expect(p.operativosPorZona.map((o) => o.puestos)).toEqual([8, 8, 8]);
    expect(p.privados).toBe(4);
  });
  it('una banca de 8 EN CADA open space (no 2 de 12 que no caben)', () => {
    const r = proponerProgramaDelPlano(PLANO500);
    const v = aplicarPrograma(r.propuesta || r, { existentes: [] });
    const items = v.confirmacion.confirmadas;
    const bancas = items.filter((x) => x.relation_role === 'ANCHOR_WORKSTATION');
    expect(bancas.map((b) => b.bancoId)).toEqual(['op-8u-4800x1200-cristal', 'op-8u-4800x1200-cristal', 'op-8u-4800x1200-cristal']);
    expect(new Set(bancas.map((b) => b.zone_id))).toEqual(new Set(['OPEN SPACE 01 (8 PAX)', 'OPEN SPACE 02 (8 PAX)', 'OPEN SPACE 03 (8 PAX)']));
    const sillas = items.filter((x) => x.relation_role === 'WORK_SEAT' && /OPEN SPACE/.test(String(x.zone_id))).reduce((s, x) => s + x.cantidad, 0);
    expect(sillas).toBe(24);
    expect(items.filter((x) => x.relation_role === 'ANCHOR_DESK')).toHaveLength(4);
  });
  it('un open space SIN conteo queda fuera y se avisa (regla de siempre); los otros siguen por cuarto', () => {
    const sinUno = PLANO500.map((a) => (a.nombre === 'OPEN SPACE 02 (8 PAX)' ? { ...a, nombre: 'OPEN SPACE 02' } : a));
    const p = programaDelPlano(sinUno);
    expect(p.operativos).toBe(16);
    expect(p.operativosPorZona.map((o) => o.nombre)).toEqual(['OPEN SPACE 01 (8 PAX)', 'OPEN SPACE 03 (8 PAX)']);
    expect(p.avisos.join(' ')).toMatch(/OPEN SPACE 02.*no tiene escritorios dibujados/);
  });
  it('sin ningún conteo (ni dibujado ni escrito): un total por geometría, como siempre', () => {
    const sinNada = PLANO500.map((a) => (a.tipo === 'open' ? { ...a, nombre: a.nombre.replace(/ \(8 PAX\)/, '') } : a));
    const p = programaDelPlano(sinNada);
    expect(p.operativosPorZona).toBeUndefined();
    expect(p.fuente.operativos).toBe('estimado');
  });
});
