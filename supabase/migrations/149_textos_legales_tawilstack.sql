-- 149 · Publica nuevas versiones de los Términos y Condiciones y de la Política de Tratamiento de Datos Personales (TAWILSTACK S.A.S.), sin cambios de esquema.
-- Fuentes canónicas (esta migración se GENERA de ellas; no se edita a mano): docs/legal/TERMINOS_v4_borrador.txt (desde la línea del título) y docs/legal/POLITICA_DATOS_v3_texto.txt.
-- Verificación de sincronización: node scripts/legal/verificar-sincronizacion.mjs
-- cambio_material = true activa el flujo existente de reaceptación.
-- Estado de producción medido el 2026-11-17: TERMINOS hasta la versión 2 (texto corto) y POLITICA_DATOS hasta la versión 2 (con «NIT xxxxx» y dirección antigua).
-- La migración 115 (Términos de 18 000 caracteres) NO llegó a insertar su versión 3 en producción; por eso aquí las versiones nuevas son max+1 (TERMINOS 3, POLITICA_DATOS 3).
-- Se aborta (sin cambios) si el estado de las versiones no es el esperado o si los textos conservan marcadores. El NIT permanece «en trámite de asignación» a propósito.

begin;

do $publicar$
declare
  v_terminos text := $terminos$Términos y Condiciones de Uso — StylerNow

1. Quiénes somos y aceptación

TAWILSTACK S.A.S., con NIT en trámite de asignación, domicilio en Calle 15B # 20-79, Candelaria, Valle del Cauca, Colombia, correo electrónico equipo@stylernow.com y teléfono +57 3183943465, es la sociedad que opera StylerNow, su producto de software como servicio y plataforma digital ("StylerNow" o la "Plataforma"). En estos términos, "TAWILSTACK" o "nosotros" es TAWILSTACK S.A.S. StylerNow no es una persona jurídica distinta: cuando estos términos hablan de StylerNow como parte (sus derechos, obligaciones, cobros, responsabilidad o tratamiento de datos), se refieren a TAWILSTACK S.A.S., que es la contraparte de los Usuarios. Estos términos regulan el uso del sitio web, la aplicación y los servicios relacionados.

Al crear una cuenta y marcar la casilla de aceptación, aceptas estos términos sin modificaciones y la Política de Tratamiento de Datos Personales; con esa casilla nos autorizas a tratar tus datos personales para las finalidades necesarias que la política describe (sección 3, letras a a g y j). Esa aceptación no incluye las autorizaciones opcionales, como las de marketing, que se piden por separado. Si no estás de acuerdo, no debes usar la Plataforma. Te recomendamos guardar una copia.

2. Definiciones

Cliente: persona que descubre, reserva y paga Servicios de un Negocio a través de la Plataforma.

Negocio: barbería, salón, spa u otro establecimiento de belleza, cuidado personal o bienestar que ofrece sus Servicios y usa la Plataforma para gestionarlos.

Equipo: barberos, profesionales y demás personas a quienes el Negocio da acceso a la Plataforma.

Servicio: el servicio que presta un Negocio a un Cliente.

Reserva: la cita agendada por un Cliente con un Negocio.

Anticipo: el pago parcial o total del Servicio que el Cliente hace al reservar. Saldo: lo que falta por pagar del Servicio.

Plan: la suscripción mensual o anual que contrata el Negocio.

Usuario: el Cliente o el Negocio. Quien use ambas funciones queda sujeto a todas las reglas que le apliquen.

3. Qué es StylerNow

StylerNow es un intermediario tecnológico. Ofrece (a) un marketplace donde los Clientes descubren Negocios, reservan y pagan el Anticipo de una cita, y (b) un software de gestión (agenda, clientes, caja, inventario, mensajes y otras herramientas) que los Negocios contratan mediante un Plan.

StylerNow no presta los Servicios de belleza ni es parte de la relación entre el Cliente y el Negocio por el Servicio. Esa relación es entre ellos y el Negocio responde por el Servicio.

4. Tu cuenta

Para crear tu cuenta usas tu correo electrónico y una contraseña, y verificas el correo con un código de un solo uso que te enviamos. Para ingresar usas tu correo y tu contraseña, o tu cuenta de Google cuando esa opción esté disponible. Si olvidas tu contraseña, puedes recuperarla desde el ingreso.

Eres responsable de mantener la confidencialidad del acceso a tu cuenta y de todo lo que ocurra en ella. No puedes ceder, transferir ni compartir tu cuenta con otra persona. Avísanos de inmediato si sospechas un uso no autorizado. Para proteger el acceso limitamos los intentos de ingreso por cuenta y por conexión, y registramos esos intentos conforme a la Política de Tratamiento de Datos Personales. No respondemos por el acceso de terceros que resulte del robo o la apropiación indebida de tu acceso por causas ajenas a nosotros.

Puedes cancelar tu cuenta en cualquier momento. Los efectos de la cancelación se explican en la sección de suspensión y terminación.

La Plataforma es para mayores de 18 años. Un adulto puede reservar para un menor a su cargo y es responsable de esa Reserva y de autorizar el Servicio. No recopilamos a sabiendas datos personales de menores sin la autorización de su representante legal.

5. Reservas y pagos del Cliente

Al reservar aceptas pagar el Anticipo indicado antes de confirmar. El Saldo se paga directamente en el Negocio, salvo que este habilite el pago completo desde la app.

El precio, la duración, la disponibilidad, la descripción y las fotos de cada Servicio los define el Negocio. Las imágenes y descripciones son ilustrativas y el Servicio real puede diferir. Debes presentarte en el lugar del Negocio a la hora de tu Reserva, salvo que el Servicio se preste por medios digitales.

Los pagos en línea se registran y procesan en Mercado Pago, cuyas condiciones también aplican. Los datos de tu tarjeta los guarda Mercado Pago y StylerNow no los almacena. El Anticipo se paga directamente a la cuenta de Mercado Pago del Negocio. Si el Negocio no tiene su cuenta conectada, no se cobran Anticipos en línea para sus Reservas.

6. Cancelación, no presentación y reembolsos del Anticipo

Cada Negocio define su política de cancelación dentro de los límites que fija StylerNow. Antes de pagar verás la política aplicable a tu Reserva y debes aceptarla expresamente para pagar el Anticipo. Guardamos constancia de la versión que aceptaste, con fecha y hora, y esa es la que rige tu Reserva aunque el Negocio la cambie después.

Salvo que el Negocio publique otra dentro de esos límites, la política es: (a) si cancelas con 24 horas o más de anticipación, te devolvemos el 100 % del Anticipo; (b) si cancelas con 2 horas o más pero menos de 24 horas de anticipación, te devolvemos el 50 %; (c) si cancelas con menos de 2 horas de anticipación o no te presentas a la hora acordada, el Anticipo (que puede ser hasta el valor total del Servicio) no es reembolsable y queda para el Negocio por el espacio reservado. Las horas se cuentan hasta la hora de inicio de tu Reserva.

Reprogramar una Reserva depende del acuerdo con el Negocio. Si el Negocio la acepta, el Anticipo se conserva para la nueva fecha.

Siempre tienes derecho al reembolso del 100 % del Anticipo cuando: (a) el Negocio cancela la Reserva o no presta el Servicio; (b) el Negocio cierra su cuenta o es suspendido y tu Reserva no puede atenderse; o (c) se hizo un cobro duplicado, errado o que no autorizaste.

Cuando corresponde un reembolso, la Plataforma lo solicita a Mercado Pago, al mismo medio de pago y desde la cuenta en la que se cobró el Anticipo, y te muestra su estado: solicitado, confirmado o en revisión. Solo lo damos por hecho cuando Mercado Pago lo confirma, y el dinero puede tardar en verse según tu medio de pago. Si Mercado Pago no puede procesarlo (por ejemplo, por falta de saldo en la cuenta del Negocio), el caso queda en revisión y el Negocio sigue obligado a devolverlo. No descontamos del reembolso las tarifas del procesador.

Lo anterior no afecta los derechos irrenunciables que la ley de consumo aplicable te reconozca, incluido el derecho de retracto en las compras a distancia cuando la ley lo conceda y con las excepciones que ella prevea.

7. Servicios de los Negocios y responsabilidad

Cada Negocio es responsable de la naturaleza, calidad, seguridad e higiene de sus Servicios, de su personal, de sus políticas de reprogramación, cambios y devolución del Saldo, y de que la información que publica sea precisa, completa y no engañosa. Cualquier disputa sobre estos puntos se resuelve con el Negocio.

El Cliente debe informar con anticipación al Negocio cualquier condición médica, alergia o necesidad especial que pueda afectar un Servicio o verse afectada por él (por ejemplo, alergias a tintes o productos). StylerNow no presta asesoría médica, dermatológica ni estética: las pruebas de sensibilidad, las indicaciones de uso de productos y los cuidados posteriores son responsabilidad del Negocio y de su Equipo.

StylerNow no responde por lesiones, pérdidas o daños derivados de los Servicios del Negocio. Esto no excluye la responsabilidad que la ley no permite excluir.

Las reseñas deben reflejar experiencias reales.

8. Planes y suscripción del Negocio

(a) El Negocio accede a las herramientas mediante un Plan (Essential, Studio, Prestige o Signature), mensual o anual. Cada Plan incluye un número de barberos y sedes, una cuota mensual de mensajes de WhatsApp y las funciones indicadas en la página de planes vigente al contratar. El Plan Signature se cotiza según las necesidades del Negocio y el precio "desde" publicado es solo de referencia. Podemos ofrecer complementos (por ejemplo, barberos o sedes adicionales, Mi Marca, créditos de inteligencia artificial y recargas de WhatsApp), cada uno con su precio.

(b) El Plan se paga por adelantado por cada período (mensual o anual), en la moneda y con el tratamiento de impuestos indicados al contratar, desde la sección «Plan y facturación» del panel, a través de Mercado Pago y a la cuenta de TAWILSTACK S.A.S. No hacemos cobros automáticos ni renovaciones automáticas: para continuar debes pagar cada período. Puedes renovar desde 7 días antes de que termine el período vigente, y los días que te queden no se pierden. El Plan se activa cuando Mercado Pago confirma el pago. Los datos de tu tarjeta los guarda Mercado Pago y TAWILSTACK S.A.S. no los almacena. Estos pagos son independientes de los Anticipos que tus Clientes te pagan a ti.

(c) Podemos ofrecer una prueba gratuita por la duración indicada al iniciarla, una sola vez por Negocio, sin registrar tarjeta ni otro método de pago. Para evitar pruebas repetidas te pedimos teléfono y documento, que guardamos solo como huella cifrada. Durante la prueba tienes las funciones del Plan elegido. Te avisamos antes de que termine. Al terminar no se te cobra nada automáticamente: para seguir recibiendo Reservas debes pagar tu Plan, y puedes hacerlo en cualquier momento de la prueba sin perder los días que te queden.

(d) Puedes subir a un Plan superior en cualquier momento pagando solo la diferencia proporcional al tiempo restante. Puedes bajar de Plan o cancelar en cualquier momento, pero lo ya pagado no se reembolsa y conservas el acceso hasta el final del período pagado. En el Plan anual esto aplica también si bajas de Plan, reduces profesionales o cancelas antes de cumplirse el año contado desde la contratación.

(e) Las promociones (como el precio fundador) se rigen por las condiciones publicadas al contratarlas y pueden perderse si cancelas antes del plazo indicado.

(f) Si superas los barberos o sedes incluidos en tu Plan, debes contratar los adicionales o subir de Plan.

(g) Si al terminar la prueba o el período pagado no has pagado el Plan, tienes un período de gracia de tres (3) días, informado en tu panel, durante el cual sigues recibiendo Reservas. Pasado ese período sin pago, tu Negocio deja de recibir Reservas nuevas y su perfil se oculta del mapa hasta que pagues; al confirmarse el pago, el acceso se restablece según tu Plan. Las Reservas ya confirmadas se mantienen.

(h) Revisamos los precios de los Planes cada trimestre, sin una fecha fija. En cada revisión el precio puede cambiar o mantenerse. Si cambia, te avisamos con antelación razonable y el nuevo precio rige desde tu siguiente renovación.

9. Obligaciones del Negocio

El Negocio debe mantener actualizada y veraz la información de su perfil (servicios, precios, horarios, equipo y fotos) y cumplir las normas aplicables a su actividad: permisos, higiene y salubridad, impuestos, facturación a sus clientes y publicidad.

El Negocio es responsable del Equipo al que da acceso, de los permisos que le asigna y de la política de cancelación que publique, que debe ser clara.

El Negocio trata los datos de los Clientes que recibe a través de la Plataforma como responsable independiente, en los términos de la cláusula 9A.

9A. Datos de los Clientes: roles, usos permitidos, incidentes e indemnidad

(a) Roles. TAWILSTACK S.A.S. es responsable del tratamiento de los datos que los Clientes entregan a la Plataforma para operarla. Cuando se confirma una Reserva, la Plataforma entrega al Negocio el nombre, el contacto y el detalle de la cita del Cliente, con la autorización específica que el Cliente marca para esa Reserva. Desde esa entrega, el Negocio es responsable independiente de esos datos conforme a la Ley 1581 de 2012 y al Decreto 1074 de 2015, y debe cumplir por sí mismo los deberes que la ley impone a los responsables: tener su propia política de tratamiento, conservar prueba de las autorizaciones adicionales que obtenga, atender las consultas y reclamos de sus clientes y garantizar la seguridad de la información. Respecto de la información que el Negocio carga en la Plataforma sobre sus clientes (por ejemplo, notas, historial y etiquetas), el Negocio es responsable y TAWILSTACK S.A.S. actúa como encargado, tratándola solo según estos términos y las instrucciones del Negocio.

(b) Usos permitidos. El Negocio solo puede usar los datos de un Cliente obtenidos a través de la Plataforma para gestionar y prestar el Servicio reservado: confirmar, reprogramar, recordar y atender la cita, cobrar el Saldo, tramitar reembolsos y cumplir la ley. Cualquier otro uso (publicidad, promociones, campañas, encuestas comerciales, venta o cesión a terceros, inclusión en listas de marketing) exige una autorización previa, expresa e informada que el Negocio obtenga directamente del Cliente y pueda probar, o la marca de promociones que el Cliente otorgó en la Plataforma para ese Negocio.

(c) Mensajes comerciales y horarios. Está prohibido enviar al Cliente mensajes comerciales por WhatsApp, SMS, llamada, correo u otro medio sin esa autorización y, aun con ella, hacerlo de lunes a viernes fuera de las 7:00 a. m. a 7:00 p. m., los sábados fuera de las 8:00 a. m. a 3:00 p. m. (hora de Colombia), en domingos y festivos, o más de una vez al día; cada mensaje comercial debe ofrecer una forma sencilla de dejar de recibirlos (Ley 2300 de 2023). Los avisos operativos de la cita no son publicidad.

(d) Seguridad y confidencialidad. El Negocio protegerá los datos de los Clientes con medidas razonables, limitará el acceso de su Equipo según la función de cada persona, no copiará la base de Clientes a dispositivos o sistemas sin protección y mantendrá la confidencialidad después de terminar la relación.

(e) Incidentes. Si el Negocio conoce una pérdida, robo, acceso no autorizado o uso indebido de datos de Clientes obtenidos a través de la Plataforma, lo reportará a TAWILSTACK S.A.S. dentro de las 24 horas siguientes, escribiendo a equipo@stylernow.com e indicando qué ocurrió, qué datos y cuántas personas se afectaron y qué medidas tomó; colaborará en la investigación y en las notificaciones a los afectados y a la autoridad, y asumirá el reporte que le corresponda como responsable.

(f) Derechos de los Clientes. Si un Cliente ejerce un derecho ante TAWILSTACK S.A.S. sobre datos que el Negocio registró, TAWILSTACK S.A.S. le trasladará la solicitud y el Negocio la atenderá en los plazos legales. Si un Cliente retira la autorización de promociones, el Negocio dejará de enviarlas de inmediato.

(g) Responsabilidad e indemnidad. El Negocio responde frente a los Clientes y frente a las autoridades por el tratamiento que hace como responsable independiente, y mantendrá indemne a TAWILSTACK S.A.S., a sus directivos y empleados frente a reclamaciones, demandas, multas que TAWILSTACK S.A.S. deba pagar por hechos imputables al Negocio, costos razonables de defensa y perjuicios derivados del incumplimiento de esta cláusula o de la ley por parte del Negocio, su Equipo, sus proveedores o cualquier persona a quien haya entregado datos. Las sanciones administrativas son personales: esta cláusula no traslada a TAWILSTACK S.A.S. las del Negocio ni exime a TAWILSTACK S.A.S. de los deberes que la ley le impone directamente.

(h) Terminación. El incumplimiento de esta cláusula es causal de suspensión o terminación de la cuenta del Negocio. Al terminar la relación, el Negocio podrá exportar la información de sus clientes que haya registrado y TAWILSTACK S.A.S. la suprimirá o anonimizará según la Política de Tratamiento de Datos Personales, salvo lo que deba conservarse por ley.

Debe tener los derechos sobre las fotos, logos y demás contenido que publique, y la autorización de las personas que aparezcan en ellos.

10. Cobros a Clientes, pagos al Negocio y comisiones

Los Anticipos que el Cliente paga a través de la Plataforma se pagan directamente a la cuenta de Mercado Pago del Negocio, que el Negocio conecta a la Plataforma. TAWILSTACK S.A.S. no recibe, custodia ni administra ese dinero, que no es suyo. El Anticipo que no se reembolsa por cancelación o inasistencia del Cliente corresponde al Negocio. TAWILSTACK S.A.S. ofrece los Planes, complementos, publicidad y recargas de WhatsApp, que se pagan a su cuenta.

El Negocio es responsable de sus obligaciones tributarias y contables sobre los pagos que recibe, de las tarifas que Mercado Pago le cobre y de los reembolsos que correspondan a sus Clientes. Los contracargos y disputas de un pago se resuelven entre el Negocio y el procesador de pagos. La Plataforma registra los movimientos para que los consultes y exportes, pero ese registro no reemplaza tu contabilidad.

Por defecto, StylerNow no cobra comisión por reserva. Si en el futuro se pacta o se fija una comisión, te la informaremos con antelación, se mostrará en tu panel y aplicará solo a pagos posteriores a su entrada en vigencia.

11. WhatsApp, mensajes y comunicaciones

Aceptas recibir comunicaciones electrónicas (correo, notificaciones en la app y WhatsApp) sobre tu cuenta y tus Reservas, como recordatorios, confirmaciones y cambios. Estas comunicaciones cumplen cualquier requisito legal de que se hagan por escrito. Los mensajes de promoción solo se envían si los autorizas y puedes revocar esa autorización en cualquier momento.

Cada Plan incluye una cuota mensual de mensajes de plantilla de WhatsApp. La cuota distingue los mensajes de aviso (recordatorios y confirmaciones) de los de marketing (promociones y campañas), y estos últimos tienen un tope porcentual de la cuota. Las recargas se consumen después de la cuota del Plan, vencen a los 12 meses de su compra y no son reembolsables. Como los costos y reglas de Meta pueden cambiar, podemos ajustar cuotas, topes y precios de recargas con aviso previo.

El envío de mensajes por WhatsApp se activa cuando la conexión con el proveedor de WhatsApp Business esté habilitada, y tu panel muestra su estado. Mientras no lo esté, puedes preparar plantillas y campañas, pero no se envía ningún mensaje ni se descuenta nada de tu cuota. Las campañas de marketing solo llegan a Clientes que autorizaron recibir promociones por WhatsApp, deben programarse de lunes a viernes entre las 7:00 a. m. y las 7:00 p. m. y los sábados entre las 8:00 a. m. y las 3:00 p. m., hora de Colombia, nunca en domingos ni festivos y con un máximo de un contacto comercial por día, y cada mensaje debe ofrecer una forma sencilla de dejar de recibirlos (Ley 2300 de 2023). La Plataforma podrá bloquear o reprogramar los envíos que incumplan esas franjas. Los avisos operativos de reservas no son publicidad y no están sujetos a ellas.

El Negocio garantiza que cuenta con la autorización de sus clientes para recibir mensajes y que cumple las políticas de WhatsApp y de Meta. Podemos limitar o suspender el envío si hay abuso, quejas o riesgo para el número de envío.

12. Uso aceptable

No puedes usar la Plataforma para fines ilegales o fraudulentos, para acosar a Negocios, Equipo o Clientes, ni para manipular reseñas o el sistema de reservas.

Tampoco puedes dañar, deshabilitar, sobrecargar o deteriorar la Plataforma; obtener información por medios no previstos (por ejemplo, rastreo automatizado); hacer ingeniería inversa; revender o sublicenciar la Plataforma; ni intentar eludir los límites o bloqueos de tu Plan ni probar vulnerabilidades sin autorización escrita.

13. Propiedad intelectual y contenido

Te otorgamos una licencia limitada, no exclusiva, intransferible y revocable para usar la Plataforma de acuerdo con estos términos. El software, el diseño, las marcas y el contenido de StylerNow son nuestros o de nuestros licenciantes y no adquieres derechos sobre ellos.

El contenido que subes sigue siendo tuyo. Nos autorizas a alojarlo, mostrarlo y procesarlo en la Plataforma (por ejemplo, en tu perfil, el mapa y las reseñas) mientras mantengas tu cuenta y el tiempo necesario después. Eres responsable de que tu contenido no infrinja derechos de terceros. Si crees que un contenido es ilícito, falso o infringe tus derechos, escríbenos a equipo@stylernow.com indicando cuál es y por qué; podremos retirarlo o limitarlo mientras lo revisamos, e informar a quien lo publicó.

14. Datos personales

Tratamos tus datos personales conforme a la Política de Tratamiento de Datos Personales, a la Ley 1581 de 2012, al Decreto 1074 de 2015 y a las normas aplicables en tu país, con la autorización que nos das al registrarte y, para cada Reserva, con la autorización específica que marcas antes de confirmarla. Para atender tu Reserva compartimos con el Negocio tu nombre, tu contacto y el detalle de la cita; desde ese momento el Negocio es responsable independiente de esos datos (cláusula 9A). Puedes ejercer tus derechos de habeas data como indica la política.

15. Terceros y enlaces

La Plataforma puede enlazar sitios de terceros y depende de servicios de terceros, como procesadores de pago (por ejemplo, Mercado Pago), Google, Meta (WhatsApp) y proveedores de infraestructura. No controlamos sus contenidos ni responden por ellos nuestros términos; aplican los suyos. Compartimos con ellos los datos necesarios para prestar el servicio, conforme a la Política de Tratamiento de Datos Personales.

16. Disponibilidad y límite de responsabilidad

Hacemos esfuerzos razonables para que la Plataforma esté disponible, pero se ofrece "tal como está": puede haber interrupciones por mantenimiento, fallas de terceros o causas fuera de nuestro control, y la información puede contener errores. Podemos mejorar o cambiar sus funciones.

Dentro de lo permitido por la ley, StylerNow no responde por daños indirectos, lucro cesante ni pérdida de datos o de clientes. Nuestra responsabilidad total frente a un Negocio se limita a lo que haya pagado por su Plan en los 12 meses anteriores al hecho y, frente a un Cliente, y solo en lo que la ley de consumo permita limitarla, al valor del Anticipo de la Reserva implicada. Nada de esto limita la responsabilidad que la ley no permite limitar, como el dolo, la culpa grave, la garantía legal o los derechos irrenunciables del consumidor.

Ninguna de las partes responde por el incumplimiento o el retraso causado por fuerza mayor o caso fortuito, como fallas generales de energía, de internet o de los servicios de terceros, actos de autoridad, desastres naturales o ataques informáticos que no pudieron evitarse con diligencia razonable.

17. Responsabilidad del Negocio frente a reclamaciones

El Negocio mantendrá indemne a StylerNow, a sus directivos y empleados frente a reclamaciones de terceros (incluidos Clientes y autoridades) derivadas de sus Servicios, del contenido que publique o del incumplimiento de estos términos o de la ley, incluidos los costos razonables de defensa; para los datos de los Clientes aplica además la cláusula 9A. StylerNow puede asumir la defensa por su cuenta y el Negocio colaborará. Esta sección no aplica a Clientes.

18. Suspensión y terminación

Puedes cancelar tu cuenta cuando quieras. Podemos suspender o cancelar tu acceso, avisándote cuando sea posible, si incumples estos términos, hay fraude, riesgo de seguridad, falta de pago o un requerimiento de autoridad.

Si un Negocio cierra su cuenta o es suspendido, se bloquean sus nuevas Reservas, se cancelan sus Reservas futuras y la Plataforma solicita el reembolso del 100 % de los Anticipos pagados y notifica a cada Cliente. El Negocio sigue obligado a esos reembolsos si Mercado Pago no puede procesarlos. Al terminar, conservamos los datos según la Política de Tratamiento de Datos Personales y las obligaciones legales, como las contables. Las reglas de reembolso de la sección de Planes siguen aplicando.

19. Usuarios internacionales

La Plataforma se opera desde Colombia y está disponible en Colombia, Estados Unidos, México y España. Si accedes desde otro país, eres responsable de cumplir tus leyes locales.

20. Ley aplicable y controversias

Estos términos se rigen por las leyes de Colombia. Antes de acudir a un juez, escríbenos a soporte para intentar resolver la diferencia. Si no se resuelve, las controversias se someterán a los jueces competentes de Cali, Colombia, salvo que la ley de consumo de tu país te permita acudir a tus propios tribunales o a la autoridad de consumo (en Colombia, la Superintendencia de Industria y Comercio), caso en el que prevalece esa norma.

21. Disposiciones generales

No existe sociedad, empresa conjunta, empleo ni agencia entre StylerNow y los Usuarios por el uso de la Plataforma. Cumpliremos los requerimientos de autoridades competentes. Si alguna disposición es inválida o inaplicable, se reemplaza por la válida que más se acerque a su intención y el resto sigue vigente.

Estos términos y la Política de Tratamiento de Datos Personales son el acuerdo completo entre tú y StylerNow sobre la Plataforma. Los mensajes de datos, los registros electrónicos y las copias impresas son admisibles como prueba conforme a la Ley 527 de 1999. Las comunicaciones que te enviemos al correo de tu cuenta o dentro de la Plataforma se consideran recibidas cuando las enviamos. No puedes ceder tus derechos sin nuestro consentimiento; nosotros podemos cederlos en una reorganización empresarial notificándote.

22. Cambios en los términos

Podemos actualizar estos términos. Si el cambio es material, te lo notificamos y te pedimos aceptarlo de nuevo antes de continuar usando la Plataforma. La versión vigente reemplaza a las anteriores y está siempre disponible en la Plataforma.

23. Contacto

Para dudas sobre estos términos, contáctanos por los canales de soporte dentro de la Plataforma, en equipo@stylernow.com o al teléfono +57 3183943465. El domicilio de TAWILSTACK S.A.S. es Calle 15B # 20-79, Candelaria, Valle del Cauca, Colombia.

Peticiones, quejas y reclamos: puedes presentarlos por esos mismos canales y los atendemos dentro de los quince (15) días hábiles siguientes. Presentar la reclamación directamente ante nosotros es un paso previo para acudir a la Superintendencia de Industria y Comercio en una acción de protección al consumidor, sin perjuicio de tus derechos. Las consultas y reclamos sobre datos personales siguen el procedimiento de la Política de Tratamiento de Datos Personales.
$terminos$;
  v_politica text := $politica$Política de Tratamiento de Datos Personales — StylerNow

1. Responsable del tratamiento

TAWILSTACK S.A.S., con NIT en trámite de asignación, domicilio en Calle 15B # 20-79, Candelaria, Valle del Cauca, Colombia, correo electrónico equipo@stylernow.com y teléfono +57 3183943465, opera StylerNow, su producto de software como servicio y plataforma digital. En esta política, TAWILSTACK S.A.S. se denomina “TAWILSTACK” y StylerNow se refiere al producto. StylerNow no es una persona jurídica distinta: es un producto de TAWILSTACK, y todo tratamiento de datos que esta política atribuya a StylerNow lo realiza TAWILSTACK, que responde ante los titulares y ante las autoridades.

TAWILSTACK es responsable del tratamiento para los fines y medios que determina al operar StylerNow. Cuando un Negocio utiliza StylerNow para cargar y gestionar información de sus clientes bajo sus instrucciones, el Negocio determina esos fines y actúa como responsable, y TAWILSTACK trata esos datos por cuenta del Negocio como encargado. Para la información de reservas que se comparte entre la Plataforma y un Negocio, cada parte tratará los datos para las finalidades que determine y cumplirá las obligaciones que le correspondan según su rol efectivo.

El tratamiento se rige por los principios de legalidad, finalidad, libertad, veracidad o calidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad. Esta política explica qué información se trata, para qué, con quién se comparte, durante cuánto tiempo según cada finalidad y cómo puedes ejercer tus derechos.

Atención de datos personales: el equipo de TAWILSTACK encargado de la protección de datos personales atiende las consultas, reclamos y solicitudes de los titulares a través de equipo@stylernow.com y del teléfono +57 3183943465, según el procedimiento de la sección 9.

2. Datos que tratamos

Datos que nos das:
(a) Cuenta: nombre, correo electrónico, celular, país e idioma. Opcionalmente, foto de perfil, fecha de nacimiento y categorías de interés.
(b) Reservas: Negocio, sede, profesional, servicios, fecha, hora, valores y estado de la cita, reprogramaciones, cancelaciones e inasistencias.
(c) Política de cancelación: cuando pagas un anticipo, guardamos la política que aceptaste (texto, números y versión), con fecha, hora y zona horaria, como constancia.
(d) Pagos: monto, estado, medio y referencias de la transacción. Los datos de tu tarjeta los recibe y guarda Mercado Pago. TAWILSTACK no los recibe ni los almacena.
(e) Contenido: reseñas, mensajes del chat de una cita, fotos de antes y después de un servicio (solo con tu consentimiento) y la información de tu programa de lealtad (puntos, sellos, beneficios, referidos y grupo familiar).
(f) Negocios: datos de contacto y de identificación fiscal del Negocio, su equipo, servicios, horarios y precios. Si el Negocio conecta su cuenta de Mercado Pago, guardamos cifradas las credenciales que Mercado Pago entrega para cobrar a su nombre.
(g) Prueba gratuita del Negocio: para que cada Negocio use una sola prueba, convertimos en huellas criptográficas irreversibles (con una clave secreta que solo conoce TAWILSTACK) el teléfono y el documento que nos indicas, tu correo, un identificador de dispositivo (que guardamos en una cookie técnica llamada sn_disp, de hasta 730 días), tu dirección IP y rasgos generales de tu equipo (tipo de navegador, tamaño de pantalla, zona horaria e idioma). No guardamos esos datos en texto claro para este control ni los usamos para identificarte en la interfaz.

Datos que se generan al usar la Plataforma:
(h) Seguridad y prevención de abuso: (i) registramos los intentos de ingreso, de envío de código y de recuperación de contraseña con tu correo, el tipo de intento, si tuvo éxito y la hora, para bloquear intentos repetidos; (ii) para limitar los intentos por conexión convertimos tu dirección IP en una huella irreversible que eliminamos en un plazo máximo de dos días y no guardamos la dirección IP en texto claro con ese fin; (iii) para contar clics e impresiones de anuncios de forma honesta generamos una huella irreversible a partir de tu cuenta o, si no has iniciado sesión, de tu conexión y tu navegador; (iv) nuestro proveedor de autenticación (Supabase) guarda, por cada sesión activa, la dirección IP y el navegador con que se inició, para proteger tu cuenta mientras la sesión exista; (v) cuando ocurre un error en la aplicación, nuestro proveedor de monitoreo (Sentry) recibe el tipo de error, la pantalla en que ocurrió, el nombre y la versión de tu navegador y sistema operativo y, si has iniciado sesión, el identificador interno de tu cuenta; no le enviamos tu correo, tu nombre, tus cookies ni las cabeceras de tu conexión; (vi) para comprobar que eres una persona y no un programa automático en el registro, el ingreso y la recuperación de contraseña usamos Cloudflare Turnstile, que recibe señales técnicas de tu navegador y tu dirección IP; (vii) mantenemos registros de auditoría de las acciones relevantes en los paneles, con el identificador de la cuenta y de la petición, sin dirección IP ni datos de tu navegador. Las constancias de aceptación y de autorización de la sección 4 no incluyen tu dirección IP ni datos de tu navegador.
(i) Ubicación: solo cuando pulsas «Cerca de mí» o «Usar mi ubicación» y tu navegador lo permite, usamos tus coordenadas aproximadas para ordenar los resultados por cercanía o calcular la distancia a una sede. No las guardamos en nuestra base de datos ni deducimos tu ciudad a partir de tu dirección IP. Como viajan en la dirección de la página, pueden quedar en el historial de tu navegador y, por un tiempo corto, en los registros de ejecución de nuestro proveedor de alojamiento. Puedes revocar el permiso desde tu navegador.
(j) Analítica de uso y rendimiento: solo si la autorizas en el Centro de privacidad.
(k) Visitas a perfiles de Negocios y clics en anuncios, para medir campañas de forma agregada.
(l) Cookies y almacenamiento local: cookies de sesión de autenticación, cookie de idioma, cookie técnica de dispositivo para la prueba gratuita del Negocio (sn_disp) y tu elección sobre cookies de analítica, que se guarda en el almacenamiento local de tu navegador. Ninguna es publicitaria.

No solicitamos diagnósticos ni usamos datos sensibles como requisito general para crear una cuenta o reservar. Si decides comunicar al Negocio una alergia, condición de salud u otra información sensible para que pueda prestarte el servicio con seguridad, el Negocio determina ese tratamiento como responsable independiente. TAWILSTACK tratará esa información por cuenta del Negocio solo si queda almacenada o procesada en StylerNow, conforme a las instrucciones y finalidades del Negocio. Evita incluir información sensible que no sea necesaria. Es facultativo responder cualquier pregunta sobre datos sensibles o sobre menores de edad, y ninguna actividad de la Plataforma está condicionada a que lo hagas.

La Plataforma está dirigida a personas mayores de 18 años. Un padre, madre o representante puede realizar una reserva para un menor bajo su responsabilidad. No se debe crear una cuenta independiente para un menor. El Negocio debe tratar la información del menor y cualquier dato sensible conforme a la ley y a las autorizaciones que correspondan.

3. Para qué usamos tus datos

(a) Crear y proteger tu cuenta y verificar tu identidad al iniciar sesión.
(b) Gestionar tus reservas: disponibilidad, confirmación, recordatorios, cambios, cancelaciones y, cuando corresponde, reembolsos.
(c) Procesar pagos a través de Mercado Pago y dejar constancia de cada operación.
(d) Compartir con el Negocio que eliges los datos necesarios para atenderte (nombre, contacto y detalle de la cita).
(e) Operar los programas de lealtad, gift cards, membresías y referidos.
(f) Prevenir fraude y abuso, por ejemplo pruebas gratuitas repetidas, accesos no autorizados o reseñas falsas.
(g) Cumplir obligaciones legales, contables y tributarias, y atender requerimientos de autoridades.
(h) Con tu autorización previa, y solo para cada fin que autorices: analítica de uso, recomendaciones personalizadas, ofertas de negocios cercanos, compartir tu nombre y ciudad con marcas aliadas, novedades de StylerNow por correo y promociones por WhatsApp de los negocios donde te atendiste.
(i) Funciones de inteligencia artificial para los Negocios (por ejemplo, textos sugeridos y análisis de su operación). Estas funciones procesan información del Negocio y pueden usar datos de sus citas y clientes de forma limitada a la tarea solicitada, sin tomar decisiones automatizadas con efectos jurídicos sobre las personas y conforme a las instrucciones de la Superintendencia de Industria y Comercio sobre el tratamiento de datos personales en sistemas de inteligencia artificial (Circular Externa 002 de 2024).
(j) Utilizar cookies o almacenamiento local necesario para mantener la sesión, recordar el idioma, guardar tu elección de cookies y proteger la Plataforma; la cookie de identificador de dispositivo también se usa para prevenir pruebas gratuitas repetidas.
(k) Si lo autorizas, activar analítica de visitas y rendimiento de Vercel mediante sus herramientas Analytics y Speed Insights. Si no eliges analítica, esas herramientas no se cargan.

TAWILSTACK no vende tus datos personales.

4. Autorizaciones independientes

Al registrarte marcas la casilla de aceptación de los Términos y de esta política. Con ella aceptas los Términos y Condiciones y nos das tu autorización previa, expresa e informada para tratar tus datos personales para las finalidades necesarias descritas en la sección 3, letras (a) a (g) y (j); sin ese tratamiento no podemos crear tu cuenta ni prestarte el servicio. La casilla no viene marcada y el silencio no se entiende como autorización. Además, antes de confirmar cada reserva autorizas de forma específica que StylerNow y el Negocio elegido usen tu nombre, celular y correo solo para gestionar esa reserva y avisarte sobre ella. Esa aceptación no incluye las finalidades opcionales: la autorización para finalidades opcionales no se presume por aceptar los Términos ni esta política. Las preferencias de analítica, personalización, ofertas cercanas, beneficios de marcas aliadas y comunicaciones de marketing se solicitan por separado, no están activadas por defecto y puedes retirarlas desde el Centro de privacidad o mediante los canales de contacto. Guardamos un historial de cada decisión y su fecha. Los avisos operativos de cuenta y reserva no son publicidad y no dependen de que aceptes marketing.

La elección de cookies se conserva en el navegador. Si has iniciado sesión, la preferencia de analítica también puede registrarse en tu cuenta. Puedes cambiarla en cualquier momento desde el banner o el Centro de privacidad. Las cookies y el almacenamiento estrictamente necesarios para el funcionamiento y la seguridad no se desactivan con la opción de rechazar analítica.

5. Con quién compartimos datos

(a) El Negocio con el que reservas, para prestarte el servicio.
(b) Proveedores que nos ayudan a operar, solo con los datos necesarios y bajo deber de confidencialidad:
- Supabase: base de datos, autenticación y almacenamiento de archivos.
- Vercel: alojamiento de la Plataforma y analítica (esta última, solo con tu autorización).
- Mercado Pago: procesamiento de pagos y reembolsos.
- Resend: envío de correos.
- Google: inicio de sesión con Google, si lo eliges.
- Cloudflare (Turnstile): verificación contra programas automáticos en el registro, el ingreso y la recuperación de contraseña.
- Sentry: monitoreo de errores de la aplicación (recibe el error, la pantalla, el navegador y sistema operativo y el identificador interno de tu cuenta; no recibe tu correo, tu nombre ni tus cookies).
- OpenStreetMap (Nominatim): conversión de las coordenadas de la sede de un Negocio en una dirección; recibe solo esas coordenadas.
- OpenStreetMap: imágenes del mapa. Tu navegador las descarga directamente, lo que expone tu dirección IP a ese servicio.
- Proveedores de inteligencia artificial (por ejemplo, OpenRouter y Google Gemini): solo para las funciones de IA de los Negocios.
- Meta (WhatsApp Business): solo cuando el envío de mensajes por WhatsApp esté habilitado.
(c) Marcas aliadas: solo tu nombre y ciudad, y solo si lo autorizas.
(d) Autoridades, cuando la ley lo exija.

Los proveedores tratan la información necesaria para prestar el servicio contratado bajo las condiciones de seguridad y confidencialidad aplicables. Cuando TAWILSTACK encarga a un proveedor el tratamiento de datos por su cuenta, limita el uso a las instrucciones y finalidades acordadas. No vendemos datos personales.

6. Transferencias y transmisiones internacionales

Algunos proveedores pueden tratar información desde otros países, incluido Estados Unidos. Cuando TAWILSTACK comunica datos a otro responsable se realiza una transferencia; cuando un proveedor los procesa por cuenta e instrucciones de TAWILSTACK se realiza una transmisión. Entre esos proveedores hay empresas ubicadas en Estados Unidos y en otros países (por ejemplo, Supabase, Vercel, Sentry, Cloudflare, Resend, Google, Meta y OpenRouter). Aplicamos las condiciones y salvaguardas exigidas por la normativa colombiana para cada operación (Ley 1581 de 2012, artículo 26, y Decreto 1074 de 2015), y la aceptación de esta política incluye tu autorización expresa e inequívoca para las transferencias y transmisiones internacionales necesarias para prestarte el servicio y ejecutar el contrato que celebras con nosotros. El uso de mapas de OpenStreetMap puede hacer que tu navegador se conecte directamente a ese servicio y le comunique tu dirección IP.

7. Cuánto tiempo conservamos los datos

Conservamos los datos solo durante el tiempo razonable y necesario para la finalidad informada, la relación con la cuenta y el cumplimiento de obligaciones legales o contractuales; después los suprimimos o anonimizamos, salvo que la ley exija conservarlos. No aplicamos un único plazo a todas las categorías. Por ejemplo: las huellas de límite de intentos por conexión se eliminan en un máximo de dos días; la cookie de identificador de dispositivo de la prueba gratuita dura hasta 730 días; los registros de pagos, reembolsos y movimientos contables se conservan hasta diez (10) años, plazo de conservación de los libros y soportes contables; y las constancias de aceptación y de autorización se conservan mientras exista la relación y por el tiempo necesario para atender reclamaciones o cumplir deberes legales. Para los demás datos técnicos (intentos de ingreso, huellas de anuncios y de la prueba gratuita, errores de monitoreo y auditoría) aplicamos plazos que revisamos periódicamente y que no superan lo necesario para su finalidad. Puedes preguntarnos el plazo que corresponde a un dato concreto escribiendo a equipo@stylernow.com.

Si solicitas eliminar tu cuenta, la solicitud queda sujeta al período de retractación que se informa al iniciarla (actualmente, catorce (14) días). Durante ese plazo puedes cancelarla. Al ejecutarse, se anonimiza la información básica del perfil y se eliminan o desvinculan datos de la cuenta como fotos, favoritos y preferencias, según el flujo aplicable; las reservas futuras se cancelan y se tramita el reembolso del anticipo cuando corresponda. Algunos registros de operaciones, aceptaciones, consentimientos y auditoría pueden conservarse cuando sea necesario para cumplir obligaciones legales, proteger derechos o acreditar actuaciones, con acceso restringido.

Conservamos, sin datos que te identifiquen cuando es posible, los registros que la ley obliga a guardar: pagos, reembolsos, movimientos contables, constancias de aceptación y auditoría. Los registros financieros no se borran ni se modifican: se corrigen con movimientos de ajuste.

8. Tus derechos

Como titular puedes:
- Conocer, actualizar y rectificar tus datos.
- Pedir prueba de la autorización que diste.
- Saber cómo se han usado tus datos.
- Revocar la autorización o pedir que se eliminen tus datos, cuando no exista un deber legal o contractual de conservarlos.
- Acceder gratis a tus datos.
- Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley de protección de datos, una vez agotado el trámite de consulta o reclamo ante TAWILSTACK.

Puedes ejercer estos derechos tú, tus causahabientes, tu representante o apoderado debidamente acreditado. La revocatoria de la autorización y la supresión no proceden cuando exista un deber legal o contractual de conservar los datos. El ejercicio de tus derechos es gratuito.

Desde la Plataforma puedes:
- Actualizar tu perfil.
- Gestionar tus autorizaciones en el Centro de privacidad.
- Descargar una copia de tus datos.
- Solicitar la eliminación de tu cuenta.

9. Cómo presentar consultas y reclamos

Escríbenos a equipo@stylernow.com o usa el canal de soporte de la Plataforma. Para ayudarnos a tramitar la solicitud, indica tu nombre, un medio de respuesta, el derecho que deseas ejercer y la información necesaria para localizar los datos. Podemos pedir información razonable para verificar tu identidad; no envíes contraseñas ni datos de tarjetas.

Las consultas se atienden dentro de diez (10) días hábiles desde su recepción. Si no es posible responder en ese plazo, se te informará el motivo y la nueva fecha, que no podrá exceder cinco (5) días hábiles adicionales. Los reclamos se atienden dentro de quince (15) días hábiles; si no es posible, se te informará el motivo y la nueva fecha, que no podrá exceder ocho (8) días hábiles adicionales. Si el reclamo está incompleto, te lo indicaremos dentro de los cinco (5) días siguientes a recibirlo para que lo completes; si pasan dos (2) meses sin que presentes la información, entenderemos que desistes. Mientras se resuelve, marcaremos el dato con la leyenda «reclamo en trámite» en un máximo de dos (2) días hábiles desde que el reclamo esté completo. Si no somos competentes para responder, trasladaremos la solicitud a quien corresponda en un máximo de dos (2) días hábiles e informaremos el trámite, conforme a la ley.

Si tu solicitud se refiere a datos que registró un Negocio (por ejemplo, sus notas sobre ti), la trasladamos al Negocio y te acompañamos en el trámite.

10. Seguridad

Aplicamos medidas técnicas y organizativas razonables:
- Conexiones cifradas.
- Control de acceso por rol y por Negocio, de modo que un Negocio no puede ver datos de otro.
- Credenciales de pago cifradas.
- Registros de auditoría.
- Límites de intentos.
- Registros financieros que no se pueden alterar.

Ningún sistema es infalible. Si ocurre un incidente que afecte tus datos, actuaremos y te avisaremos según la ley.

TAWILSTACK mantiene un procedimiento de gestión de incidentes de seguridad para evaluarlos, limitar sus efectos, registrarlos y conservar evidencia. Cuando un incidente afecte datos personales, lo reportará a la Superintendencia de Industria y Comercio dentro de los quince (15) días hábiles siguientes a su detección, cuando la normativa lo exija, y te avisará si afecta tus datos. Los Negocios deben reportarnos, dentro de las 24 horas siguientes a conocerlo, cualquier incidente que involucre datos de Clientes obtenidos a través de la Plataforma, escribiendo a equipo@stylernow.com.

11. Menores de edad

La Plataforma está dirigida a mayores de 18 años. Un padre, madre o representante legal puede reservar un servicio para un menor y debe entregar únicamente la información necesaria para esa atención. Si un Negocio recopila datos del menor o información sensible, debe informar la finalidad, obtener las autorizaciones que correspondan y proteger el interés superior del menor. TAWILSTACK no busca crear perfiles ni cuentas de menores.

12. Cambios a esta política

Si cambiamos esta política, publicaremos la versión vigente y su fecha de entrada en vigor. Los cambios de redacción que no alteren las finalidades, los datos tratados, los plazos ni tus derechos se aplican desde su publicación y te los informamos en tu siguiente ingreso. Cuando el cambio sea material, te lo notificaremos y solicitaremos una nueva aceptación antes de que continúes usando las funciones afectadas. Conservamos las versiones anteriores y la constancia de las versiones aceptadas.

13. Vigencia

Versión 3, elaborada el 17 de noviembre de 2026. Rige desde su publicación en la Plataforma, cuya fecha se muestra junto a la versión vigente. Las bases de datos de StylerNow se conservan mientras TAWILSTACK opere StylerNow y por los plazos de la sección 7.
$politica$;
  v_max_terminos integer;
  v_max_politica integer;
begin
  select coalesce(max(version), 0) into v_max_terminos from public.texto_legal where tipo = 'TERMINOS';
  select coalesce(max(version), 0) into v_max_politica from public.texto_legal where tipo = 'POLITICA_DATOS';

  -- Términos: 2 (producción hoy) o 3 (si algún día se aplicó la 115). Política: 2.
  if v_max_terminos not in (2, 3) or v_max_politica <> 2 then
    raise exception 'VERSION_LEGAL_INESPERADA: términos %, política %; revisar antes de publicar', v_max_terminos, v_max_politica;
  end if;
  if v_terminos like '%[PENDIENTE%' or v_politica like '%[PENDIENTE%'
    or v_terminos like '%[COMPLETAR%' or v_politica like '%[COMPLETAR%'
    or v_terminos like '%[DECISIÓN%' or v_politica like '%[DECISIÓN%'
    or v_terminos like '%xxxxx%' or v_politica like '%xxxxx%' then
    raise exception 'TEXTOS_LEGALES_CON_MARCADORES';
  end if;
  if position('TAWILSTACK S.A.S.' in v_terminos) = 0
    or position('TAWILSTACK S.A.S.' in v_politica) = 0
    or position('NIT en trámite de asignación' in v_terminos) = 0
    or position('NIT en trámite de asignación' in v_politica) = 0
    or position('Calle 15B # 20-79' in v_terminos) = 0
    or position('Calle 15B # 20-79' in v_politica) = 0 then
    raise exception 'IDENTIFICACION_TAWILSTACK_INCOMPLETA';
  end if;

  insert into public.texto_legal (tipo, version, contenido, cambio_material)
  values
    ('TERMINOS', v_max_terminos + 1, v_terminos, true),
    ('POLITICA_DATOS', v_max_politica + 1, v_politica, true);
end;
$publicar$;

commit;
