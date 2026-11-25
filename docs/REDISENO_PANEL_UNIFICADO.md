# Rediseño del panel de gestión — uñas, spa y salón (2026-11-25)

## A. Resumen
Un solo diseño de panel para **uñas, spa y salón** (antes cada categoría tenía su propia paleta y fuente). **Barbería y tattoo no cambian**: conservan navegación, estilos y comportamiento (verificado con la cuenta Casa Magna, barbería: panel original con la nueva build).

Referencias: `diseño dashboard negocio/` (Agenda, Equipo y Servicios, Finanzas, Marketing, Mi negocio, resumen) y la imagen de barra lateral flotante.

## B. Cambios visuales
- **Sistema de diseño** (`src/styles/panel-suave.css`): fondo neutro con matiz lavanda, tarjetas blancas con sombra suave, radios 24 px / píldoras, Plus Jakarta Sans como única tipografía, lila solo como acento y colores con función (`--pn-green/orange/blue/amber/rose/violet`, contraste AA verificado en claro y oscuro).
- **Escritorio**: barra lateral oscura flotante, compacta (solo iconos, tooltip/submenú al pasar el cursor o enfocar), con botón sutil que la expande y muestra nombres con **acordeón** por categoría. "Dinero" pasa a **Finanzas** (solo en esta navegación). Banner de categoría + píldoras de módulos hermanos.
- **Móvil**: no usa la barra de escritorio. Cabecera ligera, **barra inferior flotante** (Inicio, Agenda, Clientes, Finanzas, Más) y **hoja inferior "Más"** con todos los módulos en acordeón. Sin scroll horizontal.
- **Resumen** (`resumen-suave.tsx`): bienvenida, 4 indicadores con color por función, reservas de hoy, semana actual, próximas citas, lealtad, acciones rápidas. Solo datos reales; sin datos, estados vacíos.
- **Modo oscuro**: paleta propia (no invertida), píldoras activas legibles.
- **Agenda**: vistas Día / Semana (calendario) / Mes completo (ver commit 6805551).

## C. Cambios técnicos
- `src/app/panel/layout.tsx`: pone `data-panel="suave"` si la categoría del negocio es spa/salón/uñas y provee `PanelSuaveProvider` (`components/panel/panel-estilo.tsx`).
- `components/panel/panel-nav.tsx`: `PanelNav` delega en `PanelNavSuave` o `PanelNavClasica` (la original, intacta).
- `components/panel/panel-nav-suave.tsx`, `resumen-suave.tsx`: nuevos. `app/panel/page.tsx` elige `ResumenSuave` o `ResumenBarberia`.
- `globals.css` y `temas-suaves.css`: las clases `pn-*` quedan fuera de la regla global de esquinas (sin `!important`). Se eliminó la regla que cuadraba la barra lateral (ya no aplica).
- `layout.tsx`: fuente `Plus_Jakarta_Sans` con `preload: false`. Sin dependencias nuevas.

## D. Módulos
Todas las rutas del menú (Resumen, Agenda, Clientes, Caja, Inventario, Staff, Solicitudes, Servicios, Sedes, Promociones, Publicidad, Lealtad, WhatsApp, IA, Cobros, Libro, Wallet, Reportes, Anticipo y cancelaciones, Mi Plan, Perfil público, Mi Marca, Verificación, Auditoría, Soporte) cargan con el nuevo sistema y sin desbordamiento horizontal a 320 y 393 px. **Rediseño específico (composición propia)**: navegación, Resumen, banners de categoría. **Restyle por tokens** (colores, radios, sombras, tipografía, estados): el resto de pantallas.

## E. Pruebas ejecutadas
- `tsc --noEmit`, `eslint` (archivos tocados), `vitest` (314 pasan, 26 omitidas), `next build`.
- Capturas en PC, tableta y móvil, claro y oscuro, con una cuenta real de salón; sin desbordamiento horizontal en 25 rutas a 320/393 px.
- Regresión de barbería: panel original intacto con la nueva build. **Tattoo**: usa la misma ruta que barbería (`verticalDeCategorias` devuelve null para ambas); no se probó con una cuenta de tattoo real.

## F. Problemas encontrados
| Problema | Causa | Solución |
|---|---|---|
| Esquinas cuadradas en la barra y tarjetas | regla global `*{border-radius:0}` | excluir `[class*="pn-"]` |
| Arco enorme en el velo de la hoja móvil | botón con radio de control | clase `pn-scrim` |
| Texto de píldoras activas ilegible en oscuro | `--ink` oscuro sobre fondo oscuro | `bg-text / text-bg` |
| Estados con contraste <4.5 | verdes/naranjas claros | tonos más oscuros, verificado |

## G. Decisiones autónomas
- Un único acento lila + colores semánticos; botón primario sigue lila suave (la tabla de componentes lo usa en todo el sistema).
- Barra expandida como superposición (no empuja el contenido) para evitar saltos de layout.
- Sin buscador ni notificaciones en la cabecera: no existen como funciones; no se simularon.
- Pestañas de módulos hermanos solo en escritorio; en móvil se navega con la hoja "Más".

## H. Pendientes reales
- Pantallas internas con datos (CRM, Caja, Inventario, Wallet, Libro, Agenda con equipo, gráficas) no se pudieron ver con datos reales: la cuenta de prueba no tiene equipo, servicios ni movimientos. Pueden requerir ajustes finos de composición.
- Composición propia (tarjetas con ilustración, gráficas de las referencias) solo para el Resumen; el resto usa los componentes existentes restilizados.
- La app Staff (`/staff`) no forma parte del panel de gestión y conserva su diseño.

## I. Producción
- Rama `main`, commits `fd9ae08` y `2760414`; Vercel: success en ambos.
- Verificado en https://app.stylernow.com con una cuenta real de salón (Burica): Resumen, Finanzas (banner + píldoras) y Agenda cargan con el diseño nuevo en PC y móvil, barra lateral compacta, barra inferior flotante, sin desbordamiento horizontal.
- Sin verificar en producción: modo oscuro (probado en local), hoja "Más" (probada en local) y cuentas de barbería/tattoo (barbería probada en local).
- Estado: **PARCIALMENTE COMPLETADO** — navegación, sistema de diseño y Resumen terminados y desplegados; el resto de pantallas tiene el estilo nuevo por tokens pero falta revisarlas con datos reales.
