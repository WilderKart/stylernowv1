"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resumenPoliticaCancelacion } from "@/lib/pagos/sena";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarPolitica, type LimitesPolitica, type PoliticaNegocio } from "./actions";

export function VistaPolitica({ politica, limites }: { politica: PoliticaNegocio; limites: LimitesPolitica }) {
  const router = useRouter();
  const [total, setTotal] = useState(String(politica.totalHoras));
  const [parcial, setParcial] = useState(String(politica.parcialHoras));
  const [pct, setPct] = useState(String(politica.parcialPct));
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const vista = {
    ventana_reembolso_total_horas: Number(total) || 0,
    ventana_reembolso_parcial_horas: Number(parcial) || 0,
    reembolso_parcial_pct: Number(pct) || 0,
  };

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    iniciar(async () => {
      const r = await guardarPolitica({
        totalHoras: Number(total),
        parcialHoras: Number(parcial),
        parcialPct: Number(pct),
      });
      if (!r.ok) return setMensaje({ tipo: "error", texto: r.error });
      setMensaje({ tipo: "ok", texto: "Política guardada. Aplica a las reservas que se paguen desde ahora." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="poster-3 break-words">Política de cancelación</h1>
        <p className="sn-meta mt-2">
          Tus clientes la ven y la aceptan antes de pagar el anticipo. Si la cambias, las reservas ya pagadas
          conservan la política que aceptaron. Si tú cancelas una cita, siempre se devuelve el 100 %.
        </p>
      </header>

      <form onSubmit={guardar} className="flex flex-col gap-4">
        <Input
          label={`Devolución total si cancela con al menos (horas, entre ${limites.totalMin} y ${limites.totalMax})`}
          type="number"
          inputMode="numeric"
          min={limites.totalMin}
          max={limites.totalMax}
          required
          value={total}
          onChange={(e) => setTotal(e.target.value)}
        />
        <Input
          label={`Devolución parcial si cancela con al menos (horas, mínimo ${limites.parcialMin} y no más que la total)`}
          type="number"
          inputMode="numeric"
          min={limites.parcialMin}
          max={Number(total) || undefined}
          required
          value={parcial}
          onChange={(e) => setParcial(e.target.value)}
        />
        <Input
          label={`Porcentaje de la devolución parcial (entre ${limites.pctMin} y ${limites.pctMax})`}
          type="number"
          inputMode="decimal"
          min={limites.pctMin}
          max={limites.pctMax}
          step="0.01"
          required
          value={pct}
          onChange={(e) => setPct(e.target.value)}
        />

        <Card className="p-4">
          <p className="sn-label mb-2">Así la verá tu cliente</p>
          <ul className="m-0 list-disc space-y-1 pl-5 text-[13px]">
            {resumenPoliticaCancelacion(vista).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Card>

        {mensaje ? (
          <p
            role={mensaje.tipo === "error" ? "alert" : "status"}
            className={
              mensaje.tipo === "error"
                ? "border-2 border-danger p-3 text-[13px] font-bold text-danger"
                : "border-2 border-border p-3 text-[13px] font-bold"
            }
          >
            {mensaje.texto}
          </p>
        ) : null}

        <Button type="submit" loading={pendiente} disabled={pendiente}>
          Guardar política
        </Button>
      </form>
    </div>
  );
}
