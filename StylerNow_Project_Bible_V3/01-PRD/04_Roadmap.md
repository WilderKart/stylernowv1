# 04 — Roadmap

## Objetivo
Definir el orden de entrega del producto en fases verificables, de modo que "MVP" tenga un límite explícito y no crezca de manera indefinida por ambigüedad.

## Alcance
Roadmap funcional (qué se entrega, en qué orden). No es un cronograma con fechas calendario — las fechas dependen de capacidad del equipo de ingeniería y se gestionan fuera de esta Biblia.

## Reglas

### Fase 0 — Fundación documental (este esfuerzo)
Biblia del Proyecto completa: sin este cierre, ninguna fase siguiente comienza formalmente, según la misión que originó este documento.

### Fase 1 — MVP transaccional (una sola vertical validada, un solo Negocio piloto)
- Cliente PWA: descubrimiento básico (lista, no ranking completo de Marketplace), perfil de Negocio, flujo de reserva, pago de seña vía Wompi.
- Panel Negocio: onboarding, agenda, catálogo de Servicios, Staff básico (sin Sistema PRO/EXPERT/MASTER activo todavía).
- App Staff: agenda propia, check-in/check-out.
- SuperSU CMS: aprobación de Negocio, configuración de comisión global.
- Fuera de alcance de Fase 1: Marketplace Ads, IA, CRM avanzado, Lista de espera, Gift Cards, Membresías.

**Criterio de salida de Fase 1:** un Cliente puede descubrir, reservar y pagar una seña; un Negocio puede operar su agenda completa; SuperSU puede aprobar Negocios y cobrar comisión — todo sin intervención manual fuera de la plataforma.

### Fase 2 — Marketplace y crecimiento
- Algoritmo completo de ranking (`08-Growth-Monetization/01_Marketplace_Algorithm.md`).
- Marketplace Ads (formatos completos, autoservicio).
- Sistema PRO/EXPERT/MASTER activo con impacto en ranking y comisión.
- Lista de espera.
- Multi-sede (Plan Valhalla habilitado).

**Criterio de salida de Fase 2:** un Negocio nuevo puede ser descubierto orgánicamente sin intervención manual de SuperSU, y un Staff de alto desempeño tiene beneficios medibles frente a uno de bajo desempeño.

### Fase 3 — Inteligencia y retención
- CRM completo (`09-CRM-Intelligence/01_CRM_Complete.md`).
- IA operacional: recomendaciones al cliente, rendimiento de staff, predicción de ocupación y riesgo de abandono.
- Membresías y Gift Cards.
- Notificaciones WhatsApp avanzadas (campañas, no solo recordatorios).

**Criterio de salida de Fase 3:** un Negocio puede recibir una recomendación accionable generada por el sistema (ej. "estos 12 clientes no han vuelto en 45 días, lánzales esta promoción") sin construirla manualmente.

### Fase 4 — Escala y empaquetado móvil
- Empaquetado Capacitor de la Cliente PWA (ver ADL-003) — no antes, porque requiere que el flujo transaccional esté estable.
- Plan Allfather con API dedicada.
- Expansión de compliance más allá de Colombia (si el negocio lo requiere) — hoy fuera de alcance, ver ADL-008.

## Estados
No aplica — documento de planeación, no de entidad transaccional.

## Permisos
Solo CPO puede reordenar fases; cualquier rol puede proponer una funcionalidad para una fase, pero la asignación final es una decisión de producto, no de ingeniería.

## Dependencias
- Depende de: `01_Product_Vision.md`, `02_Functional_Architecture.md`.
- De este documento dependen: `10-Operations/01_Feature_Flags.md` (cada fase puede requerir flags para lanzamiento gradual) y `10-Operations/05_Release_Process.md`.

## Casos límite

- **Una funcionalidad de Fase 3 resulta más simple de lo estimado y el equipo quiere adelantarla a Fase 2.** Válido, siempre que no dependa de algo que Fase 2 no entrega (ej. IA de campañas depende de que exista historial de CRM, que es de Fase 3 — no se puede adelantar sin esa dependencia).
- **Un Negocio piloto de Fase 1 pide Marketplace Ads antes de Fase 2.** Se niega por diseño: Marketplace Ads sin el algoritmo de ranking completo (Fase 2) generaría un Marketplace manipulable desde el día uno. Esto está reforzado por la regla de `08-Growth-Monetization/01_Marketplace_Algorithm.md`: "nunca ocultar resultados relevantes".

## Criterios de aceptación
- [ ] Cada funcionalidad mencionada en cualquier otro documento de la Biblia tiene una fase asignada en este roadmap (ninguna funcionalidad "flota" sin fase).
- [ ] El criterio de salida de cada fase es verificable por QA sin ambigüedad.

## Checklist
- [x] Completo
- [ ] Revisado
