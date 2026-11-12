"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/proveedor";
import { ErrorForm } from "../_componentes/pantalla-auth";
import { restablecerContrasena } from "../actions";

export function VistaRecuperar() {
  const router = useRouter();
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmar) {
      setError(t("login.no_coinciden"));
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
        label={t("login.contrasena_nueva")}
        type="password"
        required
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        label={t("login.confirmar")}
        type="password"
        required
        autoComplete="new-password"
        value={confirmar}
        onChange={(e) => setConfirmar(e.target.value)}
      />
      <p className="p-note normal-case">
        {t("login.nota_pw")}
      </p>
      {error ? <ErrorForm>{error}</ErrorForm> : null}
      <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
        <span>{t("login.guardar_pw")}</span>
        <ArrowUpRight className="size-[18px]" aria-hidden />
      </Button>
    </form>
  );
}
