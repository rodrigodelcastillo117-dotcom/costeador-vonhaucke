import { generarRio, RIO_PRODUCTOS } from '../src/datos/rio.js';
import { footprintDe } from '../src/datos/lineas.js';
import { huellaReal, tipoDe } from '../src/datos/espacio.js';

const casos = [
  { producto: 'estacion', tipo: 'cruz', largo: '1500', fondo: '600', usuarios: null },
  { producto: 'estacion', tipo: 'L', largo: '1500', fondo: '600' },
  { producto: 'bench_recto_sencillo', usuarios: '6', largo: '1200', fondo: '600' },
  { producto: 'bench_recto_doble', usuarios: '6', largo: '1200', fondo: '600' },
];
for (const c of casos) {
  try {
    const g = generarRio({ finish: 'ABS', ...c });
    const fp = footprintDe(g.componentes, g.nombre);
    const t = tipoDe({ ruta: 'rio', nombre: g.nombre });
    const [bw, bd] = huellaReal(g.nombre, fp.w, fp.d, t);
    console.log(`${(g.nombre||'?').padEnd(30)} tipo=${t.padEnd(11)} fp=${fp.w}×${fp.d} → HUELLA EN EL PLANO ${bw}×${bd} mm  (${((bw*bd)/1e6).toFixed(2)} m²)`);
  } catch (e) { console.log(c.producto, c.tipo, 'ERROR', e.message); }
}
