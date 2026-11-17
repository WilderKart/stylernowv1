# Auditoría de alineación normativa — textos legales de StylerNow (Colombia)

Fecha: 2026-11-17 · Documentos auditados: `POLITICA_DATOS_v3_texto.txt` (política) y `TERMINOS_v4_borrador.txt` (términos), tal como los publica la migración 149 · Responsable: TAWILSTACK S.A.S. (NIT en trámite).

**Alcance y límites.** Es una auditoría técnica y de redacción hecha por un asistente de software, contrastando los textos con (a) la investigación normativa de `INVESTIGACION_NORMATIVA.md` (artículos leídos en fuentes oficiales el 2026-11-16, con las salvedades de su §12), (b) los hechos del código (`DICTAMEN_DATOS_TECNICOS_Y_RETENCION.md`) y (c) el estado de la base de datos de producción medido el 2026-11-17 en modo lectura. **No es asesoría jurídica ni sustituye a un abogado colombiano.** Donde no pude verificar el texto literal de una norma lo digo.

Leyenda: ✅ cubierto en el texto y coherente con el código · ◑ cubierto en parte o depende de otro cambio · ❌ pendiente.

## 1. Protección de datos personales (Ley 1581 de 2012; Decreto 1074 de 2015, Libro 2, Parte 2, Título 2, Cap. 25 y 26)

| # | Requisito | Norma | Dónde está en el texto | Estado |
|---|---|---|---|---|
| 1 | Identificación del responsable: nombre, domicilio, correo y teléfono | D. 1074 art. 2.2.2.25.3.1 (antes D. 1377/2013 art. 13) | Política §1; Términos §1 y §23 | ✅ (NIT: «en trámite de asignación», real) |
| 2 | Persona o área que atiende los datos personales | D. 1074 arts. 2.2.2.25.3.1 y 2.2.2.25.4.4 | Política §1 («el equipo de TAWILSTACK encargado de la protección de datos») y §9 | ◑ Se designa un área con los canales informados; **el propietario debe confirmar quién la integra** |
| 3 | Tratamiento y finalidades, informadas al titular | Ley 1581 arts. 4 (finalidad), 12; D. 1074 art. 2.2.2.25.2.2 | Política §2 y §3 | ✅ |
| 4 | Autorización previa, expresa e informada; no se presume; prueba conservada | Ley 1581 arts. 3, 9, 17 lit. b; D. 1074 arts. 2.2.2.25.2.4–2.2.2.25.2.5 | Política §4; Términos §1, §14; casilla de registro no premarcada y autorización específica por reserva; evidencias con texto, SHA-256 y hora del servidor | ◑ El texto describe la casilla única que existe hoy. **Mejora de interfaz recomendada**: rótulo explícito y valorar dos casillas (`TEXTOS_UI_CONSENTIMIENTO.md`) |
| 5 | Finalidades opcionales por separado, sin condicionar el servicio | Ley 1581 art. 4 lit. b; D. 1074 art. 2.2.2.25.2.2 (cambio de finalidad → nueva autorización) | Política §3(h), §4 | ✅ (analítica, personalización, ofertas, marcas aliadas y marketing: desactivados por defecto) |
| 6 | Datos sensibles: carácter facultativo; no se condiciona ninguna actividad | Ley 1581 arts. 5, 6; D. 1074 art. 2.2.2.25.2.3 | Política §2 (párrafo de datos sensibles) | ✅ El negocio decide ese tratamiento como responsable independiente |
| 7 | Menores de edad: tratamiento prohibido salvo interés superior; representante | Ley 1581 art. 7; D. 1074 art. 2.2.2.25.2.9 | Política §2 y §11; Términos §4 | ✅ Plataforma para mayores de 18; reserva para un menor por su representante |
| 8 | Derechos del titular (conocer, actualizar, rectificar, prueba de la autorización, uso, revocar/suprimir, acceso gratuito, queja ante la SIC) | Ley 1581 art. 8 | Política §8 | ✅ Incluye quién puede ejercerlos, gratuidad, límite de la supresión (deber legal o contractual) y el requisito previo de reclamo ante el responsable antes de la SIC* |
| 9 | Procedimiento de consultas y reclamos con plazos | Ley 1581 arts. 14 (consultas) y 15 (reclamos) | Política §9: consultas 10 días hábiles (+5); reclamos 15 días hábiles (+8) | ✅ **Verificados literalmente el 2026-11-17** en el Gestor Normativo de Función Pública: art. 14 (10 días hábiles + 5) y art. 15 (reclamo 15 días hábiles + 8; subsanación a los 5 días; desistimiento a los 2 meses; leyenda «reclamo en trámite» en 2 días hábiles; traslado en 2 días hábiles), recogidos en la política §9 |
| 10 | Medidas de seguridad | Ley 1581 art. 4 lit. g, art. 17 lit. d | Política §10 | ✅ |
| 11 | Aviso de incidentes a la SIC | Ley 1581 art. 17 lit. n; Circ. Externa SIC 002 de 2015 | Política §10: 15 días hábiles desde la detección, cuando la normativa lo exija; los negocios reportan en 24 horas | ✅ Plazo de 15 días hábiles tomado de la circular citada; no verificada su vigencia frente a un proyecto de actualización (investigación §6.2) |
| 12 | Transferencias y transmisiones internacionales | Ley 1581 art. 26; D. 1074 arts. 2.2.2.25.5.1–5.2 | Política §5 y §6 (lista de proveedores y países; autorización incluida en la aceptación) | ◑ **Art. 26 leído el 2026-11-17:** prohíbe transferir a países sin nivel adecuado, salvo, entre otras, autorización expresa e inequívoca del titular y transferencias necesarias para ejecutar un contrato con el titular; el texto invoca ambas. Falta que un abogado confirme si Estados Unidos figura como país adecuado y que existan contratos de transmisión con cada proveedor |
| 13 | Limitación temporal y procedimientos de retención documentados | D. 1074 art. 2.2.2.25.2.8 | Política §7 (plazos que ya se aplican; resto, «revisados periódicamente») | ◑ Varias tablas técnicas no tienen borrado automático (dictamen §2). La política **no promete** lo que no existe; falta cerrar `POLITICA_RETENCION_BORRADOR.md` y su automatización |
| 14 | Fecha de entrada en vigencia y período de vigencia | D. 1074 art. 2.2.2.25.3.1 | Política §13 («Versión 3, elaborada el 17 de noviembre de 2026… rige desde su publicación…») | ✅ |
| 15 | Aviso de privacidad cuando no sea posible entregar la política | D. 1074 arts. 2.2.2.25.3.2–3.4 | No hay aviso para visitantes sin cuenta | ❌ Mejora de interfaz (`TEXTOS_UI_CONSENTIMIENTO.md` §2, punto 3) |
| 16 | Cambios sustanciales comunicados; versiones y constancias conservadas | D. 1074 art. 2.2.2.25.3.1 | Política §12; Términos §22; reaceptación por `cambio_material` | ✅ |
| 17 | Responsabilidad demostrada (accountability) | D. 1074 arts. 2.2.2.25.6.1–6.2 | Evidencias inmutables con hash encadenado; auditoría; límites de tasa | ◑ Falta un manual interno de protección de datos y la documentación de decisiones |
| 18 | Registro Nacional de Bases de Datos | Ley 1581 art. 25; D. 1074 art. 2.2.2.26.1.2 (umbral 100 000 UVT, D. 90/2018) | No aplica al texto público | ◑ **Confirmar los activos totales de TAWILSTACK**; con una startup es probable que no esté obligada, pero sigue sujeta a la ley |
| 19 | IA con datos personales | Circular Externa SIC 002 de 2024 | Política §3(i) | ◑ Se declara el compromiso; no se evaluó el cumplimiento técnico de los proveedores de IA |
| 20 | Prohibido «interés legítimo» como base | Ley 1581 art. 10 (no existe esa base) | Ninguno de los textos canónicos lo usa; el borrador paralelo que sí lo usaba quedó marcado como no vigente | ✅ |
| 21 | Roles responsable / encargado | Ley 1581 arts. 3, 17, 18 | Política §1; Términos cláusula 9A | ✅ El negocio es responsable independiente de los datos que recibe; TAWILSTACK es encargado de lo que el negocio carga |

\* Art. 16 de la Ley 1581, verificado el 2026-11-17: la queja ante la SIC solo procede «una vez haya agotado el trámite de consulta o reclamo» ante el responsable o encargado. Art. 8: el sitio muestra los literales a) a f) (conocer/actualizar/rectificar; prueba de la autorización; ser informado del uso; quejas ante la SIC; revocar y suprimir; acceso gratuito). Art. 17: literales a) a o), entre ellos b) copia de la autorización, k) **manual interno de políticas y procedimientos** (pendiente, fila 17) y n) informar a la autoridad las violaciones de seguridad.

## 2. Consumo, comercio electrónico y comunicaciones

| # | Requisito | Norma | Dónde | Estado |
|---|---|---|---|---|
| 22 | Información del proveedor y condiciones antes del pago (identidad, domicilio, contacto, precio, impuestos, política de cancelación) | Ley 1480 de 2011 (comercio electrónico) | Términos §1, §5, §6, §8(b), §23; aceptación expresa de la política de cancelación antes de pagar | ◑ El NIT, que el estatuto exige informar, está **en trámite** |
| 23 | Cláusulas abusivas / derechos irrenunciables del consumidor | Ley 1480 de 2011, arts. 42 y 43 | Términos §6 (último párrafo), §16, §20: límites «solo en lo que la ley permita» | ◑ La cancelación 24 h/2 h/50 % y el anticipo no reembolsable por inasistencia deben ser revisados por abogado frente a estas normas |
| 24 | Derecho de retracto en compras a distancia | Ley 1480 de 2011, art. 47 y reglamentos | Términos §6: se reconoce «cuando la ley lo conceda» | ◑ **No se verificó el texto del art. 47 ni sus excepciones**; el abogado debe decidir si el anticipo de servicios con fecha determinada queda excluido y redactarlo |
| 25 | Reclamación directa como paso previo a la acción ante la SIC | Ley 1480 de 2011, art. 58 | Términos §23 | ✅ (investigación §8) |
| 26 | Reversión de pagos en comercio electrónico | Decreto 587 de 2016 | Términos §6 (reembolsos por cobro errado o no autorizado) | ◑ Cubierta en esencia; falta revisión del procedimiento exacto |
| 27 | Mensajes comerciales: horarios, un contacto por día, autorización, baja sencilla | Ley 2300 de 2023, arts. 3, 5, 8 | Términos §11 y cláusula 9A(c) | ◑ El texto lo exige al negocio y reserva el bloqueo por parte de la Plataforma; **no existe control técnico en el servidor** |
| 28 | Mensajes de datos: validez y prueba | Ley 527 de 1999, arts. 5–13 | Términos §21 | ✅ |

## 3. Qué no pude verificar y por qué importa
1. Los arts. 42, 43 y 47 de la Ley 1480 (los arts. 8, 12, 14, 15, 16, 17 y 26 de la Ley 1581 se verificaron el 2026-11-17; la página de la SIC `manejo-de-informacion-personal` trata solo el hábeas data financiero de la Ley 1266 de 2008, que no aplica a StylerNow, y no cubre RNBD, aviso de privacidad ni transferencias).
2. Si Estados Unidos figura como país de nivel adecuado en la lista vigente de la SIC y si hay contratos de transmisión firmados con Supabase, Vercel, Sentry, Cloudflare, Resend, Google, Meta y OpenRouter.
3. Si el borrador de actualización del Título V de la Circular Única cambia el plazo de reporte de incidentes.
4. La retención real en días de los registros de Supabase por plan y la configuración de la organización en Sentry (el repositorio afirma que no guarda IP, no verificable desde el código).
5. Compatibilidad de la política de cancelación con el retracto (punto 24).

## 4. Hallazgos de la auditoría y qué se hizo

| Hallazgo | Gravedad | Acción |
|---|---|---|
| La política publicada en producción identifica al responsable como «StylerNow, NIT xxxxx», con la dirección anterior | Alta | Corregido en el texto nuevo; **se corrige al aplicar la migración 149 (no aplicada)** |
| Los Términos vigentes en producción son un texto corto (versión 2); la migración 115 nunca insertó su versión 3 | Alta | La migración 149 inserta TERMINOS 3 y POLITICA_DATOS 3 (versiones máx + 1) y se detiene si el estado no es el esperado |
| El borrador de Términos decía que el acceso es solo con código de 6 dígitos o Google; la app usa correo y contraseña | Alta | Corregido (§4 de los Términos) |
| La política afirmaba guardar IP y User-Agent en registros de inicio de sesión (no ocurre) y omitía a Sentry, Cloudflare Turnstile y Nominatim | Alta | Corregido; se advierte además que **Supabase sí guarda IP y navegador por sesión** (la propuesta previa decía lo contrario) |
| Base legal de «interés legítimo» en un borrador paralelo | Alta | Borrador marcado **no vigente** |
| Cláusula del negocio que pretendía trasladar sanciones de la SIC y prohibía el CRM propio del producto | Media | Reescrita como cláusula 9A |
| La investigación y el dictamen recomendaban plazos de retención que el código no aplica | Media | La política publica solo los que existen; el resto queda como pendiente |
| Faltaban franjas de la Ley 2300, fuerza mayor, salud, retracto, reporte de contenido y PQR | Media | Añadidos a los Términos |
| El NIT sigue sin existir | — | Se mantiene «en trámite de asignación»; nunca se inventó |

## 5. Pendientes ordenados
1. Revisión por abogado colombiano de ambos textos y de los puntos de la sección 3.
2. NIT (actualizar fuentes, regenerar la 149 con `node scripts/legal/generar-migracion.mjs` y verificar con `node scripts/legal/verificar-sincronizacion.mjs`).
3. Cambios de interfaz: rótulo/dos casillas, aviso de privacidad para visitantes y control de la Ley 2300 en el servidor.
4. Política de retención aprobada y automatizada; manual interno de protección de datos.
5. Confirmar RNBD y contratos de transmisión con proveedores.
6. Aplicar la migración 149 solo cuando se decida publicar (reacepción de todos los usuarios).

## 6. Identidad operadora (cambio del 2026-11-17)
Ambos textos dejan claro que **StylerNow es un producto operado por TAWILSTACK S.A.S.** y no una persona jurídica distinta: la Política §1 y los Términos §1 establecen que toda referencia a StylerNow como parte (derechos, obligaciones, cobros, responsabilidad, tratamiento de datos) se entiende hecha a TAWILSTACK S.A.S., que responde ante los usuarios y ante las autoridades.

## 7. Fuentes consultadas el 2026-11-17
- Ley 1581 de 2012, Gestor Normativo de Función Pública: <https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981>
- SIC, «Manejo de información personal» (Ley 1266 de 2008): <https://www.sic.gov.co/manejo-de-informacion-personal>. Canal de PQRSF de la SIC: <https://servicioslinea.sic.gov.co/servilinea/pqrsf/>
