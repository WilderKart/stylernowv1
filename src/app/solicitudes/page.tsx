import { adminSinTipos } from "@/lib/cumplimiento/servidor";
import type { Metadata } from "next";
import Link from "next/link";
import { FormularioSolicitud, type TipoPublico } from "./formulario-solicitud";

export const metadata: Metadata = {
  title: "Radicar una solicitud",
  description: "Peticiones, quejas, reclamos y solicitudes sobre tus datos personales. No necesitas una cuenta.",
};

// Los tipos son configuración del CRM: no se cachea la página para que un cambio se vea de inmediato.
export const dynamic = "force-dynamic";

export default async function SolicitudesPage() {
  const { data } = await adminSinTipos().from("caso_tipo").select("codigo, categoria, nombre, publico, activo, requiere_identificacion, orden");
  const tipos = ((data as (TipoPublico & { publico: boolean; activo: boolean; orden: number })[] | null) ?? [])
    .filter((t) => t.publico && t.activo)
    .sort((a, b) => a.orden - b.orden);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <p className="sn-label text-text-muted">StylerNow · atención de solicitudes</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Radica tu solicitud</h1>
      <p className="mt-3 text-[15px] leading-6 text-text-muted">
        Puedes presentar una petición, queja o reclamo, o ejercer tus derechos sobre tus datos personales (consultar, actualizar, rectificar, suprimir o
        revocar tu autorización). <strong>No necesitas una cuenta.</strong> Al terminar recibirás un número de radicación y un enlace personal para seguir
        tu caso.
      </p>
      <p className="mt-2 text-xs leading-5 text-text-muted">
        StylerNow es un producto operado por TAWILSTACK S.A.S., responsable del tratamiento de tus datos. Usaremos lo que escribas solo para atender tu
        solicitud, según la{" "}
        <Link className="underline" href="/legal/politica-de-datos">
          Política de Tratamiento de Datos
        </Link>
        .
      </p>
      <FormularioSolicitud tipos={tipos} />
      <p className="mt-8 text-sm">
        ¿Ya radicaste una?{" "}
        <Link className="underline" href="/solicitudes/seguimiento">
          Consulta el estado de tu caso
        </Link>
        .
      </p>
    </main>
  );
}
