// ============================================================================
//  HOLDOUT · exactitud de materiales en 5 planos reales (independiente).
//  Protocolo: BOM impreso de la CAPA DE TEXTO del PDF (verdad de referencia,
//  no la lectura visual) resuelto contra el ERP real por el criterio del motor
//  (clave exacta, fail-closed). Lee claves_por_plano.json + mapa de resolucion
//  ERP (n candidatos + precio) y emite el reporte.
//  Uso: node tools/holdout_planos.mjs <ruta_claves_por_plano.json>
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';

const CLAVES_JSON = process.argv[2];
const porPlano = JSON.parse(readFileSync(CLAVES_JSON, 'utf8'));

// n de candidatos ERP por clave (consulta real catalogo_vigente, 2026-11-09):
const N = { 'AD-0008':1,'ARMADO2':0,'CLENR2CA':1,'COEME20ND':0,'COEME20NI':0,'CR1':15,'CR2':19,'CR3':9,'PC-01-1-N4':1,'PI1015':1,'PITR114':1,'REP46':1,'SK1ASEP':1,'TELSMG-CR5':1,'TELSVH120':2,'TELSVH120-AD':0,'TELSVH120-BAA':1,'TELSVH120-BX2':0,'TELSVH120-CAP':1,'TELSVH120-CF':0,'TELSVH120-CUE':0,'TELSVH120-KIT':0,'TELSVH120-P':0,'TELSVH120-PC':0,'TELSVH120-PLA':0,'TELSVH120-SIL':0,'TELSVH120-SOC':0,'TELSVH120-SOM':0,'TEVHSU-BEXL2':0,'TEVHSU-CR1':1,'TEVHSU-CR2':1,'TEVHSU-CR3':1,'TEVHSU-LOB2':1,'TEVHSU-PA1':0,'TEVHSU-PA2':0,'TEVHSU-PA3':0,'TEVHSU-PA4':0,'TEVHSU01-VP-01-1-N1':0,'TEVHSU01-VP-01-2-N1':0,'TEVHSU01-VP-01-3-N1':0,'TEVHSU01-VP-01-4-N1':0,'TEVHSU02-VP-01-1-N1':0,'TEVHSU02-VP-01-2-N1':0,'TEVHSU02-VP-01-3-N1':0,'TEVHSU02-VP-01-4-N1':0,'TEVTSU-CR1':1,'TEVTSU-CR2':1,'TEVTSU-CR3':0,'TEVTSU-PC-01-1-N4':0,'TEVTSU-PC-01-2-N4':0,'TEVTSU-PC-01-3-N4':0,'TEVTSU-PC-01-4-N4':0,'TEVTSU-PC-01-5-N4':0,'TO1412CAPH':1,'TO14CG':1,'TO3812NIC':1,'TO381CNIC':1,'TOA1412CBG':1 };
const PRE = { 'AD-0008':138.2,'CLENR2CA':590,'PI1015':0.31,'PITR114':0.29,'REP46':0.31,'SK1ASEP':170,'TELSMG-CR5':130.71,'TELSVH120-BAA':1685,'TELSVH120-CAP':1737.99,'TEVHSU-CR1':135,'TEVHSU-CR2':265,'TEVHSU-CR3':484,'TEVHSU-LOB2':51.4,'TEVTSU-CR1':525,'TEVTSU-CR2':527.8,'TO1412CAPH':0.85,'TO14CG':0.4,'TO3812NIC':40.7,'TO381CNIC':14.77,'TOA1412CBG':0.95 };
const PLANOS = ['TELSVH120','TELSMG','TEVTSU','TEVHSU','TVCAC'];
const esRuidoPlano = (c) => /-(VP|PC)-\d/.test(c) || /^PC-\d{2}-/.test(c);
const esAutoCodigo = (c) => PLANOS.includes(c);

let md = '# HOLDOUT - exactitud de materiales en 5 planos reales (independiente)\n\n';
md += 'Protocolo: BOM impreso extraido de la CAPA DE TEXTO del PDF (verdad de referencia, no la lectura visual) y resuelto contra el ERP real (catalogo_vigente) por el mismo criterio del motor (clave exacta, fail-closed). Fecha 2026-11-09.\n\n';
md += '| Plano | Materiales | Resueltos n=1 | Ambiguos n>=2 | Pendientes (no en ERP) | Ruido/codigo | Tasa resol. | Piso material* |\n|---|---|---|---|---|---|---|---|\n';
const detalle = {};
for (const p of PLANOS) {
  const claves = porPlano[p] || [];
  let mat = 0, res = 0, amb = 0, pend = 0, ruido = 0, piso = 0; const pendList = [];
  for (const c of claves) {
    if (esRuidoPlano(c) || esAutoCodigo(c)) { ruido++; continue; }
    mat++;
    const n = N[c] ?? 0;
    if (n === 1) { res++; piso += (PRE[c] || 0); }
    else if (n >= 2) { amb++; }
    else { pend++; pendList.push(c); }
  }
  const tasa = mat ? ((res / mat) * 100).toFixed(0) + '%' : '-';
  md += `| ${p} | ${mat} | ${res} | ${amb} | ${pend} | ${ruido} | ${tasa} | $${piso.toLocaleString('es-MX')} |\n`;
  detalle[p] = { materiales: mat, resueltos: res, ambiguos: amb, pendientes: pend, ruido, piso: +piso.toFixed(2), pendientes_lista: pendList };
}
md += '\n*Piso material = suma de precios ERP de las claves resueltas n=1 (no incluye fabricadas sin precio, ni consumos de lamina, ni MO). Es una COTA, no el costo del producto.\n\n';
md += '## Hallazgo sistemico (holdout)\n\n';
md += '- Las **piezas fabricadas de lamina** (cuerpo/frente/puertas/paneles: -CUE, -CF, -P, -PC, -SOC, -SOM, -PA1..4, -BEXL2, -BX2) dan **0 candidatos en TODOS los planos**: el ERP NO tiene las piezas hechas en casa. Hueco ESTRUCTURAL: todo mueble nuevo lo tendra -> necesita consumo de lamina (geometria) + routing, no un precio de catalogo.\n';
md += '- Herrajes/consumibles/cristales/maquila (REP46, TO*, AD-0008, CR*, -CAP, -BAA) resuelven bien y consistente entre planos.\n';
md += '- Claves ambiguas (CR1/CR2/CR3 a secas, 9-19 candidatos) quedan SIN resolver por diseno (fail-closed): el motor no adivina variante.\n';
md += '- TVCAC: la capa de texto no trae BOM (plano tipo imagen) -> 0 materiales extraibles; requiere lectura visual (multimodal) como TELSVH120.\n';
writeFileSync(new URL('../expedientes/HOLDOUT_PLANOS.md', import.meta.url), md);
writeFileSync(new URL('../expedientes/HOLDOUT_PLANOS.json', import.meta.url), JSON.stringify(detalle, null, 2));
console.log(md);
