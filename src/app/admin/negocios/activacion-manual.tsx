"use client";

import { Chip, ChipGroup } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { activarPlanManual, type ActivacionManualInput } from "../actions";

type Tipo = NonNullable<ActivacionManualInput["tipo"]>;

const TIPOS: { valor: Tipo; etiqueta: string; ayuda: string }[] = [
  { valor: "TRANSFERENCIA", etiqueta: "Transferencia", ayuda: "Pago por Nequi o banco; exige referencia del comprobante." },
  { valor: "CORTESIA", etiqueta: "Cortesía", ayuda: "Cliente piloto o aliado comercial." },
  { valor: "CONTINGENCIA_PASARELA", etiqueta: "Falla de pasarela", ayuda: "La pasarela no cobró; se habilita mientras se resuelve." },
];

/**
 * Plan de contingencia de SuperSU: pasar un negocio a TRIAL o ACTIVA a mano (o revertirlo).
 * Todo queda auditado con motivo; el cron nunca cobra una activación manual.
 */
export function ActivacionManual({ negocioId, nombre, planActual, onHecho }: { negocioId: string; nombre: string; planActual: string; onHecho: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState<"TRIAL" | "ACTIVA" | "REQUIERE_PLAN">("ACTIVA");
  const [plan, setPlan] = useState<ActivacionManualInput["plan"]>(
    (["ESSENTIAL", "STUDIO", "PRESTIGE", "SIGNATURE"].includes(planActual) ? planActual : "STUDIO") as ActivacionManualInput["plan"],
  );
  const [tipo, setTipo] = useState<Tipo>("TRANSFERENCIA");
  const [motivo, setMotivo] = useState("");
  const [dias, setDias] = useState("30");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revertir = estado === "REQUIERE_PLAN";

  async function enviar() {
    setError(null);
    if (motivo.trim().length < 5) return setError("Escribe el motivo (mínimo 5 caracteres).");
    if (estado === "TRIAL" && !dias.trim()) return setError("Indica cuántos días dura la prueba.");
    setGuardando(true);
    const res = await activarPlanManual({
      negocioId,
      estado,
      plan,
      tipo: revertir ? null : tipo,
      motivo,
      dias: dias.trim() ? Number(dias) : null,
      referencia: referencia || null,
    });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setAbierto(false);
    setMotivo("");
    setReferencia("");
    onHecho();
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Plan manual
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan manual · {nombre}</DialogTitle>
          <DialogDescription>
            Plan de contingencia. Queda auditado con tu motivo y el sistema no intenta cobrarlo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <span className="sn-label">Estado</span>
            <ChipGroup className="mt-2">
              <Chip selected={estado === "ACTIVA"} onClick={() => setEstado("ACTIVA")}>Activo</Chip>
              <Chip selected={estado === "TRIAL"} onClick={() => setEstado("TRIAL")}>Prueba</Chip>
              <Chip selected={estado === "REQUIERE_PLAN"} onClick={() => setEstado("REQUIERE_PLAN")}>Revertir</Chip>
            </ChipGroup>
          </div>

          <div>
            <span className="sn-label">Plan</span>
            <ChipGroup className="mt-2">
              {(["ESSENTIAL", "STUDIO", "PRESTIGE", "SIGNATURE"] as const).map((p) => (
                <Chip key={p} selected={plan === p} onClick={() => setPlan(p)}>
                  {p}
                </Chip>
              ))}
            </ChipGroup>
          </div>

          {!revertir ? (
            <>
              <div>
                <span className="sn-label">Motivo de la activación</span>
                <ChipGroup className="mt-2">
                  {TIPOS.map((t) => (
                    <Chip key={t.valor} selected={tipo === t.valor} onClick={() => setTipo(t.valor)}>
                      {t.etiqueta}
                    </Chip>
                  ))}
                </ChipGroup>
                <p className="sn-meta mt-2">{TIPOS.find((t) => t.valor === tipo)?.ayuda}</p>
              </div>

              <Input
                label={estado === "TRIAL" ? "Días de prueba" : "Vigencia en días (vacío = sin vencimiento)"}
                inputMode="numeric"
                value={dias}
                onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))}
              />
              {tipo === "TRANSFERENCIA" ? (
                <Input label="Referencia del comprobante" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ej. NEQUI-8841" />
              ) : null}
            </>
          ) : null}

          <Input label="Motivo (queda en auditoría)" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Pago recibido por Nequi el 10/11" />

          {error ? (
            <p role="alert" className="sn-help sn-help--error">
              {error}
            </p>
          ) : null}

          <Button loading={guardando} onClick={enviar} className="w-full">
            {revertir ? "Revertir a requiere plan" : estado === "TRIAL" ? "Activar prueba" : "Activar plan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
