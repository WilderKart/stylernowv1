import { BarraSuperior } from "@/components/layout/header";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { redirect } from "next/navigation";
import { obtenerCierreCaja } from "../actions";
import { VistaCierreCaja } from "./vista-cierre-caja";

export const metadata = { title: "Cierre de caja" };

export default async function CierreCajaPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/pos/caja");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  if (contexto.rol === "STAFF") redirect("/panel");

  const negocioId = contexto.negocioId!;
  const sedeId = contexto.rol === "GUARDIAN" ? contexto.sedeId : null;
  const res = await obtenerCierreCaja(negocioId, sedeId);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo="Cierre de caja" volverA="/panel/pos" />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-10">
        <VistaCierreCaja negocioId={negocioId} sedeId={sedeId} cierreInicial={res.ok ? res.data : null} errorInicial={res.ok ? null : res.error} />
      </main>
    </div>
  );
}
