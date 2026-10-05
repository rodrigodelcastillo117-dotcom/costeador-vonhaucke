import { useEffect, useRef, useState } from 'react';
import { pesos } from '../util.js';

// Monto de dinero que "cuenta" hasta su valor (deleite premium al cambiar cantidades
// o descuento). Formatea con pesos() en cada cuadro. Respeta prefers-reduced-motion:
// si está activo, muestra el valor final sin animar. Si el valor no es finito, cae a
// pesos() tal cual (no inventa un número bonito).
export default function MontoAnimado({ valor, ms = 650 }) {
  const destino = Number(valor);
  const [mostrado, setMostrado] = useState(Number.isFinite(destino) ? destino : 0);
  const desdeRef = useRef(Number.isFinite(destino) ? destino : 0);

  useEffect(() => {
    if (!Number.isFinite(destino)) return;
    const desde = Number(desdeRef.current) || 0;
    desdeRef.current = destino;
    if (destino === desde) { setMostrado(destino); return; }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce) { setMostrado(destino); return; }
    let raf, t0;
    const paso = (t) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setMostrado(desde + (destino - desde) * e);
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [destino, ms]);

  if (!Number.isFinite(destino)) return <>{pesos(valor)}</>;
  return <>{pesos(Math.round(mostrado))}</>;
}
