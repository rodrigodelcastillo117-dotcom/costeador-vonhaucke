# Integración Intelisis → Costeador Von Haucke · contrato v1

## Objetivo

Conectar Intelisis sin acoplar el Costeador a una tecnología específica. TI puede
elegir **API/Web Service**, **vistas SQL Server de solo lectura** o **exportación
automática CSV**. Los tres caminos desembocan en el mismo contrato
`intelisis-v1`; el motor de costeo no cambia.

La regla es deliberadamente estricta: **Intelisis nunca es consultado desde el
frontend** y ningún dato de costo se considera autorizado sólo porque “vino del
ERP”. Debe conservar unidad, moneda, fecha y evidencia rastreable.

## Arquitectura

```
Intelisis
   │
   ├─ API/Web Service ──────┐
   ├─ vistas SQL read-only ─┼─> adaptador servidor/ETL
   └─ CSV automático ───────┘
                                  │
                                  ▼
                           contrato intelisis-v1
                                  │
                       validación + reconciliación
                                  │
                                  ▼
                      Supabase (histórico/versionado)
                                  │
                                  ▼
                     motor Costeador / VONI
```

No se permite:
- navegador → Intelisis;
- credenciales de Intelisis en variables públicas;
- escribir/modificar tablas del ERP;
- reemplazar un costo vigente sin guardar procedencia;
- inferir conversiones de unidades;
- convertir un dato faltante a 0.

## Orden recomendado de opciones

1. **Vistas SQL Server de solo lectura**: mejor equilibrio si TI puede exponerlas
   internamente de forma controlada.
2. **API/Web Service Intelisis**: preferida si la instalación ya tiene endpoints
   soportados y su costo/operación es razonable.
3. **CSV automático**: fallback seguro. Debe ser automático y versionado; no
   depender de “alguien exportó un Excel cuando se acordó”.

La app queda preparada para cualquiera de las tres.

## Primera fase: datos mínimos para costo de materiales

Pedimos una fila por artículo/material:

| Campo canónico | Obligatorio | Comentario |
|---|---:|---|
| `clave_erp` | sí | SKU exacto Intelisis |
| `descripcion` | sí | descripción del ERP |
| `proveedor` | deseable | proveedor de la compra usada |
| `unidad_compra` | sí | hoja, kg, m, pza, tramo, etc. |
| `unidad_consumo` | si difiere | unidad con la que costea el BOM |
| `factor_conversion` | si difieren | explícito; jamás inferido |
| `precio_compra` | sí | costo/precio de compra fuente |
| `moneda` | sí | v1: MXN/USD; EUR queda bloqueado hasta tener FX por moneda |
| `fecha_ultima_compra` | sí | formato YYYY-MM-DD y fecha calendario válida |
| `costo_mxn` o `tipo_cambio_mxn` | si moneda=USD | costo local real del ERP o TC del movimiento; nunca TC de hoy |
| `evidencia` | sí | OC, factura, folio o movimiento ERP |

Si alguno de los campos críticos falla, el registro queda **bloqueado** y no
puede transformarse en precio utilizable por el motor. Cada corrida recibe además
un `snapshot_id`/batch generado por el ingestor (archivo, request o lote SQL) para
poder reconstruir exactamente de dónde salió cada costo.

## Si Viviana elige SQL Server read-only

Pedir al técnico que exponga **vistas**, no acceso libre a tablas. Nombres
sugeridos (pueden llamarse distinto; lo importante son las columnas):

### `vh_app_materiales_v1`
- clave_erp
- descripcion
- unidad_compra
- unidad_consumo
- factor_conversion
- activo
- familia/categoria

### `vh_app_ultima_compra_v1`
- clave_erp
- precio_compra
- moneda
- costo_mxn y/o tipo_cambio_mxn cuando la compra no esté en MXN
- fecha_ultima_compra
- proveedor
- evidencia / movimiento_id / folio

### `vh_app_historial_compras_v1`
Mismos campos que última compra, pero una fila por movimiento. Sirve para
volatilidad, promedio/mediana y auditoría; no sólo para “el último número”.

Permisos del usuario técnico:
- SELECT únicamente sobre estas vistas;
- sin INSERT/UPDATE/DELETE;
- sin permisos DDL;
- restringido por red/VPN/IP si la infraestructura lo permite.

## Si Viviana elige API/Web Service

Pedimos endpoints equivalentes a esas vistas:
- maestro de artículos/materiales;
- última compra/costo con fecha y moneda;
- historial de compras.

Necesitamos del técnico:
- documentación del endpoint;
- método de autenticación;
- ambiente de pruebas;
- paginación;
- límites de llamadas;
- zona horaria/formatos de fecha;
- significado exacto de cada “costo” que Intelisis exponga;
- si una compra está en USD, el costo contabilizado en MXN o el tipo de cambio del movimiento.

La credencial vive sólo del lado servidor.

## Si Viviana elige CSV

Primera entrega recomendada:
`intelisis_materiales_YYYY-MM-DD.csv`

Encabezado canónico:

```csv
clave_erp,descripcion,proveedor,unidad_compra,unidad_consumo,factor_conversion,precio_compra,moneda,costo_mxn,tipo_cambio_mxn,fecha_ultima_compra,evidencia
```

Debe ser exportación automática cuando sea posible. Cada archivo se conserva
como snapshot/evidencia; una corrección genera un archivo nuevo, no reemplaza
silenciosamente el anterior.

## Segunda fase

Una vez estable el maestro/precios:

1. recetas/BOM aprobados;
2. operaciones y tiempos por centro de trabajo;
3. indirectos/política de reparto;
4. órdenes cerradas con costo real incurrido;
5. precio vendido.

Eso permite comparar por producto:
- **Costo oficial/canónico**
- costo calculado por el motor
- costo real de orden cerrada
- **Oportunidad industrial** (nesting, merma, retazos, eficiencia)

La oportunidad industrial nunca modifica el costo oficial.

## Reconciliación con Supabase existente

La base ya tiene:
- `insumos_catalogo`
- `insumo_precios`
- `producto_version_economia`

No se crea un segundo catálogo paralelo. Primero se resuelve el mapeo
`clave_erp → insumo_id`. Si no existe una correspondencia inequívoca, el
registro queda pendiente de conciliación.

Un dato validado se prepara para `insumo_precios` como:
- histórico, no overwrite destructivo;
- `estado='propuesto'`;
- `evidence_status='documentada'`;
- `requiere_validacion_compras=true`;
- fuente y evidencia obligatorias;
- `precio`/`precio_compra` operativos quedan normalizados a MXN; moneda, precio original y TC se conservan en `propiedades`.

Compras/Dirección sigue controlando cuándo se convierte en precio autorizado.

## Criterio de GO

La integración no se declara lista por “conectar”. Debe demostrar:

- 100% de registros con clave ERP;
- 100% de precios aceptados con moneda, fecha y evidencia;
- 0 conversiones de unidad inferidas;
- 0 costos desconocidos convertidos a cero;
- trazabilidad ERP → snapshot → precio histórico → costeo;
- reconciliación explícita ERP → insumo interno;
- backtest contra órdenes cerradas independiente del set usado para calibrar.

## Lo único que necesitamos decidir con TI

1. ¿API, vistas SQL read-only o CSV automático?
2. ¿Cuál campo de Intelisis representa **última compra real**?
3. ¿Cómo relacionamos esa compra con OC/factura/movimiento?
4. ¿Qué unidades guarda el ERP y dónde están sus conversiones?
5. ¿Hay historial de compras accesible?
6. ¿Intelisis contiene BOM/recetas y tiempos/órdenes de producción?

Con esas seis respuestas se puede conectar sin rediseñar el Costeador.
