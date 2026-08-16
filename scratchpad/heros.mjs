// Genera las 3 portadas de la pantalla de entrada. Usa como REFERENCIA las
// fotos reales del catálogo, para que los muebles de la escena sean los
// nuestros y no muebles genéricos inventados.
import { writeFileSync, mkdirSync } from 'node:fs';

const URL_FN = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/functions/v1/generar-render';
const LLAVE = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
const CAT = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/catalogo';

const ESCENAS = [
  { id: 'hero1',
    refs: ['applt/banca_doble', 'modulor/archivero_h', 'pac/sillon'],
    d: 'Open-plan corporate office floor at golden hour: long rows of Von Haucke benching workstations with warm oak tops and charcoal steel frames, acoustic felt privacy screens, black ergonomic mesh chairs, storage credenzas along the wall. Floor-to-ceiling windows with warm late-afternoon sun raking across the floor, long soft shadows, polished concrete. Nobody in frame.' },
  { id: 'hero2',
    refs: ['eclipse/mesa_juntas', 'eclipse/escritorio'],
    d: 'Executive boardroom: a large Von Haucke veneer meeting table with charcoal steel base, high-back leather chairs, glass partition wall, warm wood slat feature wall, city view through the window, soft diffused daylight, elegant and restrained. Nobody in frame.' },
  { id: 'hero3',
    refs: ['worklounge/ding', 'pebble/mesa', 'tetris/sofa'],
    d: 'Collaboration lounge in a corporate office: Von Haucke upholstered modular lounge seating, small oak side tables, an acoustic felt divider, plants, warm indirect lighting, oak floor, calm and premium. Nobody in frame.' },
];

const b64 = async (u) => {
  const r = await fetch(u);
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer()).toString('base64');
};

mkdirSync('scratchpad/hero', { recursive: true });
for (const e of ESCENAS) {
  const imagenes = (await Promise.all(e.refs.map((p) => b64(`${CAT}/${p}.jpg`)))).filter(Boolean);
  const r = await fetch(URL_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: LLAVE, Authorization: `Bearer ${LLAVE}` },
    body: JSON.stringify({ descripcion: e.d, modo: 'oficina', imagenes, aspecto: '16:9' }),
  });
  const j = await r.json();
  if (!j.ok) { console.log('✗', e.id, j.error); continue; }
  const buf = Buffer.from(j.dataUrl.split(',')[1], 'base64');
  writeFileSync(`scratchpad/hero/${e.id}.jpg`, buf);
  console.log('✓', e.id, (buf.length / 1024).toFixed(0) + ' KB');
}
