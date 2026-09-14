# 01 — Security Model

## Objetivo
Fijar el modelo de amenazas y los controles de seguridad a nivel plataforma que gobiernan las decisiones de `02_RLS.md`, `03_Fraud.md` y `04_Compliance_Colombia.md`.

## Alcance
Modelo de seguridad general. RLS, fraude y compliance tienen documentos propios que profundizan cada uno; este documento es el marco que los conecta.

## Reglas

### Principios de seguridad (no negociables)

1. **Aislamiento por diseño, no por disciplina.** El aislamiento multi-tenant se garantiza en la capa de base de datos (RLS), nunca solo en la capa de aplicación — un bug de aplicación no debe poder filtrar datos de un Negocio a otro (ADL-004).
2. **Mínimo privilegio.** Cada rol accede exactamente a lo definido en `03-Business-Rules/01_Roles.md`, ni un campo más.
3. **Todo cambio sensible es auditable.** Ver `04-Data-Model/04_Audit.md` — este documento de seguridad no introduce un mecanismo de auditoría paralelo, usa el mismo.
4. **Ningún secreto vive en código ni en la Biblia.** Claves de pasarela, secretos HMAC, credenciales de infraestructura viven en gestión de secretos del entorno de despliegue (fuera del alcance de esta Biblia, que es documentación funcional, no un repositorio de credenciales).
5. **Cifrado en tránsito y en reposo.** TLS 1.2+ en tránsito; cifrado a nivel de base de datos en reposo para campos sensibles (datos de contacto, identificación fiscal).

### Superficies de ataque consideradas

| Superficie | Amenaza principal | Control primario |
|---|---|---|
| API pública de Marketplace | Scraping masivo, enumeración de Negocios | Rate limiting (`05-API/01_Standards.md`) |
| Autenticación | Robo de credenciales/tokens | Rotación de refresh token, 2FA obligatorio para SuperSU (`05-API/02_Auth.md`) |
| Webhooks de pasarela | Suplantación de eventos de pago | Validación de firma HMAC (`05-API/06_Webhooks.md`) |
| Multi-tenancy | Fuga de datos entre Negocios | RLS (`02_RLS.md`) |
| Marketplace / reseñas | Manipulación de ranking, reseñas falsas | Modelo antifraude (`03_Fraud.md`) |
| Datos personales | Incumplimiento normativo, filtración | Compliance Colombia (`04_Compliance_Colombia.md`), retención (`04-Data-Model/05_Data_Retention.md`) |
| Impersonación de SuperSU | Abuso de acceso privilegiado | Auditoría obligatoria y expiración de 30 min (`03-Business-Rules/01_Roles.md`) |

### Gestión de incidentes de seguridad

Todo incidente de seguridad confirmado (fuga de datos, cuenta comprometida, vulnerabilidad explotada) se gestiona con: (1) contención inmediata (revocar tokens/accesos afectados), (2) notificación a los Negocios/Clientes afectados dentro de plazos que respeten `04_Compliance_Colombia.md`, (3) postmortem documentado y agregado como entrada del `Architecture_Decision_Log.md` si implica un cambio de arquitectura. El procedimiento operativo detallado de continuidad vive en `10-Operations/03_Disaster_Recovery.md`.

## Estados
No aplica — documento de modelo, no de entidad.

## Permisos
No aplica — es de lectura obligatoria para todo el equipo técnico.

## Dependencias
- Depende de: `01-PRD/02_Functional_Architecture.md`, `03-Business-Rules/01_Roles.md`, `05-API/02_Auth.md`.
- De este documento dependen: `02_RLS.md`, `03_Fraud.md`, `04_Compliance_Colombia.md`, `10-Operations/03_Disaster_Recovery.md`.

## Casos límite

- **Un empleado de StylerNow (no SuperSU, ej. soporte de nivel 1) necesita ver datos de un Negocio para resolver un ticket.** No tiene acceso directo a base de datos de producción bajo ninguna circunstancia; debe pasar por el modo impersonación auditado de SuperSU, incluso si su rol operativo es "soporte" — no existe un rol técnico con bypass de RLS fuera de los mecanismos ya documentados.
- **Se detecta actividad de un token válido pero desde un patrón geográfico/de dispositivo anómalo** (señal de posible robo de sesión). Se documenta como Decisión abierta para una fase posterior (score de riesgo de sesión con reautenticación forzada) — en V1 no hay detección automática de anomalía de sesión, solo la rotación de refresh token como mitigación base.

## Criterios de aceptación
- [ ] Ningún control de seguridad de este documento depende únicamente de una validación del lado del cliente (frontend).
- [ ] Todo incidente de seguridad simulado en pruebas de penetración tiene una respuesta de contención documentada en menos de 1 hora de proceso descrito (no de tiempo real de respuesta, sino de que el procedimiento exista y sea seguible).

## Checklist
- [x] Completo
- [ ] Revisado
