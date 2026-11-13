-- StylerNow — Migración 121: Política de Tratamiento de Datos Personales v2
--
-- Reemplaza POLITICA_DATOS v1 (010), que no identificaba al responsable ni nombraba
-- proveedores, IA, fotos, WhatsApp, transferencias internacionales, consentimientos por
-- finalidad, exportación ni eliminación de cuenta. Fuente editable:
-- docs/legal/POLITICA_DATOS_v2_texto.txt (este archivo se genera desde ese texto).
--
-- Describe solo lo que el código hace hoy (incluidas 116-120); WhatsApp se menciona como
-- condicionado a que el envío esté habilitado. Se publica con cambio_material = true:
-- todos los usuarios deben aceptarla en su próximo ingreso. Sin aplicar: requiere el NIT
-- y revisión de un abogado colombiano.

do $$
declare
  v_contenido text := $t$Política de Tratamiento de Datos Personales — StylerNow

1. Responsable del tratamiento

StylerNow, NIT xxxxx, con domicilio en la Carrera 1A # 59-60, Cali, Valle del Cauca, Colombia, y correo equipo@stylernow.com, es responsable del tratamiento de los datos personales que se recogen a través de su sitio web y su aplicación (la "Plataforma"), conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y demás normas aplicables.

Cada Negocio (barbería, salón u otro establecimiento) que usa la Plataforma es responsable de los datos que él mismo registra sobre sus clientes, por ejemplo notas internas o fotos de trabajos. Para esos datos, StylerNow actúa como encargado: los aloja y procesa por cuenta del Negocio.

2. Datos que tratamos

Datos que nos das:
(a) Cuenta: nombre, correo electrónico, celular, país e idioma. Opcionalmente, foto de perfil, fecha de nacimiento y categorías de interés.
(b) Reservas: Negocio, sede, profesional, servicios, fecha, hora, valores y estado de la cita, reprogramaciones, cancelaciones e inasistencias.
(c) Política de cancelación: cuando pagas un anticipo, guardamos la política que aceptaste (texto, números y versión), con fecha, hora y zona horaria, como constancia.
(d) Pagos: monto, estado, medio y referencias de la transacción. Los datos de tu tarjeta los recibe y guarda Mercado Pago. StylerNow no los recibe ni los almacena.
(e) Contenido: reseñas, mensajes del chat de una cita, fotos de antes y después de un servicio (solo con tu consentimiento) y la información de tu programa de lealtad (puntos, sellos, beneficios, referidos y grupo familiar).
(f) Negocios: datos de contacto y de identificación fiscal del Negocio, su equipo, servicios, horarios y precios. Si el Negocio conecta su cuenta de Mercado Pago, guardamos cifradas las credenciales que Mercado Pago entrega para cobrar a su nombre.
(g) Prueba gratuita del Negocio: para evitar pruebas repetidas, guardamos una huella cifrada e irreversible del teléfono, del documento, del correo y del dispositivo. No guardamos esos datos en claro para este fin.

Datos que se generan al usar la Plataforma:
(h) Seguridad: registros de inicio de sesión (correo, tipo y resultado del intento), límites de intentos para prevenir abusos y registros de auditoría de acciones relevantes.
(i) Ubicación: solo si la autorizas, para mostrarte negocios cercanos.
(j) Analítica de uso y rendimiento: solo si la autorizas en el Centro de privacidad.
(k) Visitas a perfiles de Negocios y clics en anuncios, para medir campañas de forma agregada.

No pedimos datos sensibles. Si al reservar le cuentas al Negocio una condición de salud o una alergia, ese dato lo trata el Negocio para prestarte el servicio con seguridad.

3. Para qué usamos tus datos

(a) Crear y proteger tu cuenta y verificar tu identidad al iniciar sesión.
(b) Gestionar tus reservas: disponibilidad, confirmación, recordatorios, cambios, cancelaciones y, cuando corresponde, reembolsos.
(c) Procesar pagos a través de Mercado Pago y dejar constancia de cada operación.
(d) Compartir con el Negocio que eliges los datos necesarios para atenderte (nombre, contacto y detalle de la cita).
(e) Operar los programas de lealtad, gift cards, membresías y referidos.
(f) Prevenir fraude y abuso, por ejemplo pruebas gratuitas repetidas, accesos no autorizados o reseñas falsas.
(g) Cumplir obligaciones legales, contables y tributarias, y atender requerimientos de autoridades.
(h) Con tu autorización previa, y solo para cada fin que autorices: analítica de uso, recomendaciones personalizadas, ofertas de negocios cercanos, compartir tu nombre y ciudad con marcas aliadas, novedades de StylerNow por correo y promociones por WhatsApp de los negocios donde te atendiste.
(i) Funciones de inteligencia artificial para los Negocios (por ejemplo, textos sugeridos y análisis de su operación). Estas funciones procesan información del Negocio y pueden usar datos de sus citas y clientes de forma limitada a la tarea solicitada.

Nunca vendemos tus datos personales.

4. Autorizaciones independientes

Aceptar los términos y esta política es necesario para usar la Plataforma. Cada autorización de los fines de la sección 3(h) es independiente, opcional y no viene marcada. Puedes darla o retirarla cuando quieras desde el Centro de privacidad, sin afectar el resto del servicio. Guardamos el historial de cada decisión, con su fecha. Los recordatorios y avisos de tus citas no son publicidad y los recibes aunque no autorices promociones.

5. Con quién compartimos datos

(a) El Negocio con el que reservas, para prestarte el servicio.
(b) Proveedores que nos ayudan a operar, solo con los datos necesarios y bajo deber de confidencialidad:
- Supabase: base de datos, autenticación y almacenamiento de archivos.
- Vercel: alojamiento de la Plataforma y analítica (esta última, solo con tu autorización).
- Mercado Pago: procesamiento de pagos y reembolsos.
- Resend: envío de correos.
- Google: inicio de sesión con Google, si lo eliges.
- OpenStreetMap: imágenes del mapa. Tu navegador las descarga directamente, lo que expone tu dirección IP a ese servicio.
- Proveedores de inteligencia artificial (por ejemplo, OpenRouter y Google Gemini): solo para las funciones de IA de los Negocios.
- Meta (WhatsApp Business): solo cuando el envío de mensajes por WhatsApp esté habilitado.
(c) Marcas aliadas: solo tu nombre y ciudad, y solo si lo autorizas.
(d) Autoridades, cuando la ley lo exija.

6. Transferencias y transmisiones internacionales

Algunos de estos proveedores tienen servidores fuera de Colombia, por ejemplo en Estados Unidos. Por eso tus datos pueden transferirse o transmitirse al exterior para los fines de esta política. Lo hacemos con proveedores que ofrecen medidas de seguridad adecuadas y conforme a la normativa colombiana. Si usas la Plataforma desde otro país, tus datos se tratan en Colombia y en los países de esos proveedores.

7. Cuánto tiempo conservamos los datos

Conservamos tus datos mientras tengas una cuenta y el tiempo necesario para los fines de esta política.

Si pides eliminar tu cuenta, tienes un período de gracia para arrepentirte. Pasado ese plazo:
- Anonimizamos tus datos personales.
- Borramos tus fotos.
- Cancelamos tus citas futuras, con reembolso del anticipo cuando corresponda.

Conservamos, sin datos que te identifiquen cuando es posible, los registros que la ley obliga a guardar: pagos, reembolsos, movimientos contables, constancias de aceptación y auditoría. Los registros financieros no se borran ni se modifican: se corrigen con movimientos de ajuste.

8. Tus derechos

Como titular puedes:
- Conocer, actualizar y rectificar tus datos.
- Pedir prueba de la autorización que diste.
- Saber cómo se han usado tus datos.
- Revocar la autorización o pedir que se eliminen tus datos, cuando no exista un deber legal o contractual de conservarlos.
- Acceder gratis a tus datos.
- Presentar quejas ante la Superintendencia de Industria y Comercio.

Desde la Plataforma puedes:
- Actualizar tu perfil.
- Gestionar tus autorizaciones en el Centro de privacidad.
- Descargar una copia de tus datos.
- Solicitar la eliminación de tu cuenta.

9. Cómo presentar consultas y reclamos

Escríbenos a equipo@stylernow.com o usa el canal de soporte de la Plataforma.
- Consultas: las respondemos en un máximo de diez (10) días hábiles.
- Reclamos: los atendemos en un máximo de quince (15) días hábiles, según los plazos de la Ley 1581 de 2012.

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

11. Menores de edad

La Plataforma está dirigida a mayores de 18 años. Los servicios para menores deben reservarlos sus padres o representantes.

12. Cambios a esta política

Si cambiamos esta política de forma sustancial, te avisamos y te pedimos aceptarla de nuevo antes de seguir usando la Plataforma. Conservamos las versiones anteriores y la constancia de lo que aceptaste.

13. Vigencia

Esta política rige desde su publicación en la Plataforma.$t$;
begin
  if v_contenido ~ '\[[A-ZÁÉÍÓÚÑ ]+\]' then
    raise exception 'POLITICA_DATOS_V2_CON_MARCADORES: completa los datos legales antes de publicar';
  end if;
  if v_contenido like '%NIT xxxxx%' then
    raise notice 'POLITICA_DATOS_V2: el NIT sigue como xxxxx; actualiza el texto cuando lo tengas';
  end if;
  insert into public.texto_legal (tipo, version, contenido, cambio_material)
  values ('POLITICA_DATOS', 2, v_contenido, true)
  on conflict (tipo, version) do nothing;
end $$;
