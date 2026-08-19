// ============================================================================
//  GENERADOR APP  ·  guía oficial GE App (línea App, hermana de App LT).
//  App = misma construcción que App LT (cubiertas, patas, omegas, rieles,
//  biombos) pero con ACABADOS premium: melamina ABS, chapa de madera (CH),
//  chapa+cromo (CHCR). Por eso es un poco más cara.
//  Reusa el motor calibrado de App LT y solo cambia acabado + clave (AT→CI).
// ============================================================================
import { generarAppLT, APPLT_PRODUCTOS } from './applt.js';

// App reusa el despiece de App LT, así que salía cotizando EXACTAMENTE igual
// aunque es una línea más cara (acabados premium). Rodrigo (2026-08-15): App va
// 10% arriba de App LT en todo. Es calibración, no dato: se borra en cuanto
// haya precios reales de App en el price-book (hoy no hay ninguno).
// El 10% de App sobre App LT vive ahora en `factoresLinea.js`, junto con el
// resto de la escalera de líneas, para que todo se lea en un solo lugar.

const ACABADOS = [
  { id: 'ABS', label: 'Melamina ABS' },
  { id: 'chapa', label: 'Chapa de madera' },
];

// Productos App = productos App LT + selector de acabado en los que llevan cubierta.
export const APP_PRODUCTOS = APPLT_PRODUCTOS.map((p) => ({ ...p, finishes: ACABADOS }));

// Remapea una clave de App LT a App: prefijo AT→CI y sufijo de acabado.
function remapClave(k, finish) {
  let x = k.replace(/^AT/, 'CI');
  if (finish === 'chapa') x = x.replace('ABSOPG', 'CHOPG').replace(/ABS$/, 'CH');
  return x;
}

export function generarApp(config) {
  const finish = config.finish || 'ABS';
  const g = generarAppLT(config);

  g.nombre = g.nombre.replace('APP LT', 'App');
  g.componentes = g.componentes.map((c) => {
    const comp = { ...c };
    // Acabado chapa: la cubierta cambia de melamina 28mm a chapa de madera.
    // `startsWith`, no `===`: generarAppLT ya reescribió el id al color elegido
    // (ej. 'melamina-28-ivory') antes de que este código lo vea — comparar
    // exacto contra 'melamina-28' nunca matcheaba desde que existe el color.
    if (finish === 'chapa' && comp.insumoId?.startsWith('melamina-28')) comp.insumoId = 'chapa-madera';
    comp.nombre = comp.nombre.replace(/\(AT/g, '(CI');
    if (finish === 'chapa') comp.nombre = comp.nombre.replace('ABSOPG', 'CHOPG');
    return comp;
  });
  g.claves = (g.claves || []).map((k) => remapClave(k, finish));
  g.nota = `App (acabado ${finish === 'chapa' ? 'chapa de madera' : 'melamina ABS'}, clave CI). Precio 10% arriba de App LT por acabados premium. ${g.nota}`;
  return g;
}
