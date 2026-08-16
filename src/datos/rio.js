// ============================================================================
//  GENERADOR RÍO · guía GE_Rio (ESP-DCC-IDP-003, v3.0). Bench ORGÁNICO
//  (formas curvas y rectas). Las cubiertas "flotan" sobre patas inclinadas 66°
//  y acometidas centrales; biombos curvos/rectos de acrílico, panel acústico o
//  lámina perforada. Reconstruido a alta fidelidad desde la tabla de Componentes.
//
//  Claves de cubierta REALES por forma + posición (una banca MEZCLA varias):
//    curvo sencillo: RIBSCU[IN|CE|D|I][CV|CX] + sufijo tamaño (23=.90 24=1.20 25=1.50 26=1.80)
//    curvo doble   : RICU[IN|CE|D|I][CV|CX]   + mismo sufijo
//    recto         : RICUBRECIN | RICUBRECD | RICUBRECI + sufijo (23=.90 105=1.05 24=1.20 25=1.50 26=1.80)
//    recto central : CICUB (Modelo APP, tapa metálica TM, sólo ABS/TF) 32/105/42/52/62
//    estación "J"  : RICUBRIN[I|D] 34/35/36/37 (120/150/180/200) fondo 120
//    estación "L"  : RICUBECN[40|60][D|I] 34/35/36/37 (conexión lateral 40/60 mm)
//    mesa juntas   : inicio RIMJCUBI## + central RIMJCUBC## + individual RIMJCUBIN##
//                    (44=120 45=150 46=180 47=210 48=240; fondo 120; VH→CEVH, Ellora→E2X)
//  Patas: izq RIPIIBS / der RIPIDBS (sencillo), doble RIPIBD (doble/cruz),
//         estación RIPIBR, mesa juntas RIPAMJ4 (66°, 121.6 cm).
//  Acometidas: sencilla ø300 RIACCI30, doble ø600 RIACCI40, cuadrada RIACCU40R,
//         bases Alba ABACO30LP/ABACO40LP/ABACOM60; puerta → +imán IM175.
//  Arnés Byrne: sencillo RIJSABY / doble CIJSABY. Conductos bench doble
//         CIDUT + CIDUBD (Modelo APP) + placa unión QCIPLAUES.
//  FASE A: dimensiones reales de la guía; MP estimada (calibrar con lista real).
// ============================================================================

// --- Insumos (SOLO ids válidos de insumo_ids.txt) ---
const MEL28 = 'melamina-28', CHAPA = 'chapa-madera', TF = 'membrana-pvc';
const CANTO = 'tapacanto', LAMINA = 'lamina-20', PTR = 'ptr';
const CURVADO = 'curvado';
// FLECHA de la curva como fracción de la cuerda (el "cuánto se panza" la cubierta).
// Con 0.10 una cubierta de 1200 se sale 120 mm, que es lo que se ve en las fotos
// de la línea. De aquí salen las tres cosas que una pieza curva cuesta de más:
//   1) el TABLERO se compra por la caja envolvente (fondo + flecha), no por el
//      rectángulo útil — el pedazo de la panza se tira;
//   2) el CANTO es un arco, más largo que la cuerda;
//   3) el RUTEADO y el canteado van en curva (insumo `curvado`).
// Es geometría, no un factor: cuando llegue el radio real de la guía se cambia
// este número y todas las piezas curvas se recalculan solas.
const FLECHA = 0.10;
const arco = (cuerdaMM) => cuerdaMM * (1 + (8 / 3) * FLECHA * FLECHA);
const PATA = 'pata-metalica', ACOM = 'acometida', CHAROLA = 'charola', PASACAB = 'pasacables', DUCTO = 'ducto';
const ACRIL = 'acrilico', PET = 'pet-acustico';
const CAJA = 'caja-electrica', ARNES = 'byrne-phase2', ESCUADRA = 'escuadra', TORN = 'tornilleria';

// Acabado de cubierta → insumo + sufijo de clave
const ACAB = {
  ABS: { insumo: MEL28, suf: 'ABS', label: 'Melamina ABS' },
  chapa: { insumo: CHAPA, suf: 'CH', label: 'Chapa de madera' },
  termoformado: { insumo: TF, suf: 'TF', label: 'Termoformado' },
};
const FINISHES = [
  { id: 'ABS', label: 'Melamina ABS' },
  { id: 'chapa', label: 'Chapa de madera' },
  { id: 'termoformado', label: 'Termoformado' },
];
// Panel de biombo → insumo + sufijo de clave
const BIOMAT = {
  AC: { insumo: ACRIL, suf: 'AC', label: 'Acrílico' },
  PT: { insumo: PET, suf: 'PT', label: 'Panel acústico' },
  LP: { insumo: LAMINA, suf: 'LP', label: 'Lámina perforada' },
};

// --- Sufijos de tamaño por familia de clave ---
const SUF_CURVO = { 900: '23', 1200: '24', 1500: '25', 1800: '26' };
const SUF_RECTO = { 900: '23', 1050: '105', 1200: '24', 1500: '25', 1800: '26' };
const SUF_CICUB = { 900: '32', 1050: '105', 1200: '42', 1500: '52', 1800: '62' };
const SUF_EST = { 1200: '34', 1500: '35', 1800: '36', 2000: '37' };   // cubiertas "J"/"L": ancho=largo, fondo 120
const SUF_BIOP = { 900: '3', 1200: '4', 1500: '5', 1800: '6' };       // biombo faldón RIBIOP
const SUF_BIOC = { 900: '32', 1050: '32', 1200: '42', 1500: '52', 1800: '62', 2000: '72' }; // RIBIO / RIBIOREC
const SUF_REF = { 900: '3', 1200: '4', 1500: '5', 1800: '6' };        // omega/refuerzo/riel/charola/conducto
const SUF_MJ = { 1200: '44', 1500: '45', 1800: '46', 2100: '47', 2400: '48' }; // mesa de juntas

const LARGOS_BENCH = [
  { id: '900', label: '0.90 m' }, { id: '1050', label: '1.05 m' }, { id: '1200', label: '1.20 m' },
  { id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' },
];
const LARGOS_CURVO = [
  { id: '900', label: '0.90 m' }, { id: '1200', label: '1.20 m' },
  { id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' },
];
const LARGOS_EST = [
  { id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' },
  { id: '1800', label: '1.80 m' }, { id: '2000', label: '2.00 m' },
];
const BIOMBOS_2 = [{ id: 'AC', label: 'Acrílico' }, { id: 'PT', label: 'Panel acústico' }];
const BIOMBOS_3 = [{ id: 'AC', label: 'Acrílico' }, { id: 'PT', label: 'Panel acústico' }, { id: 'LP', label: 'Lámina perforada' }];

export const RIO_PRODUCTOS = [
  {
    id: 'bench_recto_sencillo', nombre: 'Bench recto sencillo',
    selects: [
      { key: 'usuarios', label: 'Usuarios', opciones: [{ id: '1', label: '1 usuario' }, { id: '2', label: '2 usuarios' }, { id: '3', label: '3 usuarios' }, { id: '4', label: '4 usuarios' }, { id: '6', label: '6 usuarios' }] },
      { key: 'largo', label: 'Largo por usuario', opciones: LARGOS_BENCH },
      { key: 'biombo', label: 'Biombo posterior', opciones: BIOMBOS_2 },
    ],
    finishes: FINISHES,
    checks: [{ key: 'acometida', label: 'Acometida ø300 (RIACCI30)' }, { key: 'electrico', label: 'Electrificación (arnés RIJSABY)' }],
  },
  {
    id: 'bench_recto_doble', nombre: 'Bench recto doble',
    selects: [
      { key: 'usuarios', label: 'Usuarios', opciones: [{ id: '2', label: '2 usuarios' }, { id: '4', label: '4 usuarios' }, { id: '6', label: '6 usuarios' }, { id: '8', label: '8 usuarios' }, { id: '10', label: '10 usuarios' }, { id: '12', label: '12 usuarios' }] },
      { key: 'largo', label: 'Largo por usuario', opciones: LARGOS_BENCH },
      { key: 'biombo', label: 'Biombo recto', opciones: BIOMBOS_3 },
    ],
    finishes: FINISHES,
    checks: [
      { key: 'acometida', label: 'Acometida ø600 (RIACCI40)' },
      { key: 'puerta', label: 'Acometida con puerta (+imán IM175)' },
      { key: 'electrico', label: 'Electrificación (arnés CIJSABY)' },
    ],
  },
  {
    id: 'bench_curvo_sencillo', nombre: 'Bench curvo sencillo',
    selects: [
      { key: 'usuarios', label: 'Usuarios', opciones: [{ id: '1', label: '1 usuario' }, { id: '2', label: '2 usuarios' }, { id: '3', label: '3 usuarios' }, { id: '4', label: '4 usuarios' }, { id: '6', label: '6 usuarios' }] },
      { key: 'largo', label: 'Largo por usuario', opciones: LARGOS_CURVO },
      { key: 'biombo', label: 'Biombo posterior', opciones: BIOMBOS_2 },
    ],
    finishes: FINISHES,
    checks: [{ key: 'acometida', label: 'Acometida ø300 (RIACCI30)' }, { key: 'electrico', label: 'Electrificación (arnés RIJSABY)' }],
  },
  {
    id: 'bench_curvo_doble', nombre: 'Bench curvo doble',
    selects: [
      { key: 'usuarios', label: 'Usuarios', opciones: [{ id: '2', label: '2 usuarios' }, { id: '4', label: '4 usuarios' }, { id: '6', label: '6 usuarios' }, { id: '8', label: '8 usuarios' }, { id: '10', label: '10 usuarios' }, { id: '12', label: '12 usuarios' }] },
      { key: 'largo', label: 'Largo por usuario', opciones: LARGOS_CURVO },
      { key: 'biombo', label: 'Biombo curvo', opciones: BIOMBOS_3 },
    ],
    finishes: FINISHES,
    checks: [
      { key: 'acometida', label: 'Acometida ø600 (RIACCI40)' },
      { key: 'puerta', label: 'Acometida con puerta (+imán IM175)' },
      { key: 'electrico', label: 'Electrificación (arnés CIJSABY)' },
    ],
  },
  {
    id: 'estacion', nombre: 'Estación de trabajo',
    selects: [
      {
        key: 'tipo', label: 'Configuración',
        opciones: [
          { id: 'J', label: '1 usuario (rincón "J")' },
          { id: 'L', label: '2 usuarios ("L" con conexión)' },
          { id: 'T', label: '2 usuarios "T"' },
          { id: 'cruz', label: '4 usuarios "cruz"' },
        ],
      },
      { key: 'largo', label: 'Largo', opciones: LARGOS_EST },
      { key: 'biombo', label: 'Biombo', opciones: BIOMBOS_2 },
    ],
    finishes: FINISHES,
    checks: [{ key: 'acometida', label: 'Acometida (RIACCI30 / base Alba)' }, { key: 'electrico', label: 'Electrificación (arnés RIJSABY)' }],
  },
  {
    id: 'mesa_juntas', nombre: 'TeamSpace (mesa de juntas)',
    selects: [
      { key: 'secciones', label: 'Secciones', opciones: [{ id: '1', label: '1 (individual)' }, { id: '2', label: '2' }, { id: '3', label: '3' }] },
      {
        key: 'largo', label: 'Ancho por cubierta',
        opciones: [
          { id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' },
          { id: '2100', label: '2.10 m' }, { id: '2400', label: '2.40 m' },
        ],
      },
      { key: 'caja', label: 'Caja eléctrica', opciones: [{ id: 'VH', label: 'VH (con charola)' }, { id: 'E2X', label: 'Ellora E2X (sin charola)' }] },
    ],
    finishes: FINISHES,
    checks: [{ key: 'pantalla', label: 'Pantalla 55" + soporte CPPMT55' }],
  },
];

const num = (v, def) => parseInt(v, 10) || def;
const nearest = (v, keys) => keys.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

export function generarRio(config) {
  const c = {
    producto: 'bench_recto_sencillo', usuarios: '3', largo: '1200', finish: 'ABS',
    biombo: 'AC', tipo: 'J', secciones: '1', caja: 'VH',
    acometida: false, electrico: false, puerta: false, pantalla: false, ...config,
  };
  const largo = num(c.largo, 1200);
  const a = ACAB[c.finish] || ACAB.ABS;
  const comp = [];
  const claves = [];
  const electricos = [];

  // Helper: agrega cubierta (área) + su canto perimetral
  const addCub = (insumo, nombre, key, l, fondo, curva = false) => {
    if (!curva) {
      comp.push({ insumoId: insumo, nombre: `${nombre} (${key})`, cantidad: 1, largoMM: l, anchoMM: fondo });
      comp.push({ insumoId: CANTO, nombre: `Canto — ${nombre}`, cantidad: Math.round(2 * (l + fondo)) / 1000 });
    } else {
      // Caja envolvente: la panza de la curva sale del mismo tablero y se tira.
      const fondoCaja = Math.round(fondo * (1 + FLECHA));
      const arcoMM = arco(l);
      comp.push({ insumoId: insumo, nombre: `${nombre} (${key}) — curva, caja ${l}×${fondoCaja}`, cantidad: 1, largoMM: l, anchoMM: fondoCaja });
      // Dos lados curvos (frente y respaldo) + dos rectos (los costados).
      comp.push({ insumoId: CANTO, nombre: `Canto — ${nombre}`, cantidad: Math.round(2 * arcoMM + 2 * fondo) / 1000 });
      comp.push({ insumoId: CURVADO, nombre: `Ruteado + canteado en curva — ${nombre}`, cantidad: Math.round(2 * arcoMM) / 1000 });
    }
    claves.push(key);
  };
  // Helper: tapa registrable metálica de la cubierta (lámina)
  const addTapa = (l) => comp.push({ insumoId: LAMINA, nombre: 'Tapa registrable + placas tope (lámina)', cantidad: 0.35 * (l / 1000) * 7.16 });

  // ---------------- TeamSpace (mesa de juntas) ----------------
  if (c.producto === 'mesa_juntas') {
    const fondo = 1200;
    const secc = Math.max(1, num(c.secciones, 1));
    const sufMesa = SUF_MJ[nearest(largo, [1200, 1500, 1800, 2100, 2400])];
    const cajaSuf = c.caja === 'E2X' ? 'E2X' : 'CEVH';
    const insMesa = c.finish === 'chapa' ? CHAPA : a.insumo;

    if (secc === 1) {
      addCub(insMesa, 'Cubierta individual mesa juntas', `RIMJCUBIN${sufMesa}${a.suf}${cajaSuf}`, largo, fondo);
    } else {
      addCub(insMesa, 'Cubierta inicio mesa juntas', `RIMJCUBI${sufMesa}${a.suf}${cajaSuf}`, largo, fondo);
      for (let i = 1; i < secc; i++) addCub(insMesa, 'Cubierta central mesa juntas', `RIMJCUBC${sufMesa}${a.suf}${cajaSuf}`, largo, fondo);
    }
    const nCols = secc + 1;
    comp.push({ insumoId: PATA, nombre: 'Pata inclinada alta 66° (RIPAMJ4)', cantidad: 2 * nCols });
    comp.push({ insumoId: ACOM, nombre: 'Base acometida Alba (ABACOM60)', cantidad: secc });
    comp.push({ insumoId: PASACAB, nombre: 'Riel pasacables (RICHPC5)', cantidad: secc });
    comp.push({ insumoId: CAJA, nombre: `Caja eléctrica ${c.caja === 'E2X' ? 'Ellora E2X' : 'VH'}`, cantidad: secc });
    claves.push('RIPAMJ4', 'ABACOM60', 'RICHPC5');
    // Con caja VH SÍ lleva charola RICHA40; con Ellora E2X NO.
    if (c.caja !== 'E2X') {
      comp.push({ insumoId: CHAROLA, nombre: 'Charola pasacables (RICHA40)', cantidad: secc * (largo / 1000) });
      claves.push('RICHA40');
    }
    if (c.pantalla) {
      comp.push({ insumoId: ESCUADRA, nombre: 'Soporte pantalla 55" (CPPMT55, Accents)', cantidad: 1 });
      claves.push('CPPMT55');
      electricos.push('Pantalla 55" (comprada, aparte)', 'Soporte portapantallas CPPMT55');
    }
    electricos.push(`Caja eléctrica ${c.caja === 'E2X' ? 'Ellora E2X' : 'VH'} (aparte)`);
    return armar('mesa', `Río · TeamSpace ${secc}×${(largo / 1000).toFixed(2)} m · caja ${c.caja === 'E2X' ? 'Ellora' : 'VH'} · ${a.label}`, comp, claves, electricos, c,
      'TeamSpace: mesa RIMJCUB (inicio+central o individual) + pata inclinada alta RIPAMJ4 (66°) + base acometida Alba ABACOM60 + riel RICHPC5 + pantalla 55" con soporte CPPMT55 (Accents). Caja VH incluye charola RICHA40; Ellora E2X no. Banco recomendado: Allegro Stooles.');
  }

  // ---------------- Bench / Estación ----------------
  const curvo = c.producto.includes('curvo');
  const recto = c.producto.includes('recto');
  const doble = c.producto.includes('doble');
  const esEstacion = c.producto === 'estacion';
  const fondoCub = 600;

  const insCub = a.insumo; // ABS/CH/TF
  const sufC = SUF_CURVO[nearest(largo, [900, 1200, 1500, 1800])];
  const sufR = SUF_RECTO[nearest(largo, [900, 1050, 1200, 1500, 1800])];
  const sufCI = SUF_CICUB[nearest(largo, [900, 1050, 1200, 1500, 1800])];

  // ------- Cubiertas por producto (MEZCLA de claves reales) -------
  if (recto && !esEstacion) {
    const filas = doble ? 2 : 1;
    const porFila = (doble ? num(c.usuarios, 2) : num(c.usuarios, 3)) / filas; // 1|3 sencillo, 1|3 por fila doble
    for (let f = 0; f < filas; f++) {
      if (porFila <= 1) {
        addCub(insCub, 'Cubierta recta individual', `RICUBRECIN${sufR}${a.suf}`, largo, fondoCub);
      } else {
        // izquierda + central(App CICUB, tapa metálica) + derecha
        addCub(insCub, 'Cubierta recta izquierda', `RICUBRECI${sufR}${a.suf}`, largo, fondoCub);
        const sufCe = c.finish === 'chapa' ? 'ABS' : a.suf; // CICUB sólo ABS/TF
        const insCe = c.finish === 'chapa' ? MEL28 : a.insumo;
        addCub(insCe, 'Cubierta recta central (Modelo APP)', `CICUB${sufCI}${sufCe}TM`, largo, fondoCub);
        addCub(insCub, 'Cubierta recta derecha', `RICUBRECD${sufR}${a.suf}`, largo, fondoCub);
      }
      addTapa(largo * Math.max(1, porFila));
    }
  } else if (curvo && !esEstacion) {
    const filas = doble ? 2 : 1;
    const porFila = num(c.usuarios, doble ? 2 : 1) / filas;
    const pref = doble ? 'RICU' : 'RIBSCU';
    // Restricción: las cubiertas alternan convexa (CX) / cóncava (CV) para una
    // curvatura continua. La 2ª fila (doble) invierte la curvatura de la 1ª.
    const curv = (f, pos) => ((pos + f) % 2 === 0 ? 'CX' : 'CV');
    const nom = (cv) => (cv === 'CX' ? 'convexa' : 'cóncava');
    for (let f = 0; f < filas; f++) {
      if (porFila <= 1) {
        const cv = curv(f, 0);
        addCub(insCub, `Cubierta ${nom(cv)} individual`, `${pref}IN${cv}${sufC}${a.suf}`, largo, fondoCub, true);
      } else {
        const ci = curv(f, 0), cc = curv(f, 1), cd = curv(f, 2);
        addCub(insCub, `Cubierta ${nom(ci)} izquierda`, `${pref}I${ci}${sufC}${a.suf}`, largo, fondoCub, true);
        addCub(insCub, `Cubierta ${nom(cc)} central`, `${pref}CE${cc}${sufC}${a.suf}`, largo, fondoCub, true);
        addCub(insCub, `Cubierta ${nom(cd)} derecha`, `${pref}D${cd}${sufC}${a.suf}`, largo, fondoCub, true);
      }
      addTapa(largo * Math.max(1, porFila));
    }
  }

  // ------- Estación de trabajo (J / L / T / cruz) -------
  if (esEstacion) {
    const sufE = SUF_EST[nearest(largo, [1200, 1500, 1800, 2000])];
    const fondoEst = 1200; // rincón L-shape (aprox rectángulo — FASE A)
    if (c.tipo === 'J') {
      addCub(insCub, 'Cubierta rincón "J" izquierda', `RICUBRINI${sufE}${a.suf}`, largo, fondoEst);
      comp.push({ insumoId: PATA, nombre: 'Pata doble 66° (RIPIBD)', cantidad: 1 });
      comp.push({ insumoId: PATA, nombre: 'Pata izquierda 66° (RIPIIBS)', cantidad: 1 });
      claves.push('RIPIBD', 'RIPIIBS');
    } else if (c.tipo === 'L') {
      addCub(insCub, 'Cubierta "L" derecha con conexión', `RICUBECN60D${sufE}${a.suf}`, largo, fondoEst);
      addCub(insCub, 'Cubierta "L" izquierda con conexión', `RICUBECN60I${sufE}${a.suf}`, largo, fondoEst);
      comp.push({ insumoId: PATA, nombre: 'Pata doble 66° (RIPIBD)', cantidad: 2 });
      comp.push({ insumoId: ESCUADRA, nombre: 'Placa unión con tornillería (QCIPLAUES)', cantidad: 1 });
      comp.push({ insumoId: ACRIL, nombre: 'Biombo divisor Accents (ACBIODIV9M2AC)', cantidad: 1, largoMM: 600, anchoMM: 368 });
      claves.push('RIPIBD', 'QCIPLAUES', 'ACBIODIV9M2AC');
    } else if (c.tipo === 'T') {
      addCub(insCub, 'Cubierta rincón "J" derecha', `RICUBRIND${sufE}${a.suf}`, largo, fondoEst);
      addCub(insCub, 'Cubierta rincón "J" izquierda', `RICUBRINI${sufE}${a.suf}`, largo, fondoEst);
      comp.push({ insumoId: PATA, nombre: 'Pata inclinada estación (RIPIBR)', cantidad: 1 });
      comp.push({ insumoId: PATA, nombre: 'Pata individual derecha (RIPIDBS)', cantidad: 1 });
      comp.push({ insumoId: PATA, nombre: 'Pata individual izquierda (RIPIIBS)', cantidad: 1 });
      claves.push('RIPIBR', 'RIPIDBS', 'RIPIIBS');
    } else { // cruz (4 usuarios)
      addCub(insCub, 'Cubierta rincón "J" derecha', `RICUBRIND${sufE}${a.suf}`, largo, fondoEst);
      addCub(insCub, 'Cubierta rincón "J" izquierda', `RICUBRINI${sufE}${a.suf}`, largo, fondoEst);
      comp.push({ insumoId: PATA, nombre: 'Pata doble 66° (RIPIBD)', cantidad: 1 });
      comp.push({ insumoId: PATA, nombre: 'Pata inclinada estación (RIPIBR)', cantidad: 1 });
      comp.push({ insumoId: ACOM, nombre: 'Base acometida Alba (ABACO40LP)', cantidad: 1 });
      comp.push({ insumoId: DUCTO, nombre: 'Conducto doble (CIDUBD)', cantidad: largo / 1000 });
      comp.push({ insumoId: DUCTO, nombre: 'Conducto (CIDUT, Modelo APP)', cantidad: largo / 1000 });
      claves.push('RIPIBD', 'RIPIBR', 'ABACO40LP', 'CIDUBD', 'CIDUT');
    }
    // refuerzo omega + charola + biombos de estación
    const sufRef = SUF_REF[nearest(largo, [900, 1200, 1500, 1800])];
    comp.push({ insumoId: PTR, nombre: `Omega/refuerzo (RIOM${sufRef})`, cantidad: fondoCub / 1000 });
    comp.push({ insumoId: CHAROLA, nombre: `Charola pasacables (RICHCA${sufRef})`, cantidad: largo / 1000 });
    comp.push({ insumoId: PASACAB, nombre: `Riel pasacables (RIRI${sufRef})`, cantidad: 1 });
    claves.push(`RIOM${sufRef}`, `RICHCA${sufRef}`);
    // Biombo: faldón posterior RIBIOP salvo T/cruz que además llevan recto RIBIOREC
    addBiombo(comp, claves, 'RIBIOP', largo, c.biombo, false);
    if (c.tipo === 'T' || c.tipo === 'cruz') addBiombo(comp, claves, 'RIBIOREC', largo, c.biombo, true);
  }

  // ------- Estructura común de BENCH (patas, refuerzos, biombos, conductos) -------
  if (!esEstacion) {
    const filas = doble ? 2 : 1;
    const nUs = num(c.usuarios, doble ? 2 : 3);
    const porFila = nUs / filas;
    const sufRef = SUF_REF[nearest(largo, [900, 1200, 1500, 1800])];

    if (doble) {
      const cols = porFila + 1;
      comp.push({ insumoId: PATA, nombre: 'Pata doble 66° (RIPIBD)', cantidad: cols });
      comp.push({ insumoId: DUCTO, nombre: `Conducto doble (CIDUBD${sufRef})`, cantidad: porFila * (largo / 1000) });
      comp.push({ insumoId: DUCTO, nombre: `Conducto (CIDUT${sufRef}, Modelo APP)`, cantidad: porFila * (largo / 1000) });
      claves.push('RIPIBD', `CIDUBD${sufRef}`, `CIDUT${sufRef}`);
      if (nUs > 2) { comp.push({ insumoId: ESCUADRA, nombre: 'Placa unión con tornillería (QCIPLAUES)', cantidad: nUs - 2 }); claves.push('QCIPLAUES'); }
      if (c.acometida) {
        comp.push({ insumoId: ACOM, nombre: 'Acometida circular doble ø600 (RIACCI40)', cantidad: 1 });
        claves.push('RIACCI40');
        if (c.puerta) { comp.push({ insumoId: TORN, nombre: 'Puerta metálica + imán IM175 (acometida)', cantidad: 1 }); claves.push('IM175'); }
      }
    } else {
      comp.push({ insumoId: PATA, nombre: 'Pata izquierda 66° (RIPIIBS)', cantidad: 1 });
      comp.push({ insumoId: PATA, nombre: 'Pata derecha 66° (RIPIDBS)', cantidad: 1 });
      claves.push('RIPIIBS', 'RIPIDBS');
      if (porFila > 1) {
        comp.push({ insumoId: PATA, nombre: 'Pata intermedia 66° (RIPIDBS)', cantidad: porFila - 2 > 0 ? porFila - 2 : 0 });
        comp.push({ insumoId: ESCUADRA, nombre: 'Placa unión con tornillería (QCIPLAUES)', cantidad: porFila - 1 });
        claves.push('QCIPLAUES');
        // biombo divisor entre usuarios
        comp.push({ insumoId: ACRIL, nombre: 'Biombo divisor Accents (ACBIODIV9M2AC)', cantidad: porFila - 1, largoMM: 600, anchoMM: 368 });
        claves.push('ACBIODIV9M2AC');
      }
      if (c.acometida) {
        comp.push({ insumoId: ACOM, nombre: 'Acometida circular ø300 (RIACCI30)', cantidad: Math.max(1, porFila - 1) });
        claves.push('RIACCI30');
      }
    }

    // Omega/refuerzo + charola + riel pasacables por fila
    comp.push({ insumoId: PTR, nombre: `Omega/refuerzo (RIOM${sufRef} / RIRECU${sufRef})`, cantidad: filas * porFila * (fondoCub / 1000) });
    comp.push({ insumoId: CHAROLA, nombre: `Charola pasacables (RICHCA${sufRef})`, cantidad: filas * porFila * (largo / 1000) });
    comp.push({ insumoId: PASACAB, nombre: `Riel pasacables (RIRI${sufRef})`, cantidad: filas * porFila });

    // Biombos: sencillo curvo/recto → RIBIOP posterior; doble curvo → RIBIO; doble recto → RIBIOREC
    if (doble) {
      const clv = curvo ? 'RIBIO' : 'RIBIOREC';
      for (let i = 0; i < porFila; i++) addBiombo(comp, claves, clv, largo, c.biombo, true);
    } else {
      for (let i = 0; i < porFila; i++) addBiombo(comp, claves, 'RIBIOP', largo, c.biombo, false);
    }
  }

  // ------- Electrificación (arnés Byrne Phase 2) -------
  if (c.electrico) {
    const nUs = esEstacion ? (c.tipo === 'cruz' ? 4 : (c.tipo === 'J' ? 1 : 2)) : num(c.usuarios, doble ? 2 : 3);
    const soporte = doble ? 'CIJSABY' : 'RIJSABY';
    comp.push({ insumoId: ARNES, nombre: `Arnés Byrne Phase 2 + soporte ${soporte}`, cantidad: nUs });
    claves.push(soporte);
    electricos.push(`Arnés Byrne Phase 2 con soporte ${soporte} (extensión 48"/52"/60" por medida, aparte)`);
  }

  const nombre = `Río · ${nombreProducto(c)} · ${(largo / 1000).toFixed(2)} m · ${a.label}`;
  return armar(esEstacion ? 'estacion' : 'bench', nombre, comp, claves, electricos, c,
    'Río (Fase A): claves reales de cubierta por forma+posición (mezcla convexa/cóncava e izq/central/der). MP estimada — calibrar patas 66°/omegas/charolas/conductos y desarrollo de biombos con lista de MP real. Cubierta recta central = Modelo APP (CICUB, tapa metálica, sólo ABS/TF).');
}

// Biombo: panel (área) + faldón/soportes. RIBIOP=faldón posterior (AC/PT);
// RIBIO=curvo, RIBIOREC=recto (AC/PT/LP). Sufijo por tamaño.
function addBiombo(comp, claves, familia, largo, biomboId, permiteLP) {
  // RIBIO es el biombo CURVO: acompaña la onda de la cubierta, así que se rutea
  // en curva igual que ella. Antes se cobraba como un panel recto.
  const curva = familia === 'RIBIO';
  let bid = biomboId;
  if (bid === 'LP' && !permiteLP) bid = 'PT'; // RIBIOP no tiene lámina perforada
  const b = BIOMAT[bid] || BIOMAT.AC;
  const suf = familia === 'RIBIOP'
    ? SUF_BIOP[nearest(largo, [900, 1200, 1500, 1800])]
    : SUF_BIOC[nearest(largo, [900, 1050, 1200, 1500, 1800, 2000])];
  const key = `${familia}${suf}${b.suf}`;
  const alto = familia === 'RIBIOP' ? 827 : (familia === 'RIBIO' ? 400 : 560);
  // ⚠️ UNIDAD: el acrílico y el PET se costean por ÁREA (largo×alto), pero la
  // LÁMINA PERFORADA se compra por KG. Pasarle largoMM/anchoMM la dejaba 7.2x
  // barata y ningún revisor lo veía, porque el precio del insumo sí está bien:
  // lo que estaba mal era CÓMO lo consume el despiece.
  const nomBio = `Biombo ${familia === 'RIBIOP' ? 'faldón' : (familia === 'RIBIO' ? 'curvo' : 'recto')} ${b.label} (${key})`;
  if (b.insumo === LAMINA) comp.push({ insumoId: LAMINA, nombre: nomBio, cantidad: (largo / 1000) * (alto / 1000) * 7.16 });
  else comp.push({ insumoId: b.insumo, nombre: nomBio, cantidad: 1, largoMM: largo, anchoMM: alto });
  comp.push({ insumoId: 'lamina-20', nombre: 'Faldón/soportes metálicos biombo (lámina)', cantidad: 0.2 * (largo / 1000) * 7.16 });
  if (curva) comp.push({ insumoId: CURVADO, nombre: `Ruteado + canteado en curva — biombo (${key})`, cantidad: Math.round(2 * arco(largo)) / 1000 });
  claves.push(key);
}

function nombreProducto(c) {
  const base = {
    bench_recto_sencillo: 'Bench recto sencillo', bench_recto_doble: 'Bench recto doble',
    bench_curvo_sencillo: 'Bench curvo sencillo', bench_curvo_doble: 'Bench curvo doble',
    mesa_juntas: 'TeamSpace',
  }[c.producto] || c.producto;
  if (c.producto === 'estacion') {
    const t = { J: 'Estación 1u "J"', L: 'Estación 2u "L"', T: 'Estación 2u "T"', cruz: 'Estación 4u "cruz"' }[c.tipo] || 'Estación';
    return t;
  }
  const uNombre = c.usuarios ? ` ${c.usuarios}u` : '';
  return base + uNombre;
}

function armar(tipoRender, nombre, componentes, claves, electricos, c, nota) {
  return {
    producto: c.producto, nombre, componentes, claves, electricos,
    modoManoObra: 'porcentaje', factorDirecta: 38, factorIndirecta: 12,
    nota,
  };
}
