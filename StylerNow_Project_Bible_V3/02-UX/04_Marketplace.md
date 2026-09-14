# 04 — Marketplace UX

## Objetivo
Especificar las pantallas de descubrimiento, perfil público y conversión del Marketplace, como implementación de `08-Growth-Monetization/01_Marketplace_Algorithm.md`.

## Alcance
Experiencia de descubrimiento y perfil de Negocio dentro de la Cliente PWA. El algoritmo detrás del orden de resultados está en `08-Growth-Monetization/01_Marketplace_Algorithm.md`; este documento cubre solo la capa visual e interacción.

## Reglas

### Descubrimiento (Home, ver mockup `C3-Home`)

- Barra de búsqueda + filtro rápido "Cerca de mí" (chip activo por defecto si hay permiso de ubicación).
- Filtros adicionales: Mejor calificadas, Precio, Disponible hoy, categoría (barbería/salón/spa/etc.).
- Mapa visual con pines de Negocios cercanos (vista opcional, alternable con vista de lista).
- Carrusel de Negocios destacados (resultado del componente Patrocinio del Score, siempre etiquetado "Patrocinado" cuando corresponda — `03-Business-Rules/06_Marketplace_Ads.md`).
- Cada tarjeta de resultado muestra: foto, nombre, rating + conteo de reseñas, distancia, próxima disponibilidad ("Disponible en 20 min" / "Próximo turno 3:30 PM").

### Perfil Público (ver mockup `C4-BarberProfile`)

- Galería de fotos del Negocio.
- Rating agregado + conteo de reseñas verificadas (toda reseña proviene de una Reserva completada, `04-Data-Model/01_Entities.md`).
- Lista de Servicios con precio y duración.
- Lista de Staff con foto, especialidad, y badge de Nivel PRO/EXPERT/MASTER si aplica (`03-Business-Rules/05_Staff_Rewards.md`, impacto en Conversión).
- Promociones activas (Marketplace Ads tipo Banner/Flash del propio Negocio).
- Ubicación con mapa y distancia.
- Metadatos de SEO: cada perfil de Negocio genera una URL amigable (`slug`) indexable por buscadores, con datos estructurados (schema.org LocalBusiness) para aparecer en resultados de búsqueda externos a StylerNow.
- Botón principal fijo: "Reservar turno" (entra al flujo de `05_Booking.md`).

### Conversión

- **Favoritos**: el Cliente puede guardar un Negocio para acceso rápido, sin límite de cantidad.
- **Compartir**: genera un link público al perfil del Negocio (mismo `slug` indexado por SEO), compartible por cualquier canal externo.
- **Reseñas**: solo visibles las `VISIBLE` (`06-Security/03_Fraud.md`, vector 1); el Cliente que dejó una reseña puede editarla dentro de las 48 horas siguientes a publicarla, después queda fija (evita manipulación tardía coordinada).

## Estados
No aplica una máquina de estados propia de UI — refleja los estados de `negocio` y `resena` de `04-Data-Model/03_State_Machines.md`.

## Permisos
Lectura pública para todo el descubrimiento y perfil. Favoritos y reseñas requieren sesión de Cliente autenticada.

## Dependencias
- Depende de: `08-Growth-Monetization/01_Marketplace_Algorithm.md`, `03-Business-Rules/06_Marketplace_Ads.md`, `05-API/05_Marketplace.md`.
- De este documento dependen: `05_Booking.md`, `07-QA/06_Marketplace.md`.

## Casos límite

- **Un Negocio no tiene fotos cargadas.** Se muestra un placeholder de marca (nunca un espacio vacío roto) y una alerta a la Barbería en su Panel para completar el perfil — un perfil incompleto no se bloquea del Marketplace, pero se incentiva su completitud porque afecta indirectamente la Conversión_normalizada del Score.
- **Un Cliente comparte el link de un Negocio que luego se suspende.** Quien abre el link ve el mismo `404 NEGOCIO_NO_DISPONIBLE` de `05-API/05_Marketplace.md`, con una experiencia de error clara, no una página rota.
- **Un Cliente intenta editar una reseña después de las 48 horas.** La opción de edición desaparece de la UI (consistente con la regla — no es solo un límite de backend sin explicación en pantalla); puede eliminar y volver a escribir solo si el sistema lo permite explícitamente como excepción de "corrección", lo cual no está habilitado en V1 (evita abuso).

## Criterios de aceptación
- [ ] Todo perfil de Negocio `ACTIVO` genera metadatos SEO válidos, verificable con una herramienta de validación de datos estructurados.
- [ ] Ningún resultado de descubrimiento oculta la etiqueta "Patrocinado" cuando corresponde.
- [ ] Los Favoritos persisten entre sesiones del mismo Cliente autenticado.

## Checklist
- [x] Completo
- [ ] Revisado
