// ============================================================================
//  GENERADOR PRIVACY 4 · guía GE_Privacy4_2025_09_09 (ESP-DCC-IDP-003, v3).
//  Sistema de MUROS MÓVILES y LAMBRINES (concepto 4x4). Muros de piso a plafón,
//  100% reconfigurables, ortogonales, con caras sólidas y transparentes.
//   - Muro cristal = cristal flotado 9mm discreto por medida (P4CR..N-..T) +
//     juego de rieles (P4JUR, incluye base/riel/2 tapas/2 sombras riel/2 sombras
//     ajuste) + guías inferior/superior (P4GUIN / P4RSUP) + par de niveladoras.
//   - Muro sólido  = poste inicio (P4EPIN) + poste recto (P4EPRE) + juego de
//     gajos (P4JUG, 2 caras) ó gajos corridos (P4GC..-Z) + largueros pasa-cables
//     (P4LARMS) + perfil "U" de aluminio (P4PEUALU).
//   - Puerta       = cancel con marco metálico + cristal templado 9mm, ancho fijo
//     1050mm, abatimiento derecho/izquierdo (P4CAPDCO / P4CAPICO).
//   - Lambrín      = revestimiento (una sola cara) sobre sustrato fijo.
//  Anchos 600/750/900/1200. Alturas 2200-2800 (paso 100). Puerta ancho fijo 105.
//  FASE A: dimensiones reales de la guía; MP metálica estimada (perfil-aluminio /
//  escuadra) por falta de insumo exacto de extrusión / tapa fundida P4.
// ============================================================================

import { aplicarColor } from './colorMelamina.js';
import { coloresDe } from './acabados.js';

const mm = (v) => v / 1000;
const num = (v, def) => parseInt(v) || def;

// Índice de ancho de cara (gajo / cristal / riel) usado en las claves P4.
const A_IDX = { 600: '2', 750: '75', 900: '3', 1200: '4' };

// Acabados de cara (gajo) para muro sólido. Sufijo real de la clave P4.
const ACAB = {
  ABS:      { insumo: 'melamina-28',  suf: 'ABS', label: 'Melamina y canto ABS' },
  chapa:    { insumo: 'chapa-madera', suf: 'CH',  label: 'Chapa de madera' },
  pizarron: { insumo: 'melamina-28',  suf: 'PZ',  label: 'Pizarrón' }, // sin insumo propio → melamina
  tela:     { insumo: 'frente-tela',  suf: 'TE',  label: 'Tapizado en tela' },
};
// Acabados de lambrín: los 4 de gajo + PVC termoformado / laminado HP / cristal.
const ACAB_LAMBRIN = {
  ...ACAB,
  pvc:      { insumo: 'membrana-pvc',    suf: 'PVC', label: 'PVC decorativo (termoformado)' },
  laminado: { insumo: 'laminado',        suf: 'HP',  label: 'Laminado plástico HP' },
  cristal:  { insumo: 'cristal-flotado', suf: 'CR',  label: 'Cristal' },
};

const ANCHOS = [{ id: '600', label: '0.60 m' }, { id: '750', label: '0.75 m' }, { id: '900', label: '0.90 m' }, { id: '1200', label: '1.20 m' }];
const ALTURAS = [
  { id: '2200', label: '2.20 m' }, { id: '2300', label: '2.30 m' }, { id: '2400', label: '2.40 m' },
  { id: '2500', label: '2.50 m' }, { id: '2600', label: '2.60 m' }, { id: '2700', label: '2.70 m' }, { id: '2800', label: '2.80 m' },
];

// Código de altura de 3 dígitos para clave (2800 -> '280').
const hCode = (H) => String(Math.round(H / 10));
// Postes universales, mocheta y perfil "U" sólo existen en 230 / 250 / 280.
const nodeCode = (H) => (H <= 2300 ? '230' : H <= 2500 ? '250' : '280');

const PRIVACY4_PRODUCTOS_BASE = [
  {
    id: 'muro', nombre: 'Muro / Panel',
    selects: [
      { key: 'tipo', label: 'Tipo', opciones: [{ id: 'cristal', label: 'Cristal' }, { id: 'solido', label: 'Sólido' }, { id: 'puerta', label: 'Puerta abatible' }] },
      { key: 'ancho', label: 'Ancho', opciones: ANCHOS },
      { key: 'altura', label: 'Altura', opciones: ALTURAS },
      { key: 'gajos', label: 'Gajos (sólido)', opciones: [{ id: 'juego', label: 'Juego de gajos' }, { id: 'corrido', label: 'Gajos corridos' }] },
      { key: 'mano', label: 'Abatimiento (puerta)', opciones: [{ id: 'der', label: 'Derecha' }, { id: 'izq', label: 'Izquierda' }] },
      { key: 'union', label: 'Unión (remate)', opciones: [{ id: 'esquina', label: 'Esquina' }, { id: 't', label: 'T' }, { id: 'cruz', label: 'Cruz' }] },
    ],
    finishes: [{ id: 'ABS', label: 'Melamina ABS' }, { id: 'chapa', label: 'Chapa' }, { id: 'pizarron', label: 'Pizarrón' }, { id: 'tela', label: 'Tela' }],
    checks: [
      { key: 'acustico', label: 'Aislamiento acústico' },
      { key: 'esquina', label: 'Cancel cristal en esquina' },
      { key: 'remate', label: 'Remate (tapas por unión)' },
      { key: 'mocheta', label: 'Ajuste mocheta a muro' },
    ],
  },
  {
    id: 'lambrin', nombre: 'Lambrín (revestimiento)',
    selects: [
      { key: 'ancho', label: 'Ancho por cara', opciones: ANCHOS },
      { key: 'altura', label: 'Altura', opciones: ALTURAS },
    ],
    finishes: [
      { id: 'ABS', label: 'Melamina ABS' }, { id: 'chapa', label: 'Chapa' }, { id: 'pizarron', label: 'Pizarrón' },
      { id: 'tela', label: 'Tela' }, { id: 'pvc', label: 'PVC termoformado' }, { id: 'laminado', label: 'Laminado HP' }, { id: 'cristal', label: 'Cristal' },
    ],
    checks: [{ key: 'acustico', label: 'Aislamiento acústico' }],
  },
];
// Colores reales de melamina 28mm (catálogo de acabados) para el selector.
export const PRIVACY4_PRODUCTOS = PRIVACY4_PRODUCTOS_BASE.map((p) => ({ ...p, colores: coloresDe('melamina-28') }));

export function generarPrivacy4(config) {
  const c = {
    producto: 'muro', tipo: 'cristal', ancho: '900', altura: '2500', gajos: 'juego', mano: 'der', union: 'esquina',
    finish: 'ABS', acustico: false, esquina: false, remate: false, mocheta: false, ...config,
  };
  const H = num(c.altura, 2500);
  const comp = [];
  const claves = [];
  const electricos = [];
  let nombre = '';

  if (c.producto === 'lambrin') {
    // Lambrín = estructura metálica sobre sustrato fijo + UNA cara de revestimiento.
    const A = num(c.ancho, 900), aI = A_IDX[A] || '3';
    const a = ACAB_LAMBRIN[c.finish] || ACAB_LAMBRIN.ABS;
    const caraH = H - 115;
    nombre = `Privacy 4 · Lambrín ${mm(A).toFixed(2)} × ${mm(H).toFixed(2)} · ${a.label}`;
    comp.push({ insumoId: 'perfil-aluminio', nombre: 'Estructura metálica de lambrín (2 postes)', cantidad: 2 * mm(H) });
    comp.push({ insumoId: a.insumo, nombre: `Cara de revestimiento (${a.label})`, cantidad: 1, largoMM: A, anchoMM: caraH });
    comp.push({ insumoId: 'perfil-aluminio', nombre: 'Largueros pasa-cables + perfil "U"', cantidad: 2 * mm(A) + 2 * mm(H) });
    if (a.insumo !== 'frente-tela' && a.insumo !== 'cristal-flotado') comp.push({ insumoId: 'tapacanto', nombre: 'Canto perímetro cara', cantidad: 2 * (mm(A) + mm(caraH)) });
    if (c.acustico) comp.push({ insumoId: 'pet-acustico', nombre: 'Relleno acústico PET / lana mineral', cantidad: 1, largoMM: A, anchoMM: caraH });
    comp.push({ insumoId: 'escuadra', nombre: 'Herrajes de fijación a sustrato', cantidad: 4 });
    // El lambrín reutiliza el gajo P4 como revestimiento continuo (clave P4GC..-Z).
    claves.push(`P4GC${aI}${hCode(H)}${a.suf}-Z`);
  } else if (c.tipo === 'cristal') {
    const A = num(c.ancho, 900), aI = A_IDX[A] || '3';
    const glassH = H - 24; // altura de cristal = altura instalación − 24mm (2800 → 2776).
    nombre = `Privacy 4 · Muro cristal ${mm(A).toFixed(2)} × ${mm(H).toFixed(2)}`;
    comp.push({ insumoId: 'cristal-flotado', nombre: 'Cristal flotado 9mm, cantos pulidos y abrillantados', cantidad: 1, largoMM: A, anchoMM: glassH });
    comp.push({ insumoId: 'riel', nombre: 'Juego de rieles (base, riel, 2 tapas, 2 sombras riel, 2 sombras ajuste)', cantidad: 1 });
    comp.push({ insumoId: 'perfil-aluminio', nombre: 'Guía inferior + riel estructural superior', cantidad: 2 * mm(A) });
    comp.push({ insumoId: 'nivelador', nombre: 'Par de bases niveladoras (por cristal)', cantidad: 2 });
    comp.push({ insumoId: 'silicon', nombre: 'Silicón unión a hueso', cantidad: 1 });
    claves.push(`P4CR${aI}N-${hCode(H)}T`, `P4JUR${aI}`, `P4GUIN${aI}`, `P4RSUP${aI}-E`);
    if (c.esquina) {
      comp.push({ insumoId: 'riel', nombre: 'Juego cancel cristal en esquina (rieles esquina, soportes, tapas)', cantidad: 1 });
      comp.push({ insumoId: 'nivelador', nombre: 'Par niveladores para remate de aluminio (esquina)', cantidad: 2 });
      claves.push(`P4CCRE${aI}`);
    }
  } else if (c.tipo === 'solido') {
    const A = num(c.ancho, 900), aI = A_IDX[A] || '3';
    const a = ACAB[c.finish] || ACAB.ABS;
    const caraH = H - 115; // gajo (cara) ≈ altura instalación − 115mm (2800 → 2685).
    const corrido = c.gajos === 'corrido';
    nombre = `Privacy 4 · Muro sólido ${mm(A).toFixed(2)} × ${mm(H).toFixed(2)} · ${a.label}${corrido ? ' (gajos corridos)' : ''}`;
    comp.push({ insumoId: 'perfil-aluminio', nombre: 'Estructura poste de inicio (aluminio anodizado)', cantidad: mm(H) + 0.1 });
    comp.push({ insumoId: 'perfil-aluminio', nombre: 'Estructura poste recto (aluminio anodizado)', cantidad: mm(H) + 0.1 });
    comp.push({ insumoId: a.insumo, nombre: `Juego de gajos — 2 caras (${a.label})`, cantidad: 2, largoMM: A, anchoMM: caraH });
    if (a.insumo !== 'frente-tela') comp.push({ insumoId: 'tapacanto', nombre: 'Canto perímetro caras', cantidad: 2 * 2 * (mm(A) + mm(caraH)) });
    comp.push({ insumoId: 'perfil-aluminio', nombre: 'Largueros pasa-cables (superior + inferior)', cantidad: 2 * mm(A) });
    comp.push({ insumoId: 'perfil-aluminio', nombre: 'Perfil "U" de aluminio (2 postes)', cantidad: 2 * mm(H) });
    comp.push({ insumoId: 'escuadra', nombre: 'Placas de fijación / tornillería de postes', cantidad: 4 });
    comp.push({ insumoId: 'silicon', nombre: 'Silicón / sellado acústico', cantidad: 1 });
    claves.push(`P4EPIN${aI}-${hCode(H)}`, `P4EPRE${aI}-${hCode(H)}`);
    claves.push(corrido ? `P4GC${aI}${hCode(H)}${a.suf}-Z` : `P4JUG${aI}-${hCode(H)}${a.suf}`);
    claves.push(`P4LARMS${aI}-E`, `P4PEUALU${nodeCode(H)}`);
  } else if (c.tipo === 'puerta') {
    const A = 1050; // puerta ancho fijo 105 cm.
    const der = c.mano !== 'izq';
    const dIdx = hCode(H + 50); // cancel puerta = altura muro + 50mm (2800 → 285).
    nombre = `Privacy 4 · Puerta abatible ${der ? 'derecha' : 'izquierda'} 1.05 × ${mm(H).toFixed(2)}`;
    comp.push({ insumoId: 'cristal-templado', nombre: 'Cristal templado 9mm (puerta + antepecho)', cantidad: 1, largoMM: A, anchoMM: H });
    comp.push({ insumoId: 'perfil-aluminio', nombre: 'Marco metálico de piso a plafón', cantidad: 2 * mm(H) + 2 * mm(A) });
    comp.push({ insumoId: 'cerradura', nombre: 'Cerradura de acero con llave', cantidad: 1 });
    comp.push({ insumoId: 'bisagra', nombre: 'Bisagras de acero', cantidad: 3 });
    comp.push({ insumoId: 'escuadra', nombre: 'Placa unión marco ↔ rieles + placa inox. resbalón', cantidad: 2 });
    comp.push({ insumoId: 'silicon', nombre: 'Empaque / sello perimetral', cantidad: 1 });
    claves.push(`P4CAP${der ? 'D' : 'I'}CO${dIdx}T`, 'P4COPRSU-T');
  }

  // Opciones comunes de muro (no aplican a lambrín ni entre sí en puerta).
  if (c.producto === 'muro') {
    if (c.tipo !== 'puerta' && c.acustico) {
      const A = num(c.ancho, 900);
      comp.push({ insumoId: 'pet-acustico', nombre: 'Aislamiento acústico (lana mineral / PET)', cantidad: 1, largoMM: A, anchoMM: H - 115 });
    }
    if (c.mocheta) {
      comp.push({ insumoId: 'perfil-aluminio', nombre: 'Ajuste mocheta / búfer a muro (aluminio)', cantidad: mm(H) });
      claves.push(`P4AJMSCRS${nodeCode(H)}`);
    }
    if (c.remate) {
      // Tapas discretas por unión (inferior + superior), NO metros lineales.
      const u = c.union;
      const tapas = u === 't' ? ['P4REMINT-SONI', 'P4REMSUPT-EX'] : u === 'cruz' ? ['P4REMINX-SO', 'P4REMSUPX'] : ['P4REIN-SONI', 'P4REMESUP-EX001'];
      comp.push({ insumoId: 'escuadra', nombre: `Tapa remate inferior (${u}) aluminio fundido`, cantidad: 1 });
      comp.push({ insumoId: 'escuadra', nombre: `Tapa remate superior (${u}) aluminio fundido`, cantidad: 1 });
      claves.push(...tapas);
      if (u !== 'esquina') {
        const suf = u === 't' ? 'T' : ''; // cruz = poste universal base; T = sufijo T.
        comp.push({ insumoId: 'perfil-aluminio', nombre: `Poste universal (${u}) aluminio`, cantidad: mm(H) });
        comp.push({ insumoId: 'escuadra', nombre: 'Placa unión poste universal ↔ rieles superiores', cantidad: 1 });
        claves.push(`P4POUN85${nodeCode(H)}${suf}`, 'P4COPRIN-T');
      }
    }
    electricos.push('Contactos / controles de aire / seguridad / iluminación (voz-datos, aparte)');
  }

  return aplicarColor({
    producto: c.producto, nombre, componentes: comp, claves, electricos,
    modoManoObra: 'porcentaje', factorDirecta: 38, factorIndirecta: 12,
    nota: 'Privacy 4 (Fase A): sistema de muros móviles y lambrines. Claves reales de la guía GE_Privacy4_2025_09_09 (cristales P4CR, postes P4EPIN/P4EPRE, gajos P4JUG/P4GC, puerta P4CAPDCO/P4CAPICO, rieles P4JUR, guías P4GUIN/P4RSUP, perfil U P4PEUALU, largueros P4LARMS, postes universales P4POUN, mocheta P4AJMSCRS, remates P4REIN/P4REMESUP...). Estructura metálica (postes, rieles, largueros, perfil U, mocheta, tapas de remate) estimada vía perfil-aluminio / escuadra por falta de insumo exacto de extrusión y tapa fundida P4; pizarrón sin insumo propio → melamina-28. Falta calibrar con lista de MP real (cristal, aluminio, gajos por acabado).',
  }, c);
}
