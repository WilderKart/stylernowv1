-- 189 · POS blindado: solo el día de la cita, cantidades válidas y stock nunca negativo (auditoría P1-2 y P1-3).
--
-- 1) completar_venta_pos() aceptaba CONFIRMADA de cualquier fecha: saltaba la regla de 188 (check-in solo el día) y disparaba
--    inventario, eventos de venta y fidelidad de forma anticipada. Ahora aplica el mismo guard que completar_reserva_sin_pos.
-- 2) Las cantidades de productos no se validaban: una cantidad negativa SUMABA stock sin ENTRADA y una grande dejaba stock negativo.
--    Ahora: cantidad entera > 0, fila de stock bloqueada (FOR UPDATE) y disponibilidad suficiente (STOCK_INSUFICIENTE).
--    El consumo automático por servicio nunca bloquea la venta: descuenta hasta 0 (no deja negativos).
-- 3) CHECK (stock_actual >= 0) como red de seguridad. NOT VALID: protege toda escritura nueva sin reescribir ni rechazar
--    filas históricas que pudieran estar en negativo (se validará cuando se regularicen).
-- Se parchea la definición vigente con anclas exactas (mismo patrón que 188): si una ancla no existe, la migración FALLA en vez
-- de dejar la función a medias. Idempotente.

do $$
declare
  v_def text;
  v_sig constant regprocedure := 'public.completar_venta_pos(uuid,jsonb,text,numeric,text,integer)'::regprocedure;
  v_a1 constant text := E'if v_reserva.estado not in (''CONFIRMADA'', ''EN_CURSO'') then\n    raise exception ''RESERVA_NO_COMPLETABLE'';\n  end if;';
  v_a2 constant text := E'raise exception ''PRODUCTO_NO_DISPONIBLE'';\n    end if;\n    insert into public.venta_producto';
  v_a3 constant text := E'    update public.producto_stock\n    set stock_actual = stock_actual - (v_item ->> ''cantidad'')::int';
  v_a4 constant text := E'    set stock_actual = stock_actual - v_consumo.cantidad';
  v_a5 constant text := E'v_resultado_pipeline jsonb;\nbegin';
begin
  v_def := pg_get_functiondef(v_sig);
  if position('CANTIDAD_INVALIDA' in v_def) > 0 then return; end if;  -- ya migrada
  if position(v_a1 in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA a1'; end if;
  if position(v_a2 in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA a2'; end if;
  if position(v_a3 in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA a3'; end if;
  if position(v_a4 in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA a4'; end if;
  if position(v_a5 in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA a5'; end if;

  v_def := replace(v_def, v_a5, E'v_resultado_pipeline jsonb;\n  v_stock_disp int;\nbegin');
  v_def := replace(v_def, v_a1, v_a1
    || E'\n  if v_reserva.estado = ''CONFIRMADA'' and not coalesce(public.is_supersu(), false) and not public._reserva_es_hoy(p_reserva_id) then\n'
    || E'    raise exception ''CHECKIN_SOLO_EL_DIA_DE_LA_CITA'';\n  end if;');
  v_def := replace(v_def, v_a2, E'raise exception ''PRODUCTO_NO_DISPONIBLE'';\n    end if;\n'
    || E'    if (v_item ->> ''cantidad'') is null or (v_item ->> ''cantidad'') !~ ''^[0-9]{1,5}$'' or (v_item ->> ''cantidad'')::int <= 0 then\n'
    || E'      raise exception ''CANTIDAD_INVALIDA'';\n    end if;\n    insert into public.venta_producto');
  v_def := replace(v_def, v_a3,
       E'    select stock_actual into v_stock_disp from public.producto_stock\n'
    || E'      where producto_id = v_producto.id and sede_id = v_reserva.sede_id for update;\n'
    || E'    if coalesce(v_stock_disp, 0) < (v_item ->> ''cantidad'')::int then\n      raise exception ''STOCK_INSUFICIENTE'';\n    end if;\n'
    || v_a3);
  v_def := replace(v_def, v_a4, E'    set stock_actual = greatest(stock_actual - v_consumo.cantidad, 0)');
  execute v_def;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producto_stock_no_negativo' and conrelid = 'public.producto_stock'::regclass) then
    alter table public.producto_stock add constraint producto_stock_no_negativo check (stock_actual >= 0) not valid;
  end if;
end $$;
