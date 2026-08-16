// Renderizador Markdown minimo, sin dependencias. Soporta: encabezados (##,###),
// negritas **x**, listas (- / *), tablas (| a | b |), separadores (---) y parrafos.
// Suficiente para el informe de la IA. No ejecuta HTML (seguro).

function inline(text, keyBase) {
  // negritas **x**
  const partes = String(text).split(/(\*\*[^*]+\*\*)/g);
  return partes.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={keyBase + '-' + i}>{p.slice(2, -2)}</strong>;
    return <span key={keyBase + '-' + i}>{p}</span>;
  });
}

export default function Markdown({ texto }) {
  if (!texto) return null;
  const lineas = String(texto).replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  let lista = null;      // acumulador de <li>
  let key = 0;

  const cerrarLista = () => {
    if (lista) { out.push(<ul className="md-ul" key={'ul' + key++}>{lista}</ul>); lista = null; }
  };

  while (i < lineas.length) {
    const ln = lineas[i];
    const t = ln.trim();

    // Tabla markdown: linea con | ... | seguida (o no) de separador
    if (t.startsWith('|') && t.endsWith('|') && t.includes('|', 1)) {
      cerrarLista();
      const filas = [];
      while (i < lineas.length && lineas[i].trim().startsWith('|')) { filas.push(lineas[i].trim()); i++; }
      const celdas = (row) => row.slice(1, -1).split('|').map((c) => c.trim());
      const esSep = (row) => /^\|?[\s:|-]+\|?$/.test(row) && row.includes('-');
      const head = celdas(filas[0]);
      const bodyRows = filas.slice(esSep(filas[1] || '') ? 2 : 1).filter((r) => !esSep(r));
      out.push(
        <div className="md-tablewrap" key={'tb' + key++}>
          <table className="md-table">
            <thead><tr>{head.map((c, j) => <th key={j}>{inline(c, 'h' + j)}</th>)}</tr></thead>
            <tbody>{bodyRows.map((r, ri) => { const cs = celdas(r); return <tr key={ri}>{cs.map((c, ci) => <td key={ci}>{inline(c, 'c' + ri + ci)}</td>)}</tr>; })}</tbody>
          </table>
        </div>
      );
      continue;
    }

    if (!t) { cerrarLista(); i++; continue; }

    if (/^###\s+/.test(t)) { cerrarLista(); out.push(<h4 className="md-h4" key={key++}>{inline(t.replace(/^###\s+/, ''), 'h4')}</h4>); i++; continue; }
    if (/^##\s+/.test(t)) { cerrarLista(); out.push(<h3 className="md-h3" key={key++}>{inline(t.replace(/^##\s+/, ''), 'h3')}</h3>); i++; continue; }
    if (/^#\s+/.test(t)) { cerrarLista(); out.push(<h3 className="md-h3" key={key++}>{inline(t.replace(/^#\s+/, ''), 'h1')}</h3>); i++; continue; }
    if (/^---+$/.test(t) || /^___+$/.test(t)) { cerrarLista(); out.push(<hr className="md-hr" key={key++} />); i++; continue; }
    if (/^[-*]\s+/.test(t)) { if (!lista) lista = []; lista.push(<li key={'li' + key++}>{inline(t.replace(/^[-*]\s+/, ''), 'li')}</li>); i++; continue; }
    if (/^\d+\.\s+/.test(t)) { if (!lista) lista = []; lista.push(<li key={'li' + key++}>{inline(t.replace(/^\d+\.\s+/, ''), 'li')}</li>); i++; continue; }

    cerrarLista();
    out.push(<p className="md-p" key={key++}>{inline(t, 'p')}</p>);
    i++;
  }
  cerrarLista();
  return <div className="md">{out}</div>;
}
