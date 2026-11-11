-- H1 (QA): el consentimiento de marketing nunca puede ser verdadero por defecto (debe ser opt-in explicito).
-- Solo afecta a perfiles nuevos. Pendiente de aprobacion: poner en false los perfiles existentes sin evento de consentimiento.
alter table public.perfil alter column consentimiento_marketing set default false;
