// Logotipo horizontal COMPLETO de Von Haucke (cuadro + wordmark + sello 68 años).
// Imagen oficial subida por Dirección (bucket público 'app', marca/logo.png).
export const MARCA_LOGO_URL =
  'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/marca/logo.png';

export default function MarcaLogo({ alto = 40, className = '' }) {
  return (
    <img
      src={MARCA_LOGO_URL}
      alt="Von Haucke"
      className={`marca-logo ${className}`.trim()}
      style={{ height: alto, width: 'auto', display: 'block' }}
    />
  );
}
