# TELCEL C-CO-320R — los 4 módulos EN VIVO costeando por material (producto_maestro)

Fecha: 2026-11-08 · prod `mtuvnbgljwbsaizjjgzs` · autorizado por Dirección.
Supersede TELCEL_HORIZONTAL_EN_VIVO.md (cubre los 4 módulos).

## Qué quedó vivo
Las 4 claves TELCEL pasaron de **AGREGADO_HISTORICO** (1 línea, sin desglose) a
**BOM_DETALLADO_VERIFICADO** con cantidades físicas reales (de explo_x_id, col `consumo_unitaruio`)
mapeadas al catálogo. El motor las cuesta por material a precio certificado de hoy; los huecos
(precio o identidad faltante) caen a precio histórico → **orientativo**, nunca se inventan.

| clave | líneas | material hoy | cosFab | estado motor |
|---|---|---|---|---|
| TELCEL-VH-HORIZONTAL | 9 (9 vigente) | $4,583.50 | $6,187.73 | emitible · **certificable** |
| TELCEL-VH-TORRE | 8 (7 vigente + 1 hist) | $3,074.65 | $3,397.49 | emitible · orientativo |
| TELCEL-VH-ISLA | 11 (9 vigente + 2 hist) | $3,272.16 | $4,417.42 | emitible · orientativo |
| TELCEL-MOD-ALMACEN | 8 (6 vigente + 2 hist) | $3,624.67 | $4,893.30 | emitible · orientativo |

Verificado corriendo el `costearBOM` real de prod: 0 bloqueos en los 4.

## Huecos que faltan para que los 3 orientativos sean certificables
- **Torre:** la pintura de $506.09 (consumo 1.127 kg) no trae opción/color en el origen → Ingeniería
  da el color (opción) y se mapea al `erp-pph-*` correcto.
- **Isla:** claves `LN1838` (lámina negra 3x8 cal.18) y `LN2038` (3x8 cal.20) no existen en el
  catálogo → Compras/Ingeniería las dan de alta con precio.
- **Almacén:** 2 líneas sin Artículo ($722.46 + $450.00) → Ingeniería las identifica.
- **General:** confirmar frescura de pintura A529/A10 (precio 2018/2020 firmado por Dirección).

## Verificación honesta
- Dato + motor: **verificados** (costearBOM de prod, al centavo, con reconciliación de cantidades).
- Navegador autenticado: **NO probado aquí** (no hay sesión de UI). Falta el clic final en la app.

## ROLLBACK (sólo Dirección) — volver a agregado
```sql
update public.producto_maestro set
  lineas = ('[{"desc":"Material total (agregado de estimaciones; desglose por linea pendiente)","cantidad":1,"insumoId":null,"esCompraVenta":false,"precioConfirmado":'||material_real||'}]')::jsonb,
  tipo_bom='AGREGADO_HISTORICO', actualizado_en=now()
where clave in ('TELCEL-VH-HORIZONTAL','TELCEL-VH-TORRE','TELCEL-VH-ISLA','TELCEL-MOD-ALMACEN');
```

## El loop de aprendizaje (diseño — pendiente deploy de frontend)
Para "cada mueble que un humano confirma se vuelve BOM certificable" (lo que de verdad acerca a
"cuesta cualquier producto"):
1. **Backend** (RPC gobernada, lista para crear): `guardar_producto_maestro(clave, nombre, lineas,
   factor_mo, factor_gif, material_real)` con `security definer` que exige rol Dirección
   (`puede_certificar_costo()`), hace upsert en `producto_maestro` y registra quién/cuándo. Es
   exactamente lo que se hizo a mano aquí, pero como función auditable.
2. **Frontend** (requiere PR + deploy Vercel): botón "Confirmar despiece → guardar como Producto
   Maestro" en el flujo COSTEAR, que toma el despiece de VONI confirmado por la persona y llama la
   RPC. A partir de ahí esa clave cuesta por material y es certificable.
3. Resultado: la biblioteca de BOMs certificados crece con cada mueble confirmado.
