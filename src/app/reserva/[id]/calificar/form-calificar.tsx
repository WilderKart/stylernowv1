"use client";

import { ErrorAviso, Pie } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { calificarAction } from "../actions-cita";
import { useT } from "@/lib/i18n/proveedor";

const PALABRAS = ["cal.sin_calificar", "cal.mal", "cal.regular", "cal.bien", "cal.muy_bien", "cal.excelente"] as const;
const MAX = 500;

export function FormCalificar({ reservaId }: { reservaId: string }) {
  const router = useRouter();
  const t = useT();
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    if (nota === 0) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await calificarAction(reservaId, nota, comentario);
      if (!r.ok) return setError(r.error);
      setListo(true);
      router.refresh();
    } catch {
      setError(t("cal.err_publicar"));
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div role="status" className="flex flex-col gap-4 p-4">
        <span className="sn-num flex items-center gap-2">
          <Check aria-hidden className="size-4" /> {t("cal.publicada")}
        </span>
        <p className="body-sm">{t("cal.gracias")}</p>
        <Button asChild size="lg" className="w-full">
          <Link href={`/reserva/${reservaId}`}>{t("cal.volver_cita")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={publicar} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6 px-4 pb-6">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="sn-num">{t("cal.sec_calif")}</span>
            <span className="sn-label" aria-live="polite">
              {nota} / 5 · {t(PALABRAS[nota])}
            </span>
          </div>
          <div className="sn-stars--input mt-2 flex w-full" role="radiogroup" aria-label={t("cal.calif")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={n === nota}
                aria-label={t("cal.n_de_5", { n })}
                className={`!w-auto flex-1 ${n <= nota ? "is-on" : ""}`}
                onClick={() => setNota(n)}
              >
                <Star aria-hidden className={`lucide ${n <= nota ? "fill-current" : ""}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="sn-field">
          <label htmlFor="comentario" className="flex flex-wrap justify-between gap-2">
            <span>{t("cal.sec_comentario")}</span>
            <span className="text-text-muted">{t("cal.opcional")}</span>
          </label>
          <textarea
            id="comentario"
            rows={4}
            maxLength={MAX}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder={t("cal.comentario_ph")}
            className="w-full resize-none border-2 border-border bg-bg p-3 text-[15px] leading-[22px] text-text placeholder:text-text-muted focus:shadow-hard focus:outline-none"
          />
          <span className="sn-meta self-end">
            {comentario.length} / {MAX}
          </span>
        </div>

        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
      </div>

      <div className="mt-auto" />
      <Pie>
        <Button type="submit" size="lg" className="w-full" disabled={nota === 0} loading={enviando}>
          {t("cal.publicar")}
        </Button>
        <span className="sn-meta text-center">{t("cal.se_publica")}</span>
      </Pie>
    </form>
  );
}
