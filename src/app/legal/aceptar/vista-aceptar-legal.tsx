"use client";

import { ErrorForm } from "@/app/login/_componentes/pantalla-auth";
import { Meta, Num } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { aceptarPendientes } from "./actions";

export function VistaAceptarLegal({
  next,
  textos,
}: {
  next: string;
  textos: { id: string; tipo: string; version: number; contenido: string; titulo: string }[];
}) {
  const router = useRouter();
  const [aceptando, setAceptando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const todosMarcados = textos.every((t) => marcados.has(t.id));

  function toggle(id: string) {
    setMarcados((prev) => {
      const copia = new Set(prev);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }

  async function confirmar() {
    setAceptando(true);
    setError(null);
    const res = await aceptarPendientes();
    setAceptando(false);
    if (!res.ok) return setError(res.error ?? "Error inesperado.");
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {textos.map((t, i) => (
        <section key={t.id} className="border-2 border-border bg-bg">
          <div className="border-b-2 border-border p-4">
            <Num>{String(i + 1).padStart(2, "0")} / Documento</Num>
            <h2 className="section mt-1 text-[15px] leading-5 break-words">{t.titulo}</h2>
            <Meta className="mt-1 block">Versión {t.version}</Meta>
          </div>
          <div className="max-h-52 overflow-y-auto bg-surface p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {t.contenido.split("\n\n").filter(Boolean).map((p, j) => (
              <p key={j} className="body-sm mb-2 text-text-muted break-words">
                {p}
              </p>
            ))}
          </div>
          <label className="flex cursor-pointer items-start gap-3 border-t-2 border-border p-4 has-[:focus-visible]:outline-3 has-[:focus-visible]:-outline-offset-3 has-[:focus-visible]:outline-[var(--focus)]">
            <input type="checkbox" checked={marcados.has(t.id)} onChange={() => toggle(t.id)} className="peer sr-only" />
            <span
              aria-hidden
              className="grid size-6 flex-none place-items-center border-2 border-border text-ink peer-checked:bg-signal [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
            >
              <Check className="size-4" />
            </span>
            <span className="body-sm">Leí y acepto {t.titulo.toLowerCase()}.</span>
          </label>
        </section>
      ))}

      {error ? <ErrorForm>{error}</ErrorForm> : null}

      <Button size="lg" disabled={!todosMarcados} loading={aceptando} onClick={confirmar} className="w-full justify-between">
        <span>Aceptar y continuar</span>
        <ArrowUpRight className="size-[18px]" aria-hidden />
      </Button>
    </div>
  );
}
