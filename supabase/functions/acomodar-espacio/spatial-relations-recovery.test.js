import { describe,it,expect } from 'vitest';
import { canonicalProductRole, canonicalZoneRole, semanticVerdict } from './spatial-semantics.js';

describe('spatial semantics · functional relations',()=>{
  it('relation_role beats an ambiguous commercial name',()=>{
    expect(canonicalProductRole({nombre:'SONATA',relation_role:'MEETING_SEAT'})).toBe('meeting_seat');
    expect(canonicalProductRole({nombre:'Módulo especial',relation_role:'ANCHOR_RECEPTION'})).toBe('reception_desk');
    expect(canonicalProductRole({nombre:'Mesa especial',relation_role:'ANCHOR_DESK'})).toBe('executive_desk');
  });
  it('keeps functional furniture in its correct zone role',()=>{
    expect(semanticVerdict('meeting_table',canonicalZoneRole({nombre:'SALA DE CONSEJO'})).level).toBe('PASS');
    expect(semanticVerdict('meeting_table',canonicalZoneRole({nombre:'OFICINA CEO'})).level).toBe('FAIL');
    expect(semanticVerdict('work_seat',canonicalZoneRole({nombre:'ÁREA OPERATIVA'})).level).toBe('PASS');
    expect(semanticVerdict('reception_desk',canonicalZoneRole({nombre:'RECEPCIÓN'})).level).toBe('PASS');
  });
});
