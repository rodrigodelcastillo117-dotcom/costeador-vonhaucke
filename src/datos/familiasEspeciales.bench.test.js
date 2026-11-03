// COSTEAR 100 · FASE 10/16 — Benchmark de FAMILIAS ESPECIALES (conductual).
// "NO TODO MUEBLE ES UN ESCRITORIO." Prueba que el motor industrial (subsistemas +
// routing + detector de omisiones + ingeniería de valor) se comporta correctamente
// en muebles especiales tipo TELCEL/Alpura: exhibidores, islas, torres, vidrio,
// iluminados, refrigerador integrado, mixto madera-metal, modular.
//
// HONESTO: son casos SINTÉTICOS para validar comportamiento, integridad y seguridad
// (no paridad de costo contra fábrica, que está gated por datos reales). Incluye
// casos adversariales (LED sin driver → bloquea; perfil de aluminio → NO falso
// "vidrio sin fijación").
import { describe, it, expect } from 'vitest';
import { detectarOmisiones } from './deteccionOmisiones.js';
import { proponerRouting } from './routingFabricacion.js';
import { clasificarPorSubsistema } from './subsistemas.js';
import { analizarValor } from './ingenieriaValor.js';

const omis = (ps) => detectarOmisiones({ piezas: ps });
const rout = (ps) => proponerRouting({ piezas: ps });
const subs = (ps) => clasificarPorSubsistema({ piezas: ps });
const tieneOp = (r, op) => r.operaciones.some((o) => o.op === op);
const tieneHallazgo = (r, k) => r.hallazgos.some((h) => h.regla === k);

describe('FAMILIAS · exhibidor metálico iluminado', () => {
  const conDriver = [
    { nombre: 'Lámina negra calibre 18' }, { nombre: 'Tubular industrial 1"' },
    { nombre: 'Pintura en polvo PPH azul TELCEL' },
    { nombre: 'Tira LED 12V 5m' }, { nombre: 'Driver / fuente 60W 12V' },
    { nombre: 'Lateral metálico', semantic_role: 'lateral' },
  ];
  it('subsistemas: estructura + acabados + eléctrico', () => {
    expect(subs(conDriver).presentes).toEqual(expect.arrayContaining(['estructura', 'acabados', 'electrico']));
  });
  it('routing: soldadura + pintura electrostática + cableado + pruebas eléctricas', () => {
    const r = rout(conDriver);
    for (const op of ['soldadura', 'pintura_electrostatica', 'cableado', 'pruebas_electricas']) expect(tieneOp(r, op)).toBe(true);
  });
  it('CON driver → no bloquea certificación', () => {
    expect(omis(conDriver).resumen.bloquea_certificacion).toBe(false);
  });
  it('ADVERSARIAL: SIN driver → led_sin_driver bloquea', () => {
    const sinDriver = conDriver.filter((p) => !/driver|fuente/i.test(p.nombre));
    const r = omis(sinDriver);
    expect(tieneHallazgo(r, 'led_sin_driver')).toBe(true);
    expect(r.resumen.bloquea_certificacion).toBe(true);
  });
});

describe('FAMILIAS · isla con vidrio', () => {
  const sinFijacion = [
    { nombre: 'Lámina negra 18' }, { nombre: 'Tubular 1"' },
    { nombre: 'Cristal templado 6 mm', semantic_role: 'cristal' },
  ];
  it('transparentes presente; routing corte_vidrio + colocación', () => {
    expect(subs(sinFijacion).presentes).toContain('transparentes');
    const r = rout(sinFijacion);
    expect(tieneOp(r, 'corte_vidrio')).toBe(true);
    expect(tieneOp(r, 'colocacion_vidrio')).toBe(true);
  });
  it('vidrio sin fijación → RIESGO', () => {
    expect(tieneHallazgo(omis(sinFijacion), 'vidrio_sin_fijacion')).toBe(true);
  });
  it('ADVERSARIAL: con perfil de aluminio (la fijación) → NO marca "vidrio sin fijación"', () => {
    const conPerfil = [...sinFijacion, { nombre: 'Perfil de aluminio para cristal' }];
    expect(tieneHallazgo(omis(conPerfil), 'vidrio_sin_fijacion')).toBe(false);
  });
});

describe('FAMILIAS · mueble con refrigerador integrado', () => {
  const conEquipo = [
    { nombre: 'Lámina negra 18' }, { nombre: 'Tubular 1"' },
    { nombre: 'Refrigerador comercial (suministra cliente?)' },
  ];
  it('equipos → requiere decisión económica (confirmar)', () => {
    const s = subs(conEquipo);
    expect(s.presentes).toContain('equipos');
    expect(s.resumen.requiere_decision_economica).toBe(true);
  });
  it('equipo sin soporte → RIESGO', () => {
    expect(tieneHallazgo(omis(conEquipo), 'equipo_sin_soporte')).toBe(true);
  });
});

describe('FAMILIAS · mixto madera-metal con herrajes', () => {
  const mixto = [
    { nombre: 'Tubular 1"' }, { nombre: 'Cubierta melamina', semantic_role: 'cubierta' },
    { nombre: 'Bisagra recta 110°', semantic_role: 'herraje' }, { nombre: 'Corredera de extensión' },
  ];
  it('subsistemas: estructura + panelería + herrajes (herrajes=compra-venta)', () => {
    const s = subs(mixto);
    expect(s.presentes).toEqual(expect.arrayContaining(['estructura', 'paneleria', 'herrajes']));
    expect(s.grupos.herrajes.ubicacion).toBe('compra_venta');
  });
  it('routing: corte de tablero + soldadura + instalación de herrajes', () => {
    const r = rout(mixto);
    for (const op of ['corte_tablero', 'soldadura', 'instalacion_herrajes']) expect(tieneOp(r, op)).toBe(true);
  });
  it('herrajes presentes → no marca puertas/cajones sin herraje de más', () => {
    const r = omis(mixto);
    expect(tieneHallazgo(r, 'cajones_sin_corredera')).toBe(false); // hay corredera
  });
});

describe('FAMILIAS · gabinete técnico con cableado', () => {
  const gab = [
    { nombre: 'Lateral melamina', semantic_role: 'lateral' },
    { nombre: 'Cableado eléctrico y canaleta' }, { nombre: 'Interruptor y pasacables' },
  ];
  it('subsistemas: panelería + eléctrico; routing cableado + pruebas', () => {
    expect(subs(gab).presentes).toEqual(expect.arrayContaining(['paneleria', 'electrico']));
    const r = rout(gab);
    expect(tieneOp(r, 'cableado')).toBe(true);
    expect(tieneOp(r, 'pruebas_electricas')).toBe(true);
  });
});

describe('FAMILIAS · módulo modular repetido (ingeniería de valor)', () => {
  it('piezas idénticas repetidas → VONI propone estandarizar (confianza ALTA)', () => {
    const rep = { nombre: 'Entrepaño melamina 900×300', semantic_role: 'entrepano', largoMM: 900, anchoMM: 300, insumoId: 'mel16' };
    const r = analizarValor({ piezas: [rep, { ...rep }, { ...rep }, { ...rep }] });
    const o = r.oportunidades.find((x) => x.regla === 'estandarizar_repetidas');
    expect(o).toBeTruthy();
    expect(o.confianza).toBe('ALTA');
  });
});
