import { Badge, Card } from "@/components/ui/card";

const CATEGORIA_ETIQUETA: Record<string, string> = {
  PRODUCCION: "Producción",
  CALIDAD: "Calidad",
  PUNTUALIDAD: "Puntualidad",
  OTRO: "Otros",
};

const NIVEL_TONO: Record<string, "success" | "accent" | "neutral"> = {
  MASTER: "success",
  EXPERT: "accent",
  PRO: "neutral",
};

export function VistaNivel({
  datos,
}: {
  datos: {
    nivelActual: string;
    puntajeTemporadaActual: number;
    desglosePorCategoria: Record<string, number>;
    eventosRecientes: { evento: string; puntosDelta: number; motivo: string | null; createdAt: string }[];
    historialTemporadas: { temporadaId: string; puntajeFinal: number; nivel: string }[];
    proximoNivel: string | null;
    puntosParaSiguiente: number | null;
  };
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col items-center py-8">
        <Badge tone={NIVEL_TONO[datos.nivelActual] ?? "neutral"} className="mb-2 text-[13px]">
          {datos.nivelActual}
        </Badge>
        <p className="text-[32px] font-bold text-text">{datos.puntajeTemporadaActual}</p>
        <p className="text-[11.5px] text-text-faint">puntos esta temporada</p>
        {datos.proximoNivel ? (
          <p className="mt-2 text-[12px] text-text-muted">
            Te faltan <strong>{Math.max(0, datos.puntosParaSiguiente ?? 0)}</strong> puntos para {datos.proximoNivel}
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-text-muted">Nivel máximo alcanzado</p>
        )}
      </Card>

      <section>
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Desglose por categoría</h2>
        <div className="grid grid-cols-3 gap-2">
          {["PRODUCCION", "CALIDAD", "PUNTUALIDAD"].map((cat) => (
            <div key={cat} className="rounded-xl border border-border-subtle bg-surface p-3 text-center">
              <p className="text-[18px] font-bold text-text">{datos.desglosePorCategoria[cat] ?? 0}</p>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">{CATEGORIA_ETIQUETA[cat]}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Eventos recientes</h2>
        {datos.eventosRecientes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
            Todavía no tenés eventos de puntaje esta temporada.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {datos.eventosRecientes.map((e, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5">
                <div>
                  <p className="text-[12.5px] font-semibold text-text">{e.motivo ?? e.evento.replaceAll("_", " ")}</p>
                  <p className="text-[11px] text-text-faint">{new Date(e.createdAt).toLocaleDateString("es-CO")}</p>
                </div>
                <p className={`text-[13px] font-bold ${e.puntosDelta >= 0 ? "text-success" : "text-danger"}`}>
                  {e.puntosDelta >= 0 ? "+" : ""}
                  {e.puntosDelta}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {datos.historialTemporadas.length > 0 ? (
        <section>
          <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Temporadas anteriores</h2>
          <ul className="flex flex-col gap-2">
            {datos.historialTemporadas.map((t) => (
              <li key={t.temporadaId} className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5">
                <Badge tone={NIVEL_TONO[t.nivel] ?? "neutral"}>{t.nivel}</Badge>
                <p className="text-[12.5px] font-semibold text-text">{t.puntajeFinal} puntos</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
