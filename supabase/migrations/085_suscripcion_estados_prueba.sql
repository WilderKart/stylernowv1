-- 085 — Estados de suscripción para la prueba de 14 días y el plan obligatorio.
-- ADITIVA. Los valores nuevos de un enum no se pueden usar en la misma transacción
-- que los crea, por eso van en su propia migración; 086 ya los usa.
--   TRIAL          → prueba de 14 días con método de pago registrado (se cobra al terminar).
--   REQUIERE_PLAN  → negocio sin plan vigente: su perfil se ve, pero no recibe reservas.

alter type public.suscripcion_estado add value if not exists 'TRIAL';
alter type public.suscripcion_estado add value if not exists 'REQUIERE_PLAN';
