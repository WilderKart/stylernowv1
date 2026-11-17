> **ANOTACIÓN (2026-11-17): documento histórico, parcialmente superado.** Sus recomendaciones de guardar IP y User-Agent en cada consentimiento (§3.3 y §4.4) y de una retención de 90 días para IP/User-Agent/logs (§3.4) **no se adoptaron**: la decisión vigente es que las evidencias legales no llevan IP ni navegador (`DICTAMEN_DATOS_TECNICOS_Y_RETENCION.md`) y los plazos reales están en la sección 7 de la política publicada. Su descripción del banner de privacidad tampoco refleja el código actual. El cuadro vigente de alineación con la norma es `AUDITORIA_NORMATIVA_COLOMBIA.md`.

# Auditoría legal del código y brechas técnicas a corregir

La entidad operadora indicada por el propietario es TAWILSTACK S.A.S.; StylerNow es uno de sus productos SaaS. El NIT está en trámite de asignación. Esta auditoría no sustituye la revisión jurídica de la identificación del responsable ni de los textos de publicación.

## 1. Resumen ejecutivo

La aplicación StylerNow ya incorpora varios elementos positivos de cumplimiento: hay sistema de versión de textos legales, aceptación de términos y política, gestión de consentimientos y un banner de cookies. Sin embargo, existen brechas materiales a corregir antes de una operación comercial real en Colombia.

Las brechas principales son:

1. Falta de enlace visible de políticas legales en todas las pantallas relevantes.
2. Los consentimientos legales deben mantenerse como dos casillas independientes, desmarcadas por defecto.
3. No existe evidencia técnica clara de registro de consentimiento con IP, fecha/hora y versión aceptada para todos los flujos.
4. La retención de IP, User-Agent y registros de conexión requiere una política explícita y un criterio técnico de eliminación o anonimización.
5. La geolocalización debe tener justificación, consentimiento explícito y límites de retención claros.

## 2. Evidencias encontradas en el código

### 2.1 Consentimientos y textos legales

Se observa que la app ya implementa control versionado de textos legales:

- `src/lib/auth/aceptacion-legal.ts` registra aceptación de `TERMINOS` y `POLITICA_DATOS` con `aceptacion_legal` y control de versionado.
- `src/app/login/registro-actions.ts` valida que el usuario acepte los textos y registra `consentimiento_datos_at`.
- `src/app/legal/[slug]/page.tsx` y `src/app/legal/aceptar/page.tsx` publican y exigen aceptación de documentos legales.

Esto es positivo y debe mantenerse, pero conviene reforzar la trazabilidad del consentimiento con IP, marca temporal y versión aceptada por flujo.

### 2.2 Banner de cookies y privacidad

Se encontró implementación del banner y gestión de cookies:

- `src/components/privacidad/banner-cookies.tsx`
- `src/components/privacidad/analitica.tsx`
- `src/components/privacidad/acciones-cookies.ts`

Esto cumple parcialmente el requisito de aviso de cookies y preferencias, pero no reemplaza la obligación de avisar de forma visible y previa sobre la captura de IP, navegador y datos técnicos al ingresar a la plataforma.

### 2.3 Casilla de aceptación legal

La casilla legal en el registro existe en:

- `src/app/login/_componentes/campos.tsx`

Se verifica una sola casilla con texto conjunto de términos y política, y no un doble consentinmiento separado. La recomendación es separar en dos casillas independientes, desmarcadas por defecto.

### 2.4 Captura de IP y User-Agent

Se detecta captura técnica de IP y navegador en:

- `src/lib/ads/registrar-evento.ts` obtiene `x-forwarded-for` y `user-agent` y los integra a una huella de seguridad.
- `src/lib/rate-limit.ts` extrae la IP del header.

Esto es compatible con seguridad y prevención de fraude, pero debe quedar documentado y delimitado en la política, con retención máxima y anonimización.

### 2.5 Geolocalización

Se observa uso de geolocalización en:

- `src/app/ajustes/permisos/form-permisos.tsx`
- `src/app/negocio/[slug]/reservar/aviso-distancia.tsx`
- `src/app/ofertas/usar-ubicacion.tsx`
- `src/components/marketplace/filtros.tsx`

La geolocalización es funcionalmente razonable, pero exige tratamiento claro, consentimiento explícito cuando se use para más que la ubicación aproximada necesaria para la reserva o los servicios cercanos, y limitación de almacenamiento y alcance.

## 3. Brechas a corregir

### 3.1 Enlaces legales visibles

Se recomienda asegurar que el footer y/o header incluyan enlaces permanentes a:

- Términos y Condiciones
- Política de Tratamiento de Datos Personales
- Política de cookies y privacidad

Esto debe visualizarse en todas las páginas principales y en la experiencia de negocio y cliente.

### 3.2 Consentimiento independiente y no premarcado

Se deben implementar dos casillas separadas y desmarcadas por defecto:

- aceptación de Términos y Condiciones;
- autorización de tratamiento de datos personales y técnicos.

No debe existir una sola casilla combinada con texto empaquetado.

### 3.3 Registro de consentimiento con trazabilidad

Se recomienda guardar en base de datos, al aceptar:

- `usuario_id` o `negocio_id`
- `texto_legal_id`
- `version_texto`
- `tipo_consentimiento` (términos / política / cookies / ip-geolocalizacion)
- `aceptado_at`
- `ip_origen`
- `user_agent`
- `ruta_o_pantalla`
- `hash_o_version` de la política aceptada

Esto permite demostrar que el consentimiento fue informado y puntualmente aceptado.

### 3.4 Retención de datos técnicos

Debe existir una política técnica de retención clara:

- IP + User-Agent + logs de conexión: 90 días
- geolocalización aproximada: según necesidad operativa y mínimo imprescindible
- cookies de funcionalidad: según elección del usuario y mínimo necesario
- logs de seguridad: según auditoría y requerimientos legales

### 3.5 Geolocalización y ubicaciones sensibles

Si la plataforma usa geolocalización, debe quedar claramente separada de la prestación del servicio principal y debe tener:

- advertencia breve;
- motivación para la ubicación;
- límite de uso;
- opción de desactivar o no autorizar, cuando aplique.

## 4. Recomendación de corrección inmediata

Antes del lanzamiento comercial, se recomienda:

1. Incluir footer y/o header con enlaces permanentes a Términos y Política.
2. Añadir banner de aviso inicial sobre IP, navegador, seguridad y geolocalización.
3. Separar casillas para términos y tratamiento de datos personales.
4. Registrar explícitamente el consentimiento con IP, versión, fecha y documento aceptado.
5. Definir política técnica de retención de IP, navegador y logs.
6. Delimitar el tratamiento de geolocalización y el uso del teléfono del cliente para negocio.

## 5. Conclusión

La aplicación ya está en una posición razonable respecto de control de versiones legales y consentimiento, pero aún no está blindada de forma robusta frente a una revisión legal y regulatoria en Colombia. La prioridad es reforzar la transparencia, la trazabilidad y la separación de consentimientos, sin premarcar opciones ni ocultar la finalidad del tratamiento de IP, navegador y geolocalización.
