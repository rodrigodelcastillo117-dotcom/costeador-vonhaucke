import { describe, it, expect } from 'vitest';
import {
  MATCH, MATCH_AUTOCOSTEABLE, familiaDeMaterial, clasificarMaterial, aplicarPoliticaMaterial, mejorInsumoDeFamilia, estadoMaterialUI, alertaMaterial, reconciliarMaterialServidor,
} from './materialMatch.js';

// Catálogo mock como el real (ids con color/espesor) para probar la auto-precarga.
const CAT = [
  { id: 'melamina-19-nogal-neo-tx', nombre: 'Melamina 19 mm, Nogal Neo TX', seccion: 'cubiertas' },
  { id: 'melamina-16-blanco-absoluto', nombre: 'Melamina 16 mm, Blanco Absoluto', seccion: 'cubiertas' },
  { id: 'mdf', nombre: 'MDF 19 mm', seccion: 'cubiertas' },
  { id: 'lamina-14', nombre: 'Lamina de acero cal. 14', seccion: 'metal' },
  { id: 'laminado-walnut', nombre: 'Laminado plastico 4x8 Walnut (nogal)', seccion: 'cubiertas' },
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

describe('VH-053: material del catálogo del SERVIDOR sin precio certificado', () => {
  it('id EXACT de la IA que no existe localmente → pendiente con el id, sin sustituir por familia', () => {
    const c = aplicarPoliticaMaterial(
      { nombre: 'Cubierta', insumoId: 'melamina-28-ivory', material_solicitado: 'melamina ivory 28 mm', material_match: 'EXACT' },
      () => undefined, CAT,
    );
    expect(c.insumoId).toBe('');                               // NO se costea con otro material
    expect(c._match.autollenado).toBe(false);                  // aunque haya melaminas locales
    expect(c._match.clase).toBe(MATCH.NOT_AVAILABLE);
    expect(c._match).toMatchObject({ servidorId: 'melamina-28-ivory', sinPrecioCertificado: true });
    expect(c._match.motivo).toMatch(/servidor.*melamina-28-ivory.*sin precio certificado/);
    const a = alertaMaterial(c._match);
    expect(a).toMatchObject({ tono: 'ambar', titulo: 'Material real sin precio certificado' });
    expect(a.detalle).toMatch(/Compras/);
  });
  it('sin material_match EXACT, un id desconocido sigue la red de seguridad de siempre (auto-asigna por familia, y se avisa)', () => {
    const c = aplicarPoliticaMaterial(
      { nombre: 'Costado', insumoId: 'melamina-19-nogal', material_solicitado: 'melamina nogal 19 mm' },
      () => undefined, CAT,
    );
    // Política de 4 clases (P0.1–P0.16, integrada 2026-10-12): el pariente COMPATIBLE de la misma
    // familia se autollena como costo PROVISIONAL (por confirmar); el juez costeoEmitible lo bloquea
    // hasta USER_CONFIRMED. Nunca cruza familia; se avisa en pantalla.
    expect(c.insumoId).toBe('melamina-19-nogal-neo-tx');
    expect(c._match.clase).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(c._match.autollenado).toBe(true);
    expect(c._match.confirmado_por_usuario).toBe(false);
    expect(c._match.candidate_insumo_id).toBe('melamina-19-nogal-neo-tx');
    expect(alertaMaterial(c._match)).toMatchObject({ tono: 'ambar', titulo: 'Material propuesto por familia: confírmalo' });
  });
  it('alertaMaterial: EXACT sin auto-asignación → nada que avisar; NOT_AVAILABLE → rojo', () => {
    const ok = aplicarPoliticaMaterial({ nombre: 'Tapa', insumoId: 'mdf', material_solicitado: 'mdf 19' }, (id) => CAT.find((x) => x.id === id), CAT);
    expect(alertaMaterial(ok._match)).toBeNull();
    const na = aplicarPoliticaMaterial({ nombre: 'Cubierta', insumoId: '', material_solicitado: 'superficie sólida' }, () => undefined, CAT);
    expect(alertaMaterial(na._match)).toMatchObject({ tono: 'rojo', titulo: 'Material pendiente' });
    expect(alertaMaterial(null)).toBeNull();
  });
});

describe('VH-086: EcoLegno es melamina (nombre real de melamina-19 en producción)', () => {
  const CFG = {
    'melamina-19': { id: 'melamina-19', nombre: 'Melamina / EcoLegno 19 mm', precio: 320, unidad: 'm2' },
    'melamina-16': { id: 'melamina-16', nombre: 'Melamina 16 mm', precio: 900, unidad: 'hoja' },
  };
  const res = (id) => CFG[id];
  it('familiaDeMaterial: "Melamina / EcoLegno 19 mm" y la semilla "Melamina BLANCA / EcoLegno 19 mm" son melamina; el HPL puro sigue siendo laminado', () => {
    expect(familiaDeMaterial('Melamina / EcoLegno 19 mm')).toBe('melamina');
    expect(familiaDeMaterial('Melamina BLANCA / EcoLegno 19 mm')).toBe('melamina');
    expect(familiaDeMaterial('Laminado plástico HPL')).toBe('laminado_hpl');
    expect(familiaDeMaterial('Laminado Walnut')).toBe('laminado_hpl');
  });
  it('servidor: melamina 19 pedida + melamina-19 del catálogo = misma familia (provisional sin provenance; USER_CONFIRMED con Dirección), no sustitución', () => {
    const prov = reconciliarMaterialServidor({ nombre: 'Tapa', insumoId: 'melamina-19', material_solicitado: 'melamina 19 mm', largoMM: 1600, anchoMM: 600 }, res, Object.values(CFG), { puedeConfirmar: true });
    expect(prov.insumoId).toBe('melamina-19');
    expect(prov.material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    const conf = reconciliarMaterialServidor({ nombre: 'Tapa', insumoId: 'melamina-19', material_solicitado: 'melamina 19 mm', material_confirmado: true, largoMM: 1600, anchoMM: 600 }, res, Object.values(CFG), { puedeConfirmar: true });
    expect(conf.insumoId).toBe('melamina-19');
    expect(conf.material_match).toBe(MATCH.USER_CONFIRMED);
  });
});

describe('VH-158 · diferencia frente a lo pedido no se confirma en bloque', () => {
  it('espesor, calibre, perfil, variante y color son diferencias; reglas de casa no', async () => {
    const { difiereDeLoPedido } = await import('./materialMatch.js');
    expect(difiereDeLoPedido('Solicitado 18 mm → candidato 19 mm')).toBe(false); // par aprobado 18↔19 = regla de casa
    expect(difiereDeLoPedido('Solicitado 16 mm → candidato 19 mm')).toBe(true);
    expect(difiereDeLoPedido('Solicitado cal.14 → candidato cal.18')).toBe(true);
    expect(difiereDeLoPedido('Variante pedida («recta 300») no está en el nombre del catálogo')).toBe(true);
    expect(difiereDeLoPedido('Acabado/color distinto al solicitado')).toBe(true);
    expect(difiereDeLoPedido('estándar de casa')).toBe(false);
    expect(difiereDeLoPedido('perfil supuesto 1"×1" (regla de casa)')).toBe(false);
    expect(difiereDeLoPedido('El color lo da la pintura electrostática (línea aparte); el acero va crudo')).toBe(false);
    expect(difiereDeLoPedido('')).toBe(false);
  });
  it('AsistenteEspecial: el botón en bloque excluye las diferencias y cada una tiene su aceptación explícita', async () => {
    const fs = await import('node:fs');
    const s = fs.readFileSync('src/componentes/AsistenteEspecial.jsx', 'utf8');
    // VONI Ingeniería (2026-10-13): además excluye piezas inferidas/supuestas; la exclusión de diferencias sigue igual.
    expect(s).toContain("!difiereDeLoPedido(e.cambio) && !noObservada(c) ? { ...c, ...patchConfirmacionUI(c.insumoId) } : c");
    expect(s).toContain('data-testid="confirmar-con-diferencia"');
    expect(s).toContain('data-testid="piloto-con-diferencia"');
  });
});
