// Presenta el informe de la IA (Markdown de 7-8 secciones "## Titulo") como un
// TABLERO de tarjetas: 2 por renglon, elegante. La seccion con tabla (BOM) ocupa
// el ancho completo para que se lea bien.
import Markdown from './Markdown.jsx';

function partirSecciones(md) {
  const lineas = String(md || '').replace(/\r/g, '').split('\n');
  const secs = [];
  let cur = null;
  for (const ln of lineas) {
    const m = ln.match(/^#{1,3}\s+(.*)/);
    if (m) { cur = { titulo: m[1].trim(), cuerpo: [] }; secs.push(cur); }
    else if (cur) cur.cuerpo.push(ln);
  }
  return secs
    .map((s) => ({ titulo: s.titulo, cuerpo: s.cuerpo.join('\n').trim() }))
    .filter((s) => s.titulo || s.cuerpo);
}

// Quita emojis y adornos del titulo (look de desarrollador, no de IA).
function limpiarTitulo(t) {
  return String(t)
    .replace(/[\p{Extended_Pictographic}☀-➿️]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function InformeIA({ informe }) {
  const secciones = partirSecciones(informe);
  if (secciones.length === 0) return null;
  return (
    <div className="informe-grid">
      {secciones.map((s, i) => {
        const texto = limpiarTitulo(s.titulo);
        const tieneTabla = /(^|\n)\s*\|.*\|/.test(s.cuerpo);
        const full = tieneTabla || i === 0; // resumen y tablas a todo lo ancho
        return (
          <section className={'informe-card' + (full ? ' full' : '')} key={i}>
            <header className="informe-card-h">
              <span className="informe-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="informe-card-t">{texto}</span>
            </header>
            <div className="informe-card-b"><Markdown texto={s.cuerpo} /></div>
          </section>
        );
      })}
    </div>
  );
}
