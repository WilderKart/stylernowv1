# Onboarding v2, límites de plan y verificación — informe (2026-11-17)

Worktree `C:\Users\karni\Documents\stylernow-onboarding`, rama `feat/onboarding-v2`, base `6901871`. Sin commits, sin push, sin despliegue, sin migraciones remotas. Solo base local.

## Auditoría de planes (hallazgos)
- Solo Essential tenía tope de Staff (2, heredado de Raven). Studio, Prestige y Signature no tenían ninguno.
- `promover_guardian` ignoraba `guardian_disponible`. `crear_invitacion_staff` aceptaba comisión en planes sin `comisiones_turnos`.
- Solo membresías, fidelización y My Look se bloqueaban en el servidor. DIAN, formularios, reservas de grupo y recepcionista IA no existen en el código: no hay nada que bloquear todavía.
- `docs/PLANES_CORREGIDOS_v3.md` §3 dice que en Essential el barbero adicional es «subir de plan». La base tenía precio de extra 20.000 y tope 2 para Essential: contradicción corregida a favor del documento.
- Nadie cobra el «barbero adicional» de Studio/Prestige ni permite comprarlo.

## Cambios
- 149: tope de Staff = incluido en los 4 planes; bloqueo de guardián y de comisiones por plan; `cupo_plan_negocio` para los mensajes. Aviso «actualiza a Studio (hasta 5)» en invitar Staff.
- 150: fotografía de fachada, cierre idempotente del alta sin servicios, modelo de verificación (7 estados, historial inmutable, documentos privados), insignia pública.
- Onboarding de 4 pasos (Datos, Ubicación y horarios con mapa, Plan, Activar prueba), pantalla «¡Tu negocio está listo!», asistente de bienvenida en el panel, `/panel/perfil-publico`, `/panel/verificacion`, `/admin/verificaciones`.
- Cloudinary: adaptador + documentos privados leídos solo a través de `/api/verificacion/documento/[id]` (autoriza cada lectura y la audita).

## Pruebas ejecutadas
| Prueba | Resultado |
|---|---|
| `tests/sql/limites_plan_156.sql` | pasa |
| `tests/sql/onboarding_verificacion_157.sql` | pasa |
| Suites previas (aislamiento, seguridad_regresion, auditoria_123, libro, 127, 128, 129, 130, 131, 135, whatsapp, cobro_directo) | pasan |
| `tsc`, `eslint` (0 errores), `vitest` 127, `next build` | pasan |
| Navegador local (build de producción, Cloudinary simulado): alta completa, validación de ciudad, plan, prueba, panel, límite de Staff, verificación, CRM, 404 al documento ajeno, 401 sin sesión, 403 con origen ajeno | pasan |

## No ejecutado o pendiente (no se declara aprobado)
- Vistas 390×844, 393×852, 768×1024 y 1440×900: la ventana del navegador no cambió el viewport. Solo se vio escritorio.
- Cloudinary real (la subida real no se probó; se usó un simulador local fuera del repositorio).
- Playwright: se usó Chrome por automatización, no Playwright.
- Método de pago con tarjeta en el paso 4: no existe captura de tarjeta en esta base; la opción B es informativa.
- Fotografías adicionales del perfil público: no existe tabla de galería.
- Suites de las migraciones 139 a 144 en rojo localmente porque esas migraciones no están aplicadas en la base local.

## Decisiones del propietario
1. Tope de Staff = incluido (Studio 5, Prestige 15, Signature 50) mientras no exista el cobro del extra. ¿Se mantiene?
2. ¿El propietario de Essential cuenta como el único barbero? Hoy no cuenta: puede invitar a 1.
3. Aprobación (publicar) y verificación (distintivo) siguen separadas; el panel muestra «En revisión» aunque el alta diga «listo».
4. El paso 4 pide documento o NIT por el antiabuso de la prueba (migración 135), aunque el brief pide pocos datos.
5. Fundador dice «3 meses» en la base; el documento v3 dice 6.
6. Producción: ver informe de evidencias (145 a 148 también sin aplicar). Orden: respaldo, 145 a 150, luego código, con Cloudinary configurado antes.
