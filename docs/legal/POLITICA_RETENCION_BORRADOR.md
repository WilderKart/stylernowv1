# Política de retención y supresión de datos — BORRADOR

> **BORRADOR para validación jurídica humana.** Fecha: 2026-11-16. Responsable: TAWILSTACK S.A.S. (NIT `[COMPLETAR: NIT]`), operadora de StylerNow. Documento interno exigido por el Decreto 1074 de 2015, art. 2.2.2.25.2.8 («procedimientos documentados» de conservación y supresión). Lo marcado `[DECISIÓN DEL PROPIETARIO: …]` es una elección comercial u operativa, no un mandato legal. Ningún plazo se afirma como «indefinido» sin base; donde no hay base legal, se propone un plazo y se marca como decisión. Esta política **no modifica código ni base de datos**: describe lo que hay y lo que debe implementarse.

## 1. Principios y bases legales usadas

| Base | Qué impone |
|---|---|
| Ley 1581/2012 art. 4 (finalidad, necesidad implícita), art. 17 b (conservar prueba de la autorización) | Conservar solo para la finalidad informada; conservar la prueba de autorización. |
| D. 1074/2015 art. 2.2.2.25.2.8 | Conservar «durante el tiempo que sea razonable y necesario»; luego suprimir salvo deber legal o contractual; procedimientos documentados. |
| D. 1074/2015 art. 2.2.2.25.2.6 | Supresión/revocatoria a solicitud del titular, salvo deber legal o contractual de conservar. |
| D. 1074/2015 art. 2.2.2.25.3.4 | Conservar el **modelo** del aviso de privacidad mientras existan tratamientos. |
| Ley 962/2005 art. 28 | Libros y papeles del comerciante: **10 años** desde el último asiento/documento. |
| E.T. art. 632 y Ley 962/2005 art. 46 (mod. Ley 1819/2016) | Soportes tributarios: hasta la **firmeza** de la declaración (mínimo histórico 5 años). |
| C. Civil art. 2536 (Ley 791/2002) | Prescripción: ejecutiva **5 años**, ordinaria **10 años**. Criterio para conservar evidencias contractuales. |
| Ley 527/1999 art. 12 | Conservar mensajes de datos accesibles, íntegros y con origen/destino/fecha. |
| Circular Única SIC, Tít. V cap. 2 (CE 002/2015) | Incidentes: reporte en 15 días hábiles; conservar registro del incidente. |

Regla general: **si no hay deber legal o contractual, el dato se borra o se anonimiza al cumplirse la finalidad**. La anonimización (quitar todo vínculo con una persona identificable) equivale a supresión para efectos de la Ley 1581.

## 2. Suspensión del borrado (retención legal)
Cuando exista un reclamo, una investigación de la SIC, un requerimiento de autoridad o un litigio, el Super Admin podrá marcar los registros afectados en **retención legal**; los plazos de esta política quedan suspendidos para ellos hasta que termine la actuación + 1 año. `[DECISIÓN DEL PROPIETARIO: implementar marca de retención legal en el Centro de Evidencias]`.

## 3. Matriz por categoría de dato

Columnas: dato · dónde vive hoy · retención actual (hecho) · retención propuesta · base · mecanismo.

### 3.1 Cuenta (perfil, credenciales, preferencias)
| Dato | Hoy | Propuesta | Base | Mecanismo |
|---|---|---|---|---|
| Perfil (nombre, correo, celular, país, idioma, foto, fecha de nacimiento, intereses) | Mientras la cuenta exista; al eliminar: 14 días de retractación y anonimización por cron (migraciones 099/100) | Igual. Tras anonimizar, no queda dato identificable en `perfil`. | 2.2.2.25.2.6 y 2.2.2.25.2.8 | Existente (`procesarEliminacionesCuenta`). |
| Contraseña (hash) e historial de 5 contraseñas | Mientras la cuenta exista | Igual; borrar historial al anonimizar | Seguridad (art. 17 d) | `[VERIFICAR que 100 limpia password_history]` |
| Sesiones Auth (`auth.sessions`: IP, user-agent) | Vida de la sesión (JWT 1 h; refresh rotativo); borradas al suspender (137) | Igual; al anonimizar, cerrar todas las sesiones | Seguridad | Supabase |
| Preferencias de privacidad y consentimientos (`consentimiento_evento`) | Se borran en cascada con el perfil; copia en `evidencia_legal` (146) | Mantener copia en evidencias (ver 3.5) | Art. 17 b (prueba de autorización y de su revocatoria) | Existente en worktree |
| Cuentas **abandonadas** (registro no completado > 24 h, sin datos) | Cron borra la cuenta de acceso (127); bloqueado si existe `aceptacion_legal` | **24 h** y borrar; permitir al sistema borrar `aceptacion_legal` de esas cuentas conservando la fila en `evidencia_legal` marcada `importado/sin cuenta` | 2.2.2.25.2.8; no hay relación contractual nacida | `[DECISIÓN DEL PROPIETARIO: ver dictamen §7.5]` |
| Cuentas **inactivas** (sin ingreso ni reservas) | Sin regla | Aviso a los **24 meses** de inactividad y anonimización a los **36 meses** si no hay reservas futuras, saldo, membresía ni Negocio activo | 2.2.2.25.2.8 (finalidad cumplida) | `[DECISIÓN DEL PROPIETARIO: 24/36 meses]` |

### 3.2 Reservas, agenda y CRM del Negocio
| Dato | Hoy | Propuesta | Base |
|---|---|---|---|
| Reserva (cliente, sede, profesional, servicios, hora, estado) | Indefinida; al eliminar la cuenta el cliente queda «Cliente anónimo» | Conservar mientras la relación con el Negocio o el cliente esté activa; **anonimizar el cliente a los 5 años** de la última cita si la cuenta ya no existe; conservar el registro agregado del Negocio (estadística) | Prescripción ejecutiva 5 años (anticipos, reembolsos); 2.2.2.25.2.8 |
| Notas del Negocio sobre el cliente (CRM) | Indefinida | El Negocio es responsable de ese dato; borrar cuando el Negocio cierre su cuenta o a los **5 años** sin cita; exportable antes de borrar | El Negocio actúa como responsable; TAWILSTACK como encargado borra según instrucción o al terminar el contrato (2.2.2.25.5.2) |
| Chat de la cita, reseñas | Indefinida | Chat: **12 meses** desde la cita; reseñas: mientras exista el perfil del Negocio, anonimizadas si el cliente elimina su cuenta | 2.2.2.25.2.8 · `[DECISIÓN DEL PROPIETARIO: 12 meses chat]` |
| Fotos antes/después (con consentimiento) | Hasta eliminar cuenta | Hasta revocatoria o eliminación de la cuenta; purga de Storage/Cloudinary en la misma ejecución | Consentimiento específico |

### 3.3 Pagos, facturación y contabilidad
| Dato | Hoy | Propuesta | Base |
|---|---|---|---|
| Pagos de anticipos (monto, estado, referencia de Mercado Pago), reembolsos, movimientos del libro | Inmutables, indefinidos | **10 años** desde el último asiento del ejercicio; luego anonimizar la referencia al cliente (conservar importes y fechas) | Ley 962/2005 art. 28; E.T. 632/Ley 962 art. 46; C. Civil 2536 |
| Pagos de planes del Negocio y facturas de TAWILSTACK | Indefinidos | **10 años** | Ley 962/2005 art. 28; obligación tributaria |
| Credenciales cifradas de Mercado Pago del Negocio | Mientras esté conectado | Borrar al desconectar o al cerrar la cuenta del Negocio (+30 días para reembolsos pendientes) | Necesidad; seguridad |
| Datos de tarjeta | Nunca (Mercado Pago) | Sin cambio | — |

### 3.4 Evidencias legales inmutables (`evidencia_legal`, `aceptacion_legal`, `autorizacion_datos_reserva`, `aceptacion_politica_reserva`, autorizaciones de Staff)
| Aspecto | Hoy | Propuesta | Base |
|---|---|---|---|
| Contenido | Usuario, rol, documento, versión, texto + SHA-256, canal, acción, hora del servidor, hash encadenado. **Sin IP ni navegador** (decisión F) | Mantener | Art. 17 b; 2.2.2.25.2.5; Ley 527 art. 12 |
| Plazo | Indefinido (inmutable, sin cascada) | Conservar **mientras exista la relación** + **10 años** desde la última actuación con esa persona (prescripción ordinaria; cubre la ejecutiva de 5). Cumplido el plazo: **seudonimizar** sustituyendo `usuario_id` por un identificador irreversible y borrando el texto completo (conservar `texto_sha256`, versión, fechas y hash), de modo que la cadena siga verificable | 2.2.2.25.2.8 (no puede ser «para siempre»); C. Civil 2536; Ley 527 art. 12 (integridad) |
| Solicitud de supresión del titular | No se borra (deber de conservar prueba) | Responder que se conserva por deber legal/contractual (2.2.2.25.2.6) con acceso restringido; aplicar la seudonimización al cumplir el plazo | 2.2.2.25.2.6 |
| Textos legales publicados (`texto_legal`) y modelos de aviso de privacidad | Inmutables | Conservar **mientras existan evidencias que los referencien** (en la práctica, el mismo plazo anterior) | 2.2.2.25.3.4 |
| Verificación de integridad | Función `verificar_cadena_evidencias` | Ejecutar **mensualmente** y registrar el resultado | Responsabilidad demostrada (2.2.2.25.6.1) |

Nota técnica para la implementación futura: la seudonimización al cumplir plazo debe diseñarse de modo que `hash` siga siendo verificable (el hash canónico incluye `usuario_id`; habría que versionar el esquema de hash o anclar el estado previo). `[DECISIÓN DEL PROPIETARIO: aprobar diseño antes de tocar la cadena]`.

### 3.5 Consentimientos específicos (marketing, analítica, ubicación, fotos, Staff)
| Dato | Propuesta | Base |
|---|---|---|
| Otorgamiento y revocatoria | Conservar el evento de otorgamiento y el de revocatoria **5 años** después de la revocatoria o de la eliminación de la cuenta (prueba de que se dejó de enviar) | Art. 17 b; Ley 2300 (prueba de autorización de contacto); prescripción 5 años |
| Lista de números excluidos de marketing | Mantener hash del número de quienes revocaron **de forma permanente** para no volver a contactar | Ley 2300 art. 5 (mecanismo de cancelación efectivo) |

### 3.6 Logs técnicos y datos de seguridad (ver dictamen §2 y §5)
| Dato | Hoy | Propuesta | Base |
|---|---|---|---|
| `limite_tasa_evento` (huella de IP/correo) | 1 día (cron) | **1 día**; huella con clave secreta (HMAC) | 2.2.2.25.2.1 y 2.8 |
| `intento_auth` (correo, tipo, resultado) | Sin borrado | **30 días** | 2.2.2.25.2.8 · `[DECISIÓN DEL PROPIETARIO: 30 días]` |
| `prueba_uso` — `ip_hash`, `equipo_hash` | Sin borrado | Poner a NULL a los **365 días** de `created_at` | Las reglas solo miran 365/30 días |
| `prueba_uso` — `telefono_hash`, `documento_hash`, `email_hash`, `dispositivo_hash` | Sin borrado | Mientras exista el Negocio + 12 meses; si la regla «una prueba de por vida» se mantiene, conservar solo la huella (no identificable sin el dato original) | `[DECISIÓN DEL PROPIETARIO: una prueba por vida o por N años]` |
| Cookie `sn_disp` | 730 días | **365 días** | Proporcionalidad |
| `anuncio_evento_dedupe` (huella, día) | Sin borrado | **35 días** | Dedupe diario, cierre mensual de campañas |
| `evento_auditoria` (sin IP) | Sin borrado; inmutable | **5 años**; luego anonimizar `actor_id` si la cuenta ya no existe | Prescripción ejecutiva; responsabilidad demostrada · `[DECISIÓN DEL PROPIETARIO: 5 años]` |
| `auth.audit_log_entries` (si está activado) | Desconocido | Desactivar la copia en Postgres o purgar > **90 días** | 2.2.2.25.2.8 · `[VERIFICAR en el panel de Supabase]` |
| Logs del panel de Supabase | Según plan | Aceptar el plazo del plan; no activar drenajes que conserven IP más de 90 días | Encargado (Supabase) |
| Vercel runtime logs | 1 h (Hobby) / 1 día (Pro) | Aceptar; si se activa Observability Plus (30 días), documentarlo en la política | Encargado (Vercel) |
| Sentry (errores: id de usuario, navegador/SO, sin IP) | 30/90 días según plan | Aceptar; documentar en la política; mantener «no guardar IP» | Encargado (Sentry) |
| Registro de sesiones/alertas (futuro, opción B del dictamen) | No existe | **90 días** o fin de sesión; IP truncada o HMAC | Seguridad (art. 17 d) |
| Coordenadas del navegador | No se guardan | No guardar | Minimización |

### 3.7 Invitaciones y Staff
| Dato | Hoy | Propuesta | Base |
|---|---|---|---|
| Invitación de Staff (correo invitado, token) | `[VERIFICAR en 147: caducidad]` | Caducar a los **14 días**; borrar la invitación no aceptada a los **30 días** (conservar solo que se invitó, sin correo, para estadística) | 2.2.2.25.2.8 · `[DECISIÓN DEL PROPIETARIO: 14/30 días]` |
| Perfil profesional publicado (nombre, foto, especialidad) | Mientras la autorización de publicación esté vigente | Al revocar o retirarse: dejar de mostrar **de inmediato**; borrar la foto del almacenamiento en **30 días** (periodo para reclamaciones); la autorización y su revocatoria van a evidencias (3.4) | Consentimiento específico; 2.2.2.25.2.6 |
| Vínculo laboral/comercial del Staff con el Negocio (turnos, comisiones) | Indefinido | Mientras el vínculo exista + **5 años** (reclamaciones de comisiones); el Negocio es responsable de sus obligaciones laborales y puede exigir más tiempo | Prescripción; `[DECISIÓN DEL PROPIETARIO]` |

### 3.8 Comunicaciones
| Dato | Propuesta | Base |
|---|---|---|
| Correos y notificaciones transaccionales (outbox) | **90 días** tras el envío; errores 180 días | Operación; 2.2.2.25.2.8 |
| Mensajes de WhatsApp (plantillas enviadas, estado) | **12 meses** (prueba de cumplimiento de horarios y autorizaciones de la Ley 2300); luego anonimizar número | Ley 2300; art. 17 b |
| Soporte / reclamos de titulares | **5 años** desde el cierre (prueba de atención en plazo, art. 15; reporte semestral de reclamos si está en RNBD) | Ley 1581 art. 15; CE 002/2015 |
| Registro de incidentes de seguridad | **5 años** | CE 002/2015; responsabilidad demostrada |

### 3.9 Copias de seguridad
Las copias de seguridad de Supabase se rigen por el plan contratado (Hobby/Free: sin copias diarias según `docs/COSTOS_INFRAESTRUCTURA.md`). Al pasar a Pro: copias diarias con retención de 7 días. Los datos suprimidos pueden persistir en copias hasta su rotación; no se restaurarán datos suprimidos salvo recuperación ante desastre, en cuyo caso se reaplicarán las supresiones pendientes. `[DECISIÓN DEL PROPIETARIO: plan y retención de copias]`

## 4. Procedimientos (lo que debe existir para cumplir 2.2.2.25.2.8)
1. **Inventario**: esta matriz, revisada **anualmente** y en cada migración que cree una tabla con datos personales.
2. **Purgas automáticas**: una tarea del cron diario por cada fila de la matriz con plazo (hoy solo existen las de `limite_tasa_evento`, cuentas abandonadas y anonimización de cuentas). Pendientes: `intento_auth`, `prueba_uso` (parcial), `anuncio_evento_dedupe`, chat, outbox, invitaciones, inactividad.
3. **Registro de ejecución**: cada purga deja un evento en `evento_auditoria` (origen SISTEMA) con conteos, sin datos personales.
4. **Solicitudes de supresión**: respuesta en 15 días hábiles (art. 15); si procede, ejecutar el flujo de eliminación; si no procede por deber legal/contractual, responder motivadamente y marcar acceso restringido.
5. **Responsable**: la persona o área de protección de datos designada (2.2.2.25.4.4) `[COMPLETAR: nombre/cargo]`.
6. **Proveedores**: anexo con la retención de cada encargado (Supabase, Vercel, Sentry, Resend, Mercado Pago, Meta, Cloudinary si se adopta, OpenRouter/Gemini) y la cláusula de supresión al terminar el contrato.
7. **Publicación**: la política de datos (v3 §7) remitirá a un resumen público de esta matriz (plazos por categoría), no al documento interno completo.
