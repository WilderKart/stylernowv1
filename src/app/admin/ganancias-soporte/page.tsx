import { FormAccion } from "@/components/ganancias/form-accion";
import { ResumenCards, TablaGanancias } from "@/components/ganancias/vista-ganancias";
import { requireSuperSU } from "@/lib/auth/require-supersu";
import { llamar } from "@/lib/ganancias/rpc";
import type { ListaGanancias, ResumenGanancias } from "@/lib/ganancias/tipos";
import Link from "next/link";
import { z } from "zod";
import { cerrarAcceso, tomarAcceso } from "./actions";

export const metadata = { title: "Soporte de ganancias" };

interface Disponible { id: string; negocio_id: string; negocio_nombre: string; motivo: string; autorizado_at: string; expira_at: string; tomado_por_mi: boolean }

export default async function SoporteGananciasPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireSuperSU();
  const sp = await props.searchParams;
  const pedido = Array.isArray(sp.negocio) ? sp.negocio[0] : sp.negocio;
  const negocioId = z.string().uuid().safeParse(pedido).success ? (pedido as string) : null;

  const disp = await llamar<Disponible[]>("soporte_ganancias_disponibles");
  const accesos = disp.ok ? disp.data : [];
  const sesion = negocioId ? accesos.find((a) => a.negocio_id === negocioId && a.tomado_por_mi) : undefined;

  // Solo se consulta si hay una sesión TOMADA por este agente y vigente; la base lo exige de nuevo (modo SOPORTE).
  let vista: React.ReactNode = null;
  if (negocioId && sesion) {
    const [resumen, lista] = await Promise.all([
      llamar<ResumenGanancias>("ganancias_resumen", { p_negocio: negocioId }),
      llamar<ListaGanancias>("ganancias_listar", { p_negocio: negocioId, p_limite: 50, p_desplazamiento: 0 }),
    ]);
    vista =
      resumen.ok && lista.ok && lista.data.modo === "SOPORTE" ? (
        <>
          <p className="mb-3 border-2 border-accent bg-surface p-2 text-[12.5px]">Modo solo lectura · vence {new Date(sesion.expira_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })} · cada consulta queda auditada.</p>
          <ResumenCards r={resumen.data} esProfesional={false} />
          <TablaGanancias filas={lista.data.filas} mostrarProfesional mostrarParticipacion />
        </>
      ) : (
        <p className="text-[13px] text-danger">El acceso ya no está vigente.</p>
      );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <h1 className="poster-3 mb-4">Soporte de ganancias</h1>
      <p className="mb-4 text-[13px] text-text-muted">Solo aparecen accesos que el propietario pidió y autorizó, por tiempo limitado y en solo lectura.</p>
      {accesos.length === 0 ? (
        <p className="border-2 border-dashed border-border p-6 text-center text-[13px] text-text-muted">No hay accesos autorizados en este momento.</p>
      ) : (
        <ul className="mb-6 grid gap-2">
          {accesos.map((a) => (
            <li key={a.id} className="border-2 border-border bg-surface p-3 text-[12.5px]">
              <p className="font-bold">{a.negocio_nombre}</p>
              <p className="text-text-muted">{a.motivo} · vence {new Date(a.expira_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {a.tomado_por_mi ? (
                  <>
                    <Link href={`/admin/ganancias-soporte?negocio=${a.negocio_id}`} className="font-semibold underline">Ver ganancias (solo lectura)</Link>
                    <FormAccion accion={cerrarAcceso} etiqueta="Cerrar acceso" variante="ghost" confirmacion="¿Cerrar este acceso?"><input type="hidden" name="acceso" value={a.id} /></FormAccion>
                  </>
                ) : (
                  <FormAccion accion={tomarAcceso} etiqueta="Tomar este acceso" confirmacion="¿Tomar este acceso? Quedará registrado a tu nombre."><input type="hidden" name="acceso" value={a.id} /></FormAccion>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {vista}
    </main>
  );
}
