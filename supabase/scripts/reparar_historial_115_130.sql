-- Regularización del historial de migraciones 115–130 en producción. NO es una migración.
-- NO ejecuta ninguna migración: solo las registra como aplicadas (equivale a
-- `supabase migration repair --status applied 115 … 130`).
--
-- Evidencia (2026-11-14, ver docs/ESTADO_MIGRACIONES.md):
--   * Huellas de esquema local (construido desde los archivos 001–130) = producción en columnas,
--     enums, índices, políticas, restricciones, RLS por tabla, triggers y vistas.
--   * Funciones: iguales salvo comentarios. Solo 2 funciones de la 086 difieren (admin_set_pais,
--     admin_set_plan_precio) y no pertenecen a 115–130.
--   * Permisos de ejecución para anon, authenticated y public: idénticos.
--   * Datos sembrados (paquetes de WhatsApp, 138 plantillas de notificación): idénticos.
--   * 115 aplicada pero su candado no publicó TERMINOS v3 (diseño; queda para el bloque legal).
--
-- Uso: SQL Editor de Supabase con el rol postgres, solo con autorización del propietario.

begin;

insert into supabase_migrations.schema_migrations (version, name, statements)
values
  ('115', 'terminos_v3_clientes_y_negocios', null),
  ('116', 'cancelacion_aceptacion_y_reembolsos', null),
  ('117', 'comision_cero_y_libro_inmutable', null),
  ('118', 'prueba_con_o_sin_tarjeta', null),
  ('119', 'cobro_directo_conexion_negocio', null),
  ('120', 'whatsapp_modulo', null),
  ('121', 'politica_datos_v2', null),
  ('122', 'libro_financiero', null),
  ('123', 'auditoria_completa', null),
  ('124', 'notificaciones_outbox', null),
  ('125', 'indices_y_endurecimiento', null),
  ('126', 'endurecer_comparaciones_null', null),
  ('127', 'registro_pendiente', null),
  ('128', 'registro_con_telefono', null),
  ('129', 'motor_anticipos_y_entorno', null),
  ('130', 'webhook_trazabilidad_y_disputas', null)
on conflict (version) do nothing;

-- Verificación: deben quedar exactamente 16 filas nuevas entre 115 y 130.
do $$
declare n int;
begin
  select count(*) into n from supabase_migrations.schema_migrations where version between '115' and '130' and length(version) = 3;
  if n <> 16 then raise exception 'Se esperaban 16 registros 115–130 y hay %', n; end if;
end $$;

commit;
