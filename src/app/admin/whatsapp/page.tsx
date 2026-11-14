import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { obtenerResumenAdminWhatsApp } from "./actions";
import { VistaAdminWhatsApp } from "./vista-admin-whatsapp";

export const metadata = { title: "WhatsApp" };

// Protegida por src/app/admin/layout.tsx (requireSuperSU); las RPC vuelven a exigir is_supersu().
export default async function AdminWhatsAppPage() {
  const resumen = await obtenerResumenAdminWhatsApp();
  return (
    <main className="w-full max-w-5xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="WhatsApp" titulo="Mensajería" resaltado="WhatsApp." />
      <VistaAdminWhatsApp resumen={resumen.ok ? resumen.data : null} errorInicial={resumen.ok ? null : resumen.error} />
    </main>
  );
}
