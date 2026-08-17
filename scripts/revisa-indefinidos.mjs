#!/usr/bin/env node
// ============================================================================
//  GUARDIÁN CONTRA PANTALLAS EN BLANCO
//
//  El 2026-08-15 tres pantallas completas (las 23 de Cotizar de línea, Costear
//  especial y Catálogo) estuvieron MUERTAS porque App.jsx pasaba como prop
//  cinco funciones que nunca se escribieron. Nada lo detectó: `vite build`
//  compila igual, las 23 pruebas del motor pasan igual y el bundle parsea
//  igual. Un nombre inexistente dentro de JSX sólo truena cuando alguien
//  entra a esa pestaña — y entonces se cae la app entera.
//
//  Esto lo caza antes de publicar. Es deliberadamente tonto y conservador:
//  sólo mira identificadores usados como `prop={nombre}` o `{nombre}` dentro
//  del JSX y verifica que ese nombre exista en el archivo (declarado,
//  importado o recibido como prop). Si duda, se calla: vale más no dar
//  falsas alarmas que cazar el 100%.
//
//      node scripts/revisa-indefinidos.mjs        → 0 si todo bien, 1 si hay hallazgos
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src');

const GLOBALES = new Set([
  'window', 'document', 'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'Date', 'Promise', 'Set', 'Map', 'RegExp', 'Error', 'Intl', 'navigator',
  'localStorage', 'sessionStorage', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'requestAnimationFrame', 'FileReader', 'Image', 'Blob', 'URL', 'crypto',
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'this', 'React',
]);

function archivos(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...archivos(p));
    // Las PRUEBAS no son pantallas, y algunas citan código como TEXTO a
    // propósito, para vigilar que no se vuelva a escribir de cierta forma
    // (leeNumero.test.js contiene la cadena "<CampoM2 valor={m2} onCambio={setM2} />").
    // Sin excluirlas, esas citas se leen como props inexistentes y este
    // guardián —que BLOQUEA el deploy— truena con hallazgos falsos.
    else if (/\.jsx?$/.test(e.name) && !/\.test\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// Todo lo que en este archivo ES un nombre válido.
function declarados(s) {
  const d = new Set();
  // Se queda con el IDENTIFICADOR limpio: quita valores por defecto, spread,
  // paréntesis sueltos que arrastran los regex y anotaciones tipo `a: b`.
  const add = (x) => {
    const crudo = String(x).split('=')[0];
    const m = /([A-Za-z_$][\w$]*)\s*$/.exec(crudo.trim());
    if (m) d.add(m[1]);
  };
  for (const m of s.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of s.matchAll(/class\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  // `const A = 1, B = 2` declara las DOS: hay que leer todos los declaradores.
  for (const m of s.matchAll(/(?:const|let|var)\s+([^;\n]+)/g)) {
    for (const trozo of m[1].split(',')) add(trozo);
  }
  // destructuring: const {a, b: c} = ... y const [a, b] = ...
  for (const m of s.matchAll(/(?:const|let|var)\s*\{([^}]*)\}/g)) for (const x of m[1].split(',')) add(x.split(':').pop());
  for (const m of s.matchAll(/(?:const|let|var)\s*\[([^\]]*)\]/g)) for (const x of m[1].split(',')) add(x);
  // props del componente: function X({ a, b = 1, ...resto })
  for (const m of s.matchAll(/(?:function\s+[\w$]*\s*|\(\s*)\{([^}]*)\}\s*(?:\)|,)/g)) for (const x of m[1].split(',')) add(x.split(':').pop());
  // parámetros simples de funciones y flechas
  for (const m of s.matchAll(/(?:function\s*[\w$]*\s*\(([^)]*)\)|\(([^)]*)\)\s*=>|([A-Za-z_$][\w$]*)\s*=>)/g)) {
    for (const g of [m[1], m[2], m[3]]) if (g) for (const x of g.split(',')) add(x.split(':').pop());
  }
  // Callbacks: .map((u, i) => …), .filter(x => …). El regex de arriba a veces
  // se come el paréntesis del método, así que esto lo cubre aparte.
  for (const m of s.matchAll(/\.\w+\(\s*\(?([^)(]*?)\)?\s*=>/g)) {
    for (const x of m[1].split(',')) add(x);
  }
  for (const m of s.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of s.matchAll(/for\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of s.matchAll(/import\s+([\s\S]+?)\s+from/g)) for (const x of m[1].matchAll(/[A-Za-z_$][\w$]*/g)) add(x[0]);
  return d;
}

let hallazgos = 0;
for (const f of archivos(RAIZ)) {
  const s = fs.readFileSync(f, 'utf8');
  const d = declarados(s);
  const usados = new Map();   // nombre -> línea
  const lineaDe = (i) => s.slice(0, i).split('\n').length;
  for (const m of s.matchAll(/[\w-]+=\{([A-Za-z_$][\w$]*)\}/g)) if (!usados.has(m[1])) usados.set(m[1], lineaDe(m.index));
  for (const nombre of usados.keys()) {
    if (d.has(nombre) || GLOBALES.has(nombre)) continue;
    hallazgos++;
    console.log(`✗ ${path.relative(process.cwd(), f)}:${usados.get(nombre)}  →  "${nombre}" no existe en este archivo`);
  }
}

if (hallazgos === 0) console.log('✓ ningún prop apunta a algo inexistente');
else console.log(`\n${hallazgos} hallazgo(s). Cada uno es una pantalla que se pondrá EN BLANCO al abrirla.`);
process.exit(hallazgos === 0 ? 0 : 1);
