"use client";

import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/proveedor";
import { CampoContrasena, Coincidencia, RequisitosContrasena, cumpleReglas } from "../_componentes/campos";
import { ErrorForm } from "../_componentes/pantalla-auth";
import { restablecerContrasena } from "../actions";

/** RECUPERAR, paso 2: contraseña nueva + confirmación. Al guardar se cierran todas las sesiones. */
export function VistaRecuperar() {
  const router = useRouter();
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cumpleReglas(password)) return setError(t("auth.err_pw"));
    if (password !== confirmar) return setError(t("login.no_coinciden"));
    setLoading(true);
    setError(null);
    const res = await restablecerContrasena(password);
    if (!res.ok) {
      setLoading(false);
      setError(res.error);
      return;
    }
    router.replace("/login?recuperada=1");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <CampoContrasena label={t("login.contrasena_nueva")} value={password} onChange={setPassword} autoComplete="new-password" describedBy="requisitos-nueva" />
        <RequisitosContrasena password={password} id="requisitos-nueva" />
      </div>
      <div className="flex flex-col gap-2">
        <CampoContrasena label={t("auth.confirmar")} value={confirmar} onChange={setConfirmar} autoComplete="new-password" />
        <Coincidencia password={password} confirmar={confirmar} />
      </div>
      {error ? <ErrorForm>{error}</ErrorForm> : null}
      <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
        <span>{t("login.guardar_pw")}</span>
        <ArrowUpRight className="size-[18px]" aria-hidden />
      </Button>
    </form>
  );
}
