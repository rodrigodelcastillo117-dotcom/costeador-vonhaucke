import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('VONI Council · latency budget', () => {
  it('has an exact 20s global deadline without weakening deterministic validation', () => {
    const s = fs.readFileSync('supabase/functions/voni-council/index.ts', 'utf8');
    expect(s).toContain('const councilBudget=20000');
    expect(s).toContain('Promise.race');
    expect(s).toContain('deadline_hit');
    expect(s).toContain("deterministic_validation_required:true");
    expect(s).toContain("status:'SINGLE_PROVIDER'");
    expect(s).toContain("status:'NO_PROVIDER'");
  });
});

// Auditoría 2026-10-19 (voni_council_events, 24 h): Claude NUNCA respondía dentro del presupuesto (14–22 s: "The signal
// has been aborted" en 100 % de sus llamadas) y cuando Gemini también se pasaba, la persona veía un 502 técnico.
describe('VONI Council · Claude dentro del presupuesto y error legible', () => {
  it('la llamada a Claude pide esfuerzo bajo (revisión estructurada, no razonamiento largo)', () => {
    const s = fs.readFileSync('supabase/functions/voni-council/index.ts', 'utf8');
    expect(s).toMatch(/api\.anthropic\.com[\s\S]*output_config:\{effort:'low',format:\{type:'json_schema'/);
  });
  it('un 502 (ninguna IA a tiempo) se dice en palabras de la persona, sin texto de librería', () => {
    const s = fs.readFileSync('src/nube.js', 'utf8');
    const f = s.slice(s.indexOf('export async function voniCouncil'), s.indexOf('export async function voniCouncil') + 1200);
    expect(f).toMatch(/status === 502/);
    expect(f).toMatch(/VONI no alcanzó a responder a tiempo/);
    expect(f).not.toMatch(/error: error\.message \|\| String\(error\)/);
  });
});
