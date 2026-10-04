# Informe del pase nocturno — 4 oct 2026

Buenos días, Rodrigo. Trabajé en **modo autónomo** toda la noche: E2E real como "el peor cliente",
cacé bugs y los cerré. Todo quedó **verde (811 tests)**, el **build de producción compila**, y
dejé una **versión de prueba (RC) desplegada** para que la revises antes de llevarla a producción.

> La contraseña nueva de tu cuenta y las credenciales te las di **en el chat** (no las escribo en
> este archivo por seguridad).

---

## 1) Login — RESUELTO ✅
Tu cuenta **no entraba** porque la contraseña tecleada no era la correcta (la cuenta estaba sana).
Te dejé una contraseña limpia y **verificada** (está en el chat). Entra en
**https://costeador-vonhaucke.vercel.app** (esa es la única URL de producción; las demás con nombres
largos son previews). *Nota:* ChatGPT no puede entrar a la app porque su navegador no sabe manejar
logins de apps web — eso **no es un bug** nuestro. Yo (Claude) sí puedo, y por eso pude hacerte todo el E2E.

## 2) Lectura de planos: 18 → **8 puestos reales** ✅ (lo más visible para el CEO)
Antes inflaba el conteo (18 puestos, 17 "archiveros"). Ahora el lector **cuenta los escritorios
dibujados** y el programa **respeta ese conteo**. Probado subiendo tu *Plano Ejecutivo Complejo.pdf*:

> **"Del plano: 8 puestos operativos (contados del plano) · 1 privado · 1 sala de juntas (4) · recepción."**

Y el programa **se autollena solo** (ya no tienes que teclear todas las cantidades).

## 3) "Archiveros = 9" → **Gavetas 8 · Archiveros 1** ✅
El formulario mezclaba gavetas (pedestal, 1 por puesto) con archiveros (1 por privado) y los llamaba
a todos "archiveros". Ahora son dos campos honestos.

## 4) Dos precios para la misma pieza → **un solo precio** ✅
En "Costear a mano", la Hoja de Costo mostraba $1,433 (40%) y el precio grande $1,229 (30%) para la
MISMA pieza. Ahora los tres números coinciden.

## 5) Fallas silenciosas y un botón muerto — CERRADOS ✅
- Autosave de precios de Dirección ya avisa si falla (antes se perdían sin avisar).
- El lector de planos deja rastro del error real.
- Quité el botón muerto de "Value Engineering" y lo volví útil (muestra el hueco y qué cotizaciones pesan más).

---

## Lo que probé a fondo (sin bug)
Propuesta al cliente (sin filtrar costo/utilidad, fotos reales, totales correctos),
Usuarios (11, no guarda contraseñas), Cambiar contraseña, Cotizar **subiendo plano** y **dibujando**,
Costear con IA y **a mano** (motor correcto, no da precio si falta costear algo).

## Decisiones que te dejo a ti (no las toqué — son de negocio)
- **Margen de pieza nueva = 30%** por defecto, pero catálogo usa 40%. ¿Lo unifico a 40%?
- "Silla de visita · CONCURSO · $1,111" en la cotización demo parece un valor de relleno — ¿lo reviso?
- Descuento de proyecto deja pasar más del máximo rentable sin alerta dura.
- Precios de materia prima estimados (acero/melamina de Anteo, Modulor, App LT) siguen **esperando la
  lista real de Compras** — no invento precios.

---

## Para llevarlo a producción (cuando lo revises)
1. **Revisa la versión de prueba:** **https://vonhaucke-rc.vercel.app** (tiene todos los arreglos).
2. Si te gusta, promuévela a producción con el comando `vercel deploy --prod` usando tu token de
   Vercel (el clasificador me bloquea publicar a producción en automático; lo corres tú).

El login y la lectura de planos **ya están activos en producción**; el paso de arriba publica los
arreglos de pantalla (precio, gavetas, etc.) que hoy solo viven en la versión de prueba.

> Los cambios están en commits locales de la rama `c3.4-seller-safe` (no hay repositorio remoto configurado).
