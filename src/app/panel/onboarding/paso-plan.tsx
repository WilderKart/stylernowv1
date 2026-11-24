"use client";

import { elegirPais } from "@/app/panel/suscripcion/prueba";
import { CotizarSignature } from "@/components/planes/cotizar-signature";
import { Chip } from "@/components/brutal";
import { SelectorPlanes } from "@/components/planes/selector-planes";
import { Button } from "@/components/ui/button";
import type { CatalogoPais } from "@/lib/planes/catalogo";
import type { CicloFacturacion } from "@/lib/planes/precios";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { elegirPlan } from "./actions";
import { TituloPaso } from "./encabezado-pasos";

export function PasoPlan({
  negocioId,
  paisInicial,
  planInicial,
  catalogos,
  diasPrueba,
  onElegido,
  onVolver,
}: {
  negocioId: string;
  paisInicial: string;
  planInicial: string | null;
  catalogos: CatalogoPais[];
  diasPrueba: number;
  onElegido: (plan: string, pais: string, ciclo: CicloFacturacion) => void;
  onVolver: () => void;
}) {
  const [pais, setPais] = useState(paisInicial);
  const [plan, setPlan] = useState<string | null>(planInicial);
  const [ciclo, setCiclo] = useState<CicloFacturacion>("MENSUAL");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalogo = catalogos.find((c) => c.pais.codigo === pais) ?? catalogos[0];

  async function continuar() {
    setError(null);
    if (!plan) return setError("Elige un plan para continuar.");
    setGuardando(true);
    // El país define moneda y precios: se confirma en el servidor antes de fijar el plan.
    if (pais !== paisInicial) {
      const rp = await elegirPais(negocioId, pais);
      if (!rp.ok) {
        setGuardando(false);
        return setError(rp.error);
      }
    }
    const r = await elegirPlan(negocioId, plan as "ESSENTIAL" | "STUDIO" | "PRESTIGE");
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    onElegido(plan, pais, ciclo);
  }

  return (
    <div className="flex flex-col gap-6">
      <TituloPaso
        inicio="Elige"
        acento="tu plan."
        texto={`Prueba StylerNow durante ${diasPrueba} días gratis y descubre todo lo que puedes hacer.`}
      />

      {catalogos.length > 1 ? (
        <div className="flex flex-col gap-2">
          <span className="sn-label">País del negocio</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="País del negocio">
            {catalogos.map((c) => (
              <Chip
                key={c.pais.codigo}
                selected={c.pais.codigo === pais}
                onClick={() => {
                  setPais(c.pais.codigo);
                  setCiclo("MENSUAL");
                }}
              >
                {c.pais.nombre} · {c.pais.moneda}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {catalogo ? (
        <SelectorPlanes
          compacto
          catalogo={catalogo}
          value={plan}
          onChange={(codigo) => setPlan(codigo)}
          ciclo={ciclo}
          onCicloChange={setCiclo}
          deshabilitadoCodigos={["SIGNATURE"]}
          diasPrueba={diasPrueba}
        />
      ) : null}
      <p className="sn-meta">Los precios y límites salen de la configuración vigente de StylerNow.</p>
      <CotizarSignature />

      {error ? (
        <p role="alert" className="border-2 border-danger bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <Button type="button" variant="secondary" size="lg" onClick={onVolver}>
          Volver
        </Button>
        <Button type="button" size="lg" loading={guardando} onClick={continuar}>
          CONTINUAR <ArrowRight className="!size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
