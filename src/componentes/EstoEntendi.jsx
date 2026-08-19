// ============================================================================
//  "ESTO ENTENDÍ"  ·  la lista corregible ANTES de acomodar
//
//  Rodrigo (2026-08-17) lo pidió con esas palabras. Es el momento en que Voni
//  para y dice, en español, qué leyó: "324 m² · 2 privados · 21 puestos de
//  trabajo · 14 sillas · 6 gavetas" — y señala lo que no cuadra (21 puestos y
//  14 sillas: faltan 7) CUANDO todavía se corrige de un toque, no después de
//  acomodar, ni delante del cliente.
//
//  ⚠️ NO ES UNA SEGUNDA LISTA. Es LA lista de muebles, agrupada por lo que cada
//  cosa ES. El ± y el Quitar cambian la partida de verdad. En agosto de 2026 ya
//  se quitó una lista intermedia de "renglones propuestos" —los mismos muebles
//  en dos lados, cuatro botones— y esto no la trae de vuelta: la reemplaza.
// ============================================================================
import { loQueEntendi } from '../datos/entendido.js';
import { pesos, selloPartida } from '../util.js';
import { sePuedeEditar } from './EditarPartida.jsx';

// La descripción del catálogo es larga y termina en la clave ("... -- ECCR82DCH").
// Para el vendedor basta lo que distingue una variante de otra (ecopiel,
// papelero…), sin el ruido de MODELO/medidas repetidas.
const cortito = (d) => {
  const s = String(d || '').split('--')[0].replace(/\s+/g, ' ').trim();
  return s.length > 68 ? s.slice(0, 68) + '…' : s;
};

// `soloGrupo`: clave de UN grupo (Voni Cerebro, rediseño del Paso 2 — el
// wizard "1.1 Puestos, 1.2 Privados…" en Voni.jsx). Con esto puesto,
// EstoEntendi renderiza SOLO ese grupo y se calla el encabezado/titular/
// avisos (son cosas del proyecto completo, no de un grupo — el wizard las
// muestra aparte, en su propio paso final). Sin `soloGrupo` (el uso de
// siempre, la pantalla completa "Esto entendí"), nada cambia.
export default function EstoEntendi({
  partidas = [], areasM = [], onCantidad, onQuitar, onEditar, onVariante, soloGrupo = null,
}) {
  const r = loQueEntendi(partidas, areasM);
  const porId = Object.fromEntries(partidas.map((p) => [p.id, p]));
  const grupos = soloGrupo ? r.grupos.filter((g) => g.clave === soloGrupo) : r.grupos;

  return (
    <>
      {!soloGrupo && (
        <>
          <div className="ee-cab">
            <h3 style={{ margin: 0 }}>Esto entendí</h3>
            {r.titular && <div className="ee-titular">{r.titular}</div>}
          </div>
          <p className="ayuda columna-texto" style={{ marginTop: 2 }}>
            Revísalo aquí, que es donde se corrige de un toque. Lo que apruebes es lo que voy a acomodar.
          </p>

          {/* Lo que no cuadra va ARRIBA. Abajo de veinte renglones no lo lee nadie. */}
          {r.avisos.map((a, k) => (
            <div className={`alerta ${a.tono}`} key={k} style={{ marginTop: 8 }}>
              <span className="texto">{a.texto}</span>
            </div>
          ))}
        </>
      )}

      {grupos.map((g) => (
        <div className="ee-grupo" key={g.clave}>
          <div className="ee-grupo-cab">
            <span className="ee-grupo-t">{g.titulo}</span>
            {/* "1 mesas" se lee como error de la app, y una app que escribe mal
                no inspira confianza en los números que da. */}
            <span className="ee-grupo-n">{g.cuentaTotal} {g.cuentaTotal === 1 ? g.unidad.replace(/s$/, '') : g.unidad}</span>
          </div>
          {g.renglones.map((x) => {
            const pt = porId[x.id];
            if (!pt) return null;
            const s = selloPartida(pt);
            return (
              <div className="voni-fila" key={pt.id}>
                <div className="voni-fila-nom">
                  <div className="voni-fila-t">{pt.nombre}</div>
                  <div className="ia-meta">
                    <span className={`sello sello-${s.tipo}`} title={s.nota}>{s.texto}</span>
                    {pt.confianza && pt.confianza !== 'alta' && <span className={`ia-badge ${pt.confianza}`}>confianza {pt.confianza}</span>}
                    {/* Voni lo PROPUSO (silla, gaveta, mesa de la sala); no lo
                        pidió el cliente. Se marca para que el vendedor decida. */}
                    {pt.sugerido && <span className="ia-badge sugerido" title="Voni lo propuso como acompañante. Quítalo si no va.">sugerido</span>}
                  </div>
                  {pt.nota && <div className="ia-nota">{pt.nota}</div>}
                  {/* Los AJUSTES que la app tuvo que hacerle a lo que pidió Voni
                      (pediste 8 puestos y ese producto sólo tiene 6). En rojo y
                      por renglón: antes se hacían callado. */}
                  {(pt.avisos || []).map((a, k) => <div className="ia-aviso" key={k}>⚠ {a}</div>)}
                  {/* VARIAS TERMINACIONES en el catálogo a esta medida (ecopiel,
                      papelero…). Voni NO elige por el vendedor: le muestra las
                      opciones con su precio real y él toca la correcta. Decisión
                      de Rodrigo, 2026-08-18: "cero sorpresas". */}
                  {pt.variantes && pt.variantes.length > 1 && onVariante && (
                    <details className="ee-variantes">
                      <summary>{pt.variantes.length} variantes en catálogo · elige la terminación</summary>
                      <div className="ee-variantes-lista">
                        {pt.variantes.map((v) => (
                          <button type="button" key={v.clave}
                            className={`ee-variante${pt.catalogo?.clave === v.clave ? ' sel' : ''}`}
                            onClick={() => onVariante(pt.id, v)}>
                            <span className="ee-variante-d">{cortito(v.descripcion)}</span>
                            <span className="ee-variante-p mono">{pesos(v.lista)}</span>
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                <span className="masmenos" title="Cantidad">
                  <button onClick={() => onCantidad(pt.id, (pt.cantidad || 1) - 1)}>−</button>
                  <span className="valor">{pt.cantidad}</span>
                  <button onClick={() => onCantidad(pt.id, (pt.cantidad || 1) + 1)}>+</button>
                </span>
                <div className="voni-fila-precio mono">{pesos((pt.precioUnitario || 0) * pt.cantidad)}</div>
                {sePuedeEditar(pt) && onEditar && (
                  <button className="icono-btn" title="Editar medidas, acabado y cantidad" aria-label={`Editar ${pt.nombre}`} onClick={() => onEditar(pt.id)}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  </button>
                )}
                <button className="boton fantasma" style={{ minHeight: 38, padding: '0 10px' }} onClick={() => onQuitar(pt.id)}>Quitar</button>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
