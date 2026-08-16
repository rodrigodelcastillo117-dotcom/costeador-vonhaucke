// ============================================================================
//  VONI · el personaje (avatar oficial de Von Haucke).
//  Imagen recortada con fondo transparente, servida desde Storage.
//   variante 'cara' = retrato cuadrado (encabezado, loader, mensajes)
//   variante 'full' = cuerpo completo flotando con su tablero (hero)
//   anim 'bob' = flota suave (para el loader / hero)
// ============================================================================
const BASE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/marca';
export const VONI_CARA_URL = `${BASE}/voni-cara.png`;
export const VONI_FULL_URL = `${BASE}/voni-full.png`;

export default function VoniAvatar({ tam = 40, variante = 'cara', anim = 'none', className = '' }) {
  const full = variante === 'full';
  const url = full ? VONI_FULL_URL : VONI_CARA_URL;
  // 'full' conserva su proporción vertical; 'cara' es cuadrado.
  const estilo = full
    ? { height: tam, width: 'auto', display: 'block' }
    : { width: tam, height: tam, display: 'block', objectFit: 'contain' };
  return (
    <img
      src={url}
      alt="Voni"
      className={`voni-avatar ${anim === 'bob' ? 'voni-bob' : ''} ${className}`}
      style={estilo}
      draggable="false"
    />
  );
}
