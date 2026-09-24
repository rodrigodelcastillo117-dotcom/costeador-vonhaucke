import { calcular } from '../src/motor/calculo.js';

// Insumos con precios REALES por hoja/unidad del Explo_MP (T.D.C. banca C-CO-510R)
const INS = {
  'mdf19':   { id:'mdf19',  nombre:'MDF 19', clase:'directa', precio:437.9, unidad:'hoja', fraccion:true, formato:{tipo:'tablero', corto:'MDF', medida:2.9768} },
  'chapa':   { id:'chapa',  nombre:'Chapa encino', clase:'directa', precio:540, unidad:'hoja', fraccion:true, formato:{tipo:'tablero', corto:'chapa', medida:2.9768} },
  'inox22':  { id:'inox22', nombre:'Inox cal22 3x10', clase:'directa', precio:1550, unidad:'hoja', fraccion:true, formato:{tipo:'lamina', corto:'inox', medida:17.7} },
  'lam10':   { id:'lam10',  nombre:'Lamina negra cal10 3x10', clase:'directa', precio:2016.8, unidad:'hoja', fraccion:true, formato:{tipo:'lamina', corto:'cal10', medida:79.9} },
  'tubular': { id:'tubular',nombre:'Tubular 4 cal14', clase:'directa', precio:1020, unidad:'tramo' },
  'perfil':  { id:'perfil', nombre:'Perfil cuad 4 cal14', clase:'directa', precio:1400, unidad:'tramo' },
  'nivel':   { id:'nivel',  nombre:'Nivelador', clase:'directa', precio:3.2, unidad:'pza' },
  'pintura': { id:'pintura',nombre:'Pintura polvo', clase:'indirecta', precio:238.1, unidad:'kg' },
  'empaque': { id:'empaque',nombre:'Empaque', clase:'indirecta', precio:226, unidad:'jgo' },
  'bari':    { id:'bari',   nombre:'Multicontactos Bari', clase:'indirecta', precio:887, unidad:'pza' },
  'pegado':  { id:'pegado', nombre:'Pegado de chapa (op)', clase:'directa', precio:300, unidad:'op' },
};

// Despiece REAL, capturado como lo haria el estimador: fraccion de hoja (hojas)
// para tablero/lamina, cantidad para lo demas.
const pieza = {
  nombre: 'Banca doble C-CO-510R',
  modoManoObra: 'porcentaje',
  factorDirecta: 15.5,  // MO real = 15.5% del material (real $1,180 / $7,586)
  factorIndirecta: 0,
  componentes: [
    { insumoId:'mdf19', nombre:'MDF fondo+laterales', hojas:2 },
    { insumoId:'chapa', nombre:'Chapa encino', hojas:2 },
    { insumoId:'pegado', nombre:'Pegado de chapa', cantidad:1 },
    { insumoId:'inox22', nombre:'Zoclo inox', hojas:0.15 },
    { insumoId:'nivel', nombre:'Niveladores', cantidad:4 },
    { insumoId:'tubular', nombre:'Tubular sillas', cantidad:0.333 },
    { insumoId:'lam10', nombre:'Asiento/respaldo/soportes cal10', hojas:0.8 },
    { insumoId:'perfil', nombre:'Pedestales perfil', cantidad:0.7 },
    { insumoId:'pintura', nombre:'Pintura', cantidad:0.276 },
    { insumoId:'empaque', nombre:'Empaque', cantidad:1.38 },
    { insumoId:'bari', nombre:'Multicontactos Bari', cantidad:2 },
  ],
};

const r = calcular(pieza, 1, INS);
console.log('MATERIAL app (recon):', r.materialTotal.toFixed(2), ' vs REAL 7585.92');
console.log('  directo:', r.materialDirecto.toFixed(2), ' indirecto:', r.materialIndirecto.toFixed(2));
console.log('  DESPERDICIO:', r.desperdicio.toFixed(2), '(real ~0)');
console.log('MANO OBRA app:', r.manoObra.toFixed(2), ' vs REAL 1180.12');
console.log('COSTO FABRICACION app:', r.costoFabricacion.toFixed(2), ' vs REAL 12341.88');
console.log('--- desglose material por insumo ---');
for (const d of r.detalleInsumos) console.log(' ', d.nombre.padEnd(28), 'costo', d.costo.toFixed(1), '| merma', (d.desperdicio||0).toFixed(1));
