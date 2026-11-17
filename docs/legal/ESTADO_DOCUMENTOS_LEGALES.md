# Estado de los documentos legales

Actualización: 2026-11-17. TAWILSTACK S.A.S. opera StylerNow, su producto SaaS. El propietario confirmó la razón social, el domicilio (Calle 15B # 20-79, Candelaria, Valle del Cauca), el correo (equipo@stylernow.com) y el teléfono (+57 3183943465). **El NIT sigue en trámite de asignación y así se indica en los textos.** Los textos son un trabajo de ingeniería y redacción apoyado en la investigación de `INVESTIGACION_NORMATIVA.md`; **no sustituyen la revisión de un abogado colombiano.**

## 1. Qué hay publicado en producción hoy (medido el 2026-11-17, solo lectura)
| Tipo | Versiones en `texto_legal` | Observación |
|---|---|---|
| TERMINOS | 1 y 2 (la 2, de 1 782 caracteres, publicada el 2026-11-11) | Texto corto de marketplace. **La migración 115 (Términos de ~18 000 caracteres) no insertó su versión 3 en producción.** |
| POLITICA_DATOS | 1 y 2 (la 2, de 8 641 caracteres, publicada el 2026-11-13) | Identifica al responsable como «StylerNow, NIT xxxxx» con «Carrera 1A # 59-60, Cali»: **datos incorrectos hoy a la vista del público.** |

## 2. Qué contiene este cambio
| Documento | Archivo | Estado |
|---|---|---|
| Términos y Condiciones (clientes y negocios) | `TERMINOS_v4_borrador.txt` (fuente canónica; se publica como **TERMINOS versión 3** en la tabla) | Texto actualizado a TAWILSTACK y corregido (ver §3). Pendiente: revisión de abogado. |
| Política de Tratamiento de Datos Personales | `POLITICA_DATOS_v3_texto.txt` (fuente canónica; se publica como **POLITICA_DATOS versión 3**) | Texto actualizado y alineado con el código y con la Ley 1581 (ver §3). Pendiente: revisión de abogado. |
| Migración de publicación | `supabase/migrations/149_textos_legales_tawilstack.sql` | **Generada** de las dos fuentes. **No aplicada.** Aborta si las versiones previas no son las esperadas. |
| Verificador de sincronización | `scripts/legal/verificar-sincronizacion.mjs` | Pasa: la migración coincide con ambas fuentes. |
| Alineación con la norma colombiana | `AUDITORIA_NORMATIVA_COLOMBIA.md` | Cuadro requisito por requisito, con lo cubierto y lo pendiente. |
| Investigación, dictamen, revisión y retención | `INVESTIGACION_NORMATIVA.md`, `DICTAMEN_DATOS_TECNICOS_Y_RETENCION.md`, `REVISION_JURIDICA_BORRADORES.md`, `POLITICA_RETENCION_BORRADOR.md` | Documentos de trabajo internos (no se publican). |
| Borradores paralelos | `POLITICA_TRATAMIENTO_DATOS.md`, `TERMINOS_CONDICIONES_USUARIOS.md`, `TERMINOS_COMERCIOS_ALIADOS.md` | **No vigentes**, con aviso en su cabecera. |
| Textos de interfaz | `TEXTOS_UI_CONSENTIMIENTO.md` | Reescrito: describe lo que hay hoy y las mejoras de interfaz pendientes. |
| Historial | `TERMINOS_v3_texto.txt`, `POLITICA_DATOS_v2_texto.txt`, `AUDITORIA_LEGAL_CODIGO.md` | Solo historial (la auditoría lleva una anotación de superada). |

Nota sobre numeración: los nombres de archivo conservan «v4» (términos) y «v3» (política) por el historial de redacción; en la base de datos las versiones siguientes son **TERMINOS 3** y **POLITICA_DATOS 3**.

## 3. Qué se corrigió respecto del borrador anterior
**Política:** persona/área y canal de atención; prueba gratuita (huellas, cookie `sn_disp` de 730 días, rasgos del equipo); registros de seguridad descritos como son (huella de IP de límite de intentos de máximo dos días; sesiones de Supabase con IP y navegador; Sentry; Cloudflare Turnstile; auditoría sin IP), eliminando la afirmación de guardar IP y User-Agent en registros de inicio de sesión; ubicación solo por acción de la persona y sin guardarla; cookies; carácter facultativo de datos sensibles y de menores; IA con la Circular Externa 002 de 2024; autorización del registro y de cada reserva descritas como funcionan; proveedores faltantes (Cloudflare, Sentry, Nominatim); transferencias internacionales con autorización; retención con los plazos que sí se aplican; derechos con el requisito previo para acudir a la SIC; reporte de incidentes (15 días hábiles a la SIC; 24 horas de los negocios); cambios no materiales; fecha de versión.
**Términos:** aceptación y autorización descritas según la casilla real; **acceso con correo y contraseña** (el texto anterior decía solo código de 6 dígitos o Google, ya inexacto); cláusula 9A de datos de Clientes (negocio como responsable independiente, usos permitidos, horarios Ley 2300, incidentes en 24 horas, indemnidad sin trasladar sanciones personales); salud y pruebas de sensibilidad bajo responsabilidad del negocio; retracto del consumidor; límite de responsabilidad frente al cliente solo en lo permitido por la ley de consumo; fuerza mayor; reporte de contenido; Ley 527 de 1999; peticiones, quejas y reclamos.

## 4. Pendientes (no los inventé)
1. **NIT** de TAWILSTACK S.A.S. (en trámite). Cuando exista, se actualizan ambas fuentes y se regenera la migración; mientras tanto el texto dice «NIT en trámite de asignación».
2. **Revisión de un abogado colombiano** (ver `AUDITORIA_NORMATIVA_COLOMBIA.md` §3: puntos que no se verificaron literalmente).
3. **Confirmar con el propietario**: el área de atención de datos es «el equipo de TAWILSTACK» con el correo y teléfono informados; el plazo de 15 días hábiles para peticiones, quejas y reclamos generales; los plazos de retención de la sección 7 de la política.
4. **Interfaz** (próximo cambio de código): rótulo de la casilla, valorar dos casillas, aviso de privacidad para visitantes y control de franjas Ley 2300 en el servidor (`TEXTOS_UI_CONSENTIMIENTO.md`).
5. **Política de retención** (`POLITICA_RETENCION_BORRADOR.md`) y procesos de borrado: hoy varias tablas técnicas no tienen borrado automático; la política pública promete solo lo que existe.
6. **RNBD:** confirmar si TAWILSTACK está obligada (activos totales > 100 000 UVT); probablemente no.
7. **Aplicar la migración 149** cuando se decida publicar: activará la reaceptación de todos los usuarios y reemplazará los textos con «NIT xxxxx». No se aplicó.

## 5. Documento de referencia recibido
El PDF `_política de tratamiento y protección datos personales.pdf` (carpeta `docs/politica tratamiento de datos/`) es la Guía G-IC-16 del Ministerio de Justicia y del Derecho (2020), una política **institucional** de una entidad pública. Se usó solo como lista de comprobación de estructura (glosario, principios, derechos, deberes, procedimientos, seguridad e incidentes). No se copiaron sus finalidades, canales ni procedimientos.
