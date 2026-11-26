# Matriz de permisos (implementada en base de datos)

Roles reales del sistema: propietario (`BUSINESS_OWNER`, deriva de `negocio.owner_user_id`), administrador (`BUSINESS_ADMIN`/`ADMIN_BARBER`, `es_admin`), guardián (`es_guardian`, ligado a sede), profesional (`BARBER`), SuperSU (`perfil.es_supersu`). No se inventó ningún rol: las capacidades financieras viven en `ganancia_permiso` y se conceden por persona y, opcionalmente, por sede.

| Acción | Propietario | Admin / guardián / otro con permiso | Profesional | SuperSU |
|---|---|---|---|---|
| Ver ganancias | todo el negocio | según `ver` (sede o negocio) | **solo las suyas** | solo con sesión de soporte autorizada |
| Ver participación del negocio | sí | sí si `ver` | no | solo lectura con sesión |
| Configurar reglas | sí | `configurar` (negocio completo) | no | no |
| Cerrar liquidación / ajustar / revertir | sí | `liquidar` (la de sede solo en su sede) | no | no |
| Registrar / anular pagos | sí | `pagar` | no | no |
| Exportar | sí | `exportar` | no | no |
| Novedades y revisiones | sí | `novedades` | solo **crear** su solicitud | no |
| Conceder permisos | sí | no | no | no |
| Pedir / autorizar soporte | sí | no | no | solo **tomar** lo autorizado |

Reglas de alcance: un permiso **de sede** (`sede_id` no nulo) no sirve para operaciones de negocio completo (configurar reglas, liquidar sin sede). Quien no es propietario necesita vínculo ACTIVO además del permiso. Un permiso se pierde al retirar o suspender el vínculo.
