import { describe,it,expect } from 'vitest';
import { canonicalZoneRole, canonicalProductRole, semanticVerdict } from './spatial-semantics.js';

describe('acomodo · taxonomía semántica única',()=>{
  it('normaliza roles FloorSpec al vocabulario interno',()=>{
    expect(canonicalZoneRole({zone_role:'AREA_OPERATIVA'})).toBe('operational');
    expect(canonicalZoneRole({zone_role:'SALA_CONSEJO'})).toBe('meeting');
    expect(canonicalZoneRole({zone_role:'OFICINA_CEO'})).toBe('private_office');
    expect(canonicalZoneRole({zone_role:'SANITARIOS'})).toBe('restroom');
  });
  it('clasifica SONATA destinada a juntas como meeting_seat',()=>{
    expect(canonicalProductRole({nombre:'Silla SONATA',tipo:'asiento',ruta:'vh-dest-mtg'})).toBe('meeting_seat');
  });
  it('bloquea silla de juntas en open space',()=>{
    expect(semanticVerdict('meeting_seat','operational').level).toBe('FAIL');
  });
  it('bloquea silla operativa en sala de juntas',()=>{
    expect(semanticVerdict('work_seat','meeting').level).toBe('FAIL');
  });
  it('permite asiento directivo en privado',()=>{
    expect(semanticVerdict('executive_seat','private_office').level).toBe('PASS');
  });
  it('nunca permite mobiliario normal en sanitarios',()=>{
    expect(semanticVerdict('storage','restroom').level).toBe('FAIL');
  });
});
