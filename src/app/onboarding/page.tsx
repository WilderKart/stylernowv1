"use client";

import { Num, Photo, Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/proveedor";
import type { Traductor } from "@/lib/i18n/diccionario";

const SLIDES = [
  {
    title: (t: Traductor) => (
      <>
        {t("ob.s1_1")}
        <br />
        {t("ob.s1_2")}
        <br />
        <span className="sn-hot">{t("ob.s1_3")}</span>
      </>
    ),
    description: "ob.s1_d",
  },
  {
    title: (t: Traductor) => (
      <>
        {t("ob.s2_1")}
        <br />
        {t("ob.s2_2")} <span className="sn-hot">{t("ob.s2_3")}</span>
      </>
    ),
    description: "ob.s2_d",
  },
  {
    title: (t: Traductor) => (
      <>
        {t("ob.s3_1")}
        <br />
        {t("ob.s3_2")} <span className="sn-hot">{t("ob.s3_3")}</span>
      </>
    ),
    description: "ob.s3_d",
  },
] as const;

export default function OnboardingPage() {
  const t = useT();
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
          {slide.title(t)}
        </Poster>
        <p className="body mx-4 mb-5 text-text-muted">{t(slide.description)}</p>

        <div className="mx-4 mb-5 grid border-2 border-border" style={{ gridTemplateColumns: `repeat(${SLIDES.length}, minmax(0, 1fr))` }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t("ob.ir_paso", { n: i + 1 })}
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
            <Link href="/login">{t("ob.saltar")}</Link>
          </Button>
          {isLast ? (
            <Button asChild size="lg" className="justify-between">
              <Link href="/login">
                <span>{t("comun.continuar")}</span>
                <ArrowUpRight className="size-[18px]" aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button size="lg" className="justify-between" onClick={() => setStep((s) => s + 1)}>
              <span>{t("ob.siguiente")}</span>
              <ArrowUpRight className="size-[18px]" aria-hidden />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
