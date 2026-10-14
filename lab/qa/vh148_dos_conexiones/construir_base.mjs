// Construye en Postgres 16 real la MISMA base que supabase/tests/seg01cVinculoCosteo.test.js (base()):
// producción (baseVh148b) + catálogo real + P1-03b + VH-148 + VH-148b + SEG-01 + SEG-01c (rev4) en modo estricto.
const R = new URL('../../../', import.meta.url).pathname;
const { baseProduccion, leer, VH148, VH148B, SEG01, SEG01C } = await import(R + 'supabase/tests/helpers/baseVh148b.js');
const { tablaDeBaseline, vistaCatalogoVigenteProduccion, funcionDeMigracion, privateApiDeBaseline } = await import(R + 'supabase/tests/fixtures/erpBaseAislada.js');
const { quitados } = await import('./shim_pglite.mjs');
const P103B = 'supabase/migrations/PROPUESTA_p103b_precio_id_en_catalogo.sql';
const VH088 = 'supabase/migrations/20261012043000_vh088_catalogo_motor.sql';
const db = await baseProduccion();
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
  insert into public.insumo_precios (id, insumo_id, precio, estado, confidence, vigente_desde, approved_by, approved_at,
    unidad_compra, precio_compra, factor_conversion, evidence_status, requiere_validacion_compras) overriding system value
    values (900, 'm16', 612.4, 'aprobado', 'alta', '2026-10-01', 'qa148-direccion@vonhaucke.test', now(), 'hoja', 612.4, 1, 'documentada', false);`);
for (const f of [P103B, VH148, VH148B, SEG01, SEG01C]) await db.exec(leer(f));
await db.exec(`update private_api.politica_emision_autoridad set modo = 'estricto', version_motor_vigente = 'motor-1';
  grant usage on schema auth to anon, authenticated, service_role;
  insert into public.permitidos(email, rol) values ('qa148-direccion@vonhaucke.test', 'direccion'), ('qa148-ventas@vonhaucke.test', 'vendedor')
    on conflict (email) do update set rol = excluded.rol;
  notify pgrst, 'reload schema';`);
const v = await db.query(`select (select count(*) from pg_proc where proname in ('actualizar_cotizacion_segura','adjuntar_costeo_a_partida','actualizar_expediente_seguro','promesa_partida'))::int as funciones,
  exists (select 1 from pg_trigger where tgname = 'trg_vh148_version') as trigger_version, (select modo from private_api.politica_emision_autoridad) as modo`);
console.log(JSON.stringify({ quitados, ...v.rows[0] }));
await db.close();
