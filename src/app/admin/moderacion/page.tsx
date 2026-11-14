import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { listarResenasReportadas } from "../actions";
import { ColaModeracion } from "./cola-moderacion";

export default async function AdminModeracionPage() {
  const res = await listarResenasReportadas();

  return (
    <main className="w-full max-w-3xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Moderación" titulo="Moderación de" resaltado="reseñas." />
      <ColaModeracion resenasIniciales={res.ok ? res.data : []} errorInicial={res.ok ? null : res.error} />
    </main>
  );
}
