"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ResumenAlta } from "./actions";

const SIGUIENTES = [
  "Elige tus servicios del catálogo (con 2 ya puedes recibir reservas).",
  "Invita a tu equipo, según el límite de tu plan.",
  "Personaliza tu perfil público.",
  "Verifica tu negocio para generar más confianza.",
];

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

/** Clave del navegador para ocultar el asistente de bienvenida (solo comodidad; no es un permiso). */
export const CLAVE_ASISTENTE_OCULTO = "sn_asistente_oculto";

export function PantallaListo({ resumen, planNombre, diasPrueba }: { resumen: ResumenAlta; planNombre: string; diasPrueba: number }) {
  const router = useRouter();

  function configurarDespues() {
    try {
      window.localStorage.setItem(CLAVE_ASISTENTE_OCULTO, "1");
    } catch {
      /* sin almacenamiento: el asistente simplemente seguirá visible */
    }
    router.push("/panel");
  }

  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="!size-14 text-accent" aria-hidden />
        <h1 className="font-display text-[clamp(30px,10vw,44px)] font-bold uppercase leading-[0.95] text-text">
          ¡Tu negocio <span className="text-accent">está listo!</span>
        </h1>
        <p className="text-[14px] leading-relaxed text-text-muted">
          Tu prueba gratuita de {diasPrueba} días ya está activa. Bienvenido a StylerNow.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {resumen.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- fotografía recién subida
            <img src={resumen.fotoUrl} alt="Fachada de tu negocio" className="size-16 shrink-0 border-2 border-border object-cover" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate font-display text-[18px] font-bold uppercase text-text">{resumen.nombre}</p>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-accent">Plan {planNombre}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t-2 border-border pt-3 text-[12.5px]">
          <div>
            <dt className="sn-label">Inicio de la prueba</dt>
            <dd className="mt-0.5 text-text">{fecha(resumen.pruebaInicio)}</dd>
          </div>
          <div>
            <dt className="sn-label">Termina</dt>
            <dd className="mt-0.5 text-text">{fecha(resumen.pruebaFin)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="sn-label">Método de pago</dt>
            <dd className="mt-0.5 text-text">
              {resumen.conMetodoPago ? "Registrado." : `Sin método de pago. Agrégalo antes del ${fecha(resumen.pruebaFin)} en «Plan y facturación».`}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="border-2 border-border p-4">
        <p className="font-display text-[14px] font-bold uppercase text-text">¿Qué sigue?</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {SIGUIENTES.map((s) => (
            <li key={s} className="flex items-start gap-2 text-[13px] text-text-muted">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 bg-accent" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button size="lg" className="w-full" onClick={() => router.push("/panel")}>
          IR AL PANEL
        </Button>
        <button type="button" onClick={configurarDespues} className="text-[12.5px] font-bold text-text underline underline-offset-4">
          Configurar después
        </button>
      </div>
    </div>
  );
}
