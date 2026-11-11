# Plan competitivo StylerNow: instrucciones para agentes de desarrollo

Fecha: 2026-11-11 · Propietario: Wilder · Rama de trabajo actual: `feat/cliente-17-pantallas`

## 0. Léelo antes de tocar código

**Objetivo del negocio.** Que una barbería que hoy usa Booksy o Fresha migre a StylerNow sin extrañar nada y encuentre más. Competimos en Colombia (también CO/US/MX/ES; sin Brasil). Nuestro argumento: todo incluido, WhatsApp incluido, sin comisión por cliente nuevo, pagos y facturación locales.

**Reglas obligatorias del repo**
1. `AGENTS.md`: esta versión de Next.js tiene cambios de ruptura. Lee la guía pertinente en `node_modules/next/dist/docs/` antes de escribir código de Next.
2. El prototipo manda en lo visual (`stylernow-prototipo/`). Estilo brutalista: negro sólido, naranja como acento. Nombres de plan fijos (Essential, Studio, Prestige, Signature).
3. Antes de dar algo por hecho, verifícalo en el código y en la BD. Las tareas de la sección 4 pueden estar ya parcialmente hechas (ver columna "Estado conocido"). No dupliques trabajo: lee primero, y reporta qué ya existe.
4. Nunca hagas push a `main` ni apliques migraciones a la BD compartida por tu cuenta. Deja la migración escrita en `supabase/migrations/` y avisa a Wilder (hoy hay pendientes: 107 y 108, y la 100).
5. Informa de forma fiel: si un test falla o un paso se omitió, dilo.

**Reglas de base de datos (aprendidas con incidentes reales)**
- Todo `REVOKE` de una función debe nombrar los tres roles: `public`, `anon`, `authenticated`. Se ha comprobado como vector de fraude dos veces.
- Cambiar la lista de parámetros de una función exige `drop function` explícito de la firma anterior; si no, queda un overload ambiguo.
- Nunca registrar un intento y luego hacer `RAISE EXCEPTION` en la misma transacción: el rollback borra el registro. Registra desde una transacción separada.
- Las vistas sobre tablas con RLS deben crearse con `security_invoker = true`.
- Los scripts de verificación deben borrar `wallet` y `venta_producto` antes de borrar un negocio de prueba, o dejan basura en vivo.
- Ninguna decisión de autorización (negocio, rol, plan) puede depender de datos enviados por el frontend. Todo se verifica en el servidor/RLS.

---

## 1. Análisis competitivo resumido (por qué existe este plan)

| Escenario | StylerNow | Booksy | Fresha |
|---|---|---|---|
| Barbero solo | Essential 59.900 COP | 29,99 USD (~120.000 COP) | Independiente 24.300 COP |
| 5 barberos | Studio 129.900 COP | 29,99 + 4×20 USD (~440.000) | 5×16.200 = 81.000 COP |
| WhatsApp / SMS | Incluido (150 a 2.500 conv.) | Recordatorios; masivos aparte | 20 SMS gratis, luego 500 COP c/u |
| Tarjeta / POS | **Falta** | Aparte (2,69 % + 0,30 USD) | Complemento opcional |

Notas:
- Contra Booksy ganamos con claridad en equipos (ellos cobran 20 USD por usuario).
- Contra Fresha perdemos en precio de lista. Hay que ganar por lo incluido. Costos que Fresha cobra aparte: tarifa por cliente nuevo del marketplace, fidelización 250.000 COP/sede, reseñas Google 22.000, recepcionista IA 63.000, Insights 13.500 por miembro, SMS de marketing 2.000 c/u.
- Los precios de Fresha vienen de su página en COP y no se verificaron visualmente. No los uses en material comercial sin comprobarlos.

**Qué extrañaría un usuario que migra y hoy no está en nuestro Excel de planes:** migración de datos, reportes, cobro con tarjeta/POS, política de cancelación, perfil público con reservas desde Google/Instagram/Facebook, lista de espera, formularios de consulta, reseñas, promociones y mensajes masivos, y un canal de captación de clientes nuevos (marketplace).

---

## 2. Cambios propuestos a la estructura de planes (decisión de Wilder, no implementar sin su OK)

Plan actual (`Estructura planes/Estructura_Planes_StylerNow-v2.xlsx`): Essential 59.900 · Studio 129.900 · Prestige 269.900 · Signature 599.000 COP/mes.

| Tema | Hoy | Propuesta |
|---|---|---|
| Fidelización | Desde Prestige | Versión básica desde Studio; avanzada en Prestige+ |
| Fotos sin marca de agua | Solo Prestige+ | Quitar la restricción (ni Booksy ni Fresha la cobran) |
| Reportes | No figuran | Básicos en Essential; avanzados desde Studio |
| Inventario en Essential | No | Inventario básico |
| Migración de datos | No figura | Gratis y asistida en todos los planes |
| Cobro con tarjeta/datáfono | No figura | Incluido en todos (el costo lo asume el procesador) |
| Facturación electrónica DIAN | No figura | Studio+ (integración o conexión con Siigo/Alegra) |
| Recargas WhatsApp | No existen | Paquetes extra comprables (sección 4.5) |

**Calculadora WhatsApp (hoja 2 del Excel):** solo usa la tarifa de mensajes de utilidad (2,9455 COP). Los recordatorios son de utilidad, pero las campañas son de marketing y cuestan bastante más en Colombia. Verifica la tarifa oficial de Meta para marketing y recalcula el margen del 99 %, o limita la cuota a mensajes de utilidad.

---

## 3. Orden de trabajo (fases)

| Fase | Contenido | Por qué primero |
|---|---|---|
| A. Seguridad y cierre | Sección 6 (todo) | Bloquea el pase a producción. Es riesgo, no mejora |
| B. Mínimos para migrar | 5.1 a 5.4: importación, reportes, cancelación, perfil público | Sin esto nadie migra |
| C. Diferenciales de Colombia | 4.1 a 4.3: datáfono, caja menor, Reservar con Google, y DIAN | Lo que Booksy y Fresha no tienen |
| D. Retención | 4.4 y 4.5: push nativo y recargas WhatsApp | Retención e ingreso recurrente |
| E. UI pendiente | Sección 7 | Pulido; puede ir en paralelo a B o C |
| F. Marketplace | 5.5 | El mayor esfuerzo; planificar aparte |

Cada tarea debe cerrar con: código, migración (si aplica), prueba de verificación, entrada en `CHANGELOG.md` y actualización de `docs/INFORME_SEGURIDAD.md` si toca seguridad.

---

## 4. Funciones estratégicas (alta prioridad comercial)

### 4.1 Reservar con Google (Google My Business / Maps)
- **Meta:** botón de reserva de StylerNow en el perfil de Google Maps de la barbería, sin comisión por cliente nuevo.
- **Antes de construir:** este programa (Reserve with Google / Actions Center) no es un API abierto; normalmente exige ser socio aprobado de Google o ir mediante un agregador. **Investiga el requisito vigente y reporta a Wilder la vía viable** (alta como socio, agregador, o enlace de reserva en el perfil de empresa como solución puente).
- **Puente inmediato (sí hacer):** que cada negocio tenga una URL pública de reserva estable (`/n/<slug>` o la existente) y un botón en Ajustes para copiarla y pegarla como "enlace de reservas" en Google Business Profile, Instagram y Facebook. Esto también aplica al punto 5.4.
- **Si se obtiene acceso de socio:** feed de disponibilidad y servicios por negocio, actualizado en tiempo real; reserva atómica contra la misma lógica de agenda (sin doble reserva).
- **Aceptación:** una persona puede reservar desde el enlace de Google sin crear cuenta previa y la cita aparece en la agenda del negocio. Cero comisión por cliente nuevo en el código y en los textos.

### 4.2 Datáfono físico (Mercado Pago Point)
- **Meta:** botón "Cobrar en datáfono" en la venta. El dispositivo Point del mostrador se activa con el monto.
- **Implementación:** integración con la API de Point de Mercado Pago (órdenes para dispositivos Point). Verifica en su documentación vigente la disponibilidad en Colombia y las credenciales requeridas.
- **Credenciales:** cada negocio conecta su propia cuenta (OAuth de Mercado Pago). Los tokens se guardan cifrados o en un secreto del servidor, nunca expuestos al cliente ni en tablas legibles por `anon/authenticated`.
- **Flujo:** crear orden desde el servidor con el monto calculado en el servidor (nunca el del frontend) → Point la recibe → webhook de confirmación firmado → marca el pago y cierra la venta. Maneja los estados: pendiente, aprobado, rechazado, cancelado, dispositivo desconectado.
- **Seguridad:** valida la firma del webhook, hazlo idempotente, comprueba que la orden pertenece al negocio del llamador.
- **Aceptación:** venta de prueba cobrada en un dispositivo real o simulado, con conciliación contra el cierre de caja. Un rechazo no deja la venta como pagada.

### 4.3 Caja menor (egresos diarios)
- **Meta:** botón "Registrar egreso" (escoba, tintos, etc.) que resta de las ventas del día para que el cierre de caja cuadre con los billetes físicos.
- **Modelo sugerido:** tabla `egreso_caja` con `negocio_id`, `sede_id`, `monto`, `concepto`, `categoria`, `registrado_por`, `fecha`. RLS por negocio y por rol (solo roles con permiso de caja pueden crear; los barberos no editan ni borran).
- **Reglas:** egresos no se borran, se anulan con motivo y quedan auditados. Monto positivo y con tope razonable. Fecha asignada en el servidor.
- **Cierre de caja:** `efectivo esperado = ventas en efectivo − egresos del día (+ fondo inicial)`. Muestra desglose y diferencia al contar. Los pagos con tarjeta o datáfono no entran en el efectivo esperado.
- **Aceptación:** un caso con ventas, egresos y anulación cuadra al peso en el cierre.

### 4.4 Notificaciones push nativas (Web Push)
- **Meta:** que suenen y se vean en la pantalla de bloqueo aunque la app esté cerrada.
- **Implementación:** FCM u OneSignal en el Service Worker (`public/sw.js`). Decide cuál con Wilder si hay costo o dependencia nueva; mi recomendación es FCM, para no sumar un proveedor más.
- **Reglas:**
  - Pide permiso con un gesto del usuario (explicación previa), nunca al cargar.
  - Guarda los tokens por usuario y dispositivo, con RLS (nadie lee tokens ajenos); borra los inválidos.
  - Cada aviso abre su pantalla exacta (ya existe esa lógica de navegación; reutilízala).
  - Respeta las preferencias y el consentimiento de marketing, que está en `false` por defecto (migración 106). Los avisos transaccionales (cita, recordatorio) no requieren consentimiento de marketing; las promociones sí.
- **Límite conocido:** en iOS el push web solo funciona con la app instalada en la pantalla de inicio (iOS 16.4+). Documenta la pantalla de "instala la app" para ese caso.
- **Aceptación:** cita nueva → notificación en dispositivo con la app cerrada → toque → abre la cita.

### 4.5 Recargas de WhatsApp (add-ons)
- **Meta:** que la barbería compre "paquetes extra" (ej. 500 conversaciones) cuando agote la cuota del plan.
- **Modelo:** saldo de conversaciones = cuota mensual del plan (se reinicia) + saldo comprado (no vence o vence a 12 meses; define con Wilder). El consumo gasta primero la cuota mensual y luego el saldo comprado.
- **Pago:** reutiliza la pasarela de pagos existente. Al aprobarse el pago, el webhook acredita el saldo de forma idempotente. El frontend nunca acredita saldo.
- **Precios:** deben cubrir el costo real de Meta con margen. Antes de fijar precios, verifica la tarifa vigente de Meta para utilidad y marketing en Colombia (ver nota de la sección 2).
- **UI:** barra de consumo en el panel, aviso al 80 % y al 100 %, botón "Recargar". Al llegar a 0, los recordatorios críticos no deben perderse en silencio: avisa al dueño y define el comportamiento (pausar campañas, conservar recordatorios).
- **Aceptación:** comprar paquete → saldo sube una sola vez aunque el webhook llegue repetido → el consumo respeta el orden.

---

## 5. Brechas frente a Booksy y Fresha (mínimos para que nadie extrañe nada)

### 5.1 Migración de datos asistida
Importación de clientes, servicios, productos y citas futuras desde CSV, con plantillas descargables para exportes de Booksy y Fresha. Previsualización, validación, detección de duplicados por teléfono, y reporte de errores por fila. Respeta el consentimiento (los clientes importados no quedan con marketing en `true`). Es nuestro gancho de venta: "te migramos gratis".

### 5.2 Reportes y estadísticas
Ingresos por día/semana/mes, por barbero, por servicio, por sede, retención y clientes nuevos frente a recurrentes, ventas de productos, ocupación de agenda, ausencias. Básicos en todos los planes; avanzados según la sección 2. Exportación a CSV. Toda consulta pasa por RLS o por funciones `security definer` con verificación del negocio.

### 5.3 Política de cancelación y protección contra ausencias
Política configurable por negocio (ventana de cancelación gratis, multa o retención de anticipo), mostrada al reservar con aceptación explícita. Cobro automático de la penalización desde el anticipo. Mensaje claro de las reglas en la confirmación. Es lo que Booksy vende como "reduce ausencias hasta 25 %"; nosotros ya tenemos el anticipo.

### 5.4 Perfil público y reservas desde redes
Perfil del negocio con servicios, equipo, galería, reseñas y horario. Enlace de reserva para Instagram, Facebook y Google (ver 4.1). Incluye los metadatos para SEO. Cuida el XSS en el JSON-LD (ya hubo un hallazgo, no reabrirlo).

### 5.5 Marketplace (captación de clientes nuevos)
El mayor hueco frente a Booksy Boost y al marketplace de Fresha (+25 M de clientes). Es nuestra app de cliente (17 pantallas, mapa y búsqueda) con **cero comisión por cliente nuevo**. Planifica por separado: ranking, visibilidad pagada opcional (Ads, con validación de clics en la sección 6), reseñas verificadas, y promociones. Redacta una propuesta y no empieces sin aprobación.

### 5.6 Otras brechas menores (backlog ordenado)
Lista de espera · formularios de consulta y ficha del cliente · reseñas solicitadas automáticamente tras la cita · promociones y mensajes masivos por WhatsApp (respetando la cuota y el consentimiento) · reservas de grupo · recursos (sillas) · integración con facturación electrónica DIAN (Siigo/Alegra) · pasarelas locales (PSE, Nequi, Daviplata) · recepcionista IA básica para WhatsApp · tienda de productos en línea · Meta Pixel y Google Analytics opcionales.

---

## 6. Seguridad y backend pendientes (Fase A, bloqueantes)

| # | Tarea | Estado conocido (verifica) |
|---|---|---|
| 6.1 | Bloqueo de PIN de gift card (5 intentos fallidos, 15 min) | Hecho en la migración 105. Verifica que esté aplicada y probada |
| 6.2 | Bloqueo de funciones por plan **en RLS**, no solo en la UI (Essential no debe leer ni escribir Inventario por API) | Migración 108 (proteger plan/comisión) pendiente de aplicar. Falta lo de funciones por plan |
| 6.3 | Suscripción `TRIAL_QA` para los 93 negocios QA | Pendiente. Script idempotente, solo sobre negocios marcados como QA, nunca sobre negocios reales |
| 6.4 | `/api/ia/exportar`: comprobar que el usuario autenticado pertenece al negocio **antes** de devolver nada, incluso un archivo vacío | Pendiente |
| 6.5 | CSP: añadir las cabeceras de scripts que faltaban (con nonces) | Pendiente (cabeceras base ya hechas) |
| 6.6 | Anuncios: validar la identidad del llamador antes de registrar un clic (hallazgo H8, clic fraudulento) | Pendiente |
| 6.7 | Rate limiting general; tope de peticiones al buscador público | Tope de `limite` en la migración 104. Falta un límite por IP/tiempo en el borde |

**Detalle de 6.2.** Crea una función de ayuda (por ejemplo `negocio_tiene_funcion(negocio_id, 'inventario')`) que lea el plan vigente del negocio y se use en las políticas RLS de las tablas de cada función bloqueada (inventario, comisiones, turnos, fidelización, My Look, IA, membresías avanzadas). Una sola fuente de verdad: la matriz de planes, en una tabla, no repetida en el código. Prueba negativa obligatoria: con un usuario Essential, llamar por API a inventario debe fallar. Un plan vencido o en periodo de gracia debe tener una regla clara (acordar con Wilder).

**Detalle de 6.3.** Los 93 negocios QA sin suscripción generan inconsistencias lógicas. Asigna `TRIAL_QA` con vigencia larga y sin cobro; nunca debe poder crearse desde el frontend.

**Detalle de 6.7.** Límite por IP y por usuario en el borde (Vercel/middleware o tabla de contador en BD). Respuesta 429 con `Retry-After`. Aplícalo al buscador público y a los endpoints de envío de OTP, reservas anónimas y Ads.

---

## 7. UI y experiencia (frontend pendientes)

Sigue el prototipo (`stylernow-prototipo/`) y el estilo brutalista.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| 7.1 | **Perfil público del profesional** | Vista individual con foto, calificación (estrellas) y nivel del barbero, antes de reservar. Enlazada desde el perfil del negocio y desde la reserva |
| 7.2 | **Horas agrupadas Mañana / Tarde** | En el flujo de reserva, bloques separados antes y después de las 12:00 |
| 7.3 | **Día y horario de hoy** | La tarjeta del negocio muestra la fecha de hoy y el horario de apertura de hoy (o "Cerrado hoy"), en la zona horaria del negocio |
| 7.4 | **Filtros del mapa en Drawer inferior** | Reemplazar los chips en línea por una hoja inferior desplegable con el componente Drawer actual de la app |
| 7.5 | **Pin negro en el mapa** | El pin seleccionado en negro sólido |
| 7.6 | **Lealtad en Perfil** | La barra inferior se queda en 5 botones (Explorar, Mapa, Citas, Favoritos, Perfil). "Lealtad" es el primer bloque naranja dentro de Perfil |

---

## 8. Comunicación comercial que el código debe respaldar

Para que los mensajes de venta sean ciertos, las siguientes afirmaciones deben ser verdaderas en el producto antes de publicarlas:
- "Sin comisión por cliente nuevo" (4.1, 5.5).
- "WhatsApp incluido" con cuota visible y recargable (4.5).
- "Migración gratis" (5.1).
- "Cobra en datáfono desde la app" (4.2) y "Cierre de caja que cuadra" (4.3).
- "Facturación electrónica" solo cuando esté integrada.

Una hoja de comparación (StylerNow frente a Booksy y Fresha) con costos reales debe elaborarse al final y solo con datos verificados.

---

## 9. Definición de terminado (para cada tarea)

1. Funciona con datos reales de la BD de pruebas, sin romper RLS.
2. Hay prueba negativa de seguridad cuando aplica (otro negocio, otro plan, sin sesión).
3. La migración está escrita pero **no aplicada** sin autorización, con el `REVOKE` de los tres roles.
4. Entrada en `CHANGELOG.md`; `docs/ROUTE_REGISTRY.md` actualizado si hay rutas nuevas.
5. Nada de secretos en el repo. Tokens de terceros solo en variables de entorno o en tablas protegidas.
6. Informe de cierre: qué se hizo, qué se probó, qué queda y qué decisión necesita Wilder.

## 10. Decisiones abiertas para Wilder

- Vía de acceso a Reservar con Google (socio, agregador o enlace puente).
- FCM u OneSignal para push.
- Vigencia del saldo comprado de WhatsApp y precios de los paquetes.
- Ajustes de la estructura de planes (sección 2).
- Alcance y presupuesto del marketplace (5.5).
- Regla para planes vencidos o en gracia (6.2).
