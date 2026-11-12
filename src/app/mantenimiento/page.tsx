import { obtenerEstadoSistema } from "@/lib/cliente/sistema";
import { Wrench } from "lucide-react";
import { BotonReintentar } from "./boton-reintentar";
import { obtenerIdioma, obtenerT } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("mant.meta"), robots: { index: false, follow: false } };
}

// Siempre fresco: el estado cambia desde SuperSU.
export const dynamic = "force-dynamic";

const TZ = "America/Bogota";

function hora(iso: string | null, loc: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(loc, { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export default async function MantenimientoPage() {
  const t = await obtenerT();
  const loc = (await obtenerIdioma()) === "en" ? "en-US" : "es-CO";
  const r = await obtenerEstadoSistema();
  const e = r.ok ? r.data : null;

  let cuando = t("mant.volvemos_pronto");
  if (e?.fin_estimado) {
    const min = Math.ceil((new Date(e.fin_estimado).getTime() - new Date(e.ahora).getTime()) / 60_000);
    if (Number.isFinite(min) && min > 0) cuando = min < 90 ? t("mant.volvemos_min", { min }) : t("mant.volvemos_hora", { hora: hora(e.fin_estimado, loc) });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-bg">
      <div className="p-top">
        <span className="sn-header__title pl-3">
          Styler<span className="sn-hot">Now</span>.
        </span>
        <span className="sn-num flex-none">{t("mant.sec")}</span>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-4 pt-6 pb-8">
        <p className="sn-status sn-status--warn">
          <Wrench aria-hidden /> {t("mant.aviso")}
        </p>
        <h1 className="poster-2 break-words">
          {t("mant.t1")}
          <br />
          {t("mant.t2")}
          <br />
          <span className="sn-hot">{cuando}</span>
        </h1>
        <p className="body-sm break-words text-text-muted">
          {e?.mensaje?.trim() || t("mant.msg")}
        </p>

        <div className="grid grid-cols-2 border-2 border-border">
          <div className="flex flex-col gap-1 border-r-2 border-border p-4">
            <span className="sn-meta">{t("mant.inicio")}</span>
            <span className="poster-4">{hora(e?.inicio ?? null, loc)}</span>
          </div>
          <div className="flex flex-col gap-1 p-4">
            <span className="sn-meta">{t("mant.fin")}</span>
            <span className="poster-4">{hora(e?.fin_estimado ?? null, loc)}</span>
          </div>
        </div>

        <BotonReintentar />
      </div>
    </main>
  );
}
