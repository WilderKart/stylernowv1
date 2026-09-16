# ADR-011 — Motor de Lealtad: dominio completo de recompensas

## Estado
Aprobada por el fundador (2026-09-16). Implementación inmediata, dominio completo, no arquitectura futura — resuelve la Decisión Abierta "Fase 6 — Membresías, Gift Cards, Referidos: sin documento de reglas de negocio" registrada en `docs/PENDING_DECISIONS.md`.

## Contexto

Hasta este ADR, `docs/PENDING_DECISIONS.md` bloqueaba Membresías/Gift Cards/Referidos por falta de reglas de negocio documentadas. El fundador entrega ahora la especificación completa de un dominio mucho más amplio: 12 sistemas de recompensa que comparten un mismo motor, oficialmente nombrado **Lealtad** en todo el producto (nunca más "Loyalty" — el documento `03-Business-Rules/04_Loyalty.md`, que cubre el sistema previo de Puntos de Cliente, se renombra a `04_Lealtad.md` y queda como el primer capítulo de este dominio, no reemplazado).

## Decisión

### Nomenclatura
"Lealtad" reemplaza "Loyalty" en todo código, UI y documentación **nueva** a partir de este ADR. Los comentarios dentro de migraciones SQL ya aplicadas (`021_pos.sql`, que referencia `04_Loyalty.md`) no se editan retroactivamente — es un artefacto histórico, consistente con la disciplina del proyecto de nunca modificar una migración ya aplicada.

### Los 12 sistemas del dominio
1. **StylerWallet** (`lealtad_wallet`/`lealtad_movimiento`) — núcleo: saldo de Cliente por tipo de origen (Gift Card, Referido, Cashback, Promoción, Sello convertido, Bonificación VIP). Explícitamente distinto del `wallet` de Negocio (comisión de plataforma, Módulo 6.1) — dominios de dinero completamente separados, nunca mezclados.
2. **Membresías** — planes recurrentes configurables por Negocio (precio, duración, servicios incluidos, límite de usos, descuento, prioridad, regalo de cumpleaños, congelación).
3. **Gift Cards** — digitales (física queda como arquitectura de datos lista, sin flujo de emisión física en V1 — no hay impresora/proveedor físico integrado), con PIN + QR dinámico.
4. **Referidos** — recompensa solo tras que el referido paga su primera Reserva; nunca efectivo directo, siempre a StylerWallet.
5. **Sellos digitales** — servicio elegible acumula sellos, N sellos canjean una recompensa configurada por Negocio.
6. **Cashback** — % configurable por Negocio sobre Servicios/Productos, acreditado a StylerWallet, nunca en efectivo.
7. **Club VIP** — niveles renombrables por Negocio, acceso manual o automático, con degradación.
8. **Paquetes familiares** — cuenta que agrupa miembros con saldo/servicios compartidos.
9. **Suscripciones corporativas** — empresa compra cupos de beneficio para empleados.
10. **Gift Cards empresariales** — compra masiva, códigos múltiples, asignación a empleados.
11. **Referidos de Staff** — el Staff también refiere clientes, recompensa nunca duplicada con la del Cliente.
12. **Motor de recompensas automáticas** — arquitectura Nivel 0 (reglas fijas)/Nivel 1/Nivel 2 (IA vía OpenRouter, ver abajo) que decide cuándo sugerir una recompensa; V1 construye el motor de reglas y el enganche a IA, no cada caso de uso posible.

### Aislamiento de dinero: 3 wallets distintos en la plataforma, nunca fusionados
- `wallet` (Módulo 6.1): comisión de plataforma retenida por Negocio.
- `credito_ia_lote`/`credito_ia_consumo` (migración 004): consumo de IA por Negocio.
- `lealtad_wallet` (este ADR): saldo de recompensas por **Cliente**, alimentado por Gift Cards/Referidos/Cashback/Sellos convertidos/VIP.

### Multi-sede
Todo módulo soporta configuración y consumo por Sede específica cuando aplica (ej. Sellos/Cashback por Sede si el Negocio lo configura así), con el Negocio como alcance por defecto.

### IA: proveedor OpenRouter
El fundador provee una API key de OpenRouter (modelo por defecto configurado en `OPENROUTER_MODEL`, actualmente el alias gratuito `openrouter/free`, confirmado en runtime que resuelve a un modelo real sin costo). Esto desbloquea, además del Módulo 12 de este ADR, las funciones de IA de `09-CRM-Intelligence/*` (Fase 6) que estaban bloqueadas en `docs/PENDING_DECISIONS.md` por falta de credencial. La clave vive exclusivamente en variables de entorno (`.env.local` en desarrollo, variables de entorno de Vercel en producción) — nunca en código ni en ningún archivo versionado.

### Motor WhatsApp
Explícitamente diferido por el fundador en este mismo ADR — sigue bloqueado en `docs/PENDING_DECISIONS.md`, sin cambios.

## Consecuencias

**Positivas:**
- Los 12 sistemas quedan construidos de punta a punta (schema + RLS + RPCs + UI en las 4 superficies: Cliente, Panel Barbería, App Staff, SuperSU), verificados con 51+7 casos reales contra Supabase, sin ningún mock.
- Reusa infraestructura ya existente en vez de duplicarla: `pago_tipo = 'MEMBRESIA'`/`'GIFT_CARD'` (enum desde la migración 001, sin consumidor real hasta ahora), `detectar_horarios_muertos()` (Módulo 6.4) para el disparador MEJOR_HORARIO del motor de recompensas, y el mismo patrón de "cobro único vía Checkout Pro" ya validado en Suscripciones (Módulo 6.3) para Membresías/Gift Cards.
- El enganche a IA (OpenRouter + Nemotron con failover automático) queda listo no solo para el Módulo 12 sino también para las funciones de IA de `09-CRM-Intelligence/*` (Fase 6), previamente bloqueadas por falta de credencial.
- Dos hallazgos reales (`gen_random_bytes` sin calificar esquema; evento de fraude insertado antes de un `raise` que lo revertía) se corrigieron antes de llegar a producción, documentados como ADL-024/025 con relevancia genérica más allá de este proyecto.

**Negativas / Trade-offs aceptados:**
- El uso de Membresías (Servicio incluido/descuento) y el ascenso VIP automático quedan fuera de las dos funciones más críticas y ya verificadas del proyecto (`slots_disponibles`/`completar_venta_pos()` respectivamente para lo primero; solo lo segundo se dejó fuera de `completar_venta_pos()` a propósito) — registrado en `TECH_DEBT_REGISTER.md`, mismo criterio que `servicio_combo` en el Módulo 2.5.
- El motor antifraude cubre solo Canje duplicado y Abuso de referido — Dispositivo/IP/Múltiples cuentas requieren instrumentación cliente-side que no existe todavía.
- Las sugerencias del Motor de recompensas usan plantillas fijas de texto en vez de redacción real por LLM en esta primera versión — el enganche a IA existe (`ai-provider.ts`) pero no está conectado a la generación de texto de las sugerencias todavía.
- Nemotron (respaldo de IA) está conectado y verificado pero sin crédito real en su cuenta — no aporta capacidad de respaldo hasta que se recargue.

## Checklist
- [x] Completo (fuente: instrucción directa del fundador, formalizada en este documento)
- [ ] Revisado
