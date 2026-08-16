// ============================================================================
//  ICONOS — set de línea, trazo fino, monocromo (heredan color con currentColor).
//  Reemplazan a los emojis para que la app se vea de producto, no de plantilla.
//  Uso: <Icono nombre="escritorio" tam={28} />
// ============================================================================
const trazos = {
  // Cotizador
  escritorio: (
    <>
      <path d="M3 8h18" />
      <path d="M5 8v11M19 8v11" />
      <path d="M3 8l2-3h14l2 3" />
      <path d="M9 19v-4h6v4" />
    </>
  ),
  banco: (
    <>
      <path d="M4 6.5C4 5.7 4.7 5 6 5h5v13H6c-1.3 0-2-.7-2-1.5z" />
      <path d="M20 6.5C20 5.7 19.3 5 18 5h-5v13h5c1.3 0 2-.7 2-1.5z" />
      <path d="M11 5v13" />
    </>
  ),
  especial: (
    <>
      <path d="M12 3v18M3 12h18" />
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </>
  ),
  documento: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  // Costeador
  despiece: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <path d="M17 13.5v7M13.5 17h7" />
    </>
  ),
  acabado: (
    <>
      <path d="M12 3l7 4v10l-7 4-7-4V7z" />
      <path d="M12 3v18M5 7l7 4 7-4" />
    </>
  ),
  ejecutivo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 5l1.8 4.5L18 12l-4.2 2.5L12 19l-1.8-4.5L6 12l4.2-2.5z" />
    </>
  ),
  catalogo: (
    <>
      <rect x="3.5" y="4.5" width="7.5" height="15" rx="1" />
      <rect x="13" y="4.5" width="7.5" height="7" rx="1" />
      <path d="M13 15h7.5v4.5H13z" />
    </>
  ),
  precios: (
    <>
      <path d="M4 4h7l9 9-7 7-9-9z" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </>
  ),
  negocio: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 20v-6M12.5 20V9M17 20v-9" />
    </>
  ),
  candado: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <circle cx="12" cy="15.5" r="1.2" />
    </>
  ),
  candadoAbierto: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 7.6-1.8" />
      <circle cx="12" cy="15.5" r="1.2" />
    </>
  ),
  lupa: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.7-4.7" />
    </>
  ),
  rayo: (
    <path d="M13 3L5 13h5l-1 8 8-11h-5z" />
  ),
  check: (
    <path d="M4.5 12.5l5 5 10-11" />
  ),
};

export default function Icono({ nombre, tam = 26, grosor = 1.6, className = '' }) {
  const d = trazos[nombre];
  if (!d) return null;
  return (
    <svg
      className={className}
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d}
    </svg>
  );
}
