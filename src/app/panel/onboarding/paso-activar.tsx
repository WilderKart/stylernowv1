"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { obtenerDispositivoId, rasgosDelEquipo } from "@/lib/prueba/huella-dispositivo";
import type { CicloFacturacion } from "@/lib/planes/precios";
import { cn } from "@/lib/utils";
import { Check, CreditCard, Gift, Info } from "lucide-react";
import { useState } from "react";
import { activarPruebaYCompletar, type ResumenAlta } from "./actions";
import { TituloPaso } from "./encabezado-pasos";

export function PasoActivar({
  negocioId,
  plan,
  planNombre,
  ciclo,
  telefonoInicial,
  diasPrueba,
  onVolver,
  onListo,
}: {
  negocioId: string;
  plan: string;
  planNombre: string;
  ciclo: CicloFacturacion;
  telefonoInicial: string;
  diasPrueba: number;
  onVolver: () => void;
  onListo: (r: ResumenAlta) => void;
}) {
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [documento, setDocumento] = useState("");
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (telefono.replace(/\D/g, "").length < 7) return setError("Escribe un teléfono válido.");
    if (documento.trim().length < 5) return setError("Escribe el documento o NIT del titular del negocio.");
    setActivando(true);
    const r = await activarPruebaYCompletar({
      negocioId,
      plan: plan as "ESSENTIAL" | "STUDIO" | "PRESTIGE",
      ciclo,
      telefono,
      documento,
      dispositivoId: obtenerDispositivoId(),
      equipo: rasgosDelEquipo(),
      metodoPagoToken: "", // prueba sin tarjeta; no se solicita ni guarda ningún dato de pago aquí
    });
    setActivando(false);
    if (!r.ok) return setError(r.error);
    onListo(r.data);
  }

  return (
    <form onSubmit={activar} className="flex flex-col gap-6" noValidate>
      <TituloPaso
        inicio={`Activa tu prueba de`}
        acento={`${diasPrueba} días.`}
        texto={`Elige cómo quieres iniciar tu prueba del plan ${planNombre}. No se cobra nada al activarla.`}
      />

      <div className="flex flex-col gap-3">
        <div className="border-2 border-ink bg-accent-soft p-4 shadow-hard" aria-label="Opción seleccionada">
          <div className="flex items-start gap-3">
            <Gift className="mt-0.5 !size-6 shrink-0 text-accent" aria-hidden />
            <div className="flex flex-1 flex-col gap-1">
              <p className="font-display text-[15px] font-bold uppercase text-text">Probar sin tarjeta</p>
              <p className="text-[13px] leading-relaxed text-text-muted">
                Activa tu plan ahora y agrega un método de pago antes de terminar los {diasPrueba} días.
              </p>
            </div>
            <span aria-hidden className="mt-1 flex size-5 shrink-0 items-center justify-center border-2 border-ink bg-ink text-signal">
              <Check className="!size-3.5" />
            </span>
          </div>
        </div>

        <div className={cn("border-2 border-dashed border-border p-4")}>
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 !size-6 shrink-0 text-text-muted" aria-hidden />
            <div className="flex flex-1 flex-col gap-1">
              <p className="font-display text-[15px] font-bold uppercase text-text">Agregar método de pago</p>
              <p className="text-[13px] leading-relaxed text-text-muted">
                Se hace desde «Plan y facturación» una vez activa tu prueba. Los métodos disponibles dependen de tu país. PSE, cuando esté
                disponible, es un pago puntual por periodo: no se renueva solo.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 border-2 border-border p-4">
        <Info className="mt-0.5 !size-5 shrink-0 text-accent" aria-hidden />
        <p className="text-[13px] leading-relaxed text-text-muted">
          <b className="text-text">Importante.</b> Al concluir los {diasPrueba} días, si no pagas tu plan, las funciones del negocio se
          limitarán hasta que lo actives. No borramos tu información.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-[12.5px] text-text-muted">
          Para evitar pruebas repetidas necesitamos estos datos. No se publican ni se usan para cobrar.
        </p>
        <Input label="Teléfono del titular" type="tel" required value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        <Input
          label="Documento o NIT del titular"
          required
          autoComplete="off"
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="border-2 border-danger bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <Button type="button" variant="secondary" size="lg" onClick={onVolver} disabled={activando}>
          Volver
        </Button>
        <Button type="submit" size="lg" loading={activando}>
          ACTIVAR PRUEBA <Check className="!size-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
