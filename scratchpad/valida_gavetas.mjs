// ¿La regla "va bajo el escritorio" separa bien gavetas de archiveros/credenzas?
import { vaBajoEscritorio, expandirPiezas, contarBajoEscritorio } from '../src/datos/espacio.js';

const casos = [
  // [nombre, ruta, w, d, esperado]
  ['Modulor · Gaveta rodante 2 cajones', 'modulor', 380, 580, true],
  ['MOX · Gaveta rodante con 1 cajón archivero y 1 papelero 380×580×460', 'mox', 380, 580, true],
  ['App LT · Gaveta fija bajo cubierta', 'applt', 400, 500, true],
  ['Pedestal rodante', 'modulor', 400, 550, true],
  ['Cajonera móvil 3 cajones', 'modulor', 420, 600, true],
  ['Modulor · Archivero 2 gavetas verticales 900×450', 'modulor', 900, 450, false], // grande → piso
  ['Modulor · Credenza 1.80', 'modulor', 1800, 450, false],
  ['Anteo · Credenza metálica', 'anteo', 1500, 450, false],
  ['Modulor · Armario 2 puertas', 'modulor', 900, 450, false],
  ['Modulor · Torre de guarda', 'modulor', 450, 450, false],
  ['Locker 12 puertas', 'modulor', 900, 450, false],
  ['Librero abierto', 'modulor', 900, 350, false],
  ['App LT · Escritorio 1.50', 'applt', 1500, 750, false],
  ['Cirque · Banca doble 6 puestos', 'cirque', 1200, 750, false],
];
let mal = 0;
for (const [nombre, ruta, w, d, esp] of casos) {
  const r = vaBajoEscritorio({ nombre, ruta, w, d });
  const ok = r === esp;
  if (!ok) mal++;
  console.log(`${ok ? '✓' : '✗'} ${r ? 'BAJO ' : 'PISO '} ${nombre}`);
}
console.log(mal === 0 ? '\n✅ 14/14 correctos' : `\n❌ ${mal} mal`);

// El acomodo ya no le aparta piso a la gaveta, pero sí la cuenta.
const partidas = [
  { id: 'p1', nombre: 'App LT · Escritorio 1.50 × 0.75 m', ruta: 'applt', w: 1500, d: 750, cantidad: 6 },
  { id: 'p2', nombre: 'MOX · Gaveta rodante 2 cajones', ruta: 'mox', w: 380, d: 580, cantidad: 6 },
  { id: 'p3', nombre: 'Modulor · Archivero 900 × 450', ruta: 'modulor', w: 900, d: 450, cantidad: 3 },
];
const pz = expandirPiezas(partidas);
const piso = pz.reduce((s, p) => s + p.w * p.d, 0) / 1e6;
console.log(`\nPiezas que piden piso: ${pz.length} (antes serían ${6 + 6 + 3})`);
console.log(`Gavetas bajo cubierta: ${contarBajoEscritorio(partidas)}`);
console.log(`Huella total: ${piso.toFixed(2)} m² (la gaveta ya no suma ${(6 * 380 * 580 / 1e6).toFixed(2)} m²)`);
