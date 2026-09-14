# 08 — Staff App

## Objetivo
Especificar por completo el diseño de la App Staff — la superficie que en la documentación original no tenía ni una línea escrita, pese a ser una de las 4 superficies obligatorias del producto.

## Alcance
Toda la experiencia de la App Staff: agenda, check-in/check-out, Nivel PRO/EXPERT/MASTER, comisiones/propinas propias, disponibilidad, historial de clientes atendidos. Ver `01-PRD/02_Functional_Architecture.md` para las responsabilidades (y no-responsabilidades) que delimitan esta superficie.

## Reglas

### Navegación principal

4 secciones: **Agenda**, **Mi Nivel**, **Clientes** (los que él mismo atendió), **Perfil/Ganancias**.

### Agenda (pantalla principal)

- Vista de día por defecto, con navegación a semana.
- Cada cita muestra: hora, Cliente, Servicio(s), estado.
- Botón de acción contextual sobre la cita según su estado: **Check-in** (cuando `hora_inicio` está próxima/alcanzada y la Reserva está `CONFIRMADA`), **Check-out** (cuando está `EN_CURSO`).
- El check-in/check-out dispara las transiciones de `04-Data-Model/03_State_Machines.md` vía `05-API/03_Bookings.md` — es la acción central de toda la app.
- Indicador visual de las citas que están a menos de 15 minutos de convertirse en `NO_SHOW` sin check-in (`03-Business-Rules/09_No_Show_Policy.md`), para que el Staff tenga oportunidad de actuar (avisar al Negocio, contactar al Cliente si tiene el dato) antes del corte automático.

### Mi Nivel (Sistema PRO/EXPERT/MASTER, ver `03-Business-Rules/05_Staff_Rewards.md`)

- Nivel actual, puntaje de la temporada en curso, barra de progreso hacia el siguiente Nivel.
- Desglose del puntaje por categoría (Producción, Calidad, Puntualidad) con los eventos recientes más relevantes.
- Logros obtenidos (insignias permanentes).
- Historial de temporadas pasadas (Nivel consolidado de cada una).
- Nunca muestra un campo editable de puntaje — es 100% de solo lectura, reflejando `puntaje_staff_evento` (`04-Data-Model/04_Audit.md`).

### Clientes

Lista de Clientes que el propio Staff ha atendido (no el CRM completo del Negocio — ver `03-Business-Rules/07_CRM.md`, Permisos), con historial de Servicios prestados a cada uno y notas propias del Staff (privadas, distintas de las notas del Negocio).

### Perfil/Ganancias

- Datos personales, foto, especialidad, bio (editables por el propio Staff).
- Desglose de comisión propia por periodo (`08-Growth-Monetization/02_Commissions.md`) y de propinas recibidas (`08-Growth-Monetization/03_Tips_Distribution.md`).
- Gestión de disponibilidad: horario semanal base y bloqueos de ausencia puntuales (`04-Data-Model/01_Entities.md`, entidades `disponibilidad` y `bloqueo_ausencia`).
- Selector de contexto si el Staff tiene vínculo con más de un Negocio (`05-API/02_Auth.md`, sesión multi-negocio).

## Estados
Esta app opera directamente sobre `04-Data-Model/03_State_Machines.md` (Reserva) y `03-Business-Rules/05_Staff_Rewards.md` (Temporada/Nivel) sin introducir estados propios adicionales.

## Permisos
Exclusivo de rol Staff sobre su propio vínculo `vinculo_staff_negocio`. Ver matriz completa en `03-Business-Rules/01_Roles.md` — el Staff nunca ve agenda, clientes o ganancias de otro Staff, salvo el ranking agregado si el Negocio lo habilita.

## Dependencias
- Depende de: `01-PRD/02_Functional_Architecture.md`, `03-Business-Rules/01_Roles.md`, `03-Business-Rules/05_Staff_Rewards.md`, `03-Business-Rules/02_Booking_Rules.md`, `05-API/03_Bookings.md`.
- De este documento dependen: `07-QA/03_Staff.md`.

## Casos límite

- **Un Staff intenta hacer check-in de una cita que no es suya** (ej. la agenda de otro Staff del mismo Negocio, si el Panel Negocio le diera visibilidad). Bloqueado a nivel de RLS (`06-Security/02_RLS.md`) — la App Staff ni siquiera muestra citas ajenas para intentarlo, es una restricción de datos, no solo de UI.
- **Un Staff configura un `bloqueo_ausencia` que se solapa con citas ya `CONFIRMADA`.** Se le advierte explícitamente en la UI cuáles citas quedan en conflicto y se le exige reprogramarlas o notificar a la Barbería/Guardian antes de guardar el bloqueo — consistente con `03-Business-Rules/02_Booking_Rules.md`, caso límite de cambio de horario.
- **Un Staff sin ningún Negocio activo abre la App Staff** (ej. todos sus vínculos están `RETIRADO`). Ve una pantalla de estado vacío explicando que no tiene vínculos activos, con opción de buscar/aceptar invitaciones pendientes si las hay — nunca una pantalla en blanco sin explicación.

## Criterios de aceptación
- [ ] Un Staff nunca puede ver o accionar sobre una cita de otro Staff desde esta app.
- [ ] El puntaje mostrado en "Mi Nivel" es idéntico, en tiempo real, al calculado en `03-Business-Rules/05_Staff_Rewards.md` — sin lógica de cálculo duplicada en el cliente.
- [ ] Todo check-in/check-out queda reflejado en la Agenda de forma inmediata, sin necesidad de refrescar manualmente.

## Checklist
- [x] Completo
- [ ] Revisado
