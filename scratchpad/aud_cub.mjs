import { LINEAS_REG, configDesde } from '../src/datos/lineas.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { piezasPorTablero, PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
const INS = mapaInsumos(INSUMOS_SEMILLA);
const g = LINEAS_REG['applt'].generar(configDesde(LINEAS_REG['applt'].productos.find(p=>p.id==='escritorio'), {}));
console.log('config default escritorio -> nombre:', g.nombre);
for (const c of g.componentes) {
  if (/melamina-28/.test(c.insumoId)) {
    const ppt = piezasPorTablero(c.largoMM, c.anchoMM, { ...PARAMETROS_DEFAULT, veta: INS[c.insumoId]?.veta });
    console.log(`  ${c.nombre}: ${c.largoMM}x${c.anchoMM} piezas=${c.piezas||1} -> caben ${ppt}/tablero  veta=${INS[c.insumoId]?.veta}`);
  }
}
console.log('tablero par:', PARAMETROS_DEFAULT.tableroLargoMM, 'x', PARAMETROS_DEFAULT.tableroAnchoMM, 'recorte', PARAMETROS_DEFAULT.recorteOrillaMM, 'kerf', PARAMETROS_DEFAULT.kerfMM, 'aprov', PARAMETROS_DEFAULT.aprovechamientoCorte);
