// Sube los renders de catálogo a Storage: app/render-ia/<ruta>/<producto>.jpg
// OJO: para CREAR un objeto Supabase Storage pide POST; PUT sólo actualiza uno
// que ya existe (por eso la versión en bash devolvía 400 en todos).
// Requiere las policies temporales app_temp_write/app_temp_update.
import { readFileSync, readdirSync } from 'node:fs';

const BASE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/app/render-ia';
const LLAVE = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';

const archivos = readdirSync('scratchpad/final').filter((f) => f.endsWith('.jpg')).sort();
let ok = 0; const malos = [];

for (const f of archivos) {
  const base = f.replace(/\.jpg$/, '');
  const ruta = base.slice(0, base.indexOf('-'));
  const prod = base.slice(base.indexOf('-') + 1);
  const cuerpo = readFileSync(`scratchpad/final/${f}`);
  let hecho = false;
  for (let intento = 1; intento <= 3 && !hecho; intento++) {
    try {
      const r = await fetch(`${BASE}/${ruta}/${prod}.jpg`, {
        method: 'POST',
        headers: { apikey: LLAVE, Authorization: `Bearer ${LLAVE}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
        body: cuerpo,
      });
      if (r.ok) { hecho = true; ok++; process.stdout.write('.'); }
      else if (intento === 3) malos.push(`${ruta}/${prod} http=${r.status} ${(await r.text()).slice(0, 120)}`);
    } catch (e) {
      if (intento === 3) malos.push(`${ruta}/${prod} ${e.message}`);
    }
    if (!hecho) await new Promise((s) => setTimeout(s, 800 * intento));
  }
}

console.log(`\n\nSubidos: ${ok}   Fallidos: ${malos.length}`);
for (const m of malos) console.log('  ✗', m);
process.exit(malos.length ? 1 : 0);
