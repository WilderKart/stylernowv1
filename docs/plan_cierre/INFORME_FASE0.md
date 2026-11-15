# Informe de cierre de la Fase 0

Fecha: 2026-11-15. Alcance ejecutado: Git, entorno aislado, respaldos y restauración, pruebas de aislamiento, inventario Cloudinary. **No se tocó producción** (solo lecturas `select` y una lectura HTTP pública), ni Vercel, ni Supabase remoto, ni el script `limpieza_total_produccion.sql`, ni datos, ni gasto.

Todo el trabajo vive en el worktree `C:\Users\karni\Documents\stylernow-cierre` (rama `cierre/fase-0`, base `origin/main` = `fe9385c`). **Nada está confirmado (commit) ni publicado.** Tu carpeta `stylernow` sigue intacta.

## 1. Estado de cada tarea
| Tarea | Estado | Evidencia |
|---|---|---|
| Bundle y respaldo de lo local | Hecho y recuperado | `stylernow-respaldos/` (bundle 6,1 MB, 361 archivos, parche de rastreados, `SHA256SUMS.txt`). Clonado el bundle y comparados 361 archivos por hash: 0 diferencias. Sin `.env` |
| Worktree `cierre/fase-0` | Hecho | `git worktree list` |
| Diferencias local vs `origin/main` | Hecho | `DIFERENCIAS_LOCAL_VS_ORIGIN_MAIN.tsv`, `COMMITS_LOCALES_VS_MAIN.txt` |
| Supabase local aislado (Docker) | Hecho, reproducible en ~2 min | `scripts/entorno-local/reiniciar.sh` |
| Cuentas y datos ficticios (5 perfiles) | Hecho | `supabase/seed_pruebas.sql`, `seed_datos_ricos.sql` |
| Aislamiento multi-tenant, RLS, IDOR, escalada | Hecho (límites en §5) | `evidencias/matriz_aislamiento.json`, `tests/aislamiento/matriz.mjs` |
| `pg_dump` cifrado + restauración en Docker | Hecho | `scripts/respaldo/*`, huellas idénticas |
| Investigación de backups de Supabase | Hecho | §6 |
| Arquitectura Cloudinary + verificación del objeto + migración/reversión | Hecho (diseño; sin migrar) | §7 y `01_ALMACENAMIENTO_CLOUDINARY.md` |

## 2. Git: diferencias (resumen)
- De los **362** archivos locales modificados o sin seguimiento, **80 ya son idénticos a `origin/main`**, **4 difieren**, **277 existen solo en local** y 1 está borrado.
- Los 277 solo locales son: prototipo (168), `docs/auditoria_integral` (41), `tests/load` (29), `tests/e2e` (26), planes, `.serena`, etc.
- **Los 4 que difieren** (excluyendo saltos de línea):
  1. `package.json`/`package-lock.json`: añaden `overrides: exceljs → uuid ^11.1.1`.
  2. `src/proxy.ts`: conserva el `x-request-id` entrante como `x-request-id-origen`.
  3. `src/lib/pagos/webhook-mercadopago.ts`: firma con `x-request-id-origen` (ver hallazgo F0-01).
- Commit `8ff404d`: 5 archivos idénticos a main, 3 difieren (`package*.json`, migración 131), 7 solo locales (docs). Commit `46da7c5`: 12 idénticos, 1 difiere (`vista-suscripcion.tsx`), 11 solo locales (docs y legal).
- **Conclusión**: casi todo lo “sin confirmar” ya está en `main` por otras vías. Lo único con valor de código que falta en `main` son los 3 puntos de arriba. No se hizo merge ni se descartó nada.
- `limpieza_total_produccion.sql`: no está referenciado por `package.json`, CI, `vercel.json`, `config.toml` ni scripts (0 referencias). No se tocó. Recomendación: no confirmarlo al repositorio.

## 2.1 Reconstrucción de una base nueva (cierra el análisis de H-002)
Se aplicaron las 139 migraciones del repositorio a una base vacía y se compararon con producción (solo lectura):
| Comparación | Resultado |
|---|---|
| Tablas / funciones / políticas / triggers / índices / vistas | 138 / 649 / 231 / 121 / 450 / 3, **idénticos** |
| Políticas (hash) y columnas (hash) | **idénticos** |
| Privilegios de ejecución `anon`/`authenticated` (hash) | **idénticos** |
| Cuerpo de funciones | 15 difieren solo por comentarios/espacios; **1 difiere en lógica**: `admin_set_pais` (producción inserta el evento de auditoría sin la columna `motivo`; el repositorio la pasa como `null`; equivalente en efecto) |
| Migración 137 | Ya está en `origin/main`; produce el mismo esquema que producción |

Obstáculos reales de reconstrucción (nuevos, P2):
- **F0-02** `supabase db reset` **omite `091b_consentimiento_clock_timestamp.sql`** (no cumple `<timestamp>_nombre.sql`), pero producción **sí** la aplicó. Una base reconstruida con la CLI queda distinta.
- **F0-03** En Windows, con `core.autocrlf=true`, los `.sql` se extraen con CRLF y **la migración 114 falla** (“No se pudo parchear crear_plan_membresia”) porque busca `\nbegin\n`. Se propone `.gitattributes` con `eol=lf` (ya añadido en el worktree).
- La migración de marketplace sigue con versión `20261111000000` en el repo y `20261111040456` en producción (historial desalineado; pendiente de decidir en la Fase 2).

## 3. Entorno aislado
- Docker Desktop, proyecto `stylernow-cierre`, puertos 553xx, **independiente** del stack `stylernow` (543xx) y de otros proyectos (no se tocaron).
- `reiniciar.sh`: borra solo su volumen, aplica las migraciones con `psql` (quitando CR), iguala privilegios con producción y siembra. Dos bases: `postgres` (con datos, para HTTP/E2E) y `limpia` (sin datos, para las suites SQL).
- **Paridad con producción verificada**: privilegios de tabla idénticos para `anon`, `authenticated` y `service_role`; ejecución de funciones idéntica (y las 15 funciones internas negadas a `service_role`).
- Cuentas (`@pruebas.test`): `super`, `dueno-a`, `guardian-a`, `pro-a1`, `pro-a2`, `cliente-a`, `dueno-b`, `pro-b1`, `cliente-b`, `intruso`. La contraseña es aleatoria y está en `.credenciales-pruebas.local` (ignorado por Git; no la imprimí). Las 10 cuentas inician sesión por GoTrue.
- Salvaguardas: los scripts se niegan a ejecutarse si el contenedor o el puerto no son los de pruebas; la matriz solo acepta `127.0.0.1:55321`.

## 4. Resultados de pruebas
**Suites SQL** (base `limpia`): **15 de 16 pasan**. Misma salida sobre la base restaurada.
- Falla `directiva_116_118`: espera `TRIAL → REQUIERE_PLAN`, pero la migración 133 definió `TRIAL → EN_MORA (gracia) → REQUIERE_PLAN`. Es una **prueba desactualizada**, no un defecto de la base (F0-04). No se modificó porque es regla de negocio.
- Lecciones de método: (a) mi primer clasificador marcaba OK ante errores de conexión; lo reescribí para decidir solo por el código de salida y lo validé con una base inexistente (aborta); (b) las suites suponen base vacía (el índice único de un solo Super Admin, migración 136, choca con una cuenta Super sembrada), por eso existe `limpia`.

**Matriz HTTP real** (PostgREST + JWT, 7 actores sin relación con B, controles dueño B y Super):
| Capa | Resultado |
|---|---|
| Lectura | 89 tablas con columna de tenant; 28 con datos de B. Solo `sede` y `servicio` son legibles por no autorizados (catálogo público por diseño; la política solo expone servicios ACTIVOS de negocios ACTIVOS, leída pero no probada con un servicio inactivo en esta matriz) |
| Escritura (UPDATE) | **0 violaciones** |
| Borrado | **0 violaciones** |
| Inserción con `negocio_id` de B | **0 violaciones** |
| Control positivo | dueño B ve 26 tablas de B; Super ve 25 |
| Funciones `admin_*` | **0 ejecutadas por no-super** (solo `is_supersu`, inocua) |
| Funciones (265 testeables, 1 855 celdas) | 738 denegadas, 241 sin permiso, 433 ejecutadas, el resto inconclusas por argumentos ficticios. Excluidas 218 funciones de la extensión `btree_gist` |

## 5. Hallazgos nuevos
| ID | Sev. | Hallazgo | Evidencia / acción propuesta |
|---|---|---|---|
| F0-01 | **P1 (a validar)** | En `main` el proxy sobrescribe `x-request-id` con un UUID propio y el webhook de Mercado Pago verifica la firma con ese valor, no con el que firma Mercado Pago (`id;request-id;ts`). Si `/api/*` pasa por el proxy, **toda notificación legítima fallaría la firma** y se rechazaría. La corrección ya existe en tu rama local (sin confirmar) | `proxy.ts:43`, `webhook-mercadopago.ts:68`. Validar con una prueba de firma sintética; consistente con el commit de diagnóstico de firmas rechazadas. Fase 4 |
| F0-05 | **P2** | `crear_grupo_familiar` (SECURITY DEFINER) permite a **cualquier usuario autenticado** crear un grupo atado al negocio de otro y fijar el `% de descuento`, sin validar relación ni rango. La app solo envía el nombre; es abusable por RPC directo. Hoy el descuento no entra en ningún cálculo de precio, así que no hay impacto económico, pero contamina el CRM de B y es una trampa latente | Reproducido en local 6 de 6 actores. Función idéntica a producción. Fase 1 |
| F0-06 | P2 | `anon` y `authenticated` conservan INSERT/UPDATE/DELETE/TRUNCATE a nivel de tabla en ~83–86 tablas; solo la RLS las frena, y `TRUNCATE` no pasa por RLS. PostgREST no expone TRUNCATE, así que no es explotable hoy, pero rompe defensa en profundidad | Instantánea de privilegios de producción. Fase 1 |
| F0-07 | P3 | En ~11 funciones el chequeo de plan (`FUNCION_NO_INCLUIDA`) ocurre **antes** de la autorización: un usuario sin relación puede saber si un negocio tiene esa función y la autorización de esas 66 celdas no quedó probada | Matriz. Fase 1 |
| F0-02, F0-03, F0-04 | P2/P2/P3 | Ver §2.1 y §4 | |
| (H-019 refuerzo) | P3 | 218 funciones de `btree_gist` viven en el esquema `public` | Fase 7 |

Ningún hallazgo de la auditoría quedó **cerrado** en esta fase (no se corrigió nada). Efecto sobre la confianza: el aislamiento multi-tenant pasa de “no demostrado” a “**demostrado en local para tablas y RPC probadas**, con las limitaciones de abajo”.

## 6. Backups y recuperación
**Probado (local, `pg_dump` cifrado GPG AES-256):**
- Cubre base completa (esquema, funciones, políticas, triggers, índices), schema `auth`, roles (`pg_dumpall --globals-only`, sin contraseñas) e inventario de archivos (`storage.objects`).
- Respaldo: 2–9 s (~370 KB). Restauración en base nueva: 6–7 s. Huella (tablas, funciones, políticas, privilegios, filas) **idéntica**; suites SQL con el mismo resultado sobre lo restaurado.
- 31 errores ignorados por `pg_restore`, todos de objetos internos de Supabase que `postgres` no puede tocar (default privileges, `realtime`, `secrets`, `pg_stat`). Para producción habrá que restaurar en un proyecto Supabase nuevo con su propio rol admin.
- La clave de cifrado está en `.respaldo-clave.local` (ignorada). **Hay que guardarla en tu gestor de contraseñas**: sin ella el respaldo no se recupera.

**Opciones oficiales de Supabase** (docs y página de precios, leídas hoy):
| Plan | Backups automáticos | Notas |
|---|---|---|
| Free (el actual) | **No incluidos** | La doc recomienda `supabase db dump` y copias fuera del proveedor |
| Pro (desde 25 USD/mes) | Diarios, 7 días | Restauración desde el panel |
| Team (desde 599 USD/mes) | Diarios, 14 días | |
| PITR (extra en Pro/Team/Enterprise) | Retención 7/14/28 días; ≈100/200/400 USD al mes | RPO de ~2 min en el peor caso; **sustituye** a los diarios; disponible en todos los tamaños de cómputo. Verifica precio final en tu panel |
Limitaciones oficiales: los backups **no incluyen los archivos de Storage** (solo sus metadatos), no restauran objetos borrados después, no guardan contraseñas de roles propios, y la restauración deja el proyecto inaccesible mientras dura. Borrar un proyecto borra también sus backups. Estas cifras provienen de lo que leí; confírmalas en el panel antes de decidir.

**RPO/RTO propuestos (pendientes de tu aprobación):**
| Dato | RPO | RTO |
|---|---|---|
| Reservas, pagos, suscripciones | ≤ 15 min objetivo (PITR) · mínimo aceptable ≤ 24 h | ≤ 4 h |
| Resto de catálogo y CRM | ≤ 24 h | ≤ 8 h |
| Archivos (Cloudinary) | Los conserva Cloudinary; los metadatos van en la base | — |

**Decisión que necesito de ti:** mientras sigas en Free, la única protección es un `pg_dump` periódico fuera de Supabase (tu equipo o CI) con **una conexión de solo lectura que debes crear tú**. Yo no contraté ni cambié nada. Recomendación: pasar a Pro antes del lanzamiento (diarios) y evaluar PITR cuando haya reservas y pagos reales. Estimaciones de ensayo con producción: **pendientes** (no me conecté a producción para volcar datos).

**Procedimiento de restauración (resumen):**
1. Descifrar (`gpg --decrypt`) y verificar `SHA256SUMS.txt`.
2. Crear base vacía (`create database … template template0`).
3. `pg_restore --no-owner` y revisar errores esperados.
4. Comparar `huella.sql` con la del respaldo.
5. Ejecutar suites SQL y la matriz.
6. Medir y registrar el tiempo (RTO).

## 7. Cloudinary
**Objeto existente en Supabase Storage** (solo lectura, sin descargar a disco ni modificar):
| Control | Resultado |
|---|---|
| `avatars/5ed6e562-…/foto.png`, 873 877 B | HTTP 200, `image/png`, 873 877 B recibidos |
| MD5 calculado en streaming | **`8b21cb16…a575` = `eTag` registrado** |
| Firma de archivo | PNG válido (`89 50 4e 47`) |
| SHA-256 (para verificar tras copiar) | `a1d6f7a99abd07d2054b03443da077d297d588c3bebd3235e68b573c85697541` |
| Referencias | 1 fila de `perfil` apunta a él |

**Procedimiento de migración (sin ejecutar):** (1) crear en Cloudinary de **desarrollo** el `public_id` `stylernow/dev/usuarios/<uid>/avatar` y subirlo con firma desde un script local de solo lectura sobre Supabase; (2) comparar SHA-256 y 200 en la URL de entrega; (3) añadir columnas/tabla `archivo` (aditivo); (4) guardar la URL nueva en `perfil.avatar_url` **solo para la cuenta tocada y con tu visto bueno** (es una cuenta real: no la toco); (5) periodo de compatibilidad con lectura de ambas fuentes; (6) **reversión**: restaurar el valor anterior de `avatar_url` (se guarda en el registro de migración) y dejar el archivo de Supabase intacto; (7) retirar Supabase Storage solo con tu autorización expresa.

**Credenciales que necesito, por entorno (yo no inventé ninguna; las pegas tú):**
| Variable | Desarrollo (`.env.local` del worktree) | Producción (solo Vercel, entorno Production) | Tipo |
|---|---|---|---|
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | cloud de dev | cloud de prod | público |
| `CLOUDINARY_API_KEY` | key de dev | key de prod | servidor |
| `CLOUDINARY_API_SECRET` | secret de dev | secret de prod | **secreto, solo servidor** |
| `CLOUDINARY_ENV` | `dev` | `prod` | servidor; fija la carpeta raíz `stylernow/<env>/…` |
Para separar entornos: o bien dos “environments” del producto en Cloudinary (cada uno con su `cloud_name` y claves; confírmalo en tu consola), o bien una cuenta de desarrollo distinta. Las claves de desarrollo nunca van a Vercel Production. No necesito ver el valor del secreto: basta con que las pongas en los archivos indicados.

## 8. Limitaciones (qué NO se demostró)
- La matriz usa 28 tablas con datos de B; las otras 61 tablas con columnas de tenant están vacías, así que “0 violaciones” en ellas es solo por RLS/privilegios, no por filas. Amplía la semilla para cubrirlas.
- Funciones: 433 se ejecutaron sin denegarse (auxiliares de solo lectura o acciones sobre la propia cuenta, salvo F0-05); ~443 celdas inconclusas por argumentos ficticios; 66 por F0-07.
- Solo capa de base y HTTP (PostgREST). **Server Actions y rutas de Next.js (IDOR a nivel de aplicación, `/admin/*`, H-008)** quedan para la Fase 1; el servidor de Next no se levantó en esta fase.
- Los respaldos ensayados son de la base local ficticia; **no se ha respaldado ni medido producción**.
- La paridad de esquema se midió contra producción el 2026-11-15; `main` puede seguir cambiando.

## 9. Riesgos residuales
| Riesgo | Mitigación |
|---|---|
| Plan Free sin backups hasta decidir | Decisión tuya; mientras tanto `pg_dump` externo |
| F0-01 podría estar rechazando webhooks reales | Validar con firma sintética antes del siguiente despliegue |
| Clave de respaldo perdida | Guardarla en tu gestor de contraseñas |
| Scripts de Windows y saltos de línea | `.gitattributes` y scripts con `tr -d '\r'` |

## 10. Porcentaje de preparación
Pasa de **35 %** a **~42 %** (estimación, no medición): el entorno aislado, los respaldos probados y el aislamiento demostrado en local suman; no resta nada, pero F0-01 queda abierto. No declaro cerrado ningún hallazgo de la auditoría.

## 11. Cómo reproducir
```
cd C:\Users\karni\Documents\stylernow-cierre
bash scripts/entorno-local/reiniciar.sh          # base local desde cero (~2 min)
bash scripts/entorno-local/sql-tests.sh          # suites SQL (base limpia)
node tests/aislamiento/matriz.mjs                # matriz HTTP (base con datos)
BASE=postgres bash scripts/respaldo/respaldar.sh # respaldo cifrado
bash scripts/respaldo/restaurar-prueba.sh <archivo.tar.gpg>
```
