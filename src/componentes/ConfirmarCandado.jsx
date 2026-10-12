// ============================================================================
//  CONFIRMAR CANDADO — protege contra cantidad=personas, pero no obliga a
//  confirmar DOS veces una banca cuya multiplicación ya quedó aclarada por el
//  usuario/Voni (ej. 3 bancas × 8 usuarios = 24 puestos).
// ============================================================================
import { useEffect, useMemo, useRef } from 'react';

const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function usuariosPorUnidad(p) {
  const directos = [p?.usuarios, p?.usuariosPorUnidad, p?.config?.usuarios, p?.config?.puestos, p?.capacidad]
    .map(Number).find((n) => Number.isFinite(n) && n > 0);
  if (directos) return Math.round(directos);
  const m = /(\d+)\s*(?:usuarios?|puestos?|pax)\b/.exec(norm(p?.nombre));
  return m ? Number(m[1]) : 0;
}

function textoAclaracion(p) {
  // NO usamos `avisos`: ésos los fabrica el propio candado y no demuestran que
  // el usuario entendió. Sólo campos explicativos que vienen de la corrida Voni.
  return norm([
    p?.nota, p?.notas, p?.justificacion, p?.razon, p?.explicacion,
    p?.detalle, p?.evidencia, p?.origenTexto,
  ].filter(Boolean).join(' '));
}

/**
 * True sólo cuando la ambigüedad cantidad/personas ya quedó explícitamente
 * resuelta. Un `requiereProyectista` nunca se considera resuelto aquí.
 */
export function candadoCantidadYaAclarado(p) {
  if (!p?.candadoUsuarios || p?.requiereProyectista) return false;
  const q = Math.round(Number(p?.cantidad) || 0);
  const u = usuariosPorUnidad(p);
  if (!(q > 0 && u > 0)) return false;

  const t = textoAclaracion(p);
  if (!t) return false;
  const total = q * u;

  const mencionaUnidades = new RegExp(`\\b${q}\\s*(?:bancas?|benches?|unidades?|piezas?)\\b`).test(t)
    || new RegExp(`\\b${q}\\s*[x×]\\s*${u}\\b`).test(t);
  const mencionaCapacidad = new RegExp(`\\b${u}\\s*(?:usuarios?|puestos?|lugares?|pax)\\b`).test(t)
    || new RegExp(`\\b${q}\\s*[x×]\\s*${u}\\b`).test(t);
  const mencionaTotal = new RegExp(`\\b${total}\\s*(?:usuarios?|puestos?|lugares?|pax)\\b`).test(t)
    || new RegExp(`\\b${q}\\s*[x×]\\s*${u}\\b`).test(t);

  return mencionaUnidades && mencionaCapacidad && mencionaTotal;
}

export function problemasCandado(partidas = []) {
  return (Array.isArray(partidas) ? partidas : []).filter((p) => {
    if (p?.requiereProyectista) return true;                  // fail-closed duro
    if (!p?.candadoUsuarios) return false;
    return !candadoCantidadYaAclarado(p);                     // sólo ambigüedad real
  });
}

export default function ConfirmarCandado({ partidas = [], onConfirmar, onCancelar }) {
  const problemas = useMemo(() => problemasCandado(partidas), [partidas]);
  const habiaCandado = useMemo(
    () => (Array.isArray(partidas) ? partidas : []).some((p) => p?.candadoUsuarios || p?.requiereProyectista),
    [partidas],
  );
  const autoRef = useRef(false);

  // Voni ya resolvió explícitamente todos los candados blandos. La transición
  // había quedado detenida porque el componente devolvía null sin disparar el
  // callback. Se confirma UNA vez; los candados de proyectista jamás entran aquí.
  useEffect(() => {
    if (habiaCandado && problemas.length === 0 && !autoRef.current) {
      autoRef.current = true;
      onConfirmar?.();
    }
  }, [habiaCandado, problemas.length, onConfirmar]);

  if (!problemas.length) return null;

  return (
    <div className="velo" onClick={onCancelar}>
      <div className="dialogo" onClick={(e) => e.stopPropagation()}>
        <h3>Antes de seguir, revisa esto</h3>
        <p className="ayuda">
          {problemas.length === 1
            ? 'Un renglón de esta cotización todavía trae una cantidad o un número de usuarios ambiguo.'
            : `${problemas.length} renglones todavía traen una cantidad o un número de usuarios ambiguo.`}
        </p>
        <div style={{ display: 'grid', gap: 10, margin: '14px 0', maxHeight: '40vh', overflowY: 'auto' }}>
          {problemas.map((p) => (
            <div key={p.id} className="alerta roja" style={{ display: 'block' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.nombre}</div>
              {(p.avisos || []).map((a, i) => <div className="texto" key={i}>{a}</div>)}
            </div>
          ))}
        </div>
        <div className="acciones">
          <button className="boton primario" onClick={onConfirmar}>Sí, así lo quiero cotizar</button>
          <button className="boton fantasma" onClick={onCancelar}>Cancelar, voy a revisar</button>
        </div>
      </div>
    </div>
  );
}
