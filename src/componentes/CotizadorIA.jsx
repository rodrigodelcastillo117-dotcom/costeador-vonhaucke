// ============================================================================
//  COTIZADOR CONVERSACIONAL  ·  "de un párrafo a cotización completa"
//  El vendedor escribe/pega lo que pide el cliente; Claude lo mapea a renglones
//  reales de las 24 líneas (edge fn cotizar-texto) y el MOTOR cuesta cada uno.
//
//  DECISIÓN DE DISEÑO (2026-08-15): lo que Voni entiende cae DIRECTO en la
//  lista de muebles del proyecto. Antes había una lista intermedia de
//  "renglones propuestos" que había que pasar a la lista real con un botón:
//  los mismos muebles en dos lados, cuatro botones, y nadie entendía qué
//  pasaba al agregar. Ahora se revisa UNA sola vez, en la lista de siempre,
//  donde ya se puede cambiar la cantidad y quitar lo que no va.
// ============================================================================
import { useMemo, useRef, useState } from 'react';
import { catalogoIA, costearItem } from '../datos/lineas.js';
import { BANCO } from '../datos/banco.js';
import { cotizarTexto } from '../nube.js';
import ProgramaProyecto from './ProgramaProyecto.jsx';
import { anotar } from '../datos/aprendizaje.js';

// Un pedido puede traer párrafos; la lección se guarda con una pista corta para
// que se entienda al leerla en pantalla sin volver a abrir el proyecto.
const resumenCorto = (t) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length > 90 ? s.slice(0, 90) + '…' : s;
};
import Cargando from './Cargando.jsx';

// Un botón que dice "Ejemplo 1" no le dice nada a nadie: se nombran por el
// tipo de proyecto, para que el vendedor reconozca el suyo.
const EJEMPLOS = [
  { n: 'Oficina operativa', t: '15 estaciones bench Cirque de 1.20 m para 6 puestos en melamina, una sala de juntas para 10 personas y 15 archiveros Modulor.' },
  { n: 'Área ejecutiva', t: '6 escritorios ejecutivos Eclipse en chapa, 2 credenzas y una mesa de consejo para 12.' },
  { n: 'Bench + guardas', t: '20 escritorios operativos App LT de 1.50 con faldón, 20 gavetas rodantes y 8 sillones Pac.' },
];

export default function CotizadorIA({ estado, onAgregarItems, onIr, verCotizacion = false, conPrograma = false }) {
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);
  const [respuesta, setRespuesta] = useState('');
  const catalogo = useMemo(() => catalogoIA(), []);
  // Id del último lote que puso la IA en el proyecto. Al volver a interpretar
  // se reemplaza ese lote en vez de agregar encima (si no, se duplica todo).
  const lote = useRef(null);

  // El modelo ya empieza su resumen con "Entendí"; la pantalla no lo repite.
  const limpiarResumen = (r) => String(r || '').replace(/^\s*(entend[íi]|entiendo)\s*(que\s+)?:?\s*/i, '');

  async function interpretar(textoUsar) {
    const t = typeof textoUsar === 'string' ? textoUsar : texto;
    if (!t.trim()) return;
    setError(''); setResultado(null); setCargando(true);
    try {
      const r = await cotizarTexto(t, catalogo);
      if (!r || !r.ok) { setError(r?.error || 'No se pudo interpretar. Vuelve a intentar.'); return; }
      const items = r.propuesta?.items || [];

      // Se cuestan aquí y los que SÍ se pudieron costear entran directo al
      // proyecto. La nota y la confianza de la IA viajan con la partida para
      // que se sigan viendo en la lista de muebles.
      const costados = [];
      const sinCostear = [];
      for (const it of items) {
        const cantidad = Math.max(1, Math.round(Number(it.cantidad) || 1));
        const c = costearItem(estado, { ...it, cantidad });
        // `avisos` son los ajustes que la app le hizo a lo que pidió Voni (pediste 8
        // usuarios y ese producto sólo tiene 6). Antes se hacían en silencio.
        if (c) costados.push({ ...c, nota: it.nota || null, confianza: it.confianza || null, avisos: c.avisos || [] });
        else sinCostear.push(it.etiqueta || it.producto || 'un mueble');
      }
      // PIEZAS DEL BANCO DE PRECIOS (sillería, complementos). No se cuestan: su
      // precio viene de un presupuesto CERRADO, que manda sobre cualquier
      // modelo. Antes Voni ni las veía y contestaba que no había sillas.
      for (const b of r.propuesta?.banco || []) {
        const pieza = BANCO.find((x) => x.id === b.id);
        if (!pieza) { sinCostear.push(b.etiqueta || b.id); continue; }
        const cantidad = Math.max(1, Math.round(Number(b.cantidad) || 1));
        costados.push({
          piezaId: pieza.id, nombre: pieza.medidas ? `${pieza.nombre} (${pieza.medidas})` : pieza.nombre,
          cantidad, costoUnitario: 0, precioUnitario: pieza.precio, margen: null,
          deBanco: true, precioReal: true,
          nota: b.nota || null, confianza: 'alta', avisos: [],
        });
      }
      if (costados.length) {
        const nuevoLote = `ia-${Date.now()}`;
        onAgregarItems(costados, { lote: nuevoLote, reemplaza: lote.current });
        lote.current = nuevoLote;
      } else if (lote.current) {
        // No salió nada: igual hay que limpiar lo del intento anterior.
        onAgregarItems([], { lote: null, reemplaza: lote.current });
        lote.current = null;
      }

      setResultado({
        agregados: costados.length,
        resumen: limpiarResumen(r.propuesta?.resumen),
        preguntas: r.propuesta?.preguntas || [],
        noEncontrado: r.propuesta?.noEncontrado || [],
        sinCostear,
      });
      setRespuesta('');
    } catch (e) {
      setError('No se pudo conectar con el asistente. Revisa tu internet y vuelve a intentar.');
    } finally {
      setCargando(false);
    }
  }

  // Voni pregunta y aquí se le contesta: la respuesta se pega al pedido
  // original (no hay que repetirlo) y se rehace la lista.
  //
  // Y AQUÍ ES DONDE VONI APRENDE. Esta aclaración es la corrección más valiosa
  // que existe —el vendedor está diciendo con sus palabras qué le faltó
  // entender— y hasta hoy se pegaba a un useState y moría al recargar la
  // página. Ahora se guarda, y viaja de vuelta dentro del siguiente pedido.
  async function responder() {
    const r = respuesta.trim();
    if (!r) return;
    const nuevo = `${texto.trim()}\n\nAclaraciones: ${r}`;
    // No se espera: aprender no puede hacerle esperar un segundo al vendedor.
    anotar({
      tipo: 'aclaracion',
      pedido: texto.trim(),
      texto: `Si el pedido se parece a "${resumenCorto(texto)}", ten en cuenta desde el principio: ${r}`,
      usuario: estado?.usuario?.correo || null,
    });
    setTexto(nuevo);
    await interpretar(nuevo);
  }

  if (cargando) return <Cargando voni titulo="Voni está trabajando" mensajes={['Leyendo tu pedido…', 'Buscando en las 24 líneas…', 'Costeando cada mueble…', 'Armando la lista…']} />;

  const avisos = resultado
    ? resultado.preguntas.length + resultado.noEncontrado.length + resultado.sinCostear.length
    : 0;

  return (
    <div className="contenido" style={{ maxWidth: 900, paddingLeft: 0, paddingRight: 0 }}>
      <div className="tarjeta">
        <h3 style={{ marginBottom: 4 }}>¿Qué necesita tu cliente?</h3>
        <p className="ayuda columna-texto" style={{ marginTop: 0 }}>
          Escríbelo en palabras normales, como te lo pidieron. Lo convierto en muebles de nuestras líneas, con su precio.
        </p>
        {/* El cuestionario de botones va ARRIBA del recuadro: es el camino de
            quien empieza de cero. El texto se queda para quien ya tiene el
            correo del cliente que pegar. Misma Voni, dos entradas. */}
        {conPrograma && (
          <ProgramaProyecto cargando={cargando} onArmar={(frase) => { setTexto(frase); interpretar(frase); }} />
        )}
        {conPrograma && <div className="prog-o">o escríbelo / pégalo</div>}
        <textarea
          className="ia-textarea"
          rows={4}
          placeholder="Ej. 20 lugares de trabajo en bench de 1.50, 2 escritorios ejecutivos de 2.10 con su credenza y una mesa de juntas para 8."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="chips" style={{ marginTop: 8 }}>
          {EJEMPLOS.map((ej) => (
            <button key={ej.n} className="chip" onClick={() => setTexto(ej.t)} title="Usar este ejemplo">{ej.n}</button>
          ))}
        </div>
        <div className="espacio" />
        <button className="boton primario grande" style={{ width: '100%' }} onClick={() => interpretar()} disabled={!texto.trim()}>
          {resultado ? 'Volver a interpretar' : 'Armar la lista de muebles'}
        </button>
        {error && <div className="alerta roja" style={{ marginTop: 12 }}><span className="texto">{error}</span></div>}
      </div>

      {resultado && (
        <div className={`tarjeta ${resultado.agregados ? 'agregado-ok' : ''}`}>
          {resultado.agregados > 0 ? (
            <>
              <strong>Agregué {resultado.agregados} {resultado.agregados === 1 ? 'mueble' : 'muebles'} a tu proyecto.</strong>
              {resultado.resumen && <span className="texto" style={{ display: 'block', marginTop: 4 }}>{resultado.resumen}</span>}
              <span className="texto" style={{ display: 'block', marginTop: 6 }}>
                {verCotizacion
                  ? 'Ábrelos en tu cotización para cambiar cantidades o quitar lo que no va.'
                  : 'Revísalos aquí abajo: ahí cambias cantidades y quitas lo que no va.'}
              </span>
              {verCotizacion && onIr && (
                <>
                  <div className="espacio" />
                  <button className="boton" style={{ minHeight: 46 }} onClick={() => onIr('cotizacion')}>Ver mi cotización ›</button>
                </>
              )}
            </>
          ) : (
            <span className="texto">No pude armar ningún mueble con eso. Sé más concreto con las cantidades y las medidas, o agrégalos de línea.</span>
          )}
        </div>
      )}

      {avisos > 0 && (
        <div className="tarjeta">
          {resultado.preguntas.length > 0 && (
            <>
              <strong>Para afinarlo, dime:</strong>
              <ul className="lista-ia">{resultado.preguntas.map((q, k) => <li key={k}>{q}</li>)}</ul>
            </>
          )}
          {resultado.noEncontrado.length > 0 && (
            <div className="alerta ambar" style={{ marginTop: 10 }}>
              <span className="texto">Esto no está en catálogo: {resultado.noEncontrado.join(' · ')}. Va aparte, como especial a la medida.</span>
            </div>
          )}
          {resultado.sinCostear.length > 0 && (
            <div className="alerta ambar" style={{ marginTop: 10 }}>
              <span className="texto">No pude costear: {resultado.sinCostear.join(' · ')}. Agrégalo de línea o pídelo como especial.</span>
            </div>
          )}
          {resultado.preguntas.length > 0 && (
            <>
              <label className="etiqueta" htmlFor="ia-resp" style={{ marginTop: 12 }}>Contéstame aquí</label>
              <textarea id="ia-resp" className="ia-textarea" rows={3} value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                placeholder="Ej. Todos mano derecha de 2.10 m. La mesa de consejo sí lleva electrificación." />
              <div className="ayuda gris" style={{ fontSize: 12.5, marginTop: 4 }}>
                Se suma a lo que ya escribiste y rehago la lista. No repitas el pedido completo.
              </div>
              <div className="espacio" />
              <button className="boton primario" style={{ minHeight: 46 }} onClick={responder} disabled={!respuesta.trim()}>
                Responder y rehacer la lista
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
