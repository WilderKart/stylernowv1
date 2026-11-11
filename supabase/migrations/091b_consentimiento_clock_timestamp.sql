-- clock_timestamp: orden estable de eventos dentro de una misma transaccion
alter table public.consentimiento_evento alter column created_at set default clock_timestamp();
