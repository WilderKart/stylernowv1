# 04 — Logs Policy

## Objetivo
Definir qué se registra a nivel técnico (distinto de la auditoría de negocio de `04-Data-Model/04_Audit.md`), por cuánto tiempo, y cómo se correlaciona con un `request_id` para depuración operativa.

## Alcance
Observabilidad técnica: logs de aplicación, métricas, trazas. No cubre auditoría de negocio (`04-Data-Model/04_Audit.md`, una capa distinta con propósito distinto: "qué cambió en el negocio" vs. "qué hizo el sistema técnicamente").

## Reglas

### Qué se registra

- Toda request HTTP: método, ruta, código de respuesta, latencia, `request_id` (el mismo que aparece en el formato de error de `05-API/01_Standards.md`), `actor_id` si está autenticado (nunca el token completo).
- Todo error no controlado (excepción no manejada) con stack trace completo del lado del servidor.
- Todo intento de autenticación fallido (para detección de patrones de ataque, ver `06-Security/03_Fraud.md`, vector 3).
- Toda firma HMAC de webhook inválida (`05-API/06_Webhooks.md`, posible intento de suplantación).
- Eventos de plataforma administrativos (pausa de calendario de reintentos por incidente de pasarela, activación de flags — `01_Feature_Flags.md`).

### Qué NUNCA se registra en logs técnicos

- Contraseñas, tokens completos, números de tarjeta u otros datos de pago sensibles (más allá de los últimos 4 dígitos enmascarados).
- El cuerpo completo de un payload que contenga datos personales sensibles sin enmascarar (nombre, teléfono, email pueden aparecer en logs de depuración de corto plazo, pero no se retienen a largo plazo con esos datos en claro — ver retención abajo).

### Retención de logs técnicos

- Logs de aplicación estándar: 90 días.
- Logs de intentos de autenticación fallidos y eventos de seguridad: 12 meses (consistente con `04-Data-Model/05_Data_Retention.md`).
- Logs de error crítico (excepciones no manejadas): 12 meses, para análisis de tendencias de estabilidad.

### Correlación

Todo log de una misma request comparte el mismo `request_id`, generado al inicio de la request y propagado a través de cualquier llamada interna que dispare (ej. una Reserva que dispara una notificación) — permite reconstruir la cadena completa de causa-efecto de un incidente desde un solo identificador.

## Estados
No aplica — es un mecanismo técnico, no una entidad de negocio.

## Permisos
Acceso a logs técnicos es exclusivo del equipo de ingeniería/soporte técnico interno de StylerNow — ningún rol de producto (Barbería, Staff, Cliente) tiene acceso a logs técnicos crudos (si necesitan explicación de un error, la reciben en lenguaje humano vía `02-UX/12_Errors_States.md` o soporte, no acceso directo a logs).

## Dependencias
- Depende de: `05-API/01_Standards.md` (formato de `request_id`), `04-Data-Model/04_Audit.md` (distinción de propósito), `06-Security/01_Security_Model.md`.
- De este documento dependen: `03_Disaster_Recovery.md` (diagnóstico de incidentes), `05_Release_Process.md`.

## Casos límite

- **Un log de depuración de corto plazo capturó accidentalmente un dato sensible sin enmascarar** (bug de logging). Se trata como incidente de seguridad menor (`06-Security/01_Security_Model.md`): se corrige el punto de logging, y se purga retroactivamente ese log específico antes de su fecha de retención estándar si el dato expuesto es suficientemente sensible (ej. datos de pago).
- **Se necesita investigar un incidente ocurrido hace 100 días, fuera de la retención estándar de 90 días de logs de aplicación.** No es posible con logs técnicos estándar — para ese horizonte de tiempo, la única fuente confiable es el log de auditoría de negocio (`04-Data-Model/04_Audit.md`, retenido 5 años), que cubre el "qué pasó" a nivel de negocio aunque no el detalle técnico de "por qué falló técnicamente".
- **Un `request_id` se pierde en la propagación entre dos sistemas** (ej. una llamada a la pasarela externa no propaga el header). Se documenta como una limitación conocida de la correlación de logs con sistemas de terceros, mitigada correlacionando por `id_transaccion_pasarela` en ese tramo específico en vez de `request_id`.

## Criterios de aceptación
- [ ] Ningún log retenido más de 24 horas contiene una contraseña o token completo, verificable con un escaneo automatizado de patrones sensibles.
- [ ] Todo incidente investigado puede reconstruirse completamente usando el `request_id` dentro de la ventana de retención de 90 días.
- [ ] Ningún rol de producto tiene acceso a logs técnicos crudos.

## Checklist
- [x] Completo
- [ ] Revisado
