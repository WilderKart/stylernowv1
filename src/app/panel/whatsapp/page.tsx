import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { obtenerResumenWhatsApp } from "./actions";
import { VistaWhatsApp } from "./vista-whatsapp";

export const metadata = { title: "WhatsApp" };

export default async function WhatsAppPage() {
  // Cuota, recargas y campañas son decisiones de inversión del dueño: Guardian queda fuera (igual que Publicidad).
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/whatsapp");
  const resumen = await obtenerResumenWhatsApp();

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PanelNav rol={contexto.rol} />
      <VistaWhatsApp resumen={resumen.ok ? resumen.data : null} errorInicial={resumen.ok ? null : resumen.error} />
    </div>
  );
}
