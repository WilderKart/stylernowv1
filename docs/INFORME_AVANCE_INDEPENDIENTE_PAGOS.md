# Informe: avance independiente del proveedor de pagos

**Directiva:** de continuidad, "avanzar funcionalidades independientes del proveedor de pagos".
**Fecha:** 2026-11-12.
**Alcance:** todo se verificó en Supabase local (Docker). **Nada se aplicó en producción, no se desplegó a Vercel y no se hicieron commits.**

## Estado por área

| Área | Estado | Depende del proveedor | Pruebas |
|---|---|---|---|
| Libro financiero | Implementado y verificado en local (migración 122, `/panel/libro`, `/admin/libro`) | No: es neutral | `tests/sql/libro_122.sql`: 12 OK. `tests/libro.test.ts`: 7 OK |
| Exportaciones | CSV (protegido contra inyección de fórmulas) y Excel (exceljs, que ya era dependencia) | No | Unitarias de CSV y filtros. El build compila `/api/libro/exportar` |
| Auditoría administrativa | 71 acciones inventariadas: 25 completas, 35 con antes y después, 9 pendientes (migración 123) | No | `tests/sql/auditoria_123.sql`: 19 OK. `tests/auditoria.test.ts`: 7 OK |
| Notificaciones | Outbox, plantillas, preferencias y adaptadores para email (Resend) y web push (RFC 8291/8292) (migración 124) | No, es infraestructura. El envío real necesita credenciales | `tests/sql/notificaciones_124.sql`: 19 OK. `tests/notificaciones.test.ts`: 15 OK |
| Seguridad | Hotfix P0 verificado. Corregidas 13 fallas más (1 P0) y endurecido el patrón NULL (migraciones 125 y 126) | No | `seguridad_regresion.sql`: 4 bloques OK. `aislamiento_multiempresa.sql`: 15 OK (31 lecturas, 67 escrituras, 30 inserciones y 95 RPC rechazadas por actor). `hotfix_staff_nulo_verificacion.sh`: OK |
| Anticipos y devoluciones | **Sin modificar**, por decisión del dueño | Sí | Las suites existentes 116–119 siguen pasando |
| Split Payments | **Sin modificar** | Sí | Ídem |

## 1. Estado inicial del repositorio

- **Rama:** `feat/cliente-17-pantallas`, con 64 archivos sin commit de la directiva anterior.
- **Migraciones:**
  - 001–121 escritas;
  - en producción, aplicadas hasta la 113;
  - 114–121 y el hotfix, pendientes.
- **Base local:** levantada con las migraciones 001–121 y 3 suites SQL en verde (51 verificaciones).
- **Verificaciones de código:** `tsc`, `vitest` (52) y `next build` en verde.
- Documento de reanudación: `docs/CONTINUIDAD_DIRECTIVA.md`.

## 2. Funcionalidades encontradas (relevantes para esta directiva)

- **Finanzas:**
  - `wallet` y `wallet_movimiento`, heredados del modelo de custodia, con saldo mutable;
  - `pago` y `reembolso`, con máquina de estados (116/119);
  - **no existía un libro por entidad ni exportaciones financieras.**
- **Auditoría:** `evento_auditoria` era inmutable desde la 117. De 71 acciones que modifican datos, 31 solo registraban el nombre de la acción y 26 no registraban nada. La auditoría no guardaba origen ni id de petición.
- **Notificaciones:**
  - solo había avisos dentro de la app (093);
  - `notificacion_envio` (004) marcaba "enviado" desde que se insertaba la fila;
  - tres envíos directos a Resend sin cola;
  - **no había push** (sin handler en `sw.js`).
- **Seguridad:** el P0 de `cancelar_reserva` y `completar_venta_pos` ya estaba identificado y tenía hotfix.

## 3. Funcionalidades implementadas

### Fase 1: libro financiero (migración 122)

- **Tabla `libro_movimiento`** de eventos inmutable:
  - Ni service_role puede hacer UPDATE ni DELETE, y no hay INSERT directo.
  - Separa la entidad (NEGOCIO / PLATAFORMA) y la categoría (13 categorías).
  - Separa el sentido (INGRESO / EGRESO / INFORMATIVO) y el estado (PENDIENTE / CONFIRMADO / FALLIDO / REQUIERE_REVISION / INFORMATIVO).
  - Guarda las referencias a pago, reembolso y reserva, el proveedor, el id externo, el actor, el motivo y el detalle.
- **Se genera solo**, con triggers sobre `pago`, `reembolso`, `reserva` y `gift_card_redencion`. Nadie lo escribe a mano.
- **Clave idempotente por hecho:** los webhooks repetidos no duplican movimientos (probado con 3 aprobaciones del mismo pago).
- **Evidencia:**
  - Un pago en línea APROBADO sin id de transacción queda como `PAGO_SIN_EVIDENCIA` / REQUIERE_REVISION, nunca confirmado.
  - Un reembolso solo queda CONFIRMADO cuando `reembolso` llega a REEMBOLSADO.
  - Los reembolsos anteriores a la 116, sin confirmación guardada, entran en revisión.
- **Comisión:** se registra solo si es mayor que 0. Queda como egreso del negocio e ingreso de StylerNow.
- **Ingresos de StylerNow:** van como ingreso de la plataforma, con su egreso espejo en el libro del negocio que pagó.
- **Ajustes:** solo SuperSU, con motivo obligatorio y siempre vinculados al movimiento original, que no se toca.
- **`libro_totales`** es SECURITY INVOKER (respeta la RLS) y agrupa por mes, entidad, categoría, sentido, estado y moneda.
- **Carga histórica** idempotente: reservas, pagos y reembolsos existentes.
- **Lo que no es:** no hay saldos disponibles, dinero retirable ni billeteras nuevas. La interfaz aclara que es un registro y no dinero en custodia.
- **Aplicación:**
  - `src/lib/libro/filtros.ts` (validación zod; la referencia solo admite `[A-Za-z0-9-]` para evitar inyección en filtros de PostgREST);
  - `src/lib/libro/consultas.ts` (siempre con el cliente del usuario, así que aplica la RLS);
  - `/api/libro/exportar` (el alcance sale de la sesión y el negocio del navegador se ignora);
  - el componente `components/libro/vista-libro.tsx`, que funciona sin JavaScript de cliente.

### Fase 2: auditoría (migración 123), detalle en `docs/AUDITORIA_COBERTURA.md`

- **Columnas nuevas:** `origen` (PANEL / API / SISTEMA / SQL) y `request_id`. `src/proxy.ts` genera `x-request-id` y siempre pisa el del navegador.
- **Trigger al insertar en `evento_auditoria`:**
  - borra de forma recursiva las claves con forma de secreto;
  - completa origen y petición;
  - toma el motivo de la cabecera `x-auditoria-motivo`, así las RPC antiguas no cambian de firma.
- **Trigger genérico de antes y después en 44 tablas:**
  - configuración global, planes, precios, países, IA, flags, ciudades y banners;
  - negocio, suscripción, vínculos de staff y `perfil.es_supersu`;
  - cambios de estado de reserva, pago, reembolso, gift card y reseña;
  - configuración del negocio y CRM (sin el texto de las notas).
- **Lectura:** `auditoria_listar` y `auditoria_entidades`. El dueño ve solo su negocio y SuperSU ve todo. Se bloqueó también TRUNCATE.
- **Pantallas:** `/admin/auditoria` y `/panel/auditoria` muestran el diff campo a campo, motivo, origen, petición, filtros y paginación. `/admin/planes` exige motivo.

### Fase 3: notificaciones (migración 124)

- **Tablas:** catálogo de 23 eventos, 138 plantillas es/en (con override opcional por negocio), preferencias, suscripciones push, outbox e historial de solo inserción.
- **Máquina de estados por trigger:** PENDIENTE, PROCESANDO, ENVIADO, FALLIDO, REINTENTANDO, CANAL_NO_HABILITADO y OMITIDO_PREFERENCIA. ENVIADO exige `id_externo`.
- **Encolado idempotente:**
  - lo comercial exige consentimiento y se vuelve a verificar al enviar;
  - el correo de los eventos esenciales no se puede desactivar.
- **Productores:**
  - reservas: creada, confirmada, reprogramada, cancelada, completada, no-show y recordatorio;
  - negocio: nuevo cliente, nueva reserva y cambios;
  - planes: prueba por terminar, vencido, suspendido y reactivado;
  - pagos y reembolsos: solo desde estados confirmados en la base.
- **Worker:**
  - toma lotes con `SKIP LOCKED` y un lease de 10 minutos;
  - reintenta con backoff de 2^n minutos, hasta 5 intentos;
  - marca CANAL_NO_HABILITADO cuando faltan credenciales, y reencola cuando el canal se habilita.
- **Adaptadores neutrales:** Resend, solo con `RESEND_API_KEY`. Web push sin dependencias nuevas, con vector RFC 8291 verificado, firma VAPID y lista de endpoints permitidos contra SSRF. Un adaptador "no habilitado" para el resto.
- **Interfaz:** preferencias y activación de push en `/notificaciones`, más los handlers `push` y `notificationclick` en `public/sw.js`.

### Fase 4: seguridad

- **Hotfix:** `tests/sql/hotfix_staff_nulo_verificacion.sh` reconstruye la versión vulnerable (la de producción), reproduce el ataque, aplica el script del hotfix tal cual y comprueba el bloqueo y la operación legítima del dueño.
- **`tests/sql/seguridad_regresion.sql`:**
  - intruso y dueño ajeno contra cancelar, POS, no-show y reprogramar con staff nulo;
  - operaciones legítimas de cliente, dueño y staff asignado;
  - **escaneo automático** del patrón de autorización que puede dar NULL (`=` y `<>` sin coalesce);
  - funciones internas expuestas.

  Si alguien reintroduce el patrón, la prueba falla.
- **Migración 126:**
  - seis funciones con `X <> auth.uid()` pasan a `IS DISTINCT FROM`. Eran seguras hoy, pero tenían el mismo patrón del P0;
  - se repone el cambio de `091b`, que la CLI se salta.

### Fase 5: aislamiento y calidad (migración 125)

Ver §8 para las fallas corregidas. Además:
- 29 índices sobre FK y filtros frecuentes;
- `panel/error.tsx`;
- etiquetas accesibles en la agenda y el CRM.

## 4. Archivos creados y modificados

**Migraciones:** `122_libro_financiero.sql`, `123_auditoria_completa.sql`, `124_notificaciones_outbox.sql`, `125_indices_y_endurecimiento.sql`, `126_endurecer_comparaciones_null.sql`.

**Pruebas:**
- SQL: `tests/sql/libro_122.sql`, `auditoria_123.sql`, `notificaciones_124.sql`, `aislamiento_multiempresa.sql`, `seguridad_regresion.sql`, `hotfix_staff_nulo_previo.sql`, `hotfix_staff_nulo_posterior.sql`, `hotfix_staff_nulo_verificacion.sh`.
- Unitarias: `tests/libro.test.ts`, `tests/auditoria.test.ts`, `tests/notificaciones.test.ts`.

**Código nuevo:**
- `src/lib/libro/{filtros,consultas}.ts`, `src/components/libro/vista-libro.tsx`, `src/app/{panel,admin}/libro/page.tsx`, `src/app/api/libro/exportar/route.ts`.
- `src/lib/auditoria/{motivo,listado}.ts`, `src/components/auditoria/visor-auditoria.tsx`.
- `src/lib/notificaciones/{estados,plantillas,web-push,adaptadores,mensaje,worker}.ts`, `src/app/notificaciones/{preferencias-actions.ts,preferencias-notificaciones.tsx}`.
- `src/app/panel/error.tsx`.
- `docs/AUDITORIA_COBERTURA.md` y este informe.

**Modificados:**
- `src/proxy.ts`, `src/lib/supabase/server.ts` (`x-request-id`);
- `src/app/admin/planes/*`, `src/app/admin/auditoria/*`, `src/app/panel/auditoria/*`;
- `src/app/notificaciones/page.tsx`, `public/sw.js`;
- `src/app/api/cron/diario/route.ts` (bloque `procesarOutbox`);
- `src/app/panel/agenda/vista-agenda.tsx`, `src/app/panel/crm/*` (accesibilidad);
- `src/lib/routing/route-registry.ts`, `src/components/panel/panel-nav.tsx`, `src/app/admin/admin-nav.tsx`.

## 5. Migraciones nuevas

Todas son aditivas y re-ejecutables (se aplicaron dos veces seguidas sin error) y no modifican migraciones históricas.

| # | Contenido | Toca dinero |
|---|---|---|
| 122 | Libro financiero, triggers de registro, ajustes, totales y carga histórica | No: solo registra |
| 123 | Auditoría completa: columnas, triggers genéricos, lectura aislada | No |
| 124 | Outbox de notificaciones, plantillas, preferencias, push y worker | No |
| 125 | 13 correcciones de autorización y 29 índices | No: no cambia la lógica de pagos |
| 126 | `IS DISTINCT FROM` en seis funciones y la 091b | No |

## 6. Cambios en políticas RLS

| Migración | Cambios |
|---|---|
| 122 | `libro_select`: SuperSU, o el dueño sobre filas de entidad NEGOCIO de su negocio. Sin escritura para ningún rol de API. |
| 123 | La política del dueño en `evento_auditoria` se re-crea con `negocio_id is not null and coalesce(is_barberia_de(negocio_id), false)`. service_role conserva solo INSERT. |
| 124 | Outbox, preferencias y suscripciones push: cada quien ve solo lo suyo. Las claves push no se leen por la API. Catálogo y plantillas sin acceso para clientes. |
| 125 | Se elimina el INSERT de clientes en `reserva_servicio`. Política RESTRICTIVE en `sede` (no se puede cambiar `negocio_id`). Se protegen `perfil.email`, `negocio.estado` y los valores de alta, además de los buffers y bloqueos de `reserva`, con triggers. |

## 7. Pruebas ejecutadas y resultados

Todas sobre una base limpia (`supabase db reset --local`, migraciones 001→126).

| Prueba | Resultado |
|---|---|
| `directiva_116_118.sql` | 20 OK |
| `cobro_directo_119.sql` | 11 OK |
| `whatsapp_120.sql` | 20 OK |
| `libro_122.sql` | 12 OK |
| `auditoria_123.sql` | 19 OK |
| `notificaciones_124.sql` | 19 OK |
| `aislamiento_multiempresa.sql` | 15 OK (5 actores × 223 intentos sobre el negocio B, más regresiones y accesos legítimos) |
| `seguridad_regresion.sql` | 4 OK, incluido el escaneo automático sin excepciones por patrón |
| `hotfix_staff_nulo_verificacion.sh` | Reproduce el ataque, lo bloquea y conserva el acceso legítimo |
| `npx vitest run` | 8 archivos, 81/81 |
| `npx tsc --noEmit` | Sin errores |
| `npx eslint src tests` | Exit 0 |
| `node tools/check-auth-coverage.mjs` | Sin problemas |
| `npx next build` | OK (incluye `/panel/libro`, `/admin/libro`, `/api/libro/exportar`, `/notificaciones`, auditorías) |

Las fases C, D, F, G y J siguen en verde con todo lo nuevo aplicado encima.

**Pruebas de integración:** se cubren con las suites SQL, que ejercen las funciones reales contra la base real. No hay E2E de navegador: necesita credenciales de sandbox.

## 8. Problemas detectados (y estado)

| Prioridad | Problema | Estado |
|---|---|---|
| P0 | `cancelar_reserva` y `completar_venta_pos` con staff nulo (producción) | Hotfix listo y verificado. **Sin aplicar.** |
| P0 | `iniciar_atencion_reserva` y `finalizar_atencion_reserva` con staff nulo: cualquiera pasaba una reserva ajena a EN_CURSO | Corregido en 125 (local) |
| P1 | Cuentas corporativas con `admin_user_id` NULL: crear 500 gift cards activas de otro negocio, alterar empleados, leer reportes | 125 |
| P1 | `perfil.email` editable por la API: robo de invitación de staff | 125. **Revisar en producción**, ver §12 |
| P1 | El negocio podía autoactivarse o nacer ACTIVO con plan SIGNATURE | 125 |
| P1 | El cliente podía editar buffers y bloqueos de su reserva (bloquear la agenda por meses) | 125 |
| P1 | El cliente podía insertar líneas de servicio con precio arbitrario | 125 |
| P2 | Un guardián podía mover su sede a otro negocio | 125 |
| P3 | `saldo_creditos_ia` de cualquier negocio, tickets a nombre de otro, reportes por sede | 125 |
| P3 | Seis comparaciones `<>` con el mismo patrón del P0, hoy seguras | 126 |
| Paridad | La CLI se salta `091b_…` en silencio | 126 la repone |

## 9. Riesgos pendientes

1. **Latencia de notificaciones:** el cron es diario, así que una confirmación puede tardar hasta 24 h. Hace falta un cron frecuente (cada 5 minutos) en Vercel que llame a `procesarOutbox`. No se agregó porque cambia la configuración de Vercel.
2. **Datos personales en el outbox:** los `datos` del outbox (nombres) no se anonimizan al eliminar una cuenta (099/100). La Privacidad v2 promete anonimización: hay que corregirlo antes de publicarla.
3. **Origen y motivo falsificables:** `origen` y el motivo por cabecera los puede fabricar quien tiene sesión, solo para sus propias acciones. Para hacerlo inviolable hay que firmar la cabecera en el servidor.
4. **`request.headers` sin probar en real:** falta confirmar que PostgREST de producción publique `request.headers` (en local se emuló).
5. **Correos duplicados:** puede haber dos correos cuando falla un cobro (el envío heredado más SUSCRIPCION_VENCIDA).
6. **Filtros del CRM:** traen todas las filas para intersecar en memoria. Se cortan en 1000 sin avisar en negocios grandes. Es un refactor a RPC.
7. **Lealtad e IA (P2 funcional):** en `src/app/panel/lealtad/actions.ts` la IA nunca se usa, porque llama `consumir_creditos_ia` con el cliente admin. Corregirlo empieza a consumir créditos: es decisión del dueño.
8. **Vínculos de staff (P3):** `vinculo_write_barberia` permite crear vínculos activos sin consentimiento de la persona.
9. **Accesibilidad:** los modales de la agenda no tienen `role="dialog"`, foco ni Escape.
10. **Auditoría pendiente (9 acciones):**
    - `/admin/configuracion` y `/admin/ai` no piden motivo;
    - 6 tablas sin `negocio_id` necesitan un trigger específico;
    - `admin_reintentar_reembolso` no escribe su motivo en `evento_auditoria`, solo en `reembolso_evento`.
11. **Wallet heredado:** `/panel/wallet` sigue mostrando el saldo del modelo de custodia. No se tocó (está dentro de lo excluido: distribución y custodia), pero choca con la idea de "sin saldos". Decisión pendiente.

## 10. Funcionalidades que requieren proveedor de pagos

- Ejecución real de cobros, reembolsos y split (OAuth por negocio ya construido; falta proveedor y credenciales).
- Conciliación automática del libro contra el proveedor (el libro ya guarda `proveedor` e `id_externo` para hacerlo).
- Checkout de recargas de WhatsApp.
- Renovación automática de planes (cobro recurrente).
- Pruebas E2E de pago y reembolso en sandbox.

## 11. Funcionalidades que requieren decisiones de negocio

1. Proveedor de pagos definitivo (Mercado Pago, OnePay, Cobre, Rapyd…) y modelo de anticipos y devoluciones.
2. Comisión de los 95 negocios existentes.
3. Suspensión por impago: ¿qué pasa con las citas ya pagadas?
4. Verificación de mayoría de edad.
5. Wallet heredado (§9.11).
6. IA en sugerencias de lealtad (§9.7).
7. Publicación de los documentos legales (NIT y abogado).
8. Cuándo limpiar los datos de prueba (**no se borra nada hasta que el dueño diga "listo"**).

## 12. Instrucciones exactas para aplicar en producción

**Antes de empezar:**
- Hacer un respaldo (Supabase → Database → Backups, o `pg_dump`).
- Aplicar en el SQL editor, un archivo por vez y en orden.
- Si un archivo falla, se detiene y no se sigue con el siguiente.

1. `supabase/scripts/hotfix_2026_11_12_autorizacion_staff_nulo.sql`. **Urgente** e independiente.
2. Revisar si alguien ya explotó el punto de `perfil.email`:
   ```sql
   select p.id, p.email, u.email from public.perfil p join auth.users u on u.id = p.id
   where lower(p.email) is distinct from lower(u.email);
   ```
   Si devuelve filas, revisar sus vínculos de staff antes de seguir.
3. `114_cierre_bloqueantes_auditoria.sql`, que sigue pendiente de la sesión anterior.
4. `116`, `117`, `118`, `119`, `120`, en ese orden.
5. `122`, `123`, `124`, `125`, `126`.
6. Desplegar el código (rama actual) **después** de aplicar la base.
7. Más tarde, cuando haya NIT y revisión legal: `121`. La `115` va solo cuando exista el cobro directo con negocios conectados.
8. Configurar en Vercel:
   - `RESEND_API_KEY` y `VAPID_*` cuando se quiera activar el envío;
   - un cron frecuente para el outbox (§9.1).

No es necesario borrar nada de lo existente. Ninguna migración elimina tablas ni datos.

## 13. Orden recomendado de despliegue y reversión

El orden de despliegue es el de §12: **la base primero, el código después.**

La reversión (sin perder datos) va en orden inverso:

| Paso | Cómo revertir | Efecto |
|---|---|---|
| Código | Volver a desplegar el commit anterior en Vercel | Las tablas nuevas quedan sin uso y no estorban |
| 126 | Volver a ejecutar las definiciones previas de las seis funciones (son `<>` en vez de `is distinct from`) | No hay pérdida de datos. Normalmente no hace falta revertirla |
| 125 | Las correcciones de autorización **no deberían revertirse** (reabren fallas). Si un trigger nuevo bloquea un flujo legítimo, se hace `drop trigger` de ese trigger puntual. Los índices se borran con `drop index` | — |
| 124 | `drop trigger` de los productores de notificaciones en `reserva`, `pago`, `reembolso` y `suscripcion` | Detiene el encolado y conserva las tablas y el historial |
| 123 | `drop trigger` de `_trg_auditar_cambio` en las tablas auditadas y del trigger de inserción de `evento_auditoria` | La auditoría vuelve a ser la anterior. Las filas ya escritas se conservan |
| 122 | `drop trigger trg_libro_pago / trg_libro_reembolso / trg_libro_reserva / trg_libro_redencion` | El libro deja de crecer y lo registrado se conserva (es inmutable) |

En ningún caso se recomienda `drop table` de las tablas de libro, auditoría o reembolsos: son evidencia.
