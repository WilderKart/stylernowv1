# Términos y condiciones: comparativo y versión 3 de StylerNow

Fecha: 2026-11-12 · Texto de referencia: Tuturno (Argentina) · Texto propio: `TERMINOS` v2 (BD) · Entregables: texto nuevo en [docs/legal/TERMINOS_v3_texto.txt](legal/TERMINOS_v3_texto.txt) y migración [115](../supabase/migrations/115_terminos_v3_clientes_y_negocios.sql) (sin aplicar).

> **No es asesoría legal.** El texto está adaptado a StylerNow, no copiado, pero debe revisarlo un abogado colombiano antes de publicarlo (sección 5).

## 1. Hallazgo principal

Nuestro v2 solo regula al **Cliente** (8 secciones cortas). Aunque el Negocio paga una suscripción, usa WhatsApp, recibe anticipos y publica contenido, **no hay ningún término que lo obligue ni que lo proteja a él ni a nosotros**: ni reglas de planes, ni reembolsos de la suscripción, ni responsabilidad por sus servicios, ni uso de WhatsApp. Tuturno sí cubre ambos lados. Por eso la v3 es un solo documento para Cliente y Negocio (la app hoy solo maneja los tipos `TERMINOS` y `POLITICA_DATOS`; separar un tercer documento exigiría cambios de código).

## 2. Comparativo cláusula por cláusula

| Tema | Tuturno | StylerNow v2 | Decisión en v3 |
|---|---|---|---|
| Definiciones (proveedor, usuario final) | Sí | No | Sí: Cliente, Negocio, Equipo, Servicio, Reserva, Anticipo, Saldo, Plan |
| Intermediario, no presta el servicio | Sí | Sí | Se conserva y se amplía (marketplace + software de gestión) |
| Suscripción del proveedor | Mensual según usuarios | **No** | Planes Essential/Studio/Prestige/Signature, extras, prueba, renovación, impago |
| Cambios y bajas de plan | Sin reembolso; subir paga proporcional (anual) | **No** | Aplicado a mensual y anual, según tu decisión |
| Cancelación y no presentación | Anticipo nunca reembolsable | "Varía según la cercanía" | **Siempre no reembolsable**, según tu decisión, con excepciones (abajo) |
| Reembolso si el negocio falla | No lo dice | No | **Añadido** (negocio cancela, cierra o cobro errado) |
| Responsabilidad por salud/alergias | Cliente informa | No | Sí, con ejemplo de tintes y productos |
| Cuenta, confidencialidad, no ceder | Sí | Parcial | Completo (6 dígitos, Google, no compartir) |
| Menores de edad | No recolecta a sabiendas | No | Mayores de 18; un adulto puede reservar para un menor (común en barberías) |
| Comunicaciones electrónicas | Sí | No | Sí, ampliado a WhatsApp, push, y marketing solo con autorización |
| WhatsApp y mensajes masivos | No | No | **Nuevo**: cuota, tope de marketing, recargas (12 meses, sin reembolso), políticas de Meta |
| Pagos a negocios y comisiones | No | No | **Nuevo**: el anticipo va directo a la cuenta del Negocio, tarifas y tributos a cargo del Negocio, "sin comisión por cliente nuevo ni por reserva a la fecha" (ver auditoría, secciones 7A y 7B) |
| Uso aceptable y propiedad intelectual | Sí, extenso | Muy corto | Sí; añade no eludir bloqueos de plan ni probar vulnerabilidades |
| Contenido que sube el usuario | No | No | **Nuevo**: licencia de alojamiento y autorización de personas en fotos |
| Datos personales | Solo menores | Política aparte | Remite a la Política (Ley 1581) y a la ley del país |
| Terceros y enlaces | Sí | No | Sí, nombrando Mercado Pago, Google y Meta |
| Descargo y límite de responsabilidad | Exclusión total, en mayúsculas | Una línea | **Límite con tope y salvedades** (abajo) |
| Indemnidad | Todos los usuarios | No | **Solo el Negocio** (abajo) |
| Terminación | Sin previo aviso, a su sola discreción | No | Con aviso cuando sea posible; reembolsa anticipos de reservas futuras |
| Usuarios internacionales | Argentina | No | Colombia, EE. UU., México y España |
| Ley y jurisdicción | Solo Argentina | No | Colombia, sin perder derechos del consumidor, según tu decisión |
| Disposiciones generales, cambios | Sí | Parcial | Sí; cambios materiales exigen aceptar de nuevo (ya implementado) |

**Lo que ya tenemos y Tuturno no:** consentimiento versionado con re-aceptación forzada, política de datos bajo la Ley 1581, ingreso con Google y código de 6 dígitos, reglas de consumo.

## 3. Qué no copié de Tuturno, y por qué

1. **"Todas las compras son definitivas y no reembolsables" en general.** Solo declaro no reembolsable el Anticipo por cancelación o inasistencia del Cliente (tu decisión) y la suscripción. En Colombia el Estatuto del Consumidor protege al consumidor y una cláusula sin excepciones puede considerarse abusiva o inaplicable. Añadí excepciones razonables y la salvedad de derechos irrenunciables.
2. **Exclusión total de responsabilidad.** La ley no permite excluir el dolo ni la culpa grave. Puse un tope (lo pagado en 12 meses por el Negocio; el Anticipo para el Cliente) con esas salvedades.
3. **Indemnidad para todos los usuarios.** Pedirle a un consumidor que indemnice a la empresa suele ser cláusula abusiva. La limité al Negocio.
4. **Cancelar el acceso "sin previo aviso, a sola discreción".** Lo suavicé: con aviso cuando sea posible, y con causas.
5. **Jurisdicción exclusiva del país de la empresa.** No sirve para vender a consumidores en México y España; usé la ley de Colombia con salvedad del consumidor.
6. **Cambios unilaterales sin avisar.** Se mantiene nuestro mecanismo: aviso y nueva aceptación si el cambio es material.

## 4. Decisiones tuyas que apliqué, y adiciones mías

**Aplicadas:** anticipo siempre no reembolsable; suscripción sin reembolso con subida prorrateada; ley de Colombia con salvedad del consumidor.

**Adiciones mías que debes aprobar o quitar:**
- Reembolso del Anticipo si el Negocio cancela, cierra o es suspendido, o si hay un cobro duplicado o no autorizado (sección 6 y 18). Sin esto la regla de "siempre no reembolsable" sería injusta y probablemente inaplicable.
- Reprogramación: si el Negocio la acepta, el Anticipo se conserva.
- "A la fecha, StylerNow no cobra comisión por cliente nuevo ni por reserva" (sección 10). Es coherente con el plan comercial; si más adelante quieres cobrar comisión, hay que cambiar el texto con re-aceptación.
- Recargas de WhatsApp: vencen a los 12 meses y no se reembolsan (decisión previa tuya); tope de marketing sin publicar el porcentaje (así se puede ajustar sin nueva versión).
- El Plan se renueva automáticamente solo "si el cobro recurrente está habilitado" (la lógica actual lo condiciona a Preapproval).

## 5. Puntos para el abogado

1. **Anticipo no reembolsable y derecho de retracto.** Revisar la Ley 1480 de 2011 (ventas a distancia) y las normas de México (Profeco) y España (desistimiento en contratos a distancia, con excepciones para servicios con fecha concreta). Aun con la cláusula, la ley puede reconocer derechos que no se renuncian.
2. **Cláusulas abusivas** y el tope de responsabilidad (sección 16).
3. **Roles de datos:** quién es responsable y quién encargado respecto de los datos de los clientes de cada Negocio (Ley 1581 de 2012). La Política actual dice que StylerNow es el responsable; esto influye en las secciones 9 y 14.
4. **Obligaciones de plataformas de comercio electrónico o portales de contacto** (identificación del vendedor, información al consumidor).
5. **Cobro del Anticipo:** quién es el "comerciante" frente al consumidor y la tributación de la liquidación al Negocio.
6. **Recursos de la SIC y avisos** que la ley exija mostrar.

## 6. Datos legales recibidos (2026-11-12)

Aplicados en el texto: razón social **StylerNow**, NIT **xxxxx** (a propósito, hasta tenerlo), domicilio **Carrera 1A # 59-60, Cali, Valle del Cauca**, jueces de **Cali**, correo **equipo@stylernow.com**. Cambios de precio **trimestrales, sin día fijo, "pueden cambiar o mantenerse"** (sección 8h). Tarjetas **guardadas en Mercado Pago, no por StylerNow** (secciones 5 y 8b). Prueba **con o sin tarjeta** (8c). Anticipo **directo a la cuenta del Negocio** (secciones 5, 6, 10, 18).

La migración 115 quedó regenerada, **sin aplicar**. No hay marcadores entre corchetes pendientes; si el NIT sigue en `xxxxx` al aplicarla, emite un aviso.

## 7. Auditoría: código frente a términos

Revisé el código y la BD (solo lectura). **Hay cinco diferencias que cambian el producto o el texto; hay que decidirlas antes de publicar la v3.**

| # | Tema | Lo que dice el texto v3 | Lo que hace el código hoy | Gravedad |
|---|---|---|---|---|
| A | **Destino del anticipo** | Va directo a la cuenta del Negocio; StylerNow no recibe ni custodia el dinero | Un **único token de Mercado Pago de StylerNow** (`MERCADOPAGO_ACCESS_TOKEN`, `src/lib/pagos/mercadopago.ts`) crea la preferencia sin cuenta de vendedor: **el dinero entra a la cuenta de StylerNow**, se acredita al `wallet` del Negocio (neto de comisión) y se retira con liquidación semanal que aprueba SuperSU | **Alta** |
| B | **Comisión** | "A la fecha, StylerNow no cobra comisión por cliente nuevo ni por reserva" (y el plan comercial dice 0 %) | La plataforma **retiene 8 % por defecto** (rango 3 a 15 %; un `check` impide 0). En la BD, 95 negocios tienen entre 8 % y 10 %; hay 75 wallets | **Alta** |
| C | **Cancelación del anticipo** | Siempre no reembolsable (tu decisión), salvo excepciones | Política **escalonada por negocio**: reembolso total si cancela con más de X h (24 h por defecto), parcial (50 % por defecto) hasta Y h (2 h), nada después; el negocio configura las horas (mínimo 6 h para el total). Si cancela el negocio, 100 % siempre | **Alta** |
| D | **Prueba gratuita** | Con o sin tarjeta | Prueba de 14 días que **exige método de pago, teléfono, documento y huella del dispositivo** (`iniciar_prueba_negocio`) y cobra al terminar. Además, `cobro_recurrente_habilitado` está en `false` en CO, US, MX y ES: **hoy nadie puede iniciar una prueba**. Las 94 suscripciones existentes son QA en estado TRIAL | **Alta** |
| E | **WhatsApp** (cuota, tope de marketing, recargas) | Cuota mensual, tope de marketing, recargas que vencen a 12 meses | **No existe envío por WhatsApp**: solo hay una columna `conversaciones_whatsapp_mes` y textos de plan. Los recordatorios son notificaciones dentro de la app. No hay contador, tope ni recargas | **Media** (no incumple hasta que se anuncie) |

Diferencias menores:

| # | Tema | Texto v3 | Código |
|---|---|---|---|
| F | Aceptar la política antes de pagar | "debes aceptarlas para confirmar la Reserva" | La pantalla **muestra** la política ("nunca se paga sin verla"), pero no hay casilla de aceptación |
| G | Reembolso si el negocio cierra o es suspendido | El Negocio debe reembolsar los anticipos de reservas futuras | No encontré un proceso automático para ese caso |
| H | Reembolso por cobro duplicado o errado | Existe el derecho | Solo manual por soporte; si la pasarela rechaza un reembolso, queda "pendiente, soporte lo resuelve" |
| I | Upgrade del plan anual | Se paga la diferencia proporcional | La proporción se calcula con un máximo de 30 días (`least(30, …)`); en un plan anual parece cobrar de menos. **Por verificar** |
| J | Mayores de 18 años | Declarado en el texto | No vi verificación de edad en el registro |
| K | Cuenta, Google, código de 6 dígitos, re-aceptación, reseñas, créditos de IA, Mi Marca, subir de plan prorrateado, bajar al fin del ciclo | Descritos | **Coinciden** |
| L | Tarjetas | "StylerNow no almacena datos de tarjeta" | **Coincide**: solo se guarda una referencia (`metodo_pago_ref`) del método registrado en Mercado Pago |

### Opciones por cada diferencia grande

**A y B (anticipo directo y comisión).** Tu objetivo (que el dinero no sea de StylerNow) exige cambiar el flujo de pagos, no solo el texto.
1. **Cobro directo al negocio (recomendada, es tu intención).** Cada negocio conecta su cuenta de Mercado Pago (OAuth de vendedor). La preferencia de pago y los reembolsos se hacen con el token del negocio. Desaparece la custodia, la comisión del 8 % y el wallet para anticipos. Afecta a todos los cobros que hoy pasan por la cuenta central (13 archivos: reservas, gift cards, membresías, My Look, suscripciones y anuncios). Hay que decidir caso por caso qué pasa con las gift cards y los presupuestos de anuncios, que hoy retiene el wallet. Es el mismo paso que necesita el datáfono Point (la cuenta del negocio).
2. **Mantener la custodia** y reescribir los términos: StylerNow cobra, retiene y liquida (como hoy). Conserva la comisión y el wallet, pero StylerNow maneja dinero de terceros y asume las obligaciones fiscales y regulatorias que eso implica.

Sobre tu duda tributaria: no soy contador. En términos generales, si el dinero entra a la cuenta de StylerNow como intermediario, hay que registrarlo y reportarlo aunque no sea ingreso propio (por ejemplo, información exógena e impuestos sobre la comisión). Si va directo a la cuenta del negocio, esa carga no recae sobre StylerNow, pero cobrar comisión sí sería ingreso suyo. **Confírmalo con tu contador antes de decidir.**

**C (cancelación).**
1. **Política del negocio (recomendada):** el código ya lo hace; el texto pasaría a decir "cada Negocio define su ventana de cancelación y se te muestra antes de pagar; el Anticipo no es reembolsable cuando no te presentas o cancelas fuera de esa ventana; si el Negocio cancela, siempre se reembolsa". Es lo que usan Booksy y Fresha.
2. **Siempre no reembolsable (tu decisión):** hay que cambiar la función `cancelar_reserva`, la pantalla de política y la configuración del negocio, y quitar las ventanas. Es más rígido y más expuesto legalmente.
En ambos casos hay que añadir la casilla de aceptación (F).

**D (prueba).** Para "con o sin tarjeta": permitir iniciar la prueba sin método de pago (la suscripción queda en TRIAL sin `metodo_pago_ref`; al terminar pasa a `REQUIERE_PLAN` en lugar de cobrarse), mantener las verificaciones antiabuso de teléfono, documento y dispositivo, y habilitar `cobro_recurrente_habilitado` en Colombia. El estado `REQUIERE_PLAN` ya existe y el ciclo de cobro ya ignora las suscripciones sin método de pago; falta la rama de inicio sin tarjeta y el vencimiento a `REQUIERE_PLAN`.

**E (WhatsApp).** Opciones: (1) mantener la sección 11 y no publicar los planes ni la v3 hasta construir el envío, el contador, el tope y las recargas (secciones 4.5 y 6 del plan de agentes); (2) publicar ya, quitando de la sección 11 la cuota, el tope y las recargas y dejando solo el consentimiento a comunicaciones. Recomiendo la 2 para no bloquear la v3, y restituir el texto cuando exista.

## 8. Cómo publicarlo

1. Decide A/B, C, D y E (sección 7). Con cada decisión ajusto `docs/legal/TERMINOS_v3_texto.txt` y regenero la migración. El texto actual ya refleja A (directo), C (no reembolsable) y D (con o sin tarjeta), que son tus decisiones; si eliges otra opción, se cambia.
2. Abogado y contador revisan (sección 5 y el punto tributario).
3. Se aplica la migración 115. Se publica como `TERMINOS` v3 con `cambio_material = true`: **todos los usuarios, incluidos los negocios de prueba QA, deberán aceptarla** en su próximo ingreso.
4. La página `/legal/terminos` muestra la versión más reciente; el nuevo texto separa cada título de su párrafo con una línea en blanco (en la v2 todo el apartado se pintaba como título).
5. **Orden recomendado de trabajo:** primero A/B (cobro directo), porque define el resto; luego D (prueba sin tarjeta); luego C (casilla de aceptación y política); luego E.
