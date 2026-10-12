import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('Costeador · Diseño es técnico, Dirección controla economía comercial', () => {
  it('App pasa la capacidad comercial únicamente a Dirección', () => {
    const s=fs.readFileSync('src/App.jsx','utf8');
    expect(s).toContain('puedeVerComercial={esDireccion}');
  });

  it('Costeador separa acciones técnicas y comerciales', () => {
    const s=fs.readFileSync('src/componentes/Costeador.jsx','utf8');
    expect(s).toContain('puedeVerComercial = true');
    expect(s).toContain('Diseño puede revisar BOM y costo técnico');
    expect(s).toContain('{puedeVerComercial ? (');
    expect(s).toContain('mostrarComercial={puedeVerComercial}');
  });

  it('HojaCosto no muestra precios/utilidad/volumen cuando la capacidad comercial está apagada', () => {
    const s=fs.readFileSync('src/componentes/HojaCosto.jsx','utf8');
    expect(s).toContain('mostrarComercial = true');
    expect(s).toContain('{mostrarComercial && utilidad > 0');
    expect(s).toContain('{mostrarComercial && mostrarVolumen && !incompleto');
    expect(s).toContain('{mostrarComercial && (incompleto ? (');
  });
});
