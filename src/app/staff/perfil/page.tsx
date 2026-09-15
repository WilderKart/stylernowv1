import { obtenerContextoStaff } from "@/lib/auth/require-staff";
import { redirect } from "next/navigation";
import {
  listarMiDisponibilidad,
  listarMisBloqueos,
  obtenerMiPerfilStaff,
  obtenerMisGanancias,
} from "./actions";
import { VistaPerfilStaff } from "./vista-perfil-staff";

export const metadata = { title: "Mi Perfil" };

function inicioSemanaISO() {
  const hoy = new Date();
  const dow = Number(new Date(hoy.toLocaleString("en-US", { timeZone: "America/Bogota" })).getDay());
  const offset = dow === 0 ? -6 : 1 - dow;
  const inicio = new Date(hoy);
  inicio.setDate(inicio.getDate() + offset);
  return new Date(`${inicio.toISOString().slice(0, 10)}T00:00:00-05:00`).toISOString();
}

export default async function PerfilStaffPage() {
  const contexto = await obtenerContextoStaff();
  if (!contexto) redirect("/staff");

  const desde = inicioSemanaISO();
  const hasta = new Date().toISOString();

  const [perfilRes, gananciasRes, disponibilidadRes, bloqueosRes] = await Promise.all([
    obtenerMiPerfilStaff(),
    obtenerMisGanancias(contexto.negocioId, contexto.vinculoId, desde, hasta),
    listarMiDisponibilidad(contexto.vinculoId),
    listarMisBloqueos(contexto.vinculoId),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-6 text-[22px] font-bold uppercase text-text">Mi Perfil</h1>
      <VistaPerfilStaff
        vinculoId={contexto.vinculoId}
        sedeId={contexto.sedeId}
        perfilInicial={perfilRes.ok ? perfilRes.data : { nombre: "", fotoUrl: null, especialidad: null, bio: null }}
        gananciasIniciales={gananciasRes.ok ? gananciasRes.data : { comisionGenerada: 0, reservasCompletadas: 0, propinas: 0 }}
        disponibilidadInicial={disponibilidadRes.ok ? disponibilidadRes.data : []}
        bloqueosIniciales={bloqueosRes.ok ? bloqueosRes.data : []}
      />
    </main>
  );
}
