// Mismo DESPIECE (req de 8-dto-servidor.json, tal como lo costeó el servidor en la corrida) con el motor ANTES y DESPUÉS.
import { it } from 'vitest';
import fs from 'node:fs'; import path from 'node:path';
const RAIZ = process.env.RAIZ; const CASOS = JSON.parse(process.env.CASOS);
it('replay', async () => {
  const { conAcompanantes } = await import(path.join(RAIZ, 'src/datos/autoInsumos.js'));
  const { calcular, PARAMETROS_DEFAULT } = await import(path.join(RAIZ, 'src/motor/calculo.js'));
  const { INSUMOS_SEMILLA, mapaInsumos } = await import(path.join(RAIZ, 'src/datos/insumos.js'));
  const ins = mapaInsumos(INSUMOS_SEMILLA); const out = {};
  for (const [clave, dir] of CASOS) {
    const f = path.join(dir, '8-dto-servidor.json'); if (!fs.existsSync(f)) continue;
    const req = JSON.parse(fs.readFileSync(f, 'utf8')).req;
    const comps = conAcompanantes(req.pieza.componentes.map((c) => ({ ...c })), ins);
    const r = calcular({ ...req.pieza, componentes: comps }, req.cantidad || 1, ins, PARAMETROS_DEFAULT);
    out[clave] = { material: Math.round(r.materialTotal * 100) / 100, costo: Math.round(r.costoUnitario * 100) / 100, renglones: comps.length, sinMaterial: comps.filter((c) => !c.insumoId && !c.excluida).map((c) => c.nombre) };
  }
  fs.writeFileSync(process.env.SALIDA, JSON.stringify(out, null, 1));
});
