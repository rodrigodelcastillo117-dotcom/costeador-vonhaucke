import { familiaDeMaterial } from './materialMatch.js';

// Coincidencias VISIBLES y elegibles, nunca selección económica automática.
// Si no existe el mismo acabado, mostramos variantes de la familia con advertencia.
export function opcionesMaterialPlano(solicitado, insumos = {}, limite = 6) {
  const familia = familiaDeMaterial(solicitado);
  if (!familia) return [];
  const texto = String(solicitado || '').toLowerCase();
  const nogal = /nogal|walnut/.test(texto);
  const blanco = /blanc/.test(texto);
  const negro = /negr/.test(texto);
  const e18 = /\b18\s*mm\b/i.test(texto);
  const all = Object.entries(insumos || {}).map(([key, x]) => ({
    id: String(x?.id || key), nombre: String(x?.nombre || '')
  })).filter(x => x.id && x.nombre && familiaDeMaterial(x.nombre) === familia);
  const scored = all.map(x => {
    const nombre = x.nombre.toLowerCase();
    const colorIgual = (nogal && /nogal|walnut/.test(nombre))
      || (blanco && /blanc/.test(nombre))
      || (negro && /negr/.test(nombre));
    return { ...x, colorIgual: !!colorIgual,
      score: (colorIgual ? 100 : 0) + (e18 && /\b19\s*mm\b/.test(nombre) ? 20 : 0) };
  });
  scored.sort((a, b) => b.score - a.score || a.nombre.localeCompare(b.nombre, 'es'));
  const delColor = scored.filter(x => x.colorIgual);
  // No ocultar todas las opciones si el catálogo no registra el acabado textual.
  return (delColor.length ? delColor : scored).slice(0, limite);
}
