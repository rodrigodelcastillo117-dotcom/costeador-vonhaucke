// uxParity · COSTEAR simple (flag costear_simple)
// Bloquea el invariante del modo simple SIN depender de render (el repo no tiene testing-library):
// se lee el fuente de AsistenteEspecial.jsx y se asertan las propiedades estructurales.
//  1) existe el seam `simple = modo === 'simple'`.
//  2) los bloques de "ingeniería" se pliegan con <details open={!simple}> (en avanzado open=true ⇒ idéntico).
//  3) cada pliegue tiene su summary "Ver ingeniería" (findable).
//  4) CERO funciones perdidas: las alertas fail-closed y acciones clave del PASO4 siguen presentes en el fuente.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('./AsistenteEspecial.jsx', import.meta.url)), 'utf8');

describe('uxParity COSTEAR simple', () => {
  it('declara el seam modo simple', () => {
    expect(src).toContain("const simple = modo === 'simple'");
  });

  it('pliega los bloques de ingeniería con open={!simple} (avanzado = idéntico)', () => {
    // 3 pliegues: desglose+método (PASO4), fórmula MO (PASO3), informe técnico (PASO2).
    const n = (src.match(/<details[^>]*open=\{!simple\}/g) || []).length;
    expect(n).toBeGreaterThanOrEqual(3);
  });

  it('cada pliegue tiene summary "Ver ingeniería" findable', () => {
    for (const id of ['ver-ingenieria-costeo', 'ver-ingenieria-mo', 'ver-ingenieria-informe']) {
      expect(src).toContain(`data-testid="${id}"`);
      expect(src).toMatch(new RegExp(`data-testid="${id}"[^>]*`));
    }
    expect(src).toContain('Ver ingeniería');
  });

  it('el summary se oculta en modo avanzado (display none) para no cambiar el render de hoy', () => {
    // Patrón: display: simple ? 'list-item' : 'none'  → avanzado no muestra el disclosure.
    const n = (src.match(/display:\s*simple\s*\?\s*'list-item'\s*:\s*'none'/g) || []).length;
    expect(n).toBeGreaterThanOrEqual(3);
  });

  it('NO oculta las alertas/acciones fail-closed ni pierde funciones del PASO4', () => {
    // Estas marcas siguen en el fuente (no se plegaron ni borraron):
    for (const marca of [
      'costear-motivo-bloqueo',       // motivo del bloqueo fail-closed
      'alerta-tamano-hoja',           // VH-151 medida de hoja
      'estado-costo-detalle',         // estado del costo con motivos
      'precios-por-aprobar',          // aprobación de precio (Dirección)
      'piloto-costear',               // piloto automático / confirmar materiales
      'Guardar en biblioteca',        // acción primaria de guardado
      'Generar render',               // render
    ]) {
      expect(src, `falta ${marca} — ¿se perdió una función?`).toContain(marca);
    }
  });
});
