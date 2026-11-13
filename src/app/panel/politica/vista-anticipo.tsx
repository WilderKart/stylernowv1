"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarAnticipo, type ConfigAnticipo } from "./actions";

const MODOS: { valor: ConfigAnticipo["modo"]; titulo: string; texto: string }[] = [
  { valor: "OBLIGATORIO", titulo: "Obligatorio", texto: "La reserva se confirma solo cuando el pago del anticipo se verifica." },
  { valor: "OPCIONAL", titulo: "Opcional", texto: "El cliente elige pagar el anticipo o reservar sin pagarlo." },
  { valor: "NINGUNO", titulo: "Sin anticipo", texto: "Las reservas se confirman sin cobro en línea." },
];

export function VistaAnticipo({ anticipo }: { anticipo: ConfigAnticipo }) {
  const router = useRouter();
  const [modo, setModo] = useState(anticipo.modo);
  const [tipo, setTipo] = useState<"PORCENTAJE" | "FIJO">(anticipo.montoFijo != null ? "FIJO" : "PORCENTAJE");
  const [valor, setValor] = useState(String(anticipo.montoFijo ?? anticipo.pct ?? 20));
  const [minimo, setMinimo] = useState(String(anticipo.minimo));
  const [maximo, setMaximo] = useState(String(anticipo.maximo));
  const [pagoCompleto, setPagoCompleto] = useState(anticipo.pagoCompleto);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    iniciar(async () => {
      const r = await guardarAnticipo({
        modo,
        tipo,
        valor: Number(valor),
        minimo: Number(minimo),
        maximo: Number(maximo),
        pagoCompleto,
      });
      if (!r.ok) return setMensaje({ tipo: "error", texto: r.error });
      setMensaje({ tipo: "ok", texto: "Anticipo guardado. Aplica a las reservas nuevas." });
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="section">Anticipo</h2>
        <p className="sn-meta mt-1">
          El anticipo se cobra en tu propia cuenta de Mercado Pago. StylerNow no recibe ese dinero ni cobra comisión.
        </p>
      </header>

      {!anticipo.cobraEnLinea ? (
        <p role="status" className="border-2 border-border p-3 text-[13px]">
          Tu cuenta de Mercado Pago no está conectada: por ahora tus reservas se confirman sin anticipo. Conéctala en
          «Cobros» para empezar a cobrarlo.
        </p>
      ) : null}

      <form onSubmit={guardar} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-semibold">¿Cómo funciona el anticipo?</legend>
          {MODOS.map((m) => (
            <label key={m.valor} className="flex cursor-pointer items-start gap-3 border-2 border-border p-3">
              <input type="radio" name="modo" value={m.valor} checked={modo === m.valor} onChange={() => setModo(m.valor)} className="mt-1" />
              <span>
                <span className="block text-[14px] font-bold">{m.titulo}</span>
                <span className="block text-[13px] text-text-muted">{m.texto}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {modo !== "NINGUNO" ? (
          <Card className="flex flex-col gap-3 p-4">
            <label className="flex items-center gap-3 text-[13px]">
              <input type="checkbox" checked={pagoCompleto} onChange={(e) => setPagoCompleto(e.target.checked)} />
              Cobrar el valor completo del servicio en la app
            </label>
            {!pagoCompleto ? (
              <>
                <fieldset className="flex flex-wrap gap-4 text-[13px]">
                  <legend className="sr-only">Tipo de anticipo</legend>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="tipo" checked={tipo === "PORCENTAJE"} onChange={() => setTipo("PORCENTAJE")} />
                    Porcentaje del servicio
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="tipo" checked={tipo === "FIJO"} onChange={() => setTipo("FIJO")} />
                    Valor fijo
                  </label>
                </fieldset>
                <Input
                  label={tipo === "PORCENTAJE" ? "Porcentaje (0 a 100)" : "Valor fijo (COP)"}
                  type="number"
                  min={0}
                  max={tipo === "PORCENTAJE" ? 100 : undefined}
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Anticipo mínimo (COP)" type="number" min={0} required value={minimo} onChange={(e) => setMinimo(e.target.value)} />
                  <Input label="Anticipo máximo (COP)" type="number" min={0} required value={maximo} onChange={(e) => setMaximo(e.target.value)} />
                </div>
              </>
            ) : null}
          </Card>
        ) : null}

        {mensaje ? (
          <p
            role={mensaje.tipo === "error" ? "alert" : "status"}
            className={`border-2 p-3 text-[13px] font-bold ${mensaje.tipo === "error" ? "border-danger text-danger" : "border-border"}`}
          >
            {mensaje.texto}
          </p>
        ) : null}
        <Button type="submit" loading={pendiente} disabled={pendiente}>
          Guardar anticipo
        </Button>
      </form>
    </section>
  );
}
