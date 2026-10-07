import { describe, it, expect } from 'vitest';
import { formatearMensajeVendedor } from './mensajeAcomodo.js';

describe('G · formatearMensajeVendedor (cliente)', () => {
  it('sin mensaje / sin pendientes → null (UI no cambia con el edge viejo)', () => {
    expect(formatearMensajeVendedor(null)).toBeNull();
    expect(formatearMensajeVendedor({ hay_pendientes: false })).toBeNull();
    expect(formatearMensajeVendedor({ hay_pendientes: true, pendientes: [] })).toBeNull();
  });

  it('con pendientes → QUÉ no cupó + POR QUÉ causal + 2–3 opciones', () => {
    const mv = {
      hay_pendientes: true,
      pendientes: [{ rol: 'WORK_SEAT', n: 2, texto: '2 sillas operativas' }, { rol: 'UNDERDESK_STORAGE', n: 1, texto: '1 gaveta' }],
      motivos: [{ invariante: 'NO_SPACE', texto: 'El grupo necesita ~10.8 m² y el área disponible es de ~9.0 m².' }],
      opciones: [{ id: 'quitar_no_colocadas', texto: 'Quitar 2 sillas operativas…' }, { id: 'espacio_suficiente', texto: 'Usar un área de al menos ~12 m²…' }, { id: 'mueble_mas_chico', texto: 'Usar una estación de 2 puestos…' }, { id: 'extra', texto: 'extra' }],
    };
    const r = formatearMensajeVendedor(mv);
    expect(r).not.toBeNull();
    // D (microcoherencia): el formatter NO antepone "• " (la viñeta la pone el <li>).
    expect(r.queNoCupo).toEqual(['2 sillas operativas', '1 gaveta']);
    expect(r.porque[0]).toContain('m²');
    expect(r.queHacer).toHaveLength(3);   // máximo 3 opciones
    expect(r.resumen).toContain('Quedaron pendientes');
  });
});
