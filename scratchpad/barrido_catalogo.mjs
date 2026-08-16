// Qué cotiza HOY la app para cada producto del catálogo, línea por línea.
// Sirve para que Rodrigo lea la lista y diga "éste está mal, súbelo N×" — que es
// exactamente como se calibró Anteo. Marca de dónde salió cada precio.
import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-MX');

for (const [ruta, L] of Object.entries(LINEAS_REG)) {
  const filas = [];
  for (const p of L.productos || []) {
    // Config por defecto y, si el producto tiene medidas, también la más grande.
    const variantes = [{}];
    if (p.largos?.length > 1) variantes.push({ largoMM: p.largos[p.largos.length - 1] });
    for (const v of variantes) {
      let r; try { r = costearConfig(estado, ruta, p.id, configDesde(p, v), 1); } catch { r = null; }
      if (!r) { filas.push([p.id, '— no costeó —', '', '']); continue; }
      filas.push([p.id, String(r.nombre).slice(0, 52), pesos(r.precioUnitario), r.precioReal ? 'REAL' : '']);
    }
  }
  console.log(`\n### ${L.titulo}  (${ruta})`);
  for (const [id, nombre, precio, real] of filas) {
    console.log(`  ${String(precio).padStart(10)} ${real.padEnd(5)} ${id.padEnd(20)} ${nombre}`);
  }
}
