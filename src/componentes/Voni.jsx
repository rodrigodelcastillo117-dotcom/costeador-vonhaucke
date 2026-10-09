// ============================================================================
//  VONI  ·  asistente de proyecto de 3 pasos
//  Muebles → Espacio → Propuesta. Cose las piezas que ya existen (Cotizar con
//  IA, Acomodo, Propuesta al cliente) en un solo flujo guiado, con sello
//  Firme/Estimado por renglón y "no tengo planos" siempre a la mano.
// ============================================================================
import { useMemo, useState, useRef, useEffect } from 'react';
import CotizadorIA from './CotizadorIA.jsx';
import Acomodo from './Acomodo.jsx';
import Cotizacion from './Cotizacion.jsx';
import VoniAvatar from './VoniAvatar.jsx';
import { pesos, selloPartida } from '../util.js';
import EditarPartida from './EditarPartida.jsx';
import EmpezarEspacio from './EmpezarEspacio.jsx';
import { leerPlanoDeArchivo } from '../datos/leerPlanoArchivo.js';
import { areasCanonicas, bloqueGeometria } from '../datos/floorPlan.js';
import { proponerProgramaDelPlano, aplicarPrograma } from '../datos/programaRealDelPlano.js';
import { requirementsDeBrief } from '../datos/programaBrief.js';
import Cargando from './Cargando.jsx';
import EstoEntendi from './EstoEntendi.jsx';
import { costoImplicito } from '../datos/preciosVenta.js';
import ConfirmarCandado from './ConfirmarCandado.jsx';

// ⚠️ EL ESPACIO VA PRIMERO (2026-08-17). Antes era: muebles → espacio →
// propuesta, y eso obliga a COTIZAR A CIEGAS: escoges los muebles sin saber
// dónde van y hasta el final descubres si caben. Rodrigo: "nunca preguntó
// planos antes de ponerlos". Preguntando el espacio primero, el paso de muebles
// ya puede decir "con esto vas apretado" MIENTRAS decides, que es cuando sirve.
const PASOS = [
  { n: 1, clave: 'espacio', titulo: 'Espacio', desc: '¿Dónde va el proyecto?' },
  { n: 2, clave: 'muebles', titulo: 'Muebles', desc: '¿Qué lleva?' },
  { n: 3, clave: 'acomodo', titulo: 'Acomodo', desc: 'Dónde va cada cosa.' },
  { n: 4, clave: 'propuesta', titulo: 'Propuesta', desc: 'Lista para el cliente.' },
];

// ⚠️ UN PASO SE PALOMEA SÓLO SI DE VERDAD SE HIZO (2026-08-17). Decía
// `p.n < paso ? 'hecho'`: cualquier paso que quedara atrás salía palomeado.
// Rodrigo subió su plano —que salta al paso 3 para leerlo— y **"Muebles" le
// apareció hecho sin haberle preguntado nada**. Un cartel verde que miente es
// peor que no tenerlo: le dice al proyectista que ya escogió muebles.
function Pasos({ paso, setPaso, puedeAvanzar, hechoPaso }) {
  return (
    <div className="voni-pasos no-imprimir">
      {PASOS.map((p, i) => {
        const hecho = p.n < paso && (hechoPaso ? hechoPaso(p.n) : true);
        const estado = p.n === paso ? 'activo' : hecho ? 'hecho' : 'pend';
        // Solo puedes saltar a un paso ya alcanzado (o al siguiente si hay muebles).
        const habilitado = p.n <= paso || (p.n === paso + 1 && puedeAvanzar);
        return (
          <button
            key={p.n}
            data-testid={`voni-paso-${p.clave}`}
            className={`voni-paso voni-paso-${estado}`}
            disabled={!habilitado}
            onClick={() => habilitado && setPaso(p.n)}
          >
            <span className="voni-paso-num">
              {/* ⚠️ EL SÍMBOLO TAMBIÉN, NO SÓLO EL COLOR. La primera vez sólo se
                  arregló la clase CSS y la palomita seguía dibujándose porque
                  esto miraba `p.n < paso`. Rodrigo la seguía viendo en Muebles. */}
              {hecho
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                : p.n}
            </span>
            <span className="voni-paso-tx">
              <span className="voni-paso-t">{p.titulo}</span>
              <span className="voni-paso-d">{p.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function Voni({
  estado, setEstado, soloVentas = false, veCostos = false,
  onAgregarItems, onGuardarAcomodo, onIr, onAplicarPrograma,
  paso, setPaso,
}) {
  const cot = estado.cotizacion || {};
  const partidas = cot.partidas || [];
  const hay = partidas.length > 0;

  const setCot = (parcial) => setEstado((e) => ({ ...e, cotizacion: { ...e.cotizacion, ...parcial } }));
  // El plano que el proyectista escoge en el PASO 1 viaja al paso 3, donde vive
  // el aparato que sabe leerlo. El `<input type="file">` tiene que estar AQUÍ:
  // el navegador sólo abre el diálogo si el clic salió del dedo, así que no se
  // puede abrir "al llegar" al paso 3.
  const archivoRef = useRef(null);
  const [abrirDibujo, setAbrirDibujo] = useState(false);
  // ⚠️ EL PLANO SE LEE **AQUÍ, EN EL PASO 1** (2026-08-17). Antes el lector sólo
  // existía dentro de `Acomodo` (paso 3), así que subir el PDF te empujaba al 3
  // y el paso 2 se lo saltaba. Rodrigo, tres veces: *"me sigue mandando al paso
  // 3, nunca he llegado al 2"*, *"debería ser paso 1, paso 2, paso 3, paso 4"*.
  // Mi primer intento fue rebotar de regreso desde el 3 con una condición: mala
  // idea, dependía de que el guardado automático disparara. Ahora el paso 1 lo
  // lee solo (`leerPlanoDeArchivo`) y **el 3 ni se toca**.
  const [leyendoPlano, setLeyendoPlano] = useState(false);
  const [errorPlano, setErrorPlano] = useState('');
  const [notaPlano, setNotaPlano] = useState('');
  // ChatGPT P0-A: una lectura de plano puede tardar (hasta 180 s). Si el usuario
  // sube OTRO archivo mientras una lectura previa sigue en curso, la respuesta
  // vieja NO debe pisar la nueva. Cada subida toma un id; al resolver, si ya hay
  // una subida más nueva, se descarta la vieja (cancelación lógica limpia).
  const reqPlanoRef = useRef(0);

  async function subirPlanoAqui(file) {
    const miReq = ++reqPlanoRef.current;
    setErrorPlano(''); setNotaPlano(''); setLeyendoPlano(true);
    let r;
    try {
      r = await leerPlanoDeArchivo(file);
    } catch (e) {
      if (miReq !== reqPlanoRef.current) return;   // superada por una lectura más nueva
      setLeyendoPlano(false);
      setErrorPlano('No se pudo leer el plano. Intenta de nuevo o sube la hoja principal como imagen.');
      return;
    }
    if (miReq !== reqPlanoRef.current) return;      // P0-A: llegó una lectura MÁS NUEVA → descarta ésta
    setLeyendoPlano(false);
    if (!r.ok) { setErrorPlano(r.error); return; }
    if (r.nota) setNotaPlano(r.nota);
    if (!r.areas.length) return;        // no se reconoció nada: que lo intente de nuevo
    onGuardarAcomodo?.({ ...bloqueGeometria(r.areas), plan: null, planReal: true });
    setPaso(2);                          // el siguiente paso es QUÉ LLEVA, no acomodar
  }
  const [confVaciar, setConfVaciar] = useState(false);
  const [editando, setEditando] = useState(null);   // índice de la partida que se edita
  const [confirmarCandado, setConfirmarCandado] = useState(null);   // null | paso destino
  // El paso 2 tiene DOS pantallas: 'describir' (contadores + "o escríbelo/
  // pégalo") y 'revisar' ("Agregué N muebles" + la lista completa editable +
  // preguntas para afinar, todo junto). Un solo "Armar el proyecto" te lleva
  // de una a la otra sola (ver `onListo` en el CotizadorIA de abajo) —
  // Rodrigo probó una versión con "1.1, 1.2… hasta el 7" y la tumbó: "son 7
  // clicks que no valen la pena... debería ser 1 con TODO el mobiliario".
  const [subpaso2, setSubpaso2] = useState('describir');
  const vaciar = () => { setCot({ partidas: [], acomodo: null }); setConfVaciar(false); setSubpaso2('describir'); };

  // Cada pantalla de Voni (cambio de paso, o el sub-paso 2a/2b) empieza
  // ARRIBA. Sin esto, llegar al paso 2 podía abrir donde se había quedado el
  // scroll de la pantalla anterior — mismo patrón que ya usan App.jsx:346 y
  // Cotizacion.jsx:95-96 (window Y el contenedor `.contenido`, por si el
  // navegador está haciendo scroll ahí en vez de en `window`).
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('.contenido')?.scrollTo?.(0, 0);
  }, [paso, subpaso2]);

  // El espacio, SIEMPRE en metros. `areasM` es lo normal, pero hay guardados
  // viejos que sólo traen `areas` en milímetros: sin este respaldo, "esto
  // entendí" decía "todavía no me dijiste dónde va el proyecto" con el espacio
  // ya contestado, que es peor que no decir nada.
  // Loader canónico único (floorPlan): areasM (verdad) o legacy mm→m, cuantizado 1 mm.
  const areasDelProyecto = useMemo(() => areasCanonicas(cot.acomodo || {}), [cot.acomodo]);

  // P0.1 (#1/#2/#3): el PROGRAMA PROPUESTO vive en el PASO 2. Resuelve productos
  // reales del plano y se reconcilia contra lo ya cotizado (DELTA): propone sólo
  // lo que falta (p.ej. el bench APP LT) sin re-proponer lo ya presente.
  // El brief estructurado (línea/modelo/dims/accesorios) lo interpreta CotizadorIA
  // y se persiste en cot.programaBrief; aquí se combina con el FloorSpec (#4).
  const reqBrief = requirementsDeBrief(cot.programaBrief);
  const propuestaPrograma = useMemo(
    () => (areasDelProyecto.length
      ? proponerProgramaDelPlano(areasDelProyecto, { linea: (reqBrief && reqBrief.linea) || 'App LT', brief: reqBrief || null })
      : null),
    [areasDelProyecto, cot.programaBrief],
  );
  const reconPrograma = useMemo(
    () => (propuestaPrograma ? aplicarPrograma(propuestaPrograma.propuesta, { existentes: partidas }) : null),
    [propuestaPrograma, partidas],
  );
  const faltantesPrograma = reconPrograma ? reconPrograma.confirmacion.confirmadas : [];
  const conflictosPrograma = reconPrograma ? reconPrograma.conflictos : [];
  const pendientesPrograma = propuestaPrograma ? (propuestaPrograma.propuesta.pendientes || []) : [];

  // #7: suma SÓLO precios conocidos (null/undefined NO cuenta como 0) y expone
  // cuántos faltan, para no presentar un total incompleto como definitivo.
  const totalLista = useMemo(
    () => partidas.reduce((a, p) => a + (Number.isFinite(Number(p.precioUnitario)) ? Number(p.precioUnitario) * (p.cantidad || 0) : 0), 0),
    [partidas],
  );
  const faltanPrecioVoni = useMemo(
    () => partidas.filter((p) => p.price_status === 'SIN_PRECIO' || p.precioUnitario == null).length,
    [partidas],
  );
  const nEstimados = partidas.filter((p) => selloPartida(p).tipo === 'estimado').length;

  // Candado de cantidad/usuarios (decisión de Rodrigo, 2026-08-20): antes de
  // salir del paso 2, si hay algo que huele al sobrecobro de 12× o a un
  // pedido de más de 14 usuarios, pide confirmación explícita en vez de
  // dejar pasar de largo un aviso que se puede ignorar. Se recalcula contra
  // las `partidas` de AHORA mismo, no algo que se guardó una vez.
  function avanzarConCandado(destino) {
    if (partidas.some((p) => p.candadoUsuarios || p.requiereProyectista)) setConfirmarCandado(destino);
    else setPaso(destino);
  }

  // CotizadorIA agrega renglones; en Voni no navegamos fuera: agregamos y, si el
  // botón fue "agregar y acomodar", saltamos al paso 2.
  const agregarEnProyecto = (items, opts) => onAgregarItems(items, opts);

  return (
    <div className="contenido voni" style={{ maxWidth: 1000 }}>
      <div className="voni-cab no-imprimir">
        <div className="voni-marca">
          <VoniAvatar tam={48} variante="cara" />
          <span className="voni-nombre">Voni</span>
          <span className="voni-tag">tu asistente de proyecto</span>
        </div>
        <div className="voni-proyecto">
          <label className="etiqueta" style={{ margin: 0 }}>Proyecto para</label>
          <input type="text" value={cot.cliente || ''} placeholder="Nombre del cliente"
            onChange={(e) => setCot({ cliente: e.target.value })} style={{ maxWidth: 260 }} />
        </div>
      </div>

      <Pasos paso={paso} setPaso={setPaso} puedeAvanzar={paso === 1 || hay}
        hechoPaso={(n) => (n === 1 ? !!(estado.cotizacion?.acomodo?.areasM?.length || estado.cotizacion?.acomodo?.areas?.length)
          : n === 2 ? hay
            : n === 3 ? !!estado.cotizacion?.acomodo?.plan : true)} />

      {/* ---------------- PASO 1 · ESPACIO ---------------- */}
      {paso === 1 && (
        <>
          <div className="voni-saludo">
            <VoniAvatar tam={64} variante="cara" anim="bob" />
            <p className="voni-globo">
              ¡Hola! Soy <b>Voni</b>. Empecemos por dónde va el proyecto: así, mientras escoges los
              muebles, te voy diciendo si caben.
            </p>
          </div>
          <input
            ref={archivoRef} data-testid="cotizar-plano" type="file" style={{ display: 'none' }}
            accept="image/*,application/pdf,.pdf,.dwg,.dxf"
            onChange={(e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;              // canceló el diálogo: quedarse en el paso 1
              subirPlanoAqui(f);
            }}
          />
          {leyendoPlano && <Cargando voni titulo="Voni está leyendo el plano"
            mensajes={['Midiendo los cuartos…', 'Sacando las áreas…', 'Contando privados y salas…']} />}
          {errorPlano && <div className="alerta roja" style={{ marginTop: 12 }}><span className="texto">{errorPlano}</span></div>}
          {notaPlano && !errorPlano && <div className="tarjeta" style={{ marginTop: 12 }}>{notaPlano}</div>}
          <EmpezarEspacio
            piezas={[]}
            subiendo={leyendoPlano}
            onSubirPlano={() => archivoRef.current?.click()}
            onDibujar={() => { setAbrirDibujo(true); setPaso(3); }}
            onListo={(areas) => { onGuardarAcomodo?.({ ...bloqueGeometria(areas), plan: null, planReal: false }); setPaso(2); }}
          />
          <div className="tarjeta no-imprimir voni-omitir">
            <span className="ayuda">¿Todavía no sabes el espacio?</span>
            <button className="boton fantasma" style={{ minHeight: 42 }} onClick={() => setPaso(2)}>
              Empezar por los muebles →
            </button>
          </div>
        </>
      )}

      {/* --------- PASO 2 · MUEBLES ---------
          UN solo CotizadorIA, siempre montado en el MISMO lugar del árbol
          (nunca se inserta/quita un hermano ANTES de él — eso también
          desmonta por posición). Su prop `pantalla` decide qué dibuja:
          'formulario' (contadores+texto) mientras describes, 'resultado'
          ("Agregué N muebles" + preguntas) en cuanto hay algo que revisar.
          Mismo componente, mismo estado interno (texto, resultado) — nunca
          se pierde nada (Rodrigo: "lo lleno... y lo puso otra vez en cero").
          ⚠️ UN SOLO CLIC (2026-08-19). Antes, terminar de describir mandaba
          por un wizard de "1.1, 1.2… hasta el 7" que Rodrigo no pidió — él
          quiere UNA pantalla con TODO el mobiliario y sillería junto, no
          siete clics. `onListo` (abajo) hace que "Armar el proyecto" te
          lleve derecho ahí, sin un clic de más. */}
      {paso === 2 && (
        <>
          {propuestaPrograma && (faltantesPrograma.length > 0 || conflictosPrograma.length > 0 || pendientesPrograma.length > 0) && (
            <div className="tarjeta no-imprimir" style={{ borderColor: '#8bbcaf', background: '#eef6f3' }}>
              <strong style={{ color: '#174f45' }}>✨ Programa detectado del plano</strong>
              <p className="ayuda" style={{ marginTop: 4 }}>
                Productos reales del catálogo. Se agrega SÓLO lo que falta (no duplica lo ya cotizado). El precio lo revalida el servidor al emitir.
              </p>
              {faltantesPrograma.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, color: '#174f45' }}>Por agregar</div>
                  {faltantesPrograma.map((p) => (
                    <div key={p.id}>✓ {p.cantidad}× {p.nombre}{p.w ? ` · ${(p.w / 1000).toFixed(2)}×${((p.d || 0) / 1000).toFixed(2)} m` : ''}</div>
                  ))}
                </div>
              )}
              {pendientesPrograma.length > 0 && (
                <div style={{ marginTop: 8, color: '#8a5a00' }}>
                  <div style={{ fontWeight: 700 }}>Pendiente de confirmar (no se sustituye solo)</div>
                  {pendientesPrograma.map((p, i) => (
                    <div key={i}>⚠ {p.rol}{p.faltante?.requested?.model ? ` · ${p.faltante.requested.model}` : ''} — {p.faltante?.reason || 'NEEDS_CONFIRMATION'}</div>
                  ))}
                </div>
              )}
              {conflictosPrograma.length > 0 && (
                <div style={{ marginTop: 8, color: '#8a1f1f' }}>
                  <div style={{ fontWeight: 700 }}>Conflicto (decide tú)</div>
                  {conflictosPrograma.map((c, i) => (
                    <div key={i}>✗ {c.slot}: ya existe {c.existente?.bancoId} vs propuesto {c.propuesto?.bancoId}</div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <button type="button" className="boton primario"
                  disabled={!onAplicarPrograma || faltantesPrograma.length === 0}
                  onClick={() => onAplicarPrograma?.(propuestaPrograma.propuesta)}>
                  Aplicar programa detectado
                </button>
                {conflictosPrograma.length > 0 && (
                  <span style={{ marginLeft: 10, color: '#8a1f1f', fontWeight: 700 }}>Programa INCOMPLETO / NEEDS_REVIEW por conflictos.</span>
                )}
              </div>
            </div>
          )}
          <div style={{ display: (subpaso2 === 'describir' && !hay) ? undefined : 'none' }}>
            <div className="voni-saludo">
              <VoniAvatar tam={64} variante="cara" anim="bob" />
              <p className="voni-globo">¡Hola! Soy <b>Voni</b>. Cuéntame qué necesita tu cliente —en palabras normales— y te armo el proyecto: muebles, acomodo y propuesta.</p>
            </div>
          </div>

          <CotizadorIA
            estado={estado} onAgregarItems={agregarEnProyecto} onIr={onIr} conPrograma
            pantalla={subpaso2 === 'describir' ? 'formulario' : 'resultado'}
            onListo={() => setSubpaso2('revisar')}
            soloVentas={soloVentas}
          />

          {/* Puente manual, por si vuelves a un proyecto que YA tenía muebles
              (resultado es estado local: no sobrevive a recargar la página) y
              quieres ir directo a revisar sin describir nada nuevo. */}
          {subpaso2 === 'describir' && hay && (
            <div className="tarjeta voni-puente">
              <span className="ayuda">Voni ya armó <strong>{partidas.length}</strong> {partidas.length === 1 ? 'mueble' : 'muebles'} · {faltanPrecioVoni > 0 ? `${pesos(totalLista)} (parcial · faltan ${faltanPrecioVoni} precio${faltanPrecioVoni === 1 ? '' : 's'})` : pesos(totalLista)}</span>
              <button className="boton primario grande" style={{ width: '100%' }} onClick={() => setSubpaso2('revisar')}>
                Revisar lo que entendí ({partidas.length}) →
              </button>
            </div>
          )}

          {subpaso2 === 'revisar' && (
            <button className="boton fantasma btn-atras" style={{ minHeight: 42 }} onClick={() => setSubpaso2('describir')}>
              ‹ Volver a describir o agregar más
            </button>
          )}

          {subpaso2 === 'revisar' && (
          <div className="tarjeta">
            <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Muebles del proyecto {hay && <span className="gris">({partidas.length})</span>}</h3>
              {hay && !confVaciar && <button className="boton fantasma" style={{ minHeight: 44, padding: '0 14px' }} onClick={() => setConfVaciar(true)}>Vaciar</button>}
              {hay && confVaciar && (
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span className="ayuda">¿Vaciar todo?</span>
                  <button className="boton primario" style={{ minHeight: 44, padding: '0 14px' }} onClick={vaciar}>Sí, vaciar</button>
                  <button className="boton fantasma" style={{ minHeight: 44, padding: '0 14px' }} onClick={() => setConfVaciar(false)}>No</button>
                </span>
              )}
            </div>

            {!hay ? (
              <p className="ayuda" style={{ marginTop: 8 }}>
                Ya no hay muebles. <button className="enlace" onClick={() => setSubpaso2('describir')}>Volver a describirle a Voni</button> o agrégalos de línea.
              </p>
            ) : (
              <div className="voni-lista" style={{ marginTop: 10 }}>
                <EstoEntendi
                  partidas={partidas}
                  areasM={areasDelProyecto}
                  onCantidad={(id, n) => setCot({ partidas: partidas.map((p) => (p.id === id ? { ...p, cantidad: Math.max(1, n) } : p)) })}
                  onQuitar={(id) => setCot({ partidas: partidas.filter((p) => p.id !== id) })}
                  onEditar={(id) => setEditando(partidas.findIndex((p) => p.id === id))}
                  onVariante={(id, art) => setCot({ partidas: partidas.map((p) => (p.id === id ? {
                    ...p,
                    precioUnitario: art.lista,
                    costoUnitario: costoImplicito(art.lista),   // que Dirección siga viendo utilidad coherente
                    precioReal: true,
                    catalogo: { clave: art.clave, lista: art.lista, full: art.full, minimo: art.minimo },
                  } : p)) })}
                />
                <hr />
                <div className="fila" style={{ justifyContent: 'flex-end', gap: 20 }}>
                  <span className="ayuda">{faltanPrecioVoni > 0 ? 'Subtotal con precios conocidos' : 'Precio de lista'}</span>
                  <strong className="mono" style={{ fontSize: 18 }}>{pesos(totalLista)}</strong>
                </div>
                {faltanPrecioVoni > 0 && (
                  <div className="alerta ambar" style={{ marginTop: 10 }}>
                    <span className="texto">
                      Faltan <strong>{faltanPrecioVoni}</strong> precio{faltanPrecioVoni === 1 ? '' : 's'}: el total NO está completo hasta resolverlos (el servidor los valida al emitir).
                    </span>
                  </div>
                )}
                {nEstimados > 0 && (
                  <div className="alerta ambar" style={{ marginTop: 10 }}>
                    <span className="texto">
                      <strong>{nEstimados} de {partidas.length}</strong> {nEstimados === 1 ? 'renglón trae precio' : 'renglones traen precio'} <strong>estimado</strong>.
                      Sirve para dar una idea, pero antes de comprometerlo con el cliente pídele a Diseño que lo confirme. El resto es firme.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <button className="boton primario grande" style={{ width: '100%' }} disabled={!hay} onClick={() => avanzarConCandado(3)}>
                Sí, así es — acomódalo →
              </button>
              <button className="boton grande" style={{ width: '100%' }} disabled={!hay} onClick={() => avanzarConCandado(4)} title="Sáltate el acomodo y ve directo a la propuesta">
                No necesito acomodo, ir directo a la propuesta
              </button>
            </div>
          </div>
          )}
        </>
      )}

      {confirmarCandado != null && (
        <ConfirmarCandado
          partidas={partidas}
          onConfirmar={() => { const destino = confirmarCandado; setConfirmarCandado(null); setPaso(destino); }}
          onCancelar={() => setConfirmarCandado(null)}
        />
      )}

      {editando != null && partidas[editando] && (
        <EditarPartida
          estado={estado}
          partida={partidas[editando]}
          onCerrar={() => setEditando(null)}
          onGuardar={(nueva) => {
            setCot({ partidas: partidas.map((p, j) => (j === editando ? nueva : p)) });
            setEditando(null);
          }}
        />
      )}

      {/* ---------------- PASO 3 · ACOMODO ---------------- */}
      {paso === 3 && (
        <>
          <div className="tarjeta no-imprimir voni-omitir">
            <span className="ayuda">¿No tienes planos ni medidas del lugar?</span>
            <button className="boton fantasma" style={{ minHeight: 42 }} onClick={() => setPaso(4)}>Omitir el acomodo, ir a la propuesta →</button>
          </div>
          <Acomodo
            estado={estado}
            onGuardarAcomodo={onGuardarAcomodo}
            onAplicarPrograma={onAplicarPrograma}
            onIr={(r) => setPaso(r === 'cotizacion' ? 4 : 2)}
            abrirDibujo={abrirDibujo}
            onConsumido={() => setAbrirDibujo(false)}
          />
        </>
      )}

      {/* ---------------- PASO 4 · PROPUESTA ---------------- */}
      {paso === 4 && (
        <Cotizacion
          estado={estado}
          setEstado={setEstado}
          soloVentas={soloVentas}
          onIr={(r) => setPaso(r === 'acomodo' ? 3 : 4)}
        />
      )}
    </div>
  );
}
