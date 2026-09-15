import { obtenerContextoStaff } from "@/lib/auth/require-staff";
import { StaffNav } from "./staff-nav";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
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
