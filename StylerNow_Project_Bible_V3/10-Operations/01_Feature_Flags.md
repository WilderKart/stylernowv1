# 01 — Feature Flags

## Objetivo
Definir cómo se activan/desactivan funcionalidades de forma controlada (por Negocio, por ciudad, o globalmente), para que un lanzamiento de fase (`01-PRD/04_Roadmap.md`) o un evento especial (`03-Business-Rules/05_Staff_Rewards.md`, doble puntos) no dependa de un despliegue de código coordinado manualmente.

## Alcance
Mecanismo de flags de funcionalidad a nivel de plataforma. No cubre la configuración de negocio en sí (eso vive en cada documento de dominio) — este documento define el mecanismo de activación/desactivación gradual.

## Reglas

### Niveles de alcance de un flag

1. **Global** — afecta a toda la plataforma (ej. activar Marketplace Ads al iniciar Fase 2 del roadmap).
2. **Por ciudad** — afecta solo a Negocios de una ciudad específica (ej. piloto de una funcionalidad en Bogotá antes de expandir).
3. **Por Plan** — afecta a Negocios de un Plan específico (ej. IA Premium exclusiva de Jarl+, `01-PRD/03_Monetization.md`).
4. **Por Negocio** — activación individual para pruebas controladas con un Negocio piloto específico.

### Ciclo de vida de un flag

`Creado (inactivo por defecto) → Activado en alcance limitado (Negocio piloto o ciudad) → Expandido gradualmente → Activado globalmente → Retirado (la funcionalidad se vuelve permanente y el flag se elimina del código)`. Ningún flag vive indefinidamente en estado "parcialmente activado" sin una fecha objetivo de resolución (evita deuda de flags olvidados).

### Gobierno

Solo SuperSU activa/desactiva flags desde el SuperSU CMS (`02-UX/10_Super_Admin.md`) para flags orientados a negocio/producto (ej. Eventos especiales de puntaje). Flags puramente técnicos (de despliegue progresivo de código, sin relación con una regla de negocio) son gestionados por el equipo de ingeniería fuera de esta Biblia, pero deben registrarse aquí si afectan el comportamiento documentado de cualquier regla de negocio.

## Estados
Un flag tiene estado propio: `INACTIVO` → `ACTIVO_PARCIAL` → `ACTIVO_GLOBAL` → `RETIRADO`.

## Permisos
SuperSU gestiona flags de producto/negocio. Acceso de ingeniería a flags puramente técnicos es una decisión operativa fuera de esta Biblia.

## Dependencias
- Depende de: `01-PRD/04_Roadmap.md`, `03-Business-Rules/05_Staff_Rewards.md` (Eventos especiales), `08-Growth-Monetization/05_Billing_Failures.md` (pausa de calendario de reintentos en incidente de pasarela).
- De este documento dependen: `05_Release_Process.md`.

## Casos límite

- **Un flag activado por ciudad genera una experiencia inconsistente para un Cliente que viaja entre ciudades** (ve la funcionalidad en Bogotá pero no en Cali). Es un comportamiento esperado durante el periodo de expansión gradual — se comunica en la UI cuando la ausencia de una funcionalidad podría confundir (ej. "Esta funcionalidad llega pronto a tu ciudad" en vez de solo ocultarla sin explicación).
- **Un flag por Negocio queda activo para un Negocio piloto mucho después de que la funcionalidad ya es global.** Se limpia como parte del paso "Retirado" del ciclo de vida — un flag obsoleto por Negocio no debe sobrevivir a la activación global de la misma funcionalidad.

## Criterios de aceptación
- [ ] Todo flag activo tiene un alcance y una fecha de revisión registrada, sin flags "eternos" sin dueño.
- [ ] Ninguna funcionalidad de negocio documentada en esta Biblia depende de un flag que no está registrado aquí.

## Checklist
- [x] Completo
- [ ] Revisado
