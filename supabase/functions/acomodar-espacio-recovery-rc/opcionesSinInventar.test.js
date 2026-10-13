// ============================================================================
//  ACOMODO 10 · VH-A10-05 (RC) · las OPCIONES al vendedor no inventan medidas ni bancas fuera de la guía.
//
//  Lab C2 (sala de consejo circular de 5 m, mesa Eclipse de 4.80 m): el mensaje proponía "Cambiar la mesa
//  de 4.80 m por una de 2.88 m" (0.6 × la mesa: una medida que no existe en el catálogo) y, para bancas,
//  "una estación de N puestos" de N × 1500 mm, con N impar (la guía APP LT ESP-DCC-IDP-003: banca doble =
//  2 usuarios por cubierta, cubiertas de 1200/1500/1800). Ahora:
//   · mesa: se ofrece sentar MENOS personas (en pares) en la MISMA mesa, verificado por simulación;
//   · banca: menos cubiertas de la MISMA medida (doble: usuarios pares), o nada si la medida no es de guía.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { mensajeVendedor } from './opciones.js';
import { resolverKitsMulti } from './kit-solver.js';

const sillas = (anc, n, rol, zona) => Array.from({ length: n }, (_, i) => ({ id: `${anc}-s${i + 1}`, nombre: 'Silla', relation_role: rol,
  anchor_role: rol === 'MEETING_SEAT' ? 'ANCHOR_MEETING' : 'ANCHOR_WORKSTATION', anchor_instance_id: anc, functional_group_id: `fg:${anc}`, w: 600, d: 600, zone_id: zona }));
const medidasEn = (txt) => [...String(txt).matchAll(/(\d+\.\d{2}) m\b/g)].map((m) => Number(m[1]));

describe('VH-A10-05 · opciones sin medidas inventadas', () => {
  it('mesa que no cabe con sus sillas: nunca "una mesa de 0.6 ×" (2.88 m no existe en el catálogo)', () => {
    // Sala 5.0 × 4.0 m con la Eclipse de 4.80 m y 14 sillas: la mesa sola entra; con sus sillas, no. Antes se
    // "verificaba" una mesa de 2.88 m (0.6 × 4.80) con 7 sillas y se le proponía al vendedor.
    const areas = [{ nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 5000, largo: 4000, puertas: [] }];
    const piezas = [{ id: 'mesa', nombre: 'Mesa de consejo Eclipse', relation_role: 'ANCHOR_MEETING', w: 4800, d: 1200, user_capacity: 14, zone_id: 'SALA DE CONSEJO', functional_group_id: 'fg:mesa' },
      ...sillas('mesa', 14, 'MEETING_SEAT', 'SALA DE CONSEJO')];
    const sol = resolverKitsMulti(areas, piezas);
    const m = mensajeVendedor(areas, sol.piezas, sol, { resolver: resolverKitsMulti });
    const textos = m.opciones.map((o) => o.texto);
    expect(textos.join(' ')).not.toMatch(/por una de|2\.88/);
    for (const t of textos) for (const med of medidasEn(t)) expect([4.8]).toContain(med);   // sólo la medida real de la mesa
    for (const t of textos.filter((x) => /^Dejar/.test(x))) expect(Number(/Dejar (\d+)/.exec(t)[1]) % 2).toBe(0);
  });
  it('banca doble: menos usuarios sólo en pares y con cubiertas de la misma medida de guía', () => {
    // Banca doble 8 usuarios de 4.80 m (4 cubiertas de 1200) en un cuarto donde no entra completa.
    const areas = [{ nombre: 'OPERATIVA', tipo: 'open', ancho: 4000, largo: 4000, puertas: [] }];
    const piezas = [{ id: 'b', nombre: 'Módulo operativo App LT 8 usuarios', relation_role: 'ANCHOR_WORKSTATION', w: 4800, d: 1200, user_capacity: 8, zone_id: 'OPERATIVA', functional_group_id: 'fg:b', placement_profile: { topology: 'DOUBLE_FACE', provenance: 'CATALOG' } },
      ...sillas('b', 8, 'WORK_SEAT', 'OPERATIVA')];
    const sol = resolverKitsMulti(areas, piezas);
    const m = mensajeVendedor(areas, sol.piezas, sol, { resolver: resolverKitsMulti });
    const banca = m.opciones.map((o) => o.texto).filter((t) => /banca|estación/i.test(t));
    expect(banca.length).toBeGreaterThan(0);
    for (const t of banca) {
      const n = Number(/de (\d+) (?:usuarios|puestos)/.exec(t)[1]);
      expect(n % 2).toBe(0);                       // banca doble: 2 usuarios por cubierta
      expect(t).toMatch(/cubiertas? de 1\.20 m/);   // misma medida de cubierta, de guía
      expect(t).not.toMatch(/1\.50|4\.50|10\.50/);  // nada de N × 1500 mm
    }
  });
  it('banca con cubierta fuera de guía (1050): no se propone otra medida inventada', () => {
    const areas = [{ nombre: 'OPERATIVA', tipo: 'open', ancho: 3000, largo: 3000, puertas: [] }];
    const piezas = [{ id: 'b', nombre: 'Banca doble 4 usuarios', relation_role: 'ANCHOR_WORKSTATION', w: 2100, d: 1200, user_capacity: 4, zone_id: 'OPERATIVA', functional_group_id: 'fg:b', placement_profile: { topology: 'DOUBLE_FACE', provenance: 'CATALOG' } },
      ...sillas('b', 4, 'WORK_SEAT', 'OPERATIVA')];
    const sol = resolverKitsMulti(areas, piezas);
    const m = mensajeVendedor(areas, sol.piezas, sol, { resolver: resolverKitsMulti });
    expect(m.opciones.some((o) => /banca|estación/i.test(o.texto))).toBe(false);
  });
});
