// ============================================================================
//  GENERADOR ACCENTS · guía GE_Accents (ESP-DCC-IDP-003, v3 2025-09-09). Línea
//  de ACCESORIOS y complementos. Alcance real de la guía:
//    · Accesorios de acrílico (ACCDA, ACLAA, ACPPA, ACORAC, ACPR3, ACPIPAC,
//      ACPIAC, ACORVA) — 5 mm.
//    · Carpetas = tapetes tapizados en vinipiel (ACTSC9P, ACCSC4105).
//    · Mesas de centro metal + cristal/mármol (ACMC..), mesa lateral (ACML..),
//      base especial LROCTA-BACU.
//    · Percheros (TSPER3M/6M), pizarrones móviles TeamSpace (TSPIZ58M/59M).
//    · Portapantallas TeamSpace (ACTSSP55C/40C/232).
//    · Semimampara (ACSMAS2G) y biombos divisores (ACBIODIV6M2AC/9M2AC).
//    · Recycle: gabinetes ACCR/ACCRCF, bote ACBP25X12.
//    · Organizadores: Kart ACGBCR, Box ACCO10/15/30, ACCOB15.
//    · Mesas para laptop (ACMELAP60/64 · ABS/TF).
//    · Base de altura ajustable ACBASMAJCRA y portamonitores (comprados MVL..).
//  FASE A: dimensiones y CLAVES reales de la guía; MP estimada (calibrar).
// ============================================================================
const ACRIL = 'acrilico', ACRIL6 = 'acrilico-6', VINIPIEL = 'ecopiel', MDF = 'mdf-16';
const MEL = 'melamina-19', MEMBRANA = 'membrana-pvc', CANTO = 'tapacanto';
const PTR = 'ptr', LAMINA = 'lamina-20', ALUM = 'perfil-aluminio';
const PINTURA = 'pintura-electrostatica';
const CRISTAL = 'cristal-satinado', MARMOL = 'marmol', TEMPLADO = 'cristal-templado';
const LAMINADO = 'laminado';
const KG20 = 7.16;
const laminaKg = (m2) => m2 * KG20;
const mm = (v) => (v / 1000);
const num = (v, def) => parseInt(v) || def;

export const ACCENTS_PRODUCTOS = [
  {
    id: 'acrilico', nombre: 'Accesorio de acrílico',
    selects: [{ key: 'tipo', label: 'Accesorio', opciones: [
      { id: 'organizador', label: 'Organizador papelero (ACCDA)' },
      { id: 'lapices', label: 'Porta lápices (ACLAA)' },
      { id: 'postit', label: 'Porta post-it (ACPPA)' },
      { id: 'organizador2', label: 'Organizador papelero (ACORAC)' },
      { id: 'retrato', label: 'Porta retrato (ACPR3)' },
      { id: 'ipad', label: 'Porta iPad (ACPIPAC)' },
      { id: 'celular', label: 'Porta celular (ACPIAC)' },
      { id: 'carpeta', label: 'Porta carpeta vertical (ACORVA)' },
    ] }],
  },
  {
    id: 'carpeta', nombre: 'Tapete / carpeta (vinipiel)',
    selects: [{ key: 'modelo', label: 'Modelo', opciones: [
      { id: 'ACTSC9P', label: 'Rectangular 60 × 40 cm (ACTSC9P)' },
      { id: 'ACCSC4105', label: 'Grande 120 × 105.9 cm (ACCSC4105)' },
    ] }],
  },
  {
    id: 'mesa_centro', nombre: 'Mesa de centro',
    selects: [
      { key: 'forma', label: 'Forma', opciones: [{ id: 'cuadrada', label: 'Cuadrada' }, { id: 'circular', label: 'Circular' }] },
      { key: 'medida', label: 'Medida', opciones: [{ id: '60', label: '0.60 m' }, { id: '90', label: '0.90 m' }, { id: '120', label: '1.20 m' }] },
      { key: 'cubierta', label: 'Cubierta', opciones: [
        { id: 'cristal', label: 'Cristal satinado 9 mm' },
        { id: 'marmol', label: 'Mármol carrara 20 mm' },
        { id: 'tangerine', label: 'Satineshine tangerine 12 mm' },
        { id: 'templado', label: 'Cristal satinado templado 9 mm' },
      ] },
    ],
  },
  {
    id: 'mesa_lateral', nombre: 'Mesa lateral (alta)',
    selects: [
      { key: 'forma', label: 'Forma', opciones: [{ id: 'cuadrada', label: 'Cuadrada' }, { id: 'circular', label: 'Circular' }] },
      { key: 'cubierta', label: 'Cubierta', opciones: [
        { id: 'cristal', label: 'Cristal satinado 9 mm' },
        { id: 'marmol', label: 'Mármol carrara 20 mm' },
      ] },
    ],
  },
  { id: 'base_mesa', nombre: 'Base especial p/ mesa (LROCTA-BACU)' },
  {
    id: 'perchero', nombre: 'Perchero',
    selects: [{ key: 'patas', label: 'Tamaño', opciones: [{ id: '3', label: '3 patas (0.90 m)' }, { id: '6', label: '6 patas (1.63 m)' }] }],
  },
  {
    id: 'mesa_laptop', nombre: 'Mesa para laptop',
    selects: [{ key: 'medida', label: 'Medida', opciones: [{ id: '60', label: '0.60 m' }, { id: '64', label: '0.64 m' }] }],
    finishes: [{ id: 'ABS', label: 'Melamina' }, { id: 'TF', label: 'Termoformado' }],
  },
  {
    id: 'pizarron', nombre: 'Pizarrón móvil (TeamSpace)',
    selects: [{ key: 'medida', label: 'Medida', opciones: [{ id: '58', label: '1.77 m' }, { id: '59', label: '1.80 m' }] }],
  },
  {
    id: 'portapantalla', nombre: 'Portapantalla TeamSpace',
    selects: [{ key: 'pulgadas', label: 'Pantalla', opciones: [
      { id: '55', label: '55" (ACTSSP55C)' }, { id: '40', label: '40" (ACTSSP40C)' }, { id: '32', label: '32" (ACTSSP232)' },
    ] }],
  },
  {
    id: 'semimampara', nombre: 'Semimampara / biombo divisor',
    selects: [{ key: 'modelo', label: 'Modelo', opciones: [
      { id: 'semi', label: 'Semimampara acrílico (ACSMAS2G)' },
      { id: 'biombo6', label: 'Biombo divisor 6 mm (ACBIODIV6M2AC)' },
      { id: 'biombo9', label: 'Biombo divisor 9 mm (ACBIODIV9M2AC)' },
    ] }],
  },
  {
    id: 'recycle', nombre: 'Recycle (gabinete / bote)',
    selects: [{ key: 'modelo', label: 'Modelo', opciones: [
      { id: 'gabinete', label: 'Gabinete reciclado 2 puertas (ACCR)' },
      { id: 'gabinete_esp', label: 'Gabinete reciclado especial (ACCRCF)' },
      { id: 'bote', label: 'Bote de basura (ACBP25X12)' },
    ] }],
  },
  {
    id: 'organizador', nombre: 'Organizador metálico',
    selects: [{ key: 'modelo', label: 'Modelo', opciones: [
      { id: 'kart', label: 'Kart rodante (ACGBCR)' },
      { id: 'box10', label: 'Box 10 (ACCO10)' },
      { id: 'box15', label: 'Box 15 (ACCO15)' },
      { id: 'box30', label: 'Box 30 (ACCO30)' },
      { id: 'boxb15', label: 'Box B15 (ACCOB15)' },
    ] }],
  },
  { id: 'base_ajustable', nombre: 'Base de altura ajustable (ACBASMAJCRA)' },
  {
    id: 'portamonitor', nombre: 'Portamonitor (comprado)',
    selects: [{ key: 'modelo', label: 'Modelo', opciones: [
      { id: 'b1', label: '1 brazo articulado' },
      { id: 'b2', label: '2 brazos articulados' },
      { id: 'b2v', label: '2 brazos en "V"' },
      { id: 'b3', label: '3 brazos articulados' },
      { id: 'art', label: '1 brazo carga 4-10 kg' },
      { id: 'tab', label: 'Soporte tablet a piso' },
    ] }],
  },
];

// --- claves reales de mesa de centro / lateral --------------------------------
//  Circular: -CSC{m} (cristal), -MCAC{m} (mármol), -CEC{m}T (tangerine).
//  Cuadrada: -CS{n} (cristal), -MCA{n} (mármol) con n = 22/33/44 por 60/90/120.
function claveMesa(prefijo, forma, size, cubierta) {
  const n = { 60: '22', 90: '33', 120: '44' }[size] || '22';
  if (forma === 'circular') {
    // El circular de 90 aparece como ACMCC90 en la guía.
    const p = prefijo === 'ACMC' && size === 90 ? 'ACMCC90' : prefijo + size;
    if (cubierta === 'marmol') return `${prefijo}${size}-MCAC${size}`;
    if (cubierta === 'tangerine') return `${prefijo}${size}-CEC${size}T`;
    return `${p}-CSC${size}`; // cristal satinado / templado
  }
  if (cubierta === 'marmol') return `${prefijo}${size}-MCA${n}`;
  if (cubierta === 'tangerine') return `${prefijo}${size}-CEC${n}T`;
  return `${prefijo}${size}-CS${n}`;
}

const cubiertaInsumo = {
  cristal: { id: CRISTAL, nom: 'Cubierta cristal satinado 9 mm' },
  marmol: { id: MARMOL, nom: 'Cubierta mármol carrara 20 mm' },
  tangerine: { id: CRISTAL, nom: 'Cubierta cristal satineshine tangerine 12 mm' },
  templado: { id: TEMPLADO, nom: 'Cubierta cristal satinado templado 9 mm' },
};

export function generarAccents(config) {
  const c = {
    producto: 'acrilico', tipo: 'organizador', modelo: 'ACTSC9P',
    forma: 'cuadrada', medida: '60', cubierta: 'cristal', patas: '3',
    finish: 'ABS', pulgadas: '55', ...config,
  };
  const comp = [];
  const claves = [];
  let tipoRender = 'mesita', nombre = '';

  if (c.producto === 'acrilico') {
    // [clave, etiqueta, desarrollo plano de lámina aprox (mm×mm)]
    const A = {
      organizador: ['ACCDA', 'Organizador papelero', [620, 450]],
      lapices: ['ACLAA', 'Porta lápices', [360, 180]],
      postit: ['ACPPA', 'Porta post-it', [360, 180]],
      organizador2: ['ACORAC', 'Organizador papelero', [620, 440]],
      retrato: ['ACPR3', 'Porta retrato', [270, 180]],
      ipad: ['ACPIPAC', 'Porta iPad', [320, 300]],
      celular: ['ACPIAC', 'Porta celular', [220, 180]],
      carpeta: ['ACORVA', 'Porta carpeta vertical', [420, 360]],
    }[c.tipo] || ['ACCDA', 'Organizador', [620, 450]];
    comp.push({ insumoId: ACRIL, nombre: `Acrílico 5 mm (${A[1]})`, cantidad: 1, largoMM: A[2][0], anchoMM: A[2][1] });
    comp.push({ insumoId: 'tornilleria', nombre: 'Pegado / acabado', cantidad: 0.25 });
    claves.push(A[0]);
    tipoRender = 'mesita';
    nombre = `Accents · ${A[1]} (acrílico)`;

  } else if (c.producto === 'carpeta') {
    const grande = c.modelo === 'ACCSC4105';
    const largo = grande ? 1200 : 600, ancho = grande ? 1059 : 400;
    comp.push({ insumoId: MDF, nombre: 'Base rígida (MDF)', cantidad: 1, largoMM: largo, anchoMM: ancho });
    comp.push({ insumoId: VINIPIEL, nombre: 'Tapizado vinipiel', cantidad: mm(largo) * 1.15 });
    comp.push({ insumoId: 'espuma', nombre: 'Relleno / respaldo', cantidad: mm(largo) * mm(ancho) });
    claves.push(c.modelo);
    tipoRender = 'mesita';
    nombre = `Accents · Tapete vinipiel ${grande ? '1.20 × 1.06' : '0.60 × 0.40'} m`;

  } else if (c.producto === 'mesa_centro') {
    const m = num(c.medida, 60);
    const cub = cubiertaInsumo[c.cubierta] || cubiertaInsumo.cristal;
    comp.push({ insumoId: PTR, nombre: 'Estructura metálica mesa de centro', cantidad: 4 * 0.40 + 4 * mm(m) });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: 0.45, largoMM: m * 10, anchoMM: m * 10 });
    comp.push({ insumoId: cub.id, nombre: cub.nom, cantidad: 1, largoMM: m * 10, anchoMM: m * 10 });
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    claves.push(claveMesa('ACMC', c.forma, m, c.cubierta));
    tipoRender = 'mesa';
    nombre = `Accents · Mesa de centro ${c.forma} ${(m / 100).toFixed(2)} m · ${cub.nom.split(' ').slice(1, 3).join(' ')}`;

  } else if (c.producto === 'mesa_lateral') {
    const cub = cubiertaInsumo[c.cubierta] || cubiertaInsumo.cristal;
    comp.push({ insumoId: PTR, nombre: 'Estructura metálica mesa lateral (alta)', cantidad: 4 * 0.585 + 4 * 0.60 });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: 0.5, largoMM: 600, anchoMM: 600 });
    comp.push({ insumoId: cub.id, nombre: cub.nom, cantidad: 1, largoMM: 600, anchoMM: 600 });
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    claves.push(claveMesa('ACML', c.forma, 60, c.cubierta));
    tipoRender = 'mesa';
    nombre = `Accents · Mesa lateral ${c.forma} 0.60 m · ${c.cubierta === 'marmol' ? 'mármol' : 'cristal'}`;

  } else if (c.producto === 'base_mesa') {
    // Base metálica especial 450 × 700 mm, sólo recibe cubiertas de 600/750/900.
    comp.push({ insumoId: PTR, nombre: 'Base metálica especial', cantidad: 4 * 0.70 + 4 * 0.45 });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: 0.4, largoMM: 450, anchoMM: 700 });
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería', cantidad: 1 });
    claves.push('LROCTA-BACU');
    tipoRender = 'mesa';
    nombre = 'Accents · Base especial p/ mesa (450 × 700)';

  } else if (c.producto === 'perchero') {
    const grande = c.patas === '6';
    comp.push({ insumoId: PTR, nombre: `Perchero metálico ${grande ? '6' : '3'} patas`, cantidad: grande ? 6 * 1.63 : 3 * 0.90 });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: grande ? 0.6 : 0.35, largoMM: 384, anchoMM: grande ? 1627 : 901 });
    comp.push({ insumoId: 'nivelador', nombre: 'Bases', cantidad: grande ? 6 : 3 });
    claves.push('TSPER' + (grande ? '6' : '3') + 'M');
    tipoRender = 'mampara';
    nombre = `Accents · Perchero ${grande ? '6' : '3'} patas`;

  } else if (c.producto === 'mesa_laptop') {
    const m = num(c.medida, 60);
    const w = m === 64 ? 500 : 460, d = m === 64 ? 400 : 360, h = m === 64 ? 640 : 600;
    comp.push({ insumoId: PTR, nombre: 'Estructura metálica', cantidad: 2 * mm(h) + 2 * mm(w) + mm(d) });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: 0.3, largoMM: h, anchoMM: w });
    comp.push({ insumoId: c.finish === 'TF' ? MEMBRANA : MEL, nombre: `Cubierta (${c.finish === 'TF' ? 'termoformado' : 'melamina'})`, cantidad: 1, largoMM: w, anchoMM: d });
    comp.push({ insumoId: CANTO, nombre: 'Canto', cantidad: 2 * (mm(w) + mm(d)) });
    comp.push({ insumoId: 'rodaja', nombre: 'Rodajas', cantidad: 4 });
    claves.push('ACMELAP' + m + c.finish);
    tipoRender = 'mesita';
    nombre = `Accents · Mesa para laptop ${(m / 100).toFixed(2)} m · ${c.finish === 'TF' ? 'termoformado' : 'melamina'}`;

  } else if (c.producto === 'pizarron') {
    const alto = c.medida === '59' ? 1800 : 1774;
    comp.push({ insumoId: PTR, nombre: 'Estructura metálica pizarrón', cantidad: 2 * mm(alto) + 2 * 0.83 });
    comp.push({ insumoId: LAMINADO, nombre: 'Cara laminado plástico market grade', cantidad: 1, largoMM: 831, anchoMM: 707 });
    comp.push({ insumoId: LAMINA, nombre: 'Moldura para plumón + refuerzos (lámina)', cantidad: laminaKg(0.4) });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: 0.8, largoMM: 831, anchoMM: alto });
    comp.push({ insumoId: 'rodaja', nombre: 'Rodajas', cantidad: 4 });
    claves.push('TSPIZ' + c.medida + 'M');
    tipoRender = 'mampara';
    nombre = `Accents · Pizarrón móvil ${mm(alto).toFixed(2)} m`;

  } else if (c.producto === 'portapantalla') {
    // Mampara TeamSpace con gajo (cara) en cristal laminado blanco templado.
    const P = {
      '55': ['ACTSSP55C', 1400, 1880, 700],
      '40': ['ACTSSP40C', 1105, 1733, 600],
      '32': ['ACTSSP232', 501, 1662, 500],
    }[c.pulgadas] || ['ACTSSP55C', 1400, 1880, 700];
    comp.push({ insumoId: PTR, nombre: 'Estructura metálica portapantalla', cantidad: 2 * mm(P[2]) + 3 * mm(P[1]) });
    comp.push({ insumoId: TEMPLADO, nombre: 'Cara cristal laminado blanco templado', cantidad: 1, largoMM: P[1], anchoMM: P[2] });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: 0.8, largoMM: P[1], anchoMM: P[2] });
    comp.push({ insumoId: 'nivelador', nombre: 'Base / niveladores', cantidad: 4 });
    comp.push({ insumoId: 'tornilleria', nombre: 'Soporte de pantalla + tornillería', cantidad: 1 });
    claves.push(P[0]);
    tipoRender = 'mampara';
    nombre = `Accents · Portapantalla TeamSpace ${c.pulgadas}"`;

  } else if (c.producto === 'semimampara') {
    const M = {
      semi: ['ACSMAS2G', ACRIL, 'Semimampara acrílico satinado + soportes aluminio', 605, 338],
      biombo6: ['ACBIODIV6M2AC', ACRIL6, 'Biombo divisor acrílico 6 mm satinado', 610, 339],
      biombo9: ['ACBIODIV9M2AC', ACRIL, 'Biombo divisor acrílico 9 mm satinado', 610, 339],
    }[c.modelo] || ['ACSMAS2G', ACRIL, 'Semimampara acrílico satinado', 605, 338];
    comp.push({ insumoId: M[1], nombre: M[2], cantidad: 1, largoMM: M[3], anchoMM: M[4] });
    comp.push({ insumoId: ALUM, nombre: 'Soportes de aluminio', cantidad: 0.8 });
    comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería', cantidad: 1 });
    claves.push(M[0]);
    tipoRender = 'mampara';
    nombre = `Accents · ${M[2].split(' ').slice(0, 2).join(' ')}`;

  } else if (c.producto === 'recycle') {
    if (c.modelo === 'bote') {
      comp.push({ insumoId: LAMINA, nombre: 'Cuerpo bote de basura (lámina)', cantidad: laminaKg(0.42) });
      comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: 0.42, largoMM: 250, anchoMM: 300 });
      claves.push('ACBP25X12');
      tipoRender = 'mesita';
      nombre = 'Accents · Bote de basura rectangular';
    } else {
      const esp = c.modelo === 'gabinete_esp';
      comp.push({ insumoId: LAMINA, nombre: 'Cuerpo + puertas gabinete reciclado (lámina)', cantidad: laminaKg(esp ? 3.0 : 3.4) });
      comp.push({ insumoId: LAMINADO, nombre: 'Cubierta superficie sólida', cantidad: 1, largoMM: 655, anchoMM: 605 });
      comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: 3.2, largoMM: 655, anchoMM: 940 });
      comp.push({ insumoId: ACRIL, nombre: 'Señalamientos de acrílico', cantidad: 1, largoMM: 300, anchoMM: 200 });
      if (!esp) comp.push({ insumoId: LAMINA, nombre: 'Cestos para residuos (lámina)', cantidad: laminaKg(0.9) });
      comp.push({ insumoId: 'rodaja', nombre: 'Rodajas', cantidad: 4 });
      claves.push(esp ? 'ACCRCF' : 'ACCR');
      tipoRender = 'mueble';
      nombre = `Accents · Gabinete reciclado${esp ? ' especial' : ' 2 puertas'}`;
    }

  } else if (c.producto === 'organizador') {
    const O = {
      kart: ['ACGBCR', laminaKg(1.1), 0.9, true, 242, 568],
      box10: ['ACCO10', laminaKg(0.55), 0.5, false, 300, 300],
      box15: ['ACCO15', laminaKg(0.6), 0.55, false, 300, 300],
      box30: ['ACCO30', laminaKg(0.75), 0.7, false, 300, 300],
      boxb15: ['ACCOB15', laminaKg(0.5), 0.45, false, 300, 200],
    }[c.modelo] || ['ACCO10', laminaKg(0.55), 0.5, false, 300, 300];
    comp.push({ insumoId: LAMINA, nombre: 'Cuerpo organizador metálico (lámina)', cantidad: O[1] });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: O[2], largoMM: O[4], anchoMM: O[5] });
    if (O[3]) comp.push({ insumoId: 'rodaja', nombre: 'Rodajas', cantidad: 4 });
    claves.push(O[0]);
    tipoRender = 'mueble';
    nombre = `Accents · Organizador ${c.modelo === 'kart' ? 'Kart rodante' : 'Box'} (${O[0]})`;

  } else if (c.producto === 'base_ajustable') {
    // Base de altura ajustable c/ riel pasacables (compatible cubiertas 1200/1500/1800 × 600).
    comp.push({ insumoId: PTR, nombre: 'Base metálica ajustable modelo Accents', cantidad: 2 * 0.73 + 2 * 0.71 + 2 * 1.22 });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: 0.9, largoMM: 1220, anchoMM: 710 });
    comp.push({ insumoId: 'riel', nombre: 'Riel pasacables', cantidad: 1 });
    comp.push({ insumoId: 'pasacables', nombre: 'Organizador de cables vertical (espiral)', cantidad: 1 });
    comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería', cantidad: 1 });
    claves.push('ACBASMAJCRA');
    tipoRender = 'mesa';
    nombre = 'Accents · Base de altura ajustable';

  } else if (c.producto === 'portamonitor') {
    // Piezas COMPRADAS (marca Byrne/Mockett-style, alta en aluminio). Precio real
    // debe venir de la lista de compra; aquí sólo su contenido de aluminio nominal.
    const PM = {
      b1: 'MVLAP1050500F7', b2: 'MVLAP1060500F7', b2v: 'MVLAP1070500F7',
      b3: 'MVLAP1080500F7', art: 'MVLAP1050500F8', tab: 'MVLXSO171800A',
    }[c.modelo] || 'MVLAP1050500F7';
    comp.push({ insumoId: ALUM, nombre: 'Brazo/soporte de aluminio (comprado)', cantidad: 1.2 });
    comp.push({ insumoId: 'tornilleria', nombre: 'Placa y tornillería de fijación', cantidad: 1 });
    claves.push(PM);
    tipoRender = 'mesita';
    nombre = 'Accents · Portamonitor (comprado)';
  }

  return {
    producto: c.producto, nombre, componentes: comp, claves, electricos: [],
    modoManoObra: 'porcentaje', factorDirecta: 34, factorIndirecta: 12,
    tipoRender,
    nota: 'Accents (Fase A): CLAVES reales de la guía GE_Accents (acrílicos ACCDA/ACLAA/ACPPA/ACORAC/ACPR3/ACPIPAC/ACPIAC/ACORVA; mesas ACMC/ACML por forma+medida; ACTSSP/ACSMAS/ACBIODIV; recycle ACCR/ACCRCF/ACBP25X12; organizadores ACGBCR/ACCO; base LROCTA-BACU y ACBASMAJCRA). MP ESTIMADA — calibrar con lista real. Sustituciones sin insumoId exacto: vinipiel→"ecopiel"; superficie sólida y "market grade"→"laminado"; cristal satineshine tangerine 12 mm→"cristal-satinado"; acrílico 9 mm→"acrilico". Portamonitores (MVL..) y base ajustable son piezas COMPRADAS: se cargan por precio de compra, no por despiece. Pads de escritorio son claves Eclipse Drift (EDESCQ..EP), fuera de este generador.',
  };
}
