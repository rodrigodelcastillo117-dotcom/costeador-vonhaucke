# Auditoría "cliente exigente" — antes de la demo del martes

Fecha: 2026-08-17 · Auditor: cliente que nunca ha visto la app
Entorno: `http://localhost:5177/humo.html?solo=<pantalla>` (vite dev, 5 servidores vivos en 5173–5177; usé 5177)

> Este documento se escribe SOBRE LA MARCHA. Si termina abrupto, lo de arriba ya es válido.

## Método
Las 4 lentes en cada pantalla: **¿Truena? · ¿Sirve? · ¿Es creíble? · ¿Se puede mejorar?**
Pico TODOS los botones, escribo en TODOS los campos (largo, vacío, 0, negativo, 12.5, comillas, 99999).

---

## Aviso sobre el banco de pruebas (importante para leer los hallazgos)

En `humo.html` muchos botones reciben manejadores **stub** (`nada`): `onIr`, `setVista`,
`setEstado`, `onDescartar`, `onAgregar…`. Es decir: **que un botón de navegación no haga
nada en el banco NO es un bug**. Sólo marco como hallazgo lo que:
 (a) es estado interno del propio componente y no responde, o
 (b) es contenido/número que puedo contrastar contra otro lugar de la app, o
 (c) truena.
Cuando no puedo distinguirlo, lo digo.

---

## Bitácora

### 1) `Inicio` — `?solo=inicio` (monta 3: Inicio, panel cotizar, cotizar de línea)

**Monta:** ✅ 3 de 3. Sin errores en consola.

**Botones que había (11 en la pantalla Inicio):** tarjeta "Vas a la mitad / Seguir" ·
"Descartar todo" · "Empezar" (Dime qué pide el cliente) · "Costear" · 4 chips
(Cotizar de línea · Banco de precios · Presupuestos que ya hicimos · Especial a la medida) ·
"Ver todo lo de cotizar →" · "Ver el negocio (Dirección) →" · "Usuarios y accesos →".

**Los piqué TODOS.** Los 11 dan `cambio:false` — pero los 11 son `onIr`/`setVista`/`onDescartar`
stubbeados en el banco. **No lo cuento como bug.**

#### 🟠 HALLAZGO I-1 — "6 muebles" cuando son 17 muebles
La tarjeta de retomar dice **"Corporativo de prueba, S.A. de C.V. · 6 muebles $228,102"**.
La cotización tiene 6 **renglones**, pero las cantidades son 2+2+2+1+6+4 = **17 piezas**.
`Inicio.jsx:119` → `nPartidas = partidas.length`, y en la línea 172 se imprime como
"{nPartidas} mueble{s}". El vendedor le va a decir al cliente "seis muebles" viendo esto.
**Cómo se ve el martes:** alguien pregunta "¿6 muebles cuestan $228 mil?" y el número
suena carísimo. Debe decir "6 renglones · 17 piezas" o directamente 17.

#### 🟠 HALLAZGO I-2 — El mismo número mal etiquetado en "Mis cotizaciones"
En el panel *Cotizar*, la tarjeta **"Mis cotizaciones"** dice **"Tienes 6 en la lista."**
(`Inicio.jsx:295`, también `nPartidas`). Ahí "6" se lee como **6 cotizaciones**, cuando hay
**una sola** cotización. Dos lecturas distintas del mismo contador en dos tarjetas.

#### 🟡 HALLAZGO I-3 — "Descartar todo" usa `confirm()` nativo
`Inicio.jsx:182`. Es el único destructivo de la pantalla y su única red es un `confirm()` del
navegador. En la consola quedó registrado el texto completo. Funciona, pero:
 · rompe el look de la app en la demo (caja gris del sistema operativo);
 · **no se puede deshacer** y borra también el acomodo del plano.
Si en la demo alguien le pica por error, se pierde todo el trabajo en vivo. Sugerencia:
modal propio con "Deshacer" de 10 s.

#### ✅ Lo que SÍ es creíble
El total `$228,102` de la tarjeta **cuadra al peso** con la suma manual de las 6 partidas
(2×41,439 + 2×25,132 + 2×19,364 + 1×20,432 + 6×2,962 + 4×4,507 = 228,102).
Pendiente: contrastarlo contra el total de la Propuesta (ver más abajo) — ahí es donde
puede aparecer flete/IVA/descuento y dejar de cuadrar.

#### 💡 Mejorable
· La tarjeta "Vas a la mitad" no dice **cuándo** se trabajó por última vez.
· "Ver el negocio (Dirección) →" y "Usuarios y accesos →" van al pie, en gris chico, sin
  icono: en la demo no se ven. Si va a enseñar el Tablero, no lo va a encontrar rápido.

