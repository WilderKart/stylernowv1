# Informe final — Invitación de Staff y Centro de Evidencias Legales

Fecha: 2026-11-17 · Worktree `C:\Users\karni\Documents\stylernow-evidencias` (rama `feat/evidencias-legales`, base `main` 6901871).
**Todo es local.** Sin commits, sin push, sin despliegues, sin migraciones remotas, sin cambios en producción, sin gastos, sin borrar datos.
Esperando tu aprobación antes de cualquier intervención en producción.

## 1. Qué quedó hecho (por fase)

| Fase | Resultado |
|---|---|
| 1. Cerrar debilidades | Las aceptaciones legales ya no se pueden falsificar ni borrar desde el navegador: solo por funciones del servidor, con la hora del servidor y la versión vigente. Los textos legales son inmutables y llevan huella SHA-256. |
| 2. Repositorio central | `evidencia_legal`: solo anexión, cadena de hashes, 103 evidencias previas importadas, manipulación detectable. |
| 3. Invitación y perfil de Staff | Un único botón «Continuar con mi invitación» (registro con correo bloqueado o ingreso, y vuelta a la invitación). Aceptación transaccional con autorización de tratamiento obligatoria. Perfil con autorizaciones, publicación independiente, voluntaria y revocable. Lista del panel con estado de cada profesional. Adaptador Cloudinary (apagado salvo variables de entorno). |
| 4. Centro de Evidencias | `/admin/evidencias` (solo SuperSU): búsqueda, historial, texto exacto con huella, expediente descargable (con motivo), verificación de cadena. Cada consulta y exportación queda en Auditoría. |
| 5. Pruebas | Ver §4. |

## 2. Archivos

**Migraciones nuevas (aplicadas solo en la base local):**
- `146_aceptacion_legal_solo_servidor.sql`
- `147_repositorio_evidencias_legales.sql`
- `148_staff_invitacion_y_autorizaciones.sql`
- `149_centro_evidencias_supersu.sql`

Orden obligatorio: 145 → 146 → 147 → 148 (147 usa el repositorio de 146; 148 lo consulta). No hay `down`: la reversión es restaurar un respaldo (producción hoy no tiene respaldo propio documentado; hacerlo antes de aplicar).

**Código modificado (20 archivos) y nuevo:**
- Invitación y registro: `src/app/invitacion/[id]/{page,actions,vista-invitacion}.tsx|ts`, `src/lib/invitaciones/invitacion-pendiente.ts`, `src/app/registro/{page,formulario-registro}.tsx`, `src/app/login/{page,actions,formulario-ingreso,registro-actions}.ts(x)`, `src/lib/auth/{aceptacion-legal,destino-inicial}.ts`, `src/lib/routing/route-registry.ts` (`/invitacion` pasa a pública).
- Staff: `src/app/staff/perfil/{page,actions,vista-perfil-staff}.tsx|ts`, `src/app/panel/staff/{page,lista-staff}.tsx`.
- CRM: `src/app/admin/evidencias/{page,actions,constantes,vista-evidencias}.ts(x)`, `src/app/admin/barra-lateral.tsx`.
- Cloudinary: `src/lib/almacenamiento/cloudinary.ts`, `next.config.ts` y `src/proxy.ts` (solo `img-src` de la CSP; con nota).
- Pruebas: `tests/sql/evidencias_145_149.sql`, `tests/cloudinary.test.ts`.
- Documentos: `docs/evidencias/{PROGRESO,CLOUDINARY,INFORME_FINAL}.md`.
- `webhook-mercadopago.ts` no se tocó.

**Documentos jurídicos (agente abogado, repo principal `docs/legal/`, sin commit):** `DICTAMEN_DATOS_TECNICOS_Y_RETENCION.md`, `REVISION_JURIDICA_BORRADORES.md`, `POLITICA_RETENCION_BORRADOR.md`, `INVESTIGACION_NORMATIVA.md`. Son borradores para validación humana; no los leí a fondo ni los he comparado con el código, así que tómalos como insumo, no como conclusión.

## 3. Matriz de permisos

Funciones nuevas (todas `SECURITY DEFINER`, `search_path` fijo, revocadas de `public`/`anon`/`authenticated` y concedidas solo a quien se indica):

| Función | anon | authenticated | service_role |
|---|:-:|:-:|:-:|
| `invitacion_publica` (negocio, correo enmascarado, estado) | sí | sí | — |
| `staff_es_publicable` | sí | sí | — |
| `invitacion_para_enrutar` (correo real, tiene_cuenta) | — | — | sí |
| `registrar_aceptacion_legal_registro` | — | — | sí |
| `registrar_aceptacion_legal` | — | sí (solo para sí) | — |
| `aceptar_invitacion_staff`, `autorizar_staff`, `revocar_publicacion_staff` | — | sí (solo para sí) | — |
| `estado_autorizaciones_staff` | — | dueño: su equipo · staff: solo él | — |
| `verificar_cadena_evidencias` | — | solo SuperSU | sí |
| `admin_buscar_evidencias`, `admin_evidencia_detalle`, `admin_expediente_evidencias`, `admin_verificar_cadena_evidencias` | — | solo SuperSU (+ auditoría) | — |
| `_evidencia_*`, `_registrar_evidencia`, `_rol_de_usuario`, `_staff_ultima_autorizacion`, `_verificar_evidencia` | — | — | — |

Tablas:

| Tabla | anon | Titular | Dueño del negocio | SuperSU | service_role |
|---|---|---|---|---|---|
| `evidencia_legal` | nada | lee lo suyo | lee lo de su negocio | solo por funciones auditadas | solo lectura |
| `aceptacion_legal` | nada | lee lo suyo | — | lee | solo lectura |
| `texto_legal` | lee | lee | lee | lee | solo lectura (publica por `publicar_texto_legal`) |

Nadie escribe directo en estas tres tablas por la API. La excepción vigente es el DBA (`postgres`/`supabase_admin`) por el diseño previo del trigger 116; la cadena de hashes lo detecta.

## 4. Resultados reproducibles (todos contra la base local)

```
docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/evidencias_145_149.sql
```
Resultado: `OK: evidencias_145_148 — todas las pruebas pasaron` (113 comprobaciones; 10 actores: anon, cliente, dueño A/B, staff A/B, invitados con correo verificado/sin verificar/expirado, intruso, SuperSU). Cubre: forja y borrado de aceptaciones, textos inmutables, RLS por titular y por negocio, tácita solo en cambios no materiales, borradores fuera del registro normal, invitación (correo ajeno, sin verificar, expirada, inexistente, repetida, tope del plan, un solo vínculo), publicación sin tratamiento / sin foto / revocada / re-autorizada, fin de la transición, manipulación detectada, SuperSU y auditoría de cada consulta, y borrado de cuenta sin perder evidencias.

Suites previas, repetidas tras los cambios, sin regresiones: `aislamiento_multiempresa.sql`, `seguridad_regresion.sql`, `registro_pendiente_127.sql`, `auditoria_123.sql` → todas pasan.

Otros: `vitest` 119 pasan (13 archivos; 7 son del adaptador Cloudinary, con la firma verificada contra el vector público de Cloudinary); `tsc --noEmit` limpio; `eslint` 0 errores (4 avisos previos en `tests/aislamiento/matriz.mjs`).

Prueba visual en navegador (build de producción local, puerto 3300, cuentas de prueba creadas solo en la base local): botón «Cambiar de cuenta» con sesión ajena; «Continuar con mi invitación» → ingreso con correo precargado y aviso; aceptar sin casilla se frena, con casilla se acepta; perfil con bienvenida y autorizaciones; subida de foto; autorizar publicación → aparece en el equipo público; `/admin/evidencias` redirige a quien no es SuperSU; como SuperSU: búsqueda por correo, historial, detalle con texto exacto y «huella verificada».

**No probado:** vista móvil de las pantallas nuevas, el flujo «sin cuenta → registro con correo bloqueado» en el navegador (solo por código y por SQL), el correo de invitación real y Cloudinary contra la cuenta real.

## 5. Decisiones que necesito de ti (contradicciones, no resueltas por mí)

Detalle en `PROGRESO.md` §Notas. Las que bloquean o cambian el despliegue:

1. **Cron de cuentas abandonadas (127).** Con 145 la aceptación se guarda al registrarse, así que toda cuenta abandonada queda con filas que impiden borrarla (verificado: falla por `aceptacion_legal_usuario_id_fkey`; el cron ignora el error y esas cuentas se acumulan). Opciones: (a) anonimizar/inhabilitar en vez de borrar; (b) permitir cascada solo al rol de Auth y conservar la copia en `evidencia_legal`; (c) registrar la aceptación al completar el perfil. Recomiendo (b) o (a); es una decisión legal/técnica tuya.
2. **Aceptación tácita** de cambios no materiales al ingresar: se mantiene como estaba y ahora queda marcada `ACEPTA_TACITA`. ¿Se conserva esa regla?
3. **Foto del Staff:** una URL pública sigue accesible aunque el perfil deje de publicarse. ¿Debe ser privada (con costo de URL firmada con vencimiento, de pago en Cloudinary)?
4. **IP y navegador:** la decisión F los excluye de las evidencias. Lo que propone el dictamen jurídico (p. ej. IP en el registro de seguridad con retención corta) cambiaría esa decisión; es tuya.
5. **Textos de Staff** siguen como BORRADOR: nada se publica como definitivo sin validación jurídica.

## 6. Para pasar a producción (solo con tu aprobación)

1. Respaldo de la base antes de nada (no hay uno propio documentado).
2. Aplicar 145 → 146 → 147 → 148 en ese orden (primero la base, luego el código) y correr la suite `evidencias_145_149.sql` y `seguridad_regresion.sql` contra una copia o rama de base, no contra producción en frío.
3. En producción la transición de 30 días empieza al aplicar 147 (se fija con `now()`) y se notifica al Staff existente; conviene aplicarla justo antes de desplegar el código.
4. Cloudinary: no hacer nada hasta que decidas (variables de entorno, prueba real, procedimiento de `CLOUDINARY.md`).
5. Nota de seguridad: `src/proxy.ts` cambió solo en `img-src` (Cloudinary). Revisar antes de mezclar con otras ramas que lo toquen.

## 7. Limpieza local pendiente (no hecha a propósito)

Cuentas y datos de prueba en la base local (`ev-*@stylernow.test`, negocio «Barbería Evidencias», invitaciones y 2 evidencias de prueba). Los dejé hasta que digas «listo». La contraseña de prueba está solo en el directorio temporal de la sesión.
