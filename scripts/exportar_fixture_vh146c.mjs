// Exporta (SOLO LECTURA, cuenta QA) el fixture real de VH-146c: supabase/tests/fixtures/vh146c_catalogo_real_20261014.json.
// Uso: NODE_USE_ENV_PROXY=1 QA_PW=<contraseña QA> node scripts/exportar_fixture_vh146c.mjs   (la contraseña nunca va en el archivo)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const src = fs.readFileSync('/home/user/costeador-vonhaucke/src/nube.js', 'utf8');
const LLAVE = src.match(/const LLAVE = '([^']+)'/)[1];
const sb = createClient('https://mtuvnbgljwbsaizjjgzs.supabase.co', LLAVE, { auth: { persistSession: false } });
const { error: e0 } = await sb.auth.signInWithPassword({ email: 'qa-direccion@vonhaucke.mx', password: process.env.QA_PW });
if (e0) throw e0;
const cols = 'id,nombre,seccion,unidad_costeo,activo,clasificacion,familia,atributos';
const all = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('insumos_catalogo').select(cols).eq('clasificacion', 'erp').eq('unidad_costeo', 'hoja').range(from, from + 999);
  if (error) throw error; all.push(...data); if (data.length < 1000) break;
}
const re = /(^|[^0-9])[45]\s*'?\s*x\s*'?\s*8($|[^0-9])/i;
const sinFmt = (r) => !(r.atributos && typeof r.atributos.formato === 'object' && r.atributos.formato);
const cand = all.filter((r) => ['melamina','mdf','laminado_hpl','chapa_madera','acrilico'].includes(r.familia) && sinFmt(r) && re.test(r.nombre));
const conFmt = all.filter((r) => r.familia === 'melamina' && !sinFmt(r)).sort((a,b)=>a.id<b.id?-1:1).slice(0, 3);
const otras = all.filter((r) => sinFmt(r) && !['melamina','mdf','laminado_hpl','chapa_madera','acrilico'].includes(r.familia || '')).sort((a,b)=>a.id<b.id?-1:1).slice(0, 3);
const filas = [...cand, ...conFmt, ...otras];
const ids = filas.map((r) => r.id);
const { data: precios, error: e2 } = await sb.from('insumo_precios').select('*').in('insumo_id', ['erp-ame28152-b709','erp-ame1648m706','erp-mdf18h','erp-lp48black', ...conFmt.map(r=>r.id).slice(0,1), ...otras.map(r=>r.id).slice(0,1)]).limit(20);
if (e2) throw e2;
fs.writeFileSync('/home/user/costeador-vonhaucke/supabase/tests/fixtures/vh146c_catalogo_real_20261014.json', JSON.stringify({ origen: 'producción mtuvnbgljwbsaizjjgzs, solo lectura con cuenta QA, 2026-10-14', insumos_catalogo: filas, insumo_precios: precios.map(({ cost_unit_price_mxn, ...p }) => p) }, null, 1));
console.log('filas', filas.length, 'cand', cand.length, 'acr', cand.filter(r=>r.familia==='acrilico').length, 'precios', precios.length);
