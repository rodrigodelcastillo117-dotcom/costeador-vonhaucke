// Auto-test del SCORER (no del modelo). Verifica que el medidor mide bien:
// extracción perfecta ⇒ recall 1; vacía ⇒ 0; rol ajeno ⇒ inventado; conteo/material se marcan.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rolDe, puntuar, rolesDeVerdad } from './scorer.mjs';

const VERDAD = JSON.parse(readFileSync(new URL('./telsvh120_verdad.json', import.meta.url), 'utf8'));

describe('rolDe: vocabulario canónico', () => {
  it('mapea descripciones reales del HDM a su rol', () => {
    expect(rolDe('REFUERZO TAPA DE 1175 X 90 X 17 mm')).toBe('refuerzo_tapa');
    expect(rolDe('OMEGA NIVELADORA DE 464 X 86 X 25 mm')).toBe('omega_niveladora');
    expect(rolDe('OMEGA DE 539 X 42 X 11 mm')).toBe('omega');
    expect(rolDe('TAPA DE 1197 X 596 X 35 mm')).toBe('tapa');
    expect(rolDe('LATERAL IZQUIERDO DE 600 X 827 X 70 mm')).toBe('lateral');
    expect(rolDe('CAJA DE LUZ TERMOFORMADA DE 1110 X 500')).toBe('caja_luz');
    expect(rolDe('PIJA CABEZA PLANA PHILLIPS 1 1/4"')).toBe('pija');
    expect(rolDe('TUERCA HEXAGONAL 3/8 GALVANIZADO')).toBe('tuerca');
    expect(rolDe('un cajón con ruedas')).toBe('otro'); // no reconocido
  });
});

describe('puntuar contra la verdad real de TELSVH120', () => {
  it('la verdad-base tiene la masa esperada (fabricadas + herrajes)', () => {
    expect(VERDAD.conteos.total).toBe(70);
    const V = rolesDeVerdad(VERDAD);
    // >= 15 roles distintos reconocidos (sin contar "otro")
    expect([...V.keys()].filter((r) => r !== 'otro').length).toBeGreaterThanOrEqual(15);
  });

  it('extracción PERFECTA (las descripciones reales del HDM) ⇒ recall 1.0, 0 omitidos', () => {
    const perfecta = (VERDAD.piezas || [])
      .filter((p) => p.tipo !== 'proceso')
      .map((p) => ({ nombre: p.descripcion, cantidad: Number(p.piezas_x_mueble) || 1 }));
    const r = puntuar(VERDAD, perfecta);
    expect(r.recall_roles).toBe(1);
    expect(r.roles_omitidos).toEqual([]);
  });

  it('extracción VACÍA ⇒ recall 0, todos los roles omitidos', () => {
    const r = puntuar(VERDAD, []);
    expect(r.recall_roles).toBe(0);
    expect(r.roles_detectados).toBe(0);
    expect(r.roles_omitidos.length).toBe(r.total_roles_verdad);
  });

  it('rol conocido pero AUSENTE de este HDM ⇒ inventado; rol presente ⇒ no inventado', () => {
    const V = rolesDeVerdad(VERDAD);
    // 'cristal' casi seguro no es renglón del HDM metálico; si así es, debe marcarse inventado.
    const r = puntuar(VERDAD, [{ nombre: 'capelo de cristal templado', cantidad: 1 }, { nombre: 'tapa superior', cantidad: 1 }]);
    if (!V.has('cristal')) expect(r.roles_inventados).toContain('cristal');
    // 'tapa' sí está en el HDM ⇒ nunca inventado
    expect(r.roles_inventados).not.toContain('tapa');
  });

  it('conteo y material se evalúan por rol', () => {
    const V = rolesDeVerdad(VERDAD);
    const tapaCount = V.get('tapa')?.count ?? 1;
    const r = puntuar(VERDAD, [{ nombre: 'tapa', cantidad: tapaCount, material: 'lámina calibre 18' }]);
    const d = r.detalle.find((x) => x.rol === 'tapa');
    expect(d.detectado).toBe(true);
    expect(d.conteo_ok).toBe(true);
  });
});
