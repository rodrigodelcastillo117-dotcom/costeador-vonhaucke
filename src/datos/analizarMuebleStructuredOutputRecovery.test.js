import {describe,it,expect} from 'vitest';
import fs from 'node:fs';

describe('analizar-mueble · structured-output recovery',()=>{
  const s=fs.readFileSync('supabase/functions/analizar-mueble/index.ts','utf8');

  it('sanea restricciones JSON Schema que Claude Structured Outputs no soporta',()=>{
    expect(s).toContain('function sanearSchemaClaude');
    expect(s).toContain('"minLength", "maxLength", "maxItems"');
    expect(s).toContain('schema: sanearSchemaClaude(schema)');
  });

  it('no deja una llamada HTTP fallida pasar como JSON exitoso',()=>{
    expect(s).toContain('if (!r.ok)');
    expect(s).toContain('PROVIDER_HTTP_ERROR');
    expect(s).toContain('PROVIDER_INVALID_JSON');
  });

  it('todo 502 del proveedor cierra ai_eventos con error y request_id',()=>{
    expect(s).toContain('const fallarAnalisis = async');
    expect(s).toContain('await cerrarTel("error"');
    expect(s).toContain('error_code: code');
    expect(s).toContain('request_id: requestId');
  });

  it('el schema versionado del repo no trae constraints incompatibles en duro',()=>{
    const schema=s.slice(s.indexOf('const SCHEMA ='),s.indexOf('const RESTRICCIONES_SCHEMA_NO_SOPORTADAS'));
    expect(schema).not.toMatch(/\b(?:minLength|maxLength|maxItems|minimum|maximum|multipleOf)\s*:/);
  });
});
