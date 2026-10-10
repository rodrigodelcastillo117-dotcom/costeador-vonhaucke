import { describe, it, expect } from 'vitest';
import {
  MATCH, MATCH_AUTOCOSTEABLE, debeResetearHojasMaterial, familiaDeMaterial, clasificarMaterial, aplicarPoliticaMaterial, mejorInsumoDeFamilia, estadoMaterialUI,
} from './materialMatch.js';

// Catálogo mock como el real (ids con color/espesor) para probar la auto-precarga.
const CAT = [
  { id: 'melamina-19-nogal-neo-tx', nombre: 'Melamina 19 mm, Nogal Neo TX', seccion: 'cubiertas' },
  { id: 'melamina-16-blanco-absoluto', nombre: 'Melamina 16 mm, Blanco Absoluto', seccion: 'cubiertas' },
  { id: 'mdf', nombre: 'MDF 19 mm', seccion: 'cubiertas' },
  { id: 'lamina-14', nombre: 'Lamina de acero cal. 14', seccion: 'metal' },
  { id: 'laminado-walnut', nombre: 'Laminado plastico 4x8 Walnut (nogal)', seccion: 'cubiertas' },
  { id: 'aglomerado', nombre: 'Aglomerado crudo 19 mm', seccion: 'cubiertas' },
  { id: 'canto-abs-22', nombre: 'Perfil de canto ABS 22 mm Walnut', seccion: 'cubiertas' },
  { id: 'pintura-polvo-negro', nombre: 'Pintura en polvo negro mate', seccion: 'acabados' },
];

describe('VONI propone materiales sin auto-certificarlos', () => {
  it('"melamina nogal claro 19mm" sin id del LLM → autollena candidato de la misma familia y lo costea PROVISIONAL (por confirmar)', () => {
    const c = aplicarPoliticaMaterial(
      { nombre: 'Costado melamina nogal claro 19 mm', insumoId: '', material_solicitado: 'melamina nogal claro 19 mm' },
      () => undefined, CAT,
    );
    // Misma familia, candidato único compatible → entra al cálculo provisional, marcado por confirmar.
    expect(c.insumoId).toBe('melamina-19-nogal-neo-tx');
    expect(c._match.candidate_insumo_id).toBe('melamina-19-nogal-neo-tx');
    expect(c._match.autollenado).toBe(true);
    expect(c._match.clase).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(c._match.autocosteable).toBe(true);        // provisional, NO certificado
    expect(c._match.confirmado_por_usuario).toBe(false);
  });
  it('mejorInsumoDeFamilia respeta el ESPESOR (16 vs 19)', () => {
    expect(mejorInsumoDeFamilia('tapa melamina blanca 16', CAT).id).toBe('melamina-16-blanco-absoluto');
    expect(mejorInsumoDeFamilia('cubierta melamina 19 nogal', CAT).id).toBe('melamina-19-nogal-neo-tx');
  });
  it('laminado walnut → laminado (no melamina)', () => {
    expect(mejorInsumoDeFamilia('frente laminado walnut', CAT).id).toBe('laminado-walnut');
  });
  it('REGRESIÓN REAL: tapacanto ABS Walnut jamás cae en Aglomerado', () => {
    expect(familiaDeMaterial('Tapacanto ABS Walnut 22 mm')).toBe('tapacanto');
    expect(familiaDeMaterial('Aglomerado crudo 19 mm')).toBe('aglomerado');
    expect(mejorInsumoDeFamilia('Tapacanto ABS Walnut 22 mm', CAT).id).toBe('canto-abs-22');
    const c = aplicarPoliticaMaterial(
      { nombre: 'Tapacanto ABS Walnut 22 mm', insumoId: 'aglomerado', material_solicitado: 'Canto nogal a tono con melamina nogal claro' },
      (id) => CAT.find((x) => x.id === id), CAT,
    );
    expect(c.insumoId).not.toBe('aglomerado');
    expect(c._match.clase).not.toBe(MATCH.EXACT);
  });
  it('pintura electrostática negra reconoce la familia pintura en polvo', () => {
    expect(familiaDeMaterial('Pintura electrostática negra')).toBe('pintura_polvo');
    expect(mejorInsumoDeFamilia('Pintura electrostática negra', CAT).id).toBe('pintura-polvo-negro');
  });
  it('familia AUSENTE (solid surface) → NO auto-asigna, queda pendiente (no inventa)', () => {
    expect(mejorInsumoDeFamilia('cubierta superficie sólida azul', CAT)).toBe(null);
    const c = aplicarPoliticaMaterial(
      { nombre: 'Cubierta', insumoId: '', material_solicitado: 'superficie sólida azul' },
      () => undefined, CAT,
    );
    expect(c.insumoId).toBe('');
    expect(c._match.clase).toBe(MATCH.NOT_AVAILABLE);
  });
  it('cross-familia: LLM pone MDF para solid surface → NO se queda MDF; solid surface ausente → pendiente', () => {
    const c = aplicarPoliticaMaterial(
      { nombre: 'Cubierta', insumoId: 'mdf', material_solicitado: 'superficie sólida azul' },
      (id) => CAT.find((x) => x.id === id), CAT,
    );
    expect(c.insumoId).toBe(''); // nunca MDF disfrazado de solid surface
  });
});

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
    expect(familiaDeMaterial('Aglomerado crudo 19 mm')).toBe('aglomerado');
    expect(familiaDeMaterial('Canto ABS Walnut 22 mm')).toBe('tapacanto');
    expect(familiaDeMaterial('Pintura electrostática negra')).toBe('pintura_polvo');
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

  it('sin familia explícita pero con id válido → candidato, no EXACT', () => {
    const r = clasificarMaterial({ solicitado: '', insumoId: 'melamina-16', insumoNombre: 'Melamina BLANCA 16 mm' });
    expect(r.clase).toBe(MATCH.CANDIDATE_REQUIRES_CONFIRMATION);
    expect(r.autocosteable).toBe(false);
    expect(r.insumoIdEfectivo).toBe('');
    expect(r.insumoIdCandidato).toBe('melamina-16');
  });

  it('TABLERO con salto de espesor NO aprobado (19 vs 16) → CRÍTICO (no autocostea; solo 18↔19 es compatible)', () => {
    const r = clasificarMaterial({ solicitado: 'melamina de color 19 mm', insumoId: 'melamina-16', insumoNombre: 'Melamina BLANCA 16 mm' });
    expect(r.clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    expect(r.autocosteable).toBe(false);
    expect(r.insumoIdEfectivo).toBe('');
    expect(r.insumoIdCandidato).toBe('melamina-16');   // se muestra, pero no se autocostea
  });

  it('CASO MOSTRADOR: melamina 18 mm (no existe) → candidato 19 mm, mismo acabado → COMPATIBLE + cambio legible', () => {
    const r = clasificarMaterial({ solicitado: 'melamina 18 mm nogal', insumoId: 'melamina-19-nogal-neo-tx', insumoNombre: 'Melamina 19 mm, Nogal Neo TX' });
    expect(r.clase).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(r.autocosteable).toBe(true);
    expect(r.insumoIdEfectivo).toBe('melamina-19-nogal-neo-tx');
    expect(r.cambio).toBe('Solicitado 18 mm → candidato 19 mm');
  });

  it('CRÍTICO: lámina de acero cal.18 pedida vs cal.14 del catálogo → mismo material, atributo CRÍTICO: NO autocostea', () => {
    const r = clasificarMaterial({ solicitado: 'lámina de acero cal. 18', insumoId: 'lamina-14', insumoNombre: 'Lamina de acero cal. 14' });
    expect(r.clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    expect(r.autocosteable).toBe(false);
    expect(r.insumoIdEfectivo).toBe('');               // no entra al costo sin confirmar
    expect(r.insumoIdCandidato).toBe('lamina-14');      // pero sí se muestra/preselecciona
    expect(r.cambio).toBe('Solicitado cal.18 → candidato cal.14');
  });
});

describe('MATCH_AUTOCOSTEABLE — qué entra al BOM solo', () => {
  it('EXACT, EQUIVALENT_APPROVED, USER_CONFIRMED y COMPATIBLE (provisional); CRÍTICO/AMBIGUO/sustitución/NA fuera', () => {
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.EXACT)).toBe(true);
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.EQUIVALENT_APPROVED)).toBe(true);
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.USER_CONFIRMED)).toBe(true);
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED)).toBe(true);  // provisional
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.SAME_FAMILY_CRITICAL_CONFLICT)).toBe(false);   // nunca autocostea
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.AMBIGUOUS)).toBe(false);
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.CANDIDATE_REQUIRES_CONFIRMATION)).toBe(false);
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION)).toBe(false);
    expect(MATCH_AUTOCOSTEABLE.has(MATCH.NOT_AVAILABLE)).toBe(false);
  });
});

describe('casos obligatorios del mandato (autollenado controlado, sin romper fail-closed)', () => {
  it('lámina cal.14→cal.18 vía red de seguridad → CRÍTICO: preselecciona candidato pero NO lo costea', () => {
    const c = aplicarPoliticaMaterial(
      { nombre: 'Zoclo metálico', insumoId: '', material_solicitado: 'lámina de acero cal. 18' },
      () => undefined, CAT,
    );
    expect(c.insumoId).toBe('');                               // no autocostea
    expect(c._match.candidate_insumo_id).toBe('lamina-14');    // sí se muestra
    expect(c._match.clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
    expect(c._match.autocosteable).toBe(false);
  });

  it('refrigerador que NO existe en catálogo → NOT_AVAILABLE (pendiente), nunca $0 real ni inventado', () => {
    const c = aplicarPoliticaMaterial(
      { nombre: 'Refrigerador vitrina', insumoId: '', material_solicitado: 'refrigerador vitrina doble puerta' },
      () => undefined, CAT,
    );
    expect(c.insumoId).toBe('');
    expect(c._match.candidate_insumo_id).toBeFalsy();
    expect(c._match.clase).toBe(MATCH.NOT_AVAILABLE);
    expect(c._match.autocosteable).toBe(false);
  });

  it('dos candidatos de la MISMA familia igualmente plausibles → AMBIGUOUS: no escoge a escondidas', () => {
    const c = aplicarPoliticaMaterial(
      { nombre: 'Panel', insumoId: '', material_solicitado: 'melamina' },  // sólo familia, sin color/espesor
      () => undefined, CAT,
    );
    expect(c.insumoId).toBe('');
    expect(c._match.clase).toBe(MATCH.AMBIGUOUS);
    expect(c._match.autocosteable).toBe(false);
  });

  it('solid surface → MDF sigue BLOQUEADO (fail-closed intacto)', () => {
    const c = aplicarPoliticaMaterial(
      { nombre: 'Cubierta', insumoId: 'mdf', material_solicitado: 'superficie sólida azul' },
      (id) => CAT.find((x) => x.id === id), CAT,
    );
    expect(c.insumoId).toBe('');
    expect(c._match.clase).toBe(MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION);
    expect(c._match.autocosteable).toBe(false);
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


describe('confirmación humana de material candidato', () => {
  it('material_confirmado promueve un id existente a USER_CONFIRMED y lo hace costeable', () => {
    const c = aplicarPoliticaMaterial(
      {
        nombre:'Cubierta',
        insumoId:'melamina-16-blanco-absoluto',
        material_solicitado:'',
        material_confirmado:true,
        cantidad:1,
      },
      (id) => CAT.find((x) => x.id === id),
      CAT,
    );
    expect(c.insumoId).toBe('melamina-16-blanco-absoluto');
    expect(c._match.clase).toBe(MATCH.USER_CONFIRMED);
    expect(c._match.confirmado_por_usuario).toBe(true);
    expect(MATCH_AUTOCOSTEABLE.has(c._match.clase)).toBe(true);
  });
});


describe('estadoMaterialUI — fuente única de la UI (paridad Costeador/AsistenteEspecial)', () => {
  const INS = { 'melamina-19': { nombre: 'Melamina 19 mm' }, 'lamina-14': { nombre: 'Lámina cal.14' } };

  it('COMPATIBLE autollenado → costeable, selector muestra el candidato, badge POR CONFIRMAR', () => {
    const c = { insumoId: 'melamina-19', _match: { clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, autollenado: true, candidate_insumo_id: 'melamina-19', cambio: 'Solicitado 18 mm → candidato 19 mm' } };
    const e = estadoMaterialUI(c, INS);
    expect(e.costeable).toBe(true);
    expect(e.selVal).toBe('melamina-19');
    expect(e.badge).toMatch(/POR CONFIRMAR/);
    expect(e.badge).toMatch(/18 mm → candidato 19 mm/);
    expect(e.pendiente).toBe(false);
  });

  it('CRÍTICO → NO costeable, selector preselecciona candidato, "Costo pendiente" + botón confirmar', () => {
    const c = { insumoId: '', _match: { clase: MATCH.SAME_FAMILY_CRITICAL_CONFLICT, candidate_insumo_id: 'lamina-14', cambio: 'Solicitado cal.18 → candidato cal.14' } };
    const e = estadoMaterialUI(c, INS);
    expect(e.costeable).toBe(false);
    expect(e.selVal).toBe('lamina-14');           // se muestra, no "¿de qué es?"
    expect(e.mostrarConfirmar).toBe(true);
    expect(e.pendienteMsg).toMatch(/Costo pendiente/);
    expect(e.pendienteMsg).toMatch(/crítico/);
  });

  it('AMBIGUO → pendiente, no preselecciona nada', () => {
    const c = { insumoId: '', _match: { clase: MATCH.AMBIGUOUS } };
    const e = estadoMaterialUI(c, INS);
    expect(e.costeable).toBe(false);
    expect(e.selVal).toBe('');
    expect(e.pendienteMsg).toMatch(/elige/);
  });

  it('NOT_AVAILABLE sin candidato → "Costo pendiente", NUNCA $0', () => {
    const c = { insumoId: '', _match: { clase: MATCH.NOT_AVAILABLE } };
    const e = estadoMaterialUI(c, INS);
    expect(e.pendienteMsg).toMatch(/Costo pendiente/);
    expect(e.pendienteMsg).not.toMatch(/\$0/);
  });

  it('USER_CONFIRMED → costeable, SIN badge por confirmar', () => {
    const c = { insumoId: 'melamina-19', _match: { clase: MATCH.USER_CONFIRMED, confirmado_por_usuario: true } };
    const e = estadoMaterialUI(c, INS);
    expect(e.costeable).toBe(true);
    expect(e.badge).toBe('');
  });

  it('EXACT (sin _match de autollenado) → costeable, sin badge', () => {
    const c = { insumoId: 'melamina-19', _match: { clase: MATCH.EXACT } };
    const e = estadoMaterialUI(c, INS);
    expect(e.costeable).toBe(true);
    expect(e.badge).toBe('');
  });
});

describe('identidad comercial de componentes comprados', () => {
  it('nombre comercial específico + artículo real del catálogo puede ser EXACT sin familia MP', () => {
    const r = clasificarMaterial({
      solicitado:'portamonitor Loktec',
      insumoId:'portamonitor-loktec-d7a',
      insumoNombre:'Portamonitor Loktec D7A',
    });
    expect(r.clase).toBe(MATCH.EXACT);
    expect(r.insumoIdEfectivo).toBe('portamonitor-loktec-d7a');
    expect(r.autocosteable).toBe(true);
  });

  it('texto genérico sin familia sigue siendo candidato, no exacto', () => {
    const r = clasificarMaterial({
      solicitado:'accesorio',
      insumoId:'portamonitor-loktec-d7a',
      insumoNombre:'Portamonitor Loktec D7A',
    });
    expect(r.clase).toBe(MATCH.CANDIDATE_REQUIRES_CONFIRMATION);
    expect(r.insumoIdEfectivo).toBe('');
  });
});


describe('P0 — 18 mm se prioriza contra variante de 19 mm aprobada', () => {
  const paneles = [
    { id: 'melamina-16-nogal', nombre: 'Melamina Nogal Neo 16 mm' },
    { id: 'melamina-19-nogal', nombre: 'Melamina Nogal Neo 19 mm' },
  ];
  it('elige 19 mm compatible aunque el catálogo ponga 16 mm primero', () => {
    const r = aplicarPoliticaMaterial(
      { nombre: 'Costado', material_solicitado: 'melamina nogal 18 mm', insumoId: '' },
      () => null, paneles,
    );
    expect(r.insumoId).toBe('melamina-19-nogal');
    expect(r.material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(r._match.cambio).toContain('18 mm');
    expect(r._match.confirmado_por_usuario).toBe(false);
  });
  it('si sólo hay 16 mm no autocostea espesor incompatible', () => {
    const r = aplicarPoliticaMaterial(
      { nombre: 'Costado', material_solicitado: 'melamina nogal 18 mm', insumoId: '' },
      () => null, [paneles[0]],
    );
    expect(r.insumoId).toBe('');
    expect(r.material_match).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
  });
});


describe('P0 — cantidades inválidas no se maquillan como una pieza', () => {
  it('cantidad explícita cero no se convierte en 1', () => {
    const c = aplicarPoliticaMaterial({ nombre: 'Cubierta', material_solicitado: 'melamina nogal 18 mm', cantidad: 0, insumoId: '' }, () => null, []);
    expect(c.cantidad).toBe(0);
  });
  it('sin cantidad se conserva el valor por defecto legacy', () => {
    const c = aplicarPoliticaMaterial({ nombre: 'Cubierta', material_solicitado: 'melamina nogal 18 mm', insumoId: '' }, () => null, []);
    expect(c.cantidad).toBe(1);
  });
});


describe('P0 — candidatos visibles al usuario cuando el material es ambiguo', () => {
  it('conserva alternativas de la misma familia sin autoasignación', () => {
    const catalogo = [
      {id:'melamina-16-blanco', nombre:'Melamina 16 mm blanco'},
      {id:'melamina-19-nogal', nombre:'Melamina 19 mm nogal'},
    ];
    const c = aplicarPoliticaMaterial({nombre:'Panel',material_solicitado:'melamina',insumoId:''},()=>null,catalogo);
    expect(c.material_match).toBe(MATCH.AMBIGUOUS);
    expect(c.insumoId).toBe('');
    expect(c._match.alternativas.map(x=>x.id)).toEqual(['melamina-16-blanco','melamina-19-nogal']);
    expect(c._match.autocosteable).toBe(false);
  });
});


describe('P0 — hoja obsoleta al sustituir insumo', () => {
  it('16mm a 19mm obliga a recapturar fracción aunque ambos son tableros', () => {
    expect(debeResetearHojasMaterial('melamina-16','melamina-19',true)).toBe(true);
  });
  it('mismo insumo sigue siendo editable sin borrar hoja', () => {
    expect(debeResetearHojasMaterial('melamina-19','melamina-19',true)).toBe(false);
  });
  it('cambio a material no fraccionado limpia hoja', () => {
    expect(debeResetearHojasMaterial('melamina-19','tubo-ptr',false)).toBe(true);
  });
});


describe('P0 — acero negro requiere definir metal y acabado POR SEPARADO', () => {
  it('PTR negro sin calibre/perfil no falla falsamente por color distinto', () => {
    const c = clasificarMaterial({solicitado:'PTR estructura metálica negra',insumoId:'ptr-14',insumoNombre:'Tubo / PTR cal. 14'});
    expect(c.clase).toBe(MATCH.CANDIDATE_REQUIRES_CONFIRMATION);
    expect(c.insumoIdEfectivo).toBe('');
    expect(c.insumoIdCandidato).toBe('ptr-14');
    expect(c.motivo).toMatch(/calibre/);
    expect(c.motivo).toMatch(/acabado negro/i);
  });
  it('lámina negra sin calibre tampoco puede emitirse con calibre arbitrario', () => {
    const c = clasificarMaterial({solicitado:'lámina negra',insumoId:'lamina-14',insumoNombre:'Lamina de acero cal. 14'});
    expect(c.insumoIdEfectivo).toBe('');
    expect(c.clase).toBe(MATCH.CANDIDATE_REQUIRES_CONFIRMATION);
  });
  it('lámina cal 14 y pintura negra puede estimar acero crudo con acabado pendiente, no certificar', () => {
    const c = clasificarMaterial({solicitado:'lámina negra cal. 14',insumoId:'lamina-14',insumoNombre:'Lamina de acero cal. 14'});
    expect(c.clase).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(c.cambio).toMatch(/pintura aparte/i);
  });
  it('metal CAL.18 no se sustituye por CAL.14 aunque se parezca el color', () => {
    const c = clasificarMaterial({solicitado:'lámina negra cal. 18',insumoId:'lamina-14',insumoNombre:'Lamina de acero cal. 14'});
    expect(c.clase).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT);
  });
});
