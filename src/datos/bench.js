// ============================================================================
//  BENCH MODULAR (master 8.5)
//  Los operativos son modulares y SIEMPRE en par (se sientan de frente).
//  Para p personas: f = p/2 por lado, pares = p/2, largo = f x 1.40 m,
//  patas = f + 1. Se cuenta por persona, por par, por corrida y por modulo.
//  NOTA: las cantidades de material son estimadas; se afinan con planta.
// ============================================================================
import { UE } from './ue.js';
import { REGLAS_LINEA } from './catalogo.js';

export function recetaBench(opciones = {}) {
  const {
    personas = 2,
    lineaId = 'app_lt',
    divisor = 'divisor-melamina',
    faldon = false,
  } = opciones;

  const p = Math.max(2, Math.round(personas / 2) * 2); // siempre par
  const f = p / 2;            // posiciones por lado
  const pares = p / 2;        // enfrentados
  const largo = f * 1.40;     // metros de corrida
  const patas = f + 1;
  const esAppLt = lineaId === 'app_lt';
  const cubierta = REGLAS_LINEA[lineaId]?.sustituye?.['melamina-19'] || 'melamina-19';

  const comps = [];
  // --- Por persona ---
  comps.push({ insumoId: cubierta, nombre: `Cubiertas (${p})`, largoMM: 1400, anchoMM: 700, piezas: p, cantidad: 0.98 });
  comps.push({ insumoId: 'tapacanto', nombre: 'Tapacanto', cantidad: 4.2 * p });
  comps.push({ insumoId: 'lamina-20', nombre: 'Estructura lamina', cantidad: 4.2 * p });
  comps.push({ insumoId: 'pintura-electrostatica', nombre: 'Pintura', cantidad: 0.9 * p });
  comps.push({ insumoId: 'contacto', nombre: 'Contactos', cantidad: 2 * p });
  if (!esAppLt) {
    comps.push({ insumoId: 'caja-electrica', nombre: `Cajas electricas (${p})`, cantidad: p });
    comps.push({ insumoId: 'usb-hdmi', nombre: 'USB / HDMI', cantidad: p });
  }
  // --- Por par enfrentado ---
  comps.push({ insumoId: divisor, nombre: `Divisores (${pares})`, cantidad: 0.6 * pares });
  comps.push({ insumoId: 'pasacables', nombre: 'Pasacables', cantidad: pares });
  comps.push({ insumoId: 'tapa-abatible', nombre: 'Tapas abatibles', cantidad: pares });
  // --- Por corrida ---
  comps.push({ insumoId: 'pata-metalica', nombre: `Patas (${patas})`, cantidad: patas });
  comps.push({ insumoId: 'ptr', nombre: 'PTR corrida', cantidad: largo * 2 });
  comps.push({ insumoId: 'charola', nombre: 'Charola', cantidad: largo });
  comps.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: patas });
  if (!esAppLt) comps.push({ insumoId: 'ducto', nombre: 'Ducto', cantidad: largo });
  // --- Por modulo ---
  comps.push({ insumoId: 'acometida', nombre: 'Acometida', cantidad: 1 });
  comps.push({ insumoId: 'arnes', nombre: 'Arnes', cantidad: Math.ceil(p / 4) });
  // --- Faldon opcional (mismo material que la cubierta: cae en el retazo) ---
  if (faldon) comps.push({ insumoId: cubierta, nombre: 'Faldon', cantidad: 0.3 * p });

  // Horas: escaladas de la UE del modulo de 3 usuarios (8.3), por persona
  const base = UE.modulo_app_lt_3u;
  const horas = {};
  for (const area of Object.keys(base)) horas[area] = (base[area] / 3) * p;

  const descripcion = `${p} personas = ${f} por lado, ${pares} pares enfrentados, ${largo.toFixed(2)} m de corrida. ` +
    `Lleva ${p} cubiertas, ${esAppLt ? 0 : p} cajas electricas, ${pares} divisores, ${pares} pasacables y ${patas} patas.`;

  return { personas: p, componentes: comps, horas, descripcion, largo, pares, patas };
}
