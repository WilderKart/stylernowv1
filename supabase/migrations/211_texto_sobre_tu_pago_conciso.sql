-- 211 — Texto conciso de «Sobre tu pago» (antes «Información importante»).
-- La pantalla muestra el texto en frases cortas; la base guarda como evidencia EXACTAMENTE lo que el cliente ve y acepta.
-- Mismo significado que en la 210: el dinero va al negocio, StylerNow no lo custodia ni valida ni reembolsa, y cualquier devolución se gestiona con el negocio.
-- Debe ser idéntico a PUNTOS_SOBRE_TU_PAGO.join(" ") en src/lib/pagos-directos/aviso.ts (lo comprueba tests/pagos-directos.test.ts).
-- Las aceptaciones ya guardadas conservan su texto y su md5 originales (la tabla es inmutable).
create or replace function public.texto_info_pago_directo()
returns text language sql immutable set search_path = public as $$
  select 'El pago va directo a la cuenta del negocio. '
      || 'StylerNow solo facilita la reserva: no custodia ni valida transferencias. '
      || 'StylerNow no reembolsa ese dinero: cualquier devolución o acuerdo lo gestionas directamente con la barbería.';
$$;
revoke all on function public.texto_info_pago_directo() from public, anon, authenticated;
grant execute on function public.texto_info_pago_directo() to authenticated, service_role;
