# 01 — Product Vision

## Objetivo
Definir, sin ambigüedad, qué es StylerNow, a quién sirve, y — igual de importante — qué explícitamente no es, para que ninguna decisión posterior de producto se tome "porque parecía razonable".

## Alcance
Visión de producto a nivel plataforma. No define pantallas (`02-UX`), ni reglas operativas (`03-Business-Rules`), ni precios exactos (`03_Monetization.md`).

## Reglas

### Declaración de visión

StylerNow es el **sistema operativo para negocios de citas de belleza, cuidado personal y bienestar** en Colombia, con arquitectura preparada para expansión regional. No es una agenda. No es un simple sistema de reservas. Es la infraestructura completa que un negocio de este sector necesita para operar, crecer y ser descubierto: reservas, pagos, staff, clientes, marketplace, publicidad, fidelización e inteligencia operativa, en un solo producto.

### A quién sirve (verticales soportadas desde el día uno)

El producto **no está limitado a barberías**. Debe soportar, sin distinción arquitectónica, negocios de:

- Barbería
- Salón de belleza
- Estilismo
- Manicura / Pedicura (manicurista)
- Extensiones de pestañas (lashista)
- Tatuajes
- Spa
- Masajes
- Grooming masculino
- Negocios multi-servicio (combinan dos o más de las anteriores bajo un mismo Negocio)

Ninguna decisión de producto puede asumir implícitamente una sola vertical. Ver `Glossary.md`, Regla de oro, y ADL-001.

### Qué SÍ es StylerNow

- La forma más cómoda de agendar una cita de belleza/bienestar desde el celular o el computador, sin llamadas ni esperas.
- La forma en que un Negocio administra su operación completa: agenda, staff, caja, clientes, reportes — sin hojas de cálculo ni WhatsApp como sistema de agenda.
- Un Marketplace donde los Negocios son descubiertos por Clientes nuevos, no solo una herramienta interna.
- Un sistema de incentivos (PRO/EXPERT/MASTER) que hace que el mejor Staff quiera quedarse y crecer dentro de la plataforma, no solo usarla.
- Una plataforma auditable: cada punto, cada comisión, cada estado de una reserva tiene trazabilidad.

### Qué NO es StylerNow

- No es un CRM genérico de ventas (es un CRM especializado en clientes de citas recurrentes de belleza/bienestar — ver `09-CRM-Intelligence`).
- No es un procesador de pagos propio: se apoya en pasarelas existentes en Colombia (Wompi y equivalentes: Nequi, PSE, tarjeta) — ver `05-API/04_Payments.md`.
- No es una red social: el Marketplace prioriza conversión (reservar), no engagement social.
- No es exclusivo de un solo tipo de negocio, y ninguna futura decisión de UI/datos puede romper esta premisa sin pasar por una nueva entrada del ADL.

### Diferenciadores frente a la competencia (Booksy, Fresha, Treatwell y actores locales)

1. **Pago de seña integrado con pasarelas colombianas** (Wompi/Nequi/PSE) para reducir el No-show — dolor operativo #1 del sector.
2. **Sistema PRO/EXPERT/MASTER**: gamificación real del Staff con impacto medible en visibilidad de Marketplace y comisión, no solo insignias decorativas.
3. **Multi-vertical real**: un mismo Negocio puede combinar servicios de distintas verticales sin reconfiguración estructural.
4. **CMS de SuperSU sin código**: el equipo de StylerNow opera la plataforma completa (banners, comisión, ciudades, planes) sin depender de un despliegue de ingeniería.
5. **Recurso físico como entidad de primera clase**: soporta negocios donde la capacidad la limita una camilla/cabina, no solo el Staff.

## Estados
No aplica — documento declarativo, no una entidad con ciclo de vida.

## Permisos
No aplica — documento de referencia para todo el equipo, sin restricciones de lectura.

## Dependencias
Todo el resto de la Biblia depende de este documento como fuente de la visión. Este documento depende de `Glossary.md`.

## Casos límite

- **Un Negocio quiere una vertical no listada** (ej. un centro de bronceado). La arquitectura debe soportarlo sin cambios estructurales porque `Servicio` y `Staff` son genéricos — la vertical es solo metadata (`categoria_negocio`), nunca un tipo de dato distinto.
- **Un Negocio combina verticales** (ej. barbería + tatuajes en el mismo local). Es el caso "multi-servicio": un solo `negocio_id`, Servicios de distintas categorías, Staff con distintas especialidades. No requiere ninguna regla especial adicional a la ya prevista.

## Criterios de aceptación
- [ ] Ningún documento posterior de la Biblia menciona "barbero" como entidad de datos, endpoint o rol.
- [ ] Un nuevo Negocio de cualquiera de las 10 verticales listadas puede darse de alta sin que el equipo de producto tenga que "pedir una excepción".

## Checklist
- [x] Completo
- [ ] Revisado
