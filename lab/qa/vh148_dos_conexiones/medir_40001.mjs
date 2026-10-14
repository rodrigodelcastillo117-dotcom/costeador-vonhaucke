// Mide qué hace PostgREST real (la versión de ./postgrest; se registra en la salida) ante SQLSTATE 40001 vs PT409 levantados por una RPC.
import pg from './node_modules/pg/lib/index.js';
import { execSync } from 'node:child_process';
const tok = execSync('node token.mjs qa148-ventas@vonhaucke.test').toString().trim();
const db = new pg.Client({ connectionString: 'postgres://postgres@127.0.0.1:54329/postgres' }); await db.connect();
await db.query(`create sequence if not exists public.qa148_intentos; grant usage on sequence public.qa148_intentos to authenticated;
  create or replace function public.qa148_conflicto(p_codigo text) returns jsonb language plpgsql as $f$
  begin
    perform nextval('public.qa148_intentos');   -- no transaccional: cuenta cada intento aunque se deshaga
    raise exception 'CONFLICTO_VERSION: prueba QA (%)', p_codigo using errcode = p_codigo, detail = 'actualizado=2026-10-14T00:00:00Z';
  end $f$;
  grant execute on function public.qa148_conflicto(text) to authenticated; notify pgrst, 'reload schema';`);
await new Promise((r) => setTimeout(r, 2000));
const rb = async () => Number((await db.query("select last_value + (case when is_called then 0 else -1 end) as n from public.qa148_intentos")).rows[0].n);
const out = { postgrest: execSync('./postgrest --version').toString().trim() };
for (const codigo of ['PT409', '40001']) {
  await db.query('select pg_stat_clear_snapshot()');
  const r0 = await rb(); const t0 = Date.now(); let http = null, cuerpo = null;
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch('http://127.0.0.1:59998/rpc/qa148_conflicto', { method: 'POST', signal: ctl.signal,
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_codigo: codigo }) });
    clearTimeout(to); http = r.status; cuerpo = await r.json();
  } catch (e) { http = 'sin respuesta en 5 s (' + e.name + ')'; }
  const ms = Date.now() - t0;
  await new Promise((r) => setTimeout(r, 3000));
  await db.query('select pg_stat_clear_snapshot()');
  const r1 = await rb();
  await new Promise((r) => setTimeout(r, 2000));
  await db.query('select pg_stat_clear_snapshot()');
  const r2 = await rb();
  out[codigo] = { http, cuerpo, ms, ejecuciones_de_la_rpc_en_8s: r1 - r0, ejecuciones_en_los_2s_siguientes_con_el_cliente_ya_desconectado: r2 - r1 };
}
console.log(JSON.stringify(out, null, 1));
console.error('OJO: PostgREST sigue reintentando el 40001 en segundo plano; corre ./reiniciar.sh antes de otra prueba.');
await db.end();
