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
import Cargando from './Cargando.jsx';
import EstoEntendi from './EstoEntendi.jsx';
import { costoImplicito } from '../datos/preciosVenta.js';
import { loQueEntendi } from '../datos/entendido.js';

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
  onAgregarItems, onGuardarAcomodo, onIr,
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

  async function subirPlanoAqui(file) {
    setErrorPlano(''); setNotaPlano(''); setLeyendoPlano(true);
    const r = await leerPlanoDeArchivo(file);
    setLeyendoPlano(false);
    if (!r.ok) { setErrorPlano(r.error); return; }
    if (r.nota) setNotaPlano(r.nota);
    if (!r.areas.length) return;        // no se reconoció nada: que lo intente de nuevo
    onGuardarAcomodo?.({ areasM: r.areas, areas: null, plan: null, planReal: true });
    setPaso(2);                          // el siguiente paso es QUÉ LLEVA, no acomodar
  }
  const [confVaciar, setConfVaciar] = useState(false);
  const [editando, setEditando] = useState(null);   // índice de la partida que se edita
  // El paso 2 tiene TRES pantallas, no una página larga: 'describir' (la
  // charla con Voni), 'grupos' (confirma de a poco, "1.1 Puestos…", "1.2
  // Privados…") y 'revisar' ("Esto entendí" completo, para quien prefiere
  // verlo todo junto). Antes sólo eran dos y "Esto entendí" aventaba los N
  // renglones de un jalón — Rodrigo: "se pierde lo que ya llené" al ir y
  // volver, y no había manera de confirmar de a poco antes de acomodar.
  // `indiceGrupo` sólo importa mientras `subpaso2 === 'grupos'`.
  const [subpaso2, setSubpaso2] = useState('describir');
  const [indiceGrupo, setIndiceGrupo] = useState(0);
  const vaciar = () => { setCot({ partidas: [], acomodo: null }); setConfVaciar(false); setSubpaso2('describir'); };

  // Cada pantalla de Voni (cambio de paso, o el sub-paso 2a/2b/2c) empieza
  // ARRIBA. Sin esto, llegar al paso 2 podía abrir donde se había quedado el
  // scroll de la pantalla anterior — mismo patrón que ya usan App.jsx:346 y
  // Cotizacion.jsx:95-96 (window Y el contenedor `.contenido`, por si el
  // navegador está haciendo scroll ahí en vez de en `window`).
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('.contenido')?.scrollTo?.(0, 0);
  }, [paso, subpaso2, indiceGrupo]);

  // El espacio, SIEMPRE en metros. `areasM` es lo normal, pero hay guardados
  // viejos que sólo traen `areas` en milímetros: sin este respaldo, "esto
  // entendí" decía "todavía no me dijiste dónde va el proyecto" con el espacio
  // ya contestado, que es peor que no decir nada.
  const areasDelProyecto = useMemo(() => {
    const ac = cot.acomodo || {};
    if (ac.areasM?.length) return ac.areasM;
    return (ac.areas || []).map((a) => ({ ...a, ancho: (a.ancho || 0) / 1000, largo: (a.largo || 0) / 1000 }));
  }, [cot.acomodo]);

  const totalLista = useMemo(() => partidas.reduce((a, p) => a + p.precioUnitario * p.cantidad, 0), [partidas]);
  const nEstimados = partidas.filter((p) => selloPartida(p).tipo === 'estimado').length;

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
            ref={archivoRef} type="file" style={{ display: 'none' }}
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
            onListo={(areas) => { onGuardarAcomodo?.({ areasM: areas, areas: null, plan: null, planReal: false }); setPaso(2); }}
          />
          <div className="tarjeta no-imprimir voni-omitir">
            <span className="ayuda">¿Todavía no sabes el espacio?</span>
            <button className="boton fantasma" style={{ minHeight: 42 }} onClick={() => setPaso(2)}>
              Empezar por los muebles →
            </button>
          </div>
        </>
      )}

      {/* --------- PASO 2a · CUÉNTAME (la charla con Voni, sola) ---------
          ⚠️ SE OCULTA, NO SE DEJA DE RENDERIZAR (2026-08-19). Antes este
          bloque completo dependía de `!revisar`, así que al abrir "Revisar
          lo que entendí" y volver, React desmontaba `CotizadorIA` —y con él
          `ProgramaProyecto`— y remontaba uno nuevo: los contadores +/- que ya
          habías llenado volvían a cero y el texto que ibas escribiendo se
          perdía, aunque los muebles YA agregados seguían a salvo en el
          proyecto (Rodrigo: "lo lleno... y lo puso otra vez en cero"). Ahora
          sigue montado siempre que estás en el paso 2; solo se esconde con
          CSS mientras `subpaso2` no es 'describir'. */}
      {paso === 2 && (
        <div style={{ display: subpaso2 === 'describir' ? undefined : 'none' }}>
          {!hay && (
            <div className="voni-saludo">
              <VoniAvatar tam={64} variante="cara" anim="bob" />
              <p className="voni-globo">¡Hola! Soy <b>Voni</b>. Cuéntame qué necesita tu cliente —en palabras normales— y te armo el proyecto: muebles, acomodo y propuesta.</p>
            </div>
          )}
          <CotizadorIA estado={estado} onAgregarItems={agregarEnProyecto} onIr={onIr} conPrograma />

          {/* EL PUENTE A LA REVISIÓN. Antes "Esto entendí" vivía al fondo de esta
              misma página: había que bajar un cañón de scroll y nadie llegaba
              (Rodrigo, 2026-08-18). Ahora la revisión es su propia pantalla y
              este botón grande es la única puerta: imposible no verla.
              El botón grande va grupo por grupo (2026-08-19); "Ver todo junto"
              es la salida rápida para quien ya sabe lo que quiere. */}
          {hay && (
            <div className="tarjeta voni-puente">
              <span className="ayuda">Voni ya armó <strong>{partidas.length}</strong> {partidas.length === 1 ? 'mueble' : 'muebles'} · {pesos(totalLista)}</span>
              <button className="boton primario grande" style={{ width: '100%' }}
                onClick={() => { setIndiceGrupo(0); setSubpaso2('grupos'); }}>
                Revisar lo que entendí ({partidas.length}) →
              </button>
              <button className="boton fantasma" style={{ minHeight: 40 }} onClick={() => setSubpaso2('revisar')}>
                Ver todo junto
              </button>
            </div>
          )}
        </div>
      )}

      {/* --------- PASO 2c · UNO A LA VEZ (grupo por grupo) ---------
          Rediseño del Paso 2 (Rodrigo, 2026-08-19): en vez de aventar los N
          renglones juntos en una sola pantalla, Voni los confirma de a poco
          —"Paso 1.1 Puestos de trabajo", "Paso 1.2 Privados"…— reusando el
          MISMO EstoEntendi de siempre (con `soloGrupo`), sólo que un grupo a
          la vez. Al terminar el último grupo, dice lo que no cuadra ENTRE
          grupos (faltan sillas, hay privados vacíos…) antes de acomodar —
          eso es lo que `entendido.avisos` ya calculaba, sólo que antes vivía
          escondido al fondo de una pantalla larga. */}
      {paso === 2 && subpaso2 === 'grupos' && (() => {
        const entendido = loQueEntendi(partidas, areasDelProyecto);
        const grupos = entendido.grupos;
        const i = Math.min(indiceGrupo, grupos.length);
        const grupoActual = grupos[i];
        return (
          <>
            <button className="boton fantasma btn-atras" style={{ minHeight: 42 }}
              onClick={() => (i === 0 ? setSubpaso2('describir') : setIndiceGrupo(i - 1))}>
              ‹ {i === 0 ? 'Volver a describir o agregar más' : 'Grupo anterior'}
            </button>

            <div className="tarjeta">
              {grupoActual ? (
                <>
                  <div className="ayuda" style={{ marginBottom: 4 }}>Paso 1.{i + 1} de {grupos.length}</div>
                  <div className="voni-lista">
                    <EstoEntendi
                      partidas={partidas} areasM={areasDelProyecto} soloGrupo={grupoActual.clave}
                      onCantidad={(id, n) => setCot({ partidas: partidas.map((p) => (p.id === id ? { ...p, cantidad: Math.max(1, n) } : p)) })}
                      onQuitar={(id) => setCot({ partidas: partidas.filter((p) => p.id !== id) })}
                      onEditar={(id) => setEditando(partidas.findIndex((p) => p.id === id))}
                      onVariante={(id, art) => setCot({ partidas: partidas.map((p) => (p.id === id ? {
                        ...p,
                        precioUnitario: art.lista,
                        costoUnitario: costoImplicito(art.lista),
                        precioReal: true,
                        catalogo: { clave: art.clave, lista: art.lista, full: art.full, minimo: art.minimo },
                      } : p)) })}
                    />
                  </div>
                  <button className="boton primario grande" style={{ width: '100%', marginTop: 14 }}
                    onClick={() => setIndiceGrupo(i + 1)}>
                    Sí, así es →
                  </button>
                </>
              ) : (
                <>
                  <h3 style={{ marginTop: 0 }}>¿Ya quedó?</h3>
                  {entendido.avisos.length > 0 ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {entendido.avisos.map((a, k) => (
                        <div className={`alerta ${a.tono}`} key={k}><span className="texto">{a.texto}</span></div>
                      ))}
                    </div>
                  ) : (
                    <p className="ayuda">Ya revisaste todo. {pesos(totalLista)} de precio de lista.</p>
                  )}
                  <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                    <button className="boton primario grande" style={{ width: '100%' }} disabled={!hay} onClick={() => setPaso(3)}>
                      Sí, así es — acomódalo →
                    </button>
                    <button className="boton grande" style={{ width: '100%' }} disabled={!hay} onClick={() => setPaso(4)} title="Sáltate el acomodo y ve directo a la propuesta">
                      No necesito acomodo, ir directo a la propuesta
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        );
      })()}

      {/* --------- PASO 2b · ESTO ENTENDÍ (la lista corregible, sola) --------- */}
      {paso === 2 && subpaso2 === 'revisar' && (
        <>
          <button className="boton fantasma btn-atras" style={{ minHeight: 42 }} onClick={() => setSubpaso2('describir')}>
            ‹ Volver a describir o agregar más
          </button>

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
                  <span className="ayuda">Precio de lista</span>
                  <strong className="mono" style={{ fontSize: 18 }}>{pesos(totalLista)}</strong>
                </div>
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
              <button className="boton primario grande" style={{ width: '100%' }} disabled={!hay} onClick={() => setPaso(3)}>
                Sí, así es — acomódalo →
              </button>
              <button className="boton grande" style={{ width: '100%' }} disabled={!hay} onClick={() => setPaso(4)} title="Sáltate el acomodo y ve directo a la propuesta">
                No necesito acomodo, ir directo a la propuesta
              </button>
            </div>
          </div>
        </>
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
