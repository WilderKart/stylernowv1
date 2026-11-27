# Guía SuperSU — acceso de soporte a ganancias

El agente **no** puede abrir las ganancias de un negocio por iniciativa propia.

1. El **propietario** crea una solicitud (motivo ≥ 10 caracteres) en *Ganancias → Permisos y soporte*.
2. El propietario la **autoriza** eligiendo la duración (15 min – 4 h). Queda su identidad y la hora.
3. El agente entra a `/admin/ganancias-soporte`, ve las autorizaciones vigentes y **toma** una (queda a su nombre; nadie más puede tomarla).
4. Ve resumen y registros en **solo lectura**. Cada consulta genera un evento `SOPORTE_LECTURA_*` en la auditoría.
5. El acceso **expira solo**; el propietario o el agente pueden cerrarlo antes. No existe modo de escritura: configurar reglas, liquidar, pagar, ajustar o exportar siguen exigiendo permisos que la sesión de soporte no otorga.
6. Intervenciones excepcionales con escritura **no están implementadas** a propósito (requerirían un mecanismo de autorización adicional).
