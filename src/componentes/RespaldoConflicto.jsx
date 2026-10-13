// ============================================================================
//  VH-148 · AVISO PERSISTENTE DEL RESPALDO DE CONFLICTO.
//  Tras "Ver la versión del servidor" quedan DOS versiones de la cotización: la del servidor (en
//  pantalla) y la tuya (respaldo en esta computadora, `costeador-vonhaucke-conflicto-<id>`). Este
//  aviso se queda mientras exista el respaldo de la cotización abierta (sobrevive recargas y
//  reaperturas en esta computadora) y enseña QUÉ difiere para decidir con datos:
//   · "Recuperar mis cambios": relee la versión ACTUAL del servidor, aplica tus campos encima
//     (fusión de tres vías por campo, ver conflictoGuardado.js) y guarda con la versión fresca.
//     Si eso reemplaza algo que la otra persona también cambió, pide confirmación.
//   · "Descartar mi respaldo": pide confirmación; sólo entonces se borra.
//  Nada se resuelve solo. Sólo existe con la bandera de control optimista prendida.
// ============================================================================
import { horaDe, textoMezcla } from '../datos/conflictoGuardado.js';

export default function RespaldoConflicto({ respaldo, filas = [], mezcla = null, ocupado = false, bloqueado = false, onRecuperar, onDescartar }) {
  if (!respaldo) return null;
  const hora = horaDe(respaldo.guardadoEn);
  const pendientes = Array.isArray(respaldo.anteriores) ? respaldo.anteriores.length : 0;
  const deshabilitado = ocupado || bloqueado;
  const estilo = {
    caja: { margin: '12px 16px 0', padding: '12px 14px', borderRadius: 10, border: '1px solid #6B7FA8', background: '#F1F4FA', color: '#2a2622', display: 'flex', flexDirection: 'column', gap: 8 },
    texto: { margin: 0, fontSize: 14, lineHeight: 1.4 },
    nota: { margin: 0, fontSize: 13, lineHeight: 1.4 },
    tabla: { borderCollapse: 'collapse', fontSize: 13, width: '100%', maxWidth: 640 },
    th: { textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #c9d0de', fontWeight: 600 },
    td: { padding: '4px 8px', borderBottom: '1px solid #e2e6ee', verticalAlign: 'top' },
    distinto: { background: '#FFF3C4' },
    botones: { display: 'flex', gap: 8, flexWrap: 'wrap' },
    btn: { padding: '8px 12px', borderRadius: 8, border: '1px solid #2a2622', background: '#fff', color: '#2a2622', cursor: deshabilitado ? 'not-allowed' : 'pointer', fontSize: 13 },
    btnPrimario: { padding: '8px 12px', borderRadius: 8, border: '1px solid #2a2622', background: '#2a2622', color: '#fff', cursor: deshabilitado ? 'not-allowed' : 'pointer', fontSize: 13 },
  };
  const frases = textoMezcla(mezcla);
  return (
    <section aria-label="Respaldo de tus cambios" data-testid="respaldo-conflicto" data-guardado={respaldo.guardadoEn || ''} className="no-imprimir" style={estilo.caja}>
      <p style={estilo.texto}>
        <strong>Tienes cambios respaldados{hora ? ` de las ${hora}` : ''}.</strong> En pantalla está la versión del servidor;
        la tuya sigue guardada en esta computadora hasta que decidas qué hacer con ella.
        {pendientes > 0 ? ` (Hay ${pendientes} respaldo${pendientes === 1 ? '' : 's'} anterior${pendientes === 1 ? '' : 'es'} de esta cotización; aparecerá${pendientes === 1 ? '' : 'n'} al resolver éste.)` : ''}
      </p>
      {filas.length > 0 && (
        <table style={estilo.tabla} data-testid="respaldo-diferencias">
          <thead>
            <tr><th style={estilo.th}>Campo</th><th style={estilo.th}>Tu respaldo</th><th style={estilo.th}>Versión del servidor</th></tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.campo} data-campo={f.campo} data-distinto={f.distinto ? '1' : '0'} style={f.distinto ? estilo.distinto : undefined}>
                <td style={estilo.td}>{f.etiqueta}</td>
                <td style={estilo.td}>{f.respaldo}</td>
                <td style={estilo.td}>{f.servidor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {frases.length > 0 && (
        <div data-testid="respaldo-plan">
          {frases.map((t) => <p key={t} style={estilo.nota}>{t}</p>)}
          <p style={{ ...estilo.nota, opacity: 0.8 }}>Al recuperar se vuelve a leer la versión más reciente del servidor y se guarda encima de ella (nunca a ciegas).</p>
        </div>
      )}
      {bloqueado && <p style={estilo.nota}>Primero resuelve el guardado detenido de arriba.</p>}
      <div style={estilo.botones}>
        <button type="button" disabled={deshabilitado} onClick={onRecuperar} style={estilo.btnPrimario} title="Aplica tus cambios encima de la versión actual del servidor y guarda">
          Recuperar mis cambios
        </button>
        <button type="button" disabled={deshabilitado} onClick={onDescartar} style={estilo.btn} title="Borra el respaldo de esta computadora (pide confirmación)">
          Descartar mi respaldo
        </button>
      </div>
    </section>
  );
}
