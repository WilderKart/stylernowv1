"use client";

import { ErrorAviso, Pie } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import type { Idioma, Pais } from "@/lib/cliente/preferencias";
import { useEnLinea } from "@/lib/hooks/use-en-linea";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarIdiomaRegionAction } from "../actions";
import { useT } from "@/lib/i18n/proveedor";

const PAISES = [
  { codigo: "CO", nombre: "aj.pais_co", formato: "COP · $ 45.000 · 15:30" },
  { codigo: "US", nombre: "aj.pais_us", formato: "USD · $45.00 · 3:30 PM" },
  { codigo: "MX", nombre: "aj.pais_mx", formato: "MXN · $450.00 · 15:30" },
  { codigo: "ES", nombre: "aj.pais_es", formato: "EUR · 45,00 € · 15:30" },
] as const satisfies readonly { codigo: Pais; nombre: string; formato: string }[];

const IDIOMAS: { codigo: Idioma; nombre: string }[] = [
  { codigo: "es", nombre: "Español" },
  { codigo: "en", nombre: "English" },
];

export function FormIdiomaRegion({
  paisInicial,
  localeInicial,
  enOnboarding,
}: {
  paisInicial: Pais;
  localeInicial: Idioma;
  enOnboarding: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const enLinea = useEnLinea();
  const [pais, setPais] = useState<Pais>(paisInicial);
  const [locale, setLocale] = useState<Idioma>(localeInicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const formato = PAISES.find((p) => p.codigo === pais)?.formato ?? "";

  function continuar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarIdiomaRegionAction(pais, locale);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(enOnboarding ? "/ajustes/permisos" : "/perfil");
    });
  }

  return (
    <>
      <div className="p-top">
        <span className="sn-header__title pl-3">
          Styler<span className="sn-hot">Now</span>.
        </span>
        <span className="sn-num flex-none text-right">{enOnboarding ? t("aj.paso_1") : t("aj.ajustes")}</span>
      </div>
      {enOnboarding ? (
        <div aria-hidden className="flex gap-1 px-4 pt-3">
          <span className="h-1.5 flex-1 bg-signal" />
          <span className="h-1.5 flex-1 bg-border-subtle" />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col pb-4">
        <h1 className="poster-2 break-words px-4 pt-4">
          {t("aj.donde_1")}
          <br />
          <span className="sn-hot">{t("aj.donde_2")}</span>
        </h1>
        <p className="body-sm px-4 pt-2 pb-2 text-text-muted">{t("aj.donde_txt")}</p>

        <div className="p-sec">
          <h2 className="sn-num">{t("aj.sec_pais")}</h2>
        </div>
        <div role="radiogroup" aria-label={t("aj.pais")} className="mx-4 flex flex-col border-2 border-border">
          {PAISES.map((p, i) => {
            const on = pais === p.codigo;
            return (
              <button
                key={p.codigo}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPais(p.codigo)}
                className={cn(
                  "flex min-h-14 w-full cursor-pointer items-center gap-4 px-4 text-left",
                  i > 0 && "border-t-2 border-border",
                  on ? "bg-signal text-ink" : "bg-transparent text-text",
                )}
              >
                <span className="sn-label w-8 flex-none">{p.codigo}</span>
                <span className="sn-label min-w-0 flex-1 break-words">{t(p.nombre)}</span>
              </button>
            );
          })}
        </div>

        <div className="p-sec">
          <h2 className="sn-num">{t("aj.sec_idioma")}</h2>
        </div>
        <div role="radiogroup" aria-label={t("aj.idioma")} className="mx-4 flex border-2 border-border">
          {IDIOMAS.map((g, i) => {
            const on = locale === g.codigo;
            return (
              <button
                key={g.codigo}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setLocale(g.codigo)}
                className={cn(
                  "sn-label flex min-h-12 flex-1 cursor-pointer items-center justify-center",
                  i === 0 && "border-r-2 border-border",
                  on ? "bg-text text-bg" : "bg-transparent text-text",
                )}
              >
                {g.nombre}
              </button>
            );
          })}
        </div>

        <p className="sn-meta px-4 pt-4 break-words">{t("aj.formato", { formato })}</p>
      </div>

      <Pie>
        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
        {!enLinea ? <p role="status" className="sn-meta">{t("aj.sin_conexion")}</p> : null}
        <Button size="lg" className="w-full justify-between shadow-[var(--sn-shadow-hard)]" loading={pendiente} disabled={!enLinea} onClick={continuar}>
          <span>{t("comun.continuar")}</span> <span aria-hidden>↗</span>
        </Button>
        {!enOnboarding ? (
          <Link href="/perfil" className="sn-label flex min-h-12 items-center justify-center text-text no-underline">
            {t("aj.volver_perfil")}
          </Link>
        ) : null}
      </Pie>
    </>
  );
}
