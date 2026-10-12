// ============================================================================
//  UX por pasos (12-oct). Dos piezas pequeñas y compartidas:
//   · SeccionPaso: una tarjeta numerada con título, estado (pend / activo / hecho) y nota.
//   · CabPaso:     sólo la cabecera numerada, para tarjetas que ya existen con su propia clase.
//  Nada se esconde: la sección "pendiente" se ve atenuada pero completa y usable.
// ============================================================================
export function CabPaso({ n, titulo, estado = 'pend', nota = '' }) {
  const icono = estado === 'hecho' ? '✓' : String(n);
  return (
    <div className={`acomodo-seccion-cab paso-cab-${estado}`}>
      <span className="acomodo-seccion-num" aria-hidden="true">{icono}</span>
      <h2 style={{ margin: 0 }}>{titulo}</h2>
      {nota ? <span className="ayuda acomodo-seccion-nota">{nota}</span> : null}
    </div>
  );
}

export default function SeccionPaso({ n, titulo, estado = 'pend', nota = '', oculto = false, testid, className = '', children }) {
  return (
    <section className={`tarjeta no-imprimir acomodo-seccion acomodo-seccion-${estado} ${className}`.trim()} data-testid={testid} data-estado={estado} style={oculto ? { display: 'none' } : undefined}>
      <CabPaso n={n} titulo={titulo} estado={estado} nota={nota} />
      {children}
    </section>
  );
}
