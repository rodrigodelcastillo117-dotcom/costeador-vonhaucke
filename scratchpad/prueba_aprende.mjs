// ¿DE VERDAD APRENDE? El mismo pedido, dos veces: con y sin una lección que
// contradice lo que Voni haría por su cuenta. Si la respuesta no cambia, el
// puente está roto por más que el código se vea bien.
import { catalogoIA } from '../src/datos/lineas.js';
const LLAVE = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
const URL = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/functions/v1/cotizar-texto';
const PEDIDO = '10 lugares de trabajo en bench';

async function pedir(extra) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: LLAVE, Authorization: 'Bearer ' + LLAVE },
    body: JSON.stringify({ texto: PEDIDO, catalogo: catalogoIA(), ...extra }),
  });
  const j = await r.json();
  if (!j.ok) return { error: j.error };
  return {
    lineas: (j.propuesta.items || []).map((i) => `${i.ruta}/${i.producto} ×${i.cantidad}`),
    nota: (j.propuesta.items || [])[0]?.nota?.slice(0, 150) || '',
  };
}

console.log('PEDIDO:', PEDIDO, '\n');
const a = await pedir({});
console.log('1) SIN nada        →', a.lineas?.join(' · ') || a.error);
console.log('   nota:', a.nota, '\n');

const b = await pedir({ reglas: ['Para bench operativo la casa usa RÍO por omisión, no App LT.'] });
console.log('2) CON una REGLA   →', b.lineas?.join(' · ') || b.error);
console.log('   nota:', b.nota, '\n');

const c = await pedir({ aprendizajes: ['Cuando pidan "lugares de trabajo en bench" sin decir línea, el vendedor siempre lo cambia a Cirque. Usa Cirque desde el principio.'] });
console.log('3) CON una LECCIÓN →', c.lineas?.join(' · ') || c.error);
console.log('   nota:', c.nota);
