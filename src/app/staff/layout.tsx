import { obtenerContextoStaff } from "@/lib/auth/require-staff";
import { StaffNav } from "./staff-nav";
import { Suspense } from "react";
import CargandoStaff from "./loading";

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
          Todavía no tenés un vínculo activo con ningún negocio en StylerNow. Si te invitaron, revisá tu correo — si
          creés que esto es un error, contactá al negocio directamente.
        </p>
      </div>
    );
  }

  if (contexto.estadoVinculo === "SUSPENDIDO") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
        <h1 className="font-display mb-2 text-[18px] font-bold uppercase text-danger">Acceso suspendido</h1>
        <p className="max-w-sm text-[13px] text-text-muted">
          Tu vínculo con {contexto.negocioNombre} está suspendido temporalmente. Contactá al negocio para más
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
          {contexto.negocioNombre} te invitó, pero todavía no aceptaste la invitación. Buscá el correo de invitación
          para confirmar tu ingreso.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
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
