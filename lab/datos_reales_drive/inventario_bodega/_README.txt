CATALOGO DE MOBILIARIO EN BODEGA (8) MODIFICADO 14 FEB. (varias versiones: "(1)", "(8) MOD 14 FEB", etc.)
id 1atUxZ9qPpXFYUm5-32fZSmJ9bkvzUcrP (version (8) MOD 14 FEB) y 1eg09zB-4q3JUBvq-YK6Iwbnj08bCA0SW (version (1)).

Inventario fisico de PRODUCTO TERMINADO en bodega. Columnas del archivo: No., Clave, Imagen, Descripcion,
Cantidad, P/U, Salidas, Existencia Final, Almacen Fisico, Observaciones.

- El P/U es PRECIO DE VENTA de producto terminado (no costo de MP). Por eso NO alimenta precios_vigentes_master.csv.
- Se capturaron VERBATIM los 34 primeros renglones (los que traen P/U con importe) en inventario_mobiliario_bodega_PT.csv.
- Renglones 35-118: inventario real con clave/descripcion/cantidad/existencia pero con P/U = "$-" (vacio):
  son principalmente producto terminado y modulos compuestos (Bespoke BSFIE*/BSPM*, Eclipse EC*, Modulor MOG*,
  Anteo ANG*, prototipos, JLR LRUDP/LRUDPW, gondola F12063). Claves y descripciones estan en el archivo original.
- No se pudo volcar como CSV limpio completo: el xlsx supera el limite de descarga de 10 MB (lleva imagenes
  embebidas) y el export de texto es solo en linea. Se transcribio verbatim lo legible con P/U.
