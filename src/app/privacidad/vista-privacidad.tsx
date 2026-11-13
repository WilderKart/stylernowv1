"use client";

import { ErrorAviso, Pantalla, Sec, Top } from "@/app/lealtad/ui-cliente";
import { Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Casilla } from "@/components/privacidad/casilla";
import type { EstadoConsentimiento, EventoHistorial, PropositoConsentimiento } from "@/lib/cliente/privacidad";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { guardarPreferenciasPrivacidad } from "./actions";
import { useIdioma, useT } from "@/lib/i18n/proveedor";
import type { Traductor } from "@/lib/i18n/diccionario";

type Clave = "analitica" | "personalizacion" | "ofertas_cercanas" | "beneficios_marcas" | "marketing_whatsapp";

const PROPOSITOS = [
  { k: "analitica", t: "priv.p_analitica", d: "priv.p_analitica_d" },
  { k: "personalizacion", t: "priv.p_personalizacion", d: "priv.p_personalizacion_d" },
  { k: "ofertas_cercanas", t: "priv.p_ofertas", d: "priv.p_ofertas_d" },
  { k: "beneficios_marcas", t: "priv.p_marcas", d: "priv.p_marcas_d" },
  { k: "marketing_whatsapp", t: "priv.p_whatsapp", d: "priv.p_whatsapp_d" },
] as const;

const NOMBRES = {
  analitica: "priv.p_analitica",
  personalizacion: "priv.p_personalizacion",
  ofertas_cercanas: "priv.p_ofertas",
  beneficios_marcas: "priv.n_marcas",
  marketing_email: "priv.n_email",
  marketing_whatsapp: "priv.p_whatsapp",
} as const satisfies Record<PropositoConsentimiento, string>;

function nombreEvento(e: EventoHistorial, t: Traductor) {
  if (e.tipo === "LEGAL") {
    const [doc, version] = e.proposito.split(" ");
    const base = doc === "TERMINOS" ? t("priv.terminos") : doc === "POLITICA_DATOS" ? t("priv.politica_datos") : doc;
    return `${base}${version ? ` · ${version}` : ""}`;
  }
  const clave = NOMBRES[e.proposito as PropositoConsentimiento];
  return clave ? t(clave) : e.proposito;
}

function fechaCorta(iso: string, loc: string) {
  const f = new Intl.DateTimeFormat(loc, { timeZone: "America/Bogota", day: "2-digit", month: "short" }).formatToParts(new Date(iso));
  const d = f.find((p) => p.type === "day")?.value ?? "";
  const m = (f.find((p) => p.type === "month")?.value ?? "").replace(".", "");
  return `${d} ${m}`.toUpperCase();
}

export function VistaPrivacidad({ estado, historial, error }: { estado: EstadoConsentimiento[]; historial: EventoHistorial[]; error: string | null }) {
  const t = useT();
  const idioma = useIdioma();
  // Sin evento = NO otorgado: el valor inicial sale siempre del backend, nunca premarcado.
  const [valores, setValores] = useState<Record<Clave, boolean>>(() => {
    const base: Record<Clave, boolean> = { analitica: false, personalizacion: false, ofertas_cercanas: false, beneficios_marcas: false, marketing_whatsapp: false };
    for (const e of estado) if (e.proposito in base) base[e.proposito as Clave] = e.otorgado === true;
    return base;
  });
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const activas = PROPOSITOS.filter((p) => valores[p.k]).length;

  async function guardar() {
    setGuardando(true);
    setFallo(null);
    setGuardado(false);
    const r = await guardarPreferenciasPrivacidad(valores);
    setGuardando(false);
    if (!r.ok) {
      setFallo(r.error);
      return;
    }
    setGuardado(true);
  }

  return (
    <Pantalla className="pb-8">
      <Top titulo={t("priv.top")} volverA="/perfil" />

      <div className="px-4 pt-3.5 pb-2.5">
        <Poster as="h1" size={2}>
          {t("priv.t1")}
          <br />
          <span className="sn-hot">{t("priv.t2")}</span>
        </Poster>
      </div>

      <Sec derecha={<span className="sn-meta">{t("priv.activas", { n: activas, total: PROPOSITOS.length })}</span>}>{t("priv.sec_para_que")}</Sec>
      <div className="border-t-2 border-border px-4">
        {error ? (
          <div className="py-3">
            <ErrorAviso>{error}</ErrorAviso>
          </div>
        ) : null}
        <div className="grid grid-cols-[28px_1fr] items-start gap-3 border-b border-border-subtle py-2.5">
          <span aria-hidden className="grid size-7 place-items-center border-2 border-dashed border-text-muted bg-surface text-text-muted">
            <Check className="size-4" strokeWidth={2.4} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="body font-bold">{t("priv.func")}</span>
            <span className="body-sm text-text-muted">{t("priv.func_d")}</span>
            <span className="sn-meta mt-1">{t("priv.necesario")}</span>
          </span>
        </div>
        {PROPOSITOS.map((p) => (
          <Casilla
            key={p.k}
            checked={valores[p.k]}
            onChange={(v) => {
              setGuardado(false);
              setValores((s) => ({ ...s, [p.k]: v }));
            }}
            titulo={t(p.t)}
            descripcion={t(p.d)}
          />
        ))}
      </div>

      <div className="px-4 pt-3">
        {fallo ? (
          <div className="pb-3">
            <ErrorAviso>{fallo}</ErrorAviso>
          </div>
        ) : null}
        {guardado ? (
          <p role="status" className="sn-meta pb-3">
            {t("priv.guardadas")}
          </p>
        ) : null}
        <Button type="button" size="lg" loading={guardando} onClick={guardar} className="w-full justify-between">
          <span>{t("priv.guardar")}</span>
          <ArrowUpRight aria-hidden className="size-5" />
        </Button>
      </div>

      <div className="px-4 pt-4">
        <h2 className="sn-num border-b-2 border-border pb-1.5">{t("priv.sec_historial")}</h2>
        {historial.map((h, i) => (
          <div key={i} className="grid grid-cols-[62px_1fr_auto] items-center gap-2 border-b border-border-subtle py-[7px]">
            <span className="sn-meta">{fechaCorta(h.fecha, idioma === "en" ? "en-US" : "es-CO")}</span>
            <span className="body-sm break-words">{nombreEvento(h, t)}</span>
            <span className={cn("sn-meta font-bold", h.valor === "ACEPTADO" ? "text-[var(--accent-text)]" : "text-text")}>{h.valor}</span>
          </div>
        ))}
        {historial.length === 0 ? <p className="sn-meta py-3">{t("priv.sin_cambios")}</p> : null}
      </div>

      <Link href="/legal/politica-de-datos" className="sn-label mx-4 mt-2 flex min-h-12 items-center justify-between text-[var(--accent-text)] no-underline">
        {t("priv.politica_cookies")} <span aria-hidden>↗</span>
      </Link>
    </Pantalla>
  );
}
