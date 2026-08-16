// ============================================================================
//  GENERADOR ANTEO · guía GE_Anteo (ESP-DCC-IDP-003, v3 2025-09-09). Línea de
//  ALTA DIRECCIÓN: el escritorio se apoya sobre un GABINETE / ACOMETIDA CIEGA.
//  Collage de materiales: acero con pintura electrostática, mármoles exclusivos
//  (Calacatta, Arabescato, Blue Pearl, Nero Profundo, Eco), chapas de madera
//  (incl. Walnut Burl), laminado Decorlux tipo acero satinado y EcoPiel.
//  Cerraduras digitales Stealthlock, ductos pasa-cables y cajas retráctiles.
//
//  ALCANCE REAL DE LA GUÍA:
//   · Escritorio = BASE de acero (ANBASESC210M/240M) + ACOMETIDA CIEGA
//     600x600x600 (ANBAGU60D/I, puerta ciega SIN cajones, tapa EcoPiel + caja)
//     + CUBIERTA 900x2100/2400 (ANCESREC210/240).
//   · Guardas: cajones ANGUCA47 (600x600x1200), entrepaños ANGUE47
//     (600x600x1200), gabinete bajo ANGAB30 (750x500x750), gabinete alto
//     ANGAB63 (750x500x1600).
//   · Mesa de altura regulable ANMARE150DX (SÓLO 1500, tapa EcoPiel + caja x2).
//   · Mesas rehilete: apoyo ANMECE-EST (400x400x565), centro ANMECEBA-EST
//     (500x500x365), juntas ANMEJURE-EST (500x500x715, x1 ó x2 en 8 personas).
//   · Cubiertas mesas: mármol / chapa / Walnut Burl / termoformado / cristal.
//  FASE A: dimensiones reales de la guía; MP de acero estimada (calibrar).
// ============================================================================
// Calibración de Rodrigo (2026-08-15) para el escritorio Anteo: inox + contrapeso
// + mármol exclusivo que el despiece todavía no sabe costear. Ver la nota del
// return. Cambiar este número mueve sólo el escritorio Anteo.
export const FACTOR_ESCRITORIO = 3;

const KG20 = 7.16;
const laminaKg = (m2) => m2 * KG20;
const mm = (v) => v / 1000;
const num = (v, def) => parseInt(v) || def;

// Catálogo de acabados. sufEsc = sufijo en clave de CUBIERTA de escritorio
// (Calacatta = 'ML'); sufMesa = sufijo en cubiertas de mesa y en guardas.
const ACAB = {
  calacatta:  { insumo: 'marmol-premium',  sufEsc: 'ML',   sufMesa: 'MCL',  label: 'Mármol Calacatta',       marmol: true },
  arabescato: { insumo: 'marmol-premium',  sufEsc: 'MAB',  sufMesa: 'MAB',  label: 'Mármol Arabescato',      marmol: true },
  bluepearl:  { insumo: 'marmol-premium',  sufEsc: 'MBP',  sufMesa: 'MBP',  label: 'Granito Blue Pearl',     marmol: true },
  nero:       { insumo: 'marmol-premium',  sufEsc: 'MNP',  sufMesa: 'MNP',  label: 'Granito Nero Profundo',  marmol: true },
  eco:        { insumo: 'marmol',          sufEsc: 'ECM',  sufMesa: 'ECM',  label: 'Eco mármol',             marmol: true },
  chapa:      { insumo: 'chapa-madera',    sufEsc: 'CH',   sufMesa: 'CH',   label: 'Chapa de madera' },
  walnut:     { insumo: 'chapa-walnut',    sufEsc: 'CHWB', sufMesa: 'CHWB', label: 'Chapa Walnut Burl' },
  tf:         { insumo: 'membrana-pvc',    sufEsc: 'TF',   sufMesa: 'TF',   label: 'Termoformado' },
  cristal:    { insumo: 'cristal-templado',sufEsc: 'CR',   sufMesa: 'CR',   label: 'Cristal templado',       cristal: true },
  decorlux:   { insumo: 'laminado',        sufEsc: 'DX',   sufMesa: 'DX',   label: 'Decorlux acero satinado' },
};

const FIN_ESC = ['calacatta', 'arabescato', 'bluepearl', 'nero', 'eco', 'chapa', 'walnut'];
const FIN_MESA = ['calacatta', 'arabescato', 'bluepearl', 'nero', 'eco', 'chapa', 'walnut', 'tf', 'cristal'];
const FIN_GUARDA = ['chapa', 'walnut', 'decorlux'];
const opts = (ids) => ids.map((id) => ({ id, label: ACAB[id].label }));
// Resuelve el acabado elegido contra la lista válida del producto; si el chip
// global no aplica (p. ej. venía de otro producto), cae al default de la línea.
const acab = (c, lista, def) => (lista.includes(c.finish) ? ACAB[c.finish] : ACAB[def]);

export const ANTEO_PRODUCTOS = [
  {
    id: 'escritorio', nombre: 'Escritorio (base + acometida + cubierta)',
    selects: [
      { key: 'largo', label: 'Largo cubierta', opciones: [{ id: '2100', label: '2.10 m' }, { id: '2400', label: '2.40 m' }] },
      { key: 'mano', label: 'Acometida ciega', opciones: [{ id: 'derecha', label: 'Derecha' }, { id: 'izquierda', label: 'Izquierda' }] },
    ],
    finishes: opts(FIN_ESC),
    checks: [{ key: 'cerradura', label: 'Cerradura digital Stealthlock en puerta ciega' }],
  },
  {
    id: 'guarda', nombre: 'Guardas y gabinetes',
    selects: [{ key: 'tipo', label: 'Tipo', opciones: [
      { id: 'cajones', label: '2 cajones + 2 lapiceros (60x60x120)' },
      { id: 'entrepanos', label: '2 entrepaños + puertas (60x60x120)' },
      { id: 'gab_bajo', label: 'Gabinete bajo (75x50x75)' },
      { id: 'gab_alto', label: 'Gabinete alto (75x50x160)' },
    ] }],
    finishes: opts(FIN_GUARDA),
  },
  {
    id: 'mesa_apoyo', nombre: 'Mesa de apoyo (rehilete)',
    selects: [{ key: 'cub', label: 'Cubierta', opciones: [
      { id: 'cuad600', label: 'Cuadrada 0.60 m' }, { id: 'cuad750', label: 'Cuadrada 0.75 m' },
      { id: 'red750', label: 'Redonda Ø0.75 m' }, { id: 'red900', label: 'Redonda Ø0.90 m' },
    ] }],
    finishes: opts(FIN_MESA),
  },
  {
    id: 'mesa_centro', nombre: 'Mesa de centro (rehilete)',
    selects: [{ key: 'cub', label: 'Cubierta', opciones: [
      { id: 'cuad750', label: 'Cuadrada 0.75 m' }, { id: 'cuad900', label: 'Cuadrada 0.90 m' },
      { id: 'red900', label: 'Redonda Ø0.90 m' }, { id: 'red1050', label: 'Redonda Ø1.05 m' },
    ] }],
    finishes: opts(FIN_MESA),
  },
  {
    id: 'mesa_juntas', nombre: 'Mesa de juntas (rehilete)',
    selects: [{ key: 'cub', label: 'Cubierta', opciones: [
      { id: 'red1200', label: 'Redonda Ø1.20 m' }, { id: 'cuad1200', label: 'Cuadrada 1.20 m' },
      { id: 'rect2400', label: 'Rectangular 2.40 x 1.20 m (8 personas)' },
    ] }],
    finishes: opts(FIN_MESA),
    checks: [{ key: 'electrico', label: 'Ducto pasa-cables + caja retráctil (no en cristal)' }, { key: 'manejacables', label: 'Maneja cables en espiral' }],
  },
  {
    id: 'mesa_regulable', nombre: 'Mesa de altura regulable (1.50 m)',
    checks: [{ key: 'manejacables', label: 'Maneja cables en espiral (extra)' }],
  },
];

// ---------- Sub-ensambles ----------------------------------------------------

// Cubierta rectangular por m² según el acabado (corte ala de avión / cuchillo /
// saque / cantos pulidos). Mármol y termoformado sobre núcleo de MDF; cristal
// SIEMPRE con base en EcoPiel; chapa/Walnut/Decorlux con canto.
function cubierta(comp, a, L, W, et) {
  const area = mm(L) * mm(W), perim = 2 * (mm(L) + mm(W));
  if (a.marmol) {
    comp.push({ insumoId: 'mdf', nombre: `${et} · núcleo MDF`, cantidad: 1, largoMM: L, anchoMM: W });
    comp.push({ insumoId: a.insumo, nombre: `${et} · losa ${a.label}`, cantidad: 1, largoMM: L, anchoMM: W });
  } else if (a.cristal) {
    comp.push({ insumoId: 'cristal-templado', nombre: `${et} · cristal templado`, cantidad: 1, largoMM: L, anchoMM: W });
    comp.push({ insumoId: 'ecopiel', nombre: `${et} · base en EcoPiel`, cantidad: area / 0.55 });
  } else if (a.insumo === 'membrana-pvc') {
    comp.push({ insumoId: 'mdf', nombre: `${et} · núcleo MDF`, cantidad: 1, largoMM: L, anchoMM: W });
    comp.push({ insumoId: 'membrana-pvc', nombre: `${et} · termoformado PVC`, cantidad: 1, largoMM: L, anchoMM: W });
  } else {
    comp.push({ insumoId: 'mdf', nombre: `${et} · núcleo MDF`, cantidad: 1, largoMM: L, anchoMM: W });
    comp.push({ insumoId: a.insumo, nombre: `${et} · ${a.label}`, cantidad: 1, largoMM: L, anchoMM: W });
    comp.push({ insumoId: 'tapacanto', nombre: `${et} · canto`, cantidad: perim });
  }
}

// Tapa / superficie forrada en EcoPiel (acometida, guardas, mesa regulable).
function tapaEcopiel(comp, L, W, et) {
  comp.push({ insumoId: 'mdf', nombre: `${et} · núcleo MDF`, cantidad: 1, largoMM: L, anchoMM: W });
  comp.push({ insumoId: 'ecopiel', nombre: `${et} · forro EcoPiel`, cantidad: mm(L) * mm(W) / 0.55 });
}

// Cuerpo de gabinete en MDF (laterales + piso/techo + respaldo).
function cuerpo(comp, W, D, H, et) {
  comp.push({ insumoId: 'mdf', nombre: `${et} · laterales`, cantidad: 2, largoMM: D, anchoMM: H });
  comp.push({ insumoId: 'mdf', nombre: `${et} · piso y techo`, cantidad: 2, largoMM: W, anchoMM: D });
  comp.push({ insumoId: 'mdf', nombre: `${et} · respaldo`, cantidad: 1, largoMM: W, anchoMM: H });
  comp.push({ insumoId: 'tapacanto', nombre: `${et} · cantos`, cantidad: 2 * (mm(W) + mm(H)) });
}

// Frentes (puertas / cajones) enchapados en el acabado de la línea.
function frentes(comp, a, W, H, n, et) {
  comp.push({ insumoId: 'mdf', nombre: `${et} · núcleo`, cantidad: n, largoMM: W, anchoMM: H });
  comp.push({ insumoId: a.insumo, nombre: `${et} · frente ${a.label}`, cantidad: n, largoMM: W, anchoMM: H });
  comp.push({ insumoId: 'tapacanto', nombre: `${et} · canto frente`, cantidad: 2 * (mm(W) + mm(H)) * n });
}

// Base rehilete de acero (mesas). veces=2 en juntas de 8 personas.
function baseRehilete(comp, lado, alto, clave, et, veces) {
  veces = veces || 1;
  comp.push({ insumoId: 'ptr', nombre: `${et} · estructura rehilete de acero (${clave})`, cantidad: (4 * mm(lado) * 0.7 + mm(alto)) * veces });
  comp.push({ insumoId: 'lamina-20', nombre: `${et} · placas de acero`, cantidad: laminaKg(mm(lado) * mm(lado) * 0.5) * veces });
  comp.push({ insumoId: 'pintura-electrostatica', nombre: `${et} · pintura electrostática`, cantidad: (mm(lado) * mm(lado) + 4 * mm(lado) * mm(alto)) * veces });
  comp.push({ insumoId: 'escuadra', nombre: `${et} · escuadras "Z" y "L"`, cantidad: 4 * veces });
  comp.push({ insumoId: 'nivelador', nombre: `${et} · niveladores`, cantidad: 4 * veces });
}

// ---------- Generador --------------------------------------------------------

export function generarAnteo(config) {
  const c = { producto: 'escritorio', largo: '2100', mano: 'derecha', tipo: 'cajones', cub: 'cuad600', finish: 'calacatta', cerradura: false, electrico: false, manejacables: false, ...config };
  const comp = [], claves = [], electricos = [];
  let nombre = '';

  if (c.producto === 'escritorio') {
    const a = acab(c, FIN_ESC, 'calacatta');
    const largo = num(c.largo, 2100);
    const es240 = largo >= 2400;
    const izq = c.mano === 'izquierda';
    // Acometida hereda finish de madera; con mármol/cristal se enchapa en chapa.
    const aBody = a.marmol || a.cristal ? (c.finish === 'walnut' ? ACAB.walnut : ACAB.chapa) : a;

    // 1 · Base de acero (ANBASESC210M / 240M) — 1820/2020 x 440 x 715
    const bw = es240 ? 2020 : 1820;
    comp.push({ insumoId: 'ptr', nombre: 'Base escritorio · estructura de acero', cantidad: 2 * mm(bw) + 4 * 0.715 + 2 * 0.44 });
    comp.push({ insumoId: 'lamina-20', nombre: 'Base escritorio · laterales de lámina', cantidad: laminaKg(2 * 0.44 * 0.715) });
    comp.push({ insumoId: 'pintura-electrostatica', nombre: 'Base escritorio · pintura electrostática', cantidad: 2 * (0.44 * 0.715) + 2.0 });
    comp.push({ insumoId: 'nivelador', nombre: 'Base escritorio · niveladores', cantidad: 4 });

    // 2 · Acometida CIEGA 600x600x600 — puerta ciega SIN cajones + tapa EcoPiel + caja
    cuerpo(comp, 600, 600, 600, 'Acometida ciega');
    frentes(comp, aBody, 600, 600, 1, 'Acometida · puerta ciega');
    comp.push({ insumoId: 'bisagra', nombre: 'Acometida · bisagras cierre lento', cantidad: 2 });
    comp.push({ insumoId: 'jaladera', nombre: 'Acometida · jaladera barra cónica', cantidad: 1 });
    tapaEcopiel(comp, 600, 600, 'Acometida · tapa');
    comp.push({ insumoId: 'caja-electrica', nombre: 'Acometida · caja eléctrica bajo cubierta', cantidad: 1 });
    if (c.cerradura) comp.push({ insumoId: 'cerradura-electronica', nombre: 'Acometida · cerradura digital Stealthlock', cantidad: 1 });

    // 3 · Cubierta 900 x 2100/2400 (ANCESREC210/240)
    cubierta(comp, a, largo, 900, `Cubierta escritorio ${mm(largo).toFixed(2)} m`);

    comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería (pijas, tuercas 3/8", rondanas)', cantidad: 1 });

    claves.push(es240 ? 'ANBASESC240M' : 'ANBASESC210M');
    claves.push('ANBAGU60' + (izq ? 'I' : 'D') + aBody.sufMesa);
    claves.push('ANCESREC' + (es240 ? '240' : '210') + a.sufEsc);
    electricos.push('Acometida ciega con tapa EcoPiel y caja eléctrica bajo cubierta');
    if (c.cerradura) electricos.push('Cerradura digital Stealthlock + baterías AAA');
    nombre = `Anteo · Escritorio ${mm(largo).toFixed(2)} m · acometida ${izq ? 'izquierda' : 'derecha'} · cubierta ${a.label}`;

  } else if (c.producto === 'guarda') {
    const a = acab(c, FIN_GUARDA, 'chapa');
    const D = { cajones: [600, 600, 1200], entrepanos: [600, 600, 1200], gab_bajo: [750, 500, 750], gab_alto: [750, 500, 1600] }[c.tipo];
    const [W, F, H] = D;
    cuerpo(comp, W, F, H, 'Cuerpo');
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });

    if (c.tipo === 'cajones') {
      // 2 cajones archiveros + 2 cajones lapiceros
      frentes(comp, a, W, 300, 4, 'Frentes de cajón');
      comp.push({ insumoId: 'corredera', nombre: 'Correderas de cajón', cantidad: 4 });
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras barra cónica', cantidad: 4 });
      comp.push({ insumoId: 'cerradura-electronica', nombre: 'Cerraduras Stealthlock (2 cajones)', cantidad: 2 });
      tapaEcopiel(comp, W, F, 'Cubierta');
      comp.push({ insumoId: 'caja-electrica', nombre: 'Caja eléctrica bajo cubierta', cantidad: 1 });
      claves.push('ANGUCA47' + a.sufMesa);
      nombre = `Anteo · Guarda 2 cajones + 2 lapiceros · ${a.label}`;
    } else if (c.tipo === 'entrepanos') {
      frentes(comp, a, W / 2, H, 2, 'Puertas abatibles');
      comp.push({ insumoId: 'bisagra', nombre: 'Bisagras cierre lento', cantidad: 4 });
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras barra cónica', cantidad: 2 });
      comp.push({ insumoId: 'mdf', nombre: 'Entrepaños móviles', cantidad: 2, largoMM: W, anchoMM: F });
      comp.push({ insumoId: 'cerradura-electronica', nombre: 'Cerradura Stealthlock', cantidad: 1 });
      tapaEcopiel(comp, W, F, 'Cubierta');
      comp.push({ insumoId: 'caja-electrica', nombre: 'Caja eléctrica bajo cubierta', cantidad: 1 });
      claves.push('ANGUE47' + a.sufMesa);
      nombre = `Anteo · Guarda 2 entrepaños + puertas · ${a.label}`;
    } else {
      // Gabinetes fijos (bajo / alto): puertas verticales + entrepaños + base oculta
      const nEntre = c.tipo === 'gab_alto' ? 4 : 2; // alto: 3 móviles + 1 fijo
      frentes(comp, a, W / 2, H, 2, 'Puertas verticales');
      comp.push({ insumoId: 'bisagra', nombre: 'Bisagras cierre lento', cantidad: c.tipo === 'gab_alto' ? 6 : 4 });
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras barra cónica', cantidad: 2 });
      comp.push({ insumoId: 'mdf', nombre: 'Entrepaños', cantidad: nEntre, largoMM: W, anchoMM: F });
      comp.push({ insumoId: 'cerradura-electronica', nombre: 'Cerradura Stealthlock', cantidad: 1 });
      if (c.tipo === 'gab_bajo') tapaEcopiel(comp, W, F, 'Superficie superior');
      claves.push((c.tipo === 'gab_alto' ? 'ANGAB63' : 'ANGAB30') + a.sufMesa);
      nombre = `Anteo · Gabinete ${c.tipo === 'gab_alto' ? 'alto' : 'bajo'} · ${a.label}`;
    }
    comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería y cartabones', cantidad: 1 });

  } else if (c.producto === 'mesa_apoyo' || c.producto === 'mesa_centro' || c.producto === 'mesa_juntas') {
    const a = acab(c, FIN_MESA, 'calacatta');
    const CUB = {
      mesa_apoyo: {
        cuad600: { L: 600, W: 600, head: 'ANCCU60', et: 'Cubierta cuadrada 0.60 m' },
        cuad750: { L: 750, W: 750, head: 'ANCCU7540', et: 'Cubierta cuadrada 0.75 m' },
        red750: { L: 750, W: 750, head: 'ANCRE7540', et: 'Cubierta redonda Ø0.75 m' },
        red900: { L: 900, W: 900, head: 'ANCRE9040', et: 'Cubierta redonda Ø0.90 m' },
      },
      mesa_centro: {
        cuad750: { L: 750, W: 750, head: 'ANCCU75', et: 'Cubierta cuadrada 0.75 m' },
        cuad900: { L: 900, W: 900, head: 'ANCCU90', et: 'Cubierta cuadrada 0.90 m' },
        red900: { L: 900, W: 900, head: 'ANCRE90', et: 'Cubierta redonda Ø0.90 m' },
        red1050: { L: 1050, W: 1050, head: 'ANCRE105', et: 'Cubierta redonda Ø1.05 m' },
      },
      mesa_juntas: {
        red1200: { L: 1200, W: 1200, head: 'ANCRE120', et: 'Cubierta redonda Ø1.20 m' },
        cuad1200: { L: 1200, W: 1200, head: 'ANCCU120', et: 'Cubierta cuadrada 1.20 m' },
        rect2400: { L: 2400, W: 1200, head: 'ANCREC480', et: 'Cubierta rectangular 2.40 x 1.20 m' },
      },
    }[c.producto];
    const cubMap = CUB[c.cub] || CUB[Object.keys(CUB)[0]];

    if (c.producto === 'mesa_apoyo') {
      baseRehilete(comp, 400, 565, 'ANMECE-EST', 'Base mesa de apoyo', 1);
      claves.push('ANMECE-EST');
      nombre = 'Anteo · Mesa de apoyo';
    } else if (c.producto === 'mesa_centro') {
      baseRehilete(comp, 500, 365, 'ANMECEBA-EST', 'Base mesa de centro', 1);
      claves.push('ANMECEBA-EST');
      nombre = 'Anteo · Mesa de centro';
    } else {
      const ocho = c.cub === 'rect2400';
      baseRehilete(comp, 500, 715, 'ANMEJURE-EST', 'Base mesa de juntas', ocho ? 2 : 1);
      claves.push('ANMEJURE-EST');
      // Instalación eléctrica: sólo en chapa/termoformado, NUNCA en cristal.
      if ((c.electrico || ocho) && !a.cristal) {
        comp.push({ insumoId: 'ducto', nombre: 'Ducto inferior pasa-cables (CIDUANBD2-B)', cantidad: 1.0 });
        comp.push({ insumoId: 'caja-electrica', nombre: 'Caja eléctrica retráctil bajo cubierta (2 contactos)', cantidad: 1 });
        claves.push('CIDUANBD2-B', 'BE0181940EEFA120');
        electricos.push('Ducto pasa-cables CIDUANBD2-B + caja retráctil BE0181940EEFA120');
      } else if ((c.electrico || ocho) && a.cristal) {
        electricos.push('La cubierta de cristal NO puede llevar instalación eléctrica (restricción de la línea)');
      }
      if (c.manejacables || ocho) {
        comp.push({ insumoId: 'pasacables', nombre: 'Maneja cables en espiral (MACAWM34-90)', cantidad: 1 });
        electricos.push('Maneja cables en espiral MACAWM34-90');
      }
      nombre = `Anteo · Mesa de juntas${ocho ? ' (8 personas)' : ''}`;
    }

    cubierta(comp, a, cubMap.L, cubMap.W, cubMap.et);
    comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería (pijas 12x25, rondanas 1/4")', cantidad: 1 });
    claves.push(cubMap.head + a.sufMesa);
    nombre += ` · ${cubMap.et.toLowerCase()} · ${a.label}`;

  } else if (c.producto === 'mesa_regulable') {
    // ANMARE150DX — SÓLO 1500. Base eléctrica + laterales + pedestales + tapa EcoPiel.
    comp.push({ insumoId: 'base-motorizada', nombre: 'Base eléctrica de altura ajustable (RPC400M, control digital)', cantidad: 1 });
    comp.push({ insumoId: 'ptr', nombre: 'Laterales reforzados de acero', cantidad: 2 * 0.75 });
    comp.push({ insumoId: 'pintura-electrostatica', nombre: 'Laterales · pintura electrostática', cantidad: 1.0 });
    comp.push({ insumoId: 'pedestal', nombre: 'Pedestales laterales con gromet (bajada de cableado)', cantidad: 2 });
    comp.push({ insumoId: 'riel', nombre: 'Rieles', cantidad: 2 });
    tapaEcopiel(comp, 1500, 750, 'Cubierta');
    comp.push({ insumoId: 'caja-electrica', nombre: 'Cajas eléctricas bajo cubierta', cantidad: 2 });
    if (c.manejacables) {
      comp.push({ insumoId: 'pasacables', nombre: 'Maneja cables en espiral (MACAWM34-90)', cantidad: 1 });
      electricos.push('Maneja cables en espiral MACAWM34-90 (accesorio extra)');
    }
    comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería (pijas 12x25, punta broca, rondanas)', cantidad: 1 });
    claves.push('ANMARE150DX');
    electricos.push('Base eléctrica motorizada RPC400M (comprada) + 2 cajas eléctricas + bajada por pedestales');
    nombre = 'Anteo · Mesa de altura regulable 1.50 m · cubierta EcoPiel';
  }

  return {
    producto: c.producto, nombre, componentes: comp, claves, electricos,
    // El ESCRITORIO Anteo es la pieza más cara de la casa y el despiece actual
    // no lo refleja: la pata va en ACERO INOXIDABLE con un contrapeso para que
    // el voladizo no se venza, y la cubierta es mármol de bloque exclusivo.
    // Nada de eso tiene precio de MP cargado todavía, así que el modelo lo saca
    // como si fuera acero pintado. Rodrigo (2026-08-15) fija el factor 3× sobre
    // el escritorio hasta que llegue la lista de MP real de inox y mármol.
    // Es una CALIBRACIÓN, no un dato: se borra en cuanto haya MP.
    ...(c.producto === 'escritorio' ? { factorPrecio: FACTOR_ESCRITORIO } : {}),
    modoManoObra: 'porcentaje', factorDirecta: 42, factorIndirecta: 15,
    nota: 'Anteo (Fase A): línea de alta dirección. Dimensiones y claves reales de la guía GE_Anteo v3. El escritorio se despieza en 3 piezas (base de acero ANBASESC210M/240M + acometida ciega ANBAGU60 con puerta ciega SIN cajones + cubierta ANCESREC). Mármoles por variedad (Calacatta/Arabescato/Blue Pearl/Nero/Eco) sobre marmol-premium/marmol; Walnut Burl en chapa-walnut; Decorlux en laminado. MP de acero (bases rehilete y de escritorio) ESTIMADA con PTR + lámina cal.20 + pintura electrostática: pendiente calibrar con lista real y con el desarrollo exacto de cada base. Perchero de gabinetes y baja-cables espiral MACAWM34-90 no tienen insumoId propio (perchero omitido; maneja cables mapeado a pasacables).',
  };
}
