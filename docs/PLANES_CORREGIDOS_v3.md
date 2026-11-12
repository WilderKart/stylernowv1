# Planes StylerNow (v3): precios y qué incluye cada plan

Fecha: 2026-11-11 · Moneda: COP, Colombia · Bases: `Estructura planes/Estructura_Planes_StylerNow-v2.xlsx` (cuotas y costo de WhatsApp), decisiones de Wilder del 2026-11-11 (nombres y precios) y comparación con Booksy y Fresha.

**Decisiones ya tomadas (2026-11-11)**
- Nombres definitivos: **Essential, Studio, Prestige, Signature** (sustituyen a Raven/Jarl/Valhalla/Allfather en la BD y en la app).
- Precios de lista: **69.900 · 139.900 · 279.900 · desde 599.000**.
- Signature es "desde": el precio final depende de las necesidades del cliente. **Nunca se publica 599.000 como precio cerrado.**
- Se retira del producto y de los planes la marca de agua en fotos. No hay diferencia por plan en ese punto.
- WhatsApp: todo el marketing masivo va por WhatsApp (no se usa SMS) y no debe bajar la rentabilidad (ver sección 4).

---

## 1. Resumen de planes

| | **Essential** | **Studio** ⭐ Popular | **Prestige** | **Signature** |
|---|---|---|---|---|
| **Precio mensual** | **69.900** | **139.900** | **279.900** | **Desde 599.000** (a cotizar) |
| Precio anual (paga 10 meses, 2 gratis) | 699.000 | 1.399.000 | 2.799.000 | A cotizar |
| Ideal para | Barbero independiente | Barberías en crecimiento | Barberías premium | Cadenas y franquicias |
| Barberos incluidos | 1 | 5 | 15 | Hasta 50 en la base |
| Sedes incluidas | 1 | 2 | 5 | Hasta 15 en la base |
| WhatsApp incluido al mes | 150 mensajes | 400 mensajes | 1.000 mensajes | 2.500 mensajes en la base |
| Soporte | Email | Email y chat | Prioritario | Gerente dedicado |

Sin permanencia; cancelas cuando quieras. La prueba gratuita y el cobro recurrente siguen la lógica ya implementada (Checkout Pro no guarda tarjetas; el cobro automático de la prueba exige Preapproval).

**Signature (desde 599.000).** La base incluye hasta 50 barberos, 15 sedes y 2.500 mensajes de WhatsApp. Más barberos, sedes, mensajes, integraciones o soporte a medida se cotizan según la necesidad del cliente. La página pública debe decir "Desde" y llevar a "Hablar con ventas", no a un pago directo.

**Precio fundador** (decisión vigente): 30 % de descuento durante 6 meses, solo para los primeros 100 negocios por país, solo con pago mensual y solo en Essential, Studio y Prestige. Cancelar antes lo pierde y el cupo no se recupera.

| Plan | Fundador (primeros 6 meses) |
|---|---|
| Essential | 48.930 |
| Studio | 97.930 |
| Prestige | 195.930 |

---

## 2. Qué incluye cada plan

Estado: ✅ ya existe · 🔧 por construir (ver `docs/PLAN_COMPETITIVO_AGENTES.md`) · ✳️ cambio frente al Excel v2.

### 2.1 Agenda y operación diaria

| Función | Essential | Studio | Prestige | Signature | Estado |
|---|---|---|---|---|---|
| Agenda online 24/7 | ✔ | ✔ | ✔ | ✔ | ✅ |
| Recordatorios por WhatsApp y email | ✔ | ✔ | ✔ | ✔ | ✅ (WhatsApp con cuota; email ilimitado) |
| Notificaciones push (sonido, pantalla de bloqueo) | ✔ | ✔ | ✔ | ✔ | 🔧 |
| Reservas con anticipo | ✔ | ✔ | ✔ | ✔ | ✅ |
| Política de cancelación configurable | ✔ | ✔ | ✔ | ✔ | 🔧 ✳️ |
| Fila virtual / lista de espera | ✔ | ✔ | ✔ | ✔ | ✅ (en BD solo desde Jarl) ✳️ |
| Caja y CRM | Básico | Completo | Completo | Completo | ✅ |
| Caja menor (egresos, cierre que cuadra) | ✔ | ✔ | ✔ | ✔ | 🔧 |
| Formularios de consulta y ficha del cliente | – | ✔ | ✔ | ✔ | 🔧 ✳️ |
| Reservas de grupo y recursos (sillas) | – | – | ✔ | ✔ | 🔧 ✳️ |

### 2.2 Cobros

| Función | Essential | Studio | Prestige | Signature | Estado |
|---|---|---|---|---|---|
| Cobro online (Mercado Pago) | ✔ | ✔ | ✔ | ✔ | ✅ |
| Cobrar en datáfono físico (Mercado Pago Point) | ✔ | ✔ | ✔ | ✔ | 🔧 |
| Giftcards digitales con PIN protegido (5 intentos, 15 min) | ✔ | ✔ | ✔ | ✔ | ✅ |
| Facturación electrónica DIAN (Siigo o Alegra) | – | ✔ | ✔ | ✔ | 🔧 ✳️ |
| Comisión de StylerNow por cobro | 0 % | 0 % | 0 % | 0 % | Las tarifas de la pasarela las cobra el procesador |

### 2.3 Equipo

| Función | Essential | Studio | Prestige | Signature | Estado |
|---|---|---|---|---|---|
| Comisiones por barbero | – | ✔ | ✔ | ✔ | ✅ |
| Control de turnos del personal | – | ✔ | ✔ | ✔ | ✅ |
| Roles y permisos | – | Básico | Avanzado | Por sede | ✅ |
| Administrador por sede | – | – | – | ✔ | ✅ |
| Perfil público del profesional (foto, estrellas, nivel) | ✔ | ✔ | ✔ | ✔ | 🔧 |

### 2.4 Inventario y ventas

| Función | Essential | Studio | Prestige | Signature | Estado |
|---|---|---|---|---|---|
| Inventario | Básico ✳️ | Completo | Completo | Completo | ✅ (en BD Raven no lo tiene) |
| Membresías de clientes | – | Básicas | Avanzadas | Avanzadas | ✅ |
| Programa de fidelización | – | Básica | Avanzada | Avanzada | ✅ |

### 2.5 Marketing y captación

| Función | Essential | Studio | Prestige | Signature | Estado |
|---|---|---|---|---|---|
| Perfil en el mapa de la app de cliente | Estándar | Estándar | Destacado | Destacado | ✅ |
| **Cero comisión por cliente nuevo** que llega por StylerNow | ✔ | ✔ | ✔ | ✔ | Promesa comercial: respaldar en código |
| Perfil público con enlace de reserva (Instagram, Facebook, Google) | ✔ | ✔ | ✔ | ✔ | 🔧 |
| Reservar con Google | ✔ | ✔ | ✔ | ✔ | 🔧 Depende de aprobación de Google; el enlace es el puente |
| Reseñas (solicitud automática tras la cita) | ✔ | ✔ | ✔ | ✔ | 🔧 |
| Promociones y mensajes masivos **por WhatsApp** (usan la cuota, con tope: sección 4) | ✔ | ✔ | ✔ | ✔ | 🔧 ✳️ |
| Asistente de marketing con IA (créditos al mes) | 100 | 600 | 2.500 | A cotizar | ✅ valores actuales de la BD, se mantienen |
| Galería "My Look" del cliente | – | – | ✔ | ✔ | ✅ |
| Recepcionista IA básica en WhatsApp | – | – | ✔ | ✔ | 🔧 ✳️ |

**Anuncios en el marketplace.** Visibilidad pagada opcional, disponible en todos los planes como extra. No es comisión por cliente nuevo: el negocio decide cuánto invierte y paga por clics válidos. Requiere validar la identidad del llamador antes de registrar cada clic (hallazgo de seguridad H8).

### 2.6 Datos, reportes y soporte

| Función | Essential | Studio | Prestige | Signature | Estado |
|---|---|---|---|---|---|
| Reportes | Del día | Semana y mes | Avanzados | Consolidados por sede | ✅ |
| Exportar reportes a CSV | ✔ | ✔ | ✔ | ✔ | 🔧 ✳️ |
| Migración de datos desde otra plataforma | Estándar gratis (plantillas CSV de Booksy y Fresha) ✳️ | Estándar gratis | Asistida ✳️ | Asistida con acompañamiento | ✅ parcial |
| Soporte | Email | Email y chat | Prioritario | Gerente dedicado | ✅ |

---

## 3. Extras

| Extra | Precio | Estado |
|---|---|---|
| Barbero adicional sobre el límite incluido | Studio 20.000 · Prestige 15.000 · Essential: subir de plan · Signature: cotizar | ✅ valores actuales de la BD |
| Sede adicional | Prestige 50.000 · Signature: cotizar | ✅ valor actual de la BD |
| Mi Marca (nombre y logo propios) | 29.900 al mes | ✅ valor actual de la BD |
| Paquetes de créditos de IA | Los de `ai_paquete_creditos` | ✅ se mantienen |
| Recarga de WhatsApp | 500 mensajes = 25.000 · 1.500 = 60.000 · 5.000 = 150.000 | 🔧 Precios sin cambios; máximo 10 % de marketing por recarga para sostener el margen del 70 % (sección 4) |

---

## 4. WhatsApp: costo real y rentabilidad

**Cómo cobra Meta (verifica en su página oficial antes de lanzar).** Desde 2025 Meta cobra **por mensaje de plantilla**, no por conversación, y el costo depende del tipo. Cifras que encontré en fuentes secundarias para Colombia (tarifario de octubre de 2026, vigente hasta que Meta lo actualice; Meta lo revisa cada trimestre):

| Tipo de mensaje | Tarifa Meta (USD) | En COP* |
|---|---|---|
| Utilidad (recordatorios, confirmaciones, cambios de cita) | 0,0008 | **2,9455** (el valor de tu Excel) |
| Marketing (promociones, campañas masivas) | 0,0125 | **≈ 46** |
| Servicio (el cliente escribe primero, dentro de 24 h) | Gratis hasta 1.000 al mes por número; luego tarifa de utilidad | ≈ 0 |

\* Tu Excel implica un cambio de 3.682 COP por dólar (2,9455 / 0,0008); apliqué el mismo para marketing.

**El hallazgo.** La calculadora del Excel solo usa la tarifa de utilidad. Un mensaje de marketing cuesta **unas 15 veces más** (46 COP frente a 2,95 COP). Si un negocio gasta toda su cuota en campañas, el costo sube, pero sigue siendo manejable en los planes (columna "todo marketing"):

| Plan | Cuota | Precio | Costo si todo es utilidad | Costo si todo es marketing | Costo con tope del 40 % en marketing | % del precio con tope |
|---|---|---|---|---|---|---|
| Essential | 150 | 69.900 | 442 | 6.903 | 3.026 | 4,3 % |
| Studio | 400 | 139.900 | 1.178 | 18.408 | 8.070 | 5,8 % |
| Prestige | 1.000 | 279.900 | 2.946 | 46.020 | 20.175 | 7,2 % |
| Signature (base) | 2.500 | 599.000 | 7.364 | 115.050 | 50.438 | 8,4 % |

**Regla propuesta para que no baje la rentabilidad y sin subir precios:**
1. **Tope de marketing: como máximo el 40 % de la cuota mensual** puede ir a mensajes de promoción o campaña (60, 160, 400 y 1.000 mensajes por plan). El resto queda para recordatorios y avisos de cita. Es generoso (Fresha cobra 2.000 COP por SMS de marketing) y mantiene el costo de WhatsApp bajo el 9 % del precio incluso en el peor caso.
2. **Solo WhatsApp.** No se ofrece SMS de marketing, que sería otro costo y otro proveedor.
3. **Los mensajes de servicio** (el cliente escribe primero) no consumen cuota mientras Meta los mantenga gratis; revisar tras el tarifario de enero de 2027.
4. El contador separa "utilidad" y "marketing", y el panel muestra ambos al negocio.
5. Revisar estas cifras en cada actualización trimestral de Meta (1 de enero, abril, julio y octubre) y si cambia el tipo de cambio.

**Regla de rentabilidad (aprobada): margen mínimo del 70 % en WhatsApp, en el peor caso de uso.** Margen = precio menos el costo de Meta de los mensajes, con el mix de mensajes más caro que permite cada tope. No incluye comisiones de la pasarela de pago ni infraestructura.

**Planes (tope de marketing del 40 % de la cuota):** el margen en el peor caso es **95,7 % (Essential), 94,2 % (Studio), 92,8 % (Prestige) y 91,6 % (Signature)**. Cumplen con holgura.

**Recargas.** Con el mismo tope del 40 % los paquetes grandes no llegan al 70 % (el de 5.000 daría 33 %). Como no hay negocios reales pagando y los precios se pueden mover, había dos caminos: subir precios o bajar el tope de marketing en las recargas. Elegí **bajar el tope a 10 % de marketing en las recargas** y mantener los precios:

| Paquete | Precio | Costo peor caso (10 % marketing) | Margen peor caso |
|---|---|---|---|
| 500 mensajes | 25.000 | 3.627 | 85,5 % |
| 1.500 mensajes | 60.000 | 10.880 | 81,9 % |
| 5.000 mensajes | 150.000 | 36.266 | 75,8 % |

Qué significa en la práctica: de cada recarga, como máximo el 10 % se puede usar en campañas de marketing (50, 150 y 500 mensajes); el resto sirve para recordatorios y avisos de cita. Si un negocio quiere más campañas, sube de plan o compra más cuota con el plan. Una alternativa más cara, con tope del 40 %, exigiría subir los paquetes a 34.000, 101.000 y 338.000, y la descarté para no encarecer la recarga.

**Colchón por el tipo de cambio.** El margen de la recarga de 5.000 (el más ajustado) sigue sobre el 70 % mientras el dólar no suba más de un 24 % sobre el cambio implícito del Excel (3.682 COP), es decir, hasta unos 4.560 COP por dólar. Si pasa de ahí, o si Meta sube la tarifa de marketing, hay que recalcular.

**Control automático (para los agentes).** El servidor calcula cada mes el costo de Meta por negocio. Si el costo de WhatsApp supera el 30 % del ingreso del plan (más recargas) de ese negocio, se avisa a Wilder en el panel de Super Admin. El contador distingue mensajes de utilidad y de marketing, y el tope se valida en el servidor, nunca en el frontend. Se gasta primero la cuota mensual del plan y luego el saldo comprado. Vigencia del saldo comprado: 12 meses (aprobada).

---

## 5. Frente a Booksy y Fresha

Cambio aproximado de 4.000 COP por dólar. Los datos de Fresha vienen de su página en COP y no se verificaron visualmente.

| Escenario | StylerNow | Booksy | Fresha |
|---|---|---|---|
| Barbero solo | Essential 69.900 | 29,99 USD ≈ 120.000 | Independiente 24.300 |
| 5 barberos | Studio 139.900 | ≈ 440.000 (29,99 + 4×20 USD) | 81.000 (5×16.200) |
| 15 barberos | Prestige 279.900 | ≈ 1,24 millones | 243.000 |
| Mensajes de WhatsApp o SMS | 150 a 2.500 al mes incluidos | Recordatorios | 20 SMS por miembro; luego 500 COP c/u |
| Cobro con tarjeta | 0 % de StylerNow | Aparte | Complemento opcional |
| Comisión por cliente nuevo | **0** | Boost (de pago) | Tarifa por cliente nuevo del marketplace |
| Fidelización | Desde Studio | Incluida | Complemento, 250.000 por sede |
| Reseñas de Google | Incluidas | Incluidas | Complemento, 22.345 por sede |
| Recepcionista IA | Prestige+ | Beta | Complemento, 63.000 por sede |
| Migración de datos | Gratis | Gratis | Importación; asistida de pago |

**Lectura honesta.** En precio de lista Fresha sigue siendo más barato (con 15 barberos casi empata con Prestige). Contra Booksy ganamos con claridad. Contra Fresha, el argumento es el costo real mensual: sumando SMS, fidelización, reseñas, tarifa de marketplace y recepcionista IA, una barbería mediana paga más allá, y StylerNow incluye WhatsApp, caja menor, datáfono y facturación DIAN locales.

---

## 6. Cambios frente al Excel v2

| # | Cambio | Motivo |
|---|---|---|
| 1 | Precios: 69.900 · 139.900 · 279.900 · desde 599.000 | Decisión de Wilder |
| 2 | Signature es "desde" y se cotiza | Depende de la necesidad del cliente |
| 3 | Sin marca de agua en ningún plan | Decisión de Wilder |
| 4 | Inventario básico en Essential | Un barbero solo vende productos |
| 5 | Fila virtual en todos los planes | Fresha la trae en todos |
| 6 | Migración estándar gratis en todos; asistida desde Prestige | Gancho para quien migra |
| 7 | Reportes con exportación CSV en todos | Falta frente a ambos competidores |
| 8 | Marketing masivo por WhatsApp en todos los planes con tope del 40 % | El costo es bajo y mejora la propuesta frente a Fresha |
| 9 | Política de cancelación, perfil público, reseñas, push, caja menor, datáfono y Reservar con Google en todos | Lo mínimo para que nadie extrañe nada |
| 10 | Facturación DIAN y formularios desde Studio; grupos y recursos desde Prestige | Cobertura de Fresha y ventaja local |
| 11 | Recepcionista IA básica desde Prestige | Fresha la cobra aparte |
| 12 | La cuota se mide en "mensajes", no en "conversaciones", y distingue utilidad y marketing | Así factura Meta |

---

## 7. Qué debe cambiar en la BD y en la app

Los agentes escriben la migración; **Wilder la aplica**.
1. Renombrar `plan.codigo` y `plan.nombre`: RAVEN → ESSENTIAL, JARL → STUDIO, VALHALLA → PRESTIGE, ALLFATHER → SIGNATURE. Actualizar todo lo que referencia esos códigos: `plan_precio`, `plan_caracteristica`, `suscripcion`, el catálogo (`src/lib/planes/catalogo.ts`), `src/types/database.ts`, funciones RPC, semillas y textos de la interfaz. Revisar las funciones de cambio de plan (migración 049) y las de fundador.
2. Actualizar `plan_precio` para CO: 69.900, 139.900, 279.900; Signature con `es_desde = true` y precio base 599.000 (hoy es `null`, a cotizar; la interfaz debe mostrar "Desde").
3. Actualizar `plan` y `plan_caracteristica` según las matrices de la sección 2: límites (1/5/15/50 barberos, 1/2/5/15 sedes), cuotas de WhatsApp (150/400/1.000/2.500) y las funciones nuevas.
4. Quitar la clave `camara_antes_despues` con valor `con_marca_agua` y la lógica de la marca de agua en la app.
5. Añadir el contador de WhatsApp por tipo y el tope del 40 % en marketing, validados en el servidor (el frontend nunca decide).
6. Los bloqueos por plan se aplican con RLS, no solo ocultando rutas.
7. No hay negocios reales que ya paguen, así que no se necesita periodo de transición: los precios y nombres nuevos se aplican directamente. Los negocios QA siguen con la suscripción `TRIAL_QA` (ver tarea 6.3 del documento de agentes), mapeada a los nuevos códigos.
8. No prometer en la web ni en ventas ninguna función marcada 🔧 hasta que esté desplegada.

---

## 8. Decisiones

**Aprobadas por Wilder (2026-11-11):** todo el documento, con la condición de **margen mínimo del 70 %** en WhatsApp (sección 4); tope del 40 % de marketing en los planes y del 10 % en las recargas; vigencia del saldo comprado de 12 meses; conservar los extras actuales de la BD (barbero y sede adicional); mantener el descuento fundador sobre los nuevos precios; sin periodo de transición porque no hay negocios reales pagando.

**Pendiente (verificación, no decisión):** confirmar con la página oficial de Meta las tarifas de marketing y utilidad para Colombia antes de publicar los planes, y repetir el cálculo en cada actualización trimestral. Si la tarifa de marketing sube mucho, el margen mínimo exige bajar los topes o subir las recargas.

Fuentes de las tarifas de Meta (secundarias, no oficiales): [Sleekflow](https://sleekflow.io/en-us/blog/whatsapp-business-price) · [Whautomate](https://whautomate.com/whatsapp-business-api-pricing) · [Formbeep](https://formbeep.com/whatsapp-api-pricing/) · [WhatSetter](https://www.whatsetter.com/tools/whatsapp-api-pricing-calculator) · [Voltade](https://voltade.com/resources/guides/whatsapp/whatsapp-business-api-pricing)


## 9. Estado de la migración (2026-11-11)
- Código de la app: ya usa Essential / Studio / Prestige / Signature.
- BD: `supabase/migrations/109_planes_v3_essential_studio_prestige_signature.sql` escrita, **sin aplicar y sin probar contra la BD** (la capa de permisos rechazó incluso una validación con rollback). Renombra los valores del enum (conserva datos y claves foráneas), reescribe las 6 funciones que citan los nombres antiguos, fija precios CO, límites, cuotas de WhatsApp, retira `camara_antes_despues` y siembra la matriz de funciones. Aplicarla **a la vez** que se despliega la rama: el código nuevo no funciona con el enum antiguo y viceversa.
- Pendiente de decisión: el rol "Administrador por sede" (guardián) hoy está disponible en Studio, Prestige y Signature en la BD, y esta guía lo lista solo en Signature. No se cambió.
