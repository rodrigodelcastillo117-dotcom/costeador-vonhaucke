import { describe, it, expect } from 'vitest';
import { clasificarCosto, ESTADO_COSTO } from './estadoCosto.js';
import { aplicarAHermanas } from './materialHermanas.js';
import { patchPropuestaHermana, patchConfirmacionUI, estadoMaterialUI } from './materialMatch.js';
import { revisarEstructura, medidasDe } from './revisionEstructural.js';
import { validarIntentCosteo } from './validarIntentCosteo.js';
import { carrilRcActivo, marcarExpedienteRc, ETIQUETA_CARRIL_RC } from '../nube.js';

// Hallazgos de la auditoría externa del 14-oct-2026 sobre 961c42e..e77d6d4. Pruebas de COMPORTAMIENTO (no de texto del código).
const limpio = { emitible: true, bloqueos: {}, pendientes: [] };
const srv = (estado, extra = {}) => ({ estado, aprobacionHumana: true, bomVigente: true, ...extra });

describe('P1-02 · el servidor es autoridad del estado', () => {
  it('incompleto, bloqueado o un estado desconocido del servidor → BLOQUEADO, con sus motivos', () => {
    const r = clasificarCosto({ emision: limpio, servidor: srv('incompleto', { advertencias: ['Ingeniería: cubierta sin soporte'] }) });
    expect(r.estado).toBe(ESTADO_COSTO.BLOQUEADO);
    expect(r.motivos.join(' ')).toMatch(/incompleto.*cubierta sin soporte/);
    expect(clasificarCosto({ emision: limpio, servidor: srv('bloqueado') }).estado).toBe(ESTADO_COSTO.BLOQUEADO);
    expect(clasificarCosto({ emision: limpio, servidor: srv('raro') }).estado).toBe(ESTADO_COSTO.BLOQUEADO);
    expect(clasificarCosto({ emision: limpio, servidor: srv(undefined) }).estado).toBe(ESTADO_COSTO.BLOQUEADO);
  });
  it('preliminar → PRELIMINAR; certificado con aprobación humana → VALIDADO; sin servidor → PRELIMINAR', () => {
    expect(clasificarCosto({ emision: limpio, servidor: srv('preliminar') }).estado).toBe(ESTADO_COSTO.PRELIMINAR);
    expect(clasificarCosto({ emision: limpio, servidor: srv('certificado') }).estado).toBe(ESTADO_COSTO.VALIDADO);
    expect(clasificarCosto({ emision: limpio, servidor: null }).estado).toBe(ESTADO_COSTO.PRELIMINAR);
  });
  it('una validación del servidor de OTRO despiece no bloquea ni valida', () => {
    expect(clasificarCosto({ emision: limpio, servidor: { estado: 'incompleto', bomVigente: false } }).estado).toBe(ESTADO_COSTO.PRELIMINAR);
  });
});

describe('P1-01 · material confirmado ≠ pieza confirmada', () => {
  it('una pieza INFERIDA con el material confirmado no deja validar el costo', () => {
    const comps = [{ nombre: 'Divisiones', insumoId: 'x', procedencia: 'INFERIDO', material_confirmado: true }];
    const r = clasificarCosto({ emision: limpio, servidor: srv('certificado'), componentes: comps });
    expect(r.estado).toBe(ESTADO_COSTO.PRELIMINAR);
    expect(r.motivos.join(' ')).toMatch(/infirió/);
  });
  it('con pieza_confirmada sí valida; una pieza excluida no cuenta', () => {
    expect(clasificarCosto({ emision: limpio, servidor: srv('certificado'), componentes: [{ nombre: 'D', insumoId: 'x', procedencia: 'SUPUESTO', pieza_confirmada: true }] }).estado).toBe(ESTADO_COSTO.VALIDADO);
    expect(clasificarCosto({ emision: limpio, servidor: srv('certificado'), componentes: [{ nombre: 'D', procedencia: 'SUPUESTO', excluida: true }] }).estado).toBe(ESTADO_COSTO.VALIDADO);
  });
  it('el contrato del servidor conserva procedencia y pieza_confirmada (antes los descartaba) y rechaza valores raros', () => {
    const v = validarIntentCosteo({ pieza: { componentes: [
      { nombre: 'A', insumoId: 'melamina-16', largoMM: 500, anchoMM: 400, procedencia: 'inferido', pieza_confirmada: true },
      { nombre: 'B', insumoId: 'melamina-16', largoMM: 500, anchoMM: 400, procedencia: 'CONFIRMADO_POR_IA', pieza_confirmada: 'sí' },
    ] }, cantidad: 1 });
    expect(v.ok).toBe(true);
    const [a, b] = v.intent.pieza.componentes;
    expect(a.procedencia).toBe('INFERIDO'); expect(a.pieza_confirmada).toBe(true);
    expect(b.procedencia).toBeUndefined(); expect(b.pieza_confirmada).toBeUndefined();
  });
});

describe('D2 · firmada por Dirección, pendiente Producción', () => {
  it('un tubular cobrado por fracción de tramo calcula pero no valida', () => {
    const insumos = { ptr: { id: 'ptr', nombre: 'PTR 1x1 cal 18', formato: { tipo: 'tramo', medida: 6 } } };
    const r = clasificarCosto({ emision: limpio, servidor: srv('certificado'), componentes: [{ nombre: 'Patas', insumoId: 'ptr' }], insumos });
    expect(r.estado).toBe(ESTADO_COSTO.PRELIMINAR);
    expect(r.motivos.join(' ')).toMatch(/D2/);
  });
});

describe('P2-01 · propagar a hermanas no es confirmar por la persona', () => {
  it('las hermanas reciben el artículo como PROPUESTA por confirmar, con su origen', () => {
    const comps = [
      { nombre: 'Laterales', insumoId: 'curado-28' },
      { nombre: 'Piso y techo', insumoId: 'curado-28' },
    ];
    comps[0] = { ...comps[0], insumoId: 'erp-ame28152', ...patchConfirmacionUI('erp-ame28152') };
    const { comps: out, aplicadas } = aplicarAHermanas(comps, 0, 'curado-28', 'erp-ame28152', (c) => ({ ...c, insumoId: 'erp-ame28152', ...patchPropuestaHermana('erp-ame28152', 'Laterales') }));
    expect(aplicadas).toEqual(['Piso y techo']);
    expect(out[0].material_confirmado).toBe(true);
    expect(out[1].material_confirmado).toBe(false);
    expect(out[1].propagado_desde).toBe('Laterales');
    const insumos = { 'erp-ame28152': { id: 'erp-ame28152', nombre: 'AME28152 Walnut 5x8', familia: 'melamina' } };
    expect(estadoMaterialUI(out[1], insumos).badgeTipo).toBe('confirmar');
  });
});

describe('P1-07 · una cubierta vendida sola no es "mueble sin base"', () => {
  const comps = [{ nombre: 'Cubierta', insumoId: 'melamina-28', largoMM: 1500, anchoMM: 600 }, { nombre: 'Canto ABS', insumoId: 'canto' }];
  const bloqueo = (descripcion) => revisarEstructura({ componentes: comps, descripcion }).observaciones.some((o) => o.regla === 'sin_soporte');
  it('caso real ATCUBS45ABS: la persona escribe "Cubierta…" y la IA lo clasifica "mesa" → sin bloqueo', () => {
    expect(bloqueo('Cubierta rectangular de 1500 x 600 x 28 mm modelo apps lt con puerta metalica; en melamina con cantos abs · mesa')).toBe(false);
  });
  it('una mesa completa con sólo la cubierta sigue bloqueada', () => {
    expect(bloqueo('Mesa de juntas 2400 x 1200 con cubierta de melamina · mesa')).toBe(true);
  });
});

describe('P2-03 · medidas por patrón dimensional, no por los primeros tres números', () => {
  it('un modelo o un RAL antes de las medidas no las desplazan', () => {
    expect(medidasDe('Modelo 4500 RAL 9005 escritorio 1500 x 600 x 750 mm')).toEqual([1500, 600, 750]);
    expect(medidasDe('Calibre 18, 1200x600 mm')).toEqual([1200, 600]);
  });
  it('unidades: cm y m', () => {
    expect(medidasDe('mesa 150 x 60 x 75 cm')).toEqual([1500, 600, 750]);
    expect(medidasDe('cubierta 1.5 x 0.6 m')).toEqual([1500, 600]);
  });
  it('sin patrón dimensional conserva el comportamiento anterior', () => {
    expect(medidasDe('800, 450, 2000')).toEqual([800, 450, 2000]);
  });
});

describe('P1-05/P1-06 · link de prueba', () => {
  it('el carril RC sólo se enciende con la bandera Y en una URL de preview del equipo', () => {
    expect(carrilRcActivo(true, 'costeador-vonhaucke-nswsgzdfi-rodrigos-eurotrip.vercel.app')).toBe(true);
    expect(carrilRcActivo(true, 'costeador-vonhaucke-git-claude-costing-3cffa0-rodrigos-eurotrip.vercel.app')).toBe(true);
    // Un artifact de preview PROMOVIDO a producción se sirve en el dominio de producción → carril apagado.
    expect(carrilRcActivo(true, 'costeador-vonhaucke.vercel.app')).toBe(false);
    expect(carrilRcActivo(true, 'cotizador.vonhaucke.mx')).toBe(false);
    expect(carrilRcActivo(true, 'localhost')).toBe(false);
    expect(carrilRcActivo(false, 'costeador-vonhaucke-nswsgzdfi-rodrigos-eurotrip.vercel.app')).toBe(false);
  });
  it('lo guardado desde el carril RC queda marcado como prueba (una sola vez); fuera del carril no se toca', () => {
    const e = marcarExpedienteRc({ nombre: 'Librero', etiquetas: ['nogal'] }, true);
    expect(e.nombre).toBe('PRUEBA RC · Librero');
    expect(e.etiquetas).toEqual(['nogal', ETIQUETA_CARRIL_RC]);
    expect(marcarExpedienteRc(e, true)).toEqual(e);
    expect(marcarExpedienteRc({ nombre: 'Librero' }, false)).toEqual({ nombre: 'Librero' });
  });
});

// Encontrados al repetir ATCUBS45ABS en el link de prueba tras la auditoría (no estaban en el informe).
import { aplicarPoliticaMaterial, reconciliarMaterialServidor } from './materialMatch.js';
import { INSUMOS_SEMILLA } from './insumos.js';
describe('Paridad cliente/servidor del canto (lab en el link, 14-oct)', () => {
  const cat = Object.fromEntries(INSUMOS_SEMILLA.map((x) => [x.id, x]));
  const res = (id) => cat[id]; const vals = Object.values(cat);
  const canto = { nombre: 'Canto ABS perimetral 32×2 mm', insumoId: 'cubrecanto-32', material_solicitado: 'Canto ABS para tablero de 28 mm (color a juego)', cantidad: 4.2 };
  it('VH-182 completo: "Cubre canto blanco 32 x 2 mm" cubre un tablero de 28 mm (el 32 es el ancho; antes sólo leía el 2)', () => {
    expect(aplicarPoliticaMaterial(canto, res, vals).material_match).not.toBe('SAME_FAMILY_CRITICAL_CONFLICT');
  });
  it('el servidor no asigna material a una pieza que llegó SIN material: queda pendiente, como en la pantalla', () => {
    const r = reconciliarMaterialServidor({ ...canto, insumoId: '' }, res, vals, { puedeConfirmar: true });
    expect(r.insumoId).toBe('');
    expect(r.material_match).toBe('CANDIDATE_REQUIRES_CONFIRMATION');
  });
  it('con material elegido, cliente y servidor clasifican igual', () => {
    expect(reconciliarMaterialServidor(canto, res, vals, { puedeConfirmar: true }).insumoId).toBe('cubrecanto-32');
  });
});

describe('Pieza sin material (lab en el link, 14-oct)', () => {
  it('una pieza sin material bloquea aunque el motor la haya puesto en "por confirmar"; excluida no cuenta', () => {
    const emision = { emitible: false, bloqueos: { materiales_por_confirmar: ['Tapa metálica'] }, pendientes: [] };
    const r = clasificarCosto({ emision, componentes: [{ nombre: 'Cubierta', insumoId: 'melamina-28' }, { nombre: 'Tapa metálica', insumoId: '' }] });
    expect(r.estado).toBe(ESTADO_COSTO.BLOQUEADO);
    expect(r.motivos).toContain('Sin material: Tapa metálica');
    expect(clasificarCosto({ emision: limpio, servidor: srv('certificado'), componentes: [{ nombre: 'Tapa', insumoId: '', excluida: true }] }).estado).toBe(ESTADO_COSTO.VALIDADO);
  });
});
