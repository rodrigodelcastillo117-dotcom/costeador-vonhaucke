// ============================================================================
//  VH-148 · AVISO DE CONFLICTO DE GUARDADO.
//  Otra persona (u otra pestaña) guardó esta cotización después de que la abrimos y el servidor
//  rechazó nuestro guardado (SQLSTATE 40001). Aquí NO se decide nada solo: se enseña qué pasó, se
//  deja claro que lo local sigue en esta computadora y se ofrecen DOS salidas explícitas:
//   · "Ver la versión del servidor": respalda lo local en localStorage y carga la fila del servidor;
//     después RespaldoConflicto.jsx enseña las dos versiones y ofrece recuperar / descartar.
//   · "Volver a aplicar mis cambios": re-guarda lo local COMPLETO con la versión fresca del servidor
//     (un clic; el aviso dice que reemplaza lo de la otra persona).
//  Mientras el aviso esté visible, el autosave está en pausa (lo decide App.jsx).
// ============================================================================
import { mensajeConflicto } from '../datos/conflictoGuardado.js';

export default function ConflictoGuardado({ conflicto, ocupado = false, onVerServidor, onReaplicar }) {
  if (!conflicto) return null;
  const estilo = {
    caja: { margin: '12px 16px 0', padding: '12px 14px', borderRadius: 10, border: '1px solid #B8912F', background: '#FFF8E6', color: '#2a2622', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    texto: { flex: '1 1 320px', margin: 0, fontSize: 14, lineHeight: 1.4 },
    botones: { display: 'flex', gap: 8, flexWrap: 'wrap' },
    btn: { padding: '8px 12px', borderRadius: 8, border: '1px solid #2a2622', background: '#fff', color: '#2a2622', cursor: ocupado ? 'wait' : 'pointer', fontSize: 13 },
    btnPrimario: { padding: '8px 12px', borderRadius: 8, border: '1px solid #2a2622', background: '#2a2622', color: '#fff', cursor: ocupado ? 'wait' : 'pointer', fontSize: 13 },
  };
  return (
    <div role="alert" aria-live="assertive" data-testid="conflicto-guardado" data-actualizado={conflicto.actualizadoServidor || ''} className="no-imprimir" style={estilo.caja}>
      <p style={estilo.texto}>
        <strong>Guardado detenido.</strong> {mensajeConflicto(conflicto)}
      </p>
      {/* VH-148: qué hace cada salida, dicho antes de pulsar. "Volver a aplicar" es de DOCUMENTO COMPLETO. */}
      <p style={{ ...estilo.texto, flexBasis: '100%', fontSize: 13 }} data-testid="conflicto-explicacion">
        «Ver la versión del servidor» guarda tu versión aparte en esta computadora (podrás compararla y recuperarla campo por campo).
        «Volver a aplicar mis cambios» guarda tu versión COMPLETA y reemplaza lo que la otra persona cambió.
      </p>
      <div style={estilo.botones}>
        <button type="button" disabled={ocupado} onClick={onVerServidor} style={estilo.btn} title="Guarda una copia local de lo tuyo y carga lo que está en el servidor">
          Ver la versión del servidor
        </button>
        <button type="button" disabled={ocupado} onClick={onReaplicar} style={estilo.btnPrimario} title="Vuelve a guardar lo que tienes aquí encima de la versión del servidor">
          Volver a aplicar mis cambios
        </button>
      </div>
    </div>
  );
}
