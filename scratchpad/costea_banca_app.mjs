import { calcular, precioVenta, PARAMETROS_DEFAULT } from '../src/motor/calculo.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
const INS = mapaInsumos(INSUMOS_SEMILLA);
const pieza = {
  nombre: 'Banca doble C-CO-510R',
  modoManoObra: 'porcentaje', factorDirecta: 15.5, factorIndirecta: 12,
  componentes: [
    { insumoId:'mdf', nombre:'MDF fondo/laterales', hojas:2 },
    { insumoId:'chapa-madera', nombre:'Chapa encino', hojas:2 },
    { insumoId:'pegado-chapa', nombre:'Pegado de chapa', cantidad:1 },
    { insumoId:'inoxidable', nombre:'Zoclo inox', hojas:0.15 },
    { insumoId:'nivelador', nombre:'Niveladores', cantidad:4 },
    { insumoId:'ptr-redondo-4', nombre:'Tubular sillas 4"', cantidad:0.333 },
    { insumoId:'lamina-10', nombre:'Asiento/respaldo cal10', hojas:0.8 },
    { insumoId:'ptr-cuadrado-4', nombre:'Pedestales perfil 4"', cantidad:0.7 },
    { insumoId:'pintura-polvo', nombre:'Pintura', cantidad:0.276 },
    { insumoId:'multicontactos-bari', nombre:'Multicontactos Bari', cantidad:2 },
  ],
};
const par = { ...PARAMETROS_DEFAULT };
const r = calcular(pieza, 1, INS, par);
for (const d of r.detalleInsumos) console.log('  '+d.nombre.padEnd(34), '$'+d.costo.toFixed(0).padStart(6), '| merma $'+(d.desperdicio||0).toFixed(0));
console.log('\n  MATERIAL        $'+r.materialTotal.toFixed(0).padStart(7), ' (real $7,586)');
console.log('  DESPERDICIO     $'+r.desperdicio.toFixed(0).padStart(7), ' (real ~0)');
console.log('  MANO DE OBRA    $'+r.manoObra.toFixed(0).padStart(7), ' (real $1,180)');
console.log('  INDIRECTOS 34%  $'+r.indirectosFabrica.toFixed(0).padStart(7), ' (real $3,576)');
console.log('  COSTO FABRICAR  $'+r.costoFabricacion.toFixed(0).padStart(7), ' (real $12,342)');
