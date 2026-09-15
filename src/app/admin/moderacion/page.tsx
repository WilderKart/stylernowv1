import { listarResenasReportadas } from "../actions";
import { ColaModeracion } from "./cola-moderacion";

export default async function AdminModeracionPage() {
  const res = await listarResenasReportadas();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-6 text-[22px] font-bold uppercase text-text">Moderación de reseñas</h1>
      <ColaModeracion resenasIniciales={res.ok ? res.data : []} errorInicial={res.ok ? null : res.error} />
    </main>
  );
}
