import { describe, it, expect } from 'vitest';
import { resolverJuntas } from './resolverPrograma.js';
import { BANCO } from './banco.js';

// Dirección (2026-10-20): "son dos productos distintos … 8 personas y con caja eléctrica mejor".
// Sala de 7–8 → mesa App 3.00 × 1.20 de 8 personas con 2 cajas eléctricas ($12,540), no la 2.40 sin caja.
const id = (r) => r?.bancoId;

describe('sala de juntas de 8: mesa App de 8 personas con caja eléctrica', () => {
  it('el banco la tiene igual que la de la propuesta 2610022', () => {
    const a = BANCO.find((b) => b.id === 'mj-3000x1200-8p');
    const p9 = BANCO.find((b) => b.id === 'p9-app-mesa-de-juntas-12540');
    expect(a).toMatchObject({ usuarios: 8, precio: 12540, medidas: '3000 × 1200 mm', preferente: true });
    expect(a.precio).toBe(p9.precio);
  });
  it('8 y 7 personas → mj-3000x1200-8p', () => {
    expect(id(resolverJuntas(8))).toBe('mj-3000x1200-8p');
    expect(id(resolverJuntas(7))).toBe('mj-3000x1200-8p');
  });
  it('5–6 personas → sigue la 2.40 (la de 3.00 m es grande para ellos)', () => {
    expect(id(resolverJuntas(6))).toBe('mj-2400x1200');
    expect(id(resolverJuntas(5))).toBe('mj-2400x1200');
  });
  it('9–10 → la de 10 personas (HDMI, $18,560); nunca la de 8', () => {
    expect(id(resolverJuntas(10))).toBe('mj-3000x1200');
    expect(id(resolverJuntas(9))).toBe('mj-3000x1200');
  });
  it('sala chica donde la de 3.00 m no cabe → la 2.40', () => {
    // 4.0 × 3.6 m: 3000 + 1200 > 4000 → no cabe la de 3.00; 2400 + 1200 ≤ 4000 y 1200 + 2400 ≤ 3600 → sí la 2.40.
    expect(id(resolverJuntas(8, { zona_dims: { anchoM: 4.0, largoM: 3.6 } }))).toBe('mj-2400x1200');
    expect(id(resolverJuntas(8, { zona_dims: { anchoM: 6.0, largoM: 4.0 } }))).toBe('mj-3000x1200-8p');
  });
  it('medida pedida 2.40 × 1.20 se respeta; 3.00 × 1.20 para 8 → la de 8', () => {
    expect(id(resolverJuntas(8, { requested_dimensions: { w: 2400, d: 1200 } }))).toBe('mj-2400x1200');
    expect(id(resolverJuntas(8, { requested_dimensions: { w: 3000, d: 1200 } }))).toBe('mj-3000x1200-8p');
    expect(id(resolverJuntas(10, { requested_dimensions: { w: 3000, d: 1200 } }))).toBe('mj-3000x1200');
  });
});
