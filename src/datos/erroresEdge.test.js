// Área J · R-02 (causa raíz): los fallos de las Edge de IA llegaban a la pantalla con el mensaje de la
// librería ("Edge Function returned a non-2xx status code"). Ver e2e/resiliencia.e2e.js escenarios 2–3.
import { describe, it, expect } from 'vitest';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/functions-js';
import { mensajeErrorEdge } from './erroresEdge.js';

const JERGA = /non-2xx|Edge Function|Failed to|Unexpected token|JSON|is not a function/i;
const http = (status) => new FunctionsHttpError(new Response('upstream request timeout', { status }));

describe('mensajeErrorEdge', () => {
  it('504/546/408 = tiempo agotado, en español y sin jerga', () => {
    for (const s of [504, 546, 408]) {
      const m = mensajeErrorEdge(http(s), 'x');
      expect(m).toMatch(/tardó demasiado/);
      expect(m).toMatch(/No se cambió nada/);
      expect(m).not.toMatch(JERGA);
    }
  });
  it('502/503/500 = servicio caído; 401 = sesión; 429 = saturada', () => {
    expect(mensajeErrorEdge(http(502))).toMatch(/no está disponible/);
    expect(mensajeErrorEdge(http(503))).toMatch(/no está disponible/);
    expect(mensajeErrorEdge(http(401))).toMatch(/sesión expiró/);
    expect(mensajeErrorEdge(http(429))).toMatch(/saturada/);
  });
  it('sin red / corte (FunctionsFetchError) y relay', () => {
    expect(mensajeErrorEdge(new FunctionsFetchError(new TypeError('Failed to fetch')))).toMatch(/No se pudo conectar con el servicio de IA/);
    expect(mensajeErrorEdge(new FunctionsRelayError(new Response('', { status: 502 })))).not.toMatch(JERGA);
  });
  it('JSON truncado (SyntaxError del parseo) = respuesta mal formada', () => {
    let e; try { JSON.parse('{"ok":true,"propuesta":{"items":[{"ruta":"applt","produ'); } catch (x) { e = x; }
    expect(mensajeErrorEdge(e)).toMatch(/no se pudo leer/);
    expect(mensajeErrorEdge(e)).not.toMatch(JERGA);
  });
  it('un status no mapeado usa el texto por omisión de quien llama (nunca el de la librería)', () => {
    expect(mensajeErrorEdge(http(418), 'No se pudo interpretar el texto.')).toBe('No se pudo interpretar el texto.');
    expect(mensajeErrorEdge(null, 'por omisión')).toBe('por omisión');
  });
});
