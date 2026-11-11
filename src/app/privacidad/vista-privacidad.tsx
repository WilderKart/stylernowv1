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

type Clave = "analitica" | "personalizacion" | "ofertas_cercanas" | "beneficios_marcas";

const PROPOSITOS: { k: Clave; t: string; d: string }[] = [
  { k: "analitica", t: "Analítica de uso", d: "Cookies y datos anónimos para mejorar la app." },
  { k: "personalizacion", t: "Recomendaciones personalizadas", d: "Sugerirte negocios según tus citas anteriores." },
  { k: "ofertas_cercanas", t: "Ofertas de negocios cercanos", d: "Avisos de promociones a menos de 2 km." },
  { k: "beneficios_marcas", t: "Beneficios de marcas aliadas", d: "Compartir nombre y ciudad con marcas de cuidado personal." },
];

const NOMBRES: Record<PropositoConsentimiento, string> = {
  analitica: "Analítica de uso",
  personalizacion: "Recomendaciones personalizadas",
  ofertas_cercanas: "Ofertas de negocios cercanos",
  beneficios_marcas: "Beneficios de marcas",
  marketing_email: "Novedades por correo",
};

function nombreEvento(e: EventoHistorial) {
  if (e.tipo === "LEGAL") {
    const [doc, version] = e.proposito.split(" ");
    const base = doc === "TERMINOS" ? "Términos" : doc === "POLITICA_DATOS" ? "Política de datos" : doc;
    return `${base}${version ? ` · ${version}` : ""}`;
  }
  return NOMBRES[e.proposito as PropositoConsentimiento] ?? e.proposito;
}

function fechaCorta(iso: string) {
  const f = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short" }).formatToParts(new Date(iso));
  const d = f.find((p) => p.type === "day")?.value ?? "";
  const m = (f.find((p) => p.type === "month")?.value ?? "").replace(".", "");
  return `${d} ${m}`.toUpperCase();
}

export function VistaPrivacidad({ estado, historial, error }: { estado: EstadoConsentimiento[]; historial: EventoHistorial[]; error: string | null }) {
  // Sin evento = NO otorgado: el valor inicial sale siempre del backend, nunca premarcado.
  const [valores, setValores] = useState<Record<Clave, boolean>>(() => {
    const base: Record<Clave, boolean> = { analitica: false, personalizacion: false, ofertas_cercanas: false, beneficios_marcas: false };
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
      <Top titulo="/PERFIL/PRIVACIDAD" volverA="/perfil" />

      <div className="px-4 pt-3.5 pb-2.5">
        <Poster as="h1" size={2}>
          Tus datos.
          <br />
          <span className="sn-hot">Tus reglas.</span>
        </Poster>
      </div>

      <Sec derecha={<span className="sn-meta">{`${activas} DE 4`}</span>}>01 / Para qué usamos tus datos</Sec>
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
            <span className="body font-bold">Funcionamiento de la app</span>
            <span className="body-sm text-text-muted">Reservas, pagos y seguridad de tu cuenta.</span>
            <span className="sn-meta mt-1">NECESARIO · NO SE PUEDE DESACTIVAR</span>
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
            titulo={p.t}
            descripcion={p.d}
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
            PREFERENCIAS GUARDADAS
          </p>
        ) : null}
        <Button type="button" size="lg" loading={guardando} onClick={guardar} className="w-full justify-between">
          <span>Guardar preferencias</span>
          <ArrowUpRight aria-hidden className="size-5" />
        </Button>
      </div>

      <div className="px-4 pt-4">
        <h2 className="sn-num border-b-2 border-border pb-1.5">02 / Historial de cambios</h2>
        {historial.map((h, i) => (
          <div key={i} className="grid grid-cols-[62px_1fr_auto] items-center gap-2 border-b border-border-subtle py-[7px]">
            <span className="sn-meta">{fechaCorta(h.fecha)}</span>
            <span className="body-sm break-words">{nombreEvento(h)}</span>
            <span className={cn("sn-meta font-bold", h.valor === "ACEPTADO" ? "text-[var(--accent-text)]" : "text-text")}>{h.valor}</span>
          </div>
        ))}
        {historial.length === 0 ? <p className="sn-meta py-3">00 / SIN CAMBIOS TODAVÍA</p> : null}
      </div>

      <Link href="/legal/politica-de-datos" className="sn-label mx-4 mt-2 flex min-h-12 items-center justify-between text-[var(--accent-text)] no-underline">
        Política de privacidad y cookies <span aria-hidden>↗</span>
      </Link>
    </Pantalla>
  );
}
