// ============================================================================
//  SEG-01c (revisión 2) · el costo de un renglón especial es el que el SERVIDOR registró, VINCULÓ a esa partida
//  y sigue correspondiendo a ESA definición de la partida y a ESA base de costo.
//
//  BASE: la de producción de supabase/tests/helpers/baseVh148b.js (SQL exacto, RLS y privilegios de producción;
//  las sesiones corren con SET ROLE authenticated como PostgREST) + catálogo REAL (tablas del baseline, vista de
//  producción, insumo_motor/catalogo_motor de VH-088) + P1-03b + VH-148 + VH-148b + SEG-01 + SEG-01c.
//  Sustituye al bloque SEG-01c de seguridadGateEmisionSnapshot.test.js, que corría como superusuario.
//
//  Ataques de la reauditoría externa v2 (14-oct): P0-01 cambiar la definición de la partida conservando id,
//  cantidad, costo y costeoId; P0-02 carrera guardado → vínculo; P1-01 frescura de la base de costo; P2-02 acceso.
//  Hueco propio: un especial con `productoId` de TEXTO (clave de línea) se saltaba la autoridad.
//  El bloque "ANTES" carga la revisión 1 (fixtures/seg01c_rev1_4ed8ac6.sql = 4ed8ac6) y demuestra que esos ataques
//  pasaban: las pruebas nuevas fallan contra el código anterior.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  DIRECCION, VENDEDOR, DISENO, VH148, VH148B, SEG01, SEG01C, leer, baseProduccion, uno, q, fallo, vista, guardar3, md5Def, clientePglite,
} from './helpers/baseVh148b.js';
// src/nube.js crea su cliente al importarse: aquí no se usa (vincularCosteos recibe el cliente PGlite explícito).
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));
import { tablaDeBaseline, vistaCatalogoVigenteProduccion, funcionDeMigracion, privateApiDeBaseline } from './fixtures/erpBaseAislada.js';
import { promesaComercialDeCosteo } from '../../src/datos/promesaComercial.js';
import { specTecnicaDeCosteo } from '../../src/datos/specTecnica.js';

const P103B = 'supabase/migrations/PROPUESTA_p103b_precio_id_en_catalogo.sql';
const VH088 = 'supabase/migrations/20261012043000_vh088_catalogo_motor.sql';
const SEG01C_REV1 = 'supabase/tests/fixtures/seg01c_rev1_4ed8ac6.sql';
const SEG01C_REV2 = 'supabase/tests/fixtures/seg01c_rev2_d5b45d6.sql';
const ESTRICTO = `modo = 'estricto', version_motor_vigente = 'motor-1'`;   // rev3: estricto exige versión de motor
const VENDEDOR2 = 'ventas2@vh.mx';
const MD5_WRAPPER_PROD = 'cf6ef6a30bbb68eb2b867f2bcdb7c846';

// Lo que Dirección costeó (renglón especial, sin Producto Maestro).
const COSTEADO = {
  id: 'p1', nombre: 'Escritorio operativo melamina blanca', medidas: '120x60x75', material: 'Melamina 16 mm',
  cantidad: 1, precioUnitario: 10000, costoUnitario: 6000,
  pieza: { componentes: [{ id: 'c1', nombre: 'Cubierta', largo: 1200, ancho: 600, insumoId: 'm16' }] },
};
// rev5: la pieza saneada que costeó el motor y la especificación técnica que lleva la partida (la arma Costear con la
// misma función). Por omisión el K sella esta misma spec: las pruebas de rev2–rev4 siguen probando lo suyo.
const PIEZA_COSTEADA = { componentes: [{ nombre: 'Cubierta', insumoId: 'm16', cantidad: 1, largoMM: 1200, anchoMM: 600 }] };
COSTEADO.especificacion_tecnica = specTecnicaDeCosteo(PIEZA_COSTEADA);
// Identidad que Costear manda JUNTO con el despiece (rev3) = la de la partida que se agrega.
const IDENTIDAD = { nombre: COSTEADO.nombre, medidas: COSTEADO.medidas, material: COSTEADO.material };
// Precio aprobado por una persona de Dirección: id 900, melamina 16, $612.40.
const TRAZA = [{ insumo_id: 'm16', precio_id: 900, precio_usado: 612.4, approved_by: DIRECCION, humana: true }];
const PRECIO = (id, precio, desde) => `insert into public.insumo_precios (id, insumo_id, precio, estado, confidence, vigente_desde, approved_by, approved_at,
  unidad_compra, precio_compra, factor_conversion, evidence_status, requiere_validacion_compras) overriding system value
  values (${id}, 'm16', ${precio}, 'aprobado', 'alta', '${desde}', '${DIRECCION}', now(), 'hoja', ${precio}, 1, 'documentada', false)`;

// Evidencia "antes/después": SEG01C_MIG=<archivo> corre TODO el archivo contra otra revisión (p. ej. la rev4,
// supabase/tests/fixtures/seg01c_rev4_8cc0adb.sql): las pruebas de rev5 y del pipeline real deben FALLAR ahí.
const SEG01C_ACTUAL = process.env.SEG01C_MIG || SEG01C;
async function base({ seg01c = SEG01C_ACTUAL, conP103b = true, conVh148b = true } = {}) {
  const db = await baseProduccion();
  await db.exec(`insert into public.permitidos(email, rol) values ('${VENDEDOR2}', 'vendedor')`);
  await db.exec(tablaDeBaseline('insumos_catalogo'));
  await db.exec(tablaDeBaseline('insumo_precios'));
  await db.exec(vistaCatalogoVigenteProduccion());
  await db.exec(funcionDeMigracion(VH088, 'private_api.insumo_motor'));
  await db.exec(funcionDeMigracion(VH088, 'private_api.catalogo_motor'));
  await db.exec(privateApiDeBaseline('resolver_costo_insumo'));
  await db.exec(`create table public.config (id text primary key, datos jsonb, actualizado timestamptz default now());
    insert into public.config(id, datos) values ('vonhaucke', '{"parametros": {"tarifaMO": 95, "gif": 0.35}}'::jsonb);
    insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion, familia, atributos)
      values ('m16', 'Melamina 16 mm', 'tableros', 'hoja', true, 'curado', 'melamina', '{"largo_mm": 2440, "ancho_mm": 1220}'::jsonb);
    ${PRECIO(900, 612.4, '2026-10-01')};`);
  if (conP103b) await db.exec(leer(P103B));
  if (conVh148b) { await db.exec(leer(VH148)); await db.exec(leer(VH148B)); }
  await db.exec(leer(SEG01));
  await db.exec(leer(seg01c));
  // Una revisión anterior a rev5 no tiene las columnas de spec: se agregan vacías para que el registro del costeo no
  // truene por el esquema y la prueba mida el COMPORTAMIENTO (si vincula o no), no un error de columna.
  if (seg01c !== SEG01C) await db.exec(`alter table public.costeos_servidor add column if not exists spec_tecnica_origen jsonb;
    alter table public.costeos_servidor add column if not exists spec_tecnica_version text`).catch(() => {});
  await db.exec(`update private_api.politica_emision_autoridad set ${seg01c === SEG01C_REV1 ? "modo = 'estricto'" : ESTRICTO}`);
  return db;
}

// --- ayudas (servidor = rol null; sesiones = authenticated) -------------------------------------------------------
function ayudas(db) {
  const h = {};
  // Como la Edge (service_role): registra el costeo con la huella de su base de costo.
  h.reg = async (o = {}) => (await db.query(
    `insert into public.costeos_servidor (creado_por, rol, bom_hash, cantidad, costo_unitario, estado, aprobacion_humana, precios,
       insumos_usados, base_costo_huella, version_motor, identidad_origen, componentes_costeados, promesa_origen, spec_tecnica_origen, spec_tecnica_version)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::text[], case when $10 then private_api.huella_base_costo($9::text[]) end, $11, $12::jsonb, $13::jsonb, $14::jsonb,
             $15::jsonb, case when $15::jsonb is null then null else coalesce($16, 'v1') end) returning id`,
    [o.por ?? DIRECCION, o.rol ?? 'direccion', o.bom ?? 'bom-escritorio', o.cantidad ?? 1, o.costo ?? 6000, o.estado ?? 'certificado',
      o.humana ?? true, JSON.stringify(o.precios ?? TRAZA), o.insumos ?? ['m16'], o.base !== false, o.motor ?? 'motor-1',
      o.identidad === null ? null : JSON.stringify(o.identidad ?? IDENTIDAD), JSON.stringify(COSTEADO.pieza.componentes),
      // rev4: la promesa de origen que manda la Edge (por omisión, la del mueble costeado). El trigger la sella.
      o.promesa === null ? null : JSON.stringify(promesaComercialDeCosteo(o.promesa ?? o.identidad ?? COSTEADO)),
      // rev5: la spec técnica de origen que manda la Edge (la pieza saneada que costeó). El trigger la sella.
      o.spec === null ? null : JSON.stringify(specTecnicaDeCosteo(o.spec ?? PIEZA_COSTEADA) ?? o.spec), o.specVersion ?? null])).rows[0].id;
  // Dirección guarda la cotización (a nombre del vendedor) con las partidas dadas.
  h.sembrar = async (partidas = [{ ...COSTEADO }]) => (await uno(db, DIRECCION,
    `insert into public.cotizaciones(usuario, cliente, folio, partidas, total, piezas) values ($1, 'Cliente demo', 'COT-DEMO', $2::jsonb, 11600, 1) returning id`,
    [VENDEDOR, JSON.stringify(partidas)], null)).id;
  h.version = async (id) => (await db.query(`select to_json(actualizado)#>>'{}' as v from public.cotizaciones where id=$1`, [id])).rows[0].v;
  // El vínculo con la versión que el cliente obtuvo de SU guardado (por omisión, la actual).
  h.adjuntar = async (email, cot, partida, costeo, esperado) => (await uno(db, email,
    'select public.adjuntar_costeo_a_partida($1, $2, $3::uuid, $4::timestamptz) as r',
    [cot, partida, costeo, esperado === undefined ? await h.version(cot) : esperado])).r;
  h.fila = async (id, i = 0) => (await db.query('select partidas from public.cotizaciones where id=$1', [id])).rows[0].partidas[i];
  h.legitima = async (o = {}) => {
    const k = await h.reg(o); const id = await h.sembrar([{ ...COSTEADO, costeoId: k }]);
    await h.adjuntar(o.por ?? DIRECCION, id, 'p1', k); return { id, k };
  };
  // Dirección guarda (con versión) la partida p1 cambiada.
  h.guardarP1 = async (id, cambios, email = DIRECCION) => {
    const v = await vista(db, email, id);
    return guardar3(db, email, id, { partidas: v.partidas.map((p) => (p.id === 'p1' ? { ...p, ...cambios } : p)) }, v.actualizado);
  };
  // Snapshot LEGÍTIMO: lo que el vendedor ve (vista sin economía), precio dentro del margen.
  h.snap = async (id, cambios = { precioUnitario: 9500 }) => {
    const v = await vista(db, VENDEDOR, id);
    const partidas = v.partidas.map((p) => ({ ...p, ...cambios }));
    const precioLista = partidas.reduce((s, p) => s + Math.round(p.precioUnitario * p.cantidad * 100) / 100, 0);
    return { cliente: v.cliente, folio: 'COT-DEMO', partidas, totales: { precioLista, descuento: 0, contingencia: 0, maniobras: 0, flete: 0, iva: 0 }, total: precioLista };
  };
  h.evaluar = async (id, snap) => (await uno(db, VENDEDOR, 'select public.evaluar_emision_cotizacion($1, $2::jsonb) as g', [id, JSON.stringify(snap ?? await h.snap(id))])).g;
  h.emitir = async (id, snap) => (await uno(db, VENDEDOR, 'select public.emitir_revision_v2($1, $2::jsonb) as r', [id, JSON.stringify(snap ?? await h.snap(id))])).r;
  h.motivos = async (id, email = DIRECCION) => (await uno(db, email, 'select private_api.motivos_autoridad_costeo($1) as m', [id])).m;
  h.revisiones = async (id) => Number((await db.query('select count(*)::int as n from public.cotizaciones_revisiones where cotizacion_id=$1', [id])).rows[0].n);
  h.politica = (sql) => db.exec(`update private_api.politica_emision_autoridad set ${sql}`);
  return h;
}

describe('SEG-01c rev 2 · vínculo server-side costeo → cotización → partida (sesiones authenticated, base de producción)', () => {
  let db, h;
  beforeAll(async () => {
    db = await base(); h = ayudas(db);
    expect(await md5Def(db, 'public.evaluar_emision_cotizacion(bigint, jsonb)')).not.toBe(MD5_WRAPPER_PROD); // SEG-01c lo reemplazó
  }, 180_000);
  afterAll(async () => { await db?.close(); });

  // ---------------- controles y lo que ya cubría la revisión 1 (portado) ----------------
  it('control: costeo certificado, vinculado por el servidor, partida intacta, base vigente ⇒ ALLOWED y se emite', async () => {
    const { id } = await h.legitima();
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
    expect(await h.emitir(id)).toMatchObject({ nueva: true, revision: 1 });
  });

  it('adjuntar escribe la economía DESDE el registro del servidor, no desde lo que trae el navegador', async () => {
    const k = await h.reg({ costo: 6123.45 });
    const id = await h.sembrar([{ ...COSTEADO, costeoId: k, costoUnitario: 1, costoEstado: 'certificado', bomHash: 'inventado' }]);
    await h.adjuntar(DIRECCION, id, 'p1', k);
    expect(await h.fila(id)).toMatchObject({ costoUnitario: 6123.45, costoEstado: 'certificado', costeoId: k, bomHash: 'bom-escritorio' });
  });

  it('REPLAY: el mismo costeoId copiado a OTRA cotización con su bomHash, cantidad y costo ⇒ no se emite ni se vincula', async () => {
    const { k } = await h.legitima();
    const otra = await h.sembrar([{ ...COSTEADO, costeoId: k, bomHash: 'bom-escritorio', costoEstado: 'certificado' }]);
    const g = await h.evaluar(otra);
    expect(g.state).toBe('ECONOMICS_INCOMPLETE');
    expect(g.reasons).toContain('linea_1_costeo_no_vinculado_a_esta_partida');
    expect((await fallo(h.adjuntar(DIRECCION, otra, 'p1', k)))?.message).toMatch(/ya vinculado a otra partida/);
  });

  it('REPLAY dentro de la misma cotización: otra partida no puede tomar el costeo de la primera', async () => {
    const k = await h.reg();
    const id = await h.sembrar([{ ...COSTEADO, id: 'a', costeoId: k }, { ...COSTEADO, id: 'b', costeoId: k }]);
    await h.adjuntar(DIRECCION, id, 'a', k);
    expect((await fallo(h.adjuntar(DIRECCION, id, 'b', k)))?.message).toMatch(/ya vinculado/);
    expect(await h.motivos(id)).toContain('linea_2_costeo_no_vinculado_a_esta_partida');
  });

  it('costeo sin vincular (el navegador sólo puso el costeoId) ⇒ no se emite', async () => {
    const id = await h.sembrar([{ ...COSTEADO, costeoId: await h.reg() }]);
    expect((await h.evaluar(id)).reasons).toContain('linea_1_costeo_no_vinculado_a_esta_partida');
  });

  it('el navegador declara certificado sin costeo del servidor ⇒ no se emite (0 revisiones)', async () => {
    const id = await h.sembrar([{ ...COSTEADO, costoEstado: 'certificado', validado_servidor: true }]);
    expect((await h.evaluar(id)).reasons).toContain('linea_1_sin_costeo_servidor');
    expect(await fallo(h.emitir(id))).not.toBeNull();
    expect(await h.revisiones(id)).toBe(0);
  });

  it('FRESCURA de precio: si el precio aprobado se cierra (vigente_hasta) después de costear, el costeo deja de servir', async () => {
    const { id } = await h.legitima();
    await db.exec(`${PRECIO(901, 650, '2026-10-14')}; update public.insumo_precios set vigente_hasta = '2026-10-14' where id = 900;`);
    try { expect((await h.evaluar(id)).reasons).toContain('linea_1_costeo_con_precio_ya_no_vigente'); }
    finally { await db.exec('delete from public.insumo_precios where id = 901; update public.insumo_precios set vigente_hasta = null where id = 900;'); }
  });

  it('FRESCURA de precio: llegó otro precio mejor rankeado ⇒ no sirve', async () => {
    const { id } = await h.legitima();
    await db.exec(PRECIO(902, 700, '2026-10-15'));
    try { expect((await h.evaluar(id)).reasons).toContain('linea_1_costeo_con_precio_ya_no_vigente'); }
    finally { await db.exec('delete from public.insumo_precios where id = 902'); }
  });

  it('FRESCURA de precio (punto 10 de la reauditoría): OTRA fila con el MISMO importe pasa a ser la vigente ⇒ no sirve', async () => {
    const { id } = await h.legitima();
    await db.exec(PRECIO(903, 612.4, '2026-10-16'));   // mismo $612.40, otra fila (más reciente) ⇒ catalogo_vigente elige 903
    try {
      expect((await db.query(`select precio_id from public.catalogo_vigente where insumo_id = 'm16'`)).rows[0].precio_id).toBe(903);
      expect((await h.evaluar(id)).reasons).toContain('linea_1_costeo_con_precio_ya_no_vigente');
    } finally { await db.exec('delete from public.insumo_precios where id = 903'); }
  });

  it('costeo certificado sin traza de precios ⇒ no se emite', async () => {
    const { id } = await h.legitima({ precios: [] });
    expect((await h.evaluar(id)).reasons).toContain('linea_1_costeo_sin_traza_de_precios');
  });

  it('CERTIFICADO con costo $0 no puede existir (CHECK); preliminar $0 sí se registra pero no emite', async () => {
    expect((await fallo(h.reg({ costo: 0 })))?.message).toMatch(/costeo_certificado_positivo/);
    const { id } = await h.legitima({ costo: 0, estado: 'preliminar' });
    expect((await h.evaluar(id)).state).toBe('ECONOMICS_INCOMPLETE');
  });

  it.each([
    ['preliminar', { estado: 'preliminar' }],
    ['sin aprobación humana', { humana: false }],
  ])('registro %s ⇒ no se emite aunque esté vinculado', async (_n, o) => {
    const { id } = await h.legitima(o);
    expect((await h.evaluar(id)).reasons).toContain('linea_1_costeo_servidor_no_certificado');
  });

  it('Dirección cambia luego el costo del renglón al guardar ⇒ ya no coincide con el servidor', async () => {
    const { id } = await h.legitima();
    await h.guardarP1(id, { costoUnitario: 4000 });
    expect((await h.evaluar(id)).reasons).toContain('linea_1_costo_no_coincide_con_servidor');
  });

  it('adjuntar: el vendedor no puede; otra persona no puede usar un costeo ajeno; cantidad distinta exige recostear', async () => {
    const k = await h.reg();
    const id = await h.sembrar([{ ...COSTEADO, costeoId: k }]);
    expect((await fallo(h.adjuntar(VENDEDOR, id, 'p1', k)))?.message).toMatch(/sólo Dirección o Diseño/);
    expect((await fallo(h.adjuntar(DISENO, id, 'p1', k)))?.message).toMatch(/otra persona/);
    const k2 = await h.reg({ cantidad: 20 });
    const id2 = await h.sembrar([{ ...COSTEADO, costeoId: k2 }]);
    expect((await fallo(h.adjuntar(DIRECCION, id2, 'p1', k2)))?.message).toMatch(/otra cantidad/);
  });

  it('adjuntar es idempotente para la MISMA partida SIN cambios (cada guardado puede re-vincular)', async () => {
    const { id, k } = await h.legitima();
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true });
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });

  it('el VENDEDOR intenta cambiar costeoId y costo al guardar ⇒ se le despoja; lo vinculado sigue y sigue emitiendo', async () => {
    const { id, k } = await h.legitima();
    const barato = await h.reg({ costo: 100 });
    const v = await vista(db, VENDEDOR, id);
    await guardar3(db, VENDEDOR, id, { partidas: v.partidas.map((p) => ({ ...p, costeoId: barato, costoUnitario: 100 })) }, v.actualizado);
    expect(await h.fila(id)).toMatchObject({ costeoId: k, costoUnitario: 6000 });
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });

  it('MODO PREPARADO (por omisión al aplicar): no bloquea nada; el diagnóstico dice qué bloquearía', async () => {
    const id = await h.sembrar([{ ...COSTEADO, costoEstado: 'certificado' }]);
    await h.politica(`modo = 'preparado'`);
    try {
      expect((await h.evaluar(id)).state).toBe('ALLOWED');
      expect((await uno(db, DIRECCION, 'select public.diagnostico_autoridad_costeo($1) as d', [id])).d)
        .toEqual({ modo: 'preparado', motivos: ['linea_1_sin_costeo_servidor'] });
      expect((await fallo(uno(db, VENDEDOR, 'select public.diagnostico_autoridad_costeo($1) as d', [id])))?.message).toMatch(/no autorizado/);
    } finally { await h.politica(`modo = 'estricto'`); }
  });

  it('anon/authenticated no leen ni escriben costeos_servidor, partida_costeo_vigente ni cuentas_no_humanas; huella_base_costo es sólo de service_role', async () => {
    for (const t of ['public.costeos_servidor', 'public.cuentas_no_humanas', 'public.partida_costeo_vigente']) for (const r of ['anon', 'authenticated']) for (const p of ['select', 'insert', 'update', 'delete']) {
      expect((await db.query('select has_table_privilege($1, $2, $3) as ok', [r, t, p])).rows[0].ok, `${r} ${p} ${t}`).toBe(false);
    }
    for (const r of ['anon', 'authenticated']) {
      expect((await db.query(`select has_function_privilege($1, 'public.huella_base_costo(text[])', 'execute') as ok`, [r])).rows[0].ok).toBe(false);
    }
    expect((await db.query(`select has_function_privilege('service_role', 'public.huella_base_costo(text[])', 'execute') as ok`)).rows[0].ok).toBe(true);
  });

  // ---------------- P0-01 · el costo pertenece a ESTA definición de la partida ----------------
  it.each([
    ['nombre', { nombre: 'Escritorio ejecutivo NOGAL MACIZO' }],
    ['medidas', { medidas: '300x120x75' }],
    ['material', { material: 'Nogal macizo 38 mm' }],
    ['despiece (pieza)', { pieza: { componentes: [{ id: 'c1', nombre: 'Cubierta', largo: 3000, ancho: 1200, insumoId: 'm16' }] } }],
    ['ancho w', { w: 300 }],
  ])('P0-01: Dirección cambia %s conservando id, cantidad, costo y costeoId ⇒ partida_cambio_desde_el_costeo; re-vincular NO lo lava', async (_n, cambio) => {
    const { id, k } = await h.legitima();
    await h.guardarP1(id, cambio);
    expect(await h.fila(id)).toMatchObject({ id: 'p1', cantidad: 1, costoUnitario: 6000, costeoId: k });
    const g = await h.evaluar(id);
    expect(g.state).toBe('ECONOMICS_INCOMPLETE');
    expect(g.reasons).toContain('linea_1_partida_cambio_desde_el_costeo');
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k)))?.message).toMatch(/la partida cambió/);
    expect(await fallo(h.emitir(id))).not.toBeNull();
  });

  it('P0-01: borrar la partida y crear OTRO mueble con el mismo id (y el mismo costeoId/costo) ⇒ no se emite', async () => {
    const { id, k } = await h.legitima();
    const v = await vista(db, DIRECCION, id);
    const otro = { id: 'p1', nombre: 'Mesa de juntas 12 personas', medidas: '480x140x75', material: 'Chapa nogal', cantidad: 1,
      precioUnitario: 10000, costoUnitario: 6000, costoEstado: 'certificado', costeoId: k, bomHash: 'bom-escritorio' };
    await guardar3(db, DIRECCION, id, { partidas: [otro] }, v.actualizado);
    expect((await h.evaluar(id)).reasons).toContain('linea_1_partida_cambio_desde_el_costeo');
  });

  it('P0-01 sin falsos positivos: el vendedor guarda su vista tal cual con otro precio ⇒ sigue ALLOWED', async () => {
    const { id } = await h.legitima();
    const v = await vista(db, VENDEDOR, id);
    await guardar3(db, VENDEDOR, id, { partidas: v.partidas.map((p) => ({ ...p, precioUnitario: 9800 })) }, v.actualizado);
    expect((await h.evaluar(id, await h.snap(id, {}))).state).toBe('ALLOWED');
  });

  it('P0-01 sin falsos positivos: un render nuevo y otro enlace de acomodo (no cambian el mueble) ⇒ sigue ALLOWED', async () => {
    const { id } = await h.legitima();
    await h.guardarP1(id, { render: 'https://x/r.png', zone_id: 'z2', instance_id: 'i9', anchor_role: 'centro' });
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });

  // Observación (NO es de SEG-01c): VH-035c, en producción, trata un render/enlace de acomodo guardado por el VENDEDOR
  // como "definición cambiada" y deja el renglón en recosteo. Se documenta tal cual; corregirlo es otra migración.
  it('VH-035c (producción, observación): el vendedor guarda un render ⇒ recosteo pendiente por definición cambiada', async () => {
    const { id } = await h.legitima();
    const v = await vista(db, VENDEDOR, id);
    await guardar3(db, VENDEDOR, id, { partidas: v.partidas.map((p) => ({ ...p, render: 'https://x/r.png' })) }, v.actualizado);
    expect((await h.evaluar(id)).reasons).toContain('linea_1_recosteo_pendiente_definicion_cambiada');
  });

  // ---------------- P0-02 · CAS en el vínculo ----------------
  it('P0-02: otra pestaña cambia la partida ENTRE el guardado y el vínculo ⇒ PT409; sin versión ⇒ 22004; nada se vincula', async () => {
    const k = await h.reg();
    const id = await h.sembrar([{ ...COSTEADO, costeoId: k }]);
    const deMiGuardado = await h.version(id);             // A: guardó y va a vincular con esta versión
    await h.guardarP1(id, { nombre: 'Mesa de juntas 12 personas', medidas: '480x140x75' });   // B: cambia la partida
    const e = await fallo(h.adjuntar(DIRECCION, id, 'p1', k, deMiGuardado));
    expect(e?.code).toBe('PT409');
    expect(e?.message).toMatch(/CONFLICTO_VERSION/);
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k, null)))?.code).toBe('22004');
    expect((await db.query('select cotizacion_id from public.costeos_servidor where id = $1', [k])).rows[0].cotizacion_id).toBeNull();
  });

  it('P0-02: dos vínculos encadenados — el segundo usa el `actualizado` que devolvió el primero; con el viejo ⇒ PT409', async () => {
    const ka = await h.reg(); const kb = await h.reg();
    const id = await h.sembrar([{ ...COSTEADO, id: 'a', costeoId: ka }, { ...COSTEADO, id: 'b', costeoId: kb }]);
    const v0 = await h.version(id);
    const ra = await h.adjuntar(DIRECCION, id, 'a', ka, v0);
    expect(ra.actualizado).not.toBe(v0);
    expect((await fallo(h.adjuntar(DIRECCION, id, 'b', kb, v0)))?.code).toBe('PT409');
    expect(await h.adjuntar(DIRECCION, id, 'b', kb, ra.actualizado)).toMatchObject({ ok: true });
    expect(await h.motivos(id)).toEqual([]);
  });

  // ---------------- hueco propio · clave de línea de texto ----------------
  it('HUECO productoId de TEXTO: un especial con clave de línea y sin costeo ya NO se salta la autoridad', async () => {
    const id = await h.sembrar([{ ...COSTEADO, productoId: 'LIBRERO', claveLinea: 'LIBRERO', costoUnitario: 50, costoEstado: 'certificado' }]);
    const g = await h.evaluar(id);
    expect(g.state).toBe('ECONOMICS_INCOMPLETE');
    expect(g.reasons).toContain('linea_1_sin_costeo_servidor');
    // …y se puede vincular un costeo del servidor a ese renglón (no es canónico). rev4: la clave de línea es identidad
    // de variante y entra a la promesa, así que el costeo tiene que declararla; uno costeado sin ella ya no vincula.
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', await h.reg())))?.message).toMatch(/promete otra cosa/);
    const k = await h.reg({ promesa: { ...COSTEADO, productoId: 'LIBRERO', claveLinea: 'LIBRERO' } });
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true });
  });

  it('canónico = producto_id Y producto_version_id numéricos: no pide costeo del servidor y no se le puede vincular uno', async () => {
    const id = await h.sembrar([{ id: 'c1', nombre: 'Silla', producto_id: 7, producto_version_id: 70, cantidad: 1, precioUnitario: 3000 }]);
    expect(await h.motivos(id)).toEqual([]);
    expect((await fallo(h.adjuntar(DIRECCION, id, 'c1', await h.reg())))?.message).toMatch(/partida canónica/);
  });

  // ---------------- P1-01 · frescura de la base de costo ----------------
  it('P1-01: cambia un parámetro del motor (config) ⇒ base_de_costo_cambio', async () => {
    const { id } = await h.legitima();
    await db.exec(`update public.config set datos = jsonb_set(datos, '{parametros,tarifaMO}', '110') where id = 'vonhaucke'`);
    try { expect((await h.evaluar(id)).reasons).toContain('linea_1_base_de_costo_cambio'); }
    finally { await db.exec(`update public.config set datos = jsonb_set(datos, '{parametros,tarifaMO}', '95') where id = 'vonhaucke'`); }
  });

  it('P1-01: cambia el formato de la hoja / la unidad del insumo usado (mismo precio_id e importe) ⇒ base_de_costo_cambio', async () => {
    for (const [cambio, regreso] of [
      [`atributos = '{"largo_mm": 2440, "ancho_mm": 1830}'::jsonb`, `atributos = '{"largo_mm": 2440, "ancho_mm": 1220}'::jsonb`],
      [`unidad_costeo = 'm2'`, `unidad_costeo = 'hoja'`],
    ]) {
      const { id } = await h.legitima();
      await db.exec(`update public.insumos_catalogo set ${cambio} where id = 'm16'`);
      try { expect((await h.evaluar(id)).reasons, cambio).toContain('linea_1_base_de_costo_cambio'); }
      finally { await db.exec(`update public.insumos_catalogo set ${regreso} where id = 'm16'`); }
    }
  });

  it('P1-01: un cambio en un insumo que el costeo NO usó no lo invalida', async () => {
    const { id } = await h.legitima();
    await db.exec(`insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion, familia)
                   values ('otro', 'Otro', 'herrajes', 'pza', true, 'curado', 'x') on conflict (id) do update set nombre = 'Otro cambiado'`);
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });

  it('P1-01: costeo sin huella de base ⇒ no emite; versión de motor distinta a la vigente ⇒ no emite', async () => {
    const { id } = await h.legitima({ base: false });
    expect((await h.evaluar(id)).reasons).toContain('linea_1_costeo_sin_huella_de_base');
    const { id: id2 } = await h.legitima({ motor: 'motor-1' });
    await h.politica(`version_motor_vigente = 'motor-2'`);
    try { expect((await h.evaluar(id2)).reasons).toContain('linea_1_costeo_de_otra_version_de_motor'); }
    finally { await h.politica("version_motor_vigente = 'motor-1'"); }
  });

  it("P1-01: política 'congelar_al_costear' (decisión de Dirección) acepta el costo del día aunque la base cambie; por omisión NO", async () => {
    expect((await db.query('select frescura from private_api.politica_emision_autoridad')).rows[0].frescura).toBe('exigir_vigente');
    const { id } = await h.legitima();
    await db.exec(`update public.config set datos = jsonb_set(datos, '{parametros,gif}', '0.5') where id = 'vonhaucke'`);
    await h.politica(`frescura = 'congelar_al_costear'`);
    try { expect((await h.evaluar(id)).state).toBe('ALLOWED'); }
    finally {
      await h.politica(`frescura = 'exigir_vigente'`);
      await db.exec(`update public.config set datos = jsonb_set(datos, '{parametros,gif}', '0.35') where id = 'vonhaucke'`);
    }
  });

  // ---------------- P2-02 · acceso ----------------
  it('P2-02: otro vendedor no consulta los motivos de una cotización ajena; el dueño y Dirección sí', async () => {
    const { id } = await h.legitima();
    expect((await fallo(h.motivos(id, VENDEDOR2)))?.message).toMatch(/sin acceso/);
    expect(await h.motivos(id, VENDEDOR)).toEqual([]);
    expect(await h.motivos(id, DIRECCION)).toEqual([]);
  });

  // ---------------- rev3 · P0-01 (v3) · identidad de origen ANTES del primer vínculo ----------------
  it('P0-01 v3: el costeo de un ESCRITORIO no puede vincularse por primera vez a una MESA (misma cantidad, sin vínculo previo)', async () => {
    const k = await h.reg();   // costeado como "Escritorio operativo melamina blanca"
    const mesa = { ...COSTEADO, nombre: 'Mesa de juntas 12 personas', medidas: '480x140x75', costeoId: k };
    const id = await h.sembrar([mesa]);
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k)))?.message).toMatch(/otro mueble/);
    expect((await db.query('select count(*)::int n from public.partida_costeo_vigente where costeo_id = $1', [k])).rows[0].n).toBe(0);
    expect((await h.evaluar(id)).reasons).toContain('linea_1_costeo_no_vinculado_a_esta_partida');
  });

  it('P0-01 v3: una partida que AÑADE material o medidas que no se declararon al costear tampoco se vincula; sin identidad, nada', async () => {
    const k = await h.reg({ identidad: { nombre: COSTEADO.nombre } });
    const id = await h.sembrar([{ ...COSTEADO, costeoId: k }]);   // la partida dice medidas y material; el costeo no
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k)))?.message).toMatch(/otro mueble/);
    const k2 = await h.reg({ identidad: null });
    const id2 = await h.sembrar([{ ...COSTEADO, costeoId: k2 }]);
    expect((await fallo(h.adjuntar(DIRECCION, id2, 'p1', k2)))?.message).toMatch(/no trae la identidad/);
  });

  it('P0-01 v3 sin falsos positivos: 120 = 120.0, espacios y null = ausente cuentan como la misma identidad', async () => {
    const k = await h.reg({ identidad: { nombre: '  Credenza  ', w: 120, d: 45 } });
    // rev5 (cambio intencional): toda partida especial lleva la especificación técnica de lo que se costeó.
    const id = await h.sembrar([{ id: 'p1', nombre: 'Credenza', w: 120.0, d: '45', h: null, medidas: '', cantidad: 1, precioUnitario: 10000, costeoId: k,
      especificacion_tecnica: COSTEADO.especificacion_tecnica }]);
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true });
  });

  // ---------------- rev3 · P0-02 (v3) · recostear la misma partida ----------------
  it('P0-02 v3: K1 queda viejo (cambia la base) → K2 nuevo SÍ se vincula a la misma partida; K1 queda reemplazado y no revive', async () => {
    const { id, k: k1 } = await h.legitima();
    await db.exec(`update public.config set datos = jsonb_set(datos, '{parametros,tarifaMO}', '120') where id = 'vonhaucke'`);
    try {
      expect((await h.evaluar(id)).reasons).toContain('linea_1_base_de_costo_cambio');
      const k2 = await h.reg({ costo: 6400 });   // recosteo con la base nueva
      expect(await h.adjuntar(DIRECCION, id, 'p1', k2)).toMatchObject({ ok: true });
      expect(await h.fila(id)).toMatchObject({ costeoId: k2, costoUnitario: 6400 });
      expect((await h.evaluar(id)).state).toBe('ALLOWED');
      expect((await db.query('select reemplazado_por from public.costeos_servidor where id = $1', [k1])).rows[0].reemplazado_por).toBe(k2);
      expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k1)))?.message).toMatch(/reemplazado/);
      const otra = await h.sembrar([{ ...COSTEADO, costeoId: k1 }]);
      expect((await fallo(h.adjuntar(DIRECCION, otra, 'p1', k1)))?.message).toMatch(/ya vinculado a otra partida/);
    } finally { await db.exec(`update public.config set datos = jsonb_set(datos, '{parametros,tarifaMO}', '95') where id = 'vonhaucke'`); }
  });

  it('P0-02 v3: cambió el mueble → se recostea con la identidad nueva y el costeo nuevo se vincula a la misma partida', async () => {
    const { id } = await h.legitima();
    await h.guardarP1(id, { nombre: 'Escritorio ejecutivo 180', medidas: '180x80x75' });
    expect((await h.evaluar(id)).reasons).toContain('linea_1_partida_cambio_desde_el_costeo');
    const k2 = await h.reg({ costo: 8100, identidad: { ...IDENTIDAD, nombre: 'Escritorio ejecutivo 180', medidas: '180x80x75' },
      promesa: { ...COSTEADO, nombre: 'Escritorio ejecutivo 180', medidas: '180x80x75' } });
    expect(await h.adjuntar(DIRECCION, id, 'p1', k2)).toMatchObject({ ok: true });
    expect((await h.evaluar(id, await h.snap(id, { precioUnitario: 13000 }))).state).toBe('ALLOWED');
  });

  // ---------------- rev3 · P1-01 (v3) · traspaso Diseño → Dirección ----------------
  it('P1-01 v3: Diseño costea y vincula; Dirección guarda después y el re-vínculo es idempotente (no "otra persona")', async () => {
    const k = await h.reg({ por: DISENO, rol: 'diseno' });
    const id = await h.sembrar([{ ...COSTEADO, costeoId: k }]);
    await h.adjuntar(DISENO, id, 'p1', k);
    const v = await h.version(id);
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true, idempotente: true, actualizado: v });
    expect(await h.version(id)).toBe(v);   // idempotente: no escribe ni sube la versión
    // …pero un costeo NUEVO de Diseño no lo puede vincular Dirección (robo de costeoId).
    const k2 = await h.reg({ por: DISENO, rol: 'diseno' });
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k2)))?.message).toMatch(/otra persona/);
  });

  // ---------------- rev3 · P1-05 (v3) · activación estricta ----------------
  it('P1-05 v3: no existe modo estricto sin versión de motor (CHECK); la RPC sólo la usa Dirección humana y exige versión', async () => {
    expect((await fallo(db.exec(`update private_api.politica_emision_autoridad set version_motor_vigente = null`)))?.message).toMatch(/estricto_exige_version_motor/);
    await db.exec(`insert into public.permitidos(email, rol) values ('qa-direccion@vonhaucke.mx', 'direccion') on conflict (email) do nothing`);
    const activar = (email, m, f, v) => uno(db, email, 'select public.activar_autoridad_costeo($1, $2, $3) as r', [m, f, v]);
    expect((await fallo(activar('qa-direccion@vonhaucke.mx', 'estricto', 'exigir_vigente', 'motor-1')))?.message).toMatch(/no autorizado/);
    expect((await fallo(activar(VENDEDOR, 'estricto', 'exigir_vigente', 'motor-1')))?.message).toMatch(/no autorizado/);
    expect((await fallo(activar(DISENO, 'estricto', 'exigir_vigente', 'motor-1')))?.message).toMatch(/no autorizado/);
    expect((await fallo(activar(DIRECCION, 'estricto', 'exigir_vigente', '  ')))?.message).toMatch(/exige la versión de motor/);
    expect((await activar(DIRECCION, 'estricto', 'exigir_vigente', 'motor-1')).r)
      .toEqual({ modo: 'estricto', frescura: 'exigir_vigente', version_motor_vigente: 'motor-1', decidido_por: DIRECCION });
    for (const r of ['anon', 'authenticated']) for (const pr of ['select', 'update']) {
      expect((await db.query(`select has_table_privilege($1, 'private_api.politica_emision_autoridad', $2) as ok`, [r, pr])).rows[0].ok).toBe(false);
    }
  });

  it('rollback (líneas -- RB): el wrapper vuelve BYTE A BYTE al de producción y las funciones nuevas desaparecen', async () => {
    const rb = leer(SEG01C).split('\n').filter((l) => l.startsWith('-- RB ')).map((l) => l.slice(6)).join('\n');
    await db.exec(rb);
    try {
      expect(await md5Def(db, 'public.evaluar_emision_cotizacion(bigint, jsonb)')).toBe(MD5_WRAPPER_PROD);
      for (const f of ['public.adjuntar_costeo_a_partida(bigint, text, uuid, timestamptz)', 'private_api.huella_partida(jsonb)', 'public.huella_base_costo(text[])', 'public.activar_autoridad_costeo(text, text, text)', 'private_api.identidad_partida(jsonb)',
        'private_api.promesa_partida(jsonb)', 'private_api.huella_promesa(jsonb)', 'private_api.costeo_promesa_servidor()',
        'private_api.spec_tecnica(jsonb)', 'private_api.huella_spec_tecnica(jsonb)', 'private_api.spec_numero_ok(jsonb)', 'private_api.costeo_spec_servidor()']) {
        expect((await db.query('select to_regprocedure($1) is null as no', [f])).rows[0].no, f).toBe(true);
      }
    } finally { await db.exec(leer(SEG01C)); await h.politica(ESTRICTO); }
  });
});

// ============================================================================
//  rev4 · PROMESA COMERCIAL v1 (cierre pre-deploy 14-oct). El K de un mueble no se vincula por primera vez a otro con el
//  mismo nombre, medidas y cantidad pero distinto material, acabado, accesorio, electrificación, exclusiones o
//  configuración. La promesa de origen la sella el servidor al costear; adjuntar nunca la aprende de la partida.
// ============================================================================
describe('SEG-01c rev 4 · promesa comercial v1 atada al costeo', () => {
  let db, h;
  // A: escritorio de melamina blanca, sin electrificar, cristal incluido.
  const A = { ...COSTEADO, config: { finish: 'blanco', electrico: false, largoLateralMM: null },
    pieza: { componentes: [{ id: 'c1', nombre: 'Cubierta', largo: 1200, ancho: 600, insumoId: 'm16' }, { id: 'c2', nombre: 'Cristal templado', insumoId: 'cr6' }] } };
  const conCristalExcluido = (p) => ({ ...p, pieza: { componentes: p.pieza.componentes.map((c) => (c.nombre === 'Cristal templado' ? { ...c, excluida: true } : c)) } });
  const vigentes = async (k) => Number((await db.query('select count(*)::int n from public.partida_costeo_vigente where costeo_id = $1', [k])).rows[0].n);
  beforeAll(async () => { db = await base(); h = ayudas(db); }, 180_000);
  afterAll(async () => { await db?.close(); });

  it('control: el K de A se vincula a A (misma promesa) y emite', async () => {
    const k = await h.reg({ promesa: A });
    const id = await h.sembrar([{ ...A, costeoId: k }]);
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true });
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });

  it('el servidor sella versión y huella; nadie las cambia después (ni service_role)', async () => {
    const k = await h.reg({ promesa: A });
    const r = (await db.query('select promesa_version, promesa_huella, promesa_origen, private_api.huella_promesa($2::jsonb) as esperada from public.costeos_servidor where id = $1',
      [k, JSON.stringify(A)])).rows[0];
    expect(r.promesa_version).toBe('v1');
    expect(r.promesa_huella).toBe(r.esperada);
    expect(r.promesa_origen).toEqual(promesaComercialDeCosteo(A));
    expect((await fallo(db.query(`update public.costeos_servidor set promesa_origen = '{"v":"v1","nombre":"Mesa"}'::jsonb where id = $1`, [k])))?.message).toMatch(/no se cambia/);
    expect((await fallo(db.query(`update public.costeos_servidor set promesa_huella = md5('x') where id = $1`, [k])))?.message).toMatch(/no se cambia/);
    expect((await fallo(h.reg({ promesa: A, version: 'v9' }).then(() => db.query(`insert into public.costeos_servidor (creado_por, rol, bom_hash, cantidad, costo_unitario, estado, promesa_origen, promesa_version)
      values ('${DIRECCION}', 'direccion', 'b', 1, 1, 'preliminar', '{"nombre":"x"}'::jsonb, 'v9')`))))?.message).toMatch(/promesa_version desconocida/);
  });

  it.each([
    ['material (insumo del despiece)', { pieza: { componentes: [{ id: 'c1', nombre: 'Cubierta', largo: 1200, ancho: 600, insumoId: 'm18' }, { id: 'c2', nombre: 'Cristal templado', insumoId: 'cr6' }] } }],
    ['acabado', { config: { finish: 'nogal', electrico: false } }],
    ['acabado (campo de texto)', { acabado: 'Nogal' }],
    ['accesorio', { config: { finish: 'blanco', electrico: false, cajonera: true } }],
    ['electrificación', { config: { finish: 'blanco', electrico: true } }],
    ['configuración (lateral)', { config: { finish: 'blanco', electrico: false, largoLateralMM: 1200 } }],
    ['nombresExcluidos', { nombresExcluidos: ['Faldón'] }],
    ['variante de catálogo', { catalogo: { clave: 'ESC-120-NOG' } }],
  ])('Q2: el K de A NO se vincula por primera vez a B con el mismo nombre, medidas y cantidad pero distinto %s', async (_n, cambio) => {
    const k = await h.reg({ promesa: A });
    const B = { ...A, ...cambio, costeoId: k };
    const id = await h.sembrar([B]);
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k)))?.message).toMatch(/promete otra cosa/);
    expect(await vigentes(k)).toBe(0);
    expect((await db.query('select cotizacion_id from public.costeos_servidor where id = $1', [k])).rows[0].cotizacion_id).toBeNull();
    expect((await h.evaluar(id)).reasons).toContain('linea_1_costeo_no_vinculado_a_esta_partida');
  });

  it('cristal: excluido ⇄ incluido falla en los DOS sentidos; cada uno con su propio K sí vincula', async () => {
    const Y = conCristalExcluido(A);
    const kX = await h.reg({ promesa: A }); const kY = await h.reg({ promesa: Y });
    const enY = await h.sembrar([{ ...Y, costeoId: kX }]);
    expect((await fallo(h.adjuntar(DIRECCION, enY, 'p1', kX)))?.message).toMatch(/promete otra cosa/);
    const enX = await h.sembrar([{ ...A, costeoId: kY }]);
    expect((await fallo(h.adjuntar(DIRECCION, enX, 'p1', kY)))?.message).toMatch(/promete otra cosa/);
    expect(await h.adjuntar(DIRECCION, enY, 'p1', kY)).toMatchObject({ ok: true });
    expect(await h.adjuntar(DIRECCION, enX, 'p1', kX)).toMatchObject({ ok: true });
  });

  it('nunca aprende la promesa en el primer vínculo: un K sin promesa de origen no se vincula', async () => {
    const k = await h.reg({ promesa: null });
    const id = await h.sembrar([{ ...COSTEADO, costeoId: k }]);
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k)))?.message).toMatch(/no trae la promesa comercial/);
    expect(await vigentes(k)).toBe(0);
  });

  it('K1→K2: K2 vincula con SU promesa de origen; K1 queda histórico (reemplazado) y sólo K2 está vigente', async () => {
    const k1 = await h.reg({ promesa: A });
    const id = await h.sembrar([{ ...A, costeoId: k1 }]);
    await h.adjuntar(DIRECCION, id, 'p1', k1);
    const k2 = await h.reg({ promesa: A, costo: 6200 });
    expect(await h.adjuntar(DIRECCION, id, 'p1', k2)).toMatchObject({ ok: true });
    expect((await db.query('select costeo_id from public.partida_costeo_vigente where cotizacion_id = $1', [id])).rows.map((r) => r.costeo_id)).toEqual([k2]);
    expect((await db.query('select reemplazado_por, cotizacion_id from public.costeos_servidor where id = $1', [k1])).rows[0]).toEqual({ reemplazado_por: k2, cotizacion_id: id });
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k1)))?.message).toMatch(/reemplazado/);
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });

  it('K2 no lava un cambio hecho DESPUÉS de nacer K2; un K3 costeado con la promesa nueva sí', async () => {
    const k1 = await h.reg({ promesa: A });
    const id = await h.sembrar([{ ...A, costeoId: k1 }]);
    await h.adjuntar(DIRECCION, id, 'p1', k1);
    const k2 = await h.reg({ promesa: A });                                  // K2 nace con la promesa de A…
    await h.guardarP1(id, { config: { finish: 'nogal', electrico: true } });  // …y DESPUÉS la partida cambia
    expect((await h.evaluar(id)).reasons).toContain('linea_1_partida_cambio_desde_el_costeo');
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k2)))?.message).toMatch(/promete otra cosa/);
    expect(await vigentes(k2)).toBe(0);
    const k3 = await h.reg({ promesa: { ...A, config: { finish: 'nogal', electrico: true } }, costo: 7100 });
    expect(await h.adjuntar(DIRECCION, id, 'p1', k3)).toMatchObject({ ok: true });
    expect((await h.evaluar(id, await h.snap(id, { precioUnitario: 11000 }))).state).toBe('ALLOWED');
  });

  it('campos visuales (render, imagen, acomodo, instancia) no fuerzan recosteo: vínculo idempotente y sigue ALLOWED', async () => {
    const k = await h.reg({ promesa: A });
    const id = await h.sembrar([{ ...A, costeoId: k }]);
    await h.adjuntar(DIRECCION, id, 'p1', k);
    await h.guardarP1(id, { render: 'https://x/otro.png', zone_id: 'z7', instance_id: 'i7', anchor_instance_id: 'a7', functional_group_id: 'g7', anchor_role: 'centro' });
    expect(await h.motivos(id)).toEqual([]);
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true, idempotente: true });
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });

  it('rama idempotente: mismo K vigente + misma partida + misma promesa no exige al creador (Diseño costea, Dirección re-vincula)', async () => {
    const k = await h.reg({ promesa: A, por: DISENO, rol: 'diseno' });
    const id = await h.sembrar([{ ...A, costeoId: k }]);
    await h.adjuntar(DISENO, id, 'p1', k);
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true, idempotente: true });
  });

  it('emisión: si la promesa de la partida no es la del costeo vigente ⇒ no emite (defensa en la emisión, no sólo en adjuntar)', async () => {
    const k = await h.reg({ promesa: A });
    const id = await h.sembrar([{ ...A, costeoId: k }]);
    await h.adjuntar(DIRECCION, id, 'p1', k);
    // Simula un vínculo escrito por fuera de adjuntar con la huella de la partida pero otra promesa de origen.
    const kOtro = await h.reg({ promesa: { ...A, acabado: 'Nogal' } });
    await db.query(`update public.partida_costeo_vigente set costeo_id = $2 where cotizacion_id = $1`, [id, kOtro]);
    await db.query(`update public.cotizaciones set partidas = jsonb_set(partidas, '{0,costeoId}', to_jsonb($2::text)) where id = $1`, [id, kOtro]);
    await db.query(`update public.partida_costeo_vigente set partida_huella = private_api.huella_partida((select partidas->0 from public.cotizaciones where id = $1)) where cotizacion_id = $1`, [id]);
    expect(await h.motivos(id)).toContain('linea_1_promesa_distinta_al_costeo');
  });
});

// ============================================================================
//  ANTES · rev3 (96bab98): los mismos ataques de promesa PASABAN (Q2 = SÍ). Las pruebas de arriba fallan contra rev3.
// ============================================================================
describe('ANTES · SEG-01c revisión 3 (96bab98): el K de A se vinculaba a B con otro material/acabado/exclusiones', () => {
  let db, h;
  const A = { ...COSTEADO, config: { finish: 'blanco', electrico: false } };
  beforeAll(async () => {
    db = await base({ seg01c: 'supabase/tests/fixtures/seg01c_rev3_96bab98.sql' }); h = ayudas(db);
    const reg = h.reg;
    h.reg = async (o = {}) => reg({ ...o, promesa: null });   // rev3 no tenía promesa
    await db.exec(`alter table public.costeos_servidor add column if not exists promesa_origen jsonb;
      alter table public.costeos_servidor add column if not exists spec_tecnica_origen jsonb;
      alter table public.costeos_servidor add column if not exists spec_tecnica_version text`);
  }, 180_000);
  afterAll(async () => { await db?.close(); });

  it.each([
    ['material', { pieza: { componentes: [{ id: 'c1', nombre: 'Cubierta', largo: 1200, ancho: 600, insumoId: 'm18' }] } }],
    ['acabado', { config: { finish: 'nogal', electrico: false } }],
    ['electrificación', { config: { finish: 'blanco', electrico: true } }],
    ['cristal excluido', { nombresExcluidos: ['Cristal templado'] }],
  ])('defecto rev3: distinto %s ⇒ vinculaba y quedaba ALLOWED', async (_n, cambio) => {
    const k = await h.reg();
    const id = await h.sembrar([{ ...A, ...cambio, costeoId: k }]);
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true });
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });
});

// ============================================================================
//  rev5 (reauditoría final, P0): la PROMESA no distingue dos despieces técnicamente distintos con los mismos nombres e
//  insumos. La SPEC TÉCNICA v1 sí: el K sólo se vincula a una partida que describe EXACTAMENTE el despiece que costeó.
// ============================================================================
describe('SEG-01c rev 5 · spec técnica v1 atada al costeo', () => {
  let db, h;
  const pieza = (...componentes) => ({ componentes });
  const CUB = { nombre: 'Cubierta', insumoId: 'mdf18', cantidad: 1 };
  const ENT = (cantidad = 1, extra = {}) => ({ nombre: 'Entrepaño', insumoId: 'mdf18', cantidad, ...extra });
  const LAT = (largoMM) => ({ nombre: 'Lateral', insumoId: 'mdf18', cantidad: 2, largoMM, anchoMM: 400 });
  const PINT = (areaPintadaM2) => ({ nombre: 'Pintura', insumoId: 'pint-negro', areaPintadaM2, tubular: true });
  const A = pieza(CUB, ENT(1));
  const partida = (piezaTec, extra = {}) => ({ ...COSTEADO, especificacion_tecnica: specTecnicaDeCosteo(piezaTec), ...extra });
  const vigentes = async (k) => Number((await db.query('select count(*)::int n from public.partida_costeo_vigente where costeo_id = $1', [k])).rows[0].n);
  const consumido = async (k) => (await db.query('select cotizacion_id from public.costeos_servidor where id = $1', [k])).rows[0].cotizacion_id;
  beforeAll(async () => { db = await base(); h = ayudas(db); }, 180_000);
  afterAll(async () => { await db?.close(); });

  it('control: el K de A se vincula a la partida que describe A y emite', async () => {
    const k = await h.reg({ spec: A });
    const id = await h.sembrar([partida(A, { costeoId: k })]);
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true });
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });

  it('el servidor sella versión y huella de la spec (re-proyecta en SQL); nadie las cambia después', async () => {
    const k = await h.reg({ spec: pieza(ENT(1, { nombre: ' Entrepaño ', costoUnitario: 1, excluida: true }), CUB) });
    const r = (await db.query(`select spec_tecnica_version v, spec_tecnica_huella hh, spec_tecnica_origen o,
      private_api.huella_spec_tecnica($2::jsonb) as esperada from public.costeos_servidor where id = $1`, [k, JSON.stringify(A)])).rows[0];
    expect(r).toMatchObject({ v: 'v1', hh: r.esperada, o: specTecnicaDeCosteo(A) });
    expect((await fallo(db.query(`update public.costeos_servidor set spec_tecnica_origen = '{"v":"v1","componentes":[{"insumoId":"x"}]}'::jsonb where id = $1`, [k])))?.message).toMatch(/no se cambia/);
    expect((await fallo(db.query(`update public.costeos_servidor set spec_tecnica_huella = md5('x') where id = $1`, [k])))?.message).toMatch(/no se cambia/);
    expect((await fallo(h.reg({ spec: A, specVersion: 'v9' })))?.message).toMatch(/spec_tecnica_version desconocida/);
    // Fuera de contrato ⇒ el servidor no sella spec (y ese K no vinculará).
    const kFuera = await h.reg({ spec: pieza({ ...CUB, cantidad: Number.MAX_SAFE_INTEGER + 1 }) });
    expect((await db.query('select spec_tecnica_huella from public.costeos_servidor where id = $1', [kFuera])).rows[0].spec_tecnica_huella).toBeNull();
  });

  it.each([
    ['multiplicidad: 1 × Entrepaño MDF18 → 3 × Entrepaño MDF18', A, pieza(CUB, ENT(3))],
    ['dimensión interna: Lateral MDF18 700 × 400 → 900 × 400', pieza(CUB, LAT(700)), pieza(CUB, LAT(900))],
    ['horas: ensamble 1 h → 4 h (mismo BOM de materiales)', { ...A, horas: { ensamble: 1 } }, { ...A, horas: { ensamble: 4 } }],
    ['pintura: mismo insumo, 1.5 m² → 2.25 m²', pieza(CUB, PINT(1.5)), pieza(CUB, PINT(2.25))],
    ['dificultad: normal → difícil', { ...A, dificultad: 'normal' }, { ...A, dificultad: 'dificil' }],
    ['duplicados: dos renglones cantidad 1 → un renglón cantidad 2 (no se fusionan)', pieza(CUB, ENT(1), ENT(1)), pieza(CUB, ENT(2))],
  ])('P0: el K NO se vincula por primera vez a una partida con la MISMA promesa pero otro despiece — %s', async (_n, costeado, otra) => {
    const k = await h.reg({ spec: costeado });
    const id = await h.sembrar([partida(otra, { costeoId: k })]);
    // La promesa es idéntica (mismo nombre, medidas, material, cantidad): lo que la distingue es la spec.
    expect((await db.query('select private_api.huella_promesa($1::jsonb) = promesa_huella as igual from public.costeos_servidor where id = $2',
      [JSON.stringify(partida(otra)), k])).rows[0].igual).toBe(true);
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k)))?.message).toMatch(/describe otro despiece/);
    expect(await vigentes(k)).toBe(0);
    expect(await consumido(k)).toBeNull();
    expect((await h.evaluar(id)).reasons).toContain('linea_1_costeo_no_vinculado_a_esta_partida');
    // …y cada despiece con SU propio K sí vincula.
    const kOtra = await h.reg({ spec: otra });
    const id2 = await h.sembrar([partida(otra, { costeoId: kOtra })]);
    expect(await h.adjuntar(DIRECCION, id2, 'p1', kOtra)).toMatchObject({ ok: true });
  });

  it('el ORDEN de los renglones no cuenta: la misma spec reordenada vincula', async () => {
    const k = await h.reg({ spec: pieza(CUB, ENT(1), LAT(700)) });
    const id = await h.sembrar([partida(pieza(LAT(700), ENT(1), CUB), { costeoId: k })]);
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true });
  });

  it('K sin spec de origen, partida sin especificación o con especificación fuera de contrato ⇒ no hay vínculo', async () => {
    const k0 = await h.reg({ spec: null });
    const id0 = await h.sembrar([partida(A, { costeoId: k0 })]);
    expect((await fallo(h.adjuntar(DIRECCION, id0, 'p1', k0)))?.message).toMatch(/no trae la especificación técnica v1/);
    const k = await h.reg({ spec: A });
    const sin = await h.sembrar([{ ...COSTEADO, especificacion_tecnica: undefined, costeoId: k }]);
    expect((await fallo(h.adjuntar(DIRECCION, sin, 'p1', k)))?.message).toMatch(/no trae su especificación técnica/);
    const fuera = await h.sembrar([{ ...COSTEADO, costeoId: k, especificacion_tecnica: { v: 'v1', componentes: [{ ...CUB, cantidad: '1' }, ENT(1)] } }]);
    expect((await fallo(h.adjuntar(DIRECCION, fuera, 'p1', k)))?.message).toMatch(/no trae su especificación técnica/);
    expect(await vigentes(k)).toBe(0);
  });

  it('K1→K2: cambia el despiece, K1 deja de valer, K2 (costeado con el despiece nuevo) vincula; K1 histórico, sólo K2 vigente', async () => {
    const k1 = await h.reg({ spec: A });
    const id = await h.sembrar([partida(A, { costeoId: k1 })]);
    await h.adjuntar(DIRECCION, id, 'p1', k1);
    const B = pieza(CUB, ENT(3));
    await h.guardarP1(id, { especificacion_tecnica: specTecnicaDeCosteo(B) });
    expect((await h.evaluar(id)).reasons).toContain('linea_1_partida_cambio_desde_el_costeo');
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k1)))?.message).toMatch(/cambió desde que se vinculó/);
    const k2 = await h.reg({ spec: B, costo: 7400 });
    expect(await h.adjuntar(DIRECCION, id, 'p1', k2)).toMatchObject({ ok: true });
    expect((await db.query('select costeo_id from public.partida_costeo_vigente where cotizacion_id = $1', [id])).rows.map((r) => r.costeo_id)).toEqual([k2]);
    expect((await db.query('select reemplazado_por from public.costeos_servidor where id = $1', [k1])).rows[0].reemplazado_por).toBe(k2);
    expect((await h.evaluar(id, await h.snap(id, { precioUnitario: 11500 }))).state).toBe('ALLOWED');
  });

  it('K2 no lava un cambio de despiece hecho DESPUÉS de nacer K2', async () => {
    const k1 = await h.reg({ spec: A });
    const id = await h.sembrar([partida(A, { costeoId: k1 })]);
    await h.adjuntar(DIRECCION, id, 'p1', k1);
    const k2 = await h.reg({ spec: pieza(CUB, ENT(3)) });                                   // K2 nace con 3 entrepaños…
    await h.guardarP1(id, { especificacion_tecnica: specTecnicaDeCosteo(pieza(CUB, ENT(4))) });  // …y DESPUÉS la partida pasa a 4
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k2)))?.message).toMatch(/describe otro despiece/);
    expect(await vigentes(k2)).toBe(0);
  });

  it('rama idempotente: mismo K vigente + misma partida + misma spec no exige al creador (Diseño costea, Dirección re-vincula)', async () => {
    const k = await h.reg({ spec: A, por: DISENO, rol: 'diseno' });
    const id = await h.sembrar([partida(A, { costeoId: k })]);
    await h.adjuntar(DISENO, id, 'p1', k);
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true, idempotente: true });
  });

  it('emisión: si la spec de la partida no es la del costeo vigente ⇒ no emite (defensa en la emisión, no sólo en adjuntar)', async () => {
    const k = await h.reg({ spec: A });
    const id = await h.sembrar([partida(A, { costeoId: k })]);
    await h.adjuntar(DIRECCION, id, 'p1', k);
    // Vínculo escrito por fuera de adjuntar: la huella de la partida cuadra, pero el K vigente costeó otro despiece.
    const kOtro = await h.reg({ spec: pieza(CUB, ENT(3)) });
    await db.query(`update public.partida_costeo_vigente set costeo_id = $2 where cotizacion_id = $1`, [id, kOtro]);
    await db.query(`update public.cotizaciones set partidas = jsonb_set(partidas, '{0,costeoId}', to_jsonb($2::text)) where id = $1`, [id, kOtro]);
    await db.query(`update public.partida_costeo_vigente set partida_huella = private_api.huella_partida((select partidas->0 from public.cotizaciones where id = $1)) where cotizacion_id = $1`, [id]);
    expect(await h.motivos(id)).toContain('linea_1_spec_distinta_al_costeo');
  });
});

// ============================================================================
//  ANTES · rev4 (8cc0adb): los mismos ataques de despiece PASABAN (el P0 de la reauditoría final). Las pruebas de rev5
//  fallan contra rev4.
// ============================================================================
describe('ANTES · SEG-01c revisión 4 (8cc0adb): el K de A se vinculaba a B con la misma promesa y otro despiece', () => {
  let db, h;
  const pieza = (...componentes) => ({ componentes });
  const CUB = { nombre: 'Cubierta', insumoId: 'mdf18', cantidad: 1 };
  beforeAll(async () => {
    db = await base({ seg01c: 'supabase/tests/fixtures/seg01c_rev4_8cc0adb.sql' }); h = ayudas(db);
    await db.exec(`alter table public.costeos_servidor add column if not exists spec_tecnica_origen jsonb;
      alter table public.costeos_servidor add column if not exists spec_tecnica_version text`);
  }, 180_000);
  afterAll(async () => { await db?.close(); });

  it.each([
    ['multiplicidad (1 → 3 entrepaños)', pieza(CUB, { nombre: 'Entrepaño', insumoId: 'mdf18', cantidad: 1 }), pieza(CUB, { nombre: 'Entrepaño', insumoId: 'mdf18', cantidad: 3 })],
    ['dimensión interna (700 → 900)', pieza(CUB, { nombre: 'Lateral', insumoId: 'mdf18', cantidad: 2, largoMM: 700, anchoMM: 400 }), pieza(CUB, { nombre: 'Lateral', insumoId: 'mdf18', cantidad: 2, largoMM: 900, anchoMM: 400 })],
    ['horas (1 → 4)', { ...pieza(CUB), horas: { ensamble: 1 } }, { ...pieza(CUB), horas: { ensamble: 4 } }],
  ])('defecto rev4: %s ⇒ vinculaba y quedaba ALLOWED', async (_n, costeado, otra) => {
    const k = await h.reg({ spec: costeado });
    const id = await h.sembrar([{ ...COSTEADO, especificacion_tecnica: specTecnicaDeCosteo(otra), costeoId: k }]);
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true });
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });
});

describe('SEG-01c rev 2 · dependencias', () => {
  it('sin VH-148b (actualizado no sube) SEG-01c NO se aplica: el CAS del vínculo no detectaría nada', async () => {
    const e = await fallo(base({ conVh148b: false }));
    expect(e?.message).toMatch(/requiere VH-148b/);
  }, 180_000);

  it('sin P1-03b (la vista no expone precio_id) el modo estricto falla cerrado: catalogo_sin_precio_id', async () => {
    const db = await base({ conP103b: false }); const h = ayudas(db);
    try {
      const { id } = await h.legitima();
      expect((await h.evaluar(id)).reasons).toContain('linea_1_catalogo_sin_precio_id');
    } finally { await db.close(); }
  }, 180_000);
});


// ============================================================================
//  CLIENTE REAL (src/datos/cotizaciones.js · vincularCosteos) contra el SQL real, como sesión authenticated.
// ============================================================================
describe('SEG-01c rev 2 · el cliente encadena la versión en los vínculos (P0-02) y reporta lo que no vinculó (P1-03)', () => {
  let db, h, vincularCosteos, marcar;
  beforeAll(async () => {
    db = await base(); h = ayudas(db);
    ({ vincularCosteos } = await import('../../src/datos/cotizaciones.js'));
    marcar = await import('../../src/datos/vinculoCosteo.js');
  }, 180_000);
  afterAll(async () => { await db?.close(); });

  it('dos renglones: el segundo vínculo usa la versión que devolvió el primero; la versión final es la de la fila', async () => {
    const ka = await h.reg(); const kb = await h.reg();
    const partidas = [{ ...COSTEADO, id: 'a', costeoId: ka }, { ...COSTEADO, id: 'b', costeoId: kb }];
    const id = await h.sembrar(partidas);
    const r = await vincularCosteos(id, partidas, await h.version(id), clientePglite(db, { email: DIRECCION }));
    expect(r.fallidos).toEqual([]);
    expect(r.actualizado).toBe(await h.version(id));
    expect(await h.motivos(id)).toEqual([]);
  });

  it('otra pestaña escribió después del guardado ⇒ PT409, la cadena se detiene, NADA queda vinculado y el aviso lo dice', async () => {
    const ka = await h.reg(); const kb = await h.reg();
    const partidas = [{ ...COSTEADO, id: 'a', costeoId: ka }, { ...COSTEADO, id: 'b', costeoId: kb }];
    const id = await h.sembrar(partidas);
    const deMiGuardado = await h.version(id);
    await h.guardarP1(id, { nombre: 'otra pestaña' });   // cambia otra cosa (p1 no existe aquí): sube la versión
    const r = await vincularCosteos(id, partidas, deMiGuardado, clientePglite(db, { email: DIRECCION }));
    expect(r.fallidos.map((f) => [f.partidaId, !!f.conflicto])).toEqual([['a', true], ['b', true]]);
    expect(marcar.avisoVinculosFallidos(r.fallidos)).toMatch(/alguien más cambió/);
    expect((await db.query('select count(*)::int n from public.costeos_servidor where id = any($1::uuid[]) and cotizacion_id is not null', [[ka, kb]])).rows[0].n).toBe(0);
    // El siguiente guardado (con la versión fresca) los vincula: no se marcaron como hechos.
    const r2 = await vincularCosteos(id, partidas, await h.version(id), clientePglite(db, { email: DIRECCION }));
    expect(r2.fallidos).toEqual([]);
  });
});

// ============================================================================
//  Q3 · PIPELINE REAL (reauditoría final, P1): Costear → intentDesdePieza → validarIntentCosteo → [Edge: misma
//  frontera + catalogo_motor real + reconciliación de material del servidor + motor + filaCosteoServidor] →
//  partidaAutoritativaDeCosteo → guardar (sesión de Dirección) → vincularCosteos (cliente real) → adjuntar (SQL real).
//  NADA se inyecta a mano: promesa y spec salen del costeo por las mismas funciones que usa Rodrigo. Lo único que no es
//  el código de producción es el transporte HTTP de la Edge (el objeto que se inserta lo arma la MISMA función).
// ============================================================================
describe('Q3 · pipeline real: lo que pasa la prueba es lo que pasa el usuario', () => {
  let db, h, vincularCosteos, pipe;
  const conf = (c) => ({ ...c, material_confirmado: true });
  const A = { nombre: 'Credenza', w: 1800, d: 450, piezas: 1, componentes: [
    conf({ nombre: 'Cubierta', insumoId: 'mdf18', cantidad: 1, largoMM: 1800, anchoMM: 450 }),
    conf({ nombre: 'Entrepaño', insumoId: 'mdf18', cantidad: 1, largoMM: 1760, anchoMM: 420 }) ] };
  const conEntrepano = (cambio) => ({ ...A, componentes: [A.componentes[0], { ...A.componentes[1], ...cambio }] });
  const vigentes = async (k) => Number((await db.query('select count(*)::int n from public.partida_costeo_vigente where costeo_id = $1', [k])).rows[0].n);

  beforeAll(async () => {
    db = await base(); h = ayudas(db);
    ({ vincularCosteos } = await import('../../src/datos/cotizaciones.js'));
    const { validarIntentCosteo, intentDesdePieza } = await import('../../src/datos/validarIntentCosteo.js');
    const { partidaAutoritativaDeCosteo } = await import('../../src/datos/agregarCosteo.js');
    const { filaCosteoServidor } = await import('../../src/datos/registroCosteo.js');
    const { reconciliarMaterialServidor } = await import('../../src/datos/materialMatch.js');
    const { calcular, modeloParaPieza, bomHash, PARAMETROS_DEFAULT } = await import('../../src/motor/calculo.js');
    const { dinero } = await import('../../src/motor/dinero.js');
    // MDF 18 por m² (blanco y nogal), cada uno con su precio aprobado por una persona de Dirección.
    await db.exec(`insert into public.insumos_catalogo (id, nombre, seccion, unidad_costeo, activo, clasificacion, familia, atributos) values
        ('mdf18', 'MDF 18 mm blanco', 'tableros', 'm2', true, 'curado', 'mdf', '{}'::jsonb),
        ('mdf18n', 'MDF 18 mm nogal', 'tableros', 'm2', true, 'curado', 'mdf', '{}'::jsonb);
      insert into public.insumo_precios (id, insumo_id, precio, estado, confidence, vigente_desde, approved_by, approved_at,
        unidad_compra, precio_compra, factor_conversion, evidence_status, requiere_validacion_compras) overriding system value values
        (902, 'mdf18', 450, 'aprobado', 'alta', '2026-10-01', '${DIRECCION}', now(), 'm2', 450, 1, 'documentada', false),
        (903, 'mdf18n', 520, 'aprobado', 'alta', '2026-10-01', '${DIRECCION}', now(), 'm2', 520, 1, 'documentada', false);`);
    const PRECIOS = { mdf18: { precio_id: 902, precio_usado: 450 }, mdf18n: { precio_id: 903, precio_usado: 520 } };
    const cfg = (await db.query(`select datos from public.config where id = 'vonhaucke'`)).rows[0].datos;
    const parametros = { ...PARAMETROS_DEFAULT, ...(cfg.parametros || {}) };
    const insumosDe = async (ids) => (await db.query('select private_api.catalogo_motor(false, $1::text[]) as m', [ids])).rows[0].m;   // núcleo de la envoltura pública que llama la Edge
    const COLS = { precios: 'jsonb', warnings: 'jsonb', insumos_usados: 'text[]', identidad_origen: 'jsonb', componentes_costeados: 'jsonb', promesa_origen: 'jsonb', spec_tecnica_origen: 'jsonb' };
    // nube.costearServidor + Edge costear-servidor-rc, sin el transporte HTTP.
    const costearServidor = async (costeo, n) => {
      const v = validarIntentCosteo(intentDesdePieza(costeo, n));                 // nube.js: lo que sale del navegador
      if (!v.ok) return { ok: false, error: v.code };
      const e = validarIntentCosteo(v.intent);                                    // Edge: la misma frontera
      if (!e.ok) return { ok: false, error: e.code };
      const ids = [...new Set(e.intent.pieza.componentes.map((c) => c.insumoId).filter(Boolean))];
      const insumos = await insumosDe(ids);
      const piezaRec = { ...e.intent.pieza, componentes: e.intent.pieza.componentes.map((c) => reconciliarMaterialServidor(c, (id) => insumos[id], Object.values(insumos),
        { puedeConfirmar: true, origenLegacyConfiable: false, origenSpecConfiable: false })) };
      const r = calcular(piezaRec, n, insumos, modeloParaPieza(parametros, piezaRec).par);
      const fila = filaCosteoServidor({ intent: e.intent, n, email: DIRECCION, rol: 'direccion', bomHash: bomHash(piezaRec.componentes),
        costoUnitario: dinero(r.costoUnitario), estado: 'certificado', aprobacionHumana: true, meta: { versionMotor: 'motor-1', fuenteCosto: 'catalogo' },
        precios: ids.map((id) => ({ insumo_id: id, ...PRECIOS[id], approved_by: DIRECCION, humana: true })), warnings: [], insumosUsados: ids,
        baseCostoHuella: (await db.query('select private_api.huella_base_costo($1::text[]) as hh', [ids])).rows[0].hh });
      const cols = Object.keys(fila);
      const id = (await db.query(`insert into public.costeos_servidor (${cols.join(', ')}) values (${cols.map((c, i) => `$${i + 1}${COLS[c] ? '::' + COLS[c] : ''}`).join(', ')}) returning id`,
        cols.map((c) => (COLS[c] === 'jsonb' ? (fila[c] == null ? null : JSON.stringify(fila[c])) : fila[c])))).rows[0].id;
      return { ok: true, estado: 'certificado', costo: { costoUnitario: fila.costo_unitario }, costeoId: id, bomHash: fila.bom_hash, versionMotor: 'motor-1' };
    };
    // Costear (App.jsx onAgregarCotizacion): el resultado del cliente es el motor sobre el MISMO costeo.
    pipe = async (costeo) => {
      const ids = [...new Set(costeo.componentes.map((c) => c.insumoId).filter(Boolean))];
      const insumos = await insumosDe(ids);
      const resultado = calcular(costeo, costeo.piezas, insumos, modeloParaPieza(parametros, costeo).par);
      const r = await partidaAutoritativaDeCosteo({ costeo, resultado, precio: 12000, margen: 40, costearServidor,
        pendientes: () => [], nuevoId: () => 'p1' });
      return r;
    };
  }, 180_000);
  afterAll(async () => { await db?.close(); });

  const guardarYVincular = async (partida) => {
    const id = await h.sembrar([partida]);
    const r = await vincularCosteos(id, [partida], await h.version(id), clientePglite(db, { email: DIRECCION }));
    return { id, r };
  };

  it('control: Costear A → partida A → guardar → vincular con su K ⇒ vinculado, promesa y spec de la partida = las del K, ALLOWED', async () => {
    const a = await pipe(A);
    expect(a.ok).toBe(true);
    const { id, r } = await guardarYVincular(a.partida);
    expect(r.fallidos).toEqual([]);
    const k = (await db.query(`select promesa_huella = private_api.huella_promesa($2::jsonb) as p, spec_tecnica_huella = private_api.huella_spec_tecnica($3::jsonb) as s
      from public.costeos_servidor where id = $1`, [a.partida.costeoId, JSON.stringify(a.partida), JSON.stringify(a.partida.especificacion_tecnica)])).rows[0];
    expect(k).toEqual({ p: true, s: true });
    expect((await h.evaluar(id, await h.snap(id, { precioUnitario: 12000 }))).state).toBe('ALLOWED');
  });

  it.each([
    ['configuración distinta (se agrega una cajonera al despiece)', { ...A, componentes: [...A.componentes, conf({ nombre: 'Cajonera', insumoId: 'mdf18', cantidad: 1, largoMM: 500, anchoMM: 400 })] }, /promete otra cosa/],
    ['acabado distinto (MDF blanco → nogal)', { ...A, componentes: A.componentes.map((c) => ({ ...c, insumoId: 'mdf18n' })) }, /promete otra cosa/],
    ['multiplicidad distinta (1 → 3 entrepaños; misma promesa)', conEntrepano({ cantidad: 3 }), /describe otro despiece/],
    ['dimensión interna distinta (entrepaño 1760 → 1500; misma promesa)', conEntrepano({ largoMM: 1500 }), /describe otro despiece/],
  ])('Q2 por el pipeline real: el K de A NO se vincula a la partida de B — %s', async (_n, B, motivo) => {
    const a = await pipe(A); const b = await pipe(B);
    expect(a.ok && b.ok).toBe(true);
    // El usuario real: cada partida con SU costeo se vincula.
    expect((await guardarYVincular(b.partida)).r.fallidos).toEqual([]);
    // Ataque: la partida de B (tal cual la armó Costear) con el costeoId de A.
    const { id, r } = await guardarYVincular({ ...b.partida, costeoId: a.partida.costeoId });
    expect(r.fallidos).toHaveLength(1);
    expect(r.fallidos[0].error).toMatch(motivo);
    expect(await vigentes(a.partida.costeoId)).toBe(0);
    expect((await h.evaluar(id, await h.snap(id, { precioUnitario: 12000 }))).reasons).toContain('linea_1_costeo_no_vinculado_a_esta_partida');
  });

  it('Q2 por el pipeline real: nombresExcluidos distintos — la partida de A editada para excluir el entrepaño NO acepta el K de A', async () => {
    const a = await pipe(A);
    const { id, r } = await guardarYVincular({ ...a.partida, nombresExcluidos: ['Entrepaño'] });
    expect(r.fallidos[0]?.error).toMatch(/promete otra cosa/);
    expect(await vigentes(a.partida.costeoId)).toBe(0);
    expect(id).toBeTruthy();
  });

  it('observación (fuera de alcance): Costear NO puede agregar un especial con una pieza excluida — el validador descarta `excluida` y el servidor la costea; la paridad falla cerrada', async () => {
    const r = await pipe({ ...A, componentes: [A.componentes[0], { ...A.componentes[1], excluida: true }] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/difieren/);
  });
});

// ============================================================================
//  ANTES: la revisión 1 (4ed8ac6) contra los mismos ataques. Documenta el defecto: cada caso PASABA (se emitía).
// ============================================================================
describe('ANTES · SEG-01c revisión 1 (4ed8ac6): los ataques de la reauditoría v2 pasaban', () => {
  let db, h;
  beforeAll(async () => {
    db = await base({ seg01c: SEG01C_REV1 }); h = ayudas(db);
    // La revisión 1 tenía la firma de 3 argumentos (sin CAS) y no guardaba huellas.
    h.adjuntar = async (email, cot, partida, costeo) => (await uno(db, email,
      'select public.adjuntar_costeo_a_partida($1, $2, $3::uuid) as r', [cot, partida, costeo])).r;
    h.reg = async (o = {}) => (await db.query(
      `insert into public.costeos_servidor (creado_por, rol, bom_hash, cantidad, costo_unitario, estado, aprobacion_humana, precios)
       values ($1,'direccion','bom-escritorio',1,6000,'certificado',true,$2::jsonb) returning id`, [DIRECCION, JSON.stringify(TRAZA)])).rows[0].id;
  }, 180_000);
  afterAll(async () => { await db?.close(); });

  it('P0-01 (defecto): renombrar/redimensionar la partida tras vincular ⇒ ALLOWED (el costo del escritorio se emitía para la mesa)', async () => {
    const { id } = await h.legitima();
    await h.guardarP1(id, { nombre: 'Mesa de juntas 12 personas', medidas: '480x140x75' });
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });

  it('P0-02 (defecto): el vínculo no pedía versión: se vinculaba sobre la partida que otra pestaña cambió', async () => {
    const k = await h.reg();
    const id = await h.sembrar([{ ...COSTEADO, costeoId: k }]);
    await h.guardarP1(id, { nombre: 'Mesa de juntas 12 personas' });
    expect(await h.adjuntar(DIRECCION, id, 'p1', k)).toMatchObject({ ok: true });
  });

  it('HUECO (defecto): especial con productoId de texto y costo inventado, sin costeo ⇒ sin motivos de autoridad', async () => {
    const id = await h.sembrar([{ ...COSTEADO, productoId: 'LIBRERO', costoUnitario: 50, costoEstado: 'certificado' }]);
    expect(await h.motivos(id)).toEqual([]);
  });

  it('P1-01 (defecto): cambiar parámetros del motor no invalidaba el costeo', async () => {
    const { id } = await h.legitima();
    await db.exec(`update public.config set datos = jsonb_set(datos, '{parametros,tarifaMO}', '110') where id = 'vonhaucke'`);
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });
});

// ============================================================================
//  ANTES: la revisión 2 (d5b45d6, la que auditó la reauditoría v3) contra sus dos P0. Cada caso documenta el defecto.
// ============================================================================
describe('ANTES · SEG-01c revisión 2 (d5b45d6): los dos P0 de la reauditoría v3 estaban presentes', () => {
  let db, h;
  beforeAll(async () => {
    db = await base({ seg01c: SEG01C_REV2 }); h = ayudas(db);
    h.reg = async (o = {}) => (await db.query(
      `insert into public.costeos_servidor (creado_por, rol, bom_hash, cantidad, costo_unitario, estado, aprobacion_humana, precios, insumos_usados, base_costo_huella, version_motor)
       values ($1,'direccion','bom-escritorio',1,$2,'certificado',true,$3::jsonb,'{m16}', private_api.huella_base_costo('{m16}'), 'motor-1') returning id`,
      [DIRECCION, o.costo ?? 6000, JSON.stringify(TRAZA)])).rows[0].id;
  }, 180_000);
  afterAll(async () => { await db?.close(); });

  it('P0-01 v3 (defecto): el costeo de un escritorio se vinculaba por primera vez a una mesa y quedaba ALLOWED', async () => {
    const k = await h.reg();
    const id = await h.sembrar([{ ...COSTEADO, nombre: 'Mesa de juntas 12 personas', medidas: '480x140x75', costeoId: k }]);
    await h.adjuntar(DIRECCION, id, 'p1', k);
    expect((await h.evaluar(id)).state).toBe('ALLOWED');
  });

  it('P0-02 v3 (defecto): recostear la misma partida era imposible (índice único por partida)', async () => {
    const { id } = await h.legitima();
    const k2 = await h.reg({ costo: 6400 });
    expect((await fallo(h.adjuntar(DIRECCION, id, 'p1', k2)))?.message).toMatch(/costeos_servidor_una_partida|duplicate|único|unique/i);
  });
});
