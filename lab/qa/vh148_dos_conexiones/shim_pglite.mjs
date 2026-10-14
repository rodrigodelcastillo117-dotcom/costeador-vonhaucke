// Sustituto de @electric-sql/pglite para correr EXACTAMENTE el SQL de las pruebas sobre Postgres 16 real.
// Sólo quita del preámbulo de baseProduccion lo que en Supabase real ya existe (esquema auth de GoTrue, roles,
// extensiones y los stubs de auth.uid/auth.jwt): las funciones auth.* son las REALES de GoTrue.
import pg from './node_modules/pg/lib/index.js';   // npm i --no-save pg@8.13.1 (ver LEEME.md)
const QUITAR = [
  /create schema auth;/g, /create schema extensions;/g, /create extension if not exists pgcrypto with schema extensions;/g,
  /create role anon nologin; create role authenticated nologin; create role service_role nologin;/g,
  /create function auth\.(uid|jwt)\(\) returns [\s\S]*?\$\$;/g,
];
export const quitados = [];
export class PGlite {
  constructor() { this.c = new pg.Client({ connectionString: process.env.QA_PG_URL }); this.listo = this.c.connect(); }
  async exec(sql) {
    await this.listo;
    let s = sql;
    for (const r of QUITAR) s = s.replace(r, (m) => { quitados.push(m.slice(0, 60)); return ' /* (Supabase real: ya existe) */ '; });
    await this.c.query(s);
  }
  async query(sql, params) { await this.listo; const r = await this.c.query(sql, params); return { rows: r.rows }; }
  async close() { await this.c.end(); }
}
