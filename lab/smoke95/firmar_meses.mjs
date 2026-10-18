// Firma de Dirección de precios del ERP con documento y compra ≤ N meses, con la sesión de quien la corre.
// Mismo RPC que el botón "Firmar precios del ERP" (firmar_precios_erp_lote), por lotes con cursor; la base rechaza
// la cuenta QA y cualquier rol que no sea direccion. Uso:  FIRMA_MESES=120 node lab/smoke95/firmar_meses.mjs
import { createClient } from '@supabase/supabase-js';
import readline from 'node:readline';

const MESES = Number(process.env.FIRMA_MESES || 24);
const sb = createClient('https://mtuvnbgljwbsaizjjgzs.supabase.co', 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y',
  { auth: { persistSession: false, autoRefreshToken: false } });

function preguntar(texto, oculto = false) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) rl._writeToOutput = (s) => { if (s.includes(texto)) rl.output.write(texto); };
    rl.question(texto, (r) => { rl.close(); if (oculto) process.stdout.write('\n'); ok(r.trim()); });
  });
}

const email = process.env.SMOKE_EMAIL || await preguntar('Correo de Dirección: ');
const password = await preguntar('Contraseña (no se muestra): ', true);
const { error: eLogin } = await sb.auth.signInWithPassword({ email, password });
if (eLogin) { console.log('No se pudo iniciar sesión:', eLogin.message); process.exit(1); }

// FIRMA_SIN_DOC=1: además firma los precios SIN documento de compra (política D2, queda así en el historial).
const SIN_DOC = process.env.FIRMA_SIN_DOC === '1';
const que = `los precios con documento y compra de los últimos ${MESES} meses${SIN_DOC ? ' Y los precios SIN documento de compra' : ''}`;
const confirma = await preguntar(`Vas a firmar como Dirección ${que}. Escribe SI para continuar: `);
if (confirma !== 'SI') { console.log('Cancelado. No se firmó nada.'); await sb.auth.signOut(); process.exit(0); }

async function firmarTodo(titulo, fn, args) {
  const acc = { firmados: 0, no_firmados: 0, motivos: {}, lotes: 0 };
  let cursor = null;
  for (let i = 0; i < 1000; i++) {
    const { data, error } = await sb.rpc(fn, { ...args, p_despues_de: cursor, p_limite: 200 });
    if (error) { console.log(`\n${titulo}: se detuvo:`, error.message); break; }
    acc.firmados += Number(data.firmados || 0); acc.no_firmados += Number(data.no_firmados || 0); acc.lotes += 1;
    for (const [m, n] of Object.entries(data.motivos || {})) acc.motivos[m] = (acc.motivos[m] || 0) + Number(n || 0);
    process.stdout.write(`\r${titulo}: ${acc.firmados} firmados, ${acc.no_firmados} no firmados (lote ${acc.lotes})`);
    if (data.ultimo_id == null) break;
    cursor = data.ultimo_id;
  }
  console.log(`\n${titulo} · firmados ${acc.firmados} · no firmados ${acc.no_firmados}`);
  for (const [m, n] of Object.entries(acc.motivos)) console.log(`  ${n} × ${m}`);
}

await firmarTodo(`Con documento (≤ ${MESES} meses)`, 'firmar_precios_erp_lote', { p_meses: MESES });
if (SIN_DOC) await firmarTodo('Sin documento', 'firmar_precios_sin_documento_lote', {});
console.log('\nListo.');
await sb.auth.signOut();
