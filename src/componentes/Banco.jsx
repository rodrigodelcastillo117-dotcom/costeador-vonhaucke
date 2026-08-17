// ============================================================================
//  BANCO DE PRECIOS — buscar un producto real y meterlo a la cotización con su
//  precio ya cotizado. Pensado para armar proyectos grandes rápido.
// ============================================================================
import { useState, useMemo } from 'react';
import { BANCO_CATEGORIAS, BANCO_FUENTES, BANCO_LINEAS, bancoUnico } from '../datos/banco.js';
import { CATALOGO_INDEX, CATALOGO_LINEAS } from '../datos/catalogoIndex.js';
import { pesos, coincide} from '../util.js';

export default function Banco({ onAgregar, onIr }) {
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState('todas');
  const [linea, setLinea] = useState('todas');
  const [cant, setCant] = useState({});
  const [agregado, setAgregado] = useState('');

  const q = busca.trim().toLowerCase();
  const lista = useMemo(() => {
    return bancoUnico().filter((p) => {
      if (cat !== 'todas' && p.categoria !== cat) return false;
      if (linea !== 'todas' && p.linea !== linea) return false;
      if (!q) return true;
      // Se busca por TODO lo que un vendedor recuerda: línea, clave de sistema,
      // medidas, y también la redacción literal del presupuesto.
      return coincide(q, p.nombre, p.descripcion, p.clave, p.medidas, p.material, p.linea, p.categoria);
    });
  }, [q, cat, linea]);

  const porCat = {};
  for (const p of lista) (porCat[p.categoria] ||= []).push(p);

  // El BANCO son precios ya cotizados: sólo trae lo que esos proyectos
  // compraron. El CATÁLOGO son los 114 productos de las 23 líneas, sacados de
  // las guías oficiales, con sus medidas y claves reales. Un vendedor busca en
  // los dos a la vez, así que la misma búsqueda barre ambos.
  const catalogo = useMemo(() => CATALOGO_INDEX.filter((p) => {
    if (linea !== 'todas' && p.linea !== linea) return false;
    if (!q) return true;
    return coincide(q, p.linea, p.nombre, p.medidas, p.opciones, p.claves);
  }), [q, linea]);
  const catPorLinea = {};
  for (const p of catalogo) (catPorLinea[p.linea] ||= []).push(p);

  const agregar = (p) => {
    const n = Math.max(1, parseInt(cant[p.id]) || 1);
    onAgregar(p, n);
    setAgregado(`${n} × ${p.nombre} agregado a la cotización`);
    setTimeout(() => setAgregado(''), 2500);
  };

  return (
    <div className="contenido">
      <div className="tarjeta">
        <h2>Banco de precios</h2>
        <p className="ayuda columna-texto">Productos tal como se han cotizado en proyectos reales, con su precio ya cerrado. Búscalo, ajusta la cantidad y agrégalo a tu cotización.</p>
        <div className="alerta ambar" style={{ marginTop: 10, marginBottom: 12 }}>
          <span className="texto">Estos precios <strong>ya traen el descuento del proyecto de donde salieron</strong>. Si a tu propuesta le vas a aplicar otro descuento, revísalos: se descontarían dos veces.</span>
        </div>
        <input type="text" placeholder="Busca como se te ocurra: bench 6 lugares, archivero 2 cajones, 1200 x 600, App LT…"
          value={busca} onChange={(e) => setBusca(e.target.value)} style={{ fontSize: 18 }} />
        <label className="etiqueta" style={{ marginTop: 14 }}>Línea</label>
        <div className="chips">
          <button className={`chip ${linea === 'todas' ? 'on' : ''}`} onClick={() => setLinea('todas')}>Todas</button>
          {[...new Set([...BANCO_LINEAS, ...CATALOGO_LINEAS])].sort().map((l) => (
            <button key={l} className={`chip ${linea === l ? 'on' : ''}`} onClick={() => setLinea(l)}>{l}</button>
          ))}
        </div>
        <label className="etiqueta" style={{ marginTop: 14 }}>Tipo de mueble</label>
        <div className="chips">
          <button className={`chip ${cat === 'todas' ? 'on' : ''}`} onClick={() => setCat('todas')}>Todo</button>
          {BANCO_CATEGORIAS.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="ayuda" style={{ marginTop: 10 }}>
          <strong>{lista.length}</strong> con precio ya cotizado · <strong>{catalogo.length}</strong> en el catálogo de las 23 líneas
        </div>
      </div>

      {agregado && <div className="alerta verde" style={{ marginBottom: 12 }}><span className="texto">{agregado}</span></div>}

      {lista.length === 0 && catalogo.length > 0 && (
        <div className="alerta ambar"><span className="texto">
          Ningún proyecto cerrado tiene ese producto, pero <strong>sí está en el catálogo</strong>. Búscalo abajo y cotízalo desde su línea.
        </span></div>
      )}

      {BANCO_CATEGORIAS.filter((c) => porCat[c]?.length).map((c) => (
        <div className="tarjeta" key={c}>
          <h3>{c}</h3>
          {porCat[c].map((p) => (
            <div className="banco-item" key={p.id}>
              <div className="banco-info">
                <div className="banco-nombre">
                  {p.nombre}{p.usuarios ? <span className="gris"> · {p.usuarios} usuario{p.usuarios > 1 ? 's' : ''}</span> : ''}
                  <span className="sello sello-firme" title="Precio real de un proyecto ya cotizado.">Firme</span>
                </div>
                <div className="ayuda">{[p.medidas, p.material].filter(Boolean).join(' · ')}</div>
                {p.clave && <div className="ayuda mono" style={{ fontSize: 12 }}>Clave {p.clave}</div>}
                <div className="ayuda gris" style={{ fontSize: 11 }}>
                  {BANCO_FUENTES[p.fuente] || p.fuente}
                  {!p.linea && p.categoria !== 'Sillería' && <> · <span title="El presupuesto de origen no dice de qué línea es.">línea no especificada</span></>}
                </div>
              </div>
              <div className="banco-precio">{pesos(p.precio)}</div>
              <div className="banco-add">
                <input type="number" min="1" className="numero" style={{ width: 64 }} value={cant[p.id] || 1}
                  onChange={(e) => setCant({ ...cant, [p.id]: e.target.value })} />
                <button className="boton primario" onClick={() => agregar(p)}>Agregar</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* ---- CATÁLOGO COMPLETO: los 114 productos de las 23 líneas ---- */}
      {Object.keys(catPorLinea).length > 0 && (
        <div className="tarjeta">
          <h3>Catálogo completo · las 23 líneas</h3>
          <p className="ayuda columna-texto">
            Todo lo que Von Haucke fabrica, sacado de las guías oficiales con sus medidas y claves reales.
            Aquí el precio lo calcula el modelo y es un <strong>rango</strong> según cómo lo configures:
            entra a la línea y ármalo a la medida para tener el precio exacto.
          </p>
        </div>
      )}
      {Object.entries(catPorLinea).map(([l, prods]) => (
        <div className="tarjeta" key={'cat-' + l}>
          <h3>{l} <span className="gris" style={{ fontWeight: 400, fontSize: 14 }}>· {prods.length} producto{prods.length > 1 ? 's' : ''}</span></h3>
          {prods.map((p) => (
            <div className="banco-item" key={p.ruta + '-' + p.producto}>
              <div className="banco-info">
                <div className="banco-nombre">
                  {p.nombre}
                  <span className={`sello sello-${p.real ? 'firme' : 'estimado'}`}
                    title={p.real ? 'Alguna de sus configuraciones tiene precio real cargado.' : 'Precio calculado por el modelo, no tomado de un presupuesto.'}>
                    {p.real ? 'Firme' : 'Estimado'}
                  </span>
                </div>
                {p.medidas && <div className="ayuda">{p.medidas}</div>}
                {p.opciones && <div className="ayuda gris" style={{ fontSize: 12 }}>{p.opciones}</div>}
                {p.claves && <div className="ayuda mono" style={{ fontSize: 12 }}>Claves {p.claves}</div>}
              </div>
              <div className="banco-precio">
                {p.min === p.max ? pesos(p.min) : <span style={{ fontSize: 15 }}>{pesos(p.min)} – {pesos(p.max)}</span>}
              </div>
              <div className="banco-add">
                <button className="boton" onClick={() => onIr?.(p.ruta)}>Configurar →</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {lista.length === 0 && catalogo.length === 0 && (
        <div className="tarjeta">
          <p className="ayuda">
            {q
              ? <>No hay productos que coincidan con "{busca}"{cat !== 'todas' ? <> en <strong>{cat}</strong></> : null}.</>
              : <>Todavía no hay productos en <strong>{cat}</strong>.</>}
          </p>
          {(q || cat !== 'todas') && (
            <button className="boton" style={{ minHeight: 44, marginTop: 8 }} onClick={() => { setBusca(''); setCat('todas'); }}>Ver todo el banco</button>
          )}
        </div>
      )}

      <div className="fila-botones" style={{ marginTop: 12 }}>
        <button className="boton grande" onClick={() => onIr('cotizacion')}>Ver mi cotización ›</button>
      </div>
    </div>
  );
}
