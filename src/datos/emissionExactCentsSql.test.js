import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('DB emission · exactitud monetaria a centavos', () => {
  it('el gate y la emisión no redondean precios al peso ni toleran ±$1', () => {
    const s = fs.readFileSync('docs/sql/emission_exact_cents_v3.sql', 'utf8');
    expect(s).toContain("round(v_price,2)<>v_expected_price");
    expect(s).toContain("round((pt->>'precioUnitario')::numeric,2)");
    expect(s).toContain("round(v_pl_auth * (1 - v_desc/100),2)");
    expect(s).toContain("sum(round((x->>'precioUnitario')::numeric*(x->>'cantidad')::numeric,2))");
    expect(s).toContain("round(l_pl,2) <> round(v_pl_exact,2)");
    expect(s).not.toContain("abs(l_pl - round(v_pl_exact)) > 1");
  });
});
