import { describe, it, expect } from 'vitest';
import {
  MATCH, MATCH_AUTOCOSTEABLE, familiaDeMaterial, clasificarMaterial, aplicarPoliticaMaterial,
} from './materialMatch.js';

describe('familiaDeMaterial — reconoce las familias de Von Haucke', () => {
  it('superficie sólida en todas sus formas', () => {
    expect(familiaDeMaterial('superficie sólida azul')).toBe('superficie_solida');
    expect(familiaDeMaterial('solid surface')).toBe('superficie_solida');
    expect(familiaDeMaterial('Corian blanco')).toBe('superficie_solida');
    expect(familiaDeMaterial('Krion')).toBe('superficie_solida');
  });
  it('distingue solid surface de MDF/melamina/laminado (las "parecidas")', () => {
    expect(familiaDeMaterial('MDF 19 mm')).toBe('mdf');
    expect(familiaDeMaterial('Melamina blanca 16')).toBe('melamina');
    expect(familiaDeMaterial('Laminado plástico HPL')).toBe('laminado_hpl');
  });
  it('metal, inoxidable y aluminio no se confunden', () => {
    expect(familiaDeMaterial('Acero inoxidable 304')).toBe('acero_inoxidable');
    expect(familiaDeMaterial('Lámina de acero cal. 14')).toBe('metal_lamina');
    expect(familiaDeMaterial('Perfil de aluminio anodizado')).toBe('aluminio');
  });
  it('PET acústico, cristal, mármol', () => {
    expect(familiaDeMaterial('PET acústico Sonara')).toBe('pet_acustico');
    expect(familiaDeMaterial('Cristal templado 10 mm')).toBe('cristal');
    expect(familiaDeMaterial('Mármol Calacatta')).toBe('marmol_piedra');
  });
  it('texto vacío o no reconocido → ""', () => {
    expect(familiaDeMaterial('')).toBe('');
    expect(familiaDeMaterial('cosa rara')).toBe('');
  });
});

describe('clasificarMaterial — la política', () => {
  it('EXACT: pide solid surface y cae en solid surface', () => {
    const r = clasificarMaterial({ solicitado: 'superficie sólida azul', insumoId: 'solid-surface-azul', insumoNombre: 'Superficie sólida 12 mm AZUL mineral' });
    expect(r.clase).toBe(MATCH.EXACT);
    expect(r.autocosteable).toBe(true);
    expect(r.insumoIdEfectivo).toBe('solid-surface-azul');
  });

  it('EL CASO ASUR: pide solid surface, el catálogo ofrece MDF → NO se sustituye solo', () => {
    const r = clasificarMaterial({ solicitado: 'superficie sólida azul', insumoId: 'mdf', insumoNombre: 'MDF 19 mm' });
    expect(r.clase).toBe(MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION);
    expect(r.autocosteable).toBe(false);
    expect(r.insumoIdEfectivo).toBe(''); // jamás alimenta el BOM con MDF
    expect(r.familiaSolicitada).toBe('superficie_solida');
    expect(r.familiaResuelta).toBe('mdf');
  });

  it('CASO ASUR variante HPL: pide solid surface, cae en laminado → requiere confirmación', () => {
    const r = clasificarMaterial({ solicitado: 'solid surface', insumoId: 'laminado', insumoNombre: 'Laminado plástico / Ecolegno (HPL)' });
    expect(r.clase).toBe(MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION);
    expect(r.insumoIdEfectivo).toBe('');
  });

  it('NOT_AVAILABLE: pide solid surface y no hay id → sin costear, no $0 silencioso', () => {
    const r = clasificarMaterial({ solicitado: 'superficie sólida', insumoId: '' });
    expect(r.clase).toBe(MATCH.NOT_AVAILABLE);
    expect(r.autocosteable).toBe(false);
    expect(r.insumoIdEfectivo).toBe('');
    expect(r.motivo).toMatch(/superficie solida|superficie sólida/i);
  });

  it('sin familia explícita pero con id válido → EXACT (confía en el id)', () => {
    const r = clasificarMaterial({ solicitado: '', insumoId: 'melamina-16', insumoNombre: 'Melamina BLANCA 16 mm' });
    expect(r.clase).toBe(MATCH.EXACT);
    expect(r.autocosteable).toBe(true);
  });

  it('misma familia distinto color/espesor → EXACT (melamina ↔ melamina)', () => {
    const r = clasificarMaterial({ solicitado: 'melamina de color 19', insumoId: 'melamina-16', insumoNombre: 'Melamina BLANCA 16 mm' });
    expect(r.clase).toBe(MATCH.EXACT);
  });
});

describe('MATCH_AUTOCOSTEABLE — qué entra al BOM solo', () => {
  it('sólo EXACT y EQUIVALENT_APPROVED', () => {
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.EXACT)).toBe(true);
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.EQUIVALENT_APPROVED)).toBe(true);
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION)).toBe(false);
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.NOT_AVAILABLE)).toBe(false);
  });
});

describe('aplicarPoliticaMaterial — integra con el resolver del catálogo', () => {
  const insumos = {
    'solid-surface-azul': { nombre: 'Superficie sólida 12 mm AZUL mineral' },
    'mdf': { nombre: 'MDF 19 mm' },
    'melamina-16': { nombre: 'Melamina BLANCA 16 mm' },
  };
  const resolver = (id) => insumos[id];

  it('solid surface disponible → conserva el id y es costeable', () => {
    const c = aplicarPoliticaMaterial({ nombre: 'Cubierta', insumoId: 'solid-surface-azul', material_solicitado: 'superficie sólida azul', cantidad: 1 }, resolver);
    expect(c.insumoId).toBe('solid-surface-azul');
    expect(c._match.clase).toBe(MATCH.EXACT);
  });

  it('solid surface que cae en MDF → id en blanco + bandera de confirmación', () => {
    const c = aplicarPoliticaMaterial({ nombre: 'Cubierta', insumoId: 'mdf', material_solicitado: 'superficie sólida azul', cantidad: 1 }, resolver);
    expect(c.insumoId).toBe(''); // el motor lo marcará SIN_MATERIAL (no $0 como MDF falso)
    expect(c._match.clase).toBe(MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION);
    expect(c._match.solicitado).toBe('superficie sólida azul');
  });

  it('id inexistente en catálogo → NOT_AVAILABLE', () => {
    const c = aplicarPoliticaMaterial({ nombre: 'Cubierta', insumoId: 'solid-surface-fantasma', material_solicitado: 'superficie sólida', cantidad: 1 }, resolver);
    expect(c.insumoId).toBe('');
    expect(c._match.clase).toBe(MATCH.NOT_AVAILABLE);
  });
});
