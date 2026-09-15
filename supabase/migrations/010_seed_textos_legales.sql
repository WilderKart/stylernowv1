-- StylerNow — Migración 010: textos legales versionados (v1)
--
-- 06-Security/04_Compliance_Colombia.md exige consentimiento explícito antes de
-- procesar datos personales (Ley 1581 de 2012 / Habeas Data). Hasta esta migración
-- `texto_legal` existía en el esquema (004) pero nunca se pobló: el checkbox del
-- login apuntaba a un link roto y no había ningún texto real detrás.
--
-- Nota de alcance: este es un texto estándar razonable para arrancar, no una
-- revisión de un abogado. Antes de un lanzamiento real hay que hacerlo revisar
-- por asesoría legal colombiana — queda anotado en 00_MASTER_TASKLIST.md.

insert into public.texto_legal (tipo, version, contenido, cambio_material) values
(
  'POLITICA_DATOS',
  1,
  $$Política de Tratamiento de Datos Personales — StylerNow

1. Responsable del tratamiento
StylerNow ("nosotros", "la plataforma") es responsable del tratamiento de tus datos personales conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia.

2. Datos que recolectamos
Recolectamos tu correo electrónico, nombre, número de celular, y los datos de tus Reservas (Servicio, Negocio, fecha, monto pagado) para poder prestarte el servicio. Si autorizás el uso de tu ubicación, la usamos únicamente para mostrarte negocios cercanos.

3. Finalidad del tratamiento
Usamos tus datos para: crear y gestionar tu cuenta, procesar tus Reservas y pagos, enviarte recordatorios de tus citas, permitir que el Negocio que reservaste te contacte sobre tu cita, y mejorar la plataforma. Nunca vendemos tus datos a terceros.

4. Tus derechos como Titular
Tenés derecho a: conocer, actualizar y rectificar tus datos; solicitar prueba de la autorización otorgada; ser informado sobre el uso de tus datos; presentar quejas ante la Superintendencia de Industria y Comercio; revocar esta autorización en cualquier momento; y acceder de forma gratuita a tus datos.

5. Cómo ejercer tus derechos
Podés actualizar tus datos directamente desde tu perfil en la app. Para solicitar la eliminación de tu cuenta o ejercer cualquier otro derecho, escribinos a los canales de soporte de StylerNow.

6. Vigencia
Esta política rige desde su fecha de publicación y permanece vigente mientras exista una relación con StylerNow o mientras la ley exija conservar tus datos (ej. registros de pagos con fines contables/tributarios).$$,
  false
),
(
  'TERMINOS',
  1,
  $$Términos y Condiciones de Uso — StylerNow

1. Aceptación
Al usar StylerNow aceptás estos términos. Si no estás de acuerdo, no debés usar la plataforma.

2. Qué es StylerNow
StylerNow es un marketplace que conecta Clientes con negocios de belleza, cuidado personal y bienestar (barberías, salones, spas, y similares) para descubrir, reservar y pagar la seña de una cita. StylerNow no presta directamente los Servicios de belleza — esa relación es entre vos y el Negocio.

3. Tu cuenta
Sos responsable de mantener la confidencialidad del acceso a tu cuenta. El registro se hace con tu correo electrónico mediante un código de acceso de un solo uso.

4. Reservas y pagos
Al reservar, aceptás pagar la Seña indicada al momento de confirmar. El Saldo restante del Servicio se paga directamente en el Negocio, salvo que este habilite el pago completo desde la app. Las condiciones de cancelación y reembolso de cada Reserva se muestran antes de confirmar el pago y varían según cuánto falte para la cita.

5. Conducta
No podés usar la plataforma para fines fraudulentos, para acosar a Negocios o Staff, ni para manipular reseñas o el sistema de reservas.

6. Responsabilidad
StylerNow facilita la conexión entre Cliente y Negocio, pero no es responsable por la calidad del Servicio prestado por el Negocio — esa responsabilidad es del Negocio. StylerNow sí es responsable por el procesamiento correcto de los pagos que gestiona directamente (la Seña).

7. Modificaciones
Podemos actualizar estos términos; si el cambio es material, te lo notificamos y te pedimos aceptarlo de nuevo antes de continuar usando la plataforma.

8. Contacto
Para dudas sobre estos términos, contactanos por los canales de soporte de StylerNow.$$,
  false
)
on conflict (tipo, version) do nothing;
