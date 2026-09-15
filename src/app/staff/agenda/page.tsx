import { hoyISO, sumarDias } from "@/lib/formato";
import { listarMisCitas } from "./actions";
import { VistaAgendaStaff } from "./vista-agenda-staff";

export const metadata = { title: "Mi Agenda" };

function inicioDiaISO(fecha: string) {
  return new Date(`${fecha}T00:00:00-05:00`).toISOString();
}

export default async function AgendaStaffPage() {
  const hoy = hoyISO();
  const desde = inicioDiaISO(hoy);
  const hasta = inicioDiaISO(sumarDias(hoy, 1));

  const res = await listarMisCitas(desde, hasta);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-6 text-[22px] font-bold uppercase text-text">Mi Agenda</h1>
      <VistaAgendaStaff citasIniciales={res.ok ? res.data : []} errorInicial={res.ok ? null : res.error} fechaInicial={hoy} />
    </main>
  );
}
