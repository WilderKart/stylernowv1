# Evidencias legales y Staff — registro de avance (trabajo LOCAL, sin commits)

Worktree: `C:\Users\karni\Documents\stylernow-evidencias` (rama `feat/evidencias-legales`, base main 6901871).
Base de datos: Supabase local (docker `supabase_db_stylernow`). Nada en producción. Informe final: `INFORME_FINAL.md`.

## Decisiones del propietario (2026-11-16)
- A: un solo vínculo activo por Staff (no cambiar).
- B: Cloudinary para archivos nuevos (privados/firmados cuando corresponda); no migrar existentes sin procedimiento + reversión.
- C: invitación con un único botón «CONTINUAR CON MI INVITACIÓN»; sin revelar públicamente si un correo existe.
- D: transición de 30 días para Staff existente; sin consentimientos retroactivos; al vencer se oculta quien no autorizó.
- E: Staff sin publicación vigente no recibe reservas por asignación automática; conserva funciones internas.
- Textos de Staff: BORRADORES (no definitivos hasta validación jurídica).
- F: sin IP ni navegador. G: sin borrado en cascada de evidencias; política de conservación = borrador pendiente.

## Fases
- [x] Fase 1: migración 146 (aceptaciones solo por función, hora del servidor, textos inmutables con huella).
- [x] Fase 2: migración 147 (repositorio `evidencia_legal` de solo anexión con cadena SHA-256; 103 evidencias previas importadas; manipulación detectable).
- [x] Fase 3: migración 148 + UI (invitación pública enmascarada, registro/ingreso con invitación, aceptación transaccional con autorización de tratamiento, perfil Staff con autorizaciones, lista de Staff del panel con estado, adaptador Cloudinary).
- [x] Fase 4: migración 149 + `/admin/evidencias` (búsqueda, detalle con texto exacto y huella, expediente descargable con motivo, verificación de cadena; cada consulta auditada).
- [x] Fase 5: `tests/sql/evidencias_145_149.sql` (≈110 comprobaciones, 10 actores) + suites previas + vitest/tsc/eslint. Resultados en `INFORME_FINAL.md`.

## Notas / contradicciones encontradas (requieren decisión del propietario)
1. Aceptación TÁCITA: al ingresar, los cambios NO materiales de Términos/Política se registran sin acción del usuario
   (regla vigente). No se cambió la regla; la evidencia la marca `ACEPTA_TACITA`. Decisión legal pendiente.
2. **Cron de registros abandonados (127) vs. evidencia.** Con 145 la aceptación se registra en el mismo instante del
   registro (antes de completar el perfil), así que toda cuenta abandonada tiene filas en `aceptacion_legal`
   (FK a `auth.users` sin cascada + trigger de inmutabilidad). Verificado en local: `delete from auth.users` falla con
   `aceptacion_legal_usuario_id_fkey`; el cron ignora el error (`eliminadas` no sube) y esas cuentas no se borran nunca.
   `evento_auditoria.actor_id` tiene la misma FK sin cascada (117). La evidencia central (146) NO depende de la cuenta
   (sin FK; probado). Opciones: (a) que el cron anonimice/inhabilite en vez de borrar (como hace la eliminación de cuenta
   de cliente, 099/100); (b) cascada en `aceptacion_legal` exceptuando al rol de Auth en el trigger de inmutabilidad
   (la copia inmutable queda en `evidencia_legal`); (c) registrar la aceptación solo al completar el registro (pierde el
   «mismo instante» que pide el encargo). No se tomó ninguna.
3. `completar_registro` (092) aceptaba textos sin casilla; ya no es invocable (128 le quitó el permiso). Sin acción.
4. Cloudinary no se usaba. Ahora hay adaptador (`src/lib/almacenamiento/cloudinary.ts`) activo solo con variables de
   entorno; evaluación y procedimiento de migración en `CLOUDINARY.md`. Prueba real contra la cuenta: pendiente de
   autorización (consume cuota).
5. Inmutabilidad y DBA: el trigger de 116 exceptúa a `postgres`/`supabase_admin`. Un DBA puede alterar `aceptacion_legal`,
   `texto_legal` o `evidencia_legal` por SQL directo; la cadena de hashes (146/148) lo detecta pero no lo impide. Es el
   comportamiento vigente de toda la plataforma; no se cambió.
6. `service_role` (la clave del servidor): en producción los default privileges le dan todo sobre las tablas y salta la
   RLS. Se le REVOCÓ escritura en `aceptacion_legal`, `texto_legal` y `evidencia_legal` (145/146): el servidor solo
   escribe por las funciones SECURITY DEFINER. `publicar_texto_legal` (CRM) sigue funcionando por ser DEFINER.
7. `verificar_cadena_evidencias` permitía a cualquier sesión con `session_user = postgres`; ahora exige SuperSU,
   `service_role` o ausencia total de JWT (sesión directa del DBA). Detectado por la suite nueva.
8. Los BORRADORES de Staff no entran por `registrar_aceptacion_legal` (solo textos VIGENTES); solo por `autorizar_staff`.
9. Las URL firmadas de Cloudinary no caducan (ver `CLOUDINARY.md`); una foto ya pública sigue accesible por su URL aunque
   el perfil deje de publicarse (igual que hoy con Supabase). Decisión pendiente si la foto debe ser privada.
10. Política de conservación/retención: borrador encargado al agente jurídico (repo principal, `docs/legal/`), pendiente de
    validación. Nada se conserva «indefinidamente» por decisión de este trabajo.
