"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorForm } from "../_componentes/pantalla-auth";
import { restablecerContrasena } from "../actions";

export function VistaRecuperar() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await restablecerContrasena(password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.replace("/login?recuperada=1");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Input
        label="Contraseña nueva"
        type="password"
        required
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        label="Confirmar contraseña"
        type="password"
        required
        autoComplete="new-password"
        value={confirmar}
        onChange={(e) => setConfirmar(e.target.value)}
      />
      <p className="p-note normal-case">
        Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.
      </p>
      {error ? <ErrorForm>{error}</ErrorForm> : null}
      <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
        <span>Guardar contraseña</span>
        <ArrowUpRight className="size-[18px]" aria-hidden />
      </Button>
    </form>
  );
}
