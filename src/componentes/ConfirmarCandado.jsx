// ============================================================================
//  CONFIRMAR CANDADO — el candado de "cantidad = total de gente" (el bug real
//  del sobrecobro de 12×) y el techo de cordura de usuarios (>14 puestos, sin
//  dato real de fábrica) dejaron de ser sólo un aviso que se puede ignorar:
//  ahora exigen que el vendedor los reconozca ANTES de avanzar/imprimir.
//  Decisión de Rodrigo (2026-08-20): "advertencia + confirmación explícita".
//
//  Mismo patrón visual que el confirm de borrar en Usuarios.jsx (clases
//  `velo`/`dialogo`/`acciones`), con una diferencia a propósito: clic en el
//  fondo CANCELA, nunca cuenta como un "sí" implícito — esto es justo lo
//  contrario de algo que se quiera poder saltar sin querer.
// ============================================================================
export default function ConfirmarCandado({ partidas = [], onConfirmar, onCancelar }) {
  const problemas = partidas.filter((p) => p.candadoUsuarios || p.requiereProyectista);
  if (!problemas.length) return null;

  return (
    <div className="velo" onClick={onCancelar}>
      <div className="dialogo" onClick={(e) => e.stopPropagation()}>
        <h3>Antes de seguir, revisa esto</h3>
        <p className="ayuda">
          {problemas.length === 1
            ? 'Un renglón de esta cotización trae una cantidad o un número de usuarios que puede estar mal.'
            : `${problemas.length} renglones de esta cotización traen una cantidad o un número de usuarios que puede estar mal.`}
        </p>
        <div style={{ display: 'grid', gap: 10, margin: '14px 0', maxHeight: '40vh', overflowY: 'auto' }}>
          {problemas.map((p) => (
            <div key={p.id} className="alerta roja" style={{ display: 'block' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.nombre}</div>
              {(p.avisos || [])
                .filter((a) => /bancas SEPARADAS|proyectista/.test(a))
                .map((a, i) => <div className="texto" key={i}>{a}</div>)}
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
