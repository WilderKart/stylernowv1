# Textos de interfaz para consentimiento y avisos de privacidad

Actualización: 2026-11-17. **Sustituye** a la versión anterior, que proponía un banner «al continuar navegando aceptas», casillas que autorizaban IP y datos del dispositivo y el registro de la IP en cada consentimiento: nada de eso se adoptó (el silencio no es conducta inequívoca, Decreto 1074 de 2015, art. 2.2.2.25.2.4; la IP no se guarda en las constancias).

## 1. Cómo funciona hoy (verificado en el código)
- **Registro de clientes y de negocios:** una casilla **no premarcada** («Acepto los Términos y la Política de Tratamiento de Datos»). Mensaje de error: «Debes aceptar los Términos y la Política de Tratamiento de Datos.» (`auth.err_terminos`). Los Términos §1 y la Política §4 describen esa casilla como la aceptación de los Términos **y** la autorización previa, expresa e informada del tratamiento para las finalidades necesarias.
- **Cada reserva:** casilla específica de autorización de datos de esa reserva, con el texto aprobado el 2026-11-16: «Autorizo a StylerNow y a {negocio} a usar mi nombre, celular y correo solo para gestionar esta reserva y avisarme sobre ella, según la Política de Tratamiento de Datos.»
- **Cancelación:** aceptación expresa de la política de cancelación antes de pagar el anticipo (`pago.acepto_politica`).
- **Cookies:** el banner solo activa la analítica si eliges «Aceptar»; rechazarla no desactiva lo estrictamente necesario.
- **Opcionales** (analítica, recomendaciones, ofertas cercanas, marcas aliadas, marketing): se piden por separado y vienen desactivados (Centro de privacidad).

## 2. Mejoras de interfaz recomendadas (NO incluidas en este cambio; requieren tocar componentes)
1. Rótulo de la casilla de registro con el efecto explícito: «Acepto los Términos y Condiciones y autorizo el tratamiento de mis datos personales para las finalidades necesarias descritas en la Política de Tratamiento de Datos.»
2. Valorar **dos casillas separadas** (Términos / autorización de datos): reduce el riesgo de consentimiento «empaquetado».
3. Aviso de privacidad breve en el punto de recolección para visitantes sin cuenta (Decreto 1074 de 2015, art. 2.2.2.25.3.2), en lugar de cualquier texto «al continuar navegando».
4. Micro-copy junto al teléfono del cliente en el panel del negocio: «Solo para gestionar esta cita. Sin publicidad ni mensajes fuera de horario (Ley 1581 y Ley 2300).»
5. Franjas de la Ley 2300 aplicadas **en el servidor** a las campañas de WhatsApp (hoy la regla está en los Términos §11 y §9A, pero no hay control técnico).
6. Enlaces permanentes a «Términos y Condiciones» y «Política de Tratamiento de Datos Personales» en el pie de página.
