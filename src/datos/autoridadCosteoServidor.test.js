// Operación 9.5 · OP9.5-04 (estado del servidor con motivos) y P1-03 (aprobación humana del PRECIO EXACTO).
// Datos de las filas: valores reales de producción leídos el 14-oct-2026 (aprobadores, el empate de lamina-3x10-14).
import { describe, it, expect } from 'vitest';
import { estadoBaseServidor, conMotivos, precioVigenteElegido, aprobacionPrecioExacto, preciosAprobables, preciosNoAprobables } from './autoridadCosteoServidor.js';
import { costeoEmitible } from '../motor/calculo.js';
import { clasificarCosto } from './estadoCosto.js';

describe('OP9.5-04 · estado del servidor: incompleto sólo si falta un dato, y siempre con motivo', () => {
  const emision = (b) => costeoEmitible({ costoUnitario: 1000, componentesIgnorados: [], detalleInsumos: [], ...b });

  it('material "por confirmar" con precio real ⇒ PRELIMINAR con el material nombrado (antes: incompleto sin motivo)', () => {
    const e = emision({ materialesPorConfirmar: ['Costado (Melamina 16 mm blanca propuesta)'] });
    expect(e.emitible).toBe(false); // el juez de emisión no cambia: no se emite sin confirmar
    const s = estadoBaseServidor({ emision: e, usados: ['m16'], noCertificados: [] });
    expect(s.estado).toBe('preliminar');
    expect(s.warnings).toEqual(['Material propuesto sin confirmar: Costado (Melamina 16 mm blanca propuesta)']);
    // y la pantalla lo lee como PRELIMINAR, no "El servidor marca el costo como incompleto"
    const c = clasificarCosto({ emision: e, servidor: { estado: s.estado, advertencias: s.warnings, aprobacionHumana: false }, componentes: [{ nombre: 'Costado', insumoId: 'm16' }] });
    expect(c.estado).toBe('preliminar');
    expect(c.motivos.join(' ')).not.toMatch(/incompleto/);
  });

  it('falta material o precio ⇒ INCOMPLETO con la pieza nombrada', () => {
    const s = estadoBaseServidor({ emision: emision({ componentesIgnorados: ['Tapa metálica'] }) });
    expect(s).toEqual({ estado: 'incompleto', warnings: ['Sin material o precio: Tapa metálica'] });
  });

  it('costo no finito ⇒ INCOMPLETO con motivo; nunca $0', () => {
    const s = estadoBaseServidor({ emision: emision({ costoUnitario: NaN }) });
    expect(s.estado).toBe('incompleto');
    expect(s.warnings[0]).toMatch(/inválido/);
  });

  it('pieza que no cabe en el formato de compra ⇒ BLOQUEADO (hay datos; el cálculo no es físicamente válido)', () => {
    const s = estadoBaseServidor({ emision: emision({ detalleInsumos: [{ nombre: 'Melamina 28 mm', noCabe: true }] }) });
    expect(s.estado).toBe('bloqueado');
    expect(s.warnings[0]).toMatch(/no caben en el formato/);
  });

  it('validador de Ingeniería en rojo ⇒ BLOQUEADO con el mensaje', () => {
    const s = estadoBaseServidor({ emision: emision({}), bloqueosIng: [{ mensaje: 'Cubierta con material de pintura' }] });
    expect(s).toEqual({ estado: 'bloqueado', warnings: ['Ingeniería: Cubierta con material de pintura'] });
  });

  it('precios sin certificar ⇒ PRELIMINAR con el conteo; todo certificado ⇒ CERTIFICADO sin motivos', () => {
    expect(estadoBaseServidor({ emision: emision({}), usados: ['a', 'b'], noCertificados: ['b'] }).warnings[0]).toMatch(/1 de 2/);
    expect(estadoBaseServidor({ emision: emision({}), usados: ['a'], noCertificados: [] })).toEqual({ estado: 'certificado', warnings: [] });
  });

  it('costo $0 (o negativo cero) con todo lo demás en orden ⇒ INCOMPLETO con motivo, nunca certificado (P1-04)', () => {
    const s0 = estadoBaseServidor({ emision: emision({ costoUnitario: 0 }), usados: ['m16'], noCertificados: [], costoUnitario: 0 });
    expect(s0.estado).toBe('incompleto');
    expect(s0.warnings[0]).toMatch(/\$0/);
    expect(estadoBaseServidor({ emision: emision({}), usados: ['m16'], noCertificados: [], costoUnitario: 1000 }).estado).toBe('certificado');
  });

  it('invariante: ninguna combinación produce un estado no certificado sin motivo', () => {
    const casos = [
      {}, { componentesIgnorados: ['x'] }, { materialesPorConfirmar: ['y'] }, { tarifasFaltantes: ['MO'] },
      { costoUnitario: -1 }, { detalleInsumos: [{ noCabe: true }] },
    ];
    for (const b of casos) for (const nc of [[], ['z']]) for (const ing of [[], [{ mensaje: 'm' }]]) {
      const s = estadoBaseServidor({ emision: emision(b), noCertificados: nc, usados: ['z'], bloqueosIng: ing });
      if (s.estado !== 'certificado') expect(s.warnings.length, JSON.stringify({ b, nc, ing })).toBeGreaterThan(0);
    }
    expect(conMotivos('incompleto', [])[0]).toMatch(/sin motivo registrado/);
  });
});

describe('P1-03 · precio vigente elegido igual que la vista catalogo_vigente', () => {
  // Empate REAL en producción (14-oct): lamina-3x10-14, tres filas 'propuesto'/'alta'/2026-01-26, precios 849.5 y 816.48.
  const lamina = [
    { id: 273, insumo_id: 'lamina-3x10-14', precio: 849.5, estado: 'propuesto', confidence: 'alta', vigente_desde: '2026-01-26', vigente_hasta: null },
    { id: 281, insumo_id: 'lamina-3x10-14', precio: 849.5, estado: 'propuesto', confidence: 'alta', vigente_desde: '2026-01-26', vigente_hasta: null },
    { id: 287, insumo_id: 'lamina-3x10-14', precio: 816.48, estado: 'propuesto', confidence: 'alta', vigente_desde: '2026-01-26', vigente_hasta: null },
  ];
  it('elige la fila que elige la vista (id mayor en empate) y marca el empate de precios distintos', () => {
    const r = precioVigenteElegido(lamina);
    expect(r.fila.id).toBe(287);
    expect(r.empate).toBe(true);
  });
  it('aprobado gana a propuesto; más reciente gana; fila cerrada (vigente_hasta) no cuenta', () => {
    const r = precioVigenteElegido([
      { id: 1, precio: 10, estado: 'propuesto', confidence: 'alta', vigente_desde: '2026-09-01', vigente_hasta: null },
      { id: 2, precio: 11, estado: 'aprobado', confidence: 'media', vigente_desde: '2025-01-01', vigente_hasta: null },
      { id: 3, precio: 12, estado: 'aprobado', confidence: 'media', vigente_desde: '2026-01-01', vigente_hasta: null },
      { id: 4, precio: 13, estado: 'aprobado', confidence: 'alta', vigente_desde: '2026-02-01', vigente_hasta: '2026-03-01' },
    ]);
    expect(r).toEqual({ fila: expect.objectContaining({ id: 3 }), empate: false });
  });
});

describe('P1-03 · aprobación humana del precio exacto (rol + lista explícita, no regex)', () => {
  const permitidos = [
    { email: 'qa-direccion@vonhaucke.mx', rol: 'direccion' },
    { email: 'rodrigo.delcastillo@vonhaucke.mx', rol: 'direccion' },
    { email: 'ventas@vonhaucke.mx', rol: 'vendedor' },
  ];
  const noHumanas = ['qa-direccion@vonhaucke.mx', 'reconciliacion'];
  const fila = (o) => ({ id: 900, insumo_id: 'm16', precio: 612.4, estado: 'aprobado', confidence: 'alta', vigente_desde: '2026-10-01', vigente_hasta: null, approved_by: 'rodrigo.delcastillo@vonhaucke.mx', approved_at: '2026-10-14T10:00:00Z', source_document: 'INTELISIS-REPORTE-COTIZADOR-2026-10.pdf', ...o });
  const correr = (o = {}, extra = {}) => aprobacionPrecioExacto({ usados: ['m16'], insumos: { m16: { precio: 612.4, unidad: 'hoja' } }, filasPrecio: [fila(o)], permitidos, noHumanas, ...extra });

  it('Dirección humana, precio idéntico ⇒ humana, con traza completa del precio_id', () => {
    const r = correr();
    expect(r.aprobacionHumana).toBe(true);
    expect(r.precios[0]).toMatchObject({ insumo_id: 'm16', precio_id: 900, precio_usado: 612.4, unidad: 'hoja', approved_by: 'rodrigo.delcastillo@vonhaucke.mx', rol_aprobador: 'direccion', approved_at: '2026-10-14T10:00:00Z', source_document: 'INTELISIS-REPORTE-COTIZADOR-2026-10.pdf', humana: true });
  });

  it('qa-direccion (rol direccion en permitidos) NO es humana: la lista explícita manda sobre el rol', () => {
    const r = correr({ approved_by: 'qa-direccion@vonhaucke.mx' });
    expect(r.aprobacionHumana).toBe(false);
    expect(r.precios[0].motivo).toBe('aprobado por una cuenta no humana');
  });

  it('el proceso "reconciliacion" no es humano', () => {
    expect(correr({ approved_by: 'reconciliacion' }).aprobacionHumana).toBe(false);
  });

  it('un vendedor con e-mail normal NO aprueba (la regex vieja lo aceptaba)', () => {
    const humanoViejo = (e) => !!e && /@/.test(e) && !/^qa-|^test|^prueba/i.test(e); // regex de la Edge hasta hoy
    expect(humanoViejo('ventas@vonhaucke.mx')).toBe(true);
    const r = correr({ approved_by: 'ventas@vonhaucke.mx' });
    expect(r.aprobacionHumana).toBe(false);
    expect(r.precios[0].motivo).toMatch(/sin rol aprobador \(vendedor\)/);
  });

  it('un e-mail que no está en permitidos NO aprueba (la regex vieja lo aceptaba)', () => {
    expect(correr({ approved_by: 'cualquiera@gmail.com' }).precios[0].motivo).toMatch(/no registrado/);
  });

  it('el precio que usó el motor difiere un centavo del aprobado ⇒ no cuenta', () => {
    const r = correr({}, { insumos: { m16: { precio: 612.41 } } });
    expect(r.aprobacionHumana).toBe(false);
    expect(r.precios[0].motivo).toBe('el precio usado no coincide con el precio aprobado');
  });

  it('precio propuesto (no aprobado) ⇒ no cuenta', () => {
    expect(correr({ estado: 'propuesto' }).precios[0].motivo).toBe("precio en estado 'propuesto'");
  });

  it('sin la lista de cuentas no humanas (tabla no aplicada) ⇒ fail-closed', () => {
    const r = correr({}, { noHumanas: null });
    expect(r.aprobacionHumana).toBe(false);
    expect(r.motivos[0]).toMatch(/no disponible/);
  });

  it('un insumo sin aprobación humana basta para que el costeo no lo sea; mayúsculas no burlan la lista', () => {
    const r = aprobacionPrecioExacto({
      usados: ['m16', 'canto'], insumos: { m16: { precio: 612.4 }, canto: { precio: 3.1 } },
      filasPrecio: [fila(), fila({ id: 901, insumo_id: 'canto', precio: 3.1, approved_by: 'QA-Direccion@VonHaucke.mx' })],
      permitidos, noHumanas,
    });
    expect(r.aprobacionHumana).toBe(false);
    expect(r.precios.map((p) => p.humana)).toEqual([true, false]);
    expect(r.motivos[0]).toMatch(/1 de 2/);
  });

  it('sin insumos usados no hay nada que certificar', () => {
    expect(aprobacionPrecioExacto({ usados: [], noHumanas }).aprobacionHumana).toBe(false);
  });
});

describe('P1-03 · qué precios ofrece aprobar Costear a Dirección', () => {
  const base = { humana: false, precio_id: 1 };
  const casos = [
    { ...base, insumo_id: 'qa', motivo: 'aprobado por una cuenta no humana' },
    { ...base, insumo_id: 'prop', motivo: "precio en estado 'propuesto'" },
    { ...base, insumo_id: 'dif', motivo: 'el precio usado no coincide con el precio aprobado' },
    { ...base, insumo_id: 'emp', motivo: 'empate entre precios vigentes distintos' },
    { humana: false, precio_id: null, insumo_id: 'nada', motivo: 'sin precio vigente' },
    { humana: true, precio_id: 9, insumo_id: 'ok', motivo: null },
  ];
  it('ofrece aprobar sólo el precio exacto usado; lo que no se arregla firmando se manda a Compras', () => {
    expect(preciosAprobables(casos).map((p) => p.insumo_id)).toEqual(['qa', 'prop']);
    expect(preciosNoAprobables(casos).map((p) => p.insumo_id)).toEqual(['dif', 'emp', 'nada']);
  });
});
