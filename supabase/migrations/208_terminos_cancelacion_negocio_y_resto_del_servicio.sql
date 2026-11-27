-- 208 · Términos y Condiciones alineados con la migración 207 (cancelación del negocio con mínimo 2 h y devolución con pago completo).
--
-- Publica una versión nueva de TERMINOS (la mayor + 1) a partir de la vigente, reemplazando solo seis fragmentos:
--   1. Definiciones: «Anticipo» pasa a ser la parte retenible por la política; nace «Resto del Servicio».
--   2. Sección 6(c): el Anticipo no reembolsable ya no puede ser «hasta el valor total del Servicio»; se explica el pago completo con ejemplo.
--   3. Sección 6: el derecho al 100 % cubre todo lo pagado (Anticipo y Resto del Servicio) y se agrega la regla de 2 h para el Negocio.
--   4. Responsabilidades del Negocio: cancelar solo con 2 h o más de anticipación.
--   5. Cobros: el Resto del Servicio pagado y no prestado se devuelve al Cliente.
--   6. Terminación: al cerrar o suspender un Negocio se devuelve todo lo pagado, no solo el Anticipo.
--
-- cambio_material = true: la regla de 2 h restringe lo que un Negocio puede hacer y la de devolución cambia los reembolsos del Cliente; por eso
-- cada persona debe aceptar la versión nueva en su próximo ingreso (/legal/aceptar), con constancia de fecha y versión. Si se decide que no es
-- material, cambiar ese valor a false ANTES de aplicar: una vez aplicada, la versión no se edita (se publica otra).
--
-- Aborta sin cambiar nada si el texto vigente no contiene exactamente los fragmentos esperados. Es idempotente: si la vigente ya incluye
-- «Resto del Servicio» no publica otra. Alineada con: src/lib/pagos/devolucion.ts, sena.ts (resumen de política) y la migración 207.

begin;
set local lock_timeout = '5s';

do $publicar$
declare
  v_ult record;
  v_txt text;
  -- (viejo, nuevo) en orden
  v_viejo text[] := array[
    'Anticipo: el pago parcial o total del Servicio que el Cliente hace al reservar. Saldo: lo que falta por pagar del Servicio.',
    'el Anticipo (que puede ser hasta el valor total del Servicio) no es reembolsable y queda para el Negocio por el espacio reservado. Las horas se cuentan hasta la hora de inicio de tu Reserva.',
    'Siempre tienes derecho al reembolso del 100 % del Anticipo cuando:',
    '(c) se hizo un cobro duplicado, errado o que no autorizaste.',
    'de la política de cancelación que publique, que debe ser clara.',
    'El Anticipo que no se reembolsa por cancelación o inasistencia del Cliente corresponde al Negocio.',
    'el reembolso del 100 % de los Anticipos pagados'
  ];
  v_nuevo text[] := array[
    'Anticipo: la parte del valor del Servicio que el Cliente paga al reservar y que la política de cancelación puede retener. Saldo: lo que falta por pagar del Servicio. Resto del Servicio: cuando el Negocio habilita el pago completo desde la app y el Cliente paga el valor total del Servicio, la parte de ese pago que excede el Anticipo.',

    'el Anticipo no es reembolsable y queda para el Negocio por el espacio reservado. Las horas se cuentan hasta la hora de inicio de tu Reserva.' || E'\n\n' ||
    'Si pagaste el valor total del Servicio desde la app, la política de cancelación solo aplica al Anticipo: el Resto del Servicio que pagaste se te devuelve siempre que la cita no se preste, incluso si ya no tienes derecho al reembolso del Anticipo o no te presentas. Ejemplo: Servicio de $30.000 con Anticipo de $10.000. Si cancelas con derecho al 100 %, te devolvemos $30.000. Si te corresponde el 50 % del Anticipo, te devolvemos $25.000 ($20.000 del Resto del Servicio y $5.000 de la mitad del Anticipo; los otros $5.000 quedan para el Negocio). Si ya no tienes derecho al reembolso del Anticipo, te devolvemos $20.000 y el Negocio conserva los $10.000 del Anticipo.',

    'Siempre tienes derecho al reembolso del 100 % de lo que pagaste (el Anticipo y, si pagaste el Servicio completo, también el Resto del Servicio) cuando:',

    '(c) se hizo un cobro duplicado, errado o que no autorizaste.' || E'\n\n' ||
    'El Negocio solo puede cancelar una Reserva con 2 horas o más de anticipación a su hora de inicio; con menos tiempo la Plataforma no le permite cancelarla. Esta regla no limita tu derecho al reembolso total cuando el Negocio no presta el Servicio, y no aplica cuando el Negocio cierra su cuenta o es suspendido.',

    'de la política de cancelación que publique, que debe ser clara. El Negocio solo puede cancelar una Reserva con 2 horas o más de anticipación a su hora de inicio; si no puede atender con menos tiempo, debe contactar de inmediato al Cliente y responde por el reembolso del 100 % de lo que este haya pagado.',

    'El Anticipo que no se reembolsa por cancelación o inasistencia del Cliente corresponde al Negocio; el Resto del Servicio que el Cliente haya pagado y que no llegue a prestarse debe devolverse al Cliente.',

    'el reembolso del 100 % de lo pagado por los Clientes (los Anticipos y, si pagaron el Servicio completo, el Resto del Servicio)'
  ];
  i int;
begin
  select version, contenido into v_ult from public.texto_legal where tipo = 'TERMINOS' order by version desc limit 1;
  if v_ult.version is null then raise exception 'TERMINOS_NO_ENCONTRADOS'; end if;
  if position('Resto del Servicio' in v_ult.contenido) > 0 then return; end if;   -- ya publicada

  v_txt := v_ult.contenido;
  for i in 1 .. array_length(v_viejo, 1) loop
    -- cada fragmento debe existir exactamente una vez; si no, el texto vigente cambió y hay que revisar antes de publicar
    if (length(v_txt) - length(replace(v_txt, v_viejo[i], ''))) <> length(v_viejo[i]) then
      raise exception 'FRAGMENTO_%_INESPERADO: revisar el texto vigente de los Términos antes de publicar', i;
    end if;
    v_txt := replace(v_txt, v_viejo[i], v_nuevo[i]);
  end loop;

  insert into public.texto_legal (tipo, version, contenido, cambio_material)
  values ('TERMINOS', v_ult.version + 1, v_txt, true);
end;
$publicar$;

commit;
