import { describe,it,expect } from 'vitest';
import fs from 'node:fs';
import { resumenCouncilUI } from './councilUX.js';

describe('VONI deep reviews · Acomodo',()=>{
  it('usa layout_review sobre verdad determinista y nunca mueve muebles',()=>{
    const s=fs.readFileSync('src/componentes/AcomodoBase.jsx','utf8');
    expect(s).toContain("task:'layout_review'");
    expect(s).toContain('autoridad_determinista');
    expect(s).toContain('auditoriaMedida.map');
    expect(s).toContain('NO mover, duplicar, quitar ni sustituir muebles');
    expect(s).toContain('La auditoría determinista es autoridad');
    expect(s).toContain('Revisión profunda');
  });
});

describe('VONI deep reviews · Cotización',()=>{
  it('usa quote_review sin recalcular ni brincar gates',()=>{
    const s=fs.readFileSync('src/componentes/Cotizacion.jsx','utf8');
    expect(s).toContain("task:'quote_review'");
    expect(s).toContain('gate_estado');
    expect(s).toContain('acomodoClienteGate');
    expect(s).toContain('NO cambiar precios, descuentos, IVA, cantidades ni productos');
    expect(s).toContain('El gate determinista/server-side de emisión es autoridad');
    expect(s).toContain('Revisión senior de propuesta');
  });

  it('el contexto Council no manda costoUnitario ni margen por línea',()=>{
    const s=fs.readFileSync('src/componentes/Cotizacion.jsx','utf8');
    const i=s.indexOf('async function revisarCotizacionSenior');
    const j=s.indexOf('\n  return (',i);
    const b=s.slice(i,j);
    expect(b).not.toContain('costoUnitario:');
    expect(b).not.toContain('margen:');
    expect(b).toContain('precio_unitario');
  });
});

describe('Council UI contract',()=>{
  it('deduplica recomendaciones y conserva latencia/presupuesto',()=>{
    const r=resumenCouncilUI({
      ok:true,latency_ms:12345,budget_ms:60000,deadline_hit:false,
      council:{status:'CONSENSUS',decision:'REQUIRES_VALIDATION',requires_confirmation:true},
      opinions:[
        {provider:'a',ok:true,ms:100,output:{summary:'S',recommendations:[{category:'UX',what:'A',why:'B'}],questions:[{what:'Q'}],blockers:[]}},
        {provider:'b',ok:true,ms:200,output:{summary:'S2',recommendations:[{category:'UX',what:'A',why:'B'}],questions:[{what:'Q'}],blockers:[{what:'X'}]}},
      ],
    });
    expect(r.status).toBe('CONSENSUS');
    expect(r.recommendations).toHaveLength(1);
    expect(r.questions).toEqual(['Q']);
    expect(r.blockers).toEqual(['X']);
    expect(r.latency_ms).toBe(12345);
    expect(r.budget_ms).toBe(60000);
  });
});

describe('Render prompt · Von Haucke DNA grounded',()=>{
  it('uses brand DNA only after product/reference truth',()=>{
    const s=fs.readFileSync('supabase/functions/generar-render/index.ts','utf8');
    expect(s).toContain('VON HAUCKE DESIGN DNA');
    expect(s).toContain('Never turn the piece');
    expect(s).toContain('into generic Scandinavian, residential, mid-century or another brand');
    expect(s).toContain('Preserve the ACTUAL product');
    expect(s).not.toContain('Herman Miller / Vitra catalogue quality');
  });
});
