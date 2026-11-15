# Almacenamiento de archivos → Cloudinary: inventario y arquitectura

Decisión del propietario: todo archivo de usuarios o negocios va a Cloudinary; no se usa Supabase Storage como almacén de la app. Este documento es diagnóstico y diseño. **No se implementó nada ni se tocó ningún archivo o bucket.**

## 1. Inventario real (producción, solo lectura, 2026-11-15)
| Bucket | Público | Límite | MIME admitidos | Objetos | Tamaño |
|---|---|---|---|---:|---:|
| `avatars` | Sí | 5 MB | png, jpeg, webp | **1** | 873 877 B |
| `crm-fotos` | No | 10 MB | png, jpeg, webp | 0 | 0 |
| `negocio-media` | Sí | 10 MB | png, jpeg, webp | 0 | 0 |
| `soporte-adjuntos` | No | 10 MB | png, jpeg, webp, **pdf** | 0 | 0 |

Referencias en tablas (columnas con URL/ruta, filas con valor): `perfil.avatar_url` **1** (apunta a Storage); `negocio.logo_url`, `negocio_marca.logo_url`, `servicio.imagen_url`, `staff.foto_url`, `reserva_foto.url`, `banner_home.imagen_url`: **0**. Existe además la tabla `purga_storage_pendiente` (bucket, ruta) usada por el cron diario.

**Conclusión: el volumen a migrar es de un solo archivo.** Eso baja el riesgo de la migración casi a cero y permite hacer el cambio de arquitectura antes de que existan datos reales.

## 2. Matriz de uso actual
| Módulo | Tipo de archivo | Ubicación actual (código) | Operación | Destino Cloudinary |
|---|---|---|---|---|
| Foto de perfil del cliente | imagen | `src/app/perfil/foto-actions.ts` → bucket `avatars`, ruta `<uid>/foto.<ext>` | subir (upsert), borrar, URL pública con `?v=` | carpeta `stylernow/<env>/usuarios/<uid>/avatar`, entrega pública transformada |
| Foto de perfil de staff | imagen | `src/app/staff/perfil/actions.ts` → `avatars` | subir, URL pública | `stylernow/<env>/negocios/<negocioId>/staff/<staffId>/foto`, pública |
| Logo/portada/marca del negocio | imagen | `src/app/panel/marca/actions.ts` → `negocio-media` | subir (upsert), URL pública | `…/negocios/<negocioId>/marca/{logo,portada}`, pública |
| Logo en onboarding | imagen | `src/app/panel/onboarding/actions.ts` → `negocio-media` | subir | igual que marca |
| Imagen por servicio | imagen (data URL) | `src/app/panel/servicios/actions.ts` → `negocio-media`; ayuda `src/lib/imagen/leer-como-data-url.ts` | subir | `…/negocios/<negocioId>/servicios/<servicioId>`, pública |
| Fotos de CRM (antes/después de reserva) | imagen | `src/app/panel/crm/actions.ts` → `crm-fotos` (privado); lectura con `createSignedUrl` en `lib/cliente/profesionales.ts` y `lib/cliente/mylook-pagos.ts` | subir, leer firmada 1 h | `…/negocios/<negocioId>/crm/<clienteId>/…`, **tipo `authenticated`**, URL firmada con vencimiento |
| Adjuntos de soporte | imagen/PDF | bucket `soporte-adjuntos` (privado), **sin uso en `src/`** | ninguna hoy | `…/soporte/<uid>/…`, privado, `raw`/PDF firmado. Hoy es una función prevista sin código |
| Banner del inicio | imagen | tabla `banner_home.imagen_url` (admin) | sin subida en código | `…/plataforma/banners/…`, público |
| Estado del sistema | — | `src/app/admin/sistema/page.tsx` hace `list()` en `negocio-media` como chequeo de salud | lectura | sustituir por ping a la API de Cloudinary |
| Purga diferida | — | `src/app/api/cron/diario/route.ts` (borra de `purga_storage_pendiente`) | borrar | pasar a `uploader.destroy(public_id)` y renombrar la tabla de forma aditiva |
| Políticas RLS de Storage | — | `storage.objects` (13 políticas; `007`, `114`) | — | quedan sin efecto; **no se eliminan** hasta autorización |
| CSP / imágenes | — | `src/proxy.ts` (`img-src … https://*.supabase.co`), `next.config.ts` (`remotePatterns` solo Supabase) | — | añadir `https://res.cloudinary.com` a `img-src` y a `remotePatterns` |

Observaciones del inventario:
1. Las validaciones actuales son buenas y se conservan: tamaño tras reducción en navegador (2 MB), **tipo real por bytes** (no por el `type` declarado), ruta fijada por el servidor con el id de la sesión.
2. `negocio-media` tiene política `SELECT` pública sin filtro: cualquiera puede **listar** el bucket por la API. Con Cloudinary no se replica.
3. `mylook-pagos.ts` documenta que el panel guarda hoy la URL pública completa en vez de la ruta del bucket privado `crm-fotos`: inconsistencia de modelo de datos a corregir en el rediseño.
4. No hay referencias a Cloudinary en el código (confirmado por búsqueda). El plugin de Cloudinary del entorno de Claude requiere autenticación y no se usó.

## 3. Arquitectura objetivo
```
Navegador ──(1) pide firma──▶ Server Action (Next.js)
   │                          · getUser() y rol/pertenencia al negocio
   │                          · valida tipo/tamaño declarados
   │                          · construye public_id y carpeta (servidor)
   │                          · firma con CLOUDINARY_API_SECRET (solo servidor)
   ◀──(2) firma + parámetros──┘
   │
   ├──(3) sube directo a Cloudinary con la firma (sin pasar bytes por Vercel)
   │
   └──(4) Server Action "confirmar": consulta la API Admin de Cloudinary por el public_id,
          revisa formato/bytes/carpeta/contexto, y SOLO ENTONCES guarda metadatos en Postgres
```
Alternativa más simple para imágenes pequeñas (avatares ya reducidos a ≤2 MB): subida desde el servidor con el SDK, como hoy. Recomendado: **servidor-a-Cloudinary para avatares, logos y servicios** (reutiliza `tipoReal()` por bytes), y **subida firmada directa** solo para fotos de CRM y PDFs.

### Reglas obligatorias
- **Sin presets `unsigned`.** Toda carga lleva firma generada por el servidor y con vencimiento corto.
- `CLOUDINARY_API_SECRET` y `CLOUDINARY_API_KEY` solo en variables de servidor (nunca `NEXT_PUBLIC_`). `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` es público.
- El `public_id` lo decide el servidor: `stylernow/<env>/<módulo>/<negocioId|uid>/<recurso>`. El cliente nunca envía carpeta ni `public_id`.
- Parámetros firmados: `folder`, `public_id`, `timestamp`, `allowed_formats`, `type`, `overwrite`, `invalidate`, `context` (`owner`, `negocio`, `modulo`), `tags`, `transformation` de entrada (tamaño máximo).
- Validación en el paso (4): formato permitido por módulo, `bytes` ≤ límite, `public_id` bajo la carpeta esperada, `context.owner` coincide con la sesión.
- Autorización por operación: reutilizar `is_barberia_de` / `tiene_acceso_interno` mediante una función SQL (o la comprobación que ya hace cada action) **antes** de firmar y antes de borrar. Sustituir un archivo ajeno es imposible porque el `public_id` sale del servidor y de la sesión.
- Entrega: avatares, logos, portadas y servicios → `type: upload` (público, HTTPS, transformaciones `f_auto,q_auto,w_…`). Fotos de CRM y documentos → `type: authenticated` con URL firmada de corta vida (≤1 h, igual que hoy) generada en servidor tras comprobar acceso.
- Documentos PDF privados nunca en `upload`; entrega firmada por servidor.
- Eliminación: `uploader.destroy(public_id, {invalidate:true})` desde servidor, tras autorización; registrar el fallo en `purga_*` y reintentar desde el cron (patrón ya existente).
- Errores y reintentos: un reintento con backoff; si falla, no se escribe la referencia. Sentry recibe el código de error y el módulo, **nunca** firma, secreto ni URL firmada (la limpieza de `src/lib/sentry/comun.ts` ya enmascara `token`/`secret`; añadir `signature`, `api_key`).
- Cuotas anti abuso: límite por usuario/hora en la acción de firma (reutilizar el patrón de límites existente).

### Modelo de datos (aditivo, sin borrar columnas)
Tabla `archivo` (una fila por activo): `id`, `proveedor='cloudinary'`, `public_id` (único), `tipo_entrega` (`upload|authenticated`), `modulo`, `negocio_id`, `propietario_id`, `formato`, `bytes`, `ancho`, `alto`, `version`, `creado_en`, `eliminado_en`. RLS: lectura por propietario/negocio con las funciones de acceso actuales; escritura solo por `service_role`/RPC. Las columnas `*_url` existentes se conservan durante la compatibilidad y se pasan a guardar la URL de entrega derivada del `public_id`.

## 4. Plan de migración (no iniciado)
| Paso | Detalle |
|---|---|
| 1. Inventario | Ya hecho: 4 buckets, 1 objeto, 1 referencia. Detectar huérfanos: comparar `storage.objects` con las 7 columnas; repetir justo antes de migrar |
| 2. Copia | Script local de solo lectura sobre Supabase + subida a Cloudinary **entorno de prueba** (`stylernow/test/…`). Para 1 archivo se puede hacer a mano |
| 3. Verificación | Comparar bytes, hash y respuesta HTTP 200 de la URL de Cloudinary |
| 4. Referencias | Migración **aditiva**: nuevas columnas/tabla `archivo`; las URL antiguas siguen funcionando |
| 5. Pruebas | Lectura anónima de públicos; denegación a otro negocio/usuario de privados; URL firmada caducada → 401/403 |
| 6. Compatibilidad | Un período con ambas rutas de lectura; las **nuevas** subidas ya van a Cloudinary |
| 7. Reversión | Mantener los archivos de Supabase intactos; revertir la lectura es cambiar la fuente de la URL |
| 8. Retiro de Storage | Solo con tu autorización expresa y tras demostrar cero dependencias (búsqueda de código, de columnas y logs de acceso a Storage) |

## 5. Pendiente de tu decisión
1. ¿Cuenta de Cloudinary existente? Hace falta `cloud_name`, API key/secret (solo los pegas tú en Vercel y `.env.local`; yo no los toco).
2. ¿Entornos separados (cloud o carpeta `test/` vs `prod/`)? Recomendado: carpeta por entorno y, si es posible, una cuenta o *sub-account* de pruebas.
3. Plan y cuota de Cloudinary: el uso de transformaciones y ancho de banda tiene coste; no contrato nada.
4. Retención de fotos CRM al cerrar una cuenta (derecho de supresión): usar el mismo flujo de purga.
