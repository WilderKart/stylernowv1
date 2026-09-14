# 05 — Release Process

## Objetivo
Definir cómo se despliega una versión nueva de cada superficie sin interrumpir transacciones en curso, y cómo se coordina el empaquetado futuro de la Cliente PWA vía Capacitor (ADL-003) cuando llegue esa fase.

## Alcance
Proceso de release a nivel de producto y coordinación entre superficies. No cubre el detalle de CI/CD técnico (fuera del alcance de una Biblia funcional).

## Reglas

### Cadencia y coordinación entre las 4 superficies

- Cliente PWA y Panel Negocio/App Staff pueden desplegarse de forma independiente (no requieren coordinación de versión estricta entre sí, gracias al versionado de API de `05-API/01_Standards.md`, que garantiza compatibilidad hacia atrás durante 12 meses).
- SuperSU CMS se despliega de forma independiente también, dado que su alcance no afecta directamente la experiencia transaccional del Cliente.
- Un cambio de API que rompe compatibilidad (`05-API/01_Standards.md`, versión nueva) se coordina: la versión nueva del backend se despliega primero, coexistiendo con la anterior, antes de que cualquier cliente (app) empiece a consumirla.

### Ventanas de despliegue

- Ningún despliegue que afecte los endpoints críticos (`05-API/03_Bookings.md`, `05-API/04_Payments.md`) se ejecuta sin verificación previa en un ambiente de staging que replica producción.
- Los despliegues usan estrategia de rollout progresivo (canary/blue-green) cuando el cambio afecta lógica transaccional core, con monitoreo activo de tasa de error antes de completar el 100% del tráfico.

### Empaquetado Capacitor (fase futura, ADL-003, Fase 4 de `01-PRD/04_Roadmap.md`)

- El empaquetado de la Cliente PWA como app nativa vía Capacitor se libera como una versión adicional de distribución (App Store/Play Store), **no** como un reemplazo de la PWA — ambas coexisten, dado que el pedido original de producto es "agendar desde móvil o PC" sin fricción de instalación obligatoria.
- El release de la versión Capacitor sigue el ciclo de revisión de cada tienda (Apple/Google), con plazos de aprobación que están fuera del control directo de StylerNow — se planifica con margen adicional en el roadmap.

### Reversión (rollback)

Todo release tiene un plan de reversión inmediato (revertir al artefacto de la versión anterior) disponible en menos de 15 minutos desde la detección de un problema — consistente con el RTO crítico de `03_Disaster_Recovery.md`.

## Estados
Un release sigue un estado implícito: `EN_STAGING` → `EN_ROLLOUT_PROGRESIVO` → `COMPLETO` / `REVERTIDO`.

## Permisos
Gestión de releases es responsabilidad del equipo de ingeniería. SuperSU puede solicitar (no ejecutar directamente) una pausa de rollout si detecta un problema desde el CMS (ej. picos de tickets de soporte correlacionados con un release reciente).

## Dependencias
- Depende de: `05-API/01_Standards.md`, `01-PRD/04_Roadmap.md`, `01_Feature_Flags.md`, `03_Disaster_Recovery.md`.
- De este documento dependen: `07-QA/01_Strategy.md` (todo release requiere las pruebas de regresión de `07-QA/10_Regression.md` antes de completarse).

## Casos límite

- **Un rollout progresivo detecta un aumento de errores en el 5% del tráfico canary.** Se pausa y revierte automáticamente ese rollout antes de avanzar al resto del tráfico — el criterio de pausa automática (umbral de tasa de error) se define junto con `10-Operations/06_Analytics_Definitions.md`.
- **La app Capacitor es rechazada en la revisión de una tienda de aplicaciones por un motivo de política, no técnico.** Se resuelve fuera del ciclo de release estándar de StylerNow (es un proceso de la tienda), documentado como riesgo conocido del roadmap de Fase 4, sin bloquear el resto de la operación de la Cliente PWA, que sigue funcionando con normalidad independientemente del estado de la app nativa.
- **Un Negocio reporta un problema justo después de un release, y no está claro si es causado por el release o es una coincidencia.** Se activa el monitoreo de correlación (`04_Logs_Policy.md`, `request_id` y timestamps) antes de decidir revertir — un rollback no se ejecuta sobre una sospecha sin evidencia mínima de correlación temporal y técnica.

## Criterios de aceptación
- [ ] Todo release de un endpoint crítico tiene un plan de reversión ejecutable en menos de 15 minutos.
- [ ] Ningún cambio de API rompe compatibilidad sin una versión nueva coexistiendo durante el periodo mínimo de transición.
- [ ] La versión Capacitor nunca reemplaza ni degrada la disponibilidad de la Cliente PWA.

## Checklist
- [x] Completo
- [ ] Revisado
