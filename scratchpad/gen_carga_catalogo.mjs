// Genera SQL para cargar el catálogo versionado (audit 2026-10-01):
//  - 30 iguales  -> insumo_precios estado 'aprobado' (baseline).
//  - 15 unidad   -> unidad canónica del código; estado 'propuesto' (UNIDAD aprobada,
//                   PRECIO pendiente de evidencia). Con propiedades físicas.
// NO toca config. Salida: scratchpad/carga_catalogo.sql
import { INSUMOS_SEMILLA } from '/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/src/datos/insumos.js';
import fs from 'fs';

const NUBE = { // snapshot config.datos.insumos (2026-10-01)
 'acab-satinado':{p:120,u:'m2'},'acometida':{p:850,u:'pza'},'acrilico':{p:890,u:'m2'},'acrilico-12':{p:1180,u:'m2'},'acrilico-6':{p:690,u:'m2'},'aglomerado':{p:480,u:'hoja'},'anodizado':{p:45,u:'m'},'archivo-lateral':{p:4200,u:'pza'},'arnes':{p:1450,u:'pza'},'barniz':{p:95,u:'m2'},'base-motorizada':{p:5885,u:'pza'},'bastidor-madera':{p:420,u:'pza'},'bastidor-mampara':{p:680,u:'m2'},'bisagra':{p:85,u:'pza'},'byrne-interlink':{p:3012,u:'pza'},'byrne-node':{p:1607,u:'pza'},'byrne-phase2':{p:700,u:'pza'},'caja-electrica':{p:650,u:'pza'},'cajonera-movil':{p:2100,u:'pza'},'cerradura':{p:110,u:'pza'},'cerradura-electronica':{p:1850,u:'pza'},'chapa-madera':{p:850,u:'m2'},'chapa-walnut':{p:716,u:'hoja'},'charola':{p:145,u:'m'},'chicote':{p:38,u:'m'},'contacto':{p:95,u:'pza'},'corredera':{p:95,u:'par'},'credenza':{p:6500,u:'pza'},'cristal-flotado':{p:760,u:'m2'},'cristal-satinado':{p:780,u:'m2'},'cristal-templado':{p:980,u:'m2'},'cristal-templado-12':{p:1240,u:'m2'},'cristal-templado-6':{p:720,u:'m2'},'divisor-melamina':{p:320,u:'m2'},'ducto':{p:180,u:'m'},'ecocrom':{p:180,u:'m2'},'ecopiel':{p:340,u:'m'},'escuadra':{p:28,u:'pza'},'espuma':{p:260,u:'m2'},'espuma-termoformada':{p:580,u:'pza'},'faldon-abs':{p:180,u:'pza'},'faldon-melamina':{p:320,u:'m2'},'foil-pvc':{p:290,u:'m2'},'frente-metal':{p:520,u:'m2'},'frente-tela':{p:420,u:'m2'},'granallado':{p:55,u:'m2'},'inoxidable':{p:135,u:'kg'},'jaladera':{p:45,u:'pza'},'lamina-10':{p:33,u:'kg'},'lamina-12':{p:33,u:'kg'},'lamina-14':{p:33,u:'kg'},'lamina-18':{p:34,u:'kg'},'lamina-20':{p:32,u:'kg'},'lamina-22':{p:33,u:'kg'},'laminado':{p:420,u:'m2'},'marmol':{p:2400,u:'m2'},'marmol-premium':{p:2800,u:'m2'},'mdf':{p:210,u:'m2'},'mdf-16':{p:560,u:'hoja'},'melamina-16':{p:900,u:'hoja'},'melamina-19':{p:320,u:'m2'},'melamina-28':{p:1280,u:'hoja'},'melamina-9':{p:625,u:'hoja'},'membrana-pvc':{p:260,u:'m2'},'nivelador':{p:12,u:'pza'},'nogal':{p:420,u:'pie_tab'},'pasacables':{p:35,u:'pza'},'pata-metalica':{p:380,u:'pza'},'pedestal':{p:1850,u:'pza'},'perfil-aluminio':{p:95,u:'m'},'pet-acustico':{p:1150,u:'m2'},'piel-napa':{p:1900,u:'m2'},'pintura-electrostatica':{p:110,u:'m2'},'policarbonato':{p:1012.6,u:'m2'},'ptr':{p:42,u:'m'},'ptr-10':{p:70,u:'m'},'ptr-12':{p:58,u:'m'},'ptr-14':{p:48,u:'m'},'remate-aluminio':{p:95,u:'m'},'riel':{p:1250,u:'juego'},'rodaja':{p:22,u:'pza'},'serigrafia':{p:150,u:'m2'},'silicon':{p:180,u:'pza'},'soldadura':{p:65,u:'kg'},'tapa-abatible':{p:320,u:'pza'},'tapacanto':{p:10,u:'m'},'tapacanto-3mm':{p:25,u:'m'},'tela':{p:280,u:'m'},'tornilleria':{p:45,u:'juego'},'torre':{p:5600,u:'pza'},'usb-hdmi':{p:320,u:'pza'},'wally':{p:1900,u:'pza'},
};
const q = (s) => s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
const cod = {}; for (const i of INSUMOS_SEMILLA) cod[i.id] = i;

function propiedades(i) {
  const f = i.formato || {};
  if (i.seccion === 'metal' && f.medida) {
    const calibre = (i.nombre.match(/cal\.?\s*(\d+)/i) || [])[1] || null;
    return { calibre, peso_hoja_kg: f.medida, area_m2: 2.9768, modelo: 'compra kg -> costeo hoja/fraccion' };
  }
  if ((i.seccion === 'cubiertas' || i.seccion === 'mamparas') && f.largoMM) {
    return { largo_mm: f.largoMM, ancho_mm: f.anchoMM, area_m2: f.medida, modelo: 'compra hoja -> costeo fraccion/nesting' };
  }
  return null;
}
function compra(i) {
  const f = i.formato || {};
  if (i.seccion === 'metal' && f.medida && i.unidad === 'hoja')
    return { unidad_compra: 'kg', precio_compra: +(i.precio / f.medida).toFixed(4), factor_conversion: f.medida };
  if (i.unidad === 'hoja') return { unidad_compra: 'hoja', precio_compra: i.precio, factor_conversion: 1 };
  return { unidad_compra: i.unidad, precio_compra: i.precio, factor_conversion: 1 };
}

const IGUAL = (a, b) => Math.abs(+a.precio - b.p) <= 0.005 && a.unidad === b.u;
const out = ["-- CARGA CATALOGO VERSIONADO (generado) — baseline 30 + unidad 15. No toca config."];
let n30 = 0, n15 = 0;
for (const id of Object.keys(cod)) {
  const i = cod[id], nu = NUBE[id];
  if (!nu) continue;
  const esIgual = IGUAL(i, nu);
  const unidadDistinta = i.unidad !== nu.u;
  if (!esIgual && !unidadDistinta) continue; // conflicto solo de precio -> tabla de los 47 (no se carga aun)
  const c = compra(i), props = propiedades(i);
  out.push(`insert into public.insumos_catalogo (id,nombre,seccion,unidad_costeo,clasificacion) values (${q(id)},${q(i.nombre)},${q(i.seccion)},${q(i.unidad)},'vigente') on conflict (id) do nothing;`);
  const propsSql = props ? q(JSON.stringify(props)) + '::jsonb' : 'null';
  if (esIgual) {
    n30++;
    out.push(`insert into public.insumo_precios (insumo_id,precio,unidad_compra,precio_compra,factor_conversion,propiedades,fuente,evidencia,vigente_desde,estado,creado_por) values (${q(id)},${i.precio},${q(c.unidad_compra)},${c.precio_compra},${c.factor_conversion},${propsSql},${q(i.fuente||'codigo=nube')},'baseline: codigo y nube coinciden 2026-10-01',current_date,'aprobado','reconciliacion');`);
  } else {
    n15++;
    out.push(`insert into public.insumo_precios (insumo_id,precio,unidad_compra,precio_compra,factor_conversion,propiedades,fuente,evidencia,vigente_desde,estado,creado_por) values (${q(id)},${i.precio},${q(c.unidad_compra)},${c.precio_compra},${c.factor_conversion},${propsSql},${q(i.fuente||i.articulo||'codigo SEMILLA')},${q('UNIDAD canonica del codigo aprobada; PRECIO pendiente. Nube tenia '+nu.p+' '+nu.u)},current_date,'propuesto','reconciliacion');`);
  }
}
fs.writeFileSync('/Users/rodrigodelcastillo/Documents/costeador-vonhaucke/scratchpad/carga_catalogo.sql', out.join('\n'));
console.log(`baseline(30 aprobado)=${n30}  ·  unidad(15 propuesto)=${n15}  -> scratchpad/carga_catalogo.sql`);
