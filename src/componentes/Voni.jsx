// ============================================================================
//  VONI  ·  asistente de proyecto de 3 pasos
//  Muebles → Espacio → Propuesta. Cose las piezas que ya existen (Cotizar con
//  IA, Acomodo, Propuesta al cliente) en un solo flujo guiado, con sello
//  Firme/Estimado por renglón y "no tengo planos" siempre a la mano.
// ============================================================================
import { useMemo, useState } from 'react';
import CotizadorIA from './CotizadorIA.jsx';
import Acomodo from './Acomodo.jsx';
import Cotizacion from './Cotizacion.jsx';
import VoniAvatar from './VoniAvatar.jsx';
import { pesos, selloPartida } from '../util.js';
import EditarPartida, { sePuedeEditar } from './EditarPartida.jsx';

const PASOS = [
  { n: 1, clave: 'muebles', titulo: 'Muebles', desc: '¿Qué lleva el proyecto?' },
  { n: 2, clave: 'espacio', titulo: 'Espacio', desc: '¿Dónde van?' },
  { n: 3, clave: 'propuesta', titulo: 'Propuesta', desc: 'Lista para el cliente.' },
];

function Pasos({ paso, setPaso, puedeAvanzar }) {
  return (
    <div className="voni-pasos no-imprimir">
      {PASOS.map((p, i) => {
        const estado = p.n === paso ? 'activo' : p.n < paso ? 'hecho' : 'pend';
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
              {p.n < paso
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
  const setCant = (i, cant) => setCot({ partidas: partidas.map((p, j) => (j === i ? { ...p, cantidad: Math.max(1, cant) } : p)) });
  const quitar = (i) => setCot({ partidas: partidas.filter((_, j) => j !== i) });
  const [confVaciar, setConfVaciar] = useState(false);
  const [editando, setEditando] = useState(null);   // índice de la partida que se edita
  const vaciar = () => { setCot({ partidas: [], acomodo: null }); setConfVaciar(false); };

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

      <Pasos paso={paso} setPaso={setPaso} puedeAvanzar={hay} />

      {/* ---------------- PASO 1 · MUEBLES ---------------- */}
      {paso === 1 && (
        <>
          {!hay && (
            <div className="voni-saludo">
              <VoniAvatar tam={64} variante="cara" anim="bob" />
              <p className="voni-globo">¡Hola! Soy <b>Voni</b>. Cuéntame qué necesita tu cliente —en palabras normales— y te armo el proyecto: muebles, acomodo y propuesta.</p>
            </div>
          )}
          <CotizadorIA estado={estado} onAgregarItems={agregarEnProyecto} onIr={onIr} />

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
                {partidas.map((pt, i) => {
                  const s = selloPartida(pt);
                  return (
                    <div className="voni-fila" key={pt.id}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="voni-fila-t">{pt.nombre}</div>
                        {/* Sello y confianza en su propia fila: dentro del
                            nombre se encimaban al saltar de renglón. */}
                        <div className="ia-meta">
                          <span className={`sello sello-${s.tipo}`} title={s.nota}>{s.texto}</span>
                          {pt.confianza && pt.confianza !== 'alta' && <span className={`ia-badge ${pt.confianza}`}>confianza {pt.confianza}</span>}
                        </div>
                        {pt.nota && <div className="ia-nota">{pt.nota}</div>}
                        {/* AJUSTES: lo que la app tuvo que cambiar de lo que
                            pidió Voni. Va en rojo y por renglón porque antes se
                            hacía callado: pedías 8 puestos y te cotizaba 2. */}
                        {(pt.avisos || []).map((a, k) => (
                          <div className="ia-aviso" key={k}>⚠ {a}</div>
                        ))}
                      </div>
                      <span className="masmenos" title="Cantidad">
                        <button onClick={() => setCant(i, pt.cantidad - 1)}>−</button>
                        <span className="valor">{pt.cantidad}</span>
                        <button onClick={() => setCant(i, pt.cantidad + 1)}>+</button>
                      </span>
                      <div className="voni-fila-precio mono">{pesos(pt.precioUnitario * pt.cantidad)}</div>
                      {sePuedeEditar(pt) && (
                        <button className="icono-btn" title="Editar medidas, acabado y cantidad" aria-label={`Editar ${pt.nombre}`} onClick={() => setEditando(i)}>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        </button>
                      )}
                      <button className="boton fantasma" style={{ minHeight: 38, padding: '0 10px' }} onClick={() => quitar(i)}>Quitar</button>
                    </div>
                  );
                })}
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
              <button className="boton primario grande" style={{ width: '100%' }} disabled={!hay} onClick={() => setPaso(2)}>
                Continuar al espacio →
              </button>
              <button className="boton grande" style={{ width: '100%' }} disabled={!hay} onClick={() => setPaso(3)} title="Sáltate el acomodo y ve directo a la propuesta">
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

      {/* ---------------- PASO 2 · ESPACIO ---------------- */}
      {paso === 2 && (
        <>
          <div className="tarjeta no-imprimir voni-omitir">
            <span className="ayuda">¿No tienes planos ni medidas del lugar?</span>
            <button className="boton fantasma" style={{ minHeight: 42 }} onClick={() => setPaso(3)}>Omitir el acomodo, ir a la propuesta →</button>
          </div>
          <Acomodo
            estado={estado}
            onGuardarAcomodo={onGuardarAcomodo}
            onIr={(r) => setPaso(r === 'cotizacion' ? 3 : 1)}
          />
        </>
      )}

      {/* ---------------- PASO 3 · PROPUESTA ---------------- */}
      {paso === 3 && (
        <Cotizacion
          estado={estado}
          setEstado={setEstado}
          soloVentas={soloVentas}
          onIr={(r) => setPaso(r === 'acomodo' ? 2 : 3)}
        />
      )}
    </div>
  );
}
