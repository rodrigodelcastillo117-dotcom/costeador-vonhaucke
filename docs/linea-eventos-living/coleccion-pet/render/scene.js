// Renders de la colección Von Haucke Living. Cada mueble se arma con las piezas del despiece
// (bom2.mjs): mismas medidas en metros, mismos retiros, arcos y portillas.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const Q = new URLSearchParams(location.search);
const SHOT = Q.get('shot') || 'nest';
const W = +(Q.get('w') || 2400), H = +(Q.get('h') || 1600);
const USE_AO = Q.get('ao') !== '0';

// ---------------------------------------------------------------- utilidades
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; } return s; }
const mix = (a, b, t) => a + (b - a) * t;

function canvasTex(size, painter, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size);
  painter(img.data, size, ctx);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.repeat.set(repeat, repeat);
  return t;
}

// Nogal Neo TX: veta a lo largo de u
function nogalTex() {
  return canvasTex(1024, (d, N) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const n = fbm(x * 0.0035, y * 0.045, 5);
      const ring = 0.5 + 0.5 * Math.sin(y * 0.11 + n * 26);
      const line = Math.pow(ring, 6);
      const big = fbm(x * 0.0015 + 3, y * 0.006 + 9, 3);
      const fine = vnoise(x * 0.8, y * 0.08) * 0.06;
      const k = 0.62 + big * 0.4 - line * 0.2 - fine;
      const i = (y * N + x) * 4;
      d[i] = 104 * k + 12; d[i + 1] = 76 * k + 9; d[i + 2] = 56 * k + 7; d[i + 3] = 255;
    }
  });
}
// Antracita Light TX: gris grafito con poro fino
function grafitoTex() {
  return canvasTex(512, (d, N) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const n = vnoise(x * 0.9, y * 0.9) * 0.06 + fbm(x * 0.02, y * 0.02, 3) * 0.05;
      const v = 60 + n * 120; const i = (y * N + x) * 4;
      d[i] = v; d[i + 1] = v + 2; d[i + 2] = v + 5; d[i + 3] = 255;
    }
  }, 1);
}
// Piso de encino claro en duela de 160 mm
function pisoTex() {
  return canvasTex(2048, (d, N) => {
    const pw = 128; // 0.16 m si el tile mide 2.56 m
    for (let y = 0; y < N; y++) {
      const row = Math.floor(y / pw);
      for (let x = 0; x < N; x++) {
        const off = (row * 677) % 1024; const col = Math.floor((x + off) / 960);
        const tint = hash(row, col) * 0.12 - 0.06;
        const n = fbm((x + off) * 0.004, y * 0.08, 4);
        const ring = Math.pow(0.5 + 0.5 * Math.sin(y * 0.25 + n * 18 + row * 3), 5);
        let k = 0.92 + tint - ring * 0.1 + fbm(x * 0.002, y * 0.01) * 0.12;
        const seamY = (y % pw) < 2; const seamX = ((x + off) % 960) < 2;
        if (seamY || seamX) k *= 0.72;
        const i = (y * N + x) * 4;
        d[i] = 192 * k; d[i + 1] = 163 * k; d[i + 2] = 126 * k; d[i + 3] = 255;
      }
    }
  });
}
function plasterTex(r = 222, g = 214, b = 202) {
  return canvasTex(1024, (d, N) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const n = fbm(x * 0.01, y * 0.01, 4) * 0.05 + vnoise(x * 0.5, y * 0.5) * 0.015;
      const k = 0.97 + n; const i = (y * N + x) * 4;
      d[i] = r * k; d[i + 1] = g * k; d[i + 2] = b * k; d[i + 3] = 255;
    }
  });
}
function telaTex(r, g, b, scale = 1) {
  return canvasTex(512, (d, N) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const w = (Math.sin(x * 1.6 * scale) * Math.sin(y * 1.6 * scale)) * 0.04;
      const n = vnoise(x * 0.3, y * 0.3) * 0.08 + fbm(x * 0.02, y * 0.02) * 0.06;
      const k = 0.92 + w + n; const i = (y * N + x) * 4;
      d[i] = r * k; d[i + 1] = g * k; d[i + 2] = b * k; d[i + 3] = 255;
    }
  });
}
function sisalTex() {
  return canvasTex(512, (d, N) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const band = Math.floor(y / 10) % 2;
      const s = band ? Math.sin((x + y) * 0.9) : Math.sin((x - y) * 0.9);
      const n = vnoise(x * 0.4, y * 0.4) * 0.15;
      const k = 0.85 + s * 0.08 + n - ((y % 10) < 1 ? 0.2 : 0);
      const i = (y * N + x) * 4;
      d[i] = 196 * k; d[i + 1] = 165 * k; d[i + 2] = 112 * k; d[i + 3] = 255;
    }
  });
}
function rugTex() {
  return canvasTex(1024, (d, N) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const n = vnoise(x * 0.6, y * 0.6) * 0.1 + fbm(x * 0.01, y * 0.01) * 0.08;
      const border = (x < 40 || y < 40 || x > N - 41 || y > N - 41) ? -0.06 : 0;
      const k = 0.9 + n + border; const i = (y * N + x) * 4;
      d[i] = 186 * k; d[i + 1] = 175 * k; d[i + 2] = 158 * k; d[i + 3] = 255;
    }
  });
}
function artTex() {
  const c = document.createElement('canvas'); c.width = 600; c.height = 800;
  const x = c.getContext('2d');
  x.fillStyle = '#e7dccb'; x.fillRect(0, 0, 600, 800);
  x.fillStyle = '#b5764e'; x.beginPath(); x.moveTo(150, 640); x.lineTo(150, 360); x.arc(300, 360, 150, Math.PI, 0); x.lineTo(450, 640); x.closePath(); x.fill();
  x.fillStyle = '#3c3e3f'; x.beginPath(); x.arc(410, 250, 70, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#8a7d6c'; x.lineWidth = 3; x.beginPath(); x.moveTo(90, 690); x.lineTo(510, 690); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// UV en escala de mundo, con la veta en el eje indicado
function worldUV(geo, S, grain, ox = 0, oy = 0) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const g = { x: 0, y: 1, z: 2 }[grain];
  for (let i = 0; i < pos.count; i++) {
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const k = n.indexOf(Math.max(...n));
    const axes = [0, 1, 2].filter((a) => a !== k);
    let ua = axes[0], va = axes[1];
    if (axes.includes(g)) { ua = g; va = axes.find((a) => a !== g); }
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    uv.setXY(i, p[ua] / S + ox, p[va] / S + oy);
  }
  uv.needsUpdate = true;
}

// ---------------------------------------------------------------- materiales
const M = {};
function materiales() {
  const nog = nogalTex();
  M.nogal = new THREE.MeshStandardMaterial({ map: nog, roughness: 0.5, metalness: 0 }); M.nogal.userData.S = 1.1;
  const gr = grafitoTex();
  M.grafito = new THREE.MeshStandardMaterial({ map: gr, color: 0xb9bdc1, roughness: 0.72 }); M.grafito.userData.S = 0.5;
  M.grafitoDark = new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.9 });
  M.metal = new THREE.MeshStandardMaterial({ color: 0x2f3133, roughness: 0.45, metalness: 0.6 });
  M.inox = new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.22, metalness: 1 });
  M.oro = new THREE.MeshStandardMaterial({ color: 0xc9a36a, roughness: 0.3, metalness: 1 });
  M.piso = new THREE.MeshStandardMaterial({ map: pisoTex(), roughness: 0.62 });
  M.pared = new THREE.MeshStandardMaterial({ map: plasterTex(), roughness: 0.95 });
  M.estudio = new THREE.MeshStandardMaterial({ map: plasterTex(226, 221, 213), roughness: 0.95 });
  M.zoclo = new THREE.MeshStandardMaterial({ color: 0xece7df, roughness: 0.8 });
  M.tela = new THREE.MeshStandardMaterial({ map: telaTex(206, 194, 176), roughness: 0.97 });
  M.sofa = new THREE.MeshStandardMaterial({ map: telaTex(172, 162, 148, 0.7), roughness: 0.98 });
  M.boucle = new THREE.MeshStandardMaterial({ map: telaTex(232, 226, 214, 2.2), roughness: 1 });
  M.sisal = new THREE.MeshStandardMaterial({ map: sisalTex(), roughness: 0.95 });
  M.rug = new THREE.MeshStandardMaterial({ map: rugTex(), roughness: 1 });
  M.ceramica = new THREE.MeshStandardMaterial({ color: 0xe9e3d8, roughness: 0.55 });
  M.barro = new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.85 });
  M.hoja = new THREE.MeshStandardMaterial({ color: 0x4f6142, roughness: 0.7, side: THREE.DoubleSide });
  M.tallo = new THREE.MeshStandardMaterial({ color: 0x5a4a36, roughness: 0.8 });
  M.pantalla = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.18, metalness: 0.2 });
  M.aluminio = new THREE.MeshStandardMaterial({ color: 0xbfc2c5, roughness: 0.35, metalness: 0.9 });
  M.vidrio = new THREE.MeshPhysicalMaterial({ color: 0xf2ece4, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.55 });
  M.ambar = new THREE.MeshStandardMaterial({ color: 0xc58a4a, roughness: 0.15, transparent: true, opacity: 0.85 });
  M.marco = new THREE.MeshStandardMaterial({ color: 0x2a2b2c, roughness: 0.6 });
  M.arte = new THREE.MeshStandardMaterial({ map: artTex(), roughness: 0.9 });
  M.libros = [0xcfc4b2, 0x6e7a6c, 0xa86f4e, 0x2f3437, 0xe3ddd1].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  M.croqueta = new THREE.MeshStandardMaterial({ color: 0x7a4b2a, roughness: 0.9 });
  M.glow = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
}

// ---------------------------------------------------------------- piezas
function addMesh(g, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
// tablero: caja con canto suavizado (radio 1.5 mm, como el canto ABS)
function tab(g, x0, y0, z0, x1, y1, z1, mat, grain = 'x') {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const r = Math.min(0.0018, Math.min(w, h, d) / 2.2);
  const geo = new RoundedBoxGeometry(w, h, d, 2, r);
  if (mat.map) worldUV(geo, mat.userData.S || 1, grain, rnd() * 3, rnd() * 3);
  return addMesh(g, geo, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}
// tablero frontal (plano XY) con perforación; extruido hacia +z
function tabHueco(g, x0, y0, z0, w, h, t, mat, hueco) {
  const s = new THREE.Shape();
  if (hueco.tipo === 'arco') {
    const { cx, ww, hh } = hueco; const r = ww / 2;
    s.moveTo(0, 0); s.lineTo(cx - r, 0); s.lineTo(cx - r, hh - r);
    s.absarc(cx, hh - r, r, Math.PI, 0, true);
    s.lineTo(cx + r, 0); s.lineTo(w, 0); s.lineTo(w, h); s.lineTo(0, h); s.lineTo(0, 0);
  } else {
    s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, h); s.lineTo(0, h); s.lineTo(0, 0);
    const p = new THREE.Path(); p.absarc(hueco.cx, hueco.cy, hueco.r, 0, Math.PI * 2, true); s.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 48 });
  if (mat.map) worldUV(geo, mat.userData.S || 1, 'x', rnd(), rnd());
  return addMesh(g, geo, mat, x0, y0, z0);
}
function cojin(g, cx, y0, cz, w, h, d, mat = M.tela) {
  const geo = new RoundedBoxGeometry(w, h, d, 6, Math.min(h / 2.1, 0.035));
  worldUV(geo, 0.4, 'x');
  return addMesh(g, geo, mat, cx, y0 + h / 2, cz);
}
function lathe(g, pts, mat, x, y, z, seg = 48) {
  const geo = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  return addMesh(g, geo, mat, x, y, z);
}
function libros(g, x, y, z, n = 3, rot = 0.1) {
  let yy = y;
  for (let i = 0; i < n; i++) {
    const w = 0.24 + rnd() * 0.06, d = 0.17 + rnd() * 0.04, h = 0.022 + rnd() * 0.018;
    const geo = new RoundedBoxGeometry(w, h, d, 2, 0.002);
    const m = addMesh(g, geo, M.libros[(i + Math.floor(rnd() * 5)) % 5], x, yy + h / 2, z);
    m.rotation.y = rot + (rnd() - 0.5) * 0.25; yy += h;
  }
  return yy;
}
function florero(g, x, y, z, s = 1) {
  lathe(g, [[0, 0], [0.05 * s, 0], [0.065 * s, 0.03 * s], [0.07 * s, 0.09 * s], [0.05 * s, 0.16 * s], [0.03 * s, 0.2 * s], [0.034 * s, 0.215 * s], [0, 0.215 * s]], M.ceramica, x, y, z);
}
function planta(g, x, y, z, s = 1, maceta = true) {
  if (maceta) lathe(g, [[0, 0], [0.09 * s, 0], [0.11 * s, 0.2 * s], [0.115 * s, 0.22 * s], [0, 0.22 * s]], M.barro, x, y, z);
  const base = y + (maceta ? 0.21 * s : 0);
  const leafGeo = new THREE.SphereGeometry(1, 8, 6); leafGeo.scale(0.018 * s, 0.006 * s, 0.045 * s);
  const n = Math.floor(160 * s);
  const inst = new THREE.InstancedMesh(leafGeo, M.hoja, n); inst.castShadow = true;
  const dm = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.22 * s, hh = 0.1 * s + rnd() * 0.55 * s;
    dm.position.set(x + Math.cos(a) * rr, base + hh, z + Math.sin(a) * rr * 0.8);
    dm.rotation.set(rnd() * 1.2 - 0.6, rnd() * Math.PI * 2, rnd() * 1.2 - 0.6);
    dm.updateMatrix(); inst.setMatrixAt(i, dm.matrix);
  }
  g.add(inst);
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.003 * s, 0.005 * s, 0.6 * s, 6), M.tallo);
    c.position.set(x + Math.cos(a) * 0.05 * s, base + 0.3 * s, z + Math.sin(a) * 0.05 * s); c.rotation.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25); g.add(c);
  }
}
function canasta(g, x, y, z, w, h, d) {
  const geo = new RoundedBoxGeometry(w, h, d, 3, 0.01); worldUV(geo, 0.25, 'x');
  return addMesh(g, geo, M.sisal, x, y + h / 2, z);
}
function tazon(g, x, y, z) {
  lathe(g, [[0, 0.005], [0.07, 0.0], [0.085, 0.055], [0.09, 0.06], [0.082, 0.06], [0.072, 0.012], [0, 0.012]], M.inox, x, y, z);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.025, 24), M.croqueta); c.position.set(x, y + 0.03, z); g.add(c);
}

// ---------------------------------------------------------------- muebles (x largo, y alto, z fondo; frente en z = D)
function NEST(variante = 'canino') {
  const g = new THREE.Group();
  tab(g, 0, 0.372, 0, 1.1, 0.4, 0.59, M.nogal, 'x');           // cubierta
  tab(g, 1.072, 0, 0, 1.1, 0.372, 0.59, M.nogal, 'y');         // pata cascada
  tab(g, 0.06, 0.003, 0.06, 0.076, 0.372, 0.53, M.grafito);      // costado caja
  tab(g, 0.076, 0.003, 0.06, 1.072, 0.019, 0.53, M.grafito);     // piso corrido
  tab(g, 0.604, 0.019, 0.06, 0.62, 0.372, 0.53, M.grafito);      // divisor
  tabHueco(g, 0.076, 0.003, 0.06, 0.528, 0.369, 0.016, M.grafito, { tipo: 'circ', cx: 0.264, cy: 0.2, r: 0.09 }); // fondo con salida
  const frente = variante === 'canino'
    ? { tipo: 'arco', cx: 0.264, ww: 0.24, hh: 0.266 }
    : { tipo: 'circ', cx: 0.264, cy: 0.2, r: 0.1 };
  tabHueco(g, 0.076, 0.003, 0.514, 0.528, 0.369, 0.016, M.grafito, frente);
  cojin(g, 0.34, 0.019, 0.295, 0.46, 0.055, 0.4);
  if (variante === 'felino') { const s = tab(g, 1.1, 0.06, 0.15, 1.108, 0.33, 0.44, M.sisal, 'y'); }
  canasta(g, 0.86, 0.019, 0.3, 0.3, 0.16, 0.32);
  return g;
}

function HAVEN() {
  const g = new THREE.Group(); const L = 1.6, D = 0.45, Ht = 0.54;
  tab(g, 0, Ht - 0.028, 0, L, Ht, D, M.nogal, 'x');
  tab(g, 0.08, 0, 0.0, L - 0.08, 0.08, 0.37, M.grafitoDark);   // zoclo metido
  const z1 = 0.42, y0 = 0.08, y1 = Ht - 0.028;
  tab(g, 0.03, y0, 0, 0.046, y1, z1, M.grafito); tab(g, L - 0.046, y0, 0, L - 0.03, y1, z1, M.grafito);
  tab(g, 0.046, y0, 0.016, L - 0.046, y0 + 0.016, z1, M.grafito);
  tab(g, 0.046, y0, 0, L - 0.046, y1, 0.016, M.grafito);
  const bay = (L - 0.092 - 0.032) / 3;
  const xA = 0.046, xB = xA + bay, xC = xB + 0.016 + bay, xD = xC + 0.016;
  tab(g, xB, y0 + 0.016, 0.016, xB + 0.016, y1, z1, M.grafito); tab(g, xC, y0 + 0.016, 0.016, xC + 0.016, y1, z1, M.grafito);
  tab(g, xA, y0 + 0.2, 0.016, xB, y0 + 0.216, z1 - 0.02, M.grafito);       // entrepaño
  tab(g, xB + 0.016 + 0.002, y0 + 0.018, z1, xC - 0.002, y1 - 0.024, z1 + 0.016, M.grafito); // puerta (gola arriba)
  tabHueco(g, xD, y0 + 0.016, z1, bay, y1 - y0 - 0.016, 0.016, M.grafito, { tipo: 'arco', cx: bay / 2, ww: 0.36, hh: 0.33 });
  cojin(g, xD + bay / 2, y0 + 0.016, 0.22, 0.42, 0.06, 0.36);
  // equipo y libros en la bahía abierta
  libros(g, xA + bay / 2, y0 + 0.216, 0.24, 3, 0.05);
  canasta(g, xA + bay / 2, y0 + 0.016, 0.22, 0.32, 0.15, 0.3);
  return g;
}

function DEN(variante = 'felino', comederoAbierto = true) {
  const g = new THREE.Group(); const L = 1.2, D = 0.45, Ht = 0.65, y0 = 0.01, y1 = Ht - 0.028;
  tab(g, 0, y1, 0, L, Ht, D, M.nogal, 'x');
  tab(g, 0, y0, 0, 0.016, y1, D, M.grafito); tab(g, L - 0.016, y0, 0, L, y1, D, M.grafito);
  tab(g, 0.016, y0, 0.016, L - 0.016, y0 + 0.016, D, M.grafito);
  tab(g, 0.016, y0, 0, L - 0.016, y1, 0.016, M.grafito);
  const a0 = 0.016, a1 = a0 + 0.33, b0 = a1 + 0.016, b1 = b0 + 0.38, c0 = b1 + 0.016, c1 = L - 0.016;
  tab(g, a1, y0 + 0.016, 0.016, b0, y1, D, M.grafito); tab(g, b1, y0 + 0.016, 0.016, c0, y1, D, M.grafito);
  tab(g, a0, 0.39, 0.016, a1, 0.406, D - 0.02, M.grafito);                      // entrepaño
  canasta(g, (a0 + a1) / 2, 0.406, 0.24, 0.28, 0.14, 0.3);
  // cajón comedero
  const dz = comederoAbierto ? 0.26 : 0;
  const cy0 = y0 + 0.02, cy1 = cy0 + 0.15;
  tab(g, a0 + 0.002, cy0, D + dz, a1 - 0.002, cy1, D + dz + 0.016, M.grafito);
  tab(g, a0 + 0.02, cy0 + 0.01, 0.05 + dz, a0 + 0.036, cy0 + 0.11, D + dz, M.grafito);
  tab(g, a1 - 0.036, cy0 + 0.01, 0.05 + dz, a1 - 0.02, cy0 + 0.11, D + dz, M.grafito);
  tab(g, a0 + 0.036, cy0 + 0.1, 0.05 + dz, a1 - 0.036, cy0 + 0.11, D + dz, M.grafitoDark);
  tazon(g, (a0 + a1) / 2, cy0 + 0.11, 0.17 + dz); tazon(g, (a0 + a1) / 2, cy0 + 0.11, 0.36 + dz);
  // 3 cajones con gola
  const fh = (y1 - y0 - 0.016 - 3 * 0.024) / 3;
  for (let i = 0; i < 3; i++) {
    const fy = y0 + 0.016 + i * (fh + 0.024);
    tab(g, b0 + 0.002, fy, D, b1 - 0.002, fy + fh, D + 0.016, M.grafito);
    tab(g, b0, fy + fh, D - 0.02, b1, fy + fh + 0.024, D - 0.004, M.grafitoDark);
  }
  // nido
  tabHueco(g, c0, y0 + 0.016, D, c1 - c0, y1 - y0 - 0.016, 0.016, M.grafito, { tipo: 'arco', cx: (c1 - c0) / 2, ww: 0.3, hh: 0.42 });
  cojin(g, (c0 + c1) / 2, y0 + 0.016, 0.23, 0.38, 0.06, 0.38);
  if (variante === 'felino') {
    tab(g, L, 0.09, 0.06, L + 0.012, 0.55, 0.39, M.grafitoDark);
    tab(g, L + 0.004, 0.11, 0.08, L + 0.016, 0.53, 0.37, M.sisal, 'y');
  }
  return g;
}

function ATELIER() {
  const g = new THREE.Group(); const L = 1.2, D = 0.59;
  tab(g, 0, 0.722, 0, L, 0.75, D, M.nogal, 'x');
  tab(g, 0, 0, 0, 0.028, 0.722, D, M.grafito, 'y'); tab(g, L - 0.028, 0, 0, L, 0.722, D, M.grafito, 'y');
  tab(g, 0.028, 0.42, 0.03, L - 0.028, 0.72, 0.046, M.grafito);
  tab(g, 0.08, 0.6, 0.046, L - 0.08, 0.616, 0.17, M.grafitoDark);          // charola de cables
  tab(g, 0.1, 0.75, 0.03, 0.116, 0.85, 0.25, M.grafito); tab(g, L - 0.116, 0.75, 0.03, L - 0.1, 0.85, 0.25, M.grafito);
  tab(g, 0.1, 0.85, 0.03, L - 0.1, 0.878, 0.25, M.nogal, 'x');               // repisa de monitor
  // laptop abierta
  const lx = 0.62, lz = 0.4;
  addMesh(g, new RoundedBoxGeometry(0.31, 0.012, 0.215, 2, 0.003), M.aluminio, lx, 0.756, lz);
  const scr = addMesh(g, new RoundedBoxGeometry(0.31, 0.205, 0.006, 2, 0.002), M.aluminio, lx, 0.86, lz - 0.115);
  scr.rotation.x = -0.18;
  const pan = addMesh(g, new THREE.PlaneGeometry(0.29, 0.185), M.pantalla, lx, 0.861, lz - 0.111); pan.rotation.x = -0.18;
  florero(g, 0.28, 0.878, 0.14, 0.7);
  libros(g, 0.95, 0.878, 0.14, 2, 0.0);
  return g;
}

function MUSE(reflejo = true) {
  const g = new THREE.Group(); const L = 1.1, D = 0.45;
  tab(g, 0, 0.722, 0, L, 0.75, D, M.nogal, 'x');
  tab(g, 0, 0, 0, 0.028, 0.722, D, M.grafito, 'y'); tab(g, L - 0.028, 0, 0, L, 0.722, D, M.grafito, 'y');
  tab(g, 0.028, 0.57, 0.02, L - 0.028, 0.586, D - 0.02, M.grafito);            // fondo de caja
  tab(g, 0.028, 0.57, 0.02, L - 0.028, 0.722, 0.036, M.grafito);
  for (const [x0, x1] of [[0.03, 0.548], [0.552, L - 0.03]]) {
    tab(g, x0, 0.572, D - 0.016, x1, 0.696, D, M.grafito);
    tab(g, x0, 0.696, D - 0.036, x1, 0.72, D - 0.02, M.grafitoDark);
  }
  // respaldo en arco + espejo
  const s = new THREE.Shape(); const bw = 0.76, bh = 0.96, r = bw / 2;
  s.moveTo(0, 0); s.lineTo(bw, 0); s.lineTo(bw, bh - r); s.absarc(r, bh - r, r, 0, Math.PI, false); s.lineTo(0, 0);
  const bgeo = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 64 });
  worldUV(bgeo, 0.5, 'x'); addMesh(g, bgeo, M.grafito, (L - bw) / 2, 0.75, 0.02);
  // halo LED en la pared
  const hs = new THREE.Shape(); const hw = 0.82, hh2 = 1.02, hr = hw / 2;
  hs.moveTo(0, 0); hs.lineTo(hw, 0); hs.lineTo(hw, hh2 - hr); hs.absarc(hr, hh2 - hr, hr, 0, Math.PI, false); hs.lineTo(0, 0);
  const halo = new THREE.Mesh(new THREE.ShapeGeometry(hs, 64), M.glow); halo.position.set((L - hw) / 2, 0.72, 0.0015); g.add(halo);
  const ms = new THREE.Shape(); const mw = 0.7, mh = 0.9, mr = mw / 2;
  ms.moveTo(0, 0); ms.lineTo(mw, 0); ms.lineTo(mw, mh - mr); ms.absarc(mr, mh - mr, mr, 0, Math.PI, false); ms.lineTo(0, 0);
  const mgeo = new THREE.ShapeGeometry(ms, 64);
  const espejo = new THREE.Mesh(mgeo, new THREE.MeshStandardMaterial({ color: 0xdfe5e8, metalness: 1, roughness: 0.03 }));
  espejo.position.set((L - mw) / 2, 0.78, 0.0375); g.add(espejo); ESPEJOS.push(espejo);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.7), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 }));
  gl.position.set(L / 2, 1.25, 0.001); g.add(gl);
  const luz = new THREE.PointLight(0xffc88a, 1.6, 2.2, 2); luz.position.set(L / 2, 1.3, 0.005); g.add(luz);
  // tocador vestido
  lathe(g, [[0, 0], [0.03, 0], [0.032, 0.09], [0.012, 0.1], [0.012, 0.115], [0, 0.115]], M.ambar, 0.2, 0.75, 0.33);
  lathe(g, [[0, 0.115], [0.014, 0.115], [0.014, 0.14], [0, 0.14]], M.oro, 0.2, 0.75, 0.33);
  lathe(g, [[0, 0], [0.024, 0], [0.024, 0.12], [0, 0.12]], M.vidrio, 0.27, 0.75, 0.3);
  lathe(g, [[0, 0], [0.11, 0], [0.11, 0.012], [0.1, 0.014], [0, 0.014]], M.oro, 0.9, 0.75, 0.3);
  planta(g, 0.98, 0.75, 0.12, 0.45);
  // puf bouclé
  lathe(g, [[0, 0], [0.2, 0], [0.225, 0.03], [0.23, 0.2], [0.225, 0.39], [0.2, 0.42], [0, 0.42]], M.boucle, L / 2, 0, D + 0.32, 64);
  return g;
}

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const gr = x.createRadialGradient(256, 256, 60, 256, 256, 256);
  gr.addColorStop(0, 'rgba(255,200,140,0.9)'); gr.addColorStop(0.45, 'rgba(255,190,120,0.35)'); gr.addColorStop(1, 'rgba(255,180,110,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const ESPEJOS = [];
function reflejarEspejos() {
  for (const e of ESPEJOS) {
    const rt = new THREE.WebGLCubeRenderTarget(512); const cc = new THREE.CubeCamera(0.05, 20, rt);
    const p = new THREE.Vector3(); e.getWorldPosition(p); cc.position.set(p.x + 0.35, p.y + 0.4, p.z + 0.08);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), new THREE.MeshBasicMaterial({ color: 0xfff6e6 }));
    win.position.set(-1.6, 1.5, 2.6); win.rotation.y = Math.PI / 2.6; scene.add(win);
    const marco = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1.8), new THREE.MeshBasicMaterial({ color: 0x3a3632 })); marco.position.set(-1.59, 1.5, 2.6); marco.rotation.y = Math.PI / 2.6; scene.add(marco);
    const fondo = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 12), new THREE.MeshBasicMaterial({ color: 0xcfc4b4, side: THREE.BackSide }));
    fondo.position.set(0, 2.9, 4); scene.add(fondo);
    scene.add(cc); e.visible = false; cc.update(renderer, scene); e.visible = true;
    scene.remove(fondo); scene.remove(win); scene.remove(marco);
    e.material = new THREE.MeshBasicMaterial({ color: 0xf4f7f8, envMap: rt.texture, reflectivity: 1, side: THREE.DoubleSide });
  }
}
function PERCH(g, x, y, z) {
  const pos = [[0, 0], [0.55, 0.32], [0.08, 0.66]];
  for (const [dx, dy] of pos) {
    tab(g, x + dx, y + dy, z, x + dx + 0.45, y + dy + 0.028, z + 0.25, M.nogal, 'x');
    tab(g, x + dx + 0.06, y + dy - 0.12, z, x + dx + 0.0665, y + dy, z + 0.2, M.metal);
    tab(g, x + dx + 0.383, y + dy - 0.12, z, x + dx + 0.3895, y + dy, z + 0.2, M.metal);
    tab(g, x + dx + 0.02, y + dy + 0.028, z + 0.02, x + dx + 0.43, y + dy + 0.034, z + 0.23, M.sisal);
  }
}

function SOFA(g, x, z, w = 2.3) {
  const sg = new THREE.Group();
  addMesh(sg, new RoundedBoxGeometry(w, 0.2, 0.95, 4, 0.03), M.sofa, 0, 0.14, 0);
  for (let i = 0; i < 3; i++) {
    const cw = (w - 0.36) / 3;
    addMesh(sg, new RoundedBoxGeometry(cw - 0.01, 0.16, 0.66, 6, 0.06), M.sofa, -w / 2 + 0.18 + cw * (i + 0.5), 0.32, 0.1);
    const b = addMesh(sg, new RoundedBoxGeometry(cw - 0.01, 0.46, 0.2, 6, 0.08), M.sofa, -w / 2 + 0.18 + cw * (i + 0.5), 0.6, -0.32); b.rotation.x = -0.12;
  }
  addMesh(sg, new RoundedBoxGeometry(0.18, 0.62, 0.95, 6, 0.06), M.sofa, -w / 2 + 0.09, 0.35, 0);
  addMesh(sg, new RoundedBoxGeometry(0.18, 0.62, 0.95, 6, 0.06), M.sofa, w / 2 - 0.09, 0.35, 0);
  addMesh(sg, new RoundedBoxGeometry(0.42, 0.42, 0.12, 6, 0.05), M.boucle, -0.55, 0.6, -0.15).rotation.set(-0.2, 0.25, 0.1);
  sg.position.set(x, 0, z); g.add(sg);
}

// ---------------------------------------------------------------- escena
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;
materiales();

function sol(x, y, z, I = 3.2, tx = 0, ty = 0.4, tz = 0, ext = 3) {
  const d = new THREE.DirectionalLight(SHOT.includes('2') ? 0xffe6c8 : 0xfff0dc, I); d.position.set(x, y, z); d.target.position.set(tx, ty, tz);
  d.castShadow = true; d.shadow.mapSize.set(4096, 4096); d.shadow.radius = 4; d.shadow.bias = -0.0003; d.shadow.normalBias = 0.02;
  Object.assign(d.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: 20 });
  scene.add(d); scene.add(d.target);
}
function cuarto({ pared = M.pared, piso = M.piso, rug = null, lateral = false, arte = null, ancho = 9 } = {}) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho), piso); f.rotation.x = -Math.PI / 2; f.receiveShadow = true;
  piso.map && piso.map.repeat.set(ancho / 2.56, ancho / 2.56); scene.add(f);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(ancho, 3.2), pared); w.position.set(0, 1.6, -0.02); w.receiveShadow = true;
  pared.map && pared.map.repeat.set(ancho / 2.5, 3.2 / 2.5); scene.add(w);
  if (pared === M.pared) { const z = new THREE.Mesh(new THREE.BoxGeometry(ancho, 0.08, 0.012), M.zoclo); z.position.set(0, 0.04, -0.014); z.receiveShadow = true; scene.add(z); }
  if (lateral) { const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), pared); s.rotation.y = Math.PI / 2; s.position.set(lateral, 1.6, 2.98); s.receiveShadow = true; scene.add(s); }
  if (rug) { const r = new THREE.Mesh(new THREE.BoxGeometry(rug[2], 0.008, rug[3]), M.rug); r.position.set(rug[0], 0.004, rug[1]); r.receiveShadow = true; scene.add(r); }
  if (arte) {
    const [x, y, w2, h2] = arte;
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.04, h2 + 0.04, 0.025), M.marco); fr.position.set(x, y, -0.005); fr.castShadow = true; scene.add(fr);
    const a = new THREE.Mesh(new THREE.PlaneGeometry(w2, h2), M.arte); a.position.set(x, y, 0.0085); scene.add(a);
  }
}
function estudio() {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), M.estudio); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), M.estudio); w.position.set(0, 2, -0.9); w.receiveShadow = true; scene.add(w);
  M.estudio.map.repeat.set(4, 4);
}
function place(obj, x, z, ry = 0) { obj.position.set(x, 0, z); obj.rotation.y = ry; scene.add(obj); return obj; }

const camera = new THREE.PerspectiveCamera(32, W / H, 0.05, 40);
function cam(px, py, pz, tx, ty, tz, fov = 32) { camera.fov = fov; camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); camera.updateProjectionMatrix(); }

const SHOTS = {
  // lifestyle
  nest() {
    cuarto({ rug: [0, 0.75, 2.6, 1.8], arte: [0.9, 1.55, 0.6, 0.8] });
    SOFA(scene, 0, 0.55);
    const n = place(NEST('felino'), -0.55, 1.25);
    florero(scene, -0.3, 0.4, 1.42, 1.0); libros(scene, 0.2, 0.4, 1.5, 2, 0.3);
    planta(scene, -1.7, 0, 0.35, 1.6);
    sol(-3.5, 4.2, 4.5, 3.4, 0, 0.3, 1.0, 3.5);
    cam(1.25, 1.05, 3.55, -0.05, 0.3, 1.2, 34);
  },
  haven() {
    cuarto({ rug: [0.8, 1.15, 2.4, 1.6] });
    place(HAVEN(), 0, 0.0);
    const tv = new THREE.Mesh(new RoundedBoxGeometry(1.45, 0.84, 0.03, 2, 0.004), M.pantalla); tv.position.set(0.8, 1.32, 0.0); tv.castShadow = true; scene.add(tv);
    PERCH(scene, 1.62, 0.78, -0.005);
    planta(scene, -0.45, 0, 0.3, 1.7);
    florero(scene, 1.35, 0.54, 0.25, 0.9); libros(scene, 0.25, 0.54, 0.25, 2, -0.1);
    sol(-3, 4.5, 4.5, 3.2, 0.8, 0.5, 0.3, 3.5);
    cam(2.45, 1.2, 2.95, 0.95, 0.82, 0.2, 40);
  },
  atelier() {
    cuarto({ arte: [-0.2, 1.65, 0.55, 0.72], rug: [0.6, 0.9, 2.6, 1.4] });
    place(ATELIER(), -0.95, 0.0);
    place(DEN('felino'), 0.35, 0.0);
    planta(scene, 0.75, 0.65, 0.2, 0.55); libros(scene, 1.15, 0.65, 0.22, 3, 0.1);
    planta(scene, -1.6, 0, 0.35, 1.7);
    sol(-3, 4.2, 4.6, 3.2, 0, 0.5, 0.3, 3.5);
    cam(2.25, 1.25, 3.05, 0.05, 0.5, 0.25, 38);
  },
  muse() {
    cuarto({ rug: [0.55, 0.9, 1.6, 1.2] });
    place(MUSE(true), 0, 0.0);
    planta(scene, -0.55, 0, 0.3, 1.5);
    sol(-3, 4, 4.5, 2.4, 0.5, 0.6, 0.3, 3);
    cam(1.55, 1.2, 2.85, 0.52, 0.95, 0.15, 34);
    renderer.toneMappingExposure = 0.95;
  },
  // estudio (fondo continuo)
  's-nest-c'() { estudio(); place(NEST('canino'), -0.55, 0); sol(-2.5, 4, 4, 2.8, 0, 0.2, 0.3, 2.5); cam(1.2, 0.95, 2.3, 0, 0.18, 0.3, 30); },
  's-nest-f'() { estudio(); place(NEST('felino'), -0.55, 0); sol(-2.5, 4, 4, 2.8, 0, 0.2, 0.3, 2.5); cam(1.45, 0.95, 2.15, 0.05, 0.18, 0.3, 30); },
  's-haven'() { estudio(); place(HAVEN(), -0.8, -0.2); sol(-2.5, 4, 4, 2.8, 0, 0.3, 0.2, 2.5); cam(1.3, 1.0, 2.9, 0, 0.28, 0.0, 32); },
  's-den'() { estudio(); place(DEN('felino'), -0.6, -0.2); sol(-2.5, 4, 4, 2.8, 0, 0.3, 0.2, 2.5); cam(1.55, 1.05, 2.45, 0, 0.32, 0.05, 32); },
  's-atelier'() { estudio(); place(ATELIER(), -0.6, -0.2); sol(-2.5, 4, 4, 2.8, 0, 0.4, 0.2, 2.5); cam(1.4, 1.25, 2.6, 0, 0.45, 0.05, 32); },
  's-muse'() { estudio(); place(MUSE(false), -0.55, -0.85); sol(-2.5, 4, 4, 2.6, 0, 0.6, -0.4, 2.5); cam(1.2, 1.25, 2.4, 0, 0.85, -0.5, 34); },
  'sw-nogal'() { const g = new THREE.Group(); tab(g, -0.3, 0, 0, 0.3, 0.6, 0.028, M.nogal, 'x'); g.position.set(0, 0.5, 0.5); scene.add(g); sol(-1, 3, 5, 2.4, 0, 0.8, 0.5, 2); cam(0, 0.8, 1.6, 0, 0.8, 0.5, 22); },
  'sw-grafito'() { const g = new THREE.Group(); tab(g, -0.3, 0, 0, 0.3, 0.6, 0.028, M.grafito, 'x'); g.position.set(0, 0.5, 0.5); scene.add(g); sol(-1, 3, 5, 2.4, 0, 0.8, 0.5, 2); cam(0, 0.8, 1.6, 0, 0.8, 0.5, 22); },
  's-perch'() { estudio(); PERCH(scene, -0.5, 0.9, -0.9); sol(-2.5, 4, 4, 2.8, 0, 1.2, -0.7, 2.5); cam(0.9, 1.45, 1.5, 0, 1.2, -0.75, 34); },
};

// ===================== COLECCIÓN v2 · esquinas redondeadas, listones de nogal, luz cálida, nichos forrados
function flipWinding(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name], n = a.itemSize;
    for (let i = 0; i < a.count; i += 3) for (let k = 0; k < n; k++) {
      const t = a.array[(i + 1) * n + k]; a.array[(i + 1) * n + k] = a.array[(i + 2) * n + k]; a.array[(i + 2) * n + k] = t;
    }
    a.needsUpdate = true;
  }
  return g;
}
function shapeToY(shape, t, mat, grain = 'x', bevel = 0.0015) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 40 });
  geo.rotateX(Math.PI / 2); geo.translate(0, t, 0);
  if (mat.map) worldUV(geo, mat.userData.S || 1, grain, rnd(), rnd());
  return geo;
}
function rrect(w, d, rf, rb) {
  const s = new THREE.Shape();
  s.moveTo(rb, 0); s.lineTo(w - rb, 0); if (rb) s.absarc(w - rb, rb, rb, -Math.PI / 2, 0, false);
  s.lineTo(w, d - rf); if (rf) s.absarc(w - rf, d - rf, rf, 0, Math.PI / 2, false);
  s.lineTo(rf, d); if (rf) s.absarc(rf, d - rf, rf, Math.PI / 2, Math.PI, false);
  s.lineTo(0, rb); if (rb) s.absarc(rb, rb, rb, Math.PI, Math.PI * 1.5, false);
  return s;
}
function losa(g, x0, y0, z0, w, d, t, rf, rb, mat, grain = 'x') {
  return addMesh(g, shapeToY(rrect(w, d, rf, rb), t, mat, grain), mat, x0, y0, z0);
}
// Costado curvo en planta: pared lateral + esquina redonda al frente (y atrás si rb>0)
function costadoCurvo(g, lado, L, y0, H, D, rf, rb, t, mat) {
  const s = new THREE.Shape(); const ret = 0.02;
  if (rb) { s.moveTo(rb + ret, 0); s.lineTo(rb, 0); s.absarc(rb, rb, rb, -Math.PI / 2, -Math.PI, true); }
  else { s.moveTo(ret, 0); s.lineTo(0, 0); }
  s.lineTo(0, D - rf); s.absarc(rf, D - rf, rf, Math.PI, Math.PI / 2, true);
  s.lineTo(rf + ret, D); s.lineTo(rf + ret, D - t); s.lineTo(rf, D - t);
  s.absarc(rf, D - rf, rf - t, Math.PI / 2, Math.PI, false);
  if (rb) { s.lineTo(t, rb); s.absarc(rb, rb, rb - t, Math.PI, Math.PI * 1.5, false); s.lineTo(rb + ret, t); }
  else { s.lineTo(t, t); s.lineTo(ret, t); }
  s.lineTo(s.currentPoint.x, s.currentPoint.y);
  let geo = shapeToY(s, H, mat, 'y', 0.001);
  if (lado === 'der') { geo.scale(-1, 1, 1); geo = flipWinding(geo); geo.computeVertexNormals(); geo.translate(L, 0, 0); }
  return addMesh(g, geo, mat, 0, y0, 0);
}
function listones(g, x0, x1, y0, y1, z, mat = M.nogal) {
  const w = 0.03, gap = 0.007; const n = Math.floor((x1 - x0 + gap) / (w + gap)); const off = ((x1 - x0) - (n * w + (n - 1) * gap)) / 2;
  tab(g, x0, y0, z - 0.012, x1, y1, z - 0.004, M.grafitoDark);
  for (let i = 0; i < n; i++) { const xa = x0 + off + i * (w + gap); tab(g, xa, y0 + 0.004, z - 0.004, xa + w, y1 - 0.004, z + 0.01, mat, 'y'); }
}
function forro(g, x0, x1, y0, y1, z0, z1) { // nicho forrado de nogal
  tab(g, x0, y0, z0, x1, y0 + 0.006, z1, M.nogal, 'x');
  tab(g, x0, y1 - 0.006, z0, x1, y1, z1, M.nogal, 'x');
  tab(g, x0, y0, z0, x1, y1, z0 + 0.006, M.nogal, 'x');
  tab(g, x0, y0, z0, x0 + 0.006, y1, z1, M.nogal, 'y');
  tab(g, x1 - 0.006, y0, z0, x1, y1, z1, M.nogal, 'y');
}
function ledZoclo(g, x0, x1, y, z) {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.006, 0.01), M.glow); strip.position.set((x0 + x1) / 2, y, z); g.add(strip);
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,190,120,0.85)'); gr.addColorStop(1, 'rgba(255,170,100,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 0.1, 0.32), new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
  p.rotation.x = -Math.PI / 2; p.position.set((x0 + x1) / 2, 0.002, z + 0.16); g.add(p);
  const l = new THREE.PointLight(0xffb878, 0.35, 0.8, 2); l.position.set((x0 + x1) / 2, 0.05, z + 0.05); g.add(l);
}

function NEST2(variante = 'felino') {
  const g = new THREE.Group(); const L = 1.1, D = 0.6, H = 0.4, r = 0.13, t = 0.018, yb = 0.02, yt = 0.372;
  losa(g, 0, yt, 0, L, D, 0.028, r, r, M.nogal);
  tab(g, 0.06, 0, 0.06, L - 0.06, yb, D - 0.06, M.grafitoDark);                       // zoclo metido
  costadoCurvo(g, 'izq', L, yb, yt - yb, D, r, r, t, M.grafito);
  costadoCurvo(g, 'der', L, yb, yt - yb, D, r, r, t, M.grafito);
  tab(g, r, yb, t, L - r, yb + 0.016, D - t, M.grafito);                                // piso
  tab(g, r, yb, 0, L - r, yt, t, M.grafito);                                            // fondo
  const xd = 0.62; tab(g, xd, yb + 0.016, t, xd + 0.016, yt, D - t, M.grafito);         // divisor
  const frente = variante === 'canino' ? { tipo: 'arco', cx: (xd - r) / 2, ww: 0.24, hh: 0.27 } : { tipo: 'circ', cx: (xd - r) / 2, cy: 0.2, r: 0.1 };
  tabHueco(g, r, yb, D - t, xd - r, yt - yb, t, M.grafito, frente);
  forro(g, xd + 0.016, L - r, yb + 0.016, yt, t, D - t);                                // repisa forrada de nogal
  cojin(g, (r + xd) / 2, yb + 0.016, D / 2, 0.42, 0.055, 0.42);
  canasta(g, (xd + L - r) / 2, yb + 0.022, D / 2, 0.24, 0.15, 0.3);
  return g;
}

function HAVEN2() {
  const g = new THREE.Group(); const L = 1.6, D = 0.45, r = 0.11, t = 0.018, yb = 0.09, yt = 0.512;
  losa(g, 0, yt, 0, L, D, 0.028, r, 0.006, M.nogal);
  tab(g, 0.07, 0, 0.0, L - 0.07, yb, D - 0.06, M.grafitoDark);
  ledZoclo(g, 0.1, L - 0.1, yb - 0.006, D - 0.065);
  costadoCurvo(g, 'izq', L, yb, yt - yb, D, r, 0, t, M.grafito);
  costadoCurvo(g, 'der', L, yb, yt - yb, D, r, 0, t, M.grafito);
  tab(g, t, yb, t, L - t, yb + 0.016, D - t, M.grafito);
  tab(g, t, yb, 0, L - t, yt, t, M.grafito);
  const x0 = r, x1 = L - r, bay = (x1 - x0 - 0.032) / 3;
  const xa = x0, xb = xa + bay, xc = xb + 0.016 + bay, xd = xc + 0.016;
  tab(g, xb, yb + 0.016, t, xb + 0.016, yt, D - t, M.grafito); tab(g, xc, yb + 0.016, t, xc + 0.016, yt, D - t, M.grafito);
  forro(g, t, xb, yb + 0.016, yt, t, D - t);                                            // bahía abierta forrada
  tab(g, t, yb + 0.2, t, xb, yb + 0.212, D - 0.03, M.nogal);
  libros(g, (xa + xb) / 2, yb + 0.212, 0.22, 3, 0.05); canasta(g, (xa + xb) / 2, yb + 0.022, 0.22, 0.3, 0.15, 0.28);
  listones(g, xb + 0.016 + 0.002, xc - 0.002, yb + 0.02, yt - 0.006, D);               // puerta de listones de nogal
  forro(g, xd, L - t, yb + 0.016, yt, t, D - t);                                        // nido forrado de nogal
  tabHueco(g, xd, yb + 0.016, D - t, L - r - xd, yt - yb - 0.016, t, M.grafito, { tipo: 'arco', cx: (L - r - xd) / 2, ww: 0.34, hh: 0.34 });
  cojin(g, (xd + L - r) / 2, yb + 0.022, D / 2, 0.38, 0.055, 0.34);
  return g;
}

function DEN2(variante = 'felino', abierto = true) {
  const g = new THREE.Group(); const L = 1.2, D = 0.45, Ht = 0.65, r = 0.09, t = 0.018, yb = 0.07, yt = Ht - 0.028;
  losa(g, 0, yt, 0, L, D, 0.028, r, 0.006, M.nogal);
  tab(g, 0.07, 0, 0, L - 0.07, yb, D - 0.06, M.grafitoDark);
  ledZoclo(g, 0.1, L - 0.1, yb - 0.006, D - 0.065);
  costadoCurvo(g, 'izq', L, yb, yt - yb, D, r, 0, t, M.grafito);
  costadoCurvo(g, 'der', L, yb, yt - yb, D, r, 0, t, M.grafito);
  tab(g, t, yb, t, L - t, yb + 0.016, D - t, M.grafito);
  tab(g, t, yb, 0, L - t, yt, t, M.grafito);
  const a0 = r, a1 = 0.39, b0 = a1 + 0.016, b1 = b0 + 0.36, c0 = b1 + 0.016, c1 = L - r;
  tab(g, a1, yb + 0.016, t, b0, yt, D - t, M.grafito); tab(g, b1, yb + 0.016, t, c0, yt, D - t, M.grafito);
  forro(g, t, a1, yb + 0.016, yt, t, D - t);
  tab(g, t, 0.4, t, a1, 0.412, D - 0.03, M.nogal); canasta(g, (a0 + a1) / 2, 0.412, 0.24, 0.24, 0.13, 0.28);
  const dz = abierto ? 0.25 : 0, cy0 = yb + 0.02;
  tab(g, a0 + 0.004, cy0, D + dz - 0.002, a1 - 0.004, cy0 + 0.14, D + dz + 0.016, M.grafito);
  tab(g, a0 + 0.02, cy0 + 0.01, 0.06 + dz, a0 + 0.034, cy0 + 0.1, D + dz, M.grafito); tab(g, a1 - 0.034, cy0 + 0.01, 0.06 + dz, a1 - 0.02, cy0 + 0.1, D + dz, M.grafito);
  tab(g, a0 + 0.034, cy0 + 0.09, 0.06 + dz, a1 - 0.034, cy0 + 0.1, D + dz, M.nogal);
  tazon(g, (a0 + a1) / 2, cy0 + 0.1, 0.17 + dz); tazon(g, (a0 + a1) / 2, cy0 + 0.1, 0.35 + dz);
  const fh = (yt - yb - 0.016 - 3 * 0.02) / 3;
  for (let i = 0; i < 3; i++) { const fy = yb + 0.016 + i * (fh + 0.02); listones(g, b0 + 0.003, b1 - 0.003, fy, fy + fh, D); tab(g, b0, fy + fh, D - 0.03, b1, fy + fh + 0.02, D - 0.012, M.grafitoDark); }
  forro(g, c0, L - t, yb + 0.016, yt, t, D - t);
  tabHueco(g, c0, yb + 0.016, D - t, c1 - c0, yt - yb - 0.016, t, M.grafito, { tipo: 'arco', cx: (c1 - c0) / 2, ww: 0.28, hh: 0.4 });
  cojin(g, (c0 + c1) / 2, yb + 0.022, D / 2, 0.34, 0.055, 0.36);
  if (variante === 'felino') { tab(g, L, 0.14, 0.03, L + 0.01, 0.58, D - r - 0.02, M.grafitoDark); tab(g, L + 0.004, 0.16, 0.05, L + 0.014, 0.56, D - r - 0.04, M.sisal, 'y'); }
  return g;
}

function trineo(g, x, y0, H, D, rr = 0.05, rad = 0.011) {
  const p = new THREE.CurvePath(); const v = (yy, zz) => new THREE.Vector3(x, yy, zz);
  const z0 = 0.03, z1 = D - 0.03;
  p.add(new THREE.LineCurve3(v(y0, z0 + rr), v(H - rr, z0 + 0.0)));
  const pts = [v(y0, z0), v(H - rr, z0), v(H, z0 + rr), v(H, z1 - rr), v(H - rr, z1), v(y0 + rr, z1), v(y0, z1 - rr), v(y0, z0 + rr), v(y0, z0)];
  const curve = new THREE.CatmullRomCurve3([v(y0 + 0.001, z0 + 0.06), v(H - rr, z0), v(H, z0 + rr * 1.2), v(H, z1 - rr * 1.2), v(H - rr, z1), v(y0 + rr, z1), v(y0, z1 - rr * 1.2), v(y0, z0 + rr * 1.2), v(y0 + 0.001, z0 + 0.06)], true, 'catmullrom', 0.05);
  const geo = new THREE.TubeGeometry(curve, 160, rad, 10, true);
  return addMesh(g, geo, M.metal, 0, 0, 0);
}
function ATELIER2() {
  const g = new THREE.Group(); const L = 1.2, D = 0.6;
  losa(g, 0, 0.722, 0, L, D, 0.028, 0.05, 0.05, M.nogal);
  trineo(g, 0.07, 0.011, 0.711, D); trineo(g, L - 0.07, 0.011, 0.711, D);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, L - 0.14, 12), M.metal); bar.rotation.z = Math.PI / 2; bar.position.set(L / 2, 0.66, 0.06); bar.castShadow = true; g.add(bar);
  tab(g, 0.2, 0.69, 0.04, L - 0.2, 0.722, 0.16, M.grafitoDark);                         // charola de cables
  losa(g, 0.12, 0.85, 0.03, L - 0.24, 0.22, 0.028, 0.03, 0.03, M.nogal);                // repisa monitor
  for (const xx of [0.18, L - 0.18]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 12), M.metal); c.position.set(xx, 0.8, 0.12); c.castShadow = true; g.add(c); }
  const lx = 0.62, lz = 0.42;
  addMesh(g, new RoundedBoxGeometry(0.31, 0.012, 0.215, 2, 0.003), M.aluminio, lx, 0.756, lz);
  const scr = addMesh(g, new RoundedBoxGeometry(0.31, 0.205, 0.006, 2, 0.002), M.aluminio, lx, 0.86, lz - 0.115); scr.rotation.x = -0.18;
  const pan = addMesh(g, new THREE.PlaneGeometry(0.29, 0.185), M.pantalla, lx, 0.861, lz - 0.111); pan.rotation.x = -0.18;
  florero(g, 0.3, 0.878, 0.14, 0.7); libros(g, 0.92, 0.878, 0.14, 2, 0.0);
  return g;
}

function MUSE2() {
  const g = MUSE(false);
  // reemplaza el cuerpo recto: quita patas y caja planas
  g.children.slice().forEach((c) => { if (c.position.y < 0.73 && c.position.y > 0.01 && c.geometry && c.geometry.type === 'RoundedBoxGeometry' && c.material !== M.nogal) g.remove(c); });
  const L = 1.1, D = 0.45, r = 0.07, t = 0.018;
  costadoCurvo(g, 'izq', L, 0.55, 0.172, D, r, 0, t, M.grafito);
  costadoCurvo(g, 'der', L, 0.55, 0.172, D, r, 0, t, M.grafito);
  tab(g, t, 0.55, t, L - t, 0.566, D - t, M.grafito); tab(g, t, 0.55, 0, L - t, 0.722, t, M.grafito);
  listones(g, r + 0.002, L / 2 - 0.003, 0.568, 0.7, D); listones(g, L / 2 + 0.003, L - r - 0.002, 0.568, 0.7, D);
  tab(g, r, 0.7, D - 0.03, L - r, 0.722, D - 0.012, M.grafitoDark);
  for (const [xx, zz] of [[0.09, 0.06], [L - 0.09, 0.06], [0.09, D - 0.08], [L - 0.09, D - 0.08]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.007, 0.55, 14), M.metal); leg.position.set(xx, 0.275, zz); leg.castShadow = true; g.add(leg);
  }
  return g;
}

Object.assign(SHOTS, {
  nest2() {
    cuarto({ rug: [0, 0.75, 2.6, 1.8], arte: [0.9, 1.55, 0.6, 0.8] });
    SOFA(scene, 0, 0.55); place(NEST2('felino'), -0.55, 1.2);
    florero(scene, -0.25, 0.4, 1.4, 1.0); libros(scene, 0.22, 0.4, 1.5, 2, 0.3); planta(scene, -1.7, 0, 0.35, 1.6);
    sol(-3.5, 3.6, 4.5, 2.8, 0, 0.3, 1.0, 3.5); cam(1.25, 1.0, 3.5, -0.05, 0.3, 1.2, 34);
  },
  haven2() {
    cuarto({ rug: [0.8, 1.15, 2.4, 1.6] }); place(HAVEN2(), 0, 0);
    const tv = new THREE.Mesh(new RoundedBoxGeometry(1.45, 0.84, 0.03, 2, 0.004), M.pantalla); tv.position.set(0.8, 1.32, 0.0); tv.castShadow = true; scene.add(tv);
    PERCH(scene, 1.62, 0.78, -0.005); planta(scene, -0.45, 0, 0.3, 1.7); florero(scene, 1.3, 0.54, 0.25, 0.9); libros(scene, 0.3, 0.54, 0.25, 2, -0.1);
    sol(-3, 3.8, 4.5, 2.7, 0.8, 0.5, 0.3, 3.5); cam(2.45, 1.2, 2.95, 0.95, 0.82, 0.2, 40);
  },
  atelier2() {
    cuarto({ arte: [-0.2, 1.65, 0.55, 0.72], rug: [0.6, 0.9, 2.6, 1.4] });
    place(ATELIER2(), -0.95, 0.0); place(DEN2('felino'), 0.35, 0.0);
    planta(scene, 0.75, 0.65, 0.2, 0.55); libros(scene, 1.15, 0.65, 0.22, 3, 0.1); planta(scene, -1.6, 0, 0.35, 1.7);
    sol(-3, 3.8, 4.6, 2.7, 0, 0.5, 0.3, 3.5); cam(2.25, 1.25, 3.05, 0.05, 0.5, 0.25, 38);
  },
  muse2() {
    cuarto({ rug: [0.55, 0.9, 1.6, 1.2] }); place(MUSE2(), 0, 0); planta(scene, -0.55, 0, 0.3, 1.5);
    sol(-3, 4, 4.5, 2.2, 0.5, 0.6, 0.3, 3); cam(1.55, 1.2, 2.85, 0.52, 0.95, 0.15, 34); renderer.toneMappingExposure = 0.95;
  },
  's-nest2'() { estudio(); place(NEST2('felino'), -0.55, 0); sol(-2.5, 4, 4, 2.8, 0, 0.2, 0.3, 2.5); cam(1.45, 0.95, 2.15, 0.05, 0.18, 0.3, 30); },
  's-haven2'() { estudio(); place(HAVEN2(), -0.8, -0.2); sol(-2.5, 4, 4, 2.6, 0, 0.3, 0.2, 2.5); cam(1.3, 1.0, 2.9, 0, 0.28, 0.0, 32); },
  's-den2'() { estudio(); place(DEN2('felino'), -0.6, -0.2); sol(-2.5, 4, 4, 2.6, 0, 0.3, 0.2, 2.5); cam(1.55, 1.05, 2.45, 0, 0.32, 0.05, 32); },
  's-atelier2'() { estudio(); place(ATELIER2(), -0.6, -0.2); sol(-2.5, 4, 4, 2.8, 0, 0.4, 0.2, 2.5); cam(1.4, 1.25, 2.6, 0, 0.45, 0.05, 32); },
  's-muse2'() { estudio(); place(MUSE2(), -0.55, -0.85); sol(-2.5, 4, 4, 2.6, 0, 0.6, -0.4, 2.5); cam(1.2, 1.25, 2.4, 0, 0.85, -0.5, 34); },
});

(SHOTS[SHOT] || SHOTS.nest)();
scene.add(new THREE.HemisphereLight(0xf4eee6, 0x8f8070, 0.32));
reflejarEspejos();

function frame() {
  if (USE_AO) {
    const comp = new EffectComposer(renderer);
    comp.setSize(W, H);
    comp.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, W, H);
    ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.6, thickness: 2.0, scale: 1.6, samples: 16 });
    ao.blendIntensity = 1.0;
    comp.addPass(ao);
    comp.addPass(new OutputPass());
    comp.render();
  } else {
    renderer.render(scene, camera);
  }
}
try { frame(); window.__done = 'ok'; } catch (e) { window.__done = 'err:' + e.message; console.error(e); }
