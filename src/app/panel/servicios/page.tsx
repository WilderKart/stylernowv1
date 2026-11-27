import { PanelNav } from "@/components/panel/panel-nav";
import { ImagenServicio } from "@/components/servicios/imagen-servicio";
import { Badge, Card } from "@/components/ui/card";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { createClient } from "@/lib/supabase/server";
import { duracion } from "@/lib/formato";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Servicios" };

const CATEGORIA_TEXTO: Record<string, string> = {
  ESTANDAR: "Estándar",
  PREMIUM: "Premium",
  COMPLEMENTARIO: "Complementario",
};

export default async function ServiciosPage() {
  const contexto = await verificarAccesoPanel(["BARBERIA", "GUARDIAN"], "/panel/servicios");

  const negocioId = contexto.negocioId!;
  const supabase = await createClient();

  const [{ data: servicios }, { data: combos }] = await Promise.all([
    supabase
      .from("servicio")
      .select("id, nombre, descripcion, duracion_minutos, precio_base, categoria_puntaje, estado, imagen_url")
      .eq("negocio_id", negocioId)
      .order("estado")
      .order("nombre"),
    supabase
      .from("servicio_combo")
      .select("id, nombre, precio_total_override, duracion_minutos_override, estado")
      .eq("negocio_id", negocioId)
      .order("estado")
      .order("nombre"),
  ]);

  // Sedes donde NO se ofrece cada servicio (sin fila = se ofrece en todas).
  const [{ data: sedesNeg }, { data: excepciones }] = await Promise.all([
    supabase.from("sede").select("id, nombre").eq("negocio_id", negocioId).eq("cerrada_permanente", false),
    (servicios ?? []).length
      ? (supabase as unknown as { from: (t: string) => { select: (c: string) => { in: (c: string, v: string[]) => { eq: (c: string, v: boolean) => Promise<{ data: Array<{ servicio_id: string; sede_id: string }> | null }> } } } })
          .from("servicio_sede").select("servicio_id, sede_id").in("servicio_id", (servicios ?? []).map((s) => s.id)).eq("activo", false)
      : Promise.resolve({ data: [] as Array<{ servicio_id: string; sede_id: string }> }),
  ]);
  const nombreSede = new Map((sedesNeg ?? []).map((s) => [s.id, s.nombre]));
  const sedesOcultas = new Map<string, string[]>();
  for (const e of excepciones ?? []) sedesOcultas.set(e.servicio_id, [...(sedesOcultas.get(e.servicio_id) ?? []), nombreSede.get(e.sede_id) ?? "Sede"]);

  const activos = (servicios ?? []).filter((s) => s.estado === "ACTIVO");
  const inactivos = (servicios ?? []).filter((s) => s.estado !== "ACTIVO");

  // El motor de reservas exige staff_servicio explícito por Servicio (nunca
  // "cualquiera puede atenderlo" por defecto) — se avisa aquí para que un
  // Servicio activo sin nadie asignado no quede invisible como problema.
  const { data: asignaciones } = activos.length
    ? await supabase
        .from("staff_servicio")
        .select("servicio_id")
        .in("servicio_id", activos.map((s) => s.id))
    : { data: [] as { servicio_id: string }[] };
  const conStaff = new Set((asignaciones ?? []).map((a) => a.servicio_id));
  const sinStaff = activos.filter((s) => !conStaff.has(s.id));

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[22px] font-bold uppercase text-text">Servicios</h1>
            <p className="mt-1 text-[12.5px] text-text-muted">
              {activos.length} activo{activos.length === 1 ? "" : "s"}
            </p>
          </div>
          {contexto.permisos.crearServicio ? (
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row">
              <Link
                href="/panel/servicios/catalogo"
                className="rounded-none border-2 border-ink bg-accent px-4 py-2.5 text-center text-[12.5px] font-bold uppercase text-ink hover:bg-accent-hover"
              >
                ✦ Elegir del catálogo
              </Link>
              <Link
                href="/panel/servicios/nuevo"
                className="rounded-none border-2 border-border px-4 py-2.5 text-center text-[12.5px] font-bold uppercase text-text hover:bg-surface"
              >
                + Servicio propio
              </Link>
            </div>
          ) : null}
        </div>

        {contexto.permisos.crearServicio && activos.length === 0 ? (
          <Card className="mb-6 border-2 border-ink bg-surface">
            <p className="text-[13.5px] font-bold text-text">Empieza con servicios ya listos</p>
            <p className="mt-1 text-[12.5px] text-text-muted">
              Tenemos un catálogo con cortes, barba, cuidado facial, uñas y más, con su imagen incluida. Elige los que ofreces y solo pones el precio y la duración.
            </p>
            <Link href="/panel/servicios/catalogo" className="mt-3 inline-block border-2 border-ink bg-accent px-4 py-2 text-[12.5px] font-bold uppercase text-ink">
              Ver el catálogo
            </Link>
          </Card>
        ) : null}

        {sinStaff.length > 0 ? (
          <Card className="mb-6 border-danger/30 bg-danger-soft">
            <p className="text-[12.5px] font-semibold text-danger">
              {sinStaff.length} servicio{sinStaff.length === 1 ? "" : "s"} activo
              {sinStaff.length === 1 ? "" : "s"} sin nadie asignado
            </p>
            <p className="mt-1 text-[12px] text-text-muted">
              {sinStaff.map((s) => s.nombre).join(", ")} — nadie va a poder ser reservado para{" "}
              {sinStaff.length === 1 ? "ese servicio" : "esos servicios"} hasta que asignes al menos
              un Staff en su ficha.
            </p>
          </Card>
        ) : null}

        {!servicios || servicios.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
            Todavía no tienes ningún servicio.
          </p>
        ) : (
          <ul className="mb-8 flex flex-col gap-2.5">
            {[...activos, ...inactivos].map((s) => (
              <li key={s.id}>
                <Link
                  href={`/panel/servicios/${s.id}`}
                  className="block rounded-2xl border border-border-subtle bg-surface p-4 transition-colors hover:border-accent/40"
                >
                  <Card className="border-none bg-transparent p-0">
                    <div className="flex items-start gap-3">
                      <ImagenServicio url={s.imagen_url} nombre={s.nombre} className="size-14" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold text-text">{s.nombre}</p>
                        <p className="mt-1 truncate text-[12px] text-text-faint">
                          {duracion(s.duracion_minutos)} · {formatCOP(s.precio_base)} ·{" "}
                          {CATEGORIA_TEXTO[s.categoria_puntaje] ?? s.categoria_puntaje}
                        </p>
                        {s.estado === "ACTIVO" && sedesOcultas.get(s.id)?.length ? (
                          <p className="mt-1 truncate text-[11.5px] font-semibold text-text-muted">No se ofrece en: {sedesOcultas.get(s.id)!.join(", ")}</p>
                        ) : null}
                      </div>
                      <Badge tone={s.estado === "ACTIVO" ? "success" : "neutral"}>{s.estado === "ACTIVO" ? "Se ofrece" : "No se ofrece"}</Badge>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-[15px] font-bold uppercase text-text">Combos</h2>
            {contexto.permisos.gestionarCombos ? (
              <Link href="/panel/servicios/combos/nuevo" className="text-[12px] font-bold text-accent">
                + NUEVO COMBO
              </Link>
            ) : null}
          </div>
          {!combos || combos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
              {contexto.permisos.gestionarCombos
                ? "Agrupa servicios frecuentes (ej. Corte + Barba) para que el Cliente los elija con un solo toque."
                : "Solo la Barbería administra combos."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {combos.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/panel/servicios/combos/${c.id}`}
                    className="block rounded-2xl border border-border-subtle bg-surface p-4 transition-colors hover:border-accent/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-text">{c.nombre}</p>
                        <p className="mt-1 text-[12px] text-text-faint">
                          {c.duracion_minutos_override ? duracion(c.duracion_minutos_override) : "Suma de sus servicios"}
                          {c.precio_total_override != null ? ` · ${formatCOP(c.precio_total_override)}` : ""}
                        </p>
                      </div>
                      <Badge tone={c.estado === "ACTIVO" ? "success" : "neutral"}>{c.estado}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
