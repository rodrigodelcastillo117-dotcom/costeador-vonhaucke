// ============================================================================
//  DATOS SEMILLA - Piezas / recetas de arranque (master 5.4)
//  Las cantidades son NETAS de la pieza terminada, sin merma (6.1).
//  Solo se precargan las que tienen UE medida; el resto se arma en el
//  Costeador y se guarda con "Guardar como pieza".
// ============================================================================

import { UE } from './ue.js';

export const PIEZAS_SEMILLA = [
  // --- Escritorio App LT 1.60 x 0.70, 1 usuario (UE medida) ---
  {
    id: 'escritorio-app-lt-160',
    nombre: 'Escritorio App LT 1.60 x 0.70',
    linea: 'app_lt',
    familia: 'escritorios_operativos',
    mueble: 'escritorio',
    referencia: '1.60 x 0.70 con cajonera de 2 gavetas',
    componentes: [
      { insumoId: 'melamina-19', nombre: 'Cubierta', cantidad: 1.12, largoMM: 1600, anchoMM: 700, piezas: 1, cantos: 3 },
      { insumoId: 'melamina-19', nombre: 'Faldon', cantidad: 0.32 }, // mismo material: cae en el retazo de la cubierta (8.5)
      { insumoId: 'tapacanto', nombre: 'Tapacanto', cantidad: 4.6 },
      { insumoId: 'lamina-20', nombre: 'Estructura lamina', cantidad: 4.2 },
      { insumoId: 'ptr', nombre: 'Patas PTR', cantidad: 3.2 },
      { insumoId: 'pintura-electrostatica', nombre: 'Pintura estructura', cantidad: 0.9 },
      { insumoId: 'corredera', nombre: 'Correderas cajonera', cantidad: 2 },
      { insumoId: 'jaladera', nombre: 'Jaladeras', cantidad: 2 },
      { insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 },
      { insumoId: 'tornilleria', nombre: 'Tornilleria', cantidad: 1 },
    ],
    horas: UE.escritorio_app_lt_1u,
    modoManoObra: 'horas',
    factorDirecta: 17,
    factorIndirecta: 12,
    preparacionHoras: 0,
    esAMedida: false,
    creada: '2026-08-11',
  },

  // --- Modulo bench App LT, 3 usuarios (UE medida) ---
  {
    id: 'bench-app-lt-3u',
    nombre: 'Bench App LT 3 usuarios',
    linea: 'app_lt',
    familia: 'escritorios_operativos',
    mueble: 'bench',
    referencia: '3 posiciones, corrida de 4.20 m',
    componentes: [
      { insumoId: 'melamina-19', nombre: 'Cubiertas (3)', cantidad: 3.36, piezas: 3 },
      { insumoId: 'tapacanto', nombre: 'Tapacanto', cantidad: 13.8 },
      { insumoId: 'lamina-20', nombre: 'Estructura lamina', cantidad: 12.6 },
      { insumoId: 'ptr', nombre: 'Patas y corrida PTR', cantidad: 9.6 },
      { insumoId: 'pintura-electrostatica', nombre: 'Pintura estructura', cantidad: 2.7 },
      { insumoId: 'divisor-melamina', nombre: 'Divisores', cantidad: 1.4 },
      { insumoId: 'pasacables', nombre: 'Pasacables', cantidad: 1 },
      { insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 8 },
      { insumoId: 'tornilleria', nombre: 'Tornilleria', cantidad: 3 },
    ],
    horas: UE.modulo_app_lt_3u,
    modoManoObra: 'horas',
    factorDirecta: 17,
    factorIndirecta: 12,
    preparacionHoras: 0,
    esAMedida: false,
    creada: '2026-08-11',
  },

  // --- Eclipse Cantilever (UE medida) - el caso que revienta el porcentaje ---
  {
    id: 'eclipse-cantilever',
    nombre: 'Eclipse Cantilever 2.40 x 2.40',
    linea: 'eclipse',
    familia: 'escritorios_operativos',
    mueble: 'escritorio',
    referencia: 'Cantilever izquierdo, 2 cajones archivero y 2 papeleros, ecopiel, cerradura StealthLock, chapa de madera',
    componentes: [
      { insumoId: 'chapa-madera', nombre: 'Cubierta chapa', cantidad: 2.2, largoMM: 2400, anchoMM: 750, piezas: 1 },
      { insumoId: 'chapa-madera', nombre: 'Credenza y cajones', cantidad: 3.4 },
      { insumoId: 'nogal', nombre: 'Detalles nogal', cantidad: 6 },
      { insumoId: 'ecopiel', nombre: 'Ecopiel cubierta y tapas', cantidad: 4.5 },
      { insumoId: 'lamina-20', nombre: 'Estructura', cantidad: 8.5 },
      { insumoId: 'barniz', nombre: 'Barniz', cantidad: 5.8 },
      { insumoId: 'corredera', nombre: 'Correderas', cantidad: 4 },
      { insumoId: 'cerradura-electronica', nombre: 'Cerradura StealthLock', cantidad: 1 },
      { insumoId: 'caja-electrica', nombre: 'Caja electrica', cantidad: 1 },
      { insumoId: 'jaladera', nombre: 'Jaladeras', cantidad: 4 },
      { insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 },
    ],
    horas: UE.eclipse_cantilever,
    modoManoObra: 'horas',
    factorDirecta: 17,
    factorIndirecta: 12,
    preparacionHoras: 4,
    esAMedida: false,
    creada: '2026-08-11',
  },
];
