import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { calcular, costeoEmitible } from '../motor/calculo.js';

describe('P-01 resultado móvil: rótulos pendientes y guardado borrador', () => {
  it('una partida de rótulos sin insumo NUNCA se suma como $0 ni libera precio total', () => {
    // Fixture sintético, ningún precio comercial se modifica.
    const cat = {
      tablero: { id: 'tablero', nombre: 'Melamina genérica 19 mm',
        precio: 100, unidad: 'm2', seccion: 'cubiertas', clase: 'directa' },
    };
    const r = calcular({
      nombre: 'Exhibidor de prueba', modoManoObra: 'porcentaje',
      piezas: 1, componentes: [
        { nombre: 'Repisa de prueba', insumoId: 'tablero', largoMM: 900, anchoMM: 500, cantidad: 1, piezas: 1 },
        { nombre: 'Rótulos SNACKS/BEBIDAS/GRAB & GO', insumoId: '', cantidad: 1, piezas: 1 },
      ],
    }, 1, cat);
    expect(r.costoUnitario).toBeGreaterThan(0);
    expect(r.componentesIgnorados).toContain('Rótulos SNACKS/BEBIDAS/GRAB & GO');
    const gate = costeoEmitible(r);
    expect(gate.emitible).toBe(false);
    expect(gate.costoTotal).toBeNull();
    expect(gate.subtotalConocido).toBeGreaterThan(0);
  });
  it('el usuario vuelve a decidir quién aporta rótulos, sin exclusión oculta', () => {
    const src = fs.readFileSync('src/componentes/AsistenteEspecial.jsx', 'utf8');
    expect(src).toContain("setDestinoPaso1(hayRotulosPendientes && hayPreguntaRotulos ? 'rotulos' : 'despiece')");
    expect(src).toContain('Resolver quién suministra los rótulos');
    expect(src).toContain("id={esTemaRotulos(q.pregunta) ? 'vh-pregunta-rotulos' : undefined}");
    expect(src).toContain("const emitible = emision.emitible");
    expect(src).toContain("const estadoGuardar = aprobadoBloqueado ? 'borrador' : (emitible ? estadoExp : 'borrador')");
    expect(src).not.toContain('No es obligatorio; puedes cotizar así.');
  });
  it('conserva ambos tipos de render pero no crea recuadros grandes vacíos', () => {
    const src = fs.readFileSync('src/componentes/AsistenteEspecial.jsx', 'utf8');
    expect(src).toContain('renders.aislado || renders.ambiente || renderizando');
    expect(src).toContain('<img src={renders[m]} alt={m}');
    expect(src).toContain('Todavía no hay renders.');
  });
});
