import { obtenerContextoStaff } from "@/lib/auth/require-staff";
import { StaffNav } from "./staff-nav";
import { Suspense } from "react";
import Link from "next/link";
import CargandoStaff from "./loading";
import { BannerSuscripcion } from "@/components/panel/banner-suscripcion";
import { obtenerEstadoOperativo } from "@/lib/suscripcion/estado-operativo";

/**
 * El guard (`await obtenerContextoStaff()`) vive en un componente propio
 * envuelto en un `<Suspense>` local — NO directo en `StaffLayout` — porque
 * `loading.tsx` de un segmento nunca envuelve el `layout.tsx` de ese mismo
 * segmento (ver node_modules/next/dist/docs/.../loading.md). Sin este
 * boundary local, la Suspense boundary que atrapa este guard async es la de
 * `src/app/loading.tsx` (el skeleton del Marketplace).
 */
async function StaffGuardado({ children }: { children: React.ReactNode }) {
  const contexto = await obtenerContextoStaff();

  if (!contexto) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
        <h1 className="font-display mb-2 text-[18px] font-bold uppercase text-text">Sin vínculos activos</h1>
        <p className="max-w-sm text-[13px] text-text-muted">
          Todavía no tienes un vínculo activo con ningún negocio en StylerNow. Si te invitaron, revisa tu correo — si
          crees que esto es un error, contacta al negocio directamente.
        </p>
      </div>
    );
  }

  if (contexto.estadoVinculo === "SUSPENDIDO") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
        <h1 className="font-display mb-2 text-[18px] font-bold uppercase text-danger">Acceso suspendido</h1>
        <p className="max-w-sm text-[13px] text-text-muted">
          Tu vínculo con {contexto.negocioNombre} está suspendido temporalmente. Contacta al negocio para más
          información.
        </p>
      </div>
    );
  }

  if (contexto.estadoVinculo === "INVITADO") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
        <h1 className="font-display mb-2 text-[18px] font-bold uppercase text-text">Invitación pendiente</h1>
        <p className="max-w-sm text-[13px] text-text-muted">
          {contexto.negocioNombre} te invitó, pero todavía no aceptaste la invitación. Busca el correo de invitación
          para confirmar tu ingreso.
        </p>
      </div>
    );
  }

  // Administrador sin perfil profesional (BUSINESS_ADMIN): no atiende clientes, así que no hay agenda que mostrar.
  if (!contexto.prestaServicios) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
        <h1 className="font-display mb-2 text-[18px] font-bold uppercase text-text">Tu rol es administrativo</h1>
        <p className="max-w-sm text-[13px] text-text-muted">
          En {contexto.negocioNombre} administras el equipo pero no atiendes clientes, así que no tienes agenda propia. Si
          quieres atender, pídele al propietario que te asigne el rol de administrador y profesional.
        </p>
        <Link
          href="/panel/staff"
          className="mt-4 inline-block bg-accent px-4 py-2.5 text-[12.5px] font-bold uppercase text-ink hover:bg-accent-hover"
        >
          IR AL EQUIPO
        </Link>
      </div>
    );
  }

  // FASE 2B: el profesional ve el aviso (no puede pagar) y sigue cumpliendo sus citas confirmadas; la base decide qué más se bloquea.
  const estadoOperativo = await obtenerEstadoOperativo(contexto.negocioId);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BannerSuscripcion estado={estadoOperativo} puedePagar={false} />
      <StaffNav negocioNombre={contexto.negocioNombre} esGuardian={contexto.esGuardian} />
      {children}
    </div>
  );
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<CargandoStaff />}>
      <StaffGuardado>{children}</StaffGuardado>
    </Suspense>
  );
}
