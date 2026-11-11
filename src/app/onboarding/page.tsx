"use client";

import { Num, Photo, Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const SLIDES = [
  {
    title: (
      <>
        Agenda tu
        <br />
        cita en
        <br />
        <span className="sn-hot">60 segundos.</span>
      </>
    ),
    description: "Encuentra tu negocio de confianza, elige a tu profesional y reserva sin llamadas ni esperas.",
  },
  {
    title: (
      <>
        Paga tu seña
        <br />y <span className="sn-hot">asegura tu turno.</span>
      </>
    ),
    description: "Un pequeño adelanto garantiza que tu cita nunca se pierda ni se la lleve otra persona.",
  },
  {
    title: (
      <>
        Gana puntos
        <br />
        en <span className="sn-hot">cada visita.</span>
      </>
    ),
    description: "Acumula fidelización y sube de nivel en tus negocios favoritos.",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <Photo className="h-[clamp(220px,40dvh,360px)] w-full flex-none border-b-2 border-border" />
        <div className="px-4 pt-4">
          <Num>
            {String(step + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
          </Num>
        </div>
        <Poster as="h1" size={2} className="px-4 pt-3 pb-4 break-words">
          {slide.title}
        </Poster>
        <p className="body mx-4 mb-5 text-text-muted">{slide.description}</p>

        <div className="mx-4 mb-5 grid border-2 border-border" style={{ gridTemplateColumns: `repeat(${SLIDES.length}, minmax(0, 1fr))` }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir al paso ${i + 1}`}
              aria-current={i === step ? "step" : undefined}
              onClick={() => setStep(i)}
              className={
                "min-h-12 border-r border-[var(--grid)] font-mono text-[11px] leading-[14px] font-bold tracking-[0.66px] last:border-r-0 " +
                (i === step ? "bg-signal text-ink" : i < step ? "bg-text text-bg" : "text-text")
              }
            >
              {String(i + 1).padStart(2, "0")}
            </button>
          ))}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Button asChild variant="secondary" size="lg" className="justify-between">
            <Link href="/login">Saltar</Link>
          </Button>
          {isLast ? (
            <Button asChild size="lg" className="justify-between">
              <Link href="/login">
                <span>Continuar</span>
                <ArrowUpRight className="size-[18px]" aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button size="lg" className="justify-between" onClick={() => setStep((s) => s + 1)}>
              <span>Siguiente</span>
              <ArrowUpRight className="size-[18px]" aria-hidden />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
