// ============================================================================
//  GENERADOR FLEX · guía GE_Flex (ESP-DCC-IDP-003, v3 2025-09-09). Mobiliario
//  POLIVALENTE oficina-casa: reconfigurable, con base METÁLICA PLEGABLE y
//  conexiones eléctricas escalables. Escritorios (con/sin cajón, versión MÓVIL
//  con ruedas SOLO 90/120), biombos Covid (metal 2018) y de acrílico, biombos
//  frontal/horizontal, divisor 600, privacía H40/H60, faldones metálicos
//  (lisos/perforados, medidas reales 807/1107/1417×439×23) y bancas dobles.
//  Escritorios de 1500 llevan tensores diagonales redondos (FXCON38M-CO).
//  Cubierta melamina 19 canto ABS. Claves FX reales de la guía.
//
//  IMPORTANTE (sistemas eléctricos, ver guía):
//   · Escritorio / bench individual  → Byrne INTERLINK iQ 2.0 (caja bajo cubierta).
//   · BANCA DOBLE                     → Byrne PHASE 2 arnés (BE52413 caja doble,
//                                        BE52426 contactos, BE52418 conector Y).
//  Los dos NO se mezclan.
//  FASE A: estructura + dimensiones reales de la guía; MP metálica estimada.
// ============================================================================
const CUB = 'melamina-19', CANTO = 'tapacanto', PTR = 'ptr', LAMINA = 'lamina-20';
const ACRIL = 'acrilico', PINTURA = 'pintura-electrostatica';
const KG20 = 7.16; // kg de lámina cal.20 por m² (21.3 kg/hoja ÷ 2.9768 m²)
const laminaKg = (m2) => m2 * KG20;
const num = (v, def) => parseInt(v) || def;
const mm = (v) => v / 1000;

// ---- Tablas reales de la guía GE_Flex ----------------------------------------
// Escritorio: FXESC[CA|CM][23|24|25]M19ABS   (23=900, 24=1200, 25=1500)
const ESC_IDX = { 900: '23', 1200: '24', 1500: '25' };
// Base plegable (pza estructural). 1200 usa índice "42", 1500 usa "25" (guía).
const BASE_CLAVE  = { 900: 'FXEST23M', 1200: 'FXEST42M', 1500: 'FXEST25M' };
const BASE_MOVIL  = { 900: 'FXESTM23M', 1200: 'FXESTM42M' };
// Cubierta: con cajón+charola FXSESUP##ABS ; sin cajón FXSESUSC##ABS.
const CUB_UP = { 900: 'FXSESUP23ABS', 1200: 'FXSESUP42ABS', 1500: 'FXSESUP25ABS' };
const CUB_SC = { 900: 'FXSESUSC23ABS', 1200: 'FXSESUSC42ABS', 1500: 'FXSESUSC25ABS' };
// Biombo Covid: infijo "C" en anchos ≥1196; alturas 600→600, 900→720, 1196/1500→600.
const COVID = {
  600:  { idx: '2', C: '',  alto: 600, esp: 25, realW: 600 },
  900:  { idx: '3', C: '',  alto: 720, esp: 25, realW: 900 },
  1200: { idx: '4', C: 'C', alto: 600, esp: 19, realW: 1196 },
  1500: { idx: '5', C: 'C', alto: 600, esp: 19, realW: 1500 },
};
// Biombo acrílico: FXBIODBD[3|4|5]AC, alto 459, esp 34 (SOLO 900/1200/1500).
const ACR = { 900: { idx: '3', realW: 900 }, 1200: { idx: '4', realW: 1198 }, 1500: { idx: '5', realW: 1500 } };
// Faldón: FXFAL[3|4|5]M[P], alto 439, esp 23. Anchos reales 807/1107/1417.
const FAL = { 900: { idx: '3', realW: 807 }, 1200: { idx: '4', realW: 1107 }, 1500: { idx: '5', realW: 1417 } };

export const FLEX_PRODUCTOS = [
  {
    id: 'escritorio', nombre: 'Escritorio plegable',
    selects: [
      { key: 'largo', label: 'Largo', opciones: [{ id: '900', label: '0.90 m' }, { id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }] },
      { key: 'cajon', label: 'Cajón + charola', opciones: [{ id: 'no', label: 'Sin cajón' }, { id: 'si', label: 'Con cajón' }] },
    ],
    checks: [
      { key: 'movil', label: 'Móvil con ruedas (solo 90/120)' },
      { key: 'faldon', label: 'Faldón metálico' },
      { key: 'perforado', label: 'Faldón perforado' },
      { key: 'electrico', label: 'Caja Byrne Interlink iQ' },
    ],
  },
  {
    id: 'banca_doble', nombre: 'Banca doble',
    selects: [
      { key: 'usuarios', label: 'Puestos', opciones: [{ id: '2', label: '2' }, { id: '4', label: '4' }] },
      { key: 'largo', label: 'Largo por puesto', opciones: [{ id: '900', label: '0.90 m' }, { id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }] },
      { key: 'biombo', label: 'Biombo', opciones: [{ id: 'acrilico', label: 'Acrílico' }, { id: 'covid', label: 'Post-Covid (metal)' }] },
    ],
    checks: [{ key: 'electrico', label: 'Arnés eléctrico Byrne Phase 2' }],
  },
  {
    id: 'biombo', nombre: 'Biombo',
    selects: [
      { key: 'tipo', label: 'Tipo', opciones: [
        { id: 'covid_lateral', label: 'Covid lateral / punta (metal)' },
        { id: 'covid_frontal', label: 'Covid frontal / horizontal (metal)' },
        { id: 'divisor', label: 'Divisor 600 (metal)' },
        { id: 'acrilico', label: 'Acrílico' },
        { id: 'privacia_h40', label: 'Privacía H40' },
        { id: 'privacia_h60', label: 'Privacía Post-Covid H60' },
      ] },
      { key: 'largo', label: 'Largo', opciones: [{ id: '600', label: '0.60 m' }, { id: '900', label: '0.90 m' }, { id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }] },
    ],
  },
  {
    id: 'faldon', nombre: 'Faldón metálico',
    selects: [{ key: 'largo', label: 'Largo', opciones: [{ id: '900', label: '0.90 m' }, { id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }] }],
    checks: [{ key: 'perforado', label: 'Perforado' }],
  },
];

// ---- Sub-ensambles -----------------------------------------------------------

// Base metálica plegable (FXEST / FXESTM). Tubo PTR plegable + placas de lámina
// + bisagras de plegado + pintura + niveladores (móvil: rodajas con freno).
function basePlegable(comp, largoMM, movil) {
  const clave = movil ? (BASE_MOVIL[largoMM] || 'FXESTM42M') : (BASE_CLAVE[largoMM] || 'FXEST42M');
  comp.push({ insumoId: PTR, nombre: `Estructura plegable ${clave} (metal 2018)`, cantidad: 2 * 0.73 + 2 * 0.584 + 2 * mm(largoMM) + 0.5 });
  comp.push({ insumoId: LAMINA, nombre: 'Placas/refuerzos de plegado (lámina cal.20)', cantidad: laminaKg(0.25) });
  comp.push({ insumoId: 'bisagra', nombre: 'Bisagras de plegado', cantidad: 2 });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática estructura', cantidad: 1, largoMM: 1148, anchoMM: 732 });
  if (movil) {
    comp.push({ insumoId: 'rodaja', nombre: 'Rodajas con freno', cantidad: 4 });
  } else {
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
  }
}

// Cubierta melamina 19 mm canto ABS + grommet. Con cajón: charola+cajón metálicos.
function cubierta(comp, claves, largoMM, conCajon) {
  const clave = (conCajon ? CUB_UP[largoMM] : CUB_SC[largoMM]) || (conCajon ? 'FXSESUP42ABS' : 'FXSESUSC42ABS');
  comp.push({ insumoId: CUB, nombre: `Cubierta melamina 19 canto ABS (${clave})`, cantidad: 1, largoMM, anchoMM: 600 });
  comp.push({ insumoId: CANTO, nombre: 'Canto ABS perímetro cubierta', cantidad: 2 * (mm(largoMM) + 0.6) });
  comp.push({ insumoId: 'pasacables', nombre: 'Grommet pasacables', cantidad: 1 });
  if (conCajon) {
    comp.push({ insumoId: LAMINA, nombre: 'Cajón + charola metálicos (lámina cal.20)', cantidad: laminaKg(0.5) });
    comp.push({ insumoId: 'corredera', nombre: 'Correderas cajón', cantidad: 1 });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura cajón/charola', cantidad: 0.5, largoMM, anchoMM: 600 });
  }
}

// Panel de biombo metálico (Covid / frontal / divisor / privacía): lámina + pintura.
function panelMetal(comp, nombre, clave, anchoMM, altoMM, claves) {
  const m2 = mm(anchoMM) * mm(altoMM);
  comp.push({ insumoId: LAMINA, nombre: `${nombre} (lámina cal.20)`, cantidad: laminaKg(m2) });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura biombo', cantidad: m2, largoMM: anchoMM, anchoMM: altoMM });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillo perilla / herrajes biombo', cantidad: 1 });
  if (clave) claves.push(clave);
}

// Biombo Covid lateral (por ancho, con su altura de tabla).
function biomboCovid(comp, claves, anchoMM, altoOverride) {
  const d = COVID[anchoMM] || COVID[1200];
  const alto = altoOverride || d.alto;
  panelMetal(comp, `Biombo Covid metálico ${d.realW}×${alto}×${d.esp}`, 'FXBIOSPD' + d.C + d.idx + 'MP', d.realW, alto, claves);
}

// Biombo acrílico (panel acrílico + marco metálico).
function biomboAcrilico(comp, claves, anchoMM) {
  const d = ACR[anchoMM] || ACR[1200];
  comp.push({ insumoId: ACRIL, nombre: `Panel acrílico biombo ${d.realW}×459×34`, cantidad: 1, largoMM: d.realW, anchoMM: 459 });
  comp.push({ insumoId: PTR, nombre: 'Marco metálico biombo acrílico', cantidad: 2 * mm(d.realW) + 2 * 0.459 });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillo perilla biombo', cantidad: 1 });
  claves.push('FXBIODBD' + d.idx + 'AC');
}

// Faldón metálico (liso/perforado), medidas reales.
function faldonMetal(comp, claves, anchoMM, perforado) {
  const d = FAL[anchoMM] || FAL[1200];
  const m2 = mm(d.realW) * 0.439;
  comp.push({ insumoId: LAMINA, nombre: `Faldón ${perforado ? 'perforado ' : ''}${d.realW}×439×23 (lámina cal.20)`, cantidad: laminaKg(m2) });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura faldón', cantidad: m2, largoMM: d.realW, anchoMM: 439 });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillo allen faldón', cantidad: 1 });
  claves.push('FXFAL' + d.idx + 'M' + (perforado ? 'P' : ''));
}

// Juego de herrajes de unión de biombos: cruz (+) FXJDHBC / T FXJDHBTI.
function herrajeUnion(comp, claves, tipo, n) {
  const clave = tipo === 'cruz' ? 'FXJDHBC' : 'FXJDHBTI';
  comp.push({ insumoId: LAMINA, nombre: `Juego de herrajes ${tipo === 'cruz' ? 'en cruz' : 'en T'} ${clave} (metal 2018)`, cantidad: laminaKg(0.3) * n });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería herrajes de unión', cantidad: n });
  claves.push(clave);
}

// ---- Generador ---------------------------------------------------------------
export function generarFlex(config) {
  const c = {
    producto: 'escritorio', largo: '1200', cajon: 'no', usuarios: '2', biombo: 'acrilico',
    tipo: 'covid_lateral', movil: false, faldon: false, perforado: false, electrico: false, ...config,
  };
  const largo = num(c.largo, 1200);
  const comp = [];
  const claves = [];
  const electricos = [];
  const notas = [];

  // Byrne INTERLINK iQ (escritorio/bench individual, bajo cubierta).
  const cajaInterlink = (n) => {
    comp.push({ insumoId: 'byrne-interlink', nombre: 'Caja eléctrica Byrne Interlink iQ (START/MiniTap)', cantidad: n });
    comp.push({ insumoId: 'acometida', nombre: 'Acometida + control box Interlink iQ 2.0', cantidad: 1 });
    electricos.push(`${n} caja(s) Byrne Interlink iQ + acometida BE07116 + control box BE05930 (aparte)`);
  };

  // Byrne PHASE 2 (arnés de banca doble).
  const arnesPhase2 = (n) => {
    comp.push({ insumoId: 'byrne-phase2', nombre: 'Caja eléctrica doble Byrne Phase 2 (BE52413)', cantidad: n });
    comp.push({ insumoId: 'byrne-phase2', nombre: 'Contactos Phase 2 (BE52426)', cantidad: 2 * n });
    comp.push({ insumoId: 'byrne-phase2', nombre: 'Conector en Y Phase 2 (BE52418)', cantidad: Math.max(1, n - 1) });
    comp.push({ insumoId: 'acometida', nombre: 'Acometida Phase 2 (BE52490-2-72)', cantidad: 1 });
    electricos.push(`Arnés Byrne PHASE 2: ${n} caja doble BE52413 + contactos BE52426 + conector Y BE52418 + acometida BE52490`);
  };

  let tipoRender = 'escritorio', nombre = '';

  if (c.producto === 'escritorio') {
    const movil = !!c.movil && largo <= 1200;      // móvil SOLO 90/120
    if (c.movil && largo === 1500) notas.push('Flex Móvil no existe en 1500 (solo 90/120); se costeó como fijo.');
    const conCajon = c.cajon === 'si' || movil;    // la versión móvil siempre trae cajón+charola
    cubierta(comp, claves, largo, conCajon);
    basePlegable(comp, largo, movil);
    comp.push({ insumoId: 'tornilleria', nombre: 'Ligas sujetadoras FXFLDU + tornillo allen TOA1412CBG', cantidad: 1 });
    if (largo >= 1500) {
      comp.push({ insumoId: PTR, nombre: 'Tensores diagonales redondos 3/8" (FXCON38M-CO)', cantidad: 2 * 1.7 });
      notas.push('El escritorio 1500 lleva 2 tensores diagonales (FXCON38M-CO).');
    }
    if (c.faldon) faldonMetal(comp, claves, largo, !!c.perforado);
    if (c.electrico) cajaInterlink(1);
    const pref = movil ? 'CM' : (conCajon ? 'CA' : '');
    claves.unshift('FXESC' + pref + ESC_IDX[largo] + 'M19ABS');
    tipoRender = 'escritorio';
    nombre = `Flex · Escritorio ${conCajon ? 'con cajón ' : ''}${movil ? 'móvil ' : ''}${mm(largo).toFixed(2)} m`;

  } else if (c.producto === 'banca_doble') {
    const nUs = num(c.usuarios, 2);
    const covid = c.biombo === 'covid';
    for (let i = 0; i < nUs; i++) {
      cubierta(comp, claves, largo, true);
      basePlegable(comp, largo, false);
      comp.push({ insumoId: 'tornilleria', nombre: 'Ligas sujetadoras FXFLDU', cantidad: 1 });
    }
    if (covid) {
      // Biombo frontal (horizontal) por puesto, al ancho de la cubierta, H600.
      for (let i = 0; i < nUs; i++) biomboCovid(comp, claves, largo, 600);
      // Biombos laterales de 900 en las 2 puntas + divisor 600 intermedio.
      biomboCovid(comp, claves, 900);
      biomboCovid(comp, claves, 900);
      biomboCovid(comp, claves, 600);
      // Herrajes: cruz (+) al centro, T en las orillas.
      herrajeUnion(comp, claves, 'cruz', Math.max(1, nUs / 2));
      herrajeUnion(comp, claves, 't', 2);
    } else {
      // Banca doble con biombo de acrílico: uno frontal por puesto al ancho de cubierta.
      for (let i = 0; i < nUs; i++) biomboAcrilico(comp, claves, largo);
    }
    if (c.electrico) arnesPhase2(nUs / 2);
    tipoRender = 'bench';
    nombre = `Flex · Banca doble ${nUs} puestos ${mm(largo).toFixed(2)} m · biombo ${covid ? 'Post-Covid' : 'acrílico'}`;

  } else if (c.producto === 'biombo') {
    const t = c.tipo;
    if (t === 'acrilico') {
      const w = ACR[largo] ? largo : 1200;
      if (!ACR[largo]) notas.push('Biombo acrílico solo existe en 900/1200/1500; se usó 1200.');
      biomboAcrilico(comp, claves, w);
      nombre = `Flex · Biombo acrílico ${mm(w).toFixed(2)} m`;
    } else if (t === 'divisor') {
      biomboCovid(comp, claves, 600);
      nombre = 'Flex · Biombo divisor 600 (metal)';
    } else if (t === 'covid_frontal') {
      const w = COVID[largo] ? largo : 1200;
      biomboCovid(comp, claves, w, 600);
      nombre = `Flex · Biombo frontal/horizontal ${mm(w).toFixed(2)} m`;
    } else if (t === 'privacia_h40' || t === 'privacia_h60') {
      const alto = t === 'privacia_h40' ? 400 : 600;
      const w = COVID[largo] ? largo : 1200;
      // H60 Post-Covid comparte panel metálico Covid (clave FXBIOSPD por ancho).
      const clave = t === 'privacia_h60' ? ('FXBIOSPD' + (COVID[w].C) + COVID[w].idx + 'MP') : '';
      panelMetal(comp, `Biombo privacía ${t === 'privacia_h40' ? 'H40' : 'H60'} ${w}×${alto}`, clave, w, alto, claves);
      if (t === 'privacia_h40') notas.push('Privacía H40: la guía no publica clave FX explícita; panel metálico costeado por medida.');
      nombre = `Flex · Biombo privacía ${t === 'privacia_h40' ? 'H40' : 'Post-Covid H60'} ${mm(w).toFixed(2)} m`;
    } else {
      // covid_lateral / punta
      const w = COVID[largo] ? largo : 1200;
      biomboCovid(comp, claves, w);
      nombre = `Flex · Biombo Covid lateral ${mm(w).toFixed(2)} m`;
    }
    tipoRender = 'mampara';

  } else if (c.producto === 'faldon') {
    faldonMetal(comp, claves, largo, !!c.perforado);
    tipoRender = 'mampara';
    nombre = `Flex · Faldón ${c.perforado ? 'perforado ' : ''}${mm(largo).toFixed(2)} m`;
  }

  return {
    producto: c.producto, nombre, componentes: comp, claves, electricos,
    modoManoObra: 'porcentaje', factorDirecta: 36, factorIndirecta: 12,
    nota: 'Flex (Fase A): línea polivalente plegable (metal + melamina). Dimensiones y CLAVES reales de la guía GE_Flex. MP metálica estimada (melamina 19 canto ABS; lámina cal.20 en base plegable, cajón/charola, biombos Covid, faldones y herrajes; acrílico en biombos DBD; PTR en tensores/marco). Sin insumoId exacto → usados: base plegable/estructura y tensores redondos FXCON38M-CO = "ptr" (mismo material metálico lineal); herrajes de unión FXJDHBC/FXJDHBTI = "lamina-20" (metal fabricado) + "tornilleria"; ligas sujetadoras FXFLDU y tornillo allen TOA1412CBG = "tornilleria" (no hay liga de hule ni tornillo específico en el catálogo). Falta calibrar con lista de MP real + desarrollo exacto de la base plegable y de los herrajes de biombo.'
      + (notas.length ? ' | ' + notas.join(' ') : ''),
  };
}
