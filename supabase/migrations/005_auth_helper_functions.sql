-- StylerNow — Migración 005: funciones auxiliares de autorización
-- Fuente: 06-Security/02_RLS.md — "Principio general (corregido, ver ADL-009)"
--
-- Estas funciones son la única fuente de verdad de "quién soy y qué alcance tengo"
-- para las políticas RLS de la migración 006. Ninguna política RLS debe repetir esta
-- lógica inline — todas llaman a estas funciones.

-- ¿Es SuperSU? (👑 acceso total)
create or replace function public.is_supersu()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select es_supersu from public.perfil where id = auth.uid()), false);
$$;

-- ¿Es la cuenta Barbería (owner) de este negocio? (🌐)
create or replace function public.is_barberia_de(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.negocio
    where id = p_negocio_id and owner_user_id = auth.uid()
  );
$$;

-- El vínculo Staff activo (no RETIRADO) del usuario actual, si existe.
create or replace function public.mi_vinculo()
returns public.vinculo_staff_negocio
language sql stable security definer set search_path = public as $$
  select * from public.vinculo_staff_negocio
  where staff_id = auth.uid() and estado <> 'RETIRADO'
  limit 1;
$$;

-- ¿Es Staff (cualquier perfil) de este negocio?
create or replace function public.is_staff_de(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.vinculo_staff_negocio
    where staff_id = auth.uid() and negocio_id = p_negocio_id and estado = 'ACTIVO'
  );
$$;

-- ¿Es Guardian de esta sede específica? (🏢 — requiere es_guardian = true Y sede_activa_id = p_sede_id)
create or replace function public.is_guardian_de_sede(p_sede_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.vinculo_staff_negocio
    where staff_id = auth.uid() and estado = 'ACTIVO'
      and es_guardian = true and sede_activa_id = p_sede_id
  );
$$;

-- ¿Es Guardian en algún lugar de este negocio? (para vistas agregadas a nivel negocio, alcance real sigue siendo su sede)
create or replace function public.is_guardian_de_negocio(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.vinculo_staff_negocio
    where staff_id = auth.uid() and negocio_id = p_negocio_id
      and estado = 'ACTIVO' and es_guardian = true
  );
$$;

-- Alcance combinado Barbería∪Guardian∪Staff sobre un negocio (para lecturas donde
-- los 3 roles internos ven "algo" del negocio, aunque con columnas/filas distintas
-- resueltas por políticas más específicas).
create or replace function public.tiene_acceso_interno(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_barberia_de(p_negocio_id) or public.is_staff_de(p_negocio_id);
$$;

comment on function public.is_supersu is 'RLS: alcance 👑 — Bible 03-Business-Rules/01_Roles.md';
comment on function public.is_barberia_de is 'RLS: alcance 🌐 business_id = current_business_id()';
comment on function public.is_guardian_de_sede is 'RLS: alcance 🏢 branch_id = current_sede_activa(), solo si es_guardian';
