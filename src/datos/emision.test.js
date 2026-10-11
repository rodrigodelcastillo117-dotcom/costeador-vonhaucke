// VH-047 · compuerta única: espejo del servidor (evaluar_emision_cotizacion).
import { describe, it, expect } from 'vitest';
import { evaluarEmisionLocal, combinarGate, gateServidor, detalleBloqueo, identidadServidor, SEVERIDAD } from './emision.js';
import { bloqueosDeEmision, problemasDeEmision } from './senales.js';
import { porQueNoPuedoEmitir } from './voniContext.js';
import { textoRazonEmision } from './emisionUX.js';
import { crearPartida, validarPartida } from './partida.js';

const ok = { nombre: 'Cubierta', cantidad: 1, precioUnitario: 1000 };

describe('evaluarEmisionLocal · forma y códigos del servidor', () => {
  it('sin partidas → BLOCKED sin_partidas', () => {
    expect(evaluarEmisionLocal({ partidas: [] })).toMatchObject({ estado: 'BLOCKED', motivos: ['sin_partidas'], ok: false });
  });
  it('renglón sano → ALLOWED', () => {
    expect(evaluarEmisionLocal({ partidas: [ok] })).toMatchObject({ estado: 'ALLOWED', motivos: [], economics: [], ok: true });
  });
  it('cantidad/precio inválidos con el número de línea 1-based del servidor', () => {
    const g = evaluarEmisionLocal({ partidas: [ok, { nombre: 'X', cantidad: 0, precioUnitario: Infinity }] });
    expect(g.motivos).toEqual(['linea_2_cantidad_invalida', 'linea_2_precio_invalido']);
  });
  it('identidad: producto sin versión y versión sin producto, igual que el servidor', () => {
    const g = evaluarEmisionLocal({ partidas: [{ ...ok, producto_id: 44 }, { ...ok, productoVersionId: '9' }, { ...ok, productoId: 'EJ-150' }] });
    expect(g.motivos).toEqual(['linea_1_sin_product_version_id', 'linea_2_sin_product_id']);
    // La clave de línea textual (EJ-150) NO es producto_id: el servidor la ignora si no hay versión.
    expect(identidadServidor({ productoId: 'EJ-150' })).toMatchObject({ pid: null, pvid: null });
  });
  it('clave textual con versión → producto_id_invalido (servidor idéntico)', () => {
    const g = evaluarEmisionLocal({ partidas: [{ ...ok, productoId: 'EJ-150', producto_version_id: 9 }] });
    expect(g.motivos).toContain('linea_1_producto_id_invalido');
  });
  it('sin material → bloqueo local; costoEstado incompleto/preliminar → ECONOMICS_INCOMPLETE (clave del servidor)', () => {
    expect(evaluarEmisionLocal({ partidas: [{ ...ok, piezasSinMaterial: 2 }] }).motivos).toEqual(['linea_1_sin_material']);
    const g = evaluarEmisionLocal({ partidas: [{ ...ok, costoEstado: 'incompleto' }, { ...ok, estadoCosto: 'preliminar' }] });
    expect(g).toMatchObject({ estado: 'ECONOMICS_INCOMPLETE', motivos: [], economics: ['linea_1_costo_no_certificado', 'linea_2_costo_preliminar_no_certificado'] });
    // Con ProductVersion el costo lo decide el servidor, no el veredicto local.
    expect(evaluarEmisionLocal({ partidas: [{ ...ok, producto_id: 1, producto_version_id: 2, costoEstado: 'incompleto' }] }).economics).toEqual([]);
  });
  it('exclusiones: bloquean hasta confirmarse y se listan únicas', () => {
    const ps = [{ ...ok, nombresExcluidos: ['Vidrio', 'Herraje'] }, { ...ok, nombresExcluidos: ['Vidrio'] }];
    const g = evaluarEmisionLocal({ partidas: ps });
    expect(g.motivos).toEqual(['piezas_excluidas_sin_confirmar']);
    expect(g.excluidas).toEqual(['Vidrio', 'Herraje']);
    expect(evaluarEmisionLocal({ partidas: ps, confirmoExcluidas: true }).estado).toBe('ALLOWED');
  });
});

describe('combinarGate · el servidor es la autoridad, el cliente proyecta', () => {
  const local = evaluarEmisionLocal({ partidas: [ok] });
  it('servidor desconocido/nulo → vale lo local y se dice que no se consultó', () => {
    expect(combinarGate(local, null)).toMatchObject({ estado: 'ALLOWED', servidorConsultado: false });
    expect(combinarGate(local, { estado: 'DESCONOCIDO' })).toMatchObject({ servidorConsultado: false });
    expect(gateServidor({ estado: 'RARO' })).toBeNull();
  });
  it('gana la severidad mayor y se unen las razones sin duplicar', () => {
    const srv = { ok: false, estado: 'ECONOMICS_INCOMPLETE', motivos: [], economics: ['linea_1_costo_productversion_desconocido'], hash: 'h1' };
    const g = combinarGate(local, srv);
    expect(g).toMatchObject({ estado: 'ECONOMICS_INCOMPLETE', hash: 'h1', servidorConsultado: true, ok: false });
    const bloq = combinarGate(evaluarEmisionLocal({ partidas: [{ ...ok, piezasSinMaterial: 1 }] }), { estado: 'ALLOWED', motivos: [], economics: [] });
    expect(bloq.estado).toBe('BLOCKED');                       // lo local que el servidor no puede saber
    const dup = combinarGate(evaluarEmisionLocal({ partidas: [{ ...ok, cantidad: 0 }] }), { estado: 'BLOCKED', motivos: ['linea_1_cantidad_invalida'] });
    expect(dup.motivos).toEqual(['linea_1_cantidad_invalida']);
    expect(SEVERIDAD.BLOCKED).toBeGreaterThan(SEVERIDAD.APPROVAL_REQUIRED);
  });
});

describe('todo deriva de la compuerta', () => {
  const ps = [{ nombre: 'Base', cantidad: 2, precioUnitario: 0 }, { nombre: 'Módulo', cantidad: 1, precioUnitario: 500, piezasSinMaterial: 1, nombresSinMaterial: ['Acometida'] }];
  it('bloqueosDeEmision / problemasDeEmision / porQueNoPuedoEmitir cuentan lo mismo que la compuerta', () => {
    const g = evaluarEmisionLocal({ partidas: ps, confirmoExcluidas: true });
    expect(bloqueosDeEmision(ps).map((b) => b.codigo)).toEqual(g.motivos);
    expect(problemasDeEmision(ps)).toEqual(bloqueosDeEmision(ps).map((b) => b.titulo));
    expect(porQueNoPuedoEmitir({ cotizacion: { partidas: ps } }).bloqueos.length).toBe(g.motivos.length);
    expect(bloqueosDeEmision(ps).map((b) => b.code)).toEqual(['PRECIO_INVALIDO', 'SIN_MATERIAL']);
  });
  it('ningún código del servidor sale crudo al vendedor, y ninguno trae cifras', () => {
    const codigos = ['linea_1_cantidad_invalida', 'linea_1_precio_invalido', 'linea_1_sin_correspondencia', 'linea_1_identidad_no_coincide',
      'linea_1_producto_id_invalido', 'linea_1_producto_version_id_invalido', 'linea_1_sin_product_version_id', 'linea_1_sin_product_id',
      'linea_1_product_version_no_corresponde', 'linea_1_costo_especial_desconocido', 'linea_1_especial_PRECIO_NO_VIGENTE', 'linea_1_ingenieria_preliminar',
      'linea_1_costo_especial_no_certificado', 'linea_1_descuento_invalido', 'linea_1_precio_especial_no_autoritativo', 'linea_1_costo_productversion_desconocido',
      'linea_1_costo_preliminar_no_certificado', 'linea_1_costo_no_certificado', 'linea_1_costo_desconocido', 'linea_1_precio_bajo_costo', 'linea_1_margen_bajo_25',
      'partidas_no_corresponden_a_cotizacion', 'snapshot_sin_partidas', 'politica_comercial_sin_margen_minimo', 'aprobacion_requerida_para_hash', 'no_autorizado', 'sin_permiso', 'cotizacion_no_existe', 'no_existe',
      'linea_1_sin_material', 'piezas_excluidas_sin_confirmar', 'sin_partidas', 'sin_guardar'];
    for (const c of codigos) {
      const t = textoRazonEmision(c);
      expect(t, c).not.toMatch(/_/);                         // nada crudo
      expect(t, c).not.toMatch(/\$|margen\s*\d|utilidad|proveedor/i);
    }
  });
  it('detalleBloqueo nombra la pieza y trae cómo corregir', () => {
    const d = detalleBloqueo('linea_2_sin_material', ps);
    expect(d).toMatchObject({ code: 'SIN_MATERIAL', pieza: 'Módulo', linea: 2 });
    expect(d.titulo).toContain('Acometida');
    expect(d.corregir).toBeTruthy();
  });
  it('el contrato escribe costoEstado (clave del servidor) y validarPartida lo marca', () => {
    const p = crearPartida({ nombre: 'X', cantidad: 1, precioUnitario: 10, estadoCosto: 'incompleto' }, { veCostos: true });
    expect(p.costoEstado).toBe('incompleto');
    expect(p).not.toHaveProperty('estadoCosto');
    expect(validarPartida(p).some((i) => i.campo === 'costoEstado')).toBe(true);
    expect(validarPartida(crearPartida({ nombre: 'X', cantidad: 1, precioUnitario: 10, estadoCosto: 'completo' }, { veCostos: true }))).toEqual([]);
  });
});
