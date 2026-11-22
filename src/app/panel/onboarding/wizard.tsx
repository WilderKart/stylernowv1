"use client";

import { FormularioSede } from "@/components/negocio/formulario-sede";
import { Button } from "@/components/ui/button";
import type { CatalogoPais } from "@/lib/planes/catalogo";
import type { CicloFacturacion } from "@/lib/planes/precios";
import { useState } from "react";
import type { ResumenAlta } from "./actions";
import { IndicadorPasos, Marca, TituloPaso } from "./encabezado-pasos";
import { PantallaListo } from "./pantalla-listo";
import { PasoActivar } from "./paso-activar";
import { PasoDatos } from "./paso-datos";
import { PasoPlan } from "./paso-plan";
import type { NegocioData, SedeData } from "./tipos";

/**
 * Alta del negocio en 4 pasos: Datos → Ubicación y horarios → Plan → Activar prueba (diseño del 2026-11-17).
 * Servicios y Staff ya no son parte del alta: se configuran después, en el panel.
 * El progreso vive en el servidor: al volver se retoma en el paso válido más avanzado (ver page.tsx).
 */
export function Wizard({
  perfilEmail,
  negocioInicial,
  sedeInicial,
  planInicial,
  pasoMaximoInicial,
  catalogos,
  diasPrueba,
  hayImagenes,
}: {
  perfilEmail: string;
  negocioInicial: NegocioData | null;
  sedeInicial: SedeData | null;
  planInicial: string | null;
  pasoMaximoInicial: number;
  catalogos: CatalogoPais[];
  diasPrueba: number;
  hayImagenes: boolean;
}) {
  const [negocio, setNegocio] = useState(negocioInicial);
  const [sede, setSede] = useState(sedeInicial);
  const [plan, setPlan] = useState(planInicial);
  const [ciclo, setCiclo] = useState<CicloFacturacion>("MENSUAL");
  const [paso, setPaso] = useState(pasoMaximoInicial);
  const [maximo, setMaximo] = useState(pasoMaximoInicial);
  const [resumen, setResumen] = useState<ResumenAlta | null>(null);

  const pais = negocio?.pais_codigo ?? catalogos[0]?.pais.codigo ?? "CO";
  const nombreDePlan = (codigo: string) =>
    catalogos.flatMap((c) => c.planes).find((p) => p.codigo === codigo)?.nombre ?? codigo.charAt(0) + codigo.slice(1).toLowerCase();

  function ir(n: number) {
    setPaso(n);
    setMaximo((m) => Math.max(m, n));
    window.scrollTo({ top: 0 });
  }

  if (resumen) {
    return (
      <div className="min-h-dvh bg-app">
        <Marca />
        <main className="mx-auto w-full max-w-lg px-5 py-8 pb-16">
          <PantallaListo resumen={resumen} planNombre={nombreDePlan(resumen.planCodigo)} diasPrueba={diasPrueba} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-app">
      <Marca />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-7 px-5 py-6 pb-20">
        <IndicadorPasos actual={paso} maximo={maximo} onIr={ir} />

        {paso === 1 ? (
          <PasoDatos
            negocio={negocio}
            perfilEmail={perfilEmail}
            hayImagenes={hayImagenes}
            onGuardado={setNegocio}
            onContinuar={() => ir(2)}
          />
        ) : null}

        {paso === 2 && negocio ? (
          <div className="flex flex-col gap-6">
            <TituloPaso inicio="Ubicación y" acento="horarios." texto="Define dónde está tu negocio y cuándo atiendes." />
            <FormularioSede
              negocioId={negocio.id}
              sedeExistente={sede}
              textoBoton="CONTINUAR"
              exigirUbicacion
              ciudadInicial={negocio.ciudad}
              onGuardado={(guardada) => {
                setSede({ ...guardada, horario_base: sede?.horario_base ?? null });
                ir(3);
              }}
            />
            <Button type="button" variant="secondary" size="lg" onClick={() => ir(1)}>
              Volver
            </Button>
          </div>
        ) : null}

        {paso === 3 && negocio ? (
          <PasoPlan
            negocioId={negocio.id}
            paisInicial={pais}
            planInicial={plan}
            catalogos={catalogos}
            diasPrueba={diasPrueba}
            onVolver={() => ir(2)}
            onElegido={(p, paisElegido, c) => {
              setPlan(p);
              setCiclo(c);
              setNegocio((n) => (n ? { ...n, pais_codigo: paisElegido } : n));
              ir(4);
            }}
          />
        ) : null}

        {paso === 4 && negocio && plan ? (
          <PasoActivar
            negocioId={negocio.id}
            plan={plan}
            planNombre={nombreDePlan(plan)}
            ciclo={ciclo}
            telefonoInicial={negocio.telefono_contacto ?? ""}
            diasPrueba={diasPrueba}
            onVolver={() => ir(3)}
            onListo={setResumen}
          />
        ) : null}
      </main>
    </div>
  );
}
