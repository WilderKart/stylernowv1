import { obtenerEstadoSistema } from "@/lib/cliente/sistema";
import { Wrench } from "lucide-react";
import { BotonReintentar } from "./boton-reintentar";

export const metadata = {
  title: "Mantenimiento",
  robots: { index: false, follow: false },
};

// Siempre fresco: el estado cambia desde SuperSU.
export const dynamic = "force-dynamic";

const TZ = "America/Bogota";

function hora(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export default async function MantenimientoPage() {
  const r = await obtenerEstadoSistema();
  const e = r.ok ? r.data : null;

  let cuando = "Volvemos pronto.";
  if (e?.fin_estimado) {
    const min = Math.ceil((new Date(e.fin_estimado).getTime() - new Date(e.ahora).getTime()) / 60_000);
    if (Number.isFinite(min) && min > 0) cuando = min < 90 ? `Volvemos en ${min} min.` : `Volvemos a las ${hora(e.fin_estimado)}.`;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-bg">
      <div className="p-top">
        <span className="sn-header__title pl-3">
          Styler<span className="sn-hot">Now</span>.
        </span>
        <span className="sn-num flex-none">00 / Mantenimiento</span>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-4 pt-6 pb-8">
        <p className="sn-status sn-status--warn">
          <Wrench aria-hidden /> Aviso · En mantenimiento
        </p>
        <h1 className="poster-2 break-words">
          Afilando
          <br />
          la navaja.
          <br />
          <span className="sn-hot">{cuando}</span>
        </h1>
        <p className="body-sm break-words text-text-muted">
          {e?.mensaje?.trim() || "Tus citas siguen en pie. Si tienes una hoy, preséntate a la hora de siempre."}
        </p>

        <div className="grid grid-cols-2 border-2 border-border">
          <div className="flex flex-col gap-1 border-r-2 border-border p-4">
            <span className="sn-meta">Inicio</span>
            <span className="poster-4">{hora(e?.inicio ?? null)}</span>
          </div>
          <div className="flex flex-col gap-1 p-4">
            <span className="sn-meta">Fin estimado</span>
            <span className="poster-4">{hora(e?.fin_estimado ?? null)}</span>
          </div>
        </div>

        <BotonReintentar />
      </div>
    </main>
  );
}
