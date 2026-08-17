// ============================================================================
//  QUE SE PUEDA TECLEAR UNA MEDIDA
//  ---------------------------------------------------------------------------
//  Guarda el bug del 2026-08-18: en el Acomodo, teclear "350 m²" NO daba 350.
//  Es hermana de porcentajes.test.js — el mismo bug, en otro campo, un día
//  después. Por eso la regla vive en `leeNumero` (util.js) y no dentro de una
//  pantalla: para no volver a aprenderla una tercera vez.
//
//  ⚠️ Ojo con el hueco que dejó pasar esto: `espacioNuevo.test.js` YA probaba
//  `limpiaM2`, y `limpiaM2` SIEMPRE estuvo bien. El error nunca estuvo en la
//  función, estuvo en DÓNDE se llamaba (dentro del `onChange`, o sea en cada
//  pulsación). Probar la función no bastaba y no bastará.
//
//  Por eso aquí hay dos clases de prueba:
//    1. que `leeNumero` acote bien CUANDO YA SE TERMINÓ de escribir;
//    2. que la pantalla no vuelva a acotar por tecla. Aquí no hay jsdom, así
//       que eso se vigila sobre el código fuente. Es fea, pero es la única que
//       cacha la regresión de verdad.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { leeNumero } from '../util.js';
import { M2_MIN, M2_MAX } from './espacioNuevo.js';

describe('leeNumero — acotar al terminar, no por tecla', () => {
  it('deja pasar una medida normal que ANTES era intecleable', () => {
    expect(leeNumero('350', M2_MIN, M2_MAX)).toBe(350);
    expect(leeNumero('1450', M2_MIN, M2_MAX)).toBe(1450);
    expect(leeNumero('75', M2_MIN, M2_MAX)).toBe(75);
  });

  it('acota de verdad lo que se sale', () => {
    expect(leeNumero('3', M2_MIN, M2_MAX)).toBe(M2_MIN);      // 3 m² no es una oficina
    expect(leeNumero('99999', M2_MIN, M2_MAX)).toBe(M2_MAX);
    expect(leeNumero('-40', M2_MIN, M2_MAX)).toBe(M2_MIN);
  });

  it('un campo vacío NO se rellena solo: se queda como estaba', () => {
    // Éste era el síntoma que más molestaba — borrar para reescribir y ver
    // aparecer un "20" que nadie tecleó.
    expect(leeNumero('', M2_MIN, M2_MAX, 200)).toBe(200);
    expect(leeNumero('   ', M2_MIN, M2_MAX, 200)).toBe(200);
    expect(leeNumero('abc', M2_MIN, M2_MAX, 200)).toBe(200);
  });

  it('entiende cómo se escriben los miles en México', () => {
    expect(leeNumero('1,200', M2_MIN, M2_MAX)).toBe(1200);
  });

  it('redondea a entero: no existe media oficina', () => {
    expect(leeNumero('350.6', M2_MIN, M2_MAX)).toBe(351);
  });
});

describe('la pantalla no puede volver a acotar por tecla', () => {
  const fuente = readFileSync(new URL('../componentes/EmpezarEspacio.jsx', import.meta.url), 'utf8');

  it('el campo de m² escritos usa CampoM2, no un input crudo', () => {
    expect(fuente).toContain('<CampoM2 valor={m2} onCambio={setM2} />');
  });

  it('sólo la barra deslizadora acota en cada movimiento, ningún campo de texto', () => {
    // Un `range` no puede producir valores fuera de min/max, así que ahí sí se
    // vale. Se permite exactamente una, y tiene que ser la barra.
    const acotaEnCadaCambio = fuente.match(/onChange=\{\(e\) => setM2\(limpiaM2\(/g) || [];
    expect(acotaEnCadaCambio).toHaveLength(1);
    expect(fuente).toMatch(/type="range"[\s\S]{0,240}setM2\(limpiaM2\(/);
  });
});
