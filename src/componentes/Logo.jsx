// Logotipo Von Haucke dibujado en SVG (master 3.2), no imagen.
export default function Logo({ alto = 40, color = '#D02E26' }) {
  return (
    <svg width={alto} height={alto} viewBox="0 0 100 100" aria-label="Von Haucke">
      <rect width="100" height="100" rx="6" fill={color} />
      <polygon points="16,52 33,42 43,62 76,20 88,29 45,84" fill="#fff" />
    </svg>
  );
}
