// HUELLA (footprint): la app la usa para dibujar el mueble en el plano y para
// decidir si cabe. Si sale 0 o absurda, el acomodo miente.
import { LINEAS_REG, configDesde, costearConfig } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';

const estado = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT };
const malas = [];
for (const [ruta, L] of Object.entries(LINEAS_REG)) {
  for (const p of L.productos || []) {
    const largos = p.largos?.length ? p.largos : [null];
    for (const Lm of largos) {
      const cfg = configDesde(p, Lm != null ? { largoMM: Lm } : {});
      let r; try { r = costearConfig(estado, ruta, p.id, cfg, 1); } catch { continue; }
      if (!r) continue;
      const m2 = (r.w / 1000) * (r.d / 1000);
      const nom = String(r.nombre);
      // ¿el nombre dice una medida en metros? Se usa como verdad de contraste.
      const dice = nom.match(/(\d+\.\d+)\s*m\b/);
      let motivo = null;
      if (!r.w || !r.d) motivo = 'huella 0 — el plano no la puede dibujar';
      else if (m2 < 0.05) motivo = `huella ${m2.toFixed(3)} m2 — imposible para este mueble`;
      else if (dice && r.w < parseFloat(dice[1]) * 1000 * 0.7) motivo = `el nombre dice ${dice[1]} m y la huella mide ${(r.w / 1000).toFixed(2)} m de frente`;
      else if (r.d > 1600) motivo = `fondo ${(r.d / 1000).toFixed(2)} m — no es un mueble, es un tablero desarrollado`;
      if (motivo) malas.push({ ruta, prod: p.id, w: r.w, d: r.d, m2, nombre: nom.slice(0, 58), motivo });
    }
  }
}
console.log(`### HUELLAS SOSPECHOSAS: ${malas.length}\n`);
for (const m of malas) {
  console.log(`   ${(m.ruta + '.' + m.prod).padEnd(28)} ${String(m.w).padStart(5)} × ${String(m.d).padStart(5)} mm = ${m.m2.toFixed(2)} m2`);
  console.log(`      ${m.nombre}`);
  console.log(`      → ${m.motivo}`);
}
