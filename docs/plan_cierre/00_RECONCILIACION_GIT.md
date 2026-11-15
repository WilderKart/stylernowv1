# Informe de reconciliación de Git (solo lectura)

Fecha: 2026-11-15. No se hizo merge, rebase, cherry-pick, reset, clean ni stash. Solo `git fetch --dry-run`, `branch`, `log`, `diff --stat`, `status`, `worktree list`.

## 1. Estado actual
| Elemento | Valor |
|---|---|
| Rama de trabajo | `audit/produccion-integral` en `46da7c5` |
| Divergencia contra `origin/main` | **2 commits solo locales / 10 solo remotos** (punto común `acf0118`) |
| Commits solo locales | `8ff404d` (auditoría, conciliación de pagos pendientes, migración 131) y `46da7c5` (prueba sin cobro, pago del plan por Checkout Pro, mora con gracia). 31 archivos, +2632/−26 |
| Cambios sin confirmar | 49 modificados, 1 borrado (`admin/admin-nav.tsx`), 37 sin seguimiento |
| Stash | vacío |
| `origin/main` | `fe9385c` |
| `main` local | `54fa998`, **39 commits por detrás** de `origin/main` |
| Worktrees | `stylernow` (esta rama) y `stylernow-hotfix` (`hotfix/sistema-mp` = `origin/main`) |

## 2. Hallazgo clave: la auditoría quedó un paso atrás
La auditoría leyó `origin/main` en `3386c3b`. Hoy `origin/main` está en `fe9385c`, **5 commits adelante**:
`fe9385c` (estado del sistema nombra credenciales MP faltantes), `2b72738` (CRM del Super Admin), `2592c96` (barra lateral y tablero) y los anteriores a `3386c3b` ya auditados. Esos commits **incluyen `137_admin_crm_usuarios_reportes_sistema.sql`**.

Consecuencia para los hallazgos:
- **H-002** cambia: la 137 ya está en `origin/main`. Sigue pendiente la discrepancia de versión de la migración de marketplace (`20261111000000_…` en el repositorio frente a la versión aplicada en producción) y verificar que el contenido de la 137 en git coincide byte a byte con lo aplicado (se hará en la Fase 2 con hashes).
- Todo lo que afecte `/admin/*` (H-008) debe re-auditarse sobre `fe9385c`: `admin/usuarios/actions.ts` y `admin/sistema/page.tsx` son código nuevo.

## 3. Origen de los cambios locales sin confirmar
Agrupados por procedencia probable (a confirmar con diff por archivo antes de decidir nada):
| Grupo | Ejemplos | Probable procedencia |
|---|---|---|
| Ya en `origin/main` por otro commit | `admin/*`, `admin/usuarios/`, `admin/sistema/`, `admin/tablero.ts`, `registro/`, `lib/geo/`, `lib/imagen/`, `lib/sentry/`, `instrumentation*.ts`, `api/monitoring/`, migraciones 134–137 | Copias de trabajo de lo que otro agente/sesión ya publicó (Sentry `f45fa08`, registro `3adeef7`, admin). Riesgo de conflicto al hacer pull |
| Solo locales | `docs/auditoria_integral/`, `docs/auditoria_prelanzamiento/`, `docs/PRUEBA_MERCADOPAGO_SANDBOX.md`, `tests/load/`, `tests/e2e/`, `Estructura planes/`, `stylernow-prototipo/`, `.serena/`, `test-results/` | Material de auditoría y pruebas |
| Peligroso a vigilar | `supabase/scripts/limpieza_total_produccion.sql` (sin seguimiento) | Script de borrado total. **No debe ejecutarse ni confirmarse**; se recomienda moverlo fuera del repositorio o marcarlo explícitamente |
| Basura | archivo `svg]` en la raíz | Probable error de redirección; revisar y retirar con autorización |
| Solapamiento a verificar | commit local `46da7c5` frente a `04f0858` en `origin/main` (ambos “pago del plan por Checkout Pro con gracia”) | Misma función con commits distintos: conflicto muy probable |

## 4. Fuente de verdad propuesta
1. **Código desplegado y migraciones = `origin/main` (`fe9385c`)**. Es lo que Vercel sirve y a lo que el propietario hace push.
2. **Documentos de auditoría y pruebas** = carpeta local (no existen en `main`).
3. **Commits locales `8ff404d` y `46da7c5`** = candidatos a evaluar uno por uno; no se asumen válidos ni descartables.

## 5. Plan de reconciliación propuesto (requiere tu aprobación; no ejecutado)
1. Copia de seguridad previa, sin tocar nada: `git bundle create ../stylernow-respaldo-2026-11-15.bundle --all` más un zip de los archivos sin seguimiento (excluye `node_modules` y `.next`). Es solo lectura sobre el repositorio.
2. Crear un **worktree nuevo desde `origin/main`**: `git worktree add ../stylernow-cierre -b cierre/fase-0 origin/main`. Toda la Fase 0 ocurre ahí. La carpeta actual queda intacta.
3. Por cada commit local (`8ff404d`, `46da7c5`) y por cada grupo de archivos modificados: `git diff origin/main -- <archivo>` y decidir **portar, descartar por duplicado o reescribir**. Se presenta la tabla antes de actuar.
4. Los documentos de auditoría se copian al worktree nuevo (`docs/auditoria_integral/`, `docs/plan_cierre/`).
5. Nada se publica. El push lo haces tú.

## 6. Riesgos
| Riesgo | Mitigación |
|---|---|
| Perder trabajo sin confirmar (86 archivos) | Bundle + zip antes de cualquier paso; el árbol actual no se toca |
| Conflicto del pull por duplicados | No se hace pull sobre este árbol; se trabaja en worktree limpio |
| Que el commit local `46da7c5` contenga lógica de mora/prueba distinta a la ya desplegada | Comparación por archivo y por prueba antes de portar |
| Script de limpieza total ejecutado por error | Excluir de commits; revisión explícita |
