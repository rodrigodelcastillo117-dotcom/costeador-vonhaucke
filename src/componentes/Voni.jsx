// ============================================================================
//  VONI  ·  asistente de proyecto de 3 pasos
//  Muebles → Espacio → Propuesta. Cose las piezas que ya existen (Cotizar con
//  IA, Acomodo, Propuesta al cliente) en un solo flujo guiado, con sello
//  Firme/Estimado por renglón y "no tengo planos" siempre a la mano.
// ============================================================================
import { useMemo, useState, useRef } from 'react';
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
  const vaciar = () => { setCot({ partidas: [], acomodo: null }); setConfVaciar(false); };

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

      {/* ---------------- PASO 2 · MUEBLES ---------------- */}
      {paso === 2 && (
        <>
          {!hay && (
            <div className="voni-saludo">
              <VoniAvatar tam={64} variante="cara" anim="bob" />
              <p className="voni-globo">¡Hola! Soy <b>Voni</b>. Cuéntame qué necesita tu cliente —en palabras normales— y te armo el proyecto: muebles, acomodo y propuesta.</p>
            </div>
          )}
          <CotizadorIA estado={estado} onAgregarItems={agregarEnProyecto} onIr={onIr} conPrograma />

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
                Aún no hay muebles. Descríbele a Voni lo que pide el cliente aquí arriba, o agrégalos
                de línea, del banco o como especial desde el menú de Cotizar.
              </p>
            ) : (
              <div className="voni-lista" style={{ marginTop: 10 }}>
                {/* ⚠️ ANTES AQUÍ IBA LA LISTA CRUDA: veinte renglones de catálogo
                    con clave y acabado, en el orden en que los escupió el modelo.
                    Revisar eso no es revisar el proyecto — nadie cacha ahí que
                    pidió 21 lugares y le cotizaron 14 sillas. `EstoEntendi` es
                    LA MISMA lista (el ± cambia la partida de verdad), agrupada
                    por lo que cada cosa ES y con lo que no cuadra hasta arriba.
                    Rodrigo: "el paso 'esto entendí', la lista corregible ANTES
                    de acomodar". */}
                <EstoEntendi
                  partidas={partidas}
                  areasM={areasDelProyecto}
                  onCantidad={(id, n) => setCot({ partidas: partidas.map((p) => (p.id === id ? { ...p, cantidad: Math.max(1, n) } : p)) })}
                  onQuitar={(id) => setCot({ partidas: partidas.filter((p) => p.id !== id) })}
                  onEditar={(id) => setEditando(partidas.findIndex((p) => p.id === id))}
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
              {/* El botón es la APROBACIÓN de la lectura de arriba, no un
                  "siguiente" cualquiera: lo que aprueba es lo que se acomoda.
                  Y decía "Continuar al espacio" cuando el espacio es el paso 1
                  desde que se invirtió el orden: lo que sigue es el acomodo. */}
              <button className="boton primario grande" style={{ width: '100%' }} disabled={!hay} onClick={() => setPaso(3)}>
                Sí, así es — acomódalo →
              </button>
              {/* 🐛 Este decía "ir directo a la propuesta" y mandaba al ACOMODO
                  (paso 3), que es justo lo que el vendedor quería saltarse. */}
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
