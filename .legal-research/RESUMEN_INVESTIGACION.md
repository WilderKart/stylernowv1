# Investigación legal y normativa aplicable

## Identidad de la empresa y el producto

TAWILSTACK S.A.S. es la entidad que opera StylerNow, su producto SaaS. La razón social, domicilio (Calle 15B # 20-79, Candelaria, Valle del Cauca), correo (equipo@stylernow.com) y teléfono (+57 3183943465) fueron informados por el propietario. El NIT está en trámite de asignación. Los borradores deben identificar a TAWILSTACK S.A.S. como empresa operadora y a StylerNow como producto, y conservar esa distinción al publicarse.

El PDF recibido en `docs/politica tratamiento de datos/` es la guía institucional G-IC-16 del Ministerio de Justicia y del Derecho (versión 01, 2020), no una política de StylerNow. Se tomaron solo criterios generales de organización y claridad; no se trasladaron finalidades, canales ni procedimientos propios del Ministerio.

## 1. Marco normativo principal aplicable a StylerNow

Se revisó el marco colombiano vigente para tratamiento de datos personales y comercio electrónico, con foco en:

- Ley 1581 de 2012, por la cual se dictan disposiciones generales para la protección de datos personales.
- Decreto 1377 de 2013, por el cual se reglamenta parcialmente la Ley 1581 de 2012.
- Decreto 1074 de 2015, que compila y ajusta disposiciones del sector de comercio y regulación de datos.
- Guías, lineamientos y publicaciones de la Superintendencia de Industria y Comercio (SIC) sobre tratamiento de datos en plataformas web y aplicaciones móviles.

## 2. Conclusiones relevantes para la app

### 2.1 Consentimiento válido

La SIC ha insistido en que el consentimiento debe ser:

- previo,
- libre,
- informado,
- específico,
- y no canónico ni premarcado.

Esto implica que el usuario debe poder decidir de forma separada sobre:

- aceptación de Términos y Condiciones;
- autorización de tratamiento de datos personales;
- autorizar cookies, analítica o geolocalización cuando se trate de fines adicionales.

### 2.2 Tratamiento de IP, navegador y cookies

El tratamiento de IP, User-Agent, navegador, sistema operativo, cookies y geolocalización puede ser justo y necesario cuando hay una finalidad concreta y proporcional, vinculada a:

- seguridad,
- prevención de fraude,
- prevención de reservas falsas,
- control de accesos,
- soporte técnico,
- geolocalización aproximada para ofrecer servicios cercanos,
- auditoría y trazabilidad de operaciones.

No obstante, debe quedar claramente informado en un aviso de privacidad y debe existir una política de retención y anonimización.

### 2.3 Plataforma intermediaria y comercios aliados

Como la app funciona como marketplace o intermediario de agendamiento, la relación jurídica con los comercios aliados debe quedar delimitada. El negocio aliado debe asumir la responsabilidad directa del tratamiento de datos que reciba para la ejecución del servicio agendado, sin que StylerNow quede como responsable de usos no autorizados, spam o mala gestión del dato por parte del comercio.

### 2.4 Base de datos y reporte de incidentes

La SIC exige un enfoque serio de seguridad y de registro de incidentes. Cuando exista tratamiento de datos sensibles o de alto riesgo, la plataforma debe mantener trazabilidad, control de accesos, retención definida y procedimientos para reporte de incidentes.

## 3. Aplicación al código actual de StylerNow

El código ya muestra varios avances importantes:

- hay control de versionado de textos legales;
- hay flujo de aceptación de Términos y Política;
- hay banner de cookies y gestión de privacidad;
- hay captura de IP y User-Agent para seguridad y análisis;
- hay presencia de geolocalización para ofrecer servicios cercanos.

Los puntos a reforzar son:

- doble casilla independiente y desmarcada por defecto;
- aviso de privacidad antes de navegar o al entrar a ver negocios;
- retención y anonimización explícita de IP, navegador y logs;
- registro con IP, fecha, versión y documento aceptado;
- delimitación clara de roles entre StylerNow y el comercio aliado.

## 4. Conclusión

La propuesta final de StylerNow debe quedar alineada con la lógica de la Ley 1581 de 2012 y la normativa de la SIC: transparencia, finalidad específica, consentimiento informado y separación clara entre las obligaciones de la plataforma tecnológica y las del comercio aliado.

## 5. Referencias a validar en la fuente oficial antes de publicación final

- Ley 1581 de 2012.
- Decreto 1377 de 2013.
- Decreto 1074 de 2015.
- Guías y comunicaciones de la Superintendencia de Industria y Comercio (SIC) sobre tratamiento de datos personales, cookies, geolocalización y consentimiento digital.

> Nota (actualizada 2026-11-17): los textos canónicos ya identifican a TAWILSTACK S.A.S. con su domicilio, correo y teléfono. **Solo el NIT sigue en trámite de asignación** y así consta en los textos. Antes de la publicación definitiva se requiere la revisión de un abogado colombiano (ver `docs/legal/AUDITORIA_NORMATIVA_COLOMBIA.md`).
