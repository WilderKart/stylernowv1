import type { Metadata } from "next";
import { VistaSeguimiento } from "./vista-seguimiento";

export const metadata: Metadata = {
  title: "Seguimiento de tu solicitud",
  // El enlace personal lleva un secreto en el fragmento (#): no se indexa ni se envía a terceros.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SeguimientoPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <p className="sn-label text-text-muted">StylerNow · atención de solicitudes</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Seguimiento de tu solicitud</h1>
      <VistaSeguimiento />
    </main>
  );
}
