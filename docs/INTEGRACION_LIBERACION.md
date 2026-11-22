# Integración de liberación — `release/integral-2026-11`

Fecha: 2026-11-22. Base: `origin/main` = `6901871` (lo desplegado hoy en producción, Vercel proyecto `stylernowv1`).
La base de producción tiene aplicadas las migraciones 001–144 (incluidas 139, 141, 142, 143, 144, 138 y 140). No existe 145 ni posteriores.
Esta rama NO se ha subido ni fusionado con `main`; nada de producción se tocó.

## 1. Mapa de ramas (Fase 0: topología real)

| Rama / worktree | Qué aporta | Migraciones originales | ¿Ya en producción? | Qué se hizo |
|---|---|---|---|---|
| `main` (`6901871`) | Todo lo desplegado: 001–144, registro por tipo de cuenta, Turnstile, autorización por reserva, para-negocios, correo, pagos (129–133), antiabuso (135), admin CRM (137), endurecimiento 138–144 | 001–144 | Sí (código y base) | Base de la rama. |
| `audit/produccion-integral` (`46da7c5` + instantánea `d06c39e`) | Auditoría integral, migración 131–133 y código de pagos/suscripción | 131, 132, 133 (+134–138 sin commitear, ya en main) | Sí: su código y sus migraciones ya están en `main` por otro camino (comparado archivo por archivo); `main` es posterior en `webhook-mercadopago.ts`, `ciclo-suscripciones.ts`, `vista-suscripcion.tsx` | No se integra código. Solo contribuye documentos (no integrados: informes de auditoría, ya preservados en esa rama). El `overrides` de `exceljs/uuid` de su `package.json` NO se aplicó (revisar aparte). Su pendiente (código anterior a `main`) se conservó en `d06c39e`. |
| `cierre/fase-0` (`c64c01a`, +`ef5425f`) | Fase 0 de cierre: 139–144 (ya en `main`, la rama está contenida en `main`); pendiente sin commitear: MAINTAIN, session_version, auditoría de server actions, verificación de filas afectadas | 145 (MAINTAIN), 146 (session_version) | 139–144: sí. 145/146 de esta rama: no | Se integró MAINTAIN (145) y la verificación de filas afectadas en `panel/sedes` y `panel/onboarding`. La 146 de session_version NO se integra (ver §4, decisión a). El código de registro/ingreso/para-negocios de esa rama ya estaba en `main` en su versión vigente. |
| `feat/autorizacion-reserva` | Autorización por reserva | 143, 144 | Sí (en `main`) | Nada. |
| `feat/evidencias-legales` (`78883d6`) | Repositorio de evidencias legales, aceptación legal solo servidor, invitación de Staff y autorizaciones, Centro de Evidencias SuperSU | 145–148 | No | Integrada (renumerada 146–149). |
| `feat/centro-cumplimiento` (`ce9ff18`) | Centro de Cumplimiento y PQRS (copias idénticas de 145/146/148 de evidencias) | 150–154 (+145/146/148 copia) | No | Integrada (renumerada 151–155; las copias coinciden con evidencias). |
| `legal/tawilstack-v4` (`7f5f16f`) | Textos legales TAWILSTACK (Términos v4, Política v3) + migración que los publica | 149 | No | Integrada (renumerada 150). |
| `feat/onboarding-v2` (`8d52b61`) | Onboarding de 4 pasos y verificación, roles por capacidades, función central de cupo, suscripción restringida, barberos adicionales (Fases 1, 2A, 2B) | 149–157, 160–164, 170–178 | No | Integrada (renumerada 156–177). |
| `hotfix/version-desfasada` (`fae1353`) | Recarga del navegador al cambiar la versión desplegada | — | No | Integrada. |
| Demás `hotfix/*`, `feat/brutalist-ui`, `feat/cliente-17-pantallas` | Ya contenidas en `main` (0 commits por delante) | — | Sí | Nada. |
| `release/integral-2026-11` | Esta integración + migración nueva 178 + cambios de la tarea | 145–178 | — | — |

Todas las ramas con trabajo sin commitear se commitearon primero en su propia rama (audit `d06c39e`, cierre `ef5425f`, evidencias `78883d6`, hotfix `fae1353`, onboarding `8d52b61`). Las ramas temporales `rel/*` (renumeración previa a la fusión) se conservan por trazabilidad.

## 2. Tabla FINAL de migraciones (145–178)

Dependencias: todas dependen de lo anterior en orden; se indican las específicas. «Ancla» = parchea funciones existentes con `pg_get_functiondef` + reemplazo por ancla (aborta con `ANCLA_NO_ENCONTRADA` si el cuerpo no coincide). Reversión = archivo `*_REVERSION.sql.txt` junto a la migración.

| Nuevo | Antiguo | Nombre | Depende de | Reversión | Ancla | Riesgo para datos |
|---|---|---|---|---|---|---|
| 145 | 145 cierre | quitar_maintain_a_roles_publicos | — | en el encabezado | no | Nulo (solo privilegios, solo PG ≥ 17) |
| 146 | 145 evid. | aceptacion_legal_solo_servidor | 116 | no | no | Medio: cierra la escritura directa de `aceptacion_legal` (requiere el código nuevo de aceptación); hace inmutables los textos legales |
| 147 | 146 evid. | repositorio_evidencias_legales | 146 | no | no | Bajo: tabla nueva append-only con triggers sobre tablas de aceptación |
| 148 | 147 evid. | staff_invitacion_y_autorizaciones | 146, 147 | no | sí (4 funciones) | Medio: columna `estado_juridico`, transición de 30 días para el Staff existente, textos de Staff en BORRADOR |
| 149 | 148 evid. | centro_evidencias_supersu | 147 | no | no | Bajo (solo lectura auditada) |
| 150 | 149 legal | textos_legales_tawilstack | 146 (huella), tabla `texto_legal` | no | no | Medio: publica Términos v3 y Política v3 con `cambio_material = true` (reaceptación para todos). Aborta si las versiones no son TERMINOS 2/3 y POLITICA 2 |
| 151 | 150 cump. | cumplimiento_catalogos_y_calendario | — | no | no | Bajo (tablas nuevas) |
| 152 | 151 cump. | cumplimiento_casos | 151; amplía `ticket_soporte` | no | no | Medio: `ticket_soporte.creado_por` pasa a admitir NULL; columnas nuevas |
| 153 | 152 cump. | cumplimiento_notificaciones_y_sla | 151, 152 | no | no | Bajo |
| 154 | 153 cump. | cumplimiento_evidencias | 147, 152 (escribe en `evidencia_legal`) | solo local | no | Medio: relaja `usuario_id NOT NULL` y los CHECK de `evidencia_legal` |
| 155 | 154 cump. | cumplimiento_adjuntos_y_consultas | 152, bucket privado | no | no | Bajo (bucket privado nuevo) |
| 156 | 149 onb. | limites_de_plan_servidor | 015 | no | sí (2) | Medio: topes de Staff por plan en el servidor; no retira a nadie |
| 157 | 150 onb. | onboarding_v2_y_verificacion | 147 | no | no | Bajo (tablas y columnas nuevas) |
| 158 | 151 onb. | modelo_roles_capacidades | 148 (misma `negocio_staff_publico`, `slots_disponibles`, `staff_perfil_publico`), 156 | sí | sí (5) | Alto: capacidades en `vinculo_staff_negocio`, columnas por plan |
| 159 | 152 onb. | funcion_central_de_cupo | 156, 158 | sí | sí (4) | Medio: unifica el criterio de cupo |
| 160 | 153 onb. | perfil_profesional_del_propietario | 157, 158, 159 | sí | sí (1) | Medio |
| 161 | 154 onb. | delegacion_administrativa_minima | 158, 159 (firma de `crear_invitacion_staff`) | sí | sí (2) | Medio: nuevas políticas de lectura |
| 162 | 155 onb. | invalidar_sesion_controlada | 158, 159 y trigger de 136 | sí | sí (3) | Medio: excepción de dos factores de `session_version` (decisión a) |
| 163 | 157 onb. | normalizacion_roles_existentes | 158, 160 | sí | no | ALTO: ESCRIBE datos de negocios existentes (retira el vínculo propio del propietario en planes que no son Essential; registra excesos). Pensada para base de pruebas; revisar antes de producción |
| 164 | 160 onb. | estado_operativo_suscripcion | 133, 118 | sí | sí (2) | Medio: estado operativo derivado de fechas |
| 165 | 161 onb. | suscripcion_ciclo_30_dias_bogota | 164, 133, 118, 090 | sí | sí (1) | Medio: ciclo de 30 días y gracia por fechas |
| 166 | 162 onb. | guardia_operativa_tablas | 164 | sí | no | Alto: triggers que bloquean escrituras con suscripción restringida (SUSCRIPCION_RESTRINGIDA) |
| 167 | 163 onb. | guardia_operativa_rpc | 164, 166 | sí | sí (2; parchea 35 RPC) | Alto: mismo bloqueo en las RPC |
| 168 | 164 onb. | config_suscripcion_superadmin | 164 | sí | no | Bajo |
| 169 | 170 onb. | adicionales_config_precios_fechas | 164 | sí | no | Bajo (tablas y configuración nuevas) |
| 170 | 171 onb. | adicionales_modelo_lotes | 169 | sí | no | Bajo |
| 171 | 172 onb. | adicionales_notificaciones | 124 | sí | no | Bajo |
| 172 | 173 onb. | adicionales_motor_estados_y_capacidad | 159, 170 | sí | sí (1: `_capacidad_profesional`) | Medio: suma adicionales a la capacidad |
| 173 | 174 onb. | adicionales_rpc_propietario | 170, 172 | sí | no | Bajo |
| 174 | 175 onb. | adicionales_integracion_pagos | 133, 170–173 | sí | sí (2: `aplicar_evento_pago`, planes) | Medio: separa pagos por concepto |
| 175 | 176 onb. | adicionales_mantenimiento_diario | 170–172 | sí | no | Bajo |
| 176 | 177 onb. | adicionales_rpc_superadmin | 169–172 | sí | no | Bajo |
| 177 | 178 onb. | adicionales_reembolsos_y_revision_admin | 170, 174 | sí | no | Bajo (cola de revisión; sin reembolso automático) |
| 178 | NUEVA | cron_diario_service_role_execute | funciones 008, 049/159, 067, 079 | sí | no | Nulo: concede EXECUTE a `service_role` a 4 funciones de mantenimiento (revoca de public, anon y authenticated) |

La numeración es contigua de 145 a 178 y sin duplicados. `20261111000000_marketplace_buscar_texto_ciudad_categoria.sql` (ya en producción) conserva su orden.

### Orden exacto de aplicación en producción (desde la 145)

`145 → 146 → 147 → 148 → 149 → 150 → 151 → 152 → 153 → 154 → 155 → 156 → 157 → 158 → 159 → 160 → 161 → 162 → 163 → 164 → 165 → 166 → 167 → 168 → 169 → 170 → 171 → 172 → 173 → 174 → 175 → 176 → 177 → 178`.
Una por una, cada una verificada antes de la siguiente. Reglas de orden que no se pueden alterar: 146 y 147 antes de 148, 154 y 157; 148 antes de 158 (las anclas de `negocio_staff_publico`, `slots_disponibles` y `staff_perfil_publico` esperan el cuerpo ya parcheado por 148); 156 antes de 159 y 161; 158 antes de 159–163; 164 antes de 165–167 y 169; 162 depende del trigger de la 136 (en producción); 170 antes de 172 y de 174.
El código y la base deben avanzar juntos: el código nuevo de aceptación legal exige 146; el de invitaciones exige 148; el de adicionales y suscripción restringida, 164–177. Sin las migraciones, esas pantallas fallan; sin el código, 146 rompería la aceptación legal desde la app actual. Por eso: base primero, luego código, con 163 revisada.

## 3. Cambios de código por tema

- **Evidencias legales**: aceptación legal solo servidor (`src/lib/auth/aceptacion-legal.ts`), registro/ingreso/invitación, centro de evidencias `/admin/evidencias`, `src/lib/invitaciones/`.
- **Invitación y autorizaciones de Staff**: `/invitacion/[id]`, `/panel/staff`, `/staff/perfil` (se combinaron las autorizaciones de evidencias con la tarjeta de visibilidad pública de onboarding).
- **Centro de Cumplimiento y PQRS**: `/solicitudes`, `/admin/centro-cumplimiento`, `src/lib/cumplimiento/`, cron diario.
- **Onboarding v2 y verificación**: pasos del onboarding, `/panel/verificacion`, `/admin/verificaciones`, `/api/verificacion`, `src/lib/almacenamiento/cloudinary.ts` (incluye documentos privados), geovalidación.
- **Roles y cupos**: `roles-equipo.ts`, `cupo.ts`, panel de staff, perfil profesional del propietario.
- **Suscripción restringida y estado operativo**: `src/lib/suscripcion/`, banner, avisos, `src/lib/prueba/`.
- **Barberos adicionales**: `src/lib/adicionales/`, `/panel/staff/adicionales`, `/admin/adicionales`, cron.
- **Cierre fase 0**: auditoría de server actions (`tests/server-actions-*`, `scripts/matriz-autorizacion.mjs`), verificación de filas afectadas.
- **Cambios de esta integración**: (1) `src/lib/pagos/sincronizar.ts`: TODO huérfano va a revisión, sin reembolso automático (motivos `HUERFANO_A_REVISION` y `REFERENCIA_NO_RECONOCIDA`); prueba `tests/sincronizar-huerfano.test.ts`; `webhook-mercadopago.ts` no se tocó. (2) Cloudinary acepta `CLOUDINARY_CLOUD_NAME` o `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (misma resolución en `next.config.ts`; el CSP de `src/proxy.ts` usa el host `res.cloudinary.com` sin nombre de nube, no necesita cambio). (3) Migración 178 y su reversión.

## 4. Decisiones del usuario aplicadas

- (a) Excepción de dos factores del trigger de perfil para `session_version`: está en la migración 162 (marca de transacción `stylernow.sv_autorizado` + rol que no sea de cliente). La 146 de la rama de cierre (bloqueo solo a `anon/authenticated`) se retiró: reemplazaría el trigger y haría fallar el ancla de la 162, además de dejar pasar a toda función definer.
- (b) Huérfanos con forma de UUID: a revisión, sin reembolso automático.
- (c) Renovación de lote al precio congelado: ya es así (170/173).
- (d) Cupos fungibles: ya es así (170/172).
- (e) Textos legales: se publican tal cual (150); sus fuentes y la migración coinciden (`node scripts/legal/verificar-sincronizacion.mjs`), sin marcadores que bloqueen. Los dos textos de autorización de Staff de la 148 siguen con `estado_juridico = 'BORRADOR'` (no bloquea su uso; queda en la evidencia con el sufijo «-borrador»): decidir si pasan a VIGENTE.
- (f) Resto de decisiones: en el backlog, sin implementar.

## 5. Verificación local (2026-11-22, resultados reales)

- Cadena completa de migraciones sobre una base Docker NUEVA y desechable (`release_check`, esquemas auth/storage tomados por `pg_dump --schema-only` de la base local en uso): los 180 archivos (001–178 y la de marketplace) se aplicaron sin error. La base desechable se eliminó (solo esa). Tuvo que relajarse la guardia de versiones de la 150, que solo admitía el estado de producción (TERMINOS 2/3) y fallaba en una base nueva (TERMINOS 1).
- `npx next typegen` + `npx tsc --noEmit`: sin errores (hubo uno real, t implícito en `/staff/perfil`, corregido).
- `npx eslint src`: sin errores ni avisos.
- `npx vitest run`: 18 archivos pasan, 4 omitidos (integración con Docker); el único fallo fue un tiempo de espera por carga de la máquina en `f0-01` (pasa aislado) y un defecto de `vi.hoisted` en la prueba nueva (corregido; ambas pasan).
- `npx next build --webpack`: compila (19,1 min), TypeScript y 110 páginas estáticas, exit 0.
- No se ejecutaron las suites SQL (`tests/sql/*`) ni las de integración: quedan pendientes antes de aplicar en producción, en especial las de 158 (roles), 163 (normalización), 166/167 (guardia operativa) y 174 (pagos de adicionales).

## 6. Pendientes y dudas para el coordinador

1. La 163 (normalización de roles) escribe datos de negocios existentes; fue pensada para una base de pruebas. Producción tiene negocios de prueba, pero hay que decidir si se aplica tal cual.
2. La 146 de session_version de cierre se retiró en favor de la 162 (ver §4a); si se quiere conservar igual, debe ir ANTES de la 162 y la 162 fallaría por ancla: no es compatible.
3. Textos de Staff (148) en BORRADOR: decidir si pasan a VIGENTE.
4. Las migraciones con ancla (148, 158–162, 164, 165, 167, 172, 174) se verificaron contra la cadena local desde cero, no contra el cuerpo real de las funciones en producción; confirmar con una copia de producción antes de aplicar.
5. El `overrides` de `exceljs/uuid` de la rama de auditoría no se aplicó.
5b. Las ramas temporales `rel/*` y los worktrees temporales de integración quedan solo como trazabilidad; se pueden borrar tras el despliegue.
