// ============================================================================
//  VH-148b · EL CLIENTE CONTRA EL SQL REAL. src/nube.js y src/datos/cotizaciones.js corren tal cual; lo único
//  sustituido es createClient de supabase-js por un cliente mínimo que ejecuta cada llamada en PGlite con
//  SET ROLE authenticated y el correo de la sesión (supabase/tests/helpers/baseVh148b.js · clientePglite).
//  Los errores que ven las funciones son los de Postgres (40001 / 23505 / 22004 / 42501) con la forma de
//  PostgREST. Base: producción (con VH-035c) + PROPUESTA_vh148 + PROPUESTA_vh148b.
//
//  Contrato que se prueba (lo pidió Dirección): ante conflicto de versión TODA escritura devuelve
//  { ok:false, code:'VERSION_CONFLICT', status:409 }, la pantalla muestra EXACTAMENTE
//  "Existe una versión más reciente. Recarga o compara antes de guardar." y NO hay reintento silencioso
//  (se cuenta cuántas llamadas salieron) ni fusión automática (la fila del otro queda byte a byte).
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  DIRECCION, VENDEDOR, DISENO, VH148, VH148B, leer, baseProduccion, clientePglite, uno,
  filaCot, filaExp, sembrarCot, sembrarExp,
} from './helpers/baseVh148b.js';

const destino = vi.hoisted(() => ({ cliente: null }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => new Proxy({}, {
    get: (_, k) => {
      const c = destino.cliente;
      if (!c) return undefined;
      const v = c[k];
      return typeof v === 'function' ? v.bind(c) : v;
    },
  }),
}));

const MENSAJE = 'Existe una versión más reciente. Recarga o compara antes de guardar.';
const CONFLICTO = { ok: false, code: 'VERSION_CONFLICT', status: 409 };

let db, sesion, cliente, nube, cot;
// Import perezoso: así, con el cliente VIEJO (evidencia del doc), sólo fallan las pruebas que lo usan.
const expV = () => import('../../src/datos/expedienteVersionado.js');
beforeAll(async () => {
  db = await baseProduccion();
  await db.exec(leer(VH148));
  await db.exec(leer(VH148B));
  sesion = { email: DISENO };
  cliente = clientePglite(db, sesion);
  destino.cliente = cliente;
  nube = await import('../../src/nube.js');
  cot = await import('../../src/datos/cotizaciones.js');
}, 120_000);
afterAll(async () => { await db?.close(); });

const comoPersona = (email) => { sesion.email = email; };
const llamadasDesde = (n) => cliente.llamadas.slice(n);
const depsNube = () => ({
  actualizarExpediente: nube.actualizarExpediente, actualizarExpedienteSeguro: nube.actualizarExpedienteSeguro,
  guardarRevisionExpediente: nube.guardarRevisionExpediente, guardarExpediente: nube.guardarExpediente,
});
const snapDe = (exp, quien) => (eid, rev) => ({ expediente_id: eid, rev, creado_por: quien, nombre: exp.nombre, bom: exp.bom, costo: exp.costo });

describe('expediente_revisiones · el 23505 del índice único ya no se traga', () => {
  it('guardarRevisionExpediente con un número de revisión que ya existe → 409 VERSION_CONFLICT (antes: undefined y "✓ Actualizado")', async () => {
    const id = await sembrarExp(db);
    comoPersona(DISENO);
    expect(await nube.guardarRevisionExpediente({ expediente_id: id, rev: 2, nombre: 'A' })).toEqual({ ok: true });
    comoPersona(DIRECCION);
    expect(await nube.guardarRevisionExpediente({ expediente_id: id, rev: 2, nombre: 'B' })).toMatchObject({ ...CONFLICTO, error: MENSAJE });
  });
  it('un error que NO es de versión vuelve como error (no como conflicto ni como éxito)', async () => {
    comoPersona(VENDEDOR);   // la política exprev_insert_technical no deja insertar al vendedor
    const r = await nube.guardarRevisionExpediente({ expediente_id: 1, rev: 99, nombre: 'x' });
    expect(r.ok).toBe(false);
    expect(r.code).toBeUndefined();
    expect(r.error).toMatch(/row-level security|violates/);
  });
});

describe('expediente (Costear · biblioteca): dos editores sobre la misma revisión', () => {
  const exp = { nombre: 'Credenza nogal v2', bom: [{ pieza: 'tapa', mm: 25 }], costo: { costoUnitario: 5200 } };

  it('ruta de PRODUCCIÓN (bandera apagada, UPDATE directo): el segundo recibe EXACTAMENTE el mensaje, una sola llamada y la fila del primero intacta', async () => {
    const id = await sembrarExp(db);
    comoPersona(DISENO);
    const rA = await (await expV()).guardarExpedienteEditado({ id, exp: { ...exp, nombre: 'De Diseño' }, revActual: 1, quien: DISENO, snap: snapDe({ ...exp, nombre: 'De Diseño' }, DISENO), controlOptimista: false, deps: depsNube() });
    expect(rA).toEqual({ ok: true, revision: 2 });
    const trasA = await filaExp(db, id);
    comoPersona(DIRECCION);
    const n = cliente.llamadas.length;
    const rB = await (await expV()).guardarExpedienteEditado({ id, exp: { ...exp, nombre: 'De Dirección' }, revActual: 1, quien: DIRECCION, snap: snapDe(exp, DIRECCION), controlOptimista: false, deps: depsNube() });
    expect(rB).toEqual({ ...CONFLICTO, mensaje: MENSAJE });
    expect(llamadasDesde(n)).toEqual([]);                       // UPDATE directo (no RPC) y ningún reintento por RPC
    expect(await filaExp(db, id)).toBe(trasA);
    const revs = (await db.query('select rev, nombre from public.expediente_revisiones where expediente_id=$1 order by rev', [id])).rows;
    expect(revs).toEqual([{ rev: 1, nombre: 'Credenza nogal' }, { rev: 2, nombre: 'De Diseño' }]);
  });

  it('bandera PRENDIDA (RPC con revisión esperada): el segundo recibe 409 y el mensaje; una sola llamada; fila y snapshot del primero', async () => {
    const id = await sembrarExp(db);
    comoPersona(DISENO);
    const rA = await (await expV()).guardarExpedienteEditado({ id, exp: { ...exp, nombre: 'De Diseño' }, revActual: 1, controlOptimista: true, deps: depsNube() });
    expect(rA).toEqual({ ok: true, revision: 2 });
    const trasA = await filaExp(db, id);
    comoPersona(DIRECCION);
    const n = cliente.llamadas.length;
    const rB = await (await expV()).guardarExpedienteEditado({ id, exp: { ...exp, nombre: 'De Dirección' }, revActual: 1, controlOptimista: true, deps: depsNube() });
    expect(rB).toEqual({ ...CONFLICTO, mensaje: MENSAJE });
    expect(llamadasDesde(n).map(([fn]) => fn)).toEqual(['actualizar_expediente_seguro']);   // sin reintento
    expect(await filaExp(db, id)).toBe(trasA);
  });

  it('bandera PRENDIDA sin revisión conocida: no sale ninguna escritura', async () => {
    const n = cliente.llamadas.length;
    expect(await nube.actualizarExpedienteSeguro(1, { nombre: 'x' }, undefined)).toMatchObject({ ...CONFLICTO, sinVersion: true });
    expect(llamadasDesde(n)).toEqual([]);
  });
});

describe('cocreación (guardar_cocrear_seguro) con bandera prendida', () => {
  it('la pestaña que cargó la revisión vieja recibe 409; lo de la otra pestaña se queda; sin versión conocida no se escribe', async () => {
    comoPersona(VENDEDOR);
    const c = await nube.guardarCocrearSeguro(null, { nombre: 'Banca', intent: { v: 1 } }, { controlOptimista: true });
    expect(c).toMatchObject({ ok: true, revision: 1 });
    const id = c.expediente_id;
    const rA = await nube.guardarCocrearSeguro(id, { nombre: 'Banca', intent: { v: 'A' } }, { controlOptimista: true });   // revisión recordada: 1
    expect(rA).toMatchObject({ ok: true, revision: 2 });
    const trasA = await filaExp(db, id);
    const n = cliente.llamadas.length;
    const rB = await nube.guardarCocrearSeguro(id, { nombre: 'Banca', intent: { v: 'B' } }, { controlOptimista: true, revisionEsperada: 1 });   // otra pestaña, en la 1
    expect(rB).toMatchObject({ ...CONFLICTO, error: MENSAJE, revisionServidor: 2 });
    expect(llamadasDesde(n).length).toBe(1);
    expect(await filaExp(db, id)).toBe(trasA);
    const m = cliente.llamadas.length;
    expect(await nube.guardarCocrearSeguro(987654, { nombre: 'x' }, { controlOptimista: true })).toMatchObject({ ...CONFLICTO, sinVersion: true });
    expect(llamadasDesde(m)).toEqual([]);
  });
  it('bandera apagada: la llamada de siempre (dos argumentos), sin p_revision_esperada', async () => {
    comoPersona(VENDEDOR);
    const n = cliente.llamadas.length;
    const c = await nube.guardarCocrearSeguro(null, { nombre: 'Mesa' }, { controlOptimista: false });
    expect(c.ok).toBe(true);
    expect(Object.keys(llamadasDesde(n)[0][1]).sort()).toEqual(['p_expediente_id', 'p_payload']);
  });
});

describe('cotización (guardarCotizacion) contra el SQL real', () => {
  const estadoCon = (cliente) => ({ insumos: {}, parametros: { ivaPorcentaje: 16 }, cotizacion: { cliente, folio: 'T-1', partidas: [{ id: 'p1', nombre: 'Escritorio operativo melamina', cantidad: 2, precioUnitario: 10000 }] } });

  it('B con la versión vieja → 409 VERSION_CONFLICT con la versión del servidor; una sola llamada; la fila de A intacta', async () => {
    const id = await sembrarCot(db);
    comoPersona(VENDEDOR);
    const v0 = (await uno(db, VENDEDOR, 'select public.cotizacion_segura($1) as c', [id])).c.actualizado;
    const rA = await cot.guardarCotizacion(estadoCon('Tradeco Norte'), VENDEDOR, id, { actualizadoEsperado: v0 });
    expect(rA).toMatchObject({ guardado: true });
    const trasA = await filaCot(db, id);
    const n = cliente.llamadas.length;
    const rB = await cot.guardarCotizacion(estadoCon('Tradeco Sur'), VENDEDOR, id, { actualizadoEsperado: v0 });
    expect(rB).toMatchObject({ ...CONFLICTO, error: MENSAJE, motivo: 'conflicto', actualizadoServidor: rA.actualizado });
    expect(llamadasDesde(n).length).toBe(1);
    expect(await filaCot(db, id)).toBe(trasA);
  });
  it('bandera prendida sin versión conocida (null) → 409 sin llamar: ya no cae en la firma sin control', async () => {
    const id = await sembrarCot(db);
    const antes = await filaCot(db, id);
    comoPersona(VENDEDOR);
    const n = cliente.llamadas.length;
    expect(await cot.guardarCotizacion(estadoCon('a ciegas'), VENDEDOR, id, { actualizadoEsperado: null })).toMatchObject({ ...CONFLICTO, sinVersion: true });
    expect(llamadasDesde(n)).toEqual([]);
    expect(await filaCot(db, id)).toBe(antes);
  });
  it('archivarCotizacion (UPDATE directo de `activa`) sigue funcionando con el UPDATE de columna', async () => {
    const id = await sembrarCot(db);
    comoPersona(DIRECCION);
    await cot.archivarCotizacion(id);
    expect((await db.query('select activa from public.cotizaciones where id=$1', [id])).rows[0].activa).toBe(false);
  });
});
