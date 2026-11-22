import { obtenerContextoStaff } from "@/lib/auth/require-staff";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  listarMiDisponibilidad,
  listarMisBloqueos,
  obtenerMiPerfilStaff,
  obtenerMisAutorizaciones,
  obtenerMisGanancias,
} from "./actions";
import { VistaPerfilStaff } from "./vista-perfil-staff";
import { TarjetaVisibilidadPublica } from "@/components/panel/tarjeta-visibilidad-publica";
import { obtenerEstadoPublicacion } from "@/app/panel/staff/publicacion-actions";

export const metadata = { title: "Mi Perfil" };

function inicioSemanaISO() {
  const hoy = new Date();
  const dow = Number(new Date(hoy.toLocaleString("en-US", { timeZone: "America/Bogota" })).getDay());
  const offset = dow === 0 ? -6 : 1 - dow;
  const inicio = new Date(hoy);
  inicio.setDate(inicio.getDate() + offset);
  return new Date(`${inicio.toISOString().slice(0, 10)}T00:00:00-05:00`).toISOString();
}

export default async function PerfilStaffPage(props: PageProps<"/staff/perfil">) {
  const contexto = await obtenerContextoStaff();
  if (!contexto) redirect("/staff");

  const desde = inicioSemanaISO();
  const hasta = new Date().toISOString();

  const supabase = await createClient();
  const publicacionRes = await obtenerEstadoPublicacion(contexto.negocioId);
  const [perfilRes, gananciasRes, disponibilidadRes, bloqueosRes, autorizacionesRes, { data: negocio }, { data: textos }, busqueda] =
    await Promise.all([
    obtenerMiPerfilStaff(),
    obtenerMisGanancias(contexto.negocioId, contexto.vinculoId, desde, hasta),
    listarMiDisponibilidad(contexto.vinculoId),
    listarMisBloqueos(contexto.vinculoId),
    obtenerMisAutorizaciones(contexto.negocioId),
    supabase.from("negocio").select("nombre").eq("id", contexto.negocioId).maybeSingle(),
    supabase
      .from("texto_legal")
      .select("tipo, contenido, version")
      .in("tipo", ["AUTORIZACION_STAFF_TRATAMIENTO", "AUTORIZACION_STAFF_PUBLICACION"])
      .order("version", { ascending: false }),
    props.searchParams,
  ]);
  const nombreNegocio = negocio?.nombre ?? "el negocio";
  // Versión más reciente de cada texto (borradores de trabajo, pendientes de validación jurídica).
  const textoDe = (tipo: string) =>
    ((textos ?? []).find((t) => t.tipo === tipo)?.contenido ?? "").replaceAll("{negocio}", nombreNegocio);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-6 text-[22px] font-bold uppercase text-text">Mi Perfil</h1>
      {publicacionRes.ok ? <TarjetaVisibilidadPublica estado={publicacionRes.data} /> : null}
      <VistaPerfilStaff
        vinculoId={contexto.vinculoId}
        sedeId={contexto.sedeId}
        perfilInicial={perfilRes.ok ? perfilRes.data : { nombre: "", fotoUrl: null, especialidad: null, bio: null }}
        gananciasIniciales={gananciasRes.ok ? gananciasRes.data : { comisionGenerada: 0, reservasCompletadas: 0, propinas: 0 }}
        disponibilidadInicial={disponibilidadRes.ok ? disponibilidadRes.data : []}
        bloqueosIniciales={bloqueosRes.ok ? bloqueosRes.data : []}
        autorizaciones={autorizacionesRes.ok ? autorizacionesRes.data : null}
        textoTratamiento={textoDe("AUTORIZACION_STAFF_TRATAMIENTO")}
        textoPublicacion={textoDe("AUTORIZACION_STAFF_PUBLICACION")}
        bienvenida={busqueda.bienvenida === "1"}
      />
    </main>
  );
}
