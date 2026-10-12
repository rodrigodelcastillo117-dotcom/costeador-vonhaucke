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

// Números del MOTOR (resumenMotor) para la sección de merma/nesting: lo que vale para cotizar
// es esto; el texto de la IA en esa sección es narrativo y se etiqueta como tal.
function BloqueMotor({ motor }) {
  if (!motor || !Array.isArray(motor.renglones) || motor.renglones.length === 0) return null;
  return (
    <div className="informe-motor" data-testid="informe-motor">
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Según el motor (válido para cotizar)</div>
      <div className="ayuda" style={{ marginBottom: 6 }}>
        Tablero: {motor.m2Tablero} m² netos → <b>{motor.hojasTablero} hojas</b>{motor.mermaPct != null ? ` (merma real ${motor.mermaPct} %)` : ''}.
        {motor.sinCosto && motor.sinCosto.length ? ` Sin costo todavía: ${motor.sinCosto.slice(0, 6).join(', ')}.` : ''}
        {motor.porConfirmar && motor.porConfirmar.length ? ` Provisional (por confirmar): ${motor.porConfirmar.length} material(es).` : ''}
      </div>
      <table className="tabla-motor"><tbody>
        {motor.renglones.map((r) => (
          <tr key={r.insumoId}><td>{r.nombre}</td><td style={{ textAlign: 'right' }}>{r.neto} {r.unidad === 'hoja' ? 'm²' : r.unidad}</td><td style={{ textAlign: 'right' }}>→ {r.compra}</td><td className="ayuda">{r.metodo}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}

export default function InformeIA({ informe, motor = null }) {
  const secciones = partirSecciones(informe);
  if (secciones.length === 0) return null;
  const idxMerma = secciones.findIndex((s) => /merma|nesting/i.test(s.titulo));
  return (
    <div className="informe-grid">
      {secciones.map((s, i) => {
        const texto = limpiarTitulo(s.titulo);
        const tieneTabla = /(^|\n)\s*\|.*\|/.test(s.cuerpo);
        const esMerma = i === idxMerma && !!motor;
        const full = tieneTabla || i === 0 || esMerma; // resumen, tablas y motor a todo lo ancho
        return (
          <section className={'informe-card' + (full ? ' full' : '')} key={i}>
            <header className="informe-card-h">
              <span className="informe-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="informe-card-t">{texto}</span>
            </header>
            <div className="informe-card-b">
              {esMerma && <BloqueMotor motor={motor} />}
              {esMerma && <div className="ayuda gris" style={{ margin: '6px 0 2px' }}>Comentario narrativo de la IA (sus cifras no sustituyen a las del motor):</div>}
              <Markdown texto={s.cuerpo} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
