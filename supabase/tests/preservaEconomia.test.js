// ============================================================================
//  VH-035 · PRUEBA EN BASE AISLADA (PGlite = PostgreSQL real en WASM, en memoria).
//
//  Pregunta de Rodrigo (2026-10-10): "prueba que un vendedor pueda abrir, editar y
//  guardar una cotización SIN eliminar ni modificar los costos internos de Dirección.
//  No basta con llamar a actualizar_cotizacion_segura."
//
//  Aquí se carga el esquema REAL (tablas, jsonb_sin_economia, triggers y los cuerpos
//  de private_api leídos de producción) con auth/roles simulados, y se corre el mismo
//  escenario DOS veces:
//    ANTES  = producción tal cual hoy  → se demuestra que la economía se pierde.
//    DESPUÉS = con la migración 20261010170000 → se demuestra que se conserva.
//  Nada toca producción.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');

// Saca del baseline la definición completa de una función de `public`.
function defDeBaseline(nombre) {
  const sql = leer('supabase/schema/baseline/03_funciones.sql');
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  if (ini < 0) throw new Error(`no está ${nombre} en el baseline`);
  const fin = sql.indexOf('\n;\n', ini);
  return sql.slice(ini, fin) + ';';
}

const DIRECCION = 'rodrigo@vh.mx', VENDEDOR = 'ventas@vh.mx', DISENO = 'diseno@vh.mx';

async function baseAislada() {
  const db = new PGlite();
  const x = (s) => db.exec(s);
  await x(`
    create schema auth; create schema private_api;
    -- auth simulado: quién soy lo dice la sesión de prueba.
    create function auth.uid() returns uuid language sql stable as $$
      select case when current_setting('test.email', true) in ('', null) then null
        else md5(current_setting('test.email', true))::uuid end $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when current_setting('test.email', true) in ('', null) then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create table public.permitidos (email text primary key, nombre text, rol text not null default 'vendedor', creado timestamptz not null default now());
    create table public.cotizaciones (
      id bigserial primary key, creado timestamptz not null default now(), actualizado timestamptz not null default now(),
      usuario text, cliente text, folio text, estado text not null default 'borrador',
      partidas jsonb not null default '[]'::jsonb, acomodo jsonb, totales jsonb, total numeric not null default 0,
      piezas integer not null default 0, huella_mp text, activa boolean not null default true, folio_oficial text,
      cliente_id bigint, contacto_id bigint, proyecto_id bigint);
    -- Roles (modelo de producción: Dirección ve economía; Dirección y Diseño editan config).
    create function private_api.rol_actual() returns text language sql stable as $$
      select lower(p.rol) from public.permitidos p where lower(p.email)=lower(auth.jwt()->>'email') limit 1 $$;
    create function private_api.puede_entrar() returns boolean language sql stable as $$ select private_api.rol_actual() is not null $$;
    create function private_api.puede_editar_config() returns boolean language sql stable as $$ select private_api.rol_actual() in ('direccion','diseno') $$;
    create function private_api.puede_ver_economia() returns boolean language sql stable as $$ select private_api.rol_actual() = 'direccion' $$;
    create function public.puede_entrar() returns boolean language sql stable as $$ select private_api.puede_entrar() $$;
    create function public.puede_editar_config() returns boolean language sql stable as $$ select private_api.puede_editar_config() $$;
    create function public.puede_ver_economia() returns boolean language sql stable as $$ select private_api.puede_ver_economia() $$;
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion'), ('${VENDEDOR}','vendedor'), ('${DISENO}','diseno');
    -- Producto Maestro mínimo: lo necesita pin_product_versions_in_partidas (trigger real de producción).
    create table public.productos (id bigint primary key, version_tecnica_vigente_id bigint);
    insert into public.productos values (1, 1933), (2, 2044);
  `);
  // Funciones REALES de public (baseline) y de private_api (fixture leído de producción el 2026-10-13;
  // las dos RPC son byte a byte las del fixture del 10-oct).
  for (const f of ['jsonb_sin_economia', 'normalizar_cost_status_partidas', 'pin_product_versions_in_partidas', 'normalize_economics_on_cotizacion_write', 'pin_product_versions_on_cotizacion_write', 'strip_seller_economics_on_cotizacion_write']) {
    await x(defDeBaseline(f));
  }
  await x(leer('supabase/tests/fixtures/private_api_prod_20261013.sql'));
  // Los CUATRO triggers de producción, con sus nombres (Postgres los dispara en orden alfabético:
  // guard → normalize → pin → strip; ese orden importa: strip borra el cost_status que normalize puso).
  await x(`
    create function public.cotizacion_segura(p_id bigint) returns jsonb language sql stable as $$ select private_api.cotizacion_segura(p_id) $$;
    create function public.actualizar_cotizacion_segura(p_cotizacion_id bigint, p_patch jsonb) returns jsonb language sql as $$ select private_api.actualizar_cotizacion_segura(p_cotizacion_id, p_patch) $$;
    create trigger trg_guard_cotizacion_estado_directo before insert or update on public.cotizaciones for each row execute function private_api.guard_cotizacion_estado_directo();
    create trigger trg_normalize_economics_status before insert or update on public.cotizaciones for each row execute function public.normalize_economics_on_cotizacion_write();
    create trigger trg_pin_product_versions before insert or update on public.cotizaciones for each row execute function public.pin_product_versions_on_cotizacion_write();
    create trigger trg_strip_seller_economics before insert or update on public.cotizaciones for each row execute function public.strip_seller_economics_on_cotizacion_write();
  `);
  return db;
}

const como = async (db, email, fn) => {
  await db.exec(`select set_config('test.email', '${email}', false)`);
  try { return await fn(); } finally { await db.exec(`select set_config('test.email', '', false)`); }
};
const rpc = async (db, email, sql, params) => como(db, email, async () => (await db.query(sql, params)).rows[0]);

const PARTIDAS_DIRECCION = [
  { id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000, costoUnitario: 21000, margen: 30, costoDerivado: false, producto_version_id: 1933 },
  { id: 'p2', nombre: 'Silla operativa', cantidad: 6, precioUnitario: 3200, costoUnitario: 1400, margen: 35 },
];

// El escenario completo: Dirección deja costos → el rol sin economía reabre, edita, guarda → Dirección reabre.
async function escenario(db, rolSinEconomia) {
  // 1) La cotización es del VENDEDOR y Dirección (que sí ve economía) le fija los costos.
  const { id } = (await rpc(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, partidas, total, piezas) values ($1, 'Tradeco', $2::jsonb, 67200, 7) returning id`,
    [VENDEDOR, JSON.stringify(PARTIDAS_DIRECCION)]));
  const antes = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
  expect(antes.c.partidas[0].costoUnitario).toBe(21000);

  // 2) El rol sin economía REABRE: recibe las partidas despojadas (como en la app).
  const vista = await rpc(db, rolSinEconomia, 'select public.cotizacion_segura($1) as c', [id]);
  expect(vista.c.ok).toBe(true);
  expect(vista.c.partidas[0]).not.toHaveProperty('costoUnitario');
  expect(vista.c.partidas[0]).not.toHaveProperty('margen');

  // 3) EDITA lo que le toca (cantidad, un renglón nuevo) e intenta colar un costo propio.
  const editadas = vista.c.partidas.map((p) => (p.id === 'p1' ? { ...p, cantidad: 3, costoUnitario: 1 } : p));
  editadas.push({ id: 'p3', nombre: 'Archivero', cantidad: 2, precioUnitario: 5000 });
  const r = await rpc(db, rolSinEconomia,
    'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c',
    [id, JSON.stringify({ partidas: editadas, total: 160000, piezas: 11 })]);
  expect(r.c.ok).toBe(true);

  // 4) DIRECCIÓN reabre.
  const despues = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
  const p1 = despues.c.partidas.find((p) => p.id === 'p1');
  const p2 = despues.c.partidas.find((p) => p.id === 'p2');
  const p3 = despues.c.partidas.find((p) => p.id === 'p3');
  return { id, p1, p2, p3, total: despues.c.total };
}

// ---------------------------------------------------------------------------------------------
//  Casos adversariales (2026-10-13). Una partida como las deja Dirección hoy: economía de primer
//  nivel + economía ANIDADA (config.costeo, config.insumos[].costo) + identidad de producto.
// ---------------------------------------------------------------------------------------------
const P1_COMPLETA = {
  id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000,
  costoUnitario: 21000, margen: 30, costoDerivado: false,
  producto_id: 1, producto_version_id: 1933, piezaId: 'bench-6', bom_hash: 'sha256:aaa',
  config: { color: 'nogal', costeo: { costoUnitario: 21000, materiales: 15000, manoObra: 6000 }, insumos: [{ clave: 'mdf18', costo: 950 }] },
};
// Lo que jsonb_sin_economia deja de `config` (recursivo): `costeo` cae entero (^cost), `costo` del insumo cae.
const CONFIG_SIN_ECONOMIA = { color: 'nogal', insumos: [{ clave: 'mdf18' }] };

async function sembrarCompleta(db, partidas = [P1_COMPLETA]) {
  const { id } = await rpc(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, partidas, total, piezas) values ($1, 'Tradeco', $2::jsonb, 55680, 1) returning id`,
    [VENDEDOR, JSON.stringify(partidas)]);
  const d = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
  // normalize ya marcó cost_status (costoUnitario > 0 ⇒ KNOWN); pin respetó producto_version_id 1933.
  expect(d.c.partidas[0]).toMatchObject({ costoUnitario: 21000, cost_status: 'KNOWN', producto_id: 1, producto_version_id: 1933, config: P1_COMPLETA.config });
  return id;
}
const vistaDe = async (db, email, id) => (await rpc(db, email, 'select public.cotizacion_segura($1) as c', [id])).c;
const guardar = (db, email, id, patch) => rpc(db, email, 'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c', [id, JSON.stringify(patch)]);
const p1De = async (db, id) => (await vistaDe(db, DIRECCION, id)).partidas.find((p) => p.id === 'p1');

// El rol sin economía reabre (vista despojada), cambia cantidad y guarda lo que vio.
async function escenarioAnidado(db, rol) {
  const id = await sembrarCompleta(db);
  const vista = await vistaDe(db, rol, id);
  expect(vista.ok).toBe(true);
  const v1 = vista.partidas[0];
  expect(v1).not.toHaveProperty('costoUnitario');
  expect(v1).not.toHaveProperty('margen');
  expect(v1).not.toHaveProperty('costoDerivado');
  expect(v1).not.toHaveProperty('cost_status');            // ^cost también lo esconde
  expect(v1.config).toEqual(CONFIG_SIN_ECONOMIA);           // lo anidado también se esconde
  expect(v1).toMatchObject({ producto_id: 1, producto_version_id: 1933, piezaId: 'bench-6', bom_hash: 'sha256:aaa' }); // identidad sí viaja
  const r = await guardar(db, rol, id, { partidas: vista.partidas.map((p) => ({ ...p, cantidad: 3 })), total: 167040, piezas: 3 });
  expect(r.c.ok).toBe(true);
  return { id, p1: await p1De(db, id) };
}

// Vendedor hostil: cuela economía, cambia versión/cost_status/estado de partida y prueba estado/folio_oficial arriba.
const PATCH_HOSTIL_P1 = { ...P1_COMPLETA, config: CONFIG_SIN_ECONOMIA, costoUnitario: 1, margen: 99, costoDerivado: true, cost_status: 'KNOWN', producto_version_id: 9999, estado: 'emitida', precioUnitario: 10 };
const P3_HOSTIL = { id: 'p3', nombre: 'Archivero', cantidad: 2, precioUnitario: 5000, costoUnitario: 5, cost_status: 'KNOWN' };
async function escenarioHostil(db) {
  const id = await sembrarCompleta(db);
  await expect(guardar(db, VENDEDOR, id, { estado: 'emitida', partidas: [PATCH_HOSTIL_P1] })).rejects.toThrow(/estado protegido/);
  await expect(guardar(db, VENDEDOR, id, { folio_oficial: 'VH-2026-001', partidas: [PATCH_HOSTIL_P1] })).rejects.toThrow(/folio_oficial protegido/);
  expect((await p1De(db, id)).costoUnitario).toBe(21000);   // los rechazos no escribieron nada
  const r = await guardar(db, VENDEDOR, id, { partidas: [PATCH_HOSTIL_P1, P3_HOSTIL] });
  expect(r.c.ok).toBe(true);
  const d = await vistaDe(db, DIRECCION, id);
  expect(d.estado).toBe('borrador');
  expect(d.folio_oficial).toBeNull();
  return { id, p1: d.partidas.find((p) => p.id === 'p1'), p3: d.partidas.find((p) => p.id === 'p3') };
}

// Cambio de producto conservando el `id` de partida: ¿se re-pega la economía del producto viejo?
const P1_OTRO_PRODUCTO = { id: 'p1', nombre: 'Escritorio 1.50', cantidad: 1, precioUnitario: 48000, producto_id: 2, producto_version_id: 2044, piezaId: 'desk-150', bom_hash: 'sha256:bbb', config: { color: 'blanco' } };
async function escenarioCambioProducto(db) {
  const id = await sembrarCompleta(db);
  const r = await guardar(db, VENDEDOR, id, { partidas: [P1_OTRO_PRODUCTO] });
  expect(r.c.ok).toBe(true);
  const p1 = await p1De(db, id);
  expect(p1).toMatchObject({ producto_id: 2, producto_version_id: 2044, piezaId: 'desk-150', bom_hash: 'sha256:bbb', nombre: 'Escritorio 1.50' });
  return { id, p1 };
}

describe('VH-035 · ANTES (producción hoy): el rol sin economía PISA los costos de Dirección', () => {
  let db;
  beforeAll(async () => { db = await baseAislada(); }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('vendedor edita → Dirección pierde costoUnitario/margen (el bug, demostrado)', async () => {
    const { p1, p2, p3 } = await escenario(db, VENDEDOR);
    expect(p1.cantidad).toBe(3);                 // la edición sí entró…
    expect(p1).not.toHaveProperty('costoUnitario'); // …y la economía de Dirección se perdió
    expect(p2).not.toHaveProperty('costoUnitario');
    expect(p3).toBeTruthy();
  });

  it('diseño edita → peor: el trigger de strip sólo aplica a vendedor, así que diseño PISA el costo con el suyo', async () => {
    const { p1 } = await escenario(db, DISENO);
    // Dirección tenía 21000. Diseño mandó costoUnitario: 1 "por accidente" y se quedó.
    expect(p1.costoUnitario).not.toBe(21000);
    expect(p1.costoUnitario).toBe(1);
  });

  // ---- casos adversariales (2026-10-13) ----
  it('vendedor cambia cantidad → se pierde la economía de PRIMER nivel Y la anidada (config.costeo); cost_status desaparece', async () => {
    const { p1 } = await escenarioAnidado(db, VENDEDOR);
    expect(p1.cantidad).toBe(3);
    expect(p1).not.toHaveProperty('costoUnitario');
    expect(p1).not.toHaveProperty('margen');
    expect(p1).not.toHaveProperty('costoDerivado');
    expect(p1.config).toEqual(CONFIG_SIN_ECONOMIA);
    // normalize puso cost_status y el strip (que corre DESPUÉS, orden alfabético) lo borró: la fila queda sin veredicto.
    expect(p1).not.toHaveProperty('cost_status');
    expect(p1).toMatchObject({ producto_id: 1, producto_version_id: 1933 });
  });

  it('diseño cambia cantidad → también pierde toda la economía (su escritura entra tal cual; el strip no le aplica)', async () => {
    const { p1 } = await escenarioAnidado(db, DISENO);
    expect(p1.cantidad).toBe(3);
    expect(p1).not.toHaveProperty('costoUnitario');
    expect(p1).not.toHaveProperty('margen');
    expect(p1.config).toEqual(CONFIG_SIN_ECONOMIA);
    expect(p1.cost_status).toBe('UNKNOWN');   // diseño no es vendedor: normalize marca UNKNOWN y nadie lo borra
  });

  it('vendedor hostil: estado/folio_oficial de nivel superior se rechazan; su economía NO se persiste pero la de Dirección TAMPOCO sobrevive; versión y precio sí los cambia', async () => {
    const { p1, p3 } = await escenarioHostil(db);
    expect(p1).not.toHaveProperty('costoUnitario');   // ni el 1 colado ni el 21000 de Dirección
    expect(p1).not.toHaveProperty('margen');
    expect(p1).not.toHaveProperty('cost_status');
    expect(p1.producto_version_id).toBe(9999);        // el vendedor SÍ cambia la versión pineada
    expect(p1.precioUnitario).toBe(10);               // y el precio (es su campo)
    expect(p1.estado).toBe('emitida');                // `estado` DENTRO de la partida no está protegido (sólo el de la fila)
    expect(p3).not.toHaveProperty('costoUnitario');
    expect(p3).not.toHaveProperty('cost_status');
  });

  it('vendedor cambia de producto (mismo id de partida) → no hay economía rancia porque no hay economía: todo se perdió', async () => {
    const { p1 } = await escenarioCambioProducto(db);
    expect(p1).not.toHaveProperty('costoUnitario');
    expect(p1).not.toHaveProperty('margen');
    expect(p1).not.toHaveProperty('cost_status');
  });
});

describe('VH-035 · DESPUÉS (migración 20261010170000): la economía de Dirección queda INTACTA', () => {
  let db;
  beforeAll(async () => {
    db = await baseAislada();
    await db.exec(leer('supabase/migrations/20261010170000_actualizar_cotizacion_preserva_economia.sql'));
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('vendedor edita cantidad y agrega renglón → costos y márgenes de Dirección se conservan al centavo', async () => {
    const { p1, p2, p3 } = await escenario(db, VENDEDOR);
    expect(p1.cantidad).toBe(3);                 // su edición entró
    expect(p1.costoUnitario).toBe(21000);        // la economía NO se tocó…
    expect(p1.margen).toBe(30);
    expect(p1.costoDerivado).toBe(false);
    expect(p1.producto_version_id).toBe(1933);
    expect(p2.costoUnitario).toBe(1400);
    expect(p2.margen).toBe(35);
    expect(p3).toBeTruthy();                     // el renglón nuevo existe…
    expect(p3).not.toHaveProperty('costoUnitario'); // …sin economía inventada
  });

  it('el vendedor NO puede colar un costo propio (costoUnitario: 1 se descarta, queda el de Dirección)', async () => {
    const { p1 } = await escenario(db, VENDEDOR);
    expect(p1.costoUnitario).toBe(21000);
  });

  it('diseño (edita config pero no ve economía) tampoco la borra', async () => {
    const { p1, p2 } = await escenario(db, DISENO);
    expect(p1.costoUnitario).toBe(21000);
    expect(p2.margen).toBe(35);
  });

  it('Dirección sigue pudiendo cambiar la economía (el merge NO congela sus costos)', async () => {
    const { id } = await escenario(db, VENDEDOR);
    const vista = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
    const nuevas = vista.c.partidas.map((p) => (p.id === 'p1' ? { ...p, costoUnitario: 22500 } : p));
    await rpc(db, DIRECCION, 'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c', [id, JSON.stringify({ partidas: nuevas })]);
    const d = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
    expect(d.c.partidas.find((p) => p.id === 'p1').costoUnitario).toBe(22500);
  });

  it('una escritura CRUDA del vendedor (sin pasar por el RPC) sigue strippeada por el trigger', async () => {
    const { id } = await escenario(db, VENDEDOR);
    await como(db, VENDEDOR, () => db.query(
      `update public.cotizaciones set partidas = $2::jsonb where id = $1`,
      [id, JSON.stringify([{ id: 'p9', nombre: 'X', cantidad: 1, precioUnitario: 10, costoUnitario: 999 }])]));
    const d = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
    expect(d.c.partidas[0]).not.toHaveProperty('costoUnitario');
  });

  it('quitar un renglón sí lo quita (el merge no resucita partidas borradas)', async () => {
    const { id } = await escenario(db, VENDEDOR);
    const vista = await rpc(db, VENDEDOR, 'select public.cotizacion_segura($1) as c', [id]);
    const sinP2 = vista.c.partidas.filter((p) => p.id !== 'p2');
    await rpc(db, VENDEDOR, 'select public.actualizar_cotizacion_segura($1, $2::jsonb) as c', [id, JSON.stringify({ partidas: sinP2 })]);
    const d = await rpc(db, DIRECCION, 'select public.cotizacion_segura($1) as c', [id]);
    expect(d.c.partidas.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(d.c.partidas[0].costoUnitario).toBe(21000);
  });

  // ---- casos adversariales (2026-10-13) ----
  it('vendedor cambia cantidad → economía de PRIMER nivel intacta, cantidad actualizada, cost_status KNOWN conservado', async () => {
    const { p1 } = await escenarioAnidado(db, VENDEDOR);
    expect(p1.cantidad).toBe(3);
    expect(p1).toMatchObject({ costoUnitario: 21000, margen: 30, costoDerivado: false, cost_status: 'KNOWN', producto_id: 1, producto_version_id: 1933, piezaId: 'bench-6', bom_hash: 'sha256:aaa' });
  });

  it('LIMITACIÓN CONOCIDA (no es PASS de preservación): la economía ANIDADA en config (costeo, insumos[].costo) se PIERDE con esta migración', async () => {
    const { p1 } = await escenarioAnidado(db, VENDEDOR);
    // La fusión es de claves de primer nivel; `config` no es clave económica, así que gana el `config`
    // despojado que mandó el vendedor. Dirección pierde config.costeo e insumos[].costo.
    expect(p1.config).toEqual(CONFIG_SIN_ECONOMIA);
    expect(p1.config).not.toHaveProperty('costeo');
    expect(p1.config.insumos[0]).not.toHaveProperty('costo');
  });

  it('diseño cambia cantidad → primer nivel intacto (la fusión aplica a todo rol sin economía), anidado perdido (misma limitación)', async () => {
    const { p1 } = await escenarioAnidado(db, DISENO);
    expect(p1.cantidad).toBe(3);
    expect(p1).toMatchObject({ costoUnitario: 21000, margen: 30, costoDerivado: false, cost_status: 'KNOWN' });
    expect(p1.config).toEqual(CONFIG_SIN_ECONOMIA);
  });

  it('vendedor hostil: estado/folio_oficial se rechazan; costoUnitario 1 / margen 99 / cost_status colados se descartan y gana la economía de Dirección; p3 nuevo queda UNKNOWN', async () => {
    const { p1, p3 } = await escenarioHostil(db);
    expect(p1).toMatchObject({ costoUnitario: 21000, margen: 30, costoDerivado: false, cost_status: 'KNOWN' });
    expect(p3).not.toHaveProperty('costoUnitario');
    expect(p3.cost_status).toBe('UNKNOWN');           // el 'KNOWN' colado se strippeó y normalize lo marcó UNKNOWN
    // Lo que el vendedor SÍ puede cambiar (no es economía, así que la migración no lo protege):
    expect(p1.producto_version_id).toBe(9999);        // ← versión pineada cambiada por el vendedor
    expect(p1.precioUnitario).toBe(10);
    expect(p1.estado).toBe('emitida');                // `estado` dentro de la partida: sólo el de la fila está protegido
  });

  // DEFECTO CONOCIDO de la migración pendiente (no aplicada): se documenta con it.fails para que CI siga

  // siendo señal útil; el día que la migración deje de reciclar, esta prueba FALLA y hay que quitar el .fails.

  it.fails('STALE (defecto conocido de 20261010170000): vendedor cambia de producto (producto_id 1→2, versión 1933→2044, piezaId, bom_hash) y la migración RE-PEGA el costo 21000 del producto viejo sobre el nuevo', async () => {
    const { p1 } = await escenarioCambioProducto(db);
    // Lo correcto: una partida que ya es OTRO producto no puede heredar el costo del anterior.
    // Esta migración lo hereda (fusión sólo por `id`) → costo engañoso que Dirección verá como KNOWN.
    // La prueba FALLA a propósito con 20261010170000; pasa con PROPUESTA_vh035b (bloque siguiente).
    const stale = 'STALE: 20261010170000 re-pega costoUnitario=21000 / margen=30 / cost_status=KNOWN (producto 1 · versión 1933) sobre producto 2 · versión 2044; el costo mostrado a Dirección sería falso';
    expect(p1.costoUnitario, stale).toBeUndefined();
    expect(p1.margen, stale).toBeUndefined();
    expect(p1.cost_status, stale).not.toBe('KNOWN');
  });
});

describe('VH-035b · PROPUESTA_vh035b_preserva_economia_sin_reciclar: preserva sólo si el producto es el mismo', () => {
  let db;
  beforeAll(async () => {
    db = await baseAislada();
    await db.exec(leer('supabase/migrations/PROPUESTA_vh035b_preserva_economia_sin_reciclar.sql'));
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('misma identidad: vendedor edita cantidad y agrega renglón → economía de Dirección al centavo (igual que 20261010170000)', async () => {
    const { p1, p2, p3 } = await escenario(db, VENDEDOR);
    expect(p1.cantidad).toBe(3);
    expect(p1).toMatchObject({ costoUnitario: 21000, margen: 30, costoDerivado: false, producto_version_id: 1933 });
    expect(p2).toMatchObject({ costoUnitario: 1400, margen: 35 });
    expect(p3).toBeTruthy();
    expect(p3).not.toHaveProperty('costoUnitario');
  });

  it('misma identidad con partida completa: primer nivel intacto para vendedor y diseño; anidado sigue perdiéndose (limitación heredada, documentada)', async () => {
    for (const rol of [VENDEDOR, DISENO]) {
      const { p1 } = await escenarioAnidado(db, rol);
      expect(p1.cantidad).toBe(3);
      expect(p1).toMatchObject({ costoUnitario: 21000, margen: 30, costoDerivado: false, cost_status: 'KNOWN', producto_id: 1, producto_version_id: 1933 });
      expect(p1.config).toEqual(CONFIG_SIN_ECONOMIA);
    }
  });

  it('cambio de producto (mismo id de partida) → NO se recicla la economía: queda sin costo, cost_status UNKNOWN y marca cost_stale con la identidad previa', async () => {
    const { p1 } = await escenarioCambioProducto(db);
    expect(p1).not.toHaveProperty('costoUnitario');
    expect(p1).not.toHaveProperty('margen');
    expect(p1).not.toHaveProperty('costoDerivado');
    expect(p1.cost_status).toBe('UNKNOWN');           // vocabulario de normalizar_cost_status_partidas
    expect(p1.cost_stale).toEqual({
      motivo: 'RECOSTEO_PRODUCTO_CAMBIADO',
      campos: ['producto_id', 'producto_version_id', 'piezaId', 'bom_hash'],
      previo: { producto_id: '1', producto_version_id: '1933', piezaId: 'bench-6', bom_hash: 'sha256:aaa' },
    });
    expect(p1.config).toEqual({ color: 'blanco' });
  });

  it('la marca cost_stale es economía: el vendedor no la ve, no la puede borrar y sobrevive a su siguiente guardado', async () => {
    const { id } = await escenarioCambioProducto(db);
    const vista = await vistaDe(db, VENDEDOR, id);
    expect(vista.partidas[0]).not.toHaveProperty('cost_stale');
    expect(vista.partidas[0]).not.toHaveProperty('cost_status');
    await guardar(db, VENDEDOR, id, { partidas: vista.partidas.map((p) => ({ ...p, cantidad: 5 })) });
    const p1 = await p1De(db, id);
    expect(p1.cantidad).toBe(5);
    expect(p1.cost_status).toBe('UNKNOWN');
    expect(p1.cost_stale?.motivo).toBe('RECOSTEO_PRODUCTO_CAMBIADO');
    expect(p1).not.toHaveProperty('costoUnitario');
  });

  it('sólo cambiar producto_version_id (hostil: 1933→9999) también invalida la economía en vez de heredarla', async () => {
    const { p1, p3 } = await escenarioHostil(db);
    expect(p1).not.toHaveProperty('costoUnitario');
    expect(p1).not.toHaveProperty('margen');
    expect(p1.cost_status).toBe('UNKNOWN');
    expect(p1.cost_stale).toMatchObject({ motivo: 'RECOSTEO_PRODUCTO_CAMBIADO', campos: ['producto_version_id'] });
    expect(p1.producto_version_id).toBe(9999);        // el cambio de versión se respeta; lo que no se hereda es el costo
    expect(p3.cost_status).toBe('UNKNOWN');
  });

  it('Dirección recostea: al guardar costo nuevo sobre el producto nuevo, la marca cost_stale se va', async () => {
    const { id } = await escenarioCambioProducto(db);
    const vista = await vistaDe(db, DIRECCION, id);
    const nuevas = vista.partidas.map((p) => { const { cost_stale, cost_status, ...resto } = p; return { ...resto, costoUnitario: 19500, margen: 40 }; });
    await guardar(db, DIRECCION, id, { partidas: nuevas });
    const p1 = await p1De(db, id);
    expect(p1).toMatchObject({ costoUnitario: 19500, margen: 40, cost_status: 'KNOWN', producto_id: 2 });
    expect(p1).not.toHaveProperty('cost_stale');
  });

  it('quitar un renglón sí lo quita y la escritura cruda del vendedor sigue strippeada', async () => {
    const { id } = await escenario(db, VENDEDOR);
    const vista = await vistaDe(db, VENDEDOR, id);
    await guardar(db, VENDEDOR, id, { partidas: vista.partidas.filter((p) => p.id !== 'p2') });
    let d = await vistaDe(db, DIRECCION, id);
    expect(d.partidas.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(d.partidas[0].costoUnitario).toBe(21000);
    await como(db, VENDEDOR, () => db.query(`update public.cotizaciones set partidas = $2::jsonb where id = $1`,
      [id, JSON.stringify([{ id: 'p9', nombre: 'X', cantidad: 1, precioUnitario: 10, costoUnitario: 999 }])]));
    d = await vistaDe(db, DIRECCION, id);
    expect(d.partidas[0]).not.toHaveProperty('costoUnitario');
  });
});
