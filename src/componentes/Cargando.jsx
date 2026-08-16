// Loader de marca: el logo Von Haucke girando + mensajes que rotan.
// Se usa mientras la IA analiza un render (o cualquier espera larga).
import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import VoniAvatar from './VoniAvatar.jsx';

const MENSAJES = [
  'Leyendo el render…',
  'Identificando piezas y materiales…',
  'Estimando medidas…',
  'Revisando fallas probables…',
  'Buscando el mejor aprovechamiento…',
  'Armando el despiece…',
];

export default function Cargando({ titulo = 'Analizando con IA', mensajes = MENSAJES, voni = false }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % mensajes.length), 1800);
    return () => clearInterval(t);
  }, [mensajes.length]);
  return (
    <div className="cargando">
      <div className="cargando-logo">
        <span className="cargando-halo" />
        {voni ? <VoniAvatar tam={84} variante="cara" anim="bob" /> : <Logo alto={56} />}
      </div>
      <div className="cargando-titulo">{titulo}</div>
      <div className="cargando-msg">{mensajes[i]}</div>
      <div className="cargando-barra"><span /></div>
    </div>
  );
}
