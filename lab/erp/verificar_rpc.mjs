// P0-B · ≥10 artículos ERP de familias distintas: insumo_precios (origen) → catalogo_motor (lo que ve el motor), a centavos.
// Lectura pura con la sesión QA (Dirección). No escribe nada.
import fs from 'node:fs';
const BASE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co';
const KEY = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
const IDS = ['erp-ame1948-b14','erp-mdf18h','erp-ame28152-b14','erp-ac1cv2412','erp-af212316-6','erp-12n5g3-a','erp-9071205','erp-baan124','erp-adco169','erp-20awg','erp-cnacus','erp-1810-89','erp-bmtppi3g114635','erp-abbio4crt-cr','erp-bi155bm3n'];
async function token() {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }) });
  const j = await r.json(); if (!j.access_token) throw new Error('login'); return j.access_token;
}
const tok = await token(); const H = { apikey: KEY, Authorization: `Bearer ${tok}`, 'content-type': 'application/json' };
const motor = await (await fetch(`${BASE}/rest/v1/rpc/catalogo_motor`, { method: 'POST', headers: H, body: JSON.stringify({ p_incluir_erp: false, p_ids: IDS }) })).json();
const vig = await (await fetch(`${BASE}/rest/v1/catalogo_vigente?select=insumo_id,precio,unidad_compra,estado,certificable,fuente&insumo_id=in.(${IDS.join(',')})`, { headers: H })).json();
const origen = await (await fetch(`${BASE}/rest/v1/insumo_precios?select=insumo_id,source_price,source_currency,source_unit,source_units_per_cost_unit,cost_unit,cost_unit_price_mxn,estado,vigente_desde,source_record_id&vigente_hasta=is.null&source_system=eq.erp_intelisis&insumo_id=in.(${IDS.join(',')})`, { headers: H })).json();
const cents = (x) => Math.round(Number(x) * 100);
if (!Array.isArray(vig)) console.log('catalogo_vigente por REST:', JSON.stringify(vig).slice(0, 200), '→ la vista no se expone al rol autenticado; la paridad se mide origen → catalogo_motor (RPC SECURITY DEFINER).');
const filas = []; let ok = 0;
for (const id of IDS) {
  const o = (Array.isArray(origen) ? origen : []).find((x) => x.insumo_id === id); const v = (Array.isArray(vig) ? vig : []).find((x) => x.insumo_id === id); const m = motor?.[id];
  const paridad = o && m && cents(o.source_price) === cents(o.cost_unit_price_mxn) && cents(o.cost_unit_price_mxn) === cents(m.precio ?? m.precioBase) && (!v || cents(v.precio) === cents(m.precio ?? m.precioBase));
  if (paridad) ok++;
  filas.push({ id, origen: o ? `${o.source_price} ${o.source_currency}/${o.source_unit} ×${o.source_units_per_cost_unit}` : 'SIN ORIGEN', mxn: o?.cost_unit_price_mxn, vigente: v ? `${v.precio} ${v.unidad_compra} ${v.estado} cert=${v.certificable}` : 'NO VIGENTE', motor: m ? `${m.precio ?? m.precioBase} ${m.unidad} formato=${m.formato ? (m.formato.corto || m.formato.tipo) : '-'} ev=${m.evidencia?.estado}/${m.evidencia?.certificable}` : 'NO EN MOTOR', paridad: paridad ? '✓' : '✗' });
}
console.table(filas); console.log(`paridad a centavos origen→motor: ${ok}/${IDS.length}`);
fs.writeFileSync('verificar_rpc.out.json', JSON.stringify({ filas, ok, total: IDS.length, motorKeys: Object.keys(motor || {}).length }, null, 2));
