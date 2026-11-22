# Cloudinary: evaluación y procedimiento (decisión B)

Estado: **solo local**. Ningún archivo se ha subido a la cuenta real de Cloudinary ni se ha migrado o borrado nada.

## Qué hay hoy

- No se usa Cloudinary en ningún punto del código (antes de este cambio).
- Todo vive en Supabase Storage:
  - El bucket **público** `avatars` guarda las fotos de Staff (`<usuario>/foto.<ext>`) y de perfil.
  - Hay otros buckets para logos, portadas y galería del negocio. No se tocan aquí.

## Qué se agregó

`src/lib/almacenamiento/cloudinary.ts` es un adaptador que solo corre en el servidor. Hace cuatro cosas:

- **Activación por entorno.** Se activa solo si existen `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`. Sin ellas, todo sigue igual que hoy.
- **Subida firmada desde el servidor.** No usa un preset sin firma en el navegador.
- **Validación antes de la red.** Solo acepta JPG, PNG y WebP, de hasta 5 MB.
- **Archivos privados con URL firmada.** Usa `type: authenticated` junto con `urlFirmada`.

Cambios en el resto del código:

- La foto de Staff (`subirFotoPerfilStaff`) usa Cloudinary si está configurado, en `stylernow/staff/<usuario>/foto`. Si no lo está, usa Supabase.
- La CSP `img-src` ahora incluye `https://res.cloudinary.com`.
- `next.config.ts` permite imágenes remotas solo de la nube propia (`/<cloud_name>/**`).
- Las pruebas sin red están en `tests/cloudinary.test.ts`. La firma coincide con el vector público de la documentación de Cloudinary.

## Decisiones por tipo de archivo

| Archivo | Entrega | Motivo |
|---|---|---|
| Foto de Staff | pública (`upload`) | Es la imagen que se muestra cuando hay autorización. Quien decide si se ve es `staff_es_publicable`, no la URL. |
| Documentos o soportes de evidencia (futuro) | privada (`authenticated`) + URL firmada | No deben ser accesibles por enlace adivinable. |
| Logos, portadas y galería del negocio | sin cambio | Fuera del alcance. Se evalúan aparte. |

## Limitaciones a conocer

1. **La URL firmada de Cloudinary no caduca.** Quien tenga el enlace puede verlo. Para enlaces con vencimiento, Cloudinary exige *token-based access*, que es de pago. Si los soportes legales necesitan vencimiento, hay dos opciones: contratar ese plan, o servirlos a través de una ruta propia que valide la sesión y haga de proxy. Es una decisión comercial pendiente.
2. **Una foto ya subida en el bucket público puede seguir accesible por su URL**, aunque el perfil deje de publicarse. Lo mismo pasa hoy con Supabase. Ocultarla requiere entrega privada para la foto, que es una decisión pendiente.

## Procedimiento de migración (NO ejecutado; requiere aprobación)

1. **Inventario.** Listar `staff.foto_url` que apunten a Supabase con un `select` de solo lectura. Guardar un CSV con usuario, URL y SHA-256 del archivo descargado.
2. **Copia.** Subir cada archivo a Cloudinary con un `public_id` determinista. No modificar la base todavía.
3. **Verificación de integridad.** Descargar desde Cloudinary y comparar el SHA-256 con el inventario. Los formatos que Cloudinary transforme se comparan contra el original pedido con `fl_attachment` sin transformación. Cualquier diferencia detiene el proceso.
4. **Cambio de referencias.** Hacerlo en una transacción con tabla de respaldo: `staff_foto_respaldo(usuario_id, foto_url_anterior, foto_url_nueva, at)`.
5. **Periodo de observación.** No borrar nada de Supabase durante un periodo que defina el negocio.
6. **Reversión.** Restaurar `foto_url` desde `staff_foto_respaldo`.
7. **Borrado del origen.** Solo con aprobación explícita y después del periodo de observación.

## Pendiente de autorización

- Configurar las tres variables en local para hacer una prueba real con la cuenta de Cloudinary. La prueba sube un archivo y consume cuota.
- Configurar las variables en Vercel.
- Ejecutar el procedimiento de migración.
