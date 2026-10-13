// ============================================================================
//  VH-136 · Control para que la PERSONA confirme bisagra y sentido de una puerta pendiente.
//  Se usa en la compuerta de lectura (antes de usar el plano) y en el acomodo (proyectos ya
//  confirmados). No inventa nada: hasta que se pulse "Confirmar", la puerta sigue pendiente.
// ============================================================================
import { useState } from 'react';
import { describirPuerta } from '../datos/puertasConfirmar.js';

export default function PuertaConfirmar({ puerta, area, onConfirmar, compacto = false }) {
  const esAncha = Number(puerta?.ancho) >= 1.4;
  const [doble, setDoble] = useState(esAncha);
  const [bisagra, setBisagra] = useState('izquierda');
  const [abre, setAbre] = useState('adentro');
  const Opcion = ({ activa, onClick, children }) => (
    <button type="button" className={`boton ${activa ? 'primario' : 'fantasma'}`} style={{ minHeight: 36, padding: '0 10px' }} onClick={onClick}>{children}</button>
  );
  return (
    <div data-testid="puerta-confirmar" style={{ display: 'grid', gap: 6, padding: '8px 0', borderTop: compacto ? 'none' : '1px solid var(--linea)' }}>
      <div style={{ fontSize: 13 }}>
        <strong>{area?.nombre || 'Área'}</strong> · {describirPuerta(puerta, area)}
        {esAncha && <span className="ayuda" style={{ display: 'inline' }}> · vano ancho: suele ser doble</span>}
      </div>
      <div className="fila-botones" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="ayuda">Hojas:</span>
        <Opcion activa={!doble} onClick={() => setDoble(false)}>Una hoja</Opcion>
        <Opcion activa={doble} onClick={() => setDoble(true)}>Doble (dos hojas)</Opcion>
        {!doble && (<>
          <span className="ayuda" style={{ marginLeft: 6 }}>Bisagra (de pie adentro, frente a la puerta):</span>
          <Opcion activa={bisagra === 'izquierda'} onClick={() => setBisagra('izquierda')}>Izquierda</Opcion>
          <Opcion activa={bisagra === 'derecha'} onClick={() => setBisagra('derecha')}>Derecha</Opcion>
        </>)}
        <span className="ayuda" style={{ marginLeft: 6 }}>Abre:</span>
        <Opcion activa={abre === 'adentro'} onClick={() => setAbre('adentro')}>Hacia adentro del cuarto</Opcion>
        <Opcion activa={abre === 'afuera'} onClick={() => setAbre('afuera')}>Hacia afuera</Opcion>
        <button type="button" className="boton" style={{ minHeight: 36, marginLeft: 'auto' }} data-testid="puerta-confirmar-ok"
          onClick={() => onConfirmar({ doble, bisagra, abre })}>Confirmar esta puerta</button>
      </div>
    </div>
  );
}
