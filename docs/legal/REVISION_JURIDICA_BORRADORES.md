# Revisión jurídica de los borradores legales — cláusula por cláusula


> **Estado de aplicación (2026-11-17):** las correcciones de la tabla de la sección 8 relativas a los textos canónicos se aplicaron en `POLITICA_DATOS_v3_texto.txt` y `TERMINOS_v4_borrador.txt` (ver `ESTADO_DOCUMENTOS_LEGALES.md` §3), con estas diferencias deliberadas: (1) se mantiene **una sola casilla** de registro porque es lo que hace la interfaz hoy y los textos la describen tal cual (las dos casillas quedan como mejora de interfaz); (2) los plazos de retención de §7 se publican solo si ya se aplican; (3) la variante de seguridad se redactó como Variante F **corrigiendo** que el proveedor de autenticación sí guarda IP y navegador por sesión; (4) los marcadores `[COMPLETAR]` y `[DECISIÓN]` se resolvieron con el equipo/correo informado por el propietario o se omitieron; la migración aborta si queda alguno. Las notas sobre los borradores paralelos y la migración «147» (Staff) pertenecen a otra línea de trabajo y no se tocaron.
> **BORRADOR para validación jurídica humana.** Fecha: 2026-11-16. Revisión cruzada de los borradores de `docs/legal/` frente a: (1) la ley verificada (`INVESTIGACION_NORMATIVA.md`), (2) el PDF de referencia del propietario, (3) los **hechos del código** verificados el 2026-11-16 (ver `DICTAMEN_DATOS_TECNICOS_Y_RETENCION.md` §2) y (4) la decisión F (evidencias sin IP ni navegador). Cada cambio trae el texto sustituto listo para pegar en formato «texto actual» → «texto propuesto». No se editó ningún archivo existente.

---

## 0. Documentos revisados y cuál prevalece

| Documento | Naturaleza | Prevalencia |
|---|---|---|
| `docs/politica tratamiento de datos/_política de tratamiento y protección datos personales.pdf` | **No es una política de TAWILSTACK**: es la Guía G-IC-16 «Política de tratamiento y protección de datos personales» del **Ministerio de Justicia y del Derecho**, versión 01, vigente desde 17/12/2020 (16 páginas; objetivo: «la gestión en materia de tratamiento de datos personales en el Ministerio de Justicia y del Derecho»). Sus finalidades, canales, estructura y procedimientos son los de una entidad pública. | Solo como **lista de comprobación de estructura** (glosario, principios, derechos, deberes, procedimiento de consultas/reclamos, seguridad, incidentes gestionados como incidentes de seguridad de la información). **No prevalece** sobre los textos de StylerNow; nada de su contenido institucional debe copiarse. Coincide con lo ya anotado en `ESTADO_DOCUMENTOS_LEGALES.md` §7. |
| `POLITICA_DATOS_v3_texto.txt` (= migración 138) | Texto candidato canónico de la política | **Prevalece** entre los borradores de política. Requiere las correcciones de la sección 1. |
| `POLITICA_TRATAMIENTO_DATOS.md` | Borrador paralelo, marcado como no canónico | Debe **retirarse**: contiene afirmaciones falsas respecto del código y una base legal inexistente (sección 2). |
| `TERMINOS_v4_borrador.txt` (= migración 138) | Texto candidato canónico de Términos (clientes y negocios en un solo documento) | **Prevalece**. Correcciones en la sección 3. |
| `TERMINOS_CONDICIONES_USUARIOS.md` y `TERMINOS_COMERCIOS_ALIADOS.md` | Borradores paralelos generados hoy | Contradicen a v4 en puntos materiales (sección 4). Recomendación: **no publicarlos**; rescatar de ellos solo la cláusula de comercio aliado como responsable independiente, reescrita (sección 7.5) e insertarla en v4. |
| `TEXTOS_UI_CONSENTIMIENTO.md` | Propuestas de interfaz | Varias contradicen el código y la ley (sección 5). Se entregan textos sustitutos (sección 7). |
| `AUDITORIA_LEGAL_CODIGO.md` | Auditoría previa | Contiene recomendaciones **contrarias a la decisión F** (registrar IP y User-Agent en cada consentimiento, §3.3 y §4.4) y una descripción inexacta del banner. Debe anotarse como superada por el dictamen. |
| Migración 147 (textos de Staff, `estado_juridico = BORRADOR`) | Autorizaciones de Staff | Revisión en la sección 6. |
| Migraciones 115 y 121 (textos vigentes en producción) | Historial | Siguen publicados en producción hasta aplicar 138. Contienen el responsable «StylerNow, NIT xxxxx»: hallazgo ya reportado. |

Hechos del código que condicionan toda la revisión (detalle en el dictamen §2):
- No se guarda IP ni User-Agent en claro en tablas propias. Existen huellas: límite de tasa (sha256 sin sal, 24 h), antiabuso de prueba gratuita (HMAC, sin borrado), clics de anuncios (sha256 con sal, sin borrado).
- `intento_auth` guarda correo, tipo y resultado: **no** IP ni User-Agent.
- No hay geolocalización por IP; la ubicación del navegador solo se usa tras acción de la persona y no se guarda.
- Registro con **una** casilla (Términos + Política), no premarcada. Aceptación tácita de cambios no materiales.
- Sentry recibe errores con navegador/SO e id de usuario (sin IP ni cabeceras) y **no aparece** en la política.
- Evidencias legales sin IP/UA, con hora del servidor, texto + SHA-256 y cadena de hashes.

---

## 1. `POLITICA_DATOS_v3_texto.txt` — cláusula por cláusula

### §1 Responsable
- Correcto en roles (responsable/encargado) y datos de contacto. Falta lo exigido por D. 1074 art. 2.2.2.25.3.1 y 2.2.2.25.4.4: **persona o área de atención** y **fecha de entrada en vigencia** (ver §13).
- **Redline (añadir al final de §1):**
  «texto actual»: *(no existe)*
  → «texto propuesto»: «La atención de consultas y reclamos sobre datos personales está a cargo de `[COMPLETAR: nombre del área o persona designada]`, a través de los canales de la sección 9.»

### §2 Datos que tratamos
- **(g) Prueba gratuita**: coherente con la migración 135 (huellas HMAC de teléfono, documento, correo, dispositivo, IP y rasgos del equipo). Falta informar la **cookie de dispositivo** y su duración, y que los rasgos del equipo (navegador, pantalla, zona horaria, idioma) también se convierten en huella.
  «texto actual»: «(g) Prueba gratuita del Negocio: para prevenir pruebas repetidas, tratamos identificadores del teléfono, documento, correo, dispositivo y dirección IP en forma de huellas criptográficas. No usamos esas huellas para identificarte en la interfaz ni las guardamos como esos datos de contacto en texto claro para este control.»
  → «texto propuesto»: «(g) Prueba gratuita del Negocio: para que cada Negocio use una sola prueba, convertimos en huellas criptográficas irreversibles (con clave secreta) el teléfono y el documento que nos indicas, tu correo, un identificador de dispositivo (que guardamos en una cookie técnica llamada `sn_disp` durante `[DECISIÓN DEL PROPIETARIO: 365 días]`), tu dirección IP y rasgos generales de tu equipo (tipo de navegador, tamaño de pantalla, zona horaria e idioma). No guardamos esos datos en claro para este fin ni los usamos para identificarte en la interfaz. Las huellas de IP y de equipo se eliminan a los 365 días; las demás, según la sección 7.»
- **(h) Seguridad y prevención de abuso**: **INCONSISTENTE con el código**. `intento_auth` no guarda IP ni User-Agent; la IP se usa como huella para límites de tasa durante 24 h; el User-Agent no se guarda; Sentry recibe navegador/SO. Se entregan **dos variantes** según la opción que elija el propietario (dictamen §6).
  «texto actual»: «(h) Seguridad y prevención de abuso: registros de inicio de sesión (correo, tipo y resultado del intento), dirección IP y datos técnicos como User-Agent cuando son necesarios para limitar intentos, investigar fallos o proteger cuentas. Para eventos de anuncios, la IP y el User-Agent se convierten en una huella seudonimizada antes de registrarse. También mantenemos registros de auditoría de acciones relevantes.»
  → **Variante F (sin IP/UA en evidencias; registro de seguridad mínimo — describe lo que existe hoy):** «(h) Seguridad y prevención de abuso: (i) registramos cada intento de ingreso, envío de código o recuperación de contraseña con el correo, el tipo de intento, si tuvo éxito y la hora, durante 30 días, para bloquear intentos repetidos; (ii) para limitar la cantidad de intentos por conexión, convertimos tu dirección IP en una huella irreversible con clave secreta, que se elimina en un plazo máximo de 24 horas; no guardamos la dirección IP en claro; (iii) para contar clics e impresiones de anuncios de forma honesta, generamos una huella irreversible a partir de tu cuenta o, si no has iniciado sesión, de tu conexión y tu navegador, que se elimina a los 35 días; (iv) cuando ocurre un error en la aplicación, nuestro proveedor de monitoreo (Sentry) recibe el tipo de error, la pantalla en que ocurrió, el nombre y versión de tu navegador y sistema operativo y, si has iniciado sesión, el identificador interno de tu cuenta, nunca tu correo, nombre, IP ni cookies; (v) mantenemos registros de auditoría de las acciones relevantes en los paneles, con el identificador de la cuenta que las hizo y un identificador de petición generado por el servidor, sin dirección IP ni datos del navegador. Las constancias de aceptación y autorización de la sección 4 **no incluyen** tu dirección IP ni datos de tu navegador.»
  → **Variante alterna (IP seudonimizada con retención corta, también para seguridad de la cuenta):** igual que la Variante F, añadiendo al final: «(vi) para ayudarte a detectar accesos no autorizados, conservamos por cada sesión activa y durante un máximo de 90 días una versión truncada o convertida en huella de tu dirección IP, el tipo de navegador y sistema operativo y la fecha del acceso; puedes consultarlos y cerrar sesiones desde tu cuenta. Estos registros de seguridad se guardan separados de las constancias de aceptación y no se incorporan a ellas.»
- **(i) Ubicación**: añadir que no se guarda y que puede ir en la dirección de la página.
  «texto actual»: «(i) Ubicación: solo si la autorizas, para mostrarte negocios cercanos.»
  → «texto propuesto»: «(i) Ubicación: solo cuando pulsas «Cerca de mí» o «Usar mi ubicación» y tu navegador lo permite, usamos tus coordenadas aproximadas para ordenar los resultados por cercanía o calcular la distancia a una sede. No las guardamos en nuestra base de datos ni deducimos tu ciudad a partir de tu dirección IP. Puedes revocar el permiso desde tu navegador o desde Ajustes.»
- **(k) Visitas y clics**: coherente con huellas; ya cubierto por (h)(iii).
- Añadir cookies (no hay lista): nueva letra «(l) Cookies y almacenamiento local: cookies de sesión de autenticación (`sb-*`), cookie de idioma (`sn_idioma`), cookie técnica de dispositivo (`sn_disp`, solo para la prueba gratuita del Negocio) y tu elección sobre cookies de analítica (`stylernow_cookies_v1`, en el almacenamiento local del navegador). Ninguna es publicitaria.»

### §3 Para qué usamos tus datos
- (f) y (j) correctos. (i) IA: añadir compromiso con la Circular Externa 002 de 2024 de la SIC.
  «texto actual»: «(i) Funciones de inteligencia artificial para los Negocios (…) limitada a la tarea solicitada.»
  → «texto propuesto»: «(i) Funciones de inteligencia artificial para los Negocios (por ejemplo, textos sugeridos y análisis de su operación). Procesan información del Negocio y pueden usar datos de sus citas y clientes de forma limitada a la tarea solicitada, sin tomar decisiones automatizadas con efectos jurídicos sobre las personas y conforme a las instrucciones de la Superintendencia de Industria y Comercio sobre tratamiento de datos en sistemas de inteligencia artificial (Circular Externa 002 de 2024).»

### §4 Autorizaciones independientes
- Correcto en el fondo (no se presume marketing por aceptar). Si el propietario adopta **dos casillas**, sustituir el primer párrafo:
  «texto actual»: «La aceptación de los Términos y Condiciones y la consulta de esta política forman parte del registro y uso de StylerNow; la autorización para finalidades opcionales no se presume por aceptar esos documentos.»
  → «texto propuesto»: «Al registrarte te pedimos dos decisiones separadas y ninguna viene marcada: (1) aceptar los Términos y Condiciones y (2) autorizar el tratamiento de tus datos personales para las finalidades necesarias descritas en la sección 3, letras (a) a (g) y (j). Sin la segunda no podemos crear tu cuenta, porque sin tratar tus datos no es posible prestarte el servicio. Las finalidades opcionales de la letra (h) se autorizan aparte, no se presumen y puedes retirarlas cuando quieras.»

### §5 Con quién compartimos datos
- **Falta Sentry** (monitoreo de errores; transmisión internacional). Falta OpenStreetMap/Nominatim para geocodificar sedes (solo coordenadas). Si se adopta Cloudinary (decisión B del worktree), añadirlo.
  «texto actual»: «- Google: inicio de sesión con Google, si lo eliges.»
  → «texto propuesto (insertar después)»: «- Sentry: monitoreo de errores de la aplicación (recibe el error, la pantalla, el navegador y sistema operativo y el identificador interno de tu cuenta; no recibe tu correo, nombre, dirección IP ni cookies).
  - OpenStreetMap (Nominatim): conversión de coordenadas de la sede de un Negocio en una dirección; recibe solo las coordenadas.
  - `[Si se adopta]` Cloudinary: almacenamiento y entrega de fotos de perfil profesional.»

### §6 Transferencias internacionales — correcto; verificar que el abogado valide el fundamento (Ley 1581 art. 26; D. 1074 art. 2.2.2.25.5.1).

### §7 Cuánto tiempo conservamos los datos
- Demasiado genérico frente a 2.2.2.25.2.8 y al texto de la política de retención. Sustituir el primer párrafo por una tabla pública resumida.
  «texto actual»: «Conservamos los datos durante el tiempo necesario (…) No aplicamos un único plazo a todas las categorías.»
  → «texto propuesto»: «Plazos por categoría (resumen; el detalle está en nuestra política interna de retención, disponible a solicitud):
  - Cuenta y perfil: mientras tu cuenta exista; si pides eliminarla, 14 días de retractación y luego anonimización.
  - Reservas y pagos: los registros de pagos, reembolsos y movimientos se conservan 10 años por obligaciones contables y tributarias; el vínculo con tu identidad se anonimiza cuando tu cuenta ya no existe y han pasado 5 años desde tu última cita.
  - Constancias de aceptación y de autorizaciones: mientras exista la relación y hasta 10 años después de tu última actuación (plazo de prescripción), después se seudonimizan.
  - Registros de seguridad: huellas de límite de intentos, 24 horas; intentos de ingreso, 30 días; huellas de prueba gratuita de Negocios, hasta 365 días para IP y equipo; huellas de anuncios, 35 días; errores en Sentry, hasta 90 días.
  - Mensajes y chat de citas: 12 meses. Comunicaciones de WhatsApp: 12 meses.
  - Cuentas inactivas: aviso a los 24 meses y anonimización a los 36 meses sin actividad.
  `[DECISIÓN DEL PROPIETARIO: confirmar cada plazo con POLITICA_RETENCION_BORRADOR.md]`»

### §8 Tus derechos — correcto. Añadir «conocer el uso» ya está; añadir derecho a **revocar** la publicación de foto/nombre (Staff) por remisión.

### §9 Consultas y reclamos — plazos coherentes con art. 15 (reclamos). Los de consultas (art. 14) no se verificaron literalmente: `[abogado: confirmar 10 + 5 días hábiles]`.

### §10 Seguridad
- Añadir plazo de reporte de incidentes y canal para que los Negocios reporten.
  «texto actual»: «TAWILSTACK mantiene procedimientos para gestionar incidentes de seguridad (…) notificará a los titulares afectados.»
  → «texto propuesto»: «TAWILSTACK mantiene un procedimiento documentado de gestión de incidentes de seguridad. Cuando un incidente afecte datos personales, lo evaluará, lo registrará y lo reportará a la Superintendencia de Industria y Comercio dentro de los quince (15) días hábiles siguientes a su detección, cuando la normativa lo exija, y te avisará si afecta tus datos. Los Negocios deben reportarnos cualquier incidente que involucre datos de clientes obtenidos a través de la Plataforma dentro de las 24 horas siguientes a conocerlo, al correo `[COMPLETAR: correo de seguridad]`.»

### §12 Cambios — añadir la regla de cambios no materiales para que la «aceptación tácita» quede informada (o eliminarla si el propietario elige otra opción; dictamen §7.1).
  «texto actual»: «Si cambiamos esta política, publicaremos la versión vigente y su fecha de entrada en vigor. Cuando el cambio sea material (…)»
  → «texto propuesto»: «Si cambiamos esta política, publicaremos la versión vigente y su fecha de entrada en vigor. Los cambios de redacción que no alteren las finalidades, los datos tratados, los plazos ni tus derechos se aplican desde su publicación y te los informamos en tu siguiente ingreso. Cuando el cambio sea material, te lo notificaremos y solicitaremos una nueva aceptación antes de que continúes usando las funciones afectadas. Conservamos las versiones anteriores y la constancia de las versiones aceptadas.»

### §13 Vigencia — 2.2.2.25.3.1 exige fecha.
  «texto actual»: «Esta política rige desde su publicación en la Plataforma.»
  → «texto propuesto»: «Versión 3. Rige desde el `[COMPLETAR: fecha de publicación]`. Las bases de datos se conservan mientras TAWILSTACK opere StylerNow y por los plazos de la sección 7.»

---

## 2. `POLITICA_TRATAMIENTO_DATOS.md` — por qué debe retirarse
Inconsistencias con el código o con la ley (cada una bastaría para no publicarlo):
1. §4.2/§5.1 afirman tratar «resolución de pantalla», «identificadores del navegador», «actividad de navegación» y «geolocalización … latitud/longitud … cuando la funcionalidad de la plataforma lo requiere» sin consentimiento: **no ocurre** (la ubicación solo se pide por acción explícita y no se guarda; la pantalla solo entra, hasheada, en la prueba gratuita).
2. §5.1 dice «conservar evidencias digitales de accesos y de la aceptación de políticas» con IP: **contradice la decisión F** y el código.
3. §6 invoca **«interés legítimo de la plataforma»** como base: **no existe** en la Ley 1581 (art. 10 enumera las únicas excepciones). Es el error jurídico más grave del conjunto.
4. §3.5 «geolocalización aproximada por ciudad … según la ubicación del usuario y la ciudad de operación»: no hay geolocalización por IP.
5. §5.2 «cookie … hasta 730 días»: cierto hoy, pero el dictamen propone 365.
Si el propietario quiere conservarlo como «versión larga», debe reescribirse a partir de v3 con las correcciones de la sección 1. Recomendación: **archivar**.

---

## 3. `TERMINOS_v4_borrador.txt` — cláusula por cláusula (solo donde hay cambio)

### §1 Aceptación — consentimiento empaquetado
«texto actual»: «Al crear una cuenta, marcar la casilla de aceptación o usar la Plataforma, aceptas estos términos sin modificaciones, junto con la Política de Tratamiento de Datos Personales.»
→ «texto propuesto»: «Al crear una cuenta y marcar la casilla de aceptación, aceptas estos términos sin modificaciones. La autorización para tratar tus datos personales se solicita por separado, en una casilla independiente, conforme a la Política de Tratamiento de Datos Personales; aceptar estos términos no implica esa autorización ni las autorizaciones opcionales de marketing. Si no estás de acuerdo, no debes usar la Plataforma. Te recomendamos guardar una copia.»

### §4 Tu cuenta — añadir el aviso de registros de seguridad (coherente con la política §2(h)).
«texto actual»: «Avísanos de inmediato si sospechas un uso no autorizado.»
→ «texto propuesto»: «Avísanos de inmediato si sospechas un uso no autorizado. Para proteger el acceso limitamos los intentos de ingreso por cuenta y por conexión y registramos los intentos conforme a la Política de Tratamiento de Datos Personales.»

### §9 Obligaciones del Negocio — datos de clientes: sustituir el párrafo por una remisión a la nueva cláusula 9A (sección 7.5).
«texto actual»: «Solo puede usar los datos de los Clientes para gestionar sus citas y para comunicaciones autorizadas, respetando la Política de Tratamiento de Datos Personales y la ley. No enviará mensajes de marketing a quien no lo haya autorizado.»
→ «texto propuesto»: «El Negocio trata los datos de los Clientes que recibe a través de la Plataforma como responsable independiente, en los términos de la cláusula 9A.»

### §11 WhatsApp — Ley 2300.
«texto actual»: «Las campañas de marketing solo llegan a Clientes que autorizaron recibir promociones por WhatsApp.»
→ «texto propuesto»: «Las campañas de marketing solo llegan a Clientes que autorizaron recibir promociones por WhatsApp y se envían únicamente de lunes a viernes entre las 7:00 a. m. y las 7:00 p. m. y los sábados entre las 8:00 a. m. y las 3:00 p. m., hora de Colombia, nunca en domingos ni festivos, con un máximo de un contacto comercial por día; cada mensaje incluye una forma sencilla de dejar de recibirlos (Ley 2300 de 2023). Los avisos operativos de reservas no son publicidad y no están sujetos a esas franjas.»

### §14 Datos personales — remisión a la casilla separada.
«texto actual»: «Tratamos tus datos personales conforme a la Política de Tratamiento de Datos Personales, a la Ley 1581 de 2012 y a las normas aplicables en tu país. Para atender tu Reserva compartimos con el Negocio los datos necesarios.»
→ «texto propuesto»: «Tratamos tus datos personales conforme a la Política de Tratamiento de Datos Personales, a la Ley 1581 de 2012, al Decreto 1074 de 2015 y a las normas aplicables en tu país, con la autorización que nos das en una casilla independiente al registrarte y, para cada Reserva, con la autorización específica que marcas antes de confirmarla. Para atender tu Reserva compartimos con el Negocio tu nombre, tu contacto y el detalle de la cita; desde ese momento el Negocio es responsable independiente de esos datos (cláusula 9A).»

### Nueva cláusula 9A — ver texto completo en la sección 7.5.

### §18 Terminación — correcto; remite a la política de retención.

---

## 4. `TERMINOS_CONDICIONES_USUARIOS.md` y `TERMINOS_COMERCIOS_ALIADOS.md`
- **Usuarios §6 (pagos)**: «la operación financiera puede realizarse (…) mediante medios habilitados por la Plataforma (…) En los casos en que el cobro se haga en nombre del negocio aliado» → contradice el cobro directo sin custodia (Directiva 2026-11-12 y v4 §5/§10). **No publicar.**
- **Usuarios §10 (datos y cookies)**: «puede tratar datos técnicos (…) geolocalización» sin precisión → inferior a v3; **descartar**.
- **Usuarios §14**: jurisdicción Cali «o la jurisdicción competente» — v4 §20 ya lo trata mejor (consumo).
- **Comercios §4 (roles)**: bien planteado (responsable independiente desde la entrega). Mantener la idea.
- **Comercios §5–6**: «registrar o generar listas de clientes para comunicaciones futuras» como prohibición absoluta **choca con el CRM del propio producto** (el Negocio sí tiene su base de clientes como responsable). Debe reformularse: prohibido usar los datos **obtenidos a través de la Plataforma** para fines distintos de la cita salvo autorización propia obtenida por el Negocio.
- **Comercios §7 (incidentes)**: «de manera inmediata … plazo razonablemente aplicable» → fijar **24 horas** (propuesta del propietario) con contenido mínimo del reporte.
- **Comercios §8 (indemnidad)**: «responderá directamente … ante la Superintendencia de Industria y Comercio» → las sanciones administrativas son personales e intransferibles; la indemnidad puede cubrir multas **pagadas por TAWILSTACK a causa del Negocio** y costos, no «asumir» la sanción ajena. «StylerNow quedará exento de toda responsabilidad» no es oponible a los titulares ni a la SIC (art. 17 y 18 fijan deberes propios de cada rol). Reescritura en 7.5.

---

## 5. `TEXTOS_UI_CONSENTIMIENTO.md` — evaluación
| # | Texto propuesto | Problema | Veredicto |
|---|---|---|---|
| 1 | Banner: «utilizamos datos técnicos de tu conexión, como tu dirección IP, tipo de navegador y sistema operativo (…) mostrarte negocios disponibles en tu ciudad. Al continuar navegando, aceptas…» | (a) Afirma recolectar IP y navegador «para mostrarte negocios en tu ciudad»: **no existe** geolocalización por IP. (b) «Al continuar navegando aceptas» no es autorización expresa; el silencio/la navegación no son conducta inequívoca válida para esto; además un aviso no sustituye la autorización (sanción Sodimac). (c) Duplica el banner de cookies real. | **Sustituir** por un aviso de privacidad en los formularios de acceso (7.3). |
| 2 | Casilla 2 de usuarios: «…mis datos personales y técnicos de conexión, incluyendo dirección IP, datos del dispositivo y navegador…» | Incoherente con F y con el código (no se guardan). Si se adopta la Variante alterna, la IP seudonimizada se **informa** en la política, no necesita mención en la casilla. | Sustituir (7.1/7.2). |
| 3 | Casilla 2 de negocios: «Autorizo (…) el tratamiento de los datos personales del cliente y del negocio» | El Negocio **no puede autorizar** el tratamiento de datos de sus clientes (solo el titular autoriza). Lo que corresponde es que el Negocio **acepte sus deberes** como responsable independiente y autorice el tratamiento de los datos **de su representante y equipo** por TAWILSTACK. | Sustituir (7.2). |
| 4 | Micro-copy teléfono: «Uso exclusivo para gestión de esta cita. Prohibido el envío de publicidad o mensajes no autorizados.» | Correcto en fondo; mejorar con base legal y referencia a horarios. | Ajustar (7.4). |
| 5 | Enlaces de pie | Correcto. Hoy solo existen en `/para-negocios`; deben ir en el encabezado/pie general y en las pantallas de registro, reserva y panel. | Mantener. |
| 6 | «El consentimiento debe registrarse con (…) IP» | Contradice F. | Eliminar. |

---

## 6. Migración 147 — textos borrador de autorización de Staff

### 6.1 `AUTORIZACION_STAFF_TRATAMIENTO` (v1-borrador)
Texto: «Autorizo a StylerNow y a {negocio} a tratar mis datos personales (nombre, correo, celular y perfil profesional) para gestionar mi vínculo como profesional, mi agenda, mis turnos y mis comisiones, según la Política de Tratamiento de Datos. Puedo retirar esta autorización desde mi perfil.»
- Coherente con la política v3 §1 (roles) en lo esencial. **Le falta**: (a) identificar al responsable por su razón social (TAWILSTACK S.A.S.) y aclarar que «{negocio}» es responsable independiente de la relación laboral/comercial; (b) qué datos exactos (incluye foto y documento si se piden para comisiones/pagos); (c) consecuencia de retirar la autorización (si el vínculo necesita esos datos, retirarla implica terminar el vínculo en la Plataforma: no puede «retirarse» y seguir trabajando — 2.2.2.25.2.6 permite conservar por deber contractual); (d) derechos y canal; (e) que no se le piden datos sensibles.
- **Texto propuesto (v2-borrador):** «Autorizo a TAWILSTACK S.A.S., operadora de StylerNow, y a {negocio} a tratar mi nombre, correo electrónico, número de celular, foto de perfil y datos de mi perfil profesional (especialidad, descripción, horarios y servicios que atiendo) para gestionar mi vínculo como profesional en {negocio} dentro de la Plataforma: mi agenda, mis turnos, las reservas que se me asignan, el registro de mis servicios y el cálculo de mis comisiones, y para comunicarse conmigo sobre esos asuntos. TAWILSTACK S.A.S. trata estos datos como responsable de la operación de la Plataforma; {negocio} es responsable independiente de mi relación laboral o comercial y de lo que haga con mis datos fuera de la Plataforma. No se me piden datos sensibles. Puedo conocer, actualizar, rectificar y pedir la supresión de mis datos, pedir prueba de esta autorización y revocarla desde mi perfil o escribiendo a `[COMPLETAR: correo]`; como estos datos son necesarios para el vínculo, revocarla equivale a pedir que se cierre mi vínculo en la Plataforma, sin afectar las reservas ya atendidas ni los registros que la ley obliga a conservar. He leído la Política de Tratamiento de Datos Personales.»

### 6.2 `AUTORIZACION_STAFF_PUBLICACION` (v1-borrador)
Texto: «Autorizo a StylerNow y a {negocio} a publicar mi nombre, foto, especialidad y descripción en el perfil del negocio dentro de StylerNow para que los clientes me encuentren y reserven conmigo. Puedo retirar esta autorización desde mi perfil; al hacerlo, mi perfil deja de mostrarse.»
- Coherente con v3 y con `staff_es_publicable`. **Le falta**: (a) carácter **facultativo** (no condiciona el vínculo: decisión E lo confirma, debe decirse); (b) alcance de la publicación: visible a cualquier visitante, indexable por buscadores, puede aparecer en mapa y enlaces compartidos; (c) que la foto puede seguir accesible por URL un tiempo tras retirar (limitación anotada en `CLOUDINARY.md`) y el plazo de borrado; (d) efecto sobre reservas existentes (se mantienen); (e) derechos de imagen (autoriza el uso de su imagen, sin remuneración, limitado a ese fin).
- **Texto propuesto (v2-borrador):** «Autorizo a TAWILSTACK S.A.S., operadora de StylerNow, y a {negocio} a publicar mi nombre, mi foto, mi especialidad y mi descripción en el perfil público de {negocio} dentro de StylerNow (sitio web y aplicación, visibles para cualquier persona y para buscadores) para que los clientes puedan encontrarme y reservar conmigo. Esta autorización es voluntaria: si no la doy o la retiro, sigo pudiendo usar la Plataforma para mi trabajo interno, pero no aparezco en el perfil público ni recibo reservas por asignación automática. Autorizo el uso de mi imagen solo para este fin y sin contraprestación distinta de la pactada con {negocio}. Puedo retirarla desde mi perfil en cualquier momento; mi perfil deja de mostrarse de inmediato, las reservas ya agendadas conmigo se mantienen y la foto se elimina del almacenamiento dentro de los 30 días siguientes. He leído la Política de Tratamiento de Datos Personales.»

### 6.3 Observaciones de arquitectura (para el propietario)
- `autorizar_staff` exige TRATAMIENTO antes de PUBLICACIÓN: correcto.
- La **transición de 30 días** publica Staff existente sin autorización registrada: riesgo señalado en el dictamen §7.2.
- La versión «1-borrador» queda registrada en la evidencia: adecuado; cuando se apruebe el texto, publicar v2 como VIGENTE y pedir reaceptación.
- Falta en la política v3 una mención expresa al tratamiento de datos del **Equipo/Staff** como categoría de titular (hoy solo «Negocios: … su equipo»). Añadir a v3 §2 una letra: «(m) Equipo de los Negocios: nombre, correo, celular, foto y perfil profesional de las personas que el Negocio vincula, con las autorizaciones que ellas otorgan al aceptar su invitación.»

---

## 7. Textos listos para pegar

### 7.1 Dos casillas de registro de **clientes** (desmarcadas, independientes)
**Variante F (recomendada):**
- [ ] «He leído y acepto los **Términos y Condiciones** de StylerNow.»
- [ ] «Autorizo a TAWILSTACK S.A.S. (StylerNow) a tratar mi nombre, correo, celular, país e idioma para crear y proteger mi cuenta, gestionar mis reservas y pagos, prevenir fraudes y cumplir la ley, como explica la **Política de Tratamiento de Datos Personales**. Sé que puedo conocer, actualizar, rectificar y suprimir mis datos y revocar esta autorización, y que las promociones se autorizan aparte.»

**Variante alterna (si se adopta el registro de seguridad con IP seudonimizada):**
- [ ] «He leído y acepto los **Términos y Condiciones** de StylerNow.»
- [ ] «Autorizo a TAWILSTACK S.A.S. (StylerNow) a tratar mi nombre, correo, celular, país e idioma para crear y proteger mi cuenta, gestionar mis reservas y pagos y cumplir la ley, y a conservar durante máximo 90 días un registro de seguridad de mis accesos (navegador, sistema operativo y una versión irreversible de mi dirección IP) para avisarme de accesos inusuales, como explica la **Política de Tratamiento de Datos Personales**. Sé que puedo conocer, actualizar, rectificar y suprimir mis datos y revocar esta autorización, y que las promociones se autorizan aparte.»

Texto de error si falta una: «Para crear tu cuenta necesitamos que aceptes los Términos y que autorices el tratamiento de tus datos; son dos decisiones separadas.»

### 7.2 Dos casillas de registro de **Negocios**
- [ ] «He leído y acepto los **Términos y Condiciones** de StylerNow para Negocios, incluida la cláusula 9A sobre datos de clientes.»
- [ ] «Autorizo a TAWILSTACK S.A.S. (StylerNow) a tratar mis datos como representante del Negocio (nombre, correo, celular, documento e identificación fiscal del Negocio) para operar la cuenta, facturar el Plan y cumplir la ley, como explica la **Política de Tratamiento de Datos Personales**. Entiendo que, respecto de los datos de mis clientes que reciba a través de la Plataforma, mi Negocio es responsable independiente y debe cumplir la Ley 1581 de 2012.»

### 7.3 Aviso de privacidad (sustituye al «banner de IP»)
Ubicación: formularios de ingreso, registro y recuperación de contraseña (y pie de página), no como banner modal.
«**Aviso de privacidad.** Para proteger el acceso, limitamos los intentos de ingreso por cuenta y por conexión: registramos cada intento (correo, resultado y hora) durante 30 días y convertimos tu dirección IP en una huella irreversible que se elimina en 24 horas. No guardamos tu IP en claro ni deducimos tu ubicación. Responsable: TAWILSTACK S.A.S. Más información y tus derechos en la Política de Tratamiento de Datos Personales.»

### 7.4 Micro-copy junto al teléfono del cliente (panel del Negocio)
Ubicaciones en código: `src/app/panel/agenda/vista-agenda.tsx` (líneas 611 y 839), `src/app/panel/crm/[clienteId]/detalle-cliente.tsx` (línea 146), `src/app/panel/crm/lista-crm.tsx`.
Texto corto (bajo el número): «Solo para gestionar esta cita. Sin publicidad ni mensajes fuera de horario (Ley 1581 y Ley 2300).»
Tooltip/ayuda ampliada: «Este dato te lo entregó el cliente para su cita. Puedes contactarlo para confirmar, reprogramar o atender la cita. No lo uses para promociones salvo que el cliente lo haya autorizado en StylerNow (verás la marca «Acepta promociones») y solo en horario permitido: L–V 7:00–19:00, sáb 8:00–15:00, nunca domingos ni festivos.»

### 7.5 Cláusula 9A para insertar en `TERMINOS_v4` — Negocios como responsables independientes
«**9A. Datos de los Clientes: roles, usos permitidos, incidentes e indemnidad.**
(a) **Roles.** TAWILSTACK S.A.S. es responsable del tratamiento de los datos que los Clientes entregan a la Plataforma para operarla. Cuando una Reserva se confirma, la Plataforma entrega al Negocio el nombre, el contacto y el detalle de la cita del Cliente, con la autorización específica que el Cliente marca para esa Reserva. Desde esa entrega, el Negocio es **responsable independiente** de esos datos conforme a la Ley 1581 de 2012 y al Decreto 1074 de 2015, y debe cumplir por sí mismo los deberes del artículo 17 de la Ley 1581: tener su propia política de tratamiento, conservar prueba de las autorizaciones adicionales que obtenga, atender consultas y reclamos de sus clientes y garantizar la seguridad de la información. Respecto de la información que el Negocio carga en la Plataforma sobre sus clientes (notas, historial, etiquetas), el Negocio es responsable y TAWILSTACK S.A.S. actúa como encargado, tratándola solo según estas condiciones y las instrucciones del Negocio.
(b) **Usos permitidos.** El Negocio solo puede usar los datos de un Cliente obtenidos a través de la Plataforma para gestionar y prestar el Servicio reservado: confirmar, reprogramar, recordar, atender la cita, cobrar el Saldo, tramitar reembolsos y cumplir la ley. Cualquier otro uso (publicidad, promociones, campañas, encuestas comerciales, venta o cesión a terceros, incorporación a listas de marketing) exige una autorización previa, expresa e informada que el Negocio obtenga directamente del Cliente y pueda probar, o la marca de «Acepta promociones» que el Cliente otorgó en la Plataforma para ese Negocio.
(c) **Prohibición de spam y horarios.** Está prohibido enviar al Cliente mensajes comerciales por WhatsApp, SMS, llamada, correo u otro medio sin esa autorización, y, aun con ella, hacerlo fuera de lunes a viernes de 7:00 a. m. a 7:00 p. m. y sábados de 8:00 a. m. a 3:00 p. m., hora local, o en domingos y festivos, o más de una vez al día; cada mensaje comercial debe ofrecer una forma sencilla de dejar de recibirlos (Ley 2300 de 2023). Los avisos operativos de la cita no son publicidad.
(d) **Seguridad y confidencialidad.** El Negocio protegerá los datos de los Clientes con medidas razonables, limitará el acceso a su Equipo según la función de cada persona, no exportará ni copiará la base de Clientes a dispositivos o sistemas sin protección y mantendrá la confidencialidad después de terminar la relación.
(e) **Incidentes.** Si el Negocio conoce una pérdida, robo, acceso no autorizado o uso indebido de datos de Clientes obtenidos a través de la Plataforma, lo reportará a TAWILSTACK S.A.S. dentro de las **24 horas** siguientes, por el canal indicado en la Política de Tratamiento de Datos Personales, indicando qué ocurrió, qué datos y cuántas personas se afectaron y qué medidas tomó; colaborará en la investigación y en las notificaciones a los afectados y a la autoridad, y asumirá el reporte que le corresponda como responsable.
(f) **Derechos de los Clientes.** Si un Cliente ejerce un derecho ante TAWILSTACK S.A.S. sobre datos que el Negocio registró, TAWILSTACK S.A.S. le trasladará la solicitud y el Negocio la atenderá en los plazos legales. Si un Cliente retira la autorización de promociones, el Negocio dejará de enviarlas de inmediato.
(g) **Indemnidad.** El Negocio responderá frente a los Clientes y frente a las autoridades por el tratamiento que haga como responsable independiente. Mantendrá indemne a TAWILSTACK S.A.S., sus directivos y empleados frente a reclamaciones, demandas, multas que TAWILSTACK S.A.S. deba pagar por hechos imputables al Negocio, costos razonables de defensa y perjuicios derivados del incumplimiento de esta cláusula o de la ley por parte del Negocio, su Equipo, sus proveedores o cualquier persona a la que haya entregado datos. Esta indemnidad no exime a TAWILSTACK S.A.S. de los deberes que la ley le impone directamente como responsable o encargado.
(h) **Terminación.** El incumplimiento de esta cláusula es causal de suspensión o terminación de la cuenta del Negocio. Al terminar la relación, el Negocio podrá exportar la información de sus clientes que haya registrado y TAWILSTACK S.A.S. la eliminará o anonimizará según la Política de Tratamiento de Datos Personales y la política de retención, salvo lo que deba conservarse por ley.»

### 7.6 Cláusula de datos técnicos y retención para la política (resumen en dos variantes)
Ya entregada en la sección 1, §2(h) **Variante F** y **Variante alterna**, y §7 (plazos).

### 7.7 Texto de notificación de cambio no material (si se elige la opción (b) del dictamen §7.1)
«Actualizamos la redacción de los Términos y de la Política de Datos (versión {n}, vigente desde {fecha}). No cambian las finalidades, los datos que tratamos ni tus derechos. Puedes leer la versión vigente aquí.»

---

## 8. Resumen de inconsistencias por severidad

| Sev. | Dónde | Inconsistencia | Acción |
|---|---|---|---|
| Alta | `POLITICA_TRATAMIENTO_DATOS.md` §6 | Base legal «interés legítimo» inexistente en Colombia | Retirar el documento |
| Alta | `POLITICA_DATOS_v3` §2(h) | Afirma guardar IP y User-Agent en registros de inicio de sesión; el código no lo hace | Sustituir por Variante F/alterna |
| Alta | `TEXTOS_UI` §1 | Banner «al continuar navegando aceptas» + IP para ciudad | Sustituir por aviso de privacidad 7.3 |
| Alta | `TEXTOS_UI` §3; `TERMINOS_COMERCIOS` §8 | El Negocio «autoriza» datos de clientes; indemnidad que pretende transferir sanciones | Casillas 7.2 y cláusula 9A |
| Alta | Producción (115/121) | Responsable «StylerNow, NIT xxxxx» | Aplicar 138 corregida tras revisión |
| Media | `POLITICA_DATOS_v3` §5 | Falta Sentry (y Nominatim) como encargado | Añadir |
| Media | `POLITICA_DATOS_v3` §7 y código | Retenciones «solo el tiempo necesario» vs tablas sin borrado | Plazos de la política de retención |
| Media | `TERMINOS_v4` §1 y registro | Consentimiento empaquetado en una casilla | Dos casillas 7.1/7.2 |
| Media | `TERMINOS_v4` §11, código WhatsApp | Sin franjas Ley 2300 | Cláusula + control en servidor |
| Media | Migración 147 | Textos de Staff sin responsable, alcance, carácter facultativo ni efectos de revocar | v2 de 6.1/6.2 |
| Media | Migración 147 (decisión D) | Publicación de Staff 30 días sin autorización | Decisión del propietario |
| Baja | `POLITICA_DATOS_v3` §13 | Sin fecha de vigencia | Completar |
| Baja | `AUDITORIA_LEGAL_CODIGO.md` | Recomienda guardar IP/UA en consentimientos y describe el banner como insuficiente | Anotar como superada |
| Baja | `TERMINOS_CONDICIONES_USUARIOS.md` §6 | «Cobro en nombre del negocio» | No publicar |
