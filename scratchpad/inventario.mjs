// Levanta el inventario REAL de productos con render de catálogo + sus medidas,
// leyendo los generadores de línea (fuente de verdad de largos/fondos/diámetros).
import { IMAGENES, HERO_RUTAS, imagenProducto, heroLinea } from '../src/datos/imagenes.js';

const MOD = {
  alba: () => import('../src/datos/alba.js'), anteo: () => import('../src/datos/anteo.js'),
  app: () => import('../src/datos/app.js'), applt: () => import('../src/datos/applt.js'),
  arlequin: () => import('../src/datos/arlequin.js'), cirque: () => import('../src/datos/cirque.js'),
  drift: () => import('../src/datos/drift.js'), eclipse: () => import('../src/datos/eclipse.js'),
  ergo4: () => import('../src/datos/ergo4.js'), feather: () => import('../src/datos/feather.js'),
  luna: () => import('../src/datos/luna.js'), modulor: () => import('../src/datos/modulor.js'),
  mox: () => import('../src/datos/mox.js'), pac: () => import('../src/datos/pac.js'),
  pebble: () => import('../src/datos/pebble.js'), privacy4: () => import('../src/datos/privacy4.js'),
  rio: () => import('../src/datos/rio.js'), spine: () => import('../src/datos/spine.js'),
  teamspace2: () => import('../src/datos/teamspace2.js'), tetris: () => import('../src/datos/tetris.js'),
  via: () => import('../src/datos/via.js'), worklounge: () => import('../src/datos/worklounge.js'),
};

const out = [];
for (const [ruta, cargar] of Object.entries(MOD)) {
  const mod = await cargar();
  const productos = Object.entries(mod).find(([k, v]) => k.endsWith('_PRODUCTOS') && Array.isArray(v))?.[1] || [];
  const conFoto = IMAGENES[ruta] || {};
  for (const prodId of Object.keys(conFoto)) {
    const p = productos.find((x) => x.id === prodId);
    out.push({
      ruta, prodId,
      nombre: p?.nombre || prodId,
      encontradoEnGenerador: !!p,
      largos: p?.largos || null, fondos: p?.fondos || null,
      diametros: p?.diametros || null, usuarios: p?.usuarios || null,
      alturas: p?.alturas || null,
      selects: (p?.selects || []).map((s) => s.label + ': ' + s.opciones.map((o) => o.label).join('/')),
      foto: imagenProducto(ruta, prodId),
    });
  }
}
console.log(JSON.stringify({ productos: out.length, heroes: HERO_RUTAS.size, sinGenerador: out.filter((o) => !o.encontradoEnGenerador).map((o) => o.ruta + '/' + o.prodId), items: out }, null, 1));
