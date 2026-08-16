import { calcular, precioDe, PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
const insumos = mapaInsumos(INSUMOS_SEMILLA);
const base = {
  componentes: [
    { nombre:'Cubierta cuarzo(sust marmol)', insumoId:'marmol', largoMM:3200, anchoMM:600, piezas:1 },
    { nombre:'Cuerpo melamina', insumoId:'melamina-19', largoMM:3200, anchoMM:1100, piezas:2 },
    { nombre:'Frente laminado', insumoId:'laminado', largoMM:3200, anchoMM:1100, piezas:1 },
    { nombre:'Canto', insumoId:'tapacanto', cantidad:18 },
    { nombre:'Curvado', insumoId:'curvado', cantidad:6.4 },
    { nombre:'Cajonera', insumoId:'cajonera-movil', cantidad:1 },
    { nombre:'Pasacables', insumoId:'pasacables', cantidad:2 },
    { nombre:'Ducto', insumoId:'ducto', cantidad:3.2 },
  ], modoManoObra:'porcentaje', factorIndirecta:12 };
console.log('RECEPCIÓN CURVA — el único botón de mano de obra que ofrece el asistente:');
for (const [n,v] of [['Muy fácil',30],['Fácil',40],['Estándar',55],['Difícil',70],['Muy difícil',90]]) {
  const r = calcular({...base, factorDirecta:v}, 1, insumos, PARAMETROS_DEFAULT);
  console.log(`  ${n.padEnd(12)} ${v}%  costo $${Math.round(r.costoUnitario).toLocaleString('es-MX')}  precio50 $${Math.round(precioDe(r.costoUnitario,50)).toLocaleString('es-MX')}`);
}
const a=calcular({...base,factorDirecta:30},1,insumos,PARAMETROS_DEFAULT).costoUnitario;
const b=calcular({...base,factorDirecta:90},1,insumos,PARAMETROS_DEFAULT).costoUnitario;
console.log(`  → de "Muy fácil" a "Muy difícil" el costo sólo sube ${((b/a-1)*100).toFixed(1)}%`);
// horas equivalentes
console.log(`  → $${Math.round(calcular({...base,factorDirecta:90},1,insumos,PARAMETROS_DEFAULT).manoObra)} de mano de obra = ${(calcular({...base,factorDirecta:90},1,insumos,PARAMETROS_DEFAULT).manoObra/PARAMETROS_DEFAULT.costoHora).toFixed(1)} horas de taller a $${PARAMETROS_DEFAULT.costoHora}/h`);
