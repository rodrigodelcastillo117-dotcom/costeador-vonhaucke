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
import { useEffect, useMemo, useRef, useState } from 'react';
import { catalogoIA, costearItem } from '../datos/lineas.js';
import { BANCO } from '../datos/banco.js';
import { autorizadoPorRef } from '../datos/precioAutorizado.js';
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

// `pantalla`: 'todo' (de siempre) | 'formulario' (solo contadores+texto,
// sin resultado) | 'resultado' (solo "Agregué N muebles" + preguntas, sin el
// formulario) — Voni.jsx la usa para partir esto en DOS pantallas (el
// contador de Rodrigo, no el motor: sigue siendo UN interpretar() y UN
// estado, sólo cambia qué parte se dibuja). `onListo`: se llama justo
// después de un interpretar() que sí agregó muebles, para que Voni.jsx
// pueda saltar solo a la pantalla de "esto entendí" sin un clic de más.
export default function CotizadorIA({
  estado, onAgregarItems, onIr, verCotizacion = false, conPrograma = false,
  pantalla = 'todo', onListo, soloVentas = false,
}) {
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);
  const [respuesta, setRespuesta] = useState('');
  const catalogo = useMemo(() => catalogoIA(), []);
  // Id del último lote que puso la IA en el proyecto. Al volver a interpretar
  // se reemplaza ese lote en vez de agregar encima (si no, se duplica todo).
  const lote = useRef(null);
  // ⚠️ "AGREGUÉ N MUEBLES" SE QUEDABA VIEJO (auditoría 2026-08-19). `resultado`
  // es estado local: si el vendedor borra o cambia renglones desde el Paso 4
  // (Cotizacion.jsx) y regresa aquí, esta tarjeta seguía narrando la cantidad
  // vieja mientras la lista real de abajo ya mostraba otra — dos tarjetas
  // contradiciéndose. No se intenta PREDECIR el conteo nuevo (onAgregarItems
  // no siempre suma: a veces reemplaza un lote) — más simple y robusto: se
  // marca "acabo de interpretar yo" antes de tocar las partidas, y si el
  // conteo cambia SIN esa marca, es que cambió por fuera → se esconde el
  // resumen viejo en vez de seguir mintiendo.
  const acabaDeInterpretar = useRef(false);
  const partidasActuales = estado.cotizacion?.partidas?.length || 0;
  useEffect(() => {
    if (acabaDeInterpretar.current) { acabaDeInterpretar.current = false; return; }
    setResultado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidasActuales]);

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
      const sinPrecio = [];   // vendedor: producto sin precio AUTORIZADO (fail-closed, nunca $0)
      const especiales = [];  // P0-A: material explícito que el producto NO ofrece → especial a la medida
      for (const it of items) {
        const cantidad = Math.max(1, Math.round(Number(it.cantidad) || 1));
        // P0-A — PRECEDENCIA DE MATERIAL: si el usuario pidió un material que el
        // producto de catálogo NO ofrece (p.ej. superficie sólida/Corian en una línea
        // de melamina), el producto es SOLO referencia de geometría: su precio estándar
        // NO aplica. No se costea como ese producto (sería presentar MELAMINA cuando
        // pidieron otra familia) ni se mete en $0: va como ESPECIAL a la medida,
        // conservando el material, para cotización de fábrica. El material explícito del
        // usuario manda sobre el producto similar.
        if (it.material_override && String(it.material_override).trim()) {
          const et = it.etiqueta || it.producto || 'mueble';
          especiales.push(`${et}${cantidad > 1 ? ` (×${cantidad})` : ''} — ${String(it.material_override).trim()}`);
          continue;
        }
        const c = costearItem(estado, { ...it, cantidad }, { soloVentas });
        // `avisos` son los ajustes que la app le hizo a lo que pidió Voni (pediste 8
        // usuarios y ese producto sólo tiene 6). Antes se hacían en silencio.
        if (c && c.sinPrecioAutorizado) {
          // Fail-closed: no se arma un renglón con $0. Se avisa que requiere costeo.
          sinPrecio.push(c.nombre || it.etiqueta || it.producto || 'un mueble');
        } else if (c) {
          costados.push({ ...c, nota: it.nota || null, confianza: it.confianza || null, avisos: c.avisos || [], sugerido: !!it.sugerido });
        } else {
          sinCostear.push(it.etiqueta || it.producto || 'un mueble');
        }
      }
      // PIEZAS DEL BANCO DE PRECIOS (sillería, complementos). No se cuestan: su
      // precio viene de un presupuesto CERRADO, que manda sobre cualquier
      // modelo. Antes Voni ni las veía y contestaba que no había sillas.
      for (const b of r.propuesta?.banco || []) {
        const pieza = BANCO.find((x) => x.id === b.id);
        if (!pieza) { sinCostear.push(b.etiqueta || b.id); continue; }
        const cantidad = Math.max(1, Math.round(Number(b.cantidad) || 1));
        // Banco = precio REAL de presupuesto cerrado (no se cuesta). Para el vendedor
        // NO se adjunta economía (ni siquiera costoUnitario:0, que dispararía el scanner).
        const partidaBanco = {
          piezaId: pieza.id, nombre: pieza.medidas ? `${pieza.nombre} (${pieza.medidas})` : pieza.nombre,
          cantidad, precioUnitario: pieza.precio,
          deBanco: true, precioReal: true,
          nota: b.nota || null, confianza: 'alta', avisos: [], sugerido: !!b.sugerido,
        };
        if (!soloVentas) { partidaBanco.costoUnitario = 0; partidaBanco.margen = null; }
        else {
          partidaBanco.sellerSafe = true;
          // LÍNEA V2: identidad de Producto Maestro (banco: source_ref == id de la pieza).
          const idv2 = autorizadoPorRef(pieza.id);
          if (idv2) {
            partidaBanco.source_type = 'banco';
            partidaBanco.source_ref = idv2.source_ref;
            partidaBanco.producto_id = idv2.producto_id;
            partidaBanco.producto_version_id = idv2.producto_version_id;
            partidaBanco.lista_precio_item_id = idv2.lista_precio_item_id;
            partidaBanco.precio_lista_snapshot = pieza.precio;  // precio de display (banco), no snapshot
          }
        }
        costados.push(partidaBanco);
      }
      // Se marca ANTES de tocar las partidas: el useEffect de arriba compara
      // contra esta marca para saber que el cambio que viene fue nuestro.
      acabaDeInterpretar.current = true;
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
        sinPrecio,
        especiales,
      });
      setRespuesta('');
      // Un solo clic ("Armar el proyecto") te lleva a la pantalla de "esto
      // entendí" — Rodrigo: "7 clicks que no valen la pena. debería ser 1".
      // Sólo si de verdad agregó algo: si no pudo armar nada, mejor que se
      // quede viendo el mensaje y el formulario para volver a intentar.
      if (costados.length) onListo?.();
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
    ? resultado.preguntas.length + resultado.noEncontrado.length + resultado.sinCostear.length + (resultado.sinPrecio?.length || 0)
    : 0;

  const conFormulario = pantalla !== 'resultado';
  const conResultado = pantalla !== 'formulario';

  return (
    <div className="contenido" style={{ maxWidth: 900, paddingLeft: 0, paddingRight: 0 }}>
      {conFormulario && (
        <div className="tarjeta">
          <h3 style={{ marginBottom: 4 }}>¿Qué necesita tu cliente?</h3>
          <p className="ayuda columna-texto" style={{ marginTop: 0 }}>
            Escríbelo en palabras normales, como te lo pidieron. Lo convierto en muebles de nuestras líneas, con su precio.
          </p>
          {/* El cuestionario de botones va ARRIBA del recuadro: es el camino de
              quien empieza de cero. El texto se queda para quien ya tiene el
              correo del cliente que pegar. Misma Voni, dos entradas. */}
          {/* `areasPlano`: las áreas del plano que ya se leyó en el paso 1. Con
              ellas el cuestionario llega LLENO en vez de en blanco. */}
          {conPrograma && (
            <ProgramaProyecto
              cargando={cargando}
              areasPlano={estado.cotizacion?.acomodo?.areasM || null}
              onArmar={(frase) => { setTexto(frase); interpretar(frase); }} />
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
        </div>
      )}

      {error && <div className="alerta roja" style={{ marginTop: 12 }}><span className="texto">{error}</span></div>}

      {conResultado && resultado && (
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

      {conResultado && avisos > 0 && (
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
          {resultado.especiales?.length > 0 && (
            <div className="alerta ambar" style={{ marginTop: 10 }}>
              <span className="texto">
                Material especial (no es de catálogo estándar): {resultado.especiales.join(' · ')}.
                No se cotiza con el precio del producto estándar —se respeta el material que pediste—;
                va como <strong>especial a la medida</strong> y requiere costeo de fábrica.
              </span>
            </div>
          )}
          {resultado.sinCostear.length > 0 && (
            <div className="alerta ambar" style={{ marginTop: 10 }}>
              <span className="texto">No pude costear: {resultado.sinCostear.join(' · ')}. Agrégalo de línea o pídelo como especial.</span>
            </div>
          )}
          {resultado.sinPrecio?.length > 0 && (
            <div className="alerta ambar" style={{ marginTop: 10 }}>
              <span className="texto">Sin precio autorizado (requiere costeo de Diseño/Dirección): {resultado.sinPrecio.join(' · ')}. No se agregó para no cotizar un precio no autorizado.</span>
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
