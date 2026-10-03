// ============================================================================
//  MiniRender — render ISOMÉTRICO paramétrico por tipo de mueble (no hay fotos).
//  Dibuja el mueble en 3D a partir de sus MEDIDAS reales (largo×fondo×alto),
//  con caras SOMBREADAS CON DEGRADADO, sombra de piso suave y luz de borde, y el
//  rojo de marca como canto ABS. Escala solo. El TIPO sale del nombre Y de la
//  descripción, para que al describir el mueble el esquema cambie a lo entendido.
// ============================================================================
import { useId } from 'react';

// Aclara (amt>0) u oscurece (amt<0) un color hex — para generar degradados por cara.
function hexLerp(hex, amt) {
  const n = parseInt(String(hex).slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
}

// Deduce el tipo a partir del nombre/linea Y la descripción del costeo. Al escribir
// "banca de aeropuerto…" el esquema deja de ser un escritorio genérico y pasa a banca.
export function tipoDeMueble(costeo) {
  const t = `${costeo?.nombre || ''} ${costeo?.linea || ''} ${costeo?.descripcionCliente || ''}`.toLowerCase();
  if (costeo?.bench || t.includes('bench') || t.includes('banca')) return 'bench';
  if (t.includes('estacion') || t.includes('estación') || t.includes(' en l') || t.includes('lateral') || t.includes('retorno')) return 'estacion';
  if (t.includes('escritorio')) return 'escritorio';
  if (t.includes('soporte') || t.includes('porta pantalla') || t.includes('teamspace ii')) return 'mampara';
  if (t.includes('pebble') || t.includes('apoyo') || t.includes('accents') || t.includes('lateral de apoyo')) return 'mesita';
  if (t.includes('mesa') || t.includes('teamspace') || t.includes('juntas') || t.includes('consejo') || t.includes('circular')) return 'mesa';
  if (t.includes('credenza') || t.includes('archiv') || t.includes('cajoner') || t.includes('torre') || t.includes('guarda') || t.includes('gabinete') || t.includes('locker') || t.includes('librero') || t.includes('gaveta') || t.includes('armario') || t.includes('wally')) return 'guarda';
  if (t.includes('mampara') || t.includes('divisor') || t.includes('muro') || t.includes('biombo') || t.includes('puerta') || t.includes('panel') || t.includes('privacy')) return 'mampara';
  if (t.includes('sillon') || t.includes('sillón') || t.includes('lounge') || t.includes('pouf') || t.includes('silla') || t.includes('banco') || t.includes('kasia')
    || t.includes('sofa') || t.includes('sofá') || t.includes('tetris') || t.includes('arlequ') || t.includes(' pac') || t.includes('taburete') || t.includes('ottoman')) return 'asiento';
  return 'escritorio';
}

// Medidas reales (mm) de la pieza de mayor área con dimensiones
export function dimsDeMueble(costeo) {
  let w = 0, d = 0, mx = 0;
  for (const c of (costeo?.componentes || [])) {
    if (c.largoMM && c.anchoMM && c.largoMM * c.anchoMM > mx) {
      mx = c.largoMM * c.anchoMM; w = c.largoMM; d = c.anchoMM;
    }
  }
  return { w: w || 1500, d: d || 600 };
}

const ISO_COS = Math.cos(Math.PI / 6), ISO_SIN = Math.sin(Math.PI / 6);
const STROKE = '#2B2622', RED = '#B22A22';
const TT = 28; // espesor de cubierta

// Paleta de caras por material (top = luz, left = sombra, right = medio)
const MAT = {
  top:   { top: '#F5F2ED', right: '#E5DFD6', left: '#D4CDC3' },
  leg:   { top: '#CFC8BE', right: '#C0B9AF', left: '#ABA398' },
  glass: { top: '#E7EDEE', right: '#DBE4E5', left: '#CAD6D8' },
  cab:   { top: '#F0EBE4', right: '#E1DAD0', left: '#CFC7BC' },
  seat:  { top: '#EDE7DF', right: '#DED6CB', left: '#CBC2B5' },
};

// Un prisma: caras visibles (izq, der, sup) como listas de puntos 3D
function box(x, y, z, w, d, h) {
  const zt = z + h;
  const P = (X, Y, Z) => [X, Y, Z];
  return {
    top:   [P(x, y, zt), P(x + w, y, zt), P(x + w, y + d, zt), P(x, y + d, zt)],
    right: [P(x + w, y, zt), P(x + w, y + d, zt), P(x + w, y + d, z), P(x + w, y, z)],
    left:  [P(x, y + d, zt), P(x + w, y + d, zt), P(x + w, y + d, z), P(x, y + d, z)],
  };
}

const ALTURA = { escritorio: 750, estacion: 750, bench: 750, mesa: 740, mesita: 450, guarda: 820, mampara: 2400, asiento: 780 };

// Modelo por tipo → lista de sólidos {b: box, k: material, accent?: canto rojo}
function modelo(tipo, w, d, h) {
  const S = [];
  const desk = () => {
    const legT = 45, ins = 55, off = 30;
    S.push({ b: box(ins, off, 0, legT, d - 2 * off, h - TT), k: 'leg' });
    S.push({ b: box(w - ins - legT, off, 0, legT, d - 2 * off, h - TT), k: 'leg' });
    S.push({ b: box(0, 0, h - TT, w, d, TT), k: 'top', accent: true });
  };
  switch (tipo) {
    case 'bench': {
      const legT = 45, ins = 55, off = 30;
      S.push({ b: box(ins, off, 0, legT, d - 2 * off, h - TT), k: 'leg' });
      S.push({ b: box(w - ins - legT, off, 0, legT, d - 2 * off, h - TT), k: 'leg' });
      S.push({ b: box(0, 0, h - TT, w, d, TT), k: 'top', accent: true });
      S.push({ b: box(150, d / 2 - 8, h - TT, w - 300, 16, 360), k: 'glass' }); // biombo central
      break;
    }
    case 'mesa': {
      const legT = 42, ins = 75;
      [[ins, ins], [w - ins - legT, ins], [ins, d - ins - legT], [w - ins - legT, d - ins - legT]]
        .forEach(([lx, ly]) => S.push({ b: box(lx, ly, 0, legT, legT, h - TT), k: 'leg' }));
      S.push({ b: box(0, 0, h - TT, w, d, TT), k: 'top', accent: true });
      break;
    }
    case 'guarda': {
      S.push({ b: box(0, 0, 0, w, d, h), k: 'cab', accent: true, doors: true });
      break;
    }
    case 'mampara': {
      const ft = Math.min(140, w * 0.14), dep = Math.max(d, 60);
      S.push({ b: box(6, -30, 0, ft, dep + 60, 45), k: 'leg' });
      S.push({ b: box(w - 6 - ft, -30, 0, ft, dep + 60, 45), k: 'leg' });
      S.push({ b: box(0, 0, 45, w, dep, h - 45), k: 'glass', accent: true });
      break;
    }
    case 'mesita': {
      // Mesa de apoyo (Pebble): cubierta orgánica sobre base central de columna
      const cw = Math.min(160, w * 0.3), fw = Math.min(w * 0.5, 360);
      S.push({ b: box((w - fw) / 2, (d - fw * (d / w)) / 2, 0, fw, Math.min(fw, d * 0.6), 26), k: 'leg' });   // pie
      S.push({ b: box((w - cw) / 2, (d - cw) / 2, 26, cw, cw, h - TT - 26), k: 'leg' });                       // columna
      S.push({ b: box(0, 0, h - TT, w, d, TT), k: 'top', accent: true });
      break;
    }
    case 'asiento': {
      // Silla: 4 patas + asiento + respaldo (fondo acotado)
      const dd = Math.min(Math.max(d, 460), 560), ww = Math.min(Math.max(w, 440), 560);
      const seatH = 440, seatT = 90, lt = 40, ins = 45;
      [[ins, ins], [ww - ins - lt, ins], [ins, dd - ins - lt], [ww - ins - lt, dd - ins - lt]]
        .forEach(([lx, ly]) => S.push({ b: box(lx, ly, 0, lt, lt, seatH - seatT), k: 'leg' }));
      S.push({ b: box(0, 0, seatH - seatT, ww, dd, seatT), k: 'seat' });
      S.push({ b: box(0, dd - 55, seatH, ww, 55, 420), k: 'seat', accent: true });   // respaldo
      break;
    }
    case 'estacion': {
      desk();
      const RW = Math.min(700, w * 0.5), RD = Math.min(520, d + 200);
      S.push({ b: box(w - RW, d, 0, 45, RD, h - TT), k: 'leg' });
      S.push({ b: box(w - RW, d, h - TT, RW, RD, TT), k: 'top', accent: true });
      break;
    }
    default: desk();
  }
  return S;
}

export default function MiniRender({ tipo = 'escritorio', w = 1500, d = 600, h }) {
  // id único por instancia: los degradados/filtros no deben colisionar si hay varios
  // MiniRender en la misma página (p. ej. el catálogo).
  const uid = 'mr' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const H = h || ALTURA[tipo] || 750;
  const solids = modelo(tipo, Math.max(300, w), Math.max(300, d), H);

  const proj = ([x, y, z]) => [(x - y) * ISO_COS, (x + y) * ISO_SIN - z];

  // Bounding box de todo el modelo proyectado, para escalar al viewBox
  const pts = [];
  solids.forEach((s) => ['top', 'left', 'right'].forEach((f) => s.b[f].forEach((p) => pts.push(proj(p)))));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const VW = 200, VH = 160, pad = 22;
  const sc = Math.min((VW - 2 * pad) / (maxX - minX || 1), (VH - 2 * pad) / (maxY - minY || 1));
  const ox = (VW - (maxX - minX) * sc) / 2, oy = (VH - (maxY - minY) * sc) / 2;
  const M = (p3) => { const [px, py] = proj(p3); return [ox + (px - minX) * sc, oy + (py - minY) * sc]; };
  const poly = (pts3) => pts3.map(M).map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const line = (a, b) => { const A = M(a), B = M(b); return `M${A[0].toFixed(1)} ${A[1].toFixed(1)} L${B[0].toFixed(1)} ${B[1].toFixed(1)}`; };

  const defs = [];
  const el = [];

  // Degradado vertical por cara: luz arriba, sombra abajo. Da volumen (deja de verse plano).
  const faceFill = (key, mat, face) => {
    const bc = (MAT[mat] || MAT.top)[face];
    const id = `${uid}-${key}`;
    const strong = face === 'top';
    defs.push(
      <linearGradient key={id} id={id} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor={hexLerp(bc, strong ? 0.10 : 0.05)} />
        <stop offset="1" stopColor={hexLerp(bc, strong ? -0.05 : -0.10)} />
      </linearGradient>,
    );
    return `url(#${id})`;
  };

  // Sombra de piso SUAVE (blur) con degradado radial: asienta el objeto, se ve real.
  defs.push(<filter key="soft" id={`${uid}-soft`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.8" /></filter>);
  defs.push(
    <radialGradient key="floor" id={`${uid}-floor`} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#282420" stopOpacity="0.20" />
      <stop offset="1" stopColor="#282420" stopOpacity="0" />
    </radialGradient>,
  );
  const base = [];
  solids.forEach((s) => { const b = s.b.left, r = s.b.right; base.push(b[2], b[3], r[2], r[3]); });
  const bxs = base.map((p) => proj(p)[0]);
  const cx = (Math.min(...bxs) + Math.max(...bxs)) / 2;
  const groundPts = base.map(([x, y]) => proj([x, y, 0]));
  const gcx = ox + (cx - minX) * sc;
  const gcy = oy + (Math.max(...groundPts.map((p) => p[1])) - minY) * sc;
  const grx = Math.max(30, (maxX - minX) * sc * 0.46);
  el.push(<ellipse key="sh" cx={gcx} cy={gcy - 1} rx={grx} ry={10} fill={`url(#${uid}-floor)`} filter={`url(#${uid}-soft)`} />);

  const STK = '#3b332d';
  // Caras (izq, der, sup) por sólido, en orden de arreglo (atrás→frente)
  solids.forEach((s, i) => {
    const op = s.k === 'glass' ? 0.8 : 1;
    ['left', 'right', 'top'].forEach((f) => {
      el.push(<polygon key={`p${i}${f}`} points={poly(s.b[f])} fill={faceFill(`${i}${f}`, s.k, f)} fillOpacity={op} stroke={STK} strokeOpacity={0.42} strokeWidth={0.7} strokeLinejoin="round" />);
    });
    // Puertas/entrepaños del gabinete
    if (s.doors) {
      const r = s.b.right; // cara frontal derecha
      const mid = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      el.push(<path key={`d${i}`} d={line(mid(r[0], r[3], 0.5), mid(r[1], r[2], 0.5))} stroke={STK} strokeOpacity={0.5} strokeWidth={0.8} fill="none" />);
      const h1 = mid(mid(r[0], r[1], 0.5), mid(r[3], r[2], 0.5), 0.28);
      const P = M(h1); el.push(<circle key={`h${i}`} cx={P[0]} cy={P[1]} r={1.6} fill={STK} fillOpacity={0.6} />);
    }
    // Cubierta: luz de borde (rim) en las aristas traseras + canto ABS rojo en los frontales
    if (s.accent) {
      const t = s.b.top; // [A(atrás),B,C(frente),D]
      el.push(<path key={`rim${i}a`} d={line(t[0], t[1])} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.9} strokeLinecap="round" fill="none" />);
      el.push(<path key={`rim${i}b`} d={line(t[0], t[3])} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.9} strokeLinecap="round" fill="none" />);
      el.push(<path key={`a${i}1`} d={line(t[1], t[2])} stroke={RED} strokeWidth={2} strokeLinecap="round" fill="none" />);
      el.push(<path key={`a${i}2`} d={line(t[3], t[2])} stroke={RED} strokeWidth={2} strokeLinecap="round" fill="none" />);
    }
  });

  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%" role="img" aria-label={`Render ${tipo} ${(w / 1000).toFixed(2)}×${(d / 1000).toFixed(2)}`}>
      <defs>{defs}</defs>
      {el}
    </svg>
  );
}
