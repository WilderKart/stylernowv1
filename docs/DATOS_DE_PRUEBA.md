# Datos de prueba sembrados en la base de datos

> **Son datos de PRUEBA en una base compartida con producción.** Hay que retirarlos o aislarlos antes de
> aceptar negocios reales (ver "Cómo retirarlos").

## Qué se sembró (2026-11-10)

Los 93 negocios `ACTIVO` que ya existían (creados por scripts de verificación) se diversificaron y se dejaron
**agendables de punta a punta**. No se borró ni se creó ningún negocio.

| Categoría | Negocios | Servicios por negocio |
|---|---:|---|
| barbería (sin cambios de nombre) | 45 | Corte clásico, Barba y perfilado, Corte + barba |
| manicura (uñas) | 14 | Manicure tradicional, Pedicure spa, Uñas en gel |
| tatuajes | 12 | Tatuaje pequeño, Tatuaje mediano, Piercing, Asesoría y diseño |
| salón (estética) | 8 | Corte y peinado, Tinte completo, Keratina/alisado, Maquillaje social |
| masajes | 5 | Masaje descontracturante, Masaje relajante, Drenaje linfático |
| spa | 5 | Facial hidratante, Masaje relajante, Circuito spa |
| lashista (pestañas y cejas) | 4 | Extensiones clásicas, Lifting de pestañas, Diseño de cejas |

- Los negocios no-barbería tienen nombre y descripción de demostración (terminan en `(demo)`); el `slug` no cambió.
- Todos tienen una sede con **horario semanal** (`horario_base`) y **coordenadas por ciudad** (Bogotá, Medellín, Cali)
  para probar "Cerca de mí".
- Cada negocio tiene **un profesional** con vínculo activo a la sede, asignado a **todos** los servicios del negocio
  (`staff_servicio`) y con **disponibilidad semanal** igual al horario de la sede (`disponibilidad`).
- Los 84 profesionales nuevos son usuarios `staff.demo.<8 primeros caracteres del id del negocio>@stylernow.test`,
  creados por la API de administración de Auth con una contraseña aleatoria **que no se guardó** (nadie puede iniciar
  sesión con ellos; sirven solo para agendar).
- Verificación: el motor (`slots_disponibles`) devuelve horas libres en los próximos 7 días para los 93 negocios
  (mínimo 90, promedio ≈ 125), y `crear_reserva` agenda correctamente una cita de 2 servicios en cada categoría.

## Cómo retirarlos antes del lanzamiento

1. Los negocios de prueba son los 93 de `negocio` anteriores a esta fecha. Antes de borrar, revisar dependencias
   (wallet, `venta_producto`, reservas, pagos): hubo fugas por claves foráneas de wallet en pruebas anteriores.
2. Los profesionales de prueba se identifican por el correo `staff.demo.%@stylernow.test`; borrar el usuario en Auth
   elimina en cascada `staff`, `vinculo_staff_negocio`, `staff_servicio` y `disponibilidad`.
3. Las cuentas `@stylernow.test` y `@stylernow-test.com` (clientes, dueños y SuperSU de auditoría) también son de prueba.
