// VH-120 · la capacidad viaja con su FUENTE: CATALOGO (ficha), USUARIO (lo que dijo la persona),
// INFERIDA (leída del nombre). GEOMETRICA la declara el solver. Nada se inventa: sin evidencia → null.
import { describe, it, expect } from 'vitest';
import { fuenteCapacidad, capacidadDeNombre, FUENTES_CAPACIDAD } from './capacidadDeclarada.js';

describe('VH-120 · fuenteCapacidad', () => {
  it('ficha del programa o del banco ⇒ CATALOGO', () => {
    expect(fuenteCapacidad({ nombre: 'Módulo operativo App LT 8 usuarios', user_capacity: 8, source: 'CONFIRMADO_PROGRAMA' })).toMatchObject({ capacidad: 8, fuente: 'CATALOGO' });
    expect(fuenteCapacidad({ nombre: 'Bench doble APP LT', usuarios: 8, deBanco: true })).toMatchObject({ capacidad: 8, fuente: 'CATALOGO', evidencia: 'usuarios' });
  });
  it('lo que declaró la persona (usuarios / user_capacity en SU fila) ⇒ USUARIO; gana sobre el nombre', () => {
    expect(fuenteCapacidad({ nombre: 'Banca doble APP LT 1.50 · 8 usuarios', usuarios: 12 })).toMatchObject({ capacidad: 12, fuente: 'USUARIO' });
    expect(fuenteCapacidad({ nombre: 'Banca', user_capacity: 6 })).toMatchObject({ capacidad: 6, fuente: 'USUARIO' });
  });
  it('sólo el nombre ⇒ INFERIDA (marcada); user_capacity_inferida conserva INFERIDA aunque ya traiga número', () => {
    expect(fuenteCapacidad({ nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m' })).toMatchObject({ capacidad: 8, fuente: 'INFERIDA' });
    expect(fuenteCapacidad({ nombre: 'Banca doble APP LT', w: 6000 }, { rol: 'ANCHOR_WORKSTATION' })).toMatchObject({ capacidad: 8, fuente: 'INFERIDA' });
    expect(fuenteCapacidad({ nombre: 'Banca doble', user_capacity: 8, user_capacity_inferida: true })).toMatchObject({ capacidad: 8, fuente: 'INFERIDA' });
  });
  it('capacity_source explícito se respeta; sin evidencia ⇒ null (nunca cero)', () => {
    expect(fuenteCapacidad({ nombre: 'Banca 8 usuarios', user_capacity: 8, capacity_source: 'CATALOGO' }).fuente).toBe('CATALOGO');
    expect(fuenteCapacidad({ nombre: 'Escritorio APP LT 1.50 × 0.75', w: 1500 }, { rol: 'ANCHOR_DESK' })).toEqual({ capacidad: null, fuente: null, evidencia: null });
    expect(FUENTES_CAPACIDAD).toEqual(['CATALOGO', 'USUARIO', 'INFERIDA', 'GEOMETRICA']);
    expect(capacidadDeNombre('Banca 0 usuarios')).toBe(null);
  });
});
