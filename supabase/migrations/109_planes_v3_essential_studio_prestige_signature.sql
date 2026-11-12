-- Planes v3 (docs/PLANES_CORREGIDOS_v3.md, decision 2026-11-11):
-- RAVEN -> ESSENTIAL, JARL -> STUDIO, VALHALLA -> PRESTIGE, ALLFATHER -> SIGNATURE.
-- PENDIENTE DE APLICAR por Wilder, JUNTO con el despliegue del codigo de esta rama (el codigo ya usa los nombres nuevos).
-- Renombrar valores de un enum conserva todos los datos y claves foraneas (plan, plan_precio, plan_caracteristica,
-- plan_funcion_ia, suscripcion, suscripcion_fundador, negocio.plan_codigo y su default).

alter type public.plan_codigo rename value 'RAVEN' to 'ESSENTIAL';
alter type public.plan_codigo rename value 'JARL' to 'STUDIO';
alter type public.plan_codigo rename value 'VALHALLA' to 'PRESTIGE';
alter type public.plan_codigo rename value 'ALLFATHER' to 'SIGNATURE';

-- Las funciones que comparan contra el texto del plan (se resuelve en ejecucion) se reescriben con los nombres nuevos.
do $$
declare f oid; v_def text; v_nuevo text;
begin
  for f in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.prosrc ~ '(RAVEN|JARL|VALHALLA|ALLFATHER)'
  loop
    v_def := pg_get_functiondef(f);
    v_nuevo := replace(replace(replace(replace(v_def, 'ALLFATHER', 'SIGNATURE'), 'VALHALLA', 'PRESTIGE'), 'JARL', 'STUDIO'), 'RAVEN', 'ESSENTIAL');
    execute v_nuevo;
  end loop;
end $$;

-- Nombres y limites (barberos 1/5/15/50, sedes 1/2/5/15, mensajes de WhatsApp 150/400/1.000/2.500).
update public.plan set nombre = 'Essential', limite_sedes = 1,  staff_incluido = 1,  conversaciones_whatsapp_mes = 150,  precio_mensual = 69900,  updated_at = now() where codigo = 'ESSENTIAL';
update public.plan set nombre = 'Studio',    limite_sedes = 2,  staff_incluido = 5,  conversaciones_whatsapp_mes = 400,  precio_mensual = 139900, updated_at = now() where codigo = 'STUDIO';
update public.plan set nombre = 'Prestige',  limite_sedes = 5,  staff_incluido = 15, conversaciones_whatsapp_mes = 1000, precio_mensual = 279900, updated_at = now() where codigo = 'PRESTIGE';
-- Signature se cotiza: plan.precio_mensual sigue en null (las funciones de upgrade/prueba lo rechazan; solo ventas).
update public.plan set nombre = 'Signature', limite_sedes = 15, staff_incluido = 50, conversaciones_whatsapp_mes = 2500, updated_at = now() where codigo = 'SIGNATURE';

-- Precios de lista para Colombia. Signature: "desde 599.000" (nunca precio cerrado; la app lleva a ventas).
update public.plan_precio set precio_mensual = 69900,  updated_at = now() where plan_codigo = 'ESSENTIAL' and pais_codigo = 'CO';
update public.plan_precio set precio_mensual = 139900, updated_at = now() where plan_codigo = 'STUDIO'    and pais_codigo = 'CO';
update public.plan_precio set precio_mensual = 279900, updated_at = now() where plan_codigo = 'PRESTIGE'  and pais_codigo = 'CO';
update public.plan_precio set precio_mensual = 599000, es_desde = true, updated_at = now() where plan_codigo = 'SIGNATURE' and pais_codigo = 'CO';

-- Se retira la marca de agua de todos los planes.
delete from public.plan_caracteristica where clave = 'camara_antes_despues';

-- Matriz de funciones (habilitado, valor). Upsert: no duplica ni rompe las claves existentes.
-- Cada celda es "habilitado|valor". Orden de columnas: ESSENTIAL, STUDIO, PRESTIGE, SIGNATURE.
with matriz(clave, essential, studio, prestige, signature) as (values
  ('inventario',             'true|basico',   'true|completo', 'true|completo',  'true|completo'),
  ('fila_virtual',           'true|',         'true|',         'true|',          'true|'),
  ('migracion_datos',        'true|estandar', 'true|estandar', 'true|asistida',  'true|asistida_acompanada'),
  ('membresias',             'false|',        'true|basicas',  'true|avanzadas', 'true|avanzadas'),
  ('politica_cancelacion',   'true|',         'true|',         'true|',          'true|'),
  ('caja_menor',             'true|',         'true|',         'true|',          'true|'),
  ('push_nativo',            'true|',         'true|',         'true|',          'true|'),
  ('datafono',               'true|',         'true|',         'true|',          'true|'),
  ('perfil_profesional',     'true|',         'true|',         'true|',          'true|'),
  ('enlace_reserva',         'true|',         'true|',         'true|',          'true|'),
  ('resenas_automaticas',    'true|',         'true|',         'true|',          'true|'),
  ('whatsapp_marketing',     'true|',         'true|',         'true|',          'true|'),
  ('exportar_csv',           'true|',         'true|',         'true|',          'true|'),
  ('formularios_consulta',   'false|',        'true|',         'true|',          'true|'),
  ('facturacion_dian',       'false|',        'true|',         'true|',          'true|'),
  ('reservas_grupo_recursos','false|',        'false|',        'true|',          'true|'),
  ('recepcionista_ia',       'false|',        'false|',        'true|',          'true|')
),
filas as (
  select 'ESSENTIAL'::public.plan_codigo as plan_codigo, clave, essential as celda from matriz
  union all select 'STUDIO',    clave, studio    from matriz
  union all select 'PRESTIGE',  clave, prestige  from matriz
  union all select 'SIGNATURE', clave, signature from matriz
)
insert into public.plan_caracteristica (plan_codigo, clave, habilitado, valor)
select plan_codigo, clave, split_part(celda, '|', 1)::boolean, nullif(split_part(celda, '|', 2), '') from filas
on conflict (plan_codigo, clave) do update
  set habilitado = excluded.habilitado, valor = excluded.valor, updated_at = now();

-- Anuncios en el marketplace: visibilidad pagada opcional disponible en todos los planes como extra (PLANES v3, 2.5).
update public.plan set marketplace_ads_disponible = true, updated_at = now() where codigo = 'ESSENTIAL';
