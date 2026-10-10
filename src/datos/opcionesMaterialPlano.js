import { familiaDeMaterial } from './materialMatch.js';

// Sugerencias visuales, NO asignación económica automática. Mantiene el gate
// de material hasta que una persona autorizada confirme el artículo real.
export function opcionesMaterialPlano(solicitado, insumos = {}, limite = 4) {
  const fam = familiaDeMaterial(solicitado);
  if (!fam) return [];
  const t = String(solicitado || '').toLowerCase();
  const color = /nogal|walnut/.test(t) ? 'nogal' : /blanc/.test(t) ? 'blanco' : /negr/.test(t) ? 'negro' : '';
  const pedido18 = /\b18\s*mm\b/i.test(t);
  const items = Object.values(insumos).filter(x => x?.id && familiaDeMaterial(x.nombre || '') === fam)
    .map(x => {
      const n = String(x.nombre || '').toLowerCase();
      const score = (color === 'nogal' ? (/nogal|walnut/.test(n) ? 100 : 0)
        : color ? (n.includes(color) ? 100 : 0) : 0)
        + (pedido18 && /\b19\s*mm\b/.test(n) ? 40 : 0)
        + (n.includes('nogal neo') ? 5 : 0);
      return { id: x.id, nombre: x.nombre, score };
    })
    .filter(x => !color || x.score >= 100)
    .sort((a,b) => b.score-a.score || a.nombre.localeCompare(b.nombre, 'es'));
  return items.slice(0, limite);
}
