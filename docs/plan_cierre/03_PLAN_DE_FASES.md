# Plan detallado de fases (0–7)

Regla común: antes de cada fase se presenta alcance y riesgos; al cerrar, se entregan los 12 puntos del apartado 13 del plan (hallazgos, archivos, diffs, riesgos, migraciones **solo locales**, pruebas aprobadas/falladas, capturas, evidencia, riesgos residuales, criterios, % actualizado). No se avanza sin tu autorización. Nada de despliegues, `supabase db push` ni pagos.

Todas las fases se hacen en el worktree `cierre/fase-0…` creado desde `origin/main` (ver reconciliación). Los porcentajes son **estimaciones de planificación**, no resultados.

| Fase | Hallazgos | Alcance | Prueba de cierre | Esfuerzo | Dependencias | % est. |
|---|---|---|---|---|---|---|
| **0** | H-001, H-005, H-016 | Worktree limpio, Supabase local, semilla, suite de aislamiento (3 capas), volcado cifrado + restauración ensayada | Matriz de aislamiento en verde; restauración cronometrada | 3–4 días | Docker; tu decisión sobre plan de backup | 35→45 |
| **Cloudinary** (transversal, tras Fase 0) | — | Módulo `src/lib/cloudinary/*`, firma en servidor, tabla `archivo`, sustituir 6 puntos de subida, CSP, cron de purga, pruebas de denegación | Pruebas de subida/lectura/borrado y de acceso ajeno; 0 usos de `storage.from()` | 3–4 días | Cuenta y credenciales (las pones tú) | +3 |
| **1** | H-005, H-008, H-009, H-010 | Autorización de acciones de `/admin/*` (incluido `admin/usuarios/actions.ts` nuevo), límite/validación de `registrar_visita_perfil`, contraseñas filtradas según plan, revisión RLS/RPC | Pruebas negativas UI + backend de los 6 escenarios | 3–5 días | Fase 0 | →55 |
| **2** | H-002 | Hashes de migraciones, recuperar 137 exacta, comparar `20261111…` con lo aplicado, reconstrucción de base nueva con `db reset` | Base nueva idéntica a producción (comparación de esquema) | 2 días | Fase 0 | →60 |
| **3** | H-003 | Lista de campos pendientes y contradicciones (NIT, razón social, términos vs cobro directo, anticipos, cancelaciones 24/2/50, consentimientos). **Sin inventar datos ni publicar** | Documento para el abogado; cero cambios publicados | 1–2 días + abogado | Tú / abogado | →65 |
| **4** | H-004, H-017 | OAuth por barbería, cifrado de tokens, webhook, anticipos, reembolsos, contracargos en **sandbox local**; sin excepciones de `live_mode` | Pruebas simuladas y sandbox; checklist de variables de Vercel entregado a ti | 4–5 días | Credenciales sandbox (tuyas), Fase 0/1 | →72 |
| **5** | H-011 | Suite Playwright de 5 perfiles (cliente, Super Admin, propietario, profesional, guardian) en 390×844, 768×1024, 1440×900 sobre datos de prueba | Suite verde y repetible; capturas | 5–7 días | Fase 0 (semilla) | →80 |
| **6** | H-006, H-012, H-013, H-015 | Cron y expiración de reservas, health checks y alertas, integraciones no configuradas (WhatsApp e IA Center se conservan), informe sobre Vercel Hobby (decisión y gasto son tuyos) | Pruebas de cron en local; alertas de Sentry; informe de plan | 3 días | Decisiones de gasto | →86 |
| **7** | H-014, H-018–H-025 | Rendimiento de la home (cache/TTFB), advisors, tablas internas/extensiones, objetivos táctiles, dependencias, ESLint, `security.txt`; H-020 (zoom) y H-025 (recepcionista) **solo tras tu decisión** | Mediciones antes/después; capturas; identidad brutalista intacta | 4–5 días | — | →90+ |

## Orden y paralelismo
- Fase 0 desbloquea todo lo que necesita pruebas con escritura (1, 4, 5).
- Cloudinary antes de la Fase 5 para no probar flujos de archivos dos veces.
- Fases 2 y 3 pueden avanzar en paralelo a la 1 (una es SQL de lectura, otra es documentación).

## Riesgos transversales
| Riesgo | Mitigación |
|---|---|
| Cambio de `origin/main` mientras trabajo (ya ocurrió: +5 commits) | Re-sincronizar el worktree y re-auditar archivos tocados por cada commit nuevo antes de cada cierre |
| Otro agente edita los mismos archivos | Worktree propio; no se tocan sus archivos sin diff previo |
| Declarar resuelto sin evidencia | Cada hallazgo cierra con prueba reproducible versionada |
| Gasto no autorizado | Backups, Vercel Pro, Cloudinary y staging quedan como **decisiones tuyas** |

## Decisiones que necesito de ti
1. ¿Apruebo el plan de reconciliación (bundle + worktree `cierre/fase-0` desde `origin/main`)?
2. ¿Docker Desktop (opción A) o staging (opción B) para el entorno aislado?
3. Backups: ¿autorizas evaluar un plan de pago o, por ahora, solo `pg_dump` cifrado?
4. Cloudinary: ¿cuenta existente y separación de entornos?
5. H-020 (zoom) y H-025 (recepcionista): mantengo tu decisión actual y solo los registro, salvo que digas otra cosa.
