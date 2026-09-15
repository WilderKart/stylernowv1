import { BarraSuperior } from "@/components/layout/header";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { redirect } from "next/navigation";
import { FormularioNuevoServicio } from "./formulario-nuevo-servicio";

export const metadata = { title: "Nuevo servicio" };

export default async function NuevoServicioPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/servicios/nuevo");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  // Crear servicio es exclusivo de Barbería (03-Business-Rules/01_Roles.md).
  if (!contexto.permisos.crearServicio) redirect("/panel/servicios");

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Nuevo servicio" volverA="/panel/servicios" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        <FormularioNuevoServicio negocioId={contexto.negocioId!} />
      </main>
    </div>
  );
}
