import { readFileSync } from 'node:fs';
const lineas = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const FUENTE = 'explo_x_id C-CO-320R despiece cuantificado (consumo real) + catalogo vigente; huecos a historico orientativo; autorizado Direccion 2026-11-08';
let sql = 'begin;\n';
for (const clave of Object.keys(lineas)) {
  const arr = JSON.stringify(lineas[clave]).replace(/'/g, "''");
  sql += `update public.producto_maestro set lineas='${arr}'::jsonb, tipo_bom='BOM_DETALLADO_VERIFICADO', fuente='${FUENTE}', actualizado_en=now() where clave='${clave}';\n`;
}
sql += `select clave, tipo_bom, jsonb_array_length(lineas) as n, material_real from public.producto_maestro where clave like 'TELCEL%' order by clave;`;
process.stdout.write(sql);
