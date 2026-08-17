// ¿Subir la holgura de la banca doble hizo que quepan MENOS muebles?
// Barre espacios de chico a grande y reporta cuántas piezas caben.
import { expandirPiezas } from '../src/datos/espacio.js';
import { acomodarLocal } from '../src/datos/planner.js';

const programa = (nBancas, nSillas) => ([
  { id: 'b', nombre: 'Banca doble APP LT 1.50 · 6 usuarios', cantidad: nBancas, precioUnitario: 1, w: 4500, d: 1200, ruta: 'applt' },
  { id: 's', nombre: 'Silla operativa WIN', cantidad: nSillas, precioUnitario: 1, w: 600, d: 600 },
  { id: 'a', nombre: 'Archivero Modulor 1.20 · 2 cajones', cantidad: 2, precioUnitario: 1, w: 1200, d: 450, ruta: 'modulor' },
]);

const casos = [
  ['8 × 6 m  · 1 banca', 8000, 6000, 1, 6],
  ['10 × 7 m · 2 bancas', 10000, 7000, 2, 12],
  ['12 × 8 m · 2 bancas', 12000, 8000, 2, 12],
  ['12 × 8 m · 4 bancas', 12000, 8000, 4, 24],
  ['15 × 10 m · 6 bancas', 15000, 10000, 6, 36],
  ['20 × 12 m · 10 bancas', 20000, 12000, 10, 60],
];
for (const [et, W, L, nb, ns] of casos) {
  const piezas = expandirPiezas(programa(nb, ns));
  const r = acomodarLocal([{ nombre: 'Open space', ancho: W, largo: L }], piezas, {});
  console.log(`${et.padEnd(24)} caben ${String(r.colocacion.length).padStart(3)}/${String(piezas.length).padEnd(3)} ${r.caben ? '✓' : '✗ NO CABE TODO'}`);
}
