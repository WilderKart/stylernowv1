# Guía: Mercado Pago en producción

> **No activar sin autorización expresa del dueño.** Solo después de completar las pruebas de sandbox (`docs/INFORME_SANDBOX_MERCADO_PAGO.md`). Nada de lo que describe esta guía está activado hoy.

## 1. Credenciales reales que hay que crear

| Credencial | Dónde se obtiene | Variable en Vercel (Production) |
|---|---|---|
| Access token de **producción** de la cuenta de StylerNow | Mercado Pago → Tus integraciones → app → Credenciales de producción (requiere activarlas) | `MERCADOPAGO_ACCESS_TOKEN` |
| Public key de producción | Mismo lugar | `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` |
| Client ID de la app (modelo Marketplace) | Tus integraciones → app → Detalles de aplicación | `MERCADOPAGO_CLIENT_ID` |
| Client secret de la app | Mismo lugar | `MERCADOPAGO_CLIENT_SECRET` |
| Clave secreta del webhook **de producción** | Tus integraciones → app → Webhooks (modo producción) | `MERCADOPAGO_WEBHOOK_SECRET` |
| Clave de cifrado de tokens, **nueva y exclusiva de producción** | `openssl rand -base64 32` | `PAGOS_CIFRADO_CLAVE` |
| Entorno | — | `MERCADOPAGO_ENTORNO=produccion` (**último paso**) |

**Reglas:**
- Nunca copiar credenciales de prueba a Production.
- Nunca usar credenciales de producción en local ni en Preview.
- La app rechaza `TEST-` en producción y solo acepta `produccion` en el despliegue de producción de Vercel.

## 2. Configuración de la app de Mercado Pago

- Modelo de integración: **Marketplace**.
- **Redirect URL de OAuth:** `https://<dominio-definitivo>/api/pagos/mercadopago/callback`. Debe coincidir exactamente con `NEXT_PUBLIC_SITE_URL` + la ruta.
- Activar PKCE.
- Scopes: `read`, `write`, `offline_access` (este último es necesario para renovar el token).
- **Webhook de producción:** `https://<dominio-definitivo>/api/webhooks/pasarela/mercadopago`, con los eventos **Pagos** y **mp-connect**. Usa una URL distinta de la de pruebas.
- Requisito de Mercado Pago: los vendedores necesitan cuenta verificada (KYC nivel 6).

## 3. Diferencias entre sandbox y producción

| Aspecto | Sandbox | Producción |
|---|---|---|
| `MERCADOPAGO_ENTORNO` | `sandbox` (o vacío) | `produccion` |
| Conexiones de negocios | `entorno = SANDBOX`. No operan en producción. | `entorno = PRODUCCION`. Hay que reconectar con cuentas reales. |
| `live_mode` exigido en cada pago | `false` | `true` |
| Pagos | Marcados `pago.entorno = SANDBOX` en la base y en el libro | `PRODUCCION` |
| Medios para anticipos | Tarjetas y dinero en cuenta | Iguales. PSE/Efecty solo si Mercado Pago confirma por escrito su compatibilidad con Split 1:1. |

## 4. Procedimiento para conectar un negocio real

1. El dueño entra a `/panel/cobros` → "Conectar mi cuenta de Mercado Pago".
2. Autoriza en Mercado Pago con su cuenta de vendedor verificada.
3. El panel debe mostrar "Conectada", sin la etiqueta "Modo de prueba".
4. Desde ese momento sus anticipos se cobran en su cuenta. Si no conecta, sus reservas se confirman sin anticipo.

## 5. Pruebas controladas antes de habilitar a todos

1. Un solo negocio piloto (real, autorizado) y un anticipo de bajo valor.
2. Verificar en el libro (`/admin/libro`):
   - `PAGO_CONFIRMADO` con entorno PRODUCCION;
   - `cuenta_vendedor` = la cuenta del negocio;
   - comisión del proveedor;
   - comisión de StylerNow = 0.
3. Una cancelación con reembolso parcial. Verificar REEMBOLSADO solo tras la confirmación de Mercado Pago.
4. Revisar en la cuenta de Mercado Pago **de StylerNow** que **no** entró dinero del anticipo.
5. Recién entonces, abrir a más negocios.

## 6. Reversión

- Volver a `MERCADOPAGO_ENTORNO=sandbox` (o borrar la variable) y redeploy. Los cobros reales se detienen porque las conexiones de producción no operan en sandbox.
- Sin conexión, las reservas se confirman sin anticipo: no hay cobros a medias.
- Ningún dato se borra. Pagos, reembolsos y libro se conservan.

## 7. Verificaciones de seguridad antes de activar

- [ ] Hotfix y migraciones 114–129 aplicadas en producción. 115 y 121 solo con NIT y revisión legal.
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` de producción configurado. Sin él, el webhook responde 503.
- [ ] `PAGOS_CIFRADO_CLAVE` exclusiva de producción, guardada en un gestor de secretos.
- [ ] `CRON_SECRET` configurado; reembolsos y notificaciones dependen del cron.
- [ ] Confirmación escrita de Mercado Pago sobre PSE y Split 1:1.
- [ ] Revisión de abogado y contador (términos, información exógena).
- [ ] Prueba piloto del punto 5 completada.
