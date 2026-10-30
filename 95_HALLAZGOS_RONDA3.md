# 95_HALLAZGOS_RONDA3 — ledger de la Ronda 3 (cierre funcional/económico/E2E)

**Fecha de apertura:** 2026-10-30. **Rama:** `claude/costing-app-architecture-psf02g`.
**HEAD de trabajo:** `be10782` (árbol idéntico al merge `d19557d` que fue a prod).
Regla: nada se marca "cerrado"/"95" sin evidencia reproducible con `archivo:línea` o traza real.
No se reabren hallazgos cerrados sin evidencia nueva. Se reutiliza evidencia válida (presupuesto de APIs de pago).

---

## FASE 0 — Verdad actual y regresiones (en progreso)

### 0.1 Suite de pruebas — VERIFICADO 2026-10-30
- `npm test` (vitest run) sobre el árbol que se desplegó: **3995 pruebas, 406 archivos, 0 fallos, 0 skips reportados**.
  Duración 188.8 s. Evidencia: ejecución en esta sesión (log en vivo). Esto cubre la red de regresión
  unitaria de BLN-01/04/10, motor, UI de dinero, cocrear, acomodo-recovery, edge imports, etc.
- `vite build`: verde (bundle index `index-BKArznAN.js`).

### 0.2 Manifiesto de producción — versiones DESPLEGADAS hoy (fuente: Supabase list_edge_functions)
Edges PROD (no-rc) activas, con versión:
| Edge | Versión prod | ezbr_sha256 (prefijo) |
|---|---:|---|
| costear-servidor | 18 | 107bd1fa… |
| analizar-mueble | 39 | 6fc1ffcc… |
| cotizar-texto | 19 | 75d012b7… |
| leer-plano-core | 9 | 8137faf6… |
| acomodar-espacio-recovery | 20 | f25b5df2… |
| generar-render | 32 | 73fd1119… |
| cotizar-servidor | 8 | d1aea9e9… |
| voni-council | 14 | 3d47d4c6… |

RC (no servidas por prod salvo CARRIL_RC): costear-servidor-rc v30, analizar-mueble-rc v8, leer-plano-core-rc v5,
acomodar-espacio-recovery-rc v3, generar-render-rc v5, cotizar-texto-rc v1.

> Nota de honestidad: el motor avanzado ya fue promovido a los slots prod (no-rc) en esta ronda previa
> (commit `e1a9449`). Las `-rc` quedan como banco de pruebas, no como ruta viva de prod.

### 0.3 Frontend a producción — merge+deploy ejecutado HOY (autorizado por Dirección)
- Merge `--no-ff` de la rama a `c3.4-seller-safe` → commit `d19557d` (push OK, `fece6c3..d19557d`).
- Delta real de bundle (6 archivos): pantalla Aprobar puentes (B2), BLN-01 fail-closed en `calculo.js`,
  perf de render en `AcomodoBase.jsx`.
- Vercel auto-deploy `dpl_4PPfKgethFsF8cF5Yw8Bg5G5xzpD` (target=production, commit d19557d).
- **Punto de rollback:** deploy `dpl_DuxmoFiMxZscSY1kf4Wv7SiuyMTn` (commit `fece6c3`), `isRollbackCandidate: true`.
- Confirmación de "en vivo" (hash de asset del dominio prod cambia de `index-BDj_J2fL.js`): _verificación en curso_.

### 0.4 Estado declarado de los BLN previos (a re-confirmar en esta ronda, sin reabrir sin evidencia)
| ID | Qué | Estado entrante | Cómo se re-verifica en R3 |
|---|---|---|---|
| BLN-01 | costo oficial fail-closed | CERRADO (test dedicado, en 3995 verdes) | regresión unitaria ✓; añadir guard-test si falta |
| BLN-02 | MO/GIF sin tarifas omitidas | modelo sólido; hallazgo MG-1 abierto (tarifa metal App LT) | MG-1 es decisión Dirección (B8) |
| BLN-03 | discrepancia App LT | ligado a MG-1 | idem |
| BLN-04 | unidades/cantidades/fracciones | CERRADO (fail-closed unidad incompatible) | regresión unitaria ✓ |
| BLN-05 | paridad cliente-servidor | CERRADO EN VIVO (al centavo, prod v18) | reutilizar evidencia (no re-quemar API) |
| BLN-06 | seguridad cuenta QA | hallazgo abierto (cuenta QA privilegiada) | FASE 9: remediación sin revelar credenciales |
| BLN-07 | foto→despiece | CERRADO EN VIVO (Gemini) | reutilizar evidencia |
| BLN-08 | renders Flash/Pro | CERRADO EN VIVO (generación+guardado) | FASE 7: falta FIDELIDAD industrial |
| BLN-09 | perfil metálico lineal incompatible | ABIERTO (credenza 9/12, 3 metálicos PENDIENTES) | **FASE 1: prioridad #1 de esta ronda** |
| BLN-10 | precio 0 sin bypass | CERRADO (precio-0 conocido, no bypass) | regresión unitaria ✓ |

---

## FASE 1 — BLN-09 (foto→costo completo)
_En progreso: mapeo del contrato de datos (analizar-mueble → normalizador UI → calculo.js) antes de tocar el motor._
_Regla dura del directivo: NO interpretar `anchoMM` como cantidad lineal; NO inventar longitudes; NO doble conversión/merma; NO romper App LT; NO cerrar por prueba unitaria._

(pendiente de completar con hallazgos del mapeo y el adaptador canónico)
