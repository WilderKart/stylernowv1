import { obtenerResumenAdminWhatsApp } from "./actions";
import { VistaAdminWhatsApp } from "./vista-admin-whatsapp";

export const metadata = { title: "WhatsApp" };

// Protegida por src/app/admin/layout.tsx (requireSuperSU); las RPC vuelven a exigir is_supersu().
export default async function AdminWhatsAppPage() {
  const resumen = await obtenerResumenAdminWhatsApp();
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-6 text-[22px] font-bold uppercase text-text">WhatsApp</h1>
      <VistaAdminWhatsApp resumen={resumen.ok ? resumen.data : null} errorInicial={resumen.ok ? null : resumen.error} />
    </main>
  );
}
