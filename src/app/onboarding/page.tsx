"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

const SLIDES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#E8A23C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
    title: (
      <>
        Agenda tu
        <br />
        cita en
        <br />
        <span className="text-accent">60 segundos</span>
      </>
    ),
    description: "Encuentra tu negocio de confianza, elige a tu profesional y reserva sin llamadas ni esperas.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#E8A23C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
        <path d="M2.5 10h19" />
      </svg>
    ),
    title: (
      <>
        Paga tu seña
        <br />y <span className="text-accent">asegura tu turno</span>
      </>
    ),
    description: "Un pequeño adelanto garantiza que tu cita nunca se pierda ni se la lleve otra persona.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#E8A23C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8.5" r="4.5" />
        <path d="M9 12.5 7 21l5-2.5L17 21l-2-8.5" />
      </svg>
    ),
    title: (
      <>
        Gana puntos
        <br />
        en <span className="text-accent">cada visita</span>
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
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-[#161310] to-bg">
      <div className="pointer-events-none absolute -right-16 -top-10 size-64 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative z-10 flex items-center gap-2 px-6 pt-[max(1.75rem,env(safe-area-inset-top))] sm:px-10">
        <div className="flex size-[30px] items-center justify-center rounded-lg bg-accent">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="2.4" />
            <circle cx="6" cy="18" r="2.4" />
            <path d="M20 5 8.5 14M8.5 10 20 19" />
          </svg>
        </div>
        <span className="font-display text-[19px] font-bold tracking-tight text-text">STYLERNOW</span>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-8 sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
        <div className="mb-7 flex size-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent-soft">
          {slide.icon}
        </div>
        <h1 className="font-display mb-3.5 text-[34px] font-bold uppercase leading-[1.08] tracking-tight text-text sm:text-4xl">
          {slide.title}
        </h1>
        <p className="max-w-[300px] text-[14.5px] leading-relaxed text-text-muted">{slide.description}</p>
      </div>

      <div className="relative z-10 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
        <div className="mb-5 flex justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              aria-label={`Ir al paso ${i + 1}`}
              onClick={() => setStep(i)}
              className={cn(
                "h-1 rounded-full transition-all",
                i === step ? "w-[22px] bg-accent" : "w-2 bg-border"
              )}
            />
          ))}
        </div>
        {isLast ? (
          <Button asChild size="lg" className="w-full">
            <Link href="/login">CONTINUAR</Link>
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={() => setStep((s) => s + 1)}>
            SIGUIENTE
          </Button>
        )}
        <div className="mt-4 text-center text-[13px] text-text-faint">
          Ya tengo cuenta ·{" "}
          <Link href="/login" className="font-semibold text-accent">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
