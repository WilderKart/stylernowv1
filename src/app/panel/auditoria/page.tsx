import { PanelNav } from "@/components/panel/panel-nav";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { redirect } from "next/navigation";
import { listarAuditoriaNegocio } from "./actions";
import { VistaAuditoria } from "./vista-auditoria";

export const metadata = { title: "Auditoría" };

export default async function AuditoriaPage() {
  const contexto = await resolverContexto();
  if (!contexto.userId) redirect("/login?next=/panel/auditoria");
  if (contexto.rol === "NINGUNO") redirect("/panel/onboarding");
  // 04-Data-Model/04_Audit.md: "Una Barbería ve el log de auditoría de su
  // propio Negocio" — no dice Guardian ni Staff. La RLS (auditoria_select_
  // negocio) ya solo permite is_barberia_de(), así que Guardian/Staff nunca
  // verían filas igual, pero se redirige acá también para no mostrar una
  // pantalla vacía sin explicación.
  if (contexto.rol !== "BARBERIA") redirect("/panel");

  const res = await listarAuditoriaNegocio();

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaAuditoria eventosIniciales={res.ok ? res.data : []} errorInicial={res.ok ? null : res.error} />
    </div>
  );
}
