# Catálogo v0 — Eventos y Living (maquila Von Haucke)

5 piezas de eventos (Barra Modular 118, Pedestal Esquinero 59, Periquera Equis, Mesa Imperial Equis, Cabina DJ 354)
y 4 de living (Tocador Hollywood, Escritorio Compañero, Mesa de Centro Guarida, Mueble TV Arenero), en 2 acabados
(Roble Mérida TX B806 y Black B721).

- `bom.mjs`: despiece de cada pieza, precios de última compra del ERP (`mp_erp_ultima_compra.csv`), nesting con
  `src/motor/optimizacionCorte.js` (lote de 10) y costo de fabricación con la fórmula de Alba (×1.8 fabricado, ×1.06 compra-venta).
  Escribe `bom.json`.
- `build.py` + `plantilla.html`: genera `catalogo.html` (planos SVG, fichas, comparación contra mercado).

Regenerar:

```bash
node docs/linea-eventos-living/bom.mjs && python3 docs/linea-eventos-living/build.py
```

Es una estimación para decidir qué prototipar, no una cotización. Supuestos y huecos de datos: sección "Lo que no sé" del catálogo.
