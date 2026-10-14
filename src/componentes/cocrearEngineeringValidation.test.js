// ============================================================================
//  Cocrear engineering validation path (comportamiento, 2026-10-14).
//  Antes: buscaba `const servidorVigente=!!(servidor?.ok&&...)` y `_engineering_validated:false` en el TEXTO de
//  CocrearV3.jsx. Ahora ejecuta la lógica que usa CocrearV3 (datos/validacionIngenieriaCocrear.js).
//
//  COCREAR 10 (D-03): la aprobación ya no es un sello en el JSON del cliente. La decide el SERVIDOR (rol, costo
//  emitible, validador estructural y misma revisión visual) sobre la revisión guardada. El despiece 3D completo
//  sigue siendo diagnóstico: exigirlo hacía la validación inalcanzable para un BOM real (PTR por metro, herrajes).
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import {
  estadoValidacionIngenieria, puedeAprobarIngenieria, piezasPendientesIngenieria, ingenieriaListaParaRevision,
  bloqueoValidacionIngenieria, sinValidacionIngenieria,
} from '../datos/validacionIngenieriaCocrear.js';

const specBase = { hash: 'spec-rev3' };
const validado = { ok: true, spec_hash: 'spec-rev3', ingenieria_validada: true, validada_por: 'diseno@vh.mx', validada_en: '2026-10-14', visual_hash: 'vis-3', estado: 'certificado' };
const BOM = [{ nombre: 'Cubierta', insumoId: 'mdf' }, { nombre: 'Cristal', excluida: true }];

describe('Cocrear engineering validation path', () => {
  it('sólo Diseño/Dirección pueden aprobar', () => {
    expect(puedeAprobarIngenieria('direccion')).toBe(true);
    expect(puedeAprobarIngenieria('diseno')).toBe(true);
    for (const rol of ['ventas', 'vendedor', '', null, undefined]) {
      expect(puedeAprobarIngenieria(rol)).toBe(false);
      expect(bloqueoValidacionIngenieria({ rol, componentes: BOM })).toBe('Sólo Diseño o Dirección pueden validar ingeniería.');
    }
  });

  it('aprobación: BOM sin pendientes; un BOM real (PTR por metro, sin 3 medidas) SÍ es validable', () => {
    expect(ingenieriaListaParaRevision(BOM)).toBe(true);
    expect(ingenieriaListaParaRevision([{ nombre: 'PTR 2x1', insumoId: 'ptr', unidad: 'm', cantidad: 3.2 }])).toBe(true);
    expect(bloqueoValidacionIngenieria({ rol: 'diseno', componentes: BOM })).toBeNull();
    for (const comps of [[], undefined, [{ nombre: 'Costado' }], [{ nombre: 'Cajonera', insumoId: 'x', _funcion: 'guardar' }]]) {
      expect(ingenieriaListaParaRevision(comps)).toBe(false);
      expect(bloqueoValidacionIngenieria({ rol: 'direccion', componentes: comps })).toMatch(/falta el BOM o hay piezas pendientes/);
    }
    expect(piezasPendientesIngenieria([{ nombre: 'A' }, { nombre: 'B', excluida: true }, { nombre: 'C', insumoId: 'i' }]).map((c) => c.nombre)).toEqual(['A']);
  });

  it('VALIDADA sólo si la validó el servidor para ESTA revisión y la MISMA revisión visual', () => {
    const visual = vi.fn(() => 'vis-3');
    const ok = estadoValidacionIngenieria({ servidor: validado, specBase, visualHashActual: visual });
    expect(ok.servidorVigente).toBe(true);
    expect(ok.engineeringValidated).toBe(true);
    expect(ok.engineeringValidation).toMatchObject({ fuente: 'costear-servidor', validador: 'diseno@vh.mx', visual_hash: 'vis-3' });

    // La revisión cambió (spec hash del servidor ≠ actual): el servidor deja de estar vigente.
    const vieja = estadoValidacionIngenieria({ servidor: validado, specBase: { hash: 'spec-rev4' }, visualHashActual: () => 'vis-3' });
    expect(vieja).toEqual({ servidorVigente: false, engineeringValidation: null, engineeringValidated: false });
    // Misma revisión técnica pero otra revisión visual.
    expect(estadoValidacionIngenieria({ servidor: validado, specBase, visualHashActual: () => 'vis-OTRA' }).engineeringValidated).toBe(false);
    // Servidor sin visual hash, servidor que no validó, o servidor con error.
    expect(estadoValidacionIngenieria({ servidor: { ...validado, visual_hash: null }, specBase, visualHashActual: () => null }).engineeringValidated).toBe(false);
    expect(estadoValidacionIngenieria({ servidor: { ...validado, ingenieria_validada: false }, specBase, visualHashActual: () => 'vis-3' }).engineeringValidated).toBe(false);
    expect(estadoValidacionIngenieria({ servidor: { ...validado, ok: false }, specBase, visualHashActual: () => 'vis-3' }).engineeringValidated).toBe(false);
  });

  it('un sello en el JSON del cliente NO cuenta; y el hash visual no se calcula si no hay validación', () => {
    const visual = vi.fn(() => 'vis-3');
    const r = estadoValidacionIngenieria({ servidor: null, specBase, visualHashActual: visual });
    expect(r.engineeringValidated).toBe(false);
    expect(visual).not.toHaveBeenCalled();                       // sin intent no se construye el spec
    // El intent del cliente con _engineering_validated:true no entra en la decisión: sólo `servidor`.
    expect(estadoValidacionIngenieria({ servidor: { _engineering_validated: true }, specBase, visualHashActual: visual }).engineeringValidated).toBe(false);
  });

  it('cualquier commit canónico invalida aprobación previa', () => {
    const intent = { familia: 'mesa', largo: 2400, _engineering_validated: true, _engineering_validation: { fuente: 'x' } };
    const limpio = sinValidacionIngenieria(intent);
    expect(limpio).toEqual({ familia: 'mesa', largo: 2400, _engineering_validated: false, _engineering_validation: null });
    expect(intent._engineering_validated).toBe(true);           // no muta la revisión anterior (historia)
  });

  // STATIC GUARD: CocrearV3.jsx y App.jsx no se montan en node (sin jsdom). Sólo el CABLEADO: rol/identidad reales
  // desde App, la petición al servidor con el hash visual, y que commit/reabrir usen la invalidación probada.
  it('cableado: App → CocrearV3 → servidor', () => {
    const app = fs.readFileSync('src/App.jsx', 'utf8');
    expect(app).toContain("rol={esDireccion ? 'direccion' : esDiseno ? 'diseno' : 'ventas'}");
    expect(app).toContain('usuarioEmail={sesion?.user?.email || null}');
    const s = fs.readFileSync('src/componentes/CocrearV3.jsx', 'utf8');
    expect(s).toContain('costearCocreacionServidor(g.id,validar?{validarIngenieria:true,visualHash:visualRevisionHash(spec)}:{})');
    expect(s).toContain('estadoValidacionIngenieria({');
    expect(s).toContain('const limpio=sinValidacionIngenieria(prepararRevision(next));');
    expect(s).toContain('const bloqueo=bloqueoValidacionIngenieria({rol,componentes:spec?.componentes});');
    expect(s).toContain("desarrollo?.estado==='ANALIZADO'");          // despiece 3D: diagnóstico visible, no bloqueo
    expect(s).not.toContain('_engineering_validated:true');
  });

  // STATIC GUARD: texto de UI (botón y estado) — no hay lógica que ejecutar sin montar el componente.
  it('la UI ofrece un camino real, no un gate imposible', () => {
    const s = fs.readFileSync('src/componentes/CocrearV3.jsx', 'utf8');
    expect(s).toContain('Validar ingeniería de esta revisión');
    expect(s).toContain("engineeringValidated?'VALIDADA':'REQUIERE VALIDACIÓN'");
  });
});
