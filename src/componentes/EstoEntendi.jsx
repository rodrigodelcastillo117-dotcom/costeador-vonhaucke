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
import { flagActivo } from '../datos/flags.js';
import { procedenciaDePartida, resumenProcedencia } from '../datos/provenance.js';
import { resumenObservado } from '../datos/observedProgram.js';

// Color del pill de procedencia por tono (sin depender de CSS nuevo).
const TONO_COLOR = {
  ok: { bg: '#e6f4ea', fg: '#1e6b33' },
  info: { bg: '#e8eef7', fg: '#274b7a' },
  ambar: { bg: '#fdf7e6', fg: '#8a5a00' },
  roja: { bg: '#fbe6e4', fg: '#9a2820' },
};
function PillProcedencia({ pt }) {
  const pr = procedenciaDePartida(pt);
  const c = TONO_COLOR[pr.tono] || TONO_COLOR.info;
  return (
    <span className="ia-badge" title={pr.motivo}
      style={{ background: c.bg, color: c.fg, borderColor: 'transparent' }}>
      {pr.etiqueta}
    </span>
  );
}

// La descripción del catálogo es larga y termina en la clave ("... -- ECCR82DCH").
// Para el vendedor basta lo que distingue una variante de otra (ecopiel,
// papelero…), sin el ruido de MODELO/medidas repetidas.
const cortito = (d) => {
  const s = String(d || '').split('--')[0].replace(/\s+/g, ' ').trim();
  return s.length > 68 ? s.slice(0, 68) + '…' : s;
};

export default function EstoEntendi({
  partidas = [], areasM = [], observedProgram = [], onCantidad, onQuitar, onEditar, onVariante,
}) {
  const r = loQueEntendi(partidas, areasM);
  const porId = Object.fromEntries(partidas.map((p) => [p.id, p]));
  const voni2 = flagActivo('voni_v2');
  const proc = voni2 ? resumenProcedencia(partidas) : null;
  // ChatGPT P0-1: si el lector CONSERVÓ un observed_program (la verdad del plano),
  // se muestra qué vino OBSERVADO del plano vs qué falta CONFIRMAR — en vez de
  // tratar todo como inferido desde áreas. Capa aditiva sobre la lista existente.
  const obs = Array.isArray(observedProgram) && observedProgram.length ? resumenObservado(observedProgram) : null;

  return (
    <>
      <div className="ee-cab">
        <h3 style={{ margin: 0 }}>Esto entendí</h3>
        {r.titular && <div className="ee-titular">{r.titular}</div>}
        {obs && (obs.cantidadObservada > 0 || obs.hayPendientesDeConfirmar) && (
          <div className="ayuda" style={{ marginTop: 4 }} title="Del plano: lo OBSERVADO se detectó; lo sugerido/inferido hay que confirmarlo (no se asume real).">
            Del plano detecté <strong>{obs.cantidadObservada}</strong> mueble(s) observado(s)
            {obs.cuartosObservados ? ` y ${obs.cuartosObservados} cuarto(s)` : ''}
            {obs.hayPendientesDeConfirmar ? ' · hay elementos por confirmar' : ''}.
          </div>
        )}
      </div>
      <p className="ayuda columna-texto" style={{ marginTop: 2 }}>
        Revísalo aquí, que es donde se corrige de un toque. Lo que apruebes es lo que voy a acomodar.
      </p>

      {/* Voni 2.0: de dónde salió cada cosa (procedencia). Resumen arriba. */}
      {voni2 && proc && proc.total > 0 && (
        <div className="ee-procedencia" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '6px 0 2px' }}>
          {proc.conteo.CONFIRMADO > 0 && <span className="ia-badge" style={{ background: TONO_COLOR.ok.bg, color: TONO_COLOR.ok.fg, borderColor: 'transparent' }}>{proc.conteo.CONFIRMADO} confirmado{proc.conteo.CONFIRMADO === 1 ? '' : 's'}</span>}
          {proc.conteo.INFERIDO > 0 && <span className="ia-badge" style={{ background: TONO_COLOR.info.bg, color: TONO_COLOR.info.fg, borderColor: 'transparent' }}>{proc.conteo.INFERIDO} inferido{proc.conteo.INFERIDO === 1 ? '' : 's'}</span>}
          {proc.conteo.SUPUESTO > 0 && <span className="ia-badge" style={{ background: TONO_COLOR.ambar.bg, color: TONO_COLOR.ambar.fg, borderColor: 'transparent' }}>{proc.conteo.SUPUESTO} supuesto{proc.conteo.SUPUESTO === 1 ? '' : 's'}</span>}
          {proc.conteo.SUGERIDO > 0 && <span className="ia-badge" style={{ background: TONO_COLOR.info.bg, color: TONO_COLOR.info.fg, borderColor: 'transparent' }}>{proc.conteo.SUGERIDO} sugerido{proc.conteo.SUGERIDO === 1 ? '' : 's'}</span>}
          {proc.conteo.REQUIERE_DESARROLLO > 0 && <span className="ia-badge" style={{ background: TONO_COLOR.roja.bg, color: TONO_COLOR.roja.fg, borderColor: 'transparent' }}>{proc.conteo.REQUIERE_DESARROLLO} requiere{proc.conteo.REQUIERE_DESARROLLO === 1 ? '' : 'n'} desarrollo</span>}
        </div>
      )}

      {/* Lo que no cuadra va ARRIBA. Abajo de veinte renglones no lo lee nadie. */}
      {r.avisos.map((a, k) => (
        <div className={`alerta ${a.tono}`} key={k} style={{ marginTop: 8 }}>
          <span className="texto">{a.texto}</span>
        </div>
      ))}

      {r.grupos.map((g) => (
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
                    {voni2 && <PillProcedencia pt={pt} />}
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
