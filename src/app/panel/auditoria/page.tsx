import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { listarAuditoriaNegocio } from "./actions";
import { VistaAuditoria } from "./vista-auditoria";

export const metadata = { title: "Auditoría" };

export default async function AuditoriaPage() {
  // 04-Data-Model/04_Audit.md: "Una Barbería ve el log de auditoría de su
  // propio Negocio" — no dice Guardian ni Staff. La RLS (auditoria_select_
  // negocio) ya solo permite is_barberia_de(), así que Guardian/Staff nunca
  // verían filas igual, pero se corta acá también para no mostrar una
  // pantalla vacía sin explicación.
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/auditoria");

  const res = await listarAuditoriaNegocio();

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaAuditoria eventosIniciales={res.ok ? res.data : []} errorInicial={res.ok ? null : res.error} />
    </div>
  );
}
