import { Bloque, diaYMes, Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { Avatar } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { obtenerDetalleCita } from "@/lib/cliente/citas";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormCalificar } from "./form-calificar";
import { obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("cal.meta"), robots: { index: false, follow: false } };
}

export default async function CalificarPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const t = await obtenerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/reserva/${id}/calificar`);

  const r = await obtenerDetalleCita(id);
  if (!r.ok) {
    if (r.codigo === "RESERVA_NO_ENCONTRADA" || r.codigo === "NO_AUTORIZADO") notFound();
    return (
      <Pantalla>
        <Top titulo={t("cal.meta")} volverA={`/reserva/${id}`} />
        <Bloque etiqueta={t("cal.error")}>{r.error}</Bloque>
      </Pantalla>
    );
  }
  const c = r.data;
  const dm = diaYMes(c.hora_inicio, c.zona_horaria);
  const servicios = c.servicios.map((s) => s.nombre).join(" + ") || t("rv.servicio");
  const quien = c.staff?.nombre ?? c.negocio.nombre;

  if (!c.puede_calificar) {
    return (
      <Pantalla>
        <Top titulo={t("cal.cita", { codigo: c.codigo })} volverA={`/reserva/${id}`} />
        <div className="flex flex-col gap-4 p-4">
          <h1 className="poster-3 break-words">{c.ya_califico ? t("cal.ya") : t("cal.aun_no")}</h1>
          <p className="body-sm">
            {c.ya_califico
              ? t("cal.ya_txt")
              : t("cal.aun_no_txt")}
          </p>
          <Button asChild variant="secondary" size="lg" className="w-full">
            <Link href={`/reserva/${id}`}>{t("cal.volver_cita")}</Link>
          </Button>
        </div>
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <Top titulo={t("cal.cita_completada", { codigo: c.codigo })} volverA={`/reserva/${id}`} />
      <div className="p-4">
        <h1 className="poster-2 break-words">
          {t("cal.como_1")}
          <br />
          {t("cal.como_2")}
        </h1>
        <div className="mt-4 flex items-center gap-3 border-2 border-border p-3">
          <Avatar name={quien} src={c.staff?.foto_url} />
          <div className="min-w-0 flex-1">
            <b className="block break-words uppercase">{quien}</b>
            <span className="sn-meta break-words">
              {servicios} · {dm.dia} {dm.mes} · {c.negocio.nombre}
            </span>
          </div>
        </div>
      </div>
      <FormCalificar reservaId={id} />
    </Pantalla>
  );
}
