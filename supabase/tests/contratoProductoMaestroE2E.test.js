// ============================================================================
//  E2E DE CONTRATO · Producto Maestro: navegador → backend → tabla → recosteo.
//  Prueba que el payload EXACTO que arma el componente GuardarProductoMaestro.jsx
//  es aceptado por la RPC de la migración propuesta (20261109_integridad), que la
//  fila guardada separa cos_fab_calculado de cos_fab_real, conserva las pendientes,
//  y que al reabrirla el motor real la recostea. PGlite (Postgres real), sin prod.
//
//  Es la verificación de compatibilidad de las 4 capas: si el cliente y la RPC no
//  casaran (un parámetro de más/menos o mal nombre), la llamada fallaría aquí.
// ============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { bomDesdeDespiece } from '../../src/datos/productoMaestroDesdeDespiece.js';
import { costearBOM } from '../../src/datos/productoMaestro.js';

const RAIZ = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const RPC_NUEVA = 'supabase/migrations/20261109_guardar_producto_maestro_integridad.sql';
const DIRECCION = 'rodrigo@vh.mx';

// Catálogo de prueba (fresco/certificable) y despiece del motor con cantidad física real.
const insumos = {
  lam: { nombre: 'Lamina cal.18', seccion: 'metal', unidad: 'hoja', precio: 800, evidencia: { certificable: true } },
  pin: { nombre: 'Pintura en polvo', seccion: 'acabados', unidad: 'kg', precio: 150, evidencia: { certificable: true } },
};
const linea = (id, precio, fisica, campo = 'unidades') => ({ insumoId: id, precio, costo: +(precio * fisica).toFixed(6), [campo]: fisica, unidad: insumos[id].unidad, metodoConsumo: 'RENDIMIENTO_GEOMETRICO' });
const FACT = { factorMo: 0.1, factorGif: 0.25 };

// EXACTAMENTE el payload que arma GuardarProductoMaestro.jsx (guardar()).
function payloadCliente(bom, { sustituir = false, version = null } = {}) {
  return {
    p_clave: bom.clave, p_nombre: bom.nombre, p_lineas: bom.lineas,
    p_factor_mo: bom.factor_mo, p_factor_gif: bom.factor_gif,
    p_material_real: bom.material_real,
    p_cos_fab_calculado: bom.cos_fab_calculado,
    p_cos_fab_real: bom.cos_fab_real,
    p_dims_mm: bom.dims_mm, p_tipo_bom: bom.tipo_bom, p_fuente: bom.fuente,
    p_version_anterior: sustituir ? version : null,
    p_sustituir: sustituir,
    p_sustituir_verificado: sustituir,
  };
}

const CASTS = { p_lineas: '::jsonb', p_dims_mm: '::integer[]', p_material_real: '::numeric', p_factor_mo: '::numeric', p_factor_gif: '::numeric', p_cos_fab_calculado: '::numeric', p_cos_fab_real: '::numeric', p_version_anterior: '::integer', p_sustituir: '::boolean', p_sustituir_verificado: '::boolean' };
// Llama como supabase-js: por argumentos nombrados (así se ve si sobra/falta un parámetro).
async function rpcComoCliente(db, email, args) {
  const ks = Object.keys(args);
  const sql = `select public.guardar_producto_maestro(${ks.map((k, i) => `${k} => $${i + 1}${CASTS[k] || ''}`).join(', ')}) as r`;
  const params = ks.map((k) => { const v = args[k]; return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v; });
  await db.exec(`select set_config('test.email', '${email}', false)`);
  try { return (await db.query(sql, params)).rows[0].r; }
  finally { await db.exec(`select set_config('test.email', '', false)`); }
}

async function base() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select case when coalesce(current_setting('test.email', true),'')='' then null
        else jsonb_build_object('email', current_setting('test.email', true)) end $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create table public.permitidos (email text primary key, rol text not null default 'vendedor');
    insert into public.permitidos(email, rol) values ('${DIRECCION}','direccion');
    create table public.cuentas_no_humanas (email text primary key, motivo text);
    create function public.puede_certificar_costo() returns boolean language sql stable as $$
      select coalesce((select lower(rol) from public.permitidos where lower(email)=lower(auth.jwt()->>'email'))='direccion', false)
         and not exists (select 1 from public.cuentas_no_humanas where lower(email)=lower(auth.jwt()->>'email')) $$;
    create table public.producto_maestro (
      clave text primary key, nombre text, dims_mm integer[], fuente text, cos_fab_real numeric,
      lineas jsonb, creado_por text, creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(), factor_mo numeric, factor_gif numeric,
      material_real numeric, tipo_bom text);
  `);
  await db.exec(leer(RPC_NUEVA));  // crea columnas nuevas + RPC nueva
  return db;
}
// Igual que cargarBOMporClave: la fila tal cual para recostear.
const filaBOM = async (db, clave) => (await db.query(
  'select clave,nombre,lineas,factor_mo,factor_gif,material_real,cos_fab_real,tipo_bom from public.producto_maestro where clave=$1', [clave])).rows[0];

describe('E2E contrato · el payload del componente viaja a la RPC y vuelve', () => {
  let db;
  beforeAll(async () => { db = await base(); });
  afterAll(async () => { await db?.close(); });

  it('BORRADOR con una pendiente: el componente guarda, nada se pierde, y al reabrir el motor lo bloquea', async () => {
    const detalle = [linea('lam', 800, 2.5), linea('pin', 150, 3, 'comprado'), { insumoId: null, desc: 'Refuerzo sin SKU', precio: 0, costo: 0 }];
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'nuevo-e2e', nombre: 'Mueble nuevo', verificar: true, ...FACT });
    expect(bom.tipo_bom).toBe('BOM_BORRADOR');           // pendiente ⇒ no verificado (lado cliente)
    const r = await rpcComoCliente(db, DIRECCION, payloadCliente(bom));
    expect(r.ok).toBe(true);
    expect(r.version).toBe(1);
    expect(r.tipo_bom).toBe('BOM_BORRADOR');
    const fila = await filaBOM(db, 'NUEVO-E2E');
    expect(fila.tipo_bom).toBe('BOM_BORRADOR');
    expect(fila.lineas.length).toBe(3);                  // la pendiente se guardó (nada se pierde)
    // cos_fab_calculado separado de cos_fab_real (medido = null)
    const col = (await db.query(`select cos_fab_calculado, cos_fab_real from public.producto_maestro where clave='NUEVO-E2E'`)).rows[0];
    expect(Number(col.cos_fab_calculado)).toBeCloseTo(2450 * 1.35, 2);
    expect(col.cos_fab_real).toBeNull();
    // al reabrir y recostear, la pendiente bloquea (no emitible)
    const rc = costearBOM(fila, insumos);
    expect(rc.emitible).toBe(false);
    expect(rc.certificable).toBe(false);
  });

  it('VERIFICADO completo: el componente lo guarda y al reabrir certifica con catálogo fresco', async () => {
    const detalle = [linea('lam', 800, 2.5), linea('pin', 150, 3, 'comprado')];
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'cert-e2e', nombre: 'Mueble completo', verificar: true, ...FACT });
    expect(bom.tipo_bom).toBe('BOM_DETALLADO_VERIFICADO');
    const r = await rpcComoCliente(db, DIRECCION, payloadCliente(bom));
    expect(r.ok).toBe(true);
    expect(r.tipo_bom).toBe('BOM_DETALLADO_VERIFICADO');
    const fila = await filaBOM(db, 'CERT-E2E');
    const rc = costearBOM(fila, insumos);
    expect(rc.material).toBeCloseTo(2450, 2);
    expect(rc.emitible).toBe(true);
    expect(rc.certificable).toBe(true);                  // 4 capas coherentes: guarda verificado y recostea certificable
  });

  it('sustituir exige versión correcta (control optimista) — el payload del componente lo transporta', async () => {
    const detalle = [linea('lam', 800, 2.5), linea('pin', 150, 3, 'comprado')];
    const bom = bomDesdeDespiece(detalle, insumos, { clave: 'cert-e2e', nombre: 'v2', verificar: true, ...FACT });
    // sin sustituir → la RPC rechaza (ya existe)
    const e = await rpcComoCliente(db, DIRECCION, payloadCliente(bom)).catch((x) => x);
    expect(String(e?.message || '')).toMatch(/ya existe/i);
    // con sustituir + versión correcta (1) + confirmación de verificado → v2
    const r = await rpcComoCliente(db, DIRECCION, payloadCliente(bom, { sustituir: true, version: 1 }));
    expect(r.version).toBe(2);
  });
});
