"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { actualizarPerfil, cerrarSesion } from "./actions";

export function FormularioPerfil({
  nombreInicial,
  telefonoInicial,
  email,
  bienvenida,
}: {
  nombreInicial: string;
  telefonoInicial: string;
  email: string;
  /** true justo después del primer login — el teléfono todavía no existe. */
  bienvenida: boolean;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function onGuardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setGuardado(false);
    const res = await actualizarPerfil({ nombre, telefono });
    setGuardando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setGuardado(true);
    router.refresh();
  }

  async function onCerrarSesion() {
    setCerrando(true);
    await cerrarSesion();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {bienvenida ? (
        <div className="rounded-2xl border border-accent/40 bg-accent-soft p-4">
          <p className="text-[13.5px] font-bold text-text">¡Bienvenido a StylerNow!</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
            Contanos tu nombre y tu celular para que el negocio pueda avisarte de tu
            cita — solo te lo pedimos esta vez.
          </p>
        </div>
      ) : null}

      <form onSubmit={onGuardar} className="flex flex-col gap-4">
        <Input
          label="Nombre completo"
          required
          minLength={2}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Input label="Correo" value={email} disabled className="opacity-60" />
        <Input
          label="Celular (WhatsApp)"
          type="tel"
          placeholder="+57 300 000 0000"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
        <p className="text-[11.5px] text-text-faint">
          Lo usamos para recordatorios de tu cita y avisos de la lista de espera.
        </p>

        {error ? <p className="text-xs text-danger">{error}</p> : null}
        {guardado ? <p className="text-xs font-semibold text-success">Guardado.</p> : null}

        <Button type="submit" size="lg" loading={guardando} className="w-full">
          GUARDAR CAMBIOS
        </Button>
      </form>

      <Button
        variant="ghost"
        size="sm"
        loading={cerrando}
        onClick={onCerrarSesion}
        className="w-full"
      >
        Cerrar sesión
      </Button>
    </div>
  );
}
