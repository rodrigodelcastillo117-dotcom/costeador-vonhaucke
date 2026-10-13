import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha256=(p)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const PROTEGIDOS=[
  // 2026-10-13 · VH-177, aprobado por Rodrigo ("si corrígelo"): tipoAlba dejó de leer "LAMINADO plástico/HPL"
  // como lámina de acero (metal 20 %); ahora es cubierta (15 %). Sólo cambia esa regla; porcentajes y GI intactos.
  ['src/motor/formulaAlba.js','feaf687b3bf225fc5997b9b148ce259e0a449598ebaed68da9d647acafcc375f','Fórmula Alba'],
  ['src/datos/fuentes/COSTOS-Alba-C-CO-516R-LLENO.xlsx','47b8883be0c3a6c64d8048172692b1fea94cb127fca6db3ded2e5fba7705b7bf','Fuente Alba C-CO-516R lleno'],
  ['src/datos/fuentes/COSTOS-Alba-REG-DCC-IDP-032-C-CO-516R.xlsx','af3d2fb8c6eb620002d4c1a6f4ddcd7f4b21021aaef11ad4a3c64254e013b53d','Fuente Alba REG-DCC-IDP-032'],
  ['src/datos/fuentes/SOLICITUD-Rafa-REG-DCC-IDP-012.xlsx','c7ff45e3e3192b36bae641e1346fd715498199389effa74341d812f22d8504d1','Fuente Rafa REG-DCC-IDP-012'],
];

describe('núcleo protegido Alba/Rafa',()=>{
  for(const [path,expected,label] of PROTEGIDOS){
    it(label+' no cambia accidentalmente',()=>{
      expect(sha256(path), `${label} cambió. NO actualizar este hash sin aprobación explícita de Rodrigo y justificación técnica.`).toBe(expected);
    });
  }
});
